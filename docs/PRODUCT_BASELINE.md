# Product Safety Baseline

Established: 2026-09-11

This document is the release boundary for the phased All Model Hub workspace program. It protects working product foundations while allowing small, reversible improvements to the authenticated application.

## Protected surfaces

- Public cinematic homepage: `src/app/page.tsx`
- Homepage SHA-256: `9b1f0c6657febef0a27e540644a8ba8977025d5b5d581896c8e68e5739c25d4d`
- Authentication and account lifecycle
- Wallet ledger, holds, capture, release, refunds, spending limits, and PKR conversion
- Provider adapters, routing, callback validation, and fallback foundations
- Generation settlement and generated-output persistence
- Existing API contracts unless a backward-compatible extension is documented

Run `npm run check:homepage` before merging application work. A homepage change requires an explicit product request and a deliberate update to this baseline.

## Product invariants

1. Chat, Image, Video, and Audio remain separate specialist workspaces inside one shared creation environment.
2. Authenticated routes use a `100dvh` application frame. The document does not scroll; named content regions own overflow.
3. Controls are displayed only when the selected model supports them.
4. Costs use the current pricing and wallet systems. UI estimates never replace final ledger settlement.
5. Provider progress is never represented with invented percentages.
6. Failed requests preserve user input and recover held credits through the existing settlement path.

## Responsive acceptance targets

| Class | Baseline viewport | Required behavior |
| --- | --- | --- |
| Compact mobile | 360 × 800 | Bottom navigation, sheet controls, no horizontal overflow |
| Mobile | 390 × 844 | Composer remains visible above the keyboard |
| Tablet | 768 × 1024 | Collapsed navigation and usable creation canvas |
| Laptop | 1366 × 768 | Full workspace without document scrolling |
| Desktop | 1440 × 900 | Readable content width and collapsible inspector |
| Ultrawide | 1920 × 1080 | Canvas expands while readable text remains constrained |

Both light and dark themes, keyboard navigation, reduced motion, long content, loading, empty, failure, and insufficient-balance states are acceptance requirements.

## Rollout flags

Flags are read from the existing `feature_flags` table with safe application defaults. Large unfinished work ships disabled first. Current workspace flags are `unified_shell`, `generation_center`, `unified_library`, and `cross_modality_handoffs`.

## Rollback conditions

Rollback or disable the affected flag when a release causes any of the following:

- Authentication, wallet settlement, refund, or provider callback regression
- Lost prompts, files, outputs, or project associations
- Authenticated document scrolling or inaccessible primary controls
- Incorrect cost display or ledger mismatch
- Sustained build/runtime errors attributable to the release

Rollback is the previous known-good GitHub merge commit or disabling the narrow feature flag. Database changes must be additive and remain compatible with the previous application version.

