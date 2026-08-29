import { createAdminClient } from "@/lib/supabase/admin";

const MAX_BYTES = 250 * 1024 * 1024;

function extension(contentType: string | null, url: string) {
  if (contentType?.includes("image/png")) return "png";
  if (contentType?.includes("image/webp")) return "webp";
  if (contentType?.includes("image/jpeg")) return "jpg";
  if (contentType?.includes("video/mp4")) return "mp4";
  if (contentType?.includes("audio/mpeg")) return "mp3";
  if (contentType?.includes("audio/wav")) return "wav";
  const match = url.match(/\.([a-zA-Z0-9]{2,5})(?:\?|$)/); return match?.[1]?.toLowerCase() || "bin";
}

export async function persistGeneratedAssets(userId: string, jobId: string, urls: string[]) {
  const admin = createAdminClient();
  const paths: string[] = [];
  for (let i = 0; i < Math.min(urls.length, 8); i += 1) {
    try {
      const response = await fetch(urls[i], { signal: AbortSignal.timeout(60_000) });
      if (!response.ok) continue;
      const length = Number(response.headers.get("content-length") || 0);
      if (length > MAX_BYTES) continue;
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > MAX_BYTES) continue;
      const path = `${userId}/${jobId}/${i}.${extension(response.headers.get("content-type"), urls[i])}`;
      const { error } = await admin.storage.from("generated-assets").upload(path, bytes, { contentType: response.headers.get("content-type") || "application/octet-stream", upsert: true });
      if (!error) paths.push(path);
    } catch { /* provider URL may be temporarily unavailable; keep original URL fallback */ }
  }
  return paths;
}

export async function signGeneratedPaths(paths: string[]) {
  if (!paths.length) return [];
  const admin = createAdminClient();
  const { data } = await admin.storage.from("generated-assets").createSignedUrls(paths, 3600);
  return (data ?? []).map((item) => item.signedUrl).filter(Boolean) as string[];
}
