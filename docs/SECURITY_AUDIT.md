# Production security audit

Date: 2026-09-21
Scope: authenticated Next.js application, Route Handlers, Supabase/Postgres/RLS/storage, APIMODELS/Haimaker integrations, wallet and manual payments. The visual system was intentionally left unchanged.

## Executive result

The codebase now has a substantially stronger application boundary, but production launch remains **conditional** until the owner completes the external controls in `SECURITY_LAUNCH_CHECKLIST.md`: apply/verify migrations on a non-production Supabase project, configure durable rate limiting and the asset-host allowlist, rotate secrets, verify provider callback hosts, configure platform firewall rules, and complete a staging abuse test.

No confirmed credential value was found in tracked source or Git history during the audit. Matches were environment-variable references and placeholders. The automated `check:security` scan now rejects common committed-secret formats and any new public environment name outside the approved three.

## Architecture and trust boundaries

1. Browser sessions are issued by Supabase Auth and revalidated server-side with `auth.getUser()`.
2. The Next.js proxy rejects cross-site unsafe `/api` mutations and marks API responses private/no-store.
3. Authenticated Route Handlers validate request data and enforce resource ownership before using the service-role client.
4. The service-role client is server-only. Browser-accessible RLS remains defense in depth.
5. Billable work reserves wallet funds before the provider call and captures or releases them through restricted atomic RPCs.
6. Media callbacks authenticate with a rotating high-entropy path secret, validate size/schema, allowlist output hosts, claim settlement, persist safe assets, then settle the wallet exactly once.

## API inventory and authorization matrix

| Route family | Methods | Required authority | Validation / ownership | Abuse control |
|---|---|---|---|---|
| `/api/auth/login` | POST | Public | Zod credentials; generic errors | IP, 5/10m, durable/fail-closed in production |
| `/api/chat`, `/api/prompt-enhance`, `/api/tts` | POST | User | Zod; project/conversation/file ownership in chat | Purpose-specific user limits |
| `/api/generations/[modality]` | POST | User | Zod; modality/model/project/reference ownership; server pricing | Per-modality limits; request and wallet idempotency |
| `/api/jobs`, `/api/jobs/[id]` | GET | User | Owner filter; UUID for detail; safe response DTO | Polling does not expose provider internals |
| `/api/provider-callback/apimodels/[secret]` | POST | Provider secret | Byte limit, Zod, trusted HTTPS hosts, DNS/private-IP rejection | IP 60/min; atomic settlement claim |
| `/api/files`, `/api/files/[id]` | GET/POST/DELETE | User | Quota reservation, extension/MIME/magic checks, owner filter | Upload limit; private storage |
| `/api/payments/manual` | GET/POST | User | Server-side amount/bonus, unique reference, MIME + magic bytes | 3/hour; private proof bucket |
| `/api/wallet`, `/api/usage` data | GET | User | Owner-filtered service queries | Private/no-store |
| `/api/projects*`, `/api/conversations*`, `/api/favorites` | CRUD | User | Zod and owner filters; UUID on resource routes | CSRF/origin boundary |
| `/api/support*` | GET/POST | User | Zod, ticket ownership, UUID | 5/hour create/reply |
| `/api/settings`, `/api/notifications`, `/api/search`, `/api/models` | GET/PATCH | User | Allowlisted settings fields; owner filters; bounded queries | CSRF/origin boundary |
| `/api/account/export` | GET | User | Owner-scoped safe export columns | 5/hour, audit record, no-store |
| `/api/account/delete` | POST | User + recent sign-in | Literal confirmation and 15-minute sign-in freshness | 5/10m |
| `/api/admin/**` | Mixed | Admin/owner | Explicit `requireAdmin`/`checkAdmin`; schemas; UUID where applicable | CSRF boundary; reconciliation limiter |

## Findings and remediation

### Critical / high findings fixed

- **Provider callback credential persistence:** `callback_url` and signed input URLs were previously stored in `generation_jobs.request_json`. New jobs store a sanitized request; migration 011 removes old `callback_url` and `images` keys.
- **SSRF-capable provider output URLs:** arbitrary HTTP(S) provider URLs could be fetched. Downloads now require HTTPS, an explicit hostname/suffix allowlist, no credentials, public DNS results, bounded redirects, approved media MIME, and a streamed 250 MiB maximum.
- **Raw provider data exposure:** job routes could return task identifiers, raw provider payloads, internal request JSON and costs. Customer responses are now explicit DTOs; browser column grants exclude internal generation columns.
- **Non-durable production throttling:** Redis absence/failure previously fell back to process memory. Production now fails closed; local development retains a bounded fallback.
- **Open redirect:** protocol-relative OAuth return paths and password-login redirects are rejected.
- **Retry double-credit risk:** media holds now include the client request ID, and admin wallet adjustments require a client request ID in the atomic ledger idempotency key.

### Medium findings fixed

- Cross-site unsafe API mutations are rejected using Origin and Fetch Metadata (provider callbacks are separately authenticated).
- API responses are private/no-store; CSP, HSTS (production), no-sniff, frame denial, referrer, permissions and DNS-prefetch policies are set globally.
- Provider error bodies and raw exception/context objects are no longer logged. Sensitive context keys and URLs are redacted.
- Payment proofs now use server-derived extensions after magic-byte verification.
- Account exports are audited and exclude provider/internal generation fields; deletion requires recent authentication.
- Service-only Supabase tables now have RLS/revoked browser grants; financial RPC execution is denied to public/anon/authenticated; safe generation columns receive column-level grants.
- Storage bucket limits and MIME restrictions match application enforcement.

### Accepted or owner-controlled residual risks

- Callback authentication is a high-entropy rotating URL secret because the current provider contract does not expose a signed-body webhook scheme. Prefer signed webhooks if the provider adds them.
- The CSP allows inline scripts/styles because of the current Next.js rendering and existing styles. Moving to a nonce-based CSP is a future defense-in-depth improvement and requires a focused compatibility pass.
- Application DNS validation plus a strict hostname allowlist materially reduces SSRF; infrastructure-level egress allowlisting is still recommended.
- Malware scanning is not embedded. Files are private, type/size checked, and parsing is bounded by plan limits; production should add asynchronous scanning/quarantine if untrusted organization-wide sharing is introduced.
- Existing migration names include two legacy `006_*` files. Reconcile the remote migration ledger before applying with the CLI; do not rename or replay production migrations blindly.

## Supabase review

- Owner-scoped RLS exists for profiles, wallets/transactions/holds, payments, projects, conversations/messages, generation jobs, files, tickets/messages, notifications, favorites and analytics.
- Storage buckets are private and user-folder policies remain enabled.
- `011_production_security_hardening.sql` adds missing service-only RLS/grants, safe column grants, bucket constraints, default privilege restrictions, legacy secret cleanup, and the missing `admin_profit_logs` bootstrap needed by the dated financial migration.
- `supabase/tests/security_policies.sql` asserts required policies, protected relation grants, hidden generation columns and denied financial RPC execution.

## Verification commands

```bash
node scripts/security-check.mjs
node --experimental-strip-types --test tests/security/*.test.mjs
tsc --noEmit --incremental false
eslint .
next build
pnpm audit --prod
```

Database checks must additionally run in a temporary Supabase project with all migrations and `supabase/tests/security_policies.sql`.
