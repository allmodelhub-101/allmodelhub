-- Staging-only transactional integration test. All fixtures and mutations roll back.
begin;

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('10000000-0000-4000-8000-000000000001', 'security-user-one@example.invalid', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('20000000-0000-4000-8000-000000000002', 'security-user-two@example.invalid', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.admin_roles (user_id, role)
values ('10000000-0000-4000-8000-000000000001', 'owner');

insert into public.projects (id, user_id, name)
values
  ('11000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'User one project'),
  ('22000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'User two project');

insert into public.user_files (id, user_id, project_id, storage_path, name, mime_type, size_bytes)
values
  ('12000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001/one.txt', 'one.txt', 'text/plain', 3),
  ('23000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', '22000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002/two.txt', 'two.txt', 'text/plain', 3);

insert into public.support_tickets (id, public_id, user_id, category, subject, message)
values
  ('13000000-0000-4000-8000-000000000001', 'TEST-TICKET-ONE', '10000000-0000-4000-8000-000000000001', 'technical', 'One', 'One'),
  ('24000000-0000-4000-8000-000000000002', 'TEST-TICKET-TWO', '20000000-0000-4000-8000-000000000002', 'technical', 'Two', 'Two');

insert into public.manual_payments (
  id, public_id, user_id, method, amount_pkr, credits, transaction_reference
) values (
  '25000000-0000-4000-8000-000000000002', 'TEST-PAYMENT-TWO',
  '20000000-0000-4000-8000-000000000002', 'easypaisa', 500, 500, 'TEST-REFERENCE-TWO'
);

insert into public.generation_jobs (
  id, public_id, user_id, modality, model_id, status, request_json
) values
  ('14000000-0000-4000-8000-000000000001', 'TEST-JOB-ONE', '10000000-0000-4000-8000-000000000001', 'text', (select id from public.models where active limit 1), 'queued', '{}'::jsonb),
  ('26000000-0000-4000-8000-000000000002', 'TEST-JOB-TWO', '20000000-0000-4000-8000-000000000002', 'text', (select id from public.models where active limit 1), 'queued', '{}'::jsonb);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

do $$
begin
  if (select count(*) from public.profiles) <> 1 then raise exception 'profile ownership isolation failed'; end if;
  if (select count(*) from public.wallets) <> 1 then raise exception 'wallet ownership isolation failed'; end if;
  if (select count(*) from public.projects) <> 1 then raise exception 'project ownership isolation failed'; end if;
  if (select count(*) from public.user_files) <> 1 then raise exception 'file ownership isolation failed'; end if;
  if (select count(*) from public.support_tickets) <> 1 then raise exception 'support ownership isolation failed'; end if;
  if (select count(*) from public.manual_payments) <> 0 then raise exception 'payment ownership isolation failed'; end if;
  if (select count(*) from public.generation_jobs) <> 1 then raise exception 'generation ownership isolation failed'; end if;

  if has_table_privilege('authenticated', 'public.admin_roles', 'SELECT') then
    raise exception 'authenticated can read admin roles';
  end if;
  if has_column_privilege('authenticated', 'public.generation_jobs', 'request_json', 'SELECT') then
    raise exception 'authenticated can read callback/provider request data';
  end if;
  if has_function_privilege('authenticated', 'public.approve_manual_payment(uuid,uuid,text)', 'EXECUTE') then
    raise exception 'authenticated can approve payments';
  end if;
  if has_function_privilege('authenticated', 'public.complete_generation_job(uuid,numeric,jsonb,jsonb,jsonb)', 'EXECUTE') then
    raise exception 'authenticated can settle callback jobs';
  end if;

  begin
    insert into public.projects (user_id, name)
    values ('20000000-0000-4000-8000-000000000002', 'Cross-owner insert');
    raise exception 'cross-owner project insert unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end
$$;

reset role;
select set_config('request.jwt.claims', '{}', true);

do $$
declare
  first_tx uuid;
  second_tx uuid;
  payment_before numeric;
  payment_after numeric;
  callback_hold uuid;
  callback_first jsonb;
  callback_second jsonb;
begin
  select purchased_balance + promo_balance into payment_before
  from public.wallets where user_id = '20000000-0000-4000-8000-000000000002';

  first_tx := public.approve_manual_payment(
    '25000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    'staging security test'
  );
  second_tx := public.approve_manual_payment(
    '25000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    'staging security retry'
  );
  if first_tx <> second_tx then raise exception 'payment approval is not idempotent'; end if;
  if (select count(*) from public.wallet_transactions where idempotency_key = 'payment:25000000-0000-4000-8000-000000000002') <> 1 then
    raise exception 'payment approval created duplicate ledger rows';
  end if;
  select purchased_balance + promo_balance into payment_after
  from public.wallets where user_id = '20000000-0000-4000-8000-000000000002';
  if payment_after - payment_before <> 500 then raise exception 'payment approval credited wrong amount'; end if;

  begin
    perform public.approve_manual_payment(
      '25000000-0000-4000-8000-000000000002',
      '20000000-0000-4000-8000-000000000002',
      'unauthorized'
    );
    raise exception 'non-admin payment approval unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm = 'non-admin payment approval unexpectedly succeeded' then raise; end if;
  end;

  callback_hold := public.create_wallet_hold(
    '20000000-0000-4000-8000-000000000002', 2,
    'staging-callback-hold', '{}'::jsonb
  );
  update public.generation_jobs
  set status = 'processing', hold_id = callback_hold, reserved_credits = 2
  where id = '26000000-0000-4000-8000-000000000002';

  callback_first := public.complete_generation_job(
    '26000000-0000-4000-8000-000000000002', 1,
    '{"safe":true}'::jsonb, '["https://example.invalid/result"]'::jsonb,
    '{"source":"staging-test"}'::jsonb
  );
  callback_second := public.complete_generation_job(
    '26000000-0000-4000-8000-000000000002', 1,
    '{"safe":false}'::jsonb, '["https://example.invalid/changed"]'::jsonb,
    '{"source":"staging-retry"}'::jsonb
  );
  if not (callback_first ->> 'completed_now')::boolean then raise exception 'first callback settlement did not complete'; end if;
  if (callback_second ->> 'completed_now')::boolean then raise exception 'callback retry completed twice'; end if;
  if (select count(*) from public.wallet_transactions where idempotency_key = 'generation-capture:26000000-0000-4000-8000-000000000002') <> 1 then
    raise exception 'callback retry created duplicate ledger rows';
  end if;
  if (select count(*) from public.admin_profit_logs where job_id = '26000000-0000-4000-8000-000000000002') <> 1 then
    raise exception 'callback retry created duplicate profit rows';
  end if;
  if (select result_json from public.generation_jobs where id = '26000000-0000-4000-8000-000000000002') <> '{"safe":true}'::jsonb then
    raise exception 'callback retry overwrote the first result';
  end if;

  begin
    perform public.complete_generation_job(
      '26000000-0000-4000-8000-000000000002', 1.5,
      '{"safe":false}'::jsonb, '[]'::jsonb, '{}'::jsonb
    );
    raise exception 'conflicting callback settlement unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm <> 'GENERATION_SETTLEMENT_CONFLICT' then raise; end if;
  end;
  if (select charged_credits from public.generation_jobs where id = '26000000-0000-4000-8000-000000000002') <> 1 then
    raise exception 'callback retry changed the settled charge';
  end if;
end
$$;

rollback;
