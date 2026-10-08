import type { Metadata } from "next";
import { clinic } from "@/config/clinic";
import { ContactDetails } from "@/components/public/ContactDetails";
import { PageHeader } from "@/components/public/PageHeader";
import { ClockIcon } from "@/components/ui/icons";

export const metadata: Metadata = { title: "About Us" };

export default function AboutPage() {
  return (
    <>
      <PageHeader title="About Us" description={clinic.about.summary} />
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-2">
          <div className="space-y-10">
            <div>
              <h2 className="text-2xl font-bold">Our Story</h2>
              <p className="mt-4 text-lg text-slate-600">{clinic.about.story}</p>
            </div>
            <div>
              <h2 className="text-2xl font-bold">Our Mission</h2>
              <p className="mt-4 text-lg text-slate-600">{clinic.about.mission}</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 p-6 sm:p-8">
              <h2 className="flex items-center gap-3 text-xl font-bold">
                <ClockIcon className="h-6 w-6 text-brand" /> Clinic Hours
              </h2>
              <dl className="mt-4 divide-y divide-slate-100">
                {clinic.hours.map((row) => (
                  <div key={row.days} className="flex justify-between gap-4 py-3">
                    <dt className="font-medium text-slate-800">{row.days}</dt>
                    <dd className="text-right text-slate-600">{row.time}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="rounded-2xl border border-slate-200 p-6 sm:p-8">
              <h2 className="text-xl font-bold">Visit or contact us</h2>
              <ContactDetails className="mt-4 space-y-4" />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
