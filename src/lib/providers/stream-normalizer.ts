import type { NormalizedStreamEvent, ProviderProtocol } from "@/lib/providers/types";

function asNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function normalizeProviderChunk(chunk: any, protocol: ProviderProtocol): NormalizedStreamEvent[] {
  const events: NormalizedStreamEvent[] = [];

  if (protocol === "openai") {
    const delta = chunk?.choices?.[0]?.delta?.content;
    if (typeof delta === "string" && delta) events.push({ type: "delta", text: delta });
    const usage = chunk?.usage;
    if (usage) events.push({ type: "usage", inputTokens: asNumber(usage.prompt_tokens ?? usage.input_tokens), outputTokens: asNumber(usage.completion_tokens ?? usage.output_tokens) });
    return events;
  }

  if (protocol === "anthropic") {
    const text = chunk?.delta?.text ?? chunk?.content_block?.text;
    if (typeof text === "string" && text) events.push({ type: "delta", text });
    const usage = chunk?.usage ?? chunk?.message?.usage;
    if (usage) events.push({ type: "usage", inputTokens: asNumber(usage.input_tokens), outputTokens: asNumber(usage.output_tokens) });
    return events;
  }

  const parts = chunk?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    for (const part of parts) if (typeof part?.text === "string" && part.text) events.push({ type: "delta", text: part.text });
  }
  const usage = chunk?.usageMetadata;
  if (usage) events.push({ type: "usage", inputTokens: asNumber(usage.promptTokenCount), outputTokens: asNumber(usage.candidatesTokenCount) });
  return events;
}
