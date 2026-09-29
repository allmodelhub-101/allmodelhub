import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  ApimodelsBillingRecordError,
  apimodelsRequestId,
  apimodelsResponseCost,
  callbackProviderCost,
  extractExactJsonDecimal,
  normalizeApimodelsBillingRecord,
} from "../../src/lib/providers/apimodels-billing-core.ts";
import {
  authorizationCoverage,
  calculateProviderAuthoritativeCharge,
  publicSettlementSummary,
} from "../../src/lib/billing/provider-authoritative-core.ts";
import { parseAuthorizationConstraints, validateAuthorizationRequest } from "../../src/lib/billing/authorization-core.ts";
import { executableModelIds } from "../../src/lib/billing/model-availability-core.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");

test("normalizes a settled APIMODELS USD billing record without losing tiny decimals", () => {
  const record = normalizeApimodelsBillingRecord({
    task_id: "task-1", model: "model-a", state: "completed", settled: true,
    credits: "0.000001", currency: "usd", usage: { input_tokens: 1 },
    created_at: "2026-09-28T00:00:00Z", completed_at: "2026-09-28T00:00:01Z",
  });
  assert.equal(record.taskId, "task-1");
  assert.equal(record.creditsUsd, "0.000001");
  assert.equal(record.currency, "USD");
  assert.deepEqual(record.usage, { input_tokens: 1 });
});

test("keeps unsettled records pending and rejects invented or malformed final costs", () => {
  assert.deepEqual(normalizeApimodelsBillingRecord({ task_id: "task-2", state: "running", settled: false, credits: null, usage: {} }), {
    taskId: "task-2", model: undefined, state: "running", settled: false,
    creditsUsd: undefined, currency: undefined, usage: {}, createdAt: undefined, completedAt: undefined,
  });
  assert.throws(() => normalizeApimodelsBillingRecord({ state: "completed", settled: true, credits: "1", currency: "USD" }),
    (error) => error instanceof ApimodelsBillingRecordError && error.code === "MALFORMED_RECORD");
  assert.throws(() => normalizeApimodelsBillingRecord({ task_id: "x", state: "completed", settled: true, credits: null, currency: "USD" }),
    (error) => error instanceof ApimodelsBillingRecordError && error.code === "MALFORMED_RECORD");
});

test("requires USD and authoritative failed records to have exactly zero cost", () => {
  const failed = normalizeApimodelsBillingRecord({ task_id: "failed-1", state: "failed", settled: true, credits: "0", currency: "USD" });
  assert.equal(failed.creditsUsd, "0");
  assert.throws(() => normalizeApimodelsBillingRecord({ task_id: "bad-currency", state: "completed", settled: true, credits: "1", currency: "EUR" }),
    (error) => error instanceof ApimodelsBillingRecordError && error.code === "INVALID_CURRENCY");
  assert.throws(() => normalizeApimodelsBillingRecord({ task_id: "bad-failure", state: "failed", settled: true, credits: "0.01", currency: "USD" }),
    (error) => error instanceof ApimodelsBillingRecordError && error.code === "INVALID_COST");
});

test("extracts APIMODELS headers in provider-preferred order and exact callback credits", () => {
  const headers = new Headers({ "x-apimodels-request-id": "preferred", "x-request-id": "generic", "x-apimodels-cost": "0.0000012300" });
  assert.equal(apimodelsRequestId(headers), "preferred");
  assert.deepEqual(apimodelsResponseCost(headers), { amount: "0.00000123", currency: "USD" });
  const raw = '{"task_id":"x","credits":0.000000123456789012345678,"currency":"USD"}';
  assert.equal(extractExactJsonDecimal(raw, "credits"), "0.000000123456789012345678");
  assert.deepEqual(callbackProviderCost(JSON.parse(raw), extractExactJsonDecimal(raw, "credits")), {
    amount: "0.000000123456789012345678", currency: "USD",
  });
});

test("calculates exact customer charge from provider USD times frozen FX and markup", () => {
  const tiny = calculateProviderAuthoritativeCharge({ providerCostUsd: "0.000001", internalUsdPkrRate: "300.125", markup: "1.5" });
  assert.equal(tiny.providerCostPkr, "0.000300125");
  assert.equal(tiny.customerChargeCredits, "0.000451");
  assert.equal(tiny.profitPkr, "0.000150875");
  const large = calculateProviderAuthoritativeCharge({ providerCostUsd: "9007199254740993.123456789", internalUsdPkrRate: "310.125", markup: "2.25" });
  assert.equal(large.providerCostUsd, "9007199254740993.123456789");
  assert.equal(large.customerChargeCredits, "6285054754972238607.927083");
  assert.throws(() => calculateProviderAuthoritativeCharge({ providerCostUsd: "1", internalUsdPkrRate: "300", markup: "0.99" }), /at least 1/);
});

