import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicId } from "@/lib/security/ids";
import { logServerError } from "@/lib/public-error";

export const dynamic = "force-dynamic";
const schema = z.object({
  category: z.enum(["payment", "wallet", "generation", "account", "technical", "refund", "other"]),
  subject: z.string().min(3).max(120),
  message: z.string().min(10).max(5000),
  relatedReference: z.string().max(120).optional()
});

export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const { data: tickets, error } = await admin.from("support_tickets").select("*").eq("user_id", data.user.id).order("created_at", { ascending: false }).limit(50);
  if (error) { logServerError("support-list", error, { userId: data.user.id }); return NextResponse.json({ error: "Could not load support tickets." }, { status: 500 }); }
  return NextResponse.json({ tickets: tickets ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid ticket", details: parsed.error.flatten() }, { status: 400 });
  const admin = createAdminClient();
  const { data: ticket, error } = await admin.from("support_tickets").insert({
    public_id: createPublicId("AMH-TKT"), user_id: data.user.id, category: parsed.data.category,
    subject: parsed.data.subject, message: parsed.data.message, related_reference: parsed.data.relatedReference
  }).select("*").single();
  if (error) { logServerError("support-create", error, { userId: data.user.id }); return NextResponse.json({ error: "Could not create support ticket." }, { status: 500 }); }
  await admin.from("ticket_messages").insert({ ticket_id: ticket.id, user_id: data.user.id, author_role: "user", body: parsed.data.message });
  return NextResponse.json({ ticket }, { status: 201 });
}
