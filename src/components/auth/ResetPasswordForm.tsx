"use client";

import { useActionState } from "react";
import { resetPasswordAction, type FormState } from "@/app/actions/auth";
import { Alert } from "@/components/ui/Alert";
import { FormField } from "@/components/ui/FormField";
import { SubmitButton } from "@/components/ui/SubmitButton";

const initial: FormState = {};

export function ResetPasswordForm() {
  const [state, formAction] = useActionState(resetPasswordAction, initial);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.error && <Alert variant="error">{state.error}</Alert>}
      <FormField
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint="At least 8 characters, with a letter and a number."
        errors={state.fieldErrors?.password}
      />
      <FormField
        label="Confirm new password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        errors={state.fieldErrors?.confirmPassword}
      />
      <SubmitButton pendingText="Saving...">Update password</SubmitButton>
    </form>
  );
}
