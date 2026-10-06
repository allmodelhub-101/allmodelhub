"use client";
import { createClient } from "@/lib/supabase/client";

export async function uploadStudioMedia(file: File, projectId: string | undefined, kind: "image" | "video" | "audio") {
  if (kind === "image") {
    const form = new FormData(); form.set("file", file);
    if (projectId) form.set("projectId", projectId);
    const response = await fetch("/api/files", { method: "POST", body: form });
    const data = await response.json();
    if (!response.ok || !data.file?.id) throw new Error(data.error || "Reference upload failed.");
    return data;
  }
  const start = await fetch("/api/files/media", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "start", name: file.name, size: file.size, projectId }) });
  const session = await start.json();
  if (!start.ok) throw new Error(session.error || "Could not reserve media upload.");
  const { error } = await createClient().storage.from("media-uploads")
    .uploadToSignedUrl(session.path, session.token, file, { contentType: session.mimeType });
  if (error) throw new Error("Media upload failed. Try again.");
  const complete = await fetch("/api/files/media", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "complete", sessionId: session.id }) });
  const data = await complete.json();
  if (!complete.ok || !data.file?.id) throw new Error(data.error || "Could not verify uploaded media.");
  return data;
}

