import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import * as records from "../../src/lib/providers/apimodels-billing-core.ts";

// Real async adapter/poll/record functions; network and configuration are mocks.
function providers() {
  const calls = [], cache = new Map(), realRequire = createRequire(import.meta.url);
  const dependencies = {
    "server-only": {},
    "@/lib/env": { getServerEnv: () => ({ APIMODELS_API_KEY: "isolated-fixture-key", APIMODELS_BASE_URL: "https://fixture.invalid/v1" }) },
    "@/lib/supabase/admin": {},
    "@/lib/providers/apimodels-billing-core": records,
  };
  function load(path) {
    if (cache.has(path)) return cache.get(path);
    const exports = {};
    cache.set(path, exports);
    const code = ts.transpileModule(readFileSync(new URL("../../" + path, import.meta.url), "utf8"), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    vm.runInNewContext(code, { exports, require(name) {
      if (name in dependencies) return dependencies[name];
      if (name === "./submission") return load("src/lib/providers/submission.ts");
      if (name.startsWith("@/lib/providers/")) return load(name.replace("@/", "src/") + ".ts");
      return realRequire(name);
    }, Request, Response, Headers, URL, Error, AbortSignal, setTimeout,
    process: { env: {} }, console: { info() {}, error() {} }, fetch: async (input, init) => {
      const request = new Request(input, init), url = new URL(request.url);
      const body = request.method === "POST" ? await request.json() : undefined;
      calls.push({ method: request.method, path: url.pathname, task: url.searchParams.get("task_id"), body });
      if (url.pathname === "/v1/tts/stream") return new Response("fixture-audio", {
        headers: { "content-type": "audio/mpeg", "x-request-id": "stream-task", "x-apimodels-cost": "0.0000001" },
      });
      if (url.pathname.includes("/records/")) return new Response('{"data":{"task_id":"task-audio","state":"completed","settled":true,"credits":1e-7,"currency":"USD"}}');
      return Response.json({ data: request.method === "POST" ? { task_id: "task-audio", state: "processing" }
        : { task_id: "task-audio", state: "completed", audio: "https://assets.invalid/result.mp3" } });
    } });
    return exports;
  }
  return { exact: load("src/lib/providers/index.ts"), apimodels: load("src/lib/providers/apimodels.ts"), calls };
}

for (const [modelId, upstreamModel, payload] of [
  ["minimax-speech-2-8-turbo", "minimax-speech-2.8-turbo", { text: "Hi", voice_id: "male-qn-qingse" }],
  ["minimax-speech-2-8-hd", "minimax-speech-2.8-hd", { text: "Hi", voice_id: "female-shaonv" }],
  ["kling-tts", "kling-tts", { text: "Hi", voice_id: "genshin_vindi2", voice_language: "en", voice_speed: 1 }],
  ["suno-v5", "suno-v5", { prompt: "Soft piano" }],
  ["kling-sound-effects", "kling-sound-effects", { prompt: "Bell" }],
]) {
  test(modelId + ": async audio retains model, task ID, output, and exact records cost", async () => {
    const f = providers();
    const result = await f.exact.providerCreateTaskExact({ modelId, upstreamModel, providerKey: "apimodels" }, "audio", payload);
    assert.equal(result.task.taskId, "task-audio");
    assert.deepEqual(f.calls[0], { method: "POST", path: "/v1/audio/generations", task: null, body: { ...payload, model: upstreamModel } });
    const completed = await f.exact.providerPollTask({ provider: "apimodels", modality: "audio", taskId: result.task.taskId });
    assert.equal(completed.state, "completed");
    assert.equal(completed.resultUrls[0], "https://assets.invalid/result.mp3");
    assert.equal(f.calls[1].task, "task-audio");
    const cost = await f.apimodels.getApimodelsBillingRecord(result.task.taskId);
    assert.equal(cost.creditsUsd, "0.0000001");
    assert.equal(cost.settled, true);
    assert.equal(f.calls.filter((call) => call.method === "POST").length, 1);
    assert.equal(f.calls.some((call) => call.path === "/v1/tts/stream"), false);
  });
}

for (const modelId of ["eleven-tts-flash", "eleven-tts-multilingual", "eleven-tts-v3"]) {
  test(modelId + ": real stream adapter preserves voice, body, request ID, and exact response cost", async () => {
    const f = providers();
    const result = await f.exact.providerTtsStreamExact({ modelId, upstreamModel: modelId, providerKey: "apimodels" },
      { text: "Hi", voiceId: "EXAVITQu4vr4xnSDxMaL" });
    assert.equal(result.response.headers.get("content-type"), "audio/mpeg");
    assert.equal(await result.response.text(), "fixture-audio");
    assert.equal(result.providerRequestId, "stream-task");
    assert.equal(result.providerReportedCost.amount, "0.0000001");
    assert.deepEqual(f.calls[0], { method: "POST", path: "/v1/tts/stream", task: null,
      body: { model: modelId, text: "Hi", voice_id: "EXAVITQu4vr4xnSDxMaL" } });
  });
}
