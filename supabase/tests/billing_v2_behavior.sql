-- Staging-only Billing V2 constraint and immutability checks. All fixtures roll back.
begin;

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (
  '31000000-0000-4000-8000-000000000001',
  'billing-v2-test@example.invalid',
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

insert into public.request_idempotency (id, user_id, scope, request_key)
values (
  '32000000-0000-4000-8000-000000000001',
  '31000000-0000-4000-8000-000000000001',
  'billing-v2-test',
  'billing-v2-test-request'
);

insert into public.provider_pricing_rules (
  id, provider_key, model_id, upstream_model, pricing_version,
  billing_type, currency, input_token_price, output_token_price,
  effective_from, verified_at, status, active, source_name
) values (
  '33000000-0000-4000-8000-000000000001',
  'billing-test-provider',
  (select id from public.models where active order by id limit 1),
  'billing-test-upstream',
  'test-v1',
  'token',
  'USD',
  0.000000000000000001,
  12345678901234567890.123456789012345678,
  now() - interval '1 hour',
  now(),
  'verified',
  true,
  'transactional-test'
);

do $billing_pricing_checks$
begin
  if (
    select input_token_price
    from public.billing_provider_pricing_registry
    where id = '33000000-0000-4000-8000-000000000001'
  ) <> '0.000000000000000001' then
    raise exception 'registry lost micro-cost decimal precision';
  end if;

  if (
    select output_token_price
    from public.billing_provider_pricing_registry
    where id = '33000000-0000-4000-8000-000000000001'
  ) <> '12345678901234567890.123456789012345678' then
    raise exception 'registry lost large decimal precision';
  end if;

  begin
    insert into public.provider_pricing_rules (
      provider_key, model_id, upstream_model, pricing_version,
      billing_type, currency, input_token_price,
      effective_from, verified_at, status, active
    ) values (
      'billing-test-provider',
      (select id from public.models where active order by id limit 1),
      'billing-test-upstream',
      'test-v2',
      'token',
      'USD',
      0.1,
      now(),
      now(),
      'verified',
      true
    );
    raise exception 'overlapping active pricing rule unexpectedly succeeded';
  exception when exclusion_violation then null;
  end;

  begin
    update public.provider_pricing_rules
    set input_token_price = 0.2
    where id = '33000000-0000-4000-8000-000000000001';
    raise exception 'pricing version mutation unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm <> 'BILLING_PRICING_VERSION_IMMUTABLE' then raise; end if;
  end;
end;
$billing_pricing_checks$;

insert into public.request_idempotency (id, user_id, scope, request_key)
values (
  '32000000-0000-4000-8000-000000000002',
  '31000000-0000-4000-8000-000000000001',
  'billing-v2-reservation-test',
  'billing-v2-reservation-request'
);

insert into public.wallets (user_id, purchased_balance, promo_balance, reserved_balance)
values ('31000000-0000-4000-8000-000000000001', 1000, 0, 0)
on conflict (user_id) do update
set purchased_balance = excluded.purchased_balance,
    promo_balance = excluded.promo_balance,
    reserved_balance = excluded.reserved_balance;

do $billing_reservation_checks$
declare
  v_result jsonb;
  v_retry jsonb;
  v_quote_id uuid;
begin
  v_result := public.billing_reserve_quote(
    '31000000-0000-4000-8000-000000000001',
    '32000000-0000-4000-8000-000000000002',
    '33000000-0000-4000-8000-000000000001',
    'billing-test-provider',
    (select id from public.models where active order by id limit 1),
    'billing-test-upstream',
    'test-v1',
    310,
    0.1,
    62,
    62,
    '{"estimatedUsage":{"inputTokens":"1"}}'::jsonb,
    '{"pricingVersion":"test-v1","internalUsdPkrRate":"310"}'::jsonb,
    'deterministic',
    '{"reservationIsCustomerCharge":false}'::jsonb,
    'billing-v2-reservation-hold',
    '{"test":true}'::jsonb
  );
  v_quote_id := (v_result ->> 'quote_id')::uuid;

  if v_quote_id is null or v_result ->> 'status' <> 'reserved' then
    raise exception 'atomic quote reservation did not return a server quote';
  end if;
  if (select reserved_balance from public.wallets where user_id = '31000000-0000-4000-8000-000000000001') <> 62
    or (select purchased_balance from public.wallets where user_id = '31000000-0000-4000-8000-000000000001') <> 1000 then
    raise exception 'reservation changed customer balance instead of reserving Credits';
  end if;
  if not exists (
    select 1 from public.billing_quotes q
    join public.wallet_holds h on h.id = q.wallet_hold_id
    where q.id = v_quote_id and q.status = 'reserved' and h.status = 'active'
      and q.reservation_kind = 'deterministic'
  ) then
    raise exception 'quote and wallet hold were not linked atomically';
  end if;

  v_retry := public.billing_reserve_quote(
    '31000000-0000-4000-8000-000000000001',
    '32000000-0000-4000-8000-000000000002',
    '33000000-0000-4000-8000-000000000001',
    'billing-test-provider',
    (select id from public.models where active order by id limit 1),
    'billing-test-upstream',
    'test-v1', 310, 0.1, 62, 62, '{}'::jsonb, '{}'::jsonb,
    'deterministic', '{}'::jsonb, 'billing-v2-reservation-hold', '{}'::jsonb
  );
  if v_retry ->> 'quote_id' <> v_quote_id::text
    or (select count(*) from public.wallet_holds where idempotency_key = 'billing-v2-reservation-hold') <> 1 then
    raise exception 'quote reservation retry was not idempotent';
  end if;
end;
$billing_reservation_checks$;

insert into public.billing_quotes (
  id, user_id, request_idempotency_id, pricing_rule_id,
  provider_key, model_id, upstream_model, pricing_version, pricing_status,
  internal_usd_pkr_rate, estimated_provider_cost_usd,
  customer_quote_credits, reservation_credits,
  input_dimensions, pricing_snapshot, expires_at
) values (
  '34000000-0000-4000-8000-000000000001',
  '31000000-0000-4000-8000-000000000001',
  '32000000-0000-4000-8000-000000000001',
  '33000000-0000-4000-8000-000000000001',
  'billing-test-provider',
  (select id from public.models where active order by id limit 1),
  'billing-test-upstream',
  'test-v1',
  'verified',
  310.125000000000000000,
  0.000000000000000001,
  0.000000000000000311,
  0.000000000000000400,
  '{"inputTokens":"1"}'::jsonb,
  '{"inputTokenPrice":"0.000000000000000001"}'::jsonb,
  now() + interval '15 minutes'
);

do $billing_quote_checks$
begin
  begin
    update public.billing_quotes
    set internal_usd_pkr_rate = 311
    where id = '34000000-0000-4000-8000-000000000001';
    raise exception 'quote snapshot mutation unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm <> 'BILLING_QUOTE_SNAPSHOT_IMMUTABLE' then raise; end if;
  end;

  update public.billing_quotes
  set status = 'cancelled', updated_at = now()
  where id = '34000000-0000-4000-8000-000000000001';

  begin
    update public.billing_quotes
    set status = 'reserved', updated_at = now()
    where id = '34000000-0000-4000-8000-000000000001';
    raise exception 'terminal quote status regression unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm <> 'BILLING_QUOTE_INVALID_STATUS_TRANSITION' then raise; end if;
  end;

  begin
    delete from public.billing_quotes
    where id = '34000000-0000-4000-8000-000000000001';
    raise exception 'quote deletion unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm <> 'BILLING_FINANCIAL_RECORD_IMMUTABLE' then raise; end if;
  end;
end;
$billing_quote_checks$;

rollback;
