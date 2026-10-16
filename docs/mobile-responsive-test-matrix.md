# Responsive baseline test matrix

## Phase 3 Chat coverage

Both Chromium and WebKit use **320×568, 360×800, 375×812, 390×844, 430×932, 844×390, 600×960, 768×1024, 900×900, 901×900, 1024×768, 1180×820, 1366×768 and 1920×1080**. Ten Chat cases per project add 280 executed opportunities to the preserved Phase 2 suite. Exact final Linux counts/run links are in [Phase 3 handoff](mobile-phase3/README.md); configuration discovery alone is not a pass.

| Coverage | Implementation and limit |
|---|---|
| Welcome / themes / controls | Light/dark, geometry, document overflow, composer/header/nav separation, compact single toolbar row and 44px primary controls. Actual screenshots at representative widths. |
| Input | Native text entry, Shift+Enter, synthetic composition Enter, auto-growth cap, long paste/context removal and local send. Shared pure input policy tested separately. Real mobile IME remains unverified. |
| Models / overlays | Real ModelPicker search, disabled unavailable result, selection, focus return, Escape and Ctrl+K exclusivity; project/tier selection and settings focus containment; privacy/reasoning/enhancement reachability. |
| Conversation | Long Markdown headings/lists/quote/URLs/unbroken text, focusable local code/table scrolling, draft-preserved history position, Latest, explicit new submission and synthetic streaming/Stop. |
| Files / actions / feedback | Long attachment names, local file picker, removal, reduced viewport, local edit/retry/branch/voice presentation, loading, pending billing, interrupted response and preserved error draft. No upload/microphone/provider/billing E2E claim. |
| Combined short-height states | Expanded 12-line drafts with attachments or errors at a reduced viewport: composer above navigation, history at least 24px, input/Send in view and error region keyboard-focusable. Eight targeted cases at 320×390 / 844×390 passed; the assertions also run throughout the 28-project matrix. |
| Diagnostics | Every Chat case rejects console/runtime/hydration errors, failed resources and any `/api/` request. Shared suite additionally retains external/mutation guards and production fixture gating. |
| Visual references | 12 reviewed Windows welcome references, then 12 comparison passes at both engines × 390/768/1366 × light/dark. Opt in with `PW_CHAT_VISUAL=1`; never compare Windows snapshots to Linux or regenerate to hide a failure. Long content/attachments/controls have reviewed screenshot evidence, without claimed visual baseline comparisons. |
| Production | 30 production-React component scenarios (both engines × phone/landscape/desktop × five states), plus 30 actual local Next production public-render/fixture-denial checks. The component bundle uses production React but does not claim Next authenticated E2E or optimized chunk equivalence. |

Reproduction: `pnpm test:responsive` runs the complete matrix with no retries. `pnpm exec playwright test tests/responsive/chat.spec.ts` selects Chat only. For approved Windows comparisons use `PW_CHAT_VISUAL=1` with both engines at 390×844, 768×1024 and 1366×768. `LOCAL_RESPONSIVE_FIXTURES=1 node scripts/mobile-chat-production-check.mjs` runs the loopback standalone harness. Build and start Next at 127.0.0.1:3101 with the same explicit flag, then run `node scripts/mobile-chat-next-production-check.mjs` to verify public production rendering and fixture 404s. These commands never create a session or trigger paid requests.

The **22 protected workflows remain BLOCKED**, multiplied across the matrix in the suite's skip count; optional approved-visual cases also skip by default. Those skips are not functional passes. The local fixture has welcome/conversation/long/streaming/loading/pending/error/interrupted/attachments/project states. Authentication, persisted conversation switching, real SSE/provider behavior, microphone recognition, settlement and physical-device keyboard/assistive technology still need an authorized environment/hardware.

## Phase 2 coverage

Current projects: both Chromium and WebKit at all original 12 dimensions plus **900×900 and 901×900**, for 28 projects. `workspace.spec.ts` exercises the gated real shared components with synthetic state in light/dark, visible chrome/touch geometry, long-content access, focus/scroll/Escape, nested shortcut ownership, sidebar/account persistence, mobile More/backdrop, language/reduced viewport, theme persistence, non-loopback rejection, chat-coupled selectors and synthetic active-route selection. Marketing navigation still tests actual public route navigation. Protected workflow tests remain separately BLOCKED.

