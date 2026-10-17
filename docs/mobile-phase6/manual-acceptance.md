# Remaining release acceptance — BLOCKED / UNVERIFIED

## Isolated backend prerequisites

Supply an explicitly authorized nonproduction deployment/backend, dedicated member and admin accounts, synthetic conversations/files/support/payment records, an approved free or stub provider, and payment sandbox configuration. Preview protection also needs an authorized access method if enabled. No production/customer session, fabricated auth cookie or service-role browser key is acceptable. Keep session state outside Git. Test data must be scoped so cleanup cannot touch customers.

For each of the 22 protected routes listed in tests/responsive/baseline.spec.ts, record account role, deployment/commit, reproducible workflow, expected result, screenshot and network/backend evidence. Cover Chat switching/project/private/streaming/cancel/retry and settlement; Image/Video/Audio generation/polling/results with safe providers; file permission/upload/delete with disposable data; settings/support persistence; wallet sandbox hold/capture/refund/ledger consistency; member rejection and admin role enforcement plus safe administrative actions. Auth verification/recovery require dedicated test mailboxes and approved links. No real payment or paid generation is authorized.

## iOS Safari — UNVERIFIED

Record actual device, OS/Safari version, URL/head and orientation. On small and large iPhones: focus and grow the Chat textarea with keyboard open; scroll earlier messages; select/copy/paste; exercise predictive text, dictation and IME composition; confirm Enter/Shift+Enter and Send/Stop; rotate while editing; close picker/sheet and verify focus returns. Check notch/home indicator, navigation separation, browser address-bar expansion, pinch zoom and 200% text enlargement. Test VoiceOver headings/landmarks, control names, field errors, tables, modal focus containment/return and swipe order. Check Reduce Motion, media playback and all four payment stages without a transfer.

## Android Chrome — UNVERIFIED

Record real device/Android/Chrome version and deployment/head. Repeat keyboard/IME, selection/paste, resizing, short landscape, browser controls, navigation/gesture inset, large-font and 200% zoom checks. Test TalkBack landmarks, reading order, field errors, nested dialogs/Escape/back navigation and local table access. Test ordinary and reduced motion, long Chat, large lists, studio results/native playback and payment stages on representative lower-end hardware; record frame/interaction evidence and layout shifts.

## Accessibility and performance release gate

Automated axe results are a selected WCAG A/AA subset, not an accessibility certification. Review all incomplete findings, gradients, focus contrast, color-only meaning, touch spacing, unusual content and keyboard order manually. Verify real recovery/reset, unavailable feature/model states, translations and populated account/admin data. Use production rendering on real hardware to assess frame rate, interaction latency, layout shifts and expensive decorative layers. Do not disable premium effects to obtain a score.

Release requires completed isolated E2E, actual hardware/AT acceptance, reviewed current visual comparisons, and successful foundation/both browser jobs on the exact final PR head. Keep PR #149 draft/unmerged until release authorization.
