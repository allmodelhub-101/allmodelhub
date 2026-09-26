import type { DecimalString } from "./money";

export type Currency = "USD" | "PKR" | "CREDIT";
export type PricingStatus = "verified" | "stale" | "blocked" | "pending_review";
export type BillingCostStatus = "estimated" | "usage_calculated" | "provider_reported" | "reconciled";

export type Money = Readonly<{ amount: DecimalString; currency: Currency }>;

export type NormalizedUsage = Readonly<{
  inputTokens?: DecimalString;
  outputTokens?: DecimalString;
  reasoningTokens?: DecimalString;
  cachedInputTokens?: DecimalString;
  cachedOutputTokens?: DecimalString;
  cacheWriteTokens?: DecimalString;
  characters?: DecimalString;
  seconds?: DecimalString;
  images?: DecimalString;
  references?: DecimalString;
  resolution?: string;
  quality?: string;
  mode?: string;
  fps?: DecimalString;
  dimensions?: Readonly<Record<string, DecimalString | string | boolean>>;
}>;

export type PricingContext = Readonly<{
  modelId: string;
  providerKey: string;
  providerModelId: string;
  priceVersion: string;
  pricingStatus: PricingStatus;
  internalUsdPkrRate: DecimalString;
  quotedAt: string;
}>;

export type ProviderCost = Readonly<{
  amount: Money;
  status: BillingCostStatus;
  source: string;
  observedAt: string;
  reference?: string;
}>;

export type BillingBreakdownLine = Readonly<{
  code: string;
  quantity: DecimalString;
  unit?: string;
  unitPrice?: Money;
  amount: Money;
  metadata?: Readonly<Record<string, string>>;
}>;
