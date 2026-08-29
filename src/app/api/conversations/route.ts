import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const q = url.searchParams.get("q")?.trim();
  const admin = createAdminClient();

  if (id) {
    const { data: conversation } = await admin.from("conversations").select("*").eq("id", id).eq("user_id", data.user.id).maybeSingle();
    if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const { data: messages } = await admin.from("messages")
      .select("id,role,content,model_id,provider_key,input_tokens,output_tokens,credits_charged,created_at,parent_message_id")
      .eq("conversation_id", id).eq("user_id", data.user.id).order("created_at");
    return NextResponse.json({ conversation, messages: messages ?? [] });
  }

  let query = admin.from("conversations").select("id,title,mode,preferred_model,pinned,private,project_id,updated_at")
    .eq("user_id", data.user.id).eq("archived", false).eq("private", false)
    .order("pinned", { ascending: false }).order("updated_at", { ascending: false }).limit(100);
  if (q) query = query.ilike("title", `%${q.replace(/[%_]/g, "")}%`);
  const { data: conversations, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ conversations: conversations ?? [] });
}
