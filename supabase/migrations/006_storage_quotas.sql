-- Atomic per-account storage reservations prevent concurrent uploads from bypassing quotas.
create table if not exists public.file_upload_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  size_bytes bigint not null check (size_bytes > 0),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  created_at timestamptz not null default now()
);

create index if not exists file_upload_reservations_user_expiry_idx
  on public.file_upload_reservations (user_id, expires_at);

alter table public.file_upload_reservations enable row level security;
revoke all on table public.file_upload_reservations from anon, authenticated;
create policy "storage reservations deny client access"
  on public.file_upload_reservations for all to authenticated
  using (false) with check (false);

create or replace function public.reserve_file_upload(
  p_user_id uuid,
  p_size_bytes bigint,
  p_limit_bytes bigint
) returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_used bigint;
  v_reserved bigint;
  v_id uuid;
begin
  if p_size_bytes <= 0 or p_limit_bytes <= 0 then raise exception 'INVALID_STORAGE_RESERVATION'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  delete from public.file_upload_reservations where expires_at <= now();
  select coalesce(sum(size_bytes), 0)::bigint into v_used from public.user_files where user_id = p_user_id;
  select coalesce(sum(size_bytes), 0)::bigint into v_reserved from public.file_upload_reservations where user_id = p_user_id and expires_at > now();
  if v_used + v_reserved + p_size_bytes > p_limit_bytes then raise exception 'STORAGE_QUOTA_EXCEEDED'; end if;
  insert into public.file_upload_reservations (user_id, size_bytes) values (p_user_id, p_size_bytes) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.release_file_upload_reservation(
  p_reservation_id uuid,
  p_user_id uuid
) returns boolean
language plpgsql
set search_path = public
as $$
begin
  delete from public.file_upload_reservations where id = p_reservation_id and user_id = p_user_id;
  return found;
end;
$$;

revoke all on function public.reserve_file_upload(uuid,bigint,bigint) from public, anon, authenticated;
revoke all on function public.release_file_upload_reservation(uuid,uuid) from public, anon, authenticated;
grant execute on function public.reserve_file_upload(uuid,bigint,bigint) to service_role;
grant execute on function public.release_file_upload_reservation(uuid,uuid) to service_role;

