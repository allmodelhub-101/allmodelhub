-- Hotfix: the Billing V3 consolidation seeded 20 authorization policies
-- with an effective_from timestamp later than the Production cutover.
-- Make those policies effective immediately without changing pricing,
-- limits, markup snapshots, or historical records.

update public.billing_authorization_policies
set effective_from = least(effective_from, now())
where policy_version = 'billing-v3-auth-2026-09-29-consolidated'
  and active
  and effective_from > now();

do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.billing_authorization_policies
  where policy_version = 'billing-v3-auth-2026-09-29-consolidated'
    and active
    and effective_from <= now()
    and (effective_until is null or effective_until > now());

  if v_count <> 20 then
    raise exception 'Expected 20 effective consolidated Billing V3 policies, found %', v_count;
  end if;
end
$$;