"use client";

import { useFormStatus } from "react-dom";
import { buttonClass } from "./button-styles";

/** Submit button with a built-in loading state. Must be rendered inside a <form>. */
export function SubmitButton({
  children,
  pendingText = "Please wait...",
  className = "",
  disabled = false,
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending}
      className={buttonClass("primary", "lg", `w-full ${className}`)}
    >
      {pending ? pendingText : children}
    </button>
  );
}
