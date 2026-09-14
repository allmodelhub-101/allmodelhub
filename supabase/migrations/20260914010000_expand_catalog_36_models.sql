-- Additive, idempotent catalog expansion. Existing model rows and routes are untouched.
alter table public.models add column if not exists ui_schema jsonb not null default '{}'::jsonb;

with catalog as (
  select * from jsonb_to_recordset($catalog$
  [
    {"id":"gpt-6-astra","display_name":"GPT-6 Astra","provider_family":"OpenAI","tier":"flagship","modality":"text","description":"Frontier reasoning, coding and long-horizon agent work.","upstream_model":"gpt-6-astra","input_usd_per_million":2.4,"output_usd_per_million":12,"markup":2.5,"capabilities":["frontier","reasoning","coding","vision","tools","web","long-context"]},
    {"id":"claude-sonnet-5","display_name":"Claude Sonnet 5","provider_family":"Anthropic","tier":"premium","modality":"text","description":"Adaptive reasoning for professional writing, coding and business work.","upstream_model":"claude-sonnet-5","input_usd_per_million":1.6,"output_usd_per_million":8,"markup":2.3,"capabilities":["reasoning","writing","coding","tools","long-context"]},
    {"id":"claude-fable-5-1","display_name":"Claude Fable 5.1","provider_family":"Anthropic","tier":"flagship","modality":"text","description":"Agentic coding and complex multimodal work across large projects.","upstream_model":"claude-fable-5-1","input_usd_per_million":5,"output_usd_per_million":25,"markup":2.5,"capabilities":["frontier","reasoning","coding","multimodal","tools","long-context"]},
    {"id":"gemini-3-8-flash","display_name":"Gemini 3.8 Flash","provider_family":"Google","tier":"balanced","modality":"text","description":"Fast multimodal intelligence for coding, research and documents.","upstream_model":"gemini-3.8-flash","input_usd_per_million":0.45,"output_usd_per_million":2.25,"markup":2.15,"capabilities":["fast","reasoning","coding","multimodal","tools","long-context"]},
    {"id":"grok-4-6","display_name":"Grok 4.6","provider_family":"xAI","tier":"flagship","modality":"text","description":"Frontier reasoning for long-running agents, coding and research.","upstream_model":"grok-4.6","input_usd_per_million":1.765,"output_usd_per_million":5.294,"markup":2.5,"capabilities":["frontier","reasoning","vision","tools","long-context"]},
    {"id":"deepseek-v4-pro","display_name":"DeepSeek V4 Pro","provider_family":"DeepSeek","tier":"premium","modality":"text","description":"Cost-efficient advanced reasoning for technical and agentic work.","upstream_model":"deepseek-v4-pro","input_usd_per_million":0.37,"output_usd_per_million":0.74,"markup":2.3,"capabilities":["reasoning","thinking","coding","tools","long-context"]},
    {"id":"qwen3-8-flash","display_name":"Qwen 3.8 Flash","provider_family":"Alibaba","tier":"budget","modality":"text","description":"Low-cost reasoning and tool use for high-volume work.","upstream_model":"qwen3.8-flash","input_usd_per_million":0.15,"output_usd_per_million":0.47,"markup":2,"capabilities":["fast","reasoning","thinking","coding","tools","long-context"]},
    {"id":"qwen3-8-max","display_name":"Qwen 3.8 Max","provider_family":"Alibaba","tier":"flagship","modality":"text","description":"Flagship Qwen reasoning for agents, coding and research.","upstream_model":"qwen3.8-max","input_usd_per_million":2,"output_usd_per_million":6,"markup":2.5,"capabilities":["frontier","reasoning","thinking","coding","tools","long-context"]},
    {"id":"glm-5-3","display_name":"GLM-5.3","provider_family":"Zhipu","tier":"premium","modality":"text","description":"Long-context reasoning and tool calling for agents and software work.","upstream_model":"glm-5.3","input_usd_per_million":1.33,"output_usd_per_million":4.18,"markup":2.3,"capabilities":["reasoning","coding","tools","long-context"]},
    {"id":"claude-haiku-4-5","display_name":"Claude Haiku 4.5","provider_family":"Anthropic","tier":"budget","modality":"text","description":"Fast, inexpensive Anthropic intelligence for everyday tasks.","upstream_model":"claude-haiku-4-5-20251001","input_usd_per_million":0.353,"output_usd_per_million":1.765,"markup":2,"capabilities":["fast","reasoning","writing"]},

    {"id":"gpt-image-2-5-flare","display_name":"GPT Image 2.5 Flare","provider_family":"OpenAI","tier":"premium","modality":"image","description":"Fast premium image creation with precise editing and consistency.","upstream_model":"gpt-image-2.5-flare","flat_usd":0.008,"markup":2.25,"capabilities":["text-to-image","editing","multi-reference","transparent-png"],"ui_schema":{"inputModes":["text","image"],"aspectRatios":["1:1","16:9","9:16","4:3","3:4"],"resolutionOptions":["1K","2K","4K"],"maxReferences":16}},
    {"id":"gpt-image-2-5-sunburst","display_name":"GPT Image 2.5 Sunburst","provider_family":"OpenAI","tier":"flagship","modality":"image","description":"Maximum-fidelity image creation for demanding commercial work.","upstream_model":"gpt-image-2.5-sunburst","flat_usd":0.008,"markup":2.25,"capabilities":["text-to-image","editing","multi-reference","transparent-png"],"ui_schema":{"inputModes":["text","image"],"aspectRatios":["1:1","16:9","9:16","4:3","3:4"],"resolutionOptions":["1K","2K","4K"],"maxReferences":16}},
    {"id":"grok-imagine-image-2","display_name":"Grok Imagine Image 2.0","provider_family":"xAI","tier":"premium","modality":"image","description":"Designer-grade images, typography and multi-image editing.","upstream_model":"grok-imagine-image-2","flat_usd":0.03,"markup":2.25,"capabilities":["text-to-image","editing","multi-reference","typography"],"ui_schema":{"inputModes":["text","image"],"resolutionOptions":["1K","2K"],"maxReferences":10}},
    {"id":"doubao-seedream-5-0-pro","display_name":"Doubao Seedream 5.0 Pro","provider_family":"Doubao","tier":"premium","modality":"image","description":"Commercial image generation with layered, interactive editing.","upstream_model":"doubao-seedream-5-0-pro","flat_usd":0.03,"markup":2.25,"capabilities":["text-to-image","editing","multi-reference","typography","layer-separation"],"ui_schema":{"inputModes":["text","image"],"resolutionOptions":["1K","2K"],"maxReferences":10}},
    {"id":"gemini-3-1-flash-image","display_name":"Gemini 3.1 Flash Image","provider_family":"Google","tier":"balanced","modality":"image","description":"Fast everyday image generation and editing up to 4K.","upstream_model":"gemini-3.1-flash-image","flat_usd":0.04,"markup":2.25,"capabilities":["text-to-image","editing","multi-reference"],"ui_schema":{"inputModes":["text","image"],"resolutionOptions":["512","1K","2K","4K"],"maxReferences":10}},
    {"id":"gemini-3-pro-image","display_name":"Gemini 3 Pro Image","provider_family":"Google","tier":"flagship","modality":"image","description":"High-fidelity premium image generation and advanced editing.","upstream_model":"gemini-3-pro-image","flat_usd":0.1,"markup":2.25,"capabilities":["text-to-image","editing","high-resolution"],"ui_schema":{"inputModes":["text","image"],"resolutionOptions":["1K","2K","4K"],"maxReferences":5}},
    {"id":"qwen3-image","display_name":"Qwen Image 3.0","provider_family":"Alibaba","tier":"balanced","modality":"image","description":"Multilingual image creation with excellent dense text layout.","upstream_model":"qwen3-image","flat_usd":0.035,"markup":2.25,"capabilities":["text-to-image","editing","typography","multilingual"],"ui_schema":{"inputModes":["text","image"],"resolutionOptions":["1K","2K"],"maxReferences":4}},
    {"id":"kling-v3-image","display_name":"Kling V3 Image","provider_family":"Kling","tier":"premium","modality":"image","description":"High-resolution creative generation and image-to-image editing.","upstream_model":"kling-v3-image","flat_usd":0.05,"markup":2.25,"capabilities":["text-to-image","image-to-image","editing"],"ui_schema":{"inputModes":["text","image"],"resolutionOptions":["1K","2K"],"maxReferences":1}},
    {"id":"real-esrgan","display_name":"Real-ESRGAN Upscaler","provider_family":"Real-ESRGAN","tier":"budget","modality":"image","description":"Upscale and restore illustrations, anime and artwork.","upstream_model":"real-esrgan","flat_usd":0.004,"markup":2.25,"capabilities":["upscaling","restoration","face-enhancement"],"ui_schema":{"inputModes":["image"],"resolutionOptions":["4K","8K","10K"],"maxReferences":1}},

    {"id":"seedance-2-5","display_name":"Seedance 2.5","provider_family":"ByteDance","tier":"flagship","modality":"video","description":"Long-form cinematic generation, editing and extension.","upstream_model":"seedance-2.5","per_second_usd":0.12,"markup":2.1,"capabilities":["text-to-video","image-to-video","video-editing","video-extension","native-audio","multi-reference"],"ui_schema":{"inputModes":["text","image","audio"],"durationOptions":[4,5,8,10,15,30],"resolutionOptions":["480p","720p"],"maxReferences":10,"nativeAudio":true}},
    {"id":"seedance-2-0","display_name":"Seedance 2.0","provider_family":"ByteDance","tier":"premium","modality":"video","description":"Full multimodal cinematic video with synchronized audio.","upstream_model":"seedance-2.0","per_second_usd":0.092,"markup":2.1,"capabilities":["text-to-video","image-to-video","multi-reference","native-audio"],"ui_schema":{"inputModes":["text","image","audio"],"durationOptions":[4,5,8,10,15],"resolutionOptions":["480p","720p","1080p"],"maxReferences":9,"nativeAudio":true}},
    {"id":"seedance-2-0-mini","display_name":"Seedance 2.0 Mini","provider_family":"ByteDance","tier":"budget","modality":"video","description":"Affordable multimodal video generation with synchronized audio.","upstream_model":"seedance-2.0-mini","per_second_usd":0.044,"markup":2.1,"capabilities":["text-to-video","image-to-video","multi-reference","native-audio"],"ui_schema":{"inputModes":["text","image","audio"],"durationOptions":[4,5,8,10,15],"resolutionOptions":["480p","720p"],"maxReferences":9,"nativeAudio":true}},
    {"id":"gemini-omni-1-1-flash","display_name":"Gemini Omni 1.1 Flash","provider_family":"Google","tier":"flagship","modality":"video","description":"Multimodal video generation, reference workflows and editing up to 4K.","upstream_model":"gemini-omni-1.1-flash","per_second_usd":0.07,"markup":2.1,"capabilities":["text-to-video","image-to-video","video-editing","multi-reference","native-audio"],"ui_schema":{"inputModes":["text","image"],"durationOptions":[4,6,8,10],"resolutionOptions":["720p","1080p","4K"],"maxReferences":7,"nativeAudio":true}},
    {"id":"minimax-h3","display_name":"MiniMax Hailuo H3","provider_family":"MiniMax","tier":"premium","modality":"video","description":"High-quality multimodal video with synchronized audio.","upstream_model":"minimax-h3","per_second_usd":0.097,"markup":2.1,"capabilities":["text-to-video","image-to-video","multi-reference","native-audio","2k"],"ui_schema":{"inputModes":["text","image","audio"],"durationOptions":[5,6,8,10,15],"resolutionOptions":["768p","2K"],"maxReferences":9,"nativeAudio":true}},
    {"id":"minimax-h3-max-turbo","display_name":"MiniMax H3 Max Turbo","provider_family":"MiniMax","tier":"balanced","modality":"video","description":"Accelerated cinematic video for fast iteration.","upstream_model":"minimax-h3-max-turbo","per_second_usd":0.06,"markup":2.1,"capabilities":["fast","text-to-video","image-to-video","first-last-frame"],"ui_schema":{"inputModes":["text","image"],"durationOptions":[5,6,8,10,15],"resolutionOptions":["480p","768p"],"maxReferences":2}},
    {"id":"wan-3-0-video","display_name":"Wan 3.0 Video","provider_family":"Alibaba","tier":"premium","modality":"video","description":"Versatile long-form video with omni-reference and native audio.","upstream_model":"wan-3.0-video","per_second_usd":0.0477,"markup":2.1,"capabilities":["text-to-video","image-to-video","omni-reference","document-to-video","native-audio"],"ui_schema":{"inputModes":["text","image","audio"],"durationOptions":[5,8,10,15,30],"resolutionOptions":["480p","720p","1080p"],"maxReferences":10,"nativeAudio":true}},
    {"id":"grok-video-3","display_name":"Grok Video 3","provider_family":"xAI","tier":"premium","modality":"video","description":"Cinematic text and reference-image video for social content.","upstream_model":"grok-video-3","per_second_usd":0.02,"markup":2.1,"capabilities":["text-to-video","image-to-video","multi-reference"],"ui_schema":{"inputModes":["text","image"],"durationOptions":[6,10,15],"resolutionOptions":["480p","720p"],"maxReferences":7}},
    {"id":"flashvsr","display_name":"FlashVSR Video Upscale","provider_family":"MuleRouter","tier":"balanced","modality":"video","description":"Restore and upscale existing video footage up to 4K.","upstream_model":"flashvsr","per_second_usd":0.02,"markup":2.1,"capabilities":["video-upscaling","restoration"],"ui_schema":{"inputModes":["video"],"durationOptions":[5,10,15,30],"resolutionOptions":["720p","1080p","2K","4K"],"maxReferences":1}},

    {"id":"eleven-tts-v3","display_name":"Eleven v3","provider_family":"ElevenLabs","tier":"flagship","modality":"audio","description":"Highly expressive multilingual speech with audio-tag control.","upstream_model":"eleven-tts-v3","per_1k_chars_usd":0.085,"markup":2.2,"capabilities":["tts","multilingual","audio-tags"]},
    {"id":"eleven-tts-multilingual","display_name":"Eleven Multilingual v2","provider_family":"ElevenLabs","tier":"premium","modality":"audio","description":"Emotionally rich multilingual narration and voiceover.","upstream_model":"eleven-tts-multilingual","per_1k_chars_usd":0.085,"markup":2.2,"capabilities":["tts","multilingual","emotional-speech"]},
    {"id":"eleven-dialogue","display_name":"ElevenLabs Dialogue","provider_family":"ElevenLabs","tier":"premium","modality":"audio","description":"Natural multi-speaker dialogue for podcasts and stories.","upstream_model":"eleven-dialogue","per_1k_chars_usd":0.085,"markup":2.2,"capabilities":["dialogue","multi-speaker"]},
    {"id":"eleven-dubbing","display_name":"ElevenLabs Dubbing","provider_family":"ElevenLabs","tier":"premium","modality":"audio","description":"Translate and dub existing audio or video while preserving emotion.","upstream_model":"eleven-dubbing","per_second_usd":0.004675,"markup":2.2,"capabilities":["dubbing","localization","audio-input","video-input"]},
    {"id":"eleven-isolator","display_name":"Voice Isolator","provider_family":"ElevenLabs","tier":"balanced","modality":"audio","description":"Extract clean speech and remove background noise.","upstream_model":"eleven-isolator","per_second_usd":0.0017,"markup":2.2,"capabilities":["voice-isolation","noise-removal","audio-input"]},
    {"id":"minimax-speech-2-8-turbo","display_name":"MiniMax Speech 2.8 Turbo","provider_family":"MiniMax","tier":"balanced","modality":"audio","description":"Fast, cost-efficient speech with voice clone and design support.","upstream_model":"minimax-speech-2.8-turbo","per_1k_chars_usd":0.04,"markup":2.2,"capabilities":["tts","fast","voice-clone","voice-design"]},
    {"id":"minimax-speech-2-8-hd","display_name":"MiniMax Speech 2.8 HD","provider_family":"MiniMax","tier":"premium","modality":"audio","description":"Emotion-aware HD speech for premium narration and characters.","upstream_model":"minimax-speech-2.8-hd","per_1k_chars_usd":0.063,"markup":2.2,"capabilities":["tts","hd-speech","voice-clone","voice-design"]},
    {"id":"kling-tts","display_name":"Kling TTS","provider_family":"Kling","tier":"budget","modality":"audio","description":"Affordable multilingual speech with voice and speed controls.","upstream_model":"kling-tts","flat_usd":0.01,"markup":2.2,"capabilities":["tts","multilingual","speed-control"]}
  ]
  $catalog$::jsonb) as x(
    id text, display_name text, provider_family text, tier public.model_tier, modality public.modality,
    description text, upstream_model text, input_usd_per_million numeric, output_usd_per_million numeric,
    flat_usd numeric, per_second_usd numeric, per_1k_chars_usd numeric, markup numeric,
    capabilities jsonb, ui_schema jsonb
  )
)
insert into public.models (
  id, display_name, provider_family, tier, modality, description, upstream_model,
  input_usd_per_million, output_usd_per_million, flat_usd, per_second_usd, per_1k_chars_usd,
  markup, capabilities, ui_schema, active, featured, auto_eligible
)
select id, display_name, provider_family, tier, modality, description, upstream_model,
  input_usd_per_million, output_usd_per_million, flat_usd, per_second_usd, per_1k_chars_usd,
  markup, capabilities, coalesce(ui_schema, '{}'::jsonb), true, false, modality = 'text'
