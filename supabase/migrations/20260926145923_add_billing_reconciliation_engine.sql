alter table public.generation_jobs
  add column if not exists last_provider_check_at timestamptz,
  add column if not exists next_reconcile_at timestamptz,
  add column if not exists reconcile_attempts integer not null default 0 check (reconcile_attempts >= 0),
  add column if not exists reconciliation_required boolean not null default false,
  add column if not exists reconciliation_state text not null default 'not_required'
    check (reconciliation_state in ('not_required', 'due', 'checking', 'processing', 'quarantined', 'resolved')),
  add column if not exists reconciliation_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(reconciliation_metadata) = 'object');

create index if not exists generation_jobs_reconciliation_due_idx
  on public.generation_jobs (next_reconcile_at, updated_at, id)
  where provider_task_id is not null
    and status in ('queued', 'submitted', 'processing', 'settling');

update public.generation_jobs g
set next_reconcile_at = clock_timestamp(),
    reconciliation_required = true,
    reconciliation_state = 'due',
    reconciliation_metadata = reconciliation_metadata || jsonb_build_object(
      'backfill_reason', 'existing_nonterminal_provider_job',
      'backfilled_at', clock_timestamp()
    )
where g.provider_task_id is not null
  and g.status in ('queued', 'submitted', 'processing', 'settling')
  and (
    g.hold_id is null
    or exists (select 1 from public.wallet_holds h where h.id = g.hold_id and h.status = 'active')
  );

create or replace function public.billing_sync_generation_reconciliation_state()
returns trigger language plpgsql set search_path = ''
as $function$
begin
  if new.status in ('completed', 'failed', 'cancelled', 'expired') then
    new.reconciliation_required := false;
    new.reconciliation_state := 'resolved';
    new.next_reconcile_at := null;
  elsif new.provider_task_id is not null and
    (old.provider_task_id is distinct from new.provider_task_id or old.status is distinct from new.status) then
    new.reconciliation_state := 'due';
    new.next_reconcile_at := least(coalesce(new.next_reconcile_at, clock_timestamp()), clock_timestamp());
  end if;
  return new;
end;
$function$;

drop trigger if exists generation_jobs_sync_reconciliation_state on public.generation_jobs;
create trigger generation_jobs_sync_reconciliation_state
before update on public.generation_jobs
for each row execute function public.billing_sync_generation_reconciliation_state();

create or replace function public.billing_claim_reconciliation_batch(p_limit integer default 20)
returns setof public.generation_jobs
language plpgsql security invoker set search_path = ''
as $function$
begin
  if p_limit < 1 or p_limit > 100 then raise exception 'BILLING_RECONCILIATION_LIMIT_INVALID'; end if;
  return query
  with candidates as (
    select g.id
    from public.generation_jobs g
    where g.provider_task_id is not null
      and g.provider_key is not null
      and g.status in ('queued', 'submitted', 'processing', 'settling')
      and (
        g.next_reconcile_at <= clock_timestamp()
        or (g.next_reconcile_at is null and g.updated_at <= clock_timestamp() - interval '10 minutes')
        or (g.reconciliation_state = 'checking' and g.next_reconcile_at <= clock_timestamp())
      )
    order by coalesce(g.next_reconcile_at, g.updated_at), g.id
    limit p_limit
    for update skip locked
  )
  update public.generation_jobs g
  set reconciliation_state = 'checking',
      reconcile_attempts = g.reconcile_attempts + 1,
      next_reconcile_at = clock_timestamp() + interval '5 minutes',
      reconciliation_metadata = g.reconciliation_metadata || jsonb_build_object('claimed_at', clock_timestamp()),
      updated_at = clock_timestamp()
  from candidates c
  where g.id = c.id
  returning g.*;
end;
$function$;

create or replace function public.billing_record_reconciliation_result(
  p_job_id uuid,
  p_outcome text,
  p_next_reconcile_at timestamptz default null,
  p_metadata jsonb default '{}'::jsonb
) returns boolean
language plpgsql security invoker set search_path = ''
as $function$
declare v_job public.generation_jobs%rowtype;
begin
  if p_outcome not in ('processing', 'quarantined', 'resolved') or jsonb_typeof(p_metadata) <> 'object' then
    raise exception 'BILLING_RECONCILIATION_RESULT_INVALID';
  end if;
  select * into v_job from public.generation_jobs where id = p_job_id for update;
  if not found then return false; end if;
  update public.generation_jobs
  set last_provider_check_at = clock_timestamp(),
      next_reconcile_at = case when p_outcome = 'resolved' then null else p_next_reconcile_at end,
      reconciliation_required = p_outcome = 'quarantined',
      reconciliation_state = p_outcome,
      reconciliation_metadata = reconciliation_metadata || p_metadata || jsonb_build_object('recorded_at', clock_timestamp()),
      updated_at = clock_timestamp()
  where id = p_job_id;
  return true;
