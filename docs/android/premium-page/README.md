# Premium Android download page

Scope: `/android` presentation, browser-aware install controls and one small public homepage entry. Continue on `feat/android-twa-app`, draft PR #151. Baseline for this follow-up: `b23650653a3c0cdaa018f7d301d9873c356e1ea9`.

## Delivered presentation

- Existing brand tokens drive cinematic light/dark backgrounds, blue gradient headings, layered lighting and restrained glass surfaces.
- Compact mobile hero includes the official app icon, headline, install action, app version and Android requirements. At 320×568 the primary Chrome action ends at approximately 389px, above the fold. Decorative rings fit the component; document overflow is checked against actual client width to catch mobile auto-zoom.
- CSS phone frame with camera, side buttons, perspective, glow and floating panels. Real existing interface previews switch among Chat, Image, Video and Audio with accessible tab buttons, arrow/Home/End keyboard support and a labeled tab panel.
- Four feature cards, separate Chrome/APK instructions and privacy/support/version footer. No ratings, testimonials or new app capabilities are invented.
- Mobile text, focus rings, touch targets, entrance staggering, hover/press feedback and button sheen. Motion animates transforms/opacity; the showcase pauses offscreen/when hidden and respects reduced motion. No animation dependency was added.

## Install behavior and discoverability

- Android Chrome with the existing browser event: invokes the original one-shot PWA prompt.
- Android Chrome without an event: immediately accessible Chrome installation guide; never claims an OS install occurred.
- Other Android browsers: explicit instruction to open in Chrome. Other devices: Android-device guidance.
- Running standalone or with a TWA referrer: open-workspace action; public Android promotion is suppressed. Browser detection is local UI logic, not tracking or an authorization decision.
- Signed APK links are still exclusively gated by the existing approved/published HTTPS URL + SHA-256 + byte-count checks. Current release metadata is unchanged and unpublished, so no download link appears.
- The homepage adds only an import and `<AndroidAppLink />` after its existing hero proof row. The link sits in normal document flow; existing navigation, hero content, premium animation controller and global styling are unchanged. A reusable notice surface/dismiss-button CSS is prepared but never mounted. There is no automatic banner/popup, persisted dismissal or overlay.

## Preview provenance and cost

`preview-sources.json` maps eight WebP assets directly to existing approved WebKit screenshots in `docs/mobile-navigation/after/`. They show the shipped presentation with clearly identified example content, not customer sessions or a claim of completed paid generations. Source captures are untouched; only WebP encoding was applied. All eight assets total 202,998 bytes, served directly without per-tab image optimization requests. Both themes match the current page theme.

## Essential verification

- Web production build and TypeScript: PASS (`web-build.log`). Relevant ESLint: PASS.
- Chromium page checks at 320×568, 390×844, 430×844, 768×900, 1366×900, light/dark. WebKit at 390×844, light/dark. These are 12 viewport/theme cases, not the full responsive matrix.
- Six additional scoped checks: one-shot install event, normal/offscreen motion, unsupported-device/homepage entry, standalone suppression, alternate Android browser guidance, reduced motion. Browser installation is simulated only at the event boundary; no physical-device install is claimed.
- Two Chrome 390px WCAG-subset axe scans, focus/keyboard tabs, missing APK links, image readiness, overflow and page errors are checked. Exact completed-run results are in `page-results.json` and `page-checks.log`.
- Production screenshots under `screenshots/` were image-reviewed at 320/390px in both themes, including WebKit, plus desktop and the homepage entry. Full-page and first-screen captures are separate. Historical Android foundation evidence remains unchanged.

Development diagnostics found decorative overflow, lazy optimized-preview loading and synthetic install-event readiness problems. The rings were bounded, the already optimized images use direct eager delivery in the phone, and the test waits for hydration before dispatching its synthetic event. Preliminary local diagnostics remain in the task's `work/android-premium-*.log`; final evidence uses the production server, has no development badge and is not a silently regenerated historical baseline. Targeted remaining-check mode is available to avoid repeating successful layout cases during investigation.

Reproduce the page checks against a local production server:

```powershell
pnpm build
pnpm start --port 3107
# In another shell:
node scripts/android-download-page-check.mjs
```

The original PWA check script only receives the new heading/Android UA readiness expectation; it was not rerun to overwrite foundation screenshots. The generated route/style inventory is refreshed per repository guidance. No broad responsive suite, billing/security audit, paid generation, wallet operation or Android rebuild was performed for this page task.

## Protected scope and delivery

Android project, package ID, signing identity, version, APK/AAB hashes, service worker, manifest, PWA registration/store and Digital Asset Links are unchanged. Chat, workspace navigation, generation, authentication, wallet/payment logic, homepage animation controller and global CSS remain unchanged. Existing release/policy/device gates still apply; no new claim of Android hardware or Play acceptance is made.

Keep PR #151 draft and the APK release unpublished. Vercel delivery is Preview only; merge/production publication requires final owner approval. See `changed-files.md` for the exact files in this follow-up.
