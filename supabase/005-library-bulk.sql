-- Once, after 004. Existing examples require explicit document-type classification.
begin;
alter table public.quotation_references add column document_type text not null default 'Unknown' check(document_type in ('Quotation','Invoice','Unknown'));
alter table public.quotation_references add column content_hash text;
create unique index quotation_reference_hash on public.quotation_references(content_hash) where content_hash is not null;
create or replace function public.approved_reference_profiles() returns table(id uuid,filename text,profile jsonb)
language sql stable security definer set search_path='' as $$
 select r.id,r.filename,r.profile from public.quotation_references r
 where r.confirmed and r.label='Approved' and r.document_type='Quotation' and r.profile is not null
 and public.member_role() is not null
$$;
-- Invoice and unclassified examples must not activate quotation rules either.
create or replace function public.active_reference_checks() returns table(id uuid,title text,kind text,phrase text,correction text)
language sql stable security definer set search_path='' as $$
 select c.id,c.title,c.kind,c.phrase,c.correction from public.reference_checks c
 join public.quotation_references r on r.id=c.reference_id
 where c.active and r.confirmed and r.document_type='Quotation' and public.member_role() is not null
$$;
commit;
