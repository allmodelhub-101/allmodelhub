-- Bind executable video workflows to the provider's current request contracts.
-- These rules size a temporary wallet authorization only. APIMODELS /records
-- remains the sole final settlement authority for successful provider tasks.

insert into public.provider_pricing_rules (
  provider_key, model_id, upstream_model, pricing_version, billing_type, currency,
  flat_price, resolution_dimensions, mode_dimensions, input_type_dimensions,
  formula, metadata, effective_from, verified_at, source_name, source_url,
  source_metadata, status, active
)
values
  ('apimodels', 'kling-v3', 'kling-v3', 'apimodels-kling-v3-2026-09-29', 'time', 'USD',
   0,
   '{"720p":{"perSecond":"0.12"},"1080p":{"perSecond":"0.16"}}'::jsonb,
   '{"silent":{"multiplier":"1"},"native_audio":{"multiplier":"1.5"}}'::jsonb,
   '{"text":{"multiplier":"1"},"image":{"multiplier":"1"}}'::jsonb,
   '{}'::jsonb,
   '{"authorization_only":true,"failed_requests_billable":false,"provider_mode":{"720p":"std","1080p":"pro"},"provider_audio":{"false":"off","true":"on"}}'::jsonb,
   now() - interval '1 minute', now(), 'APIMODELS Kling V3', 'https://apimodels.app/docs/kling-video',
   '{"verified_by":"media-runtime-repair"}'::jsonb, 'verified', true),
  ('apimodels', 'minimax-h3-lite', 'minimax-h3-lite', 'apimodels-minimax-h3-lite-2026-09-29', 'time', 'USD',
   0,
   '{"480p":{"perSecond":"0.01"},"768p":{"perSecond":"0.02"}}'::jsonb,
   '{}'::jsonb,
   '{"text":{"multiplier":"1"},"image":{"multiplier":"1"}}'::jsonb,
   '{}'::jsonb,
   '{"authorization_only":true,"failed_requests_billable":false,"reference_images_free":true}'::jsonb,
   now() - interval '1 minute', now(), 'APIMODELS MiniMax H3 Lite', 'https://apimodels.app/docs/minimax-h3-lite',
   '{"verified_by":"media-runtime-repair"}'::jsonb, 'verified', true)
on conflict (provider_key, model_id, upstream_model, pricing_version) do nothing;

update public.models set ui_schema = case id
  when 'gemini-omni-1-1-flash' then '{"inputModes":["text","image"],"durationOptions":[4,6,8,10],"resolutionOptions":["720p","1080p","4K"],"aspectRatios":["16:9","9:16"],"maxReferences":7}'::jsonb
  when 'grok-video-3' then '{"inputModes":["text","image"],"durationOptions":[6,10,15],"resolutionOptions":["480p","720p"],"aspectRatios":["16:9","9:16","1:1","4:3","3:4"],"maxReferences":7}'::jsonb
  when 'kling-v3' then '{"inputModes":["text","image"],"durationOptions":[3,4,5,6,7,8,9,10,11,12,13,14,15],"resolutionOptions":["720p","1080p"],"aspectRatios":["16:9","9:16","1:1","4:3","3:4","3:2","2:3","21:9"],"maxReferences":1,"nativeAudio":true}'::jsonb
  when 'minimax-h3' then '{"inputModes":["text","image"],"durationOptions":[5,6,7,8,9,10,11,12,13,14,15],"resolutionOptions":["768p","2K"],"aspectRatios":["adaptive","21:9","16:9","4:3","1:1","3:4","9:16"],"maxReferences":5}'::jsonb
  when 'minimax-h3-lite' then '{"inputModes":["text","image"],"durationOptions":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],"resolutionOptions":["480p","768p"],"aspectRatios":["16:9","9:16"],"maxReferences":9}'::jsonb
  when 'veo-3-1-fast-fhd' then '{"inputModes":["text","image"],"durationOptions":[8],"resolutionOptions":["1080p"],"aspectRatios":["16:9","9:16"],"maxReferences":2}'::jsonb
  else ui_schema end
where id in ('gemini-omni-1-1-flash','grok-video-3','kling-v3','minimax-h3','minimax-h3-lite','veo-3-1-fast-fhd');

update public.billing_authorization_policies
set active = false,
    effective_until = case when effective_until is null or effective_until > now() then now() else effective_until end
where active and modality = 'video'
  and model_id in ('gemini-omni-1-1-flash','grok-video-3','kling-v3','minimax-h3','minimax-h3-lite','veo-3-1-fast-fhd')
  and policy_version <> 'billing-v3-auth-2026-09-29-video-runtime';

