"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/app/actions/auth";
import { requireRole } from "@/lib/auth/session";
import { isUuid } from "@/lib/pets/constants";
import { readPetImage, removePetImage, uploadPetImage } from "@/lib/pets/server";
import { createClient } from "@/lib/supabase/server";
import { petSchema, type PetInput } from "@/lib/validation/pet";

const GENERIC_ERROR = "Something went wrong. Please try again.";
const IMAGE_UPLOAD_ERROR = "We couldn't upload the image. Please try again or save without one.";

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function readPetFields(formData: FormData) {
  return {
    name: text(formData, "name"),
    species: text(formData, "species"),
    speciesOther: text(formData, "speciesOther"),
    breed: text(formData, "breed"),
    gender: text(formData, "gender"),
    birthDate: text(formData, "birthDate"),
    colorMarkings: text(formData, "colorMarkings"),
  };
}

function toRow(data: PetInput) {
  return {
    name: data.name,
    species: data.species,
    species_other: data.speciesOther,
    breed: data.breed,
    gender: data.gender,
    birth_date: data.birthDate,
    color_markings: data.colorMarkings,
  };
}

/* ------------------------------------------------------------------ */
/* Register a pet (always for the signed-in client)                    */
/* ------------------------------------------------------------------ */
export async function createPetAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const profile = await requireRole(["CLIENT"]);
  const values = readPetFields(formData);
  const fromOnboarding = text(formData, "returnTo") === "onboarding";

  const parsed = petSchema.safeParse(values);
  const { image, error: imageError } = await readPetImage(formData);
  if (!parsed.success || imageError) {
    return {
      fieldErrors: {
        ...(parsed.success ? {} : z.flattenError(parsed.error).fieldErrors),
        ...(imageError ? { image: [imageError] } : {}),
      },
      values,
    };
  }

  const supabase = await createClient();
  let imagePath: string | null = null;
  if (image) {
    imagePath = await uploadPetImage(supabase, profile.id, image);
    if (!imagePath) return { fieldErrors: { image: [IMAGE_UPLOAD_ERROR] }, values };
  }

  // owner_id always comes from the session, never from the form.
  const { data, error } = await supabase
    .from("pets")
    .insert({ ...toRow(parsed.data), owner_id: profile.id, image_path: imagePath })
    .select("id")
    .single();

  if (error || !data) {
    await removePetImage(supabase, imagePath);
    return { error: GENERIC_ERROR, values };
  }

  revalidatePath("/client", "layout");
  if (fromOnboarding) redirect(`/client/get-started?added=${encodeURIComponent(parsed.data.name)}`);
  redirect(`/client/pets/${data.id}?message=created`);
}

/* ------------------------------------------------------------------ */
/* Edit a pet's basic information                                      */
/* ------------------------------------------------------------------ */
export async function updatePetAction(
  petId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const profile = await requireRole(["CLIENT"]);
  const values = readPetFields(formData);
  if (!isUuid(petId)) return { error: "Pet not found.", values };

  const supabase = await createClient();
  // RLS only returns the client's own pets, so another client's ID finds nothing.
  const { data: existing } = await supabase
    .from("pets")
    .select("id, image_path, is_archived")
    .eq("id", petId)
    .eq("owner_id", profile.id)
    .maybeSingle();
  if (!existing || existing.is_archived) return { error: "Pet not found.", values };

  const parsed = petSchema.safeParse(values);
  const { image, error: imageError } = await readPetImage(formData);
  if (!parsed.success || imageError) {
    return {
      fieldErrors: {
        ...(parsed.success ? {} : z.flattenError(parsed.error).fieldErrors),
        ...(imageError ? { image: [imageError] } : {}),
      },
      values,
    };
  }

  const removeImage = text(formData, "removeImage") === "on";
  let newImagePath: string | null | undefined;
  if (image) {
    newImagePath = await uploadPetImage(supabase, profile.id, image);
    if (!newImagePath) return { fieldErrors: { image: [IMAGE_UPLOAD_ERROR] }, values };
  } else if (removeImage) {
    newImagePath = null;
  }

  const { data: updated, error } = await supabase
    .from("pets")
    .update({
      ...toRow(parsed.data),
      ...(newImagePath !== undefined ? { image_path: newImagePath } : {}),
    })
    .eq("id", petId)
    .eq("owner_id", profile.id)
    .select("id");

  if (error || !updated?.length) {
    if (newImagePath) await removePetImage(supabase, newImagePath);
    return { error: GENERIC_ERROR, values };
  }
  if (newImagePath !== undefined && existing.image_path) {
    await removePetImage(supabase, existing.image_path);
  }

  revalidatePath("/client", "layout");
  redirect(`/client/pets/${petId}?message=updated`);
}

/* ------------------------------------------------------------------ */
/* Remove a pet (archived, so its history is kept)                     */
/* ------------------------------------------------------------------ */
export async function archivePetAction(petId: string) {
  const profile = await requireRole(["CLIENT"]);
  if (!isUuid(petId)) redirect("/client/pets");

  const supabase = await createClient();
  await supabase
    .from("pets")
    .update({ is_archived: true })
    .eq("id", petId)
    .eq("owner_id", profile.id);

  revalidatePath("/client", "layout");
  redirect("/client/pets?message=archived");
}

/* ------------------------------------------------------------------ */
/* Finish or skip the "register your pets" step after sign-up          */
/* ------------------------------------------------------------------ */
export async function completeOnboardingAction(formData: FormData) {
  const profile = await requireRole(["CLIENT"]);
  const supabase = await createClient();
  await supabase
    .from("profiles")
    .update({ onboarded_at: new Date().toISOString() })
    .eq("id", profile.id)
    .is("onboarded_at", null);

  revalidatePath("/client", "layout");
  redirect(text(formData, "intent") === "finish" ? "/client/pets" : "/client");
}
