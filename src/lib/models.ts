export type ModelTier = "budget" | "balanced" | "premium" | "flagship";
export type Modality = "text" | "image" | "video" | "audio";
export type ModelUiSchema = {
  inputModes?: Array<"text" | "image" | "video" | "audio">;
  aspectRatios?: string[];
  durationOptions?: number[];
  resolutionOptions?: string[];
  audioModes?: Array<"music" | "sfx">;
  maxReferences?: number;
  nativeAudio?: boolean;
};

export type CatalogModel = {
  id: string;
  name: string;
  providerFamily: string;
  tier: ModelTier;
  modality: Modality;
  description: string;
  upstreamModel: string;
  inputUsdPerMillion?: number;
  outputUsdPerMillion?: number;
  flatUsd?: number;
  perSecondUsd?: number;
  per1kCharsUsd?: number;
  markup: number;
  capabilities: string[];
  uiSchema?: ModelUiSchema;
  inputOverheadTokens?: number;
  autoEligible?: boolean;
};

export const TEXT_MODELS: CatalogModel[] = [
  {
    id: "deepseek-v4-flash",
    name: "DeepSeek V4 Flash",
    providerFamily: "DeepSeek",
    tier: "budget",
    modality: "text",
    description: "High-throughput, low-cost everyday AI.",
    upstreamModel: "deepseek-v4-flash",
    inputUsdPerMillion: 0.12,
    outputUsdPerMillion: 0.24,
    markup: 2,
    capabilities: ["fast", "reasoning", "tools", "long-context"]
  },
  {
    id: "gpt-5-6-luna",
    name: "GPT 5.6 Luna",
    providerFamily: "OpenAI",
    tier: "budget",
    modality: "text",
    description: "Affordable GPT tier for high-volume work.",
    upstreamModel: "gpt-5-6-luna",
    inputUsdPerMillion: 0.221,
    outputUsdPerMillion: 1.324,
    markup: 2,
    capabilities: ["fast", "reasoning", "vision", "tools", "long-context"],
    inputOverheadTokens: 1600
  },
  {
    id: "gpt-5-6-terra",
    name: "GPT 5.6 Terra",
    providerFamily: "OpenAI",
    tier: "balanced",
    modality: "text",
    description: "Balanced intelligence, speed and price.",
    upstreamModel: "gpt-5-6-terra",
    inputUsdPerMillion: 0.551,
    outputUsdPerMillion: 3.309,
    markup: 2.15,
    capabilities: ["reasoning", "vision", "tools", "long-context"],
    inputOverheadTokens: 1600
  },
  {
    id: "gemini-3-pro-preview",
    name: "Gemini 3 Pro",
    providerFamily: "Google",
    tier: "balanced",
    modality: "text",
    description: "Strong multimodal reasoning at a competitive cost.",
    upstreamModel: "gemini-3-pro-preview",
    inputUsdPerMillion: 0.442,
    outputUsdPerMillion: 2.648,
    markup: 2.15,
    capabilities: ["multimodal", "reasoning", "long-context"]
  },
  {
    id: "qwen3-7-plus",
    name: "Qwen 3.7 Plus",
    providerFamily: "Alibaba",
    tier: "balanced",
    modality: "text",
    description: "Strong value for reasoning and agentic work.",
    upstreamModel: "qwen3.7-plus",
    inputUsdPerMillion: 0.88,
    outputUsdPerMillion: 1.18,
    markup: 2.15,
    capabilities: ["reasoning", "tools", "long-context"]
  },
  {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    providerFamily: "Anthropic",
    tier: "premium",
    modality: "text",
    description: "Premium writing, coding and professional analysis.",
    upstreamModel: "claude-sonnet-4-6",
    inputUsdPerMillion: 1.059,
    outputUsdPerMillion: 5.295,
    markup: 2.3,
    capabilities: ["writing", "coding", "reasoning", "tools", "long-context"]
  },
  {
    id: "gpt-5-6-sol",
    name: "GPT 5.6 Sol",
    providerFamily: "OpenAI",
    tier: "flagship",
    modality: "text",
    description: "Flagship GPT intelligence for demanding tasks.",
    upstreamModel: "gpt-5-6-sol",
    inputUsdPerMillion: 1.103,
    outputUsdPerMillion: 6.618,
    markup: 2.5,
    capabilities: ["frontier", "reasoning", "vision", "tools", "long-context"],
    inputOverheadTokens: 1600
  },
  {
    id: "claude-opus-5",
    name: "Claude Opus 5",
    providerFamily: "Anthropic",
    tier: "flagship",
    modality: "text",
    description: "Maximum Claude capability for deep and long-horizon work.",
    upstreamModel: "claude-opus-5",
    inputUsdPerMillion: 3,
    outputUsdPerMillion: 15,
    markup: 2.5,
    capabilities: ["frontier", "reasoning", "coding", "tools", "long-context"]
  },
  {
    id: "gpt-6-astra", name: "GPT-6 Astra", providerFamily: "OpenAI", tier: "flagship", modality: "text",
    description: "Frontier reasoning, coding and long-horizon agent work.", upstreamModel: "gpt-6-astra",
    inputUsdPerMillion: 2.4, outputUsdPerMillion: 12, markup: 2.5,
    capabilities: ["frontier", "reasoning", "coding", "vision", "tools", "web", "long-context"], inputOverheadTokens: 1600
  },
  {
    id: "claude-sonnet-5", name: "Claude Sonnet 5", providerFamily: "Anthropic", tier: "premium", modality: "text",
    description: "Adaptive reasoning for professional writing, coding and business work.", upstreamModel: "claude-sonnet-5",
    inputUsdPerMillion: 1.6, outputUsdPerMillion: 8, markup: 2.3,
    capabilities: ["reasoning", "writing", "coding", "tools", "long-context"]
  },
  {
    id: "claude-fable-5-1", name: "Claude Fable 5.1", providerFamily: "Anthropic", tier: "flagship", modality: "text",
    description: "Agentic coding and complex multimodal work across large projects.", upstreamModel: "claude-fable-5-1",
    inputUsdPerMillion: 5, outputUsdPerMillion: 25, markup: 2.5,
    capabilities: ["frontier", "reasoning", "coding", "multimodal", "tools", "long-context"]
  },
  {
    id: "gemini-3-8-flash", name: "Gemini 3.8 Flash", providerFamily: "Google", tier: "balanced", modality: "text",
    description: "Fast multimodal intelligence for coding, research and documents.", upstreamModel: "gemini-3.8-flash",
    inputUsdPerMillion: 0.45, outputUsdPerMillion: 2.25, markup: 2.15,
    capabilities: ["fast", "reasoning", "coding", "multimodal", "tools", "long-context"]
  },
  {
    id: "grok-4-6", name: "Grok 4.6", providerFamily: "xAI", tier: "flagship", modality: "text",
    description: "Frontier reasoning for long-running agents, coding and research.", upstreamModel: "grok-4.6",
    inputUsdPerMillion: 1.765, outputUsdPerMillion: 5.294, markup: 2.5,
    capabilities: ["frontier", "reasoning", "vision", "tools", "long-context"]
  },
  {
    id: "deepseek-v4-pro", name: "DeepSeek V4 Pro", providerFamily: "DeepSeek", tier: "premium", modality: "text",
    description: "Cost-efficient advanced reasoning for technical and agentic work.", upstreamModel: "deepseek-v4-pro",
    inputUsdPerMillion: 0.37, outputUsdPerMillion: 0.74, markup: 2.3,
    capabilities: ["reasoning", "thinking", "coding", "tools", "long-context"]
  },
  {
    id: "qwen3-8-flash", name: "Qwen 3.8 Flash", providerFamily: "Alibaba", tier: "budget", modality: "text",
    description: "Low-cost reasoning and tool use for high-volume work.", upstreamModel: "qwen3.8-flash",
    inputUsdPerMillion: 0.15, outputUsdPerMillion: 0.47, markup: 2,
    capabilities: ["fast", "reasoning", "thinking", "coding", "tools", "long-context"]
  },
  {
    id: "qwen3-8-max", name: "Qwen 3.8 Max", providerFamily: "Alibaba", tier: "flagship", modality: "text",
    description: "Flagship Qwen reasoning for agents, coding and research.", upstreamModel: "qwen3.8-max",
    inputUsdPerMillion: 2, outputUsdPerMillion: 6, markup: 2.5,
    capabilities: ["frontier", "reasoning", "thinking", "coding", "tools", "long-context"]
  },
  {
    id: "glm-5-3", name: "GLM-5.3", providerFamily: "Zhipu", tier: "premium", modality: "text",
    description: "Long-context reasoning and tool calling for agents and software work.", upstreamModel: "glm-5.3",
    inputUsdPerMillion: 1.33, outputUsdPerMillion: 4.18, markup: 2.3,
    capabilities: ["reasoning", "coding", "tools", "long-context"]
  },
  {
    id: "claude-haiku-4-5", name: "Claude Haiku 4.5", providerFamily: "Anthropic", tier: "budget", modality: "text",
    description: "Fast, inexpensive Anthropic intelligence for everyday tasks.", upstreamModel: "claude-haiku-4-5-20251001",
    inputUsdPerMillion: 0.353, outputUsdPerMillion: 1.765, markup: 2,
    capabilities: ["fast", "reasoning", "writing"]
  }
];

