-- Public Overture Places only. This migration does not change private leads/statuses.
-- SQL Editor can execute imports as database owner. Application browsers can only read.
create table if not exists public.catalog_regions (
 id text primary key, name text not null, bounds jsonb not null,
 release text not null, imported_at timestamptz not null
);
create table if not exists public.catalog_places (
 business_id text primary key, lat double precision not null, lon double precision not null,
 release text not null, record jsonb not null,
 check (lat between 54.4 and 57.9 and lon between 7.8 and 15.3)
);
create table if not exists public.catalog_membership (
 region_id text references public.catalog_regions(id),
 business_id text references public.catalog_places(business_id),
 primary key (region_id,business_id)
);
create index if not exists catalog_lat on public.catalog_places(lat);
create index if not exists catalog_lon on public.catalog_places(lon);
alter table public.catalog_regions enable row level security;
alter table public.catalog_places enable row level security;
alter table public.catalog_membership enable row level security;
revoke all on public.catalog_regions, public.catalog_places, public.catalog_membership from anon, authenticated;
grant select on public.catalog_regions, public.catalog_places, public.catalog_membership to anon, authenticated;
drop policy if exists "Read public company catalog" on public.catalog_regions;
create policy "Read public company catalog" on public.catalog_regions for select to anon, authenticated using (true);
drop policy if exists "Read public company catalog" on public.catalog_places;
create policy "Read public company catalog" on public.catalog_places for select to anon, authenticated using (true);
drop policy if exists "Read public company catalog" on public.catalog_membership;
create policy "Read public company catalog" on public.catalog_membership for select to anon, authenticated using (true);

-- Compare numeric release suffixes (.10 follows .2). No import mutates unrelated records.
create or replace function public.webhunt_release_key(edition text) returns numeric[]
language sql immutable strict set search_path=pg_catalog as $$
 select array[replace(split_part(edition,'.',1),'-','')::numeric,split_part(edition,'.',2)::numeric];
$$;

create or replace function public.webhunt_import_region(snapshot jsonb) returns integer
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_region_id text := snapshot#>>'{region,id}'; edition text := snapshot->>'release'; item jsonb; total integer; previous_ids text[];
begin
 perform pg_advisory_xact_lock(872613420);
 if snapshot->>'version' <> '1' or v_region_id !~ '^[a-z0-9-]{1,60}$' or edition !~ '^\d{4}-\d{2}-\d{2}\.\d+$' or jsonb_typeof(snapshot->'records') <> 'array' or jsonb_array_length(snapshot->'records') = 0 then
   raise exception 'Invalid or empty import; previous data preserved';
 end if;
 if exists (select 1 from public.catalog_regions r where r.id=v_region_id and public.webhunt_release_key(r.release)>public.webhunt_release_key(edition)) then raise exception 'Cannot replace newer release'; end if;
 insert into public.catalog_regions values(v_region_id,snapshot#>>'{region,name}',snapshot#>'{region,bounds}',edition,(snapshot->>'importedAt')::timestamptz)
 on conflict(id) do update set name=excluded.name,bounds=excluded.bounds,release=excluded.release,imported_at=excluded.imported_at;
 select array_agg(m.business_id) into previous_ids from public.catalog_membership m where m.region_id=v_region_id;
 delete from public.catalog_membership m where m.region_id=v_region_id;
 for item in select value from jsonb_array_elements(snapshot->'records') loop
   if item->>'id' not like 'overture/%' or item->>'source' <> 'Overture Maps' or nullif(item->>'name','') is null or jsonb_array_length(item->'licenses')=0 then raise exception 'Invalid source record'; end if;
   insert into public.catalog_places values(item->>'id',(item->>'lat')::double precision,(item->>'lon')::double precision,edition,item)
   on conflict(business_id) do update set lat=excluded.lat,lon=excluded.lon,release=excluded.release,record=excluded.record where public.webhunt_release_key(excluded.release)>=public.webhunt_release_key(catalog_places.release);
   insert into public.catalog_membership values(v_region_id,item->>'id') on conflict do nothing;
 end loop;
 delete from public.catalog_places p where p.business_id=any(previous_ids) and not exists(select 1 from public.catalog_membership m where m.business_id=p.business_id);
 total:=jsonb_array_length(snapshot->'records');
 return total;
end $$;
revoke all on function public.webhunt_import_region(jsonb) from public, anon, authenticated;
grant execute on function public.webhunt_import_region(jsonb) to service_role;

create or replace function public.webhunt_businesses(south double precision,west double precision,north double precision,east double precision) returns jsonb
language plpgsql stable security invoker set search_path = pg_catalog, public as $$
declare results jsonb; regions jsonb; total integer; oldest timestamptz; old_release boolean; covered boolean;
begin
 if not (south>=54.4 and north<=57.9 and west>=7.8 and east<=15.3 and south<north and west<east) then raise exception 'Invalid Danish bounds'; end if;
 select coalesce(jsonb_agg(q.record order by q.business_id),'[]'::jsonb),count(*) into results,total from
 (select p.business_id,p.record from public.catalog_places p where p.lat between south and north and p.lon between west and east order by p.business_id limit 601) q;
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'bounds',r.bounds,'release',r.release,'importedAt',r.imported_at)),'[]'::jsonb),min(r.imported_at),coalesce(bool_or(left(r.release,10)::date < current_date-90),false),
 coalesce(bool_or((r.bounds->>0)::double precision<=west and (r.bounds->>1)::double precision<=south and (r.bounds->>2)::double precision>=east and (r.bounds->>3)::double precision>=north),false)
 into regions,oldest,old_release,covered from public.catalog_regions r;
 if total>600 then results:=results-600; end if;
 return jsonb_build_object('businesses',results,'cached',true,'stale',old_release,'partial',not covered,'overview',(north-south)*(east-west)>.6,'limited',total>600,'source','Overture Maps · egen database','fetchedAt',oldest,'regions',regions,
 'warning',concat_ws(' ',case when not covered then 'Dækningen er begrænset til de importerede områder; første område er Nykøbing Falster.' end,case when old_release then 'En udgivelse er over 90 dage gammel; importerede data bevares.' end));
