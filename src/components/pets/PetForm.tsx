"use client";

import { useActionState, useEffect, useState } from "react";
import type { FormState } from "@/app/actions/auth";
import { Alert } from "@/components/ui/Alert";
import { FormField, SelectField, TextAreaField } from "@/components/ui/FormField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { PawIcon } from "@/components/ui/icons";
import {
  PET_GENDER_LABELS,
  PET_GENDERS,
  PET_IMAGE_MAX_BYTES,
  PET_IMAGE_TYPES,
  PET_SPECIES,
  PET_SPECIES_LABELS,
} from "@/lib/pets/constants";

type PetFormValues = Partial<
  Record<
    "name" | "species" | "speciesOther" | "breed" | "gender" | "birthDate" | "colorMarkings",
    string
  >
>;

const initial: FormState = {};

export function PetForm({
  action,
  defaults,
  currentImageUrl,
  maxDate,
  submitLabel,
  pendingText = "Saving...",
  returnTo,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  defaults?: PetFormValues;
  /** Existing image when editing. */
  currentImageUrl?: string | null;
  /** Today's date (YYYY-MM-DD), passed from the server. */
  maxDate: string;
  submitLabel: string;
  pendingText?: string;
  returnTo?: "onboarding";
}) {
  const [state, formAction] = useActionState(action, initial);
  const values: PetFormValues = state.values ?? defaults ?? {};

  const [species, setSpecies] = useState(values.species ?? "");
  const [preview, setPreview] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  // React resets the form (including the file input) after each submit, so re-sync the
  // controlled species and drop the stale preview.
  useEffect(() => {
    if (state.values?.species !== undefined) setSpecies(state.values.species);
    setPreview(null);
  }, [state]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function onImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setImageError(null);
    setPreview(null);
    if (!file) return;
    if (!(PET_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      setImageError("Upload a JPG, PNG or WEBP image.");
      event.target.value = "";
      return;
    }
    if (file.size > PET_IMAGE_MAX_BYTES) {
      setImageError("The image must be 5 MB or smaller.");
      event.target.value = "";
      return;
    }
    setPreview(URL.createObjectURL(file));
    setRemoveImage(false);
  }

  const shownImage = preview ?? (removeImage ? null : currentImageUrl);
  const imageErrors = imageError ? [imageError] : state.fieldErrors?.image;

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.error && <Alert variant="error">{state.error}</Alert>}
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}

      <div>
        <span className="mb-1.5 block text-sm font-medium text-slate-800">
          Photo of your pet <span className="font-normal text-slate-500">(optional)</span>
        </span>
        <div className="flex items-center gap-4">
          <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-brand-soft text-brand">
            {shownImage ? (
              // eslint-disable-next-line @next/next/no-img-element -- local preview / signed URL
              <img src={shownImage} alt="Pet photo preview" className="size-full object-cover" />
            ) : (
              <PawIcon className="size-10" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <input
              id="image"
              name="image"
              type="file"
              accept={PET_IMAGE_TYPES.join(",")}
              onChange={onImageChange}
              aria-invalid={Boolean(imageErrors?.length) || undefined}
              aria-describedby="image-hint"
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-brand hover:file:bg-brand-muted"
            />
            <p id="image-hint" className="mt-1.5 text-xs text-slate-500">
              JPG, PNG or WEBP, up to 5 MB.
              {state.fieldErrors && !preview ? " Please choose the image again." : ""}
            </p>
            {currentImageUrl && !preview && (
              <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="removeImage"
                  checked={removeImage}
                  onChange={(e) => setRemoveImage(e.target.checked)}
                  className="size-4 accent-brand"
                />
                Remove current photo
              </label>
            )}
          </div>
        </div>
        {imageErrors?.length ? (
          <p className="mt-1.5 text-sm text-accent-dark">{imageErrors[0]}</p>
        ) : null}
      </div>

      <FormField
        label="Name"
        name="name"
        required
        maxLength={60}
        defaultValue={values.name}
        errors={state.fieldErrors?.name}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField
          label="Species"
          name="species"
          required
          value={species}
          onChange={(e) => setSpecies(e.target.value)}
          errors={state.fieldErrors?.species}
        >
          <option value="" disabled>
            Select species
          </option>
          {PET_SPECIES.map((s) => (
            <option key={s} value={s}>
              {PET_SPECIES_LABELS[s]}
            </option>
          ))}
        </SelectField>
        {species === "OTHER" ? (
          <FormField
            label="Specify species"
            name="speciesOther"
            required
            maxLength={40}
            placeholder="e.g. Hamster"
            defaultValue={values.speciesOther}
            errors={state.fieldErrors?.speciesOther}
          />
        ) : (
          <input type="hidden" name="speciesOther" value="" />
        )}
        <FormField
          label="Breed"
          name="breed"
          required
          maxLength={80}
          placeholder="e.g. Aspin, Shih Tzu, Mixed"
          defaultValue={values.breed}
          errors={state.fieldErrors?.breed}
        />
        <SelectField
          label="Gender"
          name="gender"
          required
          defaultValue={values.gender ?? ""}
          errors={state.fieldErrors?.gender}
        >
          <option value="" disabled>
            Select gender
          </option>
          {PET_GENDERS.map((g) => (
            <option key={g} value={g}>
              {PET_GENDER_LABELS[g]}
            </option>
          ))}
        </SelectField>
        <FormField
          label="Date of birth"
          labelNote="(optional)"
          name="birthDate"
          type="date"
          min="1980-01-01"
          max={maxDate}
          hint="Leave blank if you don't know it."
          defaultValue={values.birthDate}
          errors={state.fieldErrors?.birthDate}
        />
      </div>

      <TextAreaField
        label="Color / markings"
        name="colorMarkings"
        required
        maxLength={200}
        rows={2}
        placeholder="e.g. Brown with a white patch on the chest"
        defaultValue={values.colorMarkings}
        errors={state.fieldErrors?.colorMarkings}
      />

      <SubmitButton pendingText={pendingText}>{submitLabel}</SubmitButton>
    </form>
  );
}
