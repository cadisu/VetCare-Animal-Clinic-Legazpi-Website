import { clinic } from "@/config/clinic";
import { MailIcon, PhoneIcon, PinIcon } from "@/components/ui/icons";

const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clinic.contact.address)}`;
const phoneHref = `tel:${clinic.contact.phone.replace(/\s/g, "")}`;

export function ContactDetails({
  variant = "page",
  className,
}: {
  variant?: "page" | "footer";
  className?: string;
}) {
  const iconClass =
    variant === "footer" ? "mt-0.5 h-5 w-5 shrink-0" : "mt-0.5 h-5 w-5 shrink-0 text-brand";
  const linkClass =
    variant === "footer"
      ? "underline-offset-2 hover:text-white hover:underline"
      : "underline-offset-2 hover:text-brand hover:underline";

  return (
    <ul
      className={
        className ?? (variant === "footer" ? "mt-4 space-y-3 text-sm" : "mt-6 space-y-4")
      }
    >
      <li className="flex gap-3">
        <PinIcon className={iconClass} />
        <a href={mapsHref} target="_blank" rel="noopener noreferrer" className={linkClass}>
          {clinic.contact.address}
        </a>
      </li>
      <li className="flex gap-3">
        <PhoneIcon className={iconClass} />
        <a href={phoneHref} className={linkClass}>
          {clinic.contact.phone}
        </a>
      </li>
      <li className="flex gap-3">
        <MailIcon className={iconClass} />
        <a href={`mailto:${clinic.contact.email}`} className={`break-all ${linkClass}`}>
          {clinic.contact.email}
        </a>
      </li>
      {clinic.socials.map((social) => (
        <li key={social.href}>
          <a
            href={social.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-3 ${linkClass}`}
          >
            <img src={social.icon} alt="" className="h-5 w-5 shrink-0 object-contain" />
            {social.label}
          </a>
        </li>
      ))}
    </ul>
  );
}
