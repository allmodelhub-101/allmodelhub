import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { signedFileUrl } from "@/lib/file-extract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const { data: file } = await admin.from("user_files").select("*").eq("id", id).eq("user_id", data.user.id).maybeSingle();
  if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 });
  const url = await signedFileUrl(admin, file.storage_path);
  return NextResponse.json({ file: { ...file, storage_path: undefined, extracted_text: undefined, url } });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const { data: file } = await admin.from("user_files").select("storage_path").eq("id", id).eq("user_id", data.user.id).maybeSingle();
  if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 });
  await admin.storage.from("user-files").remove([file.storage_path]);
  await admin.from("user_files").delete().eq("id", id).eq("user_id", data.user.id);
  return NextResponse.json({ ok: true });
}
