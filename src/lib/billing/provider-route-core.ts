export type BillingProviderRouteRow = Readonly<{
  id: string;
  model_id: string;
  provider_key: string;
  upstream_model: string;
  priority: number;
  active: boolean;
  metadata: unknown;
}>;

export type ResolvedBillingProviderRoute = Readonly<{
  routeId: string;
  modelId: string;
  providerKey: string;
  upstreamModel: string;
  priority: number;
  metadata: Readonly<Record<string, unknown>>;
}>;

export class BillingRouteUnavailableError extends Error {
  readonly code: "ROUTE_NOT_FOUND" | "ROUTE_AMBIGUOUS" | "ROUTE_INVALID";

  constructor(code: BillingRouteUnavailableError["code"], message: string) {
    super(message);
    this.name = "BillingRouteUnavailableError";
    this.code = code;
  }
}

function routeMetadata(value: unknown): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BillingRouteUnavailableError("ROUTE_INVALID", "Provider route metadata must be an object.");
  }
  return value as Readonly<Record<string, unknown>>;
}

export function selectBillingProviderRoute(
  rows: readonly BillingProviderRouteRow[],
  input: Readonly<{ modelId: string; providerKey?: string }>,
): ResolvedBillingProviderRoute {
  const candidates = rows
    .filter((row) => row.active && row.model_id === input.modelId && (!input.providerKey || row.provider_key === input.providerKey))
    .sort((left, right) => left.priority - right.priority || left.provider_key.localeCompare(right.provider_key));
  if (!candidates.length) {
    throw new BillingRouteUnavailableError("ROUTE_NOT_FOUND", "No active provider route is configured for this paid request.");
  }
  if (input.providerKey && candidates.length !== 1) {
    throw new BillingRouteUnavailableError("ROUTE_AMBIGUOUS", "The exact provider route is ambiguous.");
  }
  const selected = candidates[0];
  if (!selected.id || !selected.provider_key || !selected.upstream_model || !Number.isInteger(selected.priority)) {
    throw new BillingRouteUnavailableError("ROUTE_INVALID", "The provider route is incomplete.");
  }
  return {
    routeId: selected.id,
    modelId: selected.model_id,
    providerKey: selected.provider_key,
    upstreamModel: selected.upstream_model,
    priority: selected.priority,
    metadata: routeMetadata(selected.metadata),
  };
}