export const MEDIA_MODELS: CatalogModel[] = [
  { id: "flux-2-klein-4b", name: "FLUX.2 Klein 4B", providerFamily: "Black Forest Labs", tier: "budget", modality: "image", description: "Fast budget image generation.", upstreamModel: "flux-2-klein-4b", flatUsd: 0.006, markup: 2.25, capabilities: ["text-to-image", "editing"] },
  { id: "gemini-2-5-flash-image", name: "Gemini 2.5 Flash Image", providerFamily: "Google", tier: "balanced", modality: "image", description: "Excellent everyday image generation and editing.", upstreamModel: "gemini-2.5-flash-image", flatUsd: 0.02, markup: 2.25, capabilities: ["text-to-image", "editing"] },
  { id: "gpt-image-2", name: "GPT Image 2", providerFamily: "OpenAI", tier: "premium", modality: "image", description: "Premium image creation and multi-image editing.", upstreamModel: "gpt-image-2", flatUsd: 0.025, markup: 2.25, capabilities: ["text-to-image", "editing", "multi-reference"] },
  { id: "qwen3-image-pro", name: "Qwen Image 3 Pro", providerFamily: "Alibaba", tier: "premium", modality: "image", description: "High-fidelity poster and typography image model.", upstreamModel: "qwen3-image-pro", flatUsd: 0.037, markup: 2.25, capabilities: ["text-to-image", "editing", "typography"] },
  { id: "minimax-h3-lite", name: "MiniMax H3 Lite", providerFamily: "MiniMax", tier: "budget", modality: "video", description: "Affordable video generation for drafts and social content.", upstreamModel: "minimax-h3-lite", perSecondUsd: 0.01, markup: 2.1, capabilities: ["text-to-video", "image-to-video"] },
  { id: "ltx-2-3", name: "LTX 2.3", providerFamily: "Lightricks", tier: "budget", modality: "video", description: "Fast value video generation.", upstreamModel: "ltx-2.3", perSecondUsd: 0.02, markup: 2.1, capabilities: ["text-to-video", "image-to-video"] },
  { id: "grok-imagine-video-1-5", name: "Grok Imagine Video 1.5", providerFamily: "xAI", tier: "balanced", modality: "video", description: "Balanced video generation with native audio support.", upstreamModel: "grok-imagine-video-1.5", perSecondUsd: 0.0294, markup: 2.1, capabilities: ["text-to-video", "image-to-video", "audio"] },
  { id: "seedance-2-0-fast", name: "Seedance 2.0 Fast", providerFamily: "ByteDance", tier: "premium", modality: "video", description: "Premium multimodal video generation.", upstreamModel: "seedance-2.0-fast", perSecondUsd: 0.071, markup: 2.1, capabilities: ["text-to-video", "image-to-video", "multimodal"] },
  { id: "kling-v3", name: "Kling V3", providerFamily: "Kling", tier: "flagship", modality: "video", description: "Flagship cinematic video generation.", upstreamModel: "kling-v3", perSecondUsd: 0.12, markup: 2.1, capabilities: ["text-to-video", "image-to-video", "audio"] },
  { id: "veo-3-1-fast-fhd", name: "VEO 3.1 Fast Full HD", providerFamily: "Google", tier: "flagship", modality: "video", description: "Premium Google 1080p video generation.", upstreamModel: "veo-3.1-fast-fhd", flatUsd: 0.07, markup: 2.1, capabilities: ["text-to-video", "image-to-video", "1080p"] },
  { id: "eleven-tts-flash", name: "Eleven Flash v2.5", providerFamily: "ElevenLabs", tier: "balanced", modality: "audio", description: "Fast natural speech synthesis.", upstreamModel: "eleven-tts-flash", per1kCharsUsd: 0.0425, markup: 2.2, capabilities: ["tts", "multilingual"] },
  { id: "kling-sound-effects", name: "Kling Sound Effects", providerFamily: "Kling", tier: "budget", modality: "audio", description: "Generate sound effects from text.", upstreamModel: "kling-sound-effects", flatUsd: 0.044, markup: 2.2, capabilities: ["sound-effects"] },
  { id: "suno-v5", name: "Suno Music", providerFamily: "Suno", tier: "premium", modality: "audio", description: "Generate complete songs, vocals or instrumentals.", upstreamModel: "suno-v5", flatUsd: 0.26, markup: 2.2, capabilities: ["music", "vocals", "instrumental"] }
  ,{ id: "gpt-image-2-5-flare", name: "GPT Image 2.5 Flare", providerFamily: "OpenAI", tier: "premium", modality: "image", description: "Fast premium image creation with precise editing and consistency.", upstreamModel: "gpt-image-2.5-flare", flatUsd: 0.008, markup: 2.25, capabilities: ["text-to-image", "editing", "multi-reference", "transparent-png"], uiSchema: { inputModes: ["text", "image"], aspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"], resolutionOptions: ["1K", "2K", "4K"], maxReferences: 16 } }
  ,{ id: "gpt-image-2-5-sunburst", name: "GPT Image 2.5 Sunburst", providerFamily: "OpenAI", tier: "flagship", modality: "image", description: "Maximum-fidelity image creation for demanding commercial work.", upstreamModel: "gpt-image-2.5-sunburst", flatUsd: 0.008, markup: 2.25, capabilities: ["text-to-image", "editing", "multi-reference", "transparent-png"], uiSchema: { inputModes: ["text", "image"], aspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"], resolutionOptions: ["1K", "2K", "4K"], maxReferences: 16 } }
  ,{ id: "grok-imagine-image-2", name: "Grok Imagine Image 2.0", providerFamily: "xAI", tier: "premium", modality: "image", description: "Designer-grade images, typography and multi-image editing.", upstreamModel: "grok-imagine-image-2", flatUsd: 0.03, markup: 2.25, capabilities: ["text-to-image", "editing", "multi-reference", "typography"], uiSchema: { inputModes: ["text", "image"], resolutionOptions: ["1K", "2K"], maxReferences: 10 } }
  ,{ id: "doubao-seedream-5-0-pro", name: "Doubao Seedream 5.0 Pro", providerFamily: "Doubao", tier: "premium", modality: "image", description: "Commercial image generation with layered, interactive editing.", upstreamModel: "doubao-seedream-5-0-pro", flatUsd: 0.03, markup: 2.25, capabilities: ["text-to-image", "editing", "multi-reference", "typography", "layer-separation"], uiSchema: { inputModes: ["text", "image"], resolutionOptions: ["1K", "2K"], maxReferences: 10 } }
  ,{ id: "gemini-3-1-flash-image", name: "Gemini 3.1 Flash Image", providerFamily: "Google", tier: "balanced", modality: "image", description: "Fast everyday image generation and editing up to 4K.", upstreamModel: "gemini-3.1-flash-image", flatUsd: 0.04, markup: 2.25, capabilities: ["text-to-image", "editing", "multi-reference"], uiSchema: { inputModes: ["text", "image"], resolutionOptions: ["512", "1K", "2K", "4K"], maxReferences: 10 } }
  ,{ id: "gemini-3-pro-image", name: "Gemini 3 Pro Image", providerFamily: "Google", tier: "flagship", modality: "image", description: "High-fidelity premium image generation and advanced editing.", upstreamModel: "gemini-3-pro-image", flatUsd: 0.1, markup: 2.25, capabilities: ["text-to-image", "editing", "high-resolution"], uiSchema: { inputModes: ["text", "image"], resolutionOptions: ["1K", "2K", "4K"], maxReferences: 5 } }
  ,{ id: "qwen3-image", name: "Qwen Image 3.0", providerFamily: "Alibaba", tier: "balanced", modality: "image", description: "Multilingual image creation with excellent dense text layout.", upstreamModel: "qwen3-image", flatUsd: 0.035, markup: 2.25, capabilities: ["text-to-image", "editing", "typography", "multilingual"], uiSchema: { inputModes: ["text", "image"], resolutionOptions: ["1K", "2K"], maxReferences: 4 } }
  ,{ id: "kling-v3-image", name: "Kling V3 Image", providerFamily: "Kling", tier: "premium", modality: "image", description: "High-resolution creative generation and image-to-image editing.", upstreamModel: "kling-v3-image", flatUsd: 0.05, markup: 2.25, capabilities: ["text-to-image", "image-to-image", "editing"], uiSchema: { inputModes: ["text", "image"], resolutionOptions: ["1K", "2K"], maxReferences: 1 } }
  ,{ id: "real-esrgan", name: "Real-ESRGAN Upscaler", providerFamily: "Real-ESRGAN", tier: "budget", modality: "image", description: "Upscale and restore illustrations, anime and artwork.", upstreamModel: "real-esrgan", flatUsd: 0.004, markup: 2.25, capabilities: ["upscaling", "restoration", "face-enhancement"], uiSchema: { inputModes: ["image"], resolutionOptions: ["4K", "8K", "10K"], maxReferences: 1 } }
  ,{ id: "seedance-2-5", name: "Seedance 2.5", providerFamily: "ByteDance", tier: "flagship", modality: "video", description: "Long-form cinematic generation, editing and extension.", upstreamModel: "seedance-2.5", perSecondUsd: 0.12, markup: 2.1, capabilities: ["text-to-video", "image-to-video", "video-editing", "video-extension", "native-audio", "multi-reference"], uiSchema: { inputModes: ["text", "image", "audio"], durationOptions: [4, 5, 8, 10, 15, 30], resolutionOptions: ["480p", "720p"], maxReferences: 10, nativeAudio: true } }
  ,{ id: "seedance-2-0", name: "Seedance 2.0", providerFamily: "ByteDance", tier: "premium", modality: "video", description: "Full multimodal cinematic video with synchronized audio.", upstreamModel: "seedance-2.0", perSecondUsd: 0.092, markup: 2.1, capabilities: ["text-to-video", "image-to-video", "multi-reference", "native-audio"], uiSchema: { inputModes: ["text", "image", "audio"], durationOptions: [4, 5, 8, 10, 15], resolutionOptions: ["480p", "720p", "1080p"], maxReferences: 9, nativeAudio: true } }
  ,{ id: "seedance-2-0-mini", name: "Seedance 2.0 Mini", providerFamily: "ByteDance", tier: "budget", modality: "video", description: "Affordable multimodal video generation with synchronized audio.", upstreamModel: "seedance-2.0-mini", perSecondUsd: 0.044, markup: 2.1, capabilities: ["text-to-video", "image-to-video", "multi-reference", "native-audio"], uiSchema: { inputModes: ["text", "image", "audio"], durationOptions: [4, 5, 8, 10, 15], resolutionOptions: ["480p", "720p"], maxReferences: 9, nativeAudio: true } }
  ,{ id: "gemini-omni-1-1-flash", name: "Gemini Omni 1.1 Flash", providerFamily: "Google", tier: "flagship", modality: "video", description: "Multimodal video generation, reference workflows and editing up to 4K.", upstreamModel: "gemini-omni-1.1-flash", perSecondUsd: 0.07, markup: 2.1, capabilities: ["text-to-video", "image-to-video", "video-editing", "multi-reference", "native-audio"], uiSchema: { inputModes: ["text", "image"], durationOptions: [4, 6, 8, 10], resolutionOptions: ["720p", "1080p", "4K"], maxReferences: 7, nativeAudio: true } }
  ,{ id: "minimax-h3", name: "MiniMax Hailuo H3", providerFamily: "MiniMax", tier: "premium", modality: "video", description: "High-quality multimodal video with synchronized audio.", upstreamModel: "minimax-h3", perSecondUsd: 0.097, markup: 2.1, capabilities: ["text-to-video", "image-to-video", "multi-reference", "native-audio", "2k"], uiSchema: { inputModes: ["text", "image", "audio"], durationOptions: [5, 6, 8, 10, 15], resolutionOptions: ["768p", "2K"], maxReferences: 9, nativeAudio: true } }
  ,{ id: "minimax-h3-max-turbo", name: "MiniMax H3 Max Turbo", providerFamily: "MiniMax", tier: "balanced", modality: "video", description: "Accelerated cinematic video for fast iteration.", upstreamModel: "minimax-h3-max-turbo", perSecondUsd: 0.06, markup: 2.1, capabilities: ["fast", "text-to-video", "image-to-video", "first-last-frame"], uiSchema: { inputModes: ["text", "image"], durationOptions: [5, 6, 8, 10, 15], resolutionOptions: ["480p", "768p"], maxReferences: 2 } }
  ,{ id: "wan-3-0-video", name: "Wan 3.0 Video", providerFamily: "Alibaba", tier: "premium", modality: "video", description: "Versatile long-form video with omni-reference and native audio.", upstreamModel: "wan-3.0-video", perSecondUsd: 0.0477, markup: 2.1, capabilities: ["text-to-video", "image-to-video", "omni-reference", "document-to-video", "native-audio"], uiSchema: { inputModes: ["text", "image", "audio"], durationOptions: [5, 8, 10, 15, 30], resolutionOptions: ["480p", "720p", "1080p"], maxReferences: 10, nativeAudio: true } }
  ,{ id: "grok-video-3", name: "Grok Video 3", providerFamily: "xAI", tier: "premium", modality: "video", description: "Cinematic text and reference-image video for social content.", upstreamModel: "grok-video-3", perSecondUsd: 0.02, markup: 2.1, capabilities: ["text-to-video", "image-to-video", "multi-reference"], uiSchema: { inputModes: ["text", "image"], durationOptions: [6, 10, 15], resolutionOptions: ["480p", "720p"], maxReferences: 7 } }
  ,{ id: "flashvsr", name: "FlashVSR Video Upscale", providerFamily: "MuleRouter", tier: "balanced", modality: "video", description: "Restore and upscale existing video footage up to 4K.", upstreamModel: "flashvsr", perSecondUsd: 0.02, markup: 2.1, capabilities: ["video-upscaling", "restoration"], uiSchema: { inputModes: ["video"], durationOptions: [5, 10, 15, 30], resolutionOptions: ["720p", "1080p", "2K", "4K"], maxReferences: 1 } }
  ,{ id: "eleven-tts-v3", name: "Eleven v3", providerFamily: "ElevenLabs", tier: "flagship", modality: "audio", description: "Highly expressive multilingual speech with audio-tag control.", upstreamModel: "eleven-tts-v3", per1kCharsUsd: 0.085, markup: 2.2, capabilities: ["tts", "multilingual", "audio-tags"] }
  ,{ id: "eleven-tts-multilingual", name: "Eleven Multilingual v2", providerFamily: "ElevenLabs", tier: "premium", modality: "audio", description: "Emotionally rich multilingual narration and voiceover.", upstreamModel: "eleven-tts-multilingual", per1kCharsUsd: 0.085, markup: 2.2, capabilities: ["tts", "multilingual", "emotional-speech"] }
  ,{ id: "eleven-dialogue", name: "ElevenLabs Dialogue", providerFamily: "ElevenLabs", tier: "premium", modality: "audio", description: "Natural multi-speaker dialogue for podcasts and stories.", upstreamModel: "eleven-dialogue", per1kCharsUsd: 0.085, markup: 2.2, capabilities: ["dialogue", "multi-speaker"] }
  ,{ id: "eleven-dubbing", name: "ElevenLabs Dubbing", providerFamily: "ElevenLabs", tier: "premium", modality: "audio", description: "Translate and dub existing audio or video while preserving emotion.", upstreamModel: "eleven-dubbing", perSecondUsd: 0.004675, markup: 2.2, capabilities: ["dubbing", "localization", "audio-input", "video-input"] }
  ,{ id: "eleven-isolator", name: "Voice Isolator", providerFamily: "ElevenLabs", tier: "balanced", modality: "audio", description: "Extract clean speech and remove background noise.", upstreamModel: "eleven-isolator", perSecondUsd: 0.0017, markup: 2.2, capabilities: ["voice-isolation", "noise-removal", "audio-input"] }
  ,{ id: "minimax-speech-2-8-turbo", name: "MiniMax Speech 2.8 Turbo", providerFamily: "MiniMax", tier: "balanced", modality: "audio", description: "Fast, cost-efficient speech with voice clone and design support.", upstreamModel: "minimax-speech-2.8-turbo", per1kCharsUsd: 0.04, markup: 2.2, capabilities: ["tts", "fast", "voice-clone", "voice-design"] }
  ,{ id: "minimax-speech-2-8-hd", name: "MiniMax Speech 2.8 HD", providerFamily: "MiniMax", tier: "premium", modality: "audio", description: "Emotion-aware HD speech for premium narration and characters.", upstreamModel: "minimax-speech-2.8-hd", per1kCharsUsd: 0.063, markup: 2.2, capabilities: ["tts", "hd-speech", "voice-clone", "voice-design"] }
  ,{ id: "kling-tts", name: "Kling TTS", providerFamily: "Kling", tier: "budget", modality: "audio", description: "Affordable multilingual speech with voice and speed controls.", upstreamModel: "kling-tts", flatUsd: 0.01, markup: 2.2, capabilities: ["tts", "multilingual", "speed-control"] }
];

export const ALL_MODELS = [...TEXT_MODELS, ...MEDIA_MODELS];

export function getModel(id: string) {
  return ALL_MODELS.find((model) => model.id === id || model.upstreamModel === id);
}

export function chooseTextModel(input: { tier?: ModelTier | "auto"; prompt: string }) {
  const tier = input.tier ?? "auto";
  if (tier !== "auto") {
    const preferred: Record<ModelTier, string> = {
      budget: "gpt-5-6-luna",
      balanced: "gpt-5-6-terra",
      premium: "claude-sonnet-4-6",
      flagship: "gpt-5-6-sol"
    };
    return getModel(preferred[tier])!;
  }

  const prompt = input.prompt.toLowerCase();
  const complexitySignals = ["analyze", "architecture", "strategy", "contract", "debug", "reason", "research", "compare", "complex", "codebase", "legal", "financial model"];
  const complex = input.prompt.length > 2500 || complexitySignals.some((signal) => prompt.includes(signal));
  if (complex) return getModel("claude-sonnet-4-6")!;
  if (input.prompt.length < 550) return getModel("gpt-5-6-luna")!;
  return getModel("gpt-5-6-terra")!;
}

