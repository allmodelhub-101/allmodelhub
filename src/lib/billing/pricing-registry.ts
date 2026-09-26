import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  calculateAuthoritativePrice,
  PricingUnavailableError,
  selectPricingRule,
  type FormulaEvaluator,
  type PricingDimensions,
  type PricingRegistryRow,
  type PricingRuleSelector,
} from "@/lib/billing/pricing-registry-core";
import type { NormalizedUsage } from "@/lib/billing/types";

export async function loadExactFxRate() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("billing_internal_fx_registry")
    .select("decimal_value")
    .eq("key", "internal_usd_pkr")
    .maybeSingle();
  if (error || typeof data?.decimal_value !== "string" || !data.decimal_value) {
    throw new PricingUnavailableError("FX_RATE_UNAVAILABLE", "The validated internal USD/PKR rate is unavailable.");
  }
  return data.decimal_value;
}

export async function loadAuthoritativePricingRule(selector: PricingRuleSelector) {
  const admin = createAdminClient();
  let query = admin
    .from("billing_provider_pricing_registry")
    .select("*")
    .eq("provider_key", selector.providerKey)
    .eq("model_id", selector.modelId)
    .eq("upstream_model", selector.upstreamModel);
  if (selector.pricingVersion) query = query.eq("pricing_version", selector.pricingVersion);
  const { data, error } = await query.order("effective_from", { ascending: false }).limit(10);
  if (error) throw new PricingUnavailableError("RULE_NOT_FOUND", "The provider pricing registry could not be loaded.");
  return selectPricingRule((data ?? []) as PricingRegistryRow[], selector);
}

export async function priceProviderRequest(input: Readonly<{
  selector: PricingRuleSelector;
  usage: NormalizedUsage;
  dimensions?: PricingDimensions;
  formulaEvaluators?: Readonly<Record<string, FormulaEvaluator>>;
}>) {
  const context = await loadAuthoritativePricingContext(input.selector);
  return calculateAuthoritativePrice({
    rule: context.rule,
    usage: input.usage,
    dimensions: input.dimensions,
    internalUsdPkrRate: context.internalUsdPkrRate,
    formulaEvaluators: input.formulaEvaluators,
  });
}

export async function loadAuthoritativePricingContext(selector: PricingRuleSelector) {
  const [rule, internalUsdPkrRate] = await Promise.all([
    loadAuthoritativePricingRule(selector),
    loadExactFxRate(),
  ]);
  return { rule, internalUsdPkrRate } as const;
}
