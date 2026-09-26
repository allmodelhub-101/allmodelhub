import Decimal from "decimal.js";
import type { DecimalString } from "./money";
import type { AuthoritativePrice, PricingDimensions, ValidatedPricingRule } from "./pricing-registry-core";
import type { NormalizedUsage } from "./types";
import type { ResolvedBillingProviderRoute } from "./provider-route-core";

Decimal.set({ precision: 100, rounding: Decimal.ROUND_HALF_UP, toExpNeg: -1_000_000, toExpPos: 1_000_000 });

function decimal(value: string | Decimal) {
  const parsed = value instanceof Decimal ? value : new Decimal(value);
  if (!parsed.isFinite()) throw new TypeError("Decimal value must be finite.");
  return parsed;
}

function decimalString(value: string | Decimal) {
  const parsed = decimal(value);
  return (parsed.isZero() ? "0" : parsed.toFixed()) as DecimalString;
}

export type QuoteKind = "deterministic" | "variable";
export type ReservationKind = "deterministic" | "maximum";

export type ProfitabilityPolicy = Readonly<{
  minimumRevenueCostRatio: DecimalString;
  minimumProfitPkr: DecimalString;
  walletReservationQuantumCredits: DecimalString;
}>;

export type BillingQuotePlan = Readonly<{
  kind: QuoteKind;
  reservationKind: ReservationKind;
  estimatedProviderCostUsd: DecimalString;
  estimatedCustomerChargeCredits: DecimalString;
  reservationCredits: DecimalString;
  explicitProductMinimumCredits: DecimalString | null;
  inputDimensions: Readonly<Record<string, unknown>>;
  pricingSnapshot: Readonly<Record<string, unknown>>;
  reservationBasis: Readonly<Record<string, unknown>>;
}>;

export class QuoteReservationError extends Error {
  readonly code:
    | "MAXIMUM_USAGE_REQUIRED"
    | "MAXIMUM_BELOW_ESTIMATE"
    | "PROFITABILITY_POLICY_INVALID"
    | "UNPROFITABLE_QUOTE"
    | "PRODUCT_MINIMUM_INVALID"
    | "ZERO_RESERVATION";

  constructor(code: QuoteReservationError["code"], message: string) {
    super(message);
    this.name = "QuoteReservationError";
    this.code = code;
  }
}

function nonnegativeExact(value: unknown, code: "PROFITABILITY_POLICY_INVALID" | "PRODUCT_MINIMUM_INVALID", name: string) {
  if (typeof value !== "string" || !value.trim()) throw new QuoteReservationError(code, `${name} must be an exact decimal string.`);
  try {
    const parsed = decimal(value);
    if (parsed.lt(0)) throw new QuoteReservationError(code, `${name} cannot be negative.`);
    return decimalString(parsed);
  } catch (error) {
    if (error instanceof QuoteReservationError) throw error;
    throw new QuoteReservationError(code, `${name} must be an exact decimal string.`);
  }
}

export function validateProfitabilityPolicy(input: Readonly<{
  minimumRevenueCostRatio: unknown;
  minimumProfitPkr: unknown;
  walletReservationQuantumCredits: unknown;
}>): ProfitabilityPolicy {
  const ratio = nonnegativeExact(input.minimumRevenueCostRatio, "PROFITABILITY_POLICY_INVALID", "minimumRevenueCostRatio");
  if (decimal(ratio).lt(1)) {
    throw new QuoteReservationError("PROFITABILITY_POLICY_INVALID", "minimumRevenueCostRatio must be at least 1.");
  }
  const quantum = nonnegativeExact(input.walletReservationQuantumCredits, "PROFITABILITY_POLICY_INVALID", "walletReservationQuantumCredits");
  if (!decimal(quantum).gt(0)) {
    throw new QuoteReservationError("PROFITABILITY_POLICY_INVALID", "walletReservationQuantumCredits must be greater than zero.");
  }
  return {
    minimumRevenueCostRatio: ratio,
    minimumProfitPkr: nonnegativeExact(input.minimumProfitPkr, "PROFITABILITY_POLICY_INVALID", "minimumProfitPkr"),
    walletReservationQuantumCredits: quantum,
  };
}

function configuredProductMinimum(rule: ValidatedPricingRule): DecimalString | null {
  const value = rule.metadata.productMinimumCredits;
  return value === undefined
    ? null
    : nonnegativeExact(value, "PRODUCT_MINIMUM_INVALID", "metadata.productMinimumCredits");
}

function chargeWithMinimum(rawCharge: DecimalString, minimum: DecimalString | null) {
  if (!minimum) return rawCharge;
  return decimalString(Decimal.max(decimal(rawCharge), decimal(minimum)));
}

function roundReservationUp(amount: DecimalString, quantum: DecimalString) {
  const unit = decimal(quantum);
  return decimalString(decimal(amount).div(unit).ceil().mul(unit));
}

function assertProfitable(
  price: AuthoritativePrice,
  revenueCredits: DecimalString,
  policy: ProfitabilityPolicy,
  scenario: "estimated" | "maximum",
) {
  const providerCostPkr = decimal(price.providerCostUsd).mul(decimal(price.snapshot.internalUsdPkrRate));
  const minimumSafeRevenue = providerCostPkr
    .mul(decimal(policy.minimumRevenueCostRatio))
    .plus(decimal(policy.minimumProfitPkr));
  if (decimal(revenueCredits).lt(minimumSafeRevenue)) {
    throw new QuoteReservationError(
      "UNPROFITABLE_QUOTE",
      `${scenario} customer revenue is below the configured safe provider cost.`,
    );
  }
}

