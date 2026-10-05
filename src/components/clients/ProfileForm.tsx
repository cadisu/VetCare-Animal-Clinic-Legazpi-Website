"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/actions/auth";
import { updateClientProfileAction } from "@/app/actions/profile";
import { Alert } from "@/components/ui/Alert";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ClientProfileFields } from "./ClientProfileFields";

const initial: FormState = {};

export function ProfileForm({
  defaults,
  maxBirthdate,
}: {
  defaults: Record<string, string>;
  maxBirthdate: string;
}) {
  const [state, formAction] = useActionState(updateClientProfileAction, initial);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.error && <Alert variant="error">{state.error}</Alert>}
      {state.success && <Alert variant="success">{state.success}</Alert>}
      <ClientProfileFields
        values={state.values ?? defaults}
        fieldErrors={state.fieldErrors}
        maxBirthdate={maxBirthdate}
      />
      <SubmitButton pendingText="Saving...">Save changes</SubmitButton>
    </form>
  );
}
