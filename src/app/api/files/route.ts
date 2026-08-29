import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enforceRateLimit } from "@/lib/rate-limit";
import { extractText, signedFileUrl } from "@/lib/file-extract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = new URL(request.url).searchParams.get("projectId");
  const admin = createAdminClient();
  let query = admin.from("user_files")
    .select("id,project_id,name,mime_type,size_bytes,extraction_status,created_at,storage_path")
    .eq("user_id", data.user.id)
    .order("created_at", { ascending: false })
    .limit(200);
  if (projectId) query = query.eq("project_id", projectId);
  const { data: files, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    files: (files ?? []).map(({ storage_path: _path, ...file }) => file)
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limit = await enforceRateLimit(`files:${user.id}`);
  if (!limit.success) return NextResponse.json({ error: "Too many uploads. Try again shortly." }, { status: 429 });

  const form = await request.formData();
  const file = form.get("file");
  const projectId = String(form.get("projectId") || "").trim() || null;
  if (!(file instanceof File) || file.size < 1 || file.size > 50 * 1024 * 1024) {
    return NextResponse.json({ error: "File must be between 1 byte and 50 MB." }, { status: 400 });
  }

  const allowedExtension = /\.(pdf|docx|txt|md|csv|xlsx|xls|json|xml|png|jpe?g|webp|gif|js|jsx|ts|tsx|py|php|css|html)$/i;
  if (!allowedExtension.test(file.name)) {
    return NextResponse.json({ error: "Unsupported file type." }, { status: 400 });
  }

  const admin = createAdminClient();
  if (projectId) {
    const { data: project } = await admin.from("projects").select("id").eq("id", projectId).eq("user_id", user.id).maybeSingle();
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-140);
  const path = `${user.id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: uploadError } = await admin.storage.from("user-files").upload(path, bytes, {
    contentType: file.type || "application/octet-stream",
    upsert: false
  });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const extraction = await extractText(file);
  const { data: record, error: dbError } = await admin.from("user_files").insert({
    user_id: user.id,
    project_id: projectId,
    storage_path: path,
    name: safeName,
    mime_type: file.type || "application/octet-stream",
    size_bytes: file.size,
    extracted_text: extraction.text,
    extraction_status: extraction.status
  }).select("id,project_id,name,mime_type,size_bytes,extraction_status,created_at").single();

  if (dbError) {
    await admin.storage.from("user-files").remove([path]).catch(() => undefined);
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ file: record }, { status: 201 });
}
