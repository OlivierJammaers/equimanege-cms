"use server";

import { revalidatePath } from "next/cache";
import { and, eq, gt, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { accounts, activities, availabilityWindows, meetings } from "@/db/schema";
import { assertAdmin, requireUser } from "@/lib/auth-guards";
import { formatDayLabelNl, formatTimeRangeNl, windowRangesFromInput } from "@/lib/meeting-utils";
import {
  bookMeetingSchema,
  createWindowsSchema,
  meetingIdSchema,
  windowIdSchema,
  type BookMeetingInput,
  type CreateWindowsInput,
} from "@/lib/meeting-schemas";

const AGENDA_PATH = "/beheer/agenda";
const MEETINGS_OVERVIEW_PATH = "/meetings";

function revalidateMeetingPaths(accountId?: string) {
  revalidatePath(AGENDA_PATH);
  revalidatePath(MEETINGS_OVERVIEW_PATH);
  if (accountId) revalidatePath("/accounts/" + accountId);
}

/**
 * Herkent een Postgres exclusion-constraint-violatie (23P01) — de
 * `meetings_no_overlap`-grendel uit de migratie. De neon-http/drizzle-driver
 * wrapt de onderliggende `NeonDbError` in een `DrizzleQueryError`, met de
 * SQLSTATE-code op `error.cause.code` i.p.v. `error.code` zelf (empirisch
 * geverifieerd tegen de dev-DB) — vandaar dat we allebei checken.
 */
function isOverlapViolation(error: unknown): boolean {
  function codeOf(value: unknown): unknown {
    return typeof value === "object" && value !== null && "code" in value
      ? (value as { code?: unknown }).code
      : undefined;
  }
  if (codeOf(error) === "23P01") return true;
  const cause = typeof error === "object" && error !== null ? (error as { cause?: unknown }).cause : undefined;
  return codeOf(cause) === "23P01";
}

function meetingActivityBody(action: "ingepland" | "geannuleerd", startsAt: Date, endsAt: Date): string {
  const when = `${formatDayLabelNl(startsAt)}, ${formatTimeRangeNl(startsAt, endsAt)}`;
  return action === "ingepland" ? `Meeting ingepland op ${when}` : `Meeting van ${when} geannuleerd`;
}

/** Twee intervallen overlappen wanneer a start vóór b eindigt én a eindigt na b start. */
function intervalsOverlap(a: { startsAt: Date; endsAt: Date }, b: { startsAt: Date; endsAt: Date }): boolean {
  return a.startsAt.getTime() < b.endsAt.getTime() && a.endsAt.getTime() > b.startsAt.getTime();
}

/**
 * Publiceert nieuwe beschikbaarheidsvensters voor een dag ("van–tot",
 * zonder duur). Alleen door admins. Weigert vensters in het verleden
 * (Brussels wall-clock, vergeleken met het echte huidige instant) en
 * vensters die overlappen met een bestaand venster van diezelfde admin op
 * dezelfde dag (zowel onderling in deze aanvraag als tegen wat al in de DB
 * staat).
 */
export async function createWindows(input: CreateWindowsInput) {
  const user = await requireUser();
  assertAdmin(user);

  const parsed = createWindowsSchema.parse(input);
  const ranges = windowRangesFromInput(parsed.date, parsed.ranges);

  const now = new Date();
  const pastRange = ranges.find((range) => range.startsAt.getTime() < now.getTime());
  if (pastRange) {
    throw new Error("Je kan geen beschikbaarheid in het verleden toevoegen.");
  }

  for (let i = 0; i < ranges.length; i++) {
    for (let j = i + 1; j < ranges.length; j++) {
      if (intervalsOverlap(ranges[i], ranges[j])) {
        throw new Error("Deze tijden overlappen met een bestaand beschikbaarheidsblok.");
      }
    }
  }

  const dayStart = new Date(`${parsed.date}T00:00:00.000Z`);
  const dayEnd = new Date(`${parsed.date}T00:00:00.000Z`);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 2); // ruime marge rond tijdzoneverschuivingen

  const existing = await db
    .select({ startsAt: availabilityWindows.startsAt, endsAt: availabilityWindows.endsAt })
    .from(availabilityWindows)
    .where(
      and(
        eq(availabilityWindows.createdBy, user.id),
        gte(availabilityWindows.startsAt, dayStart),
        lt(availabilityWindows.startsAt, dayEnd),
      ),
    );

  for (const range of ranges) {
    if (existing.some((row) => intervalsOverlap(range, row))) {
      throw new Error("Deze tijden overlappen met een bestaand beschikbaarheidsblok.");
    }
  }

  await db.insert(availabilityWindows).values(
    ranges.map((range) => ({
      startsAt: range.startsAt,
      endsAt: range.endsAt,
      createdBy: user.id,
    })),
  );

  revalidateMeetingPaths();

  return { count: ranges.length };
}

