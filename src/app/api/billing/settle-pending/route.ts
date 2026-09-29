import { after, NextResponse } from "next/server";
import { z } from "zod";
import { runBillingV3ReconciliationPump } from "@/lib/billing/reconciliation";
import {
  releaseAuthoritativeProviderFailure,
  settleApimodelsTask,
  settleProviderBillingRecord,
} from "@/lib/billing/provider-authoritative-settlement";
import { logServerError } from "@/lib/public-error";
import { enforceRateLimit } from "@/lib/rate-limit";
import { isTrustedMutation, privateNoStoreHeaders } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  quoteId: z.string().uuid().optional(),
  messageId: z.string().uuid().optional(),
}).refine((value) => Number(Boolean(value.quoteId)) + Number(Boolean(value.messageId)) === 1, {
  message: "Supply exactly one settlement identifier.",
});

function safeStatus(value: unknown) {
  const status = String(value ?? "pending_reconciliation");
  if (status === "settled") return "settled" as const;
  if (status === "released") return "released" as const;
  if (status === "authorization_shortfall") return "authorization_shortfall" as const;
  return "pending" as const;
}

function safeResponse(result: Record<string, unknown>, quoteStatus: string) {
  return {
    billingStatus: safeStatus(result.status ?? result.reconciliation_status),
    chargeCredits: result.charge_credits == null ? undefined : String(result.charge_credits),
    receiptId: result.receipt_id == null ? undefined : String(result.receipt_id),
    quoteStatus,
  };
}

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) {
    return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403, headers: privateNoStoreHeaders });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401, headers: privateNoStoreHeaders });

  const limit = await enforceRateLimit(`billing-settlement:${user.id}`, "standard");
  if (limit.unavailable) return NextResponse.json({ error: "Request protection is temporarily unavailable." }, { status: 503, headers: privateNoStoreHeaders });
  if (!limit.success) return NextResponse.json({ error: "Too many requests." }, { status: 429, headers: privateNoStoreHeaders });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid settlement request." }, { status: 400, headers: privateNoStoreHeaders });

  const admin = createAdminClient();
  let quoteId = parsed.data.quoteId;
  const messageId = parsed.data.messageId;
  if (messageId) {
    const { data: message } = await admin.from("messages").select("id,user_id,metadata").eq("id", messageId).eq("user_id", user.id).maybeSingle();
    const metadata = message?.metadata && typeof message.metadata === "object" ? message.metadata as Record<string, unknown> : {};
    quoteId = typeof metadata.billingQuoteId === "string" ? metadata.billingQuoteId : undefined;
    if (!message || !quoteId) return NextResponse.json({ error: "Settlement not found." }, { status: 404, headers: privateNoStoreHeaders });
  }

  const { data: quote } = await admin.from("billing_quotes").select("id,user_id,status").eq("id", quoteId!).eq("user_id", user.id).maybeSingle();
  if (!quote) return NextResponse.json({ error: "Settlement not found." }, { status: 404, headers: privateNoStoreHeaders });

  const { data: receipt } = await admin.from("billing_receipts").select("id,charge_credits").eq("quote_id", quote.id).eq("user_id", user.id).maybeSingle();
  if (receipt) {
    return NextResponse.json({ billingStatus: "settled", chargeCredits: String(receipt.charge_credits), receiptId: receipt.id, quoteStatus: "settled" }, { headers: privateNoStoreHeaders });
  }

  const { data: record } = await admin.from("provider_billing_records")
    .select("id,provider_key,provider_request_id,provider_task_id,state,settled,reconciliation_status,message_id,generation_job_id")
    .eq("quote_id", quote.id).eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!record) return NextResponse.json({ billingStatus: "pending", quoteStatus: quote.status }, { headers: privateNoStoreHeaders });

  try {
    let result: Record<string, unknown>;
    if (record.settled && (record.state === "failed" || record.state === "cancelled")) {
      result = await releaseAuthoritativeProviderFailure({ providerBillingRecordId: record.id, generationJobId: record.generation_job_id, metadata: { attempt_type: "client_poll" } });
    } else if (record.settled) {
      result = await settleProviderBillingRecord({ providerBillingRecordId: record.id, links: { messageId: messageId ?? record.message_id, generationJobId: record.generation_job_id }, metadata: { attempt_type: "client_poll" } });
    } else {
      const taskId = record.provider_task_id ?? record.provider_request_id;
      if (!taskId) return NextResponse.json({ billingStatus: "pending", quoteStatus: quote.status }, { headers: privateNoStoreHeaders });
      result = await settleApimodelsTask({
        quoteId: quote.id,
        taskId,
        providerRequestId: record.provider_request_id,
        providerTaskId: record.provider_task_id,
        source: "records_api",
        links: { messageId: messageId ?? record.message_id, generationJobId: record.generation_job_id },
        metadata: { attempt_type: "client_poll" },
      }) as Record<string, unknown>;
    }
    after(() => runBillingV3ReconciliationPump(3).catch((error) => logServerError("billing-v3-client-poll-pump", error, { userId: user.id, quoteId: quote.id })));
    return NextResponse.json(safeResponse(result, quote.status), { headers: privateNoStoreHeaders });
  } catch (error) {
    logServerError("billing-v3-client-poll", error, { userId: user.id, quoteId: quote.id, providerBillingRecordId: record.id });
    return NextResponse.json({ billingStatus: "pending", quoteStatus: quote.status }, { headers: privateNoStoreHeaders });
  }
}
