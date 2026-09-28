# Billing V2 production cutover gate

Date: 2026-09-27  
Decision: **NO-GO — production cutover was aborted before mutation**

No production migration, migration-history repair, feature-flag change, deployment, provider-billable smoke call, wallet mutation, hold release, or job reconciliation was performed.

## Why the cutover stopped

Fresh validation contradicts the premise that Billing V2 passed staging:

- Staging has `0` Billing V2 receipts, so no real quote → reserve → provider → settle → receipt flow has been proven there.
- Staging pricing coverage is incomplete: text `18 active / 0 priced`, image `13 / 0`, video `15 / 0`, and audio `11 / 8`. Billing V2 correctly fails closed for the unpriced routes.
- Staging records migration `20260922094346_production_schema_reconciliation`, but that migration is absent from the current source-controlled mainline candidate. GitHub and the staging ledger therefore do not describe one reproducible schema history.
- The existing staging readiness report already records a NO-GO and says the real provider matrix was not run.
- The production migration ledger still diverges from the repository baseline. Production must not receive a blanket `db push` or blind migration-history repair.

## Current production baseline (read-only)

- Wallets: `3`
- Purchased balance: `2296.415714` Credits
- Reserved balance: `101.9466` Credits
- Wallet transactions: `83`
- Active holds: `8`, totaling `101.9466` Credits
- Generation jobs: `12 completed`, `4 processing`
- Failed charged jobs: `0`
- Billing V2 tables: not installed

The aggregate production wallet reservation equals the active-hold total. The eight existing holds were left untouched; they require provider-confirmed reconciliation by original provider task ID after a valid Billing V2 deployment. They must not be blindly released or deleted.

## Mainline integration result

An isolated local release branch, `codex/billing-v2-production-gate`, was built from the complete local Billing/security mainline and replayed the newer upstream UI commits without changing the user's dirty frontend checkout.

Integrated successfully:

- supplied OpenAI logo/front-end asset change
- first-paint chat model rail fix
- audio input estimate fix
- all Billing V2 and prerequisite security commits

Not integrated:

- `04df14f fix: recover interrupted chat streams`

That change conflicts with the Billing V2 chat route and reintroduces legacy hold/capture formulas plus a fallback provider call after a provider-specific reservation. It needs a Billing-aware retry implementation that cancels/releases the failed attempt, resolves the fallback provider route, creates a new provider-specific quote and reservation, and settles only the successful attempt.

## Local verification

- Billing V2 tests: `45/45` passed
- TypeScript: passed (`tsc --noEmit --incremental false`)
- ESLint: passed with `0 errors` and `4 existing warnings`
- Next.js production build: passed

## Migrations applied

None. Production remains at its pre-cutover migration ledger. No production data or migration tracking rows changed.

## Required before another production attempt

1. Add the missing staging migration to source control as a reviewed forward-only compatibility migration, or otherwise establish one exact source commit whose migrations reproduce the staging ledger. Do not edit applied migrations.
2. Add provider-verified, dimension-complete pricing rules for every production-enabled text, image, video, and audio route. Keep all missing/stale/blocked routes fail-closed.
3. Deploy that exact commit to an isolated staging application and run the representative real-call matrix. Require nonzero linked usage events and receipts plus exact hold/capture/release evidence.
4. Implement and test Billing-aware interrupted-stream fallback without restoring legacy authoritative charging.
5. Reconcile the full production migration-equivalence matrix and review the exact ordered production migration plan before applying any DDL or migration repair.
6. Only after those gates pass: apply the reviewed migrations, enable Billing V2, deploy, perform tiny smoke calls, and run provider-confirmed reconciliation for the eight active holds.

## Status summary

- Billing V2 production status: **not enabled**
- Models blocked/unverified: all intended text, image, and video routes; 3 of 11 active audio routes
- Stale holds: `8 pending provider-confirmed reconciliation`; `0` manually released
- Deployment: **not started**
- Legacy billing: unchanged; no new Billing V2 production transaction was created

