# Google Play publication is blocked by an unresolved billing decision

Reviewed against official Google documentation on 2026-10-20. The Android shell does not change website billing, credits, authorization, provider routing or settlement. No Play Billing library or Digital Goods API has been added.

The existing website sells digital Credits consumed by AI chat/media features. Its wallet offers external/manual payment workflows. A TWA renders those same website routes; packaging a website does not exempt it from Play’s payments rules. On this evidence, the current AAB must **not** be represented as ready for Play publication. Eligibility for any regional alternative billing/external offers program has not been established.

The owner must choose and authorize a supported release strategy after confirming distribution countries and Play program eligibility: integrate the applicable Play billing flow and backend verification/entitlements, or design an approved consumption-only experience that meets the policy, or qualify for the applicable alternative program. Each option changes business behavior and is outside this task. Do not hide a button and assert compliance: direct links and indirect steering, signup routes and all web content accessible inside the app also matter.

Direct website APK distribution is separate from Play publication; signing alone does not establish legal, payment or store-policy compliance. Developer verification requirements for outside-Play distribution may also depend on countries/device rules at release time.

Sources:

- [Google Play Payments policy](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en)
- [Understanding the Payments policy](https://support.google.com/googleplay/android-developer/answer/10281818?hl=en)
- [Play Billing in Trusted Web Activities](https://developer.chrome.com/docs/android/trusted-web-activity/receive-payments-play-billing/)
- [Current target SDK requirements](https://developer.android.com/google/play/requirements/target-sdk): new ordinary phone apps target API 36 as of August 31, 2026. This build targets/compiles 36.

The developer must confirm current policy and any program agreements in their own Play account before submission. These notes identify implementation risk; they are not an approval or legal determination.
