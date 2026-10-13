/** White content panels on dashboard canvas backgrounds. */
export function panelClass(extra = "") {
  return [
    "rounded-2xl border border-line bg-white shadow-sm shadow-black/[0.03]",
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}

export function panelPaddingClass(extra = "") {
  return [panelClass("p-6"), extra].filter(Boolean).join(" ");
}
