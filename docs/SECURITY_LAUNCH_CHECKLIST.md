# Security launch checklist

Every required box must be checked before accepting public registrations or money. Record evidence (deployment URL, migration output, screenshots or log query) beside each item.

## Owner-only configuration

- [x] Create an isolated staging Supabase project and reconcile the duplicate `006` source versions. Evidence: `docs/MIGRATION_RESOLUTION.md`.
- [x] Apply every migration to staging, including `011_production_security_hardening.sql`, and run `supabase/tests/security_policies.sql` successfully.
- [x] Run staging Security Advisor and confirm there are no warning/error findings. Informational no-policy notices are limited to intentionally service-only tables with client grants revoked.
- [ ] Reconcile the complete production migration ledger described in `docs/MIGRATION_RESOLUTION.md`; do not run production `db push` or `migration repair` until the local/remote equivalence matrix is independently reviewed.
- [ ] Confirm leaked-password protection, email confirmation, secure redirect allowlists and appropriate OTP/session settings in Supabase Auth.
- [ ] Rotate the Supabase service-role key if it has ever appeared in a chat, screenshot, CI log or local shared file.
- [ ] Generate a new 32+ byte `CALLBACK_SECRET`; keep `CALLBACK_SECRET_PREVIOUS` only for a documented rotation window.
- [ ] Set `PROVIDER_ASSET_HOST_ALLOWLIST` to the exact APIMODELS/Haimaker output CDN hostnames observed in staging. Do not add generic cloud domains unless contractually required.
- [ ] Set Upstash REST URL/token in Preview and Production. Verify an outage produces 503 for billable/auth mutations rather than bypassing throttling.
- [ ] Confirm only `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are public variables. All provider/payment/admin values are server-only.
- [ ] Remove `ADMIN_BOOTSTRAP_EMAIL` after the initial owner account is verified.
- [ ] Set `LEGAL_REVIEWED=true` only after counsel/owner approves the payment, privacy, refund and terms text.
- [ ] Configure Vercel WAF/rate rules in monitor mode first for `/api/auth/login`, `/api/generations/*`, `/api/payments/manual`, `/api/files`, `/api/support`, and callback abuse; review logs before blocking.
- [ ] Restrict production deployments and environment changes to approved maintainers; enable protected Git branches and required reviews.
- [ ] Confirm provider contracts permit the intended public commercial SaaS usage and callback/data retention behavior.

## Staging security verification

- [ ] `node scripts/security-check.mjs` passes.
- [ ] Security unit tests, TypeScript, ESLint and production build pass from a clean checkout.
- [ ] `pnpm audit --prod` reports no unresolved high/critical issue; review lower-severity advisories.
- [ ] Anonymous users receive 401/redirects for protected pages and APIs.
- [ ] User A cannot read/update/delete User B projects, conversations, messages, files, jobs, wallet data, payments, tickets or notifications.
- [ ] A normal user receives 403 from every `/api/admin/**` endpoint.
- [ ] Cross-origin POST/PATCH/DELETE requests are rejected while same-origin UI actions continue working.
- [ ] `//attacker.example`, backslash and absolute redirect payloads cannot leave the application after sign-in.
- [ ] Repeating the same generation `requestId` does not create a second job or wallet hold.
- [ ] Repeating an admin credit request ID or payment approval does not create a second ledger entry.
- [ ] Concurrent duplicate provider callbacks result in one settlement and one notification.
- [ ] Callback payloads above 256 KiB, wrong secrets, invalid schemas, HTTP URLs, private IPs and non-allowlisted hosts are rejected.
- [ ] Oversized, polyglot/mismatched and executable payment proofs/uploads are rejected; valid files remain private.
- [ ] Signed asset/file URLs expire and cannot access a different user's path.
- [ ] Account export contains user data but no service keys, provider task IDs, callback URLs, supplier costs or raw provider payloads.
- [ ] Account deletion requires a fresh sign-in and produces an audit event before deletion.
- [ ] CSP/security headers are present on HTML/API responses and core sign-in, chat, generation, downloads and OAuth flows still work.
- [ ] Logs contain correlation-safe IDs only and no Authorization, cookies, callback URL, prompt/provider response body, signed URL or payment proof.

## Deployment and rollback

- [ ] Deploy this hardening to Preview first; do not promote a failed migration/build.
- [ ] Take a database backup and record the migration ledger before production migration.
- [ ] Apply database hardening before promoting application code that depends on its grants/columns.
- [ ] Run smoke tests for login, chat, image/video/audio generation, wallet hold/capture/release, manual payment, files, support, account export and admin reconciliation.
- [ ] Monitor 401/403/413/429/502/503 rates, provider callback failures, wallet reconciliation errors and WAF matches for at least one full traffic cycle.
- [ ] Keep the prior application deployment available for rollback; do not roll back the database by dropping policies/tables. Use a reviewed forward-fix migration.

## Launch decision

- **Ready:** every required item has evidence and no high/critical finding remains.
- **Conditionally ready:** code checks pass but one owner/platform action remains; keep public traffic/payment disabled.
- **Not ready:** migration/RLS, idempotency, callback allowlist, durable throttling, secret rotation, build or core flow verification fails.
