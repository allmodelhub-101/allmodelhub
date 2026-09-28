import type { AsyncTaskResult } from "@/lib/providers/types";
import type { DecimalString } from "./money";
import type { NormalizedUsage } from "./types";

export type MediaBillingInput = Readonly<{
  prompt: string;
  duration?: number;
  resolution?: string;
  quality?: string;
  fps?: number;
  imageCount?: number;
  referenceCount?: number;
  mode?: string;
  inputDuration?: number;
  outputDuration?: number;
  nativeAudio?: boolean;
  aspectRatio?: string;
}>;

function decimal(value: unknown): DecimalString | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const text = String(value);
  return /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text) ? text as DecimalString : undefined;
}

function integer(value: unknown): DecimalString | undefined {
  const text = decimal(value);
  return text && /^\d+$/.test(text) ? text : undefined;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function first(...values: unknown[]) {
  return values.find((value) => value !== undefined && value !== null);
}

export function mediaUsageFromRequest(input: MediaBillingInput): NormalizedUsage {
  const outputDuration = input.outputDuration ?? input.duration;
  return {
    characters: Array.from(input.prompt).length.toString() as DecimalString,
    ...(outputDuration === undefined ? {} : { seconds: outputDuration.toString() as DecimalString }),
    images: String(input.imageCount ?? 1) as DecimalString,
    references: String(input.referenceCount ?? 0) as DecimalString,
    ...(input.resolution ? { resolution: input.resolution } : {}),
    ...(input.quality ? { quality: input.quality } : {}),
    ...(input.mode ? { mode: input.mode } : {}),
    ...(input.fps === undefined ? {} : { fps: input.fps.toString() as DecimalString }),
    dimensions: {
      ...(input.inputDuration === undefined ? {} : { inputDuration: input.inputDuration.toString() as DecimalString }),
      ...(outputDuration === undefined ? {} : { outputDuration: outputDuration.toString() as DecimalString }),
      ...(input.nativeAudio === undefined ? {} : { nativeAudio: input.nativeAudio }),
      ...(input.aspectRatio ? { aspectRatio: input.aspectRatio } : {}),
    },
  };
}

export type NormalizedMediaResult = Readonly<{
  usage: NormalizedUsage;
  providerRequestId?: string;
  providerReportedCost?: Readonly<{ amount: string; currency: "USD" | "PKR" | "CREDIT" }>;
  rawUsage: Readonly<Record<string, unknown>>;
}>;

export function normalizeMediaResult(task: Pick<AsyncTaskResult, "raw" | "resultUrls">, fallback: NormalizedUsage): NormalizedMediaResult {
  const root = record(task.raw);
  const data = record(root.data);
  const usage = record(first(root.usage, data.usage, root.metrics, data.metrics));
  const output = record(first(root.output, data.output, root.result, data.result));
  const cost = record(first(usage.cost, root.cost, data.cost));
  const currency = String(first(cost.currency, usage.currency, root.currency, "USD")).toUpperCase();
  const reportedAmount = decimal(first(cost.amount, cost.total, usage.provider_cost, usage.cost, root.provider_cost));
  const normalized: NormalizedUsage = {
    ...fallback,
    ...(decimal(first(usage.output_duration, usage.outputDuration, usage.duration, output.duration)) ? { seconds: decimal(first(usage.output_duration, usage.outputDuration, usage.duration, output.duration))! } : {}),
    ...(integer(first(usage.images, usage.image_count, output.image_count, task.resultUrls?.length)) ? { images: integer(first(usage.images, usage.image_count, output.image_count, task.resultUrls?.length))! } : {}),
    ...(first(usage.resolution, output.resolution) ? { resolution: String(first(usage.resolution, output.resolution)) } : {}),
    ...(first(usage.quality, output.quality) ? { quality: String(first(usage.quality, output.quality)) } : {}),
    ...(first(usage.mode, output.mode) ? { mode: String(first(usage.mode, output.mode)) } : {}),
    ...(decimal(first(usage.fps, output.fps)) ? { fps: decimal(first(usage.fps, output.fps))! } : {}),
    dimensions: {
      ...(fallback.dimensions ?? {}),
      ...(decimal(first(usage.input_duration, usage.inputDuration)) ? { inputDuration: decimal(first(usage.input_duration, usage.inputDuration))! } : {}),
      ...(decimal(first(usage.output_duration, usage.outputDuration, usage.duration, output.duration)) ? { outputDuration: decimal(first(usage.output_duration, usage.outputDuration, usage.duration, output.duration))! } : {}),
      ...(typeof first(usage.native_audio, usage.nativeAudio, output.native_audio) === "boolean" ? { nativeAudio: first(usage.native_audio, usage.nativeAudio, output.native_audio) as boolean } : {}),
    },
  };
  return {
    usage: normalized,
    providerRequestId: typeof first(root.request_id, root.requestId, data.request_id) === "string" ? String(first(root.request_id, root.requestId, data.request_id)) : undefined,
    providerReportedCost: reportedAmount && ["USD", "PKR", "CREDIT"].includes(currency)
      ? { amount: reportedAmount, currency: currency as "USD" | "PKR" | "CREDIT" }
      : undefined,
    rawUsage: usage,
  };
}

export function mediaCallbackDecision(currentStatus: string, incomingState: string) {
  if (["completed", "failed", "cancelled", "expired"].includes(currentStatus)) return "duplicate" as const;
  if (incomingState === "completed") return "settle" as const;
  if (["failed", "cancelled", "expired"].includes(incomingState)) return "fail" as const;
  return "update" as const;
}

export function providerFailureIsNonBillable(providerKey: string, metadata: Readonly<Record<string, unknown>> = {}) {
  if (metadata.failedRequestsBillable === false) return true;
  return providerKey.toLowerCase().replace(/[-_.]/g, "") === "apimodels";
}
