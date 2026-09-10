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
  v_is_admin boolean;
  v_tx uuid;
begin
  select
    exists(
      select 1
        from public.profiles
       where id = p_reviewer_id
         and role in ('admin', 'owner')
    )
    or exists(
      select 1
        from public.admin_roles
       where user_id = p_reviewer_id
         and role in ('admin', 'owner')
    )
    into v_is_admin;

  if not coalesce(v_is_admin, false) then
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
