import { apimodelsChatStream, apimodelsCreateTask } from "@/lib/providers/apimodels";
import { haimakerChatStream, haimakerCreateTask, haimakerModelFor } from "@/lib/providers/haimaker";
import type { ProviderChatRequest, ProviderChatResult } from "@/lib/providers/types";
import { createAdminClient } from "@/lib/supabase/admin";

type ProviderRoute = { provider_key: string; upstream_model: string; priority: number; active: boolean };

async function routesForModel(modelId: string, defaultUpstream: string): Promise<ProviderRoute[]> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("provider_models")
      .select("provider_key,upstream_model,priority,active")
      .eq("model_id", modelId).eq("active", true).order("priority", { ascending: true });
    if (error) throw error;
    const rows = (data ?? []) as ProviderRoute[];
    const envFallback = haimakerModelFor(modelId);
    if (envFallback && process.env.HAIMAKER_API_KEY && !rows.some((route) => route.provider_key === "haimaker")) {
      rows.push({ provider_key: "haimaker", upstream_model: envFallback, priority: 100, active: true });
    }
    if (rows.length) {
      const fallback = haimakerModelFor(modelId);
      if (fallback && process.env.HAIMAKER_API_KEY && !rows.some((route) => route.provider_key.toLowerCase().replace(/[-_]/g, "") === "haimaker")) {
        rows.push({ provider_key: "haimaker", upstream_model: fallback, priority: 100, active: true });
      }
      return rows.sort((a, b) => a.priority - b.priority);
    }
  } catch {
    // Static primary route is a safe bootstrap before provider routing is configured in the DB.
  }
  const routes: ProviderRoute[] = [{ provider_key: "apimodels", upstream_model: defaultUpstream, priority: 10, active: true }];
  const fallback = haimakerModelFor(modelId);
  if (fallback && process.env.HAIMAKER_API_KEY) routes.push({ provider_key: "haimaker", upstream_model: fallback, priority: 20, active: true });
  return routes;
}

export async function providerCreateTask(input: { modelId: string; modality: "image" | "video"; body: Record<string, unknown>; allowFallback?: boolean }) {
  const fallback = haimakerModelFor(input.modelId);
  try {
    const task = await apimodelsCreateTask(input.modality, input.body);
    return { task, provider: "apimodels" as const };
  } catch (primaryError) {
    if (!input.allowFallback || !fallback || !process.env.HAIMAKER_API_KEY) throw primaryError;
    const task = await haimakerCreateTask(input.modality, { ...input.body, model: fallback });
    return { task, provider: "haimaker" as const };
  }
}

export async function providerChatStream(input: ProviderChatRequest & { modelId: string; allowFallback: boolean }): Promise<ProviderChatResult> {
  const routes = await routesForModel(input.modelId, input.upstreamModel);
  let lastResponse: Response | null = null;
  let lastProvider: "apimodels" | "haimaker" = "apimodels";
  let lastProtocol: "openai" | "anthropic" | "gemini" = "openai";
  let lastError: unknown = null;

  for (let index = 0; index < routes.length; index += 1) {
    if (index > 0 && !input.allowFallback) break;
    const route = routes[index];
    try {
      const providerKey = route.provider_key.toLowerCase().replace(/[-_]/g, "");
      if (providerKey === "apimodels" || providerKey === "apimodelsapp") {
        const result = await apimodelsChatStream({ ...input, upstreamModel: route.upstream_model });
        lastResponse = result.response; lastProvider = "apimodels"; lastProtocol = result.protocol;
        if (result.response.ok) return { response: result.response, provider: "apimodels", protocol: result.protocol };
      } else if (providerKey === "haimaker" || providerKey === "haimakerai") {
        if (!process.env.HAIMAKER_API_KEY) continue;
        const response = await haimakerChatStream({ ...input, upstreamOverride: route.upstream_model });
        lastResponse = response; lastProvider = "haimaker"; lastProtocol = "openai";
        if (response.ok) return { response, provider: "haimaker", protocol: "openai" };
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (lastResponse) return { response: lastResponse, provider: lastProvider, protocol: lastProtocol };
  if (lastError instanceof Error) throw lastError;
  throw new Error("No AI provider is currently available for this model.");
}
