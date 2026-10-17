# Generated CSS cascade evidence

Run `pnpm audit:css`. PostCSS parses every stylesheet. Repetition and dimensions are review candidates, not proven browser defects. Conditions and line numbers preserve context; later specificity and import order still require computed-style verification.

## src/app/admin/admin-premium.css

6 media/container conditions; 2 repeated exact selector + condition groups; 8 dimension/overflow candidates; 6 small-control declarations.

| Repeated selector | Condition | Lines |
|---|---|---|
| .admin-header | base | 1, 9 |
| .admin-header small | base | 1, 9 |

Full candidates and declarations are in `mobile-css-evidence.json`; this table shows at most 30 groups per stylesheet.

## src/app/auth/login/auth-premium.css

6 media/container conditions; 0 repeated exact selector + condition groups; 15 dimension/overflow candidates; 8 small-control declarations.

| Repeated selector | Condition | Lines |
|---|---|---|

Full candidates and declarations are in `mobile-css-evidence.json`; this table shows at most 30 groups per stylesheet.

## src/app/files/files.css

6 media/container conditions; 0 repeated exact selector + condition groups; 18 dimension/overflow candidates; 2 small-control declarations.

| Repeated selector | Condition | Lines |
|---|---|---|

Full candidates and declarations are in `mobile-css-evidence.json`; this table shows at most 30 groups per stylesheet.

## src/app/globals.css

835 media/container conditions; 768 repeated exact selector + condition groups; 585 dimension/overflow candidates; 201 small-control declarations.

| Repeated selector | Condition | Lines |
|---|---|---|
| .hero-orbit | base | 105, 1904 |
| .model-pill | base | 128, 439 |
| .app-shell | base | 161, 408, 821 |
| .app-sidebar:where(:not(.premium-workstation-shell,.premium-workstation-shell *)) | base | 162, 409, 875, 879 |
| .app-sidebar | @media (max-width:900px) | 162, 409, 429, 429, 823, 875, 879 |
| html[data-theme="light"] .app-sidebar:where(:not(.premium-workstation-shell,.premium-workstation-shell *)) | base | 163, 410 |
| html[data-theme="light"] .app-sidebar | @media (max-width:900px) | 163, 410 |
| .sidebar-brand:where(:not(.premium-workstation-shell,.premium-workstation-shell *)) | base | 164, 412, 879 |
| .sidebar-brand | @media (max-width:900px) | 164, 412, 879 |
| .sidebar-section:where(:not(.premium-workstation-shell,.premium-workstation-shell *)) | base | 165, 422, 879 |
| .sidebar-section | @media (max-width:900px) | 165, 422, 879 |
| .sidebar-nav:where(:not(.premium-workstation-shell,.premium-workstation-shell *)) | base | 166, 422, 879 |
| .sidebar-nav | @media (max-width:900px) | 166, 422, 879 |
| .sidebar-link:where(:not(.premium-workstation-shell,.premium-workstation-shell *)) | base | 167, 423 |
| .sidebar-link | @media (max-width:900px) | 167, 869 |
| .sidebar-link:hover:where(:not(.premium-workstation-shell,.premium-workstation-shell *)) | base | 168, 424, 869 |
| .sidebar-link:hover | @media (max-width:900px) | 168, 869 |
| .sidebar-bottom | @media (max-width:900px) | 169, 426, 879 |
| .app-main | base | 170, 821, 875 |
| .app-topbar | base | 171, 821, 883, 889, 1354, 1511 |
| .app-content | base | 173, 821, 1893 |
| .wallet-chip | base | 176, 889 |
| .chat-toolbar | base | 178, 845, 875 |
| .chat-messages | @media (max-width:900px) | 197, 846, 852, 875, 876 |
| .chat-messages:where(:not(.premium-chat-page.is-welcome,.premium-chat-page.is-welcome *)) | @media (min-width:901px) | 197, 846, 875 |
| .chat-row | base | 198, 847 |
| .chat-content | base | 200, 847 |
| .chat-meta | base | 201, 847 |
| .chat-empty | base | 204, 846, 875 |
| .premium-empty | base | 216, 846 |

Full candidates and declarations are in `mobile-css-evidence.json`; this table shows at most 30 groups per stylesheet.

## src/app/wallet/wallet-premium.css

0 media/container conditions; 0 repeated exact selector + condition groups; 0 dimension/overflow candidates; 0 small-control declarations.

| Repeated selector | Condition | Lines |
|---|---|---|

