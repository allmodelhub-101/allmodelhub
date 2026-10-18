# Targeted Chat visual restoration

Visual reference: `314c76404b98156ea4bdd8bb63899df24e9eb8b4`, the main commit immediately before the responsive-overhaul merge `92ac113`.

Change base: `bf52cccd0eb108877112e6487d1ca198238770b3`.

## Scope

The only application file changed is `src/components/chat-workspace.css`. The restoration is scoped to `.responsive-workspace .chat-workspace` and its descendants. It restores the pre-overhaul desktop hero typography, gradient emphasis/caret, full-width discovery rail, pastel creation cards, diagonal background, centered 640px welcome composer, compact conversation composer and assistant card treatment.

`ChatWorkspace`, `ChatClient`, their callbacks, model selection logic, routing, auth, API routes, wallet, billing, shared globals, workspace frame, sidebar, topbar and mobile navigation source are unchanged. Current bounded drafts, short-height history clearance, 44px primary controls, focus/overlay ownership and local rich-content scrolling remain. Small screens retain the current shell/composer layout and bottom-navigation clearance; they receive the restored card palette and headline emphasis without desktop sizing.

## Visual evidence

These screenshots mount the real production React `ChatWorkspace`, `WorkspaceFrame`, sidebar and topbar with the existing offline Chat fixture. They are not authenticated production sessions. Sample model names, balance and responses are synthetic. No application API, provider, paid generation or wallet request is sent.

Before captures use the exact `bf52ccc` Chat stylesheet. After captures use the restored stylesheet with identical components and synthetic data. Normal motion remains enabled in the app; evidence captures use reduced motion for stable comparison.

- [Before, light](before-welcome-1366-light.png) / [After, light](after-welcome-1366-light.png)
- [Before, dark](before-welcome-1366-dark.png) / [After, dark](after-welcome-1366-dark.png)
- [Conversation before](before-conversation-1366-light.png) / [Conversation after](after-conversation-1366-light.png)

The desktop composition follows the historical reference while retaining larger primary hit targets and current short-height handling. This is a scoped presentation restoration, not an old application/backend checkout.

## Checks

- Next production webpack build and TypeScript pass.
- All 296 existing billing/security/UI tests pass, including unchanged Chat execution-handler hashes; two new stylesheet scope/reference tests pass.
- Existing production-React Chat checker: 30 scenarios pass, covering phone, short landscape and laptop in Chromium and WebKit, local Send/Stop, attachments and long Markdown.
- Before/after layout verification checks welcome, conversation, attachments and errors in both themes, seven viewport sizes and both engines. It compares every computed style and geometry in the topbar/sidebar/mobile navigation, checks overflow and Send/navigation clearance, and exercises local Send, Retry, model picker and controls. Translucent chrome can blend with the restored content beneath it; no chrome styles or geometry are changed.
- CSS/route audits run; route inventory stays at 32 pages and 43 handlers.

Production `/chat` authentication is not bypassed for screenshots. Real provider submission, account persistence, billing settlement, physical-device software keyboards and assistive technology are outside this presentation-only verification.

## Release boundary

Preview branch only: `fix/restore-classic-chat-presentation`. Do not merge or promote to production without a separate user request.
