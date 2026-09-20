# All Model Hub — Project State

## Current phase

Final frontend redesign and polishing of the authenticated/internal All Model Hub application.

The public homepage is already acceptable and is not part of the current redesign unless explicitly requested.

## Current objective

Redesign internal pages one by one using:

- the current/old page screenshot;
- the new target-design screenshot;
- any additional page-specific instructions.

The new screenshot is the intended visual target, not merely inspiration.

Existing working functionality must remain intact while the frontend is redesigned.

## Current working method

For each page:

1. Search for the affected page/component first.
2. Inspect only the page, directly related components, and 1–2 relevant shared patterns when useful.
3. Preserve existing functional logic and interactions.
4. Reconnect existing logic to the redesigned UI rather than rebuilding working backend systems.
5. Match the supplied target design as closely as practical.
6. Make the result responsive across mobile, tablet, laptop, desktop, and larger screens.
7. Preserve important loading, selected, disabled, empty, error, hover/focus, long-content, and real-data states.
8. Run targeted validation.
9. Visually verify meaningful redesigns when browser tooling is available.
10. Review the final git diff.
11. Stop when the requested page/task is complete.

## Current priorities

1. Accurate match to the supplied target design.
2. Preserve existing functionality.
3. Excellent responsiveness.
4. Premium, modern, clean, professional UX.
5. No regressions.
6. Reuse existing architecture and shared patterns.
7. Avoid unnecessary code and unrelated changes.

## Current technical decisions to preserve

- The current repository is the source of truth.
- Reuse existing components, utilities, architecture, and conventions.
- Do not perform repository-wide audits for normal page redesigns.
- Avoid unrelated refactors, dependency upgrades, or new libraries.
- Do not modify the public homepage unless explicitly requested.
- Do not modify wallet/payment/credit, auth/security, Supabase RLS, provider integrations, or database architecture during unrelated frontend work.
- Use repository/local code first.
- Use Supabase only when a task actually requires database/auth/storage/RLS/RPC/backend information.
- Use Vercel only for deployment/runtime/environment/log issues.
- Use GitHub-specific access only when remote history, branches, PRs, issues, or other remote state is relevant.
- Respect the existing AGENTS.md and current Next.js guidance.

## Active task

Project continuity has been initialized for the new Codex chat.

Next task:  
Receive the first internal-page current screenshot, new target screenshot, and page-specific instructions, then implement that page redesign.

## Confirmed active issues

None currently recorded.

## Recently completed

- Existing All Model Hub repository was connected in the new Codex workspace.
- Existing AGENTS.md was found and read.
- No application/UI changes have been made yet.

Keep this file concise. It should represent current state, not become a long changelog.
