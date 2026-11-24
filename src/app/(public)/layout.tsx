import { Footer } from "@/components/public/Footer";
import { Navbar } from "@/components/public/Navbar";
import { getSession } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/auth/roles";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  // Only used to swap Login/Create Account for Dashboard/Log out. Public pages never require login.
  const session = await getSession().catch(() => null);
  const profile = session?.profile;
  const dashboardHref = profile && profile.status === "ACTIVE" ? ROLE_HOME[profile.role] : null;

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2"
      >
        Skip to content
      </a>
      <Navbar dashboardHref={dashboardHref} />
      <main id="main" className="relative z-10 flex-1">
        {children}
      </main>
      <div className="relative z-10">
        <Footer />
      </div>
    </div>
  );
}
