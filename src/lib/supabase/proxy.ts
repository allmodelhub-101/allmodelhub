import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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
    const login = request.nextUrl.clone();
    login.pathname = "/auth/login";
    login.searchParams.set("next", path);
    return NextResponse.redirect(login);
  }

  if (user && path === "/auth/login") {
    const next = request.nextUrl.searchParams.get("next") || "/chat";
    return NextResponse.redirect(new URL(next, request.url));
  }

  return response;
}
