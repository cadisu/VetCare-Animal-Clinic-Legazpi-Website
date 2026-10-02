"use client";

import { useActionState } from "react";
import { forgotPasswordAction, type FormState } from "@/app/actions/auth";
import { Alert } from "@/components/ui/Alert";
import { FormField } from "@/components/ui/FormField";
import { SubmitButton } from "@/components/ui/SubmitButton";

const initial: FormState = {};

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(forgotPasswordAction, initial);

  if (state.success) {
    return <Alert variant="success">{state.success}</Alert>;
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.error && <Alert variant="error">{state.error}</Alert>}
      <FormField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={state.values?.email}
        errors={state.fieldErrors?.email}
      />
      <SubmitButton pendingText="Sending link...">Send reset link</SubmitButton>
    </form>
  );
}
