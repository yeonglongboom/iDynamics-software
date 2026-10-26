-- Run AFTER schema.sql, once. No passwords belong in this SQL file.
begin;
alter table public.members add column active boolean not null default true;
alter table public.members add column must_change_password boolean not null default false;
alter table public.members add column auth_user_id uuid unique references auth.users(id);
-- Preserve existing admin membership but move it to the new admin username.
-- Create admin@accounts.internal.invalid in Authentication > Users > Add user
-- with auto-confirm enabled, and a strong private password. No mailbox is needed.
update public.members set email = 'admin@accounts.internal.invalid' where role = 'admin';
update public.members m set auth_user_id = u.id from auth.users u where lower(u.email) = m.email;
create or replace function public.member_role() returns text language sql stable security definer set search_path = '' as $$
 select m.role from public.members m where m.email = lower(auth.jwt()->>'email')
 and auth.uid() is not null and m.active and not m.must_change_password
 and (m.auth_user_id is null or m.auth_user_id = auth.uid())
$$;
-- Account flags must only be changed by authenticated server admin operations.
drop policy members_manage on public.members;
commit;
-- In Authentication > Sign In / Providers, disable "Allow new users to sign up".
-- Do not disable the Email provider: it powers username/password authentication internally.
