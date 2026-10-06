-- V3 owns its authorization definitions. Historical V2 records remain untouched.
insert into public.system_settings (key, value)
select replace(key, 'billing_v2_', 'billing_'), value
from public.system_settings
where key in ('billing_v2_wallet_reservation_quantum_credits', 'billing_v2_quote_ttl_seconds')
on conflict (key) do nothing;

-- One-time import of already verified authorization evidence, not a live dependency.
update public.billing_authorization_policies p
set metadata = p.metadata || jsonb_build_object('media_authorization_pricing', to_jsonb(r))
from public.billing_provider_pricing_registry r
where p.modality <> 'text' and p.active and r.active and r.status = 'verified'
  and r.provider_key = p.provider_key and r.model_id = p.model_id
  and r.upstream_model = p.upstream_model
  and r.pricing_version = p.metadata->>'derived_from_verified_pricing_version';

create or replace view public.billing_v3_authorization_registry
with (security_invoker = true) as
select p.id, p.provider_key, p.model_id, p.upstream_model, p.modality, p.policy_version,
  p.maximum_provider_cost_usd::text as maximum_provider_cost_usd,
  (ceil(p.maximum_provider_cost_usd * fx.rate * m.markup / q.quantum) * q.quantum)::text as maximum_authorization_credits,
  p.request_constraints, p.metadata,
  m.markup::text as model_markup, fx.rate::text as internal_usd_pkr_rate
from public.billing_authorization_policies p
join public.models m on m.id = p.model_id and m.active
join public.provider_models route on route.provider_key = p.provider_key
  and route.model_id = p.model_id and route.upstream_model = p.upstream_model and route.active
