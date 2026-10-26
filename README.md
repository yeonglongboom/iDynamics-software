# Quotation Checker

Internal Next.js + Supabase initial implementation. **Not a complete quotation validator.**

## Setup

1. For a fresh database run `supabase/schema.sql` first. Existing installations must **not** rerun it. Then run `supabase/002-username-accounts.sql` once. This migrates the existing admin membership to username `admin` and adds server-enforced access/password-change flags.
2. In Supabase Authentication > Users > Add user > Create new user, create `admin@accounts.internal.invalid` with **Auto Confirm User** enabled and a strong private password (at least 12 characters). This is an internal identifier, not a real mailbox. Sign into the app using username `admin`. Never share the password in chat or commit it.
3. In Authentication > Sign In / Providers disable **Allow new users to sign up**. Keep the Email/password provider enabled. The app uses internal identifiers with Supabase password auth; no SMTP, email links, or email verification is used. Do not send invites from the Supabase dashboard.
4. Vercel must have `NEXT_PUBLIC_SUPABASE_URL` plus `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Server-only account operations require `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`. Use the integration's existing secret if present; otherwise set it directly in Vercel Project Settings > Environment Variables for trusted environments. **Never prefix a secret/service-role key with NEXT_PUBLIC\_.** Do not expose it in chat. Redeploy after changing variables. Only trusted code branches should have access to these credentials.
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

## Reference Library setup (new)

Run `supabase/003-reference-library.sql` once after migrations 001/002, before testing this preview. It creates a **private** Supabase Storage bucket, admin-only PDF/metadata access policies, draft reference-backed checks, and a restricted function allowing authenticated sales to load only effective rule text. Storage/database quotas and provider charges remain subject to your Supabase plan; no paid upgrade is configured by this code.

Admin > Reference Library supports up to 50 PDFs per sequential batch (10 MB / 30 pages per file), a shared Approved/Rejected label and reason, per-file results, private downloads and confirmation/withdrawal. Separate batches for different rejection reasons. PDFs are checked for parseability before upload. Library PDFs and labels are not visible to sales users and are not committed to GitHub. No extracted customer text is persisted. PDFs may contain confidential information; obtain permission and redact unnecessary personal data before upload.

Confirming references does not infer or activate rules. Admins can manually author draft required/prohibited literal-phrase checks, link to confirmed references, then explicitly activate. Future reviews fetch effective rules; missing required phrases trigger Human review, prohibited phrases found trigger Rejected. Deactivating a check or withdrawing its reference excludes it from future reviews. Rule IDs and effective text snapshots are saved alongside results so later changes do not rewrite past evidence. Extraction normalizes case/whitespace but does not interpret meaning. No AI retrieval, automatic learning, visual similarity matching or automatic approval is implemented. Existing training-validity checks remain independent. Library setup errors block reviews rather than silently skipping checks.

Provider storage policies, sales denial of access, bulk uploads, private downloads and effective-rule RPC require live integration testing after migration. Automated unit tests cover rule evaluation, not database policy execution. File removal, metadata editing, pagination and category-specific rules are not yet implemented; withdraw a mistaken reference and upload a corrected draft. The initial library is intended for tens of documents, not an unbounded archive.

## Monetary checks

The reviewer now checks explicit same-page `Sub Total`, `SST Services Tax (rate%)`, and `Total RM` summary labels. Incorrect subtotal + SST totals beyond one sen are rejected. The displayed tax rate is used for a full-subtotal comparison, but discrepancies are human-review notes because taxable bases, exemptions and rounding are not inferred. No legal tax-rate determination is made.

Explicit quotation-number headings (including revision suffixes) and document-total labels are compared across pages. Differences require human review because references/page totals can have legitimate meanings. Isolated numeric rows under recognized quantity/rate/discount/tax/amount headers support quantity × rate and explicit percentage discounts, including waivers; nonzero discounts without a percentage marker are ambiguous. Wrapped PDF rows, missing units, positional columns, item-to-subtotal reconciliation and adjustments are not inferred. Coverage counts are shown, and the overall result cannot become Pass. Extraction is text-based, not visual; tests use synthetic examples, not a deployed PDF end-to-end run. No database migration is required for these checks.

## Position-based PDF tables

PDF extraction now preserves text coordinates and detects separate `#`, `Description`, `Qty`, `Rate`, optional `Disc`, `Tax%`, and `Amount` headers. Numeric cells must fit their column and align with the numbered row baseline. Wrapped descriptions and quantity units on another line are supported. Ambiguous/split rows remain unverified, with explicit coverage counts. Percentage discounts and waivers are checked independently of the older isolated-text fallback.

Subtotal reconciliation is limited to a single complete table with sequential numbered rows and one subtotal. Differences are review notes (possible adjustments), not automatic rejection. Continuation tables, rotated text, combined header tokens, multiple tables, different formats, mixed tax eligibility and missing columns still require human review. This is not full visual layout validation or automatic reference matching. No database migration required.

Local verification: all five supplied PDFs were parsed using PDF.js, yielding row counts 3, 1, 1, 2, 1 respectively; calculations had no mismatches and each subtotal reconciled. Customer files/text are not committed. Unit tests cover wrapped descriptions, missing/spanning cells, incorrect amounts and conservative reconciliation. Browser end-to-end confirmation remains necessary.

## App brand palette

UI theme uses the supplied Outrageous Orange `#FF6634`, Rodeo Dust `#C7A685`, Coral `#FF855D`, Bleach White `#EBDECB`, Aero Blue `#C1DBD0`, and Atoll `#218288`. Primary actions use orange with dark text; Atoll provides focus/heading accents; Aero Blue provides notice backgrounds. Brand colours are centralized as CSS variables. These colours style the app only, not quotation acceptance rules. Fonts and logo were not supplied and have not been invented as brand assets.
