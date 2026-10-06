import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export async function providerInputUrl(userId: string, fileId: string, bytes: Uint8Array, mimeType: string) {
  const contentHash = createHash("sha256").update(bytes).digest("hex");
  if (!/^[a-f0-9]{64}$/.test(contentHash)) throw new Error("MEDIA_FILE_INVALID");
  const app = process.env.NEXT_PUBLIC_APP_URL;
  if (!app || !app.startsWith("https://")) throw new Error("MEDIA_PROVIDER_INPUT_URL_UNAVAILABLE");
  const admin = createAdminClient();
  const token = randomBytes(32).toString("hex");
  const storagePath = `${randomBytes(32).toString("hex")}.${mimeType === "video/mp4" ? "mp4" : mimeType === "audio/wav" ? "wav" : "mp3"}`;
  const { error: uploadError } = await admin.storage.from("provider-inputs").upload(storagePath, bytes, { contentType: mimeType, upsert: false });
  if (uploadError) throw uploadError;
  const { error } = await admin.from("provider_input_assets").insert({
    token_hash: createHash("sha256").update(token).digest("hex"),
    user_id: userId, file_id: fileId,
    content_sha256: contentHash,
    storage_path: storagePath, mime_type: mimeType, size_bytes: bytes.length,
    expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
  });
  if (error) { await admin.storage.from("provider-inputs").remove([storagePath]); throw error; }
  return `${app.replace(/\/+$/, "")}/api/provider-assets/${token}`;
}

