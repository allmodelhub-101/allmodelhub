create table if not exists profit_records(
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
