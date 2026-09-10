import { z } from "zod";

/**
 * Pure Zod-schema's voor de meeting-agenda-acties
 * (`src/server/actions/meetings.ts`). Los van server-code gehouden zodat
 * validatie zonder DB/auth-runtime unit-testbaar is — zelfde patroon als
 * account-schemas.ts / user-schemas.ts.
 */

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const slotTimeSchema = z.object({
  start: z.string().regex(timeRegex, "Ongeldig tijdstip (verwacht UU:MM)."),
  durationMinutes: z
    .number()
    .int()
    .min(15, "Duur moet minstens 15 minuten zijn.")
    .max(240, "Duur mag hoogstens 240 minuten zijn."),
});

export const createSlotsSchema = z.object({
  date: z.iso.date("Ongeldige datum."),
  times: z.array(slotTimeSchema).min(1, "Voeg minstens één tijdstip toe."),
});

export type CreateSlotsInput = z.infer<typeof createSlotsSchema>;

export const slotIdSchema = z.object({
  slotId: z.string().uuid(),
});

export const meetingIdSchema = z.object({
  meetingId: z.string().uuid(),
});

export const bookMeetingSchema = z.object({
  accountId: z.string().uuid(),
  slotId: z.string().uuid(),
  note: z
    .string()
    .trim()
    .max(2000, "Notitie mag hoogstens 2000 tekens zijn.")
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
});

export type BookMeetingInput = z.input<typeof bookMeetingSchema>;
