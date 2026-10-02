"use client";

import { useActionState } from "react";
import { registerAction, type FormState } from "@/app/actions/auth";
import { Alert } from "@/components/ui/Alert";
import { FormField } from "@/components/ui/FormField";
import { SubmitButton } from "@/components/ui/SubmitButton";

const initial: FormState = {};

export function RegisterForm() {
  const [state, formAction] = useActionState(registerAction, initial);

  if (state.success) {
    return <Alert variant="success">{state.success}</Alert>;
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.error && <Alert variant="error">{state.error}</Alert>}

      {/* No role selector on purpose: public sign-up always creates a Client account. */}
      <FormField
        label="Full name"
        name="fullName"
        autoComplete="name"
        required
        defaultValue={state.values?.fullName}
        errors={state.fieldErrors?.fullName}
      />
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
      <FormField
        label="Mobile number"
        name="contactNumber"
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        placeholder="09171234567"
        required
        hint="Used for appointment reminders."
        defaultValue={state.values?.contactNumber}
        errors={state.fieldErrors?.contactNumber}
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
