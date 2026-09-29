-- Preserve the Billing V3 provider-authoritative settlement contract while
-- making text wallet authorizations proportional to the enforced request token
-- ceiling. These rates authorize holds only; APIMODELS records remain the sole
-- final provider-cost authority.

with rates(model_id, input_usd_per_million, output_usd_per_million) as (
  values
    ('claude-fable-5-1', 5.0000::numeric, 25.0000::numeric),
    ('claude-haiku-4-5', 0.353::numeric, 1.765::numeric),
    ('claude-opus-5', 3.0000::numeric, 15.0000::numeric),
    ('claude-sonnet-4-6', 1.059::numeric, 5.295::numeric),
    ('claude-sonnet-5', 1.6000::numeric, 8.0000::numeric),
    ('deepseek-v4-flash', 0.297::numeric, 0.891::numeric),
    ('deepseek-v4-pro', 1.247::numeric, 3.742::numeric),
    ('gemini-3-8-flash', 0.450::numeric, 2.250::numeric),
    ('gemini-3-pro-preview', 1.600::numeric, 9.600::numeric),
    ('glm-5-3', 1.330::numeric, 4.180::numeric),
    ('gpt-5-6-luna', 0.160::numeric, 0.960::numeric),
    ('gpt-5-6-sol', 1.324::numeric, 6.618::numeric),
    ('gpt-5-6-terra', 0.551::numeric, 3.309::numeric),
    ('gpt-6-astra', 2.400::numeric, 12.000::numeric),
    ('grok-4-6', 1.500::numeric, 4.500::numeric),
    ('qwen3-7-plus', 0.360::numeric, 1.440::numeric),
    ('qwen3-8-flash', 0.150::numeric, 0.470::numeric),
    ('qwen3-8-max', 2.000::numeric, 6.000::numeric)
), current_policy as (
  select distinct on (p.model_id) p.*, r.input_usd_per_million, r.output_usd_per_million
  from public.billing_authorization_policies p
  join rates r using (model_id)
  where p.provider_key = 'apimodels' and p.modality = 'text' and p.active
  order by p.model_id, p.effective_from desc, p.created_at desc
)
insert into public.billing_authorization_policies (
  provider_key, model_id, upstream_model, modality, policy_version,
  maximum_provider_cost_usd, maximum_authorization_credits, fx_rate_snapshot,
  markup_snapshot, request_constraints, metadata, effective_from,
  effective_until, verified_at, active
)
select
  provider_key, model_id, upstream_model, modality,
  'billing-v3-auth-2026-09-29-request-bounded',
  maximum_provider_cost_usd, maximum_authorization_credits, fx_rate_snapshot,
  markup_snapshot, request_constraints,
  metadata || jsonb_build_object(
    'authorization_input_usd_per_million', input_usd_per_million::text,
    'authorization_output_usd_per_million', output_usd_per_million::text,
    'authorization_basis', 'request_token_ceiling'
  ),
  now() - interval '1 minute', null, now(), false
from current_policy
on conflict (provider_key, model_id, upstream_model, modality, policy_version) do nothing;

with text_models(model_id) as (
  values
    ('claude-fable-5-1'), ('claude-haiku-4-5'), ('claude-opus-5'),
    ('claude-sonnet-4-6'), ('claude-sonnet-5'), ('deepseek-v4-flash'),
    ('deepseek-v4-pro'), ('gemini-3-8-flash'), ('gemini-3-pro-preview'),
    ('glm-5-3'), ('gpt-5-6-luna'), ('gpt-5-6-sol'), ('gpt-5-6-terra'),
    ('gpt-6-astra'), ('grok-4-6'), ('qwen3-7-plus'),
    ('qwen3-8-flash'), ('qwen3-8-max')
)
update public.billing_authorization_policies p
set active = false, updated_at = now()
from text_models t
where p.model_id = t.model_id
  and p.provider_key = 'apimodels'
  and p.modality = 'text'
  and p.active
  and p.policy_version <> 'billing-v3-auth-2026-09-29-request-bounded';

update public.billing_authorization_policies
set active = true, updated_at = now()
where policy_version = 'billing-v3-auth-2026-09-29-request-bounded'
  and modality = 'text' and not active;

do $$
declare v_count integer;
begin
  select count(*) into v_count
  from public.billing_authorization_policies
  where policy_version = 'billing-v3-auth-2026-09-29-request-bounded'
    and modality = 'text' and active;
  if v_count <> 18 then
    raise exception 'Expected 18 request-bounded active text policies, found %', v_count;
  end if;
end
$$;
