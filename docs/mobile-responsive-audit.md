# Models Suite — Phase 1 responsive architecture audit

## Phase 5 progress — workspace/discovery

[Batch A findings](mobile-phase5/batch-a/findings.md) records seven implemented surfaces and actual 320px overflow/hidden-sort/typography/dialog defects. Production controllers retain 21 independently checked Phase 4 handler bodies; fixtures mount the real views without controllers or application API calls. CSS ownership is workspace-data.module.css, with bounded legacy clipping/font/padding migration. Before/after and 36 reviewed Windows comparison references are retained. Overall Phase 5 remains in progress; account, wallet, admin/public batches and final exact-head Linux acceptance follow. Route counts remain 32 pages / 43 handlers, with 17 stylesheets at Batch A.


## Phase 4 studio implementation update (2026-10-16)

Image, Video and Audio were implemented in separate tested batches. See [Phase 4 handoff](mobile-phase4/README.md) for actual verification and acceptance. The inventory remains 32 source pages and 43 HTTP handlers (including one strictly gated fixture-media handler). No authenticated route or execution contract was added.

| Finding | Resolution and owner |
|---|---|
| P4-I01: intrinsic welcome width hidden by clipping | Image hero children shrink/wrap; two proven Image-specific global clipping declarations were removed and archived. image-studio.css owns page flow, spacing, references and results. |
| P4-I02: result/settings focus | ImageStudioView adds a contained full-image dialog with shared overlay ownership and an accessible inline settings disclosure; existing reference limits/options remain. |
| P4-V01: creation competes with preview | Video module owns compact/tablet creation-first stacking, desktop columns, 16px input, 44px actions and precise portrait/square preview proportions. Native playback/result actions remain. |
| P4-V02: viewer below shared chrome | Viewer portals to body and uses useWorkspaceOverlay. Production still calls the unchanged upload function; fixture reference selection is local. |
| P4-A01: duplicate bottom clearance/cramped modes | Audio module owns shell-integrated flow, three equal tabs, compact decoration, tablet side cards, readable input and contained native playback. Idle decoration pauses. |
| P4-A02: keyboard and WebKit focus | Audio arrow navigation derives the focused tab; PremiumSelect explicitly focuses its pointer trigger, preserving Escape focus return. |

Dependencies: ImageStudio/useImageStudio -> ImageStudioView -> ModelPicker/shared overlay; VideoStudio -> VideoModelRail/PremiumSelect/native media/shared overlay; AudioStudio -> TtsClient/useTtsClient/TtsView or AudioGenerationClient/useAudioGenerationClient/AudioGenerationView -> AudioStage/PremiumSelect. Twenty Phase 3 execution-handler hashes supplement Chat, billing and security regression guards.

Performance review preserves existing Video offscreen/visibility/reduced-motion media policies, metadata loading and native controls; Audio idle artwork pauses. No hardware performance gains are claimed. Global cascade debt remains; no framework or broad rewrite was introduced. Hardware media profiling, real keyboards/IME, safe areas, zoom and assistive technology remain UNVERIFIED; 22 authenticated workflows remain BLOCKED without an authorized isolated account/backend.


## Phase 3 Chat implementation update (2026-10-16)

The live inventory remains **32 source pages / 42 HTTP handlers**, now **16 stylesheets**. Chat presentation is extracted from ChatClient into the production ChatWorkspace component and its scoped stylesheet. No route, authentication, provider, upload API, persistence, pricing or settlement contract was added or changed. Phase 1/2 sections below remain historical evidence. Current acceptance and exact runs are in [Phase 3 handoff](mobile-phase3/README.md).

