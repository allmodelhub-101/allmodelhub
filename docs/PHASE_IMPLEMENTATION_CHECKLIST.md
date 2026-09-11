# Phased Implementation Checklist

Each phase uses a small branch and pull request, automated checks, review, merge, and rollback note. Schema work is isolated in numbered additive migrations.

## Phase 0 — Safety baseline

- [x] Record protected homepage fingerprint
- [x] Document API/database contract boundaries
- [x] Document product and scrolling invariants
- [x] Define responsive acceptance viewports
- [x] Define rollback conditions
- [x] Add rollout keys for substantial workspace releases
- [ ] Capture authenticated visual references when a test account is available
- [ ] Gradually split workspace CSS without changing rendered appearance

## Phase 1 — Minimal data extensions

- [x] Associate media jobs with projects
- [x] Add model `ui_schema`
- [x] Add reusable asset favorites
- [x] Add required covering indexes
- [ ] Resolve the reviewed Supabase security-advisor items before launch

## Phases 2–3 — Shell and Generation Center

- [x] Fixed authenticated application frame and internal scrolling
- [x] Compact navigation, creation launcher, project selector, command palette
- [x] Mobile bottom navigation
- [x] Global generation feed with real states and costs
- [x] Add safe retry with original prompt, model, and project context
- [ ] Add cancellation when an upstream provider exposes a safe cancellation contract

## Phases 4–7 — Creation workspaces

- [x] Preserve and integrate Chat and Image foundations
- [x] Establish separate Video and Audio Studio surfaces
- [ ] Complete capability-generated controls and recovery states
- [ ] Complete provider-supported editing, variation, extend, upscale, and waveform workflows
- [ ] Enable cross-modality handoffs behind `cross_modality_handoffs`

## Phases 8–11 — Product system

- [x] Project context, unified Library foundation, favorites, model marketplace, and cost explorer
- [x] Search destinations, projects, and models from the global command palette
- [ ] Complete asset detail, full product search, notifications drawer, onboarding, and keyboard help
- [ ] Complete spending-limit and receipt presentation

## Phase 12 — Launch hardening

- [ ] Responsive, keyboard, screen-reader, contrast, reduced-motion, failure, and slow-network verification
- [ ] Sentry, Web Analytics, and Speed Insights
- [ ] Supabase security review
- [ ] Browser → API → provider → database → wallet settlement verification

