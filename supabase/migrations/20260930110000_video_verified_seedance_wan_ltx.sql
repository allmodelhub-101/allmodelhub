-- Add only current, documented video configurations. These values calculate a
-- conservative temporary authorization; APIMODELS /v1/records is the sole
-- final provider-cost source for successful work.

update public.provider_models
set upstream_model = case model_id
  when 'seedance-2-0' then 'seedance-2.0-official'
  when 'seedance-2-0-fast' then 'seedance-2.0-fast-official'
  when 'seedance-2-0-mini' then 'seedance-2.0-mini-official'
  else upstream_model
end
where provider_key = 'apimodels'
  and model_id in ('seedance-2-0', 'seedance-2-0-fast', 'seedance-2-0-mini');

insert into public.provider_pricing_rules (
  provider_key, model_id, upstream_model, pricing_version, billing_type, currency,
  flat_price, resolution_dimensions, input_type_dimensions, formula, metadata,
  effective_from, verified_at, source_name, source_url, source_metadata, status, active
)
values
  ('apimodels','seedance-2-5','seedance-2.5','apimodels-seedance-2-5-2026-09-30','time','USD',0,
   '{"480p":{"perSecond":"0.120"},"720p":{"perSecond":"0.270"}}'::jsonb,
   '{"text":{"multiplier":"1"},"image":{"multiplier":"1"}}'::jsonb,'{}'::jsonb,
   '{"authorization_only":true,"final_cost_authority":"apimodels_records_api","failed_requests_billable":false,"supported_modes":["generate","reference_image"]}'::jsonb,
   now() - interval '1 minute',now(),'APIMODELS Doubao Seedance 2.5','https://apimodels.app/docs/seedance-2-5',
   '{"verified_on":"2026-09-30","billing_basis":"upstream_generation_tokens","documented_per_second_rates":true}'::jsonb,'verified',true),
  ('apimodels','seedance-2-0','seedance-2.0-official','apimodels-seedance-2-0-official-2026-09-30','time','USD',0,
   '{"480p":{"perSecond":"0.092"},"720p":{"perSecond":"0.197"},"1080p":{"perSecond":"0.492"}}'::jsonb,
   '{"text":{"multiplier":"1"},"image":{"multiplier":"1"}}'::jsonb,'{}'::jsonb,
   '{"authorization_only":true,"final_cost_authority":"apimodels_records_api","failed_requests_billable":false,"supported_modes":["generate","reference_image"]}'::jsonb,
   now() - interval '1 minute',now(),'APIMODELS Seedance 2.0 Official','https://apimodels.app/docs/seedance-2-0-official',
   '{"verified_on":"2026-09-30","billing_basis":"upstream_generation_tokens"}'::jsonb,'verified',true),
  ('apimodels','seedance-2-0-fast','seedance-2.0-fast-official','apimodels-seedance-2-0-fast-official-2026-09-30','time','USD',0,
   '{"480p":{"perSecond":"0.071"},"720p":{"perSecond":"0.153"}}'::jsonb,
   '{"text":{"multiplier":"1"},"image":{"multiplier":"1"}}'::jsonb,'{}'::jsonb,
   '{"authorization_only":true,"final_cost_authority":"apimodels_records_api","failed_requests_billable":false,"supported_modes":["generate","reference_image"]}'::jsonb,
   now() - interval '1 minute',now(),'APIMODELS Seedance 2.0 Fast Official','https://apimodels.app/docs/seedance-2-0-official',
   '{"verified_on":"2026-09-30","billing_basis":"upstream_generation_tokens"}'::jsonb,'verified',true),
  ('apimodels','seedance-2-0-mini','seedance-2.0-mini-official','apimodels-seedance-2-0-mini-official-2026-09-30','time','USD',0,
   '{"480p":{"perSecond":"0.044"},"720p":{"perSecond":"0.095"}}'::jsonb,
   '{"text":{"multiplier":"1"},"image":{"multiplier":"1"}}'::jsonb,'{}'::jsonb,
   '{"authorization_only":true,"final_cost_authority":"apimodels_records_api","failed_requests_billable":false,"supported_modes":["generate","reference_image"]}'::jsonb,
   now() - interval '1 minute',now(),'APIMODELS Seedance 2.0 Mini Official','https://apimodels.app/docs/seedance-2-0-official',
   '{"verified_on":"2026-09-30","billing_basis":"upstream_generation_tokens"}'::jsonb,'verified',true),
  ('apimodels','ltx-2-3','ltx-2.3','apimodels-ltx-2-3-2026-09-30','time','USD',0,
   '{"480p":{"perSecond":"0.02"},"720p":{"perSecond":"0.04"},"1080p":{"perSecond":"0.045"}}'::jsonb,
   '{"text":{"multiplier":"1"},"image":{"multiplier":"1"}}'::jsonb,'{}'::jsonb,
   '{"authorization_only":true,"final_cost_authority":"apimodels_records_api","failed_requests_billable":false,"supported_modes":["generate","first_frame"]}'::jsonb,
   now() - interval '1 minute',now(),'APIMODELS LTX-2.3','https://apimodels.app/docs/ltx-2-3',
   '{"verified_on":"2026-09-30","billing_basis":"resolution_per_output_second"}'::jsonb,'verified',true),
  ('apimodels','wan-3-0-video','wan-3.0-video','apimodels-wan-3-0-standard-2026-09-30','time','USD',0,
   '{"480p":{"perSecond":"0.045"},"720p":{"perSecond":"0.09"},"1080p":{"perSecond":"0.18"}}'::jsonb,
   '{"text":{"multiplier":"1"},"image":{"multiplier":"1"}}'::jsonb,'{}'::jsonb,
   '{"authorization_only":true,"final_cost_authority":"apimodels_records_api","failed_requests_billable":false,"supported_modes":["standard","reference_image"],"prime_blocked":true,"reference_video_blocked":true}'::jsonb,
   now() - interval '1 minute',now(),'APIMODELS Wan 3.0 Video','https://apimodels.app/docs/wan-3-0-video',
   '{"verified_on":"2026-09-30","billing_basis":"resolution_per_output_second","tier":"standard"}'::jsonb,'verified',true)
