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

create or replace function public.webhunt_import_region(snapshot jsonb) returns integer
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_region_id text := snapshot#>>'{region,id}'; edition text := snapshot->>'release'; item jsonb; total integer;
begin
 perform pg_advisory_xact_lock(872613420);
 if snapshot->>'version' <> '1' or v_region_id !~ '^[a-z0-9-]{1,60}$' or edition !~ '^\d{4}-\d{2}-\d{2}\.\d+$' or jsonb_typeof(snapshot->'records') <> 'array' or jsonb_array_length(snapshot->'records') = 0 then
   raise exception 'Invalid or empty import; previous data preserved';
 end if;
 if exists (select 1 from public.catalog_regions r where r.id=v_region_id and r.release>edition) then raise exception 'Cannot replace newer release'; end if;
 insert into public.catalog_regions values(v_region_id,snapshot#>>'{region,name}',snapshot#>'{region,bounds}',edition,(snapshot->>'importedAt')::timestamptz)
 on conflict(id) do update set name=excluded.name,bounds=excluded.bounds,release=excluded.release,imported_at=excluded.imported_at;
 delete from public.catalog_membership m where m.region_id=v_region_id;
 for item in select value from jsonb_array_elements(snapshot->'records') loop
   if item->>'id' not like 'overture/%' or item->>'source' <> 'Overture Maps' or nullif(item->>'name','') is null or jsonb_array_length(item->'licenses')=0 then raise exception 'Invalid source record'; end if;
   insert into public.catalog_places values(item->>'id',(item->>'lat')::double precision,(item->>'lon')::double precision,edition,item)
   on conflict(business_id) do update set lat=excluded.lat,lon=excluded.lon,release=excluded.release,record=excluded.record where excluded.release>=catalog_places.release;
   insert into public.catalog_membership values(v_region_id,item->>'id') on conflict do nothing;
 end loop;
 delete from public.catalog_places p where not exists(select 1 from public.catalog_membership m where m.business_id=p.business_id);
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
