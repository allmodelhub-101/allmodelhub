create or replace function public.billing_reconciliation_invariants()
returns jsonb language sql stable security invoker set search_path = ''
as $function$
  with hold_totals as (
    select user_id, coalesce(sum(amount), 0) active_holds from public.wallet_holds where status = 'active' group by user_id
  ), wallet_mismatches as (
    select count(*)::integer count
    from public.wallets w full join hold_totals h on h.user_id = w.user_id
    where w.user_id is null or abs(coalesce(w.reserved_balance, 0) - coalesce(h.active_holds, 0)) > 0.000001
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
    select count(*)::integer count from public.generation_jobs g
    where g.status in ('failed', 'cancelled', 'expired') and (
      g.charged_credits <> 0
      or exists (select 1 from public.wallet_transactions t where t.idempotency_key = 'generation-capture:' || g.id::text)
      or exists (select 1 from public.billing_receipts r where r.generation_job_id = g.id and r.charge_credits > 0)
    )
  ), migrated_debit_without_receipt as (
    select count(*)::integer count from public.wallet_transactions t
    where t.metadata ? 'billing_v2_quote_id'
      and not exists (select 1 from public.billing_receipts r where r.wallet_transaction_id = t.id)
  ), duplicate_settlements as (
    select count(*)::integer count from (
      select quote_id::text key from public.billing_receipts group by quote_id having count(*) > 1
      union all
      select idempotency_key from public.wallet_transactions where idempotency_key like 'generation-capture:%'
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

revoke all on function public.billing_reconciliation_invariants() from public, anon, authenticated;
grant execute on function public.billing_reconciliation_invariants() to service_role;
