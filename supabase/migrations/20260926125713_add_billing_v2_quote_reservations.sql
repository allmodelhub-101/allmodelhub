-- Billing V2 quote reservation is an additive, server-only path. Existing
-- charging routes remain unchanged until a later cutover.
alter table public.billing_quotes
  add column wallet_hold_id uuid references public.wallet_holds(id) on delete restrict,
  add column reservation_kind text not null default 'estimated'
    check (reservation_kind in ('deterministic', 'maximum')),
  add column reservation_basis jsonb not null default '{}'::jsonb
    check (jsonb_typeof(reservation_basis) = 'object');

create unique index billing_quotes_wallet_hold_key
  on public.billing_quotes (wallet_hold_id)
  where wallet_hold_id is not null;

insert into public.system_settings (key, value) values
  ('billing_v2_min_revenue_cost_ratio', '1.05'::jsonb),
  ('billing_v2_min_profit_pkr', '0'::jsonb),
  ('billing_v2_quote_ttl_seconds', '300'::jsonb),
  ('billing_v2_wallet_reservation_quantum_credits', '0.000001'::jsonb)
on conflict (key) do nothing;

create view public.billing_quote_policy_registry
with (security_invoker = true)
as
select key, value #>> '{}' as decimal_value, updated_at
from public.system_settings
where key in (
  'billing_v2_min_revenue_cost_ratio',
  'billing_v2_min_profit_pkr',
  'billing_v2_quote_ttl_seconds',
  'billing_v2_wallet_reservation_quantum_credits'
);

revoke all on table public.billing_quote_policy_registry
  from public, anon, authenticated;
grant select on table public.billing_quote_policy_registry
  to service_role;

create or replace function public.billing_protect_quote_snapshot()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if row(
    new.user_id, new.request_idempotency_id, new.pricing_rule_id,
    new.provider_key, new.model_id, new.upstream_model, new.pricing_version,
    new.pricing_status, new.internal_usd_pkr_rate,
    new.estimated_provider_cost_usd, new.customer_quote_credits,
    new.reservation_credits, new.input_dimensions, new.pricing_snapshot,
    new.wallet_hold_id, new.reservation_kind, new.reservation_basis,
    new.expires_at, new.created_at
  ) is distinct from row(
    old.user_id, old.request_idempotency_id, old.pricing_rule_id,
    old.provider_key, old.model_id, old.upstream_model, old.pricing_version,
    old.pricing_status, old.internal_usd_pkr_rate,
    old.estimated_provider_cost_usd, old.customer_quote_credits,
    old.reservation_credits, old.input_dimensions, old.pricing_snapshot,
    old.wallet_hold_id, old.reservation_kind, old.reservation_basis,
    old.expires_at, old.created_at
  ) then
    raise exception 'BILLING_QUOTE_SNAPSHOT_IMMUTABLE';
  end if;

  if old.status is distinct from new.status and not (
    (old.status = 'quoted' and new.status in ('reserved', 'accepted', 'expired', 'cancelled'))
    or (old.status = 'reserved' and new.status in ('accepted', 'expired', 'cancelled'))
    or (old.status = 'accepted' and new.status in ('settled', 'cancelled'))
  ) then
    raise exception 'BILLING_QUOTE_INVALID_STATUS_TRANSITION';
  end if;

  if new.status = 'expired' and clock_timestamp() < new.expires_at then
    raise exception 'BILLING_QUOTE_CANNOT_EXPIRE_EARLY';
  end if;

  return new;
end;
$function$;

