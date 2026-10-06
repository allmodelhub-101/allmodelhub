import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getStorageQuota } from "@/lib/storage-quota";
import { inspectMediaBytes } from "@/lib/media-metadata";
import { logServerError } from "@/lib/public-error";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const input = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), name: z.string().min(1).max(255), size: z.number().int().positive().max(52428800), projectId: z.string().uuid().optional() }),
  z.object({ action: z.literal("complete"), sessionId: z.string().uuid() }),
]);
const safeFile = (file: Record<string, unknown>) => ({ id: file.id, project_id: file.project_id, name: file.name,
  mime_type: file.mime_type, size_bytes: file.size_bytes, media_metadata: file.media_metadata,
  extraction_status: file.extraction_status, created_at: file.created_at });

export async function POST(request: Request) {
  const user = (await (await createClient()).auth.getUser()).data.user;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid MP4, WAV, or MP3 within your storage allowance." }, { status: 400 });
  const limit = await enforceRateLimit(`media-upload:${user.id}`, parsed.data.action === "start" ? "files" : "standard");
  if (!limit.success) return NextResponse.json({ error: "Upload protection is temporarily unavailable. Try again shortly." }, { status: limit.unavailable ? 503 : 429 });
  const admin = createAdminClient();
  try {
    if (parsed.data.action === "start") {
      const { name, size, projectId } = parsed.data;
      const extension = name.match(/\.(mp4|wav|mp3)$/i)?.[1].toLowerCase();
      if (!extension) return NextResponse.json({ error: "Use MP4, WAV, or MP3 media." }, { status: 400 });
      const quota = await getStorageQuota(admin, user.id);
      if (size > quota.maxFileBytes || size > quota.remainingBytes) return NextResponse.json({ error: "This file exceeds your available storage allowance." }, { status: 413 });
      if (projectId) {
        const { data: project } = await admin.from("projects").select("id").eq("id", projectId).eq("user_id", user.id).maybeSingle();
        if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
      }
      const { data: reservation, error } = await admin.rpc("reserve_file_upload", { p_user_id: user.id, p_size_bytes: size, p_limit_bytes: quota.limitBytes });
      if (error || !reservation) throw error || new Error("STORAGE_RESERVATION_UNAVAILABLE");
      const id = randomUUID(), path = `${id}.${extension}`;
      const mimeType = extension === "mp4" ? "video/mp4" : extension === "wav" ? "audio/wav" : "audio/mpeg";
      const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-140);
      try {
        const { error: sessionError } = await admin.from("media_upload_sessions").insert({ id, user_id: user.id,
          project_id: projectId || null, reservation_id: reservation, storage_path: path,
          destination_path: `${user.id}/${id}-${safeName}`, name: safeName, mime_type: mimeType, size_bytes: size });
        if (sessionError) throw sessionError;
        const { data, error: signedError } = await admin.storage.from("media-uploads").createSignedUploadUrl(path, { upsert: false });
        if (signedError || !data) throw signedError || new Error("MEDIA_UPLOAD_UNAVAILABLE");
        return NextResponse.json({ id, path, token: data.token, mimeType }, { headers: { "Cache-Control": "private, no-store" } });
      } catch (error) {
        await admin.rpc("release_file_upload_reservation", { p_reservation_id: reservation, p_user_id: user.id });
        throw error;
      }
    }
    const { data: session, error: sessionError } = await admin.from("media_upload_sessions").select("*")
      .eq("id", parsed.data.sessionId).eq("user_id", user.id).maybeSingle();
    if (sessionError) throw sessionError;
    if (!session) return NextResponse.json({ error: "Upload not found." }, { status: 404 });
    if (session.completed_at) {
      const { data: file } = await admin.from("user_files").select("*").eq("id", session.id).eq("user_id", user.id).maybeSingle();
      return file ? NextResponse.json({ file: safeFile(file) }) : NextResponse.json({ error: "Uploaded file was removed." }, { status: 404 });
    }
    if (new Date(session.expires_at).getTime() <= Date.now()) return NextResponse.json({ error: "Upload expired. Please upload again." }, { status: 410 });
    const { data: source, error: downloadError } = await admin.storage.from("media-uploads").download(session.storage_path);
    if (downloadError || !source) throw downloadError || new Error("MEDIA_UPLOAD_NOT_FOUND");
    if (source.size !== Number(session.size_bytes)) return NextResponse.json({ error: "Uploaded size does not match the reserved file." }, { status: 400 });
    const bytes = new Uint8Array(await source.arrayBuffer());
    const metadata = inspectMediaBytes(bytes, session.mime_type);
    const { error: saveError } = await admin.storage.from("user-files").upload(session.destination_path, bytes, { contentType: session.mime_type, upsert: false });
    if (saveError) {
      // A concurrent/retried finalization may already have saved this exact,
      // server-generated path. It cannot be overwritten by browser clients.
      const { data: saved } = await admin.storage.from("user-files").download(session.destination_path);
      if (!saved || saved.size !== bytes.length || !Buffer.from(await saved.arrayBuffer()).equals(Buffer.from(bytes))) throw saveError;
    }
    const { data: file, error: finalizeError } = await admin.rpc("finalize_media_upload", { p_session_id: session.id, p_user_id: user.id, p_metadata: metadata });
    if (finalizeError || !file) throw finalizeError || new Error("MEDIA_UPLOAD_FINALIZATION_FAILED");
    return NextResponse.json({ file: safeFile(file), quota: await getStorageQuota(admin, user.id) }, { status: 201 });
  } catch (error) {
    logServerError("media-upload", error, { userId: user.id });
    const invalid = error instanceof Error && /^MEDIA_(FILE_INVALID|DURATION_UNAVAILABLE)/.test(error.message);
    const overQuota = String((error as { message?: string })?.message).includes("STORAGE_QUOTA_EXCEEDED");
    return NextResponse.json({ error: invalid ? "Use valid media with a readable duration." : overQuota ? "Not enough storage available." : "Could not complete media upload. Try again." }, { status: invalid ? 400 : overQuota ? 413 : 503 });
  }
}

