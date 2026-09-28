-- Forward-only reconciliation for the verified production schema shape.
-- Populated business tables are altered in place; unsafe assumptions fail closed.
begin;

do $preflight$
declare
  v_relation text;
begin
  foreach v_relation in array array[
    'public.admin_roles', 'public.admin_profit_logs', 'public.audit_logs',
    'public.feature_flags', 'public.file_upload_reservations',
    'public.generation_jobs', 'public.manual_payments',
    'public.model_price_history', 'public.profiles', 'public.prompt_templates',
    'public.provider_models', 'public.request_idempotency',
    'public.system_settings', 'public.wallet_holds',
    'public.wallet_transactions', 'public.wallets'
  ] loop
    if to_regclass(v_relation) is null then
      raise exception 'PRODUCTION_RECONCILIATION_PREFLIGHT: required relation % is missing', v_relation;
    end if;
  end loop;

  if exists (
    select 1 from (values
      ('admin_profit_logs', 'id'), ('admin_profit_logs', 'job_id'),
      ('admin_profit_logs', 'user_id'), ('admin_profit_logs', 'revenue_credits'),
      ('admin_profit_logs', 'provider_cost_pkr'), ('admin_profit_logs', 'profit_pkr'),
      ('admin_profit_logs', 'created_at'), ('admin_roles', 'id'),
      ('admin_roles', 'user_id'), ('admin_roles', 'role'),
      ('admin_roles', 'created_at'), ('generation_jobs', 'request_json')
    ) as required(table_name, column_name)
    where not exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = required.table_name
        and c.column_name = required.column_name
    )
  ) then
    raise exception 'PRODUCTION_RECONCILIATION_PREFLIGHT: a required column is missing';
  end if;

  if exists (
    select 1 from public.admin_profit_logs
    where id is null or job_id is null or user_id is null
       or revenue_credits is null or provider_cost_pkr is null
       or profit_pkr is null or created_at is null
  ) then
    raise exception 'PRODUCTION_RECONCILIATION_PREFLIGHT: admin_profit_logs contains null required values';
  end if;
  if exists (select job_id from public.admin_profit_logs group by job_id having count(*) > 1) then
    raise exception 'PRODUCTION_RECONCILIATION_PREFLIGHT: admin_profit_logs contains duplicate job_id values';
  end if;
  if exists (
    select 1 from public.admin_profit_logs p
    left join public.generation_jobs g on g.id = p.job_id where g.id is null
  ) then
    raise exception 'PRODUCTION_RECONCILIATION_PREFLIGHT: admin_profit_logs contains orphan job_id values';
  end if;
  if exists (
    select 1 from public.admin_profit_logs p
    left join auth.users u on u.id = p.user_id where u.id is null
  ) then
    raise exception 'PRODUCTION_RECONCILIATION_PREFLIGHT: admin_profit_logs contains orphan user_id values';
  end if;

  if exists (select 1 from public.admin_roles where id is null or user_id is null or role is null) then
    raise exception 'PRODUCTION_RECONCILIATION_PREFLIGHT: admin_roles contains null required values';
  end if;
  if exists (select user_id from public.admin_roles group by user_id having count(*) > 1) then
    raise exception 'PRODUCTION_RECONCILIATION_PREFLIGHT: admin_roles contains duplicate user_id values';
  end if;
  if exists (
    select 1 from public.admin_roles r
    left join auth.users u on u.id = r.user_id where u.id is null
  ) then
    raise exception 'PRODUCTION_RECONCILIATION_PREFLIGHT: admin_roles contains orphan user_id values';
  end if;

  if exists (
    select method, lower(trim(transaction_reference)) from public.manual_payments
    group by method, lower(trim(transaction_reference)) having count(*) > 1
  ) then
    raise exception 'PRODUCTION_RECONCILIATION_PREFLIGHT: normalized manual payment references are duplicated';
  end if;

  if (select count(*) from storage.buckets where id in ('payment-proofs', 'generated-assets')) <> 2 then
    raise exception 'PRODUCTION_RECONCILIATION_PREFLIGHT: required private storage buckets are missing';
  end if;
end
$preflight$;

