create or replace function public.billing_sync_generation_reconciliation_state()
returns trigger language plpgsql set search_path = ''
as $function$
begin
  if new.status in ('completed', 'failed', 'cancelled', 'expired') then
    new.reconciliation_required := false;
    new.reconciliation_state := 'resolved';
    new.next_reconcile_at := null;
  elsif new.provider_task_id is not null and old.provider_task_id is distinct from new.provider_task_id then
    new.reconciliation_state := 'due';
    new.next_reconcile_at := least(coalesce(new.next_reconcile_at, clock_timestamp()), clock_timestamp());
  end if;
  return new;
end;
$function$;

revoke all on function public.billing_sync_generation_reconciliation_state() from public, anon, authenticated;
