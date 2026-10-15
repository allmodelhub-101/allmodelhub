# Billing V3 runtime repair — 2026-10-15

## Scope and delivery boundary

Branch: `codex/billing-v3-runtime-repair`, based on main `66904e1cfb755b371c941bc0a39d3de4824dad27`.
Production Vercel deployment `dpl_5wGLSKXUib5YfjjYiqPH3JhyHmDa` matched that main commit at audit time.
Production Supabase was positively identified as `gkmkiperlvmaaefwuvel` (`supabase-red-notebook`).
All production database operations in this investigation were read-only. No generation request, wallet mutation,
schema migration, secret change, merge, or production deployment was performed.

Open PRs #106 and #117 were inspected, including patches. They were not merged or copied wholesale:
the current registry has no future policies, and main already includes the later October 5/6 video repairs.
All 15 current video routes pass readiness and existing video lifecycle regressions.

## Verified roots and implementation

1. MiniMax Speech 2.8 Turbo/HD had valid current V3 authorization definitions and provider routes, but no
   execution contracts. The speech client only distinguished Kling async from ElevenLabs streaming.
   Add their asynchronous audio contracts and use `/v1/audio/generations` with `model`, `text`, and
   verified MiniMax `voice_id` presets. Preserve callback/polling and the existing records-authoritative
   settlement path. Reject unverified language/speed, references, and media cost-changing options before authorization.
2. `/api/models` lacked explicit browser/CDN no-store headers and clients used default fetch caching.
   Add browser/Vercel/CDN no-store directives and explicit no-store model fetches. Speech refreshes on
   window focus, retaining a still-executable selection. Real availability reasons replace generic billing labels.
3. Text/TTS marked provider submission started only after awaiting the transport. An exception during
   submission could release its hold and try another provider despite an unknown billable outcome.
   The first PR revision marked submission too early (P1 review). The correction observes the actual transport
   boundary: finish adapter selection, credentials, serialization and Request construction first, then mark
   immediately before fetch. Retain holds and block fallback on ambiguous timeouts/5xx; release on local
   preflight failure or typed definitive rejection. Replay cannot skip an ambiguous claim and reach another
   paid route. A failed release stops fallback rather than accumulating a second unresolved hold.
   Existing media timeout protections remain intact.
4. Exact records parsing used a regex that truncated scientific notation and could select a nested
   unrelated `credits` field. Preserve JSON numeric lexemes before parsing, select the actual record envelope,
   and normalize using Decimal. Preserve numeric provider timestamps as ISO timestamps.
   Pending `credits: null` was already supported; this PR does not claim to repair that behavior.
5. Music/SFX could label estimated/reserved credits as "Charged" when a completed job had not settled.
   Only `charged_credits` is displayed as final; otherwise the playable result says billing pending.

## Availability: audited live versus candidate code

| Studio | Catalog | Live before | Candidate readiness |
| --- | ---: | ---: | ---: |
| Text | 18 | 18 | 18 |
| Image | 13 | 12 | 12 |
| Video | 15 | 15 | 15 |
| Audio | 11 | 6 | 8 |
| Total | 57 | 51 | 53 |

Candidate counts are regression-test results against the read-only production policy/route snapshot,
not a claim that production has been updated or that paid provider execution succeeded.
`tests/fixtures/runtime-readiness-2026-10-15.json` contains all 57 readiness decisions and the 56
effective policies. It contains no users, credentials, wallet data, or provider generations and is never runtime pricing.
Every previously available route retains readiness. Only the two MiniMax speech routes change.

Remaining disabled:

- `eleven-dialogue`: needs structured multi-speaker `inputs` and per-utterance voices, not one TTS script/voice.
- `eleven-dubbing`: needs source media and target language. Current docs show $0.55/min, while the imported
  policy uses $0.2805/min; existing policy cannot safely authorize a newly implemented workflow without review.
- `eleven-isolator`: needs source audio, not a TTS script. No verified source-audio studio workflow exists.
- `grok-imagine-image-2`: no execution contract or effective V3 authorization policy for this exact catalog route.
  Do not substitute a similarly named upstream model or infer pricing.

These models remain visible and non-executable. No availability flag is forced true.

## Current provider evidence

Read on 2026-10-15:

- https://apimodels.app/docs/audio — current model IDs and billing units; MiniMax Turbo $0.04/1,000 characters,
  HD $0.063/1,000 characters. These match the existing policy definitions and 10,000-character ceilings.
- https://apimodels.app/models/minimax-speech-2.8-turbo
- https://apimodels.app/models/minimax-speech-2.8-hd
- https://apimodels.app/docs/audio?p=minimax — async POST and GET polling contract; documented system voices
  `male-qn-qingse`, `female-shaonv`. Only this verified subset is exposed. No cloning/design options are enabled.
