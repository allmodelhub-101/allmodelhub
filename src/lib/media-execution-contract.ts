import type { Modality, ModelUiSchema } from "@/lib/models";

export type MediaExecutionStrategy =
  | "apimodels_image_async"
  | "apimodels_video_async"
  | "apimodels_audio_async"
  | "apimodels_eleven_stream";

export type MediaExecutionContract = Readonly<{
  modelId: string;
  modality: Exclude<Modality, "text">;
  strategy: MediaExecutionStrategy;
  inputModes: readonly ("text" | "image" | "video" | "audio")[];
  referenceField?: "image" | "image_url" | "image_urls" | "image_reference" | "images" | "first_frame_url";
  referencePositions?: readonly string[];
  imageReferenceField?: "reference_image_urls";
  videoReferenceField?: "video_url" | "reference_video_urls";
  audioReferenceField?: "reference_audio_urls";
  maxVideoReferences?: number;
  maxAudioReferences?: number;
  maxReferenceVideoSeconds?: number;
  maxReferenceAudioSeconds?: number;
  minReferenceSeconds?: number;
  promptLimit?: number;
  workflow?: "generate" | "upscale";
  maxReferencesByResolution?: Readonly<Record<string, number>>;
  durationByInput?: Readonly<{ text: number; image: number }>;
  resolutionMapping?: Readonly<Record<string, string>>;
  providerOptions?: Readonly<Record<string, unknown>>;
  maxReferences: number;
  referenceRequired?: boolean;
  resolutions?: readonly string[];
  qualities?: readonly string[];
  defaultQuality?: string;
  durations?: readonly number[];
  durationRange?: Readonly<{ min: number; max: number; integer: boolean }>;
  aspectRatios?: readonly string[];
  nativeAudio?: readonly boolean[];
  providerDuration?: "number" | "string" | "omit";
  providerResolution?: "resolution" | "kling_mode" | "omit";
  providerNativeAudio?: "native_audio" | "kling_sound" | "generate_audio" | "audio" | "omit";
  providerAspectRatio?: "aspect_ratio" | "ratio";
}>;

const image = (modelId: string, contract: Omit<MediaExecutionContract, "modelId" | "modality" | "strategy">): MediaExecutionContract => ({
  modelId, modality: "image", strategy: "apimodels_image_async", ...contract,
});
const video = (modelId: string, contract: Omit<MediaExecutionContract, "modelId" | "modality" | "strategy">): MediaExecutionContract => ({
  modelId, modality: "video", strategy: "apimodels_video_async", ...contract,
});

