# Phase 2 shared responsive foundation

Continues Phase 1 commit `770fda1b9f9e34c40303caeb4cc559c2362d0bf3` on the same branch and draft PR #149. No merge or production promotion. Implementation and available local checks are complete; final branch CI is tracked separately below. Protected workflows and physical-device validation remain explicitly blocked.

## Changes

MR-005 removes the single unscoped mobile theme hide rule. MR-001 covers Video Studio search key events and restores trigger focus after dismiss/selection. MR-002 makes the window-level workspace shortcut respect an already claimed document event; ChatClient submission code is unchanged.

`WorkspaceFrame` is layout-only; `AppShell` retains all existing authorization and data calls. Its new owned stylesheet migrates the former shared stabilization block and adds local spacing/touch/safe-area tokens, bounded local table scroll, a two-row header through 1180px, and focus/overlay sizing. Existing branding/theme tokens and wide desktop density remain.

`useWorkspaceOverlay` coordinates topmost Escape, focus containment/return and nested document/content scroll locks for shared drawers, mobile navigation, command/help dialogs and ModelPicker. The account menu retains its nonmodal arrow/Home/End/outside-focus behavior. PremiumSelect is now a select-only combobox with active descendant, Home/End and focus restoration.

`/responsive-fixture` requires development mode, explicit `LOCAL_RESPONSIVE_FIXTURES=1`, loopback host, and absence of `VERCEL`. It never calls AppShell, creates a session, or loads private data. It renders the real frame/sidebar/topbar/ModelPicker/PremiumSelect; the topbar offline prop suppresses all backend reads/writes and polling is harmless. Browser tests assert zero application API calls. Protected E2E remains BLOCKED.

## Evidence and validation

`before/shell-{390,768,900,901,1366}.png` captures the synthetic shared frame before CSS improvements, using original Phase 1 shell styles. Fixture content is synthetic, not an authenticated workflow. These first captures include Next development tooling; final evidence hides only that tooling through Next's supported `devIndicators` option under the local flag. Phase 1 public/auth/video historical evidence is preserved in `docs/mobile-baseline`.

The immutable Phase 1 Linux CI run is https://github.com/allmodelhub-101/allmodelhub/actions/runs/38889576324 (296 passed, 40 failed, 600 skipped). Selected exact failure/count log lines are retained in `phase1-ci-failure.log`.

New tests cover both themes, shell geometry, primary chrome visibility and 44px targets at compact widths, content reachability, five mobile destinations, overlays, nested Escape ownership, no API requests, sidebar persistence/account keyboard, selector languages/reduced viewport, theme persistence, and fixture host rejection. Added 900/901px projects retain all original viewport projects and assertions. Chromium and WebKit are both required.

Current results, curated after screenshots, architecture metrics and Phase 3 handoff are recorded below. Authenticated data, physical software keyboards, real provider work and billing flows cannot be signed off by synthetic tests.

## Additional safety and coverage

The fixture guard has five unit tests covering loopback hosts, absent/exact flag, production/test modes, Vercel (including an empty value), and host lookalikes. A delayed readiness attribute ensures fixture interactions begin after hydration and initial sidebar route-reset timers. Fixture link capture changes only synthetic active-route state; it keeps real hrefs and exercises actual link callbacks without navigating into protected routes. This is not authenticated route navigation.

A synthetic `?chrome=chat` variant exercises legacy chat ancestor selectors against the shared topbar. The topbar's explicit class supplies component ownership at the necessary specificity. Individual chat content/composer sizing and all live ChatClient workflows remain Phase 3 validation work.

The Linux workflow now runs build/typecheck, scoped changed-component lint, homepage/security checks and billing/security/UI tests in a separate job. Full repository lint remains 2 baseline login-form errors and 14 existing warnings; no broad lint suppression was added. Browser CI uses four isolated workers and still runs every original assertion/viewport, plus the new cases. Login/legal Phase 2 snapshots are separately named because removing the unscoped theme hide rule intentionally restores their small-screen theme button; all Phase 1 images remain historical.

Preview access: the ec7aa75 Vercel preview deployed successfully, but anonymous requests redirect to Vercel SSO. The connector returned 403 for the owning team, and scoped CLI inspection returned "The specified scope does not exist". No protection setting or credential was changed. Preview visual testing is BLOCKED until an authorized identity for that team is available.

## Screenshot-led corrections

Actual overlay captures exposed the legacy `.app-main { z-index:1 }` stacking context: bottom navigation could paint above drawers despite larger drawer z-index values. The owned frame now clears that context; a hit-test assertion checks that bottom navigation cannot paint above an active shared modal. ModelPicker's portal has a separate `model-picker.css` owner because it is outside the frame: short lists use content-sized rows, search text is 16px, and close/filter controls are at least 44px. A regression assertion bounds short-result option height. These were visible defects missed by earlier geometry-only checks.

The initial sidebar pathname cleanup timer no longer runs unnecessarily on mount; it closes menus only after an actual route change. This avoids racing an immediate first click after hydration. Final local interaction run: 45/45 passed across Chromium 320×568, Chromium 844×390 and WebKit 390×844 before the additional screenshot-led assertions; those assertions have their own follow-up run.

## Recorded validation and acceptance

