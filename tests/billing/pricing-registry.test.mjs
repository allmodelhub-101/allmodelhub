import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateAuthoritativePrice,
  PricingUnavailableError,
  selectPricingRule,
} from "../../src/lib/billing/pricing-registry-core.ts";

const NOW = new Date("2026-09-26T12:00:00.000Z");

function row(overrides = {}) {
  return {
    id: "rule-primary-v1",
    provider_key: "apimodels",
    model_id: "model-one",
    upstream_model: "provider/model-one",
    pricing_version: "v1",
    billing_type: "flat",
    currency: "USD",
    input_token_price: null,
    output_token_price: null,
    cached_token_price: null,
    cache_write_token_price: null,
    flat_price: "0.1",
    per_image_price: null,
    per_second_price: null,
    per_minute_price: null,
    per_1k_character_price: null,
    per_reference_image_price: null,
    resolution_dimensions: {},
    quality_dimensions: {},
    mode_dimensions: {},
    input_type_dimensions: {},
    formula: {},
    metadata: {},
    effective_from: "2026-09-01T00:00:00.000Z",
    effective_until: null,
    verified_at: "2026-09-25T00:00:00.000Z",
    source_name: "provider price sheet",
    source_url: "https://provider.example/pricing",
    source_metadata: {},
    status: "verified",
    active: true,
    model_markup: "2.25",
    model_active: true,
    ...overrides,
  };
}

function selector(overrides = {}) {
  return {
    providerKey: "apimodels",
    modelId: "model-one",
    upstreamModel: "provider/model-one",
    at: NOW,
    ...overrides,
  };
}

function resolve(ruleRow, selectorOverrides = {}) {
  return selectPricingRule([ruleRow], selector(selectorOverrides));
}

function price(ruleRow, usage = {}, dimensions = {}, options = {}) {
  return calculateAuthoritativePrice({
    rule: resolve(ruleRow),
    usage,
    dimensions,
    internalUsdPkrRate: options.fx ?? "310.125",
    formulaEvaluators: options.formulaEvaluators,
  });
}

function assertPricingError(fn, code) {
  assert.throws(fn, (error) => error instanceof PricingUnavailableError && error.code === code);
}

test("selects the exact provider and never reuses the primary provider price for fallback", () => {
  const rows = [
    row({ id: "primary", provider_key: "apimodels", flat_price: "0.1" }),
    row({ id: "fallback", provider_key: "haimaker", flat_price: "0.22" }),
  ];
  const primary = selectPricingRule(rows, selector({ providerKey: "apimodels" }));
  const fallback = selectPricingRule(rows, selector({ providerKey: "haimaker" }));
  assert.equal(primary.id, "primary");
  assert.equal(primary.rates.flat, "0.1");
  assert.equal(fallback.id, "fallback");
  assert.equal(fallback.rates.flat, "0.22");
  assertPricingError(() => selectPricingRule(rows, selector({ providerKey: "unknown" })), "RULE_NOT_FOUND");
  assertPricingError(() => selectPricingRule(rows, selector({ providerKey: "api-models" })), "RULE_NOT_FOUND");
});

test("selects and snapshots the requested pricing version and exact FX rate", () => {
  const rows = [row({ id: "v1", pricing_version: "v1", flat_price: "0.1" }), row({ id: "v2", pricing_version: "v2", flat_price: "0.2" })];
  const rule = selectPricingRule(rows, selector({ pricingVersion: "v2" }));
  const result = calculateAuthoritativePrice({ rule, usage: {}, internalUsdPkrRate: "307.777777777777777777" });
  assert.equal(result.providerCost.amount, "0.2");
  assert.equal(result.snapshot.pricingVersion, "v2");
  assert.equal(result.snapshot.internalUsdPkrRate, "307.777777777777777777");
  assert.equal(result.snapshot.markup, "2.25");
  assert.equal(result.customerChargeCredits, "138.49999999999999999965");
});

test("fails closed for unavailable, stale, blocked, pending, inactive, future, and expired rules", () => {
  assertPricingError(() => selectPricingRule([], selector()), "RULE_NOT_FOUND");
  assertPricingError(() => resolve(row({ status: "stale" })), "RULE_STALE");
  assertPricingError(() => resolve(row({ status: "blocked" })), "RULE_BLOCKED");
  assertPricingError(() => resolve(row({ status: "pending_review" })), "RULE_PENDING_REVIEW");
  assertPricingError(() => resolve(row({ active: false })), "RULE_INACTIVE");
  assertPricingError(() => resolve(row({ model_active: false })), "MODEL_INACTIVE");
  assertPricingError(() => resolve(row({ effective_from: "2026-09-27T00:00:00.000Z" })), "RULE_NOT_EFFECTIVE");
  assertPricingError(() => resolve(row({ effective_until: "2026-09-26T11:59:59.000Z" })), "RULE_EXPIRED");
});

