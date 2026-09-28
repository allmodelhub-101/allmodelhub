# Image Composer Design QA

## Scope

Only the Image Studio prompt composer and its existing prompt, reference, model, canvas, settings, and create controls were changed. The shared shell, top bar, sidebar, hero, prompt starters, assets, inspector behavior, APIs, model-selection flow, and generation flow were left intact.

## Visual references

- Source reference: `C:\Users\THEPER~1\AppData\Local\Temp\codex-clipboard-4c1803d6-9f9a-42f9-bafe-b7a7229c7fe8.png`
- Implementation review: rendered locally at `http://localhost:3000/images` in the Codex in-app browser at the small-phone breakpoint.

## Review results

- The composer keeps a compact, frosted card treatment with a clearly labeled prompt field and focused contrast in light and dark themes.
- The prompt field starts short, grows from its content, and caps at 120px with internal scrolling rather than extending the page.
- Existing control destinations remain present: reference upload, model picker, canvas inspector, settings inspector, and generation submit.
- On the mobile review, the controls formed a readable two-column grid and the full-width `Create image` action remained visible without horizontal overflow.
- Hover/focus polish is scoped to these controls only; reduced-motion users receive no decorative transition or lift effects.

## Focused checks

- `git diff --check`: passed.
- Direct local TypeScript check (`node_modules/.bin/tsc.cmd --noEmit`): passed.
- `pnpm build`: blocked before Next.js compilation because pnpm requires an explicit dependency build-script approval for `unrs-resolver`; no dependency-policy change was made.

passed
