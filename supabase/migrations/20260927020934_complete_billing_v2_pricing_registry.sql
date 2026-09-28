-- Complete the Billing V2 provider-aware pricing baseline for every active route.
--
-- A route is deliberately blocked when APIMODELS does not publish a complete,
-- internally consistent contract for every cost-changing dimension exposed by
-- the catalog.  Blocked rows are first-class registry state: the loader sees the
-- newest row and fails closed instead of falling back to model metadata.

insert into public.provider_pricing_rules (
  provider_key, model_id, upstream_model, pricing_version, billing_type, currency,
  per_1k_character_price, per_minute_price, formula, metadata,
  effective_from, verified_at, source_name, source_url, source_metadata, status, active
)
values
  ('apimodels', 'eleven-dialogue', 'eleven-dialogue', 'apimodels-audio-2026-09-27', 'character', 'USD',
   0.085, null, '{}'::jsonb, '{"usage_basis":"submitted_characters"}'::jsonb,
   '2026-09-27T00:00:00Z', '2026-09-27T00:00:00Z', 'APIMODELS Audio Models', 'https://apimodels.app/docs/audio',
   '{"unit":"1k_characters","verified_by":"billing-v2-cutover"}'::jsonb, 'verified', true),
  ('apimodels', 'eleven-isolator', 'eleven-isolator', 'apimodels-audio-2026-09-27', 'time', 'USD',
   null, 0.102, '{}'::jsonb, '{"usage_basis":"input_audio_minutes"}'::jsonb,
   '2026-09-27T00:00:00Z', '2026-09-27T00:00:00Z', 'APIMODELS Eleven Isolator', 'https://apimodels.app/en/models/eleven-isolator',
   '{"unit":"input_minute","verified_by":"billing-v2-cutover"}'::jsonb, 'verified', true),
  ('apimodels', 'eleven-dubbing', 'eleven-dubbing', 'apimodels-audio-2026-09-27', 'time', 'USD',
   null, 0.2805, '{}'::jsonb, '{"usage_basis":"input_audio_minutes"}'::jsonb,
   '2026-09-27T00:00:00Z', '2026-09-27T00:00:00Z', 'APIMODELS Audio Models', 'https://apimodels.app/docs/audio',
   '{"unit":"input_minute","verified_by":"billing-v2-cutover"}'::jsonb, 'verified', true)
on conflict (provider_key, model_id, upstream_model, pricing_version) do nothing;

insert into public.provider_pricing_rules (
  provider_key, model_id, upstream_model, pricing_version, billing_type, currency,
  per_image_price, per_reference_image_price, mode_dimensions, formula, metadata,
  effective_from, verified_at, source_name, source_url, source_metadata, status, active
)
values
  ('apimodels', 'flux-2-klein-4b', 'flux-2-klein-4b', 'apimodels-image-2026-09-27', 'image', 'USD',
   0.006, 0.0015, '{"create":{"multiplier":"1"},"edit":{"multiplier":"1"}}'::jsonb, '{}'::jsonb,
   '{"supported_contract":"per image plus each reference image"}'::jsonb,
   '2026-09-27T00:00:00Z', '2026-09-27T00:00:00Z', 'APIMODELS Image Models', 'https://apimodels.app/models?type=image',
   '{"verified_by":"billing-v2-cutover"}'::jsonb, 'verified', true),
  ('apimodels', 'gemini-2-5-flash-image', 'gemini-2.5-flash-image', 'apimodels-image-2026-09-27', 'image', 'USD',
   0.02, null, '{"create":{"multiplier":"1"},"edit":{"multiplier":"1"}}'::jsonb, '{}'::jsonb,
   '{"supported_contract":"flat per image"}'::jsonb,
   '2026-09-27T00:00:00Z', '2026-09-27T00:00:00Z', 'APIMODELS Image Models', 'https://apimodels.app/models?type=image',
   '{"verified_by":"billing-v2-cutover"}'::jsonb, 'verified', true),
  ('apimodels', 'kling-v3-image', 'kling-v3-image', 'apimodels-image-2026-09-27', 'image', 'USD',
   0.05, null, '{"create":{"multiplier":"1"},"edit":{"multiplier":"1"}}'::jsonb, '{}'::jsonb,
   '{"supported_contract":"flat per image"}'::jsonb,
   '2026-09-27T00:00:00Z', '2026-09-27T00:00:00Z', 'APIMODELS Image Models', 'https://apimodels.app/models?type=image',
   '{"verified_by":"billing-v2-cutover"}'::jsonb, 'verified', true),
  ('apimodels', 'qwen3-image', 'qwen3-image', 'apimodels-image-2026-09-27', 'image', 'USD',
   0.035, 0.004, '{"create":{"multiplier":"1"},"edit":{"multiplier":"1"}}'::jsonb, '{}'::jsonb,
   '{"supported_contract":"per image plus each reference image"}'::jsonb,
   '2026-09-27T00:00:00Z', '2026-09-27T00:00:00Z', 'APIMODELS Image Models', 'https://apimodels.app/models?type=image',
   '{"verified_by":"billing-v2-cutover"}'::jsonb, 'verified', true),
  ('apimodels', 'real-esrgan', 'real-esrgan', 'apimodels-image-2026-09-27', 'image', 'USD',
   0.004, null, '{"edit":{"multiplier":"1"}}'::jsonb, '{}'::jsonb,
   '{"supported_contract":"flat per output image","operational_note":"specialized image input route is not exposed by the current studio"}'::jsonb,
   '2026-09-27T00:00:00Z', '2026-09-27T00:00:00Z', 'APIMODELS Image Models', 'https://apimodels.app/models?type=image',
   '{"verified_by":"billing-v2-cutover"}'::jsonb, 'verified', true)
