import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { calculateLegacyShadowCharge } from "../../src/lib/billing/legacy-shadow-core.ts";
import { calculateAuthoritativePrice, PricingUnavailableError, selectPricingRule } from "../../src/lib/billing/pricing-registry-core.ts";
import { evaluateReservationCoverage } from "../../src/lib/billing/quote-reservation-core.ts";
import { compareShadowCharges, failureShadowComparison } from "../../src/lib/billing/shadow-validation-core.ts";
import { mediaCallbackDecision } from "../../src/lib/billing/media-job-billing-core.ts";

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = JSON.parse(readFileSync(join(here, "fixtures", "golden-pricing.json"), "utf8"));

function row(fixture, overrides = {}) {
  return {
    id: `fixture-${fixture.name}`, provider_key: "provider-a", model_id: "fixture-model", upstream_model: "provider/model",
    pricing_version: "golden-v1", billing_type: "flat", currency: "USD", input_token_price: null,
    output_token_price: null, cached_token_price: null, cache_write_token_price: null, flat_price: null,
    per_image_price: null, per_second_price: null, per_minute_price: null, per_1k_character_price: null,
    per_reference_image_price: null, resolution_dimensions: {}, quality_dimensions: {}, mode_dimensions: {},
    input_type_dimensions: {}, formula: {}, metadata: {}, effective_from: "2026-01-01T00:00:00Z",
    effective_until: null, verified_at: "2026-01-01T00:00:00Z", source_name: "golden-fixture",
    source_url: "https://provider.example/pricing", source_metadata: {}, status: "verified", active: true,
    model_markup: "2", model_active: true, ...fixture.rule, ...overrides,
  };
}

test("golden pricing fixtures cover every distinct active billing strategy exactly", () => {
  const strategies = new Set(fixtures.map((fixture) => fixture.strategy));
  for (const strategy of ["token", "cached_token", "flat", "per_image", "reference", "resolution", "duration_resolution", "characters", "per_minute", "mode", "quality", "input_type", "formula"]) {
    assert.ok(strategies.has(strategy), `missing golden strategy ${strategy}`);
  }
  assert.ok(fixtures.filter((fixture) => ["token", "characters", "resolution", "duration_resolution"].includes(fixture.strategy)).length >= 8);
  for (const fixture of fixtures) {
    const rule = selectPricingRule([row(fixture)], { providerKey: "provider-a", modelId: "fixture-model", upstreamModel: "provider/model", at: new Date("2026-09-26T00:00:00Z") });
    const price = calculateAuthoritativePrice({ rule, usage: fixture.usage, dimensions: fixture.dimensions, internalUsdPkrRate: "300" });
    assert.equal(price.providerCostUsd, fixture.expectedProviderUsd, fixture.name);
    assert.equal(price.customerChargeCredits, fixture.expectedCharge, fixture.name);
    assert.equal(price.snapshot.internalUsdPkrRate, "300", `${fixture.name} FX snapshot`);
    assert.equal(price.snapshot.pricingVersion, "golden-v1", `${fixture.name} version snapshot`);
  }
});

test("shadow comparison preserves micro-costs and flags only meaningful mismatches", () => {
  assert.deepEqual(compareShadowCharges({ legacyExpectedChargeCredits: "0.000001", billingV2ChargeCredits: "0.000001" }), {
    legacyExpectedChargeCredits: "0.000001", billingV2ChargeCredits: "0.000001", varianceCredits: "0",
    absoluteVarianceCredits: "0", relativeVariance: "0", toleranceCredits: "0.000001", mismatch: false, severity: null,
  });
  assert.equal(compareShadowCharges({ legacyExpectedChargeCredits: "100", billingV2ChargeCredits: "100.5" }).mismatch, false);
  assert.equal(compareShadowCharges({ legacyExpectedChargeCredits: "0.1", billingV2ChargeCredits: "0.125" }).severity, "high");
  assert.equal(compareShadowCharges({ legacyExpectedChargeCredits: "1", billingV2ChargeCredits: "3" }).severity, "critical");
  assert.equal(failureShadowComparison().mismatch, false);
});

