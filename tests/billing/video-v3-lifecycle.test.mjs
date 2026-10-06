import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import * as core from "../../src/lib/billing/media-job-billing-core.ts";
import * as reconciliationCore from "../../src/lib/billing/reconciliation-core.ts";
const realRequire = createRequire(import.meta.url);
const failLegacy = () => { throw new Error("New V3 video entered legacy billing"); };

// Execute actual route/reconciliation functions, replacing only network/auth
// dependencies. Financial RPC behavior is separately verified in PostgreSQL.
function load(path, dependencies) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL("../../" + path, import.meta.url), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { exports, require: (name) => {
    if (name in dependencies) return dependencies[name];
    if (name === "server-only") return {};
    if (name.startsWith("@/") || name.startsWith("./")) throw new Error("Unmocked dependency: " + name);
    return realRequire(name);
  }, Buffer, Request, Response, TextEncoder, process: { env: { CALLBACK_SECRET: "test-secret" } }, console });
  return exports;
}
function fixture(pending = false) {
  const job = { id: "00000000-0000-4000-8000-000000000001", user_id: "user", public_id: "TEST", modality: "video",
    model_id: "ltx-2-3", provider_key: "apimodels", provider_task_id: "task", billing_quote_id: "quote",
    status: "processing", prompt: "test", request_json: { duration: 5, resolution: "480p" }, result_urls: [], reconcile_attempts: 0 };
  const calls = { records: 0, charges: 0, releases: 0, callbackCosts: 0, notifications: 0 };
  let settled = false;
  const admin = { from(table) {
    let update, filters = [];
    const query = {
      select() { return query; }, update(value) { update = value; return query; }, insert(value) { update = value; return query; },
      eq(key, value) { filters.push((row) => row[key] === value); return query; },
      in(key, values) { filters.push((row) => values.includes(row[key])); return query; },
      is(key, value) { filters.push((row) => row[key] === value); return query; },
      then(resolve, reject) { return execute().then(resolve, reject); }, single: execute, maybeSingle: execute,
    };
    async function execute() {
      const row = table === "billing_quotes" ? { id: "quote", billing_engine: "v3_provider_authoritative" } : job;
      if (!filters.every((filter) => filter(row))) return { data: null, error: null };
      if (update) Object.assign(row, update);
      return { data: { ...row }, error: null };
    }
    return query;
  }, async rpc(name) { if (name === "billing_record_reconciliation_result") return { data: true, error: null }; throw new Error(name); } };
  const settle = async () => {
    calls.records++;
    if (pending) return { status: "pending_reconciliation" };
    if (!settled) { settled = true; calls.charges++; job.charged_credits = 56; }
    return { status: "settled", charge_credits: "56" };
  };
  const assets = { assertTrustedAssetUrl: async () => {}, persistGeneratedAssets: async () => ["stored.mp4"], signGeneratedPaths: async (paths) => paths };
  const media = { completeMediaGenerationBilling: failLegacy, failMediaGenerationBilling: failLegacy, completeProviderAuthoritativeMediaBilling: settle };
  const settlement = { settleApimodelsTask: settle, settleProviderBillingRecord: failLegacy, releaseAuthoritativeProviderFailure: failLegacy, recordProviderBillingObservation: failLegacy };
  const dependencies = {
    "next/server": { NextResponse: { json: (data, init) => Response.json(data, init) } },
    "@/lib/generated-assets": assets,
    "@/lib/notifications": { notifyUser: async () => { calls.notifications++; } },
    "@/lib/public-error": { logServerError: () => {} },
    "@/lib/rate-limit": { enforceRateLimit: async () => ({ success: true }) },
    "@/lib/security/request": { requestIp: () => "test" },
    "@/lib/supabase/admin": { createAdminClient: () => admin },
    "@/lib/supabase/server": { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "user" } } }) } }) },
    "@/lib/providers": { providerPollTask: async () => ({ state: "completed", resultUrls: ["https://assets.test/output.mp4"], raw: {} }) },
    "@/lib/billing/media-job-billing": media, "./media-job-billing": media,
    "@/lib/billing/media-job-billing-core": core, "./media-job-billing-core": core,
    "@/lib/providers/apimodels-billing-core": { callbackProviderCost: () => ({ amount: "9999", currency: "USD" }), extractExactJsonDecimal: () => "9999" },
    "@/lib/billing/provider-authoritative-settlement": settlement, "./provider-authoritative-settlement": settlement,
    "./reconciliation-core": reconciliationCore,
    "./billing-v3-settings": { getBillingV3Settings: async () => ({ enabled: true, reconciliationEnabled: true }) },
    "@/lib/wallet": { completeGenerationJob: failLegacy },
  };
  return { job, calls, dependencies };
}
test("actual video callback ignores callback price and duplicate completion settles once", async () => {
  const f = fixture();
  const callback = load("src/app/api/provider-callback/apimodels/[secret]/route.ts", f.dependencies);
  const send = () => callback.POST(new Request("https://test/callback", { method: "POST", body: JSON.stringify({ taskId: "task", state: "completed", credits: 9999, output: "https://assets.test/output.mp4" }) }), { params: Promise.resolve({ secret: "test-secret" }) });
  assert.equal((await send()).status, 200);
  assert.equal((await send()).status, 200);
  assert.equal(f.job.status, "completed"); assert.equal(f.calls.charges, 1); assert.equal(f.calls.records, 1);
});
test("actual video callback retains settling status while records are unavailable", async () => {
  const f = fixture(true);
  const callback = load("src/app/api/provider-callback/apimodels/[secret]/route.ts", f.dependencies);
  const result = await callback.POST(new Request("https://test/callback", { method: "POST", body: JSON.stringify({ taskId: "task", state: "completed", output: "https://assets.test/output.mp4" }) }), { params: Promise.resolve({ secret: "test-secret" }) });
  assert.equal(result.status, 202); assert.equal(f.job.status, "settling"); assert.equal(f.calls.charges, 0); assert.equal(f.calls.notifications, 0);
});
test("actual polling completes V3 video and retries pending records without legacy settlement", async () => {
  for (const pending of [false, true]) {
    const f = fixture(pending);
    const polling = load("src/app/api/jobs/[id]/route.ts", f.dependencies);
    const poll = () => polling.GET(new Request("https://test/job"), { params: Promise.resolve({ id: f.job.id }) });
    assert.equal((await poll()).status, 200); assert.equal((await poll()).status, 200);
    assert.equal(f.job.status, pending ? "settling" : "completed");
    assert.equal(f.calls.charges, pending ? 0 : 1); assert.equal(f.calls.records, pending ? 2 : 1);
  }
});
test("actual scheduled reconciliation restores output and confirms records settlement", async () => {
  const f = fixture();
  const reconciliation = load("src/lib/billing/reconciliation.ts", f.dependencies);
  assert.equal((await reconciliation.reconcileGenerationJob({ ...f.job })).outcome, "settled");
  assert.equal(f.job.status, "completed"); assert.equal(f.job.result_urls.length, 1); assert.equal(f.calls.charges, 1);
});
test("actual failed callback releases only after authoritative zero-cost records", async () => {
  const f = fixture();
  f.dependencies["@/lib/billing/provider-authoritative-settlement"].settleApimodelsTask = async () => {
    f.calls.records++; f.calls.releases++; f.job.status = "failed"; return { status: "released" };
  };
  const callback = load("src/app/api/provider-callback/apimodels/[secret]/route.ts", f.dependencies);
  const send = () => callback.POST(new Request("https://test/callback", { method: "POST", body: JSON.stringify({ taskId: "task", state: "failed", credits: 0 }) }), { params: Promise.resolve({ secret: "test-secret" }) });
  assert.equal((await send()).status, 200); assert.equal((await send()).status, 200);
  assert.equal(f.calls.records, 1); assert.equal(f.calls.releases, 1); assert.equal(f.calls.charges, 0);
});
test("actual submission retry never resubmits an accepted task after ledger write failure", async () => {
  const f = fixture();
  const claims = new Map(); let submissions = 0, holds = 0, ledgerWrites = 0;
  const input = { requestId: "00000000-0000-4000-8000-000000000002", modelId: "ltx-2-3", prompt: "test",
    duration: 5, resolution: "480p", confirmedCost: true, confirmedAuthorizationCredits: "112" };
  Object.assign(f.dependencies, {
    "@/lib/billing/quote-reservation": { cancelBillingQuoteReservation: failLegacy },
    "@/lib/billing/provider-route": { resolveBillingProviderRoutes: async () => [{ routeId: "route", providerKey: "apimodels" }] },
    "@/lib/media-request": { generationInputSchema: { safeParse: () => ({ success: true, data: input }) },
      prepareMediaRequest: async () => ({ usage: { seconds: "5" }, dimensions: {}, storedRequest: input, providerBody: { prompt: "test", duration: 5, resolution: "480p" } }) },
    "@/lib/feature-flags": { isFeatureEnabled: async () => true },
    "@/lib/idempotency": { claimRequest: async (_user, scope, id) => {
      const key = scope + id;
      if (claims.has(key)) return { claimed: false, existing: claims.get(key) };
      const claim = { id: key }; claims.set(key, claim); return { claimed: true, ...claim };
    }, finalizeRequest: async (id, status, metadata) => {
      Object.assign(claims.get(id), { status, resource_id: metadata?.resourceId });
    } },
    "@/lib/model-store": { getRuntimeModel: async () => ({ id: "ltx-2-3", modality: "video", capabilities: [] }) },
    "@/lib/security/ids": { createPublicId: () => "TEST" },
    "@/lib/spending": { assertSpendingAllowed: async () => {} },
    "@/lib/billing/authorization": { createProviderAuthorization: async () => { holds++; return { quoteId: "quote", walletHoldId: "hold", authorizationCredits: "112", estimatedCredits: "112" }; } },
    "@/lib/media-execution-contract": { getMediaExecutionContract: () => ({}) },
    "@/lib/media-runtime-error": { classifyMediaRuntimeFailure: () => ({ message: "Reconciliation pending", status: 202, category: "provider_pending" }) },
  });
  f.dependencies["@/lib/providers"].providerCreateTaskExact = async () => { submissions++; return { task: { taskId: "accepted-task", state: "processing" } }; };
  Object.assign(f.dependencies["@/lib/billing/provider-authoritative-settlement"], {
    markProviderSettlementPending: async () => { if (++ledgerWrites === 1) throw new Error("temporary database failure"); },
    recordProviderBillingAnomaly: async () => {},
  });
  const generation = load("src/app/api/generations/[modality]/route.ts", f.dependencies);
  const send = () => generation.POST(new Request("https://test/generation", { method: "POST", body: JSON.stringify(input) }), { params: Promise.resolve({ modality: "video" }) });
  assert.equal((await send()).status, 202); assert.equal((await send()).status, 409);
  assert.equal(submissions, 1); assert.equal(holds, 1); assert.equal(f.job.provider_task_id, "accepted-task");
});

