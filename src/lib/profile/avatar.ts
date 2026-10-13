import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export const PROFILE_IMAGE_BUCKET = "profile-images";
export const PROFILE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const PROFILE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type ProfileImageType = (typeof PROFILE_IMAGE_TYPES)[number];

const SIGNED_URL_SECONDS = 60 * 60;

const EXTENSIONS: Record<ProfileImageType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function sniffImageType(bytes: Uint8Array): ProfileImageType | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

export type ProfileImageFile = { bytes: Uint8Array; type: ProfileImageType };

export async function readProfileImage(
  formData: FormData,
): Promise<{ image: ProfileImageFile | null; error?: string }> {
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return { image: null };
  if (file.size > PROFILE_IMAGE_MAX_BYTES) {
    return { image: null, error: "The image must be 2 MB or smaller." };
  }
  if (!(PROFILE_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return { image: null, error: "Upload a JPG, PNG or WEBP image." };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImageType(bytes);
  if (!type) return { image: null, error: "That file doesn't look like a valid image." };
  return { image: { bytes, type } };
}

export function isOwnAvatarPath(userId: string, path: string): boolean {
  return (
    path.startsWith(`${userId}/`) &&
    !path.includes("..") &&
    /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(path)
  );
}

export async function uploadProfileImage(
  supabase: SupabaseClient,
  userId: string,
  image: ProfileImageFile,
): Promise<string | null> {
  const path = `${userId}/${crypto.randomUUID()}.${EXTENSIONS[image.type]}`;
  const { error } = await supabase.storage
    .from(PROFILE_IMAGE_BUCKET)
    .upload(path, image.bytes, { contentType: image.type, upsert: false });
  return error ? null : path;
}

export async function removeProfileImage(supabase: SupabaseClient, path: string | null) {
  if (path) await supabase.storage.from(PROFILE_IMAGE_BUCKET).remove([path]);
}

/** Signed URL for the signed-in user's avatar. Missing column or file returns null. */
export async function getOwnAvatarUrl(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await supabase.from("profiles").select("avatar_path").eq("id", userId).maybeSingle();
  const path = data && typeof data.avatar_path === "string" ? data.avatar_path : null;
  if (error || !path || !isOwnAvatarPath(userId, path)) return null;

  const { data: signed } = await supabase.storage
    .from(PROFILE_IMAGE_BUCKET)
    .createSignedUrl(path, SIGNED_URL_SECONDS);
  return signed?.signedUrl ?? null;
}
