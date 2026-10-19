# Quotation Checker

Internal Next.js + Supabase initial implementation. **Not a complete quotation validator.**

## Setup

1. For a fresh database run `supabase/schema.sql` first. Existing installations must **not** rerun it. Then run `supabase/002-username-accounts.sql` once. This migrates the existing admin membership to username `admin` and adds server-enforced access/password-change flags.
2. In Supabase Authentication > Users > Add user > Create new user, create `admin@accounts.internal.invalid` with **Auto Confirm User** enabled and a strong private password (at least 12 characters). This is an internal identifier, not a real mailbox. Sign into the app using username `admin`. Never share the password in chat or commit it.
3. In Authentication > Sign In / Providers disable **Allow new users to sign up**. Keep the Email/password provider enabled. The app uses internal identifiers with Supabase password auth; no SMTP, email links, or email verification is used. Do not send invites from the Supabase dashboard.
4. Vercel must have `NEXT_PUBLIC_SUPABASE_URL` plus `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Server-only account operations require `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`. Use the integration's existing secret if present; otherwise set it directly in Vercel Project Settings > Environment Variables for trusted environments. **Never prefix a secret/service-role key with NEXT_PUBLIC_.** Do not expose it in chat. Redeploy after changing variables. Only trusted code branches should have access to these credentials.
5. Admin > Manage sales accounts creates usernames and temporary passwords, resets passwords, and enables/disables access. Share temporary passwords through an approved private channel. Users must change them before reading rules or saving reviews. Flags are enforced by RLS from database state, including for pre-existing sessions. Admin membership cannot be managed by sales users. The initial admin cannot disable/reset itself via sales management; admin recovery requires a trusted Supabase operator.
6. `npm ci`, `npm test`, `npm run build`. Local build and unit tests do not verify live Supabase sign-in, RLS, email-provider settings, or account operations. Test the migration and a sales account on the deployed preview before production use. Supabase Auth rate limits apply to password verification; there is no public registration UI.

## Implemented

- Username/password sign-in, admin-created sales accounts, mandatory temporary-password changes, account resets and disable/enable controls; RLS-enforced sales/admin access.
- Browser-local PDF text extraction (10 MB / 30 pages). PDFs are not uploaded or retained.
- Required-text indicators and exact training-validity checks.
- Versioned training rule changes and review records, scoped to uploader or admin.
- Explicit Rejected / Human review outcomes, no override or automatic Pass.

## Not yet implemented

Visual layout/template comparison, column correctness, authoritative customer/product checks, line-item calculations, comprehensive contractual checks, general rule editing, reference PDF management, review-history UI, rule draft testing, audit-grade server validation, and end-to-end authentication tests. Saved findings are client-produced and must not be treated as tamper-proof approvals. This version deliberately cannot grant a Pass.

No approved sample PDFs or extracted customer content are committed. Findings and filenames are saved to Supabase; treat those records as confidential. No provider credentials are required to build; a successful build does not verify provider login, schema, or deployed workflows.
