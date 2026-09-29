export type MediaPublicFailure = Readonly<{ message: string; status: number; category: string }>;

export function classifyMediaRuntimeFailure(error: unknown, providerSubmissionPending = false): MediaPublicFailure {
  if (providerSubmissionPending) return {
    message: "Generation was submitted and is pending provider reconciliation.", status: 202, category: "reconciliation_pending",
  };
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : "";
  if (message.includes("INSUFFICIENT_CREDITS")) return {
    message: "Insufficient credits for this generation.", status: 402, category: "insufficient_credits",
  };
  if (message.includes("SPEND_LIMIT")) return {
    message: "This generation exceeds your spending safety limit.", status: 403, category: "spending_limit",
  };
  if (message.includes("MEDIA_OPTION_UNSUPPORTED")) return {
    message: "One or more selected model options are unsupported.", status: 400, category: "unsupported_option",
  };
  if (name === "PricingUnavailableError" || name === "AuthorizationPolicyError"
    || /(?:BILLING|PRICING|AUTHORIZATION|RULE_|DIMENSION_|USAGE_)/.test(message)) return {
    message: "Billing configuration is unavailable for this model configuration.", status: 503, category: "billing_configuration",
  };
  if (name === "ProviderRequestError" && /unavailable|invalid model configuration/i.test(message)) return {
    message: "The provider rejected this model request.", status: 422, category: "provider_rejected",
  };
  return { message: "Generation provider is temporarily unavailable.", status: 502, category: "provider_temporary" };
}
