"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatSlotTimeNl } from "@/lib/meeting-utils";
import { cancelMeeting } from "@/server/actions/meetings";

export type MeetingRow = {
  meetingId: string;
  startsAt: Date;
  durationMinutes: number;
  accountId: string;
  accountName: string;
  accountGemeente: string | null;
  bookedByName: string | null;
  note: string | null;
};

export type MeetingDayGroup = {
  dayKey: string;
  dayLabel: string;
  meetings: MeetingRow[];
};

function CancelMeetingButton({ meetingId, accountName }: { meetingId: string; accountName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleCancel() {
    startTransition(async () => {
      try {
        await cancelMeeting(meetingId);
        toast.success("Meeting geannuleerd");
        setOpen(false);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Annuleren mislukt.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          Annuleren
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Meeting annuleren?</DialogTitle>
          <DialogDescription>
            {accountName} verliest deze meeting; het slot komt weer vrij voor een nieuwe boeking.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Terug
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleCancel}
            disabled={isPending}
          >
            {isPending ? "Bezig…" : "Annuleren"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MeetingRowCard({ meeting, showCancel }: { meeting: MeetingRow; showCancel: boolean }) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 border-b py-3 last:border-b-0">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-mono text-sm tabular-nums text-foreground">
            {formatSlotTimeNl(meeting.startsAt, meeting.durationMinutes)}
          </span>
          <Link
            href={`/accounts/${meeting.accountId}`}
            className="text-sm font-medium text-foreground underline-offset-2 hover:underline"
          >
            {meeting.accountName}
          </Link>
          {meeting.accountGemeente ? (
            <span className="text-xs text-muted-foreground">{meeting.accountGemeente}</span>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          {meeting.bookedByName ? `door ${meeting.bookedByName}` : null}
        </p>
        {meeting.note ? (
          <p
            className="block max-w-md truncate text-xs text-muted-foreground italic"
            title={meeting.note}
          >
            {meeting.note}
          </p>
        ) : null}
      </div>

      {showCancel ? (
        <CancelMeetingButton meetingId={meeting.meetingId} accountName={meeting.accountName} />
      ) : null}
    </li>
  );
}

function MeetingDayGroups({
  groups,
  showCancel,
  emptyMessage,
}: {
  groups: MeetingDayGroup[];
  showCancel: boolean;
  emptyMessage: string;
}) {
  if (groups.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <div key={group.dayKey}>
          <h3 className="mb-1 text-sm font-medium text-foreground capitalize">
            {group.dayLabel}
          </h3>
          <ul className="flex flex-col">
            {group.meetings.map((meeting) => (
              <MeetingRowCard key={meeting.meetingId} meeting={meeting} showCancel={showCancel} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/**
 * Meetings-overzicht (`/meetings`) — alle geboekte meetings, voor élke
 * ingelogde gebruiker. Server geeft de dag-gegroepeerde Komend/Afgelopen
 * data al klaar mee (zie `isMeetingUpcoming` in `meeting-utils.ts`); dit
 * component regelt alleen de tab-toggle (client state, geen page-reload) en
 * de Annuleren-actie op Komende meetings.
 */
export function MeetingsView({
  upcomingGroups,
  pastGroups,
}: {
  upcomingGroups: MeetingDayGroup[];
  pastGroups: MeetingDayGroup[];
}) {
  return (
    <Tabs defaultValue="komend">
      <TabsList>
        <TabsTrigger value="komend">Komend</TabsTrigger>
        <TabsTrigger value="afgelopen">Afgelopen</TabsTrigger>
      </TabsList>
      <TabsContent value="komend" className="mt-4">
        <MeetingDayGroups
          groups={upcomingGroups}
          showCancel
          emptyMessage="Nog geen meetings ingepland."
        />
      </TabsContent>
      <TabsContent value="afgelopen" className="mt-4">
        <MeetingDayGroups
          groups={pastGroups}
          showCancel={false}
          emptyMessage="Nog geen afgelopen meetings."
        />
      </TabsContent>
    </Tabs>
  );
}
