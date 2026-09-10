import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { completeGenerationJob, releaseWalletHold } from "@/lib/wallet";
import { persistGeneratedAssets } from "@/lib/generated-assets";
import { notifyUser } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const callbackSchema = z.object({
  taskId: z.string().min(1).max(200),
  state: z.string().min(1).max(60),
  failMsg: z.string().max(2000).optional()
});

type CallbackRecord = Record<string, unknown>;

function asRecord(value: unknown): CallbackRecord | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as CallbackRecord)
    : undefined;
}

function safeSecretEqual(value: string, expected: string) {
  const a = Buffer.from(value);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function normalizeCallbackState(value: string, urls?: string[]) {
  const state = String(value || "")
    .toLowerCase()
    .replace(/[ -]/g, "_");

  if (
    ["completed", "complete", "succeeded", "success", "done", "finished"].includes(state) ||
    (urls && urls.length > 0)
  ) {
    return "completed" as const;
  }

  if (
    ["failed", "failure", "error", "cancelled", "canceled", "expired"].includes(state)
  ) {
    return "failed" as const;
  }

  if (
    ["processing", "running", "in_progress", "inprogress", "pending", "queued"].includes(state)
  ) {
    return "processing" as const;
  }

  return "submitted" as const;
}

function extractResultUrls(value: unknown): string[] | undefined {
  const urls = new Set<string>();

  const visit = (node: unknown, depth = 0) => {
    if (depth > 8 || node === null || node === undefined) return;

    if (typeof node === "string") {
      const trimmed = node.trim();

      if (isHttpUrl(trimmed)) {
        urls.add(trimmed);
        return;
      }

      if (
        (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
        (trimmed.startsWith("[") && trimmed.endsWith("]"))
      ) {
        try {
          visit(JSON.parse(trimmed), depth + 1);
        } catch {
          // ignore invalid JSON string
        }
      }

      return;
    }

    if (Array.isArray(node)) {
      for (const item of node) visit(item, depth + 1);
      return;
    }

    if (typeof node === "object") {
      for (const child of Object.values(node as Record<string, unknown>)) {
        visit(child, depth + 1);
      }
    }
  };

  visit(value);

  const result = [...urls].filter(isHttpUrl).slice(0, 20);
  return result.length ? result : undefined;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ secret: string }> }
) {
  const { secret } = await context.params;

  const secrets = [
    process.env.CALLBACK_SECRET,
    process.env.CALLBACK_SECRET_PREVIOUS
  ].filter((value): value is string => Boolean(value));

  if (!secrets.some((expected) => safeSecretEqual(secret, expected))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 1_000_000) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  const payload = await request.json().catch(() => null);
  
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Invalid callback payload" }, { status: 400 });
  }

  const base = payload as CallbackRecord;
  const nestedData = asRecord(base.data);

  const raw = nestedData ? { ...base, ...nestedData } : base;
  const rawTask = asRecord(raw.task);
  const rawData = asRecord(raw.data);

  const parsed = callbackSchema.safeParse({
    taskId:
      raw.taskId ??
      raw.task_id ??
      raw.id ??
      rawTask?.id ??
      rawData?.taskId ??
      rawData?.task_id,
    state:
      raw.state ??
      raw.status ??
      raw.task_status ??
      raw.taskState ??
      rawTask?.state ??
      rawData?.state ??
      rawData?.status ??
      "processing",
    failMsg:
      raw.failMsg ??
      raw.fail_msg ??
      raw.failMessage ??
      raw.error_message ??
      raw.message
  });

  if (!parsed.success) {
    console.info("[callback] invalid payload");
    return NextResponse.json({ error: "Invalid callback payload" }, { status: 400 });
  }

  const data = parsed.data;
  const taskId = data.taskId;
  const resultUrls = extractResultUrls(payload);
  const callbackState = normalizeCallbackState(data.state, resultUrls);

  console.info(
    "[callback] received",
    JSON.stringify({
      taskId,
      providerState: data.state,
      normalizedState: callbackState,
      outputUrlCount: resultUrls?.length ?? 0
    })
  );

  const admin = createAdminClient();

  const { data: job, error: jobError } = await admin
    .from("generation_jobs")
    .select("*")
    .eq("provider_task_id", taskId)
    .maybeSingle();

  if (jobError) {
    console.info("[callback] job lookup error", jobError.message);
    return NextResponse.json({ error: "Job lookup failed" }, { status: 500 });
  }
  if (!job) {
    console.info("[callback] no matching job", JSON.stringify({ taskId }));
    return NextResponse.json({ ok: true });
  }

  if (["failed", "cancelled", "expired"].includes(job.status)) {
    return NextResponse.json({ ok: true });
  }
  if (callbackState !== "completed" && callbackState !== "failed") {
    const { error: progressError } = await admin
      .from("generation_jobs")
      .update({
        status: callbackState === "processing" ? "processing" : "submitted",
        result_json: payload,
        updated_at: new Date().toISOString()
      })
      .eq("id", job.id)
      .in("status", ["queued", "submitted", "processing"]);

    console.info(
      "[callback] progress update",
      JSON.stringify({
        jobId: job.id,
        nextStatus: callbackState === "processing" ? "processing" : "submitted",
        ok: !progressError,
        error: progressError?.message
      })
    );

    return NextResponse.json({ ok: true });
  }

  if (callbackState === "completed") {
    if (!resultUrls?.length) {
      const { error: noUrlUpdateError } = await admin
        .from("generation_jobs")
        .update({
          status: "processing",
          result_json: payload,
          error_message: "Provider marked job complete without output URLs.",
          updated_at: new Date().toISOString()
        })
        .eq("id", job.id);

      console.info(
        "[callback] completed without urls",
        JSON.stringify({
          jobId: job.id,
          ok: !noUrlUpdateError,
          error: noUrlUpdateError?.message
        })
      );

      return NextResponse.json({ ok: true });
    }

    const charge = Number(job.estimated_credits);

    const storedPaths = await persistGeneratedAssets(job.user_id, job.id, resultUrls);
    let settlement: { transactionId: string | null; completedNow: boolean };
    try {
      settlement = await completeGenerationJob({
        jobId: job.id,
        chargedCredits: charge,
        resultJson: { provider: payload, amhStoredPaths: storedPaths },
        resultUrls,
        metadata: {
          job_id: job.id,
          model_id: job.model_id,
          provider_task_id: job.provider_task_id,
          source: "provider_callback"
        }
      });
    } catch (error) {
      await admin
        .from("generation_jobs")
        .update({
          error_message: "Wallet settlement pending reconciliation.",
          updated_at: new Date().toISOString()
        })
        .eq("id", job.id)
        .neq("status", "completed");

      console.info(
        "[callback] wallet capture failed",
        JSON.stringify({
          jobId: job.id,
          taskId,
          error: error instanceof Error ? error.message : "Unknown wallet capture error"
        })
      );

      return NextResponse.json({ error: "Settlement pending" }, { status: 503 });
    }

    console.info(
      "[callback] settlement completed",
      JSON.stringify({
        jobId: job.id,
        outputUrlCount: resultUrls.length,
        chargedCredits: charge,
        transactionId: settlement.transactionId,
        completedNow: settlement.completedNow
      })
    );

    if (settlement.completedNow) {
      await notifyUser(job.user_id, {
        type: "generation",
        title: `${job.modality} generation completed`,
        body: `${job.public_id} is ready. ${charge.toFixed(2)} Credits charged.`
      });
    }

    return NextResponse.json({ ok: true });
  }

  if (job.hold_id) {
    await releaseWalletHold(job.hold_id, "provider_callback_failed").catch(() => undefined);
  }

  const { error: failedUpdateError } = await admin
    .from("generation_jobs")
    .update({
      status: "failed",
      result_json: payload,
      error_message: data.failMsg || "Generation failed",
      updated_at: new Date().toISOString()
    })
    .eq("id", job.id);

  console.info(
    "[callback] failed update",
    JSON.stringify({
      jobId: job.id,
      ok: !failedUpdateError,
      error: failedUpdateError?.message
    })
  );

  await notifyUser(job.user_id, {
    type: "generation",
    title: `${job.modality} generation failed`,
    body: `${job.public_id} failed. Eligible reserved Credits were released.`
  });

  return NextResponse.json({ ok: true });
}
