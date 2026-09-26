import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { assertTrustedAssetUrl, persistGeneratedAssets } from "@/lib/generated-assets";
import { notifyUser } from "@/lib/notifications";
import { logServerError } from "@/lib/public-error";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requestIp } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { completeGenerationJob, releaseWalletHold } from "@/lib/wallet";
import { audioGenerationUsage, completeAudioGenerationBilling } from "@/lib/billing/audio-job-billing";
import { cancelBillingQuoteReservation } from "@/lib/billing/quote-reservation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CALLBACK_BYTES = 256 * 1024;
const callbackSchema = z.object({
  taskId: z.string().min(1).max(200),
  state: z.string().min(1).max(60),
  failMsg: z.string().max(1000).optional()
});

type CallbackRecord = Record<string, unknown>;

function asRecord(value: unknown): CallbackRecord | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as CallbackRecord : undefined;
}

function safeSecretEqual(value: string, expected: string) {
  const provided = Buffer.from(value);
  const configured = Buffer.from(expected);
  return provided.length === configured.length && timingSafeEqual(provided, configured);
}

function candidateUrls(value: unknown) {
  const urls = new Set<string>();
  const visit = (node: unknown, depth = 0) => {
    if (depth > 8 || node === null || node === undefined) return;
    if (typeof node === "string") {
      const trimmed = node.trim();
      if (/^https:\/\//i.test(trimmed)) { urls.add(trimmed); return; }
      if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
        try { visit(JSON.parse(trimmed), depth + 1); } catch { /* non-JSON provider text */ }
      }
      return;
    }
    if (Array.isArray(node)) { node.forEach((item) => visit(item, depth + 1)); return; }
    if (typeof node === "object") Object.values(node as CallbackRecord).forEach((item) => visit(item, depth + 1));
  };
  visit(value);
  return [...urls].slice(0, 20);
}

async function trustedResultUrls(payload: unknown) {
  const candidates = candidateUrls(payload);
  const results = await Promise.allSettled(candidates.map(async (url) => {
    await assertTrustedAssetUrl(url);
    return url;
  }));
  if (results.some((result) => result.status === "rejected")) throw new Error("Callback contains an untrusted asset URL");
  return results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
}

function normalizeState(value: string, hasTrustedUrls: boolean) {
  const state = value.toLowerCase().replace(/[ -]/g, "_");
  if (["completed", "complete", "succeeded", "success", "done", "finished"].includes(state) || hasTrustedUrls) return "completed" as const;
  if (["failed", "failure", "error", "cancelled", "canceled", "expired"].includes(state)) return "failed" as const;
  if (["processing", "running", "in_progress", "inprogress", "pending", "queued"].includes(state)) return "processing" as const;
  return "submitted" as const;
}

function callbackSummary(data: z.infer<typeof callbackSchema>, normalizedState: string, urls: string[]) {
  return {
    provider_state: data.state.slice(0, 60),
    normalized_state: normalizedState,
    result_url_count: urls.length,
    ...(data.failMsg ? { failure_message: data.failMsg.slice(0, 1000) } : {})
  };
}

