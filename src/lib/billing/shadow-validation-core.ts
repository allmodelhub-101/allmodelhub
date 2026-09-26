import Decimal from "decimal.js";
import type { DecimalString } from "./money";

Decimal.set({ precision: 100, rounding: Decimal.ROUND_HALF_UP, toExpNeg: -1_000_000, toExpPos: 1_000_000 });

function exact(value: string, name: string) {
  const parsed = new Decimal(value);
  if (!parsed.isFinite() || parsed.lt(0)) throw new TypeError(`${name} must be a nonnegative exact decimal.`);
  return parsed;
}

function text(value: Decimal) {
  return (value.isZero() ? "0" : value.toFixed()) as DecimalString;
}

export type ShadowSeverity = "low" | "medium" | "high" | "critical";

export type ShadowComparison = Readonly<{
  legacyExpectedChargeCredits: DecimalString;
  billingV2ChargeCredits: DecimalString;
  varianceCredits: DecimalString;
  absoluteVarianceCredits: DecimalString;
  relativeVariance: DecimalString | null;
  toleranceCredits: DecimalString;
  mismatch: boolean;
  severity: ShadowSeverity | null;
}>;

export function compareShadowCharges(input: Readonly<{
  legacyExpectedChargeCredits: string;
  billingV2ChargeCredits: string;
  absoluteToleranceCredits?: string;
  relativeTolerance?: string;
}>): ShadowComparison {
  const legacy = exact(input.legacyExpectedChargeCredits, "legacyExpectedChargeCredits");
  const v2 = exact(input.billingV2ChargeCredits, "billingV2ChargeCredits");
  const absoluteTolerance = exact(input.absoluteToleranceCredits ?? "0.000001", "absoluteToleranceCredits");
  const relativeTolerance = exact(input.relativeTolerance ?? "0.01", "relativeTolerance");
  const variance = v2.minus(legacy);
  const absoluteVariance = variance.abs();
  const relativeVariance = legacy.isZero() ? null : absoluteVariance.div(legacy);
  const tolerance = Decimal.max(absoluteTolerance, legacy.mul(relativeTolerance));
  const mismatch = absoluteVariance.gt(tolerance);
  let severity: ShadowSeverity | null = null;
  if (mismatch) {
    if (absoluteVariance.gte(1) || (relativeVariance?.gte("0.5") ?? false)) severity = "critical";
    else if (absoluteVariance.gte("0.1") || (relativeVariance?.gte("0.25") ?? false)) severity = "high";
    else if (relativeVariance?.gte("0.1") ?? false) severity = "medium";
    else severity = "low";
  }
  return {
    legacyExpectedChargeCredits: text(legacy),
    billingV2ChargeCredits: text(v2),
    varianceCredits: text(variance),
    absoluteVarianceCredits: text(absoluteVariance),
    relativeVariance: relativeVariance ? text(relativeVariance) : null,
    toleranceCredits: text(tolerance),
    mismatch,
    severity,
  };
}

export function failureShadowComparison() {
  return compareShadowCharges({ legacyExpectedChargeCredits: "0", billingV2ChargeCredits: "0" });
}
