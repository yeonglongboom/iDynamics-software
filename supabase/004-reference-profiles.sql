-- Run once after migration 003. Profiles contain feature names only, not PDF text.
begin;
alter table public.quotation_references add column profile jsonb;
create function public.approved_reference_profiles() returns table(id uuid,filename text,profile jsonb)
language sql stable security definer set search_path='' as $$
 select r.id,r.filename,r.profile from public.quotation_references r
 where r.confirmed and r.label='Approved' and r.profile is not null
 and public.member_role() is not null
$$;
revoke all on function public.approved_reference_profiles() from public;
grant execute on function public.approved_reference_profiles() to authenticated;
alter table public.reviews add column reference_profiles_snapshot jsonb not null default '[]';
commit;
