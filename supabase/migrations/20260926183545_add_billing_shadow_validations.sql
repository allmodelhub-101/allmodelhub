create table public.billing_shadow_validations (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.billing_quotes(id) on delete restrict,
  receipt_id uuid references public.billing_receipts(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  phase text not null check (phase in ('quote', 'settlement', 'failure')),
  provider_key text not null,
  model_id text not null references public.models(id) on delete restrict,
  pricing_version text not null,
  internal_usd_pkr_rate numeric(38,18) not null check (internal_usd_pkr_rate > 0),
  legacy_expected_charge_credits numeric(38,18) not null check (legacy_expected_charge_credits >= 0),
  billing_v2_charge_credits numeric(38,18) not null check (billing_v2_charge_credits >= 0),
  variance_credits numeric(38,18) generated always as (billing_v2_charge_credits - legacy_expected_charge_credits) stored,
  absolute_variance_credits numeric(38,18) generated always as (abs(billing_v2_charge_credits - legacy_expected_charge_credits)) stored,
  relative_variance numeric(38,18),
  tolerance_credits numeric(38,18) not null check (tolerance_credits >= 0),
  mismatch boolean not null,
  severity text check (severity is null or severity in ('low', 'medium', 'high', 'critical')),
  legacy_source text not null,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now(),
  constraint billing_shadow_validations_phase_key unique (quote_id, phase),
  constraint billing_shadow_validations_receipt_phase_check check (
    (phase = 'quote' and receipt_id is null)
    or (phase in ('settlement', 'failure'))
  ),
  constraint billing_shadow_validations_mismatch_check check (
    (mismatch and severity is not null)
    or (not mismatch and severity is null)
  )
);

create index billing_shadow_validations_mismatch_idx
  on public.billing_shadow_validations (severity, created_at desc)
  where mismatch;
create index billing_shadow_validations_model_idx
  on public.billing_shadow_validations (provider_key, model_id, pricing_version, created_at desc);
create index billing_shadow_validations_user_idx
  on public.billing_shadow_validations (user_id, created_at desc);

alter table public.billing_shadow_validations enable row level security;
alter table public.billing_shadow_validations force row level security;
revoke all on table public.billing_shadow_validations from public, anon, authenticated;
grant all on table public.billing_shadow_validations to service_role;

comment on table public.billing_shadow_validations is
  'Read-only financial shadow comparisons. These rows never reserve, debit, capture, or release wallet funds.';
