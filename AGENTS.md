<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Mobile-first transformation

- Continue from `docs/mobile-responsive-audit.md`, `docs/mobile-responsive-plan.md`, and `docs/mobile-responsive-test-matrix.md`; distinguish static risks from reproduced failures.
- Use pinned pnpm 10.34.3. If PATH resolves another major, invoke `npx --yes pnpm@10.34.3` instead of accepting automatic workspace-policy rewrites.
- Phase 2 owns the shared shell/navigation/overlays and confirmed MR-001/MR-005 fixes. Preserve authentication, AI submission, wallet/payment calculations, provider configuration and database schemas. Individual studio redesigns belong to later phases.
- Run `pnpm audit:routes` and `pnpm audit:css` after route/style changes; keep the route inventory and milestone evidence current.
- Responsive tests use localhost with public pages, the development-only video fixture, and `/responsive-fixture` (requires development + LOCAL_RESPONSIVE_FIXTURES=1 + loopback host + no VERCEL). The synthetic shell uses offline topbar data; it never creates a session. Never bypass authentication or commit sessions/secrets; protected workflows require authorized isolated accounts. Never submit paid generations or purchases for layout tests.
- Review mobile/tablet/desktop, both browser engines, light/dark, short landscape, zoom, focus, reduced motion and actual software keyboards before signing off a responsive change. Clipped document overflow is not proof of usable content.

- Shared shell styling belongs to `src/components/workspace-shell.css`; migrate proven superseded rules instead of adding global overrides. Shared dialogs use `useWorkspaceOverlay`; preserve nested Escape ownership, focus return and scroll restoration.
- Phase 1 evidence stays in `docs/mobile-baseline`. Phase 2 evidence belongs in `docs/mobile-phase2`; snapshots are OS/browser/viewport specific. Never regenerate approved snapshots merely to hide a failure.
