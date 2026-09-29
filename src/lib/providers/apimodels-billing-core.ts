import Decimal from "decimal.js";

export type ApimodelsBillingState = "pending" | "running" | "completed" | "failed" | "cancelled";

export type ApimodelsBillingRecord = Readonly<{
  taskId: string;
  model?: string;
  state: ApimodelsBillingState;
  settled: boolean;
  creditsUsd?: string;
  currency?: string;
  usage: Readonly<Record<string, unknown>>;
  createdAt?: string;
  completedAt?: string;
}>;

export class ApimodelsBillingRecordError extends Error {
  readonly code:
    | "MALFORMED_RECORD"
    | "UNSETTLED_RECORD"
    | "INVALID_CURRENCY"
    | "INVALID_COST"
    | "RECORD_UNAVAILABLE";

  constructor(
    code:
      | "MALFORMED_RECORD"
      | "UNSETTLED_RECORD"
      | "INVALID_CURRENCY"
      | "INVALID_COST"
      | "RECORD_UNAVAILABLE",
    message: string,
  ) {
    super(message);
    this.name = "ApimodelsBillingRecordError";
    this.code = code;
  }
}

const DECIMAL = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function first(...values: unknown[]) {
  return values.find((value) => value !== undefined && value !== null);
}

function exactNonnegative(value: unknown, field: string) {
  const text = typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
  if (!DECIMAL.test(text)) throw new ApimodelsBillingRecordError("INVALID_COST", `${field} is not an exact non-negative decimal.`);
  const parsed = new Decimal(text);
  if (!parsed.isFinite() || parsed.isNegative()) throw new ApimodelsBillingRecordError("INVALID_COST", `${field} is invalid.`);
  return parsed.isZero() ? "0" : parsed.toFixed();
}

function normalizeState(value: unknown): ApimodelsBillingState {
  const state = String(value ?? "pending").trim().toLowerCase().replace(/[ -]/g, "_");
  if (["completed", "complete", "success", "succeeded", "done", "finished"].includes(state)) return "completed";
  if (["failed", "failure", "error"].includes(state)) return "failed";
  if (["cancelled", "canceled", "expired"].includes(state)) return "cancelled";
  if (["running", "processing", "in_progress"].includes(state)) return "running";
  return "pending";
}

export function extractExactJsonDecimal(jsonText: string, field: string) {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`"${escaped}"\\s*:\\s*(?:"((?:0|[1-9]\\d*)(?:\\.\\d+)?)"|((?:0|[1-9]\\d*)(?:\\.\\d+)?))`, "i").exec(jsonText);
  return match ? (match[1] ?? match[2]) : undefined;
}

export function normalizeApimodelsBillingRecord(
  value: unknown,
  exactCredits?: string,
): ApimodelsBillingRecord {
  const root = object(value);
  const data = object(root.data);
  const source = Object.keys(data).length ? data : root;
  const taskId = String(first(source.task_id, source.taskId, source.id, root.task_id, root.taskId) ?? "").trim();
  if (!taskId) throw new ApimodelsBillingRecordError("MALFORMED_RECORD", "APIMODELS billing record has no task ID.");
  const settledValue = first(source.settled, root.settled);
  if (typeof settledValue !== "boolean") throw new ApimodelsBillingRecordError("MALFORMED_RECORD", "APIMODELS billing record has no settled flag.");
  const settled = settledValue;
  const state = normalizeState(first(source.state, source.status, root.state, root.status));
  const rawCredits = exactCredits ?? first(source.credits, root.credits);
  const rawCurrency = first(source.currency, root.currency);
  let creditsUsd: string | undefined;
  let currency: string | undefined;

  if (settled) {
    if (rawCredits === undefined || rawCredits === null) {
      throw new ApimodelsBillingRecordError("MALFORMED_RECORD", "A settled APIMODELS record must include credits.");
    }
    currency = String(rawCurrency ?? "").trim().toUpperCase();
    if (currency !== "USD") throw new ApimodelsBillingRecordError("INVALID_CURRENCY", "Automatic settlement requires an APIMODELS USD record.");
    creditsUsd = exactNonnegative(rawCredits, "credits");
    if ((state === "failed" || state === "cancelled") && creditsUsd !== "0") {
      throw new ApimodelsBillingRecordError("INVALID_COST", "A failed APIMODELS record must have zero credits.");
    }
  } else if (rawCredits !== undefined && rawCredits !== null) {
    throw new ApimodelsBillingRecordError("MALFORMED_RECORD", "An unsettled APIMODELS record must not include final credits.");
  }

  return {
    taskId,
    model: typeof source.model === "string" ? source.model : undefined,
    state,
    settled,
    creditsUsd,
    currency,
    usage: object(first(source.usage, root.usage)),
    createdAt: typeof first(source.created_at, source.createdAt) === "string" ? String(first(source.created_at, source.createdAt)) : undefined,
    completedAt: typeof first(source.completed_at, source.completedAt) === "string" ? String(first(source.completed_at, source.completedAt)) : undefined,
  };
}

export function apimodelsRequestId(headers: Headers) {
  return headers.get("x-apimodels-request-id")
    ?? headers.get("x-request-id")
    ?? headers.get("request-id")
    ?? undefined;
}

export function apimodelsResponseCost(headers: Headers) {
  const value = headers.get("x-apimodels-cost")?.trim();
  if (!value) return undefined;
  return { amount: exactNonnegative(value, "x-apimodels-cost"), currency: "USD" as const };
}

export function callbackProviderCost(value: unknown, exactCredits?: string) {
  const root = object(value);
  const data = object(root.data);
  const credits = exactCredits ?? first(data.credits, root.credits);
  if (credits === undefined || credits === null) return undefined;
  const currency = String(first(data.currency, root.currency, "USD")).toUpperCase();
  if (currency !== "USD") throw new ApimodelsBillingRecordError("INVALID_CURRENCY", "APIMODELS callback cost must be USD.");
  return { amount: exactNonnegative(credits, "callback credits"), currency: "USD" as const };
}
