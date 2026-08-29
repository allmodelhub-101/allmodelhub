import { getServerEnv } from "@/lib/env";
import type { AsyncTaskResult, ProviderChatRequest, ProviderProtocol } from "@/lib/providers/types";

function headers() {
  const env = getServerEnv();
  if (!env.APIMODELS_API_KEY) throw new Error("APIMODELS_API_KEY is not configured.");
  return { Authorization: `Bearer ${env.APIMODELS_API_KEY}`, "Content-Type": "application/json" };
}

function normalizeTask(json: unknown): AsyncTaskResult {
  const root = json as Record<string, unknown>;
  const data = (root.data && typeof root.data === "object" ? root.data : root) as { taskId?: string; task_id?: string; id?: string; state?: AsyncTaskResult["state"]; status?: AsyncTaskResult["state"]; resultUrls?: string[]; result_urls?: string[]; urls?: string[]; resultJson?: string; failMsg?: string; fail_message?: string; error?: string };
  let resultUrls = data?.resultUrls ?? data?.result_urls ?? data?.urls;
  if (!resultUrls && typeof data?.resultJson === "string") {
    try { resultUrls = JSON.parse(data.resultJson)?.resultUrls; } catch { /* provider returned non-JSON result */ }
  }
  return {
    taskId: data?.taskId ?? data?.task_id ?? data?.id ?? "",
    state: data?.state ?? data?.status ?? "pending",
    resultUrls,
    failMsg: data?.failMsg ?? data?.fail_message ?? data?.error,
    raw: json
  };
}

function protocolFor(model: string): ProviderProtocol {
  if (model.startsWith("claude-")) return "anthropic";
  if (model.startsWith("gemini-")) return "gemini";
  return "openai";
}

function anthropicBody(request: ProviderChatRequest) {
  const systems = request.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  return {
    model: request.upstreamModel,
    system: systems || undefined,
    messages: request.messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content })),
    max_tokens: request.maxTokens ?? 2048,
    temperature: request.temperature ?? 0.7,
    stream: true
  };
}

function geminiBody(request: ProviderChatRequest) {
  const systems = request.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  return {
    model: request.upstreamModel,
    systemInstruction: systems ? { parts: [{ text: systems }] } : undefined,
    contents: request.messages.filter((m) => m.role !== "system").map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    })),
    generationConfig: {
      maxOutputTokens: request.maxTokens ?? 2048,
      temperature: request.temperature ?? 0.7,
      ...(request.deepThink ? { thinkingConfig: { includeThoughts: false } } : {})
    },
    stream: true
  };
}

function openAiBody(request: ProviderChatRequest) {
  return {
    model: request.upstreamModel,
    messages: request.messages,
    max_tokens: request.maxTokens ?? 2048,
    temperature: request.temperature ?? 0.7,
    ...(request.deepThink ? { reasoning_effort: "high" } : {}),
    stream: true,
    stream_options: { include_usage: true }
  };
}

export async function apimodelsChatStream(request: ProviderChatRequest) {
  const env = getServerEnv();
  const protocol = protocolFor(request.upstreamModel);
  const body = protocol === "anthropic" ? anthropicBody(request) : protocol === "gemini" ? geminiBody(request) : openAiBody(request);
  const response = await fetch(`${env.APIMODELS_BASE_URL}/messages`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
    cache: "no-store"
  });
  return { response, protocol };
}

export async function apimodelsCreateTask(modality: "image" | "video" | "audio", body: Record<string, unknown>) {
  const env = getServerEnv();
  const plural = modality === "image" ? "images" : modality;
  const response = await fetch(`${env.APIMODELS_BASE_URL}/${plural}/generations`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
    cache: "no-store"
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json?.message || json?.msg || `APIMODELS ${modality} request failed (${response.status}).`);
  return normalizeTask(json);
}

export async function apimodelsPollTask(modality: "image" | "video" | "audio", taskId: string) {
  const env = getServerEnv();
  const plural = modality === "image" ? "images" : modality;
  const response = await fetch(`${env.APIMODELS_BASE_URL}/${plural}/generations?task_id=${encodeURIComponent(taskId)}`, {
    headers: headers(),
    cache: "no-store"
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json?.message || json?.msg || `APIMODELS task poll failed (${response.status}).`);
  return normalizeTask(json);
}

export async function apimodelsTtsStream(body: { model: string; text: string; voice_id: string; language_code?: string }) {
  const env = getServerEnv();
  return fetch(`${env.APIMODELS_BASE_URL}/tts/stream`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
    cache: "no-store"
  });
}
