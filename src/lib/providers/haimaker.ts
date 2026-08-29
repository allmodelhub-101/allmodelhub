import { getServerEnv } from "@/lib/env";
import type { ProviderChatRequest } from "@/lib/providers/types";

export function haimakerModelFor(amhModelId: string) {
  const env = getServerEnv();
  try {
    const map = JSON.parse(env.HAIMAKER_MODEL_MAP_JSON) as Record<string, string>;
    return map[amhModelId];
  } catch {
    return undefined;
  }
}

export async function haimakerChatStream(request: ProviderChatRequest & { modelId: string; upstreamOverride?: string }) {
  const env = getServerEnv();
  if (!env.HAIMAKER_API_KEY) throw new Error("HAIMAKER_API_KEY is not configured.");
  const mapped = request.upstreamOverride || haimakerModelFor(request.modelId);
  if (!mapped) throw new Error(`No Haimaker fallback mapping configured for ${request.modelId}.`);

  return fetch(`${env.HAIMAKER_BASE_URL}/chat/completions`, {
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
