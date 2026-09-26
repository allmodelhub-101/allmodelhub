import Decimal from "decimal.js";
import type { DecimalString } from "./money";
import { calculateAuthoritativePrice, type PricingDimensions, type ValidatedPricingRule } from "./pricing-registry-core";
import {
  chargeWithMinimum,
  configuredProductMinimum,
  evaluateReservationCoverage,
  roundWalletAmountUp,
  type ProfitabilityPolicy,
} from "./quote-reservation-core";
import type { Currency, NormalizedUsage } from "./types";

Decimal.set({ precision: 100, rounding: Decimal.ROUND_HALF_UP, toExpNeg: -1_000_000, toExpPos: 1_000_000 });

function exact(value: string, field: string) {
  const parsed = new Decimal(value);
  if (!parsed.isFinite() || parsed.lt(0)) throw new Error(`INVALID_USAGE:${field}`);
  return parsed;
}

function decimalString(value: Decimal) {
  return (value.isZero() ? "0" : value.toFixed()) as DecimalString;
}

export function normalizeExactUsage(usage: NormalizedUsage): NormalizedUsage {
  const decimalFields = [
    "inputTokens", "outputTokens", "reasoningTokens", "cachedInputTokens", "cachedOutputTokens",
    "cacheWriteTokens", "characters", "seconds", "images", "references", "fps",
  ] as const;
  const normalized: Record<string, unknown> = {};
  for (const field of decimalFields) {
    const value = usage[field];
    if (value !== undefined) normalized[field] = decimalString(exact(value, field));
  }
  for (const field of ["resolution", "quality", "mode", "inputType"] as const) {
    if (usage[field] !== undefined) normalized[field] = usage[field];
  }
  if (usage.dimensions) normalized.dimensions = usage.dimensions;
  return normalized as NormalizedUsage;
}

export function prepareUsageSettlement(input: Readonly<{
  rule: ValidatedPricingRule;
  usage: NormalizedUsage;
  dimensions?: PricingDimensions;
  internalUsdPkrRate: string;
  profitabilityPolicy: ProfitabilityPolicy;
  reservationCredits: string;
  providerReportedCost?: Readonly<{ amount: string; currency: Currency }> | null;
  usageSource: string;
  providerRequestId?: string | null;
  providerTaskId?: string | null;
}>) {
  const normalizedUsage = normalizeExactUsage(input.usage);
  const calculated = calculateAuthoritativePrice({
    rule: input.rule,
    usage: normalizedUsage,
    dimensions: input.dimensions,
    internalUsdPkrRate: input.internalUsdPkrRate,
  });
  const chargeCredits = roundWalletAmountUp(
    chargeWithMinimum(calculated.customerChargeCredits, configuredProductMinimum(input.rule)),
    input.profitabilityPolicy.walletReservationQuantumCredits,
  );
  let finalProviderCostUsd = calculated.providerCostUsd;
  let costStatus: "usage_calculated" | "provider_reported" = "usage_calculated";
  if (input.providerReportedCost) {
    const reported = exact(input.providerReportedCost.amount, "providerReportedCost");
    if (input.providerReportedCost.currency === "CREDIT") throw new Error("PROVIDER_COST_CREDIT_UNSUPPORTED");
    finalProviderCostUsd = decimalString(input.providerReportedCost.currency === "USD"
      ? reported
      : reported.div(exact(input.internalUsdPkrRate, "internalUsdPkrRate")));
    costStatus = "provider_reported";
  }
  return {
    normalizedUsage,
    calculatedProviderCostUsd: calculated.providerCostUsd,
    finalProviderCostUsd,
    chargeCredits,
    costStatus,
    coverage: evaluateReservationCoverage(chargeCredits, input.reservationCredits),
    usageSnapshot: {
      ...normalizedUsage,
      source: input.usageSource,
      providerRequestId: input.providerRequestId ?? null,
      providerTaskId: input.providerTaskId ?? null,
      providerReportedCost: input.providerReportedCost ?? null,
      calculatedProviderCostUsd: calculated.providerCostUsd,
    },
  } as const;
}