end $$;
revoke all on function public.webhunt_businesses(double precision,double precision,double precision,double precision) from public;
grant execute on function public.webhunt_businesses(double precision,double precision,double precision,double precision) to anon, authenticated;
notify pgrst, 'reload schema';

-- Phase 1–2 additive read helpers. Existing tables, records, imports and private RLS remain intact.
create or replace function public.webhunt_catalog_category(b jsonb) returns text
language sql immutable set search_path=pg_catalog as $$
 select case replace(lower(coalesce(b->>'category','Virksomhed')),' ','_')
WHEN 'restaurant' THEN 'Restaurant'
WHEN 'cafe' THEN 'Café'
WHEN 'fast_food' THEN 'Takeaway'
WHEN 'bar' THEN 'Bar'
WHEN 'pub' THEN 'Pub'
WHEN 'hairdresser' THEN 'Frisør'
WHEN 'hair_salon' THEN 'Frisør'
WHEN 'beauty_salon' THEN 'Skønhed'
WHEN 'real_estate_agent' THEN 'Ejendomsmægler'
WHEN 'auto_repair' THEN 'Autoværksted'
WHEN 'clothing_store' THEN 'Tøjbutik'
WHEN 'beauty' THEN 'Skønhed'
WHEN 'bakery' THEN 'Bager'
WHEN 'supermarket' THEN 'Supermarked'
WHEN 'clothes' THEN 'Tøjbutik'
WHEN 'florist' THEN 'Blomster'
WHEN 'car_repair' THEN 'Autoværksted'
WHEN 'dentist' THEN 'Tandlæge'
WHEN 'pharmacy' THEN 'Apotek'
WHEN 'hotel' THEN 'Hotel'
WHEN 'guest_house' THEN 'Overnatning'
WHEN 'carpenter' THEN 'Tømrer'
WHEN 'electrician' THEN 'Elektriker'
WHEN 'plumber' THEN 'VVS'
WHEN 'estate_agent' THEN 'Ejendomsmægler'
WHEN 'convenience' THEN 'Dagligvarer'
WHEN 'optician' THEN 'Optiker'
WHEN 'bicycle' THEN 'Cykelbutik'
WHEN 'butcher' THEN 'Slagter'
WHEN 'furniture' THEN 'Møbler'
WHEN 'shoes' THEN 'Sko'
WHEN 'jewelry' THEN 'Smykker'
 else coalesce(b->>'category','Virksomhed') end
$$;

create or replace function public.webhunt_catalog_page(
 south double precision, west double precision, north double precision, east double precision,
 search_text text default '', industry text default '', page_offset integer default 0
) returns jsonb
language plpgsql stable security invoker set search_path=pg_catalog,public as $$
declare result jsonb; items jsonb; matched bigint; total bigint; kinds jsonb; revision text;
begin
 if page_offset<0 or page_offset>500000 or length(search_text)>120 or length(industry)>100 then raise exception 'Invalid catalog query'; end if;
 result:=public.webhunt_businesses(south,west,north,east);
 select count(*) into total from public.catalog_places;
 select count(*) into matched from public.catalog_places p where p.lat between south and north and p.lon between west and east
 and (search_text='' or strpos(lower(concat_ws(' ',p.record->>'name',p.record->>'address',p.record->>'city',p.record->>'postcode',public.webhunt_catalog_category(p.record),p.record->>'cvr')),lower(search_text))>0)
 and (industry='' or public.webhunt_catalog_category(p.record)=industry);
 select coalesce(jsonb_agg(q.record order by q.business_id),'[]'::jsonb) into items from (
 select p.business_id,p.record from public.catalog_places p where p.lat between south and north and p.lon between west and east
 and (search_text='' or strpos(lower(concat_ws(' ',p.record->>'name',p.record->>'address',p.record->>'city',p.record->>'postcode',public.webhunt_catalog_category(p.record),p.record->>'cvr')),lower(search_text))>0)
 and (industry='' or public.webhunt_catalog_category(p.record)=industry) order by p.business_id limit 600 offset page_offset) q;
 select coalesce(jsonb_agg(q.category order by q.category),'[]'::jsonb) into kinds from (select distinct public.webhunt_catalog_category(record) as category from public.catalog_places p where p.lat between south and north and p.lon between west and east) q;
 select string_agg(id||':'||release||':'||imported_at::text,'|' order by id) into revision from public.catalog_regions;
 return result||jsonb_build_object('businesses',items,'catalogTotal',total,'matchedTotal',matched,'categories',kinds,'limited',page_offset+jsonb_array_length(items)<matched,'nextOffset',case when page_offset+jsonb_array_length(items)<matched then page_offset+jsonb_array_length(items) else null end,'revision',revision);
end $$;
revoke all on function public.webhunt_catalog_page(double precision,double precision,double precision,double precision,text,text,integer) from public;
grant execute on function public.webhunt_catalog_page(double precision,double precision,double precision,double precision,text,text,integer) to anon,authenticated;
notify pgrst,'reload schema';
