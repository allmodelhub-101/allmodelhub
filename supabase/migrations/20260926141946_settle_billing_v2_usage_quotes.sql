create function public.billing_accept_quote(p_quote_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_quote public.billing_quotes%rowtype;
begin
  select * into v_quote from public.billing_quotes where id = p_quote_id for update;
  if not found then return false; end if;
  if v_quote.status = 'accepted' then return true; end if;
  if v_quote.status <> 'reserved' or v_quote.expires_at <= clock_timestamp() then return false; end if;
  update public.billing_quotes set status = 'accepted', updated_at = clock_timestamp() where id = p_quote_id;
  return true;
end;
$function$;

create function public.billing_cancel_quote_reservation(p_quote_id uuid, p_reason text default 'cancelled')
returns boolean
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_quote public.billing_quotes%rowtype;
begin
  select * into v_quote from public.billing_quotes where id = p_quote_id for update;
  if not found then return false; end if;
  if v_quote.status = 'cancelled' then return true; end if;
  if v_quote.status not in ('reserved', 'accepted') then return false; end if;
  if v_quote.wallet_hold_id is not null then
    perform public.release_wallet_hold(v_quote.wallet_hold_id, p_reason);
  end if;
  update public.billing_quotes set status = 'cancelled', updated_at = clock_timestamp() where id = p_quote_id;
  return true;
end;
$function$;

create function public.billing_settle_usage_quote(
  p_quote_id uuid,
  p_capture_idempotency_key text,
  p_usage_idempotency_key text,
  p_usage jsonb,
  p_provider_request_id text,
  p_provider_task_id text,
  p_provider_reported_cost numeric,
  p_provider_reported_currency text,
  p_calculated_provider_cost_usd numeric,
  p_final_provider_cost_usd numeric,
  p_charge_credits numeric,
  p_cost_status text,
  p_message_id uuid,
  p_generation_job_id uuid,
  p_raw_usage jsonb,
  p_usage_snapshot jsonb,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_quote public.billing_quotes%rowtype;
  v_hold public.wallet_holds%rowtype;
  v_wallet public.wallets%rowtype;
  v_existing public.billing_receipts%rowtype;
  v_usage_id uuid;
  v_receipt_id uuid;
  v_transaction_id uuid;
  v_before numeric;
  v_after numeric;
  v_available numeric;
  v_from_promo numeric;
  v_from_purchased numeric;
  v_provider_cost_pkr numeric;
  v_profit_pkr numeric;
  v_margin_percent numeric;
  v_markup numeric;
begin
  select * into v_existing from public.billing_receipts where quote_id = p_quote_id;
  if found then
    return jsonb_build_object(
      'receipt_id', v_existing.id,
      'usage_event_id', v_existing.usage_event_id,
      'wallet_transaction_id', v_existing.wallet_transaction_id,
      'charge_credits', v_existing.charge_credits::text,
      'provider_cost_usd', v_existing.provider_cost_usd::text,
      'cost_status', v_existing.cost_status
    );
  end if;

  select * into v_quote from public.billing_quotes where id = p_quote_id for update;
  if not found or v_quote.status <> 'accepted' or v_quote.wallet_hold_id is null then
    raise exception 'BILLING_QUOTE_NOT_SETTLEABLE';
  end if;
  if p_cost_status not in ('usage_calculated', 'provider_reported', 'reconciled')
    or p_calculated_provider_cost_usd < 0
    or p_final_provider_cost_usd < 0
    or p_charge_credits <= 0
    or jsonb_typeof(p_usage) <> 'object'
    or jsonb_typeof(p_raw_usage) <> 'object'
    or jsonb_typeof(p_usage_snapshot) <> 'object'
    or jsonb_typeof(p_metadata) <> 'object' then
    raise exception 'BILLING_SETTLEMENT_INVALID';
  end if;
  if (p_provider_reported_cost is null) <> (p_provider_reported_currency is null) then
    raise exception 'BILLING_PROVIDER_COST_INVALID';
  end if;

  select * into v_hold from public.wallet_holds where id = v_quote.wallet_hold_id for update;
  if not found or v_hold.status <> 'active' or v_hold.user_id is distinct from v_quote.user_id then
    raise exception 'BILLING_HOLD_NOT_ACTIVE';
  end if;
  select * into v_wallet from public.wallets where user_id = v_quote.user_id for update;
  if not found then raise exception 'Wallet not found'; end if;
  v_available := v_wallet.purchased_balance + v_wallet.promo_balance - (v_wallet.reserved_balance - v_hold.amount);
  if v_available < p_charge_credits then raise exception 'INSUFFICIENT_CREDITS_AT_SETTLEMENT'; end if;

  v_before := v_wallet.purchased_balance + v_wallet.promo_balance;
  v_from_promo := least(v_wallet.promo_balance, p_charge_credits);
  v_from_purchased := p_charge_credits - v_from_promo;
  update public.wallets
  set promo_balance = promo_balance - v_from_promo,
      purchased_balance = purchased_balance - v_from_purchased,
      reserved_balance = greatest(0, reserved_balance - v_hold.amount),
      updated_at = clock_timestamp()
  where user_id = v_quote.user_id;
  update public.wallet_holds set status = 'captured', finalized_at = clock_timestamp() where id = v_hold.id;
  select purchased_balance + promo_balance into v_after from public.wallets where user_id = v_quote.user_id;

  insert into public.wallet_transactions (
    user_id, type, bucket, amount, reference_id, idempotency_key,
    balance_before, balance_after, metadata
  ) values (
    v_quote.user_id, 'generation_capture', 'mixed', -p_charge_credits,
    v_hold.id::text, p_capture_idempotency_key, v_before, v_after,
    p_metadata || jsonb_build_object('billing_v2_quote_id', v_quote.id)
  ) returning id into v_transaction_id;

  insert into public.billing_usage_events (
    idempotency_key, user_id, quote_id, provider_key, model_id, upstream_model,
    provider_request_id, provider_task_id, input_tokens, output_tokens, reasoning_tokens,
    cached_input_tokens, cached_output_tokens, cache_write_tokens,
    characters, seconds, images, reference_images, resolution, quality, mode,
    input_type, fps, dimensions, raw_usage, provider_reported_cost, provider_reported_currency,
    cost_status, occurred_at
  ) values (
    p_usage_idempotency_key, v_quote.user_id, v_quote.id,
    v_quote.provider_key, v_quote.model_id, v_quote.upstream_model,
    p_provider_request_id, p_provider_task_id,
    nullif(p_usage ->> 'inputTokens', '')::bigint,
    nullif(p_usage ->> 'outputTokens', '')::bigint,
    nullif(p_usage ->> 'reasoningTokens', '')::bigint,
    nullif(p_usage ->> 'cachedInputTokens', '')::bigint,
    nullif(p_usage ->> 'cachedOutputTokens', '')::bigint,
    nullif(p_usage ->> 'cacheWriteTokens', '')::bigint,
    nullif(p_usage ->> 'characters', '')::bigint,
    nullif(p_usage ->> 'seconds', '')::numeric,
    nullif(p_usage ->> 'images', '')::bigint,
    nullif(p_usage ->> 'references', '')::bigint,
    p_usage ->> 'resolution', p_usage ->> 'quality', p_usage ->> 'mode',
    p_usage ->> 'inputType', nullif(p_usage ->> 'fps', '')::numeric,
    coalesce(p_usage -> 'dimensions', '{}'::jsonb), p_raw_usage,
    p_provider_reported_cost, p_provider_reported_currency,
    p_cost_status, clock_timestamp()
  ) returning id into v_usage_id;

  v_provider_cost_pkr := p_final_provider_cost_usd * v_quote.internal_usd_pkr_rate;
  v_profit_pkr := p_charge_credits - v_provider_cost_pkr;
  v_margin_percent := case when p_charge_credits = 0 then null else (v_profit_pkr / p_charge_credits) * 100 end;
  v_markup := (v_quote.pricing_snapshot ->> 'markup')::numeric;

  insert into public.billing_receipts (
    user_id, quote_id, usage_event_id, provider_key, model_id, upstream_model,
    pricing_version, cost_status, provider_cost_usd, internal_usd_pkr_rate,
    provider_cost_pkr, charge_credits, markup, profit_pkr, margin_percent,
    wallet_transaction_id, message_id, generation_job_id, request_idempotency_id,
    usage_snapshot, pricing_snapshot, metadata, settled_at
  ) values (
    v_quote.user_id, v_quote.id, v_usage_id, v_quote.provider_key,
    v_quote.model_id, v_quote.upstream_model, v_quote.pricing_version,
    p_cost_status, p_final_provider_cost_usd, v_quote.internal_usd_pkr_rate,
    v_provider_cost_pkr, p_charge_credits, v_markup, v_profit_pkr,
    v_margin_percent, v_transaction_id, p_message_id, p_generation_job_id,
    v_quote.request_idempotency_id, p_usage_snapshot, v_quote.pricing_snapshot,
    p_metadata, clock_timestamp()
  ) returning id into v_receipt_id;

  if p_charge_credits > v_quote.reservation_credits then
    insert into public.billing_anomalies (
      user_id, quote_id, usage_event_id, receipt_id, request_idempotency_id,
      provider_key, model_id, upstream_model, anomaly_type,
      expected_cost_usd, observed_cost_usd, severity, details
    ) values (
      v_quote.user_id, v_quote.id, v_usage_id, v_receipt_id,
      v_quote.request_idempotency_id, v_quote.provider_key, v_quote.model_id,
      v_quote.upstream_model, 'reservation_shortfall',
      v_quote.reservation_credits / v_quote.internal_usd_pkr_rate,
      p_charge_credits / v_quote.internal_usd_pkr_rate, 'critical',
      jsonb_build_object(
        'reservation_credits', v_quote.reservation_credits::text,
        'actual_charge_credits', p_charge_credits::text,
        'settlement_was_not_capped', true
      )
    );
  end if;

  if p_provider_reported_cost is not null
    and abs(p_final_provider_cost_usd - p_calculated_provider_cost_usd) > 0.000000000000000001 then
    insert into public.billing_anomalies (
      user_id, quote_id, usage_event_id, receipt_id, request_idempotency_id,
      provider_key, model_id, upstream_model, anomaly_type,
      expected_cost_usd, observed_cost_usd, severity, details
    ) values (
      v_quote.user_id, v_quote.id, v_usage_id, v_receipt_id,
      v_quote.request_idempotency_id, v_quote.provider_key, v_quote.model_id,
      v_quote.upstream_model, 'provider_cost_variance',
      p_calculated_provider_cost_usd, p_final_provider_cost_usd, 'medium',
      jsonb_build_object('provider_reported_currency', p_provider_reported_currency)
    );
  end if;

  update public.billing_quotes set status = 'settled', updated_at = clock_timestamp() where id = v_quote.id;
  return jsonb_build_object(
    'receipt_id', v_receipt_id,
    'usage_event_id', v_usage_id,
    'wallet_transaction_id', v_transaction_id,
    'charge_credits', p_charge_credits::text,
    'provider_cost_usd', p_final_provider_cost_usd::text,
    'provider_cost_pkr', v_provider_cost_pkr::text,
    'cost_status', p_cost_status
  );
end;
$function$;

revoke all on function public.billing_accept_quote(uuid) from public, anon, authenticated;
revoke all on function public.billing_cancel_quote_reservation(uuid,text) from public, anon, authenticated;
revoke all on function public.billing_settle_usage_quote(
  uuid,text,text,jsonb,text,text,numeric,text,numeric,numeric,numeric,text,uuid,uuid,jsonb,jsonb,jsonb
) from public, anon, authenticated;
grant execute on function public.billing_accept_quote(uuid) to service_role;
grant execute on function public.billing_cancel_quote_reservation(uuid,text) to service_role;
grant execute on function public.billing_settle_usage_quote(
  uuid,text,text,jsonb,text,text,numeric,text,numeric,numeric,numeric,text,uuid,uuid,jsonb,jsonb,jsonb
) to service_role;

comment on function public.billing_settle_usage_quote(
  uuid,text,text,jsonb,text,text,numeric,text,numeric,numeric,numeric,text,uuid,uuid,jsonb,jsonb,jsonb
) is 'Atomically captures one Billing V2 charge and creates immutable normalized usage and receipt records.';
