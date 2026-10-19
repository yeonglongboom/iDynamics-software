# Quotation Checker

Internal Next.js + Supabase initial implementation. **Not a complete quotation validator.**

## Setup

1. In the connected Supabase project's SQL Editor, replace `replace-with-admin-email@example.com` with your administrator email and run `supabase/schema.sql` once. It enables row-level security, installs the initial administrator access entry, and creates immutable rule versions.
2. In Supabase Authentication > URL Configuration, set Site URL to the deployed application URL. Add only trusted redirect URLs. If using preview deployments, explicitly allow their URLs rather than broadly allowing arbitrary hosts.
3. Confirm the integration provides `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Never expose a secret/service-role key as a public variable.
4. Supabase Authentication > Email Templates > Magic Link can use `{{ .Token }}` to send a verification code. Default magic links also work when Site URL is set correctly. Production email delivery may require configuring an SMTP provider. No credentials belong in GitHub.
5. `npm ci`, `npm test`, `npm run build`; deploy after setup. Initial admin signs in with their configured email; the admin page grants sales access. Unlisted accounts can authenticate with Supabase but RLS denies application data access.

## Implemented

- Email sign-in; RLS-enforced sales/admin access.
- Browser-local PDF text extraction (10 MB / 30 pages). PDFs are not uploaded or retained.
- Required-text indicators and exact training-validity checks.
- Versioned training rule changes and review records, scoped to uploader or admin.
- Explicit Rejected / Human review outcomes, no override or automatic Pass.

## Not yet implemented

Visual layout/template comparison, column correctness, authoritative customer/product checks, line-item calculations, comprehensive contractual checks, general rule editing, reference PDF management, review-history UI, rule draft testing, audit-grade server validation, and end-to-end authentication tests. Saved findings are client-produced and must not be treated as tamper-proof approvals. This version deliberately cannot grant a Pass.

No approved sample PDFs or extracted customer content are committed. Findings and filenames are saved to Supabase; treat those records as confidential. No provider credentials are required to build; a successful build does not verify provider login, schema, or deployed workflows.
