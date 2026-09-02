import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureWalletHold, releaseWalletHold } from "@/lib/wallet";
import { persistGeneratedAssets } from "@/lib/generated-assets";
import { notifyUser } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const callbackSchema = z.object({
  taskId: z.string().min(1).max(200),
  state: z.enum(["completed", "failed", "processing", "submitted"]),
  resultUrls: z.array(z.string().url().refine((value) => ["https:", "http:"].includes(new URL(value).protocol))).max(20).optional(),
  resultJson: z.string().max(100_000).optional(),
  failMsg: z.string().max(2_000).optional()
});

function extractResultUrls(value: unknown): string[] | undefined {
  if (!value || typeof value !== "object") return undefined;
  const root = value as Record<string, unknown>;
  const candidates = [root.resultUrls, root.result_urls, root.urls, root.output, root.result, (root.data as Record<string, unknown> | undefined)?.resultUrls, (root.data as Record<string, unknown> | undefined)?.urls];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      const urls = candidate.filter((item): item is string => typeof item === "string" && /^https?:\/\//.test(item));
      if (urls.length) return urls;
    }
    if (typeof candidate === "string" && /^https?:\/\//.test(candidate)) return [candidate];
  }
  return undefined;
}

function safeSecretEqual(value: string, expected: string) {
  const a = Buffer.from(value);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request, context: { params: Promise<{ secret: string }> }) {
  const { secret } = await context.params;
  const secrets = [process.env.CALLBACK_SECRET, process.env.CALLBACK_SECRET_PREVIOUS].filter((value): value is string => Boolean(value));
  if (!secrets.some((expected) => safeSecretEqual(secret, expected))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 1_000_000) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  const payload = await request.json().catch(() => null);
  const raw = payload?.data ?? payload;
  const parsed = callbackSchema.safeParse({ ...raw, taskId: raw?.taskId ?? raw?.task_id });
  if (!parsed.success) return NextResponse.json({ error: "Invalid callback payload" }, { status: 400 });
  const data = parsed.data;
  const taskId = data.taskId;
  const admin = createAdminClient();
  const { data: job } = await admin.from("generation_jobs").select("*").eq("provider_task_id", taskId).maybeSingle();
  if (!job || ["completed", "failed", "cancelled", "expired", "settling"].includes(job.status)) return NextResponse.json({ ok: true });

  let resultUrls = data.resultUrls;
  if (!resultUrls && typeof data.resultJson === "string") { try { resultUrls = extractResultUrls(JSON.parse(data.resultJson)); } catch { /* preserve status-only callback */ } }
  if (!resultUrls) resultUrls = extractResultUrls(payload);
  if (data.state !== "completed" && data.state !== "failed") {
    await admin.from("generation_jobs").update({ status: data.state === "processing" ? "processing" : "submitted", result_json: payload, updated_at: new Date().toISOString() }).eq("id", job.id).in("status", ["queued", "submitted", "processing"]);
    return NextResponse.json({ ok: true });
  }

  // Claim terminal settlement before charging, storage, or notifications.
  const { data: claimed } = await admin.from("generation_jobs").update({ status: "settling", updated_at: new Date().toISOString() }).eq("id", job.id).in("status", ["submitted", "processing"]).select("id").maybeSingle();
  if (!claimed) return NextResponse.json({ ok: true });


  if (data?.state === "completed") {
    const charge = Number(job.estimated_credits);
    if (job.hold_id) {
      try {
        await captureWalletHold(job.hold_id, charge, `generation-capture:${job.id}`, { callback: true, provider_task_id: taskId });
      } catch {
        await admin.from("generation_jobs").update({ status: "processing", error_message: "Wallet settlement pending reconciliation.", updated_at: new Date().toISOString() }).eq("id", job.id);
        return NextResponse.json({ error: "Settlement pending" }, { status: 503 });
      }
    }
    const storedPaths = await persistGeneratedAssets(job.user_id, job.id, resultUrls ?? []);
    await admin.from("generation_jobs").update({ status: "completed", result_json: { provider: payload, amhStoredPaths: storedPaths }, result_urls: resultUrls ?? [], charged_credits: charge, updated_at: new Date().toISOString(), completed_at: new Date().toISOString() }).eq("id", job.id);
    await notifyUser(job.user_id, { type: "generation", title: `${job.modality} generation completed`, body: `${job.public_id} is ready. ${charge.toFixed(2)} Credits charged.` });
  } else if (data?.state === "failed") {
    if (job.hold_id) await releaseWalletHold(job.hold_id, "provider_callback_failed").catch(() => undefined);
    await admin.from("generation_jobs").update({ status: "failed", result_json: payload, error_message: data?.failMsg || "Generation failed", updated_at: new Date().toISOString() }).eq("id", job.id);
    await notifyUser(job.user_id, { type: "generation", title: `${job.modality} generation failed`, body: `${job.public_id} failed. Eligible reserved Credits were released.` });
  } else {
    await admin.from("generation_jobs").update({ status: data?.state === "processing" ? "processing" : "submitted", result_json: payload, updated_at: new Date().toISOString() }).eq("id", job.id);
  }
  return NextResponse.json({ ok: true });
}
