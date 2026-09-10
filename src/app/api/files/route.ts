import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enforceRateLimit } from "@/lib/rate-limit";
import { extractText } from "@/lib/file-extract";
import { logServerError } from "@/lib/public-error";

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
  if (error) { logServerError("files-list", error, { userId: data.user.id }); return NextResponse.json({ error: "Could not load files." }, { status: 500 }); }

  return NextResponse.json({
    files: (files ?? []).map((file) => { const safeFile = { ...file }; delete safeFile.storage_path; return safeFile; })
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

  const extension = file.name.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  const allowedExtensions = new Set(["pdf", "docx", "txt", "md", "csv", "xlsx", "xls", "json", "xml", "png", "jpg", "jpeg", "webp", "gif", "js", "jsx", "ts", "tsx", "py", "php", "css", "html"]);
  if (!extension || !allowedExtensions.has(extension)) return NextResponse.json({ error: "Unsupported file type." }, { status: 400 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const textExtensions = new Set(["txt", "md", "csv", "json", "xml", "js", "jsx", "ts", "tsx", "py", "php", "css", "html"]);
  const signature = new TextDecoder().decode(bytes.slice(0, 16));
  const startsWith = (...values: number[][]) => values.some((value) => value.every((byte, index) => bytes[index] === byte));
  const zipContainer = startsWith([0x50, 0x4b, 0x03, 0x04], [0x50, 0x4b, 0x05, 0x06], [0x50, 0x4b, 0x07, 0x08]);
  const oleContainer = startsWith([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  const validBinary = extension === "pdf" ? signature.startsWith("%PDF-")
    : extension === "png" ? startsWith([137, 80, 78, 71, 13, 10, 26, 10])
    : extension === "jpg" || extension === "jpeg" ? startsWith([0xff, 0xd8, 0xff])
    : extension === "gif" ? signature.startsWith("GIF87a") || signature.startsWith("GIF89a")
    : extension === "webp" ? signature.slice(0, 4) === "RIFF" && signature.slice(8, 12) === "WEBP"
    : extension === "docx" || extension === "xlsx" ? zipContainer
    : extension === "xls" ? oleContainer
    : textExtensions.has(extension) ? !bytes.slice(0, 4096).some((byte) => byte === 0)
    : false;
  if (!validBinary || (textExtensions.has(extension) && !String(file.type).startsWith("text/") && file.type !== "application/json" && file.type !== "application/xml")) return NextResponse.json({ error: "File contents do not match the selected type." }, { status: 400 });

  const admin = createAdminClient();
  if (projectId) {
    const { data: project } = await admin.from("projects").select("id").eq("id", projectId).eq("user_id", user.id).maybeSingle();
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-140);
  const path = `${user.id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName}`;
  const { error: uploadError } = await admin.storage.from("user-files").upload(path, bytes, {
    contentType: file.type || "application/octet-stream",
    upsert: false
  });
  if (uploadError) { logServerError("file-upload", uploadError, { userId: user.id }); return NextResponse.json({ error: "Could not upload file." }, { status: 500 }); }

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
    logServerError("file-record-create", dbError, { userId: user.id });
    return NextResponse.json({ error: "Could not save file." }, { status: 500 });
  }

  return NextResponse.json({ file: record }, { status: 201 });
}