test("legacy shadow calculator remains comparison-only across text, TTS, media and failure", () => {
  const text = { id: "text", modality: "text", markup: 2, inputUsdPerMillion: 1, outputUsdPerMillion: 4 };
  assert.equal(calculateLegacyShadowCharge({ model: text, phase: "settlement", usage: { inputTokens: "1", outputTokens: "0" }, internalUsdPkrRate: "300" }), "0.0006");
  assert.equal(calculateLegacyShadowCharge({ model: text, phase: "quote", usage: { inputTokens: "1000", outputTokens: "100" }, internalUsdPkrRate: "300" }), "1.008");
  const tts = { id: "tts", modality: "audio", markup: 2.2, per1kCharsUsd: 0.085 };
  assert.equal(calculateLegacyShadowCharge({ model: tts, phase: "settlement", usage: { characters: "10000" }, internalUsdPkrRate: "300" }), "561");
  const image = { id: "image", modality: "image", markup: 2.25, flatUsd: 0.025 };
  assert.equal(calculateLegacyShadowCharge({ model: image, phase: "settlement", usage: { images: "1" }, internalUsdPkrRate: "300" }), "16.875");
  assert.equal(calculateLegacyShadowCharge({ model: image, phase: "failure", usage: { images: "1" }, internalUsdPkrRate: "300" }), "0");
});

test("provider fallback remains provider-priced and unavailable or stale rules fail closed", () => {
  const fixture = fixtures[0];
  const providerA = row(fixture);
  const providerB = row(fixture, { id: "provider-b-rule", provider_key: "provider-b", input_token_price: "0.00001" });
  const selected = selectPricingRule([providerA, providerB], { providerKey: "provider-b", modelId: "fixture-model", upstreamModel: "provider/model", at: new Date("2026-09-26T00:00:00Z") });
  assert.equal(selected.providerKey, "provider-b");
  assert.equal(selected.rates.inputToken, "0.00001");
  assert.throws(() => selectPricingRule([], { providerKey: "provider-a", modelId: "fixture-model", upstreamModel: "provider/model" }), (error) => error instanceof PricingUnavailableError && error.code === "RULE_NOT_FOUND");
  assert.throws(() => selectPricingRule([row(fixture, { status: "stale" })], { providerKey: "provider-a", modelId: "fixture-model", upstreamModel: "provider/model" }), (error) => error instanceof PricingUnavailableError && error.code === "RULE_STALE");
});

test("failure, duplicate callback, and reservation shortfall outcomes remain financially safe", () => {
  assert.equal(mediaCallbackDecision("completed", "completed"), "duplicate");
  assert.equal(mediaCallbackDecision("failed", "failed"), "duplicate");
  assert.equal(mediaCallbackDecision("processing", "failed"), "fail");
  assert.equal(evaluateReservationCoverage("10", "10").covered, true);
  assert.equal(evaluateReservationCoverage("10.000001", "10").anomaly?.severity, "critical");
});

test("database contracts enforce duplicate request, concurrent capture, shadow idempotency and wallet reconciliation", () => {
  const migrationsDir = join(here, "..", "..", "supabase", "migrations");
  const sql = readdirSync(migrationsDir).filter((name) => name.endsWith(".sql"))
    .map((name) => readFileSync(join(migrationsDir, name), "utf8")).join("\n").toLowerCase();
  assert.match(sql, /constraint billing_quotes_request_key unique \(request_idempotency_id\)/);
  assert.match(sql, /quote_id uuid not null unique references public\.billing_quotes/);
  assert.match(sql, /for update/);
  assert.match(sql, /billing_shadow_validations_phase_key unique \(quote_id, phase\)/);
  assert.match(sql, /wallet_reserved_balance_mismatches/);
  assert.match(sql, /duplicate_settlements/);
});
