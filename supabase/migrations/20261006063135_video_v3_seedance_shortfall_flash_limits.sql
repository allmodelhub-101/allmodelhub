-- This is deliberately a forward repair: the first Video V3 migration may
-- already be applied. Keep its historical pricing snapshots intact.

-- A V3 shortfall is terminal and must never leave the customer's wallet hold
-- reserved. Preserve the old implementation for the normal settlement path
-- and intercept only the terminal, non-chargeable outcome here.
alter function public.billing_v3_settle_provider_record(uuid, jsonb, uuid, uuid, jsonb)
  rename to billing_v3_settle_provider_record_pre_shortfall_repair;

create function public.billing_v3_settle_provider_record(
  p_provider_billing_record_id uuid,
  p_usage jsonb default '{}'::jsonb,
  p_message_id uuid default null,
  p_generation_job_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_record public.provider_billing_records%rowtype;
  v_quote public.billing_quotes%rowtype;
  v_existing public.billing_receipts%rowtype;
  v_quantum numeric;
  v_charge numeric;
begin
  if jsonb_typeof(p_usage) <> 'object' or jsonb_typeof(p_metadata) <> 'object' then
    raise exception 'BILLING_V3_SETTLEMENT_INVALID';
  end if;
  select * into v_record from public.provider_billing_records where id = p_provider_billing_record_id for update;
  if not found then raise exception 'BILLING_V3_PROVIDER_RECORD_NOT_FOUND'; end if;

  -- A previous invocation already recorded and released this terminal state.
  -- Return before quote validation so replayed callback/poll/reconcile calls
  -- remain idempotent after the quote is cancelled.
  if v_record.reconciliation_status = 'authorization_shortfall' then
    return jsonb_build_object('status', 'authorization_shortfall');
  end if;
  select * into v_existing from public.billing_receipts where quote_id = v_record.quote_id;
  if found then
    return public.billing_v3_settle_provider_record_pre_shortfall_repair(
      p_provider_billing_record_id, p_usage, p_message_id, p_generation_job_id, p_metadata);
  end if;
  select * into v_quote from public.billing_quotes where id = v_record.quote_id for update;
  if not found or v_quote.billing_engine <> 'v3_provider_authoritative'
    or v_quote.status <> 'accepted' or v_quote.wallet_hold_id is null
    or not v_record.settled or v_record.state <> 'completed'
    or v_record.credits_usd is null or v_record.currency <> 'USD' then
    return public.billing_v3_settle_provider_record_pre_shortfall_repair(
      p_provider_billing_record_id, p_usage, p_message_id, p_generation_job_id, p_metadata);
  end if;
  if exists(select 1 from public.billing_authorization_policies where id = v_quote.authorization_policy_id and modality = 'video')
    and v_record.source not in ('records_api', 'reconciliation') then
    return public.billing_v3_settle_provider_record_pre_shortfall_repair(
      p_provider_billing_record_id, p_usage, p_message_id, p_generation_job_id, p_metadata);
  end if;
  select (value #>> '{}')::numeric into v_quantum from public.system_settings
    where key = 'billing_wallet_reservation_quantum_credits';
  v_quantum := coalesce((v_quote.pricing_snapshot ->> 'reservationQuantumCredits')::numeric, v_quantum);
  if v_quantum is null or v_quantum <= 0 then
    return public.billing_v3_settle_provider_record_pre_shortfall_repair(
      p_provider_billing_record_id, p_usage, p_message_id, p_generation_job_id, p_metadata);
  end if;
  v_charge := case when v_record.credits_usd = 0 then 0 else ceil(
    (v_record.credits_usd * v_quote.internal_usd_pkr_rate * v_quote.frozen_markup) / v_quantum
  ) * v_quantum end;
  if v_charge <= v_quote.reservation_credits then
    return public.billing_v3_settle_provider_record_pre_shortfall_repair(
      p_provider_billing_record_id, p_usage, p_message_id, p_generation_job_id, p_metadata);
  end if;

  if not exists(select 1 from public.billing_anomalies where quote_id = v_quote.id and anomaly_type = 'authorization_shortfall') then
    insert into public.billing_anomalies (
      user_id, quote_id, request_idempotency_id, provider_key, model_id, upstream_model,
      anomaly_type, expected_cost_usd, observed_cost_usd, severity, details
    ) values (
      v_quote.user_id, v_quote.id, v_quote.request_idempotency_id, v_quote.provider_key,
      v_quote.model_id, v_quote.upstream_model, 'authorization_shortfall',
      v_quote.reservation_credits / v_quote.internal_usd_pkr_rate,
      v_charge / v_quote.internal_usd_pkr_rate, 'critical',
      jsonb_build_object('authorization_credits', v_quote.reservation_credits::text,
        'required_charge_credits', v_charge::text, 'provider_cost_usd', v_record.credits_usd::text,
        'customer_was_not_charged', true, 'wallet_hold_released', true)
    );
  end if;
  -- release_wallet_hold atomically changes only an active hold and decrements
  -- reserved_balance once. No capture/transaction/receipt is created.
  perform public.release_wallet_hold(v_quote.wallet_hold_id, 'authorization_shortfall');
  update public.billing_quotes set status = 'cancelled', updated_at = clock_timestamp() where id = v_quote.id;
  update public.provider_billing_records set reconciliation_status = 'authorization_shortfall',
    next_reconcile_at = null, updated_at = clock_timestamp() where id = v_record.id;
  update public.billing_authorization_policies set active = false, updated_at = clock_timestamp()
    where id = v_quote.authorization_policy_id;
  return jsonb_build_object('status', 'authorization_shortfall',
    'authorization_credits', v_quote.reservation_credits::text,
    'required_charge_credits', v_charge::text);
end;
$function$;

revoke all on function public.billing_v3_settle_provider_record(uuid,jsonb,uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.billing_v3_settle_provider_record(uuid,jsonb,uuid,uuid,jsonb) to service_role;

-- Replace the over-wide FlashVSR policy with the documented 120s source limit.
update public.billing_authorization_policies set active = false, effective_until = now(), updated_at = clock_timestamp()
where provider_key = 'apimodels' and model_id = 'flashvsr' and modality = 'video' and active;
update public.billing_authorization_policies set active = false, effective_until = now(), updated_at = clock_timestamp()
where provider_key = 'apimodels' and model_id in ('seedance-2-0','seedance-2-0-fast','seedance-2-0-mini','seedance-2-5')
  and modality = 'video' and active;

with definitions(model_id, upstream_model, ceiling, constraints, resolution_rates, input_type_rates, source_url) as (values
  ('flashvsr', 'flashvsr', 7.2::numeric,
    '{"maxCharacters":"20000","maxSeconds":"120","maxOutputDuration":"120","maxInputDuration":"120","maxReferences":"0","maxImages":"0","allowedResolutions":["720p","1080p","2K","4K"],"allowedInputTypes":["video"],"allowedAspectRatios":[]}'::jsonb,
    '{"720p":{"perSecond":"0.020"},"1080p":{"perSecond":"0.030"},"2K":{"perSecond":"0.035"},"4K":{"perSecond":"0.060"}}'::jsonb, '{}'::jsonb, 'https://apimodels.app/docs/flashvsr'),
  ('seedance-2-0', 'seedance-2.0', 7.38::numeric,
    '{"maxCharacters":"20000","maxSeconds":"15","maxOutputDuration":"15","maxInputDuration":"15","maxReferences":"9","maxImages":"9","allowedResolutions":["480p","720p","1080p"],"allowedInputTypes":["text","image","video","audio"],"allowedAspectRatios":["adaptive","16:9","4:3","1:1","3:4","9:16","21:9"],"allowedNativeAudio":[false,true]}'::jsonb,
    '{"480p":{"perSecond":"0.092"},"720p":{"perSecond":"0.197"},"1080p":{"perSecond":"0.492"}}'::jsonb, '{}'::jsonb, 'https://apimodels.app/docs/seedance-2-0-official'),
  ('seedance-2-0-fast', 'seedance-2.0-fast', 2.295::numeric,
    '{"maxCharacters":"20000","maxSeconds":"15","maxOutputDuration":"15","maxInputDuration":"15","maxReferences":"9","maxImages":"9","allowedResolutions":["480p","720p"],"allowedInputTypes":["text","image","video","audio"],"allowedAspectRatios":["adaptive","16:9","4:3","1:1","3:4","9:16","21:9"],"allowedNativeAudio":[false,true]}'::jsonb,
    '{"480p":{"perSecond":"0.071"},"720p":{"perSecond":"0.153"}}'::jsonb, '{}'::jsonb, 'https://apimodels.app/docs/seedance-2-0-official'),
  ('seedance-2-0-mini', 'seedance-2.0-mini', 1.425::numeric,
    '{"maxCharacters":"20000","maxSeconds":"15","maxOutputDuration":"15","maxInputDuration":"15","maxReferences":"9","maxImages":"9","allowedResolutions":["480p","720p"],"allowedInputTypes":["text","image","video","audio"],"allowedAspectRatios":["adaptive","16:9","4:3","1:1","3:4","9:16","21:9"],"allowedNativeAudio":[false,true]}'::jsonb,
    '{"480p":{"perSecond":"0.044"},"720p":{"perSecond":"0.095"}}'::jsonb, '{}'::jsonb, 'https://apimodels.app/docs/seedance-2-0-official'),
  ('seedance-2-5', 'seedance-2.5', 9.72::numeric,
    '{"maxCharacters":"20000","maxSeconds":"60","maxOutputDuration":"30","maxInputDuration":"30","maxReferences":"30","maxImages":"30","allowedResolutions":["480p","720p"],"allowedInputTypes":["text","image","video","audio"],"allowedAspectRatios":["adaptive","16:9","4:3","1:1","3:4","9:16","21:9"],"allowedNativeAudio":[false,true]}'::jsonb,
    '{"480p":{"perSecond":"0.120"},"720p":{"perSecond":"0.270"}}'::jsonb,
    '{"text":{"multiplier":"1"},"image":{"multiplier":"1"},"audio":{"multiplier":"1"},"video":{"multiplier":"0.6"}}'::jsonb, 'https://apimodels.app/docs/seedance-2-5')
), settings as (
  select (select (value #>> '{}')::numeric from public.system_settings where key = 'internal_usd_pkr') fx,
    (select (value #>> '{}')::numeric from public.system_settings where key = 'billing_wallet_reservation_quantum_credits') quantum
)
insert into public.billing_authorization_policies (
  provider_key, model_id, upstream_model, modality, policy_version, maximum_provider_cost_usd,
  maximum_authorization_credits, fx_rate_snapshot, markup_snapshot, request_constraints, metadata, effective_from, active
)
select 'apimodels', d.model_id, d.upstream_model, 'video', 'billing-v3-video-runtime-2026-10-06-seedance-flash',
  d.ceiling, ceil(d.ceiling * s.fx * m.markup / s.quantum) * s.quantum, s.fx, m.markup, d.constraints,
  jsonb_build_object(
    'derived_from_verified_pricing_version', 'apimodels-video-v3-2026-10-06-seedance-flash',
    'media_authorization_pricing', jsonb_build_object(
      'id', 'v3-' || d.model_id, 'provider_key', 'apimodels', 'model_id', d.model_id, 'upstream_model', d.upstream_model,
      'pricing_version', 'apimodels-video-v3-2026-10-06-seedance-flash', 'billing_type', 'time', 'currency', 'USD',
      'input_token_price', null, 'output_token_price', null, 'cached_token_price', null, 'cache_write_token_price', null,
      'flat_price', '0', 'per_image_price', null, 'per_second_price', null, 'per_minute_price', null,
      'per_1k_character_price', null, 'per_reference_image_price', null, 'resolution_dimensions', d.resolution_rates,
      'quality_dimensions', '{}'::jsonb, 'mode_dimensions', '{}'::jsonb, 'input_type_dimensions', d.input_type_rates,
      'formula', '{}'::jsonb, 'metadata', jsonb_build_object('authorization_only', true, 'estimate_kind', 'published_derived_per_second_ceiling'),
      'effective_from', '2026-10-06T00:00:00Z', 'effective_until', null, 'verified_at', '2026-10-06T00:00:00Z',
      'source_name', 'APIMODELS current video documentation', 'source_url', d.source_url,
      'source_metadata', jsonb_build_object('authorization_estimate_only', true, 'final_provider_price', 'APIMODELS records API credits'),
      'status', 'verified', 'active', true),
    'authorization_estimate', 'published derived per-second authorization ceiling; never final provider price',
    'final_cost_authority', 'apimodels_records_api', 'execution_strategy', 'apimodels_video_async', 'source_url', d.source_url), now(), true
from definitions d join public.models m on m.id = d.model_id and m.active cross join settings s
where s.fx > 0 and s.quantum > 0
on conflict (provider_key, model_id, upstream_model, modality, policy_version) do nothing;
