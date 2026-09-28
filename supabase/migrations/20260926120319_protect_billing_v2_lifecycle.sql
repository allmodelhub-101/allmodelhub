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
    new.expires_at, new.created_at
  ) is distinct from row(
    old.user_id, old.request_idempotency_id, old.pricing_rule_id,
    old.provider_key, old.model_id, old.upstream_model, old.pricing_version,
    old.pricing_status, old.internal_usd_pkr_rate,
    old.estimated_provider_cost_usd, old.customer_quote_credits,
    old.reservation_credits, old.input_dimensions, old.pricing_snapshot,
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

create function public.billing_protect_pricing_version()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if row(
    new.provider_key, new.model_id, new.upstream_model, new.pricing_version,
    new.billing_type, new.currency, new.input_token_price,
    new.output_token_price, new.cached_token_price, new.cache_write_token_price,
    new.flat_price, new.per_image_price, new.per_second_price,
    new.per_minute_price, new.per_1k_character_price,
    new.per_reference_image_price, new.resolution_dimensions,
    new.quality_dimensions, new.mode_dimensions, new.input_type_dimensions,
    new.formula, new.metadata, new.effective_from, new.source_name,
    new.source_url, new.source_metadata, new.created_at
  ) is distinct from row(
    old.provider_key, old.model_id, old.upstream_model, old.pricing_version,
    old.billing_type, old.currency, old.input_token_price,
    old.output_token_price, old.cached_token_price, old.cache_write_token_price,
    old.flat_price, old.per_image_price, old.per_second_price,
    old.per_minute_price, old.per_1k_character_price,
    old.per_reference_image_price, old.resolution_dimensions,
    old.quality_dimensions, old.mode_dimensions, old.input_type_dimensions,
    old.formula, old.metadata, old.effective_from, old.source_name,
    old.source_url, old.source_metadata, old.created_at
  ) then
    raise exception 'BILLING_PRICING_VERSION_IMMUTABLE';
  end if;

  return new;
end;
$function$;

create trigger provider_pricing_rules_protect_version
before update on public.provider_pricing_rules
for each row execute function public.billing_protect_pricing_version();

create trigger provider_pricing_rules_prevent_delete
before delete on public.provider_pricing_rules
for each row execute function public.billing_prevent_mutation();

revoke all on function public.billing_protect_pricing_version()
  from public, anon, authenticated;