Full candidates and declarations are in `mobile-css-evidence.json`; this table shows at most 30 groups per stylesheet.

## src/components/account-workspace.module.css

2 media/container conditions; 0 repeated exact selector + condition groups; 1 dimension/overflow candidates; 0 small-control declarations.

| Repeated selector | Condition | Lines |
|---|---|---|

Full candidates and declarations are in `mobile-css-evidence.json`; this table shows at most 30 groups per stylesheet.

## src/components/admin-workspace.module.css

2 media/container conditions; 0 repeated exact selector + condition groups; 2 dimension/overflow candidates; 0 small-control declarations.

| Repeated selector | Condition | Lines |
|---|---|---|

Full candidates and declarations are in `mobile-css-evidence.json`; this table shows at most 30 groups per stylesheet.

## src/components/app-sidebar.css

3 media/container conditions; 0 repeated exact selector + condition groups; 1 dimension/overflow candidates; 0 small-control declarations.

| Repeated selector | Condition | Lines |
|---|---|---|

Full candidates and declarations are in `mobile-css-evidence.json`; this table shows at most 30 groups per stylesheet.

## src/components/audio-studio.module.css

11 media/container conditions; 87 repeated exact selector + condition groups; 44 dimension/overflow candidates; 7 small-control declarations.

| Repeated selector | Condition | Lines |
|---|---|---|
| .page | base | 1, 7, 24 |
| .hero | base | 2, 8, 25 |
| .heroCopy | base | 2, 26 |
| .kicker | base | 2, 8 |
| .hero h1 | base | 2, 8, 26 |
| .hero p | base | 2, 8, 26 |
| .heroWave | base | 2, 8 |
| .modeTabs | base | 3, 9, 29 |
| .modeTabs button | base | 3, 9, 30 |
| .modeTabs .active | base | 3, 9, 30 |
| .content | base | 4, 10, 31 |
| .workspace | base | 4, 10, 31 |
| .controls,.preview,.quick,.inspiration | base | 4, 10, 32 |
| .controls | base | 4, 10, 33 |
| .cardHead | base | 4, 33 |
| .headIcon | base | 4, 33 |
| .field | base | 4, 34 |
| .field textarea | base | 4, 10, 34 |
| .field textarea:focus | base | 4, 34 |
| .field textarea::placeholder | base | 4, 34 |
| .select :global(.premium-select-trigger) | base | 4, 10, 35 |
| .select :global(.premium-select-menu) | base | 4, 35 |
| .advancedToggle>button | base | 4, 36 |
| .advancedToggle>div | base | 4, 36 |
| .starterGroup button | base | 4, 36 |
| .costRow | base | 4, 37 |
| .costIcon | base | 4, 37 |
| .costRow small | base | 4, 37 |
| .costRow b | base | 4, 37 |
| .confirm | base | 4, 37 |

Full candidates and declarations are in `mobile-css-evidence.json`; this table shows at most 30 groups per stylesheet.

## src/components/chat-workspace.css

4 media/container conditions; 0 repeated exact selector + condition groups; 6 dimension/overflow candidates; 1 small-control declarations.

| Repeated selector | Condition | Lines |
|---|---|---|

Full candidates and declarations are in `mobile-css-evidence.json`; this table shows at most 30 groups per stylesheet.

## src/components/image-studio.css

6 media/container conditions; 4 repeated exact selector + condition groups; 15 dimension/overflow candidates; 9 small-control declarations.

| Repeated selector | Condition | Lines |
|---|---|---|
| body .image-workspace.image-studio-refined .image-prompt-dock form:focus-within | base | 167, 227 |
| body .image-workspace.image-studio-refined .image-prompt-dock textarea | base | 169, 228 |
| body .image-workspace.image-studio-refined .image-prompt-dock textarea:focus | base | 170, 229 |
| body .image-workspace.image-studio-refined .compose-tool .model-brand | base | 175, 231 |

Full candidates and declarations are in `mobile-css-evidence.json`; this table shows at most 30 groups per stylesheet.

## src/components/legal-page.module.css

10 media/container conditions; 27 repeated exact selector + condition groups; 23 dimension/overflow candidates; 4 small-control declarations.

