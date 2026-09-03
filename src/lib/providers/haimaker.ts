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

function extractUrls(value: unknown): string[] {
  const urls = new Set<string>();
  const visit = (node: unknown, depth = 0) => {
    if (depth > 5 || node === null || node === undefined) return;
    if (typeof node === "string") { if (/^https?:\/\//i.test(node)) urls.add(node); return; }
    if (Array.isArray(node)) { node.forEach((item) => visit(item, depth + 1)); return; }
    if (typeof node !== "object") return;
    for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
      if (["result_urls", "resultUrls", "urls", "url", "output", "data", "result", "images", "videos"].includes(key)) visit(child, depth + 1);
    }
  };
  visit(value);
  return [...urls].slice(0, 20);
}

function normalizeState(value: unknown, urls: string[]): AsyncTaskResult["state"] {
  const state = String(value || "processing").toLowerCase().replace(/[ -]/g, "_");
  if (["completed", "complete", "succeeded", "success", "done", "finished"].includes(state) || urls.length) return "completed";
  if (["failed", "failure", "error", "cancelled", "canceled", "expired"].includes(state)) return "failed";
  if (["processing", "running", "in_progress", "inprogress"].includes(state)) return "processing";
  return "pending";
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
  const root = (json && typeof json === "object" ? json : {}) as Record<string, unknown>;
  const data = (root.data && typeof root.data === "object" ? root.data : root) as Record<string, unknown>;
  const urls = extractUrls(json);
  const taskId = String(data.id || data.task_id || data.taskId || root.id || root.task_id || crypto.randomUUID());
  return { taskId, state: normalizeState(data.status || data.state || root.status || root.state, urls), resultUrls: urls.length ? urls : undefined, raw: json };
}

export async function haimakerPollTask(modality: "image" | "video", taskId: string) {
  const env = getServerEnv();
  if (!env.HAIMAKER_API_KEY) throw new Error("HAIMAKER_API_KEY is not configured.");
  const endpoint = modality === "image" ? "images/generations" : "videos";
  const response = await fetch(`${apiUrl(endpoint)}?task_id=${encodeURIComponent(taskId)}`, { headers: { Authorization: `Bearer ${env.HAIMAKER_API_KEY}` }, cache: "no-store" });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Haimaker ${modality} poll failed (${response.status}).`);
  const root = (json && typeof json === "object" ? json : {}) as Record<string, unknown>;
  const data = (root.data && typeof root.data === "object" ? root.data : root) as Record<string, unknown>;
  const urls = extractUrls(json);
  const state = normalizeState(data.status || data.state || root.status || root.state, urls);
  return { taskId, state, resultUrls: urls.length ? urls : undefined, failMsg: typeof data.error === "string" ? data.error : undefined, raw: json };
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
