# Phase 4 — Image, Video and Audio Studio presentation

Continues verified Phase 3 `d73c99e5803845633ca982122dbcf274c115756e` on `feat/mobile-first-responsive-overhaul`, draft PR #149. Main remains `314c764`; open PRs #117 and #106 were inspected and no execution/financial changes imported. No production promotion or merge.

## Batch A — Image Studio

ImageStudioView is the actual production presentation; useImageStudio retains controller state, model metadata, requests, uploads, polling and result actions. The local fixture renders that view with synthetic state/callbacks under the existing development + explicit opt-in + loopback + no-Vercel gate. No session or API request is created by the fixture.

Scoped layout replaces duplicate navigation padding with the shell's clearance, contains long reference names locally, preserves result image content with object-fit containment and adds a focus-trapped full-image viewer. Settings remain an inline disclosure with Escape/focus restoration; all existing model-derived options remain. A 320px visual inspection revealed an intrinsic-width welcome layout concealed by global overflow clipping. Two Image-specific clipping declarations were removed and archived; actual content sizing now resolves the overflow.

Before/after actual screenshots: `image/before/` and `image/after/`, idle/results at 320×568, 390×844, 768×1024, 844×390 and 1366×768. Inspected small-phone, phone result and desktop captures; reduced mobile decoration after review to bring the prompt closer. Initial test failures were an incorrect model-picker dialog name, fixed to its image-specific accessible name. Targeted Image run: 12 passed, 0 failed in four representative projects, both themes. See the combined verification below.

Twenty Phase 3 function-body hashes guard Image, Video, music/SFX and speech execution handlers in `tests/ui/studio-contracts.test.mjs`; all pass after Image extraction. These guards supplement billing/security tests, not authenticated E2E. Never regenerate hashes merely to hide a presentation change.

## Batch B — Video Studio

Creation controls precede preview on compact/tablet layouts; desktop retains two columns. The model rail, actual model picker and metadata-derived duration/resolution/aspects remain. A 9:16 selection has a correctly proportioned contained preview, native result playback stays contained, and primary/player controls have 44px targets. The viewer portals above mobile navigation and shares overlay focus, Escape and scroll restoration. Gallery/offscreen and reduced-motion media policies already existed and are preserved.

The existing Video fixture is mounted inside the real shared shell. Local reference selection now uses a presentation adapter rather than the real upload function; normal production reference selection still delegates to that unchanged function. Upload/poll/submit hashes pass. Actual before/after captures exist at five representative sizes, including completed native-player output; phone and desktop images were reviewed. Early validation repaired an extraction mistake and incorrect test roles/mode order; these interrupted runs are not passes.

Targeted tests exercise both themes, model Escape/focus, long prompt/file names, actual aspect ratio, viewer controls/focus return and queued/completed/failure states. Exact batch stats are in `video/browser-summary.json`. Existing Phase 2 dropdown behavior is retained for final full regression.

Image, Video and Audio implementation is complete; combined verification is recorded below. Protected workflows still require an authorized isolated account/backend. Physical iOS/Android keyboards, safe areas, zoom, assistive technology and low-end hardware performance remain UNVERIFIED. Fixtures do not prove real generation, upload, persistence, download security or settlement behavior.

## Batch C — Audio Studio

Speech and music/SFX controllers now return typed presentation props to TtsView and AudioGenerationView. Their real requests, polling, estimates and settlement code are retained. AudioStudio accepts optional presentation panels for the guarded local fixture; production uses the original clients. Model/voice metadata remains dynamic in production, and all three modes remain available.

Audio-owned styles improve mode-tab layout, tablet columns, readable 16px inputs, 44px primary actions, player containment and navigation clearance. Native audio controls expose real playback progress/duration from the media; no synthetic waveform is presented as output data. Existing decorative AudioStage artwork is explicitly labeled as decoration and now pauses when idle. A two-second synthetic PCM WAV lives in tests/fixtures and is served only by a media handler with the same explicit development/loopback/no-Vercel gates as the fixture page. No public test-media asset is shipped. Data URLs were rejected by the unchanged CSP and Windows WebKit could not play Blob WAVs; the guarded local handler preserves the real native-player checks without relaxing security.

Targeted Audio checks: 12 passed in four representative projects, both themes, all three modes, long script, model/voice selection, native playback, starters, unavailable model and queued/error states. They found and repaired keyboard tab navigation from a focused inactive tab and WebKit select focus restoration. Phone, native-player and desktop screenshots were inspected. See combined verification below for the final validation gates.

## Boundaries, evidence and independent acceptance

| Studio | Scoped implementation acceptance | Evidence |
|---|---|---|
| Image | Implemented and visually reviewed; initial 12/12 targeted cases pass | image/before, image/after, image/browser-summary.json |
| Video | Implemented and visually reviewed; initial 12/12 targeted cases pass | video/before, video/after, video/browser-summary.json |
| Audio speech/music/SFX | Implemented and visually reviewed; initial 12/12 targeted cases pass | audio/before, audio/after, audio/browser-summary.json |

Batch commits: Image `86c5eed`, Video `7fe4e8e`, Audio `ca7c12d`. Follow-up verification commits retain the same branch/draft PR. Before captures use the real original presentation after fixture/controller separation and before the studio layout changes. They are synthetic states, not customer pages. App content scrolls within the shell, so fullPage captures still show the current app viewport; completed Video baseline captures do not claim playback verification. After result captures scroll to the output. `controls/` adds expanded Image settings, both viewers, Music and SFX at phone/landscape/desktop sizes. Source PNGs and Windows reference snapshots are retained; no raw trace trees are committed.

