import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PET_IMAGE_BUCKET,
  PET_IMAGE_MAX_BYTES,
  PET_IMAGE_TYPES,
  type PetImageType,
} from "./constants";

const SIGNED_URL_SECONDS = 60 * 60;

const EXTENSIONS: Record<PetImageType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Detects the real image type from the file's first bytes (the browser-sent type can be faked). */
function sniffImageType(bytes: Uint8Array): PetImageType | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

export type PetImageFile = { bytes: Uint8Array; type: PetImageType };

/**
 * Reads the optional "image" field of a pet form.
 * Returns null when no file was chosen, or an error message for invalid files.
 */
export async function readPetImage(
  formData: FormData,
): Promise<{ image: PetImageFile | null; error?: string }> {
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return { image: null };

  if (file.size > PET_IMAGE_MAX_BYTES) {
    return { image: null, error: "The image must be 5 MB or smaller." };
  }
  if (!(PET_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return { image: null, error: "Upload a JPG, PNG or WEBP image." };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImageType(bytes);
  if (!type) return { image: null, error: "That file doesn't look like a valid image." };
  return { image: { bytes, type } };
}

/** Uploads into the owner's own folder (required by the Storage RLS policies). */
export async function uploadPetImage(
  supabase: SupabaseClient,
  ownerId: string,
  image: PetImageFile,
): Promise<string | null> {
  const path = `${ownerId}/${crypto.randomUUID()}.${EXTENSIONS[image.type]}`;
  const { error } = await supabase.storage
    .from(PET_IMAGE_BUCKET)
    .upload(path, image.bytes, { contentType: image.type, upsert: false });
  return error ? null : path;
}

export async function removePetImage(supabase: SupabaseClient, path: string | null) {
  if (path) await supabase.storage.from(PET_IMAGE_BUCKET).remove([path]);
}

/** Short-lived URLs for private pet images, keyed by storage path. */
export async function getPetImageUrls(
  supabase: SupabaseClient,
  paths: (string | null)[],
): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  if (unique.length === 0) return {};

  const { data } = await supabase.storage
    .from(PET_IMAGE_BUCKET)
    .createSignedUrls(unique, SIGNED_URL_SECONDS);

  const urls: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) urls[item.path] = item.signedUrl;
  }
  return urls;
}
