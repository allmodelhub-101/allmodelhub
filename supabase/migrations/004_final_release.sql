-- All Model Hub final release hardening and product-completeness migration

alter type public.payment_status add value if not exists 'request_new_proof';

alter table public.conversations add column if not exists pinned boolean not null default false;
alter table public.conversations add column if not exists private boolean not null default false;
alter table public.conversations add column if not exists archived boolean not null default false;
alter table public.conversations add column if not exists branch_of uuid references public.conversations(id) on delete set null;

alter table public.profiles add column if not exists custom_instructions text;

alter table public.messages add column if not exists parent_message_id uuid references public.messages(id) on delete set null;

create table if not exists public.user_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  storage_path text not null unique,
  name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  extracted_text text,
  extraction_status text not null default 'stored' check (extraction_status in ('stored','ready','unsupported','failed')),
  created_at timestamptz not null default now()
);
create index if not exists user_files_user_created_idx on public.user_files(user_id, created_at desc);
create index if not exists user_files_project_idx on public.user_files(project_id, created_at desc);

create table if not exists public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete cascade,
  message_id uuid references public.messages(id) on delete cascade,
  file_id uuid not null references public.user_files(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(message_id, file_id)
);

create table if not exists public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  author_role text not null default 'user' check (author_role in ('user','support','admin','system')),
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists ticket_messages_ticket_idx on public.ticket_messages(ticket_id, created_at asc);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event text not null,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists analytics_events_event_idx on public.analytics_events(event, created_at desc);
create index if not exists analytics_events_user_idx on public.analytics_events(user_id, created_at desc);

create table if not exists public.platform_errors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  scope text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.feature_flags (
  key text primary key,
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.system_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.feature_flags(key, enabled, config) values
('model_battle', true, '{}'),
('image_studio', true, '{}'),
('video_studio', true, '{}'),
('audio_studio', true, '{}'),
('prompt_enhancer', true, '{}'),
('private_chat', true, '{}'),
('teams', false, '{"release":"v1.5"}')
on conflict (key) do nothing;

insert into public.system_settings(key, value) values
('internal_usd_pkr', '310'::jsonb),
('min_topup_pkr', '500'::jsonb),
('welcome_credits', '10'::jsonb),
('purchased_credits_expire', 'false'::jsonb)
on conflict (key) do nothing;

alter table public.user_files enable row level security;
alter table public.message_attachments enable row level security;
alter table public.ticket_messages enable row level security;
alter table public.analytics_events enable row level security;
alter table public.platform_errors enable row level security;
alter table public.feature_flags enable row level security;
alter table public.system_settings enable row level security;

create policy "files own all" on public.user_files for all
using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "attachments own all" on public.message_attachments for all
using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "ticket messages own read" on public.ticket_messages for select
using (exists (select 1 from public.support_tickets t where t.id=ticket_id and t.user_id=auth.uid()));
create policy "ticket messages own insert" on public.ticket_messages for insert
with check (
  auth.uid() = user_id and author_role='user' and
  exists (select 1 from public.support_tickets t where t.id=ticket_id and t.user_id=auth.uid())
);

create policy "analytics own insert" on public.analytics_events for insert with check (auth.uid() = user_id or user_id is null);
create policy "analytics own read" on public.analytics_events for select using (auth.uid() = user_id);
create policy "platform errors own insert" on public.platform_errors for insert with check (auth.uid() = user_id or user_id is null);

create policy "feature flags read" on public.feature_flags for select using (true);
-- system_settings intentionally has no public/authenticated read policy; server/admin access uses service role.

-- Storage buckets. Private access is enforced with signed URLs and user-folder policies.
insert into storage.buckets(id,name,public,file_size_limit) values
('user-files','user-files',false,52428800),
('payment-proofs','payment-proofs',false,10485760),
('generated-assets','generated-assets',false,524288000)
on conflict (id) do update set public=false, file_size_limit=excluded.file_size_limit;

drop policy if exists "user files upload own folder" on storage.objects;
create policy "user files upload own folder" on storage.objects for insert to authenticated
with check (bucket_id='user-files' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "user files read own folder" on storage.objects;
create policy "user files read own folder" on storage.objects for select to authenticated
using (bucket_id='user-files' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "user files delete own folder" on storage.objects;
create policy "user files delete own folder" on storage.objects for delete to authenticated
using (bucket_id='user-files' and (storage.foldername(name))[1] = auth.uid()::text);

-- Make wallet ledger append-only for normal application users. Service-role operations still work.
revoke insert, update, delete on public.wallet_transactions from anon, authenticated;
revoke insert, update, delete on public.wallet_holds from anon, authenticated;
revoke update, delete on public.wallets from anon, authenticated;

-- Useful indexes for product history/search.
create index if not exists conversations_search_idx on public.conversations(user_id, archived, pinned, updated_at desc);
create index if not exists messages_user_created_idx on public.messages(user_id, created_at desc);

-- Cross-request idempotency. Server/service-role claims a client request id before any billable provider call.
create table if not exists public.request_idempotency (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null,
  request_key text not null,
  status text not null default 'processing' check (status in ('processing','completed','failed')),
  resource_id text,
  response_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, scope, request_key)
);
create index if not exists request_idempotency_user_created_idx on public.request_idempotency(user_id, created_at desc);
alter table public.request_idempotency enable row level security;
-- No authenticated/anon policies: claims and updates are server-only through the service role.
