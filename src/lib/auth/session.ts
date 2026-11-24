import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isUserRole, type AccountStatus, type UserRole } from "./roles";

export type Profile = {
  id: string;
  /** Derived in the database from first, middle, last name, and suffix (read-only). */
  full_name: string;
  last_name: string;
  first_name: string;
  middle_name: string | null;
  name_suffix: string | null;
  email: string;
  contact_number: string | null;
  address: string | null;
  birthdate: string | null;
  role: UserRole;
  status: AccountStatus;
  onboarded_at: string | null;
  created_at: string;
};

export const PROFILE_COLUMNS =
  "id, full_name, last_name, first_name, middle_name, name_suffix, email, contact_number, address, birthdate, role, status, onboarded_at, created_at";

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
    .select(PROFILE_COLUMNS)
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
