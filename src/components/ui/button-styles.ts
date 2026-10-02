type Variant = "primary" | "secondary" | "outline" | "ghost";
type Size = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-dark",
  secondary: "bg-accent text-white hover:bg-accent-dark",
  outline: "border border-brand text-brand hover:bg-brand-soft",
  ghost: "text-slate-700 hover:bg-slate-100",
};

const sizes: Record<Size, string> = {
  // min-h-11 (44px) keeps touch targets comfortable on mobile.
  md: "min-h-11 px-5 text-sm",
  lg: "min-h-12 px-6 text-base",
};

/** Class string for buttons and link-styled-as-button elements. */
export function buttonClass(variant: Variant = "primary", size: Size = "md", extra = "") {
  return [base, variants[variant], sizes[size], extra].filter(Boolean).join(" ");
}
