import { z } from "zod";

/**
 * Pure Zod-schema's voor de meeting-agenda-acties
 * (`src/server/actions/meetings.ts`). Los van server-code gehouden zodat
 * validatie zonder DB/auth-runtime unit-testbaar is — zelfde patroon als
 * account-schemas.ts / user-schemas.ts.
 */

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const windowRangeSchema = z
  .object({
    from: z.string().regex(timeRegex, "Ongeldig tijdstip (verwacht UU:MM)."),
    to: z.string().regex(timeRegex, "Ongeldig tijdstip (verwacht UU:MM)."),
  })
  .refine((range) => range.to > range.from, {
    message: "Eindtijd moet na de starttijd liggen.",
    path: ["to"],
  });

export const createWindowsSchema = z.object({
  date: z.iso.date("Ongeldige datum."),
  ranges: z.array(windowRangeSchema).min(1, "Voeg minstens één tijdsblok toe."),
});

export type CreateWindowsInput = z.infer<typeof createWindowsSchema>;

export const windowIdSchema = z.object({
  windowId: z.string().uuid(),
});

export const meetingIdSchema = z.object({
  meetingId: z.string().uuid(),
});

/**
 * `start` is het volledige gekozen instant als ISO-8601-string (UTC), niet
 * een Brussels wall-clock "UU:MM". De sales-dialoog berekent de mogelijke
 * starttijden zelf als concrete `Date`-instanties (`startOptions` in
 * meeting-utils.ts, binnen een venster) en geeft de gekozen optie hier
 * rechtstreeks als instant door — dat sluit het cleanst aan en vermijdt een
 * dubbele/foutgevoelige heen-en-terug-vertaling naar wall-clock-tijd (die bij
 * een venster rond een DST-omschakeling of middernacht ambigu zou kunnen
 * worden). `durationMinutes` kiest de sales-persoon zelf (15–240 min, zie
 * `bookMeeting` in meetings.ts) — er is bewust geen vaste duur meer op een
 * beschikbaarheidsvenster.
 */
export const bookMeetingSchema = z.object({
  accountId: z.string().uuid(),
  windowId: z.string().uuid(),
  start: z.iso.datetime({ message: "Ongeldig tijdstip." }),
  durationMinutes: z
    .number()
    .int()
    .min(15, "Duur moet minstens 15 minuten zijn.")
    .max(240, "Duur mag hoogstens 240 minuten zijn."),
  note: z
    .string()
    .trim()
    .max(2000, "Notitie mag hoogstens 2000 tekens zijn.")
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
});

export type BookMeetingInput = z.input<typeof bookMeetingSchema>;
