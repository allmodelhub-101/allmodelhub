# Production database workflow

The live Supabase project is `gkmkiperlvmaaefwuvel`. Its schema predates reliable migration tracking: migrations `001` through `007` describe the legacy bootstrap schema, but the production database was originally created or changed outside the migration ledger.

## Authoritative state

- `001_init.sql` through `007_profit_tracking.sql` are retained so a new database can be bootstrapped. They must not be applied to the existing production database.
- Timestamped migrations are the production change log from 2026-09-10 onward. Their versions must match the Supabase migration ledger exactly.
- All future DDL changes must be made through a timestamped migration and committed in the same pull request as dependent application code.
- Never edit an already-applied migration. Add a new migration instead.

Current production-tracked migrations:

| Version | Purpose |
| --- | --- |
| `20260910100219` | Atomic generation settlement and secure manual-payment approval |
| `20260910100634` | Unified `profiles` / `admin_roles` authorization |
| `20260910104628` | Function grants, foreign-key indexes, RLS optimization, duplicate-index cleanup |

## Operational checks

Before release, compare local timestamped files to `supabase_migrations.schema_migrations`, run Supabase security and performance advisors, and run the application typecheck, lint, and production build.

The seven RLS-enabled tables with no end-user policy (`admin_profit_logs`, `admin_roles`, `audit_logs`, `model_price_history`, `provider_models`, `request_idempotency`, and `system_settings`) are intentionally service-role-only. Do not add public read policies merely to silence the informational advisor.

Leaked-password protection is an Auth project setting, not SQL DDL. Enable it in Supabase Dashboard → Authentication → Sign In / Providers → Password security, then rerun the security advisor.

## Financial reconciliation

Generation completion must go through `complete_generation_job`; payment approval must go through `approve_manual_payment`. Both functions are idempotent and service-role-only. Never update wallet balances, holds, job completion, or payment approval directly.

For old nonterminal jobs, use the Admin Jobs “Reconcile” action. It polls the original provider first, then captures exactly once on confirmed completion, releases only on confirmed failure, and leaves ambiguous jobs unchanged.
