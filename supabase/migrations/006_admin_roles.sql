create table if not exists admin_roles(
id uuid primary key default gen_random_uuid(),
user_id uuid not null,
role text default 'owner',
created_at timestamptz default now()
);
