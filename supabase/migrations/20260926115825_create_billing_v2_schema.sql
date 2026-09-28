-- Billing Engine V2 is additive. Existing wallet, transaction, message, and
-- generation settlement paths remain authoritative until a later cutover.
create extension if not exists btree_gist with schema extensions;

create table public.provider_pricing_rules (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null,
  model_id text not null references public.models(id) on delete restrict,
  upstream_model text not null,
  pricing_version text not null,
  billing_type text not null check (billing_type in (
    'token', 'flat', 'image', 'time', 'character', 'reference', 'composite', 'formula'
  )),
  currency text not null check (currency in ('USD', 'PKR', 'CREDIT')),
  input_token_price numeric(38,18),
  output_token_price numeric(38,18),
  cached_token_price numeric(38,18),
  cache_write_token_price numeric(38,18),
  flat_price numeric(38,18),
  per_image_price numeric(38,18),
  per_second_price numeric(38,18),
  per_minute_price numeric(38,18),
  per_1k_character_price numeric(38,18),
  per_reference_image_price numeric(38,18),
  resolution_dimensions jsonb not null default '{}'::jsonb,
  quality_dimensions jsonb not null default '{}'::jsonb,
  mode_dimensions jsonb not null default '{}'::jsonb,
  input_type_dimensions jsonb not null default '{}'::jsonb,
  formula jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  effective_from timestamptz not null,
  effective_until timestamptz,
  verified_at timestamptz,
  source_name text,
  source_url text,
  source_metadata jsonb not null default '{}'::jsonb,
  status text not null default 'pending_review'
    check (status in ('verified', 'stale', 'blocked', 'pending_review')),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_pricing_rules_version_key
    unique (provider_key, model_id, upstream_model, pricing_version),
  constraint provider_pricing_rules_effective_window_check
    check (effective_until is null or effective_until > effective_from),
  constraint provider_pricing_rules_verified_check
    check (status <> 'verified' or verified_at is not null),
  constraint provider_pricing_rules_active_check
    check (not active or status in ('verified', 'stale')),
  constraint provider_pricing_rules_dimensions_check check (
    jsonb_typeof(resolution_dimensions) = 'object'
    and jsonb_typeof(quality_dimensions) = 'object'
    and jsonb_typeof(mode_dimensions) = 'object'
    and jsonb_typeof(input_type_dimensions) = 'object'
    and jsonb_typeof(formula) = 'object'
    and jsonb_typeof(metadata) = 'object'
    and jsonb_typeof(source_metadata) = 'object'
  ),
  constraint provider_pricing_rules_nonnegative_prices_check check (
    (input_token_price is null or input_token_price >= 0)
    and (output_token_price is null or output_token_price >= 0)
    and (cached_token_price is null or cached_token_price >= 0)
    and (cache_write_token_price is null or cache_write_token_price >= 0)
    and (flat_price is null or flat_price >= 0)
    and (per_image_price is null or per_image_price >= 0)
    and (per_second_price is null or per_second_price >= 0)
    and (per_minute_price is null or per_minute_price >= 0)
    and (per_1k_character_price is null or per_1k_character_price >= 0)
    and (per_reference_image_price is null or per_reference_image_price >= 0)
  ),
  constraint provider_pricing_rules_has_price_check check (
    num_nonnulls(
      input_token_price, output_token_price, cached_token_price,
      cache_write_token_price, flat_price, per_image_price, per_second_price,
      per_minute_price, per_1k_character_price, per_reference_image_price
    ) > 0 or formula <> '{}'::jsonb
  ),
  constraint provider_pricing_rules_active_window_excl exclude using gist (
    provider_key with =,
    model_id with =,
    upstream_model with =,
    billing_type with =,
    tstzrange(effective_from, effective_until, '[)') with &&
  ) where (active and status in ('verified', 'stale'))
);

create index provider_pricing_rules_lookup_idx
  on public.provider_pricing_rules (provider_key, model_id, upstream_model, effective_from desc)
  where active and status in ('verified', 'stale');
