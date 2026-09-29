import Decimal from "decimal.js";
import type { NormalizedProviderUsage } from "@/lib/providers/types";
import type { DecimalString } from "./money";
import type { PricingDimensions, ValidatedPricingRule } from "./pricing-registry-core";
import { type ProfitabilityPolicy, type ReservationCoverage } from "./quote-reservation-core";
import type { NormalizedUsage } from "./types";
import { prepareUsageSettlement } from "./usage-settlement-core";

Decimal.set({ precision: 100, rounding: Decimal.ROUND_HALF_UP, toExpNeg: -1_000_000, toExpPos: 1_000_000 });

function exact(value: string) {
  const parsed = new Decimal(value);
  if (!parsed.isFinite() || parsed.lt(0)) throw new TextBillingError("INVALID_USAGE", "Usage and costs must be nonnegative exact decimals.");
  return parsed;
}

function text(value: Decimal) {
  return value.isZero() ? "0" as DecimalString : value.toFixed() as DecimalString;
}

export class TextBillingError extends Error {
  readonly code: "EXACT_USAGE_REQUIRED" | "INVALID_USAGE" | "PROVIDER_COST_INVALID";

  constructor(code: TextBillingError["code"], message: string) {
    super(message);
    this.name = "TextBillingError";
    this.code = code;
  }
}

export function estimateTextUsageForReservation(input: Readonly<{
  text: string;
  maxOutputTokens: number;
  inputOverheadTokens?: number;
}>) {
  const overhead = new Decimal(input.inputOverheadTokens ?? 0);
  const estimatedInput = new Decimal(input.text.length).div("3.4").ceil().plus(overhead);
  // UTF-8 byte length is deliberately conservative for pre-request reservation;
  // it is never used as authoritative successful-operation usage.
  const maximumInput = new Decimal(new TextEncoder().encode(input.text).byteLength).plus(overhead);
  return {
    estimatedUsage: {
      inputTokens: text(estimatedInput),
      outputTokens: text(new Decimal(input.maxOutputTokens).div(2).ceil()),
    } satisfies NormalizedUsage,
    maximumUsage: {
      inputTokens: text(maximumInput),
      outputTokens: text(new Decimal(input.maxOutputTokens)),
    } satisfies NormalizedUsage,
  } as const;
}

export type PreparedTextSettlement = Readonly<{
  normalizedUsage: NormalizedUsage;
  calculatedProviderCostUsd: DecimalString;
  finalProviderCostUsd: DecimalString;
  chargeCredits: DecimalString;
  costStatus: "usage_calculated" | "provider_reported";
  providerReportedCost: NormalizedProviderUsage["providerReportedCost"] | null;
  coverage: ReservationCoverage;
  usageSnapshot: Readonly<Record<string, unknown>>;
}>;

/** @deprecated Historical Billing V2 settlement only. New requests settle from APIMODELS records. */
export function prepareTextSettlement(input: Readonly<{
  rule: ValidatedPricingRule;
  usage: NormalizedProviderUsage;
  dimensions?: PricingDimensions;
  internalUsdPkrRate: string;
  profitabilityPolicy: ProfitabilityPolicy;
  reservationCredits: string;
}>): PreparedTextSettlement {
  if (input.usage.inputTokens === undefined || input.usage.outputTokens === undefined) {
    throw new TextBillingError("EXACT_USAGE_REQUIRED", "Provider token usage is required for authoritative text settlement.");
  }
  const normalizedUsage: NormalizedUsage = {
    inputTokens: text(exact(input.usage.inputTokens)),
    outputTokens: text(exact(input.usage.outputTokens)),
    cachedInputTokens: input.usage.cachedInputTokens === undefined ? undefined : text(exact(input.usage.cachedInputTokens)),
    cacheWriteTokens: input.usage.cacheWriteTokens === undefined ? undefined : text(exact(input.usage.cacheWriteTokens)),
    reasoningTokens: input.usage.reasoningTokens === undefined ? undefined : text(exact(input.usage.reasoningTokens)),
  };
  const prepared = prepareUsageSettlement({
    rule: input.rule,
    usage: normalizedUsage,
    dimensions: input.dimensions,
    internalUsdPkrRate: input.internalUsdPkrRate,
    profitabilityPolicy: input.profitabilityPolicy,
    reservationCredits: input.reservationCredits,
    providerReportedCost: input.usage.providerReportedCost,
    usageSource: "provider_exact",
    providerRequestId: input.usage.providerRequestId,
  });

  return {
    normalizedUsage,
    calculatedProviderCostUsd: prepared.calculatedProviderCostUsd,
    finalProviderCostUsd: prepared.finalProviderCostUsd,
    chargeCredits: prepared.chargeCredits,
    costStatus: prepared.costStatus,
    providerReportedCost: input.usage.providerReportedCost ?? null,
    coverage: prepared.coverage,
    usageSnapshot: prepared.usageSnapshot,
  };
}
