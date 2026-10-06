import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const source = (path) => readFileSync(join(root, ...path.split("/")), "utf8");

test("Qwen normal mode explicitly disables provider-default thinking", () => {
  const provider = source("src/lib/providers/apimodels.ts");
  assert.match(provider, /model\.startsWith\("qwen3\.8-"\)/);
  assert.match(provider, /deepThink \? \{ enable_thinking: true, reasoning_effort: "medium" \} : \{ enable_thinking: false \}/);
  assert.match(provider, /max_tokens: request\.maxTokens \?\? 2048/);
  assert.match(provider, /\.\.\.reasoningControlForModel\(request\.upstreamModel, Boolean\(request\.deepThink\)\)/);
});

test("V3 text authorization uses a policy-versioned request ceiling", () => {
  const authorization = source("src/lib/billing/authorization.ts");
  assert.match(authorization, /safePolicyCharge/);
  assert.match(authorization, /BILLING_V3_AUTHORIZATION_POLICY_UNDERFUNDED/);
  assert.match(authorization, /calculateTextAuthorizationProviderCost/);
  assert.match(authorization, /authorization_input_usd_per_million/);
  assert.match(authorization, /authorizationCredits: requestAuthorization/);
  assert.doesNotMatch(authorization, /calculateAuthoritativePrice/);
  assert.doesNotMatch(authorization, /estimateTokensFromCharacters/);
});

test("chat never resubmits empty failed assistant placeholders", () => {
  const chat = source("src/components/chat-client.tsx");
  const route = source("src/app/api/chat/route.ts");
  assert.match(chat, /history\.filter\(\(message\) => message\.content\.trim\(\)\.length > 0\)/);
  assert.match(chat, /messages: working\.map/);
  assert.match(route, /content\.trim\(\)\.length > 0/);
  assert.match(route, /bodySchema\.safeParse\(sanitizedBody\)/);
});

test("text availability requires the same complete policy metadata as authorization", () => {
  const store = source("src/lib/model-store.ts");
  const core = source("src/lib/billing/model-availability-core.ts");
  const authorization = source("src/lib/billing/authorization.ts");
  assert.match(store, /evaluateModelReadiness/);
  assert.match(source("src/lib/model-readiness-core.ts"), /isRuntimeAuthorizationPolicyComplete/);
  assert.match(core, /authorization_input_usd_per_million/);
  assert.match(core, /authorization_output_usd_per_million/);
  assert.match(core, /derived_from_verified_pricing_version/);
  assert.ok(authorization.indexOf("authorizationProviderCost") < authorization.indexOf('admin.rpc("billing_v3_reserve_authorization"'));
});

