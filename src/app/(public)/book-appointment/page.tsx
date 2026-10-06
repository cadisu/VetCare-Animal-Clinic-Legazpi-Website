import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/public/PageHeader";
import { buttonClass } from "@/components/ui/button-styles";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Book an Appointment" };

export default async function BookAppointmentPage() {
  const session = await getSession().catch(() => null);
  const profile = session?.profile;

  if (profile?.status === "ACTIVE" && profile.role === "CLIENT") {
    redirect("/client/appointments/new");
  }

  return (
    <>
      <PageHeader
        title="Book an Appointment"
        description="Schedule your pet's visit from home, at a time that suits you."
      />
      <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
        <div className="rounded-2xl border border-slate-200 p-6 sm:p-8">
          <h2 className="text-xl font-bold">Sign in to book</h2>
          <p className="mt-3 text-slate-600">
            Online booking is available for registered pet owners. Log in or create an account, then
            choose a service, date, time and pet.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/login?next=%2Fclient%2Fappointments%2Fnew"
              className={buttonClass("primary", "lg")}
            >
              Login to book
            </Link>
            <Link href="/register" className={buttonClass("outline", "lg")}>
              Create Account
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
