import assert from "node:assert/strict";
import test from "node:test";
import { calculateAuthoritativePrice, selectPricingRule } from "../../src/lib/billing/pricing-registry-core.ts";
import { countSubmittedCharacters } from "../../src/lib/billing/audio-usage-core.ts";

const baseRow = {
  id: "tts-v1", provider_key: "apimodels", model_id: "tts", upstream_model: "eleven-tts-flash",
  pricing_version: "2026-09", billing_type: "character", currency: "USD",
  input_token_price: null, output_token_price: null, cached_token_price: null, cache_write_token_price: null,
  flat_price: null, per_image_price: null, per_second_price: null, per_minute_price: null,
  per_1k_character_price: "0.04", per_reference_image_price: null,
  resolution_dimensions: {}, quality_dimensions: {}, mode_dimensions: {}, input_type_dimensions: {}, formula: {}, metadata: {},
  effective_from: "2026-09-01T00:00:00Z", effective_until: null, verified_at: "2026-09-25T00:00:00Z",
  source_name: "provider docs", source_url: "https://apimodels.app/en/docs/audio", source_metadata: {},
  status: "verified", active: true, model_markup: "2", model_active: true,
};
const selector = { providerKey: "apimodels", modelId: "tts", upstreamModel: "eleven-tts-flash", at: new Date("2026-09-26T12:00:00Z") };
function price(overrides, usage) {
  const row = { ...baseRow, ...overrides };
  const rule = selectPricingRule([row], { ...selector, modelId: row.model_id, upstreamModel: row.upstream_model });
  return calculateAuthoritativePrice({ rule, usage, internalUsdPkrRate: "300" });
}

test("golden exact TTS character charges for 1, 6, 100, 1000, 5000 and 10000 characters", () => {
  const golden = [
    [1, "0.00004", "0.024"],
    [6, "0.00024", "0.144"],
    [100, "0.004", "2.4"],
    [1000, "0.04", "24"],
    [5000, "0.2", "120"],
    [10000, "0.4", "240"],
  ];
  for (const [characters, providerCost, charge] of golden) {
    const result = price({}, { characters: String(characters) });
    assert.equal(result.providerCostUsd, providerCost);
    assert.equal(result.customerChargeCredits, charge);
  }
});

test("submitted character counting is Unicode code-point exact", () => {
  assert.equal(countSubmittedCharacters("a"), "1");
  assert.equal(countSubmittedCharacters("😀"), "1");
  assert.equal(countSubmittedCharacters("A😀ب"), "3");
});

test("fixed and duration audio use their validated provider-specific strategies", () => {
  const fixed = price({ model_id: "fixed-audio", upstream_model: "kling-tts", billing_type: "flat", flat_price: "0.01", per_1k_character_price: null }, {});
  assert.equal(fixed.providerCostUsd, "0.01");
  assert.equal(fixed.customerChargeCredits, "6");

  const duration = price({ model_id: "duration-audio", upstream_model: "eleven-isolator", billing_type: "time", per_minute_price: "0.102", per_1k_character_price: null }, { seconds: "1.5" });
  assert.equal(duration.providerCostUsd, "0.00255");
  assert.equal(duration.customerChargeCredits, "1.53");
});
