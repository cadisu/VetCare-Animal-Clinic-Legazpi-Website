/**
 * Pet option lists shared by forms, validation and display.
 * Must match the pet_species / pet_gender enums in the Phase 2 migration.
 */

export const PET_SPECIES = ["DOG", "CAT", "BIRD", "RABBIT", "OTHER"] as const;
export type PetSpecies = (typeof PET_SPECIES)[number];

export const PET_SPECIES_LABELS: Record<PetSpecies, string> = {
  DOG: "Dog",
  CAT: "Cat",
  BIRD: "Bird",
  RABBIT: "Rabbit",
  OTHER: "Other",
};

export const PET_GENDERS = ["MALE", "FEMALE"] as const;
export type PetGender = (typeof PET_GENDERS)[number];

export const PET_GENDER_LABELS: Record<PetGender, string> = {
  MALE: "Male",
  FEMALE: "Female",
};

export const PET_IMAGE_BUCKET = "pet-images";
export const PET_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const PET_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type PetImageType = (typeof PET_IMAGE_TYPES)[number];

export type Pet = {
  id: string;
  pet_number: number;
  owner_id: string;
  name: string;
  species: PetSpecies;
  species_other: string | null;
  breed: string;
  gender: PetGender;
  birth_date: string | null;
  color_markings: string;
  image_path: string | null;
  is_archived: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export const PET_COLUMNS =
  "id, pet_number, owner_id, name, species, species_other, breed, gender, birth_date, color_markings, image_path, is_archived, archived_at, created_at, updated_at";

export function petCode(petNumber: number): string {
  return `PET-${String(petNumber).padStart(6, "0")}`;
}

export function speciesLabel(pet: Pick<Pet, "species" | "species_other">): string {
  return pet.species === "OTHER" && pet.species_other
    ? pet.species_other
    : PET_SPECIES_LABELS[pet.species];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