- https://apimodels.app/docs/records — settled USD `credits`, pending nullable cost, millisecond timestamps,
  and free record lookup. Final settlement continues using records, not local authorization estimates.

No pricing formula, markup, FX, provider route, policy ceiling, schema, or historical receipt was changed.
No migration is required for the two MiniMax repairs: their effective policies already exist.

## Read-only financial findings

- Effective V3 policies: 56; future-dated: 0; duplicated route-policy bindings: 0.
- Underfunded policy maximums at current configured FX/markup: 0.
- Missing wallet transaction links on receipts: 0; duplicate quote receipts: 0.
- Negative-margin receipts: 0; captures exceeding reservation: 0.
- Wallet reserved-balance discrepancies against active holds: 0.
- Holds: 8 active, 111 captured, 41 released; provider ledger: 21 completed/settled and 1 authorization shortfall.
- Open anomalies include 8 missing provider identifiers and 1 historical authorization shortfall.
  These are not declared resolved and were not modified.

Historical shortfall evidence: Qwen 3.8 Flash, provider request `cmumg1hfj08gvp901t9q8ostu`, provider USD cost
`0.003500000000000000`, frozen FX 310 and markup 2 imply 2.170000 customer credits, versus original
authorization `0.642823000000000000`. Never capture above authorization or invent a provider credit/refund.
Owner-authorized resolution and authoritative provider evidence are needed. The eight identifier-less holds
cannot be settled/released safely until their provider request evidence is recovered.

The current Hobby Vercel log window is only one hour. The available recent query returned no matching
`ApimodelsBillingRecordError`; this does not prove earlier production errors are absent. Parser defects above
were reproduced in tests; they are not asserted as the cause of every historical anomaly.

## Validation and handoff

- Billing/security regression suite, including real PostgreSQL-compatible financial RPC tests, exercises exact
  capture, duplicate settlement, releases, frozen snapshots, and authorization shortfall behavior.
- New tests execute real text/TTS attempt functions with mocked I/O: ambiguous transport and 503 never
  resubmit/release; definitive 429 releases before configured fallback.
- New tests execute real MiniMax request preparation and all 57 readiness decisions, plus exact tiny/large
  cost parsing, Unicode character units, provider-specific controls and no-store contracts.
- Typecheck and optimized production build passed; source security scan passed.
- Full-project lint has two pre-existing `react-hooks/set-state-in-effect` errors in the unchanged
  `src/components/login-form.tsx` (saved-email restore and mode reset). They are outside this billing repair.
  Existing unrelated warnings are retained. Changed-file lint is run separately.

Preview isolation instructions: [BILLING_V3_PREVIEW_ISOLATION.md](./BILLING_V3_PREVIEW_ISOLATION.md).
The current Preview must not be used for generation or financial mutation tests because its public bundle
references production Supabase. No real-provider success is claimed.

Production prerequisites: owner review/approval and explicit deployment authorization; approved small budget
for real MiniMax/provider smoke tests; recover provider evidence for historical anomalies and decide safe
shortfall treatment. No automatic production cutover is authorized by this task.

## P1 correction verification

- Billing/security suite: 158 tests passed, zero failed/skipped.
- The explicit local PostgreSQL-compatible PGlite financial integration rerun passed. It executes real
  V3 SQL/RPCs and ledger constraints; managed Supabase integration and overlap-exclusion validation remain
  blocked by Preview isolation. No live database test is claimed.
- Transport regressions now load real billing, exact adapters, request construction and submission code.
  Missing credentials, unsupported adapters/providers and invalid request URLs release without network
  submission or missing-identifier anomalies. Safe configured fallback occurs only after successful release.
  Definitive 429 releases; 503, timeout and accepted-but-malformed cost evidence retain the original hold.
  A returned provider request ID survives later parsing failure. Replay cannot reach a fallback after
  an ambiguous or completed attempt, and a failed reservation release blocks further attempts.
- All eight executable audio paths have network-mocked adapter checks: MiniMax Turbo/HD, Kling TTS,
  Suno, Kling Sound Effects, Eleven Flash/Multilingual/v3. These are not real-provider quality/success tests.
- Typecheck, optimized production build, changed-file lint and security source scan passed. Changed-file
  lint retains six pre-existing video image-element warnings, no errors.
- Exact four remaining gated IDs are asserted in the 57-model regression test; candidate readiness stays
  53/57. No model, route, formula, FX, markup, receipt or historical hold was changed by this correction.
