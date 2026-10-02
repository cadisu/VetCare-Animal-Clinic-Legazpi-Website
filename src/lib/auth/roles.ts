/**
 * Roles, account statuses, and the route-access matrix.
 * This file has no server-only imports so it can be used by middleware,
 * server components, server actions and client components alike.
 */

export const USER_ROLES = ["CLIENT", "STAFF", "SENIOR_VET"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ACCOUNT_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const ROLE_LABELS: Record<UserRole, string> = {
  CLIENT: "Client",
  STAFF: "Staff",
  SENIOR_VET: "Senior Vet",
};

/** The dashboard each role lands on after login. */
export const ROLE_HOME: Record<UserRole, string> = {
  CLIENT: "/client",
  STAFF: "/staff",
  SENIOR_VET: "/senior-vet",
};

/**
 * Protected areas and the roles allowed inside them.
 * - CLIENT     -> /client only
 * - STAFF      -> /staff only
 * - SENIOR_VET -> /senior-vet, plus /staff (Senior Vet has all Staff functions)
 */
const PROTECTED_AREAS: { prefix: string; roles: readonly UserRole[] }[] = [
  { prefix: "/client", roles: ["CLIENT"] },
  { prefix: "/staff", roles: ["STAFF", "SENIOR_VET"] },
  { prefix: "/senior-vet", roles: ["SENIOR_VET"] },
];

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Returns the allowed roles for a path, or null when the path is public. */
export function getRequiredRoles(pathname: string): readonly UserRole[] | null {
  const area = PROTECTED_AREAS.find((a) => matchesPrefix(pathname, a.prefix));
  return area ? area.roles : null;
}

export function isProtectedPath(pathname: string): boolean {
  return getRequiredRoles(pathname) !== null;
}

export function canAccessPath(role: UserRole, pathname: string): boolean {
  const required = getRequiredRoles(pathname);
  return required === null || required.includes(role);
}

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && (USER_ROLES as readonly string[]).includes(value);
}

/**
 * Only allow same-site relative redirect targets (prevents open redirects).
 */
export function isSafeRedirectPath(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\") &&
    !/[\r\n]/.test(value)
  );
}

/**
 * Picks where to send a freshly authenticated user: the requested page if the
 * role may access it, otherwise the role's own dashboard.
 */
export function resolvePostLoginPath(role: UserRole, requested?: string | null): string {
  if (
    requested &&
    isSafeRedirectPath(requested) &&
    isProtectedPath(requested.split("?")[0]) &&
    canAccessPath(role, requested.split("?")[0])
  ) {
    return requested;
  }
  return ROLE_HOME[role];
}
