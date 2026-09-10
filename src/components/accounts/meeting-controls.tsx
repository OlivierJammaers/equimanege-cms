"use client";

import { useMemo, useState, useTransition } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatDayLabelNl, formatTimeRangeNl, freeGaps, startOptions } from "@/lib/meeting-utils";
import { bookMeeting, cancelMeeting } from "@/server/actions/meetings";

const DURATION_OPTIONS = [30, 45, 60, 90, 120] as const;
const DEFAULT_DURATION = 60;

export type FreeWindow = {
  windowId: string;
  startsAt: Date;
  endsAt: Date;
  meetings: { startsAt: Date; endsAt: Date }[];
};

export type FreeWindowDayGroup = {
  dayKey: string;
  dayLabel: string;
  slots: FreeWindow[];
};

export type UpcomingMeeting = {
  meetingId: string;
  startsAt: Date;
  endsAt: Date;
  bookedByName: string | null;
};

/**
 * Sales-flow op het accountdetail (boven `AddCommentForm` in de
 * "Opvolging"-kaart): toont een al geboekte meeting met een
 * annuleer-knop, of een "Meeting inplannen"-knop die een dialoog opent.
 * Daarin kiest de sales-persoon eerst een beschikbaarheidsvenster, daarna
 * zelf een duur en (binnen de nog vrije tijd van dat venster) een
 * starttijd — er staat nergens een vaste duur op het venster zelf.
 */
export function MeetingControls({
  accountId,
  upcomingMeeting,
  freeWindowGroups,
}: {
  accountId: string;
  upcomingMeeting: UpcomingMeeting | null;
  freeWindowGroups: FreeWindowDayGroup[];
}) {
  const router = useRouter();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);
  const [selectedWindow, setSelectedWindow] = useState<FreeWindow | null>(null);
  const [durationMinutes, setDurationMinutes] = useState<number>(DEFAULT_DURATION);
  const [selectedStart, setSelectedStart] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [isCancelPending, startCancelTransition] = useTransition();
  const [isBookPending, startBookTransition] = useTransition();

  const startChoices = useMemo(() => {
    if (!selectedWindow) return [];
    const gaps = freeGaps(selectedWindow, selectedWindow.meetings);
    return startOptions(gaps, durationMinutes);
  }, [selectedWindow, durationMinutes]);

  function resetBookState() {
    setSelectedWindow(null);
    setDurationMinutes(DEFAULT_DURATION);
    setSelectedStart(null);
    setNote("");
  }

  function handleSelectWindow(window: FreeWindow) {
    setSelectedWindow(window);
    setSelectedStart(null);
  }

  function handleDurationChange(value: string) {
    setDurationMinutes(Number(value));
    setSelectedStart(null);
  }

  function handleCancel() {
    if (!upcomingMeeting) return;
    startCancelTransition(async () => {
      try {
        const result = await cancelMeeting(upcomingMeeting.meetingId);
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

  function handleBook() {
    if (!selectedWindow || !selectedStart) return;
    startBookTransition(async () => {
      try {
        const result = await bookMeeting({
          accountId,
          windowId: selectedWindow.windowId,
          start: selectedStart,
          durationMinutes,
          note,
        });
        if ("error" in result) {
          toast.error(result.error);
          return;
        }
        toast.success("Meeting ingepland");
        setBookOpen(false);
        resetBookState();
        router.refresh();
      } catch {
        toast.error("Er ging iets mis — probeer opnieuw.");
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
              {formatTimeRangeNl(upcomingMeeting.startsAt, upcomingMeeting.endsAt)}
            </p>
            {upcomingMeeting.bookedByName ? (
              <p className="text-xs text-muted-foreground">door {upcomingMeeting.bookedByName}</p>
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
              <DialogDescription>Dit tijdstip komt weer vrij voor een nieuwe boeking.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCancelOpen(false)} disabled={isCancelPending}>
                Terug
              </Button>
              <Button type="button" variant="destructive" onClick={handleCancel} disabled={isCancelPending}>
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
        if (!open) resetBookState();
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
          <DialogDescription>Kies een beschikbaarheidsvenster, dan een duur en starttijd.</DialogDescription>
        </DialogHeader>

        {freeWindowGroups.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Er is momenteel geen beschikbaarheid — vraag de admin om een venster toe te voegen.
          </p>
        ) : (
          <div className="flex max-h-48 flex-col gap-4 overflow-y-auto">
            {freeWindowGroups.map((group) => (
              <div key={group.dayKey}>
                <h4 className="mb-1.5 text-xs font-medium text-muted-foreground capitalize">
                  {group.dayLabel}
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {group.slots.map((window) => (
                    <Button
                      key={window.windowId}
                      type="button"
                      size="sm"
                      variant={selectedWindow?.windowId === window.windowId ? "default" : "outline"}
                      onClick={() => handleSelectWindow(window)}
                      className={cn("font-mono", "tabular-nums")}
                    >
                      {formatTimeRangeNl(window.startsAt, window.endsAt)}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedWindow ? (
          <div className="flex flex-col gap-3 border-t pt-3">
            <div className="flex items-center gap-2">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Duur</span>
                <Select value={String(durationMinutes)} onValueChange={handleDurationChange}>
                  <SelectTrigger aria-label="Duur" className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.map((minutes) => (
                      <SelectItem key={minutes} value={String(minutes)}>
                        {minutes} min
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Starttijd</span>
                <Select
                  value={selectedStart ?? undefined}
                  onValueChange={(value) => setSelectedStart(value)}
                  disabled={startChoices.length === 0}
                >
                  <SelectTrigger aria-label="Starttijd" className="w-28">
                    <SelectValue placeholder="Kies…" />
                  </SelectTrigger>
                  <SelectContent>
                    {startChoices.map((start) => (
                      <SelectItem key={start.toISOString()} value={start.toISOString()}>
                        {formatTimeRangeNl(start, new Date(start.getTime() + durationMinutes * 60_000)).split(
                          " – ",
                        )[0]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {startChoices.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Geen starttijd van {durationMinutes} min past nog in dit venster — kies een kortere duur of
                een ander venster.
              </p>
            ) : null}
          </div>
        ) : null}

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
          <Button type="button" onClick={handleBook} disabled={isBookPending || !selectedStart}>
            {isBookPending ? "Bezig…" : "Inplannen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
