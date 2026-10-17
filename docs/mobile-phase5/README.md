# Phase 5 — remaining workspace, account, wallet and administration

## Status and verified entry

**IN PROGRESS.** Continue the same feature branch and draft PR #149. No merge or production promotion is authorized. Phase 4 entry was independently verified: head `690745ad9ef38808bb797b9c62560d3505d6ba50`, run [38952838410](https://github.com/allmodelhub-101/allmodelhub/actions/runs/38952838410), foundation and both browser shards successful. Main remains `314c76404b98156ea4bdd8bb63899df24e9eb8b4`.

The source inventory contains 32 pages and 43 HTTP handlers. Open PR #106 changes a Billing V3 migration; #117 changes Video execution, billing and migrations; #121 changes homepage scrolling and global CSS. Their files were inspected at preflight. No execution changes from these PRs are imported. Homepage content/hash and prior Chat/studio handler guards must remain intact.

## Ordered milestones

| Batch | Scope | Implementation | Acceptance |
|---|---|---|---|
| A | History, projects, files, templates, models, comparison, notifications | Implemented | Local checks and reviewed visual comparisons pass; Accepted locally; milestone committed before Batch B |
| B | Settings, support, usage | Pending | Must follow accepted A |
| C | Wallet/payment presentation | Pending | Must follow accepted B; financial behavior unchanged |
| D | Admin tabs, public/auth/legal/recovery | Pending | Must follow accepted C; no authorization weakening |
| Final | Entire retained matrix, production checks, contracts and exact-head CI | Pending | Both Linux shards and foundation required |

## Batch A boundaries and initial findings

HistoryClientView, FilesClientView, ProjectsClientView, NotificationsClientView and ModelBattleView render the real production DOM with original production controller callbacks. The original clients call private controller hooks. Derived search/filter/sort logic remains in the real presentation where practical. FilesWorkspace shares the existing file page frame between production and synthetic rendering. ModelsMarketplace and TemplateLibrary already accept data and retain their existing definitions, pricing and destinations.

`workspace-data.module.css` owns Batch A layout and controls. It uses the established theme tokens, content-driven flow, compact/tablet columns and visible focus. There is no new framework. The shared frame remains the viewport and navigation owner.

Reproduced before-layout findings at 320px:

- Library tools measured 393px while the document measured 320px; page clipping concealed the broken layout.
- Projects extended the inner app canvas to 354px.
- Long model content extended the inner app canvas to 1314px.
- A long comparison selector extended the inner canvas to 1082px.
- File state badges were hidden by compact CSS, and selection clearing used a button role nested within another button.
- Asset details lacked the existing shared overlay focus/Escape lifecycle.

The library's root `overflow:clip` declaration was retired with evidence in `batch-a/retired-css.json`. Oversized decorative orbits are contained only inside the aria-hidden artwork. Content sizing and inner-canvas assertions provide verification beyond document-level clipping. The remaining legacy global selectors are not presumed dead. The existing Library source guard now asserts the same decorative containment on the aria-hidden artwork plus visible page overflow; its automatic page-height and app-content scroll assertions are retained. Browser tests additionally reject hidden inner-canvas overflow. The initial 240-test regression run recorded 239 passes and this one location-dependent source assertion failure, prompting that ownership-aware update.

Twenty-one Phase 4 function-body hashes in `tests/ui/workspace-contract-baseline.json` protect the retained workspace/file/project/notification/comparison handlers. Existing Chat and Studio baselines are untouched. These static checks supplement regression tests; they do not establish authenticated behavior.

## Evidence interpretation

`batch-a/before/` contains 35 clean captures: seven actual production presentation surfaces at 320×568, 390×844, 844×390, 768×1024 and 1366×768. These use synthetic data after presentation extraction and semantic-control cleanup, with the Phase 5 layout module disabled. They are before-layout evidence, not original authenticated screenshots. A first exploratory capture ran before the hydration readiness marker and is superseded by the clean 35-capture run.

