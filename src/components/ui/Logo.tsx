import Link from "next/link";
import { clinic } from "@/config/clinic";
import { PawIcon } from "./icons";

/** PLACEHOLDER logo: a paw mark + clinic name. Swap for the real logo later. */
export function Logo({ href = "/", light = false }: { href?: string; light?: boolean }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5" aria-label={`${clinic.name} home`}>
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-xl ${
          light ? "bg-white text-brand" : "bg-brand text-white"
        }`}
      >
        <PawIcon className="h-6 w-6" />
      </span>
      <span className={`text-lg font-bold tracking-tight ${light ? "text-white" : "text-slate-900"}`}>
        {clinic.shortName}
        <span className={light ? "text-white/70" : "text-brand"}> Vet Clinic</span>
      </span>
    </Link>
  );
}
