-- Billing V3 is the sole runtime engine for all new AI requests. Historical
-- Billing V1/V2 rows, receipts, pricing rules, and settlement functions remain
-- intact for audit and reconciliation of requests created before this cutover.

insert into public.system_settings (key, value)
values
  ('billing_runtime_engine', '"v3_provider_authoritative"'::jsonb),
  ('billing_v3_provider_authoritative_enabled', 'true'::jsonb),
  ('billing_v3_canary_models', '[]'::jsonb),
  ('billing_v2_shadow_validation_enabled', 'false'::jsonb)
on conflict (key) do update
set value = excluded.value,
    updated_at = now();

-- These bounds are authorization ceilings, not final prices. Each is derived
-- from the current APIMODELS contract and the request limits enforced by AMH.
-- Final cost always comes from the settled APIMODELS provider record.
with policy(model_id, upstream_model, modality, maximum_provider_cost_usd, constraints, source_version) as (
  values
    ('claude-fable-5-1', 'claude-fable-5-1', 'text', ((150000 * 5.0000 + 16384 * 25.0000) / 1000000)::numeric, '{"maxInputTokens":"150000","maxOutputTokens":"16384"}'::jsonb, 'apimodels-llm-2026-09-29'),
    ('claude-haiku-4-5', 'claude-haiku-4-5-20251001', 'text', ((150000 * 0.353 + 16384 * 1.765) / 1000000)::numeric, '{"maxInputTokens":"150000","maxOutputTokens":"16384"}'::jsonb, 'apimodels-llm-2026-09-29'),
    ('claude-opus-5', 'claude-opus-5', 'text', ((150000 * 3.0000 + 16384 * 15.0000) / 1000000)::numeric, '{"maxInputTokens":"150000","maxOutputTokens":"16384"}'::jsonb, 'apimodels-llm-2026-09-29'),
    ('claude-sonnet-4-6', 'claude-sonnet-4-6', 'text', ((150000 * 1.059 + 16384 * 5.295) / 1000000)::numeric, '{"maxInputTokens":"150000","maxOutputTokens":"16384"}'::jsonb, 'apimodels-llm-2026-09-29'),
    ('claude-sonnet-5', 'claude-sonnet-5', 'text', ((150000 * 1.6000 + 16384 * 8.0000) / 1000000)::numeric, '{"maxInputTokens":"150000","maxOutputTokens":"16384"}'::jsonb, 'apimodels-llm-2026-09-29'),
    ('deepseek-v4-flash', 'deepseek-v4-flash', 'text', ((150000 * 0.297 + 16384 * 0.891) / 1000000)::numeric, '{"maxInputTokens":"150000","maxOutputTokens":"16384"}'::jsonb, 'apimodels-llm-2026-09-29'),
    ('deepseek-v4-pro', 'deepseek-v4-pro', 'text', ((150000 * 1.247 + 16384 * 3.742) / 1000000)::numeric, '{"maxInputTokens":"150000","maxOutputTokens":"16384"}'::jsonb, 'apimodels-llm-2026-09-29'),
    ('gemini-3-8-flash', 'gemini-3.8-flash', 'text', ((150000 * 0.450 + 16384 * 2.250) / 1000000)::numeric, '{"maxInputTokens":"150000","maxOutputTokens":"16384"}'::jsonb, 'apimodels-llm-2026-09-29'),
    ('gemini-3-pro-preview', 'gemini-3-pro-preview', 'text', ((150000 * 1.600 + 16384 * 9.600) / 1000000)::numeric, '{"maxInputTokens":"150000","maxOutputTokens":"16384"}'::jsonb, 'apimodels-llm-2026-09-29'),
    ('glm-5-3', 'glm-5.3', 'text', ((150000 * 1.330 + 16384 * 4.180) / 1000000)::numeric, '{"maxInputTokens":"150000","maxOutputTokens":"16384"}'::jsonb, 'apimodels-llm-2026-09-29'),
    ('gpt-5-6-luna', 'gpt-5-6-luna', 'text', ((150000 * 0.160 + 16384 * 0.960) / 1000000)::numeric, '{"maxInputTokens":"150000","maxOutputTokens":"16384"}'::jsonb, 'apimodels-llm-2026-09-29'),
    ('gpt-5-6-sol', 'gpt-5-6-sol', 'text', ((150000 * 1.324 + 16384 * 6.618) / 1000000)::numeric, '{"maxInputTokens":"150000","maxOutputTokens":"16384"}'::jsonb, 'apimodels-llm-2026-09-29'),
    ('gpt-5-6-terra', 'gpt-5-6-terra', 'text', ((150000 * 0.551 + 16384 * 3.309) / 1000000)::numeric, '{"maxInputTokens":"150000","maxOutputTokens":"16384"}'::jsonb, 'apimodels-llm-2026-09-29'),
    ('gpt-6-astra', 'gpt-6-astra', 'text', ((150000 * 2.400 + 16384 * 12.000) / 1000000)::numeric, '{"maxInputTokens":"150000","maxOutputTokens":"16384"}'::jsonb, 'apimodels-llm-2026-09-29'),
    ('grok-4-6', 'grok-4.6', 'text', ((150000 * 1.500 + 16384 * 4.500) / 1000000)::numeric, '{"maxInputTokens":"150000","maxOutputTokens":"16384"}'::jsonb, 'apimodels-llm-2026-09-29'),
    ('qwen3-7-plus', 'qwen3.7-plus', 'text', ((150000 * 0.360 + 16384 * 1.440) / 1000000)::numeric, '{"maxInputTokens":"150000","maxOutputTokens":"16384"}'::jsonb, 'apimodels-llm-2026-09-29'),
    ('doubao-seedream-5-0-pro', 'doubao-seedream-5-0-pro', 'image', 0.060::numeric, '{"maxCharacters":"20000","maxImages":"1","maxReferences":"10","allowedResolutions":["1K","2K"],"allowedInputTypes":["text","image"]}'::jsonb, 'apimodels-image-2026-09-29'),
    ('gpt-image-2', 'gpt-image-2', 'image', 0.050::numeric, '{"maxCharacters":"20000","maxImages":"1","maxReferences":"10","allowedResolutions":["1K","2K","4K"],"allowedInputTypes":["text","image"],"allowedAspectRatios":["1:1","16:9","9:16","4:3","3:4"]}'::jsonb, 'apimodels-gpt-image-2-2026-09-29'),
    ('qwen3-image-pro', 'qwen3-image-pro', 'image', 0.079::numeric, '{"maxCharacters":"20000","maxImages":"1","maxReferences":"1","allowedResolutions":["1K","2K"],"allowedInputTypes":["text","image"],"allowedAspectRatios":["1:1","16:9","9:16","4:3","3:4"]}'::jsonb, 'apimodels-image-2026-09-29'),
    ('kling-v3', 'kling-v3', 'video', 1.800::numeric, '{"maxCharacters":"20000","maxSeconds":"10","maxOutputDuration":"10","maxImages":"1","maxReferences":"1","allowedResolutions":["720p"],"allowedInputTypes":["text","image"],"allowedAspectRatios":["16:9","9:16","1:1"],"allowedNativeAudio":[false,true]}'::jsonb, 'apimodels-kling-v3-2026-09-29')
), settings as (
  select
    (select (value #>> '{}')::numeric from public.system_settings where key = 'internal_usd_pkr') as fx,
    (select (value #>> '{}')::numeric from public.system_settings where key = 'billing_v2_wallet_reservation_quantum_credits') as quantum
)
insert into public.billing_authorization_policies (
  provider_key, model_id, upstream_model, modality, policy_version,
  maximum_provider_cost_usd, maximum_authorization_credits, fx_rate_snapshot,
  markup_snapshot, request_constraints, metadata, effective_from, active
)
select 'apimodels', p.model_id, p.upstream_model, p.modality,
  'billing-v3-auth-2026-09-29-consolidated', p.maximum_provider_cost_usd,
  ceil((p.maximum_provider_cost_usd * s.fx * m.markup) / s.quantum) * s.quantum,
  s.fx, m.markup, p.constraints,
  jsonb_build_object(
    'authorization_only', true,
    'derived_from_verified_pricing_version', p.source_version,
    'final_cost_authority', 'apimodels_records_api',
    'source_url', case when p.model_id = 'gpt-image-2' then 'https://apimodels.app/docs/gpt-image-2'
      when p.model_id = 'kling-v3' then 'https://apimodels.app/models/kling-v3'
      when p.modality = 'text' then 'https://apimodels.app/docs/llm'
      else 'https://apimodels.app/docs/image' end
  ),
  '2026-09-29T16:00:00Z'::timestamptz, true
from policy p
join public.models m on m.id = p.model_id
join public.provider_models route on route.provider_key = 'apimodels'
  and route.model_id = p.model_id and route.upstream_model = p.upstream_model and route.active
cross join settings s
where s.fx > 0 and s.quantum > 0
on conflict (provider_key, model_id, upstream_model, modality, policy_version) do nothing;

do $$
declare v_seeded integer;
begin
  select count(*) into v_seeded from public.billing_authorization_policies
  where policy_version = 'billing-v3-auth-2026-09-29-consolidated' and active;
  if v_seeded <> 20 then
    raise exception 'Expected 20 new defensible Billing V3 authorization policies, found %', v_seeded;
  end if;
end
$$;

comment on table public.provider_pricing_rules is
  'Historical Billing V2 pricing registry retained for audit. It is not an availability or settlement authority for new requests after the Billing V3 cutover.';

comment on table public.billing_authorization_policies is
  'Billing V3 fail-closed wallet authorization policies. APIMODELS provider records remain the final provider-cost authority.';

create index if not exists billing_authorization_policies_model_id_idx
  on public.billing_authorization_policies (model_id);
create index if not exists provider_billing_records_user_id_idx
  on public.provider_billing_records (user_id);
create index if not exists provider_billing_records_model_id_idx
  on public.provider_billing_records (model_id);
create index if not exists provider_billing_records_message_id_idx
  on public.provider_billing_records (message_id) where message_id is not null;
create index if not exists provider_billing_records_generation_job_id_idx
  on public.provider_billing_records (generation_job_id) where generation_job_id is not null;

do $$
declare
  v_engine text;
  v_enabled boolean;
  v_canaries jsonb;
begin
  select value #>> '{}' into v_engine
  from public.system_settings where key = 'billing_runtime_engine';
  select (value #>> '{}')::boolean into v_enabled
  from public.system_settings where key = 'billing_v3_provider_authoritative_enabled';
  select value into v_canaries
  from public.system_settings where key = 'billing_v3_canary_models';

  if v_engine <> 'v3_provider_authoritative' or not v_enabled or v_canaries <> '[]'::jsonb then
    raise exception 'Billing V3 runtime cutover settings failed validation';
  end if;
end
$$;
