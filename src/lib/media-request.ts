import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { signedFileUrl } from "@/lib/file-extract";
import { providerInputUrl } from "@/lib/provider-input-assets";
import { inspectMediaBytes } from "@/lib/media-metadata";
import { getMediaExecutionContract, mediaProviderOptionPayload, referencePayload, validateMediaContractRequest } from "@/lib/media-execution-contract";
import { mediaUsageFromRequest } from "@/lib/billing/media-job-billing-core";
import type { DecimalString } from "@/lib/billing/money";

export const generationInputSchema = z.object({
  requestId: z.string().uuid(), projectId: z.string().uuid().optional(), modelId: z.string().min(1),
  prompt: z.string().min(1).max(20000), duration: z.number().positive().max(600).optional(),
  inputDuration: z.number().nonnegative().max(3600).optional(), outputDuration: z.number().positive().max(3600).optional(),
  resolution: z.string().max(40).optional(), quality: z.string().max(40).optional(), fps: z.number().positive().max(240).optional(),
  imageCount: z.number().int().positive().max(20).optional(), aspectRatio: z.string().max(40).optional(),
  imageFileIds: z.array(z.string().uuid()).max(30).default([]),
  videoFileIds: z.array(z.string().uuid()).max(10).default([]),
  audioFileIds: z.array(z.string().uuid()).max(10).default([]),
  mode: z.string().max(40).optional(), nativeAudio: z.boolean().optional(), audioMode: z.string().max(40).optional(),
  voiceId: z.string().min(2).max(120).optional(), languageCode: z.string().min(2).max(12).optional(),
  voiceSpeed: z.number().min(0.7).max(2).optional(), confirmedCost: z.boolean().default(false),
  confirmedAuthorizationCredits: z.string().regex(/^\d+(\.\d+)?$/).max(80).optional(),
});
export type GenerationInput = z.infer<typeof generationInputSchema>;