| Repeated selector | Condition | Lines |
|---|---|---|
| .headerInner | base | 4, 28 |
| .headerActions :global(.theme-toggle),.loginLink,.startLink | base | 7, 39 |
| .heroGlow | base | 8, 28 |
| .heroCopy | base | 8, 28 |
| .hero h1 | base | 8, 28 |
| .heroVisual | base | 9, 28 |
| .policySwitcher | base | 10, 28 |
| .policySwitcher a | base | 10, 28 |
| .contents a | base | 12, 41 |
| .glance | base | 13, 28 |
| .highlight | base | 13, 28 |
| .policySection | base | 14, 28 |
| .sectionIcon | base | 14, 28 |
| .supportCard | base | 15, 28 |
| .footer | base | 16, 28 |
| .hero | @media (max-width:760px) | 19, 22 |
| .hero h1 | @media (max-width:760px) | 19, 22 |
| .description | @media (max-width:760px) | 19, 42 |
| .policySwitcher | @media (max-width:760px) | 19, 42 |
| .mobileContents nav | @media (max-width:760px) | 19, 42 |
| .sectionCopy p,.sectionCopy li | @media (max-width:760px) | 19, 42 |
| .hero h1 | @media (max-width:420px) | 20, 23 |
| .trustPanel | base | 24, 28 |
| .trustRow | base | 24, 28 |
| .trustRow:nth-child(3) | base | 24, 28 |
| .trustRow:nth-child(4) | base | 24, 28 |
| .trustRow | @media (max-width:760px) | 25, 36 |

Full candidates and declarations are in `mobile-css-evidence.json`; this table shows at most 30 groups per stylesheet.

## src/components/marketing-nav.module.css

3 media/container conditions; 0 repeated exact selector + condition groups; 2 dimension/overflow candidates; 3 small-control declarations.

| Repeated selector | Condition | Lines |
|---|---|---|

Full candidates and declarations are in `mobile-css-evidence.json`; this table shows at most 30 groups per stylesheet.

## src/components/model-picker.css

1 media/container conditions; 0 repeated exact selector + condition groups; 0 dimension/overflow candidates; 0 small-control declarations.

| Repeated selector | Condition | Lines |
|---|---|---|

Full candidates and declarations are in `mobile-css-evidence.json`; this table shows at most 30 groups per stylesheet.

## src/components/template-library.css

2 media/container conditions; 0 repeated exact selector + condition groups; 3 dimension/overflow candidates; 5 small-control declarations.

| Repeated selector | Condition | Lines |
|---|---|---|

Full candidates and declarations are in `mobile-css-evidence.json`; this table shows at most 30 groups per stylesheet.

## src/components/video-studio-v2.module.css

17 media/container conditions; 41 repeated exact selector + condition groups; 25 dimension/overflow candidates; 26 small-control declarations.

| Repeated selector | Condition | Lines |
|---|---|---|
| .page | base | 1, 137, 184 |
| .studioToolbar | base | 62, 139 |
| .studioToolbarTitle small | base | 63, 139 |
| .studioToolbarTitle b | base | 63, 139 |
| .studioMark | base | 64, 139 |
| .workspaceTabs | base | 65, 140 |
| .workspaceTabs button,.workspaceTabs a | base | 66, 140 |
| .workspaceTabs .tabSelected | base | 68, 140 |
| .layout | base | 70, 146 |
| .leftColumn,.rightColumn | base | 71, 146 |
| .modelRail | base | 84, 150 |
| .modelRail b | base | 87, 150 |
| .modelRail small | base | 87, 150 |
| .modelTrigger b | base | 95, 151 |
| .confirm | base | 105, 158 |
| .confirm input | base | 105, 158 |
| .playerControls button | base | 112, 164 |
| .indeterminate i | base | 118, 168 |
| .viewerStage | base | 122, 123 |
| .viewerUnavailable | base | 122, 123 |
| :global(html:not([data-theme="light"])) .page | base | 126, 171 |
| .layout | @container (max-width:1120px) | 131, 177 |
| .studioIntro | base | 141, 185 |
| .page .modelTrigger | base | 151, 195 |
| .page .modelList button | base | 152, 195 |
| .page .showcase | base | 160, 200 |
| .page .mainPoster | base | 161, 196 |
| .page .posterShade | base | 162, 198 |
| .sceneHeading | base | 163, 199 |
| .sceneHeading>span | base | 163, 199 |

Full candidates and declarations are in `mobile-css-evidence.json`; this table shows at most 30 groups per stylesheet.

## src/components/video-studio.module.css

10 media/container conditions; 38 repeated exact selector + condition groups; 21 dimension/overflow candidates; 1 small-control declarations.

