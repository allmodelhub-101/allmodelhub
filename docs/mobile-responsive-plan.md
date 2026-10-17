# Phase 6 continuation

Phase 6 now owns final hardening; see mobile-phase6/README.md, route-acceptance.md and manual-acceptance.md. Preserve prior milestones and immutable backend/auth contracts. Release requires isolated E2E, physical devices/AT and exact-head CI; no merge or production promotion.

# Models Suite responsive transformation — implementation plan

## Phase 5 progress — Batch A

Seven workspace/discovery surfaces are implemented with production View components and scoped workspace-data.module.css. [Phase 5 record](mobile-phase5/README.md) distinguishes local acceptance from final Linux/production acceptance. Next: Batch B Settings/Support/Usage, Batch C Wallet/payment presentation, Batch D Admin/public/auth, then complete retained regression and exact-head CI. Keep all 22 authenticated workflows BLOCKED, preserve existing hashes and do not merge/promote.


## Phase 4 delivery and Phase 5 entry

Image, Video and Audio continue the existing branch/PR in three ordered implementation commits. [Phase 4 handoff](mobile-phase4/README.md) records batch acceptance, screenshots, fixture boundaries and actual verification. Preserve the Phase 2 shell, Phase 3 Chat and all controller payloads, authorization, settlement, uploads and polling.

Phase 5 order: inspect current main/overlapping work; then history/library/projects/templates and tables; account/settings/support forms; wallet/payment presentation without purchases or mutations; admin/public polish under authorized roles or explicit blockers; full browser/production/contract regression and reviewed screenshots. Reuse WorkspaceFrame/useWorkspaceOverlay/ModelPicker/PremiumSelect and component-owned CSS, local content scrolling, 44px primary actions and visible focus.

Phase 5 entry requires exact-head Linux CI success and reviewed Phase 4 visual comparisons. Fixtures do not prove authentication or real generation. Release requires authorized isolated E2E and physical iOS/Android keyboard/safe-area/zoom/assistive-technology checks. Phase 6 remains full accessibility/performance/regression hardening with a separate release decision. No merge or production promotion is authorized.


## Phase 3 implementation and Phase 4 entry

Chat implementation is on the existing feature branch and draft PR #149. See [Phase 3 handoff](mobile-phase3/README.md) for exact acceptance and CI evidence; earlier Phase 1/2 sections below describe prior milestones. ChatWorkspace and chat-workspace.css own presentation, while ChatClient keeps business/state contracts. The safe fixture mounts those real components and uses only synthetic local callbacks. Model, project, reasoning, privacy, enhancement, paste, attachment, voice and Send/Stop controls remain available.

Phase 3 completion gates: green full Linux Chromium/WebKit matrix and regression checks; reviewed before/after and approved Windows screenshot comparisons; production Next build/typecheck and fixture-denial checks; ten unchanged contract hashes plus shared input-policy tests; explicit protected/device blockers. Repository-wide lint's two pre-existing LoginForm errors and 14 warnings are independent debt. The Windows homepage raw-byte guard is line-ending-sensitive; Linux and the LF-normalized unchanged homepage match the pinned hash.

Phase 4 implementation order:

1. Recheck main, PR head and overlapping #117 Video/#106 billing work. Reuse this branch/PR and read each studio's actual controller/CSS dependencies before editing.
2. Image Studio first: extract presentation only when it reduces risk; cover welcome, prompt/options, upload previews, synthetic result grids/viewers, errors/loading, long filenames and short-height overlays. Preserve model flags, request fields, upload contracts and billing.
3. Video Studio next: preserve Phase 2 Escape/focus work, generation/settlement handlers and aspect-ratio behavior; test synthetic long controls, history and preview media without provider calls.
4. Audio Studio modes last: speech/music/sound-effects controls, long text, file previews, audio-player reachability and mode switching, with synthetic media and no real purchases/generations.
5. For every studio, use owner-scoped CSS, guarded real presentation fixtures, all 28 projects, light/dark plus 900/901 breakpoint checks, before/after image review, production component/Next checks and existing billing/security/UI tests. Do not add broad global overflow clipping.

Phase 5 remains workspace/account/data/payment/admin/public polish; Phase 6 remains full accessibility/performance/regression hardening and a separate release decision. Obtain an authorized isolated account/backend to unblock the 22 authenticated workflows; physical iOS/Android keyboards, zoom, safe areas and assistive technology remain release gates. Phase 4 presentation work can proceed with the existing safe fixture approach after Phase 3's available gates are green; this does not authorize merging or production promotion.

