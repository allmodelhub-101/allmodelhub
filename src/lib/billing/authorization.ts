import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createIdempotencyKey } from "@/lib/security/ids";
import type { PricingDimensions } from "./pricing-registry-core";
import { decimal, decimalString, type DecimalString } from "./money";
import { roundWalletAmountUp } from "./quote-reservation-core";
import type { NormalizedUsage } from "./types";
import type { ResolvedBillingProviderRoute } from "./provider-route-core";
import { calculateTextAuthorizationProviderCost, parseAuthorizationConstraints, validateAuthorizationRequest } from "./authorization-core";
import { priceMediaAuthorization } from "./media-authorization-pricing";

type PolicyRow = Readonly<{
  id: string;
  provider_key: string;
  model_id: string;
  upstream_model: string;
  modality: string;
  policy_version: string;
  maximum_provider_cost_usd: string;
  maximum_authorization_credits: string;
  request_constraints: Record<string, unknown>;
  metadata: Record<string, unknown>;
  model_markup: string;
  internal_usd_pkr_rate: string;
}>;

export type ProviderAuthorization = Readonly<{
  quoteId: string;
  walletHoldId: string;
  expiresAt: string;
  authorizationCredits: string;
  estimatedCredits: string;
  policyId: string;
  policyVersion: string;
  internalUsdPkrRate: string;
  markup: string;
  route: ResolvedBillingProviderRoute;
}>;

export async function loadAuthorizationPolicy(route: ResolvedBillingProviderRoute, modality: string) {
  const provider = route.providerKey.toLowerCase().replace(/[-_.]/g, "");
  if (provider !== "apimodels" && provider !== "apimodelsapp") {
    throw new Error("BILLING_V3_PROVIDER_COST_AUTHORITY_UNAVAILABLE");
  }
  const admin = createAdminClient();
  const { data, error } = await admin.from("billing_v3_authorization_registry")
    .select("id,provider_key,model_id,upstream_model,modality,policy_version,maximum_provider_cost_usd,maximum_authorization_credits,request_constraints,metadata,model_markup,internal_usd_pkr_rate")
    .eq("provider_key", route.providerKey)
    .eq("model_id", route.modelId)
    .eq("upstream_model", route.upstreamModel)
    .eq("modality", modality)
    .limit(1)
    .maybeSingle();
  if (error || !data) throw new Error("BILLING_V3_AUTHORIZATION_POLICY_UNAVAILABLE");
  return data as PolicyRow;
}

function exactMetadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("BILLING_V3_AUTHORIZATION_PRICING_VERSION_UNAVAILABLE");
  }
  return value;
}

function textAuthorizationProviderCost(policy: PolicyRow, usageEnvelope: NormalizedUsage) {
  return decimalString(calculateTextAuthorizationProviderCost({
    usage: usageEnvelope,
    inputUsdPerMillion: exactMetadataString(policy.metadata, "authorization_input_usd_per_million"),
    outputUsdPerMillion: exactMetadataString(policy.metadata, "authorization_output_usd_per_million"),
  }));
}

async function loadAuthorizationQuantum() {
  const admin = createAdminClient();
  const { data, error } = await admin.from("system_settings")
    .select("value")
    .eq("key", "billing_wallet_reservation_quantum_credits")
    .maybeSingle();
  const value = data?.value;
  if (error || (typeof value !== "string" && typeof value !== "number")) {
    throw new Error("BILLING_V3_AUTHORIZATION_QUANTUM_UNAVAILABLE");
  }
  const normalized = decimalString(String(value));
  if (!decimal(normalized).gt(0)) throw new Error("BILLING_V3_AUTHORIZATION_QUANTUM_UNAVAILABLE");
  return normalized;
}

