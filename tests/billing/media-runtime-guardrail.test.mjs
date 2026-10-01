import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ALL_MODELS } from "../../src/lib/models.ts";
import {
  listMediaExecutionContracts,
  mediaContractUiSchema,
  mediaUiSchemaMatchesContract,
} from "../../src/lib/media-execution-contract.ts";
import { classifyMediaRuntimeFailure } from "../../src/lib/media-runtime-error.ts";

const repairSql = [
  "20260929200000_media_image_contract_repair.sql",
  "20260929201000_media_audio_contract_repair.sql",
  "20260929202000_media_video_contract_repair.sql",
  "20260930010000_final_image_audio_repair.sql",
  "20260930093000_video_authoritative_contracts.sql",
  "20260930110000_video_verified_seedance_wan_ltx.sql",
].map((name) => readFileSync(new URL(`../../supabase/migrations/${name}`, import.meta.url), "utf8")).join("\n");

test("every advertised media execution contract has all source-controlled runtime layers", () => {
  const mediaModels = new Map(ALL_MODELS.filter((model) => model.modality !== "text").map((model) => [model.id, model]));
  const contracts = listMediaExecutionContracts();
  assert.equal(new Set(contracts.map((contract) => contract.modelId)).size, contracts.length, "contract model ids must be unique");
  for (const contract of contracts) {
    const model = mediaModels.get(contract.modelId);
    assert.ok(model, `${contract.modelId}: active catalog model`);
    assert.equal(contract.modality, model.modality, `${contract.modelId}: adapter modality`);
    assert.match(contract.strategy, /^apimodels_/, `${contract.modelId}: provider adapter strategy`);
    assert.equal(mediaUiSchemaMatchesContract(mediaContractUiSchema(contract), contract), true,
      `${contract.modelId}: compatible UI/provider contract`);
    assert.match(repairSql, new RegExp(`['\"]${contract.modelId.replaceAll("-", "\\-")}['\"]`),
      `${contract.modelId}: source-controlled authorization/pricing binding`);
  }
});

test("runtime availability fails closed on missing adapter, pricing, or UI agreement", () => {
  const modelStore = readFileSync(new URL("../../src/lib/model-store.ts", import.meta.url), "utf8");
  assert.match(modelStore, /authorization_pricing_unavailable/);
  assert.match(modelStore, /row\.modality !== "text" && !pricedPolicyModels\.has\(row\.id\)/,
    "media pricing-registry checks must not replace request-bounded text policy validation");
  assert.match(modelStore, /policy\.modality === "text" \|\| pricingKeys\.has/,
    "text executability must remain policy-bounded while media requires an exact pricing rule");
  assert.match(modelStore, /provider_adapter_unavailable/);
  assert.match(modelStore, /media_contract_mismatch/);
  assert.match(modelStore, /pricingKeys\.has/);
  assert.match(modelStore, /mediaUiSchemaMatchesContract/);
});

test("media authorization is request-bounded while settlement remains provider-authoritative", () => {
  const authorization = readFileSync(new URL("../../src/lib/billing/authorization.ts", import.meta.url), "utf8");
  const settlement = readFileSync(new URL("../../src/lib/billing/provider-authoritative-settlement.ts", import.meta.url), "utf8");
  assert.match(authorization, /priceProviderRequest\(/);
  assert.match(authorization, /priced\?\.providerCostUsd/);
  assert.match(authorization, /REQUEST_EXCEEDS_POLICY/);
  assert.match(authorization, /requestAuthorization[\s\S]*policyMaximum/);
  assert.match(settlement, /getApimodelsBillingRecord/);
  assert.doesNotMatch(settlement, /priceProviderRequest/);
});

test("known media failures produce safe, accurate public categories", () => {
  assert.deepEqual(classifyMediaRuntimeFailure(new Error("MEDIA_OPTION_UNSUPPORTED:resolution")), {
    message: "One or more selected model options are unsupported.", status: 400, category: "unsupported_option",
  });
  assert.equal(classifyMediaRuntimeFailure(new Error("BILLING_V3_AUTHORIZATION_POLICY_UNAVAILABLE")).category,
    "billing_configuration");
  const providerRejection = Object.assign(new Error("Model unavailable"), { name: "ProviderRequestError" });
  assert.equal(classifyMediaRuntimeFailure(providerRejection).category, "provider_rejected");
  assert.equal(classifyMediaRuntimeFailure(new Error("socket timeout")).category, "provider_temporary");
  assert.equal(classifyMediaRuntimeFailure(new Error("timeout"), true).category, "reconciliation_pending");
});
