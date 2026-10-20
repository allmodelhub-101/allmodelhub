# Data safety worksheet — owner confirmation required

Privacy policy URL: https://www.modelssuite.com/privacy. Source: existing `src/lib/legal-documents.ts`; this task did not change legal terms or data processing. The TWA adds no analytics/ad SDK, native private-data database or background collection. **Web data collected within the app still belongs in the Play declaration.** Do not answer “no data collected” based on a thin wrapper.

| Play data area | Existing website evidence / draft answer | Required confirmation |
|---|---|---|
| Personal information | Account email, user identity/profile; account management | Exact fields, required/optional status, deletion procedure |
| User content | Prompts, conversations, uploaded documents/images/audio/video, generated assets; functionality | Provider inventory, retention, deletion, optional features |
| Photos/videos/audio/files | User-selected attachments and voice/audio input where used | Classify each category, transient vs retained, access controls |
| Financial information | Wallet transactions, payment references and uploaded proof | Whether payment-card/bank data reaches the app/server/provider; do not claim none without checking |
| App activity | Requests/history, projects, usage, support requests | Product analytics, service logs, data purposes |
| Device/other IDs and diagnostics | Existing policy mentions technical/security/device signals | IPs, cookies, identifiers, logging/retention, analytics providers |
| Location, contacts, SMS | No native permissions requested for these categories | Confirm website/providers infer location or other data before marking absent |
| Data sharing | Prompts/attachments sent to upstream AI providers; hosting/auth/storage/payment processors | Service provider exceptions, contracts and purposes; not every transfer has the same classification |
| Encryption | HTTPS canonical origin; cleartext disabled in Android | Verify end-to-end operational configuration and third-party transfers before answering |
| Deletion | Existing policy/support content discusses requests | Verify a working account deletion path plus publicly accessible deletion-request URL. No automated deletion flow was created or tested here |
| Ads / tracking | No ads or tracking SDK added by this Android project | Audit existing website analytics/cookies/providers and confirm owner declarations |

Also complete: data types, collection vs sharing, ephemeral processing, required/optional, purposes, security practices, retention, account deletion, children/target audience, generative AI/user-content policies and any independent review claims. Do not claim security review, encryption at rest, or guaranteed provider deletion without evidence.

This worksheet is not the submitted Play data-safety form. Owner/operations must verify actual infrastructure and vendor contracts. Authenticated workflows were not exercised with customer sessions.

Official references: [Data safety declarations](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en), [User data policy](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en), [Account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en).
