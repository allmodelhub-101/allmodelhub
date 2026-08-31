import dns from "node:dns/promises";
import net from "node:net";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_BYTES = 250 * 1024 * 1024;
const MAX_REDIRECTS = 3;

function isPrivateAddress(address: string) {
  if (net.isIP(address) === 6) {
    const normalized = address.toLowerCase();
    return normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:");
  }
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return true;
  const [a, b] = octets;
  return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || a === 0;
}

async function assertPublicUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("Only HTTPS asset URLs are allowed");
  if (url.username || url.password) throw new Error("Credentialed URLs are not allowed");
  const addresses = await dns.lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) throw new Error("Private asset destinations are not allowed");
  return url;
}

async function fetchPublicAsset(value: string) {
  let url = await assertPublicUrl(value);
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(60_000) });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get("location");
    if (!location || redirects === MAX_REDIRECTS) throw new Error("Too many asset redirects");
    url = await assertPublicUrl(new URL(location, url).toString());
  }
  throw new Error("Asset fetch failed");
}

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
      const response = await fetchPublicAsset(urls[i]);
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
