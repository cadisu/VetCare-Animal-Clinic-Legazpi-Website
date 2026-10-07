import type { Metadata } from "next";
import Link from "next/link";
import { ServiceCard } from "@/components/public/ServiceCard";
import { PageHeader } from "@/components/public/PageHeader";
import { buttonClass } from "@/components/ui/button-styles";
import { listBookableServices } from "@/lib/appointments/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Services" };

export default async function ServicesPage() {
  const supabase = await createClient();
  const services = await listBookableServices(supabase);

  return (
    <>
      <PageHeader
        title="Our Services"
        description="These are the services you can book for an appointment."
      />
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
        {services.length === 0 ? (
          <p className="text-center text-slate-600">Services will be listed here soon.</p>
        ) : (
          <ul className="grid gap-6 md:grid-cols-2">
            {services.map((service) => (
              <li key={service.id}>
                <ServiceCard name={service.name} description={service.description} headingLevel="h2" />
              </li>
            ))}
          </ul>
        )}
        <div className="mt-12 text-center">
          <Link href="/book-appointment" className={buttonClass("secondary", "lg")}>
            Book an Appointment
          </Link>
        </div>
      </section>
    </>
  );
}