test("request-bounded migration matches Production schema and switches policies atomically", () => {
  const migration = source("supabase/migrations/20260929190000_bound_text_authorizations_to_requests.sql");
  assert.doesNotMatch(migration, /verified_at/);
  assert.match(migration, /authorization_input_usd_per_million/);
  assert.match(migration, /authorization_output_usd_per_million/);
  assert.match(migration, /authorization_basis', 'request_token_ceiling/);
  const rateSeed = migration.slice(migration.indexOf("with rates"), migration.indexOf("), current_policy"));
  assert.equal([...rateSeed.matchAll(/^\s+\('[^']+',/gm)].length, 18);
  assert.match(migration, /Expected 18 complete request-bounded text policies before activation/);
  assert.match(migration, /Expected 18 complete request-bounded active text policies/);
  assert.ok(migration.indexOf("before activation") < migration.indexOf("set active = false"));
  assert.doesNotMatch(migration, /\b(delete|truncate)\b/i);
});

test("successful provider output gets bounded background settlement retries", () => {
  const billing = source("src/lib/billing/text-billing.ts");
  const chat = source("src/app/api/chat/route.ts");
  const enhancer = source("src/app/api/prompt-enhance/route.ts");
  assert.match(billing, /\[1_000, 2_000, 4_000, 8_000, 12_000, 15_000\]/);
  assert.match(billing, /settleApimodelsTask/);
  assert.match(chat, /after\(async \(\) =>/);
  assert.match(enhancer, /after\(\(\) => settleTextBillingInBackground/);
  assert.match(chat, /billingStatus === "settled" \? Number\(settlement\.chargeCredits\) : undefined/);
  assert.match(enhancer, /billingStatus === "settled" \? Number\(settlement\.chargeCredits\) : undefined/);
});

test("pending billing is not presented as a zero charge", () => {
  const chat = source("src/components/chat-client.tsx");
  assert.match(chat, /Billing pending/);
  assert.match(chat, /billingStatus === "pending_reconciliation"/);
  assert.match(chat, /pendingBilling \|\| streamEvent\.credits == null \? undefined/);
  assert.doesNotMatch(chat, /Billing pending[^\n]*0\.0000/);
});

test("the full catalog stays visible while unavailable routes remain disabled", () => {
  const store = source("src/lib/model-store.ts");
  const api = source("src/app/api/models/route.ts");
  const picker = source("src/components/model-picker.tsx");
  assert.match(store, /return rows\.map\(\(row\) =>/);
  assert.match(store, /\.filter\(\(model\) => model\.available !== false && model\.autoEligible !== false\)/);
  assert.match(store, /if \(!runtimeModels\.length\) return undefined/);
  assert.match(api, /available: model\.available !== false/);
  assert.match(api, /availabilityReason: model\.availabilityReason/);
  assert.match(picker, /disabled=\{unavailable\}/);
  assert.match(picker, /Billing setup pending/);
});

test("wallet distinguishes spendable credits from temporary reservations", () => {
  const wallet = source("src/components/wallet-client.tsx");
  assert.match(wallet, /label: "Available"/);
  assert.match(wallet, /label: "Temporarily reserved"/);
  assert.match(wallet, /Held for work in progress/i);
});

test("user-owned settlement polling is safe, bounded, and provider-authoritative", () => {
  const endpoint = source("src/app/api/billing/settle-pending/route.ts");
  const chat = source("src/components/chat-client.tsx");
  assert.match(endpoint, /isTrustedMutation\(request\)/);
  assert.match(endpoint, /enforceRateLimit/);
  assert.match(endpoint, /\.eq\("user_id", user\.id\)/);
  assert.match(endpoint, /settleApimodelsTask/);
  assert.match(endpoint, /settleProviderBillingRecord/);
  assert.match(endpoint, /releaseAuthoritativeProviderFailure/);
  assert.doesNotMatch(endpoint, /credits_usd[^\n]*NextResponse/);
  assert.match(chat, /\[2_000, 3_000, 5_000, 8_000, 13_000, 20_000\]/);
  assert.match(chat, /quoteId: streamEvent\.billingQuoteId/);
  assert.match(chat, /Billing pending/);
  assert.match(chat, /No charge/);
});

test("pending V3 messages use nullable costs and never enter historical billing", () => {
  const route = source("src/app/api/chat/route.ts");
  const usage = source("src/app/usage/page.tsx");
  assert.match(route, /credits_charged: null/);
  assert.match(route, /supplier_cost_usd: null/);
  assert.match(route, /internal_cost_pkr: null/);
  assert.match(route, /billingEngine: "v3_provider_authoritative"/);
  assert.match(usage, /metadata\.billingEngine!=="v3_provider_authoritative"/);
  assert.match(usage, /released\?"No charge":"Billing pending"/);
});

test("traffic reconciliation uses the existing database claim function", () => {
  const reconciliation = source("src/lib/billing/reconciliation.ts");
  const chat = source("src/app/api/chat/route.ts");
  assert.match(reconciliation, /export async function runBillingV3ReconciliationPump\(limit = 3\)/);
  assert.match(reconciliation, /billing_v3_claim_reconciliation_batch/);
  assert.match(chat, /runBillingV3ReconciliationPump\(3\)/);
});