| Repeated selector | Condition | Lines |
|---|---|---|
| .root | base | 1, 29, 59, 91 |
| :global(.video-workspace):has(.root) | base | 3, 49, 78 |
| :global(.video-workspace):has(.root) :global(.workspace-heading) | base | 4, 51, 79 |
| :global(.video-workspace):has(.root) :global(.media-studio-mark) | base | 6, 54, 80 |
| :global(.video-workspace):has(.root) :global(.media-studio-heading h1) | base | 9, 53, 81 |
| :global(.video-workspace):has(.root) :global(.media-studio-heading p) | base | 10, 82 |
| :global(.video-workspace):has(.root) :global(.video-workflow-guide) | base | 11, 83 |
| :global(.video-workspace):has(.root) :global(.creation-studio-layout) | base | 17, 84 |
| :global(.video-workspace):has(.root) :global(.inspector-panel) | base | 18, 57, 85 |
| :global(.video-workspace):has(.root) :global(.studio-control-head) | base | 20, 59 |
| :global(.video-workspace):has(.root) :global(.prompt-editor) | base | 23, 87 |
| :global(.video-workspace):has(.root) :global(.prompt-chip) | base | 25, 67 |
| :global(.video-workspace):has(.root) :global(.advanced-grid) | base | 27, 88 |
| :global(.video-workspace):has(.root) :global(.media-submit) | base | 28, 90 |
| .root :global(.video-mode-tabs) | base | 31, 61, 92 |
| .root :global(.video-mode-tabs button) | base | 32, 62 |
| .root :global(.video-mode-tabs button.active) | base | 33, 62 |
| .root :global(.studio-stage-label) | base | 35, 92 |
| .root :global(.studio-empty) | base | 36, 92 |
| .root :global(.studio-empty-glyph) | base | 37, 63, 92 |
| .root :global(.studio-empty h2) | base | 38, 64, 92 |
| .root :global(.studio-empty p) | base | 39, 92 |
| :global(.video-workspace):has(.root) | @media (max-width:900px) | 44, 94 |
| :global(.video-workspace):has(.root) :global(.workspace-heading) | @media (max-width:900px) | 44, 94 |
| .root | @media (max-width:900px) | 44, 73, 94 |
| :global(.video-workspace):has(.root) :global(.workspace-heading) | @media (max-width:620px) | 45, 74, 95 |
| :global(.video-workspace):has(.root) :global(.media-studio-heading h1) | @media (max-width:620px) | 45, 74, 95 |
| :global(.video-workspace):has(.root) :global(.video-workflow-guide) | @media (max-width:620px) | 45, 95 |
| :global(.video-workspace):has(.root) :global(.advanced-grid) | @media (max-width:620px) | 45, 95 |
| .root | @media (max-width:620px) | 45, 74, 95 |

Full candidates and declarations are in `mobile-css-evidence.json`; this table shows at most 30 groups per stylesheet.

## src/components/wallet-workspace.module.css

3 media/container conditions; 0 repeated exact selector + condition groups; 3 dimension/overflow candidates; 0 small-control declarations.

| Repeated selector | Condition | Lines |
|---|---|---|

Full candidates and declarations are in `mobile-css-evidence.json`; this table shows at most 30 groups per stylesheet.

## src/components/workspace-data.module.css

7 media/container conditions; 7 repeated exact selector + condition groups; 10 dimension/overflow candidates; 3 small-control declarations.

| Repeated selector | Condition | Lines |
|---|---|---|
| .surface.library :global(.library-meta) | base | 22, 167 |
| .surface.projects :global(.project-card p) | base | 43, 172 |
| .surface.projects :global(.project-meta) | base | 48, 173 |
| .surface.models :global(.model-sort) | base | 74, 190 |
| .surface.templates :global(.template-card-copy p) | base | 77, 175 |
| .surface.battle :global(.battle-response) | base | 86, 185 |
| .surface.models :global(.models-marketplace-hero) | @media (max-width:600px) | 139, 207 |

Full candidates and declarations are in `mobile-css-evidence.json`; this table shows at most 30 groups per stylesheet.

## src/components/workspace-shell.css

4 media/container conditions; 0 repeated exact selector + condition groups; 6 dimension/overflow candidates; 0 small-control declarations.

| Repeated selector | Condition | Lines |
|---|---|---|

Full candidates and declarations are in `mobile-css-evidence.json`; this table shows at most 30 groups per stylesheet.
