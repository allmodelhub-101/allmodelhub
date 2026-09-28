import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../../supabase/migrations/20260927020934_complete_billing_v2_pricing_registry.sql", import.meta.url),
  "utf8",
);
const executionGateMigration = readFileSync(
  new URL("../../supabase/migrations/20260927061138_disable_unverified_billing_routes.sql", import.meta.url),
  "utf8",
);
const qwenPricingMigration = readFileSync(
  new URL("../../supabase/migrations/20260928162500_verify_qwen_3_8_text_pricing.sql", import.meta.url),
  "utf8",
);

const previouslyVerified = [
  "eleven-tts-flash", "eleven-tts-multilingual", "eleven-tts-v3", "kling-sound-effects",
  "kling-tts", "minimax-speech-2-8-hd", "minimax-speech-2-8-turbo", "suno-v5",
];

const newlyVerified = [
  "eleven-dialogue", "eleven-dubbing", "eleven-isolator",
  "flux-2-klein-4b", "gemini-2-5-flash-image", "kling-v3-image", "qwen3-image", "real-esrgan",
  "gemini-omni-1-1-flash", "grok-video-3", "minimax-h3", "veo-3-1-fast-fhd",
];

const blocked = [
  "claude-fable-5-1", "claude-haiku-4-5", "claude-opus-5", "claude-sonnet-4-6", "claude-sonnet-5",
  "deepseek-v4-flash", "deepseek-v4-pro", "gemini-3-8-flash", "gemini-3-pro-preview", "glm-5-3",
  "gpt-5-6-luna", "gpt-5-6-sol", "gpt-5-6-terra", "gpt-6-astra", "grok-4-6",
  "qwen3-7-plus", "qwen3-8-flash", "qwen3-8-max",
  "doubao-seedream-5-0-pro", "gemini-3-1-flash-image", "gemini-3-pro-image", "gpt-image-2",
  "gpt-image-2-5-flare", "gpt-image-2-5-sunburst", "grok-imagine-image-2", "qwen3-image-pro",
  "flashvsr", "grok-imagine-video-1-5", "kling-v3", "ltx-2-3", "minimax-h3-lite",
  "minimax-h3-max-turbo", "seedance-2-0", "seedance-2-0-fast", "seedance-2-0-mini",
  "seedance-2-5", "wan-3-0-video",
];

test("all 57 active provider routes have an explicit pricing decision", () => {
  const active = [...previouslyVerified, ...newlyVerified, ...blocked];
  assert.equal(active.length, 57);
  assert.equal(new Set(active).size, 57);
  for (const model of newlyVerified) assert.match(migration, new RegExp(`'${model.replaceAll("-", "\\-")}'`));
  for (const model of blocked) {
    assert.match(migration, new RegExp(`'${model.replaceAll("-", "\\-")}'`));
    assert.match(migration, new RegExp(`\\('${model.replaceAll("-", "\\-")}',\\s*'[^']+',\\s*'[^']+'\\)`));
  }
});

test("unverified routes are explicit fail-closed registry state", () => {
  assert.match(migration, /'apimodels-blocked-2026-09-27'/);
  assert.match(migration, /'blocked', false/);
  assert.match(migration, /jsonb_build_object\('kind', 'blocked', 'reason', reason\)/);
  assert.match(migration, /v_active_routes <> 57/);
  assert.match(migration, /v_covered_routes <> v_active_routes/);
});

test("unverified routes are removed from executable customer routing", () => {
  assert.match(executionGateMigration, /update public\.provider_models/);
  assert.match(executionGateMigration, /billing_v2_status', 'temporarily_unavailable'/);
  assert.match(executionGateMigration, /update public\.models/);
  assert.match(executionGateMigration, /auto_eligible = false/);
  assert.match(executionGateMigration, /An executable provider route has non-verified Billing V2 pricing/);
});

test("verified rules preserve all distinct media strategies", () => {
  assert.match(migration, /0\.085, null.*submitted_characters/s);
  assert.match(migration, /null, 0\.102.*input_audio_minutes/s);
  assert.match(migration, /0\.006, 0\.0015.*per image plus each reference image/s);
  assert.match(migration, /"720p":\{"perSecond":"0\.07"\}.*"4K":\{"perSecond":"0\.20"\}/s);
  assert.match(migration, /'veo-3-1-fast-fhd'.*'flat'.*0\.07/s);
});

test("Qwen 3.8 text routes use current authoritative per-token prices", () => {
  assert.match(qwenPricingMigration, /'qwen3-8-flash'.*0\.00000015, 0\.00000047, 0\.000000016/s);
  assert.match(qwenPricingMigration, /'qwen3-8-max'.*0\.000002, 0\.000006, 0\.00000025/s);
  assert.match(qwenPricingMigration, /reasoning tokens are included in provider completion tokens/);
  assert.match(qwenPricingMigration, /billing_v2_executable', true/);
  assert.match(qwenPricingMigration, /verified_count <> 2/);
});
