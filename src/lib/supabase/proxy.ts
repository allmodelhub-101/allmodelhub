import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { safeAuthenticatedPath } from "@/lib/security/request";

function redirectWithCookies(destination: URL, response: NextResponse) {
  const redirect = NextResponse.redirect(destination);
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      }
    }
  });

  const { data } = await supabase.auth.getUser();
  const user = data.user;
  const path = request.nextUrl.pathname;

  const protectedPrefixes = ["/chat", "/wallet", "/images", "/video", "/audio", "/projects", "/files", "/models", "/settings", "/admin", "/history", "/battle", "/usage", "/notifications", "/templates", "/support"];
  const protectedPath = protectedPrefixes.some((prefix) => path.startsWith(prefix));
  if (protectedPath && !user) {
    const login = new URL("/auth/login", request.url);
    login.searchParams.set("next", `${path}${request.nextUrl.search}`);
    return redirectWithCookies(login, response);
  }

  if (user && (path === "/auth/login" || path === "/auth/signup")) {
    const next = safeAuthenticatedPath(request.nextUrl.searchParams.get("next"));
    return redirectWithCookies(new URL(next, request.url), response);
  }

  return response;
}
