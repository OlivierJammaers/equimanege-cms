"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, CalendarPlus } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatDayLabelNl, formatSlotTimeNl } from "@/lib/meeting-utils";
import { bookMeeting, cancelMeeting } from "@/server/actions/meetings";

export type FreeSlotDayGroup = {
  dayKey: string;
  dayLabel: string;
  slots: { slotId: string; startsAt: Date; durationMinutes: number }[];
};

export type UpcomingMeeting = {
  meetingId: string;
  startsAt: Date;
  durationMinutes: number;
  bookedByName: string | null;
};

/**
 * Sales-flow op het accountdetail (boven `AddCommentForm` in de
 * "Opvolging"-kaart): toont een al geboekte meeting met een
 * annuleer-knop, of een "Meeting inplannen"-knop die een dialoog opent met
 * de vrije momenten (server heeft ze al opgehaald, gegroepeerd per dag).
 */
export function MeetingControls({
  accountId,
  upcomingMeeting,
  freeSlotGroups,
}: {
  accountId: string;
  upcomingMeeting: UpcomingMeeting | null;
  freeSlotGroups: FreeSlotDayGroup[];
}) {
  const router = useRouter();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [isCancelPending, startCancelTransition] = useTransition();
  const [isBookPending, startBookTransition] = useTransition();

  function handleCancel() {
    if (!upcomingMeeting) return;
    startCancelTransition(async () => {
      try {
        await cancelMeeting(upcomingMeeting.meetingId);
        toast.success("Meeting geannuleerd");
        setCancelOpen(false);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Annuleren mislukt.");
      }
    });
  }

  function handleBook() {
    if (!selectedSlotId) return;
    startBookTransition(async () => {
      try {
        await bookMeeting({ accountId, slotId: selectedSlotId, note });
        toast.success("Meeting ingepland");
        setBookOpen(false);
        setSelectedSlotId(null);
        setNote("");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Inplannen mislukt.");
      }
    });
  }

  if (upcomingMeeting) {
    return (
      <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3">
        <div className="flex items-start gap-2">
          <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="flex flex-col gap-0.5">
            <p className="text-sm text-foreground">
              Meeting: {formatDayLabelNl(upcomingMeeting.startsAt)},{" "}
              {formatSlotTimeNl(upcomingMeeting.startsAt, upcomingMeeting.durationMinutes)}
            </p>
            {upcomingMeeting.bookedByName ? (
              <p className="text-xs text-muted-foreground">
                door {upcomingMeeting.bookedByName}
              </p>
            ) : null}
          </div>
        </div>

        <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              Annuleren
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Meeting annuleren?</DialogTitle>
              <DialogDescription>
                Het slot komt weer vrij voor een nieuwe boeking.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCancelOpen(false)}
                disabled={isCancelPending}
              >
                Terug
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleCancel}
                disabled={isCancelPending}
              >
                {isCancelPending ? "Bezig…" : "Annuleren"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <Dialog
      open={bookOpen}
      onOpenChange={(open) => {
        setBookOpen(open);
        if (!open) {
          setSelectedSlotId(null);
          setNote("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="self-start">
          <CalendarPlus className="size-3.5" />
          Meeting inplannen
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Meeting inplannen</DialogTitle>
          <DialogDescription>Kies een vrij moment uit de agenda.</DialogDescription>
        </DialogHeader>

        {freeSlotGroups.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Er zijn momenteel geen vrije momenten — vraag de admin om beschikbaarheid toe te
            voegen.
          </p>
        ) : (
          <div className="flex max-h-72 flex-col gap-4 overflow-y-auto">
            {freeSlotGroups.map((group) => (
              <div key={group.dayKey}>
                <h4 className="mb-1.5 text-xs font-medium text-muted-foreground capitalize">
                  {group.dayLabel}
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {group.slots.map((slot) => (
                    <Button
                      key={slot.slotId}
                      type="button"
                      size="sm"
                      variant={selectedSlotId === slot.slotId ? "default" : "outline"}
                      onClick={() => setSelectedSlotId(slot.slotId)}
                      className={cn("font-mono", "tabular-nums")}
                    >
                      {formatSlotTimeNl(slot.startsAt, slot.durationMinutes)}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Notitie (optioneel)"
            disabled={isBookPending}
            className="min-h-16"
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            onClick={handleBook}
            disabled={isBookPending || !selectedSlotId}
          >
            {isBookPending ? "Bezig…" : "Inplannen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
