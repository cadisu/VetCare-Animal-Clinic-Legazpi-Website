"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { FormState } from "@/app/actions/auth";
import { createPrivilegedUserAction } from "@/app/actions/users";
import { Alert } from "@/components/ui/Alert";
import { buttonClass } from "@/components/ui/button-styles";
import { FormField, SelectField } from "@/components/ui/FormField";
import { SubmitButton } from "@/components/ui/SubmitButton";

const initial: FormState = {};

export function CreatePrivilegedUserForm() {
  const [state, formAction] = useActionState(createPrivilegedUserAction, initial);
  const values = state.values ?? {};

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.error && <Alert variant="error">{state.error}</Alert>}
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Last name" name="lastName" autoComplete="family-name" defaultValue={values.lastName} errors={state.fieldErrors?.lastName} />
        <FormField label="First name" name="firstName" autoComplete="given-name" defaultValue={values.firstName} errors={state.fieldErrors?.firstName} />
        <FormField label="Middle name" name="middleName" labelNote="(optional)" defaultValue={values.middleName} errors={state.fieldErrors?.middleName} />
        <FormField label="Contact number" name="contactNumber" inputMode="tel" defaultValue={values.contactNumber} errors={state.fieldErrors?.contactNumber} />
        <FormField label="Email" name="email" type="email" autoComplete="off" defaultValue={values.email} errors={state.fieldErrors?.email} />
        <SelectField label="Role" name="role" defaultValue={values.role || "STAFF"} errors={state.fieldErrors?.role}>
          <option value="STAFF">Staff</option>
          <option value="SENIOR_VET">Senior Vet</option>
        </SelectField>
        <FormField
          label="Initial password"
          name="password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters, with a letter and a number. It is not stored in the audit log."
          errors={state.fieldErrors?.password}
        />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <SubmitButton pendingText="Creating..." className="sm:w-auto">Create account</SubmitButton>
        <Link href="/senior-vet/users" className={buttonClass("ghost", "lg")}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