function configureGenerationSubmission(f, routes, submit) {
  const input = { requestId: "00000000-0000-4000-8000-000000000003", modelId: "ltx-2-3", prompt: "test",
    duration: 5, resolution: "480p", confirmedCost: true, confirmedAuthorizationCredits: "112" };
  let holds = 0, cancellations = 0, submissions = 0, anomalies = 0;
  const claims = new Map();
  Object.assign(f.dependencies, {
    "@/lib/billing/quote-reservation": { cancelBillingQuoteReservation: async () => { cancellations++; } },
    "@/lib/billing/provider-route": { resolveBillingProviderRoutes: async () => routes },
    "@/lib/media-request": { generationInputSchema: { safeParse: () => ({ success: true, data: input }) },
      prepareMediaRequest: async () => ({ usage: { seconds: "5" }, dimensions: {}, storedRequest: input, providerBody: { prompt: "test", duration: 5, resolution: "480p" } }) },
    "@/lib/feature-flags": { isFeatureEnabled: async () => true },
    "@/lib/idempotency": { claimRequest: async (_user, scope, id) => {
      const key = scope + id; if (claims.has(key)) return { claimed: false, existing: claims.get(key) };
      const claim = { id: key }; claims.set(key, claim); return { claimed: true, ...claim };
    }, finalizeRequest: async () => {} },
    "@/lib/model-store": { getRuntimeModel: async () => ({ id: "ltx-2-3", modality: "video", capabilities: [] }) },
    "@/lib/security/ids": { createPublicId: () => "TEST" },
    "@/lib/spending": { assertSpendingAllowed: async () => {} },
    "@/lib/billing/authorization": { createProviderAuthorization: async () => { holds++; return { quoteId: "quote", walletHoldId: "hold", authorizationCredits: "112", estimatedCredits: "112" }; } },
    "@/lib/media-execution-contract": { getMediaExecutionContract: () => ({}) },
    "@/lib/media-runtime-error": { classifyMediaRuntimeFailure: () => ({ message: "Reconciliation pending", status: 202, category: "provider_pending" }) },
  });
  f.dependencies["@/lib/providers"].providerCreateTaskExact = async (route) => { submissions++; return submit(route, submissions); };
  Object.assign(f.dependencies["@/lib/billing/provider-authoritative-settlement"], {
    markProviderSettlementPending: async () => {}, recordProviderBillingAnomaly: async () => { anomalies++; }
  });
  return { input, bump() { submissions++; return submissions; }, get holds() { return holds; }, get cancellations() { return cancellations; }, get submissions() { return submissions; }, get anomalies() { return anomalies; } };
}

