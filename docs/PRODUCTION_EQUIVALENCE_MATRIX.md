# Production migration equivalence matrix

Date: 2026-09-22  
Production Supabase project: `gkmkiperlvmaaefwuvel`  
Reference staging project: `kxywjivopqcxtqejglta`

## Decision

**BLOCKED — production history mismatch or missing evidence**

This matrix was built with read-only migration-ledger and catalog queries. No production SQL, migration repair, data mutation, or deployment was performed. The production ledger contains only ten dated versions, while the repository contains the normalized `001`–`011` chain plus six dated migrations. Live production is not schema-equivalent to a fresh application of the repository chain.

Classification meanings:

- **Equivalent:** recorded version and/or live effect is materially the same.
- **Superseded:** the original effect exists but a later migration intentionally changed it.
- **Compatible remote-only:** the production-only version is an exact or verified semantic counterpart of a differently numbered local migration.
- **Mismatch:** the expected live object is missing or materially different.
- **Unknown:** evidence is insufficient; repair is prohibited.

## Local-to-production matrix

| Local migration | Production ledger | Classification | Read-only evidence |
| --- | --- | --- | --- |
| `001_init.sql` | Not recorded | **Superseded, not repair-ready** | Core enums, trigger, tables, constraints, functions, RLS, and private buckets exist. Later migrations changed many objects. Production differs from the fresh chain in grants, bucket limits/types, `admin_profit_logs`, and settlement function, so the aggregate baseline cannot yet be repaired safely. |
| `002_seed_models.sql` | Not recorded | **Superseded** | Production and staging both have 57 active model IDs and 57 active provider routes with identical ordered ID/route digests. Production has 40 price-history rows versus staging's 36, a compatible data superset requiring owner review rather than deletion. |
| `003_completion.sql` | Not recorded | **Equivalent then intentionally changed by `011` locally** | Notifications and prompt-template tables exist; all six template slugs match. Production retains the original public-read policies. Staging has the authenticated-only replacements from `011`. |
| `004_final_release.sql` | Not recorded | **Superseded, not repair-ready** | Product tables, seed keys, request-idempotency table, auth trigger, and private storage buckets exist. Production retains the pre-`011` 10 MiB payment-proof limit and 500 MiB generated-assets limit; staging has hardened limits and MIME restrictions. |
| `005_production_hardening.sql` | Not recorded | **Superseded with a chain defect** | Its index is later dropped by recorded `20260910104628`. Production has a different canonical normalized index, `manual_payment_reference_unique_idx`; the fresh staging chain does not. A forward-only corrective migration is required before history repair. |
| `006_admin_roles.sql` | Not recorded | **Mismatch / augmented untracked object** | Production has one live row and a schema superset (`permissions`, `updated_at`, FK, unique index), but also different nullability. No recorded production statement creates the table. Blindly applying or repairing `006` is unsafe. |
| `0061_storage_quotas.sql` | Not recorded | **Compatible remote-only / superseded** | Its table, index, functions, service-role grants, RLS, and deny policy are present. Recorded production versions `20260912180511` and `20260912180606` contain the same DDL split across two migrations. No active reservation rows were present during inspection. |
| `007_profit_tracking.sql` | Not recorded | **Mismatch** | `public.profit_records` does not exist in production. `011` expects it and would fail if run without a forward correction or an explicitly reviewed application of `007`. |
| `008_unified_workspace.sql` | Not recorded | **Compatible remote-only** | Recorded `20260911060432_unified_workspace` contains the same statements; live project column, UI schema column, favorites table, RLS, policies, constraints, and index exist. |
| `009_workspace_index_hardening.sql` | Not recorded | **Compatible remote-only** | Recorded `20260911071537_workspace_index_hardening` contains the same three index statements and the indexes exist. |
| `010_seed_model_ui_schemas.sql` | Not recorded | **Compatible remote-only** | Recorded `20260911111958_seed_model_ui_schemas` has the exact content hash of the local file. Production and staging have 38 non-empty UI schemas. |
| `011_production_security_hardening.sql` | Not recorded | **Mismatch / never applied** | Production does not force RLS on audit, idempotency, or upload reservations; retains public template/feature policies; retains broad client grants on sensitive tables; has pre-hardening bucket limits; and lacks the local `profit_records` prerequisite. |
| `20260910100219_financial_integrity.sql` | Recorded | **Equivalent then superseded** | Ledger version is present; financial functions and unique job-profit index exist. `complete_generation_job` is later expected to be replaced by `20260922053357`, which production lacks. |
| `20260910100634_unify_admin_authorization.sql` | Recorded | **Equivalent then superseded** | Ledger version is present; current payment approval function includes both profile and `admin_roles` authorization and was later replaced by the bonus migration. |
| `20260910104628_security_and_performance_hardening.sql` | Recorded | **Equivalent** | Ledger version is present; all compared RLS policies and supporting indexes exist. It intentionally removed the two earlier payment-reference indexes, exposing the fresh-chain index gap noted above. |
| `20260914010000_expand_catalog_36_models.sql` | Recorded | **Equivalent with compatible data superset** | Production/staging model and route digests match: 57 active models and 57 active routes. Production retains four additional price-history records. |
| `20260914160040_add_manual_payment_bonus.sql` | Not recorded | **Compatible remote-only** | Production records `20260914163441_add_manual_payment_bonus`; its stored statement MD5 exactly matches the complete local file (`dcb3ccacf238b8a51df998001f9084a8`). Live bonus columns, constraints, and approval function match. |
| `20260922053357_enforce_immutable_generation_settlement.sql` | Not recorded | **Mismatch / never applied** | Production `complete_generation_job` definition differs from staging and lacks the verified immutable-settlement correction. |

