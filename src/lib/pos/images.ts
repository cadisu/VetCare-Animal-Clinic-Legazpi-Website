import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export const PRODUCT_IMAGE_BUCKET = "product-images";
export const PRODUCT_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
type ProductImageType = "image/jpeg" | "image/png" | "image/webp";
const EXTENSIONS: Record<ProductImageType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function sniffImageType(bytes: Uint8Array): ProductImageType | null {
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
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

export function isProductImagePath(productId: string, path: string): boolean {
  return (
    path.startsWith(`${productId}/`) &&
    !path.includes("..") &&
    /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(path)
  );
}

export async function readProductImage(
  formData: FormData,
): Promise<{ image: { bytes: Uint8Array; type: ProductImageType } | null; remove: boolean; error?: string }> {
  const remove = String(formData.get("removeImage") ?? "") === "true";
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return { image: null, remove };
  if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
    return { image: null, remove, error: "The image must be 2 MB or smaller." };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImageType(bytes);
  if (!type) return { image: null, remove, error: "Upload a JPG, PNG, or WEBP image." };
  return { image: { bytes, type }, remove };
}

export async function uploadProductImage(
  supabase: SupabaseClient,
  productId: string,
  image: { bytes: Uint8Array; type: ProductImageType },
): Promise<string | null> {
  const path = `${productId}/${crypto.randomUUID()}.${EXTENSIONS[image.type]}`;
  const { error } = await supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(path, image.bytes, { contentType: image.type, upsert: false });
  return error ? null : path;
}

export async function removeProductImage(supabase: SupabaseClient, path: string | null) {
  if (path) await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove([path]);
}

export async function getProductImageUrls(
  supabase: SupabaseClient,
  paths: (string | null | undefined)[],
): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter((path): path is string => Boolean(path)))];
  if (unique.length === 0) return {};
  const { data } = await supabase.storage.from(PRODUCT_IMAGE_BUCKET).createSignedUrls(unique, 60 * 60);
  const urls: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) urls[item.path] = item.signedUrl;
  }
  return urls;
}
