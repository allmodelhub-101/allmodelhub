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

test("newly verified video contracts forward only their documented request fields", () => {
  const grok = getMediaExecutionContract("grok-imagine-video-1-5");
  const turbo = getMediaExecutionContract("minimax-h3-max-turbo");
  assert.deepEqual(grok.resolutions, ["480p", "720p", "1080p"]);
  assert.equal(grok.maxReferences, 7);
  assert.deepEqual(turbo.resolutions, ["480p", "768p"]);
  assert.equal(turbo.maxReferences, 1);
  assert.deepEqual(referencePayload(turbo, ["https://example.test/first.jpg"]), {
    first_frame_url: "https://example.test/first.jpg",
  });
  assert.throws(() => validateMediaContractRequest(turbo, {
    referenceCount: 2, duration: 5, resolution: "768p", aspectRatio: "16:9",
  }), /MEDIA_OPTION_UNSUPPORTED:references/);
});

test("video output persists while exact provider-record billing reconciles", () => {
  const jobs = readFileSync(new URL("../../src/app/api/jobs/[id]/route.ts", import.meta.url), "utf8");
  const callback = readFileSync(new URL("../../src/app/api/provider-callback/apimodels/[secret]/route.ts", import.meta.url), "utf8");
  const reconciliation = readFileSync(new URL("../../src/lib/billing/reconciliation.ts", import.meta.url), "utf8");
  const billing = readFileSync(new URL("../../src/lib/billing/media-job-billing.ts", import.meta.url), "utf8");
  assert.match(jobs, /job\.modality === "video"/);
  assert.match(callback, /existingJob\.modality === "video"/);
  assert.match(reconciliation, /job\.modality === "video"/);
  assert.match(billing, /job\.modality !== "video"/);
  assert.match(jobs, /completeProviderAuthoritativeMediaBilling/);
});

test("video preflight is authenticated, non-mutating, and does not expose provider cost", () => {
  const preflight = readFileSync(new URL("../../src/app/api/generations/video/preflight/route.ts", import.meta.url), "utf8");
  assert.match(preflight, /auth\.getUser/);
  assert.match(preflight, /previewProviderAuthorization/);
  assert.match(preflight, /maximumAuthorizationCredits/);
  assert.doesNotMatch(preflight, /providerCreateTaskExact|createProviderAuthorization|providerCostUsd/);
});