test("authorization constraints fail closed and shortfalls never become capped charges", () => {
  assert.equal(validateAuthorizationRequest({ outputTokens: "4096", resolution: "1080p" }, {
    maxOutputTokens: "4096", allowedResolutions: ["1080p"],
  }), true);
  assert.throws(() => validateAuthorizationRequest({ outputTokens: "4097" }, { maxOutputTokens: "4096" }), /exceeds/);
  assert.throws(() => validateAuthorizationRequest({ quality: "ultra" }, { allowedQualities: ["standard"] }), /not authorized/);
  assert.throws(() => validateAuthorizationRequest({ fps: "60" }, { maxFps: "30" }), /exceeds/);
  assert.throws(() => validateAuthorizationRequest({ dimensions: { nativeAudio: true } }, { allowedNativeAudio: [false] }), /not authorized/);
  assert.deepEqual(parseAuthorizationConstraints({ maxImages: "20", allowedInputTypes: ["text", "image"] }), {
    maxImages: "20", allowedInputTypes: ["text", "image"],
  });
  assert.throws(() => parseAuthorizationConstraints({ unknownCostDimension: "1" }), /Unsupported authorization constraint/);
  assert.deepEqual(authorizationCoverage("10.000001", "10"), {
    covered: false, shortfallCredits: "0.000001", chargeCredits: "10.000001", authorizationCredits: "10",
  });
});

test("model availability uses authorization policy under V3, not detailed final pricing", () => {
  const v2 = executableModelIds({ activeModelIds: ["a", "b"], operationalRouteModelIds: ["a", "b"],
    verifiedPricingModelIds: ["a"], authorizationPolicyModelIds: ["b"], billingV3Enabled: false, billingV3CanaryModels: [] });
  assert.deepEqual([...v2], ["a"]);
  const canary = executableModelIds({ activeModelIds: ["a", "b"], operationalRouteModelIds: ["a", "b"],
    verifiedPricingModelIds: ["a"], authorizationPolicyModelIds: ["b"], billingV3Enabled: false, billingV3CanaryModels: ["b"] });
  assert.deepEqual([...canary], ["a", "b"]);
  const v3 = executableModelIds({ activeModelIds: ["a", "b"], operationalRouteModelIds: ["a", "b"],
    verifiedPricingModelIds: [], authorizationPolicyModelIds: ["b"], billingV3Enabled: true, billingV3CanaryModels: [] });
  assert.deepEqual([...v3], ["b"]);
});

test("public settlement summaries never expose supplier cost", () => {
  const summary = publicSettlementSummary({ status: "settled", receiptId: "r", walletTransactionId: "w", chargeCredits: "1.23" });
  assert.deepEqual(summary, { status: "settled", receiptId: "r", walletTransactionId: "w", chargeCredits: "1.23" });
  assert.equal("providerCostUsd" in summary, false);
});

test("database contract enforces provider idempotency, authorization ceiling, pending reconciliation and zero-cost failure", () => {
  const sql = readFileSync(join(root, "supabase", "migrations", "20260928182225_add_billing_v3_provider_authoritative.sql"), "utf8").toLowerCase();
  assert.match(sql, /unique index provider_billing_records_request_key/);
  assert.match(sql, /unique index provider_billing_records_task_key/);
  assert.match(sql, /unique index provider_billing_records_quote_key/);
  assert.match(sql, /if v_charge > v_quote\.reservation_credits then/);
  assert.match(sql, /customer_was_not_charged', true/);
  assert.match(sql, /billing_v3_provider_record_not_settleable/);
  assert.match(sql, /billing_v3_failure_not_authoritative/);
  assert.match(sql, /v_record\.credits_usd <> 0/);
  assert.match(sql, /for update skip locked/);
  assert.match(sql, /billing_v3_provider_authoritative_enabled', 'false'/);
  assert.match(sql, /billing_v3_record_provider_anomaly/);
  assert.match(sql, /provider_billing_records_protect_update/);
  assert.match(sql, /expected 22 defensible billing v3 authorization policies/);
  assert.match(sql, /billing_v3_authorization_policy_stale/);
  assert.match(sql, /p_authorization_credits > v_policy\.maximum_authorization_credits/);
  assert.match(sql, /v_hold\.amount is distinct from p_authorization_credits/);
  assert.doesNotMatch(sql, /p_user_id, v_policy\.maximum_authorization_credits, p_hold_idempotency_key/);
});

test("streaming and callback paths retain successful output while provider billing reconciles", () => {
  const chat = readFileSync(join(root, "src", "app", "api", "chat", "route.ts"), "utf8");
  const callback = readFileSync(join(root, "src", "app", "api", "provider-callback", "apimodels", "[secret]", "route.ts"), "utf8");
  assert.match(chat, /billingStatus: settlement\.billingStatus/);
  assert.match(chat, /billingAttempt\.engine === "v2"/);
  assert.match(callback, /provider_callback_records_fallback/);
  assert.match(callback, /pending_reconciliation/);
  assert.match(callback, /settleProviderBillingRecord/);
});
