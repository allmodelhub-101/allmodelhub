import { createAdminClient } from "@/lib/supabase/admin";
import {
  ALL_MODELS,
  chooseTextModel,
  getModel as getStaticModel,
  type CatalogModel,
  type Modality,
  type ModelTier
} from "@/lib/models";

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

export async function listRuntimeModels(options?: { modality?: Modality; includeInactive?: boolean }) {
  try {
    const admin = createAdminClient();
    let query = admin.from("models").select("*").order("tier").order("display_name");
    if (options?.modality) query = query.eq("modality", options.modality);
    if (!options?.includeInactive) query = query.eq("active", true);
    const { data, error } = await query;
    if (error) throw error;
    return (data as DbModel[]).map(toCatalogModel);
  } catch {
    return ALL_MODELS.filter((model) => (!options?.modality || model.modality === options.modality));
  }
}

export async function getRuntimeModel(id: string) {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("models").select("*").or(`id.eq.${id},upstream_model.eq.${id}`).eq("active", true).limit(1).maybeSingle();
    if (error) throw error;
    if (!data) return undefined;
    return toCatalogModel(data as DbModel);
  } catch {
    return getStaticModel(id);
  }
}

export async function chooseRuntimeTextModel(input: { tier?: ModelTier | "auto"; prompt: string }) {
  const desired = chooseTextModel(input);
  const runtimeDesired = await getRuntimeModel(desired.id);
  if (runtimeDesired?.modality === "text") return runtimeDesired;

  const runtimeModels = (await listRuntimeModels({ modality: "text" })).filter((model) => model.autoEligible !== false);
  const sameTier = runtimeModels.find((model) => model.tier === desired.tier);
  if (sameTier) return sameTier;
  return runtimeModels[0] ?? desired;
}

