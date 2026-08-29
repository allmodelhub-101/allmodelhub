# ALL MODEL HUB — COMPLETE FULL-STACK BUILD

This repository is the single codebase to upload to GitHub and connect to v0/Vercel. It contains the Next.js frontend, server routes/backend logic, Supabase schema/migrations, wallet and manual-payment logic, provider adapters, media jobs, admin controls, projects, history, receipts, templates and notifications. Real production credentials are intentionally excluded.

# All Model Hub

Production-oriented Next.js 16 SaaS starter for **All Model Hub — Every Leading AI. One PKR Wallet.**

This repository implements the locked V1 architecture: premium marketing site, Supabase authentication, PKR credit wallet/ledger, manual Easypaisa + Meezan top-ups with admin approval, curated AI model tiers, Auto Best routing, streamed text chat, Model Battle, image/video/audio generation jobs, spending limits, projects, files, support, and admin model/payment controls.

## Stack

- Next.js 16 + React 19 + TypeScript
- Supabase PostgreSQL, Auth and Storage
- Upstash Redis rate limiting
- Vercel deployment
- Cloudflare recommended in front of the domain
- APIMODELS primary provider
- Haimaker optional LLM backup provider

## 1. Create infrastructure

1. Create a Supabase project.
2. Run `supabase/migrations/001_init.sql`.
3. Run `supabase/migrations/002_seed_models.sql`.
4. Create an Upstash Redis database (optional in local development, recommended in production).
5. Create a Vercel project linked to this GitHub repository.

## 2. Configure environment

Copy `.env.example` to `.env.local` and fill in real values.

Never commit provider API keys, service-role keys, payment recipient details, callback secrets, or deployment secrets.

## 3. Install and run

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## 4. Bootstrap the first admin

After signing up, promote your account in Supabase SQL Editor:

```sql
update public.profiles
set role = 'owner'
where email = 'YOUR_ADMIN_EMAIL';
```

Admin dashboard: `/admin`

## 5. Supabase Auth setup

Enable:

- Email/password
- Email confirmation
- Google OAuth (recommended)

Add callback URLs:

- `http://localhost:3000/auth/callback`
- `https://YOUR_DOMAIN/auth/callback`

## 6. Manual payments

Set these server environment variables in Vercel:

- `EASYPAISA_ACCOUNT_TITLE`
- `EASYPAISA_ACCOUNT_NUMBER`
- `MEEZAN_ACCOUNT_TITLE`
- `MEEZAN_ACCOUNT_NUMBER`
- `MEEZAN_IBAN`

User flow:

Wallet → Add Credits → transfer funds → enter reference → upload proof → admin verifies → credits are added by an idempotent database RPC.

## 7. AI providers

### APIMODELS

Set:

- `APIMODELS_API_KEY`
- `APIMODELS_BASE_URL=https://api.apimodels.app/v1`

The app uses OpenAI-compatible chat completions plus APIMODELS async image/video/audio generation endpoints.

### Haimaker backup

Set:

- `HAIMAKER_API_KEY`
- `HAIMAKER_BASE_URL=https://api.haimaker.ai/v1`
- `HAIMAKER_MODEL_MAP_JSON`

Example:

```json
{
  "claude-sonnet-4-6": "anthropic/claude-sonnet-4-20250514"
}
```

Only mapped exact models are allowed to fail over. This avoids silently substituting a materially different model.

## 8. Pricing

Internal accounting uses `INTERNAL_USD_PKR=310` by default.

Retail pricing is calculated from provider cost × internal PKR basis × markup. Markups are stored per model and can be changed from Admin without editing frontend pricing code.

Important: supplier prices change. Before launch, verify every model price against the current provider dashboard and update the database seed/configuration if needed.

## 9. Wallet safety

The wallet uses:

- immutable transaction records
- separate purchased and promo balances
- reserved balance
- idempotent holds/captures/releases
- no negative balance
- daily and single-generation user limits

Expensive media requests show estimated cost in the UI and the server reserves a safety-buffer amount before contacting the provider.

## 10. Provider callbacks

Set a strong `CALLBACK_SECRET`. APIMODELS callbacks are routed to:

`/api/provider-callback/apimodels/<CALLBACK_SECRET>`

The secret is embedded in the callback path because provider callback signing may not be available for every async API.

## 11. V0 workflow

Connect this repository to v0. GitHub should remain the source of truth. Use `V0_MASTER_PROMPT.md` as the project instruction, then ask v0 to make focused changes rather than regenerating the entire app.

## 12. Production launch gates

Do not accept real customer payments until all of these are complete:

- written commercial SaaS permission from APIMODELS
- written commercial SaaS/backup permission from Haimaker as applicable
- live API keys tested
- current model pricing reconciled
- real Easypaisa/Meezan recipient details configured
- Terms, Privacy, Acceptable Use and Refund policy reviewed for the actual business entity
- admin MFA enabled
- database backups configured
- rate limiting enabled
- wallet concurrency and duplicate-payment tests completed
- Cloudflare/WAF configured
- error monitoring configured
- mobile QA completed

## Known production follow-ups

This repo is intentionally deployable without inventing third-party credentials, but three infrastructure items deserve dedicated production work before scale:

1. **Durable large-video re-hosting.** APIMODELS media URLs expire; use a dedicated background worker/object storage pipeline for large generated videos rather than pulling very large media through a normal Vercel request.
2. **Full file-to-model context pipeline.** File upload/storage exists; provider-specific document ingestion and RAG can be layered onto Projects next.
3. **Automated Pakistan payments.** Manual Easypaisa/Meezan is V1 by design. Add signed gateway webhooks later without bypassing the wallet ledger.

## Legal note

This repository is technical software, not legal advice. Provider authorization and end-user legal policies must match the actual business and supplier contracts before public paid launch.

## 13. Runtime model and provider controls

`src/lib/model-store.ts` resolves the active database model at request time. This means model activation and retail markup changes made in Admin can affect runtime requests without changing frontend code.

Text provider routes are stored in `provider_models`. APIMODELS is seeded as priority 10. After you receive Haimaker permission and confirm exact model names, add Haimaker routes through the admin API or Supabase with a lower-priority fallback number (for example 20). Environment mapping remains supported as a bootstrap fallback.

## 14. Welcome-credit abuse protection

The repository includes a conservative disposable-email baseline and idempotent one-time welcome-credit RPC. Before meaningful ad spend or a larger free promotion, connect a maintained disposable-domain/risk service and add stronger device/IP risk rules. The 10-Credit promotion is deliberately not treated as an unconditional signup entitlement.

## 15. Legal starter pages

Starter policy pages exist at `/terms`, `/privacy`, `/acceptable-use`, and `/refunds`. They include the product's actual wallet/provider concepts but are not a substitute for review for your final entity and supplier contracts. Set `NEXT_PUBLIC_LEGAL_REVIEWED=true` only after review.

## Validation note

The source tree has been syntax-parsed with TypeScript in the build environment. The sandbox used to create this repository could not reach `registry.npmjs.org` (DNS `EAI_AGAIN`), so dependency installation and a full `next build` could not be executed here. Run `npm install && npm run typecheck && npm run build` in GitHub/Vercel or a networked local machine before the first deployment.