-- Preserve the augmented production admin-role contract and its extra data.
alter table public.admin_roles
  add column if not exists permissions jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

alter table public.admin_roles
  alter column id set default gen_random_uuid(),
  alter column user_id set not null,
  alter column role set default 'owner',
  alter column role set not null,
  alter column created_at set default now(),
  alter column created_at set not null;

create unique index if not exists admin_roles_user_id_key on public.admin_roles(user_id);

do $admin_roles_fk$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.conrelid = 'public.admin_roles'::regclass
      and c.contype = 'f' and cardinality(c.conkey) = 1
      and a.attname = 'user_id' and c.confrelid = 'auth.users'::regclass
      and c.confdeltype = 'c'
  ) then
    if exists (
      select 1 from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
      where c.conrelid = 'public.admin_roles'::regclass
        and c.contype = 'f' and cardinality(c.conkey) = 1 and a.attname = 'user_id'
    ) then
      raise exception 'PRODUCTION_RECONCILIATION_PREFLIGHT: admin_roles has an unexpected user_id foreign key';
    end if;
    alter table public.admin_roles add constraint admin_roles_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end
$admin_roles_fk$;

-- Reconcile the legacy profit log in place; no row is deleted or recreated.
do $profit_timestamp$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'admin_profit_logs'
      and column_name = 'created_at' and data_type = 'timestamp without time zone'
  ) then
    alter table public.admin_profit_logs alter column created_at type timestamptz
      using created_at at time zone 'UTC';
  elsif not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'admin_profit_logs'
      and column_name = 'created_at' and data_type = 'timestamp with time zone'
  ) then
    raise exception 'PRODUCTION_RECONCILIATION_PREFLIGHT: admin_profit_logs.created_at has an unexpected type';
  end if;
end
$profit_timestamp$;

alter table public.admin_profit_logs
  alter column id set default gen_random_uuid(),
  alter column job_id set not null,
  alter column user_id set not null,
  alter column revenue_credits set default 0,
  alter column revenue_credits set not null,
  alter column provider_cost_pkr set default 0,
  alter column provider_cost_pkr set not null,
  alter column profit_pkr set default 0,
  alter column profit_pkr set not null,
  alter column created_at set default now(),
  alter column created_at set not null;

do $profit_fks$
declare
  v_constraint record;
begin
  for v_constraint in
    select c.conname, a.attname, c.confrelid, c.confdeltype
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.conrelid = 'public.admin_profit_logs'::regclass
      and c.contype = 'f' and cardinality(c.conkey) = 1
      and a.attname in ('job_id', 'user_id')
  loop
    if (v_constraint.attname = 'job_id' and
        (v_constraint.confrelid <> 'public.generation_jobs'::regclass or v_constraint.confdeltype <> 'c'))
       or (v_constraint.attname = 'user_id' and
        (v_constraint.confrelid <> 'auth.users'::regclass or v_constraint.confdeltype <> 'c')) then
      execute format('alter table public.admin_profit_logs drop constraint %I', v_constraint.conname);
    end if;
  end loop;

  if not exists (
    select 1 from pg_constraint c
    where c.conrelid = 'public.admin_profit_logs'::regclass
      and c.contype = 'f' and c.confrelid = 'public.generation_jobs'::regclass
      and c.confdeltype = 'c'
      and c.conkey = array[(select attnum from pg_attribute
        where attrelid = c.conrelid and attname = 'job_id')]::smallint[]
  ) then
    alter table public.admin_profit_logs add constraint admin_profit_logs_job_id_fkey
      foreign key (job_id) references public.generation_jobs(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint c
    where c.conrelid = 'public.admin_profit_logs'::regclass
      and c.contype = 'f' and c.confrelid = 'auth.users'::regclass
      and c.confdeltype = 'c'
      and c.conkey = array[(select attnum from pg_attribute
        where attrelid = c.conrelid and attname = 'user_id')]::smallint[]
  ) then
    alter table public.admin_profit_logs add constraint admin_profit_logs_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end
$profit_fks$;

create unique index if not exists admin_profit_logs_job_id_key on public.admin_profit_logs(job_id);

