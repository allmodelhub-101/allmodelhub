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
