# Generated route and dependency inventory

Run `pnpm audit:routes` from the repository root. Counts are source routes, not authenticated browser passes. Root layout globals apply to every page.

32 page routes; 42 HTTP handlers; 14 CSS files. No Pages Router exists.

| Route | Access | Source / redirect | Components (transitive) | Styles (transitive) |
|---|---|---|---|---|
| /acceptable-use | public | src/app/acceptable-use/page.tsx | brand.tsx, legal-page.module.css, legal-page.tsx, pwa-register.tsx, theme-toggle.tsx | src/app/globals.css, src/components/legal-page.module.css |
| /admin/models | admin | src/app/admin/models/page.tsx → /admin?tab=models | pwa-register.tsx | src/app/admin/admin-premium.css, src/app/globals.css |
| /admin | admin | src/app/admin/page.tsx | admin-client.tsx, admin-workspace.tsx, premium-select.tsx, pwa-register.tsx | src/app/admin/admin-premium.css, src/app/globals.css |
| /admin/payments | admin | src/app/admin/payments/page.tsx → /admin?tab=payments | pwa-register.tsx | src/app/admin/admin-premium.css, src/app/globals.css |
| /admin/profits | admin | src/app/admin/profits/page.tsx → /admin?tab=jobs | pwa-register.tsx | src/app/admin/admin-premium.css, src/app/globals.css |
| /admin/settings | admin | src/app/admin/settings/page.tsx → /admin?tab=settings | pwa-register.tsx | src/app/admin/admin-premium.css, src/app/globals.css |
| /admin/users | admin | src/app/admin/users/page.tsx → /admin?tab=users | pwa-register.tsx | src/app/admin/admin-premium.css, src/app/globals.css |
| /audio | authenticated | src/app/audio/page.tsx | app-shell.tsx, app-sidebar.css, app-sidebar.tsx, audio-generation-client.tsx, audio-stage.tsx, audio-studio.module.css, audio-studio.tsx, feature-unavailable.tsx, premium-select.tsx, pwa-register.tsx, theme-toggle.tsx, tts-client.tsx, use-workspace-overlay.ts, workspace-frame.tsx, workspace-network-status.tsx, workspace-onboarding.tsx, workspace-shell.css, workspace-topbar.tsx | src/app/globals.css, src/components/app-sidebar.css, src/components/audio-studio.module.css, src/components/workspace-shell.css |
| /auth/login | public | src/app/auth/login/page.tsx | auth-page.tsx, login-form.tsx, pwa-register.tsx, theme-toggle.tsx | src/app/auth/login/auth-premium.css, src/app/globals.css |
| /auth/signup | public | src/app/auth/signup/page.tsx | auth-page.tsx, login-form.tsx, pwa-register.tsx, theme-toggle.tsx | src/app/auth/login/auth-premium.css, src/app/globals.css |
| /auth/update-password | recovery form; session needed to submit | src/app/auth/update-password/page.tsx | pwa-register.tsx, theme-toggle.tsx, update-password-form.tsx | src/app/auth/login/auth-premium.css, src/app/globals.css |
| /auth/verified | confirmation session | src/app/auth/verified/page.tsx | email-verified-card.tsx, pwa-register.tsx | src/app/auth/login/auth-premium.css, src/app/globals.css |
| /battle | authenticated | src/app/battle/page.tsx | app-shell.tsx, app-sidebar.css, app-sidebar.tsx, feature-unavailable.tsx, model-battle.tsx, model-brand.tsx, pwa-register.tsx, theme-toggle.tsx, use-workspace-overlay.ts, workspace-frame.tsx, workspace-network-status.tsx, workspace-onboarding.tsx, workspace-shell.css, workspace-topbar.tsx | src/app/globals.css, src/components/app-sidebar.css, src/components/workspace-shell.css |
| /chat | authenticated | src/app/chat/page.tsx | app-shell.tsx, app-sidebar.css, app-sidebar.tsx, chat-client.tsx, model-brand.tsx, model-picker.tsx, premium-select.tsx, pwa-register.tsx, theme-toggle.tsx, use-workspace-overlay.ts, workspace-frame.tsx, workspace-network-status.tsx, workspace-onboarding.tsx, workspace-shell.css, workspace-topbar.tsx | src/app/globals.css, src/components/app-sidebar.css, src/components/workspace-shell.css |
| /files | authenticated | src/app/files/page.tsx | app-shell.tsx, app-sidebar.css, app-sidebar.tsx, files-client.tsx, premium-select.tsx, pwa-register.tsx, theme-toggle.tsx, use-workspace-overlay.ts, workspace-frame.tsx, workspace-network-status.tsx, workspace-onboarding.tsx, workspace-shell.css, workspace-topbar.tsx | src/app/files/files.css, src/app/globals.css, src/components/app-sidebar.css, src/components/workspace-shell.css |
| /history | authenticated | src/app/history/page.tsx | app-shell.tsx, app-sidebar.css, app-sidebar.tsx, history-client.tsx, pwa-register.tsx, theme-toggle.tsx, use-workspace-overlay.ts, workspace-frame.tsx, workspace-network-status.tsx, workspace-onboarding.tsx, workspace-shell.css, workspace-topbar.tsx | src/app/globals.css, src/components/app-sidebar.css, src/components/workspace-shell.css |
| /images | authenticated | src/app/images/page.tsx | app-shell.tsx, app-sidebar.css, app-sidebar.tsx, image-studio.css, image-studio.tsx, model-brand.tsx, model-picker.tsx, pwa-register.tsx, theme-toggle.tsx, use-workspace-overlay.ts, workspace-frame.tsx, workspace-network-status.tsx, workspace-onboarding.tsx, workspace-shell.css, workspace-topbar.tsx | src/app/globals.css, src/components/app-sidebar.css, src/components/image-studio.css, src/components/workspace-shell.css |
| /models | authenticated | src/app/models/page.tsx | app-shell.tsx, app-sidebar.css, app-sidebar.tsx, model-brand.tsx, models-marketplace.tsx, pwa-register.tsx, theme-toggle.tsx, use-workspace-overlay.ts, workspace-frame.tsx, workspace-network-status.tsx, workspace-onboarding.tsx, workspace-shell.css, workspace-topbar.tsx | src/app/globals.css, src/components/app-sidebar.css, src/components/workspace-shell.css |
| /notifications | authenticated | src/app/notifications/page.tsx | app-shell.tsx, app-sidebar.css, app-sidebar.tsx, pwa-register.tsx, theme-toggle.tsx, use-workspace-overlay.ts, workspace-clients.tsx, workspace-frame.tsx, workspace-network-status.tsx, workspace-onboarding.tsx, workspace-shell.css, workspace-topbar.tsx | src/app/globals.css, src/components/app-sidebar.css, src/components/workspace-shell.css |
| / | public | src/app/page.tsx | brand.tsx, cinematic-home.tsx, cinematic-story-controller.tsx, marketing-nav.module.css, marketing-nav.tsx, pwa-register.tsx, theme-toggle.tsx | src/app/globals.css, src/components/marketing-nav.module.css |
| /privacy | public | src/app/privacy/page.tsx | brand.tsx, legal-page.module.css, legal-page.tsx, pwa-register.tsx, theme-toggle.tsx | src/app/globals.css, src/components/legal-page.module.css |
| /projects | authenticated | src/app/projects/page.tsx | app-shell.tsx, app-sidebar.css, app-sidebar.tsx, premium-select.tsx, pwa-register.tsx, simple-forms.tsx, theme-toggle.tsx, use-workspace-overlay.ts, workspace-frame.tsx, workspace-network-status.tsx, workspace-onboarding.tsx, workspace-shell.css, workspace-topbar.tsx | src/app/globals.css, src/components/app-sidebar.css, src/components/workspace-shell.css |
| /refunds | public | src/app/refunds/page.tsx | brand.tsx, legal-page.module.css, legal-page.tsx, pwa-register.tsx, theme-toggle.tsx | src/app/globals.css, src/components/legal-page.module.css |
| /responsive-fixture | development fixture | src/app/responsive-fixture/page.tsx | app-sidebar.css, app-sidebar.tsx, model-brand.tsx, model-picker.tsx, premium-select.tsx, pwa-register.tsx, responsive-fixture.tsx, theme-toggle.tsx, use-workspace-overlay.ts, workspace-frame.tsx, workspace-shell.css, workspace-topbar.tsx | src/app/globals.css, src/components/app-sidebar.css, src/components/workspace-shell.css |
| /settings | authenticated | src/app/settings/page.tsx | app-shell.tsx, app-sidebar.css, app-sidebar.tsx, premium-select.tsx, pwa-register.tsx, simple-forms.tsx, theme-toggle.tsx, use-workspace-overlay.ts, workspace-frame.tsx, workspace-network-status.tsx, workspace-onboarding.tsx, workspace-shell.css, workspace-topbar.tsx | src/app/globals.css, src/components/app-sidebar.css, src/components/workspace-shell.css |
| /studio-fixture | development fixture | src/app/studio-fixture/page.tsx | premium-select.tsx, pwa-register.tsx, video-model-rail.tsx, video-studio-v2.module.css, video-studio.tsx | src/app/globals.css, src/components/video-studio-v2.module.css |
| /support | authenticated | src/app/support/page.tsx | app-shell.tsx, app-sidebar.css, app-sidebar.tsx, premium-select.tsx, pwa-register.tsx, simple-forms.tsx, theme-toggle.tsx, use-workspace-overlay.ts, workspace-frame.tsx, workspace-network-status.tsx, workspace-onboarding.tsx, workspace-shell.css, workspace-topbar.tsx | src/app/globals.css, src/components/app-sidebar.css, src/components/workspace-shell.css |
| /templates | authenticated | src/app/templates/page.tsx | app-shell.tsx, app-sidebar.css, app-sidebar.tsx, pwa-register.tsx, template-library.css, template-library.tsx, theme-toggle.tsx, use-workspace-overlay.ts, workspace-frame.tsx, workspace-network-status.tsx, workspace-onboarding.tsx, workspace-shell.css, workspace-topbar.tsx | src/app/globals.css, src/components/app-sidebar.css, src/components/template-library.css, src/components/workspace-shell.css |
| /terms | public | src/app/terms/page.tsx | brand.tsx, legal-page.module.css, legal-page.tsx, pwa-register.tsx, theme-toggle.tsx | src/app/globals.css, src/components/legal-page.module.css |
| /usage | authenticated | src/app/usage/page.tsx | app-shell.tsx, app-sidebar.css, app-sidebar.tsx, pwa-register.tsx, theme-toggle.tsx, usage-icon.tsx, use-workspace-overlay.ts, workspace-frame.tsx, workspace-network-status.tsx, workspace-onboarding.tsx, workspace-shell.css, workspace-topbar.tsx | src/app/globals.css, src/components/app-sidebar.css, src/components/workspace-shell.css |
| /video | authenticated | src/app/video/page.tsx | app-shell.tsx, app-sidebar.css, app-sidebar.tsx, feature-unavailable.tsx, premium-select.tsx, pwa-register.tsx, theme-toggle.tsx, use-workspace-overlay.ts, video-model-rail.tsx, video-studio-v2.module.css, video-studio.tsx, workspace-frame.tsx, workspace-network-status.tsx, workspace-onboarding.tsx, workspace-shell.css, workspace-topbar.tsx | src/app/globals.css, src/components/app-sidebar.css, src/components/video-studio-v2.module.css, src/components/workspace-shell.css |
| /wallet | authenticated | src/app/wallet/page.tsx | app-shell.tsx, app-sidebar.css, app-sidebar.tsx, pwa-register.tsx, theme-toggle.tsx, use-workspace-overlay.ts, wallet-client.tsx, workspace-frame.tsx, workspace-network-status.tsx, workspace-onboarding.tsx, workspace-shell.css, workspace-topbar.tsx | src/app/globals.css, src/app/wallet/wallet-premium.css, src/components/app-sidebar.css, src/components/workspace-shell.css |