-- Create the absent table, or verify an existing relation is structurally compatible.
create table if not exists public.profit_records (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid,
  user_id uuid,
  model_id text,
  provider_cost_pkr numeric default 0,
  selling_price_pkr numeric default 0,
  profit_pkr numeric default 0,
  margin_percentage numeric default 0,
  created_at timestamptz default now()
);

do $profit_records_shape$
begin
  if exists (
    select 1 from (values
      ('id'), ('generation_id'), ('user_id'), ('model_id'), ('provider_cost_pkr'),
      ('selling_price_pkr'), ('profit_pkr'), ('margin_percentage'), ('created_at')
    ) as required(column_name)
    where not exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = 'profit_records'
        and c.column_name = required.column_name
    )
  ) then
    raise exception 'PRODUCTION_RECONCILIATION_PREFLIGHT: profit_records exists with an incompatible shape';
  end if;
end
$profit_records_shape$;

-- Establish the canonical normalized uniqueness invariant after the duplicate check.
create unique index if not exists manual_payment_reference_unique_idx
  on public.manual_payments(method, lower(trim(transaction_reference)));
drop index if exists public.manual_payments_reference_unique;
drop index if exists public.manual_payments_method_reference_unique_idx;

-- Archive legacy callback URLs and signed inputs before removing them from the job.
create table if not exists public.legacy_generation_request_archive (
  job_id uuid primary key references public.generation_jobs(id) on delete cascade,
  archived_fields jsonb not null,
  archived_at timestamptz not null default now()
);

do $archive_shape$
begin
  if exists (
    select 1 from (values ('job_id'), ('archived_fields'), ('archived_at')) as required(column_name)
    where not exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = 'legacy_generation_request_archive'
        and c.column_name = required.column_name
    )
  ) then
    raise exception 'PRODUCTION_RECONCILIATION_PREFLIGHT: legacy request archive has an incompatible shape';
  end if;
end
$archive_shape$;

insert into public.legacy_generation_request_archive(job_id, archived_fields)
select g.id,
       (select jsonb_object_agg(entry.key, entry.value)
        from jsonb_each(g.request_json) entry
        where entry.key in ('callback_url', 'images'))
from public.generation_jobs g
where g.request_json ? 'callback_url' or g.request_json ? 'images'
on conflict (job_id) do update
set archived_fields = public.legacy_generation_request_archive.archived_fields || excluded.archived_fields;

update public.generation_jobs
set request_json = request_json - 'callback_url' - 'images'
where request_json ? 'callback_url' or request_json ? 'images';

-- Least-privilege RLS and browser grants from the missing hardening migration.
alter table public.admin_roles enable row level security;
alter table public.profit_records enable row level security;
alter table public.admin_profit_logs enable row level security;
alter table public.legacy_generation_request_archive enable row level security;
alter table public.legacy_generation_request_archive force row level security;
alter table public.audit_logs force row level security;
alter table public.request_idempotency force row level security;
alter table public.file_upload_reservations force row level security;

revoke all on table public.admin_roles from public, anon, authenticated;
revoke all on table public.profit_records from public, anon, authenticated;
revoke all on table public.admin_profit_logs from public, anon, authenticated;
revoke all on table public.legacy_generation_request_archive from public, anon, authenticated;
revoke all on table public.audit_logs from public, anon, authenticated;
revoke all on table public.provider_models from public, anon, authenticated;
revoke all on table public.model_price_history from public, anon, authenticated;
revoke all on table public.system_settings from public, anon, authenticated;
revoke all on table public.request_idempotency from public, anon, authenticated;
revoke all on table public.file_upload_reservations from public, anon, authenticated;

grant all on table public.admin_roles, public.profit_records, public.admin_profit_logs,
  public.legacy_generation_request_archive, public.audit_logs, public.provider_models,
  public.model_price_history, public.system_settings, public.request_idempotency,
  public.file_upload_reservations to service_role;

revoke select on table public.generation_jobs from anon, authenticated;
grant select (
  id, public_id, user_id, project_id, modality, model_id, status, prompt,
  result_urls, estimated_credits, reserved_credits, charged_credits,
  error_message, created_at, updated_at, completed_at
) on table public.generation_jobs to authenticated;

