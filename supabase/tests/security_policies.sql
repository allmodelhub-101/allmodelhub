-- Run with `supabase test db` or psql after all migrations. The transaction always rolls back.
begin;

do $$
declare
  missing_count integer;
begin
  select count(*) into missing_count
  from (values
    ('profiles', 'profiles own read'),
    ('wallets', 'wallet own read'),
    ('wallet_transactions', 'transactions own read'),
    ('manual_payments', 'payments own read'),
    ('generation_jobs', 'jobs own read'),
    ('projects', 'projects own all'),
    ('conversations', 'conversations own all'),
    ('user_files', 'files own all'),
    ('support_tickets', 'tickets own read')
  ) expected(tablename, policyname)
  where not exists (
    select 1 from pg_policies policy
    where policy.schemaname = 'public'
      and policy.tablename = expected.tablename
      and policy.policyname = expected.policyname
  );
  if missing_count <> 0 then raise exception 'Required owner RLS policies are missing'; end if;

  if has_table_privilege('authenticated', 'public.admin_roles', 'SELECT')
    or has_table_privilege('authenticated', 'public.audit_logs', 'SELECT')
    or has_table_privilege('authenticated', 'public.request_idempotency', 'SELECT') then
    raise exception 'Authenticated role can read a service-only relation';
  end if;

  if has_column_privilege('authenticated', 'public.generation_jobs', 'request_json', 'SELECT')
    or has_column_privilege('authenticated', 'public.generation_jobs', 'provider_task_id', 'SELECT')
    or has_column_privilege('authenticated', 'public.generation_jobs', 'result_json', 'SELECT')
    or has_column_privilege('authenticated', 'public.generation_jobs', 'supplier_cost_usd', 'SELECT') then
    raise exception 'Authenticated role can read internal generation columns';
  end if;

  if has_function_privilege('authenticated', 'public.credit_wallet(uuid,numeric,text,text,text,text,jsonb)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.capture_wallet_hold(uuid,numeric,text,jsonb)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.approve_manual_payment(uuid,uuid,text)', 'EXECUTE') then
    raise exception 'Authenticated role can invoke a privileged financial RPC';
  end if;
end
$$;

rollback;
