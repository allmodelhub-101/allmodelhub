create unique index billing_anomalies_shadow_quote_type_uidx
  on public.billing_anomalies (quote_id, anomaly_type)
  where anomaly_type like 'shadow_%_charge_mismatch';
