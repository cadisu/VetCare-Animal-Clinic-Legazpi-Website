const NOTICES: Record<string, string> = {
  created: "The account has been created.",
  deactivated: "The account is now inactive. Past visits and bills stay on record.",
  reactivated: "The account is active again.",
  role: "The role has been updated.",
};

const ERRORS: Record<string, string> = {
  invalid: "That request could not be applied.",
  "not-authorized": "You are not allowed to manage this account.",
  "own-status": "You cannot change your own account status.",
  "own-role": "You cannot change your own role.",
  "last-senior-vet": "The clinic must keep at least one active Senior Vet.",
  "client-role": "A client account cannot be turned into a staff account from here. Create a separate staff account instead.",
  "not-found": "That account could not be found.",
  config: "The system is not configured yet. Please contact the clinic administrator.",
  audit: "The account was created, but the audit log could not be written. Apply the Phase 12 database migration and try again if this continues.",
  create: "The account could not be created. Please try again.",
  exists: "An account with that email already exists.",
  save: "The account could not be saved. Please try again.",
  signin: "The account is active, but sign-in could not be restored. Open the account and choose Reactivate again.",
};

export function userNoticeText(code: string | undefined): string | null {
  if (!code) return null;
  return NOTICES[code] ?? null;
}

export function userErrorText(code: string | undefined): string | null {
  if (!code) return null;
  return ERRORS[code] ?? "The account could not be saved. Please try again.";
}

/** Maps a database exception to a short code used in the page address. */
export function userAdminErrorCode(message: string): string {
  const text = message.toLowerCase();
  if (text.includes("not authorized")) return "not-authorized";
  if (text.includes("own account status")) return "own-status";
  if (text.includes("own role")) return "own-role";
  if (text.includes("at least one active senior vet")) return "last-senior-vet";
  if (text.includes("client accounts cannot change role")) return "client-role";
  if (text.includes("account not found")) return "not-found";
  if (text.includes("already") && text.includes("registered")) return "exists";
  if (text.includes("already been registered")) return "exists";
  return "save";
}
