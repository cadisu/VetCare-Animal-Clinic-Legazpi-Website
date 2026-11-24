import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isSafeRedirectPath } from "@/lib/auth/roles";

/**
 * Landing point for links in Supabase emails (signup confirmation, password recovery).
 * Supports both the PKCE `code` flow and the `token_hash` flow.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextParam = searchParams.get("next");
  const next = isSafeRedirectPath(nextParam) ? nextParam : "/dashboard";

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(`${origin}/login?error=config`);
  }

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return redirectAfterSession(supabase, origin, next);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return redirectAfterSession(supabase, origin, next);
  }

  return NextResponse.redirect(`${origin}/login?error=link-invalid`);
}

async function redirectAfterSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  origin: string,
  next: string,
) {
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (userId) {
    const { data: profile } = await supabase.from("profiles").select("status").eq("id", userId).maybeSingle();
    if (profile && profile.status !== "ACTIVE") {
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/login?error=inactive`);
    }
  }
  return NextResponse.redirect(`${origin}${next}`);
}
