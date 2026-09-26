import assert from "node:assert/strict";
import test from "node:test";
import { mergeProviderUsage, normalizeProviderChunk } from "../../src/lib/providers/stream-normalizer.ts";

test("normalizes OpenAI exact usage without double-charging cached input", () => {
  const [event] = normalizeProviderChunk({
    id: "req_openai_1",
    usage: {
      prompt_tokens: 100,
      completion_tokens: 25,
      prompt_tokens_details: { cached_tokens: 40, cache_write_tokens: 3 },
      completion_tokens_details: { reasoning_tokens: 7 },
      cost: { amount: "0.000123456789", currency: "USD" },
    },
  }, "openai");
  assert.deepEqual(event, {
    type: "usage", inputTokens: "60", outputTokens: "25", cachedInputTokens: "40",
    cacheWriteTokens: "3", reasoningTokens: "7", providerRequestId: "req_openai_1",
    providerReportedCost: { amount: "0.000123456789", currency: "USD" },
  });
});

test("normalizes Anthropic cache reads, cache writes and thinking usage", () => {
  const [event] = normalizeProviderChunk({ request_id: "req_anthropic_1", usage: {
    input_tokens: "11", output_tokens: "9", cache_read_input_tokens: "5",
    cache_creation_input_tokens: "2", thinking_tokens: "4",
  } }, "anthropic");
  assert.equal(event.inputTokens, "11");
  assert.equal(event.cachedInputTokens, "5");
  assert.equal(event.cacheWriteTokens, "2");
  assert.equal(event.reasoningTokens, "4");
});

test("normalizes Gemini cached and reasoning tokens and merges partial events", () => {
  const [event] = normalizeProviderChunk({ id: "req_gemini_1", usageMetadata: {
    promptTokenCount: 80, candidatesTokenCount: 12, cachedContentTokenCount: 30, thoughtsTokenCount: 6,
  } }, "gemini");
  assert.equal(event.inputTokens, "50");
  const merged = mergeProviderUsage({ providerRequestId: "header-id", outputTokens: "1" }, event);
  assert.equal(merged.outputTokens, "12");
  assert.equal(merged.cachedInputTokens, "30");
  assert.equal(merged.providerRequestId, "req_gemini_1");
});

test("rejects fractional or negative token counts instead of coercing them", () => {
  const [event] = normalizeProviderChunk({ usage: { prompt_tokens: 1.5, completion_tokens: -1 } }, "openai");
  assert.equal(event.inputTokens, undefined);
  assert.equal(event.outputTokens, undefined);
});
