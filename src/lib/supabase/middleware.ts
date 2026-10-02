import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getRequiredRoles, isUserRole } from "@/lib/auth/roles";
import { getSupabaseEnv } from "./env";

/**
 * Runs on every request:
 *  1. Refreshes the Supabase session cookies (session persistence).
 *  2. Gatekeeps /client/*, /staff/* and /senior-vet/* by login, account status and role.
 *
 * This is the first line of defence. Every protected page/layout ALSO re-checks
 * on the server (see lib/auth/session.ts), and the database enforces Row Level Security.
 */
export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requiredRoles = getRequiredRoles(pathname);
  const env = getSupabaseEnv();

  if (!env) {
    // App not configured yet: public pages still render, protected ones do not.
    if (requiredRoles) return redirectTo(request, "/login", { error: "config" });
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // getUser() validates the token with Supabase Auth (unlike getSession()).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!requiredRoles) return response;

  if (!user) {
    return withCookies(
      redirectTo(request, "/login", { next: `${pathname}${request.nextUrl.search}` }),
      response,
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    return withCookies(redirectTo(request, "/auth/blocked", { reason: "no-profile" }), response);
  }
  if (profile.status !== "ACTIVE") {
    return withCookies(redirectTo(request, "/auth/blocked", { reason: "inactive" }), response);
  }
  if (!isUserRole(profile.role) || !requiredRoles.includes(profile.role)) {
    return withCookies(redirectTo(request, "/access-denied", {}), response);
  }

  return response;
}

function redirectTo(request: NextRequest, path: string, params: Record<string, string>) {
  const url = request.nextUrl.clone();
  url.pathname = path;
  url.search = "";
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return NextResponse.redirect(url);
}

/** Keep refreshed auth cookies on redirect responses. */
function withCookies(redirect: NextResponse, source: NextResponse) {
  source.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}
