# Phase 2 shared responsive foundation

Continues Phase 1 commit `770fda1b9f9e34c40303caeb4cc559c2362d0bf3` on the same branch and draft PR #149. No merge or production promotion. Full validation is in progress; this is not a sign-off.

## Changes

MR-005 removes the single unscoped mobile theme hide rule. MR-001 covers Video Studio search key events and restores trigger focus after dismiss/selection. MR-002 makes the window-level workspace shortcut respect an already claimed document event; ChatClient submission code is unchanged.

`WorkspaceFrame` is layout-only; `AppShell` retains all existing authorization and data calls. Its new owned stylesheet migrates the former shared stabilization block and adds local spacing/touch/safe-area tokens, bounded local table scroll, a two-row header through 1180px, and focus/overlay sizing. Existing branding/theme tokens and wide desktop density remain.

`useWorkspaceOverlay` coordinates topmost Escape, focus containment/return and nested document/content scroll locks for shared drawers, mobile navigation, command/help dialogs and ModelPicker. The account menu retains its nonmodal arrow/Home/End/outside-focus behavior. PremiumSelect is now a select-only combobox with active descendant, Home/End and focus restoration.

`/responsive-fixture` requires development mode, explicit `LOCAL_RESPONSIVE_FIXTURES=1`, loopback host, and absence of `VERCEL`. It never calls AppShell, creates a session, or loads private data. It renders the real frame/sidebar/topbar/ModelPicker/PremiumSelect; the topbar offline prop suppresses all backend reads/writes and polling is harmless. Browser tests assert zero application API calls. Protected E2E remains BLOCKED.

## Evidence and validation

`before/shell-{390,768,900,901,1366}.png` captures the synthetic shared frame before CSS improvements, using original Phase 1 shell styles. Fixture content is synthetic, not an authenticated workflow. These first captures include Next development tooling; final evidence hides only that tooling through Next's supported `devIndicators` option under the local flag. Phase 1 public/auth/video historical evidence is preserved in `docs/mobile-baseline`.

The immutable Phase 1 Linux CI run is https://github.com/allmodelhub-101/allmodelhub/actions/runs/38889576324 (296 passed, 40 failed, 600 skipped). Selected exact failure/count log lines are retained in `phase1-ci-failure.log`.

New tests cover both themes, shell geometry, primary chrome visibility and 44px targets at compact widths, content reachability, five mobile destinations, overlays, nested Escape ownership, no API requests, sidebar persistence/account keyboard, selector languages/reduced viewport, theme persistence, and fixture host rejection. Added 900/901px projects retain all original viewport projects and assertions. Chromium and WebKit are both required.

Final results, curated after screenshots, CI links, architecture metrics and Phase 3 handoff will be recorded after execution. Authenticated data, physical software keyboards, real provider work and billing flows cannot be signed off by synthetic tests.
