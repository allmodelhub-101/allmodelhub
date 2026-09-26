do $billing_v2_schema$
declare
  v_table text;
begin
  foreach v_table in array array[
    'provider_pricing_rules',
    'billing_quotes',
    'billing_usage_events',
    'billing_receipts',
    'billing_anomalies'
  ] loop
    if to_regclass('public.' || v_table) is null then
      raise exception 'Missing Billing V2 table: %', v_table;
    end if;

    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = v_table
        and c.relrowsecurity
        and c.relforcerowsecurity
    ) then
      raise exception 'Billing V2 table lacks forced RLS: %', v_table;
    end if;

    if has_table_privilege('anon', 'public.' || v_table, 'SELECT')
      or has_table_privilege('authenticated', 'public.' || v_table, 'SELECT')
      or has_table_privilege('authenticated', 'public.' || v_table, 'INSERT')
      or has_table_privilege('authenticated', 'public.' || v_table, 'UPDATE')
      or has_table_privilege('authenticated', 'public.' || v_table, 'DELETE') then
      raise exception 'Billing V2 table is exposed to a client role: %', v_table;
    end if;
  end loop;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.provider_pricing_rules'::regclass
      and conname = 'provider_pricing_rules_active_window_excl'
      and contype = 'x'
  ) then
    raise exception 'Missing active pricing overlap exclusion constraint';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.billing_receipts'::regclass
      and tgname = 'billing_receipts_immutable'
      and not tgisinternal
  ) then
    raise exception 'Missing immutable receipt trigger';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.provider_pricing_rules'::regclass
      and tgname = 'provider_pricing_rules_protect_version'
      and not tgisinternal
  ) then
    raise exception 'Missing immutable pricing version trigger';
  end if;

  if position(
    'GENERATION_SETTLEMENT_CONFLICT'
    in pg_get_functiondef('public.complete_generation_job(uuid,numeric,jsonb,jsonb,jsonb)'::regprocedure)
  ) = 0 then
    raise exception 'Immutable generation settlement conflict protection is missing';
  end if;
end;
$billing_v2_schema$;