## HTTP handlers — inventoried only; never bulk invoked

| Route | Methods | Source |
|---|---|---|
| /api/account/delete | POST | src/app/api/account/delete/route.ts |
| /api/account/export | GET | src/app/api/account/export/route.ts |
| /api/admin/jobs/[id]/reconcile | POST | src/app/api/admin/jobs/[id]/reconcile/route.ts |
| /api/admin/models/[id] | GET, PATCH | src/app/api/admin/models/[id]/route.ts |
| /api/admin/payments/[id]/approve | POST | src/app/api/admin/payments/[id]/approve/route.ts |
| /api/admin/payments/[id]/reject | POST | src/app/api/admin/payments/[id]/reject/route.ts |
| /api/admin/providers | GET, POST | src/app/api/admin/providers/route.ts |
| /api/admin/settings | GET, PATCH | src/app/api/admin/settings/route.ts |
| /api/admin/support/[id]/reply | POST | src/app/api/admin/support/[id]/reply/route.ts |
| /api/admin/users/[id]/credit | POST | src/app/api/admin/users/[id]/credit/route.ts |
| /api/auth/login | POST | src/app/api/auth/login/route.ts |
| /api/auth/provision | POST | src/app/api/auth/provision/route.ts |
| /api/billing/settle-pending | POST | src/app/api/billing/settle-pending/route.ts |
| /api/chat | POST | src/app/api/chat/route.ts |
| /api/conversations/[id] | PATCH, DELETE | src/app/api/conversations/[id]/route.ts |
| /api/conversations | GET | src/app/api/conversations/route.ts |
| /api/favorites | GET, POST, DELETE | src/app/api/favorites/route.ts |
| /api/files/[id] | GET, DELETE | src/app/api/files/[id]/route.ts |
| /api/files/media | POST | src/app/api/files/media/route.ts |
| /api/files | GET, POST | src/app/api/files/route.ts |
| /api/generations/[modality] | POST | src/app/api/generations/[modality]/route.ts |
| /api/generations/preflight | POST | src/app/api/generations/preflight/route.ts |
| /api/internal/billing/reconcile | GET | src/app/api/internal/billing/reconcile/route.ts |
| /api/jobs/[id] | GET | src/app/api/jobs/[id]/route.ts |
| /api/jobs | GET | src/app/api/jobs/route.ts |
| /api/models | GET | src/app/api/models/route.ts |
| /api/notifications | GET, PATCH | src/app/api/notifications/route.ts |
| /api/payments/manual | GET, POST | src/app/api/payments/manual/route.ts |
| /api/projects/[id] | PATCH, DELETE | src/app/api/projects/[id]/route.ts |
| /api/projects | GET, POST | src/app/api/projects/route.ts |
| /api/prompt-enhance | POST | src/app/api/prompt-enhance/route.ts |
| /api/provider-assets/[token] | GET | src/app/api/provider-assets/[token]/route.ts |
| /api/provider-callback/apimodels/[secret] | POST | src/app/api/provider-callback/apimodels/[secret]/route.ts |
| /api/search | GET | src/app/api/search/route.ts |
| /api/settings | GET, PATCH | src/app/api/settings/route.ts |
| /api/support/[id] | GET, POST | src/app/api/support/[id]/route.ts |
| /api/support | GET, POST | src/app/api/support/route.ts |
| /api/tts | POST | src/app/api/tts/route.ts |
| /api/wallet | GET | src/app/api/wallet/route.ts |
| /auth/callback | GET | src/app/auth/callback/route.ts |
| /auth/confirm | GET | src/app/auth/confirm/route.ts |
| /auth/logout | POST | src/app/auth/logout/route.ts |

