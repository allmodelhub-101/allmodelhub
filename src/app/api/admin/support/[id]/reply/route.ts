import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/notifications";
import { logServerError } from "@/lib/public-error";

const schema = z.object({ message: z.string().min(1).max(5000), status: z.enum(["open", "waiting_user", "in_review", "resolved", "closed"]).default("waiting_user") });
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const adminUser = await requireAdmin(); const { id } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Invalid reply" }, { status: 400 });
  const admin = createAdminClient(); const { data: ticket } = await admin.from("support_tickets").select("user_id,public_id").eq("id", id).maybeSingle();
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  const { data: message, error } = await admin.from("ticket_messages").insert({ ticket_id: id, user_id: adminUser.id, author_role: "admin", body: parsed.data.message }).select("*").single();
  if (error) { logServerError("admin-support-reply", error, { adminUserId: adminUser.id, ticketId: id }); return NextResponse.json({ error: "Could not send support reply." }, { status: 500 }); }
  await admin.from("support_tickets").update({ status: parsed.data.status, updated_at: new Date().toISOString() }).eq("id", id);
  await admin.from("audit_logs").insert({ actor_user_id: adminUser.id, action: "support.replied", entity_type: "support_ticket", entity_id: id });
  await notifyUser(ticket.user_id, { type: "support", title: "Support replied", body: `There is a new reply on ${ticket.public_id}.`, href: "/support" });
  return NextResponse.json({ message });
}
