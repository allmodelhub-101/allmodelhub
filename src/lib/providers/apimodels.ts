import { getServerEnv } from "@/lib/env";
import type { AsyncTaskResult, ProviderChatRequest } from "@/lib/providers/types";

export type ProviderFailureKind = "authentication" | "model_unavailable" | "temporary" | "configuration";

export class ProviderRequestError extends Error {
  constructor(public readonly kind: ProviderFailureKind, message = "Provider request failed") {
    super(message);
    this.name = "ProviderRequestError";
  }
}

function apiUrl(path: string) {
  const base = getServerEnv().APIMODELS_BASE_URL.replace(/\/+$/, "").replace(/\/v1$/i, "");
  return `${base}/v1/${path.replace(/^\/+/, "")}`;
}

function logProviderResponse(provider: string, endpoint: string, model: string | undefined, response: Response) {
  if (response.ok) {
    console.info("[v0] provider request succeeded", JSON.stringify({ provider, endpoint, model, status: response.status }));
    return;
  }
  void response.clone().text().then((body) => {
    console.error("[v0] provider diagnostic", JSON.stringify({
      environment: { apimodelsKeyPresent: Boolean(process.env.APIMODELS_API_KEY), apimodelsBaseUrlPresent: Boolean(process.env.APIMODELS_BASE_URL) },
      outgoing: { provider, endpoint, model, method: "POST" },
      incoming: { status: response.status, body: body.replace(/(api[_-]?key|authorization|token|secret)\s*[:=]\s*[\"']?[^,\"' }]+/gi, "$1:[REDACTED]").slice(0, 1000) }
    }));
  }).catch(() => undefined);
}

function headers() {
  const env = getServerEnv();
  if (!env.APIMODELS_API_KEY) throw new Error("APIMODELS_API_KEY is not configured.");
  return { Authorization: `Bearer ${env.APIMODELS_API_KEY}`, "Content-Type": "application/json" };
}

function extractResultUrls(value: unknown): string[] {
  const urls = new Set<string>();
  function visit(node: unknown, depth = 0) {
    if (depth > 5 || node === null || node === undefined) return;
    if (typeof node === "string") { if (/^https?:\/\//i.test(node)) urls.add(node); return; }
    if (Array.isArray(node)) { node.forEach((item) => visit(item, depth + 1)); return; }
    if (typeof node !== "object") return;
    const object = node as Record<string, unknown>;
    for (const [key, child] of Object.entries(object)) {
      if (["result_urls", "resultUrls", "urls", "url", "output", "data", "result", "images", "videos", "audio"].includes(key)) visit(child, depth + 1);
    }
  }
  visit(value);
  return [...urls].slice(0, 20);
}

function normalizeTask(json: unknown): AsyncTaskResult {
  const root = (json && typeof json === "object" ? json : {}) as Record<string, unknown>;
  const data = (root.data && typeof root.data === "object" ? root.data : root) as Record<string, unknown>;
  const resultUrls = extractResultUrls(json);
  const rawState = String(data.state ?? data.status ?? root.state ?? root.status ?? "pending").toLowerCase();
  const state = rawState === "completed" || rawState === "complete" || rawState === "succeeded" || rawState === "success" || (resultUrls?.length ?? 0) > 0 ? "completed" : rawState === "failed" || rawState === "error" || rawState === "cancelled" ? "failed" : rawState === "processing" || rawState === "running" || rawState === "in_progress" ? "processing" : "pending";
  return {
    taskId: String(data.taskId ?? data.task_id ?? data.id ?? root.taskId ?? root.task_id ?? root.id ?? ""),
    state,
    resultUrls: resultUrls.length ? resultUrls : undefined,
    failMsg: typeof (data.failMsg ?? data.fail_message ?? data.error ?? root.error) === "string" ? String(data.failMsg ?? data.fail_message ?? data.error ?? root.error) : undefined,
    raw: json
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

function providerFailure(status: number) {
  if (status === 401 || status === 403) return new ProviderRequestError("authentication", "Provider authentication failed");
  if (status === 400 || status === 404) return new ProviderRequestError("model_unavailable", "Model unavailable");
  if (status === 409 || status === 429 || status >= 500) return new ProviderRequestError("temporary", "Provider temporarily unavailable");
  return new ProviderRequestError("configuration", "Invalid model configuration");
}

export async function apimodelsChatStream(request: ProviderChatRequest) {
  const response = await fetch(apiUrl("chat/completions"), {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(openAiBody(request)),
    cache: "no-store"
  });
  logProviderResponse("apimodels", apiUrl("chat/completions"), request.upstreamModel, response);
  return { response, protocol: "openai" as const };
}

export async function apimodelsCreateTask(modality: "image" | "video" | "audio", body: Record<string, unknown>) {
  const plural = modality === "image" ? "images" : modality;
  const response = await fetch(apiUrl(`${plural}/generations`), {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
    cache: "no-store"
  });
  logProviderResponse("apimodels", apiUrl(`${plural}/generations`), String(body.model ?? ""), response);
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw providerFailure(response.status);
  return normalizeTask(json);
}

export async function apimodelsPollTask(modality: "image" | "video" | "audio", taskId: string) {
  const plural = modality === "image" ? "images" : modality;
  const response = await fetch(`${apiUrl(`${plural}/generations`)}?task_id=${encodeURIComponent(taskId)}`, {
    headers: headers(),
    cache: "no-store"
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json?.message || json?.msg || `APIMODELS task poll failed (${response.status}).`);
  return normalizeTask(json);
}

export async function apimodelsTtsStream(body: { model: string; text: string; voice_id: string; language_code?: string }) {
  const endpoint = apiUrl("audio/speech");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ model: body.model, input: body.text, voice: body.voice_id, ...(body.language_code ? { language: body.language_code } : {}) }),
    cache: "no-store"
  });
  logProviderResponse("apimodels", endpoint, body.model, response);
  return response;
}
