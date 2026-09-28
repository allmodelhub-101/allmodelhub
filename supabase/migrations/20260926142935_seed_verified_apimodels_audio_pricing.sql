-- Provider-specific prices verified against the APIMODELS audio documentation.
-- Model markup remains sourced from public.models through the billing registry view.
insert into public.provider_pricing_rules (
  provider_key, model_id, upstream_model, pricing_version, billing_type, currency,
  flat_price, per_1k_character_price, effective_from, verified_at,
  source_name, source_url, source_metadata, status, active, metadata
)
values
  ('apimodels','eleven-tts-flash','eleven-tts-flash','apimodels-audio-2026-09-26','character','USD',null,0.0425,'2026-09-26T00:00:00Z','2026-09-26T14:00:00Z','APIMODELS Audio API','https://apimodels.app/en/docs/audio','{"unit":"per 1K chars"}'::jsonb,'verified',true,'{}'::jsonb),
  ('apimodels','eleven-tts-multilingual','eleven-tts-multilingual','apimodels-audio-2026-09-26','character','USD',null,0.085,'2026-09-26T00:00:00Z','2026-09-26T14:00:00Z','APIMODELS Audio API','https://apimodels.app/en/docs/audio','{"unit":"per 1K chars"}'::jsonb,'verified',true,'{}'::jsonb),
  ('apimodels','eleven-tts-v3','eleven-tts-v3','apimodels-audio-2026-09-26','character','USD',null,0.085,'2026-09-26T00:00:00Z','2026-09-26T14:00:00Z','APIMODELS Audio API','https://apimodels.app/en/docs/audio','{"unit":"per 1K chars"}'::jsonb,'verified',true,'{}'::jsonb),
  ('apimodels','minimax-speech-2-8-turbo','minimax-speech-2.8-turbo','apimodels-audio-2026-09-26','character','USD',null,0.04,'2026-09-26T00:00:00Z','2026-09-26T14:00:00Z','APIMODELS Audio API','https://apimodels.app/en/docs/audio','{"unit":"per 1K chars"}'::jsonb,'verified',true,'{}'::jsonb),
  ('apimodels','minimax-speech-2-8-hd','minimax-speech-2.8-hd','apimodels-audio-2026-09-26','character','USD',null,0.063,'2026-09-26T00:00:00Z','2026-09-26T14:00:00Z','APIMODELS Audio API','https://apimodels.app/en/docs/audio','{"unit":"per 1K chars"}'::jsonb,'verified',true,'{}'::jsonb),
  ('apimodels','kling-tts','kling-tts','apimodels-audio-2026-09-26','flat','USD',0.01,null,'2026-09-26T00:00:00Z','2026-09-26T14:00:00Z','APIMODELS Audio API','https://apimodels.app/en/docs/audio','{"unit":"per call"}'::jsonb,'verified',true,'{}'::jsonb),
  ('apimodels','kling-sound-effects','kling-sound-effects','apimodels-audio-2026-09-26','flat','USD',0.044,null,'2026-09-26T00:00:00Z','2026-09-26T14:00:00Z','APIMODELS Audio API','https://apimodels.app/en/docs/audio','{"unit":"per call","output_duration_seconds":"3-10"}'::jsonb,'verified',true,'{}'::jsonb),
  ('apimodels','suno-v5','suno-v5','apimodels-audio-2026-09-26','flat','USD',0.26,null,'2026-09-26T00:00:00Z','2026-09-26T14:00:00Z','APIMODELS Audio API','https://apimodels.app/en/docs/audio','{"unit":"per song call","variants":2}'::jsonb,'verified',true,'{}'::jsonb)
on conflict (provider_key, model_id, upstream_model, pricing_version) do nothing;