on conflict (provider_key, model_id, upstream_model, pricing_version) do nothing;

update public.models set ui_schema = case id
  when 'seedance-2-5' then '{"inputModes":["text","image"],"durationOptions":[4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30],"resolutionOptions":["480p","720p"],"aspectRatios":["adaptive","21:9","16:9","4:3","1:1","3:4","9:16"],"maxReferences":10}'::jsonb
  when 'seedance-2-0' then '{"inputModes":["text","image"],"durationOptions":[4,5,6,7,8,9,10,11,12,13,14,15],"resolutionOptions":["480p","720p","1080p"],"aspectRatios":["adaptive","21:9","16:9","4:3","1:1","3:4","9:16"],"maxReferences":9}'::jsonb
  when 'seedance-2-0-fast' then '{"inputModes":["text","image"],"durationOptions":[4,5,6,7,8,9,10,11,12,13,14,15],"resolutionOptions":["480p","720p"],"aspectRatios":["adaptive","21:9","16:9","4:3","1:1","3:4","9:16"],"maxReferences":9}'::jsonb
  when 'seedance-2-0-mini' then '{"inputModes":["text","image"],"durationOptions":[4,5,6,7,8,9,10,11,12,13,14,15],"resolutionOptions":["480p","720p"],"aspectRatios":["adaptive","21:9","16:9","4:3","1:1","3:4","9:16"],"maxReferences":9}'::jsonb
  when 'ltx-2-3' then '{"inputModes":["text","image"],"durationOptions":[5,6,7,8,9,10,11,12,13,14,15],"resolutionOptions":["480p","720p","1080p"],"aspectRatios":["16:9","9:16"],"maxReferences":1}'::jsonb
  when 'wan-3-0-video' then '{"inputModes":["text","image"],"durationOptions":[2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30],"resolutionOptions":["480p","720p","1080p"],"aspectRatios":["adaptive","16:9","4:3","1:1","3:4","9:16"],"maxReferences":10}'::jsonb
  else ui_schema end
where id in ('seedance-2-5','seedance-2-0','seedance-2-0-fast','seedance-2-0-mini','ltx-2-3','wan-3-0-video');

update public.billing_authorization_policies
set active = false, effective_until = case when effective_until is null or effective_until > now() then now() else effective_until end
where active and modality = 'video'
  and model_id in ('seedance-2-5','seedance-2-0','seedance-2-0-fast','seedance-2-0-mini','ltx-2-3','wan-3-0-video');