Synthetic fixtures reuse `/responsive-fixture?surface=...&state=...`, behind development mode, explicit opt-in, loopback Host and no Vercel. They mount no production controller, create no session and make no account/API call. External and mutating requests are blocked; new fixture tests additionally abort and assert zero application API requests. Synthetic submit/read/favorite/selection adapters update only local state. Real deletion, upload, provider requests and account mutations are never executed.

## Release gates retained

All 22 true authenticated workflows remain **BLOCKED** without an authorized isolated account/backend. Fixture acceptance never implies authenticated E2E. Physical iOS/Android keyboards/IME, safe areas, text/pinch zoom, assistive technology and low-end-device profiling remain **UNVERIFIED** until actually performed. Production release acceptance and Phase 6 hardening are separate decisions.

## Batch A acceptance record

Seven actual production presentations were implemented and reviewed. The final owner preserves desktop columns, makes compact controls reachable, retains native editing and current callbacks, keeps file status visible and uses shared modal focus/scroll/Escape behavior. Project panels retain DOM/visual traversal order; New project focuses the original field. Library details hand global shortcuts to the unchanged topbar after closing, including the rapid-entry case. The overlay budgets actual safe-area insets with vh/dvh fallbacks; hardware behavior remains unverified.

| Executed check | Actual result |
|---|---|
| All seven surfaces, light/dark, five representative projects | 70 passed / 0 failed in the clean run before final image refinements |
| Affected post-review surfaces and new cross-dialog shortcut case | 55 passed / 0 failed |
| Final compact typography cases | All 30 history/template/model cases passed; the same 35-case run also had four shortcut passes and one rapid-shortcut failure |
| Rapid shortcut repair | 15/15 explicit repetitions passed, across five projects; repeats are diagnostic repetitions, not retries or extra matrix cases |
| Final Project input/Tab/sort/activation plus captures | 10 functional checks + five captures passed; Chromium 390px capture refreshed separately |
| Billing/security/UI regressions | 240 passed / 0 failed: 156 billing, four security, 80 UI including 21 new original-handler hashes |
| Final UI-only recheck | 80 passed / 0 failed |
| Final Library pointer/Tab containment/Escape/shortcut and captures | 20 passed (15 functional + five captures), plus two dark dialog captures; four focused containment checks also passed |
| Production Next build / TypeScript | PASS locally; 32 pages retained; explicit TypeScript check has no diagnostics |
| Scoped lint | Zero errors, three existing warnings (Library memo/img and unused notification import) |
| Security script | PASS across 1148 tracked/unignored files at that execution |
| Visual references | 36 generated, all reviewed in six contact sheets, then 36/36 comparison passes without update-snapshots |

These local runs overlap and must not be added together as a full-matrix count. The final Phase 5 Linux run must execute the retained suite plus all new cases on the final head. Batch A contributes 15 functional cases per project (420 opportunities across 28 projects); discovery is not execution. Existing 700 default skips remain independent protected/opt-in coverage. Actual authenticated workflows remain BLOCKED.

Evidence: `batch-a/before/` has 35 before-layout light captures. `batch-a/after/` has final top/content captures at the five requested dimensions, plus selected dark captures in both engines. `batch-a/visual-review/` contains the six inspected contact sheets for all 36 new references. The platform-specific reference PNGs live in `tests/responsive/__screenshots__/win32/*/phase5-*.png`. `batch-a/local-runs.json` preserves clean and exploratory stats. `batch-a/review-findings/` retains selected images that prompted refinements. `batch-a/verification/` holds compact logs. No raw browser trace tree is committed. Expanded Library details captures verify actual compact dialog appearance; the final check covers pointer Close in addition to Escape. Files retains its original SSR icon import, with 12/12 focused visual comparison passes after sharing the page header.

Source-only evidence: `batch-a/original-contract-verification.json` independently matches all 21 new baselines against verified Phase 4 source. `batch-a/findings.md` and `retired-css.json` describe reproduced defects and bounded CSS changes. Snapshot generation was followed by image review and comparison; no prior phase reference was regenerated.

Next authorized batch: Settings, Support and Usage. Preserve their validation, requests, permissions and calculations; use the same gated presentation isolation. Then Wallet/payment presentation, Admin/public/auth, and the final comprehensive production/Linux regression. Overall Phase 5 remains IN PROGRESS.
