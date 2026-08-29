insert into public.models(id,display_name,provider_family,tier,modality,description,upstream_model,input_usd_per_million,output_usd_per_million,flat_usd,per_second_usd,per_1k_chars_usd,markup,capabilities,featured)
values
('deepseek-v4-flash','DeepSeek V4 Flash','DeepSeek','budget','text','High-throughput low-cost everyday AI.','deepseek-v4-flash',0.12,0.24,null,null,null,2.00,'["fast","reasoning","tools","long-context"]',true),
('gpt-5-6-luna','GPT 5.6 Luna','OpenAI','budget','text','Affordable GPT tier for high-volume work.','gpt-5-6-luna',0.221,1.324,null,null,null,2.00,'["fast","reasoning","vision","tools","long-context"]',true),
('gpt-5-6-terra','GPT 5.6 Terra','OpenAI','balanced','text','Balanced intelligence speed and price.','gpt-5-6-terra',0.551,3.309,null,null,null,2.15,'["reasoning","vision","tools","long-context"]',true),
('gemini-3-pro-preview','Gemini 3 Pro','Google','balanced','text','Strong multimodal reasoning.','gemini-3-pro-preview',0.442,2.648,null,null,null,2.15,'["multimodal","reasoning","long-context"]',false),
('qwen3-7-plus','Qwen 3.7 Plus','Alibaba','balanced','text','Strong value for reasoning and agentic work.','qwen3.7-plus',0.88,1.18,null,null,null,2.15,'["reasoning","tools","long-context"]',false),
('claude-sonnet-4-6','Claude Sonnet 4.6','Anthropic','premium','text','Premium writing coding and analysis.','claude-sonnet-4-6',1.059,5.295,null,null,null,2.30,'["writing","coding","reasoning","tools","long-context"]',true),
('gpt-5-6-sol','GPT 5.6 Sol','OpenAI','flagship','text','Flagship GPT intelligence.','gpt-5-6-sol',1.103,6.618,null,null,null,2.50,'["frontier","reasoning","vision","tools","long-context"]',true),
('claude-opus-5','Claude Opus 5','Anthropic','flagship','text','Maximum Claude capability.','claude-opus-5',3,15,null,null,null,2.50,'["frontier","reasoning","coding","tools","long-context"]',true),
('flux-2-klein-4b','FLUX.2 Klein 4B','Black Forest Labs','budget','image','Fast budget image generation.','flux-2-klein-4b',null,null,0.006,null,null,2.25,'["text-to-image","editing"]',false),
('gemini-2-5-flash-image','Gemini 2.5 Flash Image','Google','balanced','image','Everyday image generation and editing.','gemini-2.5-flash-image',null,null,0.02,null,null,2.25,'["text-to-image","editing"]',true),
('gpt-image-2','GPT Image 2','OpenAI','premium','image','Premium image creation and editing.','gpt-image-2',null,null,0.025,null,null,2.25,'["text-to-image","editing","multi-reference"]',true),
('qwen3-image-pro','Qwen Image 3 Pro','Alibaba','premium','image','High-fidelity poster and typography image model.','qwen3-image-pro',null,null,0.037,null,null,2.25,'["text-to-image","editing","typography"]',false),
('minimax-h3-lite','MiniMax H3 Lite','MiniMax','budget','video','Affordable video generation.','minimax-h3-lite',null,null,null,0.01,null,2.10,'["text-to-video","image-to-video"]',true),
('ltx-2-3','LTX 2.3','Lightricks','budget','video','Fast value video generation.','ltx-2.3',null,null,null,0.02,null,2.10,'["text-to-video","image-to-video"]',false),
('grok-imagine-video-1-5','Grok Imagine Video 1.5','xAI','balanced','video','Balanced video generation with native audio.','grok-imagine-video-1.5',null,null,null,0.0294,null,2.10,'["text-to-video","image-to-video","audio"]',true),
('seedance-2-0-fast','Seedance 2.0 Fast','ByteDance','premium','video','Premium multimodal video generation.','seedance-2.0-fast',null,null,null,0.071,null,2.10,'["text-to-video","image-to-video","multimodal"]',true),
('kling-v3','Kling V3','Kling','flagship','video','Flagship cinematic video generation.','kling-v3',null,null,null,0.12,null,2.10,'["text-to-video","image-to-video","audio"]',true),
('veo-3-1-fast-fhd','VEO 3.1 Fast Full HD','Google','flagship','video','Premium Google 1080p video generation.','veo-3.1-fast-fhd',null,null,0.07,null,null,2.10,'["text-to-video","image-to-video","1080p"]',true),
('eleven-tts-flash','Eleven Flash v2.5','ElevenLabs','balanced','audio','Fast natural text to speech.','eleven-tts-flash',null,null,null,null,0.0425,2.20,'["tts","multilingual"]',true),
('kling-sound-effects','Kling Sound Effects','Kling','budget','audio','Generate sound effects from text.','kling-sound-effects',null,null,0.044,null,null,2.20,'["sound-effects"]',true),
('suno-v5','Suno Music','Suno','premium','audio','Generate songs vocals or instrumentals.','suno-v5',null,null,0.26,null,null,2.20,'["music","vocals","instrumental"]',true)
on conflict (id) do update set
  display_name=excluded.display_name,
  provider_family=excluded.provider_family,
  tier=excluded.tier,
  modality=excluded.modality,
  description=excluded.description,
  upstream_model=excluded.upstream_model,
  input_usd_per_million=excluded.input_usd_per_million,
  output_usd_per_million=excluded.output_usd_per_million,
  flat_usd=excluded.flat_usd,
  per_second_usd=excluded.per_second_usd,
  per_1k_chars_usd=excluded.per_1k_chars_usd,
  markup=excluded.markup,
  capabilities=excluded.capabilities,
  featured=excluded.featured,
  updated_at=now();

insert into public.provider_models(model_id,provider_key,upstream_model,priority,active)
select id,'apimodels',upstream_model,10,true from public.models
on conflict(model_id,provider_key) do update set upstream_model=excluded.upstream_model,priority=excluded.priority,active=true;
