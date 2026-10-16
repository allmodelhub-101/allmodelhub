# Phase 3 — responsive Chat presentation

Baseline: Phase 2 `dc7ab2025edf071af2b470586f126ff8537fb3d7`, same feature branch and draft PR #149. Main remains unchanged; no merge or production promotion. Validation is in progress; no final PASS is claimed yet.

## Implemented boundaries

ChatClient retains transport, Supabase session refresh, pending settlement, uploads, voice recognition and conversation persistence. ChatWorkspace is the production presentation, with typed callbacks, shared ModelPicker/PremiumSelect, Markdown and actual composer controls. The local fixture mounts this same component in WorkspaceFrame with an offline topbar, under the existing development + explicit flag + loopback + no-Vercel gate. It cannot authorize or load a protected route. No production test account/backend is available; authenticated E2E stays BLOCKED.

The pure composer policy is shared by production and fixture: Enter submits, Shift+Enter/IME preserve native editing, Escape stops busy requests, >1200-character paste becomes context, and submitted context formatting is preserved. Tests pin ten Phase 2 AST function hashes for request/stream processing, pending settlement, uploads, enhancement, voice and conversation actions. No baseline was regenerated for Phase 3 behavior changes.

## Presentation and ownership

`chat-workspace.css` owns a new root class, so retired `.chat-page`/`.premium-chat-page` overrides cannot dictate its viewport. WorkspaceFrame owns header and mobile navigation clearance. Chat occupies the remaining grid cell; history is a scroll region above an in-flow auto-growing composer. VisualViewport height is used directly at scale 1, with 100dvh fallback; there is no guessed keyboard offset. Composer sizing responds to input and viewport changes.

Message Markdown has focusable local code/table scroll regions; unbroken prose wraps. Markdown rendering is memoized by content. Streaming follows only near the bottom, recognizes upward reading before delayed scroll events, and offers Latest. History updates do not force readers down. Welcome starts at the top, with an interactive model ticker that pauses for pointer/focus and stops for reduced motion, four starter actions, restrained typography and a pinned composer.

Attach, voice, model and Send/Stop remain primary. Compact screens expose enhancement in the Chat controls dialog alongside project/tier/reasoning/privacy, using the existing callbacks. The controls portal reuses shared overlay handling and avoids composer stacking contexts. The shared selector now consumes Escape only while open, so a closed selector does not swallow dialog dismissal. Body/history scroll locks restore previous styles.

## CSS migration evidence

Only eleven global selector groups requiring the retired exact `.chat-page` class were removed; source search confirms no component renders that class. Removed rules/declarations are recorded in `removed-legacy-chat-selectors.json`. The Phase 2 synthetic `premium-chat-page` compatibility test remains intact. Shared/media styles and the remainder of global CSS are preserved. No blanket document overflow clipping or new !important rule was added.

## Evidence and current checks

`before/` contains actual Chromium welcome/long Chat captures at 320, 390, 844 landscape, 768 and 1366 before styling changes, using the extracted unchanged markup with Phase 2 styles. `after/` contains the new real presentation and controls. Historical Phase 1/2 evidence is preserved.

Initial exploratory browser runs found and repaired: a new scroll-effect ReferenceError, closed-selector Escape propagation, a streaming-follow timing race, and a controls stacking-context issue visible in screenshots. These runs must not be represented as passing final runs. Exact final runs, screenshot review and acceptance status will be appended after execution.

## Remaining verification limits

Fixture send/retry/branch/edit/attachment/voice actions are local synthetic adapters; they do not prove authenticated persistence, microphone recognition, provider streaming, or billing settlement. Shared pure input policy and unchanged production-controller function hashes provide additional isolated evidence, not E2E equivalence. Physical iOS/Android keyboards, safe areas, touch selection, zoom and assistive technology remain unverified. Preview protection/team permissions remain unavailable from Phase 2.

Phase 4 should start with Image Studio, then Video and Audio, using the same safety gates, scoped owners, real presentation fixtures, before/after evidence and unchanged API/provider/billing contracts. Do not merge this six-phase PR or promote it to production without the final release decision.
