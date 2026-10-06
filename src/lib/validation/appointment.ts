import { z } from "zod";
import { isUuid } from "@/lib/pets/constants";

export const bookAppointmentSchema = z.object({
  petId: z.string().refine(isUuid, "Select a pet"),
  serviceId: z.string().refine(isUuid, "Select a service"),
  slotId: z.string().refine(isUuid, "Select a time slot"),
  veterinarianId: z.string().optional(),
});

export const staffAppointmentSchema = z.object({
  clientId: z.string().refine(isUuid, "Select a client"),
  petId: z.string().refine(isUuid, "Select a pet"),
  serviceId: z.string().refine(isUuid, "Select a service"),
  slotId: z.string().refine(isUuid, "Select a time slot"),
  source: z.enum(["APPOINTMENT", "WALK_IN"]),
  allowOverCapacity: z.boolean().optional(),
});
