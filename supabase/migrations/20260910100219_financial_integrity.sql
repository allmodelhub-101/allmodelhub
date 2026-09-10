create unique index if not exists admin_profit_logs_job_id_key
  on public.admin_profit_logs(job_id);

create or replace function public.complete_generation_job(
  p_job_id uuid,
  p_charged_credits numeric,
  p_result_json jsonb,
  p_result_urls jsonb,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_job public.generation_jobs%rowtype;
  v_transaction_id uuid;
  v_was_completed boolean;
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

  if v_job.status in ('failed', 'cancelled', 'expired') then
    raise exception 'Generation job cannot be completed from status %', v_job.status;
  end if;

  v_was_completed := v_job.status = 'completed';

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
         result_json = case when v_was_completed then result_json else p_result_json end,
         result_urls = case when v_was_completed then result_urls else p_result_urls end,
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
  )
  values(
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
    'completed_now', not v_was_completed
  );
end;
$function$;

revoke all on function public.complete_generation_job(uuid,numeric,jsonb,jsonb,jsonb)
  from public, anon, authenticated;
grant execute on function public.complete_generation_job(uuid,numeric,jsonb,jsonb,jsonb)
  to service_role;

create or replace function public.approve_manual_payment(
  p_payment_id uuid,
  p_reviewer_id uuid,
  p_review_note text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_payment public.manual_payments%rowtype;
  v_role public.user_role;
  v_tx uuid;
begin
  select role
    into v_role
    from public.profiles
   where id = p_reviewer_id;

  if v_role is null or v_role not in ('admin', 'owner') then
    raise exception 'Admin permission required';
  end if;

  select *
    into v_payment
    from public.manual_payments
   where id = p_payment_id
   for update;

  if not found then
    raise exception 'Payment not found';
  end if;

  if v_payment.status = 'approved' then
    select id
      into v_tx
      from public.wallet_transactions
     where idempotency_key = 'payment:' || p_payment_id::text;

    if v_tx is null then
      raise exception 'Approved payment ledger entry missing';
    end if;
    return v_tx;
  end if;

  if v_payment.status not in ('pending', 'under_review', 'request_new_proof') then
    raise exception 'Payment cannot be approved from status %', v_payment.status;
  end if;

  v_tx := public.credit_wallet(
    v_payment.user_id,
    v_payment.credits,
    'purchased',
    'credit_purchase',
    'payment:' || p_payment_id::text,
    v_payment.public_id,
    jsonb_build_object(
      'method', v_payment.method,
      'amount_pkr', v_payment.amount_pkr
    )
  );

  update public.manual_payments
     set status = 'approved',
         reviewed_by = p_reviewer_id,
         reviewed_at = now(),
         review_note = nullif(trim(p_review_note), ''),
         updated_at = now()
   where id = p_payment_id;

  insert into public.audit_logs(
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values(
    p_reviewer_id,
    'payment.approved',
    'manual_payment',
    p_payment_id::text,
    jsonb_build_object('transaction_id', v_tx)
  );

  return v_tx;
end;
$function$;

revoke all on function public.approve_manual_payment(uuid,uuid,text)
  from public, anon, authenticated;
grant execute on function public.approve_manual_payment(uuid,uuid,text)
  to service_role;
