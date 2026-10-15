import { z } from "zod";
import { APPOINTMENT_STATUSES } from "@/lib/appointments/constants";
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

export const appointmentTransitionSchema = z.object({
  appointmentId: z.string().refine(isUuid, "Invalid appointment"),
  nextStatus: z.enum(APPOINTMENT_STATUSES),
  reason: z.string().trim().max(500).optional(),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  returnTo: z.string().optional(),
});
