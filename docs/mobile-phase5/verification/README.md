# Phase 5 verification record

## Local execution

- Next production build: PASS; explicit TypeScript checks: PASS.
- Security script: PASS across 1551 tracked/unignored files at execution.
- Billing/security/UI: 275 passed, zero failures (156 billing, four security, 115 UI). Chat and studio immutable execution guards remain present; 56 workspace/account/wallet/admin handler/query/formatting baselines independently match Phase 4 original source.
- Scoped lint: zero errors, ten existing warnings; full repository lint: historical two LoginForm errors and 14 warnings. Both logs are preserved. No suppression was added.
- Homepage: identical Git blob to Phase 4 and matching normalized pinned hash. Raw Windows CRLF guard mismatch is recorded separately; Linux foundation runs the unmodified guard.
- Production React workspace/account/wallet/admin presentations: 72 PASS, zero failures, no API requests. Existing 30 Chat and 72 Studio production checks remain in the Linux workflow.
- Actual Next production: 156 PASS public-render/fixture-denial checks. Every added surface fixture returns 404 even with the opt-in flag set in production.
- Shell/Chat/workspace approved visual comparisons: 60 PASS without baseline updates (12 shell,12 Chat,36 workspace). Public references: 16 new images generated only where missing, all reviewed, then 16 PASS comparisons without updates. Studio comparisons: 36 PASS. Total current approved comparisons: **112 PASS** (60 retained Phase 2–4, 52 new Phase 5), with no baseline-update flag during comparison. The independent historic Phase 1 mismatch remains separately reported.
- Historic Phase 1 video reference: one FAIL, three not run after first-failure stop. This reference predates the Phase 4 safe fixture changes; original reference and assertion remain intact. See stale-phase1-reference/README.md and current screenshot. This is reported separately from current Phase 4 studio comparisons.

Batch-specific browser results are in batch-a through batch-d. They overlap; do not sum them into a complete matrix. All 28 viewport/browser projects retain Phase 1–4 coverage. Phase 5 adds 33 default functional cases per project (924 opportunities): 15 A, six B, three C, two D-admin, seven D-public. Discovery confirms 2828 configured cases across 11 default files, including the existing 700 opt-in/protected skips. Configured opportunities are not execution results.

## Exact-head Linux acceptance

The final PR Checks must show successful foundation plus browser shards 1 and 2 on the exact PR head. PR149's final delivery description links that run and its compact artifact counts. Earlier runs are not accepted as final-head evidence. A first final attempt passed foundation but failed the deterministic inventory check because a trailing blank-line correction shifted the CSS evidence by one line; regenerated evidence fixes that mismatch without changing browser assertions. Current checks retain zero retries, fail-fast false and a 60-minute budget for expanded browser coverage.

## Safety and limitations

No API/server/provider/authentication/wallet arithmetic/schema/configuration contract was altered. Fixtures create no session, mount no production controller and block APIs, external requests and mutations. Synthetic form submissions change only local fixture state. No payment, account mutation, administrative operation, generation or real upload occurred.

All 22 authenticated workflows remain BLOCKED pending authorized isolated accounts/backend. Software keyboards/IME, physical safe-area behavior, zoom, AT and lower-end-device performance remain UNVERIFIED. These are Phase 6 release gates, not presentation fixture passes. The draft PR stays unmerged and no production promotion is performed.
