# Billing V3 authorization audit — 2026-09-29

Billing V3 is the only engine used to authorize and settle new AI requests. An
authorization policy is a conservative wallet ceiling, not a final price. The
final provider cost is always the exact settled USD `credits` returned by the
APIMODELS record for the provider request/task ID. Customer Credits are that
exact USD amount multiplied by the quote's frozen internal USD/PKR rate and the
model's existing frozen markup.

Current official sources:

- LLM contract and current token rates: <https://apimodels.app/docs/llm>
- Image catalog and current pricing dimensions: <https://apimodels.app/docs/image>
- GPT Image 2 request contract: <https://apimodels.app/docs/gpt-image-2>
- Kling V3 request contract: <https://apimodels.app/models/kling-v3>
- Seedance 2.5 request contract: <https://apimodels.app/docs/seedance-2-5>

## Coverage

- Visible operational routes: 57
- Active V3 authorization policies after this migration: 42
- Text: 18/18
- Image: 8/13
- Video: 5/15
- Audio: 11/11

The 20 policies added by the consolidation migration cover all 16 previously
blocked text routes plus Doubao Seedream 5.0 Pro, GPT Image 2, Qwen3 Image Pro,
and Kling V3. Text ceilings use AMH's enforced 150,000 maximum input-token
envelope and 16,384 maximum completion-token envelope. AMH does not send cache
creation directives, and APIMODELS documents reasoning/thinking tokens inside
the completion/output usage bucket, so the full-rate input plus full-rate
output ceiling safely includes those costs.

## Routes that remain fail-closed

| Model | Exact unresolved contract dimension |
|---|---|
| `gemini-3-1-flash-image` | The current generic image catalog does not publish a complete 512/1K/2K/4K price matrix plus editing/reference behavior for this exact route ID. |
| `gemini-3-pro-image` | The current source does not provide a complete 1K/2K/4K maximum-cost contract for the exact route, including its five-reference editing mode. |
| `gpt-image-2-5-flare` | No current official APIMODELS page defines this exact model ID's full quality/resolution/reference price matrix. GPT Image 2 prices cannot be reused for a different route. |
| `gpt-image-2-5-sunburst` | No current official APIMODELS page defines this exact model ID's full quality/resolution/reference price matrix. GPT Image 2 prices cannot be reused for a different route. |
| `grok-imagine-image-2` | The catalog exposes a headline price but does not establish whether reference editing and both exposed resolutions share the same maximum charge for this exact route. |
| `flashvsr` | AMH's route accepts input video duration and 720p/1080p/2K/4K output, but the current provider source does not define a complete maximum-cost formula across those dimensions. |
| `grok-imagine-video-1-5` | The exact 720p duration/audio/reference combination exposed by AMH lacks a complete current maximum-cost contract. |
| `ltx-2-3` | The current official source does not define a complete maximum-cost contract for the exact route ID and its duration/input mode. |
| `minimax-h3-lite` | The current official source does not define a complete maximum-cost contract for the exact Lite route, duration, and image mode. H3 pricing is not reused. |
| `minimax-h3-max-turbo` | The current official source does not define a complete maximum-cost contract for 480p/768p, duration, and two-reference combinations. |
| `seedance-2-0` | The exposed route includes image/audio inputs and native audio; current documentation does not provide a complete ceiling for all of those combinations. |
| `seedance-2-0-fast` | The current source does not define the exact Fast route's complete duration and image-mode maximum-cost contract. |
| `seedance-2-0-mini` | The exposed route includes image/audio inputs and native audio; current documentation does not provide a complete ceiling for all combinations. |
| `seedance-2-5` | Generation is token-billed, while edit/extension bills source plus output duration. AMH does not yet measure and enforce every referenced source asset duration before authorization. |
| `wan-3-0-video` | The exact route exposes resolution, duration, references, audio input, and native audio without a current complete provider maximum-cost matrix for every combination. |

These routes remain visible with `available=false`. Auto routing cannot select
them, and direct requests fail before wallet authorization or provider calls.

## Historical engines

Billing V1/V2 tables, migrations, receipts, and reconciliation primitives are
retained for audit and for completing operations created before the V3 cutover.
They are not imported by any new-request authorization path. V2 pricing rules
are no longer a catalog availability gate or a final-cost authority.
