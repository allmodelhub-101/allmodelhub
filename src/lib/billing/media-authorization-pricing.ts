import Decimal from "decimal.js";
import { calculateAuthoritativePrice, selectPricingRule, type FormulaEvaluator, type PricingDimensions, type PricingRegistryRow } from "./pricing-registry-core.ts";
import type { NormalizedUsage } from "./types";
import type { DecimalString } from "./money";

// Rates and dimensions must be provider-verified policy data, never inferred
// from approximate published per-second conversions.
export const videoTokenFormulaEvaluator: FormulaEvaluator = ({ formula, usage, dimensions }) => {
  const rate = dimensions.inputType === "video" ? formula.usdPerMillionReferenceVideoTokens : formula.usdPerMillionTokens;
  const sizes = formula.resolutionDimensions as Record<string, { width: string; height: string }> | undefined;
  const size = sizes?.[dimensions.resolution || ""];
  if (typeof rate !== "string" || !size || typeof size.width !== "string" || typeof size.height !== "string"
    || typeof formula.fps !== "string" || typeof formula.tokenDivisor !== "string" || !usage.seconds) {
    throw new Error("BILLING_V3_MEDIA_FORMULA_INCOMPLETE");
  }
  const values = [rate, size.width, size.height, formula.fps, formula.tokenDivisor, usage.seconds].map((v) => new Decimal(v));
  if (values.some((v) => !v.isFinite() || v.lte(0))) throw new Error("BILLING_V3_MEDIA_FORMULA_INCOMPLETE");
  const [usdPerMillion, width, height, fps, divisor, seconds] = values;
  const tokens = seconds.mul(width).mul(height).mul(fps).div(divisor).ceil();
  return { amount: tokens.mul(usdPerMillion).div(1_000_000).toFixed() as DecimalString, operation: "replace" };
};

// The versioned definition belongs to the V3 policy. The shared decimal
// evaluator is pure; it does not consult historical pricing tables.
export function priceMediaAuthorization(input: Readonly<{
  metadata: Record<string, unknown>;
  providerKey: string;
  modelId: string;
  upstreamModel: string;
  pricingVersion: string;
  markup: string;
  internalUsdPkrRate: string;
  usage: NormalizedUsage;
  dimensions?: PricingDimensions;
}>) {
  const definition = input.metadata.media_authorization_pricing;
  if (!definition || typeof definition !== "object" || Array.isArray(definition)) {
    throw new Error("BILLING_V3_MEDIA_PRICING_UNAVAILABLE");
  }
  const row = { ...definition, model_markup: input.markup, model_active: true } as PricingRegistryRow;
  const rule = selectPricingRule([row], {
    providerKey: input.providerKey, modelId: input.modelId,
    upstreamModel: input.upstreamModel, pricingVersion: input.pricingVersion,
  });
  return calculateAuthoritativePrice({ rule, usage: input.usage,
    dimensions: input.dimensions, internalUsdPkrRate: input.internalUsdPkrRate,
    formulaEvaluators: { video_tokens: videoTokenFormulaEvaluator } });
}

