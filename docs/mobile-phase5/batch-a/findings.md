# Batch A reproduced findings and ownership

| ID | Severity | Reproduction / evidence | Resolution |
|---|---|---|---|
| P5-A01 | P1 | At 320px, Library tools were 393px wide while root document was 320px; before/history-*.json and PNG | Owned shrinking columns and wrapping; visible Library page overflow; 44px filters/actions; strict inner-canvas assertions |
| P5-A02 | P1 | Projects inner canvas 354px, Models 1314px and Battle 1082px with synthetic long names at 320px | Scoped min-width, fluid cards, wrapped names/selectors; comparison panels stack below 901px |
| P5-A03 | P2 | File states hidden by compact CSS; nested clear-selection button role in upload button | Ready/Stored remain visible; separate native 44px clear action; no upload API changes |
| P5-A04 | P2 | Asset details lacked shared focus/Escape/scroll ownership; rapid global shortcuts could open behind details | Shared overlay hook and body portal; explicit opening-button focus; early document shortcut hand-off closes details before the original topbar handler opens its dialog |
| P5-A05 | P2 | Phone screenshots showed tiny response/detail text; computed Library search/sort were 12/10px, template search 13px and model sort 11px | Readable owned typography; retired two !important Library font declarations; compact editable controls compute to >=16px and have regression assertions |
| P5-A06 | P1 | Native model sorting entirely hidden below 621px; expanded browser test timed out waiting for it | Sort remains visible at compact widths; pricing-sort handler unchanged; eight focused checks passed |
| P5-A07 | P2 | Desktop compare CTA measured 43px versus retained >=44px assertion | 48px primary CTA in the owning stylesheet; desktop light/dark rechecks pass |
| P5-A08 | P3 | Tall phone Project summaries and colliding tablet file decoration in reviewed images | Compact three-column summary, direct New project focus action, desktop form/list order retained for predictable keyboard traversal; decorative tablet art removed |
| P5-A09 | P3 | Files/Models reserved navigation space in addition to shell padding | Four obsolete padding/important declarations retired; shell owns navigation clearance, content keeps 24px breathing room |
| P5-A10 | P2 | Child main landmarks nested inside the shared main | Named content sections; browser assertions retain one main landmark |

The source inventory remains 32 pages and 43 HTTP handlers. The added stylesheet is `src/components/workspace-data.module.css`; it owns these seven surfaces and uses existing theme tokens. `retired-css.json` records bounded global/file stylesheet changes. Other legacy global selectors and candidate repetitions remain; no broad cascade rewrite or blanket clipping was added.

The before screenshots are actual synthetic production presentations with Phase 5 layout disabled, after controller separation and initial semantic cleanup. They are not authenticated customer screenshots. After screenshots include separate scrolled content captures so content below the first app viewport is reviewed. Both themes and both engines have representative references. Do not equate capture generation with visual comparison or synthetic actions with authenticated behavior.

The user story remains authorized page -> original controller/API -> stored workspace data -> presentation. Safe fixtures verify presentation and local callbacks only. API/data/session boundaries remain BLOCKED without the authorized isolated environment; the browser guard aborts and fails any fixture API request. No production session, purchase, generation, file deletion or upload occurred.