create index provider_pricing_rules_review_idx
  on public.provider_pricing_rules (status, updated_at desc)
  where status in ('pending_review', 'stale', 'blocked');

create table public.billing_quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  request_idempotency_id uuid not null references public.request_idempotency(id) on delete restrict,
  pricing_rule_id uuid not null references public.provider_pricing_rules(id) on delete restrict,
  provider_key text not null,
  model_id text not null references public.models(id) on delete restrict,
  upstream_model text not null,
  pricing_version text not null,
  pricing_status text not null
    check (pricing_status in ('verified', 'stale', 'blocked', 'pending_review')),
  internal_usd_pkr_rate numeric(38,18) not null check (internal_usd_pkr_rate > 0),
  estimated_provider_cost_usd numeric(38,18) not null check (estimated_provider_cost_usd >= 0),
  customer_quote_credits numeric(38,18) not null check (customer_quote_credits >= 0),
  reservation_credits numeric(38,18) not null check (reservation_credits >= customer_quote_credits),
  input_dimensions jsonb not null default '{}'::jsonb
    check (jsonb_typeof(input_dimensions) = 'object'),
  pricing_snapshot jsonb not null check (jsonb_typeof(pricing_snapshot) = 'object'),
  status text not null default 'quoted'
    check (status in ('quoted', 'reserved', 'accepted', 'expired', 'cancelled', 'settled')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_quotes_request_key unique (request_idempotency_id),
  constraint billing_quotes_expiry_check check (expires_at > created_at)
);

create index billing_quotes_user_created_idx
  on public.billing_quotes (user_id, created_at desc);
create index billing_quotes_open_expiry_idx
  on public.billing_quotes (status, expires_at)
  where status in ('quoted', 'reserved', 'accepted');
create index billing_quotes_pricing_rule_idx
  on public.billing_quotes (pricing_rule_id);

create table public.billing_usage_events (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  user_id uuid not null references auth.users(id) on delete restrict,
  quote_id uuid references public.billing_quotes(id) on delete restrict,
  provider_key text not null,
  model_id text not null references public.models(id) on delete restrict,
  upstream_model text not null,
  provider_request_id text,
  provider_task_id text,
  input_tokens bigint check (input_tokens is null or input_tokens >= 0),
  output_tokens bigint check (output_tokens is null or output_tokens >= 0),
  reasoning_tokens bigint check (reasoning_tokens is null or reasoning_tokens >= 0),
  cached_input_tokens bigint check (cached_input_tokens is null or cached_input_tokens >= 0),
  cached_output_tokens bigint check (cached_output_tokens is null or cached_output_tokens >= 0),
  cache_write_tokens bigint check (cache_write_tokens is null or cache_write_tokens >= 0),
  characters bigint check (characters is null or characters >= 0),
  seconds numeric(38,18) check (seconds is null or seconds >= 0),
  images bigint check (images is null or images >= 0),
  reference_images bigint check (reference_images is null or reference_images >= 0),
  resolution text,
  quality text,
  mode text,
  input_type text,
  fps numeric(20,8) check (fps is null or fps >= 0),
  dimensions jsonb not null default '{}'::jsonb
    check (jsonb_typeof(dimensions) = 'object'),
  raw_usage jsonb not null default '{}'::jsonb
    check (jsonb_typeof(raw_usage) = 'object'),
  provider_reported_cost numeric(38,18)
    check (provider_reported_cost is null or provider_reported_cost >= 0),
  provider_reported_currency text
    check (provider_reported_currency is null or provider_reported_currency in ('USD', 'PKR', 'CREDIT')),
  cost_status text not null default 'usage_calculated'
    check (cost_status in ('estimated', 'usage_calculated', 'provider_reported', 'reconciled')),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint billing_usage_events_provider_cost_check check (
    (provider_reported_cost is null and provider_reported_currency is null)
    or (provider_reported_cost is not null and provider_reported_currency is not null)
  )
);