with policy(model_id, upstream_model, maximum_provider_cost_usd, constraints, pricing_version, source_url) as (
  values
    ('seedance-2-5','seedance-2.5',8.100::numeric,'{"maxCharacters":"20000","maxSeconds":"30","maxOutputDuration":"30","maxImages":"1","maxReferences":"10","allowedResolutions":["480p","720p"],"allowedInputTypes":["text","image"],"allowedAspectRatios":["adaptive","21:9","16:9","4:3","1:1","3:4","9:16"]}'::jsonb,'apimodels-seedance-2-5-2026-09-30','https://apimodels.app/docs/seedance-2-5'),
    ('seedance-2-0','seedance-2.0-official',7.380::numeric,'{"maxCharacters":"20000","maxSeconds":"15","maxOutputDuration":"15","maxImages":"1","maxReferences":"9","allowedResolutions":["480p","720p","1080p"],"allowedInputTypes":["text","image"],"allowedAspectRatios":["adaptive","21:9","16:9","4:3","1:1","3:4","9:16"]}'::jsonb,'apimodels-seedance-2-0-official-2026-09-30','https://apimodels.app/docs/seedance-2-0-official'),
    ('seedance-2-0-fast','seedance-2.0-fast-official',2.295::numeric,'{"maxCharacters":"20000","maxSeconds":"15","maxOutputDuration":"15","maxImages":"1","maxReferences":"9","allowedResolutions":["480p","720p"],"allowedInputTypes":["text","image"],"allowedAspectRatios":["adaptive","21:9","16:9","4:3","1:1","3:4","9:16"]}'::jsonb,'apimodels-seedance-2-0-fast-official-2026-09-30','https://apimodels.app/docs/seedance-2-0-official'),
    ('seedance-2-0-mini','seedance-2.0-mini-official',1.425::numeric,'{"maxCharacters":"20000","maxSeconds":"15","maxOutputDuration":"15","maxImages":"1","maxReferences":"9","allowedResolutions":["480p","720p"],"allowedInputTypes":["text","image"],"allowedAspectRatios":["adaptive","21:9","16:9","4:3","1:1","3:4","9:16"]}'::jsonb,'apimodels-seedance-2-0-mini-official-2026-09-30','https://apimodels.app/docs/seedance-2-0-official'),
    ('ltx-2-3','ltx-2.3',0.675::numeric,'{"maxCharacters":"20000","maxSeconds":"15","maxOutputDuration":"15","maxImages":"1","maxReferences":"1","allowedResolutions":["480p","720p","1080p"],"allowedInputTypes":["text","image"],"allowedAspectRatios":["16:9","9:16"]}'::jsonb,'apimodels-ltx-2-3-2026-09-30','https://apimodels.app/docs/ltx-2-3'),
    ('wan-3-0-video','wan-3.0-video',5.400::numeric,'{"maxCharacters":"20000","maxSeconds":"30","maxOutputDuration":"30","maxImages":"1","maxReferences":"10","allowedResolutions":["480p","720p","1080p"],"allowedInputTypes":["text","image"],"allowedAspectRatios":["adaptive","16:9","4:3","1:1","3:4","9:16"]}'::jsonb,'apimodels-wan-3-0-standard-2026-09-30','https://apimodels.app/docs/wan-3-0-video')
), settings as (
  select (select (value #>> '{}')::numeric from public.system_settings where key = 'internal_usd_pkr') as fx,
         (select (value #>> '{}')::numeric from public.system_settings where key = 'billing_v2_wallet_reservation_quantum_credits') as quantum
)
insert into public.billing_authorization_policies (
  provider_key, model_id, upstream_model, modality, policy_version, maximum_provider_cost_usd,
  maximum_authorization_credits, fx_rate_snapshot, markup_snapshot, request_constraints, metadata,
  effective_from, effective_until, active
)
select 'apimodels',p.model_id,p.upstream_model,'video','billing-v3-auth-2026-09-30-video-verified',p.maximum_provider_cost_usd,
  ceil((p.maximum_provider_cost_usd * s.fx * m.markup) / s.quantum) * s.quantum,s.fx,m.markup,p.constraints,
  jsonb_build_object('authorization_only',true,'derived_from_verified_pricing_version',p.pricing_version,
    'final_cost_authority','apimodels_records_api','execution_strategy','apimodels_video_async',
    'failed_pre_acceptance_billable',false,'source_url',p.source_url),now(),null,true
from policy p join public.models m on m.id=p.model_id and m.active
join public.provider_models route on route.provider_key='apimodels' and route.model_id=p.model_id and route.upstream_model=p.upstream_model and route.active
cross join settings s where s.fx > 0 and s.quantum > 0
on conflict (provider_key, model_id, upstream_model, modality, policy_version) do nothing;

do $$
declare v_policies integer; v_rules integer;
begin
  select count(*) into v_policies from public.billing_authorization_policies
    where active and policy_version='billing-v3-auth-2026-09-30-video-verified';
  select count(*) into v_rules from public.provider_pricing_rules
    where active and status='verified' and provider_key='apimodels'
      and pricing_version in ('apimodels-seedance-2-5-2026-09-30','apimodels-seedance-2-0-official-2026-09-30','apimodels-seedance-2-0-fast-official-2026-09-30','apimodels-seedance-2-0-mini-official-2026-09-30','apimodels-ltx-2-3-2026-09-30','apimodels-wan-3-0-standard-2026-09-30');
  if v_policies <> 6 or v_rules <> 6 then
    raise exception 'Expected six verified video policies and pricing rules; found policies %, rules %', v_policies, v_rules;
  end if;
end $$;
