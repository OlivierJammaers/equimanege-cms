"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarX2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatTimeRangeNl } from "@/lib/meeting-utils";
import { cancelMeeting, deleteWindow } from "@/server/actions/meetings";

export type AgendaMeetingRow = {
  meetingId: string;
  startsAt: Date;
  endsAt: Date;
  accountId: string;
  accountName: string;
  bookedByName: string | null;
  note: string | null;
};

export type AgendaWindowRow = {
  windowId: string;
  startsAt: Date;
  endsAt: Date;
  meetings: AgendaMeetingRow[];
};

export type AgendaDayGroup = {
  dayKey: string;
  dayLabel: string;
  slots: AgendaWindowRow[];
};

function MeetingRow({ meeting }: { meeting: AgendaMeetingRow }) {
  const router = useRouter();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleCancel() {
    startTransition(async () => {
      try {
        const result = await cancelMeeting(meeting.meetingId);
        if ("error" in result) {
          toast.error(result.error);
          return;
        }
        toast.success("Meeting geannuleerd");
        setCancelOpen(false);
        router.refresh();
      } catch {
        toast.error("Er ging iets mis — probeer opnieuw.");
      }
    });
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 border-t py-2 pl-4 first:border-t-0">
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs tabular-nums text-foreground">
            {formatTimeRangeNl(meeting.startsAt, meeting.endsAt)}
          </span>
          <Link
            href={`/accounts/${meeting.accountId}`}
            className="text-xs text-foreground underline-offset-2 hover:underline"
          >
            {meeting.accountName}
          </Link>
          {meeting.bookedByName ? (
            <span className="text-xs text-muted-foreground">· door {meeting.bookedByName}</span>
          ) : null}
        </div>
        {meeting.note ? <p className="text-xs text-muted-foreground italic">{meeting.note}</p> : null}
      </div>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Annuleren"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <CalendarX2 className="size-4" />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>Meeting annuleren</TooltipContent>
        </Tooltip>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Meeting annuleren?</DialogTitle>
            <DialogDescription>
              {meeting.accountName} verliest deze meeting; dit tijdstip komt weer vrij.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCancelOpen(false)} disabled={isPending}>
              Terug
            </Button>
            <Button type="button" variant="destructive" onClick={handleCancel} disabled={isPending}>
              {isPending ? "Bezig…" : "Annuleren"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}

function WindowRow({ window }: { window: AgendaWindowRow }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const booked = window.meetings.length > 0;

  function handleDelete() {
    startTransition(async () => {
      try {
        const result = await deleteWindow(window.windowId);
        if ("error" in result) {
          toast.error(result.error);
          return;
        }
        toast.success("Beschikbaarheidsblok verwijderd");
        router.refresh();
      } catch {
        toast.error("Er ging iets mis — probeer opnieuw.");
      }
    });
  }

  return (
    <li className="border-b py-3 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm tabular-nums text-foreground">
            {formatTimeRangeNl(window.startsAt, window.endsAt)}
          </span>
          <Badge variant={booked ? "default" : "outline"} className="text-[11px]">
            {booked ? `${window.meetings.length} geboekt` : "Vrij"}
          </Badge>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Verwijderen"
              className="text-muted-foreground"
              onClick={handleDelete}
              disabled={isPending}
            >
              <Trash2 className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Verwijderen</TooltipContent>
        </Tooltip>
      </div>

      {window.meetings.length > 0 ? (
        <ul className="mt-2 flex flex-col">
          {window.meetings.map((meeting) => (
            <MeetingRow key={meeting.meetingId} meeting={meeting} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function AgendaList({ groups }: { groups: AgendaDayGroup[] }) {
  if (groups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Geen aankomende beschikbaarheid — voeg hierboven een blok toe.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <div key={group.dayKey}>
          <h3 className="mb-1 text-sm font-medium text-foreground capitalize">{group.dayLabel}</h3>
          <ul className="flex flex-col">
            {group.slots.map((window) => (
              <WindowRow key={window.windowId} window={window} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
