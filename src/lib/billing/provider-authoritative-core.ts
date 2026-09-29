import Decimal from "decimal.js";
import type { DecimalString } from "./money";

Decimal.set({ precision: 100, rounding: Decimal.ROUND_HALF_UP, toExpNeg: -1_000_000, toExpPos: 1_000_000 });

const DECIMAL = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;

function exact(value: string, name: string) {
  if (!DECIMAL.test(value.trim())) throw new TypeError(`${name} must be an exact non-negative decimal string.`);
  const parsed = new Decimal(value);
  if (!parsed.isFinite() || parsed.isNegative()) throw new TypeError(`${name} must be non-negative.`);
  return parsed;
}

function positive(value: string, name: string) {
  const parsed = exact(value, name);
  if (!parsed.gt(0)) throw new RangeError(`${name} must be greater than zero.`);
  return parsed;
}

function text(value: Decimal) {
  return (value.isZero() ? "0" : value.toFixed()) as DecimalString;
}

export type ProviderAuthoritativeCharge = Readonly<{
  providerCostUsd: DecimalString;
  internalUsdPkrRate: DecimalString;
  markup: DecimalString;
  providerCostPkr: DecimalString;
  customerChargeCredits: DecimalString;
  profitPkr: DecimalString;
  marginPercent: DecimalString | null;
}>;

export function calculateProviderAuthoritativeCharge(input: Readonly<{
  providerCostUsd: string;
  internalUsdPkrRate: string;
  markup: string;
  walletQuantumCredits?: string;
}>): ProviderAuthoritativeCharge {
  const providerUsd = exact(input.providerCostUsd, "providerCostUsd");
  const fx = positive(input.internalUsdPkrRate, "internalUsdPkrRate");
  const markup = positive(input.markup, "markup");
  if (markup.lt(1)) throw new RangeError("markup must be at least 1 to prevent a normal negative-margin settlement.");
  const quantum = positive(input.walletQuantumCredits ?? "0.000001", "walletQuantumCredits");
  const providerPkr = providerUsd.mul(fx);
  const rawCharge = providerPkr.mul(markup);
  const charge = rawCharge.isZero() ? rawCharge : rawCharge.div(quantum).ceil().mul(quantum);
  const profit = charge.minus(providerPkr);
  if (profit.isNegative()) throw new RangeError("Customer charge cannot be below provider cost.");
  return {
    providerCostUsd: text(providerUsd),
    internalUsdPkrRate: text(fx),
    markup: text(markup),
    providerCostPkr: text(providerPkr),
    customerChargeCredits: text(charge),
    profitPkr: text(profit),
    marginPercent: charge.isZero() ? null : text(profit.div(charge).mul(100)),
  };
}

export function authorizationCoverage(chargeCredits: string, authorizationCredits: string) {
  const charge = exact(chargeCredits, "chargeCredits");
  const authorization = positive(authorizationCredits, "authorizationCredits");
  const shortfall = Decimal.max(0, charge.minus(authorization));
  return {
    covered: shortfall.isZero(),
    shortfallCredits: text(shortfall),
    chargeCredits: text(charge),
    authorizationCredits: text(authorization),
  } as const;
}

export function publicSettlementSummary(input: Readonly<{
  receiptId?: string;
  walletTransactionId?: string | null;
  chargeCredits?: string;
  status: "settled" | "pending_reconciliation" | "released";
}>) {
  return {
    status: input.status,
    ...(input.receiptId ? { receiptId: input.receiptId } : {}),
    ...(input.walletTransactionId ? { walletTransactionId: input.walletTransactionId } : {}),
    ...(input.chargeCredits !== undefined ? { chargeCredits: input.chargeCredits } : {}),
  };
}
