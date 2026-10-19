# Premium mobile navigation — preview-only change

Integration base: `75258ac` on main, including restored Chat commit `a8d9bf976f17f233ee2367f2234deedcdf27dba1` and current Generation Center Chat activity. Branch: `feat/premium-mobile-navigation`. This is a separate follow-up to merged PR149. Do not merge or promote this follow-up before the user reviews its Preview.

## Implementation boundaries

- Through 600 CSS pixels, workspace-shell.css owns a 56px row plus the top safe area. Project, search, notifications, wallet and avatar keep 44px targets. Search invokes the existing palette; project names truncate; wallet balance remains in its accessible name. The 601–1180 tablet/intermediate header and wide desktop layout retain existing geometry.
- The phone avatar opens a portaled account dialog with settings, the existing ThemeToggle and the original logout form destination/method. useWorkspaceOverlay remains the sole modal focus/scroll/Escape owner. Resize beyond 600 closes the phone panel. Only the currently applicable theme control mounts, preserving hydration and avoiding competing theme states.
- AppSidebar retains Chat/Image/Video/Audio/More. More now groups Workspace, Explore, Activity and Account. All destinations remain, with Admin still conditional on isAdmin. The active More state also represents a selected secondary destination. Scrollable sheet content has a sticky close header and safe-area padding.
- workspace-navigation.ts is a UI-only count/open bridge, also coordinating existing search/help shortcuts while mobile menus are open. WorkspaceTopbar still owns useGenerationCenter, status grouping, Chat activity, polling, errors, refresh and retry. More dismisses before opening that same drawer and returns focus to More. No second job hook, provider call or generation implementation was added.
- `?navigation=demo` supplies synthetic projects, one unread notification and one active Chat entry only to the existing guarded offline fixture. Production data flow does not supply these props; all production fixture gates remain unchanged.

Application changes are limited to workspace-topbar.tsx, app-sidebar.tsx, workspace-shell.css, new workspace-navigation.ts, and the guarded responsive-fixture component/page. No global CSS, page presentation, business handler, theme implementation or dependency changed. Nineteen source hashes and seven topbar handler hashes are pinned to the integration base in tests/ui/mobile-navigation-preservation.json; the restored Chat View/CSS also match a8d9bf9 directly.

## Evidence and verification

`before/` contains 64 actual captures of the integration-base presentation: eight surfaces (Chat/Image/Video/Audio/Projects/Library/Wallet/Settings), Chromium/WebKit, 390/1366 widths and light/dark. These are synthetic presentation captures, never customer/authenticated screenshots. `after/` uses the same scenarios. Approved historical visual references are not rewritten.

Focused tests cover the 56px row and non-overlapping 44px targets, long and short project names, persisted project selection, palette filtering, unread badge/drawer, wallet destination and balance label, account/theme/focus/backdrop behavior, grouped More, all destinations, active state, Generation Center Chat entry/count/handoff, and actual presentation clearance. Existing shell tests now assert phone access through its approved menu locations rather than requiring removed phone controls to remain in the top row. Existing Chat/studio accessibility readiness checks wait for the actual root theme; dedicated navigation cases exercise the relocated theme control.

Local execution: 328 Node tests passed; build/types, lint, security and homepage checks passed (seven existing lint warnings). Focused shell/navigation: 56 passes; handoff/motion repetitions: ten passes; new dialog axe scans: eight passes. See verification/README.md for chronology, hydrated before/after image review, exact boundaries and the remaining exact-head Linux acceptance. The PR records final CI/Preview metadata.

Exploratory local failures are retained, not counted as passes: Windows network suspension (ERR_NETWORK_IO_SUSPENDED), a browser launch timeout, and a Turbopack HMR cell panic interrupted runs. A first geometry assertion sampled a real -2px hover transition; it now moves the pointer away and waits for stable alignment without removing the animation. Reusing one page across fixture routes exposed a WebKit prefetch/navigation race; the multi-surface test now gives each route its own page while retaining all console/runtime/API assertions. A clean cache and uninterrupted runs distinguish implementation defects from these diagnostics. No retry setting, blanket skip or existing threshold was weakened.

## Acceptance limits

Fixtures do not certify real project persistence, notification read mutations, wallet accounting, logout, generation refresh or authenticated authorization. Existing controller/handler checks supplement presentation tests; they do not replace isolated E2E. Physical iOS/Android keyboards, safe areas, IME, assistive technology and hardware motion/performance remain unverified. No paid requests, customer uploads, purchases or real account changes are used.

Final delivery must include the exact head, Preview URL, full available verification, before/after image review and desktop comparisons. Production remains unchanged by this branch until separate visual approval.
