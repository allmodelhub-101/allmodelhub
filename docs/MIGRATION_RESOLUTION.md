# Supabase migration resolution

Date: 2026-09-22

## Safety status

The duplicate local `006` version is resolved without changing production. The later file was renamed to the unique version `0061`, its SQL statements remain semantically unchanged, and the complete chain was successfully applied to an isolated staging project.

No production migration, migration-history repair, SQL mutation, or data mutation was performed. Production is **not** ready for `supabase db push`: its broader history still diverges from the repository and must be reconciled object by object first.

## Exact duplicate migrations

| Original file | Introduced | Purpose | Dependencies |
| --- | --- | --- | --- |
| `006_admin_roles.sql` | Commit `a3a4b31`, 2026-09-03 | Creates `public.admin_roles` | Must exist before `20260910100634_unify_admin_authorization.sql`, `20260914160040_add_manual_payment_bonus.sql`, and `011_production_security_hardening.sql` |
| `006_storage_quotas.sql` | Commit `44bb597`, 2026-09-12 | Creates upload reservations, quota index, deny policy, and reserve/release RPCs | Requires `auth.users` and `public.user_files`; must run before `011_production_security_hardening.sql` |

Git history establishes that admin roles owned version `006` first. The storage migration was added later with the same version.

## Read-only production evidence

The authenticated project matching `.env.local` is project `gkmkiperlvmaaefwuvel`. Only catalog queries, migration-list queries, and schema inspection were run against it.

### Migration history

- Version `006` is not recorded remotely.
- Local versions `001` through `011` are not recorded remotely.
- Remote history begins with the dated migrations on 2026-09-10 and contains additional remote-only versions.
- The storage quota SQL is recorded remotely as `20260912180511`; its deny policy is recorded as `20260912180606`.
- The new settlement correction `20260922053357` is not recorded remotely.

The final production recheck confirmed both `legacy_006_recorded = false` and `new_settlement_fix_recorded = false`.

### `006_admin_roles.sql`

Classification: **schema effect present and subsequently augmented, but the local migration was never recorded**.

The production table contains every baseline column from the local migration and is a schema superset:

- baseline: `id`, `user_id`, `role`, `created_at`;
- later additions: `permissions`, `updated_at`, an `auth.users` foreign key, a unique `user_id` index, and RLS;
- the table contains an administrative row and is used by later payment-authorization functions.

No recorded remote migration statement creates `admin_roles`, so its original creation was either manual or predates the tracked remote history. It must not be recreated, dropped, or marked blindly. Production currently also retains broad table grants for `anon` and `authenticated`; `011_production_security_hardening.sql` is designed to revoke them, but `011` has not been applied to production.

### `006_storage_quotas.sql`

Classification: **the local version was never recorded, and its effect was fully superseded by later recorded remote migrations**.

Production contains the expected:

- `file_upload_reservations` table, constraints, RLS, and user/expiry index;
- `storage reservations deny client access` policy;
- `reserve_file_upload(uuid,bigint,bigint)` and `release_file_upload_reservation(uuid,uuid)` functions;
- service-role-only execution grants.

The table had no active rows during inspection. The recorded remote statements in `20260912180511` and `20260912180606` are semantically equivalent to the local storage migration.

## Selected resolution

1. Preserve `006_admin_roles.sql` as version `006`, because it is the older migration and later migrations depend on the table.
2. Rename only the later storage migration to `0061_storage_quotas.sql`.
3. Preserve its position between `006` and `007` so all dependencies remain valid.
4. Do not repair production migration history yet.
5. Add a new forward-only migration, `20260922053357_enforce_immutable_generation_settlement.sql`, after staging exposed a settlement retry inconsistency. The migration makes completed callback settlements immutable and rejects a retry with a conflicting charge.

This normalization is safe for fresh environments. It does not by itself make the existing production history safe to push.

## Staging environment and results

An isolated free-plan project was created:

- name: `amh-security-staging-20260922`
- project ref: `kxywjivopqcxtqejglta`
- region: `us-east-1`

The generated database password was not printed or persisted. Reset it in the Supabase dashboard if direct password-based database access is later required.

Results:

- dry run listed one ordered chain with `006` followed by `0061`;
- all migrations from `001` through `20260922053357` applied successfully;
- local and staging migration histories match exactly;
- `supabase/tests/security_policies.sql` passed;
- `supabase/tests/staging_security_behavior.sql` passed and rolled back all fixtures;
- two-user RLS isolation passed for profiles, wallets, projects, files, support tickets, payments, and generation jobs;
- authenticated access to admin tables, privileged financial RPCs, callback settlement RPCs, and internal generation columns was denied;
- wallet crediting and manual-payment approval were idempotent;
- non-admin payment approval was rejected;
- duplicate callback settlement did not duplicate wallet or profit rows or overwrite the first result;
- a conflicting callback charge was rejected after the forward-only correction;
- test-fixture cleanup check returned zero users, payments, and jobs;
- Security Advisor returned no warning or error findings. Its all-level run reported only informational `RLS enabled with no policy` notices for intentionally service-only tables whose client grants are revoked.

The database-level callback settlement was tested. A real provider webhook was not sent because no staging application was deployed and no provider callback credential was configured; that remains a pre-production staging test.

## Reproduction commands

Run these only against the staging ref:

```powershell
npx --yes supabase@latest link --project-ref kxywjivopqcxtqejglta --yes
npx --yes supabase@latest migration list --linked
npx --yes supabase@latest db query --linked --file supabase/tests/security_policies.sql
npx --yes supabase@latest db query --linked --file supabase/tests/staging_security_behavior.sql
npx --yes supabase@latest db advisors --linked --type security --level warn --fail-on warn
```

Do not run `db push`, `migration repair`, or these tests against production.

## Production reconciliation still required

Before production can receive any migration:

1. Export and securely retain the production migration list and schema-only dump.
2. Enable or confirm an appropriate recovery point/PITR or backup.
3. Build an equivalence matrix for every local version missing remotely (`001`-`011`, including `0061`) and every remote-only version (`20260911060432`, `20260911071537`, `20260911111958`, `20260912180511`, `20260912180606`, and `20260914163441`).
4. For each remote-only version whose effect is already represented locally, add a reviewed compatibility migration file using that exact remote version and no duplicate DDL. This preserves remote history without rewriting it.
5. Only after complete schema equivalence is proven, mark the corresponding low-numbered local versions as applied with `supabase migration repair <version> --status applied --linked`. Repair changes tracking rows only; it must never be used to pretend missing DDL exists.
6. Re-run `migration list`; local and remote columns must align before any `db push` dry run.
7. Run a production-targeted dry run and require independent review of the exact proposed migration set.

No blanket repair command is provided because the evidence gathered in this task proves equivalence only for the duplicate `006` effects, not for the entire divergent chain.

## Rollback approach

- Local filename resolution: before another environment records `0061`, revert the resolution commit to restore the old filename. After an environment records `0061`, do not rename it again; use a forward compatibility migration.
- Staging: tests are transactional. If staging must be discarded, delete the isolated staging project; production is unaffected.
- Settlement correction: never edit or remove the recorded migration. If a regression is found, create another forward-only migration that restores the desired function behavior, test it in a fresh non-production environment, and retain both history entries.
- Production: because no change was made, no production rollback is required for this task.

## Launch gate

The duplicate migration conflict is safely resolved for source control and fresh staging. Production is **not safe for the next migration/deployment stage** until the full history-equivalence matrix, compatibility files, gated repairs, real staging webhook test, environment-secret rotation, and the remaining security launch checklist are complete.
