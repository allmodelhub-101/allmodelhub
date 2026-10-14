import test from "node:test";
import assert from "node:assert/strict";
import { clipboardImageFiles } from "../../src/lib/image-clipboard.ts";
import { readFileSync } from "node:fs";

const file = name => new File(["image"], name, { type: "image/png" });
test("clipboard items preserve multiple images without double-counting FileList", () => {
  const a = file("a.png"), b = file("b.png");
  assert.deepEqual(clipboardImageFiles({items:[a,b].map(f=>({kind:"file",type:f.type,getAsFile:()=>f})),files:[a,b]}),[a,b]);
});
test("FileList-only clipboard works, null items and ordinary text stay harmless", () => {
  const a = file("a.png");
  assert.deepEqual(clipboardImageFiles({items:[{kind:"file",type:"image/png",getAsFile:()=>null}],files:[a]}),[a]);
  assert.deepEqual(clipboardImageFiles({items:[{kind:"string",type:"text/plain",getAsFile:()=>null}]}),[]);
  assert.deepEqual(clipboardImageFiles({files:[new File(["text"],"note.txt",{type:"text/plain"})]}),[]);
});
test("FLUX maps to an official mark and paste remains a user-triggered guarded action", () => {
  const brand=readFileSync(new URL("../../src/components/model-brand.tsx",import.meta.url),"utf8");
  const studio=readFileSync(new URL("../../src/components/image-studio.tsx",import.meta.url),"utf8");
  assert(brand.includes('return "flux"') && brand.includes('/model-brands/black-forest-labs.svg'));
  assert(readFileSync(new URL("../../public/model-brands/black-forest-labs.svg",import.meta.url),"utf8").includes('viewBox="0 0 196 140"'));
  assert(studio.includes('onClick={() => void pasteFromClipboard()}'));
  assert(studio.includes('const remaining = maxReferences - references.length'));
  assert(studio.includes('Clipboard access was blocked.') && studio.includes('if (!files.length) return;'));
});