on conflict (provider_key, model_id, upstream_model, pricing_version) do nothing;

insert into public.provider_pricing_rules (
  provider_key, model_id, upstream_model, pricing_version, billing_type, currency,
  flat_price, per_second_price, resolution_dimensions, input_type_dimensions,
  formula, metadata, effective_from, verified_at, source_name, source_url,
  source_metadata, status, active
)
values
  ('apimodels', 'gemini-omni-1-1-flash', 'gemini-omni-1.1-flash', 'apimodels-video-2026-09-27', 'time', 'USD',
   0, null,
   '{"720p":{"perSecond":"0.07"},"1080p":{"perSecond":"0.10"},"4K":{"perSecond":"0.20"}}'::jsonb,
   '{"text":{"multiplier":"1"},"image":{"multiplier":"1"}}'::jsonb, '{}'::jsonb,
   '{"supported_contract":"generation by exact output duration and resolution","native_audio_included":true}'::jsonb,
   '2026-09-27T00:00:00Z', '2026-09-27T00:00:00Z', 'APIMODELS Gemini Omni 1.1', 'https://apimodels.app/en/models/gemini-omni-1-1-flash',
   '{"verified_by":"billing-v2-cutover"}'::jsonb, 'verified', true),
  ('apimodels', 'grok-video-3', 'grok-video-3', 'apimodels-video-2026-09-27', 'time', 'USD',
   null, 0.04, '{}'::jsonb,
   '{"text":{"multiplier":"1"},"image":{"multiplier":"1"}}'::jsonb, '{}'::jsonb,
   '{"supported_contract":"current catalog supports 480p and 720p at the same per-second rate"}'::jsonb,
   '2026-09-27T00:00:00Z', '2026-09-27T00:00:00Z', 'APIMODELS Video Models', 'https://apimodels.app/models?type=video',
   '{"verified_by":"billing-v2-cutover"}'::jsonb, 'verified', true),
  ('apimodels', 'minimax-h3', 'minimax-h3', 'apimodels-video-2026-09-27', 'time', 'USD',
   0, null,
   '{"768p":{"perSecond":"0.097"},"2K":{"perSecond":"0.145"}}'::jsonb,
   '{"text":{"multiplier":"1"},"image":{"multiplier":"1"}}'::jsonb, '{}'::jsonb,
   '{"supported_contract":"text/image generation only","unsupported_dimension":"audio or reference-video input requires separately verified surcharge"}'::jsonb,
   '2026-09-27T00:00:00Z', '2026-09-27T00:00:00Z', 'APIMODELS MiniMax H3', 'https://apimodels.app/en/models/minimax-h3',
   '{"verified_by":"billing-v2-cutover"}'::jsonb, 'verified', true),
  ('apimodels', 'veo-3-1-fast-fhd', 'veo-3.1-fast-fhd', 'apimodels-video-2026-09-27', 'flat', 'USD',
   0.07, null, '{}'::jsonb,
   '{"text":{"multiplier":"1"},"image":{"multiplier":"1"}}'::jsonb, '{}'::jsonb,
   '{"supported_contract":"fixed 8-second 1080p generation"}'::jsonb,
   '2026-09-27T00:00:00Z', '2026-09-27T00:00:00Z', 'APIMODELS VEO 3.1 Fast Full HD', 'https://apimodels.app/en/models/veo-3-1-fast-fhd',
   '{"verified_by":"billing-v2-cutover"}'::jsonb, 'verified', true)
