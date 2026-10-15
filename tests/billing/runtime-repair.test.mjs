import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { minimaxSpeechPayload, minimaxVoices } from "../../src/lib/audio-execution.ts";
import { getMediaExecutionContract, validateMediaContractRequest } from "../../src/lib/media-execution-contract.ts";
import { extractExactJsonDecimal, normalizeApimodelsBillingRecord } from "../../src/lib/providers/apimodels-billing-core.ts";
import { priceMediaAuthorization } from "../../src/lib/billing/media-authorization-pricing.ts";
import { modelAvailabilityMessage } from "../../src/lib/model-availability-message.ts";
import { ALL_MODELS } from "../../src/lib/models.ts";
import { evaluateModelReadiness } from "../../src/lib/model-readiness-core.ts";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import * as contracts from "../../src/lib/media-execution-contract.ts";
import * as audio from "../../src/lib/audio-execution.ts";
import * as mediaBilling from "../../src/lib/billing/media-job-billing-core.ts";

test("real media preparation binds MiniMax text, voice, and billed characters without dropping options", async () => {
  const realRequire = createRequire(import.meta.url);
  const exports = {};
  const dependencies = {
    "server-only": {}, "@/lib/supabase/admin": { createAdminClient: () => ({}) },
    "@/lib/file-extract": {}, "@/lib/provider-input-assets": {}, "@/lib/media-metadata": {},
    "@/lib/media-execution-contract": contracts, "@/lib/audio-execution": audio,
    "@/lib/billing/media-job-billing-core": mediaBilling,
  };
  const code = ts.transpileModule(readFileSync(new URL("../../src/lib/media-request.ts", import.meta.url), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(code, { exports, require: (name) => name in dependencies ? dependencies[name] : realRequire(name), Error });
  for (const modelId of ["minimax-speech-2-8-turbo", "minimax-speech-2-8-hd"]) {
    const input = exports.generationInputSchema.parse({ requestId: "00000000-0000-4000-8000-000000000001",
      modelId, prompt: " A🎤你 ", voiceId: minimaxVoices[0].value });
    const prepared = await exports.prepareMediaRequest("isolated-test", input, "audio");
    assert.equal(prepared.providerBody.text, input.prompt);
    assert.equal(prepared.providerBody.voice_id, input.voiceId);
    assert.equal(prepared.providerBody.prompt, undefined);
    assert.equal(prepared.usage.characters, "5");
    assert.equal(prepared.dimensions.inputType, "text");
    for (const extra of [{ voiceSpeed: 1 }, { languageCode: "en" }, { duration: 5 }, { quality: "hd" },
      { mode: "music" }, { nativeAudio: true }, { resolution: "1K" }]) {
      await assert.rejects(exports.prepareMediaRequest("isolated-test", { ...input, ...extra }, "audio"), /MEDIA_OPTION_UNSUPPORTED/);
    }
  }
});

test("all 57 audited routes preserve readiness and only the two repaired MiniMax routes become ready", () => {
  const snapshot = JSON.parse(readFileSync(new URL("../fixtures/runtime-readiness-2026-10-15.json", import.meta.url), "utf8"));
  assert.equal(snapshot.models.length, 57);
  const before = {}, after = {};
  for (const row of snapshot.models) {
    const catalog = ALL_MODELS.find((model) => model.id === row.id);
    assert.ok(catalog, row.id);
    const result = evaluateModelReadiness({ model: { ...catalog, uiSchema: row.uiSchema }, active: true,
      routes: snapshot.routes, policies: snapshot.policies, configurationReady: true });
    before[row.modality] = (before[row.modality] || 0) + Number(row.available);
    after[row.modality] = (after[row.modality] || 0) + Number(result.ready);
    if (row.id.startsWith("minimax-speech-2-8-")) assert.equal(result.ready, true, row.id);
    else {
      assert.equal(result.ready, row.available, row.id);
      assert.equal(result.reason, row.availabilityReason, row.id);
    }
  }
  assert.deepEqual(before, { text: 18, image: 12, video: 15, audio: 6 });
  assert.deepEqual(after, { text: 18, image: 12, video: 15, audio: 8 });
});

test("MiniMax uses its own async speech contract and rejects foreign voices/options", () => {
  for (const modelId of ["minimax-speech-2-8-turbo", "minimax-speech-2-8-hd"]) {
    const contract = getMediaExecutionContract(modelId);
    assert.equal(contract.strategy, "apimodels_audio_async");
    for (const voice of minimaxVoices) {
      assert.deepEqual(minimaxSpeechPayload({ modelId, text: "Hello", voiceId: voice.value }), { text: "Hello", voice_id: voice.value });
    }
    assert.throws(() => minimaxSpeechPayload({ modelId, text: "Hello", voiceId: "EXAVITQu4vr4xnSDxMaL" }), /voice/);
    assert.throws(() => minimaxSpeechPayload({ modelId, text: "Hello", voiceId: minimaxVoices[0].value, voiceSpeed: 1.5 }), /voice_setting/);
    assert.throws(() => minimaxSpeechPayload({ modelId, text: "Hello", voiceId: minimaxVoices[0].value, languageCode: "en" }), /voice_setting/);
    assert.throws(() => minimaxSpeechPayload({ modelId, text: "a".repeat(10001), voiceId: minimaxVoices[0].value }), /prompt/);
    assert.throws(() => validateMediaContractRequest(contract, { referenceCount: 1 }), /references/);
  }
});

test("record costs preserve exponent notation, large decimals, and correct envelope field", () => {
  assert.equal(extractExactJsonDecimal('{"data":{"credits":1e-7}}', "credits"), "0.0000001");
  assert.equal(extractExactJsonDecimal('{"data":{"credits":9.007199254740993123456789e15}}', "credits"), "9007199254740993.123456789");
  assert.equal(extractExactJsonDecimal('{"credits":99,"data":{"usage":{"credits":88},"credits":0.000001}}', "credits"), "0.000001");
  assert.equal(extractExactJsonDecimal('{"data":{"credits":null,"settled":false}}', "credits"), undefined);
  assert.throws(() => extractExactJsonDecimal('{"data":{"credits":-1e-7}}', "credits"), /non-negative/);
  assert.throws(() => extractExactJsonDecimal('{"data":{"credits":1e-7oops}}', "credits"));
});

test("documented pending records remain pending and Unix milliseconds become durable timestamps", () => {
  const pending = normalizeApimodelsBillingRecord({ data: { task_id: "pending", state: "pending", settled: false, credits: null, currency: "USD", created_at: 1790676571513, completed_at: null } });
  assert.equal(pending.settled, false);
  assert.equal(pending.creditsUsd, undefined);
  assert.equal(pending.createdAt, new Date(1790676571513).toISOString());
  assert.equal(pending.completedAt, undefined);
});

test("availability labels distinguish adapter support from authorization problems", () => {
  assert.equal(modelAvailabilityMessage("provider_adapter_unavailable"), "Workflow support unavailable");
  assert.equal(modelAvailabilityMessage("authorization_pricing_unavailable"), "Billing authorization unavailable");
  assert.notEqual(modelAvailabilityMessage("runtime_configuration_unavailable"), modelAvailabilityMessage("provider_adapter_unavailable"));
});

test("MiniMax authorization prices submitted Unicode characters with policy data, never output duration", () => {
  for (const [modelId, upstreamModel, rate] of [
    ["minimax-speech-2-8-turbo", "minimax-speech-2.8-turbo", "0.04"],
    ["minimax-speech-2-8-hd", "minimax-speech-2.8-hd", "0.063"],
  ]) {
    const policy = { media_authorization_pricing: { id: "fixture", provider_key: "apimodels", model_id: modelId,
      upstream_model: upstreamModel, pricing_version: "fixture-verified", billing_type: "character", currency: "USD",
      per_1k_character_price: rate, status: "verified", active: true, verified_at: "2026-10-15T00:00:00Z",
      effective_from: "2026-10-15T00:00:00Z", effective_until: null, source_name: "APIMODELS",
      source_url: "https://apimodels.app/docs/audio", source_metadata: {}, metadata: {}, formula: {},
      resolution_dimensions: {}, quality_dimensions: {}, mode_dimensions: {}, input_type_dimensions: {} } };
    const result = priceMediaAuthorization({ metadata: policy, providerKey: "apimodels", modelId, upstreamModel,
      pricingVersion: "fixture-verified", markup: "2.2", internalUsdPkrRate: "310",
      usage: { characters: String(Array.from("A🎤你").length) }, dimensions: { inputType: "text" } });
    assert.equal(result.providerCostUsd, modelId.endsWith("turbo") ? "0.00012" : "0.000189");
  }
});

test("all model-list clients explicitly bypass stale HTTP cache", () => {
  for (const name of ["tts-client", "audio-generation-client", "chat-client", "image-studio", "media-studio", "model-battle", "video-studio", "workspace-topbar"]) {
    const source = readFileSync(new URL(`../../src/components/${name}.tsx`, import.meta.url), "utf8");
    assert.match(source, /fetch\("\/api\/models", \{[^}]*cache: "no-store"/);
  }
  const route = readFileSync(new URL("../../src/app/api/models/route.ts", import.meta.url), "utf8");
  assert.match(route, /"Cache-Control": "private, no-store, max-age=0"/);
  assert.match(route, /"Vercel-CDN-Cache-Control": "no-store"/);
});
