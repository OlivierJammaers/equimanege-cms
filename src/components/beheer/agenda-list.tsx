"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { formatSlotTimeNl } from "@/lib/meeting-utils";
import { cancelMeeting, deleteSlot } from "@/server/actions/meetings";

export type AgendaSlotRow = {
  slotId: string;
  startsAt: Date;
  durationMinutes: number;
  meetingId: string | null;
  accountId: string | null;
  accountName: string | null;
  bookedByName: string | null;
  note: string | null;
};

export type AgendaDayGroup = {
  dayKey: string;
  dayLabel: string;
  slots: AgendaSlotRow[];
};

function SlotRow({ slot }: { slot: AgendaSlotRow }) {
  const router = useRouter();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const booked = slot.meetingId !== null;

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteSlot(slot.slotId);
        toast.success("Moment verwijderd");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Verwijderen mislukt.");
      }
    });
  }

  function handleCancel() {
    if (!slot.meetingId) return;
    startTransition(async () => {
      try {
        await cancelMeeting(slot.meetingId!);
        toast.success("Meeting geannuleerd");
        setCancelOpen(false);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Annuleren mislukt.");
      }
    });
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 border-b py-3 last:border-b-0">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm tabular-nums text-foreground">
            {formatSlotTimeNl(slot.startsAt, slot.durationMinutes)}
          </span>
          <Badge variant={booked ? "default" : "outline"} className="text-[11px]">
            {booked ? "Geboekt" : "Vrij"}
          </Badge>
        </div>
        {booked ? (
          <p className="text-xs text-muted-foreground">
            <Link
              href={`/accounts/${slot.accountId}`}
              className="text-foreground underline-offset-2 hover:underline"
            >
              {slot.accountName}
            </Link>
            {slot.bookedByName ? ` · door ${slot.bookedByName}` : null}
            {slot.note ? <span className="block italic">{slot.note}</span> : null}
          </p>
        ) : null}
      </div>

      {booked ? (
        <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
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
                {slot.accountName} verliest deze meeting; het slot komt weer vrij.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCancelOpen(false)}
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
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={handleDelete}
          disabled={isPending}
        >
          {isPending ? "Bezig…" : "Verwijderen"}
        </Button>
      )}
    </li>
  );
}

export function AgendaList({ groups }: { groups: AgendaDayGroup[] }) {
  if (groups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Geen aankomende momenten — voeg hierboven een moment toe.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <div key={group.dayKey}>
          <h3 className="mb-1 text-sm font-medium text-foreground capitalize">
            {group.dayLabel}
          </h3>
          <ul className="flex flex-col">
            {group.slots.map((slot) => (
              <SlotRow key={slot.slotId} slot={slot} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
