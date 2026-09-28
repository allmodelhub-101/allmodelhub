import assert from "node:assert/strict";
import test from "node:test";
import { calculateAuthoritativePrice, selectPricingRule } from "../../src/lib/billing/pricing-registry-core.ts";
import { mediaCallbackDecision, mediaUsageFromRequest, normalizeMediaResult } from "../../src/lib/billing/media-job-billing-core.ts";

function rule(overrides = {}) {
  const row = {
    id: "media-v1", provider_key: "apimodels", model_id: "media", upstream_model: "media/upstream",
    pricing_version: "v1", billing_type: "flat", currency: "USD", input_token_price: null,
    output_token_price: null, cached_token_price: null, cache_write_token_price: null, flat_price: "0.1",
    per_image_price: null, per_second_price: null, per_minute_price: null, per_1k_character_price: null,
    per_reference_image_price: null, resolution_dimensions: {}, quality_dimensions: {}, mode_dimensions: {},
    input_type_dimensions: {}, formula: {}, metadata: {}, effective_from: "2026-09-01T00:00:00Z",
    effective_until: null, verified_at: "2026-09-01T00:00:00Z", source_name: "provider",
    source_url: "https://provider.example", source_metadata: {}, status: "verified", active: true,
    model_markup: "2", model_active: true, ...overrides,
  };
  return selectPricingRule([row], { providerKey: row.provider_key, modelId: row.model_id,
    upstreamModel: row.upstream_model, at: new Date("2026-09-26T00:00:00Z") });
}

function cost(validated, usage, dimensions = {}) {
  return calculateAuthoritativePrice({ rule: validated, usage, dimensions, internalUsdPkrRate: "300" }).providerCost.amount;
}

test("FLUX editing includes every reference-image surcharge", () => {
  const flux = rule({ billing_type: "image", flat_price: null, per_image_price: "0.04",
    per_reference_image_price: "0.015", mode_dimensions: { generate: { flat: "0" }, edit: { flat: "0.02" } } });
  assert.equal(cost(flux, { images: "1", references: "3" }, { mode: "edit" }), "0.105");
});

test("image resolution rules select distinct validated prices", () => {
  const image = rule({ billing_type: "image", flat_price: null,
    resolution_dimensions: { "1024x1024": { perImage: "0.025" }, "2048x2048": { perImage: "0.03" }, "4096x4096": { perImage: "0.05" } } });
  assert.equal(cost(image, { images: "2" }, { resolution: "1024x1024" }), "0.05");
  assert.equal(cost(image, { images: "2" }, { resolution: "4096x4096" }), "0.1");
});

test("video duration, resolution, and native audio produce different costs", () => {
  const video = rule({ billing_type: "time", flat_price: null,
    resolution_dimensions: { "720p": { perSecond: "0.12" }, "1080p": { perSecond: "0.2" } },
    mode_dimensions: { silent: { multiplier: "1" }, native_audio: { multiplier: "1.5" } } });
  assert.equal(cost(video, { seconds: "5" }, { resolution: "720p", mode: "silent" }), "0.6");
  assert.equal(cost(video, { seconds: "10" }, { resolution: "1080p", mode: "native_audio" }), "3");
});

test("fixed-price media stays deterministic", () => {
  assert.equal(cost(rule({ flat_price: "0.275" }), mediaUsageFromRequest({ prompt: "x" })), "0.275");
});

test("provider usage overrides requested media dimensions where reported", () => {
  const fallback = mediaUsageFromRequest({ prompt: "hello", duration: 5, resolution: "720p", fps: 24 });
  const normalized = normalizeMediaResult({ raw: { request_id: "req-1", usage: { output_duration: "5.25", fps: "30", cost: { amount: "0.42", currency: "USD" } } }, resultUrls: ["https://example.test/a.mp4"] }, fallback);
  assert.equal(normalized.usage.seconds, "5.25"); assert.equal(normalized.usage.fps, "30");
  assert.equal(normalized.providerRequestId, "req-1"); assert.deepEqual(normalized.providerReportedCost, { amount: "0.42", currency: "USD" });
});

test("async failure settles once and duplicate callbacks are no-ops", () => {
  assert.equal(mediaCallbackDecision("processing", "failed"), "fail");
  assert.equal(mediaCallbackDecision("processing", "completed"), "settle");
  assert.equal(mediaCallbackDecision("completed", "completed"), "duplicate");
  assert.equal(mediaCallbackDecision("failed", "failed"), "duplicate");
});
