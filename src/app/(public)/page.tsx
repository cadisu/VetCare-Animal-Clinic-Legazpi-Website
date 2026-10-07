import Link from "next/link";
import { clinic, team, whyChooseUs } from "@/config/clinic";
import { ServiceCard } from "@/components/public/ServiceCard";
import { SectionHeading } from "@/components/public/PageHeader";
import { TeamCard } from "@/components/public/TeamCard";
import { buttonClass } from "@/components/ui/button-styles";
import {
  CalendarIcon,
  ClockIcon,
  FolderIcon,
  HeartIcon,
  MailIcon,
  PhoneIcon,
  PinIcon,
  ShieldIcon,
} from "@/components/ui/icons";
import { listBookableServices } from "@/lib/appointments/server";
import { createClient } from "@/lib/supabase/server";

const whyIcons = [HeartIcon, ShieldIcon, CalendarIcon, FolderIcon];

export default async function HomePage() {
  const supabase = await createClient();
  const bookableServices = await listBookableServices(supabase);

  return (
    <>
      {/* Hero */}
      <section className="bg-brand-soft">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-28">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-accent">
              {clinic.name}
            </p>
            <h1 className="mt-3 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              {clinic.tagline}
            </h1>
            <p className="mt-5 max-w-xl text-lg text-slate-600">{clinic.intro}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/book-appointment" className={buttonClass("secondary", "lg")}>
                Book an Appointment
              </Link>
              <Link href="/services" className={buttonClass("outline", "lg")}>
                View Services
              </Link>
            </div>
          </div>

          <div className="relative mx-auto aspect-[4/3] w-full max-w-lg overflow-hidden rounded-3xl">
            <img
              src="/VetCare_GroupPIC_enhance.jpg"
              alt="VetCare veterinary team"
              className="size-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* About preview */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-16">
          <SectionHeading eyebrow="About the Clinic" title="Caring for pets like family" />
          <div>
            <p className="text-lg text-slate-600">{clinic.about.summary}</p>
            <Link href="/about" className={buttonClass("outline", "md", "mt-6")}>
              Learn more about us
            </Link>
          </div>
        </div>
      </section>

      {/* Featured services */}
      <section className="bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <SectionHeading
            center
            eyebrow="Our Services"
            title="Featured Services"
            description="Everything your pet needs, under one roof."
          />
          {bookableServices.length === 0 ? (
            <p className="mt-12 text-center text-slate-600">Services will be listed here soon.</p>
          ) : (
            <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {bookableServices.map((service) => (
                <li key={service.id}>
                  <ServiceCard name={service.name} description={service.description} headingLevel="h3" />
                </li>
              ))}
            </ul>
          )}
          <div className="mt-10 text-center">
            <Link href="/services" className={buttonClass("outline")}>
              See all services
            </Link>
          </div>
        </div>
      </section>

      {/* Why choose us */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <SectionHeading center eyebrow="Why Choose Us" title="A clinic you can trust" />
        <ul className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {whyChooseUs.map((item, index) => {
            const Icon = whyIcons[index % whyIcons.length];
            return (
              <li key={item.title} className="text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-brand">
                  <Icon className="h-7 w-7" />
                </span>
                <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-slate-600">{item.description}</p>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Veterinary team preview */}
      <section className="bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <SectionHeading
            center
            eyebrow="Our People"
            title="Meet Our Veterinary Team"
            description="Friendly, experienced professionals who love animals."
          />
          <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {team.map((member) => (
              <li key={member.name}>
                <TeamCard member={member} />
              </li>
            ))}
          </ul>
          <div className="mt-10 text-center">
            <Link href="/veterinary-team" className={buttonClass("outline")}>
              Meet the whole team
            </Link>
          </div>
        </div>
      </section>

      {/* Clinic hours + contact */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 p-6 sm:p-8">
            <h2 className="flex items-center gap-3 text-xl font-bold">
              <ClockIcon className="h-6 w-6 text-brand" /> Clinic Hours
            </h2>
            <dl className="mt-6 divide-y divide-slate-100">
              {clinic.hours.map((row) => (
                <div key={row.days} className="flex justify-between gap-4 py-3">
                  <dt className="font-medium text-slate-800">{row.days}</dt>
                  <dd className="text-right text-slate-600">{row.time}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="rounded-2xl border border-slate-200 p-6 sm:p-8">
            <h2 className="text-xl font-bold">Contact Information</h2>
            <ul className="mt-6 space-y-4">
              <li className="flex gap-3">
                <PinIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                <span>{clinic.contact.address}</span>
              </li>
              <li className="flex gap-3">
                <PhoneIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                <span>
                  {clinic.contact.phone} / {clinic.contact.mobile}
                </span>
              </li>
              <li className="flex gap-3">
                <MailIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                <span className="break-all">{clinic.contact.email}</span>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
