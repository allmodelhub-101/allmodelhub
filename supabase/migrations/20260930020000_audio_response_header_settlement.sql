-- Direct APIMODELS TTS streaming can provide an exact billed USD header without
-- issuing a task or request ID. Permit only that completed, settled evidence.

alter table public.provider_billing_records
  drop constraint if exists provider_billing_records_identifier_check;

alter table public.provider_billing_records
  add constraint provider_billing_records_identifier_check check (
    provider_request_id is not null
    or provider_task_id is not null
    or (
      source = 'response_header'
      and settled = true
      and state = 'completed'
      and credits_usd is not null
      and currency = 'USD'
    )
  );

create or replace function public.billing_v3_record_provider_observation(
  p_quote_id uuid, p_provider_request_id text, p_provider_task_id text,
  p_state text, p_settled boolean, p_credits_usd numeric, p_currency text,
  p_usage jsonb, p_source text, p_raw_record jsonb default '{}'::jsonb,
  p_provider_created_at timestamptz default null, p_provider_completed_at timestamptz default null,
  p_message_id uuid default null, p_generation_job_id uuid default null
) returns uuid language plpgsql security invoker set search_path = '' as $function$
declare
  v_quote public.billing_quotes%rowtype;
  v_record public.provider_billing_records%rowtype;
  v_header_only boolean;
begin
  v_header_only := p_provider_request_id is null and p_provider_task_id is null
    and p_source = 'response_header' and p_settled and p_state = 'completed'
    and p_credits_usd is not null and p_currency = 'USD';
  if (p_provider_request_id is null and p_provider_task_id is null and not v_header_only)
    or p_state not in ('pending', 'running', 'completed', 'failed', 'cancelled')
    or p_source not in ('response_header', 'callback', 'records_api', 'reconciliation')
    or jsonb_typeof(p_usage) <> 'object' or jsonb_typeof(p_raw_record) <> 'object'
    or ((not p_settled) and (p_credits_usd is not null or p_currency is not null))
    or (p_settled and (p_credits_usd is null or p_credits_usd < 0 or p_currency <> 'USD'))
    or (p_state in ('failed', 'cancelled') and p_settled and p_credits_usd <> 0)
  then raise exception 'BILLING_V3_PROVIDER_OBSERVATION_INVALID'; end if;
  select * into v_quote from public.billing_quotes where id = p_quote_id for update;
  if not found or v_quote.billing_engine <> 'v3_provider_authoritative' then raise exception 'BILLING_V3_QUOTE_INVALID'; end if;
  select * into v_record from public.provider_billing_records
  where quote_id = p_quote_id
     or (p_provider_request_id is not null and provider_key = v_quote.provider_key and provider_request_id = p_provider_request_id)
     or (p_provider_task_id is not null and provider_key = v_quote.provider_key and provider_task_id = p_provider_task_id)
  limit 1 for update;
  if found then
    if v_record.quote_id is distinct from p_quote_id or v_record.provider_key is distinct from v_quote.provider_key
      or (v_record.settled and (v_record.state is distinct from p_state or v_record.credits_usd is distinct from p_credits_usd
        or v_record.currency is distinct from p_currency or not p_settled))
    then raise exception 'BILLING_V3_PROVIDER_OBSERVATION_CONFLICT'; end if;
    update public.provider_billing_records
    set provider_request_id = coalesce(provider_request_id, p_provider_request_id),
        provider_task_id = coalesce(provider_task_id, p_provider_task_id),
        state = case when settled then state else p_state end,
        settled = case when settled then true else p_settled end,
        credits_usd = case when settled then credits_usd else p_credits_usd end,
        currency = case when settled then currency else p_currency end,
        usage = case when settled then usage else p_usage end,
        source = case when settled then source else p_source end,
        raw_record = case when settled then raw_record else p_raw_record end,
        provider_created_at = coalesce(provider_created_at, p_provider_created_at),
        provider_completed_at = coalesce(provider_completed_at, p_provider_completed_at),
        message_id = coalesce(message_id, p_message_id), generation_job_id = coalesce(generation_job_id, p_generation_job_id),
        reconciliation_status = case when p_settled then 'pending' else 'retry' end,
        next_reconcile_at = case when p_settled then null else clock_timestamp() + interval '5 minutes' end,
        last_observed_at = clock_timestamp(), updated_at = clock_timestamp()
    where id = v_record.id;
    return v_record.id;
  end if;
  insert into public.provider_billing_records (
    provider_key, quote_id, user_id, model_id, message_id, generation_job_id,
    provider_request_id, provider_task_id, state, settled, credits_usd, currency, usage, source,
    reconciliation_status, next_reconcile_at, raw_record, provider_created_at, provider_completed_at
  ) values (
    v_quote.provider_key, v_quote.id, v_quote.user_id, v_quote.model_id, p_message_id, p_generation_job_id,
    p_provider_request_id, p_provider_task_id, p_state, p_settled, p_credits_usd, p_currency, p_usage, p_source,
    case when p_settled then 'pending' else 'retry' end,
    case when p_settled then null else clock_timestamp() + interval '5 minutes' end,
    p_raw_record, p_provider_created_at, p_provider_completed_at
  ) returning id into v_record.id;
  return v_record.id;
end;
$function$;

revoke all on function public.billing_v3_record_provider_observation(uuid,text,text,text,boolean,numeric,text,jsonb,text,jsonb,timestamptz,timestamptz,uuid,uuid) from public, anon, authenticated;
grant execute on function public.billing_v3_record_provider_observation(uuid,text,text,text,boolean,numeric,text,jsonb,text,jsonb,timestamptz,timestamptz,uuid,uuid) to service_role;

do $$
declare v_constraint integer;
begin
  select count(*) into v_constraint from pg_constraint
  where conrelid = 'public.provider_billing_records'::regclass
    and conname = 'provider_billing_records_identifier_check';
  if v_constraint <> 1 then raise exception 'Audio response-header settlement constraint is missing'; end if;
end $$;