export async function prepareMediaRequest(userId: string, input: GenerationInput, modality: "image" | "video" | "audio", publish = false) {
  const contract = getMediaExecutionContract(input.modelId);
  if (!contract || contract.modality !== modality) throw new Error("MEDIA_ADAPTER_UNAVAILABLE");
  if (modality === "video" && input.aspectRatio && !contract.aspectRatios?.length) throw new Error("MEDIA_OPTION_UNSUPPORTED:aspect_ratio");
  if (contract.workflow === "upscale" && input.duration !== undefined) throw new Error("MEDIA_OPTION_UNSUPPORTED:duration");
  if (modality === "video" && (input.fps !== undefined || input.inputDuration !== undefined || input.outputDuration !== undefined
    || input.imageCount !== undefined || input.quality !== undefined || input.mode !== undefined)) throw new Error("MEDIA_OPTION_UNSUPPORTED:unverified_option");
  const admin = createAdminClient();
  const ids = [...input.imageFileIds, ...input.videoFileIds, ...input.audioFileIds];
  if (new Set(ids).size !== ids.length) throw new Error("MEDIA_OPTION_UNSUPPORTED:duplicate_reference");
  const files = ids.length ? (await admin.from("user_files").select("id,storage_path,mime_type,size_bytes").eq("user_id", userId).in("id", ids)).data : [];
  if (!files || files.length !== ids.length) throw new Error("MEDIA_OPTION_UNSUPPORTED:reference_unavailable");
  const urls: Record<string, string[]> = { image: [], video: [], audio: [] };
  let inputDuration = 0, audioDuration = 0;
  for (const [kind, selected] of [["image", input.imageFileIds], ["video", input.videoFileIds], ["audio", input.audioFileIds]] as const) {
    for (const id of selected) {
      const file = files.find((file) => file.id === id)!;
      if (!String(file.mime_type).startsWith(kind + "/")) throw new Error("MEDIA_OPTION_UNSUPPORTED:reference_type");
      let sourceBytes: Uint8Array | undefined;
      if (kind !== "image") {
        if (!["video/mp4", "audio/wav", "audio/mpeg"].includes(file.mime_type) || file.size_bytes > 50 * 1024 * 1024) throw new Error("MEDIA_OPTION_UNSUPPORTED:reference_type");
        const { data, error } = await admin.storage.from("user-files").download(file.storage_path);
        if (error || !data) throw new Error("MEDIA_OPTION_UNSUPPORTED:reference_unavailable");
        if (data.size !== Number(file.size_bytes)) throw new Error("MEDIA_FILE_INVALID");
        const bytes = new Uint8Array(await data.arrayBuffer());
        sourceBytes = bytes;
        const metadata = inspectMediaBytes(bytes, file.mime_type as "video/mp4" | "audio/wav" | "audio/mpeg");
        if (metadata.duration < (contract.minReferenceSeconds ?? 0)
          || metadata.duration > (kind === "video" ? contract.maxReferenceVideoSeconds ?? 0 : contract.maxReferenceAudioSeconds ?? 0)) throw new Error("MEDIA_OPTION_UNSUPPORTED:reference_duration");
        if (kind === "video") inputDuration += metadata.duration;
        else audioDuration += metadata.duration;
      }
      if (publish) urls[kind].push(kind === "image" ? await signedFileUrl(admin, file.storage_path) : await providerInputUrl(userId, id, sourceBytes!, file.mime_type));
    }
  }
  const quality = input.quality ?? contract.defaultQuality;
  const aspectRatio = modality === "audio" ? undefined : contract.aspectRatios?.length ? input.aspectRatio : undefined;
  const nativeAudio = contract.nativeAudio ? input.nativeAudio ?? false : input.nativeAudio;
  validateMediaContractRequest(contract, { referenceCount: input.imageFileIds.length, resolution: input.resolution,
    quality, duration: input.duration, aspectRatio, nativeAudio, prompt: input.prompt,
    videoReferenceCount: input.videoFileIds.length, audioReferenceCount: input.audioFileIds.length, inputDuration, audioDuration });
  const pricingMode = contract.providerNativeAudio === "kling_sound" ? (nativeAudio ? "native_audio" : "silent")
    : modality === "video" ? undefined : input.mode ?? input.audioMode;
  const imageCount = modality === "image" ? input.imageCount ?? 1 : undefined;
  const inputType = input.videoFileIds.length ? "video" : input.imageFileIds.length ? "image" : input.audioFileIds.length ? "audio" : "text";
  // Seedance 2.5's documented reference-video authorization estimate applies
  // to source plus output seconds. The 2.0 family uses its published output
  // duration tiers; neither value is used for final provider settlement.
  const billableSeconds = contract.workflow === "upscale" ? inputDuration
    : input.modelId === "wan-3-0-video" || (input.modelId === "seedance-2-5" && input.videoFileIds.length)
      ? (input.duration ?? 0) + inputDuration : input.duration;
  const usage = { ...mediaUsageFromRequest({ ...input, modality, quality, imageCount, aspectRatio,
    mode: modality === "image" ? undefined : pricingMode, nativeAudio, referenceCount: input.imageFileIds.length,
    ...(inputDuration ? { inputDuration } : {}) }),
    inputType, ...(billableSeconds === undefined ? {} : { seconds: String(billableSeconds) as DecimalString }) };
  const dimensions = { resolution: input.resolution, quality, mode: pricingMode, inputType };
  const storedRequest = { ...input, modality, ...(imageCount === undefined ? {} : { imageCount }), aspectRatio,
    referenceCount: input.imageFileIds.length, inputDuration, audioDuration };
  const providerBody: Record<string, unknown> = {
    ...(contract.workflow === "upscale" ? {} : { prompt: input.prompt }),
    ...(quality ? { quality } : {}),
    ...(modality === "image" && imageCount !== 1 ? { n: imageCount } : {}),
    ...mediaProviderOptionPayload(contract, { duration: input.duration, resolution: input.resolution, aspectRatio, nativeAudio }),
    ...referencePayload(contract, urls.image),
    ...(contract.videoReferenceField && urls.video.length ? { [contract.videoReferenceField]: contract.videoReferenceField === "video_url" ? urls.video[0] : urls.video } : {}),
    ...(contract.audioReferenceField && urls.audio.length ? { [contract.audioReferenceField]: urls.audio } : {}),
    ...(modality === "audio" && pricingMode ? { mode: pricingMode } : {}),
    ...(modality !== "video" && input.fps !== undefined ? { fps: input.fps } : {}),
    ...(modality !== "video" && input.inputDuration !== undefined ? { input_duration: input.inputDuration } : {}),
    ...(modality !== "video" && input.outputDuration !== undefined ? { output_duration: input.outputDuration } : {}),
  };
  if (contract.modelId === "minimax-h3-max-turbo" && input.imageFileIds.length) delete providerBody.aspect_ratio;
  return { contract, quality, imageCount, usage, dimensions, storedRequest, providerBody };
}
