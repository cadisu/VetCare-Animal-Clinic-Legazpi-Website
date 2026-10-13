"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { FormState } from "@/app/actions/auth";
import { updateStaffProfileAction } from "@/app/actions/profile";
import { Alert } from "@/components/ui/Alert";
import { buttonClass } from "@/components/ui/button-styles";
import { FormField } from "@/components/ui/FormField";
import { SubmitButton } from "@/components/ui/SubmitButton";

const initial: FormState = {};

export function StaffProfileForm({
  defaults,
  currentImageUrl,
  initials,
}: {
  defaults: {
    lastName: string;
    middleName: string;
    firstName: string;
    contactNumber: string;
  };
  currentImageUrl: string | null;
  initials: string;
}) {
  const [state, formAction] = useActionState(updateStaffProfileAction, initial);
  const [preview, setPreview] = useState<string | null>(null);
  const values = state.values ?? defaults;
  const imageUrl = preview || currentImageUrl;

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.error && <Alert variant="error">{state.error}</Alert>}
      {state.success && <Alert variant="success">{state.success}</Alert>}

      <div className="flex items-center gap-4">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-brand-muted text-lg font-semibold text-brand-dark">
            {initials}
          </span>
        )}
        <div>
          <label htmlFor="image" className="mb-1.5 block text-sm font-medium text-ink">
            Profile picture
          </label>
          <input
            id="image"
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand"
            onChange={(event) => {
              const file = event.target.files?.[0];
              setPreview(file ? URL.createObjectURL(file) : null);
            }}
          />
          <p className="mt-1.5 text-xs text-muted">JPG, PNG, or WEBP. 2 MB maximum.</p>
        </div>
      </div>

      <FormField
        label="First name"
        name="firstName"
        autoComplete="given-name"
        required
        defaultValue={values.firstName}
        errors={state.fieldErrors?.firstName}
      />
      <FormField
        label="Middle name"
        name="middleName"
        labelNote="(optional)"
        autoComplete="additional-name"
        defaultValue={values.middleName}
        errors={state.fieldErrors?.middleName}
      />
      <FormField
        label="Last name"
        name="lastName"
        autoComplete="family-name"
        required
        defaultValue={values.lastName}
        errors={state.fieldErrors?.lastName}
      />
      <FormField
        label="Contact number"
        name="contactNumber"
        type="tel"
        autoComplete="tel"
        required
        defaultValue={values.contactNumber}
        errors={state.fieldErrors?.contactNumber}
      />

      <div className="flex flex-wrap gap-3">
        <SubmitButton pendingText="Saving...">Save changes</SubmitButton>
        <Link href="/staff" className={buttonClass("outline", "lg")}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
