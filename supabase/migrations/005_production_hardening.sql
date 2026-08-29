-- Prevent duplicate manual payment references regardless of casing or surrounding whitespace.
create unique index if not exists manual_payments_method_reference_unique_idx
  on public.manual_payments (method, lower(trim(transaction_reference)));
