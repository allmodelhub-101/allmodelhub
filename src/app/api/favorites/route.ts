import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ kind: z.enum(["job", "file"]), id: z.string().uuid() });

async function userId() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user?.id;
}

export async function GET() {
  const id = await userId();
  if (!id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const { data, error } = await admin.from("asset_favorites").select("job_id,file_id").eq("user_id", id);
  if (error) return NextResponse.json({ error: "Could not load favorites." }, { status: 500 });
  return NextResponse.json({ jobIds: (data || []).flatMap((row) => row.job_id ? [row.job_id] : []), fileIds: (data || []).flatMap((row) => row.file_id ? [row.file_id] : []) });
}

export async function POST(request: Request) {
  const id = await userId();
  if (!id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid favorite." }, { status: 400 });
  const admin = createAdminClient();
  const table = parsed.data.kind === "job" ? "generation_jobs" : "user_files";
  const { data: owned } = await admin.from(table).select("id").eq("id", parsed.data.id).eq("user_id", id).maybeSingle();
  if (!owned) return NextResponse.json({ error: "Asset is unavailable." }, { status: 404 });
  const source = parsed.data.kind === "job" ? { job_id: parsed.data.id } : { file_id: parsed.data.id };
  const { error } = await admin.from("asset_favorites").upsert({ user_id: id, ...source }, { onConflict: "user_id,job_id,file_id" });
  if (error) return NextResponse.json({ error: "Could not save favorite." }, { status: 500 });
  return NextResponse.json({ favorite: true });
}

export async function DELETE(request: Request) {
  const id = await userId();
  if (!id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid favorite." }, { status: 400 });
  const admin = createAdminClient();
  const column = parsed.data.kind === "job" ? "job_id" : "file_id";
  const { error } = await admin.from("asset_favorites").delete().eq("user_id", id).eq(column, parsed.data.id);
  if (error) return NextResponse.json({ error: "Could not remove favorite." }, { status: 500 });
  return NextResponse.json({ favorite: false });
}