async function calculateRequestAuthorization(input: Readonly<{
  policy: PolicyRow;
  route: ResolvedBillingProviderRoute;
  usageEnvelope: NormalizedUsage;
  dimensions?: PricingDimensions;
}>) {
  const pricingVersion = exactMetadataString(input.policy.metadata, "derived_from_verified_pricing_version");
  const quantum = await loadAuthorizationQuantum();
  const safePolicyCharge = roundWalletAmountUp(
    decimal(input.policy.maximum_provider_cost_usd)
      .mul(input.policy.internal_usd_pkr_rate)
      .mul(input.policy.model_markup)
      .toFixed() as DecimalString,
    quantum as DecimalString,
  );
  const policyMaximum = decimalString(input.policy.maximum_authorization_credits);
  if (!decimal(policyMaximum).gt(0) || decimal(policyMaximum).lt(safePolicyCharge)) {
    throw new Error("BILLING_V3_AUTHORIZATION_POLICY_UNDERFUNDED");
  }
  const priced = input.policy.modality === "text" ? null : priceMediaAuthorization({
      metadata: input.policy.metadata,
      providerKey: input.route.providerKey,
      modelId: input.route.modelId,
      upstreamModel: input.route.upstreamModel,
      pricingVersion,
      markup: input.policy.model_markup,
      internalUsdPkrRate: input.policy.internal_usd_pkr_rate,
    usage: input.usageEnvelope,
    dimensions: input.dimensions,
  });
  const requestProviderCost = priced?.providerCostUsd ?? textAuthorizationProviderCost(input.policy, input.usageEnvelope);
  if (decimal(requestProviderCost).gt(decimal(input.policy.maximum_provider_cost_usd))) {
    throw new Error("BILLING_V3_AUTHORIZATION_REQUEST_EXCEEDS_POLICY");
  }
  const requestAuthorization = roundWalletAmountUp(
    decimal(requestProviderCost)
      .mul(input.policy.internal_usd_pkr_rate)
      .mul(input.policy.model_markup)
      .toFixed() as DecimalString,
    quantum as DecimalString,
  );
  if (!decimal(requestAuthorization).gt(0) || decimal(requestAuthorization).gt(policyMaximum)) {
    throw new Error("BILLING_V3_AUTHORIZATION_POLICY_UNDERFUNDED");
  }
  // This is only a conservative wallet authorization. APIMODELS' settled
  // provider record remains the sole final-cost and capture authority.
  return { authorizationCredits: requestAuthorization,
    estimatedCredits: decimalString(decimal(requestProviderCost).mul(input.policy.internal_usd_pkr_rate).mul(input.policy.model_markup)),
    providerCostUsd: requestProviderCost,
    pricingVersion, pricingRuleId: priced?.snapshot.pricingRuleId ?? null } as const;
}

export async function preflightProviderAuthorization(input: Readonly<{
  route: ResolvedBillingProviderRoute; modality: string;
  usageEnvelope: NormalizedUsage; dimensions?: PricingDimensions;
}>) {
  const policy = await loadAuthorizationPolicy(input.route, input.modality);
  validateAuthorizationRequest(input.usageEnvelope, parseAuthorizationConstraints(policy.request_constraints));
  return { policy, ...await calculateRequestAuthorization({ ...input, policy }) };
}

export async function createProviderAuthorization(input: Readonly<{
  userId: string;
  requestIdempotencyId: string;
  route: ResolvedBillingProviderRoute;
  modality: string;
  usageEnvelope: NormalizedUsage;
  dimensions?: PricingDimensions;
  options?: Readonly<Record<string, unknown>>;
  metadata?: Readonly<Record<string, unknown>>;
}>) {
  const policy = await loadAuthorizationPolicy(input.route, input.modality);
  validateAuthorizationRequest(input.usageEnvelope, parseAuthorizationConstraints(policy.request_constraints));
  const requestAuthorization = await calculateRequestAuthorization({
    policy,
    route: input.route,
    usageEnvelope: input.usageEnvelope,
    dimensions: input.dimensions,
  });
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("billing_v3_reserve_authorization", {
    p_user_id: input.userId,
    p_request_idempotency_id: input.requestIdempotencyId,
    p_authorization_policy_id: policy.id,
    p_provider_key: input.route.providerKey,
    p_model_id: input.route.modelId,
    p_upstream_model: input.route.upstreamModel,
    p_modality: input.modality,
    p_authorization_credits: requestAuthorization.authorizationCredits,
    p_input_dimensions: { usageEnvelope: input.usageEnvelope, options: input.options ?? {} },
    p_hold_idempotency_key: createIdempotencyKey("billing-v3-authorization", input.userId, input.requestIdempotencyId),
    p_hold_metadata: {
      ...input.metadata,
      billing_v3: true,
      provider_route_id: input.route.routeId,
      authorization_pricing_rule_id: requestAuthorization.pricingRuleId,
      authorization_pricing_version: requestAuthorization.pricingVersion,
      authorization_provider_cost_usd: requestAuthorization.providerCostUsd,
      authorization_fx: policy.internal_usd_pkr_rate,
      authorization_markup: policy.model_markup,
    },
  });
  if (error || !data) throw error ?? new Error("BILLING_V3_AUTHORIZATION_FAILED");
  const result = data as Record<string, unknown>;
  return {
    quoteId: String(result.quote_id),
    walletHoldId: String(result.wallet_hold_id),
    expiresAt: String(result.expires_at),
    authorizationCredits: String(result.authorization_credits),
    estimatedCredits: String(result.estimated_credits ?? requestAuthorization.estimatedCredits),
    policyId: policy.id,
    policyVersion: policy.policy_version,
    internalUsdPkrRate: String(result.fx ?? policy.internal_usd_pkr_rate),
    markup: String(result.markup ?? policy.model_markup),
    route: input.route,
  } satisfies ProviderAuthorization;
}

