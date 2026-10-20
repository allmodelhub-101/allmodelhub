# Android delivery — 2026-10-20

**Implementation and signed build: complete. Public release / Play publication: not approved or performed.**

Branch: `feat/android-twa-app`, based on main `48a9aea996c174bcbbf32c1895b2157e888ead95` (merged premium navigation PR #150). Open work #121/#117/#106 was observed and not incorporated or changed. No existing Chat, shell/navigation, AI, wallet, billing, auth, upload or database implementation was edited. Source preservation was checked against that main commit.

## Delivered

- PWA manifest: stable `/` ID, canonical scope, `/chat` launch, standalone display, official opaque 192/512 icons, safe-zone maskable 512 icon, Apple icon, dark brand splash/theme.
- Service worker caches **only** self-contained public `/offline.html`; no private pages, API/auth/payment responses, RSC payloads, uploads or cross-origin requests. Online errors are returned unchanged. API/auth/download requests never get HTML fallback. Worker updates avoid stale HTTP caching.
- Browser install event capture and one-shot prompt handling; no app-wide installation banners or other page redesigns.
- Public `/android` page, scoped CSS, existing Brand/ThemeToggle, Chrome installation guide, version and APK guidance. APK CTA is intentionally absent until approved public hosting + exact checksum validation.
- Google Bubblewrap 1.27.0 generated Android project in `android/`: TWA, Custom Tabs fallback, official launcher/splash assets, browser-owned back/auth/external-link/file/keyboard handling, HTTPS-only canonical trust. Minimum API 24 / Android 7.0, target/compile API 36, version 1.0.0 / code 1, stable ID **com.modelssuite.app**.
- Signing/build/bootstrap/portable-backup/restore scripts and versioned download-recording script. Keys/passwords/binaries are excluded from Git. Toolchain is isolated outside repository and machine-wide settings are unchanged.
- Actual release certificate in `release-certificate.pem` (public, not a private key) and its SHA-256 fingerprint in `public/.well-known/assetlinks.json`.
- Play listing, privacy/data safety worksheet, billing policy findings, release notes and official-brand store assets under `store/`.

## Actual release files

Local directory: `android/artifacts/1.0.0/` (ignored by Git). Draft GitHub release assets are intended for durable owner-only review; see the PR/repository Releases for the actual uploaded draft. Do not publish that draft without approval.

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| models-suite-1.0.0.apk | 1,606,234 | `5dc67fe37c8958daeaf9647acb9b804ae44b91409ee260706c689c202c46c6bc` |
| models-suite-1.0.0.aab | 1,711,127 | `ae9e28130ef95e11e733936f462e5906b7f8cb7702022f7ff2d805f06cd3e730` |

APK signing scheme v2 verifies; minimum API 24 supports it. AAB JAR signature verifies and Bundletool 1.18.3 validates its structure. AAB ZIP entry order is normalized without changing signed entry contents so JAR stream readers see signing metadata first. The APK is never repacked. Rebuilding can change ZIP bytes; always regenerate checksums and never replace an already published version silently.

Release certificate SHA-256:
`84:82:92:09:A6:45:9A:F6:E3:C0:90:C8:21:FF:A3:00:B3:7A:35:E7:48:B3:4E:E2:55:8A:37:8B:E7:A8:9E:5D`

## Essential verification actually performed

| Check | Result / evidence |
|---|---|
| Next production build, final source | PASS — `verification/web-build.log` |
| TypeScript and relevant ESLint | PASS — command output; build also runs TypeScript |
| Android assembleRelease + bundleRelease | PASS — `verification/android-build.log` |
| APK signature, ID/version/SDK/permissions | PASS — signing output and `verification/apk-badging.txt` |
| AAB signature after normalization | PASS — `verification/aab-signature.log`; expected self-signed Android certificate/no timestamp warnings retained |
| Bundletool structure validation | PASS — compact first lines in `verification/bundle-validation.txt` |
| PWA browser checks | 5 PASS groups — `verification/web-results.json`: manifest/assets, worker/cache isolation, one-shot prompt event, offline behavior, public page captures/overflow/page errors |
| Chromium installability diagnostics | PASS — `verification/chromium-installability.json`, empty installabilityErrors; this is not an OS installation |
| Appearance | Actual light/dark phone, dark desktop, offline screenshots viewed; official feature graphic reviewed. No existing-page baselines overwritten |
| Script syntax | PowerShell parser and Node syntax checks PASS |
| Android device install/launch | UNAVAILABLE — no device/emulator connected (`verification/adb-devices.txt`) |
| Canonical-domain verified TWA | BLOCKED — production DAL file not deployed; Preview cannot prove canonical-host ownership |
| Auth/file/voice/download/IME/back/device flows | UNVERIFIED on Android; browser-owned behavior configured, not claimed as tested |
| Google Play publication | BLOCKED — no Console submission; unresolved digital-credit policy + owner account/declarations/signing decisions |

The first Android build correctly failed on minSdk 23 because current Browser Helper requires 24; configuration and public requirements were corrected rather than overriding library safety. A current SDK-tools XML compatibility warning remains in the successful Gradle log. The final AAB signature log supersedes the raw pre-normalization JarInputStream ordering warning in the Gradle wrapper log. Standard self-signed certificate trust/timestamp warnings do not mean the Android artifact is unsigned. No physical-device verification was invented.

No billing/API generation, purchases, customer uploads or authenticated production mutations were performed. The 14-viewport responsive matrix and unrelated audits/tests were not rerun; only required inventory refresh and essential build/PWA checks were performed.

## Evidence and store candidates

- `verification/android-360-light.png`, `android-360-dark.png`, `android-desktop.png`, `offline-360.png`.
- `store/assets/screenshots/`: real public homepage, sign-in and Android-page web renders, 1080×1920. These are candidates, **not installed TWA screenshots**. No private fixture is presented as an authenticated account.
- `store/assets/app-icon-512.png`, `feature-graphic-1024x500.png` (opaque PNG).
- `verification/release-artifacts.json`: downloadable artifact integrity metadata, no private material.
- Raw Bundletool file enumeration and transient tooling logs stay outside Git; compact evidence is committed.

## Remaining owner actions / release gates

1. Choose a backup passphrase and run `Export-SigningBackup.ps1` to a secure external location; separately retain that passphrase. Private identity currently lives at `C:/Users/The Perfect Point/.codex/android-signing/models-suite/`. Windows DPAPI is not portable by itself.
2. Approve the website merge/deployment to publish the manifest/worker/Digital Asset Links/download page. Then verify canonical DAL and native launch on an Android device; unverified launches may show a browser toolbar until association is live.
3. Approve public APK release publication if direct distribution is desired. Then run `record-download.mjs` against the immutable version URL and approve its website metadata deployment. Until then there is no live APK button.
4. For Google Play: owner’s Console access/developer verification, billing strategy authorization, data-safety/deletion/support-email/content-rating/country declarations, signing-key enrollment/continuity decision and any account-specific testing requirements. See `store/`; no policy compliance is asserted.

No owner software installation or routine configuration is requested. No production deployment or Play submission was performed. Continue with `android/README.md` for exact commands and guarded distribution procedure.
