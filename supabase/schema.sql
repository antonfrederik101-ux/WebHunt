-- Run in the Supabase SQL editor. No service-role key is needed by the app.
create table if not exists public.leads (
 user_id uuid not null references auth.users(id) on delete cascade,
 business_id text not null,
 business jsonb not null,
 notes text not null default '' check (length(notes) <= 10000),
 contact_status text not null default 'Ikke kontaktet' check (contact_status in ('Ikke kontaktet','Kontaktet','Interesseret','Kunde','Afvist')),
 created_at timestamptz not null default now(),
 primary key (user_id, business_id)
);
create table if not exists public.business_statuses (
 user_id uuid not null references auth.users(id) on delete cascade,
 business_id text not null,
 status text not null default 'unknown' check (status in ('unknown','missing','improve','good')),
 analysis jsonb,
 primary key (user_id, business_id)
);
alter table public.leads enable row level security;
alter table public.business_statuses enable row level security;
-- Policies are repeatable; ownership must match for both existing and new rows.
drop policy if exists "Users manage own leads" on public.leads;
create policy "Users manage own leads" on public.leads for all to authenticated
 using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users manage own assessments" on public.business_statuses;
create policy "Users manage own assessments" on public.business_statuses for all to authenticated
 using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.leads from anon;
revoke all on public.business_statuses from anon;
grant select, insert, update, delete on public.leads to authenticated;
grant select, insert, update, delete on public.business_statuses to authenticated;
create index if not exists leads_created_at on public.leads (user_id, created_at desc);
-- Ask PostgREST to refresh its schema cache after installation.
notify pgrst, 'reload schema';
