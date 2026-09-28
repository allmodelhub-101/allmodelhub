# Production migration plan

Date: 2026-09-22

## Gate status

**BLOCKED — production history mismatch or missing evidence**

Do not run `supabase db push`, `supabase migration repair`, production SQL, or a production Vercel deployment. This document is a plan only; none of the commands in the approval section were executed.

## Current state

- Source/staging duplicate `006` is resolved: admin roles remain `006`; storage quotas are `0061`.
- Isolated staging has the complete chain through `20260922053357`; database regression tests and Security Advisor warning/error checks passed there.
- Production records ten dated migrations and none of local `001`–`011`.
- Six production-only versions have verified local counterparts, but the full production schema is not equivalent to the fully migrated staging schema.
- Production has live, incompatible objects and data that make blanket repair unsafe. See `docs/PRODUCTION_EQUIVALENCE_MATRIX.md`.

## Required forward-only correction design

Before any production repair or push, add and review one or more new timestamped migrations that are safe on both fresh staging and the existing production state. They must:

1. Reconcile `admin_profit_logs` without losing its nine existing rows: validate null populations, backfill only from authoritative job/user data, normalize defaults/nullability/timestamp semantics and FK delete behavior, and retain the unique job invariant.
2. Establish the intended `admin_roles` contract without removing the production-only permissions/audit columns or its live owner row.
3. Create `profit_records` only if the application still requires it; otherwise remove the stale `007`/`011` dependency through a new forward migration and code review. Do not mark `007` applied while the table is absent.
4. Ensure exactly one canonical normalized unique index exists for manual payment references in both fresh and production histories.
5. Apply the least-privilege effects of `011`: force RLS where intended, remove broad client grants, replace public read policies, lock privileged RPC execution, and harden private bucket limits/MIME types.
6. Apply the immutable generation-settlement function from `20260922053357` after the financial table contract is reconciled.
7. Add compatibility/assertion migrations for the six verified remote-only versions only after the corrective migration is accepted. Assertions must fail if their expected objects differ; do not add empty files merely to make the ledger look clean.

Apply the proposed correction to a newly reset non-production project and the existing isolated staging project. Re-run both SQL regression suites, Security Advisor, migration-list comparison, and a second production read-only catalog comparison before proposing any production action.

## Backup and recovery prerequisites

The owner must complete and record all of the following in the Supabase dashboard before approval:

1. Confirm the production plan's backup/PITR capability and retention window.
2. Create/verify a recoverable point immediately before the approved migration window.
3. Export and securely retain the production migration ledger and schema-only metadata snapshot. Do not place credentials or user data in the repository.
4. Record counts and null checks for every table the corrective migration will alter.
5. Freeze admin/payment/generation writes for the migration window or provide a reviewed online-migration strategy.

Database rollback must be a forward fix. Do not drop hardened policies/tables or rewrite recorded migrations. Application rollback uses the prior Vercel deployment only if it remains compatible with the forward database state.

## Production dry-run and approval checkpoint

The following is the exact sequence to use **only after** the corrective migration passes independent review and the backup checkpoint is recorded. Stop if any output differs from the approved evidence bundle.

```powershell
# 1. Read-only ledger recheck.
npx --yes supabase@latest migration list --project-ref gkmkiperlvmaaefwuvel

# 2. Read-only production advisor recheck.
npx --yes supabase@latest db advisors --linked --project-ref gkmkiperlvmaaefwuvel --type security --level warn

# 3. Link a throwaway checkout to production metadata, then dry-run only.
npx --yes supabase@latest link --project-ref gkmkiperlvmaaefwuvel --yes
npx --yes supabase@latest db push --linked --dry-run
```

There are deliberately **no executable repair commands yet**. Repairs are tracking mutations and are unjustified while `006`, `007`, `011`, and `20260922053357` are not schema-equivalent. After the corrective migration is proven, a reviewer must generate a version-by-version allowlist. Each eventual command must have this form and be issued individually:

```powershell
# TEMPLATE ONLY — replace VERSION solely from the signed-off allowlist.
npx --yes supabase@latest migration repair VERSION --status applied --linked
```

The owner approval checkpoint must explicitly approve:

- the corrective SQL diff;
- the exact repair allowlist and why every repaired version is already equivalent;
- the dry-run's exact proposed migration set;
- the backup/recovery evidence;
- the maintenance/freeze plan;
- the post-migration smoke-test owner and rollback decision maker.

Only after that checkpoint may an operator run individual repairs and the approved production push. This task grants no such approval.

## Vercel Preview gate

Project `allmodelhub` is linked at the repository/team level, but Preview is not isolated:

