"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { logoutAction } from "@/app/actions/auth";
import { clinic } from "@/config/clinic";
import { buttonClass } from "@/components/ui/button-styles";
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon, MenuIcon } from "@/components/ui/icons";
import {
  isDashboardNavActive,
  type DashboardNavItem,
  type DashboardShellProfile,
} from "./types";

function initials(profile: DashboardShellProfile): string {
  const letters = `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`.toUpperCase();
  return letters || profile.email.charAt(0).toUpperCase() || "?";
}

function Avatar({
  profile,
  className,
}: {
  profile: DashboardShellProfile;
  className: string;
}) {
  if (profile.avatarUrl) {
    return <img src={profile.avatarUrl} alt="" className={`${className} object-cover`} />;
  }
  return (
    <span
      className={`${className} inline-flex items-center justify-center bg-brand-muted text-xs font-semibold text-brand-dark`}
    >
      {initials(profile)}
    </span>
  );
}

function NavLinks({
  items,
  pathname,
  collapsed,
  onNavigate,
}: {
  items: readonly DashboardNavItem[];
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const active = isDashboardNavActive(pathname, item);
        const Icon = item.icon;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              title={collapsed ? item.label : undefined}
              aria-current={active ? "page" : undefined}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                collapsed ? "justify-center" : ""
              } ${
                active
                  ? "bg-highlight text-brand"
                  : "text-ink hover:bg-highlight/60 hover:text-ink"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className={collapsed ? "sr-only" : "truncate"}>{item.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function AccountMenu({
  profile,
  collapsed,
  roleLabel,
  profileHref,
  passwordHref,
}: {
  profile: DashboardShellProfile;
  collapsed: boolean;
  roleLabel: string;
  profileHref: string;
  passwordHref: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const displayName = profile.fullName || profile.email;

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative border-t border-line p-3">
      {open && (
        <div
          id={menuId}
          role="menu"
          className="absolute bottom-full left-3 z-30 mb-2 w-56 rounded-xl border border-line bg-white p-1 shadow-lg"
        >
          <Link
            href={profileHref}
            role="menuitem"
            className="block rounded-lg px-3 py-2 text-sm text-ink hover:bg-highlight/60"
            onClick={() => setOpen(false)}
          >
            My Profile
          </Link>
          <Link
            href={passwordHref}
            role="menuitem"
            className="block rounded-lg px-3 py-2 text-sm text-ink hover:bg-highlight/60"
            onClick={() => setOpen(false)}
          >
            Change Password
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              role="menuitem"
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-highlight/60"
            >
              Sign out
            </button>
          </form>
        </div>
      )}
      <button
        type="button"
        className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-highlight/60 ${
          collapsed ? "justify-center" : ""
        }`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        title={collapsed ? displayName : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <Avatar profile={profile} className="h-9 w-9 shrink-0 rounded-full" />
        <span className={collapsed ? "sr-only" : "min-w-0"}>
          <span className="block truncate text-sm font-semibold text-ink">{displayName}</span>
          <span className="block truncate text-xs text-muted">{roleLabel}</span>
        </span>
      </button>
    </div>
  );
}

function SidebarBody({
  profile,
  nav,
  homeHref,
  navLabel,
  roleLabel,
  profileHref,
  passwordHref,
  collapsed,
  onNavigate,
  onToggleCollapse,
  showCollapseToggle,
}: {
  profile: DashboardShellProfile;
  nav: readonly DashboardNavItem[];
  homeHref: string;
  navLabel: string;
  roleLabel: string;
  profileHref: string;
  passwordHref: string;
  collapsed: boolean;
  onNavigate?: () => void;
  onToggleCollapse?: () => void;
  showCollapseToggle?: boolean;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div
        className={`flex items-center gap-2 border-b border-line px-3 py-3 ${collapsed ? "justify-center" : ""}`}
      >
        <Link
          href={homeHref}
          className="inline-flex items-center gap-2"
          aria-label={`${clinic.shortName} home`}
          onClick={onNavigate}
        >
          <img src="/VetCare_Logo.jpg" alt="" className="h-10 w-10 rounded-lg bg-white object-contain" />
          {!collapsed && <span className="text-sm font-bold text-ink">{clinic.shortName}</span>}
        </Link>
      </div>
      <nav aria-label={navLabel} className="flex-1 overflow-y-auto px-3 py-4">
        <NavLinks items={nav} pathname={pathname} collapsed={collapsed} onNavigate={onNavigate} />
      </nav>
      {showCollapseToggle && onToggleCollapse && (
        <div className="px-3 pb-2">
          <button
            type="button"
            onClick={onToggleCollapse}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-highlight/60 ${
              collapsed ? "justify-center" : ""
            }`}
            aria-pressed={collapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRightIcon className="h-5 w-5" /> : <ChevronLeftIcon className="h-5 w-5" />}
            <span className={collapsed ? "sr-only" : ""}>
              {collapsed ? "Expand sidebar" : "Collapse sidebar"}
            </span>
          </button>
        </div>
      )}
      <AccountMenu
        profile={profile}
        collapsed={collapsed}
        roleLabel={roleLabel}
        profileHref={profileHref}
        passwordHref={passwordHref}
      />
    </div>
  );
}

