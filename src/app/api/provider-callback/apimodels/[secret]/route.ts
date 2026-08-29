import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureWalletHold, releaseWalletHold } from "@/lib/wallet";
import { persistGeneratedAssets } from "@/lib/generated-assets";
import { notifyUser } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ secret: string }> }) {
  const { secret } = await context.params;
  if (!process.env.CALLBACK_SECRET || secret !== process.env.CALLBACK_SECRET) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await request.json().catch(() => null);
  const data = payload?.data ?? payload;
  const taskId = data?.taskId ?? data?.task_id;
  if (!taskId) return NextResponse.json({ ok: true });
  const admin = createAdminClient();
  const { data: job } = await admin.from("generation_jobs").select("*").eq("provider_task_id", taskId).maybeSingle();
  if (!job || ["completed", "failed", "cancelled", "expired"].includes(job.status)) return NextResponse.json({ ok: true });

  let resultUrls = data?.resultUrls;
  if (!resultUrls && typeof data?.resultJson === "string") { try { resultUrls = JSON.parse(data.resultJson)?.resultUrls; } catch { /* no result URLs */ } }
  if (data?.state === "completed") {
    const charge = Number(job.estimated_credits);
    if (job.hold_id) await captureWalletHold(job.hold_id, charge, `generation-capture:${job.id}`, { callback: true, provider_task_id: taskId }).catch(() => undefined);
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
