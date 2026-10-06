import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ALL_MODELS } from "../../src/lib/models.ts";
import { evaluateModelReadiness } from "../../src/lib/model-readiness-core.ts";
import { priceMediaAuthorization, videoTokenFormulaEvaluator } from "../../src/lib/billing/media-authorization-pricing.ts";
import { getMediaExecutionContract, mediaContractUiSchema, mediaProviderOptionPayload, referencePayload, validateMediaContractRequest } from "../../src/lib/media-execution-contract.ts";
import { inspectMediaBytes } from "../../src/lib/media-metadata.ts";
const source = (path) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");
const migration = source("supabase/migrations/20261005203530_video_v3_native_authorization.sql");
const definitions = [...migration.matchAll(/\('([^']+)', '([^']+)', ([\d.]+)::numeric, '([^']+)'::jsonb, '([^']+)'::jsonb\)/g)]
  .map((match) => ({ model_id: match[1], upstream_model: match[2], maximum_provider_cost_usd: match[3],
    provider_key: "apimodels", modality: "video", request_constraints: JSON.parse(match[4]), metadata: JSON.parse(match[5]) }));

test("all fifteen video catalog entries have deterministic canonical readiness", () => {
  const models = ALL_MODELS.filter((model) => model.modality === "video");
  assert.equal(models.length, 15);
  for (const model of models) {
    const contract = getMediaExecutionContract(model.id);
    assert.ok(contract, model.id);
    const input = { model: { ...model, uiSchema: mediaContractUiSchema(contract) }, active: true,
      routes: [{ provider_key: "apimodels", model_id: model.id, upstream_model: model.upstreamModel }],
      policies: [], configurationReady: true };
    const state = evaluateModelReadiness(input);
    assert.equal(state.ready, false);
    assert.equal(state.reason, "authorization_pricing_unavailable");
    assert.deepEqual(evaluateModelReadiness(input), state);
  }
});

test("verified native definitions become ready without any V2 lookup or frozen policy FX", () => {
  assert.equal(definitions.length, 5);
  for (const policy of definitions) {
    const model = ALL_MODELS.find((model) => model.id === policy.model_id);
    const input = { model: { ...model, markup: 2, uiSchema: mediaContractUiSchema(getMediaExecutionContract(model.id)) },
      active: true, routes: [policy], policies: [policy], configurationReady: true };
    assert.equal(evaluateModelReadiness(input).ready, true, model.id);
    assert.equal(evaluateModelReadiness({ ...input, model: { ...input.model, markup: 3 } }).ready, true);
    assert.equal(evaluateModelReadiness({ ...input, configurationReady: false }).ready, false);
    assert.equal(evaluateModelReadiness({ ...input, policies: [] }).ready, false);
    assert.equal(evaluateModelReadiness({ ...input, routes: [] }).ready, false);
    assert.equal(evaluateModelReadiness({ ...input, model: { ...input.model, uiSchema: { resolutionOptions: ["fake"] } } }).ready, false);
  }
  for (const path of ["src/lib/model-store.ts", "src/lib/billing/authorization.ts", "src/lib/model-readiness-core.ts"]) {
    assert.doesNotMatch(source(path), /billing_provider_pricing_registry|provider_pricing_rules|priceProviderRequest/);
  }
});

test("request duration, resolution and current economics change exact V3 estimates", () => {
  const policy = definitions.find((policy) => policy.model_id === "ltx-2-3");
  const quote = (seconds, resolution, fx = "280", markup = "2") => priceMediaAuthorization({
    metadata: policy.metadata, providerKey: policy.provider_key, modelId: policy.model_id,
    upstreamModel: policy.upstream_model, pricingVersion: policy.metadata.derived_from_verified_pricing_version,
    markup, internalUsdPkrRate: fx, usage: { seconds }, dimensions: { resolution, inputType: "text" },
  });
  assert.equal(quote("5", "480p").customerChargeCredits, "56");
  assert.equal(quote("10", "480p").customerChargeCredits, "112");
  assert.equal(quote("5", "1080p").customerChargeCredits, "126");
  assert.equal(quote("5", "480p", "300", "3").customerChargeCredits, "90");
});

test("existing six contracts still validate and generate their verified provider options", () => {
  for (const id of ["gemini-omni-1-1-flash", "grok-video-3", "kling-v3", "minimax-h3", "minimax-h3-lite", "veo-3-1-fast-fhd"]) {
    const contract = getMediaExecutionContract(id);
    const schema = mediaContractUiSchema(contract);
    const input = { referenceCount: 1, duration: schema.durationOptions[0], resolution: schema.resolutionOptions[0],
      aspectRatio: schema.aspectRatios[0], ...(schema.nativeAudio ? { nativeAudio: false } : {}) };
    assert.doesNotThrow(() => validateMediaContractRequest(contract, input), id);
    assert.ok(Object.keys(referencePayload(contract, ["https://example.test/image"])).length);
    assert.ok(Object.keys(mediaProviderOptionPayload(contract, input)).length);
  }
});

