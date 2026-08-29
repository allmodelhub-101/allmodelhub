import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
const messageSchema = z.object({ message: z.string().min(1).max(5000) });

async function ownedTicket(id: string, userId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("support_tickets").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
  return data;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ticket = await ownedTicket(id, data.user.id);
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  const admin = createAdminClient();
  const { data: messages } = await admin.from("ticket_messages").select("*").eq("ticket_id", id).order("created_at");
  return NextResponse.json({ ticket, messages: messages ?? [] });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = messageSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid message" }, { status: 400 });
  const ticket = await ownedTicket(id, data.user.id);
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  const admin = createAdminClient();
  const { data: message, error } = await admin.from("ticket_messages").insert({ ticket_id: id, user_id: data.user.id, author_role: "user", body: parsed.data.message }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await admin.from("support_tickets").update({ status: "open", updated_at: new Date().toISOString() }).eq("id", id);
  return NextResponse.json({ message }, { status: 201 });
}
