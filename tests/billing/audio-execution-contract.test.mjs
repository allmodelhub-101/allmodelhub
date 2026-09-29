import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getMediaExecutionContract } from "../../src/lib/media-execution-contract.ts";

test("TTS transports are provider-model specific", () => {
  assert.equal(getMediaExecutionContract("eleven-tts-flash").strategy, "apimodels_eleven_stream");
  assert.equal(getMediaExecutionContract("kling-tts").strategy, "apimodels_audio_async");
  assert.equal(getMediaExecutionContract("minimax-speech-2-8-hd"), undefined);
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
