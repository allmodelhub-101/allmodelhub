import { timingSafeEqual } from "node:crypto";
import { runBillingReconciliation } from "@/lib/billing/reconciliation";
import { logServerError } from "@/lib/public-error";
import { cleanupTemporaryMedia } from "@/lib/media-storage-cleanup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");
  if (!secret || !header?.startsWith("Bearer ")) return false;
  const provided = Buffer.from(header.slice(7));
  const expected = Buffer.from(secret);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await runBillingReconciliation(20);
    await cleanupTemporaryMedia().catch((error) => logServerError("temporary-media-cleanup", error));
    return Response.json({ ok: true, ...result });
  } catch (error) {
    logServerError("billing-reconciliation-cron", error);
    return Response.json({ ok: false, error: "Reconciliation run failed" }, { status: 500 });
  }
}