| Finding / dependency | Evidence and resolution |
|---|---|
| P3-C01: competing viewport owners | Retired `.chat-page` selectors included `100vh - 116px` and `100dvh - 56px` while the repaired shell already owns a 108px compact header and navigation clearance. Chat now fills one shell cell, with a history row and an in-flow composer. Direct VisualViewport height at scale 1 supplies the frame, without a keyboard-height guess. |
| P3-C02: inherited compact toolbar cap | Browser inspection found `.composer-tools` constrained enough to wrap at 320px. The owned rule explicitly clears that max-width; tests assert one compact toolbar row and 44px primary controls. Attachments use a separate named local horizontal scroll region. |
| P3-C03: uncontrolled history follow | A synthetic streaming race initially forced readers back down. The presentation tracks the last followed offset and detects upward reading before a delayed scroll event; draft edits and incoming tokens preserve history position. Latest and explicit submission resume following. |
| P3-C04: composer overlay stacking | Screenshot review exposed a settings backdrop below the shared mobile navigation. Chat controls now portal to body and share focus/scroll/Escape handling. PremiumSelect consumes Escape only when its own list is open. |
| P3-C05: long content and readability | Production Markdown is memoized by content; code and GFM tables have named focusable local scroll regions. Long prose/URLs wrap, mobile avatars yield space, assistant answers use available width, and message actions remain reachable. |
| P3-C06: feedback and discovery | Welcome retains dynamic model data and all starter actions. The ticker pauses on hover/focus and stops for reduced motion. Pending billing, empty/loading/interrupted/error states keep their existing values; changing response status is concise, without live-announcing every timer tick. |
| P3-C07: expanded drafts plus secondary content at short heights | A final combined-state probe found zero history height and an error banner below navigation at 320×390. Below 481px height, the textarea uses one internally scrollable line, attachment cards keep 44px controls with less padding, and the focusable error region scrolls within 48px. Both engines retain 25px history for the error case and 39px for attachments at 320×390; regression assertions require at least 24px and navigation separation. |

`production/computed-styles.json` records the actual computed shell, history, composer, toolbar and textarea properties in both engines at phone, landscape and desktop sizes. The owning declarations are in `chat-workspace.css`; source order alone was not used as visual proof. Eleven selector groups requiring the unused exact `.chat-page` class were removed and archived. Globals still contains **835 media/container conditions and 766 repeated exact selector/condition groups**: this is remaining debt, not a claim that all are defects. Phase 2's synthetic `premium-chat-page` compatibility case is preserved. No global stylesheet rewrite or artificial document clipping was introduced.

Dependencies: ChatClient → ChatWorkspace → ReactMarkdown/remark-gfm, ModelPicker/ModelBrand, PremiumSelect and useWorkspaceOverlay; WorkspaceFrame → workspace-shell.css, shared header/sidebar/mobile navigation. ChatClient still owns request/SSE processing, refresh, uploads, billing polling, recognition and conversation state. Ten Phase 2 function hashes and three shared input-policy tests guard this boundary; fixture adapters do not prove real persistence.

Remaining risks: actual IME/keyboard resizing, device safe areas, pinch/text zoom and assistive technology need hardware verification; real conversation switching, recognition, billing transitions and provider streaming require an authorized isolated backend/session. Long-answer rendering has memoization and restrained motion, but no low-end-device performance certification. Error banners and attachment rows can still reduce history space at extremely small visual viewports; supported emulated reduced heights are covered, physical keyboards are not.

## Phase 2 implementation update (2026-10-16)

Phase 1 evidence below is historical. Current code adds a gated synthetic shell route: **32 source pages, 42 HTTP handlers, 15 stylesheets** (one additional fixture and two owned stylesheets). The 22 real protected workflows remain blocked; fixture coverage is explicitly component coverage.

MR-005 (mobile auth theme visibility) and MR-001 (Video Studio Escape from focused model search) are implemented with regression tests. MR-002 shortcut ownership is exercised using the real topbar and ModelPicker with a document-level fixture listener matching ChatClient's event boundary; the window handler now honors `defaultPrevented`. No chat submission logic changed. This does not verify authenticated ChatClient E2E.

Shared changes: layout-only WorkspaceFrame extraction; scoped workspace-shell.css; responsive topbar/search row through 1180px; five mobile destinations and accessible More sheet; active route semantics/translations; sidebar/account keyboard preservation; select-only combobox semantics/Home/End; shared modal focus, nested Escape and scroll locking. Safari pointer activation explicitly focuses opening controls for reliable return. Chat-specific global selectors remain legacy debt; an explicit topbar class establishes shared ownership and a synthetic chat-style case checks their effect.

Removed the old shared stabilization block and its global html/body horizontal clipping. Content/table scrolling is local. The removed block is preserved under `mobile-phase2/shared-css-before.txt`. Root globals shrink rather than receiving another appended override section. Existing studio CSS and backend behavior remain outside this phase.

See [Phase 2 evidence and acceptance](mobile-phase2/README.md) for final checks, screenshots, CI and remaining limitations. Physical keyboards/zoom and real authenticated populated workspaces still require dedicated validation; screenshot review of synthetic content is not production-workflow sign-off.


Baseline: `main` at `314c76404b98156ea4bdd8bb63899df24e9eb8b4`, 2026-10-16 (Asia/Karachi). No production UI or backend implementation is changed in this phase.

## Discovery and repository preflight