on conflict (provider_key, model_id, upstream_model, pricing_version) do nothing;

with blocked(model_id, upstream_model, reason) as (
  values
    ('claude-fable-5-1', 'claude-fable-5-1', 'Complete cache-read, cache-write, and tier pricing is not published for authoritative settlement.'),
    ('claude-haiku-4-5', 'claude-haiku-4-5-20251001', 'Complete cache-read, cache-write, and tier pricing is not published for authoritative settlement.'),
    ('claude-opus-5', 'claude-opus-5', 'Complete cache-read, cache-write, and tier pricing is not published for authoritative settlement.'),
    ('claude-sonnet-4-6', 'claude-sonnet-4-6', 'Complete cache-read, cache-write, and tier pricing is not published for authoritative settlement.'),
    ('claude-sonnet-5', 'claude-sonnet-5', 'Complete cache-read, cache-write, and tier pricing is not published for authoritative settlement.'),
    ('deepseek-v4-flash', 'deepseek-v4-flash', 'Complete cached-token and model-specific tier pricing is not published for authoritative settlement.'),
    ('deepseek-v4-pro', 'deepseek-v4-pro', 'Complete cached-token and model-specific tier pricing is not published for authoritative settlement.'),
    ('gemini-3-8-flash', 'gemini-3.8-flash', 'Complete cached-token and long-context tier pricing is not published for authoritative settlement.'),
    ('gemini-3-pro-preview', 'gemini-3-pro-preview', 'Complete cached-token and long-context tier pricing is not published for authoritative settlement.'),
    ('glm-5-3', 'glm-5.3', 'Complete cached-token and model-specific tier pricing is not published for authoritative settlement.'),
    ('gpt-5-6-luna', 'gpt-5-6-luna', 'Complete cached-token and cache-write pricing is not published for authoritative settlement.'),
    ('gpt-5-6-sol', 'gpt-5-6-sol', 'Complete cached-token and cache-write pricing is not published for authoritative settlement.'),
    ('gpt-5-6-terra', 'gpt-5-6-terra', 'Complete cached-token and cache-write pricing is not published for authoritative settlement.'),
    ('gpt-6-astra', 'gpt-6-astra', 'Complete cached-token and cache-write pricing is not published for authoritative settlement.'),
    ('grok-4-6', 'grok-4.6', 'Current provider documentation and model page publish conflicting base prices; cache pricing is also incomplete.'),
    ('qwen3-7-plus', 'qwen3.7-plus', 'Complete cached-token and model-specific tier pricing is not published for authoritative settlement.'),
    ('qwen3-8-flash', 'qwen3.8-flash', 'Complete cached-token and model-specific tier pricing is not published for authoritative settlement.'),
    ('qwen3-8-max', 'qwen3.8-max', 'Complete cached-token and model-specific tier pricing is not published for authoritative settlement.'),
    ('doubao-seedream-5-0-pro', 'doubao-seedream-5-0-pro', 'Resolution prices are published, but authoritative resolution forwarding is not yet guaranteed by the current image request contract.'),
    ('gemini-3-1-flash-image', 'gemini-3.1-flash-image', 'Resolution prices are published, but authoritative resolution forwarding is not yet guaranteed by the current image request contract.'),
    ('gemini-3-pro-image', 'gemini-3-pro-image', 'Resolution prices are published, but authoritative resolution forwarding is not yet guaranteed by the current image request contract.'),
    ('gpt-image-2', 'gpt-image-2', 'The active catalog does not expose the complete provider resolution and quality dimensions required for exact pricing.'),
    ('gpt-image-2-5-flare', 'gpt-image-2.5-flare', 'Only a broad price range is published; the complete resolution, quality, and edit matrix is not verified.'),
    ('gpt-image-2-5-sunburst', 'gpt-image-2.5-sunburst', 'Only a broad price range is published; the complete resolution, quality, and edit matrix is not verified.'),
    ('grok-imagine-image-2', 'grok-imagine-image-2', 'The complete resolution, quality, and edit pricing matrix is not published.'),
    ('qwen3-image-pro', 'qwen3-image-pro', 'Resolution prices vary, but the active request contract does not forward an authoritative resolution.'),
    ('flashvsr', 'flashvsr', 'The complete input/output resolution and duration pricing matrix is not published.'),
    ('grok-imagine-video-1-5', 'grok-imagine-video-1.5', 'The complete native-audio and input-mode pricing contract is not published.'),
    ('kling-v3', 'kling-v3', 'The complete duration, native-audio, mode, and resolution pricing contract is not published.'),
    ('ltx-2-3', 'ltx-2.3', 'Only a starting price is published; the exact supported-option contract is not verified.'),
    ('minimax-h3-lite', 'minimax-h3-lite', 'Published resolution tiers do not match the active catalog resolution contract.'),
    ('minimax-h3-max-turbo', 'minimax-h3-max-turbo', 'Current provider pages publish conflicting per-second prices.'),
    ('seedance-2-0', 'seedance-2.0', 'The complete resolution, native-audio, and input-mode pricing matrix is not published.'),
    ('seedance-2-0-fast', 'seedance-2.0-fast', 'The exact supported-option price is not published.'),
    ('seedance-2-0-mini', 'seedance-2.0-mini', 'The complete resolution, native-audio, and input-mode pricing matrix is not published.'),
    ('seedance-2-5', 'seedance-2.5', 'Only a starting per-second price is published; the complete option matrix is not verified.'),
    ('wan-3-0-video', 'wan-3.0-video', 'Published promotional pricing has expired and the complete current option matrix is not verified.')
)
insert into public.provider_pricing_rules (
  provider_key, model_id, upstream_model, pricing_version, billing_type, currency,
  formula, metadata, effective_from, verified_at, source_name, source_url,
  source_metadata, status, active
)
select
  'apimodels', model_id, upstream_model, 'apimodels-blocked-2026-09-27', 'formula', 'USD',
  jsonb_build_object('kind', 'blocked', 'reason', reason),
  jsonb_build_object('block_reason', reason, 'fail_closed', true),
  '2026-09-27T00:00:00Z'::timestamptz, null,
  'APIMODELS provider documentation', 'https://apimodels.app/docs',
  jsonb_build_object('reviewed_at', '2026-09-27T00:00:00Z', 'verified_by', 'billing-v2-cutover'),
  'blocked', false
