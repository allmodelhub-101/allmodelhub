# Billing V2 staging readiness

Date: 2026-09-26  
Decision: **NO-GO — staging cutover is blocked**

No production deployment, production database mutation, or provider-billable test call was made during this validation. Real provider calls were deliberately withheld because the available Vercel Preview configuration is not isolated from production and cannot create authoritative staging wallet/receipt evidence.

## Verified

- Connected staging Supabase project: `kxywjivopqcxtqejglta`.
- The staging migration ledger includes every Billing V2 migration through:
  - `20260926183545_add_billing_shadow_validations`
  - `20260926183637_index_billing_shadow_validation_foreign_keys`
  - `20260926183909_deduplicate_billing_shadow_anomalies`
- No unapplied Billing V2 migration was found in the local source-controlled migration set.
- Current staging billing invariants are clean:
  - wallet/reservation mismatches: `0`
  - completed generations without a valid capture: `0`
  - failed generations with a charge: `0`
  - migrated debits without a receipt: `0`
  - duplicate settlements: `0`
- Current staging financial state is empty and clean:
  - active holds: `0` (`0` Credits)
  - Billing V2 quotes: `0`
  - Billing V2 receipts: `0`
  - billing anomalies: `0`
  - shadow validations: `0`
- Local Billing V2 automated suite: `45/45` passing.
- TypeScript typecheck: passing.

## Release blockers

### 1. There is no isolated staging deployment

The connected Vercel project currently lists Production deployments only. Its Preview environment resolves `NEXT_PUBLIC_SUPABASE_URL` to production project `gkmkiperlvmaaefwuvel`, not staging, and does not provide the server-side Supabase/provider credentials required by Billing V2. `BILLING_V2_SHADOW_VALIDATION` is unset.

Deploying or exercising that Preview configuration would risk writing test activity to production, so it was not used.

### 2. GitHub and the staging migration ledger do not have one matching revision

GitHub default branch currently resolves to `e0491f499b798250591f9f5ab4f28d3466d83120` and does not contain the final Billing V2 migration files. The local Billing V2 branch resolves to `2721f2b29f8e673fde7e52ac65ba703781916df8`, while the staging ledger also contains `20260922094346_production_schema_reconciliation`, which is on the newer GitHub history but not tracked by the local Billing V2 branch.

The staging schema therefore reflects the union of two histories rather than one GitHub commit that can be deployed and audited reproducibly.

### 3. The authoritative staging pricing registry is incomplete

Staging contains eight active, verified pricing rules, all for APIMODELS audio/TTS models. It has no current provider-specific rules for text, image, reference-image, variable-resolution image, or video requests.

This is safe in the sense that Billing V2 fails closed, but it blocks the requested cutover matrix. Static catalog prices must not be copied into the registry as a substitute for provider-verified rules.

## E2E matrix

| Scenario | Result | Evidence / reason |
| --- | --- | --- |
| Text | Blocked | No authoritative staging pricing rule and no isolated staging deployment |
| Cheap text | Blocked | No authoritative staging pricing rule and no isolated staging deployment |
| Image | Blocked | No authoritative staging pricing rule and no isolated staging deployment |
| Reference image | Blocked | No authoritative staging pricing rule and no isolated staging deployment |
| Variable-resolution image | Blocked | No authoritative staging pricing rule and no isolated staging deployment |
| TTS | Blocked before provider call | Pricing rule exists, but no safe staging app/service-role configuration exists to prove hold, capture, usage event, and receipt atomically |
| Audio | Blocked before provider call | Same deployment isolation blocker |
| Video | Not attempted | Missing verified pricing and not financially justified while the release gate is red |
| Failed request release | Automated tests pass; live staging blocked | No safe staging request path |
| Duplicate callback / charge | Automated tests pass; live staging blocked | No safe staging request path |
| Provider fallback pricing | Automated tests pass; live staging blocked | No complete multi-provider staging registry |
| Small-cost accuracy | Exact-decimal automated tests pass down to `0.000001`; live staging blocked | No safe staging request path |

Because no real staging operation could safely traverse quote → reserve → provider → settle → receipt, there is no predicted-versus-provider-reported cost comparison to sign off yet.

## Required before retrying cutover

1. Create or configure an isolated Vercel staging/Preview environment whose Supabase URL, publishable key, service-role key, callback secrets, provider keys, and cron secret all belong to staging/test scope.
2. Set `BILLING_V2_SHADOW_VALIDATION=true` only in that staging environment.
3. Merge/push the Billing V2 commits together with the current GitHub default-branch migration history so one GitHub SHA exactly explains the staging ledger.
4. Add new source-controlled migrations containing provider-verified, dimension-complete pricing rules for every model/provider route used in the E2E matrix. Keep missing rules fail-closed.
5. Deploy that exact SHA to staging, then run the real call matrix and verify wallet balances, holds, usage events, receipts, anomalies, idempotency, failure release, and provider-reported costs before reconsidering production.

Production remains blocked until all three release blockers are resolved and the real staging matrix passes without a known loss or overcharge condition.

Preview deployment trigger: 2026-09-27
