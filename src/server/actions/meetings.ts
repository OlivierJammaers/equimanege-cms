"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, activities, meetingSlots, meetings } from "@/db/schema";
import { assertAdmin, requireUser } from "@/lib/auth-guards";
import { formatDayLabelNl, formatSlotTimeNl, slotTimesFromInput } from "@/lib/meeting-utils";
import {
  bookMeetingSchema,
  createSlotsSchema,
  meetingIdSchema,
  slotIdSchema,
  type BookMeetingInput,
  type CreateSlotsInput,
} from "@/lib/meeting-schemas";

const AGENDA_PATH = "/beheer/agenda";
const MEETINGS_OVERVIEW_PATH = "/meetings";

function revalidateMeetingPaths(accountId?: string) {
  revalidatePath(AGENDA_PATH);
  revalidatePath(MEETINGS_OVERVIEW_PATH);
  if (accountId) revalidatePath("/accounts/" + accountId);
}

/**
 * Herkent een Postgres unique-constraint-violatie (23505), ongeacht welke
 * driver de fout gooit — zelfde patroon als `src/server/actions/users.ts`.
 */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}

function meetingActivityBody(action: "ingepland" | "geannuleerd", startsAt: Date, durationMinutes: number): string {
  const when = `${formatDayLabelNl(startsAt)}, ${formatSlotTimeNl(startsAt, durationMinutes)}`;
  return action === "ingepland"
    ? `Meeting ingepland op ${when}`
    : `Meeting van ${when} geannuleerd`;
}

/**
 * Publiceert nieuwe beschikbare meetingmomenten voor een dag. Alleen door
 * admins. Weigert tijdstippen in het verleden (Brussels wall-clock,
 * vergeleken met het echte huidige instant).
 */
export async function createSlots(input: CreateSlotsInput) {
  const user = await requireUser();
  assertAdmin(user);

  const parsed = createSlotsSchema.parse(input);
  const slotTimes = slotTimesFromInput(parsed.date, parsed.times);

  const now = new Date();
  const pastSlot = slotTimes.find((slot) => slot.startsAt.getTime() < now.getTime());
  if (pastSlot) {
    throw new Error("Je kan geen moment in het verleden toevoegen.");
  }

  await db.insert(meetingSlots).values(
    slotTimes.map((slot) => ({
      startsAt: slot.startsAt,
      durationMinutes: slot.durationMinutes,
      createdBy: user.id,
    })),
  );

  revalidateMeetingPaths();
}

/**
 * Verwijdert een nog niet geboekt meetingmoment. Alleen door admins.
 * Weigert wanneer er al een meeting op dit slot geboekt is (de admin moet
 * die meeting eerst laten annuleren).
 */
export async function deleteSlot(slotId: string) {
  const user = await requireUser();
  assertAdmin(user);

  const parsed = slotIdSchema.parse({ slotId });

  const [existingMeeting] = await db
    .select({ id: meetings.id })
    .from(meetings)
    .where(eq(meetings.slotId, parsed.slotId))
    .limit(1);
  if (existingMeeting) {
    throw new Error("Dit slot is al geboekt — annuleer eerst de meeting.");
  }

  await db.delete(meetingSlots).where(eq(meetingSlots.id, parsed.slotId));

  revalidateMeetingPaths();
}

/**
 * Boekt een meeting voor een account op een vrij slot (sales + admin). De
 * unieke index op `meetings.slotId` is de race-proof dubbelboekingsgrendel:
 * twee gelijktijdige boekingen op hetzelfde slot geven hier een
 * unique-constraint-fout, opgevangen met een vriendelijke NL-melding.
 */
export async function bookMeeting(input: BookMeetingInput) {
  const user = await requireUser();

  const parsed = bookMeetingSchema.parse(input);

  const [slot] = await db
    .select({ id: meetingSlots.id, startsAt: meetingSlots.startsAt, durationMinutes: meetingSlots.durationMinutes })
    .from(meetingSlots)
    .where(eq(meetingSlots.id, parsed.slotId))
    .limit(1);
  if (!slot) throw new Error("Dit moment bestaat niet (meer).");
  if (slot.startsAt.getTime() < Date.now()) {
    throw new Error("Dit moment ligt in het verleden.");
  }

  const [account] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.id, parsed.accountId))
    .limit(1);
  if (!account) throw new Error("Account niet gevonden");

  try {
    await db.insert(meetings).values({
      slotId: parsed.slotId,
      accountId: parsed.accountId,
      bookedBy: user.id,
      note: parsed.note,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new Error("Dit tijdstip is net geboekt — kies een ander moment.");
    }
    throw error;
  }

  const body =
    meetingActivityBody("ingepland", slot.startsAt, slot.durationMinutes) +
    (parsed.note ? ` — ${parsed.note}` : "");

  await db.insert(activities).values({
    accountId: parsed.accountId,
    userId: user.id,
    type: "meeting",
    body,
  });

  revalidateMeetingPaths(parsed.accountId);
}

/**
 * Annuleert een geboekte meeting: verwijdert de meeting-rij (het slot komt
 * meteen weer vrij voor een nieuwe boeking) en logt de annulering.
 */
export async function cancelMeeting(meetingId: string) {
  const user = await requireUser();

  const parsed = meetingIdSchema.parse({ meetingId });

  const [row] = await db
    .select({
      id: meetings.id,
      accountId: meetings.accountId,
      startsAt: meetingSlots.startsAt,
      durationMinutes: meetingSlots.durationMinutes,
    })
    .from(meetings)
    .innerJoin(meetingSlots, eq(meetings.slotId, meetingSlots.id))
    .where(eq(meetings.id, parsed.meetingId))
    .limit(1);
  if (!row) throw new Error("Meeting niet gevonden");

  await db.delete(meetings).where(eq(meetings.id, parsed.meetingId));

  await db.insert(activities).values({
    accountId: row.accountId,
    userId: user.id,
    type: "meeting",
    body: meetingActivityBody("geannuleerd", row.startsAt, row.durationMinutes),
  });

  revalidateMeetingPaths(row.accountId);
}
