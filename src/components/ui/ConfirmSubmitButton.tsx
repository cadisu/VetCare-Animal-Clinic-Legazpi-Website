"use client";

import { useFormStatus } from "react-dom";
import { buttonClass } from "./button-styles";

/** Submit button that asks for confirmation first. Must be rendered inside a <form>. */
export function ConfirmSubmitButton({
  children,
  confirmMessage,
  pendingText = "Please wait...",
  variant = "outline",
}: {
  children: React.ReactNode;
  confirmMessage: string;
  pendingText?: string;
  variant?: "primary" | "secondary" | "outline" | "ghost";
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) event.preventDefault();
      }}
      className={buttonClass(variant)}
    >
      {pending ? pendingText : children}
    </button>
  );
}
