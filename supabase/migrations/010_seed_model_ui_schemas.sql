update public.models
set ui_schema = case
  when modality = 'image' then jsonb_build_object(
    'inputModes', case when capabilities ? 'editing' then '["text","image"]'::jsonb else '["text"]'::jsonb end,
    'aspectRatios', '["1:1","16:9","9:16","4:3","3:4"]'::jsonb,
    'maxReferences', case when capabilities ? 'multi-reference' then 10 when capabilities ? 'editing' then 1 else 0 end
  )
  when modality = 'video' then jsonb_build_object(
    'inputModes', case when capabilities ? 'image-to-video' then '["text","image"]'::jsonb else '["text"]'::jsonb end,
    'aspectRatios', '["16:9","9:16","1:1"]'::jsonb,
    'durationOptions', case when id = 'veo-3-1-fast-fhd' then '[8]'::jsonb else '[5,10]'::jsonb end,
    'resolutionOptions', case when capabilities ? '1080p' then '["1080p"]'::jsonb else '["720p"]'::jsonb end,
    'maxReferences', case when capabilities ? 'image-to-video' then 1 else 0 end,
    'nativeAudio', capabilities ? 'audio'
  )
  when id = 'suno-v5' then '{"inputModes":["text","audio"],"audioModes":["music"],"durationOptions":[10,30,60],"maxReferences":0}'::jsonb
  when id = 'kling-sound-effects' then '{"inputModes":["text"],"audioModes":["sfx"],"durationOptions":[3,5,10],"maxReferences":0}'::jsonb
  when modality = 'text' then jsonb_build_object(
    'inputModes', case when capabilities ?| array['vision','multimodal'] then '["text","image"]'::jsonb else '["text"]'::jsonb end
  )
  else ui_schema
end
where active = true;

