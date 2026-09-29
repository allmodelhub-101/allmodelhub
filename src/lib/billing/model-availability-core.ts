import Decimal from "decimal.js";

type AuthorizationPolicyAvailability = Readonly<{
  modality: string;
  metadata: unknown;
  request_constraints: unknown;
}>;

function positiveDecimalString(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const parsed = new Decimal(value);
    return parsed.isFinite() && parsed.gt(0);
  } catch {
    return false;
  }
}

export function isRuntimeAuthorizationPolicyComplete(policy: AuthorizationPolicyAvailability) {
  if (!policy.metadata || typeof policy.metadata !== "object" || Array.isArray(policy.metadata)) return false;
  if (!policy.request_constraints || typeof policy.request_constraints !== "object" || Array.isArray(policy.request_constraints)) return false;
  const metadata = policy.metadata as Record<string, unknown>;
  if (typeof metadata.derived_from_verified_pricing_version !== "string"
    || metadata.derived_from_verified_pricing_version.trim().length === 0) return false;
  if (policy.modality !== "text") return true;
  const constraints = policy.request_constraints as Record<string, unknown>;
  return positiveDecimalString(metadata.authorization_input_usd_per_million)
    && positiveDecimalString(metadata.authorization_output_usd_per_million)
    && positiveDecimalString(constraints.maxInputTokens)
    && positiveDecimalString(constraints.maxOutputTokens);
}

export function executableModelIds(input: Readonly<{
  activeModelIds: readonly string[];
  operationalRouteModelIds: readonly string[];
  verifiedPricingModelIds: readonly string[];
  authorizationPolicyModelIds: readonly string[];
  billingV3Enabled: boolean;
  billingV3CanaryModels: readonly string[];
}>) {
  const routes = new Set(input.operationalRouteModelIds);
  const v2 = new Set(input.verifiedPricingModelIds);
  const v3 = new Set(input.authorizationPolicyModelIds);
  const canaries = new Set(input.billingV3CanaryModels);
  return new Set(input.activeModelIds.filter((modelId) => {
    if (!routes.has(modelId)) return false;
    return input.billingV3Enabled || canaries.has(modelId) ? v3.has(modelId) : v2.has(modelId);
  }));
}