export function DashboardShell({
  profile,
  nav,
  homeHref,
  navLabel,
  roleLabel,
  profileHref,
  passwordHref,
  collapseStorageKey,
  mobileMenuLabel,
  children,
}: {
  profile: DashboardShellProfile;
  nav: readonly DashboardNavItem[];
  homeHref: string;
  navLabel: string;
  roleLabel: string;
  profileHref: string;
  passwordHref: string;
  collapseStorageKey: string;
  mobileMenuLabel: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(collapseStorageKey) === "1");
    setReady(true);
  }, [collapseStorageKey]);

  useEffect(() => {
    if (ready) window.localStorage.setItem(collapseStorageKey, collapsed ? "1" : "0");
  }, [collapsed, ready, collapseStorageKey]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const drawerWasOpen = useRef(false);

  useEffect(() => {
    if (!mobileOpen) {
      if (drawerWasOpen.current) menuRef.current?.focus();
      drawerWasOpen.current = false;
      return;
    }
    drawerWasOpen.current = true;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  return (
    <div className="min-h-screen bg-canvas lg:flex">
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 overflow-visible border-r border-line lg:block ${
          collapsed ? "w-20" : "w-72"
        }`}
      >
        <SidebarBody
          profile={profile}
          nav={nav}
          homeHref={homeHref}
          navLabel={navLabel}
          roleLabel={roleLabel}
          profileHref={profileHref}
          passwordHref={passwordHref}
          collapsed={collapsed}
          showCollapseToggle
          onToggleCollapse={() => setCollapsed((value) => !value)}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-white px-4 py-3 lg:hidden">
          <button
            ref={menuRef}
            type="button"
            className={buttonClass("outline", "md", "!min-h-11 !px-3")}
            aria-label="Open menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(true)}
          >
            <MenuIcon className="h-5 w-5" />
          </button>
          <span className="text-sm font-bold text-ink">{clinic.shortName}</span>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink/40"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={mobileMenuLabel}
            className="relative flex h-full w-72 max-w-[85vw] flex-col bg-white shadow-xl"
          >
            <button
              ref={closeRef}
              type="button"
              className="absolute right-3 top-3 z-10 rounded-lg p-2 text-muted hover:bg-highlight/60"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
            >
              <CloseIcon className="h-5 w-5" />
            </button>
            <SidebarBody
              profile={profile}
              nav={nav}
              homeHref={homeHref}
              navLabel={navLabel}
              roleLabel={roleLabel}
              profileHref={profileHref}
              passwordHref={passwordHref}
              collapsed={false}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
