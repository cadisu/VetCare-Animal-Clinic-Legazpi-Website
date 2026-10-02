import { logoutAction } from "@/app/actions/auth";
import { buttonClass } from "@/components/ui/button-styles";
import { Logo } from "@/components/ui/Logo";
import { ROLE_HOME, ROLE_LABELS } from "@/lib/auth/roles";
import type { Profile } from "@/lib/auth/session";
import { PortalNav, type PortalNavItem } from "./PortalNav";

/** Shared frame for the Client, Staff and Senior Vet portals. */
export function PortalShell({
  profile,
  nav,
  children,
}: {
  profile: Profile;
  nav: PortalNavItem[];
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 pt-3 sm:px-6 lg:px-8">
          <Logo href={ROLE_HOME[profile.role]} />
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-slate-900">
                {profile.full_name || profile.email}
              </p>
              <p className="text-xs text-slate-500">{ROLE_LABELS[profile.role]}</p>
            </div>
            <form action={logoutAction}>
              <button type="submit" className={buttonClass("outline")}>
                Log out
              </button>
            </form>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <PortalNav items={nav} />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">{children}</main>
    </div>
  );
}