from blocked
on conflict (provider_key, model_id, upstream_model, pricing_version) do nothing;

-- Assert that every active provider route has a latest fail-closed decision and
-- that every active rule is a genuinely verified rule.
do $$
declare
  v_active_routes integer;
  v_covered_routes integer;
begin
  select count(*) into v_active_routes
  from public.models m
  join public.provider_models pm on pm.model_id = m.id
  where m.active and pm.active;

  with latest as (
    select distinct on (r.provider_key, r.model_id, r.upstream_model)
      r.provider_key, r.model_id, r.upstream_model, r.status, r.active
    from public.provider_pricing_rules r
    order by r.provider_key, r.model_id, r.upstream_model, r.effective_from desc, r.created_at desc
  )
  select count(*) into v_covered_routes
  from public.models m
  join public.provider_models pm on pm.model_id = m.id and pm.active
  join latest l
    on l.provider_key = pm.provider_key
   and l.model_id = pm.model_id
   and l.upstream_model = pm.upstream_model
  where m.active
    and ((l.status = 'verified' and l.active) or (l.status = 'blocked' and not l.active));

  if v_active_routes <> 57 then
    raise exception 'Expected 57 active provider routes, found %', v_active_routes;
  end if;
  if v_covered_routes <> v_active_routes then
    raise exception 'Billing V2 pricing coverage incomplete: % of % routes', v_covered_routes, v_active_routes;
  end if;
end
$$;
;
