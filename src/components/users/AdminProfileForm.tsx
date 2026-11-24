"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/actions/auth";
import { updateAdminProfileAction } from "@/app/actions/users";
import { Alert } from "@/components/ui/Alert";
import { FormField } from "@/components/ui/FormField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { UserRole } from "@/lib/auth/roles";

const initial: FormState = {};

export function AdminProfileForm({
  userId,
  role,
  defaults,
}: {
  userId: string;
  role: UserRole;
  defaults: {
    lastName: string;
    middleName: string;
    firstName: string;
    contactNumber: string;
    address: string;
    birthdate: string;
  };
}) {
  const [state, formAction] = useActionState(updateAdminProfileAction, initial);
  const values = { ...defaults, ...state.values };

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="role" value={role} />
      {state.error && <Alert variant="error">{state.error}</Alert>}
      {state.success && <Alert variant="success">{state.success}</Alert>}
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Last name" name="lastName" autoComplete="family-name" defaultValue={values.lastName} errors={state.fieldErrors?.lastName} />
        <FormField label="First name" name="firstName" autoComplete="given-name" defaultValue={values.firstName} errors={state.fieldErrors?.firstName} />
        <FormField label="Middle name" name="middleName" labelNote="(optional)" defaultValue={values.middleName} errors={state.fieldErrors?.middleName} />
        <FormField label="Contact number" name="contactNumber" inputMode="tel" defaultValue={values.contactNumber} errors={state.fieldErrors?.contactNumber} />
        {role === "CLIENT" && (
          <>
            <div className="sm:col-span-2">
              <FormField label="Address" name="address" defaultValue={values.address} errors={state.fieldErrors?.address} />
            </div>
            <FormField label="Birthdate" name="birthdate" type="date" defaultValue={values.birthdate} errors={state.fieldErrors?.birthdate} />
          </>
        )}
      </div>
      <SubmitButton pendingText="Saving..." className="sm:w-auto">Save account details</SubmitButton>
    </form>
  );
}
