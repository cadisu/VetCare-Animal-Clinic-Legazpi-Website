"use client";

import { useActionState } from "react";
import { registerAction, type FormState } from "@/app/actions/auth";
import { ClientProfileFields } from "@/components/clients/ClientProfileFields";
import { Alert } from "@/components/ui/Alert";
import { FormField } from "@/components/ui/FormField";
import { SubmitButton } from "@/components/ui/SubmitButton";

const initial: FormState = {};

export function RegisterForm({ maxBirthdate }: { maxBirthdate: string }) {
  const [state, formAction] = useActionState(registerAction, initial);

  if (state.success) {
    return <Alert variant="success">{state.success}</Alert>;
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.error && <Alert variant="error">{state.error}</Alert>}

      {/* No role selector on purpose: public sign-up always creates a Client account. */}
      <ClientProfileFields
        values={state.values}
        fieldErrors={state.fieldErrors}
        maxBirthdate={maxBirthdate}
      />
      <FormField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        hint="You'll use this to log in."
        defaultValue={state.values?.email}
        errors={state.fieldErrors?.email}
      />
      <FormField
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint="At least 8 characters, with a letter and a number."
        errors={state.fieldErrors?.password}
      />
      <FormField
        label="Confirm password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        errors={state.fieldErrors?.confirmPassword}
      />

      <SubmitButton pendingText="Creating account...">Create account</SubmitButton>
    </form>
  );
}
