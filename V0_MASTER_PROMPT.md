# v0 Master Project Instruction — All Model Hub Final V1

You are working inside the production GitHub repository for **All Model Hub**, a Pakistan-first, globally extensible premium AI SaaS. Treat this repository as an existing product to preserve and improve, not as a blank project to regenerate.

## Locked product promise

**Every Leading AI. One PKR Wallet.**

- 1 Credit = PKR 1.
- Purchased credits never expire.
- Pay-as-you-go for individual AI usage.
- Pakistan first; architecture remains global-ready.
- Primary users: freelancers, creators, students. Secondary: agencies/businesses.
- Curated Budget, Balanced, Premium and Flagship tiers plus **All Model Hub Auto** and exact-model selection.
- Text, image, video and audio are public V1 capabilities.
- Manual launch payments: Easypaisa + Meezan Bank proof upload and admin approval.

## Non-negotiable architecture

- Next.js App Router + TypeScript + React.
- GitHub is the source of truth. Never regenerate the entire repository when a focused patch is enough.
- Supabase PostgreSQL/Auth/Storage.
- Upstash rate limiting/temporary locks when credentials are configured.
- Vercel hosting.
- APIMODELS primary provider behind `src/lib/providers/apimodels.ts`.
- Haimaker backup behind `src/lib/providers/haimaker.ts`.
- Provider-specific code stays inside adapters/gateway modules.
- Never call provider APIs from browser code with secret credentials.
- Never put provider/service-role secrets in `NEXT_PUBLIC_*` variables.
- Never replace the wallet ledger with a simple editable balance.
- Never credit a wallet because client-side code says a payment succeeded.
- Preserve wallet holds/capture/release and idempotency for billable operations.
- Pricing/model activation/provider routing remains database/admin driven.
- Historical pricing/receipts must remain reproducible.

## Locked billing behavior

- Normal text chat should not interrupt every message with a price confirmation.
- Show actual Credits used after text generation.
- Expensive image/audio/video actions must display an estimate and require explicit confirmation when applicable.
- Media jobs use server-side wallet holds and async job states.
- User safety settings include daily/single-generation spending limits and expensive media controls.
- Welcome promotion is 10 Credits only after eligible verified/non-disposable-account checks.
- Promotional credits are non-transferable.
- Supplier acquisition cost is never exposed to ordinary customers.
- Internal default cost basis is PKR 310/USD but is a configurable server/admin setting, not customer-facing FX information.

## UX and visual direction

- Default theme: dark ultra-premium technology aesthetic.
- Also support a polished light theme and system preference.
- Avoid generic purple AI-template design.
- Prefer obsidian/near-black surfaces, restrained cyan/blue energy, premium glass/depth, refined typography, high-quality microinteractions and smooth motion.
- Preserve performance: mobile and low-bandwidth mode must reduce expensive decorative effects.
- Pakistan-first UX: PKR, Roman Urdu support, Pakistan workflow templates, mobile-first layout and local payments.
- Do not introduce fake stats, fake testimonials or non-working decorative controls.

## Existing production surfaces

Marketing/legal:
- `/`
- `/terms`
- `/privacy`
- `/acceptable-use`
- `/refunds`

Authentication:
- `/auth/login`
- `/auth/callback`
- `/auth/logout`

Workspace:
- `/chat`
- `/history`
- `/projects`
- `/files`
- `/templates`
- `/models`
- `/battle`
- `/images`
- `/video`
- `/audio`
- `/wallet`
- `/usage`
- `/notifications`
- `/settings`
- `/support`
- `/admin`

## Core product behavior to preserve

- All Model Hub Auto routes based on tier/task/capability/provider availability and admin eligibility.
- Exact-model selection remains available.
- Model Battle compares 2–3 models and bills each selected model independently.
- Prompt Enhancer is a real billable AI request and respects wallet/spending protections.
- Project-aware chat can use project instructions and selected user-file context.
- Conversations support history/search/pin/delete/private behavior.
- Files use private storage and safe signed URLs when an upstream provider needs temporary access.
- Images/video/audio use the provider gateway and real generation job records.
- Long-running media uses persisted async job states.
- Usage/receipts are auditable.
- Notifications/support/privacy routes remain functional.
- Admin can manage payments, users/wallet credits, model activation/markup, provider routes/settings and support replies without exposing supplier cost to customers.

## Before modifying backend-critical code

Read the relevant files first, especially:
- `supabase/migrations/001_init.sql`
- `supabase/migrations/002_seed_models.sql`
- `supabase/migrations/003_completion.sql`
- `supabase/migrations/004_final_release.sql`
- `src/lib/wallet.ts`
- `src/lib/pricing.ts`
- `src/lib/model-store.ts`
- `src/lib/system-settings.ts`
- `src/lib/idempotency.ts`
- `src/lib/spending.ts`
- `src/lib/providers/*`
- the relevant `src/app/api/**/route.ts`

Do not weaken financial/security invariants to satisfy a cosmetic request.

## Runtime configuration rules

- Runtime pricing/model status comes from Supabase; static catalog data is bootstrap/fallback only.
- Provider routing for text models uses `provider_models`; APIMODELS is intended primary and Haimaker is exact-model fallback only when mapped/authorized.
- File uploads are private and may be converted to short-lived signed URLs for provider calls.
- Public legal pages are product-ready starter text but still require the owner’s final legal review before accepting real money; respect `NEXT_PUBLIC_LEGAL_REVIEWED` if used in release workflow.

## How to work in this repo

1. Preserve existing functionality.
2. Make focused, reviewable changes rather than recreating the app.
3. Do not replace real API/database flows with mock data.
4. Do not hardcode production secrets.
5. Run `npm run typecheck` and `npm run build` after dependency installation.
6. If a live provider parameter is uncertain, keep it configurable in the provider adapter rather than inventing unsupported behavior.
7. For UI refinement, maintain the premium dark/light design and responsive behavior while leaving backend contracts intact.

## First task after import

Perform a repository-aware connection audit only: identify missing environment variables, confirm all four Supabase migrations are intended to run in order, confirm Supabase auth callback settings, and confirm provider credentials are absent from source. Do **not** rewrite the application. Then help connect the user’s real Supabase/APIMODELS/Haimaker credentials and fix only integration errors revealed by live testing.
