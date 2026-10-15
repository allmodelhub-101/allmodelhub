# PR #148 — isolated Preview setup

Do not run generation, provisioning, reconciliation, wallet writes, or financial mutation tests on the current
Preview. Its public bundle was verified to reference production Supabase project `gkmkiperlvmaaefwuvel`.
An empty `/api/models` response is not proof of isolation.

## Owner setup — no Production changes

1. Choose an existing isolated non-production Supabase project, or provision one yourself. Do not clone
   production users, auth sessions, wallets, holds, receipts or private storage. Confirm its project reference
   is **not** `gkmkiperlvmaaefwuvel`. Do not change production credentials.
2. Open [Vercel project Environment Variables](https://vercel.com/ayaneijaz45-9394/allmodelhub/settings/environment-variables).
   For every entry below select **Preview only** and branch **codex/billing-v3-runtime-repair**.
   Do not edit a Production entry or an all-environments shared value. Add branch overrides instead.
   These overrides must cover both build-time and server runtime.
3. Set the following exact names using that isolated project's settings. Never paste secret values into
   chat, GitHub, logs or source files:

   | Variable | Required source / purpose |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Isolated project's HTTPS URL; public build configuration |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Matching isolated project's publishable key, not a service-role key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Matching isolated project's service-role key; server-only Secret |
   | `NEXT_PUBLIC_APP_URL` | Stable HTTPS branch Preview alias, never the production domain |
   | `APIMODELS_BASE_URL` | Official APIMODELS base URL, or an explicitly controlled isolated test server |
   | `APIMODELS_API_KEY` | Separate non-production provider credential/budget; never submit paid requests without approval |
   | `UPSTASH_REDIS_REST_URL` | Isolated Redis REST URL; do not share production rate-limit storage |
   | `UPSTASH_REDIS_REST_TOKEN` | Matching isolated Redis credential, server-only Secret |
   | `CALLBACK_SECRET` | Unique Preview-only random secret, at least 32 characters |
   | `CRON_SECRET` | Unique Preview-only reconciliation endpoint secret, server-only |
   | `PROVIDER_ASSET_HOST_ALLOWLIST` | Verified provider asset hosts and isolated storage host, comma-separated, never `*` |

   For tests without provider access, keep an isolated mock endpoint/credential and label results mocked.
   Production-mode Next builds require a configured provider key, Redis, callback secret and asset allowlist;
   Vercel Preview also runs with `NODE_ENV=production`. Do not turn off security checks to bypass this.

   `SUPABASE_URL`, legacy anon-key aliases, and `SUPABASE_PUBLISHABLE_KEY` are **not**
   substitutes for the exact variables the current application reads above. The existing misspelled
   public URL entry has no effect. Any legacy aliases retained for other tooling must point only
   at the same isolated project. Never put a service-role/secret key under any `NEXT_PUBLIC_` name.

   Leave `CALLBACK_SECRET_PREVIOUS` absent for this branch unless using a distinct Preview rotation secret;
   do not accept the production callback secret. Leave HAIMAKER fallback credentials absent unless a separately
   approved isolated fallback is being tested. Any `APP_URL` alias retained for tooling must not point to production.
4. Prepare **only the isolated database**: compare its migration ledger with this branch, then apply missing
   source-controlled migrations once in order. Seed the non-private model catalog, provider routes, current
   effective V3 authorization registry, internal FX/settings, and feature flags. Keep unsupported routes gated.
   No new migration is introduced by PR #148.
5. Configure isolated Supabase Auth Site URL / redirect allowlist for the Preview alias, including
   `/auth/callback`, `/auth/confirm` and `/auth/update-password` where needed. Use a dedicated test account
   with synthetic credits only. Configure private test storage buckets from the existing migrations.
   Do not enable payments, add banking credentials, or provision test users in production.
6. Redeploy the exact PR head commit to **Preview**, without promoting it. Confirm the deployment SHA and
   branch before opening protected/authenticated routes. A rebuild is necessary because `NEXT_PUBLIC_*`
   values are compiled into browser bundles.
7. First perform non-mutating checks: verify the compiled public Supabase URL, successful catalog reads,
   no-store headers, and branch URL. Inspect credential/project matching only inside trusted tooling.
   Expected candidate catalog: 57 visible, 53 executable (18 text, 12 image, 15 video, 8 audio) if the isolated
   registry matches the audited fixture. Different seed data must be investigated, not forced available.
8. Only after isolation is positively verified may authorized isolated financial tests run. Real-provider
   generation remains a separate explicit approval with a small spending budget. Do not call reconciliation
   or callbacks against the old non-isolated deployment.

## Verification in this PR

Network-mocked tests exercise the real provider adapters and submission boundary. PostgreSQL-compatible
integration tests run in local PGlite, not Supabase production. No real-provider success is claimed.
No environment variables or secrets were changed during this repair.
