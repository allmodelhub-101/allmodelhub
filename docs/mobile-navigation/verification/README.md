# Verification and handoff

Branch: feat/premium-mobile-navigation. Draft PR150. Integration base: 75258ac92f660488ccf0424d7fe4b2580dc0b695. The PR description/checks record the final tested head and Preview URL; this file does not invent its own future commit hash. Production remains on main until the user visually approves this follow-up.

## Executed local checks

- 328 Node tests PASS: 301 retained tests plus 27 integration-base source/handler/store checks. The final command-level breakdown is 161 billing, four security and 163 UI/contracts; these are included, not additional counts.
- Focused shell/navigation run: 56 PASS, zero failures, no retries, across Chromium 320/768/1366 and WebKit390. It includes all eight real presentation surfaces in both themes. This run preceded the final passive-effect handoff/readiness/avatar refinement; final Linux CI must verify the final head.
- Final handoff/motion regression: ten PASS (five explicit diagnostic repetitions per Chromium320/WebKit390), zero failures. Normal/reduced-motion behavior, Escape, scroll restoration, current Chat entry and focus return remain asserted. These repetitions are not extra full-matrix coverage or automatic retries.
- Navigation dialog axe subset: eight scans PASS, zero violations (More/account x two themes x Chromium/WebKit). Incomplete/full assistive-technology and physical-device acceptance remain manual.
- TypeScript, local production build, scoped lint and pinned homepage/security scripts PASS. Full lint: zero errors and seven retained raw-media warnings. Exact final Linux foundation checks supersede earlier local source checkpoints.
- Candidate Preview public smoke checks: 22 PASS on 17a01f5, five public routes x two engines x phone/desktop plus two production fixture denials. This does not expose fixture routes or establish authenticated navigation. Repeat after final Preview rebuild and record its actual result in PR150.

## Visual review

Initial before/ contains 64 captures from main. Initial desktop comparison includes a Video poster versus loaded sample, and pale WebKit text captured before hydration. The failed readiness probe showed the theme control still named Change theme. That capture is retained as diagnostics/unready-webkit-projects.png rather than silently accepted. No unrelated page CSS was changed to hide it.

The capture helper now waits for real hydration, exercises and dismisses the existing project dropdown, waits for the actual theme control when present, and captures the settled presentation. A source-identical isolated main extraction at loopback3102 supplies verified-before/: 32 hydrated desktop captures (eight surfaces x two themes x both engines). It uses the same dependencies/assets and webpack dev compiler; it is component/layout evidence, not a cross-compiler build equivalence claim. The branch uses its normal Turbopack server at loopback3100. Original before evidence remains unchanged. after/ contains 64 final presentation captures with the same readiness protocol. Historical approved snapshot references were never regenerated.

All four 32-case desktop contact sheets under visual-review/ were inspected, including full-size Chat/Image and WebKit Settings/Projects. 17 complete images are pixel-identical; 27 headers are pixel-identical. The largest mean absolute channel delta is 0.04645 on a 0-255 scale, with residual text/edge raster differences retained in desktop-comparison-verified.json and visual-review/desktop-render-metrics.json. Geometry, branding, restored Chat, Image/Video/Audio, payment and account designs remain equivalent. The refreshed Video pair uses the same loaded preview instead of comparing it with an initial poster. Do not call all images pixel-identical.

Phone review confirms the 108px header becomes one 56px row, recovering 52px without altering Chat source. Project/search/notification/wallet/avatar targets remain44px. overlays/ contains 12 additional reviewed captures of More, Generation Center and account dialogs, both themes and engines. The More sheet scrolls; its sticky close header and the existing shared focus/scroll hook remain the owners.

## Safety and remaining acceptance

Nineteen source hashes preserve Chat restoration, studio execution/presentation, wallet, theme, overlays, homepage and globals. Seven original topbar handlers preserve project switching, wallet refresh, notification reads, destinations and retries. The existing Generation Center hook, Chat activity and job/billing helpers remain untouched. The sibling bridge shares a derived count and an open event only. Final handoff uses a passive effect after More cleanup, avoiding a requestAnimationFrame race. The phone avatar reuses the existing premium topbar avatar class.

All 14 established viewport sizes and both engines remain configured. Full Linux browser and production-mode results must be attached to the current PR head; earlier candidate runs are diagnostics. No retry/blanket-skip/threshold reduction is permitted. Fixture results do not certify real notification mutations, project backend persistence, logout, wallet accounting, provider generation or authorization. The 22 isolated authenticated workflows remain blocked; physical keyboards/IME/safe areas/zoom/AT and lower-end hardware remain unverified.

No production merge/promotion, secret/schema/configuration change, purchase, paid generation, customer upload or account mutation was performed for this task.

## Final menu-shortcut regression repair

A direct hit-test reproduced two dialogs after Ctrl+K from the phone account menu: the model picker had focus underneath the account backdrop. The before/after PNGs are in diagnostics/account-shortcut-before.png and account-shortcut-after.png. The final bridge supports existing generation/search/help panels. Account and More consume only their owned Ctrl/Command+K and question-mark keys, dismiss, and open the existing panel; native propagation is stopped to prevent Chat's document-level listener from opening a second overlay. Outside these menus the original shortcuts are unchanged. More still waits for passive cleanup before handoff. Final six phone checks pass in Chromium320/WebKit390, both account themes and grouped More, asserting search/help visibility, one-owner focus and restoration. All 27 source/handler/store guards pass again; scoped lint is clean. The superseded first shortcut attempt and its focus/ordering diagnostics remain recorded. These six cases overlap the default suite and are not added to its unique count.
