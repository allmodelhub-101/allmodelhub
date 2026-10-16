# Phase 3 — responsive Chat presentation

Baseline: Phase 2 `dc7ab2025edf071af2b470586f126ff8537fb3d7`, same feature branch and [draft PR #149](https://github.com/allmodelhub-101/allmodelhub/pull/149). Main remains unchanged; no merge or production promotion. This handoff distinguishes scoped Chat presentation from blocked authenticated/device acceptance.

## Implemented boundaries

ChatClient retains transport, Supabase session refresh, pending settlement, uploads, voice recognition and conversation persistence. ChatWorkspace is the production presentation, with typed callbacks, shared ModelPicker/PremiumSelect, Markdown and actual composer controls. The local fixture mounts this same component in WorkspaceFrame with an offline topbar, under the existing development + explicit flag + loopback + no-Vercel gate. It cannot authorize or load a protected route. No production test account/backend is available; authenticated E2E stays BLOCKED.

The pure composer policy is shared by production and fixture: Enter submits, Shift+Enter/IME preserve native editing, Escape stops busy requests, >1200-character paste becomes context, and submitted context formatting is preserved. Tests pin ten Phase 2 AST function hashes for request/stream processing, pending settlement, uploads, enhancement, voice and conversation actions. No baseline was regenerated for Phase 3 behavior changes.

## Presentation and ownership

`chat-workspace.css` owns a new root class, so retired `.chat-page`/`.premium-chat-page` overrides cannot dictate its viewport. WorkspaceFrame owns header and mobile navigation clearance. Chat occupies the remaining grid cell; history is a scroll region above an in-flow auto-growing composer. VisualViewport height is used directly at scale 1, with 100dvh fallback; there is no guessed keyboard offset. Composer sizing responds to input and viewport changes.

Message Markdown has focusable local code/table scroll regions; unbroken prose wraps. Markdown rendering is memoized by content. Streaming follows only near the bottom, recognizes upward reading before delayed scroll events, and offers Latest. History updates do not force readers down. Welcome starts at the top, with an interactive model ticker that pauses for pointer/focus and stops for reduced motion, four starter actions, restrained typography and a pinned composer.

Attach, voice, model and Send/Stop remain primary. Compact screens expose enhancement in the Chat controls dialog alongside project/tier/reasoning/privacy, using the existing callbacks. The controls portal reuses shared overlay handling and avoids composer stacking contexts. The shared selector now consumes Escape only while open, so a closed selector does not swallow dialog dismissal. Body/history scroll locks restore previous styles.

## CSS migration evidence

Only eleven global selector groups requiring the retired exact `.chat-page` class were removed; source search confirms no component renders that class. Removed rules/declarations are recorded in `removed-legacy-chat-selectors.json`. The Phase 2 synthetic `premium-chat-page` compatibility test remains intact. Shared/media styles and the remainder of global CSS are preserved. No blanket document overflow clipping or new !important rule was added.

## Evidence and current checks

`before/` contains actual Chromium welcome/long Chat captures at 320, 390, 844 landscape, 768 and 1366 before styling changes, using the extracted unchanged markup with Phase 2 styles. `after/` contains the new real presentation and controls. Historical Phase 1/2 evidence is preserved.

Initial exploratory browser runs found and repaired: a new scroll-effect ReferenceError, closed-selector Escape propagation, a streaming-follow timing race, and a controls stacking-context issue visible in screenshots. These runs must not be represented as passing final runs. Exact final runs, screenshot review and acceptance status will be appended after execution.

## Remaining verification limits

Fixture send/retry/branch/edit/attachment/voice actions are local synthetic adapters; they do not prove authenticated persistence, microphone recognition, provider streaming, or billing settlement. Shared pure input policy and unchanged production-controller function hashes provide additional isolated evidence, not E2E equivalence. Physical iOS/Android keyboards, safe areas, touch selection, zoom and assistive technology remain unverified. Preview protection/team permissions remain unavailable from Phase 2.

Phase 4 should start with Image Studio, then Video and Audio, using the same safety gates, scoped owners, real presentation fixtures, before/after evidence and unchanged API/provider/billing contracts. Do not merge this six-phase PR or promote it to production without the final release decision.

## Follow-up verification infrastructure

A standalone production-React component harness compiles the real ChatFixture/ChatWorkspace and shared components with production React into an ignored local bundle, using already installed TypeScript and Next's bundled Webpack. It binds only loopback, rejects remote Host headers and mutations, requires explicit opt-in and blocks external/backend requests in the browser. Thirty scenarios passed across Chromium/WebKit × 390×844/844×390/1366×768 × welcome/long/attachments/error/loading. This is production-mode component verification, not a production Next authenticated route or a replacement for the Next build. Production Next keeps the fixture unavailable. The harness is added to Linux browser CI after browser installation.

The 320px toolbar now explicitly clears an inherited max-width so its four tools and Send fit on one row with 44px targets. Long attachment filenames use a named local scroll region and a single preview row. The ticker has accessible model names and a normal-motion focus/pause check in addition to reduced-motion coverage. Explicit new submission returns to Latest, while draft editing and incoming tokens preserve a reader's earlier position.

## Executed verification

| Check | Actual result |
|---|---|
| Local Next production build | PASS; `build.log`, 32 source-page routes retained |
| Local TypeScript | PASS after production build; `typecheck.log` |
| Security script | PASS; `security-check.log` |
| Existing billing/security/UI and new isolated checks | **199 passed, 0 failed, 0 skipped**; `functional-checks.log` (156 billing, 4 security, 39 UI including 10 contract guards and 3 input-policy tests) |
| Chat components, helper and test lint | PASS; empty `scoped-lint.log` means exit 0 with no diagnostics. New capture/production scripts also lint cleanly. |
| Full repository lint | **FAIL: 2 pre-existing LoginForm set-state-in-effect errors, 14 existing warnings**; `full-repository-lint.log`. These files/causes were not changed by Chat work. |
| Homepage protected hash | Windows raw-byte check FAIL due to checkout CRLF; index is LF and normalized SHA256 is the pinned `9b1f0c6657febef0a27e540644a8ba8977025d5b5d581896c8e68e5739c25d4d`. Source diff is empty. Linux CI check PASS. See `homepage-check.log`. |
| Local focused browser runs | **36 passed** stable Chat checks; **9 passed** final discovery/welcome checks; **6 passed** compact toolbar checks; **8 passed** expanded-draft short-height checks. These overlap and are not added to the full matrix count. `local-browser-runs.json` preserves actual stats and earlier exploratory failures. |
| Approved visual comparison | **12 generated and reviewed, then 12 comparison passes**, both engines × 390/768/1366 × light/dark. `visual-review.png` is the inspected contact sheet; references live in `tests/responsive/__screenshots__/win32/*/phase3-welcome-*.png`. |
| Production React components | **30 passed**, both engines × 390×844/844×390/1366×768 × five states; `production/results.json`, runtime log/screenshots and computed styles. Uses production React with minification disabled, not Next optimized bundle equivalence. |
| Actual Next production rendering / fixture guards | **30 passed**, both engines × phone/tablet/desktop: 18 public rendering checks plus 12 fixture-denial checks; `next-production/results.json` and screenshots. Opt-in was enabled on the production server, yet both fixture URLs returned 404. |
| Full Linux matrix | **952 passed / 0 failed / 700 skipped**, retries 0; [run 38913706025](https://github.com/allmodelhub-101/allmodelhub/actions/runs/38913706025), implementation `37a7e2a94aaadd1bc8999ae717a95c5cb7ce7b18`. All 280 Chat cases passed (10 × 28 projects). Foundation build/type/security/billing/UI/scoped-lint and 30 production React checks also passed on Linux. Artifact `responsive-foundation`, ID 12051868588, 26,049,678 bytes. |
| Authenticated E2E / physical mobile devices | **BLOCKED / UNVERIFIED**, respectively; 22 protected routes lack an authorized isolated session/backend, and no physical iOS/Android device was available. |

All 14 viewport sizes and both engines remain configured, including 900/901 breakpoint boundaries. Tests run with retries 0. Synthetic Chat diagnostics reject application API calls, resource failures, console errors and hydration/runtime errors. The full suite preserves Phase 2 checks. No generation, purchase, wallet mutation or customer upload was initiated.

## Image review and reproduced defects

Reviewed the 12 theme/engine/viewport welcome references plus the final 320px welcome/attachments, 390px controls/long Markdown, 844px landscape and 768/1366px layouts as actual images. Mobile controls remain one row; cards/messages scroll above the composer; code/table content remains locally scrollable. The modal backdrop is above mobile navigation (pointer hit-test returns its scrim). Short landscape prioritizes ticker and composer while welcome cards remain reachable by history scrolling. At 320px welcome copy/cards require scrolling; the composer remains in view.

Widths in evidence filenames map to 320×568, 390×844, 844×390, 768×1024 and 1366×768. `before/` has 10 captures; `after/` has 16 main captures plus eight explicitly named expanded-draft captures at 320×390 / 844×390. `production/` includes six component screenshots and `next-production/` two public screenshots. The production screenshot named welcome is taken after a local synthetic send, deliberately covering populated rendering. Before/after fixture model names and balances are synthetic, not production account data.

The incomplete first smoke run is not a pass. The subsequent exploratory recheck had **15 passed / 3 failed** (the streaming reading-position race and a locator matching Next's route announcer); they were repaired and superseded by the stable/final runs. The first discovery run used an over-specific model accessible name before the label correction. No failing comparison was approved by overwriting an existing baseline. Final screenshot refreshes replace implementation-stage `after/` evidence while preserving `before/` and approved comparison references.

The initial full green matrix did not combine expanded drafts with secondary composer content at very short heights. A subsequent geometry probe exposed P3-C07: history collapsed to zero, with error content below navigation. `short-height-edge-before.log` and `short-height-edge-after.log` preserve measured geometry; their generic eight-scenario completion lines are not layout acceptance assertions. The focused browser regression adds actual assertions for at least 24px of history, composer/navigation separation and reachable input/Send, plus keyboard focus on the locally scrollable error. It passed eight cases, with screenshots. The production component harness also asserts this combination in its 844×390 attachment/error cases. Follow-up Linux runs on the final implementation are available in PR #149 Checks.

## Continuation and acceptance boundary

Source owners: `chat-client.tsx` (controller callbacks retained), `chat-workspace.tsx` + `chat-workspace.css` (production presentation), `chat-composer-events.ts` (pure event policy), `chat-fixture.tsx` + existing guarded fixture route (local adapters), `premium-select.tsx` (nested Escape), `use-workspace-overlay.ts` (history scroll lock), and eleven retired selector groups in `globals.css`. ModelPicker's Phase 2 search/focus/availability/pricing logic and shared shell styling are reused.

Reproduce screenshots with an opted-in local dev server and `LOCAL_RESPONSIVE_FIXTURES=1 node scripts/mobile-capture-chat.mjs`; inspect the PNGs before accepting updates. Production component checks use `mobile-chat-production-check.mjs`; actual Next production public/guard checks use `mobile-chat-next-production-check.mjs` after build/start at loopback port 3101. CI retains compact results, HTML attachments and production component evidence for seven days; committed screenshots/logs survive artifact expiration. Raw traces are not committed.

With the full Linux run green, Phase 4 is ready for safe Image → Video → Audio presentation work. Preserve these Chat boundaries and all Phase 2 regressions. Protected conversation switching/persistence, real microphone/IME behavior, actual provider/SSE errors and billing settlement are not certified by fixtures. Physical keyboard, zoom/safe-area and assistive-technology verification remain release gates. The responsive plan contains the ordered studio acceptance criteria. No production release is authorized.

## Phase 3 acceptance

**PASS for scoped Chat presentation.** The complete Linux matrix is green, the 12 approved visual comparisons pass, actual before/after images were reviewed, and available production/functional checks pass with the disclosed pre-existing lint and Windows line-ending exceptions. The 700 skips comprise 616 protected instances (22 × 28) and 84 opt-in visual cases; none is counted as a functional pass. No observed unresolved defect remains in the covered synthetic Chat/shared/public scope.

All ten scoped acceptance items have evidence above: responsive welcome/conversations; compact accessible composer/model controls; shell-integrated height/scroll ownership; long-content/files/state coverage; emulated keyboard/focus/Escape checks; retained desktop/shared regression coverage; unchanged controller contracts; Linux checks with unrelated lint debt disclosed; reviewed before/after images; and explicit protected/physical-device limits. Real authenticated system acceptance remains BLOCKED, and hardware acceptance remains UNVERIFIED.

Phase 4 is **ready for isolated studio presentation implementation** using the ordered plan. It is not ready for authenticated workflow certification or a production release. Latest subsequent CI runs are linked from PR #149's Checks tab; this document pins the completed implementation run rather than attempting to embed its own future commit SHA.
