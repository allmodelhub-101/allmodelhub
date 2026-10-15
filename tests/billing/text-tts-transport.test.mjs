import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import * as billingCore from "../../src/lib/providers/apimodels-billing-core.ts";

// Execute real billing -> exact adapter -> transport -> Request -> fetch.
// Replace only configuration, ledger I/O and the actual network.
function fixture(kind, outcome, options = {}) {
  const calls = { submissions: 0, releases: 0, anomalies: 0, reservations: 0, pending: [], finalized: [], order: [] };
  const claims = new Map();
  const routes = [
    { routeId: "first", providerKey: "apimodels", modelId: kind === "text" ? "qwen3-8-flash" : "eleven-tts-flash", upstreamModel: "first" },
    { routeId: "fallback", providerKey: "apimodels", modelId: kind === "text" ? "qwen3-8-flash" : "eleven-tts-flash", upstreamModel: "fallback" },
  ];
  if (outcome === "unsupported-provider") routes[0].providerKey = "unsupported";
  if (outcome === "unsupported-adapter") routes[0].modelId = "minimax-speech-2-8-hd";
  if (outcome === "missing-first-key" || outcome === "haimaker") routes[0].providerKey = "haimaker";
  const env = {
    APIMODELS_API_KEY: outcome === "missing-credentials" ? undefined : "isolated-fixture-key",
    APIMODELS_BASE_URL: outcome === "invalid-url" ? "not a valid URL" : "https://fixture.invalid/v1",
    HAIMAKER_API_KEY: outcome === "haimaker" ? "isolated-fixture-key" : undefined,
    HAIMAKER_BASE_URL: "https://haimaker.invalid/v1", HAIMAKER_MODEL_MAP_JSON: "{}",
  };
  const mockFetch = async (request) => {
    assert.ok(request instanceof Request);
    calls.submissions++;
    calls.order.push("fetch");
    if (outcome === "timeout") throw new Error("network timeout after submission");
    const first429 = outcome === 429 && calls.submissions === 1;
    const status = first429 ? 429 : outcome === 503 ? 503 : 200;
    const headers = status === 200 ? { "x-request-id": "accepted-task", ...(outcome === "accepted-malformed-cost" ? { "x-apimodels-cost": "invalid" } : {}) } : {};
    return new Response("stream", { status, headers });
  };
  const dependencies = {
    "server-only": {},
    "@/lib/env": { getServerEnv: () => env },
    "@/lib/supabase/admin": { createAdminClient: () => { throw new Error("Unexpected database access"); } },
    "@/lib/idempotency": {
      claimRequest: async (_user, _scope, key) => {
        const existing = claims.get(key);
        if (existing) return { claimed: false, existing };
        const claim = { id: key, status: "processing" };
        claims.set(key, claim);
        return { claimed: true, id: key };
      },
      finalizeRequest: async (id, status) => {
        claims.get(id).status = status;
        calls.finalized.push(status);
      },
    },
    "@/lib/spending": { assertSpendingAllowed: async () => {} },
    "./provider-route": { resolveBillingProviderRoutes: async () => routes },
    "./quote-reservation": { cancelBillingQuoteReservation: async () => {
      calls.releases++;
      calls.order.push("release");
      if (options.releaseFails) throw new Error("release unavailable");
    } },
    "./text-billing-core": { estimateTextUsageForReservation: () => ({ maximumUsage: {} }) },
    "./audio-usage-core": { countSubmittedCharacters: (text) => String(Array.from(text).length) },
    "./authorization": { createProviderAuthorization: async () => {
      calls.reservations++;
      return { quoteId: "quote", authorizationCredits: "1" };
    } },
    "./provider-authoritative-settlement": {
      markProviderSettlementPending: async (input) => { calls.pending.push(input); return { ledgerId: "ledger" }; },
      recordProviderBillingAnomaly: async () => { calls.anomalies++; },
    },
    "@/lib/providers/apimodels-billing-core": billingCore,
  };
  const realRequire = createRequire(import.meta.url), modules = new Map();
  function load(path) {
    if (modules.has(path)) return modules.get(path);
    const exports = {};
    modules.set(path, exports);
    const code = ts.transpileModule(readFileSync(new URL("../../" + path, import.meta.url), "utf8"), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    vm.runInNewContext(code, { exports, require(name) {
      if (name in dependencies) return dependencies[name];
      if (name === "@/lib/providers") return load("src/lib/providers/index.ts");
      if (name.startsWith("@/lib/providers/")) return load(name.replace("@/", "src/") + ".ts");
      if (name === "./submission") return load("src/lib/providers/submission.ts");
      return realRequire(name);
    }, Error, Request, Response, Headers, URL, AbortSignal, fetch: mockFetch,
    process: { env }, console: { info() {}, error() {} } });
    return exports;
  }
  const billing = load("src/lib/billing/" + kind + "-billing.ts");
  return { calls, begin: () => billing[kind === "text" ? "beginTextBillingAttempt" : "beginTtsBillingAttempt"]({
    userId: "test", parentRequestId: "request", modelId: "test", text: "Hi", textForReservation: "Hi",
    maxOutputTokens: 8, messages: [{ role: "user", content: "Hi" }], operation: "chat", allowFallback: options.allowFallback !== false,
    voiceId: "voice", confirmedCost: true,
  }) };
}

for (const kind of ["text", "tts"]) {
  test(kind + ": missing credentials cause no submission, anomaly, or retained hold", async () => {
    const f = fixture(kind, "missing-credentials");
    await assert.rejects(f.begin(), /APIMODELS_API_KEY/);
    assert.equal(f.calls.submissions, 0);
    assert.equal(f.calls.releases, 2);
    assert.equal(f.calls.anomalies, 0);
    assert.deepEqual(f.calls.finalized, ["failed", "failed"]);
  });
  for (const outcome of ["unsupported-provider", "missing-first-key"]) {
    test(kind + ": local " + outcome + " releases before safe configured fallback", async () => {
      const f = fixture(kind, outcome);
      await f.begin();
      assert.equal(f.calls.reservations, 2);
      assert.equal(f.calls.submissions, 1);
      assert.equal(f.calls.releases, 1);
      assert.equal(f.calls.anomalies, 0);
      assert.deepEqual(f.calls.order, ["release", "fetch"]);
    });
  }
  test(kind + ": request construction failure happens before the submission marker", async () => {
    const f = fixture(kind, "invalid-url");
    await assert.rejects(f.begin());
    assert.equal(f.calls.submissions, 0);
    assert.equal(f.calls.releases, 2);
    assert.equal(f.calls.anomalies, 0);
  });
  test(kind + ": network timeout retains one hold, forbids fallback, and blocks replay", async () => {
    const f = fixture(kind, "timeout");
    await assert.rejects(f.begin(), /network timeout/);
    await assert.rejects(f.begin(), /ALREADY_SUBMITTED/);
    assert.equal(f.calls.submissions, 1);
    assert.equal(f.calls.reservations, 1);
    assert.equal(f.calls.releases, 0);
    assert.equal(f.calls.anomalies, 1);
    assert.deepEqual(f.calls.finalized, ["completed"]);
  });
  test(kind + ": received 503 remains ambiguous and cannot trigger another paid attempt", async () => {
    const f = fixture(kind, 503);
    await assert.rejects(f.begin(), /temporarily unavailable/);
    await assert.rejects(f.begin(), /ALREADY_SUBMITTED/);
    assert.equal(f.calls.submissions, 1);
    assert.equal(f.calls.releases, 0);
  });
  test(kind + ": definitive 429 releases before trying the next configured route", async () => {
    const f = fixture(kind, 429);
    await f.begin();
    assert.equal(f.calls.submissions, 2);
    assert.equal(f.calls.releases, 1);
    assert.deepEqual(f.calls.order, ["fetch", "release", "fetch"]);
    assert.equal(f.calls.anomalies, 0);
    await assert.rejects(f.begin(), /ALREADY_SUBMITTED/);
    assert.equal(f.calls.submissions, 2);
  });
  test(kind + ": failed release stops fallback and blocks replay", async () => {
    const f = fixture(kind, 429, { releaseFails: true });
    await assert.rejects(f.begin(), /release unavailable/);
    await assert.rejects(f.begin(), /ALREADY_SUBMITTED/);
    assert.equal(f.calls.submissions, 1);
    assert.equal(f.calls.reservations, 1);
  });
  test(kind + ": acceptance followed by malformed billing evidence preserves task ID and hold", async () => {
    const f = fixture(kind, "accepted-malformed-cost");
    await assert.rejects(f.begin(), /non-negative decimal/);
    assert.equal(f.calls.submissions, 1);
    assert.equal(f.calls.releases, 0);
    assert.equal(f.calls.pending[0].providerRequestId, "accepted-task");
    assert.equal(f.calls.anomalies, 0);
    await assert.rejects(f.begin(), /ALREADY_SUBMITTED/);
  });
  test(kind + ": successful Haimaker adapter forwards the actual submission boundary", async () => {
    const f = fixture(kind, "haimaker");
    await f.begin();
    assert.equal(f.calls.submissions, 1);
    assert.equal(f.calls.releases, 0);
    assert.equal(f.calls.pending[0].providerRequestId, "accepted-task");
  });
}
test("TTS: unsupported stream adapter releases before the valid Eleven stream fallback", async () => {
  const f = fixture("tts", "unsupported-adapter");
  await f.begin();
  assert.equal(f.calls.submissions, 1);
  assert.equal(f.calls.releases, 1);
  assert.equal(f.calls.anomalies, 0);
});
test("text: local failure does not bypass explicit fallback prohibition", async () => {
  const f = fixture("text", "unsupported-provider", { allowFallback: false });
  await assert.rejects(f.begin(), /Unsupported provider route/);
  assert.equal(f.calls.submissions, 0);
  assert.equal(f.calls.releases, 1);
});
