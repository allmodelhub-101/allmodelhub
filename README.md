# All Model Hub

All Model Hub is a Next.js 16 application for multi-model chat, image/video/audio studios, file and project context, wallet-based credit accounting, manual PKR payments, and an authenticated operations console backed by Supabase.

## Local development

1. Copy `.env.example` to `.env.local` and configure Supabase, provider, callback, and optional Upstash values.
2. Install with `pnpm install`.
3. Run `pnpm dev`.

Upstash is optional for availability: when it is missing or unreachable, each application instance applies a conservative in-memory rate limit. Provider and wallet safety checks remain mandatory.

## Database

Read [docs/production-schema.md](docs/production-schema.md) before changing schema or financial flows. The live project contains real user activity; migrations and reconciliation must preserve ledger idempotency.

## Release checks

```bash
pnpm exec tsc --noEmit
pnpm exec eslint src --max-warnings=0
pnpm build
```
