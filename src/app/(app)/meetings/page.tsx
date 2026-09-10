import type { Metadata } from "next";
import { asc, desc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { accounts, cmsUsers, meetingSlots, meetings } from "@/db/schema";
import { requireUser } from "@/lib/auth-guards";
import { formatDayLabelNl, isMeetingUpcoming } from "@/lib/meeting-utils";
import { MeetingsView, type MeetingDayGroup, type MeetingRow } from "@/components/meetings/meetings-view";

// Leest rechtstreeks uit de DB — nooit statisch prerenderen.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Meetings — EquiManage CRM",
};

// Ruim boven de max. slotduur (240 min, zie meeting-schemas.ts) zodat een nog
// lopende meeting (gestart maar niet geëindigd) altijd meegenomen wordt —
// het definitieve Komend/Afgelopen-onderscheid gebeurt daarna in JS via
// `isMeetingUpcoming` (op het slot-einde, niet het begin).
const UPCOMING_LOOKBACK_MS = 4 * 60 * 60 * 1000;
const PAST_CAP = 100;
// Buffer boven de cap: sommige van de meest recente "voorbije" rijen kunnen
// bij het filteren alsnog Komend blijken (nog niet geëindigd) en vallen dan
// af — met deze marge blijven er na filtering altijd genoeg over tot de cap.
const PAST_FETCH_LIMIT = PAST_CAP + 20;

const meetingSelection = {
  meetingId: meetings.id,
  startsAt: meetingSlots.startsAt,
  durationMinutes: meetingSlots.durationMinutes,
  accountId: accounts.id,
  accountName: accounts.name,
  accountGemeente: accounts.gemeente,
  bookedByName: cmsUsers.name,
  note: meetings.note,
};

/** Sleutel voor dag-groepering in Brussels tijdzone, bv. "2026-09-17". */
const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Brussels",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Groepeert (al gesorteerde) meetingrijen per dag — behoudt de volgorde. */
function groupMeetingsByDay(rows: MeetingRow[]): MeetingDayGroup[] {
  const groups: MeetingDayGroup[] = [];
  for (const row of rows) {
    const dayKey = dayKeyFormatter.format(row.startsAt);
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.dayKey === dayKey) {
      lastGroup.meetings.push(row);
    } else {
      groups.push({ dayKey, dayLabel: formatDayLabelNl(row.startsAt), meetings: [row] });
    }
  }
  return groups;
}

export default async function MeetingsPage() {
  await requireUser();

  const now = new Date();

  const upcomingRowsRaw = await db
    .select(meetingSelection)
    .from(meetings)
    .innerJoin(meetingSlots, eq(meetings.slotId, meetingSlots.id))
    .innerJoin(accounts, eq(meetings.accountId, accounts.id))
    .leftJoin(cmsUsers, eq(meetings.bookedBy, cmsUsers.id))
    .where(gte(meetingSlots.startsAt, new Date(now.getTime() - UPCOMING_LOOKBACK_MS)))
    .orderBy(asc(meetingSlots.startsAt));

  const upcomingRows = upcomingRowsRaw.filter((row) =>
    isMeetingUpcoming(row.startsAt, row.durationMinutes, now),
  );

  const pastRowsRaw = await db
    .select(meetingSelection)
    .from(meetings)
    .innerJoin(meetingSlots, eq(meetings.slotId, meetingSlots.id))
    .innerJoin(accounts, eq(meetings.accountId, accounts.id))
    .leftJoin(cmsUsers, eq(meetings.bookedBy, cmsUsers.id))
    .where(lt(meetingSlots.startsAt, now))
    .orderBy(desc(meetingSlots.startsAt))
    .limit(PAST_FETCH_LIMIT);

  const pastRows = pastRowsRaw
    .filter((row) => !isMeetingUpcoming(row.startsAt, row.durationMinutes, now))
    .slice(0, PAST_CAP);

  const upcomingGroups = groupMeetingsByDay(upcomingRows);
  const pastGroups = groupMeetingsByDay(pastRows);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Meetings</h1>
        <p className="text-sm text-muted-foreground">
          Alle ingeplande meetings, per dag gegroepeerd.
        </p>
      </div>

      <MeetingsView upcomingGroups={upcomingGroups} pastGroups={pastGroups} />
    </div>
  );
}
