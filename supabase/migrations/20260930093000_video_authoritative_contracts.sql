-- Video-only Billing V3 expansion. These rules provide a conservative request
-- authorization envelope; APIMODELS /v1/records remains final cost authority.

insert into public.provider_pricing_rules (
  provider_key, model_id, upstream_model, pricing_version, billing_type, currency,
  flat_price, resolution_dimensions, input_type_dimensions, formula, metadata,
  effective_from, verified_at, source_name, source_url, source_metadata, status, active
)
values
  ('apimodels', 'grok-imagine-video-1-5', 'grok-imagine-video-1.5',
   'apimodels-grok-imagine-video-1-5-2026-09-30', 'time', 'USD', 0,
   '{"480p":{"perSecond":"0.0294"},"720p":{"perSecond":"0.0529"},"1080p":{"perSecond":"0.0882"}}'::jsonb,
   '{"text":{"multiplier":"1"},"image":{"multiplier":"1"}}'::jsonb, '{}'::jsonb,
   '{"authorization_only":true,"final_cost_authority":"apimodels_records_api","failed_requests_billable":false,"reference_images_free":true}'::jsonb,
   now() - interval '1 minute', now(), 'APIMODELS Grok Imagine Video 1.5',
   'https://apimodels.app/models/grok-imagine-video-1.5',
   '{"verified_on":"2026-09-30","billing_basis":"resolution_per_output_second","max_duration_seconds":15}'::jsonb, 'verified', true),
  ('apimodels', 'minimax-h3-max-turbo', 'minimax-h3-max-turbo',
   'apimodels-minimax-h3-max-turbo-2026-09-30', 'time', 'USD', 0,
   '{"480p":{"perSecond":"0.06"},"768p":{"perSecond":"0.096"}}'::jsonb,
   '{"text":{"multiplier":"1"},"image":{"multiplier":"1"}}'::jsonb, '{}'::jsonb,
   '{"authorization_only":true,"final_cost_authority":"apimodels_records_api","failed_requests_billable":false,"first_last_frame_surcharge":"0"}'::jsonb,
   now() - interval '1 minute', now(), 'APIMODELS MiniMax H3 Max Turbo',
   'https://apimodels.app/docs/minimax-h3-max-turbo',
   '{"verified_on":"2026-09-30","billing_basis":"resolution_per_output_second","max_duration_seconds":15}'::jsonb, 'verified', true)
on conflict (provider_key, model_id, upstream_model, pricing_version) do nothing;

update public.models
set ui_schema = case id
  when 'grok-imagine-video-1-5' then '{"inputModes":["text","image"],"durationOptions":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],"resolutionOptions":["480p","720p","1080p"],"aspectRatios":["16:9","9:16","1:1","3:2","2:3"],"maxReferences":7}'::jsonb
  when 'minimax-h3-max-turbo' then '{"inputModes":["text","image"],"durationOptions":[5,6,7,8,9,10,11,12,13,14,15],"resolutionOptions":["480p","768p"],"aspectRatios":["21:9","16:9","4:3","1:1","3:4","9:16"],"maxReferences":1}'::jsonb
  else ui_schema
end
where id in ('grok-imagine-video-1-5', 'minimax-h3-max-turbo');

update public.billing_authorization_policies
set active = false,
    effective_until = case when effective_until is null or effective_until > now() then now() else effective_until end
where active and modality = 'video'
  and model_id in ('grok-imagine-video-1-5', 'minimax-h3-max-turbo');

with policy(model_id, upstream_model, maximum_provider_cost_usd, constraints, pricing_version, source_url) as (
  values
    ('grok-imagine-video-1-5', 'grok-imagine-video-1.5', 1.323::numeric,
     '{"maxCharacters":"20000","maxSeconds":"15","maxOutputDuration":"15","maxImages":"1","maxReferences":"7","allowedResolutions":["480p","720p","1080p"],"allowedInputTypes":["text","image"],"allowedAspectRatios":["16:9","9:16","1:1","3:2","2:3"]}'::jsonb,
     'apimodels-grok-imagine-video-1-5-2026-09-30', 'https://apimodels.app/models/grok-imagine-video-1.5'),
    ('minimax-h3-max-turbo', 'minimax-h3-max-turbo', 1.440::numeric,
     '{"maxCharacters":"5000","maxSeconds":"15","maxOutputDuration":"15","maxImages":"1","maxReferences":"1","allowedResolutions":["480p","768p"],"allowedInputTypes":["text","image"],"allowedAspectRatios":["21:9","16:9","4:3","1:1","3:4","9:16"]}'::jsonb,
     'apimodels-minimax-h3-max-turbo-2026-09-30', 'https://apimodels.app/docs/minimax-h3-max-turbo')
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
  'billing-v3-auth-2026-09-30-video-authoritative', p.maximum_provider_cost_usd,
  ceil((p.maximum_provider_cost_usd * s.fx * m.markup) / s.quantum) * s.quantum,
  s.fx, m.markup, p.constraints,
  jsonb_build_object('authorization_only', true,
    'derived_from_verified_pricing_version', p.pricing_version,
    'final_cost_authority', 'apimodels_records_api',
    'execution_strategy', 'apimodels_video_async',
    'failed_pre_acceptance_billable', false,
    'source_url', p.source_url),
  now(), null, true
from policy p
join public.models m on m.id = p.model_id and m.active
join public.provider_models route on route.provider_key = 'apimodels'
  and route.model_id = p.model_id and route.upstream_model = p.upstream_model and route.active
cross join settings s
where s.fx > 0 and s.quantum > 0
on conflict (provider_key, model_id, upstream_model, modality, policy_version) do nothing;

do $$
declare v_policies integer; v_rules integer;
begin
  select count(*) into v_policies from public.billing_authorization_policies
  where policy_version = 'billing-v3-auth-2026-09-30-video-authoritative' and active;
  select count(*) into v_rules from public.provider_pricing_rules
  where provider_key = 'apimodels' and status = 'verified' and active
    and (model_id, pricing_version) in (
      ('grok-imagine-video-1-5', 'apimodels-grok-imagine-video-1-5-2026-09-30'),
      ('minimax-h3-max-turbo', 'apimodels-minimax-h3-max-turbo-2026-09-30')
    );
  if v_policies <> 2 or v_rules <> 2 then
    raise exception 'Video authoritative repair expected 2 policies and 2 pricing rules; found % and %', v_policies, v_rules;
  end if;
end $$;
