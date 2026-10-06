import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getMediaExecutionContract } from "../../src/lib/media-execution-contract.ts";

test("TTS transports are provider-model specific", () => {
  assert.equal(getMediaExecutionContract("eleven-tts-flash").strategy, "apimodels_eleven_stream");
  assert.equal(getMediaExecutionContract("kling-tts").strategy, "apimodels_audio_async");
  assert.equal(getMediaExecutionContract("minimax-speech-2-8-hd"), undefined);
});

test("direct response-header settlement is allowed only for complete exact USD evidence", () => {
  const migration = readFileSync(new URL("../../supabase/migrations/20260930020000_audio_response_header_settlement.sql", import.meta.url), "utf8");
  assert.match(migration, /source = 'response_header'[\s\S]*settled = true[\s\S]*state = 'completed'[\s\S]*credits_usd is not null[\s\S]*currency = 'USD'/);
  assert.match(migration, /not v_header_only/);
  assert.match(migration, /revoke all on function public\.billing_v3_record_provider_observation/);
});

test("successful direct audio is not failed by post-stream settlement work", () => {
  const billing = readFileSync(new URL("../../src/lib/billing/tts-billing.ts", import.meta.url), "utf8");
  const route = readFileSync(new URL("../../src/app/api/tts/route.ts", import.meta.url), "utf8");
  assert.match(billing, /providerStarted = true[\s\S]*try \{[\s\S]*providerReportedCost/);
  assert.match(billing, /billing_write_failed/);
  assert.match(route, /tts-v3-post-stream-settlement/);
  assert.match(route, /X-AMH-Billing-Quote-Id/);
  assert.match(route, /X-AMH-Credits/);
});

test("audio usage omits visual fields instead of sending zero-valued dimensions", () => {
  const core = readFileSync(new URL("../../src/lib/billing/media-job-billing-core.ts", import.meta.url), "utf8");
  const route = readFileSync(new URL("../../src/lib/media-request.ts", import.meta.url), "utf8");
  assert.match(core, /isImage \? \{ images:/);
  assert.match(route, /const imageCount = modality === "image" \? input\.imageCount \?\? 1 : undefined/);
  assert.doesNotMatch(route, /imageCount: modality === "audio" \? 0/);
});

test("pre-acceptance HTTP failure releases instead of retaining a hold", () => {
  const billing = readFileSync(new URL("../../src/lib/billing/tts-billing.ts", import.meta.url), "utf8");
  assert.match(billing, /if \(!upstream\.response\.ok \|\| !upstream\.response\.body\).*providerStarted = true/s);
  assert.match(billing, /authorization && !providerStarted[\s\S]*cancelBillingQuoteReservation/);
});

test("Kling async payload uses Kling voice fields and never Eleven streaming", () => {
  const route = readFileSync(new URL("../../src/app/api/generations/[modality]/route.ts", import.meta.url), "utf8");
  const providers = readFileSync(new URL("../../src/lib/providers/index.ts", import.meta.url), "utf8");
  assert.match(route, /voice_id: input\.voiceId[\s\S]*voice_language: input\.languageCode[\s\S]*voice_speed/);
  assert.match(providers, /route\.modelId\.startsWith\("eleven-tts-"\)/);
});


