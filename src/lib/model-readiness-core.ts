import { isRuntimeAuthorizationPolicyComplete } from "./billing/model-availability-core.ts";
import { getMediaExecutionContract, mediaUiSchemaMatchesContract } from "./media-execution-contract.ts";
import { selectPricingRule, type PricingRegistryRow } from "./billing/pricing-registry-core.ts";
import type { CatalogModel } from "./models";
import Decimal from "decimal.js";
import { parseAuthorizationConstraints } from "./billing/authorization-core.ts";
import { priceMediaAuthorization } from "./billing/media-authorization-pricing.ts";
import type { DecimalString } from "./billing/money";

export type ReadinessPolicy = {
  provider_key: string; model_id: string; upstream_model: string; modality: string;
  metadata: Record<string, unknown>; request_constraints: Record<string, unknown>;
  maximum_provider_cost_usd?: string;
};
export function evaluateModelReadiness(input: {
  model: CatalogModel; active: boolean;
  routes: readonly { provider_key: string; model_id: string; upstream_model: string }[];
  policies: readonly ReadinessPolicy[]; configurationReady: boolean;
}) {
  const { model } = input;
  const routes = input.routes.filter((r) => r.model_id === model.id);
  const policies = input.policies.filter((p) => p.model_id === model.id && p.modality === model.modality
    && routes.some((r) => r.provider_key === p.provider_key && r.upstream_model === p.upstream_model));
  const contract = getMediaExecutionContract(model.id);
  const text = model.modality === "text";
  const settlementReady = routes.some((r) => ["apimodels", "apimodelsapp"].includes(r.provider_key.toLowerCase().replace(/[-_.]/g, "")));
  const authorizationReady = policies.some((p) => {
    if (!["apimodels", "apimodelsapp"].includes(p.provider_key.toLowerCase().replace(/[-_.]/g, ""))) return false;
    if (!isRuntimeAuthorizationPolicyComplete(p)) return false;
    if (text) return true;
    try {
      const definition = p.metadata.media_authorization_pricing;
      if (!definition || typeof definition !== "object" || Array.isArray(definition)) return false;
      selectPricingRule([{ ...definition, model_markup: String(model.markup), model_active: input.active } as PricingRegistryRow], {
        providerKey: p.provider_key, modelId: model.id, upstreamModel: p.upstream_model,
        pricingVersion: String(p.metadata.derived_from_verified_pricing_version),
      });
      const pricing = definition as PricingRegistryRow;
      const constraints = parseAuthorizationConstraints(p.request_constraints);
      if (pricing.billing_type === "formula") {
        const formula = pricing.formula as Record<string, unknown>;
        if (!["linear", "option_matrix", "video_tokens"].includes(String(formula?.kind))) return false;
        if (formula.kind === "video_tokens" && (typeof formula.usdPerMillionTokens !== "string"
          || !formula.resolutionDimensions || !formula.fps || !formula.tokenDivisor)) return false;
      }
      if (model.modality === "video" && contract) {
        const seconds = contract.workflow === "upscale" ? contract.maxReferenceVideoSeconds!
          : contract.durationRange?.max ?? Math.max(...(contract.durations ?? []));
        if (!constraints.maxSeconds || new Decimal(constraints.maxSeconds).lt(seconds)
          || !constraints.maxCharacters || new Decimal(constraints.maxCharacters).lt(contract.promptLimit ?? 20000)
          || !constraints.maxReferences || new Decimal(constraints.maxReferences).lt(contract.maxReferences)
          || contract.inputModes.some((mode) => !constraints.allowedInputTypes?.includes(mode))
          || contract.resolutions?.some((resolution) => !constraints.allowedResolutions?.includes(resolution))
          || contract.aspectRatios?.some((ratio) => !constraints.allowedAspectRatios?.includes(ratio))
          || contract.nativeAudio?.some((audio) => !constraints.allowedNativeAudio?.includes(audio))
          || !p.maximum_provider_cost_usd) return false;
        for (const resolution of contract.resolutions ?? [undefined]) {
          for (const audio of contract.nativeAudio ?? [undefined]) {
            for (const inputType of contract.inputModes) {
            // A reference-video request has a larger authorization envelope
            // than its output duration. Upscale already uses its source limit
            // as `seconds`, so it must not be counted twice.
            const authorizationSeconds = inputType === "video" && contract.modelId === "seedance-2-5"
              ? seconds + (contract.maxReferenceVideoSeconds ?? 0) : seconds;
            const result = priceMediaAuthorization({
              metadata: p.metadata, providerKey: p.provider_key, modelId: model.id, upstreamModel: p.upstream_model,
              pricingVersion: String(p.metadata.derived_from_verified_pricing_version),
              markup: String(model.markup), internalUsdPkrRate: "1",
              usage: { seconds: String(authorizationSeconds) as DecimalString },
              dimensions: { resolution, inputType,
                ...(contract.providerNativeAudio === "kling_sound" ? { mode: audio ? "native_audio" : "silent" } : {}) },
            });
            if (new Decimal(result.providerCostUsd).gt(p.maximum_provider_cost_usd)) return false;
            }
          }
        }
      }
      return true;
    } catch { return false; }
  });
  const state = {
    modelActive: input.active, routeReady: routes.length > 0, adapterReady: text || Boolean(contract),
    authorizationReady, settlementReady,
    contractReady: text || Boolean(contract && mediaUiSchemaMatchesContract(model.uiSchema, contract)),
    configurationReady: input.configurationReady,
  };
  const reason: CatalogModel["availabilityReason"] = !state.modelActive ? "model_inactive"
    : !state.routeReady ? "provider_route_unavailable"
    : !state.adapterReady ? "provider_adapter_unavailable"
    : !state.authorizationReady ? "authorization_pricing_unavailable"
    : !state.contractReady ? "media_contract_mismatch"
    : !state.settlementReady ? "settlement_unavailable"
    : !state.configurationReady ? "runtime_configuration_unavailable" : null;
  return { ...state, ready: !reason, reason };
}