The repository was cloned into an isolated checkout with a clean initial worktree. Default branch is `main`; the dedicated branch is `feat/mobile-first-responsive-overhaul`. GitHub CLI and connector both have repository access; connector metadata reports push/admin permissions. Existing open work: #121 homepage scrolling, #117 video settlement, #106 billing policy effective time. Recent main changes include library decoration containment, compact templates, shared sidebar accessibility and Audio Studio refinement. Do not overwrite or cherry-pick those branches blindly.

31 UI page routes and 42 HTTP handlers were automatically enumerated from `src/app`. **Every page is mapped to source, access classification, ancestor layout, transitive components and styles** in [mobile-route-inventory.md](mobile-route-inventory.md), with machine-readable [JSON](mobile-route-inventory.json). Admin child routes are redirects to query-string tabs. Admin overview additionally exposes overview/billing/payments/models/providers/users/jobs/support/settings states. Audio has speech/music/sfx modes; Video has create/explore and fixture job states; these are states, not extra filesystem routes. Feature flags can substitute unavailable views on audio, battle and media handoffs.

There is no Pages Router. HTTP handlers include account export/delete, generation/preflight, callbacks, internal reconciliation, wallet/payments, support and admin mutations. They are inventoried and intentionally never bulk-called by the browser suite. Auth callbacks/logout are workflows with side effects, not screenshot pages. Manifest/icon routes, generated not-found/global-error fallbacks and the route error boundary are inventoried separately. No source sitemap or robots route was found. The production build manifest confirms 31 source pages and 42 handlers, plus the framework fallbacks and metadata routes.

Node 24.21.0 is available and matches Vercel's configured 24.x; repo requires >=22. Repository manager is pnpm 10.34.3. The PATH initially resolved pnpm 11.25.0 and reported an ignored-build policy mismatch; its generated workspace policy change was reverted before reinstalling with the repository pin. Build/lint/typecheck, billing/security tests and UI source guardrails exist. Browser tooling is new in this phase. See [test matrix](mobile-responsive-test-matrix.md) for executed results.

Vercel read access: team `ayaneijaz45-9394`, project `allmodelhub` (`prj_nWr0hf2JPRDaEuIusnVLgcDTfxTs`). Project read returned production deployment READY and www.modelssuite.com/modelssuite.com domains, with password/SSO/IP protection reported disabled. No environment values were pulled and no deployment, setting or domain was changed. A Git push may trigger the project's normal preview integration; this phase never promotes to production. Authenticated backend testing remains unavailable because no dedicated test credentials or isolated backend have been supplied.

## Shared architecture and evidence

Canonical LF measurements: `globals.css` is 647,413 bytes / 2,420 lines, with 846 media queries, 137 `!important` declarations, 774 repeated exact selector/condition groups, 601 dimension/overflow candidates and 201 small-control declarations. Raw Windows checkout bytes are larger because of mixed CRLF line endings. These are candidate counts, not counts of proven defects.

