# Phase 4 — Image, Video and Audio Studio presentation

Continues verified Phase 3 `d73c99e5803845633ca982122dbcf274c115756e` on `feat/mobile-first-responsive-overhaul`, draft PR #149. Main remains `314c764`; open PRs #117 and #106 were inspected and no execution/financial changes imported. No production promotion or merge.

## Batch A — Image Studio

ImageStudioView is the actual production presentation; useImageStudio retains controller state, model metadata, requests, uploads, polling and result actions. The local fixture renders that view with synthetic state/callbacks under the existing development + explicit opt-in + loopback + no-Vercel gate. No session or API request is created by the fixture.

Scoped layout replaces duplicate navigation padding with the shell's clearance, contains long reference names locally, preserves result image content with object-fit containment and adds a focus-trapped full-image viewer. Settings remain an inline disclosure with Escape/focus restoration; all existing model-derived options remain. A 320px visual inspection revealed an intrinsic-width welcome layout concealed by global overflow clipping. Two Image-specific clipping declarations were removed and archived; actual content sizing now resolves the overflow.

Before/after actual screenshots: `image/before/` and `image/after/`, idle/results at 320×568, 390×844, 768×1024, 844×390 and 1366×768. Inspected small-phone, phone result and desktop captures; reduced mobile decoration after review to bring the prompt closer. Initial test failures were an incorrect model-picker dialog name, fixed to its image-specific accessible name. Targeted Image run: 12 passed, 0 failed in four representative projects, both themes. Further final regression/CI is pending.

Twenty Phase 3 function-body hashes guard Image, Video, music/SFX and speech execution handlers in `tests/ui/studio-contracts.test.mjs`; all pass after Image extraction. These guards supplement billing/security tests, not authenticated E2E. Never regenerate hashes merely to hide a presentation change.

## Pending batches and acceptance

## Batch B — Video Studio

Creation controls precede preview on compact/tablet layouts; desktop retains two columns. The model rail, actual model picker and metadata-derived duration/resolution/aspects remain. A 9:16 selection has a correctly proportioned contained preview, native result playback stays contained, and primary/player controls have 44px targets. The viewer portals above mobile navigation and shares overlay focus, Escape and scroll restoration. Gallery/offscreen and reduced-motion media policies already existed and are preserved.

The existing Video fixture is mounted inside the real shared shell. Local reference selection now uses a presentation adapter rather than the real upload function; normal production reference selection still delegates to that unchanged function. Upload/poll/submit hashes pass. Actual before/after captures exist at five representative sizes, including completed native-player output; phone and desktop images were reviewed. Early validation repaired an extraction mistake and incorrect test roles/mode order; these interrupted runs are not passes.

Targeted tests exercise both themes, model Escape/focus, long prompt/file names, actual aspect ratio, viewer controls/focus return and queued/completed/failure states. Exact batch stats are in `video/browser-summary.json`. Existing Phase 2 dropdown behavior is retained for final full regression.

Video and Audio implementation and final full-matrix validation are in progress. Phase 4 is not yet declared PASS. Protected workflows still require an authorized isolated account/backend. Physical iOS/Android keyboards, safe areas, zoom, assistive technology and low-end hardware performance remain UNVERIFIED. Fixtures do not prove real generation, upload, persistence, download security or settlement behavior.