/**
 * Verwijdert een beschikbaarheidsvenster. Alleen door admins. Weigert
 * wanneer er al meetings geboekt zijn die dit venster overlappen (de admin
 * moet die eerst laten annuleren) — een meeting heeft geen FK naar het
 * venster, dus dit is een tijdsbereik-overlapcheck.
 */
export async function deleteWindow(windowId: string) {
  const user = await requireUser();
  assertAdmin(user);

  const parsed = windowIdSchema.parse({ windowId });

  const [window] = await db
    .select({ id: availabilityWindows.id, startsAt: availabilityWindows.startsAt, endsAt: availabilityWindows.endsAt })
    .from(availabilityWindows)
    .where(eq(availabilityWindows.id, parsed.windowId))
    .limit(1);
  if (!window) throw new Error("Dit venster bestaat niet (meer).");

  const [overlappingMeeting] = await db
    .select({ id: meetings.id })
    .from(meetings)
    .where(and(lt(meetings.startsAt, window.endsAt), gt(meetings.endsAt, window.startsAt)))
    .limit(1);
  if (overlappingMeeting) {
    throw new Error("Er zijn al meetings geboekt binnen dit blok — annuleer die eerst.");
  }

  await db.delete(availabilityWindows).where(eq(availabilityWindows.id, parsed.windowId));

  revalidateMeetingPaths();
}

/**
 * Boekt een meeting voor een account: de sales-persoon (of admin) kiest zelf
 * een starttijd + duur binnen een beschikbaarheidsvenster. Valideert dat het
 * gekozen tijdsbereik volledig binnen het venster valt en in de toekomst
 * ligt. De `meetings_no_overlap`-exclusion-constraint (migratie-SQL, zie
 * schema.ts) is de race-proof dubbelboekingsgrendel: twee gelijktijdige
 * boekingen die overlappen geven hier een PG-fout (23P01), opgevangen met
 * een vriendelijke NL-melding.
 */
export async function bookMeeting(input: BookMeetingInput) {
  const user = await requireUser();

  const parsed = bookMeetingSchema.parse(input);

  const startsAt = new Date(parsed.start);
  const endsAt = new Date(startsAt.getTime() + parsed.durationMinutes * 60_000);

  if (startsAt.getTime() < Date.now()) {
    throw new Error("Dit moment ligt in het verleden.");
  }

  const [window] = await db
    .select({ id: availabilityWindows.id, startsAt: availabilityWindows.startsAt, endsAt: availabilityWindows.endsAt })
    .from(availabilityWindows)
    .where(eq(availabilityWindows.id, parsed.windowId))
    .limit(1);
  if (!window) throw new Error("Dit beschikbaarheidsvenster bestaat niet (meer).");

  if (startsAt.getTime() < window.startsAt.getTime() || endsAt.getTime() > window.endsAt.getTime()) {
    throw new Error("Dit tijdstip valt niet (volledig) binnen het gekozen venster.");
  }

  const [account] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.id, parsed.accountId))
    .limit(1);
  if (!account) throw new Error("Account niet gevonden");

  try {
    await db.insert(meetings).values({
      accountId: parsed.accountId,
      startsAt,
      endsAt,
      bookedBy: user.id,
      note: parsed.note,
    });
  } catch (error) {
    if (isOverlapViolation(error)) {
      throw new Error("Dit tijdstip overlapt met een andere meeting — kies een ander moment.");
    }
    throw error;
  }

  const body =
    meetingActivityBody("ingepland", startsAt, endsAt) + (parsed.note ? ` — ${parsed.note}` : "");

  await db.insert(activities).values({
    accountId: parsed.accountId,
    userId: user.id,
    type: "meeting",
    body,
  });

  revalidateMeetingPaths(parsed.accountId);
}

/**
 * Annuleert een geboekte meeting: verwijdert de meeting-rij (die tijd komt
 * meteen weer vrij voor een nieuwe boeking) en logt de annulering.
 */
export async function cancelMeeting(meetingId: string) {
  const user = await requireUser();

  const parsed = meetingIdSchema.parse({ meetingId });

  const [row] = await db
    .select({
      id: meetings.id,
      accountId: meetings.accountId,
      startsAt: meetings.startsAt,
      endsAt: meetings.endsAt,
    })
    .from(meetings)
    .where(eq(meetings.id, parsed.meetingId))
    .limit(1);
  if (!row) throw new Error("Meeting niet gevonden");

  await db.delete(meetings).where(eq(meetings.id, parsed.meetingId));

  await db.insert(activities).values({
    accountId: row.accountId,
    userId: user.id,
    type: "meeting",
    body: meetingActivityBody("geannuleerd", row.startsAt, row.endsAt),
  });

  revalidateMeetingPaths(row.accountId);
}
