import type { NormalizedStreamEvent, ProviderProtocol } from "@/lib/providers/types";

function asNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

type ProviderChunk = { choices?: Array<{ delta?: { content?: unknown } }>; usage?: { prompt_tokens?: unknown; input_tokens?: unknown; completion_tokens?: unknown; output_tokens?: unknown }; delta?: { text?: unknown }; content_block?: { text?: unknown }; message?: { usage?: { input_tokens?: unknown; output_tokens?: unknown } }; candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }>; usageMetadata?: { promptTokenCount?: unknown; candidatesTokenCount?: unknown } };

export function normalizeProviderChunk(chunk: unknown, protocol: ProviderProtocol): NormalizedStreamEvent[] {
  const typedChunk = chunk as ProviderChunk;
  const events: NormalizedStreamEvent[] = [];

  if (protocol === "openai") {
    const delta = typedChunk?.choices?.[0]?.delta?.content;
    if (typeof delta === "string" && delta) events.push({ type: "delta", text: delta });
    const usage = typedChunk?.usage;
    if (usage) events.push({ type: "usage", inputTokens: asNumber(usage.prompt_tokens ?? usage.input_tokens), outputTokens: asNumber(usage.completion_tokens ?? usage.output_tokens) });
    return events;
  }

  if (protocol === "anthropic") {
    const text = typedChunk?.delta?.text ?? typedChunk?.content_block?.text;
    if (typeof text === "string" && text) events.push({ type: "delta", text });
    const usage = typedChunk?.usage ?? typedChunk?.message?.usage;
    if (usage) events.push({ type: "usage", inputTokens: asNumber(usage.input_tokens), outputTokens: asNumber(usage.output_tokens) });
    return events;
  }

  const parts = typedChunk?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    for (const part of parts) if (typeof part?.text === "string" && part.text) events.push({ type: "delta", text: part.text });
  }
  const usage = typedChunk?.usageMetadata;
  if (usage) events.push({ type: "usage", inputTokens: asNumber(usage.promptTokenCount), outputTokens: asNumber(usage.candidatesTokenCount) });
  return events;
}
