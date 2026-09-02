import { getServerEnv } from "@/lib/env";
import type { AsyncTaskResult, ProviderChatRequest } from "@/lib/providers/types";

function apiUrl(path: string) {
  const base = getServerEnv().HAIMAKER_BASE_URL.replace(/\/+$/, "").replace(/\/v1$/i, "");
  return `${base}/v1/${path.replace(/^\/+/, "")}`;
}

export function haimakerModelFor(amhModelId: string) {
  const env = getServerEnv();
  try {
    const map = JSON.parse(env.HAIMAKER_MODEL_MAP_JSON) as Record<string, string>;
    return map[amhModelId] ?? amhModelId;
  } catch {
    return amhModelId;
  }
}

export async function haimakerCreateTask(modality: "image" | "video", body: Record<string, unknown>): Promise<AsyncTaskResult> {
  const env = getServerEnv();
  if (!env.HAIMAKER_API_KEY) throw new Error("HAIMAKER_API_KEY is not configured.");
  const endpoint = modality === "image" ? "images/generations" : "videos";
  const response = await fetch(apiUrl(endpoint), {
    method: "POST",
    headers: { Authorization: `Bearer ${env.HAIMAKER_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store"
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Haimaker ${modality} request failed (${response.status}).`);
  const root = json as Record<string, unknown>;
  const data = (root.data && typeof root.data === "object" ? root.data : root) as Record<string, unknown>;
  const urls = Array.isArray(data.data) ? data.data.map((item) => typeof item === "object" && item ? String((item as Record<string, unknown>).url || "") : "").filter(Boolean) : [data.url, data.video_url, data.output_url].filter((value): value is string => typeof value === "string" && value.length > 0);
  const taskId = String(data.id || data.task_id || crypto.randomUUID());
  return { taskId, state: urls.length ? "completed" : "processing", resultUrls: urls, raw: json };
}

export async function haimakerPollTask(modality: "image" | "video", taskId: string) {
  const env = getServerEnv();
  if (!env.HAIMAKER_API_KEY) throw new Error("HAIMAKER_API_KEY is not configured.");
  const endpoint = modality === "image" ? "images/generations" : "videos";
  const response = await fetch(`${apiUrl(endpoint)}?task_id=${encodeURIComponent(taskId)}`, { headers: { Authorization: `Bearer ${env.HAIMAKER_API_KEY}` }, cache: "no-store" });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Haimaker ${modality} poll failed (${response.status}).`);
  const root = json as Record<string, unknown>;
  const data = (root.data && typeof root.data === "object" ? root.data : root) as Record<string, unknown>;
  const status = String(data.status || data.state || "processing").toLowerCase();
  const items = Array.isArray(data.data) ? data.data : [];
  const urls = items.map((item) => typeof item === "object" && item ? String((item as Record<string, unknown>).url || "") : "").filter(Boolean);
  const direct = [data.url, data.video_url, data.output_url].filter((value): value is string => typeof value === "string" && value.length > 0);
  return { taskId, state: (status === "completed" || status === "succeeded" || urls.length || direct.length ? "completed" : status === "failed" || status === "error" ? "failed" : "processing") as "completed" | "failed" | "processing", resultUrls: [...urls, ...direct], failMsg: typeof data.error === "string" ? data.error : undefined, raw: json };
}

export async function haimakerTtsStream(body: { model: string; input: string; voice: string }) {
  const env = getServerEnv();
  if (!env.HAIMAKER_API_KEY) throw new Error("HAIMAKER_API_KEY is not configured.");
  return fetch(apiUrl("audio/speech"), { method: "POST", headers: { Authorization: `Bearer ${env.HAIMAKER_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
}

export async function haimakerChatStream(request: ProviderChatRequest & { modelId: string; upstreamOverride?: string }) {
  const env = getServerEnv();
  if (!env.HAIMAKER_API_KEY) throw new Error("HAIMAKER_API_KEY is not configured.");
  const mapped = request.upstreamOverride || haimakerModelFor(request.modelId);
  if (!mapped) throw new Error(`No Haimaker fallback mapping configured for ${request.modelId}.`);

  return fetch(apiUrl("chat/completions"), {
    method: "POST",
    headers: { Authorization: `Bearer ${env.HAIMAKER_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: mapped,
      messages: request.messages,
      max_tokens: request.maxTokens ?? 2048,
      temperature: request.temperature ?? 0.7,
      stream: true,
      stream_options: { include_usage: true }
    }),
    cache: "no-store"
  });
}
