-- Reassert the immutable generation settlement behavior verified in staging as
-- a clean, forward-only migration. This does not migrate production charging
-- to Billing V2 and does not rewrite any wallet or history rows.
create or replace function public.complete_generation_job(
  p_job_id uuid,
  p_charged_credits numeric,
  p_result_json jsonb,
  p_result_urls jsonb,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_job public.generation_jobs%rowtype;
  v_transaction_id uuid;
begin
  if p_charged_credits is null or p_charged_credits < 0 then
    raise exception 'Charged credits must be non-negative';
  end if;

  select *
    into v_job
    from public.generation_jobs
   where id = p_job_id
   for update;

  if not found then
    raise exception 'Generation job not found';
  end if;

  if v_job.status = 'completed' then
    if v_job.charged_credits is distinct from p_charged_credits then
      raise exception 'GENERATION_SETTLEMENT_CONFLICT';
    end if;

    select id
      into v_transaction_id
      from public.wallet_transactions
     where idempotency_key = 'generation-capture:' || v_job.id::text;

    if p_charged_credits > 0 and v_transaction_id is null then
      raise exception 'Completed generation ledger entry missing';
    end if;

    return jsonb_build_object(
      'transaction_id', v_transaction_id,
      'completed_now', false
    );
  end if;

  if v_job.status in ('failed', 'cancelled', 'expired') then
    raise exception 'Generation job cannot be completed from status %', v_job.status;
  end if;

  if v_job.hold_id is null then
    select id
      into v_transaction_id
      from public.wallet_transactions
     where idempotency_key = 'generation-capture:' || v_job.id::text;

    if p_charged_credits > 0 and v_transaction_id is null then
      raise exception 'Generation job has no wallet hold';
    end if;
  else
    v_transaction_id := public.capture_wallet_hold(
      v_job.hold_id,
      p_charged_credits,
      'generation-capture:' || v_job.id::text,
      coalesce(p_metadata, '{}'::jsonb)
    );
  end if;

  update public.generation_jobs
     set status = 'completed',
         result_json = p_result_json,
         result_urls = p_result_urls,
         charged_credits = p_charged_credits,
         error_message = null,
         updated_at = now(),
         completed_at = coalesce(completed_at, now())
   where id = v_job.id;

  insert into public.admin_profit_logs(
    job_id,
    user_id,
    revenue_credits,
    provider_cost_pkr,
    profit_pkr
  ) values (
    v_job.id,
    v_job.user_id,
    p_charged_credits,
    coalesce(v_job.internal_cost_pkr, 0),
    p_charged_credits - coalesce(v_job.internal_cost_pkr, 0)
  )
  on conflict (job_id) do update
    set revenue_credits = excluded.revenue_credits,
        provider_cost_pkr = excluded.provider_cost_pkr,
        profit_pkr = excluded.profit_pkr;

  return jsonb_build_object(
    'transaction_id', v_transaction_id,
    'completed_now', true
  );
end;
$function$;

revoke all on function public.complete_generation_job(uuid,numeric,jsonb,jsonb,jsonb)
  from public, anon, authenticated;
grant execute on function public.complete_generation_job(uuid,numeric,jsonb,jsonb,jsonb)
  to service_role;
