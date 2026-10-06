import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Immutable service-owned copies preserve the inspected source. Redirecting
// keeps large media and range responses outside Vercel's function body limit.
export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  if (!/^[a-f0-9]{64}$/.test(token)) return new Response(null, { status: 404 });
  const admin = createAdminClient();
  const { data: asset, error } = await admin.from("provider_input_assets").select("storage_path")
    .eq("token_hash", createHash("sha256").update(token).digest("hex"))
    .gt("expires_at", new Date().toISOString()).maybeSingle();
  if (error) return new Response(null, { status: 503 });
  if (!asset) return new Response(null, { status: 404 });
  const { data, error: signedError } = await admin.storage.from("provider-inputs").createSignedUrl(asset.storage_path, 300);
  if (signedError || !data) return new Response(null, { status: 503 });
  const response = NextResponse.redirect(data.signedUrl, 307);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

