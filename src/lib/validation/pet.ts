import { z } from "zod";
import { isIsoDate, todayIso } from "@/lib/dates";
import { PET_GENDERS, PET_SPECIES } from "@/lib/pets/constants";

/** Text fields of the pet form. The image file is validated separately in the server action. */
export const petSchema = z
  .object({
    name: z.string().trim().min(1, "Enter your pet's name.").max(60, "Name is too long."),
    species: z.enum(PET_SPECIES, "Choose a species."),
    speciesOther: z.string().trim().max(40, "Species is too long."),
    breed: z
      .string()
      .trim()
      .min(1, "Enter the breed (write \"Mixed\" or \"Unknown\" if unsure).")
      .max(80, "Breed is too long."),
    gender: z.enum(PET_GENDERS, "Choose a gender."),
    birthDate: z
      .string()
      .trim()
      .refine((v) => v === "" || isIsoDate(v), "Enter a valid date.")
      .refine((v) => v === "" || v >= "1980-01-01", "Enter a valid date of birth.")
      .refine((v) => v === "" || v <= todayIso(), "Date of birth cannot be in the future.")
      .transform((v) => (v === "" ? null : v)),
    colorMarkings: z
      .string()
      .trim()
      .min(1, "Describe your pet's color or markings.")
      .max(200, "Color/markings is too long."),
  })
  .superRefine((d, ctx) => {
    if (d.species === "OTHER" && d.speciesOther === "") {
      ctx.addIssue({ code: "custom", path: ["speciesOther"], message: "Tell us the species." });
    }
  })
  .transform(({ speciesOther, ...rest }) => ({
    ...rest,
    speciesOther: rest.species === "OTHER" ? speciesOther : null,
  }));

export type PetInput = z.infer<typeof petSchema>;
