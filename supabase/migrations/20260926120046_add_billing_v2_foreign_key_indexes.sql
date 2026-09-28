-- PostgreSQL does not automatically index foreign keys. Keep these separate
-- from the already-applied Billing V2 schema migration as a forward-only fix.
create index billing_provider_pricing_rules_model_fk_idx
  on public.provider_pricing_rules (model_id);

create index billing_quotes_model_fk_idx
  on public.billing_quotes (model_id);

create index billing_usage_events_model_fk_idx
  on public.billing_usage_events (model_id);

create index billing_receipts_model_fk_idx
  on public.billing_receipts (model_id);

create index billing_anomalies_user_fk_idx
  on public.billing_anomalies (user_id)
  where user_id is not null;
create index billing_anomalies_quote_fk_idx
  on public.billing_anomalies (quote_id)
  where quote_id is not null;
create index billing_anomalies_usage_event_fk_idx
  on public.billing_anomalies (usage_event_id)
  where usage_event_id is not null;
create index billing_anomalies_receipt_fk_idx
  on public.billing_anomalies (receipt_id)
  where receipt_id is not null;
create index billing_anomalies_model_fk_idx
  on public.billing_anomalies (model_id);
