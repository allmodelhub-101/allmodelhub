-- Production security hardening. Safe to apply after 010 and before the dated migrations.
-- This also backfills a table referenced by the later financial-integrity migration.

create table if not exists public.admin_profit_logs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.generation_jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  revenue_credits numeric(18,6) not null default 0,
  provider_cost_pkr numeric(18,6) not null default 0,
  profit_pkr numeric(18,6) not null default 0,
  created_at timestamptz not null default now()
);

alter table public.admin_roles enable row level security;
alter table public.profit_records enable row level security;
alter table public.admin_profit_logs enable row level security;
alter table public.audit_logs force row level security;
alter table public.request_idempotency force row level security;
alter table public.file_upload_reservations force row level security;

-- These relations are service-role only. No browser policy is intentionally created.
revoke all on table public.admin_roles from public, anon, authenticated;
revoke all on table public.profit_records from public, anon, authenticated;
revoke all on table public.admin_profit_logs from public, anon, authenticated;
revoke all on table public.audit_logs from public, anon, authenticated;
revoke all on table public.provider_models from public, anon, authenticated;
revoke all on table public.model_price_history from public, anon, authenticated;
revoke all on table public.system_settings from public, anon, authenticated;
revoke all on table public.request_idempotency from public, anon, authenticated;
revoke all on table public.file_upload_reservations from public, anon, authenticated;

grant all on table public.admin_roles, public.profit_records, public.admin_profit_logs,
  public.audit_logs, public.provider_models, public.model_price_history, public.system_settings,
  public.request_idempotency, public.file_upload_reservations to service_role;

-- The browser may read only the safe, owner-scoped generation receipt columns.
revoke select on table public.generation_jobs from anon, authenticated;
grant select (
  id, public_id, user_id, project_id, modality, model_id, status, prompt,
  result_urls, estimated_credits, reserved_credits, charged_credits,
  error_message, created_at, updated_at, completed_at
) on table public.generation_jobs to authenticated;

-- Role elevation and financial writes remain server-only even if a future policy is broadened.
revoke update (role, welcome_granted_at) on public.profiles from anon, authenticated;
revoke insert, update, delete on public.wallets, public.wallet_transactions, public.wallet_holds,
  public.manual_payments, public.generation_jobs from anon, authenticated;

drop policy if exists "feature flags read" on public.feature_flags;
create policy "feature flags authenticated read" on public.feature_flags
  for select to authenticated using (true);

drop policy if exists "templates public read" on public.prompt_templates;
create policy "templates authenticated read" on public.prompt_templates
  for select to authenticated using (active = true);

-- Align bucket enforcement with server validation.
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

-- Close implicit function execution for current and future functions.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.reserve_file_upload(uuid,bigint,bigint) to service_role;
grant execute on function public.release_file_upload_reservation(uuid,uuid) to service_role;
grant execute on function public.credit_wallet(uuid,numeric,text,text,text,text,jsonb) to service_role;
grant execute on function public.grant_welcome_credits(uuid,numeric) to service_role;
grant execute on function public.create_wallet_hold(uuid,numeric,text,jsonb) to service_role;
grant execute on function public.release_wallet_hold(uuid,text) to service_role;
grant execute on function public.capture_wallet_hold(uuid,numeric,text,jsonb) to service_role;

alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;

comment on table public.admin_roles is 'Service-role-only administrative authorization records.';
comment on table public.admin_profit_logs is 'Service-role-only generation revenue and provider cost records.';

-- Remove callback credentials and temporary signed input URLs persisted by older application versions.
update public.generation_jobs
set request_json = request_json - 'callback_url' - 'images'
where request_json ? 'callback_url' or request_json ? 'images';
