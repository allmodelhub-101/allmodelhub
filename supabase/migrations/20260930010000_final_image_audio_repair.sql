-- Final Image/Audio runtime contracts. These prices size temporary wallet
-- authorizations only. APIMODELS /v1/records remains final cost authority.

insert into public.provider_pricing_rules (
  provider_key, model_id, upstream_model, pricing_version, billing_type, currency,
  per_image_price, resolution_dimensions, quality_dimensions, formula, metadata,
  effective_from, verified_at, source_name, source_url, source_metadata, status, active
)
values
  ('apimodels','gemini-3-1-flash-image','gemini-3.1-flash-image','apimodels-gemini-image-2026-09-30','image','USD',0,
   '{"512":{"perImage":"0.04"},"1K":{"perImage":"0.06"},"2K":{"perImage":"0.06"},"4K":{"perImage":"0.10"}}','{}','{}',
   '{"authorization_only":true}','2026-09-30T00:00:00Z',now(),'APIMODELS Gemini Image','https://apimodels.app/docs/gemini-image','{"verified_by":"final-image-audio-repair"}','verified',true),
  ('apimodels','gemini-3-pro-image','gemini-3-pro-image','apimodels-gemini-image-2026-09-30','image','USD',0,
   '{"1K":{"perImage":"0.10"},"2K":{"perImage":"0.10"},"4K":{"perImage":"0.15"}}','{}','{}',
   '{"authorization_only":true}','2026-09-30T00:00:00Z',now(),'APIMODELS Gemini Image','https://apimodels.app/docs/gemini-image','{"verified_by":"final-image-audio-repair"}','verified',true),
  ('apimodels','gpt-image-2-5-flare','gpt-image-2.5-flare','apimodels-gpt-image-2-5-2026-09-30','image','USD',null,
   '{}','{}','{"kind":"option_matrix","dimensionKeys":["resolution","quality"],"values":{"1K|medium":"0.020","2K|medium":"0.025","4K|medium":"0.045"}}',
   '{"authorization_only":true,"verified_configuration":"quality=medium"}','2026-09-30T00:00:00Z',now(),'APIMODELS GPT Image 2.5','https://apimodels.app/docs/gpt-image-2-5','{"verified_by":"final-image-audio-repair"}','verified',true),
  ('apimodels','gpt-image-2-5-sunburst','gpt-image-2.5-sunburst','apimodels-gpt-image-2-5-2026-09-30','image','USD',null,
   '{}','{}','{"kind":"option_matrix","dimensionKeys":["resolution","quality"],"values":{"1K|high":"0.03","2K|high":"0.04","4K|high":"0.08"}}',
   '{"authorization_only":true,"verified_configuration":"quality=high"}','2026-09-30T00:00:00Z',now(),'APIMODELS GPT Image 2.5','https://apimodels.app/docs/gpt-image-2-5','{"verified_by":"final-image-audio-repair"}','verified',true)
on conflict (provider_key,model_id,upstream_model,pricing_version) do nothing;

