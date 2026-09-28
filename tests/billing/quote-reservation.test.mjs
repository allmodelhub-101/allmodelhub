import assert from "node:assert/strict";
import test from "node:test";
import { calculateAuthoritativePrice, selectPricingRule } from "../../src/lib/billing/pricing-registry-core.ts";
import { BillingRouteUnavailableError, selectBillingProviderRoute } from "../../src/lib/billing/provider-route-core.ts";
import {
  buildBillingQuotePlan,
  evaluateReservationCoverage,
  QuoteReservationError,
  validateProfitabilityPolicy,
} from "../../src/lib/billing/quote-reservation-core.ts";

const NOW = new Date("2026-09-26T12:00:00.000Z");

function row(overrides = {}) {
  return {
    id: "rule-v1",
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
    model_markup: "2",
    model_active: true,
    ...overrides,
  };
}

function rule(overrides = {}) {
  const pricingRow = row(overrides);
  return selectPricingRule([pricingRow], {
    providerKey: pricingRow.provider_key,
    modelId: pricingRow.model_id,
    upstreamModel: pricingRow.upstream_model,
    at: NOW,
  });
}

const route = {
  routeId: "route-primary",
  modelId: "model-one",
  providerKey: "apimodels",
  upstreamModel: "provider/model-one",
  priority: 10,
  metadata: {},
};

const policy = validateProfitabilityPolicy({
  minimumRevenueCostRatio: "1.05",
  minimumProfitPkr: "0",
  walletReservationQuantumCredits: "0.000001",
});

function priced(validatedRule, usage) {
  return calculateAuthoritativePrice({ rule: validatedRule, usage, internalUsdPkrRate: "310" });
}

function plan(input = {}) {
  const validatedRule = input.rule ?? rule();
  const estimatedUsage = input.estimatedUsage ?? {};
  const estimatedPrice = priced(validatedRule, estimatedUsage);
  const maximumPrice = input.maximumUsage ? priced(validatedRule, input.maximumUsage) : undefined;
  return buildBillingQuotePlan({
    kind: input.kind ?? "deterministic",
    route,
    rule: validatedRule,
    estimatedUsage,
    maximumUsage: input.maximumUsage,
    estimatedPrice,
    maximumPrice,
    profitabilityPolicy: input.policy ?? policy,
    options: input.options,
  });
}

function assertQuoteError(fn, code) {
  assert.throws(fn, (error) => error instanceof QuoteReservationError && error.code === code);
}

test("resolves an exact database route and keeps fallback providers financially separate", () => {
  const routes = [
    { id: "primary", model_id: "model-one", provider_key: "apimodels", upstream_model: "a/model", priority: 10, active: true, metadata: {} },
    { id: "fallback", model_id: "model-one", provider_key: "haimaker", upstream_model: "h/model", priority: 20, active: true, metadata: {} },
  ];
  assert.equal(selectBillingProviderRoute(routes, { modelId: "model-one" }).routeId, "primary");
  assert.equal(selectBillingProviderRoute(routes, { modelId: "model-one", providerKey: "haimaker" }).upstreamModel, "h/model");
  assert.throws(
    () => selectBillingProviderRoute(routes, { modelId: "model-one", providerKey: "hai-maker" }),
    (error) => error instanceof BillingRouteUnavailableError && error.code === "ROUTE_NOT_FOUND",
  );
});

test("fixed-price calls quote and reserve deterministically with exact snapshots", () => {
  const result = plan({ options: { quality: "standard" } });
  assert.equal(result.kind, "deterministic");
  assert.equal(result.reservationKind, "deterministic");
  assert.equal(result.estimatedProviderCostUsd, "0.1");
  assert.equal(result.estimatedCustomerChargeCredits, "62");
  assert.equal(result.reservationCredits, "62");
  assert.equal(result.reservationBasis.reservationIsCustomerCharge, false);
  assert.equal(result.pricingSnapshot.pricingVersion, "v1");
  assert.equal(result.pricingSnapshot.internalUsdPkrRate, "310");
  assert.deepEqual(result.inputDimensions.options, { quality: "standard" });
});

test("variable calls reserve the server-derived maximum, not the estimated final charge", () => {
  const tokenRule = rule({
    billing_type: "token",
    flat_price: null,
    input_token_price: "0.001",
    output_token_price: "0.002",
  });
  const result = plan({
    kind: "variable",
    rule: tokenRule,
    estimatedUsage: { inputTokens: "100", outputTokens: "50" },
    maximumUsage: { inputTokens: "100", outputTokens: "500" },
  });
  assert.equal(result.estimatedCustomerChargeCredits, "124");
  assert.equal(result.reservationCredits, "682");
  assert.equal(result.reservationKind, "maximum");
  assert.equal(result.reservationBasis.reservationIsCustomerCharge, false);
  assertQuoteError(() => plan({ kind: "variable", rule: tokenRule, estimatedUsage: { inputTokens: "1", outputTokens: "1" } }), "MAXIMUM_USAGE_REQUIRED");
});

test("profitability validation fails closed before reservation", () => {
  const unprofitableRule = rule({ model_markup: "1" });
  assertQuoteError(() => plan({ rule: unprofitableRule }), "UNPROFITABLE_QUOTE");
  assertQuoteError(
    () => validateProfitabilityPolicy({
      minimumRevenueCostRatio: "0.99",
      minimumProfitPkr: "0",
      walletReservationQuantumCredits: "0.000001",
    }),
    "PROFITABILITY_POLICY_INVALID",
  );
});

test("tiny real prices are preserved unless an explicit product minimum is configured", () => {
  const tinyRule = rule({ flat_price: "0.000000000000000001" });
  const tiny = plan({ rule: tinyRule });
  assert.equal(tiny.estimatedCustomerChargeCredits, "0.00000000000000062");
  assert.equal(tiny.reservationCredits, "0.000001");

  const minimumRule = rule({ flat_price: "0.000000000000000001", metadata: { productMinimumCredits: "0.05" } });
  const explicit = plan({ rule: minimumRule });
  assert.equal(explicit.estimatedCustomerChargeCredits, "0.05");
  assert.equal(explicit.explicitProductMinimumCredits, "0.05");
});

test("reservation shortfalls surface a critical anomaly for fail-closed settlement", () => {
  const result = evaluateReservationCoverage("1.25", "1");
  assert.equal(result.covered, false);
  assert.equal(result.actualChargeCredits, "1.25");
  assert.equal(result.reservationCredits, "1");
  assert.equal(result.shortfallCredits, "0.25");
  assert.deepEqual(result.anomaly, {
    type: "reservation_shortfall",
    severity: "critical",
    expectedReservationCredits: "1",
    observedChargeCredits: "1.25",
  });
});
