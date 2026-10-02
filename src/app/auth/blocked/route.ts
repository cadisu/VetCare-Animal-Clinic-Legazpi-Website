import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * Signs out a user who may not use the application (inactive account or missing
 * profile) and sends them to the login page with an explanation.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const reason = searchParams.get("reason") === "inactive" ? "inactive" : "no-profile";

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(`${origin}/login?error=${reason}`);
}
