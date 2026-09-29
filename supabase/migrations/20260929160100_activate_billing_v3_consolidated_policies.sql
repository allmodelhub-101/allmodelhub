-- Activate the already-approved consolidated Billing V3 authorization policies.
-- No pricing, markup, FX, routing, constraints, or historical policies change.

do $$
declare
  v_policy_count integer;
begin
  select count(*)
  into v_policy_count
  from public.billing_authorization_policies
  where policy_version = 'billing-v3-auth-2026-09-29-consolidated'
    and active = true;

  if v_policy_count <> 20 then
    raise exception
      'Expected exactly 20 active consolidated Billing V3 authorization policies, found %',
      v_policy_count;
  end if;
end
$$;

update public.billing_authorization_policies
set effective_from = least(effective_from, now() - interval '1 minute')
where policy_version = 'billing-v3-auth-2026-09-29-consolidated'
  and active = true;
