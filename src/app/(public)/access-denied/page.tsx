import type { Metadata } from "next";
import Link from "next/link";
import { buttonClass } from "@/components/ui/button-styles";
import { getSession } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/auth/roles";

export const metadata: Metadata = { title: "Access Denied" };

export default async function AccessDeniedPage() {
  const session = await getSession().catch(() => null);
  const profile = session?.profile;
  const home = profile && profile.status === "ACTIVE" ? ROLE_HOME[profile.role] : null;

  return (
    <section className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
      <p className="text-sm font-semibold uppercase tracking-wider text-accent">Access denied</p>
      <h1 className="mt-3 text-3xl font-bold">You can&apos;t open that page</h1>
      <p className="mt-4 text-lg text-slate-600">
        Your account does not have permission to access this information.
      </p>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        {home ? (
          <Link href={home} className={buttonClass("primary", "lg")}>
            Back to my dashboard
          </Link>
        ) : (
          <Link href="/login" className={buttonClass("primary", "lg")}>
            Login
          </Link>
        )}
        <Link href="/" className={buttonClass("outline", "lg")}>
          Go to homepage
        </Link>
      </div>
    </section>
  );
}
