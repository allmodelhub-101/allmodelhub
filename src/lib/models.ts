export type ModelTier = "budget" | "balanced" | "premium" | "flagship";
export type Modality = "text" | "image" | "video" | "audio";

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