| Check | Actual result / evidence |
|---|---|
| Full Linux run at 50cb433 | **672 passed, 0 failed, 700 skipped, 0 flaky**, 28 browser projects, 13.5 minutes. https://github.com/allmodelhub-101/allmodelhub/actions/runs/38904343668 |
| Skips | 616 protected workflow instances (22 × 28), 84 opt-in visual instances (3 × 28). No confirmed-defect assertion skipped. |
| Final overlay correction | **6/6 passed** Chromium 390/1366 and WebKit 390, including paint hit-testing above navigation and compact model options. |
| Clean local interactions | **45/45 passed** Chromium 320×568/844×390, WebKit 390×844. |
| Shared visual comparisons | **12/12 passed**, both engines × 390/768/1366 × light/dark, without update-snapshots. |
| Public/video visual comparisons | **12/12 passed** login/legal/video × Chromium 390/768/1366 and WebKit 390, without update-snapshots. Phase 1 video baselines remain valid; intentional theme visibility changes use separately named login/legal baselines. |
| Billing/security/UI unit tests | **186 passed, 0 failed** (156 billing, 4 security, 26 UI including five fail-closed fixture cases). |
| Security checker | PASS; no provider, auth, payment or schema logic changes. |
| Typecheck | PASS locally and Linux foundation job. |
| Optimized production browser check | **18/18 passed**: Chromium/WebKit × 390/768/1366 × login/signup theme persistence plus fixture 404 with flag enabled. `production-browser-results.json`. |
| Production build | PASS locally and Linux foundation job. |
| Scoped changed-component lint | PASS (0 errors, six existing Video Studio image warnings). |
| Full repository lint | Existing **2 errors / 14 warnings**, unchanged login-form state-in-effect errors at original 87/91. Not suppressed. |
| Homepage guard | PASS on Linux and exact Git blob. Windows raw checkout fails because CRLF changes byte hash; homepage source is unchanged. |
| Final code CI | Follow-up full run for 9a88202: https://github.com/allmodelhub-101/allmodelhub/actions/runs/38906215690 . Its foundation job passed; browser result must be checked before sign-off. The PR always links the latest commit run, including evidence-only commits. |
| Vercel preview | Deployment checks succeed; protected visual verification BLOCKED by team-scope access. No production deployment or promotion performed. |

Exploratory failures were retained in `local-browser-runs.json`: early focus restore bugs, development-tool pointer interference, WebKit interaction readiness/timeouts, and the fixes/reruns are distinguished from final verification. No retry-to-green policy was added; CI has retries 0.

## CSS ownership and reduction

Global CSS: normalized UTF-8/LF **647,413 → 644,682 bytes** (−2,731), media/container conditions **846 → 844**, repeated exact selector/condition groups **774 → 768**, dimension candidates **601 → 598**. Small-control candidates in legacy globals remain 201; the new owners have no <44px control declarations. This is a bounded shell migration, not a claim that all CSS risks are repaired. `css-metrics.json` and the generated route/CSS evidence are the machine-readable sources.

Ownership: AppShell keeps server auth/data; WorkspaceFrame keeps structural slots; workspace-shell.css owns chrome/scroll/safe-area/focus/touch rules; model-picker.css owns the portal's result sizing and controls; useWorkspaceOverlay owns stack/focus/scroll; component state retains existing actions. Desktop sidebar styles and existing theme/brand tokens remain. Original broad page-specific overrides remain Phase 3+ debt; fixture `chrome=chat` tests topbar interaction with those selectors.

## Evidence locations and reproducibility

- Historical Phase 1: `docs/mobile-baseline/` and Phase 1 snapshots are preserved.
- Before synthetic shell: `before/`, five widths, original shell styles.
- After shell/auth/drawers/More/help/model library: `after/`; production public captures have a `production-` prefix.
- Approved Windows Phase 2 snapshots: `tests/responsive/__screenshots__/win32/*/phase2-*.png`; never compare them to Linux pixel rendering.
- Full local reports (ignored): `playwright-report/<run>/index.html`, `test-results/<run>/results.json`. Curated compact results are committed here.
- CI artifacts: workflow run → `responsive-foundation`; HTML includes attachments/traces. 50cb433 artifact **23,369,091 bytes**, versus Phase 1 **600,865,164 bytes** (about 96.1% lower), with expanded assertions. Seven-day retention; source screenshots here persist after expiry.
- Run `pnpm test:responsive` for all local projects. For reviewed shell comparisons set `PW_SHARED_VISUAL=1` and select the six existing representative snapshot projects. For public snapshots set `PW_VISUAL=1` and select the four existing public snapshot projects. Missing snapshots are not approval to overwrite or compare operating systems.
- `node scripts/mobile-capture-phase2.mjs` requires an already running explicitly opted-in local development server at 127.0.0.1:3100. It blocks external/mutating requests and captures overlays from both engines.

## Phase 3 handoff and remaining limits

Shared foundation is ready for scoped Chat/message/composer work after the final full code CI is green. The source inventory is now **32 pages, 42 HTTP handlers, 15 stylesheets**; the added route is a local fixture, not another production feature.

1. Obtain an authorized isolated staging account/backend for true authenticated populated workspaces; no production sessions are needed or permitted for fixture work. All 22 protected E2E workflows stay BLOCKED until that exists.
2. Validate actual ChatClient welcome/conversation/streaming/error states using safe fixtures. Reconcile its fixed viewport/content/composer rules with the 108px compact header and existing bottom-nav clearance; `chrome=chat` checks shared topbar only, not the composer.
3. Verify physical iOS/Android keyboard resizing, device safe areas, pinch/text zoom, assistive technology, and long translated labels. Emulated reduced heights and keyboard focus are evidence with these limits.
4. Migrate remaining studio/data/admin overlays incrementally; they do not automatically gain the hook until integrated. No global CSS rewrite or full accessibility/performance certification is claimed.
5. Preserve billing, generation, auth, upload contracts and desktop density; retain screenshots, rerun relevant functional suites and both browser engines for every subsequent change.

No observed regression remains in the verified shared/public scope. Authenticated live workflows and real-device behavior remain unverified. No main merge or production promotion is authorized.
