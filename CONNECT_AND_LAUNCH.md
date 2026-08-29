# All Model Hub — Final Connect & Launch Guide

This repository contains the full frontend/backend application code for the audited All Model Hub release candidate. Never paste production secrets into source files or GitHub.

## 1. Upload to GitHub
Upload the CONTENTS of this folder to the repository root. `package.json`, `src/`, `supabase/`, `.env.example`, and `next.config.ts` must be at the root.

## 2. Connect the same GitHub repository to v0 and Vercel
GitHub remains the source of truth. v0 may refine the UI or make focused patches, but it must not replace the financial/provider architecture.

## 3. Create Supabase and run ALL migrations in this exact order
1. `supabase/migrations/001_init.sql`
2. `supabase/migrations/002_seed_models.sql`
3. `supabase/migrations/003_completion.sql`
4. `supabase/migrations/004_final_release.sql`

Do not skip migration 004; it contains final release schema/storage/security additions.

## 4. Add environment variables in Vercel
Copy the names from `.env.example` into Vercel Project Settings → Environment Variables and fill in real values.

Required for core production:
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APIMODELS_API_KEY`
- `APIMODELS_BASE_URL`
- `CALLBACK_SECRET`
- `ADMIN_BOOTSTRAP_EMAIL` during initial owner bootstrap
- `EASYPAISA_ACCOUNT_TITLE`
- `EASYPAISA_ACCOUNT_NUMBER`
- `MEEZAN_ACCOUNT_TITLE`
- `MEEZAN_IBAN`
- `MEEZAN_ACCOUNT_NUMBER`

Recommended production values:
- `INTERNAL_USD_PKR=310`
- `WELCOME_CREDITS=10`

Optional/fallback/observability:
- `HAIMAKER_API_KEY`
- `HAIMAKER_BASE_URL`
- `HAIMAKER_MODEL_MAP_JSON`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `SENTRY_DSN`
- `NEXT_PUBLIC_POSTHOG_KEY`
- `NEXT_PUBLIC_POSTHOG_HOST`
- `NEXT_PUBLIC_SUPPORT_WHATSAPP`
- `NEXT_PUBLIC_SUPPORT_EMAIL`

## 5. Configure Supabase Auth
Enable Email authentication. Enable Google OAuth if desired. Add the production callback URL:
`https://YOUR-DOMAIN/auth/callback`

## 6. Bootstrap the first admin
Set `ADMIN_BOOTSTRAP_EMAIL` to your owner email during first setup. Confirm the resulting profile role is owner/admin in Supabase. Remove or rotate bootstrap configuration after successful setup.

## 7. Configure storage and verify migrations
The migrations create/upgrade the private storage buckets and policies used by payment proofs, user files, and generated assets. Confirm these buckets/policies exist after migration execution.

## 8. Provider authorization
Do not accept paid public traffic until APIMODELS and any backup provider authorize your intended customer-facing commercial SaaS usage.

## 9. Install and build in a networked environment
Run:

```bash
npm install
npm run typecheck
npm run build
```

The current ChatGPT sandbox could not download npm packages because npm registry access timed out, so this final dependency-linked build is a mandatory deployment check.

## 10. Live integration tests before accepting money
Test at minimum:
- signup/login + welcome-credit eligibility
- normal streaming text chat
- Auto Best and exact-model selection
- Prompt Enhancer
- Model Battle with 2–3 models
- file upload + project-aware chat context
- image generation/edit/reference-image flow
- video generation + explicit confirmation + wallet hold/capture/release
- audio/TTS generation
- failed provider request releasing eligible holds
- manual Easypaisa payment proof submission
- manual Meezan payment proof submission
- duplicate payment-reference protection
- admin payment approval/rejection
- wallet transaction/receipt history
- admin model enable/disable
- admin markup/system setting change without redeploy
- Haimaker exact-model fallback if configured/authorized
- notifications/support/privacy export/delete flows
- mobile + dark/light + low-bandwidth experience

## 11. v0 instruction
After importing the GitHub repository into v0, give v0 the contents of `V0_MASTER_PROMPT.md` as the permanent project instruction. Ask it to preserve the existing backend/security architecture and only make focused fixes/refinements.

## 12. Go-live rule
The repository is code-complete for the planned V1 scope, but production readiness requires your live credentials, successful `npm run build`, Supabase migration execution, provider authorization, and the integration checks above. No source-code package can safely pre-embed those private/external values.
