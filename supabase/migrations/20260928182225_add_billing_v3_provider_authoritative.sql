-- Billing V3 is additive and disabled by default. Billing V2 rows and RPCs
-- remain intact for rollback and historical audit.

insert into public.system_settings (key, value) values
  ('billing_v3_provider_authoritative_enabled', 'false'::jsonb),
  ('billing_v3_canary_models', '[]'::jsonb),
  ('billing_v3_reconciliation_enabled', 'false'::jsonb)
on conflict (key) do nothing;

-- Restore route.active to its operational meaning. Runtime availability below
-- remains fail-closed through either a verified V2 rule or an active V3
-- authorization policy, depending on rollout settings.
update public.provider_models
set active = true,
    metadata = metadata || jsonb_build_object('billing_v3_operational', true)
where not active
  and metadata ->> 'billing_v2_status' = 'temporarily_unavailable'
  and nullif(btrim(upstream_model), '') is not null;

update public.models m
set active = true,
    capabilities = capabilities - 'temporarily-unavailable',
    updated_at = now()
where not active
  and exists (
    select 1 from public.provider_models pm
    where pm.model_id = m.id and pm.active and nullif(btrim(pm.upstream_model), '') is not null
  );

create table public.billing_authorization_policies (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null,
  model_id text not null references public.models(id) on delete restrict,
  upstream_model text not null,
  modality text not null check (modality in ('text', 'image', 'video', 'audio')),
  policy_version text not null,
  maximum_provider_cost_usd numeric(38,18) not null check (maximum_provider_cost_usd > 0),
  maximum_authorization_credits numeric(38,18) not null check (maximum_authorization_credits > 0),
  fx_rate_snapshot numeric(38,18) not null check (fx_rate_snapshot > 0),
  markup_snapshot numeric(38,18) not null check (markup_snapshot >= 1),
  request_constraints jsonb not null default '{}'::jsonb check (jsonb_typeof(request_constraints) = 'object'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  effective_from timestamptz not null default now(),
  effective_until timestamptz,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_authorization_policy_version_key
    unique (provider_key, model_id, upstream_model, modality, policy_version),
  constraint billing_authorization_policy_window_check
    check (effective_until is null or effective_until > effective_from),
  constraint billing_authorization_policy_active_window_excl exclude using gist (
    provider_key with =,
    model_id with =,
    upstream_model with =,
    modality with =,
    tstzrange(effective_from, effective_until, '[)') with &&
  ) where (active)
);

create index billing_authorization_policy_lookup_idx
  on public.billing_authorization_policies (provider_key, model_id, upstream_model, modality, effective_from desc)
  where active;

create table public.provider_billing_records (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null,
  quote_id uuid not null references public.billing_quotes(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  model_id text not null references public.models(id) on delete restrict,
  message_id uuid references public.messages(id) on delete restrict,
  generation_job_id uuid references public.generation_jobs(id) on delete restrict,
  provider_request_id text,
  provider_task_id text,
  state text not null check (state in ('pending', 'running', 'completed', 'failed', 'cancelled')),
  settled boolean not null default false,
  credits_usd numeric(38,18) check (credits_usd is null or credits_usd >= 0),
  currency text check (currency is null or currency = 'USD'),
  usage jsonb not null default '{}'::jsonb check (jsonb_typeof(usage) = 'object'),
  source text not null check (source in ('response_header', 'callback', 'records_api', 'reconciliation')),
  reconciliation_status text not null default 'pending'
    check (reconciliation_status in ('pending', 'retry', 'settled', 'released', 'authorization_shortfall', 'anomaly')),
  reconciliation_attempts integer not null default 0 check (reconciliation_attempts >= 0),
  next_reconcile_at timestamptz,
  receipt_id uuid unique references public.billing_receipts(id) on delete restrict,
  raw_record jsonb not null default '{}'::jsonb check (jsonb_typeof(raw_record) = 'object'),
  provider_created_at timestamptz,
  provider_completed_at timestamptz,
  first_observed_at timestamptz not null default now(),
  last_observed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_billing_records_identifier_check
    check (provider_request_id is not null or provider_task_id is not null),
  constraint provider_billing_records_cost_check check (
    (not settled and credits_usd is null and currency is null)
    or (settled and credits_usd is not null and currency = 'USD')
  ),
  constraint provider_billing_records_failure_zero_check
    check (state not in ('failed', 'cancelled') or not settled or credits_usd = 0)
);

create unique index provider_billing_records_request_key
  on public.provider_billing_records (provider_key, provider_request_id)
  where provider_request_id is not null;
create unique index provider_billing_records_task_key
  on public.provider_billing_records (provider_key, provider_task_id)
  where provider_task_id is not null;
create unique index provider_billing_records_quote_key
  on public.provider_billing_records (quote_id);
create index provider_billing_records_reconcile_idx
  on public.provider_billing_records (next_reconcile_at, created_at, id)
  where reconciliation_status in ('pending', 'retry', 'authorization_shortfall', 'anomaly');

create unique index billing_anomalies_provider_record_quote_type_uidx
  on public.billing_anomalies (quote_id, anomaly_type)
  where anomaly_type like 'provider_record_%';

-- Seed only authorization bounds that can be proven from an already-verified
-- Billing V2 rule and the server request ceiling. These bounds authorize the
-- wallet only; APIMODELS records remain the final cost authority.
with policy(model_id, upstream_model, modality, maximum_provider_cost_usd, request_constraints, pricing_version) as (
  values
    ('qwen3-8-flash', 'qwen3.8-flash', 'text', 0.03020048::numeric,
      '{"maxInputTokens":"150000","maxOutputTokens":"16384"}'::jsonb, 'apimodels-qwen-3-8-flash-2026-09-28'),
    ('qwen3-8-max', 'qwen3.8-max', 'text', 0.398304::numeric,
      '{"maxInputTokens":"150000","maxOutputTokens":"16384"}'::jsonb, 'apimodels-qwen-3-8-max-2026-09-28'),
    ('eleven-tts-flash', 'eleven-tts-flash', 'audio', 0.425::numeric,
      '{"maxCharacters":"10000"}'::jsonb, 'apimodels-audio-2026-09-26'),
    ('eleven-tts-multilingual', 'eleven-tts-multilingual', 'audio', 0.85::numeric,
      '{"maxCharacters":"10000"}'::jsonb, 'apimodels-audio-2026-09-26'),
    ('eleven-tts-v3', 'eleven-tts-v3', 'audio', 0.85::numeric,
      '{"maxCharacters":"10000"}'::jsonb, 'apimodels-audio-2026-09-26'),
    ('minimax-speech-2-8-turbo', 'minimax-speech-2.8-turbo', 'audio', 0.4::numeric,
      '{"maxCharacters":"10000"}'::jsonb, 'apimodels-audio-2026-09-26'),
    ('minimax-speech-2-8-hd', 'minimax-speech-2.8-hd', 'audio', 0.63::numeric,
      '{"maxCharacters":"10000"}'::jsonb, 'apimodels-audio-2026-09-26'),
    ('kling-tts', 'kling-tts', 'audio', 0.01::numeric,
      '{"maxCharacters":"10000"}'::jsonb, 'apimodels-audio-2026-09-26'),
    ('kling-sound-effects', 'kling-sound-effects', 'audio', 0.044::numeric,
      '{"maxCharacters":"20000","maxSeconds":"10","maxImages":"1","allowedModes":["sfx"],"allowedInputTypes":["text"]}'::jsonb, 'apimodels-audio-2026-09-26'),
    ('suno-v5', 'suno-v5', 'audio', 0.26::numeric,
      '{"maxCharacters":"20000","maxSeconds":"10","maxImages":"1","allowedModes":["music"],"allowedInputTypes":["text"]}'::jsonb, 'apimodels-audio-2026-09-26'),
    ('eleven-dialogue', 'eleven-dialogue', 'audio', 0.85::numeric,
      '{"maxCharacters":"10000"}'::jsonb, 'apimodels-audio-2026-09-27'),
    ('eleven-dubbing', 'eleven-dubbing', 'audio', 16.83::numeric,
      '{"maxCharacters":"20000","maxSeconds":"3600","maxInputDuration":"3600","maxImages":"1"}'::jsonb, 'apimodels-audio-2026-09-27'),
    ('eleven-isolator', 'eleven-isolator', 'audio', 6.12::numeric,
      '{"maxCharacters":"20000","maxSeconds":"3600","maxInputDuration":"3600","maxImages":"1"}'::jsonb, 'apimodels-audio-2026-09-27'),
    ('flux-2-klein-4b', 'flux-2-klein-4b', 'image', 0.135::numeric,
      '{"maxCharacters":"20000","maxImages":"20","maxReferences":"10","allowedInputTypes":["text","image"],"allowedAspectRatios":["16:9","9:16","1:1","4:3","3:4"]}'::jsonb, 'apimodels-image-2026-09-27'),
    ('gemini-2-5-flash-image', 'gemini-2.5-flash-image', 'image', 0.4::numeric,
      '{"maxCharacters":"20000","maxImages":"20","maxReferences":"10","allowedInputTypes":["text","image"],"allowedAspectRatios":["16:9","9:16","1:1","4:3","3:4"]}'::jsonb, 'apimodels-image-2026-09-27'),
    ('kling-v3-image', 'kling-v3-image', 'image', 1::numeric,
      '{"maxCharacters":"20000","maxImages":"20","maxReferences":"1","allowedResolutions":["1K","2K"],"allowedInputTypes":["text","image"],"allowedAspectRatios":["16:9","9:16","1:1","4:3","3:4"]}'::jsonb, 'apimodels-image-2026-09-27'),
    ('qwen3-image', 'qwen3-image', 'image', 0.74::numeric,
      '{"maxCharacters":"20000","maxImages":"20","maxReferences":"10","allowedResolutions":["1K","2K"],"allowedInputTypes":["text","image"],"allowedAspectRatios":["16:9","9:16","1:1","4:3","3:4"]}'::jsonb, 'apimodels-image-2026-09-27'),
    ('real-esrgan', 'real-esrgan', 'image', 0.08::numeric,
      '{"maxCharacters":"20000","maxImages":"20","maxReferences":"1","allowedResolutions":["4K","8K","10K"],"allowedInputTypes":["text","image"],"allowedAspectRatios":["16:9","9:16","1:1","4:3","3:4"]}'::jsonb, 'apimodels-image-2026-09-27'),
    ('gemini-omni-1-1-flash', 'gemini-omni-1.1-flash', 'video', 2::numeric,
      '{"maxCharacters":"20000","maxSeconds":"10","maxOutputDuration":"10","maxImages":"1","maxReferences":"7","allowedResolutions":["720p","1080p","4K"],"allowedInputTypes":["text","image"],"allowedAspectRatios":["16:9","9:16","1:1","4:3","3:4"]}'::jsonb, 'apimodels-video-2026-09-27'),
    ('grok-video-3', 'grok-video-3', 'video', 0.6::numeric,
      '{"maxCharacters":"20000","maxSeconds":"15","maxOutputDuration":"15","maxImages":"1","maxReferences":"7","allowedResolutions":["480p","720p"],"allowedInputTypes":["text","image"],"allowedAspectRatios":["16:9","9:16","1:1","4:3","3:4"]}'::jsonb, 'apimodels-video-2026-09-27'),
    ('minimax-h3', 'minimax-h3', 'video', 2.175::numeric,
      '{"maxCharacters":"20000","maxSeconds":"15","maxOutputDuration":"15","maxImages":"1","maxReferences":"9","allowedResolutions":["768p","2K"],"allowedInputTypes":["text","image"],"allowedAspectRatios":["16:9","9:16","1:1","4:3","3:4"],"allowedNativeAudio":[false]}'::jsonb, 'apimodels-video-2026-09-27'),
    ('veo-3-1-fast-fhd', 'veo-3.1-fast-fhd', 'video', 0.07::numeric,
      '{"maxCharacters":"20000","maxSeconds":"8","maxOutputDuration":"8","maxImages":"1","maxReferences":"1","allowedResolutions":["1080p"],"allowedInputTypes":["text","image"],"allowedAspectRatios":["16:9","9:16","1:1","4:3","3:4"]}'::jsonb, 'apimodels-video-2026-09-27')
), settings as (
  select
    (select (value #>> '{}')::numeric from public.system_settings where key = 'internal_usd_pkr') as fx,
    (select (value #>> '{}')::numeric from public.system_settings where key = 'billing_v2_wallet_reservation_quantum_credits') as quantum
)
insert into public.billing_authorization_policies (
  provider_key, model_id, upstream_model, modality, policy_version,
  maximum_provider_cost_usd, maximum_authorization_credits, fx_rate_snapshot,
  markup_snapshot, request_constraints, metadata, effective_from, active
)
select
  'apimodels', p.model_id, p.upstream_model, p.modality,
  'billing-v3-auth-2026-09-29', p.maximum_provider_cost_usd,
  ceil((p.maximum_provider_cost_usd * s.fx * m.markup) / s.quantum) * s.quantum,
  s.fx, m.markup, p.request_constraints,
  jsonb_build_object('authorization_only', true, 'derived_from_verified_pricing_version', p.pricing_version,
    'final_cost_authority', 'apimodels_records_api'),
  '2026-09-29T00:00:00Z'::timestamptz, true
from policy p
join public.models m on m.id = p.model_id
join public.provider_models route on route.provider_key = 'apimodels'
  and route.model_id = p.model_id and route.upstream_model = p.upstream_model and route.active
join public.provider_pricing_rules price on price.provider_key = route.provider_key
  and price.model_id = route.model_id and price.upstream_model = route.upstream_model
  and price.pricing_version = p.pricing_version and price.status = 'verified' and price.active
cross join settings s
where s.fx > 0 and s.quantum > 0
on conflict (provider_key, model_id, upstream_model, modality, policy_version) do nothing;

do $$
declare v_seeded integer;
begin
  select count(*) into v_seeded from public.billing_authorization_policies
  where policy_version = 'billing-v3-auth-2026-09-29' and active;
  if v_seeded <> 22 then
    raise exception 'Expected 22 defensible Billing V3 authorization policies, found %', v_seeded;
  end if;
end
$$;

alter table public.billing_quotes
  alter column pricing_rule_id drop not null,
  add column authorization_policy_id uuid references public.billing_authorization_policies(id) on delete restrict,
  add column authorization_policy_version text,
  add column billing_engine text not null default 'v2' check (billing_engine in ('v2', 'v3_provider_authoritative')),
  add column frozen_markup numeric(38,18) check (frozen_markup is null or frozen_markup >= 1),
  add constraint billing_quotes_engine_authority_check check (
    (billing_engine = 'v2' and pricing_rule_id is not null and authorization_policy_id is null)
    or (
      billing_engine = 'v3_provider_authoritative'
      and pricing_rule_id is null
      and authorization_policy_id is not null
      and authorization_policy_version is not null
      and frozen_markup is not null
    )
  );

create index billing_quotes_authorization_policy_idx
  on public.billing_quotes (authorization_policy_id)
  where authorization_policy_id is not null;

alter table public.billing_authorization_policies enable row level security;
alter table public.billing_authorization_policies force row level security;
alter table public.provider_billing_records enable row level security;
alter table public.provider_billing_records force row level security;
revoke all on table public.billing_authorization_policies from public, anon, authenticated;
revoke all on table public.provider_billing_records from public, anon, authenticated;
grant all on table public.billing_authorization_policies to service_role;
grant all on table public.provider_billing_records to service_role;

create view public.billing_v3_authorization_registry
with (security_invoker = true)
as
select
  p.id,
  p.provider_key,
  p.model_id,
  p.upstream_model,
  p.modality,
  p.policy_version,
  p.maximum_provider_cost_usd::text as maximum_provider_cost_usd,
  p.maximum_authorization_credits::text as maximum_authorization_credits,
  p.request_constraints,
  p.metadata,
  p.markup_snapshot::text as model_markup,
  p.fx_rate_snapshot::text as internal_usd_pkr_rate
from public.billing_authorization_policies p
join public.models m on m.id = p.model_id and m.active
join public.provider_models route
  on route.provider_key = p.provider_key
 and route.model_id = p.model_id
 and route.upstream_model = p.upstream_model
 and route.active
where p.active
  and p.effective_from <= clock_timestamp()
  and (p.effective_until is null or p.effective_until > clock_timestamp());

revoke all on table public.billing_v3_authorization_registry from public, anon, authenticated;
grant select on table public.billing_v3_authorization_registry to service_role;

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
    new.authorization_policy_id, new.authorization_policy_version,
    new.billing_engine, new.frozen_markup,
    new.expires_at, new.created_at
  ) is distinct from row(
    old.user_id, old.request_idempotency_id, old.pricing_rule_id,
    old.provider_key, old.model_id, old.upstream_model, old.pricing_version,
    old.pricing_status, old.internal_usd_pkr_rate,
    old.estimated_provider_cost_usd, old.customer_quote_credits,
    old.reservation_credits, old.input_dimensions, old.pricing_snapshot,
    old.wallet_hold_id, old.reservation_kind, old.reservation_basis,
    old.authorization_policy_id, old.authorization_policy_version,
    old.billing_engine, old.frozen_markup,
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

create function public.billing_v3_reserve_authorization(
  p_user_id uuid,
  p_request_idempotency_id uuid,
  p_authorization_policy_id uuid,
  p_provider_key text,
  p_model_id text,
  p_upstream_model text,
  p_modality text,
  p_authorization_credits numeric,
  p_input_dimensions jsonb,
  p_hold_idempotency_key text,
  p_hold_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_claim public.request_idempotency%rowtype;
  v_policy public.billing_authorization_policies%rowtype;
  v_existing public.billing_quotes%rowtype;
  v_hold public.wallet_holds%rowtype;
  v_model public.models%rowtype;
  v_fx numeric;
  v_quantum numeric;
  v_ttl integer;
  v_quote_id uuid := gen_random_uuid();
  v_hold_id uuid;
  v_expires_at timestamptz;
begin
  if jsonb_typeof(p_input_dimensions) <> 'object' or jsonb_typeof(p_hold_metadata) <> 'object'
    or p_authorization_credits is null or p_authorization_credits <= 0 then
    raise exception 'BILLING_V3_AUTHORIZATION_INVALID_INPUT';
  end if;
  select * into v_existing from public.billing_quotes where request_idempotency_id = p_request_idempotency_id;
  if found then
    if v_existing.user_id is distinct from p_user_id
      or v_existing.billing_engine <> 'v3_provider_authoritative'
      or v_existing.status not in ('reserved', 'accepted') then
      raise exception 'BILLING_V3_AUTHORIZATION_CONFLICT';
    end if;
    return jsonb_build_object(
      'quote_id', v_existing.id, 'wallet_hold_id', v_existing.wallet_hold_id,
      'expires_at', v_existing.expires_at,
      'authorization_credits', v_existing.reservation_credits::text
    );
  end if;

  select * into v_claim from public.request_idempotency where id = p_request_idempotency_id for update;
  if not found or v_claim.user_id is distinct from p_user_id or v_claim.status <> 'processing' then
    raise exception 'BILLING_V3_INVALID_REQUEST_CLAIM';
  end if;
  select * into v_policy from public.billing_authorization_policies
  where id = p_authorization_policy_id for update;
  if not found or not v_policy.active
    or v_policy.provider_key is distinct from p_provider_key
    or v_policy.model_id is distinct from p_model_id
    or v_policy.upstream_model is distinct from p_upstream_model
    or v_policy.modality is distinct from p_modality
    or v_policy.effective_from > clock_timestamp()
    or (v_policy.effective_until is not null and v_policy.effective_until <= clock_timestamp()) then
    raise exception 'BILLING_V3_AUTHORIZATION_POLICY_UNAVAILABLE';
  end if;
  if not exists (
    select 1 from public.provider_models pm
    where pm.provider_key = p_provider_key and pm.model_id = p_model_id
      and pm.upstream_model = p_upstream_model and pm.active
  ) then raise exception 'BILLING_V3_PROVIDER_ROUTE_UNAVAILABLE'; end if;
  select * into v_model from public.models where id = p_model_id and active;
  if not found or v_model.markup < 1 then raise exception 'BILLING_V3_MODEL_UNAVAILABLE'; end if;
  select (value #>> '{}')::numeric into v_fx from public.system_settings where key = 'internal_usd_pkr';
  select (value #>> '{}')::numeric into v_quantum from public.system_settings
    where key = 'billing_v2_wallet_reservation_quantum_credits';
  select (value #>> '{}')::integer into v_ttl from public.system_settings where key = 'billing_v2_quote_ttl_seconds';
  if v_fx is null or v_fx <= 0 or v_quantum is null or v_quantum <= 0
    or v_ttl is null or v_ttl < 1 or v_ttl > 3600 then
    raise exception 'BILLING_V3_CONFIGURATION_UNAVAILABLE';
  end if;
  if v_policy.fx_rate_snapshot is distinct from v_fx
    or v_policy.markup_snapshot is distinct from v_model.markup
    or v_policy.maximum_authorization_credits is distinct from
      ceil((v_policy.maximum_provider_cost_usd * v_fx * v_model.markup) / v_quantum) * v_quantum then
    raise exception 'BILLING_V3_AUTHORIZATION_POLICY_STALE';
  end if;
  if p_authorization_credits > v_policy.maximum_authorization_credits
    or p_authorization_credits is distinct from ceil(p_authorization_credits / v_quantum) * v_quantum then
    raise exception 'BILLING_V3_AUTHORIZATION_AMOUNT_INVALID';
  end if;
  v_expires_at := clock_timestamp() + make_interval(secs => v_ttl);
  v_hold_id := public.create_wallet_hold(
    p_user_id, p_authorization_credits, p_hold_idempotency_key,
    p_hold_metadata || jsonb_build_object('billing_quote_id', v_quote_id, 'billing_engine', 'v3_provider_authoritative')
  );
  select * into v_hold from public.wallet_holds where id = v_hold_id;
  if not found or v_hold.user_id is distinct from p_user_id
    or v_hold.amount is distinct from p_authorization_credits
    or v_hold.status <> 'active' then raise exception 'BILLING_V3_HOLD_CONFLICT'; end if;

  insert into public.billing_quotes (
    id, user_id, request_idempotency_id, pricing_rule_id,
    provider_key, model_id, upstream_model, pricing_version, pricing_status,
    internal_usd_pkr_rate, estimated_provider_cost_usd, customer_quote_credits,
    reservation_credits, input_dimensions, pricing_snapshot, status, expires_at,
    wallet_hold_id, reservation_kind, reservation_basis,
    authorization_policy_id, authorization_policy_version, billing_engine, frozen_markup
  ) values (
    v_quote_id, p_user_id, p_request_idempotency_id, null,
    p_provider_key, p_model_id, p_upstream_model, v_policy.policy_version, 'verified',
    v_fx, 0, 0, p_authorization_credits, p_input_dimensions,
    jsonb_build_object(
      'billingEngine', 'v3_provider_authoritative',
      'authorizationPolicyId', v_policy.id,
      'authorizationPolicyVersion', v_policy.policy_version,
      'authorizationCredits', p_authorization_credits::text,
      'maximumAuthorizationCredits', v_policy.maximum_authorization_credits::text,
      'internalUsdPkrRate', v_fx::text,
      'markup', v_model.markup::text,
      'requestConstraints', v_policy.request_constraints
    ),
    'accepted', v_expires_at, v_hold_id, 'maximum',
    jsonb_build_object('kind', 'provider_authoritative_maximum', 'finalCostAuthority', 'apimodels_records_api'),
    v_policy.id, v_policy.policy_version, 'v3_provider_authoritative', v_model.markup
  );
  return jsonb_build_object(
    'quote_id', v_quote_id, 'wallet_hold_id', v_hold_id,
    'expires_at', v_expires_at,
    'authorization_credits', p_authorization_credits::text
  );
end;
$function$;

create function public.billing_v3_record_provider_observation(
  p_quote_id uuid,
  p_provider_request_id text,
  p_provider_task_id text,
  p_state text,
  p_settled boolean,
  p_credits_usd numeric,
  p_currency text,
  p_usage jsonb,
  p_source text,
  p_raw_record jsonb default '{}'::jsonb,
  p_provider_created_at timestamptz default null,
  p_provider_completed_at timestamptz default null,
  p_message_id uuid default null,
  p_generation_job_id uuid default null
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_quote public.billing_quotes%rowtype;
  v_record public.provider_billing_records%rowtype;
begin
  if p_provider_request_id is null and p_provider_task_id is null then raise exception 'BILLING_V3_PROVIDER_ID_REQUIRED'; end if;
  if p_state not in ('pending', 'running', 'completed', 'failed', 'cancelled')
    or p_source not in ('response_header', 'callback', 'records_api', 'reconciliation')
    or jsonb_typeof(p_usage) <> 'object' or jsonb_typeof(p_raw_record) <> 'object'
    or ((not p_settled) and (p_credits_usd is not null or p_currency is not null))
    or (p_settled and (p_credits_usd is null or p_credits_usd < 0 or p_currency <> 'USD'))
    or (p_state in ('failed', 'cancelled') and p_settled and p_credits_usd <> 0)
  then raise exception 'BILLING_V3_PROVIDER_OBSERVATION_INVALID'; end if;
  select * into v_quote from public.billing_quotes where id = p_quote_id for update;
  if not found or v_quote.billing_engine <> 'v3_provider_authoritative' then raise exception 'BILLING_V3_QUOTE_INVALID'; end if;
  select * into v_record from public.provider_billing_records
  where quote_id = p_quote_id
     or (p_provider_request_id is not null and provider_key = v_quote.provider_key and provider_request_id = p_provider_request_id)
     or (p_provider_task_id is not null and provider_key = v_quote.provider_key and provider_task_id = p_provider_task_id)
  limit 1 for update;
  if found then
    if v_record.quote_id is distinct from p_quote_id or v_record.provider_key is distinct from v_quote.provider_key
      or (v_record.settled and (
        v_record.state is distinct from p_state or v_record.credits_usd is distinct from p_credits_usd
        or v_record.currency is distinct from p_currency or not p_settled
      )) then raise exception 'BILLING_V3_PROVIDER_OBSERVATION_CONFLICT'; end if;
    update public.provider_billing_records
    set provider_request_id = coalesce(provider_request_id, p_provider_request_id),
        provider_task_id = coalesce(provider_task_id, p_provider_task_id),
        state = case when settled then state else p_state end,
        settled = case when settled then true else p_settled end,
        credits_usd = case when settled then credits_usd else p_credits_usd end,
        currency = case when settled then currency else p_currency end,
        usage = case when settled then usage else p_usage end,
        source = case when settled then source else p_source end,
        raw_record = case when settled then raw_record else p_raw_record end,
        provider_created_at = coalesce(provider_created_at, p_provider_created_at),
        provider_completed_at = coalesce(provider_completed_at, p_provider_completed_at),
        message_id = coalesce(message_id, p_message_id),
        generation_job_id = coalesce(generation_job_id, p_generation_job_id),
        reconciliation_status = case when p_settled then 'pending' else 'retry' end,
        next_reconcile_at = case when p_settled then null else clock_timestamp() + interval '5 minutes' end,
        last_observed_at = clock_timestamp(), updated_at = clock_timestamp()
    where id = v_record.id;
    return v_record.id;
  end if;
  insert into public.provider_billing_records (
    provider_key, quote_id, user_id, model_id, message_id, generation_job_id,
    provider_request_id, provider_task_id,
    state, settled, credits_usd, currency, usage, source, reconciliation_status,
    next_reconcile_at, raw_record, provider_created_at, provider_completed_at
  ) values (
    v_quote.provider_key, v_quote.id, v_quote.user_id, v_quote.model_id,
    p_message_id, p_generation_job_id,
    p_provider_request_id, p_provider_task_id, p_state, p_settled,
    p_credits_usd, p_currency, p_usage, p_source,
    case when p_settled then 'pending' else 'retry' end,
    case when p_settled then null else clock_timestamp() + interval '5 minutes' end,
    p_raw_record, p_provider_created_at, p_provider_completed_at
  ) returning id into v_record.id;
  return v_record.id;
end;
$function$;

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
  v_hold public.wallet_holds%rowtype;
  v_wallet public.wallets%rowtype;
  v_existing public.billing_receipts%rowtype;
  v_quantum numeric;
  v_provider_pkr numeric;
  v_charge numeric;
  v_profit numeric;
  v_margin numeric;
  v_before numeric;
  v_after numeric;
  v_from_promo numeric;
  v_from_purchased numeric;
  v_usage_id uuid;
  v_receipt_id uuid;
  v_transaction_id uuid;
begin
  if jsonb_typeof(p_usage) <> 'object' or jsonb_typeof(p_metadata) <> 'object' then
    raise exception 'BILLING_V3_SETTLEMENT_INVALID';
  end if;
  select * into v_record from public.provider_billing_records where id = p_provider_billing_record_id for update;
  if not found then raise exception 'BILLING_V3_PROVIDER_RECORD_NOT_FOUND'; end if;
  select * into v_existing from public.billing_receipts where quote_id = v_record.quote_id;
  if found then return jsonb_build_object(
    'status', 'settled', 'receipt_id', v_existing.id,
    'usage_event_id', v_existing.usage_event_id,
    'wallet_transaction_id', v_existing.wallet_transaction_id,
    'charge_credits', v_existing.charge_credits::text
  ); end if;
  if not v_record.settled or v_record.state <> 'completed'
    or v_record.credits_usd is null or v_record.currency <> 'USD' then
    raise exception 'BILLING_V3_PROVIDER_RECORD_NOT_SETTLEABLE';
  end if;
  select * into v_quote from public.billing_quotes where id = v_record.quote_id for update;
  if not found or v_quote.billing_engine <> 'v3_provider_authoritative'
    or v_quote.status <> 'accepted' or v_quote.wallet_hold_id is null then
    raise exception 'BILLING_V3_QUOTE_NOT_SETTLEABLE';
  end if;
  p_message_id := coalesce(p_message_id, v_record.message_id);
  p_generation_job_id := coalesce(p_generation_job_id, v_record.generation_job_id);
  select (value #>> '{}')::numeric into v_quantum from public.system_settings
  where key = 'billing_v2_wallet_reservation_quantum_credits';
  if v_quantum is null or v_quantum <= 0 then raise exception 'BILLING_V3_QUANTUM_UNAVAILABLE'; end if;
  v_provider_pkr := v_record.credits_usd * v_quote.internal_usd_pkr_rate;
  v_charge := case when v_provider_pkr = 0 then 0 else ceil((v_provider_pkr * v_quote.frozen_markup) / v_quantum) * v_quantum end;
  v_profit := v_charge - v_provider_pkr;
  v_margin := case when v_charge = 0 then null else (v_profit / v_charge) * 100 end;
  if v_profit < 0 then raise exception 'BILLING_V3_NEGATIVE_MARGIN'; end if;
  if v_charge > v_quote.reservation_credits then
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
        'customer_was_not_charged', true)
    );
    update public.provider_billing_records set reconciliation_status = 'authorization_shortfall',
      next_reconcile_at = null, updated_at = clock_timestamp() where id = v_record.id;
    update public.billing_authorization_policies set active = false, updated_at = clock_timestamp()
      where id = v_quote.authorization_policy_id;
    return jsonb_build_object('status', 'authorization_shortfall',
      'authorization_credits', v_quote.reservation_credits::text,
      'required_charge_credits', v_charge::text);
  end if;

  select * into v_hold from public.wallet_holds where id = v_quote.wallet_hold_id for update;
  if not found or v_hold.status <> 'active' or v_hold.user_id is distinct from v_quote.user_id
    or v_hold.amount < v_charge then raise exception 'BILLING_V3_HOLD_NOT_ACTIVE'; end if;
  select * into v_wallet from public.wallets where user_id = v_quote.user_id for update;
  if not found then raise exception 'Wallet not found'; end if;
  v_before := v_wallet.purchased_balance + v_wallet.promo_balance;
  if v_before < v_charge then raise exception 'INSUFFICIENT_CREDITS_AT_SETTLEMENT'; end if;
  v_from_promo := least(v_wallet.promo_balance, v_charge);
  v_from_purchased := v_charge - v_from_promo;
  update public.wallets set
    promo_balance = promo_balance - v_from_promo,
    purchased_balance = purchased_balance - v_from_purchased,
    reserved_balance = greatest(0, reserved_balance - v_hold.amount),
    updated_at = clock_timestamp()
  where user_id = v_quote.user_id;
  update public.wallet_holds set status = 'captured', finalized_at = clock_timestamp() where id = v_hold.id;
  select purchased_balance + promo_balance into v_after from public.wallets where user_id = v_quote.user_id;
  if v_charge > 0 then
    insert into public.wallet_transactions (
      user_id, type, bucket, amount, reference_id, idempotency_key,
      balance_before, balance_after, metadata
    ) values (
      v_quote.user_id, 'generation_capture', 'mixed', -v_charge, v_hold.id::text,
      'billing-v3-provider-capture:' || v_quote.id::text, v_before, v_after,
      p_metadata || jsonb_build_object('billing_v3_quote_id', v_quote.id,
        'provider_billing_record_id', v_record.id)
    ) returning id into v_transaction_id;
  end if;
  insert into public.billing_usage_events (
    idempotency_key, user_id, quote_id, provider_key, model_id, upstream_model,
    provider_request_id, provider_task_id, dimensions, raw_usage,
    provider_reported_cost, provider_reported_currency, cost_status, occurred_at
  ) values (
    'billing-v3-provider-usage:' || v_quote.id::text, v_quote.user_id, v_quote.id,
    v_quote.provider_key, v_quote.model_id, v_quote.upstream_model,
    v_record.provider_request_id, v_record.provider_task_id,
    coalesce(p_usage -> 'dimensions', '{}'::jsonb),
    v_record.usage || p_usage, v_record.credits_usd, 'USD', 'provider_reported', clock_timestamp()
  ) returning id into v_usage_id;
  insert into public.billing_receipts (
    user_id, quote_id, usage_event_id, provider_key, model_id, upstream_model,
    pricing_version, cost_status, provider_cost_usd, internal_usd_pkr_rate,
    provider_cost_pkr, charge_credits, markup, profit_pkr, margin_percent,
    wallet_transaction_id, message_id, generation_job_id, request_idempotency_id,
    usage_snapshot, pricing_snapshot, metadata, settled_at
  ) values (
    v_quote.user_id, v_quote.id, v_usage_id, v_quote.provider_key, v_quote.model_id,
    v_quote.upstream_model, v_quote.authorization_policy_version, 'provider_reported',
    v_record.credits_usd, v_quote.internal_usd_pkr_rate, v_provider_pkr, v_charge,
    v_quote.frozen_markup, v_profit, v_margin, v_transaction_id, p_message_id,
    p_generation_job_id, v_quote.request_idempotency_id,
    jsonb_build_object('source', v_record.source, 'providerRequestId', v_record.provider_request_id,
      'providerTaskId', v_record.provider_task_id, 'providerUsage', v_record.usage),
    v_quote.pricing_snapshot,
    p_metadata || jsonb_build_object('billing_v3', true, 'provider_billing_record_id', v_record.id),
    clock_timestamp()
  ) returning id into v_receipt_id;
  update public.billing_quotes set status = 'settled', updated_at = clock_timestamp() where id = v_quote.id;
  update public.provider_billing_records set receipt_id = v_receipt_id,
    reconciliation_status = 'settled', next_reconcile_at = null, updated_at = clock_timestamp()
  where id = v_record.id;
  if p_message_id is not null then
    update public.messages set
      credits_charged = v_charge,
      supplier_cost_usd = v_record.credits_usd,
      internal_cost_pkr = v_provider_pkr,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'billingStatus', 'settled', 'billingReceiptId', v_receipt_id,
        'billingEngine', 'v3_provider_authoritative'
      )
    where id = p_message_id and user_id = v_quote.user_id;
  end if;
  if p_generation_job_id is not null then
    update public.generation_jobs set status = 'completed', charged_credits = v_charge,
      completed_at = coalesce(completed_at, clock_timestamp()), updated_at = clock_timestamp(),
      error_message = null where id = p_generation_job_id;
  end if;
  return jsonb_build_object(
    'status', 'settled', 'receipt_id', v_receipt_id, 'usage_event_id', v_usage_id,
    'wallet_transaction_id', v_transaction_id, 'charge_credits', v_charge::text
  );
end;
$function$;

create function public.billing_v3_release_authoritative_failure(
  p_provider_billing_record_id uuid,
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
  v_usage_id uuid;
  v_receipt_id uuid;
begin
  if jsonb_typeof(p_metadata) <> 'object' then raise exception 'BILLING_V3_FAILURE_INVALID'; end if;
  select * into v_record from public.provider_billing_records where id = p_provider_billing_record_id for update;
  if not found or not v_record.settled or v_record.state not in ('failed', 'cancelled')
    or v_record.credits_usd <> 0 or v_record.currency <> 'USD' then
    raise exception 'BILLING_V3_FAILURE_NOT_AUTHORITATIVE';
  end if;
  p_generation_job_id := coalesce(p_generation_job_id, v_record.generation_job_id);
  select * into v_existing from public.billing_receipts where quote_id = v_record.quote_id;
  if found then return jsonb_build_object('status', 'released', 'receipt_id', v_existing.id, 'charge_credits', '0'); end if;
  select * into v_quote from public.billing_quotes where id = v_record.quote_id for update;
  if not found or v_quote.billing_engine <> 'v3_provider_authoritative'
    or v_quote.status <> 'accepted' or v_quote.wallet_hold_id is null then
    raise exception 'BILLING_V3_QUOTE_NOT_RELEASABLE';
  end if;
  perform public.release_wallet_hold(v_quote.wallet_hold_id, 'billing_v3_provider_' || v_record.state);
  insert into public.billing_usage_events (
    idempotency_key, user_id, quote_id, provider_key, model_id, upstream_model,
    provider_request_id, provider_task_id, raw_usage, provider_reported_cost,
    provider_reported_currency, cost_status, occurred_at
  ) values (
    'billing-v3-provider-failure-usage:' || v_quote.id::text, v_quote.user_id,
    v_quote.id, v_quote.provider_key, v_quote.model_id, v_quote.upstream_model,
    v_record.provider_request_id, v_record.provider_task_id, v_record.usage,
    0, 'USD', 'provider_reported', clock_timestamp()
  ) returning id into v_usage_id;
  insert into public.billing_receipts (
    user_id, quote_id, usage_event_id, provider_key, model_id, upstream_model,
    pricing_version, cost_status, provider_cost_usd, internal_usd_pkr_rate,
    provider_cost_pkr, charge_credits, markup, profit_pkr, margin_percent,
    generation_job_id, request_idempotency_id, usage_snapshot, pricing_snapshot,
    metadata, settled_at
  ) values (
    v_quote.user_id, v_quote.id, v_usage_id, v_quote.provider_key, v_quote.model_id,
    v_quote.upstream_model, v_quote.authorization_policy_version, 'provider_reported',
    0, v_quote.internal_usd_pkr_rate, 0, 0, v_quote.frozen_markup, 0, null,
    p_generation_job_id, v_quote.request_idempotency_id,
    jsonb_build_object('source', v_record.source, 'providerState', v_record.state,
      'providerRequestId', v_record.provider_request_id, 'providerTaskId', v_record.provider_task_id),
    v_quote.pricing_snapshot,
    p_metadata || jsonb_build_object('billing_v3', true, 'authoritative_non_billable_failure', true,
      'provider_billing_record_id', v_record.id), clock_timestamp()
  ) returning id into v_receipt_id;
  update public.billing_quotes set status = 'settled', updated_at = clock_timestamp() where id = v_quote.id;
  update public.provider_billing_records set receipt_id = v_receipt_id,
    reconciliation_status = 'released', next_reconcile_at = null, updated_at = clock_timestamp()
  where id = v_record.id;
  if p_generation_job_id is not null then
    update public.generation_jobs set status = case when v_record.state = 'cancelled' then 'cancelled'::public.job_status else 'failed'::public.job_status end,
      charged_credits = 0, updated_at = clock_timestamp() where id = p_generation_job_id;
  end if;
  return jsonb_build_object('status', 'released', 'receipt_id', v_receipt_id,
    'usage_event_id', v_usage_id, 'wallet_transaction_id', null, 'charge_credits', '0');
end;
$function$;

create function public.billing_v3_claim_reconciliation_batch(p_limit integer default 20)
returns setof public.provider_billing_records
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if p_limit < 1 or p_limit > 100 then raise exception 'BILLING_V3_RECONCILIATION_LIMIT_INVALID'; end if;
  return query
  with candidates as (
    select r.id from public.provider_billing_records r
    where r.reconciliation_status in ('pending', 'retry')
      and (r.next_reconcile_at is null or r.next_reconcile_at <= clock_timestamp())
      and r.receipt_id is null
    order by coalesce(r.next_reconcile_at, r.created_at), r.id
    limit p_limit for update skip locked
  )
  update public.provider_billing_records r
  set reconciliation_attempts = r.reconciliation_attempts + 1,
      next_reconcile_at = clock_timestamp() + make_interval(mins => least(360, 5 * power(2, least(r.reconciliation_attempts, 6))::integer)),
      updated_at = clock_timestamp()
  from candidates c where r.id = c.id returning r.*;
end;
$function$;

create function public.billing_v3_mark_reconciliation_retry(
  p_provider_billing_record_id uuid,
  p_status text,
  p_next_reconcile_at timestamptz,
  p_details jsonb default '{}'::jsonb
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if p_status not in ('retry', 'anomaly') or jsonb_typeof(p_details) <> 'object' then
    raise exception 'BILLING_V3_RECONCILIATION_RESULT_INVALID';
  end if;
  update public.provider_billing_records set reconciliation_status = p_status,
    next_reconcile_at = p_next_reconcile_at,
    raw_record = raw_record || jsonb_build_object('reconciliation', p_details),
    updated_at = clock_timestamp()
  where id = p_provider_billing_record_id and receipt_id is null;
  return found;
end;
$function$;

create function public.billing_v3_record_provider_anomaly(
  p_quote_id uuid,
  p_provider_request_id text,
  p_provider_task_id text,
  p_anomaly_type text,
  p_details jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_quote public.billing_quotes%rowtype;
  v_anomaly_id uuid;
begin
  if p_anomaly_type not like 'provider_record_%'
    or length(p_anomaly_type) > 120
    or jsonb_typeof(p_details) <> 'object' then
    raise exception 'BILLING_V3_PROVIDER_ANOMALY_INVALID';
  end if;
  select * into v_quote from public.billing_quotes where id = p_quote_id for update;
  if not found or v_quote.billing_engine <> 'v3_provider_authoritative' then
    raise exception 'BILLING_V3_QUOTE_INVALID';
  end if;
  insert into public.billing_anomalies (
    user_id, quote_id, request_idempotency_id, provider_key, model_id, upstream_model,
    anomaly_type, expected_cost_usd, observed_cost_usd, severity, details
  ) values (
    v_quote.user_id, v_quote.id, v_quote.request_idempotency_id, v_quote.provider_key,
    v_quote.model_id, v_quote.upstream_model, p_anomaly_type, 0, 0, 'critical',
    p_details || jsonb_build_object(
      'provider_request_id', p_provider_request_id,
      'provider_task_id', p_provider_task_id,
      'hold_retained', true
    )
  ) on conflict do nothing returning id into v_anomaly_id;
  if v_anomaly_id is null then
    select id into v_anomaly_id from public.billing_anomalies
    where quote_id = p_quote_id and anomaly_type = p_anomaly_type;
  end if;
  update public.provider_billing_records
  set reconciliation_status = 'anomaly',
      next_reconcile_at = clock_timestamp() + interval '15 minutes',
      raw_record = raw_record || jsonb_build_object('anomaly', p_details),
      updated_at = clock_timestamp()
  where quote_id = p_quote_id and receipt_id is null;
  return v_anomaly_id;
end;
$function$;

create or replace function public.billing_protect_provider_record_update()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if row(new.provider_key, new.quote_id, new.user_id, new.model_id,
    new.first_observed_at, new.created_at)
    is distinct from row(old.provider_key, old.quote_id, old.user_id, old.model_id,
    old.first_observed_at, old.created_at) then
    raise exception 'PROVIDER_BILLING_RECORD_IDENTITY_IMMUTABLE';
  end if;
  if (old.provider_request_id is not null and new.provider_request_id is distinct from old.provider_request_id)
    or (old.provider_task_id is not null and new.provider_task_id is distinct from old.provider_task_id)
    or (old.message_id is not null and new.message_id is distinct from old.message_id)
    or (old.generation_job_id is not null and new.generation_job_id is distinct from old.generation_job_id)
    or (old.receipt_id is not null and new.receipt_id is distinct from old.receipt_id) then
    raise exception 'PROVIDER_BILLING_RECORD_LINK_IMMUTABLE';
  end if;
  if old.settled and row(new.state, new.settled, new.credits_usd, new.currency,
    new.usage, new.source, new.provider_created_at, new.provider_completed_at)
    is distinct from row(old.state, old.settled, old.credits_usd, old.currency,
    old.usage, old.source, old.provider_created_at, old.provider_completed_at) then
    raise exception 'PROVIDER_BILLING_RECORD_SETTLEMENT_IMMUTABLE';
  end if;
  return new;
end;
$function$;

create trigger provider_billing_records_protect_update
before update on public.provider_billing_records
for each row execute function public.billing_protect_provider_record_update();

create or replace function public.billing_prevent_provider_record_delete()
returns trigger language plpgsql set search_path = '' as $function$
begin raise exception 'PROVIDER_BILLING_RECORD_IMMUTABLE'; end;
$function$;
create trigger provider_billing_records_prevent_delete
before delete on public.provider_billing_records
for each row execute function public.billing_prevent_provider_record_delete();

revoke all on function public.billing_v3_reserve_authorization(uuid,uuid,uuid,text,text,text,text,numeric,jsonb,text,jsonb) from public, anon, authenticated;
revoke all on function public.billing_v3_record_provider_observation(uuid,text,text,text,boolean,numeric,text,jsonb,text,jsonb,timestamptz,timestamptz,uuid,uuid) from public, anon, authenticated;
revoke all on function public.billing_v3_settle_provider_record(uuid,jsonb,uuid,uuid,jsonb) from public, anon, authenticated;
revoke all on function public.billing_v3_release_authoritative_failure(uuid,uuid,jsonb) from public, anon, authenticated;
revoke all on function public.billing_v3_claim_reconciliation_batch(integer) from public, anon, authenticated;
revoke all on function public.billing_v3_mark_reconciliation_retry(uuid,text,timestamptz,jsonb) from public, anon, authenticated;
revoke all on function public.billing_v3_record_provider_anomaly(uuid,text,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.billing_prevent_provider_record_delete() from public, anon, authenticated;
revoke all on function public.billing_protect_provider_record_update() from public, anon, authenticated;
grant execute on function public.billing_v3_reserve_authorization(uuid,uuid,uuid,text,text,text,text,numeric,jsonb,text,jsonb) to service_role;
grant execute on function public.billing_v3_record_provider_observation(uuid,text,text,text,boolean,numeric,text,jsonb,text,jsonb,timestamptz,timestamptz,uuid,uuid) to service_role;
grant execute on function public.billing_v3_settle_provider_record(uuid,jsonb,uuid,uuid,jsonb) to service_role;
grant execute on function public.billing_v3_release_authoritative_failure(uuid,uuid,jsonb) to service_role;
grant execute on function public.billing_v3_claim_reconciliation_batch(integer) to service_role;
grant execute on function public.billing_v3_mark_reconciliation_retry(uuid,text,timestamptz,jsonb) to service_role;
grant execute on function public.billing_v3_record_provider_anomaly(uuid,text,text,text,jsonb) to service_role;

comment on table public.billing_authorization_policies is
  'Billing V3 safe maximum wallet authorizations; these are not final provider pricing.';
comment on table public.provider_billing_records is
  'Service-role-only APIMODELS authoritative provider-cost observations and reconciliation state.';
comment on function public.billing_v3_settle_provider_record(uuid,jsonb,uuid,uuid,jsonb) is
  'Idempotently captures exact APIMODELS USD cost times frozen FX and markup without exceeding authorization.';
