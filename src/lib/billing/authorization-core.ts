import Decimal from "decimal.js";
import type { NormalizedUsage } from "./types";

type Constraints = Readonly<{
  maxCharacters?: string;
  maxInputTokens?: string;
  maxOutputTokens?: string;
  maxSeconds?: string;
  maxImages?: string;
  maxReferences?: string;
  maxFps?: string;
  maxInputDuration?: string;
  maxOutputDuration?: string;
  allowedResolutions?: readonly string[];
  allowedQualities?: readonly string[];
  allowedModes?: readonly string[];
  allowedInputTypes?: readonly string[];
  allowedAspectRatios?: readonly string[];
  allowedNativeAudio?: readonly boolean[];
}>;

export class AuthorizationPolicyError extends Error {
  readonly code: "POLICY_UNAVAILABLE" | "REQUEST_OUTSIDE_POLICY" | "POLICY_INVALID";

  constructor(code: "POLICY_UNAVAILABLE" | "REQUEST_OUTSIDE_POLICY" | "POLICY_INVALID", message: string) {
    super(message);
    this.name = "AuthorizationPolicyError";
    this.code = code;
  }
}

function decimal(value: string, field: string) {
  try {
    const parsed = new Decimal(value);
    if (!parsed.isFinite() || parsed.isNegative()) throw new Error();
    return parsed;
  } catch {
    throw new AuthorizationPolicyError("POLICY_INVALID", `${field} is not a valid non-negative decimal.`);
  }
}

function assertMaximum(value: string | undefined, maximum: string | undefined, field: string) {
  if (value === undefined) return;
  if (maximum === undefined || decimal(value, field).gt(decimal(maximum, `constraints.${field}`))) {
    throw new AuthorizationPolicyError("REQUEST_OUTSIDE_POLICY", `${field} exceeds the Billing V3 authorization contract.`);
  }
}

function assertAllowed(value: string | undefined, allowed: readonly string[] | undefined, field: string) {
  if (value === undefined) return;
  if (!allowed?.includes(value)) {
    throw new AuthorizationPolicyError("REQUEST_OUTSIDE_POLICY", `${field} is not authorized for this provider route.`);
  }
}

function dimension(usage: NormalizedUsage, key: string) {
  const value = usage.dimensions?.[key];
  return typeof value === "string" ? value : undefined;
}

export function validateAuthorizationRequest(usage: NormalizedUsage, constraints: Constraints) {
  assertMaximum(usage.characters, constraints.maxCharacters, "characters");
  assertMaximum(usage.inputTokens, constraints.maxInputTokens, "inputTokens");
  assertMaximum(usage.outputTokens, constraints.maxOutputTokens, "outputTokens");
  assertMaximum(usage.seconds, constraints.maxSeconds, "seconds");
  assertMaximum(usage.images, constraints.maxImages, "images");
  assertMaximum(usage.references, constraints.maxReferences, "references");
  assertMaximum(usage.fps, constraints.maxFps, "fps");
  assertMaximum(dimension(usage, "inputDuration"), constraints.maxInputDuration, "inputDuration");
  assertMaximum(dimension(usage, "outputDuration"), constraints.maxOutputDuration, "outputDuration");
  assertAllowed(usage.resolution, constraints.allowedResolutions, "resolution");
  assertAllowed(usage.quality, constraints.allowedQualities, "quality");
  assertAllowed(usage.mode, constraints.allowedModes, "mode");
  assertAllowed(usage.inputType, constraints.allowedInputTypes, "inputType");
  assertAllowed(dimension(usage, "aspectRatio"), constraints.allowedAspectRatios, "aspectRatio");
  const nativeAudio = usage.dimensions?.nativeAudio;
  if (typeof nativeAudio === "boolean" && !constraints.allowedNativeAudio?.includes(nativeAudio)) {
    throw new AuthorizationPolicyError("REQUEST_OUTSIDE_POLICY", "nativeAudio is not authorized for this provider route.");
  }
  return true;
}

export function parseAuthorizationConstraints(value: unknown): Constraints {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AuthorizationPolicyError("POLICY_INVALID", "Authorization constraints must be an object.");
  }
  const constraints = value as Record<string, unknown>;
  const numericKeys = ["maxCharacters", "maxInputTokens", "maxOutputTokens", "maxSeconds", "maxImages",
    "maxReferences", "maxFps", "maxInputDuration", "maxOutputDuration"] as const;
  const stringArrayKeys = ["allowedResolutions", "allowedQualities", "allowedModes", "allowedInputTypes",
    "allowedAspectRatios"] as const;
  const supported = new Set<string>([...numericKeys, ...stringArrayKeys, "allowedNativeAudio"]);
  for (const key of Object.keys(constraints)) {
    if (!supported.has(key)) throw new AuthorizationPolicyError("POLICY_INVALID", `Unsupported authorization constraint: ${key}.`);
  }
  for (const key of numericKeys) {
    const entry = constraints[key];
    if (entry !== undefined && (typeof entry !== "string" || !decimal(entry, `constraints.${key}`).isFinite())) {
      throw new AuthorizationPolicyError("POLICY_INVALID", `constraints.${key} must be a non-negative decimal string.`);
    }
  }
  for (const key of stringArrayKeys) {
    const entry = constraints[key];
    if (entry !== undefined && (!Array.isArray(entry) || entry.some((item) => typeof item !== "string"))) {
      throw new AuthorizationPolicyError("POLICY_INVALID", `constraints.${key} must be an array of strings.`);
    }
  }
  const nativeAudio = constraints.allowedNativeAudio;
  if (nativeAudio !== undefined && (!Array.isArray(nativeAudio) || nativeAudio.some((item) => typeof item !== "boolean"))) {
    throw new AuthorizationPolicyError("POLICY_INVALID", "constraints.allowedNativeAudio must be an array of booleans.");
  }
  return constraints as Constraints;
}
