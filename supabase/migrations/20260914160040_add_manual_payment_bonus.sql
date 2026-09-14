alter table public.manual_payments
  add column if not exists bonus_percent numeric(5,2) not null default 0,
  add column if not exists bonus_credits numeric(18,6) not null default 0;

alter table public.manual_payments
  drop constraint if exists manual_payments_bonus_percent_range,
  add constraint manual_payments_bonus_percent_range
    check (bonus_percent >= 0 and bonus_percent <= 20) not valid,
  drop constraint if exists manual_payments_bonus_credits_nonnegative,
  add constraint manual_payments_bonus_credits_nonnegative
    check (bonus_credits >= 0) not valid,
  drop constraint if exists manual_payments_amount_product_range,
  add constraint manual_payments_amount_product_range
    check (amount_pkr >= 500 and amount_pkr <= 100000) not valid,
  drop constraint if exists manual_payments_bonus_matches_snapshot,
  add constraint manual_payments_bonus_matches_snapshot
    check (bonus_credits = round((credits * bonus_percent / 100.0)::numeric, 6)) not valid;

create or replace function public.approve_manual_payment(
  p_payment_id uuid,
  p_reviewer_id uuid,
  p_review_note text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.manual_payments%rowtype;
  v_is_admin boolean;
  v_purchase_tx uuid;
  v_bonus_tx uuid;
begin
  select
    exists(
      select 1 from public.profiles
      where id = p_reviewer_id and role in ('admin', 'owner')
    )
    or exists(
      select 1 from public.admin_roles
      where user_id = p_reviewer_id and role in ('admin', 'owner')
    )
    into v_is_admin;

  if not coalesce(v_is_admin, false) then
    raise exception 'Admin permission required';
  end if;

  select * into v_payment
  from public.manual_payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'Payment not found';
  end if;

  if v_payment.status = 'approved' then
    select id into v_purchase_tx
    from public.wallet_transactions
    where idempotency_key = 'payment:' || p_payment_id::text;

    if v_purchase_tx is null then
      raise exception 'Approved payment ledger entry missing';
    end if;

    if v_payment.bonus_credits > 0 and not exists (
      select 1 from public.wallet_transactions
      where idempotency_key = 'payment_bonus:' || p_payment_id::text
    ) then
      raise exception 'Approved payment bonus ledger entry missing';
    end if;

    return v_purchase_tx;
  end if;

  if v_payment.status not in ('pending', 'under_review', 'request_new_proof') then
    raise exception 'Payment cannot be approved from status %', v_payment.status;
  end if;

  v_purchase_tx := public.credit_wallet(
    v_payment.user_id,
    v_payment.credits,
    'purchased',
    'credit_purchase',
    'payment:' || p_payment_id::text,
    v_payment.public_id,
    jsonb_build_object(
      'method', v_payment.method,
      'amount_pkr', v_payment.amount_pkr,
      'bonus_percent', v_payment.bonus_percent,
      'bonus_credits', v_payment.bonus_credits
    )
  );

  if v_payment.bonus_credits > 0 then
    v_bonus_tx := public.credit_wallet(
      v_payment.user_id,
      v_payment.bonus_credits,
      'promo',
      'promo_credit',
      'payment_bonus:' || p_payment_id::text,
      v_payment.public_id,
      jsonb_build_object(
        'campaign', 'topup_bonus',
        'method', v_payment.method,
        'amount_pkr', v_payment.amount_pkr,
        'bonus_percent', v_payment.bonus_percent,
        'purchase_transaction_id', v_purchase_tx
      )
    );
  end if;

  update public.manual_payments
  set status = 'approved',
      reviewed_by = p_reviewer_id,
      reviewed_at = now(),
      review_note = nullif(trim(p_review_note), ''),
      updated_at = now()
  where id = p_payment_id;

  insert into public.audit_logs(
    actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    p_reviewer_id,
    'payment.approved',
    'manual_payment',
    p_payment_id::text,
    jsonb_build_object(
      'purchase_transaction_id', v_purchase_tx,
      'bonus_transaction_id', v_bonus_tx,
      'purchased_credits', v_payment.credits,
      'bonus_credits', v_payment.bonus_credits,
      'total_credits', v_payment.credits + v_payment.bonus_credits
    )
  );

  return v_purchase_tx;
end;
$$;

revoke all on function public.approve_manual_payment(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.approve_manual_payment(uuid,uuid,text) to service_role;

