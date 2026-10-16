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

## Additional safety and coverage

The fixture guard has five unit tests covering loopback hosts, absent/exact flag, production/test modes, Vercel (including an empty value), and host lookalikes. A delayed readiness attribute ensures fixture interactions begin after hydration and initial sidebar route-reset timers. Fixture link capture changes only synthetic active-route state; it keeps real hrefs and exercises actual link callbacks without navigating into protected routes. This is not authenticated route navigation.

A synthetic `?chrome=chat` variant exercises legacy chat ancestor selectors against the shared topbar. The topbar's explicit class supplies component ownership at the necessary specificity. Individual chat content/composer sizing and all live ChatClient workflows remain Phase 3 validation work.

The Linux workflow now runs build/typecheck, scoped changed-component lint, homepage/security checks and billing/security/UI tests in a separate job. Full repository lint remains 2 baseline login-form errors and 14 existing warnings; no broad lint suppression was added. Browser CI uses four isolated workers and still runs every original assertion/viewport, plus the new cases. Login/legal Phase 2 snapshots are separately named because removing the unscoped theme hide rule intentionally restores their small-screen theme button; all Phase 1 images remain historical.

Preview access: the ec7aa75 Vercel preview deployed successfully, but anonymous requests redirect to Vercel SSO. The connector returned 403 for the owning team, and scoped CLI inspection returned "The specified scope does not exist". No protection setting or credential was changed. Preview visual testing is BLOCKED until an authorized identity for that team is available.
