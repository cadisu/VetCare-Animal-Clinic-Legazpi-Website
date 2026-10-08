import Link from "next/link";
import { clinic, publicNavLinks } from "@/config/clinic";
import { ContactDetails } from "@/components/public/ContactDetails";
import { Logo } from "@/components/ui/Logo";

export function Footer() {
  return (
    <footer className="bg-brand-dark text-white/80">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-3 lg:px-8">
        <div>
          <Logo light />
          <p className="mt-4 max-w-xs text-sm leading-relaxed">{clinic.tagline}</p>
        </div>

        <nav aria-label="Footer">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white">Explore</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            {publicNavLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="hover:text-white">
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/login" className="hover:text-white">
                Login
              </Link>
            </li>
            <li>
              <Link href="/register" className="hover:text-white">
                Create Account
              </Link>
            </li>
          </ul>
        </nav>

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white">Contact</h2>
          <ContactDetails variant="footer" />
        </div>
      </div>

      <div className="border-t border-white/10">
        <p className="mx-auto max-w-7xl px-4 py-5 text-xs sm:px-6 lg:px-8">
          &copy; {new Date().getFullYear()} {clinic.copyrightHolder}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
