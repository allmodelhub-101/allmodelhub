-- Bind executable image workflows to current APIMODELS request contracts.
-- These prices size temporary authorizations only; provider records remain the
-- sole final settlement authority.

insert into public.provider_pricing_rules (
  provider_key, model_id, upstream_model, pricing_version, billing_type, currency,
  per_image_price, per_reference_image_price, resolution_dimensions, mode_dimensions, formula, metadata,
  effective_from, verified_at, source_name, source_url, source_metadata, status, active
)
values
  ('apimodels', 'doubao-seedream-5-0-pro', 'doubao-seedream-5-0-pro', 'apimodels-image-2026-09-29', 'image', 'USD', 0, null,
   '{"1K":{"perImage":"0.03"},"2K":{"perImage":"0.06"}}'::jsonb,
   '{"create":{"multiplier":"1"},"edit":{"multiplier":"1"}}'::jsonb, '{}'::jsonb,
   '{"authorization_only":true,"failed_requests_billable":false}'::jsonb,
   '2026-09-29T20:00:00Z', now(), 'APIMODELS Seedream 5.0 Pro', 'https://apimodels.app/docs/seedream-5-0-pro',
   '{"verified_by":"media-runtime-repair"}'::jsonb, 'verified', true),
  ('apimodels', 'gpt-image-2', 'gpt-image-2', 'apimodels-gpt-image-2-2026-09-29', 'image', 'USD', 0, null,
   '{"1K":{"perImage":"0.025"},"2K":{"perImage":"0.03"},"4K":{"perImage":"0.05"}}'::jsonb,
   '{"create":{"multiplier":"1"},"edit":{"multiplier":"1"}}'::jsonb, '{}'::jsonb,
   '{"authorization_only":true,"failed_requests_billable":false}'::jsonb,
   '2026-09-29T20:00:00Z', now(), 'APIMODELS GPT Image 2', 'https://apimodels.app/docs/gpt-image-2',
   '{"verified_by":"media-runtime-repair"}'::jsonb, 'verified', true),
  ('apimodels', 'qwen3-image-pro', 'qwen3-image-pro', 'apimodels-image-2026-09-29', 'image', 'USD', 0, 0.004,
   '{"1K":{"perImage":"0.037"},"2K":{"perImage":"0.075"}}'::jsonb,
   '{"create":{"multiplier":"1"},"edit":{"multiplier":"1"}}'::jsonb, '{}'::jsonb,
   '{"authorization_only":true,"failed_requests_billable":false}'::jsonb,
   '2026-09-29T20:00:00Z', now(), 'APIMODELS Qwen Image 3 Pro', 'https://apimodels.app/models/qwen3-image-pro',
   '{"verified_by":"media-runtime-repair"}'::jsonb, 'verified', true)
on conflict (provider_key, model_id, upstream_model, pricing_version) do nothing;

update public.models set ui_schema = case id
  when 'doubao-seedream-5-0-pro' then '{"inputModes":["text","image"],"resolutionOptions":["1K","2K"],"aspectRatios":["1:1","4:3","3:4","16:9","9:16","3:2","2:3","5:4","4:5","21:9"],"maxReferences":10}'::jsonb
  when 'flux-2-klein-4b' then '{"inputModes":["text","image"],"aspectRatios":["1:1","16:9","9:16","4:3","3:4"],"maxReferences":3}'::jsonb
  when 'gpt-image-2' then '{"inputModes":["text","image"],"resolutionOptions":["1K","2K","4K"],"aspectRatios":["1:1","2:3","3:2","4:3","3:4","16:9","9:16","21:9"],"maxReferences":16}'::jsonb
  when 'kling-v3-image' then '{"inputModes":["text","image"],"resolutionOptions":["1K","2K"],"aspectRatios":["1:1","16:9","9:16","4:3","3:4","3:2","2:3","5:4","4:5","21:9"],"maxReferences":1}'::jsonb
  when 'qwen3-image' then '{"inputModes":["text","image"],"resolutionOptions":["1K","2K"],"aspectRatios":["1:1","3:2","2:3","4:3","3:4","16:9","9:16","21:9"],"maxReferences":3}'::jsonb
  when 'qwen3-image-pro' then '{"inputModes":["text","image"],"resolutionOptions":["1K","2K"],"aspectRatios":["1:1","3:2","2:3","4:3","3:4","16:9","9:16","21:9"],"maxReferences":3}'::jsonb
  else ui_schema end