create function public.billing_reserve_quote(
  p_user_id uuid,
  p_request_idempotency_id uuid,
  p_pricing_rule_id uuid,
  p_provider_key text,
  p_model_id text,
  p_upstream_model text,
  p_pricing_version text,
  p_internal_usd_pkr_rate numeric,
  p_estimated_provider_cost_usd numeric,
  p_customer_quote_credits numeric,
  p_reservation_credits numeric,
  p_input_dimensions jsonb,
  p_pricing_snapshot jsonb,
  p_reservation_kind text,
  p_reservation_basis jsonb,
  p_hold_idempotency_key text,
  p_hold_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_claim public.request_idempotency%rowtype;
  v_rule public.provider_pricing_rules%rowtype;
  v_existing public.billing_quotes%rowtype;
  v_hold public.wallet_holds%rowtype;
  v_quote_id uuid := gen_random_uuid();
  v_hold_id uuid;
  v_ttl_seconds integer;
  v_reservation_quantum numeric;
  v_expires_at timestamptz;
begin
  select * into v_existing
  from public.billing_quotes
  where request_idempotency_id = p_request_idempotency_id;

  if found then
    if v_existing.user_id is distinct from p_user_id then
      raise exception 'BILLING_QUOTE_REQUEST_CONFLICT';
    end if;
    if v_existing.status <> 'reserved' or v_existing.expires_at <= clock_timestamp() then
      raise exception 'BILLING_QUOTE_NOT_REUSABLE';
    end if;
    return jsonb_build_object(
      'quote_id', v_existing.id,
      'wallet_hold_id', v_existing.wallet_hold_id,
      'status', v_existing.status,
      'expires_at', v_existing.expires_at,
      'customer_quote_credits', v_existing.customer_quote_credits::text,
      'reservation_credits', v_existing.reservation_credits::text,
      'pricing_snapshot', v_existing.pricing_snapshot,
      'reservation_kind', v_existing.reservation_kind
    );
  end if;

  select * into v_claim
  from public.request_idempotency
  where id = p_request_idempotency_id
  for update;
  if not found or v_claim.user_id is distinct from p_user_id or v_claim.status <> 'processing' then
    raise exception 'BILLING_QUOTE_INVALID_REQUEST_CLAIM';
  end if;

  select * into v_rule
  from public.provider_pricing_rules
  where id = p_pricing_rule_id;
  if not found
    or v_rule.provider_key is distinct from p_provider_key
    or v_rule.model_id is distinct from p_model_id
    or v_rule.upstream_model is distinct from p_upstream_model
    or v_rule.pricing_version is distinct from p_pricing_version
    or v_rule.status <> 'verified'
    or not v_rule.active
    or v_rule.verified_at is null
    or v_rule.effective_from > clock_timestamp()
    or (v_rule.effective_until is not null and v_rule.effective_until <= clock_timestamp()) then
    raise exception 'BILLING_QUOTE_PRICING_RULE_UNAVAILABLE';
  end if;

  if p_internal_usd_pkr_rate <= 0
    or p_estimated_provider_cost_usd < 0
    or p_customer_quote_credits < 0
    or p_reservation_credits <= 0
    or p_reservation_credits < p_customer_quote_credits then
    raise exception 'BILLING_QUOTE_INVALID_FINANCIALS';
  end if;
  select (value #>> '{}')::numeric into v_reservation_quantum
  from public.system_settings
  where key = 'billing_v2_wallet_reservation_quantum_credits';
  if v_reservation_quantum is null or v_reservation_quantum <= 0
    or mod(p_reservation_credits, v_reservation_quantum) <> 0 then
    raise exception 'BILLING_QUOTE_INVALID_RESERVATION_QUANTUM';
  end if;
  if p_reservation_kind not in ('deterministic', 'maximum')
    or jsonb_typeof(p_input_dimensions) <> 'object'
    or jsonb_typeof(p_pricing_snapshot) <> 'object'
    or jsonb_typeof(p_reservation_basis) <> 'object'
    or jsonb_typeof(p_hold_metadata) <> 'object' then
    raise exception 'BILLING_QUOTE_INVALID_SNAPSHOT';
  end if;

  select (value #>> '{}')::integer into v_ttl_seconds
  from public.system_settings
  where key = 'billing_v2_quote_ttl_seconds';
  if v_ttl_seconds is null or v_ttl_seconds < 1 or v_ttl_seconds > 3600 then
    raise exception 'BILLING_QUOTE_TTL_UNAVAILABLE';
  end if;
  v_expires_at := clock_timestamp() + make_interval(secs => v_ttl_seconds);

  v_hold_id := public.create_wallet_hold(
    p_user_id,
    p_reservation_credits,
    p_hold_idempotency_key,
    p_hold_metadata || jsonb_build_object('billing_quote_id', v_quote_id)
  );
  select * into v_hold from public.wallet_holds where id = v_hold_id;
  if not found
    or v_hold.user_id is distinct from p_user_id
    or v_hold.amount is distinct from p_reservation_credits
    or v_hold.status <> 'active' then
    raise exception 'BILLING_QUOTE_HOLD_CONFLICT';
  end if;

  insert into public.billing_quotes (
    id, user_id, request_idempotency_id, pricing_rule_id,
    provider_key, model_id, upstream_model, pricing_version, pricing_status,
    internal_usd_pkr_rate, estimated_provider_cost_usd,
    customer_quote_credits, reservation_credits,
    input_dimensions, pricing_snapshot, status, expires_at,
    wallet_hold_id, reservation_kind, reservation_basis
  ) values (
    v_quote_id, p_user_id, p_request_idempotency_id, p_pricing_rule_id,
    p_provider_key, p_model_id, p_upstream_model, p_pricing_version, 'verified',
    p_internal_usd_pkr_rate, p_estimated_provider_cost_usd,
    p_customer_quote_credits, p_reservation_credits,
    p_input_dimensions, p_pricing_snapshot, 'reserved', v_expires_at,
    v_hold_id, p_reservation_kind, p_reservation_basis
  );

  return jsonb_build_object(
    'quote_id', v_quote_id,
    'wallet_hold_id', v_hold_id,
    'status', 'reserved',
    'expires_at', v_expires_at,
    'customer_quote_credits', p_customer_quote_credits::text,
    'reservation_credits', p_reservation_credits::text,
    'pricing_snapshot', p_pricing_snapshot,
    'reservation_kind', p_reservation_kind
  );
end;
$function$;

create function public.billing_expire_quote_reservation(p_quote_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_quote public.billing_quotes%rowtype;
begin
  select * into v_quote
  from public.billing_quotes
  where id = p_quote_id
  for update;
  if not found then return false; end if;
  if v_quote.status = 'expired' then return true; end if;
  if v_quote.status <> 'reserved' or v_quote.expires_at > clock_timestamp() then
    return false;
  end if;
  if v_quote.wallet_hold_id is not null then
    perform public.release_wallet_hold(v_quote.wallet_hold_id, 'billing_quote_expired');
  end if;
  update public.billing_quotes
  set status = 'expired', updated_at = clock_timestamp()
  where id = p_quote_id;
  return true;
end;
$function$;

revoke all on function public.billing_reserve_quote(
  uuid, uuid, uuid, text, text, text, text, numeric, numeric, numeric,
  numeric, jsonb, jsonb, text, jsonb, text, jsonb
) from public, anon, authenticated;
revoke all on function public.billing_expire_quote_reservation(uuid)
  from public, anon, authenticated;
grant execute on function public.billing_reserve_quote(
  uuid, uuid, uuid, text, text, text, text, numeric, numeric, numeric,
  numeric, jsonb, jsonb, text, jsonb, text, jsonb
) to service_role;
grant execute on function public.billing_expire_quote_reservation(uuid)
  to service_role;

comment on function public.billing_reserve_quote(
  uuid, uuid, uuid, text, text, text, text, numeric, numeric, numeric,
  numeric, jsonb, jsonb, text, jsonb, text, jsonb
) is 'Atomically creates an immutable Billing V2 quote and wallet reservation; service role only.';
comment on view public.billing_quote_policy_registry is
  'Service-role-only exact-decimal Billing V2 profitability and quote-expiry configuration.';
