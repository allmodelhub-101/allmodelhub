# Video V3 runtime repair

Branch: `fix/video-v3-runtime`. No production migration, wallet mutation, main merge, or production deployment was performed.

## What changed

New video requests use V3 policy-owned, versioned authorization evidence. A forward migration imports already verified evidence once; runtime catalog/authorization never query the historical V2 pricing registry. V2 financial history and historical settlement remain intact.

The V3 registry derives current FX, model markup, and reservation quantum. Each quote freezes those values, the exact request provider estimate, and the request-specific hold. Existing immutable-quote triggers continue protecting all financial fields. Final video capture requires APIMODELS records API evidence, not a callback price. Shortfalls retain the hold, produce one anomaly, disable the affected policy, and never cap or debit extra funds.

Callback, polling, and scheduled reconciliation save trusted output, retain `settling` while records are pending, and mark video completed after settlement. Polling can retry pending records. Shared quote/record locks and receipt checks prevent duplicate captures. Task identity is saved before the pending-ledger write; reconciliation can recover a missing job task ID from that ledger. An ambiguous transport failure retains authorization and cannot fall through to another provider submission.

Canonical execution contracts provide selectable UI controls. Canonical server readiness checks active models, exact operational routes, verified authorization, adapter/UI compatibility, V3 settlement, and required environment configuration. The same result feeds `/api/models`, runtime selection, and admin diagnostics. Video retail hints from historical static catalog rates are omitted; the authenticated preflight provides current customer credit estimates without supplier USD details.

Video Studio preserves its layout and adds estimates, explicit maximum-hold confirmation, normalized image/video/audio references, positional Turbo first/last frames, and FlashVSR Upscale. Video/audio uploads use fixed-path signed private Storage uploads, existing quota reservations, server byte inspection, and atomic/idempotent finalization. Provider references are immutable copies in a separate private bucket, accessed through expiring opaque capabilities and short-lived signed redirects. Neither large upload bodies nor provider media responses traverse Vercel functions. Temporary objects are cleaned in bounded batches by the existing reconciliation cron; user files and financial history are not cleanup targets.

## Forward migrations

Apply in order, after review:

1. `20261005203530_video_v3_native_authorization.sql`: neutral settings, V3 evidence import, live-economics view, request-specific reservation RPC, five newly verified video policies, media metadata, private capability table, and exact records-authoritative settlement RPC.
2. `20261006052727_video_private_media_uploads.sql`: two private media buckets, service-only upload sessions and atomic finalization RPC, immutable provider-source metadata.

Supabase RLS and service-only table/function grants are explicit; the view uses `security_invoker`. No browser service key, supplier-cost payload, or public bucket is introduced. Both migrations are new; no historical migration was changed. Review Storage policies in the target project to ensure no wildcard policy grants clients access to the new buckets.

## Model status after migrations and environment configuration

“Ready” below means code/SQL readiness verified locally, not a completed live paid provider smoke test.

| Model | Status | Supported workflow | Authorization strategy |
| --- | --- | --- | --- |
| gemini-omni-1-1-flash | Ready | Text/image generation | Verified time/resolution snapshot |
| grok-video-3 | Ready | Text/image generation | Verified time/resolution snapshot |
| kling-v3 | Ready | Text/image, optional native audio | Verified time/resolution/audio mode |
| minimax-h3 | Ready | Text/image generation | Verified time/resolution snapshot |
| minimax-h3-lite | Ready | Text/image generation | Verified time/resolution snapshot |
| veo-3-1-fast-fhd | Ready | Text/image, fixed 8s/1080p | Verified fixed request price |
| ltx-2-3 | Ready | Text 5–15s/image 5–20s | Verified time/resolution snapshot |
| grok-imagine-video-1-5 | Ready | Text/image; intrinsic audio | Verified time/resolution snapshot |
| minimax-h3-max-turbo | Ready | Text/first-frame/first+last-frame | Verified time/resolution snapshot |
| seedance-2-0 | Ready | Text/image/video/audio generation; no audio-only reference | Published authorization ceiling; final Records API settlement |
| seedance-2-0-fast | Ready | Same; no audio-only references | Published authorization ceiling; final Records API settlement |
| seedance-2-0-mini | Ready | Same; no audio-only references | Published authorization ceiling; final Records API settlement |
| seedance-2-5 | Ready | Standard multimodal generation; no edit/extend UI | Conservative authorization envelope; final Records API settlement |
| wan-3-0-video | Ready | Standard generation, image/video/audio refs | Rate × output seconds; video refs add input seconds |
| flashvsr | Ready | MP4 Upscale only; source duration ≤120s | Rate × server-inspected source duration/resolution |

All ready models settle final cost from APIMODELS records using quote-frozen FX/markup. Unsupported smart-duration, prime Wan, document/web inputs, Seedance edit/extend, and public arbitrary source URLs are not advertised or accepted.

## Seedance authorization and settlement

The forward repair adds executable, versioned authorization policies for all four Seedance routes. Their published derived per-second values are explicitly stored as conservative authorization estimates/ceilings, not final provider prices. Seedance 2.5 reference-video authorization uses source plus output seconds with the documented lower reference-video rate. Every final Video V3 customer charge still derives exclusively from the APIMODELS Records API USD cost and the quote-frozen FX/markup snapshot.