with policy(model_id, upstream_model, maximum_provider_cost_usd, constraints, pricing_version, source_url) as (
  values
    ('gemini-omni-1-1-flash', 'gemini-omni-1.1-flash', 2.000::numeric,
      '{"maxCharacters":"20000","maxSeconds":"10","maxOutputDuration":"10","maxImages":"1","maxReferences":"7","allowedResolutions":["720p","1080p","4K"],"allowedInputTypes":["text","image"],"allowedAspectRatios":["16:9","9:16"]}'::jsonb,
      'apimodels-video-2026-09-27', 'https://apimodels.app/docs/gemini-omni-1-1-flash'),
    ('grok-video-3', 'grok-video-3', 0.600::numeric,
      '{"maxCharacters":"20000","maxSeconds":"15","maxOutputDuration":"15","maxImages":"1","maxReferences":"7","allowedResolutions":["480p","720p"],"allowedInputTypes":["text","image"],"allowedAspectRatios":["16:9","9:16","1:1","4:3","3:4"]}'::jsonb,
      'apimodels-video-2026-09-27', 'https://apimodels.app/models/grok-video-3'),
    ('kling-v3', 'kling-v3', 3.600::numeric,
      '{"maxCharacters":"2500","maxSeconds":"15","maxOutputDuration":"15","maxImages":"1","maxReferences":"1","allowedResolutions":["720p","1080p"],"allowedInputTypes":["text","image"],"allowedAspectRatios":["16:9","9:16","1:1","4:3","3:4","3:2","2:3","21:9"],"allowedNativeAudio":[false,true]}'::jsonb,
      'apimodels-kling-v3-2026-09-29', 'https://apimodels.app/docs/kling-video'),
    ('minimax-h3', 'minimax-h3', 2.175::numeric,
      '{"maxCharacters":"20000","maxSeconds":"15","maxOutputDuration":"15","maxImages":"1","maxReferences":"5","allowedResolutions":["768p","2K"],"allowedInputTypes":["text","image"],"allowedAspectRatios":["adaptive","21:9","16:9","4:3","1:1","3:4","9:16"]}'::jsonb,
      'apimodels-video-2026-09-27', 'https://apimodels.app/models/minimax-h3'),
    ('minimax-h3-lite', 'minimax-h3-lite', 0.300::numeric,
      '{"maxCharacters":"20000","maxSeconds":"15","maxOutputDuration":"15","maxImages":"1","maxReferences":"9","allowedResolutions":["480p","768p"],"allowedInputTypes":["text","image"],"allowedAspectRatios":["16:9","9:16"]}'::jsonb,
      'apimodels-minimax-h3-lite-2026-09-29', 'https://apimodels.app/docs/minimax-h3-lite'),
    ('veo-3-1-fast-fhd', 'veo-3.1-fast-fhd', 0.070::numeric,
      '{"maxCharacters":"20000","maxSeconds":"8","maxOutputDuration":"8","maxImages":"1","maxReferences":"2","allowedResolutions":["1080p"],"allowedInputTypes":["text","image"],"allowedAspectRatios":["16:9","9:16"]}'::jsonb,
      'apimodels-video-2026-09-27', 'https://apimodels.app/docs/google-veo')
), settings as (
  select
    (select (value #>> '{}')::numeric from public.system_settings where key = 'internal_usd_pkr') as fx,
    (select (value #>> '{}')::numeric from public.system_settings where key = 'billing_v2_wallet_reservation_quantum_credits') as quantum
)
insert into public.billing_authorization_policies (
  provider_key, model_id, upstream_model, modality, policy_version,
  maximum_provider_cost_usd, maximum_authorization_credits, fx_rate_snapshot,
  markup_snapshot, request_constraints, metadata, effective_from, effective_until, active
)
select 'apimodels', p.model_id, p.upstream_model, 'video',
  'billing-v3-auth-2026-09-29-video-runtime', p.maximum_provider_cost_usd,
  ceil((p.maximum_provider_cost_usd * s.fx * m.markup) / s.quantum) * s.quantum,
  s.fx, m.markup, p.constraints,
  jsonb_build_object(
    'authorization_only', true,
    'derived_from_verified_pricing_version', p.pricing_version,
    'final_cost_authority', 'apimodels_records_api',
    'source_url', p.source_url,
    'execution_strategy', 'apimodels_video_async',
    'provider_acceptance_required', true,
    'failed_pre_acceptance_billable', false
  ),
  now(), null, true
from policy p
join public.models m on m.id = p.model_id and m.active
join public.provider_models route on route.provider_key = 'apimodels'
  and route.model_id = p.model_id and route.upstream_model = p.upstream_model and route.active
cross join settings s
where s.fx > 0 and s.quantum > 0
on conflict (provider_key, model_id, upstream_model, modality, policy_version) do nothing;

do $$
declare v_versioned integer; v_rules integer;
begin
  select count(*) into v_versioned from public.billing_authorization_policies
  where policy_version = 'billing-v3-auth-2026-09-29-video-runtime' and active;
  select count(*) into v_rules from public.provider_pricing_rules
  where provider_key = 'apimodels' and status = 'verified' and active
    and (model_id, pricing_version) in (
      ('gemini-omni-1-1-flash','apimodels-video-2026-09-27'),
      ('grok-video-3','apimodels-video-2026-09-27'),
      ('kling-v3','apimodels-kling-v3-2026-09-29'),
      ('minimax-h3','apimodels-video-2026-09-27'),
      ('minimax-h3-lite','apimodels-minimax-h3-lite-2026-09-29'),
      ('veo-3-1-fast-fhd','apimodels-video-2026-09-27')
    );
  if v_versioned <> 6 or v_rules <> 6 then
    raise exception 'Video repair expected 6 executable policies and 6 exact pricing rules; found % and %', v_versioned, v_rules;
  end if;
end $$;
