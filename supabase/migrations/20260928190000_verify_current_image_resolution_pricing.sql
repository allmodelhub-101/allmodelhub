-- Current APIMODELS image documentation now publishes complete per-image
-- resolution contracts for these routes. Each pricing rule requires the same
-- resolution passed to the provider; any absent or unsupported resolution is
-- rejected by the registry before a provider request is made.

insert into public.provider_pricing_rules (
  provider_key, model_id, upstream_model, pricing_version, billing_type, currency,
  per_image_price, resolution_dimensions, formula, metadata, effective_from, verified_at,
  source_name, source_url, source_metadata, status, active
)
values
  (
    'apimodels', 'doubao-seedream-5-0-pro', 'doubao-seedream-5-0-pro',
    'apimodels-seedream-5-pro-2026-09-28', 'image', 'USD', 0,
    '{"1K":{"perImage":"0.03"},"2K":{"perImage":"0.06"}}'::jsonb,
    '{}'::jsonb,
    '{"usage_basis":"successful_single_output","supported_input_types":["text","image"],"references":"included_in_price"}'::jsonb,
    '2026-09-28T19:00:00Z', '2026-09-28T19:00:00Z',
    'APIMODELS Doubao Seedream 5.0 Pro', 'https://apimodels.app/docs/seedream-5-0-pro',
    '{"published_unit":"per_image","1K":"0.03","2K":"0.06","verified_by":"billing-v2-current-provider-audit"}'::jsonb,
    'verified', true
  ),
  (
    'apimodels', 'gemini-3-1-flash-image', 'gemini-3.1-flash-image',
    'apimodels-gemini-3-1-flash-image-2026-09-28', 'image', 'USD', 0,
    '{"512":{"perImage":"0.04"},"1K":{"perImage":"0.06"},"2K":{"perImage":"0.06"},"4K":{"perImage":"0.10"}}'::jsonb,
    '{}'::jsonb,
    '{"usage_basis":"successful_single_output","supported_input_types":["text","image"],"references":"included_in_price"}'::jsonb,
    '2026-09-28T19:00:00Z', '2026-09-28T19:00:00Z',
    'APIMODELS Gemini Image API', 'https://apimodels.app/docs/gemini-image',
    '{"published_unit":"per_image","512":"0.04","1K":"0.06","2K":"0.06","4K":"0.10","verified_by":"billing-v2-current-provider-audit"}'::jsonb,
    'verified', true
  ),
  (
    'apimodels', 'gemini-3-pro-image', 'gemini-3-pro-image',
    'apimodels-gemini-3-pro-image-2026-09-28', 'image', 'USD', 0,
    '{"1K":{"perImage":"0.10"},"2K":{"perImage":"0.10"},"4K":{"perImage":"0.15"}}'::jsonb,
    '{}'::jsonb,
    '{"usage_basis":"successful_single_output","supported_input_types":["text","image"],"references":"included_in_price"}'::jsonb,
    '2026-09-28T19:00:00Z', '2026-09-28T19:00:00Z',
    'APIMODELS Gemini Image API', 'https://apimodels.app/docs/gemini-image',
    '{"published_unit":"per_image","1K":"0.10","2K":"0.10","4K":"0.15","verified_by":"billing-v2-current-provider-audit"}'::jsonb,
    'verified', true
  ),
  (
    'apimodels', 'gpt-image-2', 'gpt-image-2',
    'apimodels-gpt-image-2-2026-09-28', 'image', 'USD', 0,
    '{"1K":{"perImage":"0.025"},"2K":{"perImage":"0.03"},"4K":{"perImage":"0.05"}}'::jsonb,
    '{}'::jsonb,
    '{"usage_basis":"successful_single_output","supported_input_types":["text","image"],"references":"included_in_price"}'::jsonb,
    '2026-09-28T19:00:00Z', '2026-09-28T19:00:00Z',
    'APIMODELS GPT Image 2 API', 'https://apimodels.app/docs/gpt-image-2',
    '{"published_unit":"per_image","1K":"0.025","2K":"0.03","4K":"0.05","verified_by":"billing-v2-current-provider-audit"}'::jsonb,
    'verified', true
  )
on conflict (provider_key, model_id, upstream_model, pricing_version) do nothing;

update public.provider_models
set active = true,
    metadata = (metadata - 'billing_v2_reason' - 'billing_v2_status') ||
      jsonb_build_object('billing_v2_executable', true)
where provider_key = 'apimodels'
  and (model_id, upstream_model) in (
    ('doubao-seedream-5-0-pro', 'doubao-seedream-5-0-pro'),
    ('gemini-3-1-flash-image', 'gemini-3.1-flash-image'),
    ('gemini-3-pro-image', 'gemini-3-pro-image'),
    ('gpt-image-2', 'gpt-image-2')
  );

update public.models
set active = true,
    capabilities = capabilities - 'temporarily-unavailable',
    updated_at = now()
where id in ('doubao-seedream-5-0-pro', 'gemini-3-1-flash-image', 'gemini-3-pro-image', 'gpt-image-2');

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
  where rule.pricing_version in (
    'apimodels-seedream-5-pro-2026-09-28',
    'apimodels-gemini-3-1-flash-image-2026-09-28',
    'apimodels-gemini-3-pro-image-2026-09-28',
    'apimodels-gpt-image-2-2026-09-28'
  ) and rule.status = 'verified' and rule.active and route.active;

  if verified_count <> 4 then
    raise exception 'Current image Billing V2 route activation failed: % of 4 routes verified', verified_count;
  end if;
end
$$;