- Supabase URL and credential variables are one shared configuration across Development, Preview, and Production, so Preview cannot be proven to target `kxywjivopqcxtqejglta` separately from production.
- Preview lacks its own `NEXT_PUBLIC_APP_URL`, `CALLBACK_SECRET`, Upstash URL/token, and `PROVIDER_ASSET_HOST_ALLOWLIST`.
- `LEGAL_REVIEWED` is absent.
- Production also lacks `PROVIDER_ASSET_HOST_ALLOWLIST` and `LEGAL_REVIEWED`; the latter must remain false/absent until owner/legal approval.

No Preview deployment was created. Owner action:

1. Add separate Preview values for `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` pointing only to staging.
2. Add separate Preview values for `NEXT_PUBLIC_APP_URL`, `CALLBACK_SECRET`, `PROVIDER_ASSET_HOST_ALLOWLIST`, `UPSTASH_REDIS_REST_URL`, and `UPSTASH_REDIS_REST_TOKEN`.
3. Confirm at least one provider key is present in Preview but do not execute a paid provider call during the gate.
4. Remove unnecessary legacy Supabase/Postgres variables from application scope after confirming integrations do not require them.
5. Rotate any credential that has appeared outside approved secret storage.

After owner configuration, deploy Preview only with `vercel deploy` (never `--prod`) and run the checklist below.

## Preview verification checklist

- Anonymous protected page/API requests return redirect/401.
- A normal staging user receives 403 from every `/api/admin/**` route.
- Two staging users cannot read or mutate each other's projects, conversations, files, jobs, wallet/payment, support, notification, or signed-file paths.
- Cross-origin mutations fail; same-origin UI mutations continue to work.
- Redirect bypasses using `//`, backslashes, absolute URLs, and encoded variants remain internal.
- Invalid callback secret/schema/size/URL/host is rejected without invoking a provider.
- Duplicate request IDs, payment approvals, admin credits, and callbacks remain idempotent.
- Upstash outage/misconfiguration fails closed for billable/auth mutations.
- Security headers/CSP are present and no secrets or signed URLs appear in logs or responses.

## Firewall draft state

Nothing is published. Two draft changes are staged:

1. `Monitor auth login bursts`: `/api/auth/login`, POST, 30 requests/600 seconds/IP, exceed action `log`.
2. `Monitor sensitive API surfaces`: log-only OR rule for `/api/generations/`, `/api/payments/manual`, `/api/files`, `/api/support`, and `/api/provider-callback/`.

Vercel rejected additional per-route rate-limit drafts because rate limiting is not available on the current plan. Owner action: review with

```powershell
npx --yes vercel@latest firewall diff --project allmodelhub --scope ayaneijaz45-9394 --no-color
```

Do not publish until Preview traffic has been observed and thresholds are approved. Publishing is an explicit owner action:

```powershell
# OWNER ACTION ONLY — not run by this task.
npx --yes vercel@latest firewall publish --project allmodelhub --scope ayaneijaz45-9394 --no-color
```

If the drafts are not accepted, discard them instead of publishing:

```powershell
npx --yes vercel@latest firewall discard --project allmodelhub --scope ayaneijaz45-9394 --no-color
```

## Verification completed in this gate

- Security static check: passed across 212 tracked/unignored files.
- Security unit tests: 2/2 passed.
- TypeScript: passed.
- ESLint: 0 errors, 5 pre-existing warnings.
- Next.js production build: passed; 24 static pages generated and all dynamic routes compiled.
- Supabase production Security Advisor: one warning, leaked-password protection disabled.
- Preview HTTP/auth/ownership tests: not run because Preview is not safely isolated.

## Owner actions before reconsidering production

1. Approve and implement the forward-only corrective migration described above.
2. Rebuild/reset staging, re-run database and application regression tests, and obtain independent migration review.
3. Isolate Preview environment values from Production, deploy Preview only, and complete the Preview verification checklist.
4. Enable Supabase leaked-password protection and complete remaining Auth settings review.
5. Review the two firewall drafts and either publish after observation/approval or discard them.
6. Produce backup/PITR evidence and an exact repair allowlist.
7. Re-run the production dry run and hold the explicit owner approval checkpoint.

### Dashboard ownership

- **Supabase:** approve the corrective migration design; confirm backup/PITR; enable leaked-password protection; review email confirmation, redirect allowlists, OTP/session settings; approve the final dry run and version-by-version repair allowlist.
- **Vercel:** create isolated Preview variables named above; deploy Preview only; complete non-billable verification; review the two unpublished firewall drafts; do not publish or promote without the final gate.
- **Upstash:** provision distinct Preview REST URL/token and confirm fail-closed behavior before any billable Preview mutation test.
- **Provider:** approve a non-production key/callback secret and exact asset-host allowlist; any real webhook/provider test remains a separately approved manual test.
- **GitHub:** confirm protected production branch, required review/status checks, and restricted deployment/environment maintainers. The remote is `allmodelhub-101/allmodelhub`; GitHub settings could not be inspected because the GitHub CLI is unavailable on this host.
