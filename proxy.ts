import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { isTrustedMutation } from "@/lib/security/request";

export async function proxy(request: NextRequest) {
  const isApi = request.nextUrl.pathname.startsWith("/api/");
  const isProviderCallback = request.nextUrl.pathname.startsWith("/api/provider-callback/");
  if (isApi && !isProviderCallback && !isTrustedMutation(request)) {
    return NextResponse.json({ error: "Cross-site request rejected." }, { status: 403 });
  }

  const response = await updateSession(request);
  if (isApi) {
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.set("Pragma", "no-cache");
  }
  return response;
}

export const config = {
  // Keep Next.js internals, including the HMR websocket endpoint, out of the auth proxy.
  matcher: ["/((?!_next|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};