## Phase 2 continuation

Phase 2 is implemented on the existing branch/PR; see `mobile-phase2/README.md` for validation and acceptance. Phase 1 sections below describe the original baseline and proposed sequence. Shared layout now uses WorkspaceFrame + workspace-shell.css, with a gated synthetic shell and central overlay hook. Do not interpret the original Phase 1-only scope paragraph as prohibiting the explicitly requested Phase 2 UI work.

Before Phase 3, require green Linux responsive CI, reviewed before/after evidence, passing build/type/security/billing/relevant UI checks, and an explicit record of blocked authenticated/device cases. Full lint's pre-existing login-form effects are independent debt unless safely addressed in a dedicated change.

Phase 3 implementation order: (1) validate an authorized isolated chat account when available, (2) connect the chat content/message/composer height budget to the new shell header and mobile safe-area clearance, (3) make model/tool/attachment popovers share overlay ownership, (4) test long messages, code/tables, attachments and empty/error states with safe fixture data, (5) verify keyboard resizing and focus on physical iOS/Android, then (6) compare desktop screenshots and run billing/security/UI plus Chromium/WebKit matrices. Preserve Enter/Shift+Enter, streaming, cancellation, pricing and file-upload/server contracts. No live generation is needed for layout verification.

Phases 4–6 retain the sequence below: studio layouts/media first, workspace/data/payment/admin surfaces second, cross-device accessibility/performance/regression sign-off last. Each change needs owner-scoped CSS, actual screenshots, functionality checks and an explicit blocked list. Do not expand Phase 3 into the full global stylesheet rewrite.


Phase 1 baseline source: `314c76404b98156ea4bdd8bb63899df24e9eb8b4` on `main`, inspected 2026-10-16 (Asia/Karachi). Branch: `feat/mobile-first-responsive-overhaul`. This phase adds documentation and test tooling only. See the audit and test matrix for actual results and remaining blockers.

## Scope and safety contract

Preserve branding, copy, model availability, server authorization, billing, wallet arithmetic, provider calls, persistence and desktop workflows. No production secrets, schemas, provider settings or billing settings may change as part of responsive work. Tests must never submit generations, top-ups, account changes, uploads or support requests against a real backend. No main merge or production promotion is authorized in Phase 1.

## Proposed responsive architecture

Retain existing light/dark tokens (`--bg`, `--panel`, `--text`, `--muted`, `--line`, `--accent`, `--radius`) and modality color identities. Add semantic tokens only when implementing an owning component: spacing 4/8/12/16/24/32px; fluid page gutters; shell navigation height; header height; dialog inset; layer levels. Do not redefine every token or adopt a new CSS framework in one patch.

Use a single-column base with `min-width:0` on grid/flex children, fluid media with aspect ratios, deliberate local scroll regions for tables and model rails, and content-driven expansion. Initial proposed shared breakpoints: compact <=600, intermediate 601–900, wide >=901. Studio container queries remain useful because sidebar width reduces usable canvas. Validate these values at 600, 768, 844 landscape, 900/901 and 1024 before migrating existing 620/680/700/720/760/940 rules. Breakpoints are proposals, not approved redesigns.

Define one shell scroll owner and one safe-area-aware mobile navigation inset. Chat needs a bounded message region plus an in-flow composer; media pages need ordinary page scroll. Prefer dynamic viewport units with fallback, but verify real keyboard resizing and focus scroll on physical Safari/Chrome. Do not use global horizontal clipping as proof that layout fits.

Centralize overlay behavior (Escape, focus entry/trap/restore, inert background, nested scroll locking), then migrate one modal at a time. Define layer ordering for navigation, dropdowns, dialogs and toasts. Preserve each form's event handlers and server contract. Aim for >=44px touch controls, readable inputs >=16px on phones, visible focus, semantic labels, error association and 200% zoom/reflow.

CSS migration: identify the winning rule with computed styles; add a component-owned equivalent; compare all supported widths/themes; remove only the superseded rules in the same reviewed change. Avoid introducing cascade layers around old rules without a precedence study: unlayered legacy rules would still win. Compare production CSS ordering as well as development mode.

## Component dependency order

Root theme/globals → AppShell → AppSidebar / mobile navigation + WorkspaceTopbar → page content / scroll ownership → shared selectors and dialogs → ChatClient + ModelPicker → studios → data/forms/admin. AuthPage and LegalPage form independent public branches. WalletClient has payment dependencies and must keep all calculations and submissions untouched. The generated route inventory lists transitive components and styles for every page, including ancestor layouts.