test("a newer blocked rule fails closed instead of falling back to an older verified price", () => {
  const rules = [
    row({ id: "old-verified", pricing_version: "v1", effective_from: "2026-09-01T00:00:00.000Z" }),
    row({ id: "new-block", pricing_version: "v2", status: "blocked", active: false, effective_from: "2026-09-20T00:00:00.000Z" }),
  ];
  assertPricingError(() => selectPricingRule(rules, selector()), "RULE_BLOCKED");
});

test("calculates token, cached-token, and cache-write pricing exactly", () => {
  const result = price(row({
    billing_type: "token",
    flat_price: null,
    input_token_price: "0.000001",
    output_token_price: "0.000002",
    cached_token_price: "0.0000005",
    cache_write_token_price: "0.00000075",
  }), {
    inputTokens: "10",
    outputTokens: "5",
    cachedInputTokens: "4",
    cachedOutputTokens: "2",
    cacheWriteTokens: "2",
  });
  assert.equal(result.providerCost.amount, "0.0000245");
});

test("calculates character and TTS pricing proportionally per 1,000 characters", () => {
  const result = price(row({ billing_type: "character", flat_price: null, per_1k_character_price: "0.04" }), { characters: "1500" });
  assert.equal(result.providerCost.amount, "0.06");
});

test("supports fixed, per-image, reference-image, and duration pricing", () => {
  assert.equal(price(row({ flat_price: "0.25" })).providerCost.amount, "0.25");
  assert.equal(price(row({ billing_type: "image", flat_price: null, per_image_price: "0.03", per_reference_image_price: "0.01" }), { images: "2", references: "3" }).providerCost.amount, "0.09");
  assert.equal(price(row({ billing_type: "time", flat_price: null, per_second_price: "0.02" }), { seconds: "6" }).providerCost.amount, "0.12");
  assert.equal(price(row({ billing_type: "time", flat_price: null, per_minute_price: "0.6" }), { seconds: "30" }).providerCost.amount, "0.3");
});

test("requires and applies validated resolution and mode-specific pricing", () => {
  const ruleRow = row({
    billing_type: "image",
    flat_price: null,
    per_image_price: "0.03",
    resolution_dimensions: { "4K": { flat: "0.1" }, "2K": { flat: "0.04" } },
    mode_dimensions: { edit: { perReferenceImage: "0.02" }, generate: { flat: "0" } },
  });
  const result = price(ruleRow, { images: "1", references: "2" }, { resolution: "4K", mode: "edit" });
  assert.equal(result.providerCost.amount, "0.17");
  assertPricingError(() => price(ruleRow, { images: "1" }, { mode: "generate" }), "DIMENSION_REQUIRED");
  assertPricingError(() => price(ruleRow, { images: "1" }, { resolution: "8K", mode: "generate" }), "DIMENSION_UNSUPPORTED");
});

test("supports safe extensible formulas and blocks unknown formula kinds", () => {
  const linear = row({
    billing_type: "formula",
    flat_price: null,
    formula: { kind: "linear", operation: "replace", base: "0.01", terms: [{ dimension: "fps", rate: "0.001" }] },
  });
  assert.equal(price(linear, { fps: "24" }).providerCost.amount, "0.034");

  const custom = row({ billing_type: "formula", flat_price: null, formula: { kind: "provider_matrix" } });
  assert.equal(price(custom, {}, {}, { formulaEvaluators: { provider_matrix: () => ({ amount: "0.123", operation: "replace" }) } }).providerCost.amount, "0.123");
  assertPricingError(() => price(custom), "FORMULA_UNSUPPORTED");
});

test("rejects missing billable usage and invalid financial configuration", () => {
  assertPricingError(() => price(row({ billing_type: "time", flat_price: null, per_second_price: "0.02" })), "USAGE_REQUIRED");
  assertPricingError(() => resolve(row({ model_markup: "0" })), "MARKUP_INVALID");
  assertPricingError(() => resolve(row({ billing_type: "time", flat_price: null, per_second_price: "0.1", per_minute_price: "1" })), "RULE_INVALID");
  assertPricingError(() => price(row(), {}, {}, { fx: "0" }), "FX_RATE_UNAVAILABLE");
  assertPricingError(() => resolve(row({ flat_price: 0.1 })), "RULE_INVALID");
});

test("fails closed when providers report cache usage without validated cache rates", () => {
  assert.throws(
    () => price(row({ billing_type: "token", input_token_price: "0.000001", output_token_price: "0.000002", cached_token_price: null }), {
      inputTokens: "10", outputTokens: "2", cachedInputTokens: "1",
    }),
    (error) => error instanceof PricingUnavailableError && error.code === "RULE_INVALID",
  );
  assert.throws(
    () => price(row({ billing_type: "token", input_token_price: "0.000001", output_token_price: "0.000002", cache_write_token_price: null }), {
      inputTokens: "10", outputTokens: "2", cacheWriteTokens: "1",
    }),
    (error) => error instanceof PricingUnavailableError && error.code === "RULE_INVALID",
  );
});
