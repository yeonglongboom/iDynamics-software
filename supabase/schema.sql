-- Run once in Supabase SQL Editor. No customer PDFs are stored by this version.
create table public.members (email text primary key check (email = lower(email)), role text not null check (role in ('admin','sales')));
insert into public.members values ('replace-with-admin-email@example.com','admin');
create function public.member_role() returns text language sql stable security definer set search_path = '' as $$
 select role from public.members where email = lower(auth.jwt()->>'email') and auth.uid() is not null
$$;
revoke all on function public.member_role() from public;
grant execute on function public.member_role() to authenticated;
alter table public.members enable row level security;
create policy members_read on public.members for select to authenticated using (email = lower(auth.jwt()->>'email') or public.member_role() = 'admin');
create policy members_manage on public.members for all to authenticated using (public.member_role() = 'admin') with check (public.member_role() = 'admin');
create table public.rule_versions (id bigint generated always as identity primary key, created_at timestamptz not null default now(), created_by uuid references auth.users(id), training_months integer not null check (training_months between 1 and 36));
insert into public.rule_versions (training_months) values (1);
alter table public.rule_versions enable row level security;
create policy rules_read on public.rule_versions for select to authenticated using (public.member_role() is not null);
create policy rules_insert on public.rule_versions for insert to authenticated with check (public.member_role() = 'admin' and created_by = auth.uid());
create table public.reviews (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), user_id uuid not null references auth.users(id), filename text not null, rule_version bigint not null references public.rule_versions(id), status text not null check (status in ('Rejected','Human review')), findings jsonb not null);
alter table public.reviews enable row level security;
create policy reviews_read on public.reviews for select to authenticated using (public.member_role() is not null and (user_id = auth.uid() or public.member_role() = 'admin'));
-- Results are not approval records; this initial release intentionally cannot issue Pass.
create policy reviews_insert on public.reviews for insert to authenticated with check (public.member_role() is not null and user_id = auth.uid());
