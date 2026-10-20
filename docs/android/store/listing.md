# Models Suite Android — draft Play listing

Prepared 2026-10-20. These are publication materials, not a claim of Play approval. No submission has been made.

**App title (30-character limit):** Models Suite

**Short description (80-character limit):** Chat, images, video and audio in one Models Suite AI workspace.

**Full description:**

Bring your Models Suite workspace to Android.

Explore AI chat, image creation, video tools and audio workflows from one familiar account. Choose from the models available in your workspace and keep your projects and conversations connected across your phone and computer.

• Chat with available AI models and organize your conversations.
• Work with image, video and audio tools in a responsive workspace.
• Use your existing Models Suite account and project features.
• Return to your workspace directly from your home screen.
• Choose light or dark appearance using the website’s existing settings.

Models Suite for Android securely opens the Models Suite website using your supported Android browser. An internet connection and a compatible browser are required. AI features, model availability and access depend on your account and the platform’s current offering. Some features require Credits. AI output can contain mistakes; review results before relying on them.

Privacy policy: https://www.modelssuite.com/privacy
Terms: https://www.modelssuite.com/terms
Support: https://www.modelssuite.com/support (requires sign-in; owner must supply a public support email for Play).

**Suggested category:** Productivity. **Language:** English. **Ads:** Owner must confirm; no advertising SDK is added by this Android package. **Content rating:** Complete IARC questionnaire based on generative AI and user content; do not infer an age rating from the shell.

## Assets

- `assets/app-icon-512.png`: actual official mark, 512×512, opaque PNG.
- `assets/feature-graphic-1024x500.png`: 1024×500, opaque PNG, brand-only promotional graphic.
- `assets/screenshots/`: real public web-render candidates with capture metadata. They are not emulator/device proof and do not show protected authenticated workflows. Review on the installed app before final Play upload; capture signed-in Chat/studios only using an authorized account without exposing private information.

## Release notes — 1.0.0 (code 1)

Initial Models Suite Android package. Launch your existing AI workspace from your home screen, with official branding, a matching splash screen, browser-managed navigation and a clear offline reconnect screen. AI features require an internet connection.

## Publication gates

1. Owner confirms developer identity, stable application ID `com.modelssuite.app`, support email, territories, content rating and account ownership. The ID is reserved by this code, not registered in Play.
2. Complete the billing decision in `billing-and-policy.md` before any Play submission. This AAB is technically built, not certified policy compliant.
3. Complete and validate data safety and deletion answers in `data-safety-worksheet.md`.
4. Back up the signing key and password in portable encrypted form. Decide whether to enroll the existing release key in Play App Signing so website and Play builds can update one another. A different Play key requires its SHA-256 fingerprint in Digital Asset Links and can split update compatibility.
5. After website merge/deploy approval, publish `/.well-known/assetlinks.json` on the exact canonical host without redirects; verify the certificate on an actual device. Until then the app may open with a browser toolbar.
6. Test install, launch, back, sign-in/out/recovery, external OAuth links, permissions, file picker/uploads/downloads, keyboard and offline recovery on Android. No device was supplied during development.
7. Upload AAB to the owner’s Play Console only after approval; meet any account-specific closed testing/verification requirements. Recheck current API/policy requirements at submission time.