| Area | Source evidence and finding | Risk / implementation gate |
|---|---|---|
| Global cascade | `src/app/globals.css` contains base styles plus successive page redesigns and stabilization passes. Exact selector/condition repetitions and property declarations are catalogued in [mobile-css-evidence.md](mobile-css-evidence.md) and [JSON](mobile-css-evidence.json). | Repetition is not automatically a conflict. Confirm winning specificity/import order at each width before removing anything. |
| Global overflow | `globals.css:2058` applies `html,body` overflow hidden/clip at <=900 despite the enclosing comment describing authenticated scope. Later page-level clipping also occurs. | Document-overflow PASS can coexist with clipped controls. Inspect offender geometry and focus reachability, not only scrollWidth. P2 architecture concern. |
| Confirmed global selector leak | `globals.css:896` hides the unscoped `.theme-toggle` at <=900. Auth premium styles size its button but do not restore display. Browser computed style on `/auth/login` is `display:none` with a 0×0 box at 390 and 768, versus `display:grid` at 1366. | P2: theme selection disappears from the auth page on phone/tablet. Evidence: `mobile-baseline/auth-theme-control.log`, auth screenshots and interaction assertion. Fix selector ownership during Phase 2; Phase 1 leaves UI unchanged. |
| Shell + nav | AppShell requires a user, wallet and admin profile. AppSidebar switches desktop/mobile at 900/901; bottom navigation, drawer, topbar and page padding each reserve height. `globals.css:2060–2073` adds another safe-area/stack pass. | Duplicate bottom allowances can shrink usable space; real keyboard + 844x390 is a required follow-up. P1 candidate, not authenticated browser proof. |
| Composer | ChatClient scrolls to messages; globals have multiple welcome/message-specific layout and composer overrides, including <=680 at end of file. Image dock has <=700 rules again at 2173. | No visualViewport keyboard handling found in shared TSX inspection. CSS dvh may help but is not physical-device proof. P1 keyboard risk; do not change submission logic. |
| Shortcut ownership | `chat-client.tsx:155` registers Ctrl/Command+K on document to open ModelPicker; `workspace-topbar.tsx:68` registers the same key on window to open the command palette. Both call preventDefault without checking defaultPrevented or stopping propagation. | Static P2 overlay collision: the same bubbling event can open both surfaces. Reproduce with an authorized chat session before changing shortcut ownership. |
| Overlays | ModelPicker portals to body and toggles `modal-open`; mobile drawer toggles `nav-drawer-open`; marketing menu writes body overflow; wallet/video dialogs maintain their own state. | Shared body lock ownership is fragmented. ModelPicker/mobile drawer lack full focus trap/restore in inspected source. Video viewer has a trap/restore; sidebar account menu already handles arrows/Escape/blur. Preserve those working behaviors. P2 accessibility. |
| Dropdowns | PremiumSelect has arrow/Enter/Escape support but no aria-activedescendant association for its active option and no Home/End implementation. Video picker search is auto-focused; Escape handling sits on trigger/list. | Verify focus path and Escape from search. Do not claim all dropdowns inaccessible; record exact failing state. P2. |
| Touch + input | Auth mobile inputs explicitly use 14px, image prompt 13px. Video preview uses 30px controls in compact container rules; several shared sidebar/topbar controls are 30–38px. Library actions use 27px min-height. | Smaller than proposed 44px target; not every such control fails WCAG 2.2's minimum target exception/spacing rules. iOS focus zoom is a risk below 16px. P2 candidate. |
| Video | VideoStudio imports both base and v2 CSS modules with container overrides; v2 appends further compact rules at 176/179. Safe development fixture excludes live model/preflight/polling effects. | Nested viewport/container constraints must be tested at tablet shell widths, not just physical window width. Fixture does not include authenticated shell. |
| Audio | AudioStudio switches between TtsClient and AudioGenerationClient. Container <=760 and viewport <=560 differ; decorative halos/orbits/bars animate. Reduced motion and pause controls already exist. | Validate all three modes with authorized safe data; profile animation costs under normal motion. No performance claim from screenshots. |
| Forms/data/payments | SimpleForms supplies projects/settings/support. WalletClient implements multi-step top-up and proof upload. FilesClient includes uploads/storage. AdminClient aggregates multiple operations. | Preserve server contracts and amount logic. Test long names/errors, wizard scroll, file preview and table-local overflow only in isolated fixtures/accounts. |
| Tokens/branding | Root light/dark variables exist; studios add scoped color tokens; many late selectors use highly specific page/shell ancestors and !important. | Reuse semantic brand tokens and incremental ownership migration; avoid wholesale reset or token replacement. |
| Rendering | Homepage story controller, layered gradients/blur, marquee/model rails, library card entrances and media previews create work on constrained devices. | Reduced-motion coverage is not a performance profile. Homepage performance PR #121 overlaps. Measure long tasks, scroll frames and media downloads before changing effects. |

All 13 stylesheets are parsed by PostCSS, with condition-aware exact repetitions, large dimension/overflow candidates and small-control declarations. Generated evidence preserves original line numbers; compressed lines can contain many rules. Evidence represents the inspected commit and must be regenerated after future UI changes.

## Findings versus verification

Source-audited routes include public marketing/legal/auth, workspace/studios, wallet/usage, settings/support and admin. Authenticated UI state findings are static risks until an authorized session or existing safe fixture reproduces them. Public and Video fixture browser observations, screenshot evidence and actual check results are maintained in the test matrix. No backend schema, financial/provider configuration, auth policy or production secret is altered.

## Continuation

Use [mobile-responsive-plan.md](mobile-responsive-plan.md) for ownership, safe sequencing and acceptance gates. Review browser failures and screenshots before implementing Phase 2. Refresh inventory after new routes, rerun CSS analysis after stylesheet edits, and keep failure attribution tied to the baseline SHA.


Phase 5 Batch B: settings/support/usage presentation implemented; see `mobile-phase5/batch-b/README.md` and per-route acceptance. Original account handlers, usage query/aggregation prefix and financial formatting are guarded against the Phase 4 source. Named table regions own horizontal scrolling; the shell retains navigation clearance. Safe local fixtures are separate from the 22 BLOCKED authenticated workflows. Final exact-head Phase 5 CI is still required.