revoke update (role, welcome_granted_at) on public.profiles from anon, authenticated;
revoke insert, update, delete on public.wallets, public.wallet_transactions, public.wallet_holds,
  public.manual_payments, public.generation_jobs from anon, authenticated;

drop policy if exists "feature flags read" on public.feature_flags;
drop policy if exists "feature flags authenticated read" on public.feature_flags;
create policy "feature flags authenticated read" on public.feature_flags
  for select to authenticated using (true);

drop policy if exists "templates public read" on public.prompt_templates;
drop policy if exists "templates authenticated read" on public.prompt_templates;
create policy "templates authenticated read" on public.prompt_templates
  for select to authenticated using (active = true);

update storage.buckets
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','application/pdf']
where id = 'payment-proofs';

update storage.buckets
set public = false,
    file_size_limit = 262144000,
    allowed_mime_types = array['image/png','image/webp','image/jpeg','image/gif','video/mp4','video/webm','audio/mpeg','audio/wav','audio/ogg']
where id = 'generated-assets';

-- Immutable callback settlement. Identical retries return the original transaction;
-- a conflicting charge fails closed and cannot rewrite the first provider result.
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

  select * into v_job from public.generation_jobs where id = p_job_id for update;
  if not found then
    raise exception 'Generation job not found';
  end if;

  if v_job.status = 'completed' then
    if v_job.charged_credits is distinct from p_charged_credits then
      raise exception 'GENERATION_SETTLEMENT_CONFLICT';
    end if;

    select id into v_transaction_id from public.wallet_transactions
    where idempotency_key = 'generation-capture:' || v_job.id::text;

    if p_charged_credits > 0 and v_transaction_id is null then
      raise exception 'Completed generation ledger entry missing';
    end if;

    return jsonb_build_object('transaction_id', v_transaction_id, 'completed_now', false);
  end if;

  if v_job.status in ('failed', 'cancelled', 'expired') then
    raise exception 'Generation job cannot be completed from status %', v_job.status;
  end if;

  if v_job.hold_id is null then
    select id into v_transaction_id from public.wallet_transactions
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
  set status = 'completed', result_json = p_result_json, result_urls = p_result_urls,
      charged_credits = p_charged_credits, error_message = null, updated_at = now(),
      completed_at = coalesce(completed_at, now())
  where id = v_job.id;

  insert into public.admin_profit_logs(
    job_id, user_id, revenue_credits, provider_cost_pkr, profit_pkr
  ) values (
    v_job.id, v_job.user_id, p_charged_credits,
    coalesce(v_job.internal_cost_pkr, 0),
    p_charged_credits - coalesce(v_job.internal_cost_pkr, 0)
  )
  on conflict (job_id) do update
  set revenue_credits = excluded.revenue_credits,
      provider_cost_pkr = excluded.provider_cost_pkr,
      profit_pkr = excluded.profit_pkr;

  return jsonb_build_object('transaction_id', v_transaction_id, 'completed_now', true);
end;
$function$;

-- Restrict current and future privileged routines to the server role.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.reserve_file_upload(uuid,bigint,bigint) to service_role;
grant execute on function public.release_file_upload_reservation(uuid,uuid) to service_role;
grant execute on function public.credit_wallet(uuid,numeric,text,text,text,text,jsonb) to service_role;
grant execute on function public.grant_welcome_credits(uuid,numeric) to service_role;
grant execute on function public.create_wallet_hold(uuid,numeric,text,jsonb) to service_role;
grant execute on function public.release_wallet_hold(uuid,text) to service_role;
grant execute on function public.capture_wallet_hold(uuid,numeric,text,jsonb) to service_role;
grant execute on function public.approve_manual_payment(uuid,uuid,text) to service_role;
grant execute on function public.complete_generation_job(uuid,numeric,jsonb,jsonb,jsonb) to service_role;

alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;

comment on table public.admin_roles is 'Service-role-only administrative authorization records.';
comment on table public.admin_profit_logs is 'Service-role-only generation revenue and provider cost records.';
comment on table public.legacy_generation_request_archive is
  'Service-role-only archive of callback URLs and signed input references removed from generation job request data.';

commit;

