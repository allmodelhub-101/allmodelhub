import { createAdminClient } from "@/lib/supabase/admin";
import {
  ALL_MODELS,
  chooseTextModel,
  getModel as getStaticModel,
  type CatalogModel,
  type Modality,
  type ModelTier
} from "@/lib/models";
import { evaluateModelReadiness, type ReadinessPolicy } from "@/lib/model-readiness-core";
import { getMediaExecutionContract, mediaContractUiSchema } from "@/lib/media-execution-contract";
import { getServerEnv } from "@/lib/env";

type DbModel = {
  id: string;
  display_name: string;
  provider_family: string;
  tier: ModelTier;
  modality: Modality;
  description: string;
  upstream_model: string;
  input_usd_per_million: number | string | null;
  output_usd_per_million: number | string | null;
  flat_usd: number | string | null;
  per_second_usd: number | string | null;
  per_1k_chars_usd: number | string | null;
  markup: number | string;
  capabilities: unknown;
  ui_schema?: unknown;
  active: boolean;
  auto_eligible: boolean;
};

function optionalNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function toCatalogModel(row: DbModel): CatalogModel {
  const staticModel = getStaticModel(row.id);
  return {
    id: row.id,
    name: row.display_name,
    providerFamily: row.provider_family,
    tier: row.tier,
    modality: row.modality,
    description: row.description,
    upstreamModel: row.upstream_model,
    inputUsdPerMillion: optionalNumber(row.input_usd_per_million),
    outputUsdPerMillion: optionalNumber(row.output_usd_per_million),
    flatUsd: optionalNumber(row.flat_usd),
    perSecondUsd: optionalNumber(row.per_second_usd),
    per1kCharsUsd: optionalNumber(row.per_1k_chars_usd),
    markup: Number(row.markup),
    capabilities: Array.isArray(row.capabilities) ? row.capabilities.filter((item): item is string => typeof item === "string") : [],
    uiSchema: row.modality === "video" && getMediaExecutionContract(row.id) ? mediaContractUiSchema(getMediaExecutionContract(row.id)!) : row.ui_schema && typeof row.ui_schema === "object" && !Array.isArray(row.ui_schema) ? row.ui_schema as CatalogModel["uiSchema"] : staticModel?.uiSchema,
    inputOverheadTokens: staticModel?.inputOverheadTokens,
    autoEligible: row.auto_eligible
  };
}

function withAvailability(model: CatalogModel, available: boolean, reason: CatalogModel["availabilityReason"] = null) {
  return { ...model, available, availabilityReason: available ? null : reason };
}

export async function listRuntimeModels(options?: { modality?: Modality; includeInactive?: boolean; diagnostics?: boolean }): Promise<(CatalogModel & { readiness?: ReturnType<typeof evaluateModelReadiness> })[]> {
  try {
    const admin = createAdminClient();
    let query = admin.from("models").select("*").order("tier").order("display_name");
    if (options?.modality) query = query.eq("modality", options.modality);
    if (!options?.includeInactive) query = query.eq("active", true);
    const { data, error } = await query;
    if (error) throw error;
    const rows = data as DbModel[];
    if (!rows.length) return [];
    const [{ data: routes, error: routeError }, { data: policies, error: policyError }] = await Promise.all([
      admin.from("provider_models").select("provider_key,model_id,upstream_model").eq("active", true).in("model_id", rows.map((r) => r.id)),
      admin.from("billing_v3_authorization_registry").select("*").in("model_id", rows.map((r) => r.id)),
    ]);
    if (routeError || policyError) throw routeError ?? policyError;
    let configurationReady = false;
    try { configurationReady = Boolean(getServerEnv().APIMODELS_API_KEY); } catch { /* fail closed */ }
    return rows.map((row) => {
      const model = toCatalogModel(row);
      const readiness = evaluateModelReadiness({ model, active: row.active, routes: routes ?? [],
        policies: (policies ?? []) as ReadinessPolicy[], configurationReady: configurationReady
          && (!getMediaExecutionContract(row.id)?.maxVideoReferences
            || Boolean(process.env.NEXT_PUBLIC_APP_URL?.startsWith("https://"))) });
      return { ...withAvailability(model, readiness.ready, readiness.reason),
        ...(options?.diagnostics ? { readiness } : {}) };
    });
  } catch {
    if (process.env.NODE_ENV === "production") return [];
    return ALL_MODELS.filter((m) => !options?.modality || m.modality === options.modality)
      .map((m) => withAvailability(m, false, "runtime_configuration_unavailable"));
  }
}

export async function getModelReadiness(modelId: string) {
  const models = await listRuntimeModels({ includeInactive: true, diagnostics: true });
  return models.find((model) => model.id === modelId)?.readiness;
}

export async function getRuntimeModel(id: string) {
  return (await listRuntimeModels()).find((model) => model.available === true
    && (model.id === id || model.upstreamModel === id));
}

export async function chooseRuntimeTextModel(input: { tier?: ModelTier | "auto"; prompt: string; hasAttachments?: boolean; deepThink?: boolean }) {
  const desired = chooseTextModel(input);
  const runtimeModels = (await listRuntimeModels({ modality: "text" }))
    .filter((model) => model.available !== false && model.autoEligible !== false);
  if (!runtimeModels.length) return undefined;

  if (input.tier && input.tier !== "auto") {
    const runtimeDesired = runtimeModels.find((model) => model.id === desired.id);
    return runtimeDesired ?? runtimeModels.find((model) => model.tier === desired.tier) ?? runtimeModels[0];
  }

  const prompt = input.prompt.toLowerCase();
  const words = prompt.trim().split(/\s+/).filter(Boolean).length;
  const wantsCode = /\b(code|coding|debug|bug|typescript|javascript|python|sql|api|refactor|repository|codebase)\b/.test(prompt);
  const wantsResearch = /\b(research|sources?|citations?|current|latest|verify|evidence|compare)\b/.test(prompt);
  const wantsReasoning = input.deepThink || /\b(analy[sz]e|reason|strategy|architecture|contract|financial|legal|complex|step.by.step)\b/.test(prompt);
  const wantsVision = input.hasAttachments || /\b(image|photo|screenshot|diagram|document|pdf|file)\b/.test(prompt);
  const wantsLongContext = input.hasAttachments || words > 900 || input.prompt.length > 6_000;
  const simple = words < 90 && !wantsCode && !wantsResearch && !wantsReasoning && !wantsVision;
  const tierWeight: Record<ModelTier, number> = { budget: 0, balanced: 1, premium: 2, flagship: 3 };

  return [...runtimeModels].sort((a, b) => {
    const score = (model: CatalogModel) => {
      const capabilities = new Set(model.capabilities.map((item) => item.toLowerCase()));
      let value = simple ? (capabilities.has("fast") ? 8 : 0) - tierWeight[model.tier] * 2 : tierWeight[model.tier];
      if (wantsCode && (capabilities.has("coding") || capabilities.has("code"))) value += 10;
      if (wantsResearch && (capabilities.has("research") || capabilities.has("reasoning"))) value += 8;
      if (wantsReasoning && capabilities.has("reasoning")) value += 9;
      if (wantsVision && (capabilities.has("vision") || capabilities.has("multimodal"))) value += 11;
      if (wantsLongContext && (capabilities.has("long-context") || capabilities.has("long context"))) value += 9;
      if (!simple && capabilities.has("tools")) value += 2;
      return value;
    };
    return score(b) - score(a) || a.id.localeCompare(b.id);
  })[0];
}



