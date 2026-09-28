import type { NormalizedProviderUsage, NormalizedStreamEvent, ProviderProtocol } from "@/lib/providers/types";

function exactCount(value: unknown) {
  if (typeof value !== "number" && typeof value !== "string") return undefined;
  const text = String(value);
  if (!/^\d+$/.test(text)) return undefined;
  try {
    const parsed = BigInt(text);
    return parsed >= 0n ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

function exactCost(value: unknown) {
  if (typeof value !== "number" && typeof value !== "string") return undefined;
  const text = String(value);
  return /^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text) ? text : undefined;
}

function exclusiveCount(total: unknown, included: unknown) {
  const totalCount = exactCount(total);
  const includedCount = exactCount(included);
  if (!totalCount || !includedCount) return totalCount;
  const result = BigInt(totalCount) - BigInt(includedCount);
  return result >= 0n ? result.toString() : totalCount;
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function requestId(chunk: Record<string, unknown>) {
  const value = chunk.request_id ?? chunk.requestId ?? chunk.id;
  return typeof value === "string" && value ? value : undefined;
}

function reportedCost(...sources: unknown[]): NormalizedProviderUsage["providerReportedCost"] {
  for (const source of sources) {
    const value = object(source);
    const amount = exactCost(value.amount ?? value.total_cost ?? value.totalCost ?? value.cost ?? value.provider_cost);
    if (!amount) continue;
    const currency = String(value.currency ?? value.cost_currency ?? "USD").toUpperCase();
    if (currency === "USD" || currency === "PKR" || currency === "CREDIT") {
      return { amount, currency };
    }
  }
  return undefined;
}

export function normalizeProviderChunk(chunk: unknown, protocol: ProviderProtocol): NormalizedStreamEvent[] {
  const root = object(chunk);
  const events: NormalizedStreamEvent[] = [];

  if (protocol === "openai") {
    const choices = Array.isArray(root.choices) ? root.choices : [];
    const delta = object(object(choices[0]).delta).content;
    if (typeof delta === "string" && delta) events.push({ type: "delta", text: delta });
    const usage = object(root.usage);
    if (Object.keys(usage).length) {
      const promptDetails = object(usage.prompt_tokens_details ?? usage.input_tokens_details);
      const completionDetails = object(usage.completion_tokens_details ?? usage.output_tokens_details);
      events.push({
        type: "usage",
        inputTokens: exclusiveCount(usage.prompt_tokens ?? usage.input_tokens, promptDetails.cached_tokens ?? usage.cached_input_tokens),
        outputTokens: exactCount(usage.completion_tokens ?? usage.output_tokens),
        cachedInputTokens: exactCount(promptDetails.cached_tokens ?? usage.cached_input_tokens),
        cacheWriteTokens: exactCount(promptDetails.cache_write_tokens ?? usage.cache_write_tokens),
        reasoningTokens: exactCount(completionDetails.reasoning_tokens ?? usage.reasoning_tokens),
        providerRequestId: requestId(root),
        providerReportedCost: reportedCost(usage.cost, usage, root.cost, root),
      });
    }
    return events;
  }

  if (protocol === "anthropic") {
    const delta = object(root.delta).text ?? object(root.content_block).text;
    if (typeof delta === "string" && delta) events.push({ type: "delta", text: delta });
    const usage = Object.keys(object(root.usage)).length ? object(root.usage) : object(object(root.message).usage);
    if (Object.keys(usage).length) {
      events.push({
        type: "usage",
        inputTokens: exactCount(usage.input_tokens),
        outputTokens: exactCount(usage.output_tokens),
        cachedInputTokens: exactCount(usage.cache_read_input_tokens ?? usage.cached_input_tokens),
        cacheWriteTokens: exactCount(usage.cache_creation_input_tokens ?? usage.cache_write_input_tokens),
        reasoningTokens: exactCount(usage.thinking_tokens ?? usage.reasoning_tokens),
        providerRequestId: requestId(root),
        providerReportedCost: reportedCost(usage.cost, usage, root.cost, root),
      });
    }
    return events;
  }

  const candidates = Array.isArray(root.candidates) ? root.candidates : [];
  const parts = object(object(candidates[0]).content).parts;
  if (Array.isArray(parts)) {
    for (const part of parts) {
      const text = object(part).text;
      if (typeof text === "string" && text) events.push({ type: "delta", text });
    }
  }
  const usage = object(root.usageMetadata);
  if (Object.keys(usage).length) {
    events.push({
      type: "usage",
      inputTokens: exclusiveCount(usage.promptTokenCount, usage.cachedContentTokenCount),
      outputTokens: exactCount(usage.candidatesTokenCount),
      cachedInputTokens: exactCount(usage.cachedContentTokenCount),
      cacheWriteTokens: exactCount(usage.cacheWriteTokenCount),
      reasoningTokens: exactCount(usage.thoughtsTokenCount),
      providerRequestId: requestId(root),
      providerReportedCost: reportedCost(usage.cost, usage, root.cost, root),
    });
  }
  return events;
}

export function mergeProviderUsage(current: NormalizedProviderUsage, event: NormalizedProviderUsage): NormalizedProviderUsage {
  return {
    inputTokens: event.inputTokens ?? current.inputTokens,
    outputTokens: event.outputTokens ?? current.outputTokens,
    cachedInputTokens: event.cachedInputTokens ?? current.cachedInputTokens,
    cacheWriteTokens: event.cacheWriteTokens ?? current.cacheWriteTokens,
    reasoningTokens: event.reasoningTokens ?? current.reasoningTokens,
    providerRequestId: event.providerRequestId ?? current.providerRequestId,
    providerReportedCost: event.providerReportedCost ?? current.providerReportedCost,
  };
}
