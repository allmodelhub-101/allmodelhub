import type { DecimalString } from "./money";
import type { BillingBreakdownLine, BillingCostStatus, Money, NormalizedUsage, PricingContext, ProviderCost } from "./types";

export type QuoteRequest = Readonly<{
  requestId: string;
  pricing: PricingContext;
  estimatedUsage: NormalizedUsage;
  metadata?: Readonly<Record<string, string>>;
}>;

export type BillingQuote = Readonly<{
  quoteId: string;
  requestId: string;
  pricing: PricingContext;
  usage: NormalizedUsage;
  estimatedProviderCost: ProviderCost & Readonly<{ status: "estimated" }>;
  customerCharge: Money;
  breakdown: readonly BillingBreakdownLine[];
  expiresAt?: string;
}>;

export type SettlementRequest = Readonly<{
  settlementId: string;
  quote: BillingQuote;
  actualUsage: NormalizedUsage;
  providerReportedCost?: ProviderCost & Readonly<{ status: "provider_reported" }>;
  metadata?: Readonly<Record<string, string>>;
}>;

export type BillingSettlement = Readonly<{
  settlementId: string;
  quoteId: string;
  costStatus: Exclude<BillingCostStatus, "estimated">;
  usage: NormalizedUsage;
  estimatedProviderCost: ProviderCost & Readonly<{ status: "estimated" }>;
  actualProviderCost: ProviderCost & Readonly<{ status: "usage_calculated" | "provider_reported" | "reconciled" }>;
  customerCharge: Money;
  breakdown: readonly BillingBreakdownLine[];
  settledAt: string;
}>;

export interface PricingEngine {
  quote(request: QuoteRequest): Promise<BillingQuote>;
}

export interface SettlementEngine {
  settle(request: SettlementRequest): Promise<BillingSettlement>;
}

export interface ProviderCostCalculator {
  calculate(usage: NormalizedUsage, pricing: PricingContext): Promise<ProviderCost & Readonly<{ status: "estimated" | "usage_calculated" }>>;
}

export interface ProviderCostReconciler {
  reconcile(input: Readonly<{
    estimatedProviderCost: ProviderCost & Readonly<{ status: "estimated" }>;
    calculatedProviderCost: ProviderCost & Readonly<{ status: "usage_calculated" }>;
    providerReportedCost?: ProviderCost & Readonly<{ status: "provider_reported" }>;
    toleranceUsd: DecimalString;
  }>): Promise<ProviderCost & Readonly<{ status: "reconciled" }>>;
}
