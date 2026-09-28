-- Keep models without a current authoritative Billing V2 rule out of all
-- executable provider route. The pricing decision remains in the immutable
-- registry so admins can see the exact temporary-unavailable reason.

with latest_rules as (
  select distinct on (provider_key, model_id, upstream_model)
    provider_key,
    model_id,
    upstream_model,
    status,
    active,
    coalesce(
      formula ->> 'reason',
      metadata ->> 'block_reason',
      'Current authoritative provider pricing is unavailable.'
    ) as block_reason
  from public.provider_pricing_rules
  order by provider_key, model_id, upstream_model, effective_from desc, created_at desc
), blocked as (
  select *
  from latest_rules
  where status <> 'verified' or not active
)
update public.provider_models pm
set
  active = false,
  metadata = pm.metadata || jsonb_build_object(
    'billing_v2_executable', false,
    'billing_v2_status', 'temporarily_unavailable',
    'billing_v2_reason', blocked.block_reason
  )
from blocked
where pm.provider_key = blocked.provider_key
  and pm.model_id = blocked.model_id
  and pm.upstream_model = blocked.upstream_model;

with unavailable_models as (
  select distinct pm.model_id
  from public.provider_models pm
  where not pm.active
    and pm.metadata ->> 'billing_v2_status' = 'temporarily_unavailable'
    and not exists (
      select 1
      from public.provider_models enabled
      where enabled.model_id = pm.model_id
        and enabled.active
    )
)
update public.models m
set
  active = false,
  auto_eligible = false,
  capabilities = case
    when m.capabilities ? 'temporarily-unavailable' then m.capabilities
    else m.capabilities || '["temporarily-unavailable"]'::jsonb
  end,
  updated_at = now()
from unavailable_models unavailable
where m.id = unavailable.model_id;

do $$
begin
  if exists (
    with latest_rules as (
      select distinct on (provider_key, model_id, upstream_model)
        provider_key, model_id, upstream_model, status, active
      from public.provider_pricing_rules
      order by provider_key, model_id, upstream_model, effective_from desc, created_at desc
    )
    select 1
    from public.provider_models pm
    join latest_rules rule
      on rule.provider_key = pm.provider_key
     and rule.model_id = pm.model_id
     and rule.upstream_model = pm.upstream_model
    where pm.active
      and (rule.status <> 'verified' or not rule.active)
  ) then
    raise exception 'An executable provider route has non-verified Billing V2 pricing';
  end if;
end
$$;