Historical Phase 1 results below are unchanged. Current exact run results and links belong to `mobile-phase2/README.md`. Do not aggregate exploratory runs during editing as a final clean run or count a synthetic route selection as authenticated navigation.

Screenshots are file attachments, geometry JSON is attached by path, HTML artifacts contain useful failure evidence, and CI uploads only HTML plus result JSON (7-day retention) to avoid duplicating the raw attachment tree. Default baseline screenshots are limited to 390/768/1366; `PW_CAPTURE_ALL=1` restores captures at every size. Assertions still run at every configured size. Windows/Linux snapshots remain separate; `PW_SHARED_VISUAL=1` enables shared-shell comparisons at representative widths after baseline review.


Source baseline: `314c76404b98156ea4bdd8bb63899df24e9eb8b4`, 2026-10-16, Asia/Karachi. Evidence is from an isolated Windows localhost checkout, not a production verification.

## Configuration and execution

Pinned pnpm 10.34.3, Node 24.21.0, Next.js 16.3.3, React 19.2.8, Playwright Test 1.64.1. `playwright.config.ts` defines Chromium + WebKit projects for each viewport:

| Class | Width × height |
|---|---|
| Small phones | 320×568, 360×800, 375×812 |
| Phones | 390×844, 430×932 |
| Short landscape | 844×390 |
| Small tablet | 600×960 |
| Tablet | 768×1024, 1024×768 |
| Laptop | 1180×820, 1366×768 |
| Desktop | 1920×1080 |

This is viewport/touch emulation, not certification on actual iPhones/iPads/Android devices. Chromium/WebKit desktop engines cannot fully reproduce mobile keyboard/browser chrome, safe-area hardware or accessibility assistive technology. iOS focus zoom and screen-reader reading order need physical-device verification.

The suite only accepts localhost URLs. The webServer clears backend/provider credentials in its child environment. Browser interception blocks external requests and all non-GET/HEAD/OPTIONS requests. Service workers are blocked. The public routes are derived from the source inventory. Tests never log in, submit account changes, send chat, generate media, upload files or buy credits. The existing `/studio-fixture` route is development-only and does not render the authenticated shell; its production 404 is expected.

`baseline.spec.ts` checks document status, visible heading, primary controls on core pages, document overflow, runtime/console errors and failed resources, and attaches viewport screenshots plus geometry/control measurements. Geometry offenders may be intentionally scrollable rails/decorations; inspect evidence before filing defects. Small targets are recorded, not auto-failed under an invented WCAG rule.

`interactions.spec.ts` exercises marketing menu/Escape and login navigation, local form typing/password visibility/reduced-height focus, video fixture dropdown and viewer. No form is submitted. `visual.spec.ts` is opt-in (`PW_VISUAL=1`); reviewed OS/browser/viewport-specific PNGs live under `tests/responsive/__screenshots__`. Initial snapshot generation is not a regression pass: rerun without `--update-snapshots` after review. Linux CI must produce its own reviewed Linux baselines before enabling visual assertions there.