## Stylesheet measurements

| File | Bytes | Lines | Media queries | Important declarations | Viewport units |
|---|---:|---:|---:|---:|---:|
| src/app/admin/admin-premium.css | 8806 | 7 | 5 | 0 | 0 |
| src/app/auth/login/auth-premium.css | 23541 | 422 | 5 | 0 | 2 |
| src/app/files/files.css | 16170 | 10 | 6 | 4 | 0 |
| src/app/globals.css | 644682 | 2390 | 844 | 137 | 78 |
| src/app/wallet/wallet-premium.css | 88 | 2 | 0 | 0 | 0 |
| src/components/app-sidebar.css | 4316 | 37 | 3 | 1 | 1 |
| src/components/audio-studio.module.css | 32447 | 63 | 8 | 4 | 0 |
| src/components/image-studio.css | 29959 | 199 | 5 | 10 | 1 |
| src/components/legal-page.module.css | 22395 | 37 | 9 | 5 | 1 |
| src/components/marketing-nav.module.css | 1906 | 28 | 3 | 0 | 1 |
| src/components/template-library.css | 8901 | 66 | 2 | 2 | 0 |
| src/components/video-studio-v2.module.css | 47881 | 180 | 3 | 12 | 7 |
| src/components/video-studio.module.css | 23171 | 97 | 10 | 70 | 1 |
| src/components/workspace-shell.css | 5453 | 61 | 4 | 0 | 4 |

## Auxiliary routes and states

| URL/state | Source | Kind |
|---|---|---|
| /manifest.webmanifest | src/app/manifest.ts | metadata |
| /icon.png | src/app/icon.png | metadata asset |
| /_not-found | Next.js generated default | framework fallback |
| /_global-error | Next.js generated default | framework error fallback |
| (route error boundary) | src/app/error.tsx | error UI; no independent URL |

The dependency graph resolves static local imports, includes ancestor layouts, and intentionally over-approximates shared files with multiple exports. Runtime data states, feature flags and query-string tabs need separate coverage. Inspect dynamic imports and future route conventions before extending this scanner.
