export function modelAvailabilityMessage(reason?: string | null) {
  switch (reason) {
    case "provider_adapter_unavailable": return "Workflow support unavailable";
    case "provider_route_unavailable": return "Provider route unavailable";
    case "authorization_pricing_unavailable":
    case "billing_authorization_pending": return "Billing authorization unavailable";
    case "media_contract_mismatch": return "Model options need verification";
    case "settlement_unavailable": return "Provider settlement unavailable";
    case "runtime_configuration_unavailable": return "Service configuration unavailable";
    case "model_inactive": return "Model inactive";
    default: return "Temporarily unavailable";
  }
}
