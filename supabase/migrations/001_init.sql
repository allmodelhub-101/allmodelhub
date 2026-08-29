-- All Model Hub v1 core schema
-- Apply in Supabase SQL editor or with Supabase CLI.

create extension if not exists pgcrypto;

create type public.user_role as enum ('user','support','admin','owner');
create type public.model_tier as enum ('budget','balanced','premium','flagship');
create type public.modality as enum ('text','image','video','audio');
create type public.payment_status as enum ('draft','pending','under_review','approved','rejected','duplicate','cancelled','expired');
create type public.job_status as enum ('queued','submitted','processing','completed','failed','cancelled','expired');
create type public.hold_status as enum ('active','captured','released');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  role public.user_role not null default 'user',
  theme text not null default 'system' check (theme in ('dark','light','system')),
  default_language text not null default 'auto',
  default_tier text not null default 'auto',
  low_bandwidth boolean not null default false,
  daily_spend_limit numeric(18,6),
  single_generation_limit numeric(18,6),
  welcome_granted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  purchased_balance numeric(18,6) not null default 0 check (purchased_balance >= 0),
  promo_balance numeric(18,6) not null default 0 check (promo_balance >= 0),
  reserved_balance numeric(18,6) not null default 0 check (reserved_balance >= 0),
  updated_at timestamptz not null default now()
);

create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  bucket text not null check (bucket in ('purchased','promo','mixed','none')),
  amount numeric(18,6) not null,
  status text not null default 'completed',
  reference_id text,
  idempotency_key text not null unique,
  balance_before numeric(18,6),
  balance_after numeric(18,6),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index wallet_transactions_user_created_idx on public.wallet_transactions(user_id, created_at desc);

create table public.wallet_holds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(18,6) not null check (amount > 0),
  status public.hold_status not null default 'active',
  idempotency_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  finalized_at timestamptz
);
create index wallet_holds_user_status_idx on public.wallet_holds(user_id, status);

create table public.manual_payments (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  method text not null check (method in ('easypaisa','meezan')),
  amount_pkr numeric(18,2) not null check (amount_pkr >= 500),
  credits numeric(18,6) not null check (credits > 0),
  status public.payment_status not null default 'pending',
  transaction_reference text not null,
  proof_path text,
  note text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index manual_payments_reference_unique on public.manual_payments(method, lower(transaction_reference));
create index manual_payments_user_created_idx on public.manual_payments(user_id, created_at desc);
create index manual_payments_status_idx on public.manual_payments(status, created_at);

create table public.models (
  id text primary key,
  display_name text not null,
  provider_family text not null,
  tier public.model_tier not null,
  modality public.modality not null,
  description text not null default '',
  upstream_model text not null,
  input_usd_per_million numeric(18,8),
  output_usd_per_million numeric(18,8),
  flat_usd numeric(18,8),
  per_second_usd numeric(18,8),
  per_1k_chars_usd numeric(18,8),
  markup numeric(10,4) not null default 2.0,
  capabilities jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  featured boolean not null default false,
  auto_eligible boolean not null default true,
  price_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index models_modality_tier_idx on public.models(modality, tier, active);

create table public.provider_models (
  id uuid primary key default gen_random_uuid(),
  model_id text not null references public.models(id) on delete cascade,
  provider_key text not null,
  upstream_model text not null,
  priority integer not null default 100,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  unique(model_id, provider_key)
);

create table public.model_price_history (
  id uuid primary key default gen_random_uuid(),
  model_id text not null references public.models(id) on delete cascade,
  version integer not null,
  pricing jsonb not null,
  effective_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(model_id, version)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  instructions text,
  preferred_tier text default 'auto',
  preferred_language text default 'auto',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_user_idx on public.projects(user_id, updated_at desc);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text not null default 'New chat',
  mode text not null default 'auto',
  preferred_model text,
  private boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index conversations_user_idx on public.conversations(user_id, updated_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('system','user','assistant')),
  content text not null,
  model_id text references public.models(id) on delete set null,
  provider_key text,
  input_tokens integer,
  output_tokens integer,
  credits_charged numeric(18,6),
  supplier_cost_usd numeric(18,8),
  internal_cost_pkr numeric(18,6),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages(conversation_id, created_at);

create table public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  modality public.modality not null,
  model_id text not null references public.models(id),
  provider_key text,
  provider_task_id text,
  status public.job_status not null default 'queued',
  prompt text,
  request_json jsonb not null default '{}'::jsonb,
  result_json jsonb,
  result_urls jsonb,
  estimated_credits numeric(18,6) not null default 0,
  reserved_credits numeric(18,6) not null default 0,
  charged_credits numeric(18,6) not null default 0,
  supplier_cost_usd numeric(18,8),
  internal_cost_pkr numeric(18,6),
  hold_id uuid references public.wallet_holds(id),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index generation_jobs_user_idx on public.generation_jobs(user_id, created_at desc);
create index generation_jobs_status_idx on public.generation_jobs(status, updated_at);

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  subject text not null,
  message text not null,
  status text not null default 'open',
  priority text not null default 'normal',
  related_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id),
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs(created_at desc);

-- Storage buckets
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 5242880, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit)
values ('user-files', 'user-files', false, 52428800)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit)
values ('generated-assets', 'generated-assets', false, 104857600)
on conflict (id) do nothing;

