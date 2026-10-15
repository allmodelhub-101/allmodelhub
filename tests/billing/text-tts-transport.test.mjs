import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// Execute the real attempt functions; only I/O dependencies are mocked.
function fixture(kind, outcome) {
  const calls = { submissions: 0, releases: 0, anomalies: 0, reservations: 0, finalized: [] };
  const response = async () => {
    calls.submissions++;
    if (outcome === "timeout") throw new Error("transport disconnected after submission");
    return { response: new Response("body", { status: outcome }), providerRequestId: outcome === 200 ? "task-1" : undefined };
  };
  const exports = {};
  const dependencies = {
    "server-only": {},
    "@/lib/idempotency": { claimRequest: async () => ({ claimed: true, id: "claim" }),
      finalizeRequest: async (_id, status) => { calls.finalized.push(status); } },
    "@/lib/providers": { providerChatStreamExact: response, providerTtsStreamExact: response },
    "@/lib/providers/apimodels": { providerFailure(status) {
      return Object.assign(new Error("HTTP " + status), { name: "ProviderRequestError",
        kind: status === 429 ? "definitive_rejection" : "temporary" });
    } },
    "@/lib/spending": { assertSpendingAllowed: async () => {} },
    "./provider-route": { resolveBillingProviderRoutes: async () => [{ routeId: "first" }, { routeId: "fallback" }] },
    "./quote-reservation": { cancelBillingQuoteReservation: async () => { calls.releases++; } },
    "./text-billing-core": { estimateTextUsageForReservation: () => ({ maximumUsage: {} }) },
    "./audio-usage-core": { countSubmittedCharacters: (text) => String(Array.from(text).length) },
    "./authorization": { createProviderAuthorization: async () => {
      calls.reservations++;
      return { quoteId: "quote", authorizationCredits: "1" };
    } },
    "./provider-authoritative-settlement": {
      markProviderSettlementPending: async () => ({ ledgerId: "ledger" }),
      recordProviderBillingAnomaly: async () => { calls.anomalies++; },
    },
  };
  const code = ts.transpileModule(readFileSync(new URL(`../../src/lib/billing/${kind}-billing.ts`, import.meta.url), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(code, { exports, require(name) {
    if (!(name in dependencies)) throw new Error("Unexpected dependency: " + name);
    return dependencies[name];
  }, Error, Response, console });
  return { calls, begin: () => exports[kind === "text" ? "beginTextBillingAttempt" : "beginTtsBillingAttempt"]({
    userId: "test", parentRequestId: "request", modelId: "test", text: "Hi", textForReservation: "Hi",
    maxOutputTokens: 8, messages: [{ role: "user", content: "Hi" }], operation: "chat", allowFallback: true,
    voiceId: "voice", confirmedCost: true,
  }) };
}

for (const kind of ["text", "tts"]) {
  test(`${kind}: ambiguous transport retains one hold and forbids fallback`, async () => {
    const f = fixture(kind, "timeout");
    await assert.rejects(f.begin(), /transport disconnected/);
    assert.equal(f.calls.submissions, 1);
    assert.equal(f.calls.reservations, 1);
    assert.equal(f.calls.releases, 0);
    assert.equal(f.calls.anomalies, 1);
    assert.deepEqual(f.calls.finalized, ["completed"]);
  });
  test(`${kind}: received 503 remains ambiguous and cannot trigger another paid attempt`, async () => {
    const f = fixture(kind, 503);
    await assert.rejects(f.begin(), /503/);
    assert.equal(f.calls.submissions, 1);
    assert.equal(f.calls.releases, 0);
  });
  test(`${kind}: definitive 429 releases before trying the next configured route`, async () => {
    const f = fixture(kind, 429);
    await assert.rejects(f.begin(), /429/);
    assert.equal(f.calls.submissions, 2);
    assert.equal(f.calls.releases, 2);
    assert.equal(f.calls.anomalies, 0);
    assert.deepEqual(f.calls.finalized, ["failed", "failed"]);
  });
}
