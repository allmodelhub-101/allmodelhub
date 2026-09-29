import { createAdminClient } from "@/lib/supabase/admin";
import {
  ALL_MODELS,
  chooseTextModel,
  getModel as getStaticModel,
  type CatalogModel,
  type Modality,
  type ModelTier
} from "@/lib/models";
import { executableModelIds } from "@/lib/billing/model-availability-core";

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
    uiSchema: row.ui_schema && typeof row.ui_schema === "object" && !Array.isArray(row.ui_schema) ? row.ui_schema as CatalogModel["uiSchema"] : staticModel?.uiSchema,
    inputOverheadTokens: staticModel?.inputOverheadTokens,
    autoEligible: row.auto_eligible
  };
}

function withAvailability(model: CatalogModel, available: boolean, reason: CatalogModel["availabilityReason"] = null) {
  return { ...model, available, availabilityReason: available ? null : reason };
}

export async function listRuntimeModels(options?: { modality?: Modality; includeInactive?: boolean }) {
  try {
    const admin = createAdminClient();
    const now = new Date().toISOString();
    let query = admin.from("models").select("*").order("tier").order("display_name");
    if (options?.modality) query = query.eq("modality", options.modality);
    if (!options?.includeInactive) query = query.eq("active", true);
    const { data, error } = await query;
    if (error) throw error;
    const rows = data as DbModel[];
    if (options?.includeInactive || !rows.length) return rows.map(toCatalogModel);

    // Route activity means operational availability. Billing V3 independently
    // requires a current authorization policy, so the catalog fails closed
    // without using historical local pricing as a final-cost authority.
    const [{ data: routes, error: routeError },
      { data: policies, error: policyError }] = await Promise.all([admin
      .from("provider_models")
      .select("model_id")
      .eq("active", true)
      .in("model_id", rows.map((row) => row.id)), admin
      .from("billing_authorization_policies")
      .select("model_id")
      .eq("active", true)
      .lte("effective_from", now)
      .or(`effective_until.is.null,effective_until.gt.${now}`)
      .in("model_id", rows.map((row) => row.id))]);
    if (routeError || policyError) throw routeError ?? policyError;
    const executable = executableModelIds({
      activeModelIds: rows.map((row) => row.id),
      operationalRouteModelIds: (routes ?? []).map((route) => String(route.model_id)),
      verifiedPricingModelIds: [],
      authorizationPolicyModelIds: (policies ?? []).map((policy) => String(policy.model_id)),
      billingV3Enabled: true,
      billingV3CanaryModels: [],
    });
    const operational = new Set((routes ?? []).map((route) => String(route.model_id)));
    return rows.map((row) => withAvailability(
      toCatalogModel(row),
      executable.has(row.id),
      operational.has(row.id) ? "billing_authorization_pending" : "provider_route_unavailable",
    ));
  } catch {
    // Static catalog data is UI metadata only. Never turn it into an
    // executable production fallback when the authoritative route registry is
    // unavailable.
    if (process.env.NODE_ENV === "production") return [];
    return ALL_MODELS.filter((model) => (!options?.modality || model.modality === options.modality))
      .map((model) => withAvailability(model, false, "billing_authorization_pending"));
  }
}

export async function getRuntimeModel(id: string) {
  try {
    const admin = createAdminClient();
    const now = new Date().toISOString();
    const { data, error } = await admin.from("models").select("*").or(`id.eq.${id},upstream_model.eq.${id}`).eq("active", true).limit(1).maybeSingle();
    if (error) throw error;
    if (!data) return undefined;
    const [{ data: route, error: routeError },
      { data: policy, error: policyError }] = await Promise.all([admin
      .from("provider_models")
      .select("id")
      .eq("model_id", data.id)
      .eq("active", true)
      .limit(1)
      .maybeSingle(), admin.from("billing_authorization_policies").select("id")
      .eq("model_id", data.id).eq("active", true)
      .lte("effective_from", now)
      .or(`effective_until.is.null,effective_until.gt.${now}`)
      .limit(1).maybeSingle()]);
    if (routeError || policyError) throw routeError ?? policyError;
    if (!route || !policy) return undefined;
    return toCatalogModel(data as DbModel);
  } catch {
    if (process.env.NODE_ENV === "production") return undefined;
    return getStaticModel(id);
  }
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


