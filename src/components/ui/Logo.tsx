import Link from "next/link";
import { clinic } from "@/config/clinic";

/** Clinic mark. The JPG has a white background so it sits on the light header. */
export function Logo({ href = "/", light = false }: { href?: string; light?: boolean }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5" aria-label={`${clinic.name} home`}>
      <img
        src="/VetCare_Logo.jpg"
        alt=""
        className="h-12 w-12 rounded-xl bg-white object-contain"
      />
      <span className="flex flex-col leading-tight">
        <span className={`text-lg font-bold tracking-tight ${light ? "text-white" : "text-slate-900"}`}>
          {clinic.shortName}
          <span className={light ? "text-white/80" : "text-brand"}> Animal Clinic - Legazpi</span>
        </span>
        <span className={`text-xs font-semibold ${light ? "text-white/80" : "text-brand"}`}>
          Where Caring Means More
        </span>
      </span>
    </Link>
  );
}
