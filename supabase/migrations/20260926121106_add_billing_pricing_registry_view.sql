-- Preserve PostgreSQL NUMERIC values as exact decimal strings across the
-- PostgREST boundary. This view is service-role-only and does not expose model
-- pricing to browser clients.
create view public.billing_provider_pricing_registry
with (security_invoker = true)
as
select
  rule.id,
  rule.provider_key,
  rule.model_id,
  rule.upstream_model,
  rule.pricing_version,
  rule.billing_type,
  rule.currency,
  rule.input_token_price::text as input_token_price,
  rule.output_token_price::text as output_token_price,
  rule.cached_token_price::text as cached_token_price,
  rule.cache_write_token_price::text as cache_write_token_price,
  rule.flat_price::text as flat_price,
  rule.per_image_price::text as per_image_price,
  rule.per_second_price::text as per_second_price,
  rule.per_minute_price::text as per_minute_price,
  rule.per_1k_character_price::text as per_1k_character_price,
  rule.per_reference_image_price::text as per_reference_image_price,
  rule.resolution_dimensions,
  rule.quality_dimensions,
  rule.mode_dimensions,
  rule.input_type_dimensions,
  rule.formula,
  rule.metadata,
  rule.effective_from,
  rule.effective_until,
  rule.verified_at,
  rule.source_name,
  rule.source_url,
  rule.source_metadata,
  rule.status,
  rule.active,
  rule.created_at,
  rule.updated_at,
  model.markup::text as model_markup,
  model.active as model_active
from public.provider_pricing_rules rule
join public.models model on model.id = rule.model_id;

revoke all on table public.billing_provider_pricing_registry
  from public, anon, authenticated;
grant select on table public.billing_provider_pricing_registry
  to service_role;

comment on view public.billing_provider_pricing_registry is
  'Service-role-only exact-decimal projection for the Billing V2 provider-aware pricing registry.';