export async function POST(request: Request, context: { params: Promise<{ secret: string }> }) {
  const { secret } = await context.params;
  const secrets = [process.env.CALLBACK_SECRET, process.env.CALLBACK_SECRET_PREVIOUS].filter((value): value is string => Boolean(value));
  if (!secrets.length || !secrets.some((expected) => safeSecretEqual(secret, expected))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = await enforceRateLimit(`callback:${requestIp(request)}`, "callback");
  if (limit.unavailable) return NextResponse.json({ error: "Callback protection unavailable" }, { status: 503 });
  if (!limit.success) return NextResponse.json({ error: "Too many callbacks" }, { status: 429 });

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_CALLBACK_BYTES) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_CALLBACK_BYTES) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  let payload: unknown;
  try { payload = JSON.parse(text); } catch { return NextResponse.json({ error: "Invalid callback payload" }, { status: 400 }); }

  const base = asRecord(payload);
  if (!base) return NextResponse.json({ error: "Invalid callback payload" }, { status: 400 });
  const raw = asRecord(base.data) ? { ...base, ...asRecord(base.data) } : base;
  const task = asRecord(raw.task);
  const nested = asRecord(raw.data);
  const parsed = callbackSchema.safeParse({
    taskId: raw.taskId ?? raw.task_id ?? raw.id ?? task?.id ?? nested?.taskId ?? nested?.task_id,
    state: raw.state ?? raw.status ?? raw.task_status ?? raw.taskState ?? task?.state ?? nested?.state ?? nested?.status ?? "processing",
    failMsg: raw.failMsg ?? raw.fail_msg ?? raw.failMessage ?? raw.error_message ?? raw.message
  });
  if (!parsed.success) return NextResponse.json({ error: "Invalid callback payload" }, { status: 400 });

  let resultUrls: string[];
  try { resultUrls = await trustedResultUrls(payload); }
  catch (error) {
    logServerError("provider-callback-url", error, { source: "apimodels" });
    return NextResponse.json({ error: "Untrusted callback asset" }, { status: 400 });
  }
  const state = normalizeState(parsed.data.state, resultUrls.length > 0);
  const summary = callbackSummary(parsed.data, state, resultUrls);
  const admin = createAdminClient();
  const jobFields = "id,user_id,public_id,modality,model_id,status,hold_id,billing_quote_id,estimated_credits,provider_task_id,prompt,request_json";
  const { data: existingJob, error: lookupError } = await admin.from("generation_jobs").select(jobFields).eq("provider_task_id", parsed.data.taskId).maybeSingle();
  if (lookupError) {
    logServerError("provider-callback-lookup", lookupError, { source: "apimodels" });
    return NextResponse.json({ error: "Job lookup failed" }, { status: 500 });
  }
  if (!existingJob || ["completed", "failed", "cancelled", "expired"].includes(existingJob.status)) return NextResponse.json({ ok: true });

  if (state !== "completed" && state !== "failed") {
    await admin.from("generation_jobs").update({ status: state, result_json: summary, updated_at: new Date().toISOString() })
      .eq("id", existingJob.id).in("status", ["queued", "submitted", "processing"]);
    return NextResponse.json({ ok: true });
  }

  if (state === "completed") {
    if (!resultUrls.length) {
      await admin.from("generation_jobs").update({ status: "processing", result_json: summary, error_message: "Provider marked job complete without output URLs.", updated_at: new Date().toISOString() }).eq("id", existingJob.id);
      return NextResponse.json({ ok: true });
    }

    const { data: job, error: claimError } = await admin.from("generation_jobs")
      .update({ status: "settling", result_json: summary, updated_at: new Date().toISOString() })
      .eq("id", existingJob.id).in("status", ["queued", "submitted", "processing"]).select(jobFields).maybeSingle();
    if (claimError) {
      logServerError("provider-callback-claim", claimError, { jobId: existingJob.id });
      return NextResponse.json({ error: "Settlement claim failed" }, { status: 503 });
    }
    if (!job) return NextResponse.json({ ok: true });

    const storedPaths = await persistGeneratedAssets(job.user_id, job.id, resultUrls);
    const charge = Number(job.estimated_credits);
    try {
      const billingV2Audio = job.modality === "audio" && Boolean(job.billing_quote_id);
      const requestJson = (job.request_json && typeof job.request_json === "object" ? job.request_json : {}) as { duration?: number };
      const settlement = billingV2Audio
        ? await completeAudioGenerationBilling({
            jobId: job.id,
            usage: audioGenerationUsage({ prompt: String(job.prompt ?? ""), duration: requestJson.duration }),
            providerTaskId: job.provider_task_id,
            resultJson: { ...summary, amhStoredPaths: storedPaths }, resultUrls,
            metadata: { job_id: job.id, model_id: job.model_id, source: "provider_callback" },
          })
        : await completeGenerationJob({
            jobId: job.id,
            chargedCredits: charge,
            resultJson: { ...summary, amhStoredPaths: storedPaths },
            resultUrls,
            metadata: { job_id: job.id, model_id: job.model_id, source: "provider_callback" }
          });
      if (billingV2Audio || ("completedNow" in settlement && settlement.completedNow)) {
        await notifyUser(job.user_id, { type: "generation", title: `${job.modality} generation completed`, body: `${job.public_id} is ready. ${charge.toFixed(2)} Credits charged.` });
      }
      return NextResponse.json({ ok: true });
    } catch (error) {
      await admin.from("generation_jobs").update({ error_message: "Wallet settlement pending reconciliation.", updated_at: new Date().toISOString() }).eq("id", job.id).neq("status", "completed");
      logServerError("provider-callback-settlement", error, { jobId: job.id });
      return NextResponse.json({ error: "Settlement pending" }, { status: 503 });
    }
  }

  if (existingJob.billing_quote_id) await cancelBillingQuoteReservation(existingJob.billing_quote_id, "provider_callback_failed").catch(() => undefined);
  else if (existingJob.hold_id) await releaseWalletHold(existingJob.hold_id, "provider_callback_failed").catch(() => undefined);
  await admin.from("generation_jobs").update({ status: "failed", result_json: summary, error_message: parsed.data.failMsg || "Generation failed", updated_at: new Date().toISOString() }).eq("id", existingJob.id);
  await notifyUser(existingJob.user_id, { type: "generation", title: `${existingJob.modality} generation failed`, body: `${existingJob.public_id} failed. Eligible reserved Credits were released.` });
  return NextResponse.json({ ok: true });
}
