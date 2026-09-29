import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  getMediaExecutionContract,
  mediaProviderOptionPayload,
  referencePayload,
  validateMediaContractRequest,
} from "../../src/lib/media-execution-contract.ts";

test("Kling V3 maps AMH options to exact provider fields", () => {
  const contract = getMediaExecutionContract("kling-v3");
  assert.deepEqual(mediaProviderOptionPayload(contract, {
    duration: 3, resolution: "1080p", aspectRatio: "9:16", nativeAudio: true,
  }), { duration: "3", mode: "pro", aspect_ratio: "9:16", sound: "on" });
  assert.deepEqual(referencePayload(contract, ["https://example.test/frame.png"]), {
    image: "https://example.test/frame.png",
  });
  assert.throws(() => validateMediaContractRequest(contract, {
    referenceCount: 0, duration: 16, resolution: "720p", nativeAudio: false,
  }), /MEDIA_OPTION_UNSUPPORTED:duration/);
});

test("VEO keeps fixed duration and resolution out of the provider request", () => {
  const contract = getMediaExecutionContract("veo-3-1-fast-fhd");
  assert.deepEqual(mediaProviderOptionPayload(contract, {
    duration: 8, resolution: "1080p", aspectRatio: "16:9",
  }), { aspect_ratio: "16:9" });
  assert.deepEqual(referencePayload(contract, ["first", "last"]), { images: ["first", "last"] });
});

test("MiniMax H3 and Lite enforce only safely priced request subsets", () => {
  const h3 = getMediaExecutionContract("minimax-h3");
  const lite = getMediaExecutionContract("minimax-h3-lite");
  assert.equal(h3.maxReferences, 5, "paid H3 reference-image overages are not exposed");
  assert.equal(lite.maxReferences, 9, "Lite reference images are documented as free");
  assert.throws(() => validateMediaContractRequest(h3, {
    referenceCount: 6, duration: 5, resolution: "768p", aspectRatio: "16:9",
  }), /MEDIA_OPTION_UNSUPPORTED:references/);
  assert.doesNotThrow(() => validateMediaContractRequest(lite, {
    referenceCount: 9, duration: 1, resolution: "480p", aspectRatio: "9:16",
  }));
  assert.deepEqual(mediaProviderOptionPayload(lite, {
    duration: 1, resolution: "480p", aspectRatio: "9:16",
  }), { duration: 1, resolution: "480p", ratio: "9:16" });
});

test("video migration has exact request-bounded maxima and current evidence", () => {
  const sql = readFileSync(new URL("../../supabase/migrations/20260929202000_media_video_contract_repair.sql", import.meta.url), "utf8");
  assert.match(sql, /'kling-v3'.*3\.600::numeric/s);
  assert.match(sql, /720p.*perSecond.*0\.12.*1080p.*perSecond.*0\.16/s);
  assert.match(sql, /silent.*multiplier.*1.*native_audio.*multiplier.*1\.5/s);
  assert.match(sql, /'minimax-h3-lite'.*0\.300::numeric/s);
  assert.match(sql, /480p.*perSecond.*0\.01.*768p.*perSecond.*0\.02/s);
  assert.match(sql, /APIMODELS \/records[\s\S]*sole final settlement authority/);
});
