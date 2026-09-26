-- JSONB numeric settings are projected as text so the server never needs to
-- pass the authoritative FX rate through a JavaScript Number.
create view public.billing_internal_fx_registry
with (security_invoker = true)
as
select
  key,
  value #>> '{}' as decimal_value,
  updated_at
from public.system_settings
where key = 'internal_usd_pkr';

revoke all on table public.billing_internal_fx_registry
  from public, anon, authenticated;
grant select on table public.billing_internal_fx_registry
  to service_role;

comment on view public.billing_internal_fx_registry is
  'Service-role-only exact-decimal projection of the configured internal USD/PKR rate.';
