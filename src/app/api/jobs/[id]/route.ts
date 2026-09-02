import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { providerPollTask } from "@/lib/providers";
import { captureWalletHold, releaseWalletHold } from "@/lib/wallet";
import { persistGeneratedAssets, signGeneratedPaths } from "@/lib/generated-assets";
import { notifyUser } from "@/lib/notifications";

export const dynamic = "force-dynamic";

type GenerationJob = {
  result_json?: { amhStoredPaths?: unknown } | null;
  result_urls?: string[] | null;
  [key: string]: unknown;
};

async function clientJob(job: GenerationJob) {
  const paths = Array.isArray(job.result_json?.amhStoredPaths) && job.result_json.amhStoredPaths.every((path): path is string => typeof path === "string") ? job.result_json.amhStoredPaths : [];
  const signed = await signGeneratedPaths(paths);
  return { ...job, result_urls: signed.length ? signed : (job.result_urls ?? []) };
}

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const admin = createAdminClient();
  const { data: job, error } = await admin.from("generation_jobs").select("*").eq("id", id).eq("user_id", user.id).single();
  if (error || !job) return NextResponse.json({ error: "Generation job not found." }, { status: 404 });

  if (["completed", "failed", "cancelled", "expired", "settling"].includes(job.status) || !job.provider_task_id) {
    return NextResponse.json({ job: await clientJob(job) });
  }

  try {
    const task = await providerPollTask({ provider: String(job.provider_key || "apimodels"), modality: job.modality as "image" | "video" | "audio", taskId: job.provider_task_id });
    if (task.state === "completed") {
      const claim = await admin.from("generation_jobs").update({ status: "settling", updated_at: new Date().toISOString() }).eq("id", job.id).in("status", ["submitted", "processing"]).select("id").maybeSingle();
      if (!claim.data) return NextResponse.json({ job: await clientJob(job), warning: "Generation completion is being finalized." });
      const charge = Number(job.estimated_credits);
      if (job.hold_id) {
        try {
          await captureWalletHold(job.hold_id, charge, `generation-capture:${job.id}`, { job_id: job.id, model_id: job.model_id, provider_task_id: job.provider_task_id });
        } catch {
          await admin.from("generation_jobs").update({ status: "processing", error_message: "Wallet settlement pending reconciliation.", updated_at: new Date().toISOString() }).eq("id", job.id);
          return NextResponse.json({ job: await clientJob(job), warning: "Wallet settlement is pending." }, { status: 503 });
        }
      }
      const storedPaths = await persistGeneratedAssets(user.id, job.id, task.resultUrls ?? []);
      const resultJson = { provider: task.raw, amhStoredPaths: storedPaths };
      const { data: updated } = await admin.from("generation_jobs").update({ status: "completed", result_json: resultJson, result_urls: task.resultUrls ?? [], charged_credits: charge, updated_at: new Date().toISOString(), completed_at: new Date().toISOString() }).eq("id", job.id).select("*").single();
      await notifyUser(user.id, { type: "generation", title: `${job.modality} generation completed`, body: `${job.public_id} is ready. ${charge.toFixed(2)} Credits charged.`, href: `/${job.modality === "image" ? "images" : job.modality === "video" ? "video" : "audio"}` });
      return NextResponse.json({ job: await clientJob(updated) });
    }

    if (task.state === "failed") {
      if (job.hold_id) await releaseWalletHold(job.hold_id, "provider_generation_failed").catch(() => undefined);
      const { data: updated } = await admin.from("generation_jobs").update({ status: "failed", error_message: task.failMsg || "Generation failed", result_json: task.raw, updated_at: new Date().toISOString() }).eq("id", job.id).select("*").single();
      await notifyUser(user.id, { type: "generation", title: `${job.modality} generation failed`, body: `${job.public_id} failed. Eligible reserved Credits were released.` });
      return NextResponse.json({ job: updated });
    }

    const normalized = task.state === "processing" ? "processing" : "submitted";
    const { data: updated } = await admin.from("generation_jobs").update({ status: normalized, result_json: task.raw, updated_at: new Date().toISOString() }).eq("id", job.id).select("*").single();
    return NextResponse.json({ job: updated });
  } catch (pollError) {
    return NextResponse.json({ job: await clientJob(job), warning: pollError instanceof Error ? pollError.message : "Could not refresh provider status." });
  }
}
