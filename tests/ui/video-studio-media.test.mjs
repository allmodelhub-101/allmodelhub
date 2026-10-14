import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { videoStudioClips } from "../../src/lib/video-studio-media.ts";
import { inspectMediaBytes } from "../../src/lib/media-metadata.ts";

const asset = (url) => new URL(`../../public${url}`, import.meta.url);

test("all sixteen supplied samples have full-length, fast-start browser assets", () => {
  assert.equal(videoStudioClips.length, 16);
  assert.equal(new Set(videoStudioClips.map(clip => clip.id)).size, 16);
  for (const clip of videoStudioClips) {
    assert(clip.fullSrc && clip.sourceDurationSeconds > 0);
    assert(existsSync(asset(clip.poster)));
    for (const source of [clip.fullSrc, clip.gridSrc]) {
      const bytes = readFileSync(asset(source));
      const metadata = inspectMediaBytes(bytes, "video/mp4");
      assert(Math.abs(metadata.duration - clip.sourceDurationSeconds) < 0.1, `${clip.id}: shortened timeline ${metadata.duration}`);
      assert(bytes.indexOf(Buffer.from("moov")) < bytes.indexOf(Buffer.from("mdat")), `${clip.id}: fast-start metadata missing`);
      assert.equal(metadata.width > metadata.height ? "landscape" : metadata.width === metadata.height ? "square" : "portrait", clip.orientation);
    }
  }
});

test("model browsing and full-frame playback preserve generation protections", () => {
  const studio = readFileSync(new URL("../../src/components/video-studio.tsx", import.meta.url), "utf8");
  const rail = readFileSync(new URL("../../src/components/video-model-rail.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../../src/components/video-studio-v2.module.css", import.meta.url), "utf8");
  assert(studio.includes("src={demo.fullSrc || demo.gridSrc}"));
  assert(studio.includes("!confirmed") && studio.includes("quote.requestKey !== requestPayload"));
  assert(rail.includes("window.clearInterval(timer)") && rail.includes("document.hidden"));
  assert(rail.includes("onFocusCapture") && rail.includes("onMouseEnter") && rail.includes("motionAllowed"));
  assert(!rail.includes("slice(0, 3)"));
  assert(css.includes("object-fit:contain") && css.includes("prefers-reduced-motion:reduce"));
});

test("verified provider marks exist locally and FlashVSR remains honestly labeled", () => {
  for (const file of ["ltx.png", "minimax.ico", "seedance.ico", "kling.png", "wan.ico", "grok.ico", "google.png"]) {
    assert(readFileSync(asset(`/video-studio/brands/${file}`)).length > 100);
  }
  const rail = readFileSync(new URL("../../src/components/video-model-rail.tsx", import.meta.url), "utf8");
  assert(rail.includes('? "VSR" : "AI"'));
});
