do $billing_v2_schema$
declare
  v_table text;
begin
  if to_regclass('public.billing_provider_pricing_registry') is null
    or to_regclass('public.billing_internal_fx_registry') is null
    or to_regclass('public.billing_quote_policy_registry') is null then
    raise exception 'Missing Billing V2 exact-decimal registry view';
  end if;

  if has_table_privilege('anon', 'public.billing_provider_pricing_registry', 'SELECT')
    or has_table_privilege('authenticated', 'public.billing_provider_pricing_registry', 'SELECT')
    or has_table_privilege('authenticated', 'public.billing_internal_fx_registry', 'SELECT')
    or has_table_privilege('authenticated', 'public.billing_quote_policy_registry', 'SELECT') then
    raise exception 'Billing V2 registry view is exposed to a client role';
  end if;

  if not has_table_privilege('service_role', 'public.billing_provider_pricing_registry', 'SELECT')
    or not has_table_privilege('service_role', 'public.billing_internal_fx_registry', 'SELECT')
    or not has_table_privilege('service_role', 'public.billing_quote_policy_registry', 'SELECT') then
    raise exception 'Billing V2 registry view is unavailable to service_role';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'billing_quotes'
      and column_name = 'wallet_hold_id'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'billing_quotes'
      and column_name = 'reservation_kind'
  ) then
    raise exception 'Billing V2 quote reservation linkage is missing';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.billing_reserve_quote(uuid,uuid,uuid,text,text,text,text,numeric,numeric,numeric,numeric,jsonb,jsonb,text,jsonb,text,jsonb)',
    'EXECUTE'
  ) or has_function_privilege(
    'anon',
    'public.billing_expire_quote_reservation(uuid)',
    'EXECUTE'
  ) then
    raise exception 'Billing V2 quote reservation RPC is exposed to a client role';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.billing_reserve_quote(uuid,uuid,uuid,text,text,text,text,numeric,numeric,numeric,numeric,jsonb,jsonb,text,jsonb,text,jsonb)',
    'EXECUTE'
  ) then
    raise exception 'Billing V2 quote reservation RPC is unavailable to service_role';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'billing_provider_pricing_registry'
      and column_name in (
        'input_token_price', 'output_token_price', 'cached_token_price',
        'cache_write_token_price', 'flat_price', 'per_image_price',
        'per_second_price', 'per_minute_price', 'per_1k_character_price',
        'per_reference_image_price', 'model_markup'
      )
      and data_type <> 'text'
  ) then
    raise exception 'Billing V2 registry contains a non-text financial projection';
  end if;

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
