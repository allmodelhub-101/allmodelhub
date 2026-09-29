-- Version the audio execution contracts independently from final settlement.
-- Unsupported specialized workflows retain their catalog rows but are gated by
-- the server execution-contract registry.

with retired as (
  update public.billing_authorization_policies
  set active = false,
      effective_until = case when effective_until is null or effective_until > now() then now() else effective_until end
  where active and modality = 'audio'
    and model_id in ('eleven-tts-flash','eleven-tts-multilingual','eleven-tts-v3','kling-tts','kling-sound-effects','suno-v5')
    and policy_version <> 'billing-v3-auth-2026-09-29-audio-runtime'
  returning provider_key, model_id, upstream_model, modality,
    maximum_provider_cost_usd, maximum_authorization_credits, fx_rate_snapshot,
    markup_snapshot, request_constraints, metadata
)
insert into public.billing_authorization_policies (
  provider_key, model_id, upstream_model, modality, policy_version,
  maximum_provider_cost_usd, maximum_authorization_credits, fx_rate_snapshot,
  markup_snapshot, request_constraints, metadata, effective_from, effective_until, active
)
select provider_key, model_id, upstream_model, modality,
  'billing-v3-auth-2026-09-29-audio-runtime',
  maximum_provider_cost_usd, maximum_authorization_credits, fx_rate_snapshot,
  markup_snapshot,
  case when model_id = 'kling-tts' then '{"maxCharacters":"1000"}'::jsonb else request_constraints end,
  metadata || jsonb_build_object(
    'execution_strategy', case when model_id like 'eleven-tts-%' then 'apimodels_eleven_stream' else 'apimodels_audio_async' end,
    'provider_acceptance_required', true,
    'failed_pre_acceptance_billable', false
  ),
  now(), null, true
from retired
on conflict (provider_key, model_id, upstream_model, modality, policy_version) do nothing;

update public.models set ui_schema = case id
  when 'eleven-tts-flash' then '{"inputModes":["text"],"maxReferences":0}'::jsonb
  when 'eleven-tts-multilingual' then '{"inputModes":["text"],"maxReferences":0}'::jsonb
  when 'eleven-tts-v3' then '{"inputModes":["text"],"maxReferences":0}'::jsonb
  when 'kling-tts' then '{"inputModes":["text"],"maxReferences":0}'::jsonb
  when 'kling-sound-effects' then '{"inputModes":["text"],"durationOptions":[3,4,5,6,7,8,9,10],"audioModes":["sfx"],"maxReferences":0}'::jsonb
  when 'suno-v5' then '{"inputModes":["text"],"audioModes":["music"],"maxReferences":0}'::jsonb
  else ui_schema end
where id in ('eleven-tts-flash','eleven-tts-multilingual','eleven-tts-v3','kling-tts','kling-sound-effects','suno-v5');

do $$
declare v_versioned integer; v_active integer;
begin
  select count(*) into v_versioned from public.billing_authorization_policies
  where policy_version = 'billing-v3-auth-2026-09-29-audio-runtime' and active;
  select count(*) into v_active from public.billing_authorization_policies
  where modality = 'audio' and active;
  if v_versioned <> 6 or v_active <> 11 then
    raise exception 'Audio repair expected 6 executable versioned and 11 total active policies; found % and %', v_versioned, v_active;
  end if;
end $$;
