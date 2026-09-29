import { apimodelsChatStream, apimodelsCreateTask, apimodelsPollTask, apimodelsTtsStream } from "@/lib/providers/apimodels";
import { haimakerChatStream, haimakerCreateTask, haimakerModelFor, haimakerPollTask, haimakerTtsStream } from "@/lib/providers/haimaker";
import type { ProviderChatRequest, ProviderChatResult } from "@/lib/providers/types";
import type { ResolvedBillingProviderRoute } from "@/lib/billing/provider-route-core";
import { createAdminClient } from "@/lib/supabase/admin";
import { apimodelsRequestId, apimodelsResponseCost } from "@/lib/providers/apimodels-billing-core";

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

export async function providerCreateTask(input: { modelId: string; modality: "image" | "video" | "audio"; body: Record<string, unknown>; allowFallback?: boolean }) {
  const fallback = haimakerModelFor(input.modelId);
  try {
    const task = await apimodelsCreateTask(input.modality, input.body);
    return { task, provider: "apimodels" as const };
  } catch (primaryError) {
    if (input.modality === "audio" || !input.allowFallback || !fallback || !process.env.HAIMAKER_API_KEY) throw primaryError;
    const task = await haimakerCreateTask(input.modality, { ...input.body, model: fallback });
    return { task, provider: "haimaker" as const };
  }
}

export async function providerPollTask(input: { provider: string; modality: "image" | "video" | "audio"; taskId: string }) {
  const key = input.provider.toLowerCase().replace(/[-_.]/g, "");
  if ((key === "haimaker" || key === "haimakerai") && input.modality !== "audio") return haimakerPollTask(input.modality, input.taskId);
  return apimodelsPollTask(input.modality, input.taskId);
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

export async function providerCreateTaskExact(
  route: ResolvedBillingProviderRoute,
  modality: "image" | "video" | "audio",
  body: Record<string, unknown>,
) {
  const key = route.providerKey.toLowerCase().replace(/[-_.]/g, "");
  const routedBody = { ...body, model: route.upstreamModel };
  if (key === "apimodels" || key === "apimodelsapp") {
    return { task: await apimodelsCreateTask(modality, routedBody), provider: route.providerKey } as const;
  }
  if ((key === "haimaker" || key === "haimakerai") && modality !== "audio") {
    if (!process.env.HAIMAKER_API_KEY) throw new Error("HAIMAKER_API_KEY is not configured.");
    return { task: await haimakerCreateTask(modality, routedBody), provider: route.providerKey } as const;
  }
  throw new Error(`Unsupported ${modality} provider route: ${route.providerKey}`);
}

export async function providerChatStreamExact(
  route: ResolvedBillingProviderRoute,
  input: Omit<ProviderChatRequest, "upstreamModel">,
): Promise<ProviderChatResult> {
  const key = route.providerKey.toLowerCase().replace(/[-_.]/g, "");
  if (key === "apimodels" || key === "apimodelsapp") {
    const result = await apimodelsChatStream({ ...input, upstreamModel: route.upstreamModel });
    return {
      response: result.response,
      provider: route.providerKey,
      protocol: result.protocol,
      providerRequestId: apimodelsRequestId(result.response.headers),
      providerReportedCost: apimodelsResponseCost(result.response.headers),
    };
  }
  if (key === "haimaker" || key === "haimakerai") {
    if (!process.env.HAIMAKER_API_KEY) throw new Error("HAIMAKER_API_KEY is not configured.");
    const response = await haimakerChatStream({
      ...input,
      upstreamModel: route.upstreamModel,
      modelId: route.modelId,
      upstreamOverride: route.upstreamModel,
    });
    return {
      response,
      provider: route.providerKey,
      protocol: "openai",
      providerRequestId: response.headers.get("x-request-id") ?? response.headers.get("request-id") ?? undefined,
    };
  }
  throw new Error(`Unsupported provider route: ${route.providerKey}`);
}

export async function providerTtsStreamExact(
  route: ResolvedBillingProviderRoute,
  input: Readonly<{ text: string; voiceId: string; languageCode?: string }>,
) {
  const key = route.providerKey.toLowerCase().replace(/[-_.]/g, "");
  let response: Response;
  if (key === "apimodels" || key === "apimodelsapp") {
    response = await apimodelsTtsStream({ model: route.upstreamModel, text: input.text, voice_id: input.voiceId, language_code: input.languageCode });
  } else if (key === "haimaker" || key === "haimakerai") {
    response = await haimakerTtsStream({ model: route.upstreamModel, input: input.text, voice: input.voiceId });
  } else {
    throw new Error(`Unsupported TTS provider route: ${route.providerKey}`);
  }
  return {
    response,
    provider: route.providerKey,
    providerRequestId: key === "apimodels" || key === "apimodelsapp"
      ? apimodelsRequestId(response.headers)
      : response.headers.get("x-request-id") ?? response.headers.get("request-id") ?? undefined,
    providerReportedCost: key === "apimodels" || key === "apimodelsapp"
      ? apimodelsResponseCost(response.headers)
      : undefined,
  } as const;
}
