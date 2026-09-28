-- Preserve authoritative quote numerics as exact decimal strings when async
-- media settlement reloads a quote through PostgREST. Direct table reads may
-- decode NUMERIC as a JavaScript number, which is not acceptable for money.

create view public.billing_media_settlement_quotes
with (security_invoker = true)
as
select
  id,
  user_id,
  provider_key,
  model_id,
  upstream_model,
  pricing_version,
  internal_usd_pkr_rate::text as internal_usd_pkr_rate,
  reservation_credits::text as reservation_credits,
  created_at,
  input_dimensions,
  pricing_snapshot
from public.billing_quotes;

revoke all on table public.billing_media_settlement_quotes
  from public, anon, authenticated;
grant select on table public.billing_media_settlement_quotes
  to service_role;

comment on view public.billing_media_settlement_quotes is
  'Service-role-only exact-decimal Billing V2 quote projection for async media settlement.';
