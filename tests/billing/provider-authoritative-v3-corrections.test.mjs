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

test("V3 authorization holds the validated policy maximum instead of a token estimate", () => {
  const authorization = source("src/lib/billing/authorization.ts");
  assert.match(authorization, /safePolicyCharge/);
  assert.match(authorization, /BILLING_V3_AUTHORIZATION_POLICY_UNDERFUNDED/);
  assert.match(authorization, /authorizationCredits: policyMaximum/);
  assert.doesNotMatch(authorization, /calculateAuthoritativePrice/);
  assert.doesNotMatch(authorization, /estimateTokensFromCharacters/);
});

test("successful provider output gets bounded background settlement retries", () => {
  const billing = source("src/lib/billing/text-billing.ts");
  const chat = source("src/app/api/chat/route.ts");
  const enhancer = source("src/app/api/prompt-enhance/route.ts");
  assert.match(billing, /\[500, 1_500, 3_000, 5_000\]/);
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
  assert.match(store, /return rows\.map\(\(row\) => withAvailability/);
  assert.match(store, /\.filter\(\(model\) => model\.available !== false && model\.autoEligible !== false\)/);
  assert.match(store, /if \(!runtimeModels\.length\) return undefined/);
  assert.match(api, /available: model\.available !== false/);
  assert.match(api, /availabilityReason: model\.availabilityReason/);
  assert.match(picker, /disabled=\{unavailable\}/);
  assert.match(picker, /Billing setup pending/);
});

test("wallet distinguishes spendable credits from temporary reservations", () => {
  const wallet = source("src/components/wallet-client.tsx");
  assert.match(wallet, /label: "Spendable"/);
  assert.match(wallet, /label: "Temporarily reserved"/);
  assert.match(wallet, /not a final charge/i);
});
