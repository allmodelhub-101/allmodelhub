create index billing_shadow_validations_model_fk_idx
  on public.billing_shadow_validations (model_id);

create index billing_shadow_validations_receipt_fk_idx
  on public.billing_shadow_validations (receipt_id)
  where receipt_id is not null;