end;
$function$;

create or replace function public.billing_reconcile_legacy_generation_failure(
  p_job_id uuid,
  p_provider_state text,
  p_error_message text,
  p_metadata jsonb default '{}'::jsonb
) returns boolean
language plpgsql security invoker set search_path = ''
as $function$
declare v_job public.generation_jobs%rowtype;
begin
  if p_provider_state not in ('failed', 'cancelled', 'expired') or jsonb_typeof(p_metadata) <> 'object' then
    raise exception 'LEGACY_RECONCILIATION_FAILURE_INVALID';
  end if;
  select * into v_job from public.generation_jobs where id = p_job_id for update;
  if not found then return false; end if;
  if v_job.billing_quote_id is not null then raise exception 'LEGACY_RECONCILIATION_EXPECTED'; end if;
  if v_job.status in ('failed', 'cancelled', 'expired') then return true; end if;
  if v_job.status = 'completed' or v_job.charged_credits <> 0 then raise exception 'LEGACY_RECONCILIATION_CONFLICT'; end if;
  if v_job.hold_id is not null then perform public.release_wallet_hold(v_job.hold_id, 'provider_confirmed_' || p_provider_state); end if;
  update public.generation_jobs
  set status = p_provider_state::public.job_status,
      charged_credits = 0,
      error_message = left(coalesce(p_error_message, 'Provider confirmed failure'), 1000),
      result_json = coalesce(result_json, '{}'::jsonb) || p_metadata,
      last_provider_check_at = clock_timestamp(),
      reconciliation_required = false,
      reconciliation_state = 'resolved',
      next_reconcile_at = null,
      updated_at = clock_timestamp()
  where id = p_job_id;
  return true;
end;
$function$;

create or replace function public.billing_reconciliation_invariants()
returns jsonb language sql stable security invoker set search_path = ''
as $function$
  with hold_totals as (
    select user_id, coalesce(sum(amount), 0) active_holds from public.wallet_holds where status = 'active' group by user_id
  ), wallet_mismatches as (
    select count(*)::integer count from public.wallets w left join hold_totals h on h.user_id = w.user_id
    where abs(w.reserved_balance - coalesce(h.active_holds, 0)) > 0.000001
  ), completed_without_capture as (
    select count(*)::integer count from public.generation_jobs g
    where g.status = 'completed' and g.charged_credits > 0
      and not (
        (g.billing_quote_id is not null and exists (
          select 1 from public.billing_receipts r join public.wallet_transactions t on t.id = r.wallet_transaction_id
          where r.generation_job_id = g.id and r.quote_id = g.billing_quote_id
        ))
        or (g.billing_quote_id is null and exists (
          select 1 from public.wallet_transactions t where t.idempotency_key = 'generation-capture:' || g.id::text
        ))
      )
  ), failed_with_charge as (
    select count(*)::integer count from public.generation_jobs
    where status in ('failed', 'cancelled', 'expired') and charged_credits <> 0
  ), migrated_debit_without_receipt as (
    select count(*)::integer count from public.generation_jobs g
    where g.billing_quote_id is not null and g.charged_credits > 0
      and not exists (select 1 from public.billing_receipts r where r.generation_job_id = g.id and r.quote_id = g.billing_quote_id)
  ), duplicate_settlements as (
    select count(*)::integer count from (
      select generation_job_id from public.billing_receipts where generation_job_id is not null group by generation_job_id having count(*) > 1
      union all
      select null::uuid from public.wallet_transactions where idempotency_key like 'generation-capture:%'
      group by idempotency_key having count(*) > 1
    ) d
  )
  select jsonb_build_object(
    'checked_at', clock_timestamp(),
    'wallet_reserved_balance_mismatches', (select count from wallet_mismatches),
    'completed_without_valid_capture', (select count from completed_without_capture),
    'failed_generations_with_charge', (select count from failed_with_charge),
    'migrated_debits_without_receipt', (select count from migrated_debit_without_receipt),
    'duplicate_settlements', (select count from duplicate_settlements)
  );
$function$;

revoke all on function public.billing_sync_generation_reconciliation_state() from public, anon, authenticated;
revoke all on function public.billing_claim_reconciliation_batch(integer) from public, anon, authenticated;
revoke all on function public.billing_record_reconciliation_result(uuid,text,timestamptz,jsonb) from public, anon, authenticated;
revoke all on function public.billing_reconcile_legacy_generation_failure(uuid,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.billing_reconciliation_invariants() from public, anon, authenticated;
grant execute on function public.billing_claim_reconciliation_batch(integer) to service_role;
grant execute on function public.billing_record_reconciliation_result(uuid,text,timestamptz,jsonb) to service_role;
grant execute on function public.billing_reconcile_legacy_generation_failure(uuid,text,text,jsonb) to service_role;
grant execute on function public.billing_reconciliation_invariants() to service_role;