Combined validation includes 36/36 targeted cases (both engines, small phone, phone, short landscape and desktop), actual native Video result/viewer play-pause, native speech/music/SFX WAV playback, primary action height/navigation clearance and local fixture state interactions. Approved Windows references cover 36 light/dark snapshots; all 36 approved visual comparisons passed and are saved separately. Twenty unchanged Phase 3 studio execution-body hashes join existing Chat/billing/security guards. All 219 billing/security/UI tests pass. Scoped lint has zero errors and six existing Video img warnings; full lint retains two pre-existing LoginForm errors and 14 warnings. The Windows raw-byte homepage guard remains CRLF-sensitive; LF-normalized unchanged bytes match the protected hash and Linux exact-byte CI must pass.

Production React verification covers 72 studio scenarios with Next's bundled CSS Modules plugins. The bundle uses production React without minification; it is not an optimized Next chunk or authenticated SSR equivalence claim. Actual Next production rendering/fixture denial passed 54 checks, including the local media route returning 404 with opt-in set. Next production build and explicit TypeScript validation passed. Build, type checks, production evidence and visual-comparison summaries are saved in verification/, production/ and next-production/ as available. The final exact-head Linux workflow and outcome are linked in PR #149's description/checks; require that head's success before Phase 5. This document never substitutes an earlier successful commit for the current head.

## Final gates and Phase 5 handoff

- Keep all 28 viewport projects, nine studio cases per project, and prior shell/Chat/public/fixture-gate coverage. No retries or coverage reduction to obtain green results.
- Preserve all 20 studio contract hashes, existing Chat hashes, billing/security suites and original execution callbacks. No API/lib/schema/provider/wallet/auth/pricing code was changed during Phase 4.
- Shared components: PremiumSelect's explicit pointer focus is tested with Audio and the preserved shell/Chat matrix. Both viewers use the shared overlay lifecycle; settings and wide references use in-flow/local scrolling, not root clipping.
- Fixtures and actual generation are separate acceptance layers. All 22 authenticated workflows remain BLOCKED without an authorized isolated session/backend. Real uploads, generation, persisted history, settlement and protected downloads have not been executed.
- Physical iOS/Android software keyboards, IME, safe areas, pinch/text zoom, screen readers and native device fullscreen remain UNVERIFIED. Mid-range/low-end media profiling remains necessary; no device performance certification is claimed.
- Phase 5 may start after the current PR head's full Linux checks pass: remaining workspace/data surfaces, account/settings/support, then wallet/admin/public presentation under the same safety boundaries. Phase 6 retains hardware/accessibility/performance hardening and a separate release decision. Do not merge or promote production.

Exploratory runs found and repaired incorrect test dialog/action names, an extraction placement mistake, Audio inactive-tab arrow handling and WebKit select focus. An interrupted comparison run was invalidated while its test source changed; approved reference images were preserved and a clean comparison rerun is authoritative. Existing full-repository lint debt and Windows line-ending guard behavior are documented rather than hidden.

A final repeat identified a WebKit test scheduling race after viewport rotation: programmatic scrolling happened before resized layout settled. The reachability helper now waits for Playwright element stability and two animation frames after resizing, preserving all visibility, 44px height, navigation-clearance and rotation assertions. Ten repeated WebKit light/dark Audio probes passed without changing production UI or enabling retries. The earlier CI run was cancelled to validate the corrected test on the final head.

## Full-matrix non-regression repair

Exact-head run 38937713386 recorded 1,203 passes, one failure and 700 skips: all 252 studio cases passed, but Linux WebKit at 768x1024 reduced to 768x390 measured 23px of history beside an expanded draft/error, below the preserved 24px minimum. No threshold or existing test was removed. The Chat-owned short-height composer now uses 5px vertical padding instead of 6px, returning 2px to history without changing 44px controls, callbacks or desktop styling. Eighteen repetitions of the existing regression case across six representative browser/viewport projects pass locally. regression/ preserves the actual failing Linux capture, a Windows WebKit after capture (different OS, not a pixel comparison) and computed geometry. New compact geometry attachments and 768px reduced-height captures provide final Linux evidence.

CI now partitions the exact same full matrix into two concurrent shards with fail-fast disabled and separate responsive-foundation-1 / responsive-foundation-2 artifacts. Joint coverage and aggregate counts are required for sign-off; no retries, assertions, viewport projects or tests were removed. Local `pnpm test:responsive` remains the complete unsharded command. The final head's run is linked in PR #149.

The next full run 38943471097 again recorded 1,203 passes/one failure/700 skips; all studio cases passed. Linux WebKit at 360x800 reduced to 360x390 measured only 11px history, demonstrating that the initial 2px-only adjustment was insufficient for all compact font metrics. The short-height error region is now capped at 32px with 6px vertical padding and 4px top margin (previously 48px/10px/8px). Full error text remains in its keyboard-focusable local scroll region, while the primary controls retain 44px targets. Compact geometry measurement waits two animation frames after filling/resizing so pending input layout is settled. Neither the 24px history requirement nor navigation/visibility assertions changed. Final phone/tablet captures are in regression/final-chat-webkit-*.png. Exact final CI outcome is maintained on PR #149 and in the exported handoff.
