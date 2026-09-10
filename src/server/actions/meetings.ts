"use server";

import { revalidatePath } from "next/cache";
import { and, eq, gt, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { accounts, activities, availabilityWindows, meetings } from "@/db/schema";
import { assertAdmin, requireUser } from "@/lib/auth-guards";
import { formatDayLabelNl, formatTimeNl, formatTimeRangeNl, windowRangesFromInput } from "@/lib/meeting-utils";
import {
  bookMeetingSchema,
  createWindowsSchema,
  firstIssueMessage,
  meetingIdSchema,
  windowIdSchema,
  type BookMeetingInput,
  type CreateWindowsInput,
} from "@/lib/meeting-schemas";

/**
 * Discriminant-resultaattype voor de meeting-acties: user-facing
 * validatie-/conflictfouten worden geretourneerd i.p.v. gethrowd. Reden:
 * productie-Next.js maskeert thrown server-action-fouten (alleen een digest,
 * geen message) — dat gaf een React #441-crash i.p.v. een nette toast. Enkel
 * échte onverwachte/systeemfouten (DB down e.d.) mogen nog gooien; de
 * auth-guards (`requireUser`/`assertAdmin`) redirecten zoals voorheen.
 */
export type ActionError = { error: string };

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
export async function createWindows(
  input: CreateWindowsInput,
): Promise<{ count: number } | ActionError> {
  const user = await requireUser();
  assertAdmin(user);

  const parsed = createWindowsSchema.safeParse(input);
  if (!parsed.success) {
    return { error: firstIssueMessage(parsed.error) };
  }
  const ranges = windowRangesFromInput(parsed.data.date, parsed.data.ranges);

  const now = new Date();
  const pastRange = ranges.find((range) => range.startsAt.getTime() < now.getTime());
  if (pastRange) {
    return {
      error: `Je kan geen beschikbaarheid in het verleden toevoegen. De starttijd (${formatTimeNl(pastRange.startsAt)}) is al voorbij.`,
    };
  }

  for (let i = 0; i < ranges.length; i++) {
    for (let j = i + 1; j < ranges.length; j++) {
      if (intervalsOverlap(ranges[i], ranges[j])) {
        return { error: "Deze tijden overlappen met een bestaand beschikbaarheidsblok." };
      }
    }
  }

  const dayStart = new Date(`${parsed.data.date}T00:00:00.000Z`);
  const dayEnd = new Date(`${parsed.data.date}T00:00:00.000Z`);
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
      return { error: "Deze tijden overlappen met een bestaand beschikbaarheidsblok." };
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
export async function deleteWindow(windowId: string): Promise<{ ok: true } | ActionError> {
  const user = await requireUser();
  assertAdmin(user);

  const parsed = windowIdSchema.safeParse({ windowId });
  if (!parsed.success) {
    return { error: firstIssueMessage(parsed.error) };
  }

  const [window] = await db
    .select({ id: availabilityWindows.id, startsAt: availabilityWindows.startsAt, endsAt: availabilityWindows.endsAt })
    .from(availabilityWindows)
    .where(eq(availabilityWindows.id, parsed.data.windowId))
    .limit(1);
  if (!window) return { error: "Dit venster bestaat niet (meer)." };

  const [overlappingMeeting] = await db
    .select({ id: meetings.id })
    .from(meetings)
    .where(and(lt(meetings.startsAt, window.endsAt), gt(meetings.endsAt, window.startsAt)))
    .limit(1);
  if (overlappingMeeting) {
    return { error: "Er zijn al meetings geboekt binnen dit blok — annuleer die eerst." };
  }

  await db.delete(availabilityWindows).where(eq(availabilityWindows.id, parsed.data.windowId));

  revalidateMeetingPaths();

  return { ok: true };
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
export async function bookMeeting(input: BookMeetingInput): Promise<{ ok: true } | ActionError> {
  const user = await requireUser();

  const parsed = bookMeetingSchema.safeParse(input);
  if (!parsed.success) {
    return { error: firstIssueMessage(parsed.error) };
  }
  const data = parsed.data;

  const startsAt = new Date(data.start);
  const endsAt = new Date(startsAt.getTime() + data.durationMinutes * 60_000);

  if (startsAt.getTime() < Date.now()) {
    return { error: "Dit moment ligt in het verleden." };
  }

  const [window] = await db
    .select({ id: availabilityWindows.id, startsAt: availabilityWindows.startsAt, endsAt: availabilityWindows.endsAt })
    .from(availabilityWindows)
    .where(eq(availabilityWindows.id, data.windowId))
    .limit(1);
  if (!window) return { error: "Dit beschikbaarheidsvenster bestaat niet (meer)." };

  if (startsAt.getTime() < window.startsAt.getTime() || endsAt.getTime() > window.endsAt.getTime()) {
    return { error: "Dit tijdstip valt niet (volledig) binnen het gekozen venster." };
  }

  const [account] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.id, data.accountId))
    .limit(1);
  if (!account) return { error: "Account niet gevonden" };

  try {
    await db.insert(meetings).values({
      accountId: data.accountId,
      startsAt,
      endsAt,
      bookedBy: user.id,
      note: data.note,
    });
  } catch (error) {
    if (isOverlapViolation(error)) {
      return { error: "Dit tijdstip overlapt met een andere meeting — kies een ander moment." };
    }
    throw error;
  }

  const body = meetingActivityBody("ingepland", startsAt, endsAt) + (data.note ? ` — ${data.note}` : "");

  await db.insert(activities).values({
    accountId: data.accountId,
    userId: user.id,
    type: "meeting",
    body,
  });

  revalidateMeetingPaths(data.accountId);

  return { ok: true };
}

/**
 * Annuleert een geboekte meeting: verwijdert de meeting-rij (die tijd komt
 * meteen weer vrij voor een nieuwe boeking) en logt de annulering.
 */
export async function cancelMeeting(meetingId: string): Promise<{ ok: true } | ActionError> {
  const user = await requireUser();

  const parsed = meetingIdSchema.safeParse({ meetingId });
  if (!parsed.success) {
    return { error: firstIssueMessage(parsed.error) };
  }

  const [row] = await db
    .select({
      id: meetings.id,
      accountId: meetings.accountId,
      startsAt: meetings.startsAt,
      endsAt: meetings.endsAt,
    })
    .from(meetings)
    .where(eq(meetings.id, parsed.data.meetingId))
    .limit(1);
  if (!row) return { error: "Meeting niet gevonden" };

  await db.delete(meetings).where(eq(meetings.id, parsed.data.meetingId));

  await db.insert(activities).values({
    accountId: row.accountId,
    userId: user.id,
    type: "meeting",
    body: meetingActivityBody("geannuleerd", row.startsAt, row.endsAt),
  });

  revalidateMeetingPaths(row.accountId);

  return { ok: true };
}
