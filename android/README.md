# Models Suite Android

Stable application ID: **`com.modelssuite.app`**. First version: **1.0.0 / code 1**. Do not change the ID or signing identity after distribution. `release.json` is the version/SDK/download metadata source; increment versionCode for each Play upload and versionName for visible releases.

This is a Google Bubblewrap-generated Trusted Web Activity, not a separate native website implementation. Canonical origin: `https://www.modelssuite.com`, launch: `/chat`, scope `/`. It preserves the current website’s Chat, navigation, auth, wallet, uploads and AI contracts. No native backend, web bridge, credentials or customer sessions are embedded.

## Build

PowerShell 7.4+, Node 22+, pnpm 10.34.3 and JDK 17. The checked-in Gradle wrapper verifies the distribution checksum. Android Gradle Plugin 8.10.1, Gradle 8.11.1, Android Browser Helper 2.7.4, compile/target API 36, minimum API 24. Supported, up-to-date Android Chrome is recommended; old devices/browser versions are not certified by the manifest minimum.

```powershell
# Optional on a clean Windows machine; prompts for SDK licenses. Environment
# changes apply only to this PowerShell process, not global machine settings.
./android/Setup-Toolchain.ps1

# Exactly once per signing identity; never replace an existing release key.
./android/Initialize-Signing.ps1
./android/Build-Release.ps1
```

The initializer creates `~/.codex/android-signing/models-suite/models-suite-release.p12`, `password.dpapi` and a public certificate. ACLs limit access to the Windows owner and SYSTEM. Passwords are generated randomly, passed through environment variables, never printed and never written into Gradle/source files. DPAPI is machine/user bound: **back up both the keystore and password in portable encrypted form before release**:

```powershell
./android/Export-SigningBackup.ps1 -Destination 'D:/SecureBackup/models-suite-signing.msbackup'
# Choose your own strong passphrase; store it separately.
# On recovery: ./android/Restore-SigningBackup.ps1 -Backup 'D:/SecureBackup/models-suite-signing.msbackup'
```

The destination must be outside Git. Keep encrypted backups in more than one secure place. Losing the signing key can prevent direct-install users from updating. An encrypted key alone is insufficient without the password. Codex cannot choose an owner-known backup passphrase on the owner’s behalf.

On Linux/macOS or CI, supply `JAVA_HOME`, `ANDROID_HOME`, `MODELS_ANDROID_KEYSTORE` (outside checkout), `MODELS_ANDROID_STORE_PASSWORD`, `MODELS_ANDROID_KEY_PASSWORD`, optional `MODELS_ANDROID_KEY_ALIAS=models-suite-release`, then run `cd android && ./gradlew --no-daemon assembleRelease bundleRelease`. Missing signing inputs fail release tasks, never silently create debug/unsigned releases. Do not pass passwords on the command line or echo them.

Outputs: `android/artifacts/<version>/models-suite-<version>.apk`, `.aab`, `release-artifacts.json` with SHA-256/bytes. Build-Release verifies APK and AAB signatures. Raw Gradle outputs stay under ignored `app/build/`. Reproducibility means pinned source/tool versions and repeatable signed builds, not a guarantee of byte-identical ZIP timestamps.

## Regenerate assets/project intentionally

```powershell
cd android/tools
pnpm --ignore-workspace install --frozen-lockfile
cd ../..
node android/tools/assets.mjs
node android/tools/generate.mjs
```

The official mark remains the source. Maskable artwork fits within the safe zone, with an opaque dark background. Regeneration uses loopback assets, no live site or session. `generate.mjs` applies the API/signing/security changes after Bubblewrap generation; review before overwriting future native modifications.

## Browser-owned behavior

- Native browser history owns Android Back and gesture navigation. No custom interception or duplicate history stack.
- Only canonical HTTPS origin is trusted. Unverified/external origins show browser security UI; OAuth/payment origins are not added as trusted. Existing browser cookies/auth flows are preserved. No tokens are extracted or embedded.
- Existing HTML file inputs, browser downloads and microphone prompts remain browser managed. No broad storage, camera, SMS, contacts or location permission is requested by the shell. Push delegation is disabled; website notification UI is unchanged.
- The launcher uses adjustResize; the TWA browser owns keyboard/insets/safe-area handling. No artificial keyboard offset or injected page CSS.
- Custom Tabs fallback is used if TWA verification/browser support is unavailable; no embedded WebView fallback.

## Digital Asset Links

`public/.well-known/assetlinks.json` contains the actual release certificate fingerprint and stable package ID. Public fingerprints are not secrets. Run `node android/tools/assetlinks.mjs FINGERPRINT [PLAY_FINGERPRINT ...]` to add authorized identities; retain the direct APK fingerprint. The Android reciprocal statement names only `https://www.modelssuite.com`.

Preview hosting does **not** verify the production origin. Until the owner approves deploying the website file to `https://www.modelssuite.com/.well-known/assetlinks.json` as a 200 JSON response without login/redirect, verified full-screen launch is BLOCKED and a toolbar may appear. Never disable Chrome’s verification as a release workaround.

Google Play App Signing may use another certificate; add its app-signing fingerprint (not just upload-key fingerprint) before testing Play builds. Plan key continuity before first Play enrollment if direct APK and Play updates should interoperate.

## Distribution

Do not commit APK/AAB/key material. Use the repository’s **draft GitHub release** `android-v<version>` for owner review. After separate owner publication approval, publish the signed APK with immutable versioned filename plus checksum JSON; keep AAB for Play Console. This repository is public, so publishing a release makes attached assets public.

The website button stays hidden while `distribution.published=false`. After public hosting is approved and available:

```powershell
node android/tools/record-download.mjs https://github.com/allmodelhub-101/allmodelhub/releases/download/android-v1.0.0/models-suite-1.0.0.apk
```

The script compares the hosted APK bytes/hash with verified local build metadata before recording a link. Commit/review/deploy that metadata change separately. Never point to a mutable `latest` URL or Vercel’s source/public folder. GitHub handles HTTPS and attachments; also retain the SHA-256 independently. `/android` provides browser installation and per-version APK guidance. No banner or redesign is added elsewhere.

See `docs/android/README.md` for delivery status and `docs/android/store/` for publication materials and policy blockers. No production merge/deployment or Google Play upload is authorized in this task.