create index billing_usage_events_quote_idx
  on public.billing_usage_events (quote_id, occurred_at);
create index billing_usage_events_user_created_idx
  on public.billing_usage_events (user_id, created_at desc);
create index billing_usage_events_provider_request_idx
  on public.billing_usage_events (provider_key, provider_request_id)
  where provider_request_id is not null;
create index billing_usage_events_provider_task_idx
  on public.billing_usage_events (provider_key, provider_task_id)
  where provider_task_id is not null;

create table public.billing_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  quote_id uuid not null unique references public.billing_quotes(id) on delete restrict,
  usage_event_id uuid not null unique references public.billing_usage_events(id) on delete restrict,
  provider_key text not null,
  model_id text not null references public.models(id) on delete restrict,
  upstream_model text not null,
  pricing_version text not null,
  cost_status text not null
    check (cost_status in ('usage_calculated', 'provider_reported', 'reconciled')),
  provider_cost_usd numeric(38,18) not null check (provider_cost_usd >= 0),
  internal_usd_pkr_rate numeric(38,18) not null check (internal_usd_pkr_rate > 0),
  provider_cost_pkr numeric(38,18) not null check (provider_cost_pkr >= 0),
  charge_credits numeric(38,18) not null check (charge_credits >= 0),
  markup numeric(38,18) not null check (markup >= 0),
  profit_pkr numeric(38,18) not null,
  margin_percent numeric(38,18),
  wallet_transaction_id uuid unique references public.wallet_transactions(id) on delete restrict,
  message_id uuid references public.messages(id) on delete restrict,
  generation_job_id uuid references public.generation_jobs(id) on delete restrict,
  request_idempotency_id uuid references public.request_idempotency(id) on delete restrict,
  usage_snapshot jsonb not null check (jsonb_typeof(usage_snapshot) = 'object'),
  pricing_snapshot jsonb not null check (jsonb_typeof(pricing_snapshot) = 'object'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  settled_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint billing_receipts_provider_cost_conversion_check check (
    abs(provider_cost_pkr - (provider_cost_usd * internal_usd_pkr_rate)) <= 0.000000000000000001
  ),
  constraint billing_receipts_profit_check check (
    abs(profit_pkr - (charge_credits - provider_cost_pkr)) <= 0.000000000000000001
  ),
  constraint billing_receipts_wallet_transaction_check check (
    charge_credits = 0 or wallet_transaction_id is not null
  ),
  constraint billing_receipts_margin_check check (
    (charge_credits = 0 and margin_percent is null)
    or (
      charge_credits > 0
      and margin_percent is not null
      and abs(margin_percent - ((profit_pkr / charge_credits) * 100)) <= 0.000000000001
    )
  )
);

create index billing_receipts_user_settled_idx
  on public.billing_receipts (user_id, settled_at desc);
create index billing_receipts_model_settled_idx
  on public.billing_receipts (provider_key, model_id, settled_at desc);
create index billing_receipts_message_idx
  on public.billing_receipts (message_id) where message_id is not null;
create index billing_receipts_generation_job_idx
  on public.billing_receipts (generation_job_id) where generation_job_id is not null;
create index billing_receipts_request_idx
  on public.billing_receipts (request_idempotency_id) where request_idempotency_id is not null;

create table public.billing_anomalies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete restrict,
  quote_id uuid references public.billing_quotes(id) on delete restrict,
  usage_event_id uuid references public.billing_usage_events(id) on delete restrict,
  receipt_id uuid references public.billing_receipts(id) on delete restrict,
  request_idempotency_id uuid references public.request_idempotency(id) on delete restrict,
  provider_key text not null,
  model_id text not null references public.models(id) on delete restrict,
  upstream_model text,
  anomaly_type text not null,
  expected_cost_usd numeric(38,18) not null check (expected_cost_usd >= 0),
  observed_cost_usd numeric(38,18) not null check (observed_cost_usd >= 0),
  variance_usd numeric(38,18) generated always as (observed_cost_usd - expected_cost_usd) stored,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open'
    check (status in ('open', 'investigating', 'resolved', 'dismissed')),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint billing_anomalies_resolution_check check (
    (status in ('resolved', 'dismissed') and resolved_at is not null)
    or (status in ('open', 'investigating') and resolved_at is null)
  ),
  constraint billing_anomalies_link_check check (
    num_nonnulls(quote_id, usage_event_id, receipt_id, request_idempotency_id) > 0
  )
);

