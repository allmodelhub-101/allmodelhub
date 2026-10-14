import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const component = readFileSync(new URL("../../src/components/image-studio.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../../src/components/image-studio.css", import.meta.url), "utf8");

test("image polish remains scoped and supports light/dark surfaces", () => {
  assert(css.includes('html[data-theme="light"] body .image-workspace.image-studio-refined'));
  assert(css.includes('--image-surface:#fff') && css.includes('--image-surface:#101b2c'));
  assert(css.includes('image-prompt-dock form:focus-within'));
  assert(css.includes('image-generate-button:disabled'));
});

test("decorative motion is gentle, pausable and disabled for reduced motion", () => {
  assert(component.includes('aria-pressed={motionPaused}'));
  assert(component.includes('"Resume motion" : "Pause motion"'));
  assert(css.includes('imageAtelierFloat') && css.includes('translate:0 -7px'));
  assert(css.includes('is-motion-paused') && css.includes('animation-play-state:paused!important'));
  assert(css.includes('prefers-reduced-motion:reduce') && css.includes('animation:none!important'));
  assert(css.includes('aspect-ratio:3 / 2')); // No animated atlas deformation.
});

test("model, reference and settings controls preserve authorization and accessible state", () => {
  assert(component.includes('aria-controls="image-settings-panel"') && component.includes('aria-expanded={inspectorOpen}'));
  assert(component.includes('onPaste={pasteReference}'));
  assert(component.includes('imageFileIds: references.map'));
  assert(component.includes('(expensive && !confirmed)'));
  assert(component.includes('pollTokenRef.current += 1'));
});
