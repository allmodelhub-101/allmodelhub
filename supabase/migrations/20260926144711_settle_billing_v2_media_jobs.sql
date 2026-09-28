create function public.billing_complete_media_quote(
  p_job_id uuid, p_usage jsonb, p_provider_request_id text,
  p_provider_reported_cost numeric, p_provider_reported_currency text,
  p_calculated_provider_cost_usd numeric, p_final_provider_cost_usd numeric,
  p_charge_credits numeric, p_cost_status text, p_raw_usage jsonb,
  p_usage_snapshot jsonb, p_result_json jsonb, p_result_urls jsonb,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security invoker set search_path = ''
as $function$
declare
  v_job public.generation_jobs%rowtype;
  v_result jsonb;
begin
  select * into v_job from public.generation_jobs where id = p_job_id for update;
  if not found or v_job.billing_quote_id is null then raise exception 'BILLING_MEDIA_JOB_NOT_SETTLEABLE'; end if;
  select jsonb_build_object('receipt_id', r.id, 'usage_event_id', r.usage_event_id,
    'wallet_transaction_id', r.wallet_transaction_id, 'charge_credits', r.charge_credits::text)
    into v_result from public.billing_receipts r where r.generation_job_id = v_job.id;
  if v_result is not null then return v_result; end if;
  if v_job.status <> 'settling' then raise exception 'BILLING_MEDIA_JOB_NOT_SETTLING'; end if;

  v_result := public.billing_settle_usage_quote(
    v_job.billing_quote_id, 'billing-v2-media-capture:' || v_job.id::text,
    'billing-v2-media-usage:' || v_job.id::text, p_usage, p_provider_request_id,
    v_job.provider_task_id, p_provider_reported_cost, p_provider_reported_currency,
    p_calculated_provider_cost_usd, p_final_provider_cost_usd, p_charge_credits,
    p_cost_status, null, v_job.id, p_raw_usage, p_usage_snapshot,
    p_metadata || jsonb_build_object('billing_v2', true, 'operation', v_job.modality::text || '_generation')
  );
  update public.generation_jobs set status = 'completed', charged_credits = p_charge_credits,
    result_json = p_result_json, result_urls = p_result_urls, completed_at = clock_timestamp(),
    updated_at = clock_timestamp(), error_message = null where id = v_job.id;
  return v_result;
end;
$function$;

create function public.billing_fail_media_quote(
  p_job_id uuid, p_provider_state text, p_error_message text,
  p_raw_usage jsonb default '{}'::jsonb, p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security invoker set search_path = ''
as $function$
declare
  v_job public.generation_jobs%rowtype;
  v_quote public.billing_quotes%rowtype;
  v_existing public.billing_receipts%rowtype;
  v_usage_id uuid;
  v_receipt_id uuid;
  v_status public.job_status;
begin
  if p_provider_state not in ('failed', 'cancelled', 'expired')
    or jsonb_typeof(p_raw_usage) <> 'object' or jsonb_typeof(p_metadata) <> 'object'
  then raise exception 'BILLING_MEDIA_FAILURE_INVALID'; end if;
  v_status := p_provider_state::public.job_status;
  select * into v_job from public.generation_jobs where id = p_job_id for update;
  if not found or v_job.billing_quote_id is null then raise exception 'BILLING_MEDIA_JOB_NOT_SETTLEABLE'; end if;
  select * into v_existing from public.billing_receipts where quote_id = v_job.billing_quote_id;
  if found then return jsonb_build_object('receipt_id', v_existing.id, 'usage_event_id', v_existing.usage_event_id,
    'wallet_transaction_id', v_existing.wallet_transaction_id, 'charge_credits', v_existing.charge_credits::text);
  end if;
  select * into v_quote from public.billing_quotes where id = v_job.billing_quote_id for update;
  if not found or v_quote.status <> 'accepted' or v_quote.wallet_hold_id is null then raise exception 'BILLING_MEDIA_QUOTE_NOT_ACCEPTED'; end if;
  perform public.release_wallet_hold(v_quote.wallet_hold_id, 'provider_' || p_provider_state);
  insert into public.billing_usage_events (
    idempotency_key, user_id, quote_id, provider_key, model_id, upstream_model,
    provider_task_id, dimensions, raw_usage, cost_status, occurred_at
  ) values (
    'billing-v2-media-failure-usage:' || v_job.id::text, v_quote.user_id, v_quote.id,
    v_quote.provider_key, v_quote.model_id, v_quote.upstream_model, v_job.provider_task_id,
    coalesce(v_quote.input_dimensions -> 'estimatedUsage' -> 'dimensions', '{}'::jsonb), p_raw_usage,
    'usage_calculated', clock_timestamp()
  ) returning id into v_usage_id;
  insert into public.billing_receipts (
    user_id, quote_id, usage_event_id, provider_key, model_id, upstream_model,
    pricing_version, cost_status, provider_cost_usd, internal_usd_pkr_rate,
    provider_cost_pkr, charge_credits, markup, profit_pkr, margin_percent,
    wallet_transaction_id, generation_job_id, request_idempotency_id,
    usage_snapshot, pricing_snapshot, metadata, settled_at
  ) values (
    v_quote.user_id, v_quote.id, v_usage_id, v_quote.provider_key, v_quote.model_id,
    v_quote.upstream_model, v_quote.pricing_version, 'usage_calculated', 0,
    v_quote.internal_usd_pkr_rate, 0, 0, (v_quote.pricing_snapshot ->> 'markup')::numeric,
    0, null, null, v_job.id, v_quote.request_idempotency_id,
    jsonb_build_object('source', 'provider_terminal_failure', 'providerTaskId', v_job.provider_task_id),
    v_quote.pricing_snapshot, p_metadata || jsonb_build_object('billing_v2', true,
      'provider_state', p_provider_state, 'non_billable_failure', true), clock_timestamp()
  ) returning id into v_receipt_id;
  update public.billing_quotes set status = 'settled', updated_at = clock_timestamp() where id = v_quote.id;
  update public.generation_jobs set status = v_status, charged_credits = 0,
    error_message = left(coalesce(p_error_message, 'Generation failed'), 1000),
    result_json = p_raw_usage, updated_at = clock_timestamp() where id = v_job.id;
  return jsonb_build_object('receipt_id', v_receipt_id, 'usage_event_id', v_usage_id,
    'wallet_transaction_id', null, 'charge_credits', '0', 'provider_cost_usd', '0');
end;
$function$;

revoke all on function public.billing_complete_media_quote(uuid,jsonb,text,numeric,text,numeric,numeric,numeric,text,jsonb,jsonb,jsonb,jsonb,jsonb) from public, anon, authenticated;
revoke all on function public.billing_fail_media_quote(uuid,text,text,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.billing_complete_media_quote(uuid,jsonb,text,numeric,text,numeric,numeric,numeric,text,jsonb,jsonb,jsonb,jsonb,jsonb) to service_role;
grant execute on function public.billing_fail_media_quote(uuid,text,text,jsonb,jsonb) to service_role;
comment on function public.billing_complete_media_quote(uuid,jsonb,text,numeric,text,numeric,numeric,numeric,text,jsonb,jsonb,jsonb,jsonb,jsonb)
  is 'Idempotently settles one media quote and completes its generation job in the same transaction.';
comment on function public.billing_fail_media_quote(uuid,text,text,jsonb,jsonb)
  is 'Idempotently releases a non-billable failed media reservation and records immutable zero-cost usage and receipt rows.';