cross join lateral (select (value #>> '{}')::numeric rate from public.system_settings where key = 'internal_usd_pkr') fx
cross join lateral (select (value #>> '{}')::numeric quantum from public.system_settings where key = 'billing_wallet_reservation_quantum_credits') q
where p.active and p.effective_from <= clock_timestamp()
  and (p.effective_until is null or p.effective_until > clock_timestamp())
  and fx.rate > 0 and q.quantum > 0 and m.markup >= 1;

create or replace function public.billing_v3_reserve_authorization(
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
  -- Serialize retries before checking for an existing quote/hold.
  select * into v_claim from public.request_idempotency where id = p_request_idempotency_id for update;
  select * into v_existing from public.billing_quotes where request_idempotency_id = p_request_idempotency_id;
  if found then
    if v_existing.user_id is distinct from p_user_id
      or v_existing.billing_engine <> 'v3_provider_authoritative'
      or v_existing.provider_key is distinct from p_provider_key
      or v_existing.model_id is distinct from p_model_id
      or v_existing.upstream_model is distinct from p_upstream_model
      or v_existing.input_dimensions is distinct from p_input_dimensions
      or v_existing.status not in ('reserved', 'accepted') then
      raise exception 'BILLING_V3_AUTHORIZATION_CONFLICT';
    end if;
    return jsonb_build_object(
      'quote_id', v_existing.id, 'wallet_hold_id', v_existing.wallet_hold_id,
      'expires_at', v_existing.expires_at,
      'authorization_credits', v_existing.reservation_credits::text,
      'estimated_credits', v_existing.customer_quote_credits::text,
      'fx', v_existing.internal_usd_pkr_rate::text, 'markup', v_existing.frozen_markup::text
    );
  end if;

  if v_claim.id is null or v_claim.user_id is distinct from p_user_id or v_claim.status <> 'processing' then
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
    where key = 'billing_wallet_reservation_quantum_credits';
  select (value #>> '{}')::integer into v_ttl from public.system_settings where key = 'billing_quote_ttl_seconds';
  if v_fx is null or v_fx <= 0 or v_quantum is null or v_quantum <= 0
    or v_ttl is null or v_ttl < 1 or v_ttl > 3600 then
    raise exception 'BILLING_V3_CONFIGURATION_UNAVAILABLE';
  end if;
  -- Current economics are frozen per quote, never per model policy.
  -- A concurrent Admin update asks this request to refresh, without disabling a model.
  if (p_hold_metadata->>'authorization_fx')::numeric is distinct from v_fx
    or (p_hold_metadata->>'authorization_markup')::numeric is distinct from v_model.markup then
    raise exception 'BILLING_V3_QUOTE_ECONOMICS_CHANGED';
  end if;
  if (p_hold_metadata->>'authorization_provider_cost_usd')::numeric is null
    or (p_hold_metadata->>'authorization_provider_cost_usd')::numeric <= 0
    or (p_hold_metadata->>'authorization_provider_cost_usd')::numeric > v_policy.maximum_provider_cost_usd
    or p_authorization_credits is distinct from
      ceil(((p_hold_metadata->>'authorization_provider_cost_usd')::numeric * v_fx * v_model.markup) / v_quantum) * v_quantum then
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
    v_fx, (p_hold_metadata->>'authorization_provider_cost_usd')::numeric,
    (p_hold_metadata->>'authorization_provider_cost_usd')::numeric * v_fx * v_model.markup, p_authorization_credits, p_input_dimensions,
    jsonb_build_object(
      'billingEngine', 'v3_provider_authoritative',
      'authorizationPolicyId', v_policy.id,
      'authorizationPolicyVersion', v_policy.policy_version,
      'authorizationCredits', p_authorization_credits::text,
      'maximumAuthorizationCredits', (ceil(v_policy.maximum_provider_cost_usd * v_fx * v_model.markup / v_quantum) * v_quantum)::text,
      'internalUsdPkrRate', v_fx::text,
      'reservationQuantumCredits', v_quantum::text,
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
    'authorization_credits', p_authorization_credits::text,
    'estimated_credits', ((p_hold_metadata->>'authorization_provider_cost_usd')::numeric * v_fx * v_model.markup)::text,
    'fx', v_fx::text, 'markup', v_model.markup::text
  );
end;
$function$;

-- Only exact documented non-token strategies are activated here.
update public.billing_authorization_policies set active = false, effective_until = now()
where modality = 'video' and active and model_id in ('ltx-2-3','grok-imagine-video-1-5','minimax-h3-max-turbo','wan-3-0-video','flashvsr');

update public.provider_models set active = true
where provider_key = 'apimodels' and (model_id, upstream_model) in (('ltx-2-3','ltx-2.3'),('grok-imagine-video-1-5','grok-imagine-video-1.5'),('minimax-h3-max-turbo','minimax-h3-max-turbo'),('wan-3-0-video','wan-3.0-video'),('flashvsr','flashvsr'));

with definitions(model_id, upstream_model, ceiling, constraints, metadata) as (values
('ltx-2-3', 'ltx-2.3', 0.9::numeric, '{"maxCharacters":"20000","maxSeconds":"20","maxOutputDuration":"20","maxInputDuration":"0","maxReferences":"1","maxImages":"1","allowedResolutions":["480p","720p","1080p"],"allowedInputTypes":["text","image"],"allowedAspectRatios":["16:9","9:16"]}'::jsonb, '{"derived_from_verified_pricing_version":"apimodels-video-v3-2026-10-06","media_authorization_pricing":{"id":"v3-ltx-2-3","provider_key":"apimodels","model_id":"ltx-2-3","upstream_model":"ltx-2.3","pricing_version":"apimodels-video-v3-2026-10-06","billing_type":"time","currency":"USD","input_token_price":null,"output_token_price":null,"cached_token_price":null,"cache_write_token_price":null,"flat_price":"0","per_image_price":null,"per_second_price":null,"per_minute_price":null,"per_1k_character_price":null,"per_reference_image_price":null,"resolution_dimensions":{"480p":{"perSecond":"0.02"},"720p":{"perSecond":"0.04"},"1080p":{"perSecond":"0.045"}},"quality_dimensions":{},"mode_dimensions":{},"input_type_dimensions":{},"formula":{},"metadata":{"authorization_only":true},"effective_from":"2026-10-05T00:00:00Z","effective_until":null,"verified_at":"2026-10-06T00:00:00Z","source_name":"APIMODELS current video documentation","source_url":"https://apimodels.app/docs/ltx-2-3","source_metadata":{"verified_by":"video-v3-runtime-repair"},"status":"verified","active":true},"final_cost_authority":"apimodels_records_api","execution_strategy":"apimodels_video_async","source_url":"https://apimodels.app/docs/ltx-2-3"}'::jsonb),
('grok-imagine-video-1-5', 'grok-imagine-video-1.5', 1.323::numeric, '{"maxCharacters":"4096","maxSeconds":"15","maxOutputDuration":"15","maxInputDuration":"0","maxReferences":"7","maxImages":"1","allowedResolutions":["480p","720p","1080p"],"allowedInputTypes":["text","image"],"allowedAspectRatios":["16:9","9:16","1:1","3:2","2:3"]}'::jsonb, '{"derived_from_verified_pricing_version":"apimodels-video-v3-2026-10-06","media_authorization_pricing":{"id":"v3-grok-imagine-video-1-5","provider_key":"apimodels","model_id":"grok-imagine-video-1-5","upstream_model":"grok-imagine-video-1.5","pricing_version":"apimodels-video-v3-2026-10-06","billing_type":"time","currency":"USD","input_token_price":null,"output_token_price":null,"cached_token_price":null,"cache_write_token_price":null,"flat_price":"0","per_image_price":null,"per_second_price":null,"per_minute_price":null,"per_1k_character_price":null,"per_reference_image_price":null,"resolution_dimensions":{"480p":{"perSecond":"0.0294"},"720p":{"perSecond":"0.0529"},"1080p":{"perSecond":"0.0882"}},"quality_dimensions":{},"mode_dimensions":{},"input_type_dimensions":{},"formula":{},"metadata":{"authorization_only":true},"effective_from":"2026-10-05T00:00:00Z","effective_until":null,"verified_at":"2026-10-06T00:00:00Z","source_name":"APIMODELS current video documentation","source_url":"https://apimodels.app/docs/grok-imagine-video","source_metadata":{"verified_by":"video-v3-runtime-repair"},"status":"verified","active":true},"final_cost_authority":"apimodels_records_api","execution_strategy":"apimodels_video_async","source_url":"https://apimodels.app/docs/grok-imagine-video"}'::jsonb),
('minimax-h3-max-turbo', 'minimax-h3-max-turbo', 1.44::numeric, '{"maxCharacters":"20000","maxSeconds":"15","maxOutputDuration":"15","maxInputDuration":"0","maxReferences":"2","maxImages":"1","allowedResolutions":["480p","768p"],"allowedInputTypes":["text","image"],"allowedAspectRatios":["16:9","9:16","1:1","4:3","3:4","21:9"]}'::jsonb, '{"derived_from_verified_pricing_version":"apimodels-video-v3-2026-10-06","media_authorization_pricing":{"id":"v3-minimax-h3-max-turbo","provider_key":"apimodels","model_id":"minimax-h3-max-turbo","upstream_model":"minimax-h3-max-turbo","pricing_version":"apimodels-video-v3-2026-10-06","billing_type":"time","currency":"USD","input_token_price":null,"output_token_price":null,"cached_token_price":null,"cache_write_token_price":null,"flat_price":"0","per_image_price":null,"per_second_price":null,"per_minute_price":null,"per_1k_character_price":null,"per_reference_image_price":null,"resolution_dimensions":{"480p":{"perSecond":"0.06"},"768p":{"perSecond":"0.096"}},"quality_dimensions":{},"mode_dimensions":{},"input_type_dimensions":{},"formula":{},"metadata":{"authorization_only":true},"effective_from":"2026-10-05T00:00:00Z","effective_until":null,"verified_at":"2026-10-06T00:00:00Z","source_name":"APIMODELS current video documentation","source_url":"https://apimodels.app/docs/minimax-h3-max-turbo","source_metadata":{"verified_by":"video-v3-runtime-repair"},"status":"verified","active":true},"final_cost_authority":"apimodels_records_api","execution_strategy":"apimodels_video_async","source_url":"https://apimodels.app/docs/minimax-h3-max-turbo"}'::jsonb),
('wan-3-0-video', 'wan-3.0-video', 5.4::numeric, '{"maxCharacters":"20000","maxSeconds":"30","maxOutputDuration":"30","maxInputDuration":"15","maxReferences":"10","maxImages":"1","allowedResolutions":["480p","720p","1080p"],"allowedInputTypes":["text","image","video","audio"],"allowedAspectRatios":["adaptive","16:9","4:3","1:1","3:4","9:16"],"allowedNativeAudio":[false,true]}'::jsonb, '{"derived_from_verified_pricing_version":"apimodels-video-v3-2026-10-06","media_authorization_pricing":{"id":"v3-wan-3-0-video","provider_key":"apimodels","model_id":"wan-3-0-video","upstream_model":"wan-3.0-video","pricing_version":"apimodels-video-v3-2026-10-06","billing_type":"time","currency":"USD","input_token_price":null,"output_token_price":null,"cached_token_price":null,"cache_write_token_price":null,"flat_price":"0","per_image_price":null,"per_second_price":null,"per_minute_price":null,"per_1k_character_price":null,"per_reference_image_price":null,"resolution_dimensions":{"480p":{"perSecond":"0.045"},"720p":{"perSecond":"0.09"},"1080p":{"perSecond":"0.18"}},"quality_dimensions":{},"mode_dimensions":{},"input_type_dimensions":{},"formula":{},"metadata":{"authorization_only":true},"effective_from":"2026-10-05T00:00:00Z","effective_until":null,"verified_at":"2026-10-06T00:00:00Z","source_name":"APIMODELS current video documentation","source_url":"https://apimodels.app/docs/wan-3-0-video","source_metadata":{"verified_by":"video-v3-runtime-repair"},"status":"verified","active":true},"final_cost_authority":"apimodels_records_api","execution_strategy":"apimodels_video_async","source_url":"https://apimodels.app/docs/wan-3-0-video"}'::jsonb),
('flashvsr', 'flashvsr', 36::numeric, '{"maxCharacters":"20000","maxSeconds":"600","maxOutputDuration":"600","maxInputDuration":"600","maxReferences":"0","maxImages":"1","allowedResolutions":["720p","1080p","2K","4K"],"allowedInputTypes":["video"],"allowedAspectRatios":[]}'::jsonb, '{"derived_from_verified_pricing_version":"apimodels-video-v3-2026-10-06","media_authorization_pricing":{"id":"v3-flashvsr","provider_key":"apimodels","model_id":"flashvsr","upstream_model":"flashvsr","pricing_version":"apimodels-video-v3-2026-10-06","billing_type":"time","currency":"USD","input_token_price":null,"output_token_price":null,"cached_token_price":null,"cache_write_token_price":null,"flat_price":"0","per_image_price":null,"per_second_price":null,"per_minute_price":null,"per_1k_character_price":null,"per_reference_image_price":null,"resolution_dimensions":{"720p":{"perSecond":"0.02"},"1080p":{"perSecond":"0.03"},"2K":{"perSecond":"0.035"},"4K":{"perSecond":"0.06"}},"quality_dimensions":{},"mode_dimensions":{},"input_type_dimensions":{},"formula":{},"metadata":{"authorization_only":true},"effective_from":"2026-10-05T00:00:00Z","effective_until":null,"verified_at":"2026-10-06T00:00:00Z","source_name":"APIMODELS current video documentation","source_url":"https://apimodels.app/docs/flashvsr","source_metadata":{"verified_by":"video-v3-runtime-repair"},"status":"verified","active":true},"final_cost_authority":"apimodels_records_api","execution_strategy":"apimodels_video_async","source_url":"https://apimodels.app/docs/flashvsr"}'::jsonb)
), settings as (
  select (select (value #>> '{}')::numeric from public.system_settings where key = 'internal_usd_pkr') fx,
    (select (value #>> '{}')::numeric from public.system_settings where key = 'billing_wallet_reservation_quantum_credits') quantum
)
insert into public.billing_authorization_policies (
  provider_key, model_id, upstream_model, modality, policy_version, maximum_provider_cost_usd,
  maximum_authorization_credits, fx_rate_snapshot, markup_snapshot, request_constraints, metadata, effective_from, active
)
select 'apimodels', d.model_id, d.upstream_model, 'video', 'billing-v3-video-runtime-2026-10-06',
  d.ceiling, ceil(d.ceiling * s.fx * m.markup / s.quantum) * s.quantum, s.fx, m.markup, d.constraints, d.metadata, now(), true
from definitions d join public.models m on m.id = d.model_id and m.active cross join settings s
where s.fx > 0 and s.quantum > 0
on conflict (provider_key, model_id, upstream_model, modality, policy_version) do nothing;

-- Media durations are server-inspected. The capability relay keeps user-files private.
alter table public.user_files add column if not exists media_metadata jsonb;
create table public.provider_input_assets (
  token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
  content_sha256 text not null check (content_sha256 ~ '^[a-f0-9]{64}$'),
  file_id uuid references public.user_files(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.provider_input_assets enable row level security;
alter table public.provider_input_assets force row level security;
revoke all on public.provider_input_assets from public, anon, authenticated;
grant all on public.provider_input_assets to service_role;
create index provider_input_assets_expiry_idx on public.provider_input_assets(expires_at);

-- Seedance remains fail-closed until exact provider token rates are verified.
-- These are current evidence gaps, not a migration-era model block list.

create or replace function public.billing_v3_settle_provider_record(
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
  if not found then raise exception 'BILLING_V3_QUOTE_NOT_SETTLEABLE'; end if;
  -- Different provider observations for the same quote can race. Recheck the
  -- receipt after the shared quote lock, not only after the record lock.
  select * into v_existing from public.billing_receipts where quote_id = v_record.quote_id;
  if found then return jsonb_build_object('status','settled','receipt_id',v_existing.id,
    'usage_event_id',v_existing.usage_event_id,'wallet_transaction_id',v_existing.wallet_transaction_id,
    'charge_credits',v_existing.charge_credits::text); end if;
  if exists(select 1 from public.billing_authorization_policies where id=v_quote.authorization_policy_id and modality='video')
    and v_record.source not in ('records_api','reconciliation') then
    raise exception 'BILLING_V3_VIDEO_RECORDS_AUTHORITY_REQUIRED';
  end if;
  if v_quote.billing_engine <> 'v3_provider_authoritative'
    or v_quote.status <> 'accepted' or v_quote.wallet_hold_id is null then
    raise exception 'BILLING_V3_QUOTE_NOT_SETTLEABLE';
  end if;
  p_message_id := coalesce(p_message_id, v_record.message_id);
  p_generation_job_id := coalesce(p_generation_job_id, v_record.generation_job_id);
  select (value #>> '{}')::numeric into v_quantum from public.system_settings
  where key = 'billing_wallet_reservation_quantum_credits';
  v_quantum := coalesce((v_quote.pricing_snapshot->>'reservationQuantumCredits')::numeric, v_quantum);
  if v_quantum is null or v_quantum <= 0 then raise exception 'BILLING_V3_QUANTUM_UNAVAILABLE'; end if;
  v_provider_pkr := v_record.credits_usd * v_quote.internal_usd_pkr_rate;
  v_charge := case when v_provider_pkr = 0 then 0 else ceil((v_provider_pkr * v_quote.frozen_markup) / v_quantum) * v_quantum end;
  v_profit := v_charge - v_provider_pkr;
  v_margin := case when v_charge = 0 then null else (v_profit / v_charge) * 100 end;
  if v_profit < 0 then raise exception 'BILLING_V3_NEGATIVE_MARGIN'; end if;
  if v_charge > v_quote.reservation_credits then
    if not exists(select 1 from public.billing_anomalies where quote_id=v_quote.id and anomaly_type='authorization_shortfall') then
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
    end if;
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
      error_message = null where id = p_generation_job_id
      and (modality <> 'video' or jsonb_array_length(coalesce(result_urls, '[]'::jsonb)) > 0);
  end if;
  return jsonb_build_object(
    'status', 'settled', 'receipt_id', v_receipt_id, 'usage_event_id', v_usage_id,
    'wallet_transaction_id', v_transaction_id, 'charge_credits', v_charge::text
  );
end;
$function$;

revoke all on function public.billing_v3_reserve_authorization(uuid,uuid,uuid,text,text,text,text,numeric,jsonb,text,jsonb) from public, anon, authenticated;
grant execute on function public.billing_v3_reserve_authorization(uuid,uuid,uuid,text,text,text,text,numeric,jsonb,text,jsonb) to service_role;
revoke all on function public.billing_v3_settle_provider_record(uuid,jsonb,uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.billing_v3_settle_provider_record(uuid,jsonb,uuid,uuid,jsonb) to service_role;
revoke all on public.billing_v3_authorization_registry from public, anon, authenticated;
grant select on public.billing_v3_authorization_registry to service_role;