## Production-only ledger versions

| Production version | Local counterpart | Classification | Evidence |
| --- | --- | --- | --- |
| `20260911060432_unified_workspace` | `008_unified_workspace.sql` | **Compatible remote-only** | Stored SQL is statement-for-statement equivalent. |
| `20260911071537_workspace_index_hardening` | `009_workspace_index_hardening.sql` | **Compatible remote-only** | Stored SQL is statement-for-statement equivalent. |
| `20260911111958_seed_model_ui_schemas` | `010_seed_model_ui_schemas.sql` | **Compatible remote-only** | Exact content MD5 match. |
| `20260912180511_storage_quotas` | Most of `0061_storage_quotas.sql` | **Compatible remote-only** | Same table, index, reservation functions, revokes, and service-role grants. |
| `20260912180606_storage_reservations_explicit_deny_policy` | Remaining policy in `0061_storage_quotas.sql` | **Compatible remote-only** | Same authenticated deny policy. |
| `20260914163441_add_manual_payment_bonus` | `20260914160040_add_manual_payment_bonus.sql` | **Compatible remote-only** | Exact complete-file MD5 match. |

No compatibility files were added. Although the six remote-only mappings above are verified, the full chain is not equivalent; adding ledger-shaping files now would obscure the unresolved schema blockers.

Of 18 local migration mappings, 11 have a verified equivalent/superseding counterpart and 7 remain unsafe for repair or application (`001`, `004`, `005`, `006`, `007`, `011`, and `20260922053357`).

## Material live-schema differences

Compared with the fully migrated staging reference, production has:

- 36 versus 37 public/storage relations; `public.profit_records` is missing.
- 20 column differences, concentrated in missing `profit_records` and the augmented `admin_roles` / incompatible `admin_profit_logs` shapes.
- 4 constraint and 3 index differences, including a production-only canonical payment-reference index.
- 4 policy differences: production retains public feature/template read policies instead of the authenticated-only `011` policies.
- 121 sensitive table-grant differences across admin, audit, provider, pricing, system, idempotency, wallet, payment, job, and profit tables.
- different `complete_generation_job` behavior because the immutable settlement migration is absent.
- pre-hardening storage limits/MIME policy: payment proofs 10 MiB and generated assets 500 MiB in production versus 5 MiB and 250 MiB with an explicit media MIME allowlist in staging.
- nine existing `admin_profit_logs` rows in a table whose nullability, defaults, timestamp type, and FK delete actions differ from the fresh chain.

Production Security Advisor also reports leaked-password protection disabled. This is an independent launch blocker.

## Evidence commands used

All commands were read-only:

```powershell
npx --yes supabase@latest migration list --project-ref gkmkiperlvmaaefwuvel
npx --yes supabase@latest db query --linked --project-ref gkmkiperlvmaaefwuvel "<catalog-only SQL>"
npx --yes supabase@latest db query --linked --project-ref kxywjivopqcxtqejglta "<same catalog-only SQL>"
npx --yes supabase@latest db advisors --linked --project-ref gkmkiperlvmaaefwuvel --type security --level warn
```

Catalog evidence covered relations/RLS flags, columns/defaults/nullability, constraints, indexes, policies, table/routine grants, function identity/definitions, storage bucket configuration, enums, triggers, non-secret seed keys, and model/route digests. No user-row contents were selected.
