<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Mobile-first transformation

- Continue from `docs/mobile-responsive-audit.md`, `docs/mobile-responsive-plan.md`, and `docs/mobile-responsive-test-matrix.md`; distinguish static risks from reproduced failures.
- Use pinned pnpm 10.34.3. If PATH resolves another major, invoke `npx --yes pnpm@10.34.3` instead of accepting automatic workspace-policy rewrites.
- Phase 3 owns Chat presentation in ChatWorkspace and chat-workspace.css, integrated with the verified Phase 2 shell. Preserve authentication, AI submission, wallet/payment calculations, provider configuration and database schemas. Phase 4 owns Image, Video and Audio presentation; Phase 5 targets remaining workspace/account/data surfaces.
- Run `pnpm audit:routes` and `pnpm audit:css` after route/style changes; keep the route inventory and milestone evidence current.
- Responsive tests use localhost with public pages, the development-only video fixture, and `/responsive-fixture` (requires development + LOCAL_RESPONSIVE_FIXTURES=1 + loopback host + no VERCEL). The synthetic shell uses offline topbar data; it never creates a session. Never bypass authentication or commit sessions/secrets; protected workflows require authorized isolated accounts. Never submit paid generations or purchases for layout tests.
- Review mobile/tablet/desktop, both browser engines, light/dark, short landscape, zoom, focus, reduced motion and actual software keyboards before signing off a responsive change. Clipped document overflow is not proof of usable content.

- Shared shell styling belongs to `src/components/workspace-shell.css`; migrate proven superseded rules instead of adding global overrides. Shared dialogs use `useWorkspaceOverlay`; preserve nested Escape ownership, focus return and scroll restoration.
- Phase 1 evidence stays in `docs/mobile-baseline`. Phase 2 evidence belongs in `docs/mobile-phase2`; snapshots are OS/browser/viewport specific. Never regenerate approved snapshots merely to hide a failure.

- ChatClient retains transport, authorization refresh, uploads, billing and persistence; ChatWorkspace receives real callbacks and owns DOM layout/focus/scroll. Chat fixtures are gated variants of `/responsive-fixture?chat=...`; they never create a session or contact application APIs.
- Preserve the Phase 2 contract hashes in `tests/ui/chat-contract-baseline.json`; changes to submission/settlement/voice/upload/conversation actions require explicit scope review. Do not overwrite them to hide a presentation regression. Phase 3 evidence belongs in `docs/mobile-phase3`.

- Phase 4 evidence belongs in `docs/mobile-phase4`. ImageStudioView, TtsView and AudioGenerationView receive original controller callbacks; Video retains its controller and fixture-only local reference selection. Preserve twenty execution-handler hashes in `tests/ui/studio-contract-baseline.json`; never regenerate them to conceal changes. Studio fixtures use the existing development/loopback/no-Vercel gate and never contact application APIs.

- Phase 5 workspace/discovery presentation belongs to the exported Views and workspace-data.module.css. Continue docs/mobile-phase5/README.md in ordered batches. Preserve original execution hashes in tests/ui/workspace-contract-baseline.json; fixtures mount presentation with synthetic local callbacks, never production controllers or fabricated sessions.

- Phase 5 account, wallet and admin presentation use their component-owned CSS modules. Keep all 56 workspace-contract baselines immutable; new safe fixtures mount Views only. Admin fixtures reuse the existing development/loopback/no-Vercel gate and never prove authorization. Final Phase 5 evidence and Phase 6 release gates are under docs/mobile-phase5/.

- Phase 6 evidence and release gates live in docs/mobile-phase6/. Keep the seven Phase 5 authentication hashes immutable, preserve premium animations for normal motion, and keep offscreen animation cleanup symmetric. Historical snapshots are archived; phase6-* references require explicit image review plus a no-update comparison. Full repository lint is now a CI gate. Never equate fixture/axe success with authenticated or physical-device acceptance.

- Premium mobile navigation follow-up: see docs/mobile-navigation/README.md. Keep the a8d9bf9 Chat restoration and current Generation Center implementation intact; phone chrome (<=600px) belongs to workspace-shell.css. More opens the existing drawer through the UI-only workspace-navigation bridge. Preserve the integration-base source/handler guards and do not overwrite historical screenshots. Delivery is Preview-only until the user approves this follow-up.
