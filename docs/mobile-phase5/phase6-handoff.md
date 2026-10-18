# Phase 6 handoff and release gates

All four ordered Phase 5 presentation batches are implemented. Source inventory remains 32 routes and 43 handlers. Phase 2 shell, Phase 3 Chat and Phase 4 Studios remain in scope for regression only. The homepage Git blob remains unchanged.

1. Require successful foundation and both browser shards on the exact PR head. Read final CI artifacts, not earlier green commits. The expanded browser job timeout is 60 minutes for retained plus new coverage; retries remain zero and fail-fast false.
2. Provision authorized isolated member/admin accounts and a nonproduction backend. All 22 true authenticated workflows remain BLOCKED; synthetic fixture success never proves auth, billing settlement, uploads, persistence or provider execution.
3. Execute protected Chat, studio, workspace, settings/support, wallet and admin workflows safely. Use approved free/test providers and payment sandbox fixtures; never purchase credits or submit paid generations for layout verification.
4. Test actual iOS Safari and Android Chrome keyboards, IME/composition, rotation, safe areas, text/pinch zoom, screen-reader navigation and reduced-height editing. Browser viewport simulation does not verify software keyboards or hardware performance.
5. Audit contrast, focus order, route recovery, tables, long content, nested overlays, touch target spacing and accessible errors with assistive technology. Automated labels/focus checks cover selected paths only.
6. Profile real lower-end hardware with long conversations, media results, administrative tables and reduced motion disabled. Existing global CSS and decorative animation layers remain a consolidation/performance risk. Do not remove selectors without computed-rule evidence and regression tests.
7. Review final approved visual comparisons and report every difference. Existing OS/browser baselines are specific; do not overwrite them to mask regressions. Public typography changes require explicit review rather than false claims of pixel identity.
8. Resolve historical full-repository lint defects separately from newly introduced errors. Homepage raw CRLF mismatches on Windows require Git-blob/LF verification, not homepage edits.
9. Keep PR149 draft/unmerged until release acceptance. No production promotion is authorized by this phase.

Ownership: workspace-data.module.css covers discovery/workspace; account-workspace.module.css covers settings/support/usage; wallet-workspace.module.css covers wallet presentation; admin-workspace.module.css covers admin data. Shared frame and overlay ownership remain Phase 2. Original production controllers receive unchanged payloads/callbacks; 56 immutable baseline hashes and original provenance supplement billing/security/Chat/studio regressions. New production React and actual Next denial scripts exercise presentation only.