test("definitive HTTP 429 releases its hold and retries a later route", async () => {
  const f = fixture();
  const state = configureGenerationSubmission(f, [{ routeId: "first", providerKey: "apimodels" }, { routeId: "second", providerKey: "apimodels" }], (_route, count) => {
    if (count === 1) return { error: { name: "ProviderRequestError", kind: "definitive_rejection" } };
    return { task: { taskId: "accepted-after-429", state: "processing" } };
  });
  // The mock provider throws the structured error so the route exercises its
  // definitive-rejection branch without treating it as an ambiguous timeout.
  f.dependencies["@/lib/providers"].providerCreateTaskExact = async (_route, _modality, _body) => {
    const count = state.bump();
    if (count === 1) throw { name: "ProviderRequestError", kind: "definitive_rejection" };
    return { task: { taskId: "accepted-after-429", state: "processing" } };
  };
  const generation = load("src/app/api/generations/[modality]/route.ts", f.dependencies);
  const result = await generation.POST(new Request("https://test/generation", { method: "POST", body: JSON.stringify(state.input) }), { params: Promise.resolve({ modality: "video" }) });
  assert.equal(result.status, 202); assert.equal(state.cancellations, 1); assert.equal(state.submissions, 2);
  assert.equal(f.job.provider_task_id, "accepted-after-429");
});

test("ambiguous provider timeout retains the hold and does not retry submission", async () => {
  const f = fixture();
  const state = configureGenerationSubmission(f, [{ routeId: "first", providerKey: "apimodels" }, { routeId: "second", providerKey: "apimodels" }], () => { throw new Error("network timeout"); });
  const generation = load("src/app/api/generations/[modality]/route.ts", f.dependencies);
  const result = await generation.POST(new Request("https://test/generation", { method: "POST", body: JSON.stringify(state.input) }), { params: Promise.resolve({ modality: "video" }) });
  assert.equal(result.status, 202); assert.equal(state.cancellations, 0); assert.equal(state.submissions, 1);
  assert.equal(f.job.status, "processing"); assert.equal(state.anomalies, 1);
});