from catalog
on conflict (id) do nothing;

insert into public.provider_models (model_id, provider_key, upstream_model, priority, active, metadata)
select id, 'apimodels', upstream_model, 10, true, jsonb_build_object('catalog_expansion', '2026-09-14')
from public.models
where id in (
  'gpt-6-astra','claude-sonnet-5','claude-fable-5-1','gemini-3-8-flash','grok-4-6','deepseek-v4-pro','qwen3-8-flash','qwen3-8-max','glm-5-3','claude-haiku-4-5',
  'gpt-image-2-5-flare','gpt-image-2-5-sunburst','grok-imagine-image-2','doubao-seedream-5-0-pro','gemini-3-1-flash-image','gemini-3-pro-image','qwen3-image','kling-v3-image','real-esrgan',
  'seedance-2-5','seedance-2-0','seedance-2-0-mini','gemini-omni-1-1-flash','minimax-h3','minimax-h3-max-turbo','wan-3-0-video','grok-video-3','flashvsr',
  'eleven-tts-v3','eleven-tts-multilingual','eleven-dialogue','eleven-dubbing','eleven-isolator','minimax-speech-2-8-turbo','minimax-speech-2-8-hd','kling-tts'
)
on conflict (model_id, provider_key) do nothing;

insert into public.model_price_history (model_id, version, pricing)
select id, price_version, jsonb_strip_nulls(jsonb_build_object(
  'input_usd_per_million', input_usd_per_million,
  'output_usd_per_million', output_usd_per_million,
  'flat_usd', flat_usd,
  'per_second_usd', per_second_usd,
  'per_1k_chars_usd', per_1k_chars_usd,
  'markup', markup
))
from public.models
where id in (
  'gpt-6-astra','claude-sonnet-5','claude-fable-5-1','gemini-3-8-flash','grok-4-6','deepseek-v4-pro','qwen3-8-flash','qwen3-8-max','glm-5-3','claude-haiku-4-5',
  'gpt-image-2-5-flare','gpt-image-2-5-sunburst','grok-imagine-image-2','doubao-seedream-5-0-pro','gemini-3-1-flash-image','gemini-3-pro-image','qwen3-image','kling-v3-image','real-esrgan',
  'seedance-2-5','seedance-2-0','seedance-2-0-mini','gemini-omni-1-1-flash','minimax-h3','minimax-h3-max-turbo','wan-3-0-video','grok-video-3','flashvsr',
  'eleven-tts-v3','eleven-tts-multilingual','eleven-dialogue','eleven-dubbing','eleven-isolator','minimax-speech-2-8-turbo','minimax-speech-2-8-hd','kling-tts'
)
on conflict (model_id, version) do nothing;

