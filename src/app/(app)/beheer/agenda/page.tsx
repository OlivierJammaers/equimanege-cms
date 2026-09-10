import type { Metadata } from "next";
import { asc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { accounts, cmsUsers, meetingSlots, meetings } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth-guards";
import { groupSlotsByDay } from "@/lib/meeting-utils";
import { AddSlotsForm } from "@/components/beheer/add-slots-form";
import { AgendaList, type AgendaSlotRow } from "@/components/beheer/agenda-list";

// Leest rechtstreeks uit de DB — nooit statisch prerenderen.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Agenda — EquiManage CRM",
};

export default async function AgendaPage() {
  await requireAdmin();

  const now = new Date();
  const from = new Date(now.getTime() - 60 * 60 * 1000);

  const rows = await db
    .select({
      slotId: meetingSlots.id,
      startsAt: meetingSlots.startsAt,
      durationMinutes: meetingSlots.durationMinutes,
      meetingId: meetings.id,
      accountId: meetings.accountId,
      accountName: accounts.name,
      bookedByName: cmsUsers.name,
      note: meetings.note,
    })
    .from(meetingSlots)
    .leftJoin(meetings, eq(meetings.slotId, meetingSlots.id))
    .leftJoin(accounts, eq(meetings.accountId, accounts.id))
    .leftJoin(cmsUsers, eq(meetings.bookedBy, cmsUsers.id))
    .where(gte(meetingSlots.startsAt, from))
    .orderBy(asc(meetingSlots.startsAt));

  const slotRows: AgendaSlotRow[] = rows.map((row) => ({
    slotId: row.slotId,
    startsAt: row.startsAt,
    durationMinutes: row.durationMinutes,
    meetingId: row.meetingId,
    accountId: row.accountId,
    accountName: row.accountName,
    bookedByName: row.bookedByName,
    note: row.note,
  }));

  const groups = groupSlotsByDay(
    slotRows.map((row) => ({ ...row, booked: row.meetingId !== null })),
    now,
    { includeBooked: true },
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Agenda</h1>
        <p className="text-sm text-muted-foreground">
          Beheer je beschikbare meetingmomenten voor sales.
        </p>
      </div>

      <AddSlotsForm />

      <Card>
        <CardHeader>
          <CardTitle>Komende momenten</CardTitle>
        </CardHeader>
        <CardContent>
          <AgendaList groups={groups} />
        </CardContent>
      </Card>
    </div>
  );
}
