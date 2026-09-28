-- A Billing V2 receipt is the immutable evidence of a wallet capture. Reject
-- any receipt whose charge exceeds the server-created authorization snapshot.
-- Because receipt creation and wallet mutation occur in one PostgreSQL
-- transaction, this guard rolls the entire settlement back before commit.
create or replace function public.billing_enforce_capture_authorization()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_reservation_credits numeric;
begin
  select q.reservation_credits
    into v_reservation_credits
    from public.billing_quotes q
   where q.id = new.quote_id
   for key share;

  if not found then
    raise exception 'BILLING_QUOTE_NOT_FOUND';
  end if;

  if new.charge_credits > v_reservation_credits then
    raise exception 'BILLING_CAPTURE_EXCEEDS_AUTHORIZATION';
  end if;

  return new;
end;
$function$;

revoke all on function public.billing_enforce_capture_authorization()
  from public, anon, authenticated;

drop trigger if exists billing_receipts_capture_authorization_guard
  on public.billing_receipts;
create trigger billing_receipts_capture_authorization_guard
before insert on public.billing_receipts
for each row execute function public.billing_enforce_capture_authorization();

comment on function public.billing_enforce_capture_authorization() is
  'Fails closed when a Billing V2 settlement attempts to capture more Credits than the quote authorized.';