## Repeatable commands

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium webkit
pnpm audit:routes
pnpm audit:css
pnpm test:responsive:smoke
pnpm test:responsive
pnpm exec playwright show-report
```

For selected Windows snapshots, set `PW_VISUAL=1` in the shell and run `pnpm exec playwright test visual.spec.ts --project=chromium-390x844 --project=webkit-390x844 --project=chromium-768x1024 --project=chromium-1366x768 --update-snapshots`. Review then repeat without the final flag. All test reports are ignored in Git; curated evidence and summary logs belong in `docs/mobile-baseline`.

GitHub Actions `.github/workflows/responsive.yml` runs the full public/fixture viewport suite on Linux, validates generated inventory and uploads HTML/JSON, screenshots and retained failure traces for 14 days. No deployment credentials or session secrets are present. Known defects remain red assertions instead of being silently converted into passes. Protected-route tests use Playwright skip with an explicit `BLOCKED` reason; this never means the workflow passed.

## Protected coverage and genuine blockers

All authenticated workspace routes, admin tabs and `/auth/verified` require a dedicated authorized test session and isolated backend. They are source-audited but their protected UI is **BLOCKED** in browser tests. No credentials/session were provided; no auth bypass or fabricated cookie is used. `/auth/update-password` can be rendered publicly but successful submission requires a recovery session and is not tested.

Workspace sidebar/bottom drawer, topbar search/notifications/onboarding, populated chat/composer, Image/Audio studios, wallet wizard, file upload preview, settings/support submissions, tables/receipts and admin states remain unverified at runtime. Never interpret a public login screenshot or a fixture screenshot as coverage for those workflows.

## Recorded checks

Actual results and defect evidence are appended below after execution. A setup run performed while dependencies were changing is invalid evidence and is excluded from baseline results. Windows CRLF checkout bytes cause the existing `check:homepage` raw hash check to fail although `git show HEAD:src/app/page.tsx` matches its expected hash exactly; this is an environment issue, not a homepage source regression.

| Existing check | Actual result | Attribution |
|---|---|---|
| `pnpm build` | PASS | Compiled, typechecked and generated route manifest without production credentials |
| `pnpm typecheck` | PASS | Successful completed install; includes new Playwright TypeScript |
| `pnpm lint` | FAIL: 2 errors, 14 warnings | Existing `login-form.tsx:87,91` state updates in effects; other warnings in existing source/tests; application files unchanged |
| `pnpm test:billing` | PASS: 156/156 | Local pure tests/PGlite; no paid provider requests |
| security + UI Node tests | PASS: 25/25 | `node --experimental-strip-types --test tests/security/*.test.mjs tests/ui/*.test.mjs` |
| `pnpm check:security` | PASS | Repository source guardrails |
| `pnpm check:homepage` | FAIL on Windows checkout | Expected Git blob SHA256 `9b1f0c6657febef0a27e540644a8ba8977025d5b5d581896c8e68e5739c25d4d`; local CRLF SHA256 `33bd90079b82a2053771e847ff4fcbfec3978309dc0c5317b2e99f1cc21fca8e`. No homepage diff |
| New tooling ESLint | PASS | Playwright config/specs + inventory/CSS scripts; rerun after final tooling changes |

## Reproduced defect log

| ID | Severity | State / reproduction | Evidence / owner | Status |
|---|---|---|---|---|
| MR-001 | P2 | Visit `/studio-fixture`; open model picker; focus is automatically in search; press Escape; trigger remains `aria-expanded=true` | `interactions.spec.ts` dropdown test; retained screenshot/trace; `src/components/video-studio.tsx:694` handles trigger/list keydown but not search | Existing UI behavior, reproduced on Chromium phone/tablet/desktop; fix in shared-controls/media phase |
| MR-002 | P2 static risk | Ctrl/Command+K on authenticated Chat bubbles through document + window listeners, potentially opening ModelPicker and command palette together | `chat-client.tsx:155`, `workspace-topbar.tsx:68`; authenticated runtime reproduction BLOCKED | Resolve shortcut ownership after authorized baseline |
| MR-003 | P2 static risk | Auth mobile input font 14px; image prompt 13px; several compact controls 27–38px | CSS evidence JSON with source selectors and conditions | Physical focus zoom and touch spacing verification pending |
| MR-004 | P1 verification gap | Shell/mobile nav/composer/overlay coexistence with software keyboard, short landscape and tablet sidebar | AppShell requires authenticated backend; fixture omits shell | BLOCKED without isolated authorized session; do not claim a reproduced defect |
| MR-005 | P2 | Open `/auth/login` at 390 or 768; theme switch has computed display none and 0×0 rectangle; at 1366 it displays | Unscoped `.theme-toggle{display:none}` in `globals.css:896` overrides auth surface expectations; `auth-theme-control.log`, screenshots, interaction test | Confirmed responsive control loss; fix in Phase 2 |

The initial smoke harness tried a hidden desktop Login link after closing the phone menu. That timeout is a test-locator mistake, not a site defect; the corrected test reopens the mobile menu before navigating. Keep the initial smoke log as historical diagnostic evidence, and use subsequent results for final acceptance.

## Final executed browser results

| Run | Actual result | Meaning |
|---|---|---|
| Full development render matrix | **214 passed, 2 failed / 216** | All 9 render targets across all 24 engine/viewport projects executed. The two failures were WebKit auth recovery at 600×960 and signup at 768×1024, reporting hydration attribute mismatches involving screenshot-injected `caret-color:transparent`. No document overflow assertion failed. |
| Corrected harness recheck | **4 passed / 4** | Both affected auth routes rerun at both affected WebKit sizes after explicit hydration readiness and avoiding caret mutation. Original failures remain recorded; this was not a fresh clean 216-case run. |
| Local production bundle | **48 passed / 48** | 8 public/recovery targets at Chromium + WebKit 390×844, 768×1024 and 1366×768; `/studio-fixture` intentionally excluded because it is production-disabled. Confirms production CSS chunk rendering separately. |
| Final visual references | **12 generated, then 12 comparison passes** | Login, privacy and Video fixture at Chromium 390×844 / 768×1024 / 1366×768 and WebKit 390×844. Uses hydration readiness, restored empty fixture prompt, reduced motion and only dev-tool hiding. PNGs inspected; earlier screenshot timing runs are superseded. |
| Final interactions | **12 passed, 4 failed / 16** | Marketing menu/navigation, local login form usability and video viewer passed at all four representative projects. Four model-dropdown Escape assertions failed: MR-001. |
| Auth control availability | **1 passed, 3 failed / 4** | Desktop theme switch passed; Chromium phone/tablet and WebKit phone failed visibility: MR-005. |
| Protected browser coverage | **BLOCKED: 22 routes** | Initial smoke records 88 blocked instances (22 × 4 projects); no dedicated authorized session/backend. Initial smoke also had 12 opt-in visual skips, giving 100 total skips. These are not functional passes. |

Test discovery resolves **936 configured test cases** (39 per project × 24). This is configuration discovery, not a claim that all 936 were executed. The complete 216-case render matrix, representative interactions and visual comparisons above were executed. The CI workflow runs the larger default suite and will remain red while MR-001/MR-005 persist; no expected-failure suppression was added.

All repository check outcomes above are final for this Phase 1 implementation; new tooling lint and final TypeScript checks both exited 0. Frozen pnpm 10.34.3 install also exited 0. `git diff HEAD -- src proxy.ts next.config.ts next-env.d.ts` was empty before committing; generated tracked `tsconfig.tsbuildinfo` was restored.

## Verification boundaries and acceptance

Using the Vercel verification guidance, the story here is **route → existing UI render → safe local navigation/form/fixture state → rendered response**. API/database/provider side effects are outside the authorized test path.

| Boundary | Status | Evidence |
|---|---|---|
| Source route → dev UI | Exercised with disclosed harness failures/rechecks | 216-case matrix, geometry, screenshots |
| Public route → production UI | PASS | 48-case local production run; no cloud deployment |
| Safe action → UI state | PARTIAL | 13 interaction/control passes, 7 failures across two existing defects |
| Protected UI → authenticated API/data | BLOCKED | Missing authorized isolated account/backend; no bypass |
| Billing/provider mutation → persisted result | Not initiated | Mutation guard; 156 local billing tests pass; no real generation/purchase |

| Phase 1 acceptance item | Progress |
|---|---|
| Preflight, isolated branch, integration inspection | Complete |
| All source routes + shared styles/dependencies inventoried | Complete; build manifest cross-check matches |
| Responsive architecture audited, Phases 2–6 plan ready | Complete |
| Chromium/WebKit infrastructure executable | Complete; both installed and run |
| Baseline checks + visual evidence | Complete for accessible scope; protected runtime remains BLOCKED |
| Desktop/production behavior intentionally unchanged | Confirmed by application-source diff |
| Persistent documentation and test infrastructure | Complete; versioned with this foundation |
| Full functional coverage of the system | PARTIAL; 22 protected routes and physical keyboard/assistive-tech checks remain |

Overall Phase 1 validation status: **PARTIAL**. Phase 2 is ready to begin as controlled shared-shell work using the plan, with MR-005 prioritized as a proven global-style ownership issue. Obtain a dedicated nonproduction account/backend and an authorized admin session before claiming authenticated acceptance. Physical iOS/Android keyboard testing and normal-motion performance profiling remain required later gates. Production release is not approved by this audit.

Implementation references: [Playwright projects](https://playwright.dev/docs/test-projects) and [browser installation](https://playwright.dev/docs/browsers); Next.js bundled guides for routing, CSS order and Playwright were read as required by AGENTS.md.
