-- Keep already-applied migration history immutable while correcting the
-- compatibility default used by legacy/manual quote inserts.
alter table public.billing_quotes
  alter column reservation_kind set default 'maximum';

comment on column public.billing_quotes.reservation_kind is
  'deterministic for exact calls; maximum for variable calls and legacy inserts. A reservation is not a customer charge.';
