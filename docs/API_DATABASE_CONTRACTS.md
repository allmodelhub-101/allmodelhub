# API and Database Contract Baseline

Established: 2026-09-11

## Public and account APIs

- `GET /api/models` returns capability and retail-price metadata.
- Account login, callback, export, and deletion retain their existing request and authorization behavior.

## Workspace APIs

- Conversations: `/api/conversations`, `/api/conversations/[id]`, `/api/chat`
- Media: `/api/generations/[modality]`, `/api/tts`, `/api/jobs`, `/api/jobs/[id]`
- Context and assets: `/api/projects`, `/api/projects/[id]`, `/api/files`, `/api/files/[id]`, `/api/favorites`
- Product support: `/api/notifications`, `/api/settings`, `/api/support`, `/api/prompt-enhance`
- Financial reads/writes: `/api/wallet`, `/api/payments/manual`

Existing response fields remain stable. New fields must be optional until every consumer has migrated. Mutations require authenticated ownership checks; administrative operations remain server-only.

## Financial and generation invariants

- Wallet mutations continue through existing wallet functions and database procedures.
- A media request reserves credits before provider submission.
- Completion captures actual cost; failure or cancellation releases the appropriate hold.
- Provider callbacks remain authenticated and idempotent.
- Client-supplied costs, ownership IDs, and completion states are never trusted.

## Core persisted entities

- User/profile and role records
- Wallets, wallet ledger entries, holds, and payment orders
- Conversations and messages
- Projects and project associations
- Files and storage metadata
- Generation jobs and generated outputs
- Models, provider configuration, feature flags, notifications, and support records
- Asset favorites

Migrations `001` through `009` are the current ordered schema history. Future migrations must be additive, include ownership/RLS treatment, add required foreign-key indexes, and avoid rewriting ledger or settlement history.

## Change checklist

- Document request/response additions and migration dependencies.
- Preserve older callers for at least one release boundary.
- Verify authorization and ownership on every new read/write path.
- Verify hold, capture, release, and refund behavior when costs are involved.
- Confirm indexes with the Supabase advisor after schema changes.
- Do not remove apparently unused indexes before production traffic supports that decision.