## Six-phase milestones and acceptance gates

| Phase | Work and ordering | Acceptance |
|---|---|---|
| 1 Foundation | Route/dependency enumeration, CSS evidence, Playwright matrix, public + fixture baseline, existing checks, documentation, draft PR | Actual PASS/FAIL/BLOCKED evidence; no app behavior changes; blockers named |
| 2 Shared shell | Resolve authorized isolated test environment first; unify shell scroll, sidebar/mobile rail, topbar, safe areas and overlay stack | 24 browser/viewport projects; no covered document overflow; nav reachable; drawer focus trapped/restored; desktop sidebar collapse retained; light/dark and short landscape reviewed |
| 3 Chat + shared controls | Composer/messages, model picker, attachments UI, command/search overlays, dropdown keyboard support | Long messages/code/tables contained; composer reachable with physical keyboard shown; no send/generation tests without safe backend fixtures; existing chat contracts preserved |
| 4 Media studios | Image first, Video next, Audio modes last; upload/preview/result/loading/error layouts | Fixture states and representative long content; responsive previews; no generation purchases; model controls and dialogs usable at all widths |
| 5 Workspace/account | Projects, library, files, templates, models/compare, notifications, support/settings, wallet/usage, admin tabs; public auth/legal/home polish | Empty/populated/error/loading states; local table scrolling; touch/focus/zoom; wallet wizard reviewed without submitting; admin authorized session required |
| 6 Hardening | Remove demonstrated dead overrides incrementally, full regression + performance/accessibility pass, physical-device keyboard checks | Chromium/WebKit full matrix, approved visual diffs, production-mode preview verification, green existing checks or explicitly accepted pre-existing failures, no provider/billing regression, explicit release decision |

Each phase should remain a small reviewable series of commits with updated route inventory, defect evidence, before/after screenshots and milestone checklist. Rebase against current main before implementation; recent sidebar/audio/templates/library changes may move the baseline. Open PRs #121 (homepage scrolling), #117 (video settlement), #106 (billing policy effective time) were present at preflight; inspect their current status before overlapping work.

## Priorities and handoff

1. P1: arrange an authorized nonproduction account/backend for workspace and admin coverage. Never invent a cookie/session or enable privileged UI on production.
2. P1: shared navigation/composer/overlay ownership and physical-device keyboard acceptance before page-by-page polish.
3. P2: small controls, mobile input typography, tablet breakpoints and stacked layouts; verify with browser evidence rather than broad CSS replacement.
4. P2: performance profiling on actual mobile hardware; reduced-motion screenshots do not establish animation smoothness.
5. P3: consolidate responsive rules after behavior is covered, with a documented owner for each style.

Phase 2 may start with isolated shell work once baseline evidence is reviewed; authenticated acceptance cannot be signed off until the missing session/backend coverage is resolved. Failed baseline tests are defect records, not permission to alter layouts in Phase 1.

Phase 1 handoff: source discovery and architecture documentation are complete; browser execution confirms MR-001 (Video dropdown Escape) and MR-005 (auth theme switch hidden below 901px). See the test matrix for the 216-case development run and corrected rechecks, 48 production rendering passes, 12 final visual comparison passes and seven representative interaction/control failures. Overall validation is PARTIAL because authenticated system coverage is unavailable. Start Phase 2 by scoping the global `.theme-toggle` rule and establishing shell fixtures/authorized runtime coverage; keep generation/auth/payment handlers unchanged.


Phase 5 Batch B: settings/support/usage presentation implemented; see `mobile-phase5/batch-b/README.md` and per-route acceptance. Original account handlers, usage query/aggregation prefix and financial formatting are guarded against the Phase 4 source. Named table regions own horizontal scrolling; the shell retains navigation clearance. Safe local fixtures are separate from the 22 BLOCKED authenticated workflows. Final exact-head Phase 5 CI is still required.


Phase 5 batches A-D are implemented on the existing feature branch. Evidence and local acceptance are in `mobile-phase5/README.md`, batch-a through batch-d, and route-acceptance.md. New scoped owners cover workspace, account, wallet and admin presentation; original handlers and usage calculations remain guarded by 56 Phase 4 source hashes. All 22 authenticated workflows remain BLOCKED; hardware/AT checks remain UNVERIFIED. Final production build, retained comparisons and exact-head Linux foundation/both shards are recorded separately; local fixture checks are never authenticated E2E claims. Phase 6 begins with isolated account provisioning, full protected workflows, real iOS/Android keyboard/IME and accessibility/performance acceptance.
