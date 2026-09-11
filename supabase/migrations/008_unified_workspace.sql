alter table public.generation_jobs
  add column if not exists project_id uuid references public.projects(id) on delete set null;

create index if not exists generation_jobs_project_idx
  on public.generation_jobs(user_id, project_id, created_at desc);

alter table public.models
  add column if not exists ui_schema jsonb not null default '{}'::jsonb;

create table if not exists public.asset_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid references public.generation_jobs(id) on delete cascade,
  file_id uuid references public.user_files(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint asset_favorites_one_source check ((job_id is not null)::int + (file_id is not null)::int = 1),
  unique nulls not distinct (user_id, job_id, file_id)
);

alter table public.asset_favorites enable row level security;
create policy "asset favorites own read" on public.asset_favorites for select to authenticated using ((select auth.uid()) = user_id);
create policy "asset favorites own insert" on public.asset_favorites for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "asset favorites own delete" on public.asset_favorites for delete to authenticated using ((select auth.uid()) = user_id);

