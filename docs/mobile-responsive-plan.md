# Models Suite responsive transformation — implementation plan

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
