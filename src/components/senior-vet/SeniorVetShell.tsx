"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { logoutAction } from "@/app/actions/auth";
import { clinic } from "@/config/clinic";
import { buttonClass } from "@/components/ui/button-styles";
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon, MenuIcon } from "@/components/ui/icons";
import {
  isSeniorVetNavActive,
  SENIOR_VET_NAV,
  type SeniorVetShellProfile,
} from "./nav";

const COLLAPSE_KEY = "vetcare.seniorVet.sidebarCollapsed";

function initials(profile: SeniorVetShellProfile): string {
  const letters = `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`.toUpperCase();
  return letters || profile.email.charAt(0).toUpperCase() || "?";
}

function Avatar({
  profile,
  className,
}: {
  profile: SeniorVetShellProfile;
  className: string;
}) {
  if (profile.avatarUrl) {
    return (
      <img
        src={profile.avatarUrl}
        alt=""
        className={`${className} object-cover`}
      />
    );
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
  pathname,
  collapsed,
  onNavigate,
}: {
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <ul className="space-y-1">
      {SENIOR_VET_NAV.map((item) => {
        const active = isSeniorVetNavActive(pathname, item);
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
                  ? "bg-brand-soft text-brand"
                  : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
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
}: {
  profile: SeniorVetShellProfile;
  collapsed: boolean;
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
    <div ref={rootRef} className="relative border-t border-slate-200 p-3">
      {open && (
        <div
          id={menuId}
          role="menu"
          className="absolute bottom-full left-3 z-30 mb-2 w-56 rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
        >
          <Link
            href="/senior-vet/profile"
            role="menuitem"
            className="block rounded-lg px-3 py-2 text-sm text-slate-800 hover:bg-slate-100"
            onClick={() => setOpen(false)}
          >
            My Profile
          </Link>
          <Link
            href="/senior-vet/profile/password"
            role="menuitem"
            className="block rounded-lg px-3 py-2 text-sm text-slate-800 hover:bg-slate-100"
            onClick={() => setOpen(false)}
          >
            Change Password
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              role="menuitem"
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-100"
            >
              Sign out
            </button>
          </form>
        </div>
      )}
      <button
        type="button"
        className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-slate-100 ${
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
          <span className="block truncate text-sm font-semibold text-slate-900">{displayName}</span>
          <span className="block truncate text-xs text-slate-500">Senior Vet</span>
        </span>
      </button>
    </div>
  );
}

function SidebarBody({
  profile,
  collapsed,
  onNavigate,
  onToggleCollapse,
  showCollapseToggle,
}: {
  profile: SeniorVetShellProfile;
  collapsed: boolean;
  onNavigate?: () => void;
  onToggleCollapse?: () => void;
  showCollapseToggle?: boolean;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className={`flex items-center gap-2 border-b border-slate-200 px-3 py-3 ${collapsed ? "justify-center" : ""}`}>
        <Link href="/senior-vet" className="inline-flex items-center gap-2" aria-label={`${clinic.shortName} home`} onClick={onNavigate}>
          <img src="/VetCare_Logo.jpg" alt="" className="h-10 w-10 rounded-lg bg-white object-contain" />
          {!collapsed && <span className="text-sm font-bold text-slate-900">{clinic.shortName}</span>}
        </Link>
      </div>
      <nav aria-label="Senior Vet" className="flex-1 overflow-y-auto px-3 py-4">
        <NavLinks pathname={pathname} collapsed={collapsed} onNavigate={onNavigate} />
      </nav>
      {showCollapseToggle && onToggleCollapse && (
        <div className="px-3 pb-2">
          <button
            type="button"
            onClick={onToggleCollapse}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 ${
              collapsed ? "justify-center" : ""
            }`}
            aria-pressed={collapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRightIcon className="h-5 w-5" /> : <ChevronLeftIcon className="h-5 w-5" />}
            <span className={collapsed ? "sr-only" : ""}>{collapsed ? "Expand sidebar" : "Collapse sidebar"}</span>
          </button>
        </div>
      )}
      <AccountMenu profile={profile} collapsed={collapsed} />
    </div>
  );
}

export function SeniorVetShell({
  profile,
  children,
}: {
  profile: SeniorVetShellProfile;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "1");
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) window.localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
  }, [collapsed, ready]);

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
    <div className="min-h-screen bg-slate-50 lg:flex">
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 overflow-visible border-r border-slate-200 lg:block ${
          collapsed ? "w-20" : "w-72"
        }`}
      >
        <SidebarBody
          profile={profile}
          collapsed={collapsed}
          showCollapseToggle
          onToggleCollapse={() => setCollapsed((value) => !value)}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
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
          <span className="text-sm font-bold text-slate-900">{clinic.shortName}</span>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Senior Vet menu"
            className="relative flex h-full w-72 max-w-[85vw] flex-col bg-white shadow-xl"
          >
            <button
              ref={closeRef}
              type="button"
              className="absolute right-3 top-3 z-10 rounded-lg p-2 text-slate-600 hover:bg-slate-100"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
            >
              <CloseIcon className="h-5 w-5" />
            </button>
            <SidebarBody profile={profile} collapsed={false} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
