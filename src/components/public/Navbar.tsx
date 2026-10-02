"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { publicNavLinks } from "@/config/clinic";
import { logoutAction } from "@/app/actions/auth";
import { buttonClass } from "@/components/ui/button-styles";
import { CloseIcon, MenuIcon } from "@/components/ui/icons";
import { Logo } from "@/components/ui/Logo";

type NavbarProps = {
  /** Where the logged-in user's dashboard lives, or null for visitors. */
  dashboardHref: string | null;
};

export function Navbar({ dashboardHref }: NavbarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const linkClass = (href: string) =>
    `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
      isActive(href) ? "text-brand" : "text-slate-600 hover:text-brand"
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Logo />

        {/* Desktop navigation */}
        <nav aria-label="Main" className="hidden items-center gap-1 xl:flex">
          {publicNavLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={linkClass(link.href)}
              aria-current={isActive(link.href) ? "page" : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 xl:flex">
          {dashboardHref ? (
            <>
              <Link href={dashboardHref} className={buttonClass("primary")}>
                My Dashboard
              </Link>
              <form action={logoutAction}>
                <button type="submit" className={buttonClass("outline")}>
                  Log out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className={buttonClass("ghost")}>
                Login
              </Link>
              <Link href="/register" className={buttonClass("primary")}>
                Create Account
              </Link>
            </>
          )}
        </div>

        {/* Mobile / tablet menu button */}
        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 xl:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <CloseIcon className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile / tablet panel */}
      {open && (
        <div id="mobile-menu" className="border-t border-slate-200 bg-white xl:hidden">
          <nav aria-label="Mobile" className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4 sm:px-6">
            {publicNavLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                aria-current={isActive(link.href) ? "page" : undefined}
                className={`flex min-h-11 items-center rounded-lg px-3 text-base font-medium ${
                  isActive(link.href) ? "bg-brand-soft text-brand" : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                {link.label}
              </Link>
            ))}

            <div className="mt-3 flex flex-col gap-2 border-t border-slate-200 pt-4 sm:flex-row">
              {dashboardHref ? (
                <>
                  <Link
                    href={dashboardHref}
                    onClick={() => setOpen(false)}
                    className={buttonClass("primary", "md", "flex-1")}
                  >
                    My Dashboard
                  </Link>
                  <form action={logoutAction} className="flex-1">
                    <button type="submit" className={buttonClass("outline", "md", "w-full")}>
                      Log out
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className={buttonClass("outline", "md", "flex-1")}
                  >
                    Login
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setOpen(false)}
                    className={buttonClass("primary", "md", "flex-1")}
                  >
                    Create Account
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
