-- Forward-only repair for the already-applied shortfall settlement wrapper.
-- The prior migration correctly releases the wallet hold and cancels the
-- quote, but the linked generation job must also leave `settling`.

create or replace function public.billing_v3_mark_shortfall_job_terminal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.reconciliation_status = 'authorization_shortfall'
    and old.reconciliation_status is distinct from new.reconciliation_status
    and new.generation_job_id is not null then
    update public.generation_jobs
    set status = 'failed',
        error_message = 'Provider cost exceeded authorization; no customer charge was applied.',
        reconciliation_required = false,
        reconciliation_state = 'resolved',
        next_reconcile_at = null,
        completed_at = coalesce(completed_at, clock_timestamp()),
        updated_at = clock_timestamp(),
        result_json = coalesce(result_json, '{}'::jsonb) || jsonb_build_object(
          'billingStatus', 'authorization_shortfall',
          'customerCharged', false
        )
    where id = new.generation_job_id
      and status not in ('completed', 'failed', 'cancelled', 'expired');
  end if;
  return new;
end;
$function$;

revoke all on function public.billing_v3_mark_shortfall_job_terminal() from public, anon, authenticated;
grant execute on function public.billing_v3_mark_shortfall_job_terminal() to service_role;

drop trigger if exists provider_billing_shortfall_job_terminal on public.provider_billing_records;
create trigger provider_billing_shortfall_job_terminal
after update of reconciliation_status on public.provider_billing_records
for each row
when (new.reconciliation_status = 'authorization_shortfall'
  and old.reconciliation_status is distinct from new.reconciliation_status)
execute function public.billing_v3_mark_shortfall_job_terminal();

-- Repair any shortfalls finalized by the previous migration before this
-- trigger existed. This is idempotent and performs no wallet operation.
update public.generation_jobs as jobs
set status = 'failed',
    error_message = 'Provider cost exceeded authorization; no customer charge was applied.',
    reconciliation_required = false,
    reconciliation_state = 'resolved',
    next_reconcile_at = null,
    completed_at = coalesce(jobs.completed_at, clock_timestamp()),
    updated_at = clock_timestamp(),
    result_json = coalesce(jobs.result_json, '{}'::jsonb) || jsonb_build_object(
      'billingStatus', 'authorization_shortfall',
      'customerCharged', false
    )
from public.provider_billing_records as records
where records.generation_job_id = jobs.id
  and records.reconciliation_status = 'authorization_shortfall'
  and jobs.status not in ('completed', 'failed', 'cancelled', 'expired');

