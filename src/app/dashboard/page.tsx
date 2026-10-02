import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/auth/roles";

/** Generic entry point (used after email confirmation): sends users to their own dashboard. */
export default async function DashboardRedirectPage() {
  const session = await getSession().catch(() => null);
  if (!session) redirect("/login");
  if (!session.profile) redirect("/auth/blocked?reason=no-profile");
  if (session.profile.status !== "ACTIVE") redirect("/auth/blocked?reason=inactive");
  redirect(ROLE_HOME[session.profile.role]);
}