const contracts: readonly MediaExecutionContract[] = [
  image("doubao-seedream-5-0-pro", { inputModes: ["text", "image"], referenceField: "images", maxReferences: 10, resolutions: ["1K", "2K"], aspectRatios: ["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3", "5:4", "4:5", "21:9"] }),
  image("flux-2-klein-4b", { inputModes: ["text", "image"], referenceField: "image_urls", maxReferences: 3, aspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"] }),
  image("gemini-2-5-flash-image", { inputModes: ["text", "image"], referenceField: "image_urls", maxReferences: 1, aspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"] }),
  image("gpt-image-2", { inputModes: ["text", "image"], referenceField: "image_urls", maxReferences: 16, resolutions: ["1K", "2K", "4K"], aspectRatios: ["1:1", "2:3", "3:2", "4:3", "3:4", "16:9", "9:16", "21:9"] }),
  image("kling-v3-image", { inputModes: ["text", "image"], referenceField: "image_reference", maxReferences: 1, resolutions: ["1K", "2K"], aspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "5:4", "4:5", "21:9"] }),
  image("qwen3-image", { inputModes: ["text", "image"], referenceField: "image_urls", maxReferences: 3, resolutions: ["1K", "2K"], aspectRatios: ["1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16", "21:9"] }),
  image("qwen3-image-pro", { inputModes: ["text", "image"], referenceField: "image_urls", maxReferences: 3, resolutions: ["1K", "2K"], aspectRatios: ["1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16", "21:9"] }),
  image("real-esrgan", { inputModes: ["image"], referenceField: "image_url", maxReferences: 1, referenceRequired: true, resolutions: ["4K", "8K", "10K"] }),
  image("gemini-3-1-flash-image", { inputModes: ["text", "image"], referenceField: "image_urls", maxReferences: 5,
    resolutions: ["512", "1K", "2K", "4K"], aspectRatios: ["auto", "1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"] }),
  image("gemini-3-pro-image", { inputModes: ["text", "image"], referenceField: "image_urls", maxReferences: 5,
    resolutions: ["1K", "2K", "4K"], aspectRatios: ["auto", "1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"] }),
  image("gpt-image-2-5-flare", { inputModes: ["text", "image"], referenceField: "image_urls", maxReferences: 16,
    resolutions: ["1K", "2K", "4K"], qualities: ["medium"], defaultQuality: "medium",
    aspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"] }),
  image("gpt-image-2-5-sunburst", { inputModes: ["text", "image"], referenceField: "image_urls", maxReferences: 16,
    resolutions: ["1K", "2K", "4K"], qualities: ["high"], defaultQuality: "high",
    aspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"] }),

  { modelId: "eleven-tts-flash", modality: "audio", strategy: "apimodels_eleven_stream", inputModes: ["text"], maxReferences: 0 },
  { modelId: "eleven-tts-multilingual", modality: "audio", strategy: "apimodels_eleven_stream", inputModes: ["text"], maxReferences: 0 },
  { modelId: "eleven-tts-v3", modality: "audio", strategy: "apimodels_eleven_stream", inputModes: ["text"], maxReferences: 0 },
  { modelId: "kling-tts", modality: "audio", strategy: "apimodels_audio_async", inputModes: ["text"], maxReferences: 0 },
  { modelId: "kling-sound-effects", modality: "audio", strategy: "apimodels_audio_async", inputModes: ["text"], maxReferences: 0, durationRange: { min: 3, max: 10, integer: false } },
  { modelId: "suno-v5", modality: "audio", strategy: "apimodels_audio_async", inputModes: ["text"], maxReferences: 0 },

  video("gemini-omni-1-1-flash", { inputModes: ["text", "image"], referenceField: "images", maxReferences: 7, durations: [4, 6, 8, 10], resolutions: ["720p", "1080p", "4K"], aspectRatios: ["16:9", "9:16"], providerDuration: "string" }),
  video("grok-video-3", { inputModes: ["text", "image"], referenceField: "images", maxReferences: 7, durations: [6, 10, 15], resolutions: ["480p", "720p"], aspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4"] }),
  video("kling-v3", { promptLimit: 2500, inputModes: ["text", "image"], referenceField: "image", maxReferences: 1, durationRange: { min: 3, max: 15, integer: true }, resolutions: ["720p", "1080p"], aspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4", "3:2", "2:3", "21:9"], nativeAudio: [false, true], providerDuration: "string", providerResolution: "kling_mode", providerNativeAudio: "kling_sound" }),
  video("minimax-h3", { inputModes: ["text", "image"], referenceField: "images", maxReferences: 5, durationRange: { min: 5, max: 15, integer: true }, resolutions: ["768p", "2K"], aspectRatios: ["adaptive", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"], providerAspectRatio: "ratio" }),
  video("minimax-h3-lite", { inputModes: ["text", "image"], referenceField: "images", maxReferences: 9, durationRange: { min: 1, max: 15, integer: true }, resolutions: ["480p", "768p"], aspectRatios: ["16:9", "9:16"], providerAspectRatio: "ratio" }),
  video("veo-3-1-fast-fhd", { inputModes: ["text", "image"], referenceField: "images", maxReferences: 2, durations: [8], resolutions: ["1080p"], aspectRatios: ["16:9", "9:16"], providerDuration: "omit", providerResolution: "omit", providerNativeAudio: "omit" }),
  video("ltx-2-3", { inputModes: ["text", "image"], referenceField: "image", maxReferences: 1, durationRange: { min: 5, max: 20, integer: true }, durationByInput: { text: 15, image: 20 }, resolutions: ["480p", "720p", "1080p"], aspectRatios: ["16:9", "9:16"], providerNativeAudio: "omit" }),
  video("grok-imagine-video-1-5", { inputModes: ["text", "image"], referenceField: "images", maxReferences: 7, maxReferencesByResolution: { "1080p": 1 }, promptLimit: 4096, durationRange: { min: 1, max: 15, integer: true }, resolutions: ["480p", "720p", "1080p"], aspectRatios: ["16:9", "9:16", "1:1", "3:2", "2:3"], providerNativeAudio: "omit" }),
  video("minimax-h3-max-turbo", { inputModes: ["text", "image"], referencePositions: ["first_frame_url", "last_frame_url"], maxReferences: 2, durationRange: { min: 5, max: 15, integer: true }, resolutions: ["480p", "768p"], aspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"], providerNativeAudio: "omit" }),
  video("wan-3-0-video", { inputModes: ["text", "image", "video", "audio"], imageReferenceField: "reference_image_urls", videoReferenceField: "reference_video_urls", audioReferenceField: "reference_audio_urls", maxReferences: 10, maxVideoReferences: 5, maxAudioReferences: 5, maxReferenceVideoSeconds: 15, maxReferenceAudioSeconds: 15, minReferenceSeconds: 1, durationRange: { min: 2, max: 30, integer: true }, resolutions: ["480p", "720p", "1080p"], resolutionMapping: { "480p": "480P", "720p": "720P", "1080p": "1080P" }, aspectRatios: ["adaptive", "16:9", "4:3", "1:1", "3:4", "9:16"], nativeAudio: [false, true], providerNativeAudio: "audio", providerAspectRatio: "ratio", providerOptions: { mode: "standard" } }),
  ...["seedance-2-0", "seedance-2-0-fast", "seedance-2-0-mini", "seedance-2-5"].map((id) => video(id, {
    inputModes: ["text", "image", "video", "audio"], imageReferenceField: "reference_image_urls", videoReferenceField: "reference_video_urls", audioReferenceField: "reference_audio_urls",
    maxReferences: id === "seedance-2-5" ? 30 : 9, maxVideoReferences: id === "seedance-2-5" ? 10 : 3, maxAudioReferences: id === "seedance-2-5" ? 10 : 3,
    maxReferenceVideoSeconds: id === "seedance-2-5" ? 30 : 15, maxReferenceAudioSeconds: id === "seedance-2-5" ? 30 : 15, minReferenceSeconds: 2,
    durationRange: { min: 4, max: id === "seedance-2-5" ? 30 : 15, integer: true }, resolutions: id === "seedance-2-0" ? ["480p", "720p", "1080p"] : ["480p", "720p"],
    aspectRatios: ["adaptive", "16:9", "4:3", "1:1", "3:4", "9:16", "21:9"], nativeAudio: [false, true], providerNativeAudio: "generate_audio", providerOptions: { task_type: "generate" },
  })),
  // APIMODELS prices this workflow from the inspected source duration. The
  // service accepts a larger file than the product upload boundary, but never
  // a source longer than two minutes.
  video("flashvsr", { workflow: "upscale", inputModes: ["video"], videoReferenceField: "video_url", maxReferences: 0, maxVideoReferences: 1, maxReferenceVideoSeconds: 120, minReferenceSeconds: 0, resolutions: ["720p", "1080p", "2K", "4K"], resolutionMapping: { "2K": "2k", "4K": "4k" }, providerDuration: "omit", providerNativeAudio: "omit" }),
];

const byModel = new Map(contracts.map((contract) => [contract.modelId, contract]));

export function listMediaExecutionContracts() {
  return [...contracts];
}

export function getMediaExecutionContract(modelId: string) {
  return byModel.get(modelId);
}

export function mediaContractUiSchema(contract: MediaExecutionContract): ModelUiSchema {
  return {
    inputModes: [...contract.inputModes],
    ...(contract.aspectRatios ? { aspectRatios: [...contract.aspectRatios] } : {}),
    ...(contract.durations ? { durationOptions: [...contract.durations] } : contract.durationRange
      ? { durationOptions: Array.from({ length: contract.durationRange.max - contract.durationRange.min + 1 }, (_, index) => contract.durationRange!.min + index) }
      : {}),
    ...(contract.resolutions ? { resolutionOptions: [...contract.resolutions] } : {}),
    maxReferences: contract.maxReferences,
    promptLimit: contract.promptLimit ?? 20000,
    workflow: contract.workflow ?? "generate",
    maxVideoReferences: contract.maxVideoReferences ?? 0,
    maxAudioReferences: contract.maxAudioReferences ?? 0,
    maxReferencesByResolution: contract.maxReferencesByResolution,
    durationByInput: contract.durationByInput,
    ...(contract.nativeAudio ? { nativeAudio: contract.nativeAudio.includes(true) } : {}),
  };
}

function subset<T>(left: readonly T[] | undefined, right: readonly T[] | undefined) {
  return !left?.length || Boolean(right?.length && left.every((value) => right.includes(value)));
}

export function mediaUiSchemaMatchesContract(uiSchema: ModelUiSchema | undefined, contract: MediaExecutionContract) {
  if (!uiSchema) return false;
  return subset(uiSchema.inputModes, contract.inputModes)
    && subset(uiSchema.aspectRatios, contract.aspectRatios)
    && subset(uiSchema.durationOptions, contract.durations ?? mediaContractUiSchema(contract).durationOptions)
    && subset(uiSchema.resolutionOptions, contract.resolutions)
    && (uiSchema.maxReferences ?? 0) <= contract.maxReferences
    && (uiSchema.maxVideoReferences ?? 0) <= (contract.maxVideoReferences ?? 0)
    && (uiSchema.maxAudioReferences ?? 0) <= (contract.maxAudioReferences ?? 0)
    && (!uiSchema.workflow || uiSchema.workflow === (contract.workflow ?? "generate"))
    && (uiSchema.promptLimit ?? 0) <= (contract.promptLimit ?? 20000)
    && (!uiSchema.nativeAudio || contract.nativeAudio?.includes(true) === true);
}

export function validateMediaContractRequest(contract: MediaExecutionContract, input: Readonly<{
  referenceCount: number; resolution?: string; quality?: string; duration?: number; aspectRatio?: string; nativeAudio?: boolean; prompt?: string;
  videoReferenceCount?: number; audioReferenceCount?: number; inputDuration?: number; audioDuration?: number;
}>) {
  if (!Number.isInteger(input.referenceCount) || input.referenceCount < 0) throw new Error("MEDIA_OPTION_UNSUPPORTED:references");
  if (Array.from(input.prompt ?? "").length > (contract.promptLimit ?? 20000)) throw new Error("MEDIA_OPTION_UNSUPPORTED:prompt");
  if (input.referenceCount > (contract.maxReferencesByResolution?.[input.resolution ?? ""] ?? contract.maxReferences)) throw new Error("MEDIA_OPTION_UNSUPPORTED:references");
  if ((input.videoReferenceCount ?? 0) > (contract.maxVideoReferences ?? 0) || (input.audioReferenceCount ?? 0) > (contract.maxAudioReferences ?? 0)) throw new Error("MEDIA_OPTION_UNSUPPORTED:media_references");
  if ((input.inputDuration ?? 0) > (contract.maxReferenceVideoSeconds ?? 0) || (input.audioDuration ?? 0) > (contract.maxReferenceAudioSeconds ?? 0)) throw new Error("MEDIA_OPTION_UNSUPPORTED:reference_duration");
  if (contract.workflow === "upscale" && (input.videoReferenceCount !== 1 || !(input.inputDuration && input.inputDuration > 0))) throw new Error("MEDIA_OPTION_UNSUPPORTED:source_video_required");
  if (contract.modelId === "wan-3-0-video" && (input.inputDuration ?? 0) + (input.duration ?? 0) > 30) throw new Error("MEDIA_OPTION_UNSUPPORTED:combined_duration");
  if (contract.modelId.startsWith("seedance-2-0") && input.audioReferenceCount && !input.referenceCount && !input.videoReferenceCount) throw new Error("MEDIA_OPTION_UNSUPPORTED:audio_requires_visual");
  if (contract.durationByInput && input.duration !== undefined && input.duration > contract.durationByInput[input.referenceCount ? "image" : "text"]) throw new Error("MEDIA_OPTION_UNSUPPORTED:duration");
  if (contract.modality === "video" && contract.workflow !== "upscale" && input.duration === undefined) throw new Error("MEDIA_OPTION_UNSUPPORTED:duration_required");
  if (input.referenceCount > contract.maxReferences) throw new Error("MEDIA_OPTION_UNSUPPORTED:references");
  if (contract.referenceRequired && input.referenceCount === 0) throw new Error("MEDIA_OPTION_UNSUPPORTED:reference_required");
  if (input.referenceCount > 0 && !contract.inputModes.includes("image")) throw new Error("MEDIA_OPTION_UNSUPPORTED:image_input");
  if (contract.resolutions?.length && (!input.resolution || !contract.resolutions.includes(input.resolution))) throw new Error("MEDIA_OPTION_UNSUPPORTED:resolution");
  if (input.quality && (!contract.qualities?.length || !contract.qualities.includes(input.quality))) throw new Error("MEDIA_OPTION_UNSUPPORTED:quality");
  if (input.duration !== undefined) {
    if (contract.durations && !contract.durations.includes(input.duration)) throw new Error("MEDIA_OPTION_UNSUPPORTED:duration");
    if (contract.durationRange && (input.duration < contract.durationRange.min || input.duration > contract.durationRange.max || (contract.durationRange.integer && !Number.isInteger(input.duration)))) throw new Error("MEDIA_OPTION_UNSUPPORTED:duration");
  }
  if (input.aspectRatio && (!contract.aspectRatios?.length || !contract.aspectRatios.includes(input.aspectRatio))) throw new Error("MEDIA_OPTION_UNSUPPORTED:aspect_ratio");
  if (input.nativeAudio !== undefined && !contract.nativeAudio?.includes(input.nativeAudio)) throw new Error("MEDIA_OPTION_UNSUPPORTED:native_audio");
}

export function referencePayload(contract: MediaExecutionContract, urls: readonly string[]) {
  if (!urls.length) return {};
  if (urls.length > contract.maxReferences) throw new Error("MEDIA_OPTION_UNSUPPORTED:references");
  if (contract.referencePositions) return Object.fromEntries(urls.map((url, index) => [contract.referencePositions![index], url]));
  if (contract.imageReferenceField) return { [contract.imageReferenceField]: [...urls] };
  switch (contract.referenceField) {
    case "image": case "image_url": case "image_reference": case "first_frame_url": return { [contract.referenceField]: urls[0] };
    case "image_urls": case "images": return { [contract.referenceField]: [...urls] };
    default: throw new Error("MEDIA_ADAPTER_REFERENCE_UNAVAILABLE");
  }
}

export function mediaProviderOptionPayload(contract: MediaExecutionContract, input: Readonly<{
  duration?: number; resolution?: string; aspectRatio?: string; nativeAudio?: boolean;
}>) {
  const payload: Record<string, unknown> = { ...contract.providerOptions };
  if (input.duration !== undefined && contract.providerDuration !== "omit") {
    payload.duration = contract.providerDuration === "string" ? String(input.duration) : input.duration;
  }
  if (input.resolution && contract.providerResolution !== "omit") {
    if (contract.providerResolution === "kling_mode") payload.mode = input.resolution === "1080p" ? "pro" : "std";
    else payload.resolution = contract.resolutionMapping?.[input.resolution] ?? (input.resolution === "4K" ? "4k" : input.resolution);
  }
  if (input.aspectRatio) payload[contract.providerAspectRatio ?? "aspect_ratio"] = input.aspectRatio;
  if (input.nativeAudio !== undefined && contract.providerNativeAudio !== "omit") {
    if (contract.providerNativeAudio === "kling_sound") payload.sound = input.nativeAudio ? "on" : "off";
    else payload[contract.providerNativeAudio ?? "native_audio"] = input.nativeAudio;
  }
  return payload;
}
