import type { Metadata } from "next";
import { asc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { accounts, availabilityWindows, cmsUsers, meetings } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth-guards";
import { groupWindowsByDay } from "@/lib/meeting-utils";
import { AddWindowsForm } from "@/components/beheer/add-windows-form";
import { AgendaList, type AgendaWindowRow } from "@/components/beheer/agenda-list";

// Leest rechtstreeks uit de DB — nooit statisch prerenderen.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Agenda — EquiManage CRM",
};

export default async function AgendaPage() {
  await requireAdmin();

  const now = new Date();
  const from = new Date(now.getTime() - 60 * 60 * 1000);

  const windowRows = await db
    .select({ id: availabilityWindows.id, startsAt: availabilityWindows.startsAt, endsAt: availabilityWindows.endsAt })
    .from(availabilityWindows)
    .where(gte(availabilityWindows.endsAt, from))
    .orderBy(asc(availabilityWindows.startsAt));

  // Meetings hebben geen FK naar een venster — we halen alle relevante
  // meetings op en koppelen ze in JS aan hun overlappende venster(s), i.p.v.
  // per venster een aparte query te doen.
  const meetingRows = await db
    .select({
      meetingId: meetings.id,
      startsAt: meetings.startsAt,
      endsAt: meetings.endsAt,
      accountId: meetings.accountId,
      accountName: accounts.name,
      bookedByName: cmsUsers.name,
      note: meetings.note,
    })
    .from(meetings)
    .innerJoin(accounts, eq(meetings.accountId, accounts.id))
    .leftJoin(cmsUsers, eq(meetings.bookedBy, cmsUsers.id))
    .where(gte(meetings.endsAt, from))
    .orderBy(asc(meetings.startsAt));

  const windowsWithMeetings: AgendaWindowRow[] = windowRows.map((window) => ({
    windowId: window.id,
    startsAt: window.startsAt,
    endsAt: window.endsAt,
    meetings: meetingRows.filter(
      (meeting) => meeting.startsAt < window.endsAt && meeting.endsAt > window.startsAt,
    ),
  }));

  const groups = groupWindowsByDay(
    windowsWithMeetings.map((w) => ({ ...w, startsAt: w.startsAt, endsAt: w.endsAt })),
    now,
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Agenda</h1>
        <p className="text-sm text-muted-foreground">
          Beheer je beschikbaarheidsvensters voor sales — sales kiest zelf een starttijd en duur binnen
          zo&apos;n venster.
        </p>
      </div>

      <AddWindowsForm />

      <Card>
        <CardHeader>
          <CardTitle>Komende beschikbaarheid</CardTitle>
        </CardHeader>
        <CardContent>
          <AgendaList groups={groups} />
        </CardContent>
      </Card>
    </div>
  );
}
