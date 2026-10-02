import type { Metadata } from "next";
import Link from "next/link";
import { services } from "@/config/clinic";
import { PageHeader } from "@/components/public/PageHeader";
import { buttonClass } from "@/components/ui/button-styles";
import { PawIcon } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Services" };

export default function ServicesPage() {
  return (
    <>
      <PageHeader
        title="Our Services"
        description="Complete, compassionate care for your pets. (Placeholder services; these will be managed by the clinic later.)"
      />
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
        <ul className="grid gap-6 md:grid-cols-2">
          {services.map((service) => (
            <li
              key={service.name}
              className="flex gap-5 rounded-2xl border border-slate-200 bg-white p-6"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                <PawIcon className="h-6 w-6" />
              </span>
              <div>
                <h2 className="text-lg font-semibold">{service.name}</h2>
                <p className="mt-2 text-slate-600">{service.details}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-12 text-center">
          <Link href="/book-appointment" className={buttonClass("secondary", "lg")}>
            Book an Appointment
          </Link>
        </div>
      </section>
    </>
  );
}