where id in ('doubao-seedream-5-0-pro','flux-2-klein-4b','gpt-image-2','kling-v3-image','qwen3-image','qwen3-image-pro');

update public.billing_authorization_policies
set request_constraints = case model_id
  when 'doubao-seedream-5-0-pro' then '{"maxCharacters":"20000","maxImages":"1","maxReferences":"10","allowedResolutions":["1K","2K"],"allowedInputTypes":["text","image"],"allowedAspectRatios":["1:1","4:3","3:4","16:9","9:16","3:2","2:3","5:4","4:5","21:9"]}'::jsonb
  when 'flux-2-klein-4b' then '{"maxCharacters":"20000","maxImages":"1","maxReferences":"3","allowedInputTypes":["text","image"],"allowedAspectRatios":["1:1","16:9","9:16","4:3","3:4"]}'::jsonb
  when 'gemini-2-5-flash-image' then '{"maxCharacters":"20000","maxImages":"1","maxReferences":"1","allowedInputTypes":["text","image"],"allowedAspectRatios":["1:1","16:9","9:16","4:3","3:4"]}'::jsonb
  when 'gpt-image-2' then '{"maxCharacters":"20000","maxImages":"1","maxReferences":"16","allowedResolutions":["1K","2K","4K"],"allowedInputTypes":["text","image"],"allowedAspectRatios":["1:1","2:3","3:2","4:3","3:4","16:9","9:16","21:9"]}'::jsonb
  when 'kling-v3-image' then '{"maxCharacters":"20000","maxImages":"1","maxReferences":"1","allowedResolutions":["1K","2K"],"allowedInputTypes":["text","image"],"allowedAspectRatios":["1:1","16:9","9:16","4:3","3:4","3:2","2:3","5:4","4:5","21:9"]}'::jsonb
  when 'qwen3-image' then '{"maxCharacters":"20000","maxImages":"1","maxReferences":"3","allowedResolutions":["1K","2K"],"allowedInputTypes":["text","image"],"allowedAspectRatios":["1:1","3:2","2:3","4:3","3:4","16:9","9:16","21:9"]}'::jsonb
  when 'qwen3-image-pro' then '{"maxCharacters":"20000","maxImages":"1","maxReferences":"3","allowedResolutions":["1K","2K"],"allowedInputTypes":["text","image"],"allowedAspectRatios":["1:1","3:2","2:3","4:3","3:4","16:9","9:16","21:9"]}'::jsonb
  when 'real-esrgan' then '{"maxCharacters":"20000","maxImages":"1","maxReferences":"1","allowedResolutions":["4K","8K","10K"],"allowedInputTypes":["image"]}'::jsonb
  else request_constraints end
where active and modality = 'image' and model_id in
  ('doubao-seedream-5-0-pro','flux-2-klein-4b','gemini-2-5-flash-image','gpt-image-2','kling-v3-image','qwen3-image','qwen3-image-pro','real-esrgan');

do $$
declare v_rules integer; v_policies integer;
begin
  select count(*) into v_rules from public.provider_pricing_rules
   where provider_key='apimodels' and active and status='verified' and model_id in
    ('doubao-seedream-5-0-pro','flux-2-klein-4b','gemini-2-5-flash-image','gpt-image-2','kling-v3-image','qwen3-image','qwen3-image-pro','real-esrgan');
  select count(*) into v_policies from public.billing_authorization_policies
   where active and modality='image' and model_id in
    ('doubao-seedream-5-0-pro','flux-2-klein-4b','gemini-2-5-flash-image','gpt-image-2','kling-v3-image','qwen3-image','qwen3-image-pro','real-esrgan');
  if v_rules <> 8 or v_policies <> 8 then
    raise exception 'Image repair expected 8 verified rules and 8 active policies; found % and %', v_rules, v_policies;
  end if;
end $$;