with policy(model_id,upstream_model,maximum_provider_cost_usd,constraints,source_version,source_url) as (
  values
    ('gemini-3-1-flash-image','gemini-3.1-flash-image',0.10::numeric,'{"maxCharacters":"20000","maxImages":"1","maxReferences":"5","allowedResolutions":["512","1K","2K","4K"],"allowedInputTypes":["text","image"],"allowedAspectRatios":["auto","1:1","16:9","9:16","4:3","3:4","3:2","2:3"]}'::jsonb,'apimodels-gemini-image-2026-09-30','https://apimodels.app/docs/gemini-image'),
    ('gemini-3-pro-image','gemini-3-pro-image',0.15::numeric,'{"maxCharacters":"20000","maxImages":"1","maxReferences":"5","allowedResolutions":["1K","2K","4K"],"allowedInputTypes":["text","image"],"allowedAspectRatios":["auto","1:1","16:9","9:16","4:3","3:4","3:2","2:3"]}'::jsonb,'apimodels-gemini-image-2026-09-30','https://apimodels.app/docs/gemini-image'),
    ('gpt-image-2-5-flare','gpt-image-2.5-flare',0.045::numeric,'{"maxCharacters":"20000","maxImages":"1","maxReferences":"16","allowedResolutions":["1K","2K","4K"],"allowedQualities":["medium"],"allowedInputTypes":["text","image"],"allowedAspectRatios":["1:1","16:9","9:16","4:3","3:4"]}'::jsonb,'apimodels-gpt-image-2-5-2026-09-30','https://apimodels.app/docs/gpt-image-2-5'),
    ('gpt-image-2-5-sunburst','gpt-image-2.5-sunburst',0.08::numeric,'{"maxCharacters":"20000","maxImages":"1","maxReferences":"16","allowedResolutions":["1K","2K","4K"],"allowedQualities":["high"],"allowedInputTypes":["text","image"],"allowedAspectRatios":["1:1","16:9","9:16","4:3","3:4"]}'::jsonb,'apimodels-gpt-image-2-5-2026-09-30','https://apimodels.app/docs/gpt-image-2-5')
), settings as (
  select (select (value #>> '{}')::numeric from public.system_settings where key='internal_usd_pkr') fx,
         (select (value #>> '{}')::numeric from public.system_settings where key='billing_v2_wallet_reservation_quantum_credits') quantum
)
insert into public.billing_authorization_policies (
  provider_key,model_id,upstream_model,modality,policy_version,maximum_provider_cost_usd,
  maximum_authorization_credits,fx_rate_snapshot,markup_snapshot,request_constraints,metadata,effective_from,active
)
select 'apimodels',p.model_id,p.upstream_model,'image','billing-v3-auth-2026-09-30-image-runtime',p.maximum_provider_cost_usd,
  ceil((p.maximum_provider_cost_usd*s.fx*m.markup)/s.quantum)*s.quantum,s.fx,m.markup,p.constraints,
  jsonb_build_object('authorization_only',true,'final_cost_authority','apimodels_records_api',
    'derived_from_verified_pricing_version',p.source_version,'source_url',p.source_url,'execution_strategy','apimodels_image_async'),
  now(),true
from policy p join public.models m on m.id=p.model_id
join public.provider_models r on r.provider_key='apimodels' and r.model_id=p.model_id and r.upstream_model=p.upstream_model and r.active
cross join settings s where s.fx>0 and s.quantum>0
on conflict (provider_key,model_id,upstream_model,modality,policy_version) do nothing;

update public.models set ui_schema=case id
  when 'gemini-3-1-flash-image' then '{"inputModes":["text","image"],"resolutionOptions":["512","1K","2K","4K"],"aspectRatios":["auto","1:1","16:9","9:16","4:3","3:4","3:2","2:3"],"maxReferences":5}'::jsonb
  when 'gemini-3-pro-image' then '{"inputModes":["text","image"],"resolutionOptions":["1K","2K","4K"],"aspectRatios":["auto","1:1","16:9","9:16","4:3","3:4","3:2","2:3"],"maxReferences":5}'::jsonb
  when 'gpt-image-2-5-flare' then '{"inputModes":["text","image"],"resolutionOptions":["1K","2K","4K"],"aspectRatios":["1:1","16:9","9:16","4:3","3:4"],"maxReferences":16}'::jsonb
  when 'gpt-image-2-5-sunburst' then '{"inputModes":["text","image"],"resolutionOptions":["1K","2K","4K"],"aspectRatios":["1:1","16:9","9:16","4:3","3:4"],"maxReferences":16}'::jsonb
  else ui_schema end
where id in ('gemini-3-1-flash-image','gemini-3-pro-image','gpt-image-2-5-flare','gpt-image-2-5-sunburst');

do $$ declare v_rules integer; v_policies integer;
begin
  select count(*) into v_rules from public.provider_pricing_rules where active and status='verified'
    and pricing_version in ('apimodels-gemini-image-2026-09-30','apimodels-gpt-image-2-5-2026-09-30');
  select count(*) into v_policies from public.billing_authorization_policies
    where active and policy_version='billing-v3-auth-2026-09-30-image-runtime';
  if v_rules<>4 or v_policies<>4 then raise exception 'Final image repair expected 4 rules and 4 policies; found % and %',v_rules,v_policies; end if;
end $$;