An authorization shortfall now records one critical anomaly, disables the policy, releases the active hold and reservation, and cancels the quote without capturing a customer charge. Replayed settlement calls return the same terminal outcome while retaining the provider record for reconciliation.

## Verification

- Billing suite: 112 passing tests, including all 15 deterministic readiness states, all six existing video contracts, five new native strategies, token formula, current FX/markup and frozen quotes.
- Actual route-function tests (external dependencies mocked): submission-once after accepted-task database failure; records-authoritative callback; duplicate callback; pending records; polling retry; authoritative zero-cost failure; scheduled output/settlement recovery.
- Embedded PostgreSQL (PGlite): both forward migrations, real V3 reservation/settlement/failure RPCs, immutable quote FX/markup, exact capture and release, duplicate reservation/receipt, idempotent shortfall anomaly, private grants, quota reservation and upload finalization. Foundation wallet fixtures are transactional but simplified. PGlite serializes calls; this is not a substitute for multi-connection PostgreSQL race testing. Historical `btree_gist` active-window exclusion constraints are omitted only in this fixture.
- Security suite: 4 tests passing. Security scan passed. Typecheck and production build passed.
- Changed-file lint: 0 errors, four existing image-element warnings. Full repository lint still reports the unchanged `login-form.tsx` set-state-in-effect errors at lines 87 and 91 (plus existing warnings).
- Local browser fixture verified FlashVSR source/target controls and absence of text-to-video prompt/duration controls. This did not submit a paid provider job.
- Docker local Supabase was unavailable. No migration was applied to production or inactive staging. Live Storage, authenticated preview, provider callbacks/records, and full multi-connection races remain deployment-gate smoke checks.

## Exact review and preview steps

1. Review this branch and both migrations. Keep Vercel's Production Branch on `main`; do not promote the repair branch to production. A branch push may create an automatic Git preview, but its runtime must not point to production Supabase.
2. Provision/resume an isolated Supabase preview project with the repository's prior migrations and safe test catalog/settings. Do not use production wallets. The existing staging project was inactive; it was not modified.
3. In that isolated project, apply the two new migration files in timestamp order via Supabase migration tooling. Inspect `supabase db push --help`; run the dry-run against the explicit preview database URL first. Apply only after confirming the target and migration history. Run database security advisors and verify private buckets, service-only RPC grants, and RLS.
4. Scope Vercel Preview env to that preview project: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `APIMODELS_API_KEY`, `APIMODELS_BASE_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `CALLBACK_SECRET`, `CRON_SECRET`, `PROVIDER_ASSET_HOST_ALLOWLIST`, and `NEXT_PUBLIC_APP_URL`. Set the last value to a stable HTTPS preview hostname. Configure Supabase Auth redirect URLs for that hostname. Keep provider, callback, and Redis secrets server-only.
5. Deploy a Preview of `fix/video-v3-runtime` after review. APIMODELS must reach callback/capability endpoints without Vercel deployment-protection login; use an approved isolated preview domain/access configuration, not public production credentials. Verify that a provider follows the signed Storage redirect and Range requests work on an uploaded MP4 larger than 4.5 MB.
6. Run `pnpm install --frozen-lockfile`, `pnpm test:billing`, `pnpm test:security`, `pnpm check:security`, `pnpm typecheck`, and `pnpm build`. Confirm `/api/models` returns 15 active video entries with 15 ready entries, and admin `GET /api/admin/models/<id>` readiness agrees.
7. Use a dedicated preview test wallet and an explicitly approved provider-spend budget. Smoke-test each ready model, Turbo ordered frames, Wan video-reference duration billing, and FlashVSR upload → estimate → hold → provider task → output → receipt. Compare final APIMODELS USD record × frozen FX × frozen markup (rounded to frozen wallet quantum) to exactly one wallet transaction and receipt; check unused hold release.
8. Replay callbacks and poll concurrently from multiple clients; invoke authenticated `GET /api/internal/billing/reconcile` with the preview `CRON_SECRET`. Test failed zero-cost record release, delayed records, output persistence retry, pricing changes requiring renewed confirmation, and source-file deletion after task submission. In isolated SQL tests, force a shortfall and confirm no additional debit/no capped charge. Confirm changing FX/markup affects new quotes but not an existing quote. The existing cron remains daily; review a faster approved schedule separately if desired.
9. Only after these gates pass, back up production, apply the reviewed forward migrations, review the normal merge, and deploy through the project's approved production workflow. Do not roll back by deleting financial rows; use a reviewed forward repair or disable the affected route/policy if needed.

## Changed-file map

Billing and settlement: `authorization.ts`, `media-authorization-pricing.ts`, `media-job-billing.ts`, `reconciliation.ts`, generation route, callback route, jobs route, cron route, both migrations.

Readiness/contracts: `model-store.ts`, `model-readiness-core.ts`, `media-execution-contract.ts`, `models.ts`, public models API, admin model diagnostics and model picker.

Studio/references: `video-studio.tsx`, `media-request.ts`, `media-metadata.ts`, `studio-media-upload.ts`, `provider-input-assets.ts`, `media-storage-cleanup.ts`, files API, private media upload API, preflight API and provider capability API.

Tests/tooling: three new video V3 test files, four updated historical/runtime billing test files, pinned PGlite test dependency/lockfile, TypeScript import-extension support, and this handoff document. Generated Next/TypeScript build artifacts are not part of the repair commit.