-- Trigger to create user shell records.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(coalesce(new.email,''),'@',1)))
  on conflict (id) do nothing;

  insert into public.wallets (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Wallet functions. All financial mutations are server-only via service role / RPC.
create or replace function public.credit_wallet(
  p_user_id uuid,
  p_amount numeric,
  p_bucket text,
  p_type text,
  p_idempotency_key text,
  p_reference_id text default null,
  p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_wallet public.wallets%rowtype;
  v_tx_id uuid;
  v_before numeric;
  v_after numeric;
begin
  if p_amount <= 0 then raise exception 'Credit amount must be positive'; end if;
  if p_bucket not in ('purchased','promo') then raise exception 'Invalid wallet bucket'; end if;

  select * into v_wallet from public.wallets where user_id = p_user_id for update;
  if not found then
    insert into public.wallets(user_id) values (p_user_id) returning * into v_wallet;
  end if;

  select id into v_tx_id from public.wallet_transactions where idempotency_key = p_idempotency_key;
  if v_tx_id is not null then return v_tx_id; end if;

  v_before := v_wallet.purchased_balance + v_wallet.promo_balance;
  if p_bucket = 'purchased' then
    update public.wallets set purchased_balance = purchased_balance + p_amount, updated_at = now() where user_id = p_user_id;
  else
    update public.wallets set promo_balance = promo_balance + p_amount, updated_at = now() where user_id = p_user_id;
  end if;
  select purchased_balance + promo_balance into v_after from public.wallets where user_id = p_user_id;

  insert into public.wallet_transactions(user_id,type,bucket,amount,reference_id,idempotency_key,balance_before,balance_after,metadata)
  values(p_user_id,p_type,p_bucket,p_amount,p_reference_id,p_idempotency_key,v_before,v_after,p_metadata)
  returning id into v_tx_id;
  return v_tx_id;
end;
$$;

create or replace function public.grant_welcome_credits(p_user_id uuid, p_amount numeric)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
begin
  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found or v_profile.welcome_granted_at is not null or p_amount <= 0 then return false; end if;
  perform public.credit_wallet(p_user_id,p_amount,'promo','promo_credit','welcome:'||p_user_id::text,'welcome','{"campaign":"welcome"}'::jsonb);
  update public.profiles set welcome_granted_at = now(), updated_at = now() where id = p_user_id;
  return true;
end;
$$;

create or replace function public.create_wallet_hold(
  p_user_id uuid,
  p_amount numeric,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_wallet public.wallets%rowtype;
  v_hold uuid;
  v_available numeric;
begin
  if p_amount <= 0 then raise exception 'Hold amount must be positive'; end if;
  select id into v_hold from public.wallet_holds where idempotency_key = p_idempotency_key;
  if v_hold is not null then return v_hold; end if;

  select * into v_wallet from public.wallets where user_id = p_user_id for update;
  if not found then raise exception 'Wallet not found'; end if;
  v_available := v_wallet.purchased_balance + v_wallet.promo_balance - v_wallet.reserved_balance;
  if v_available < p_amount then raise exception 'INSUFFICIENT_CREDITS'; end if;

  insert into public.wallet_holds(user_id,amount,idempotency_key,metadata)
  values(p_user_id,p_amount,p_idempotency_key,p_metadata) returning id into v_hold;
  update public.wallets set reserved_balance = reserved_balance + p_amount, updated_at = now() where user_id = p_user_id;
  return v_hold;
end;
$$;

create or replace function public.release_wallet_hold(p_hold_id uuid, p_reason text default 'released')
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_hold public.wallet_holds%rowtype;
begin
  select * into v_hold from public.wallet_holds where id = p_hold_id for update;
  if not found then return false; end if;
  if v_hold.status <> 'active' then return true; end if;
  update public.wallets set reserved_balance = greatest(0,reserved_balance - v_hold.amount), updated_at = now() where user_id = v_hold.user_id;
  update public.wallet_holds set status='released', finalized_at=now(), metadata=metadata||jsonb_build_object('release_reason',p_reason) where id=p_hold_id;
  return true;
end;
$$;

create or replace function public.capture_wallet_hold(
  p_hold_id uuid,
  p_amount numeric,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_hold public.wallet_holds%rowtype;
  v_wallet public.wallets%rowtype;
  v_tx_id uuid;
  v_before numeric;
  v_after numeric;
  v_from_promo numeric;
  v_from_purchased numeric;
begin
  select id into v_tx_id from public.wallet_transactions where idempotency_key=p_idempotency_key;
  if v_tx_id is not null then return v_tx_id; end if;
  if p_amount < 0 then raise exception 'Capture amount cannot be negative'; end if;

  select * into v_hold from public.wallet_holds where id=p_hold_id for update;
  if not found then raise exception 'Hold not found'; end if;
  if v_hold.status <> 'active' then raise exception 'Hold is not active'; end if;
  if p_amount > v_hold.amount then raise exception 'Capture exceeds reserved amount'; end if;

  select * into v_wallet from public.wallets where user_id=v_hold.user_id for update;
  v_before := v_wallet.purchased_balance + v_wallet.promo_balance;
  v_from_promo := least(v_wallet.promo_balance, p_amount);
  v_from_purchased := p_amount - v_from_promo;
  if v_from_purchased > v_wallet.purchased_balance then raise exception 'INSUFFICIENT_CREDITS'; end if;

  update public.wallets
    set promo_balance = promo_balance - v_from_promo,
        purchased_balance = purchased_balance - v_from_purchased,
        reserved_balance = greatest(0,reserved_balance - v_hold.amount),
        updated_at = now()
    where user_id = v_hold.user_id;

  update public.wallet_holds set status='captured', finalized_at=now() where id=p_hold_id;
  select purchased_balance + promo_balance into v_after from public.wallets where user_id=v_hold.user_id;

  insert into public.wallet_transactions(user_id,type,bucket,amount,reference_id,idempotency_key,balance_before,balance_after,metadata)
  values(v_hold.user_id,'generation_capture','mixed',-p_amount,p_hold_id::text,p_idempotency_key,v_before,v_after,p_metadata)
  returning id into v_tx_id;
  return v_tx_id;
end;
$$;

create or replace function public.approve_manual_payment(p_payment_id uuid, p_reviewer_id uuid, p_review_note text default null)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_payment public.manual_payments%rowtype;
  v_role public.user_role;
  v_tx uuid;
begin
  select role into v_role from public.profiles where id=p_reviewer_id;
  if v_role not in ('admin','owner') then raise exception 'Admin permission required'; end if;

  select * into v_payment from public.manual_payments where id=p_payment_id for update;
  if not found then raise exception 'Payment not found'; end if;
  if v_payment.status='approved' then
    select id into v_tx from public.wallet_transactions where idempotency_key='payment:'||p_payment_id::text;
    return v_tx;
  end if;
  if v_payment.status in ('duplicate','cancelled') then raise exception 'Payment cannot be approved'; end if;

  v_tx := public.credit_wallet(v_payment.user_id,v_payment.credits,'purchased','credit_purchase','payment:'||p_payment_id::text,v_payment.public_id,jsonb_build_object('method',v_payment.method,'amount_pkr',v_payment.amount_pkr));
  update public.manual_payments set status='approved', reviewed_by=p_reviewer_id, reviewed_at=now(), review_note=p_review_note, updated_at=now() where id=p_payment_id;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
  values(p_reviewer_id,'payment.approved','manual_payment',p_payment_id::text,jsonb_build_object('transaction_id',v_tx));
  return v_tx;
end;
$$;

-- RLS
alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.wallet_holds enable row level security;
alter table public.manual_payments enable row level security;
alter table public.models enable row level security;
alter table public.provider_models enable row level security;
alter table public.model_price_history enable row level security;
alter table public.projects enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.generation_jobs enable row level security;
alter table public.support_tickets enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles own read" on public.profiles for select using (auth.uid()=id);
create policy "wallet own read" on public.wallets for select using (auth.uid()=user_id);
create policy "transactions own read" on public.wallet_transactions for select using (auth.uid()=user_id);
create policy "holds own read" on public.wallet_holds for select using (auth.uid()=user_id);
create policy "payments own read" on public.manual_payments for select using (auth.uid()=user_id);
create policy "models public authenticated read" on public.models for select to authenticated using (active=true);
create policy "projects own all" on public.projects for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "conversations own all" on public.conversations for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "messages own read" on public.messages for select using (auth.uid()=user_id);
create policy "jobs own read" on public.generation_jobs for select using (auth.uid()=user_id);
create policy "tickets own read" on public.support_tickets for select using (auth.uid()=user_id);
create policy "tickets own insert" on public.support_tickets for insert with check (auth.uid()=user_id);

-- Storage access: payment proofs stay private and path starts with user id.
create policy "payment proof insert own path" on storage.objects for insert to authenticated
with check (bucket_id='payment-proofs' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "payment proof read own path" on storage.objects for select to authenticated
using (bucket_id='payment-proofs' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "user files own path" on storage.objects for all to authenticated
using (bucket_id='user-files' and (storage.foldername(name))[1]=auth.uid()::text)
with check (bucket_id='user-files' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "generated assets own path" on storage.objects for select to authenticated
using (bucket_id='generated-assets' and (storage.foldername(name))[1]=auth.uid()::text);

-- Revoke wallet RPCs from public/authenticated; server service-role can still execute.
revoke all on function public.credit_wallet(uuid,numeric,text,text,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.grant_welcome_credits(uuid,numeric) from public, anon, authenticated;
revoke all on function public.create_wallet_hold(uuid,numeric,text,jsonb) from public, anon, authenticated;
revoke all on function public.release_wallet_hold(uuid,text) from public, anon, authenticated;
revoke all on function public.capture_wallet_hold(uuid,numeric,text,jsonb) from public, anon, authenticated;
revoke all on function public.approve_manual_payment(uuid,uuid,text) from public, anon, authenticated;

grant execute on function public.credit_wallet(uuid,numeric,text,text,text,text,jsonb) to service_role;
grant execute on function public.grant_welcome_credits(uuid,numeric) to service_role;
grant execute on function public.create_wallet_hold(uuid,numeric,text,jsonb) to service_role;
grant execute on function public.release_wallet_hold(uuid,text) to service_role;
grant execute on function public.capture_wallet_hold(uuid,numeric,text,jsonb) to service_role;
grant execute on function public.approve_manual_payment(uuid,uuid,text) to service_role;
