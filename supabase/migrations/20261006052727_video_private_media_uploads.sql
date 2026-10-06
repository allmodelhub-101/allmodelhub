-- Direct, fixed-path signed media uploads avoid Vercel's 4.5 MB body limit.
-- These buckets intentionally have no client storage policies.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types) values
  ('media-uploads', 'media-uploads', false, 52428800, array['video/mp4','audio/wav','audio/mpeg']),
  ('provider-inputs', 'provider-inputs', false, 52428800, array['video/mp4','audio/wav','audio/mpeg'])
on conflict (id) do nothing;

create table public.media_upload_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  reservation_id uuid not null,
  storage_path text not null unique,
  destination_path text not null unique,
  name text not null,
  mime_type text not null check (mime_type in ('video/mp4','audio/wav','audio/mpeg')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.media_upload_sessions enable row level security;
alter table public.media_upload_sessions force row level security;
revoke all on public.media_upload_sessions from public, anon, authenticated;
grant all on public.media_upload_sessions to service_role;
create index media_upload_sessions_cleanup_idx on public.media_upload_sessions(created_at);

-- Insert the verified file and consume its quota reservation atomically.
-- Invoker permissions and explicit service-only grants prevent browser forgery.
create function public.finalize_media_upload(p_session_id uuid, p_user_id uuid, p_metadata jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare s public.media_upload_sessions%rowtype; f public.user_files%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  select * into s from public.media_upload_sessions where id=p_session_id and user_id=p_user_id for update;
  if not found then raise exception 'MEDIA_UPLOAD_NOT_FOUND'; end if;
  if s.completed_at is not null then
    select * into f from public.user_files where id=s.id and user_id=p_user_id;
    if not found then raise exception 'MEDIA_UPLOAD_FILE_REMOVED'; end if;
    return to_jsonb(f);
  end if;
  if s.expires_at <= now() then raise exception 'MEDIA_UPLOAD_EXPIRED'; end if;
  perform 1 from public.file_upload_reservations where id=s.reservation_id and user_id=p_user_id
    and size_bytes=s.size_bytes and expires_at > now() for update;
  if not found then raise exception 'MEDIA_UPLOAD_RESERVATION_EXPIRED'; end if;
  if coalesce((p_metadata->>'duration')::numeric,0) <= 0 then raise exception 'MEDIA_DURATION_UNAVAILABLE'; end if;
  if s.project_id is not null and not exists(select 1 from public.projects where id=s.project_id and user_id=p_user_id)
    then raise exception 'MEDIA_UPLOAD_PROJECT_UNAVAILABLE'; end if;
  insert into public.user_files(id,user_id,project_id,storage_path,name,mime_type,size_bytes,media_metadata,extraction_status)
    values(s.id,s.user_id,s.project_id,s.destination_path,s.name,s.mime_type,s.size_bytes,p_metadata,'unsupported') returning * into f;
  delete from public.file_upload_reservations where id=s.reservation_id and user_id=p_user_id;
  update public.media_upload_sessions set completed_at=now() where id=s.id;
  return to_jsonb(f);
end $$;
revoke all on function public.finalize_media_upload(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.finalize_media_upload(uuid,uuid,jsonb) to service_role;

-- Provider sources are immutable copies in a separate private bucket, not
-- mutable browser-owned objects. The relay redirects instead of proxying bytes.
alter table public.provider_input_assets
  add column storage_path text not null unique,
  add column mime_type text not null check (mime_type in ('video/mp4','audio/wav','audio/mpeg')),
  add column size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 52428800);

