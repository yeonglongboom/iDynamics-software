-- Run once AFTER 002-username-accounts.sql.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('quotation-references','quotation-references',false,10485760,array['application/pdf']);
create table public.quotation_references (
 id uuid primary key, filename text not null, storage_path text not null unique,
 label text not null check(label in ('Approved','Rejected')), reason text not null default '',
 confirmed boolean not null default false,
 created_at timestamptz not null default now(), created_by uuid not null references auth.users(id),
 check(label <> 'Rejected' or length(trim(reason)) > 0)
);
alter table public.quotation_references enable row level security;
create policy reference_admin on public.quotation_references for all to authenticated
using(public.member_role()='admin') with check(public.member_role()='admin' and created_by=auth.uid());
create policy reference_files_admin on storage.objects for all to authenticated
using(bucket_id='quotation-references' and public.member_role()='admin')
with check(bucket_id='quotation-references' and public.member_role()='admin');
create table public.reference_checks (
 id uuid primary key default gen_random_uuid(), reference_id uuid not null references public.quotation_references(id),
 title text not null check(length(trim(title))>0),
 kind text not null check(kind in ('required_phrase','forbidden_phrase')),
 phrase text not null check(length(trim(phrase)) between 3 and 500),
 correction text not null check(length(trim(correction))>0),
 active boolean not null default false, created_at timestamptz not null default now(),
 created_by uuid not null references auth.users(id)
);
alter table public.reference_checks enable row level security;
create policy checks_admin on public.reference_checks for all to authenticated
using(public.member_role()='admin') with check(public.member_role()='admin' and created_by=auth.uid());
-- Sales can fetch only effective rules, not confidential PDFs or library metadata.
create function public.active_reference_checks() returns table(id uuid, title text,kind text,phrase text,correction text)
language sql stable security definer set search_path='' as $$
 select c.id,c.title,c.kind,c.phrase,c.correction from public.reference_checks c
 join public.quotation_references r on r.id=c.reference_id
 where c.active and r.confirmed and public.member_role() is not null
$$;
revoke all on function public.active_reference_checks() from public;
grant execute on function public.active_reference_checks() to authenticated;
alter table public.reviews add column reference_check_ids uuid[] not null default '{}';
alter table public.reviews add column reference_checks_snapshot jsonb not null default '[]';
commit;
