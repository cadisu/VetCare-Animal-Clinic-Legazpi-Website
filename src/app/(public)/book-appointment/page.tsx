import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/public/PageHeader";
import { buttonClass } from "@/components/ui/button-styles";
import { getSession } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/auth/roles";

export const metadata: Metadata = { title: "Book an Appointment" };

const steps = [
  "Select a service",
  "Choose an available date",
  "Choose an available time",
  "Select your pet and confirm",
];

export default async function BookAppointmentPage() {
  const session = await getSession().catch(() => null);
  const profile = session?.profile;
  const loggedInHome = profile && profile.status === "ACTIVE" ? ROLE_HOME[profile.role] : null;

  return (
    <>
      <PageHeader
        title="Book an Appointment"
        description="Schedule your pet's visit from home, at a time that suits you."
      />
      <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
        {/* PLACEHOLDER: real online booking is implemented in a later phase. */}
        <div className="rounded-2xl border border-slate-200 p-6 sm:p-8">
          <h2 className="text-xl font-bold">Online booking is coming soon</h2>
          <p className="mt-3 text-slate-600">
            You&apos;ll soon be able to book here in a few simple steps. To get ready, create your
            account and you&apos;ll be able to book as soon as it opens.
          </p>

          <ol className="mt-6 space-y-3">
            {steps.map((step, index) => (
              <li key={step} className="flex items-center gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {loggedInHome ? (
              <Link href={loggedInHome} className={buttonClass("primary", "lg")}>
                Go to my dashboard
              </Link>
            ) : (
              <>
                <Link href="/register" className={buttonClass("primary", "lg")}>
                  Create Account
                </Link>
                <Link href="/login" className={buttonClass("outline", "lg")}>
                  Login
                </Link>
              </>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
