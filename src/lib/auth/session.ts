import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isUserRole, type AccountStatus, type UserRole } from "./roles";

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  contact_number: string | null;
  role: UserRole;
  status: AccountStatus;
};

export type Session = { user: User; profile: Profile | null };

/**
 * Current authenticated user + application profile, or null when signed out
 * (or Supabase is not configured). Uses getUser(), which re-validates the JWT
 * with Supabase Auth. De-duplicated per request via React cache().
 */
export const getSession = cache(async (): Promise<Session | null> => {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, contact_number, role, status")
    .eq("id", user.id)
    .maybeSingle();

  const profile: Profile | null =
    data && isUserRole(data.role) ? (data as Profile) : null;
  return { user, profile };
});

/**
 * Server-side authorization guard for protected pages/layouts.
 * - signed out           -> /login
 * - no profile/inactive  -> sign out + /login (via /auth/blocked)
 * - wrong role           -> /access-denied
 */
export async function requireRole(allowed: readonly UserRole[]): Promise<Profile> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.profile) redirect("/auth/blocked?reason=no-profile");
  if (session.profile.status !== "ACTIVE") redirect("/auth/blocked?reason=inactive");
  if (!allowed.includes(session.profile.role)) redirect("/access-denied");
  return session.profile;
}
