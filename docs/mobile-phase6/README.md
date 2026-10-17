# Phase 6 — final hardening and release gates

Continues Phase 5 `5f5df2d092515cebe198fc4f30a3ca6589023d92` on `feat/mobile-first-responsive-overhaul`, draft [PR #149](https://github.com/allmodelhub-101/allmodelhub/pull/149). Main remained `314c76404b98156ea4bdd8bb63899df24e9eb8b4` at preflight. Phase 5 exact-head CI 39024549022 succeeded; its 2,128 passes are historical, not Phase 6 results. PRs #106 billing, #117 Video execution and #121 homepage performance remain separate. No merge or production promotion is authorized.

## Implemented changes

- LoginForm: hydration-safe session email snapshot and render-time route-prop synchronization replace cascading effects. Explicit email/password labels keep help text out of accessible names. Login, signup, recovery, password policy, redirects and API payload handlers remain byte-equivalent after LF normalization, guarded by seven hashes from the Phase 5 source.
- Model availability indicators now use a permitted image role with their existing available/unavailable names.
- Rendered contrast failures are repaired in shared shell, workspace projects, account/admin, Chat avatars and Audio tabs. Owning styles retain theme tokens and component-local overflow.
- VideoModelRail stops its animation frame loop while outside the scroll viewport or while the document is hidden, then resumes from the previous position. Live reduced-motion/save-data listeners update Video Studio without a reload. Pause, touch/hover/focus behavior, selection and generation handlers remain intact.
- Account decorative orbits, usage shine and admin live pulse run normally again; their scoped suppression applies only to reduced motion. Homepage, payment premium animations and the media/AI contracts are preserved.
- Two exact duplicate global admin CSS blocks (7,801 non-newline bytes) were retired; the identical admin-owned stylesheet remains imported by both production AdminLayout and the guarded AdminFixture. Archived declarations/hashes are in css-retirement.json and retired-admin-global.css.txt. No root overflow masking was introduced.
- Safe lint cleanup: history search closure is inside its memo; unused icons/test parameters removed; a static local brand icon uses unoptimized Next Image, preserving its URL and size. Full lint drops from two errors/14 warnings to zero errors/seven existing raw-media warnings. The remaining signed/blob/media previews are not rewritten merely to silence advice.
- Homepage guard normalizes CRLF to LF before hashing, preserving the same pinned source hash across Windows/Linux. Homepage source is unchanged.

## Verification boundaries

See [route acceptance](route-acceptance.md), [visual reference migration](visual-reference-migration.md), [manual acceptance](manual-acceptance.md), and [verification records](verification/README.md). Exact final CI results and commit are published on PR #149 and must match its current head. Earlier interrupted/failed diagnostic runs remain recorded; they are never counted as successful final verification.

All 14 sizes and both engines remain configured. New default coverage adds local auth validation/navigation, normal/reduced motion, rail visibility/resumption, stress views and a WCAG A/AA axe subset at 390 and 1366 pixels in both themes/engines. Other projects explicitly exclude the expensive accessibility/stress files rather than reporting them as passes or skipped acceptance. Retained tests cover the other sizes, overlays, touch targets and navigation.

Stress fixtures render 160 Chat rows, 500 library conversations and 500 admin users/200 jobs through real Views. They use synthetic IDs and callbacks; production controllers and auth gates are never mounted or bypassed. Production Next fixture-denial tests remain mandatory.

## Performance evidence and limitations

performance/rail-before.json and rail-after.json instrument actual scrollLeft writes for one-second samples. Chromium offscreen work fell from 54 to zero writes; WebKit from 37 to zero. Visible/resumed motion remains active in both engines. These operation counts demonstrate eliminated offscreen work, not a device frame-rate certification. before/audit.json and after/audit.json retain normal-motion lab frame, layout-shift and long-task samples; stress profiles cover long content and payment stages. Development navigation timings include compilation and must not be presented as production Web Vitals or compared as a controlled speed benchmark. WebKit lacks Chromium long-task/CLS support; empty unsupported entries are not proof of zero cost.

No authorized isolated backend/accounts or physical iOS/Android devices were supplied. The 22 true protected workflows remain BLOCKED. Hardware keyboards/IME, safe areas, assistive technology and low-end-device performance remain UNVERIFIED. Release remains NOT RELEASE READY until those gates and any final automated failures are accepted. Fixture, screenshot and contract success cannot establish real persistence, uploads, settlement, authorization or generation.
