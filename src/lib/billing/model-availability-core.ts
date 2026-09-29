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