test("new adapters enforce positional frames, reference limits and upscale-only sources", () => {
  assert.deepEqual(referencePayload(getMediaExecutionContract("minimax-h3-max-turbo"), ["first", "last"]),
    { first_frame_url: "first", last_frame_url: "last" });
  const ltx = getMediaExecutionContract("ltx-2-3");
  assert.throws(() => validateMediaContractRequest(ltx, { referenceCount: 0, duration: 20, resolution: "720p" }));
  assert.doesNotThrow(() => validateMediaContractRequest(ltx, { referenceCount: 1, duration: 20, resolution: "720p" }));
  assert.throws(() => validateMediaContractRequest(getMediaExecutionContract("grok-imagine-video-1-5"),
    { referenceCount: 2, duration: 5, resolution: "1080p" }));
  const wan = getMediaExecutionContract("wan-3-0-video");
  assert.equal(mediaProviderOptionPayload(wan, { duration: 5, resolution: "720p", nativeAudio: true }).resolution, "720P");
  assert.throws(() => validateMediaContractRequest(wan, { referenceCount: 0, duration: 20, inputDuration: 15, videoReferenceCount: 1, resolution: "720p" }));
  const flash = getMediaExecutionContract("flashvsr");
  assert.throws(() => validateMediaContractRequest(flash, { referenceCount: 0, resolution: "4K" }));
  assert.doesNotThrow(() => validateMediaContractRequest(flash, { referenceCount: 0, resolution: "4K", videoReferenceCount: 1, inputDuration: 12.5 }));
  assert.deepEqual(mediaProviderOptionPayload(flash, { resolution: "4K" }), { resolution: "4k" });
});

test("formula authorization requires exact verified rates, not approximate seconds prices", () => {
  const context = { usage: { seconds: "10" }, dimensions: { resolution: "720p" },
    formula: { usdPerMillionTokens: "5", fps: "24", tokenDivisor: "1024", resolutionDimensions: { "720p": { width: "1280", height: "720" } } } };
  assert.equal(videoTokenFormulaEvaluator(context).amount, "1.08");
  assert.throws(() => videoTokenFormulaEvaluator({ ...context, dimensions: { ...context.dimensions, inputType: "video" } }));
  assert.equal(videoTokenFormulaEvaluator({ ...context, dimensions: { ...context.dimensions, inputType: "video" },
    formula: { ...context.formula, usdPerMillionReferenceVideoTokens: "3" } }).amount, "0.648");
  assert.throws(() => videoTokenFormulaEvaluator({ ...context, formula: { ...context.formula, usdPerMillionTokens: undefined } }));
});

test("uploaded MP4 duration is parsed from server bytes and corrupt input fails closed", () => {
  const atom = (name, body) => { const buffer = Buffer.alloc(body.length + 8); buffer.writeUInt32BE(buffer.length); buffer.write(name, 4); body.copy(buffer, 8); return buffer; };
  const header = Buffer.alloc(20); header.writeUInt32BE(1000, 12); header.writeUInt32BE(12500, 16);
  const file = Buffer.concat([atom("ftyp", Buffer.alloc(8)), atom("moov", atom("mvhd", header))]);
  assert.equal(inspectMediaBytes(file, "video/mp4").duration, 12.5);
  assert.throws(() => inspectMediaBytes(Buffer.from("not a video"), "video/mp4"));
  const corrupt = Buffer.from(file); corrupt.writeUInt32BE(999999, 16);
  assert.throws(() => inspectMediaBytes(corrupt, "video/mp4"));
});

test("video callback, polling and reconciliation only enter V3 records authority", () => {
  const callback = source("src/app/api/provider-callback/apimodels/[secret]/route.ts");
  assert.match(callback, /callbackCost && job.modality !== "video"/);
  assert.match(callback, /settleApimodelsTask/);
  assert.match(source("src/app/api/jobs/[id]/route.ts"), /quote\?\.billing_engine === "v3_provider_authoritative"/);
  assert.match(source("src/lib/billing/media-job-billing.ts"), /BILLING_V3_LEGACY_SETTLEMENT_FORBIDDEN/);
  assert.doesNotMatch(source("src/app/api/generations/[modality]/route.ts"), /const estimated = 0/);
  assert.doesNotMatch(source("src/components/video-studio.tsx"), /x.id !== "flashvsr"/);
});

