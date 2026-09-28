-- Re-enable the Qwen 3.8 text routes after APIMODELS published complete,
-- non-conflicting input, output, and cached-input prices on the individual
-- model pages. Rates are stored per token (published per-million rate / 1e6).

insert into public.provider_pricing_rules (
  provider_key, model_id, upstream_model, pricing_version, billing_type, currency,
  input_token_price, output_token_price, cached_token_price,
  formula, metadata, effective_from, verified_at, source_name, source_url,
  source_metadata, status, active
)
values
  (
    'apimodels', 'qwen3-8-flash', 'qwen3.8-flash',
    'apimodels-qwen-3-8-flash-2026-09-28', 'token', 'USD',
    0.00000015, 0.00000047, 0.000000016,
    '{}'::jsonb,
    '{"reasoning_billing":"reasoning tokens are included in provider completion tokens","cache_write_supported":false}'::jsonb,
    '2026-09-28T00:00:00Z', '2026-09-28T00:00:00Z',
    'APIMODELS Qwen3.8 Flash', 'https://apimodels.app/models/qwen3.8-flash',
    '{"published_unit":"per_1m_tokens","input":"0.15","output":"0.47","cached_input":"0.016","last_updated":"2026-09-12","verified_by":"billing-v2-production-fix"}'::jsonb,
    'verified', true
  ),
  (
    'apimodels', 'qwen3-8-max', 'qwen3.8-max',
    'apimodels-qwen-3-8-max-2026-09-28', 'token', 'USD',
    0.000002, 0.000006, 0.00000025,
    '{}'::jsonb,
    '{"reasoning_billing":"reasoning tokens are included in provider completion tokens","cache_write_supported":false}'::jsonb,
    '2026-09-28T00:00:00Z', '2026-09-28T00:00:00Z',
    'APIMODELS Qwen3.8 Max', 'https://apimodels.app/models/qwen3.8-max',
    '{"published_unit":"per_1m_tokens","input":"2.00","output":"6.00","cached_input":"0.25","last_updated":"2026-09-12","verified_by":"billing-v2-production-fix"}'::jsonb,
    'verified', true
  )
on conflict (provider_key, model_id, upstream_model, pricing_version) do nothing;

update public.provider_models
set
  active = true,
  metadata = (metadata - 'billing_v2_reason' - 'billing_v2_status') ||
    jsonb_build_object('billing_v2_executable', true)
where provider_key = 'apimodels'
  and (model_id, upstream_model) in (
    ('qwen3-8-flash', 'qwen3.8-flash'),
    ('qwen3-8-max', 'qwen3.8-max')
  );

update public.models
set
  active = true,
  auto_eligible = true,
  capabilities = capabilities - 'temporarily-unavailable',
  updated_at = now()
where id in ('qwen3-8-flash', 'qwen3-8-max');

do $$
declare
  verified_count integer;
begin
  select count(*) into verified_count
  from public.provider_pricing_rules rule
  join public.provider_models route
    on route.provider_key = rule.provider_key
   and route.model_id = rule.model_id
   and route.upstream_model = rule.upstream_model
  where rule.provider_key = 'apimodels'
    and rule.pricing_version in (
      'apimodels-qwen-3-8-flash-2026-09-28',
      'apimodels-qwen-3-8-max-2026-09-28'
    )
    and rule.status = 'verified'
    and rule.active
    and route.active;

  if verified_count <> 2 then
    raise exception 'Qwen 3.8 Billing V2 route activation failed: % of 2 routes verified', verified_count;
  end if;
end
$$;
