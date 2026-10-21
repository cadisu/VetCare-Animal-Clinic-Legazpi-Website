"use client";

import { useFormStatus } from "react-dom";
import { buttonClass } from "@/components/ui/button-styles";

/** Submit button with a loading label. Must sit inside a form. */
export function PosSubmitButton({
  children,
  pendingText = "Please wait...",
  variant = "primary",
  disabled = false,
}: {
  children: React.ReactNode;
  pendingText?: string;
  variant?: "primary" | "secondary" | "outline" | "ghost";
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending}
      className={buttonClass(variant)}
    >
      {pending ? pendingText : children}
    </button>
  );
}