create index billing_anomalies_queue_idx
  on public.billing_anomalies (severity, detected_at desc)
  where status in ('open', 'investigating');
create index billing_anomalies_provider_model_idx
  on public.billing_anomalies (provider_key, model_id, detected_at desc);
create index billing_anomalies_request_idx
  on public.billing_anomalies (request_idempotency_id)
  where request_idempotency_id is not null;

create function public.billing_protect_quote_snapshot()
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
    new.created_at
  ) is distinct from row(
    old.user_id, old.request_idempotency_id, old.pricing_rule_id,
    old.provider_key, old.model_id, old.upstream_model, old.pricing_version,
    old.pricing_status, old.internal_usd_pkr_rate,
    old.estimated_provider_cost_usd, old.customer_quote_credits,
    old.reservation_credits, old.input_dimensions, old.pricing_snapshot,
    old.created_at
  ) then
    raise exception 'BILLING_QUOTE_SNAPSHOT_IMMUTABLE';
  end if;
  return new;
end;
$function$;

create function public.billing_prevent_mutation()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  raise exception 'BILLING_FINANCIAL_RECORD_IMMUTABLE';
end;
$function$;

create trigger billing_quotes_protect_snapshot
before update on public.billing_quotes
for each row execute function public.billing_protect_quote_snapshot();

create trigger billing_quotes_prevent_delete
before delete on public.billing_quotes
for each row execute function public.billing_prevent_mutation();

create trigger billing_usage_events_immutable
before update or delete on public.billing_usage_events
for each row execute function public.billing_prevent_mutation();

create trigger billing_receipts_immutable
before update or delete on public.billing_receipts
for each row execute function public.billing_prevent_mutation();

alter table public.provider_pricing_rules enable row level security;
alter table public.billing_quotes enable row level security;
alter table public.billing_usage_events enable row level security;
alter table public.billing_receipts enable row level security;
alter table public.billing_anomalies enable row level security;

alter table public.provider_pricing_rules force row level security;
alter table public.billing_quotes force row level security;
alter table public.billing_usage_events force row level security;
alter table public.billing_receipts force row level security;
alter table public.billing_anomalies force row level security;

revoke all on table public.provider_pricing_rules from public, anon, authenticated;
revoke all on table public.billing_quotes from public, anon, authenticated;
revoke all on table public.billing_usage_events from public, anon, authenticated;
revoke all on table public.billing_receipts from public, anon, authenticated;
revoke all on table public.billing_anomalies from public, anon, authenticated;
revoke all on function public.billing_protect_quote_snapshot() from public, anon, authenticated;
revoke all on function public.billing_prevent_mutation() from public, anon, authenticated;

grant all on table public.provider_pricing_rules to service_role;
grant all on table public.billing_quotes to service_role;
grant all on table public.billing_usage_events to service_role;
grant all on table public.billing_receipts to service_role;
grant all on table public.billing_anomalies to service_role;

comment on table public.provider_pricing_rules is 'Versioned provider pricing rules for Billing Engine V2; no production route consumes these yet.';
comment on table public.billing_quotes is 'Request-scoped immutable Billing V2 pricing snapshots and reservations.';
comment on table public.billing_usage_events is 'Append-only normalized provider usage and provider-reported cost observations.';
comment on table public.billing_receipts is 'Immutable final Billing V2 financial records; 1 Credit equals PKR 1.';
comment on table public.billing_anomalies is 'Billing V2 expected-versus-observed cost exceptions for reconciliation.';