export function buildBillingQuotePlan(input: Readonly<{
  kind: QuoteKind;
  route: ResolvedBillingProviderRoute;
  rule: ValidatedPricingRule;
  estimatedUsage: NormalizedUsage;
  maximumUsage?: NormalizedUsage;
  dimensions?: PricingDimensions;
  options?: Readonly<Record<string, unknown>>;
  estimatedPrice: AuthoritativePrice;
  maximumPrice?: AuthoritativePrice;
  profitabilityPolicy: ProfitabilityPolicy;
}>): BillingQuotePlan {
  if (input.kind === "variable" && (!input.maximumUsage || !input.maximumPrice)) {
    throw new QuoteReservationError("MAXIMUM_USAGE_REQUIRED", "Variable paid requests require a server-derived maximum usage envelope.");
  }

  const productMinimum = configuredProductMinimum(input.rule);
  const estimatedCharge = chargeWithMinimum(input.estimatedPrice.customerChargeCredits, productMinimum);
  const maximumPrice = input.kind === "deterministic" ? input.estimatedPrice : input.maximumPrice!;
  const maximumCharge = chargeWithMinimum(maximumPrice.customerChargeCredits, productMinimum);
  const reservationCharge = roundReservationUp(maximumCharge, input.profitabilityPolicy.walletReservationQuantumCredits);
  if (decimal(maximumCharge).lt(decimal(estimatedCharge))
    || decimal(maximumPrice.providerCostUsd).lt(decimal(input.estimatedPrice.providerCostUsd))) {
    throw new QuoteReservationError("MAXIMUM_BELOW_ESTIMATE", "The maximum usage envelope cannot cost less than the estimate.");
  }
  if (!decimal(reservationCharge).gt(0)) {
    throw new QuoteReservationError("ZERO_RESERVATION", "A paid request must reserve a positive amount.");
  }

  assertProfitable(input.estimatedPrice, estimatedCharge, input.profitabilityPolicy, "estimated");
  assertProfitable(maximumPrice, maximumCharge, input.profitabilityPolicy, "maximum");

  const reservationKind: ReservationKind = input.kind === "deterministic" ? "deterministic" : "maximum";
  return {
    kind: input.kind,
    reservationKind,
    estimatedProviderCostUsd: input.estimatedPrice.providerCostUsd,
    estimatedCustomerChargeCredits: estimatedCharge,
    reservationCredits: reservationCharge,
    explicitProductMinimumCredits: productMinimum,
    inputDimensions: {
      modelId: input.route.modelId,
      providerKey: input.route.providerKey,
      upstreamModel: input.route.upstreamModel,
      options: input.options ?? {},
      pricingDimensions: input.dimensions ?? {},
      estimatedUsage: input.estimatedUsage,
      maximumUsage: input.kind === "variable" ? input.maximumUsage : input.estimatedUsage,
    },
    pricingSnapshot: {
      ...input.estimatedPrice.snapshot,
      providerRouteId: input.route.routeId,
      providerRoutePriority: input.route.priority,
      quoteKind: input.kind,
      rawEstimatedCustomerChargeCredits: input.estimatedPrice.customerChargeCredits,
      explicitProductMinimumCredits: productMinimum,
      profitabilityPolicy: input.profitabilityPolicy,
    },
    reservationBasis: {
      kind: reservationKind,
      maximumUsage: input.kind === "variable" ? input.maximumUsage : input.estimatedUsage,
      maximumProviderCostUsd: maximumPrice.providerCostUsd,
      maximumCustomerChargeCredits: maximumCharge,
      walletReservationQuantumCredits: input.profitabilityPolicy.walletReservationQuantumCredits,
      reservationIsCustomerCharge: false,
    },
  };
}

export type ReservationCoverage = Readonly<{
  covered: boolean;
  actualChargeCredits: DecimalString;
  reservationCredits: DecimalString;
  shortfallCredits: DecimalString;
  anomaly: null | Readonly<{
    type: "reservation_shortfall";
    severity: "critical";
    expectedReservationCredits: DecimalString;
    observedChargeCredits: DecimalString;
  }>;
}>;

export function evaluateReservationCoverage(actualCharge: string, reservation: string): ReservationCoverage {
  const actual = nonnegativeExact(actualCharge, "PROFITABILITY_POLICY_INVALID", "actualChargeCredits");
  const reserved = nonnegativeExact(reservation, "PROFITABILITY_POLICY_INVALID", "reservationCredits");
  const shortfall = Decimal.max(0, decimal(actual).minus(decimal(reserved)));
  const covered = shortfall.isZero();
  return {
    covered,
    actualChargeCredits: actual,
    reservationCredits: reserved,
    shortfallCredits: decimalString(shortfall),
    anomaly: covered ? null : {
      type: "reservation_shortfall",
      severity: "critical",
      expectedReservationCredits: reserved,
      observedChargeCredits: actual,
    },
  };
}
