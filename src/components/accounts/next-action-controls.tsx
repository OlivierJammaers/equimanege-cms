"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Account } from "@/db/schema";
import { setNextAction, toggleDone, convertToCustomer } from "@/server/actions/accounts";

export function NextActionControls({
  accountId,
  nextActionDate,
  isDone,
  type,
}: {
  accountId: string;
  nextActionDate: string | null;
  isDone: boolean;
  type: Account["type"];
}) {
  const [date, setDate] = useState(nextActionDate ?? "");
  const [done, setDone] = useState(isDone);
  const [isDatePending, startDateTransition] = useTransition();
  const [isDonePending, startDoneTransition] = useTransition();
  const [isConvertPending, startConvertTransition] = useTransition();

  function handleDateChange(event: React.ChangeEvent<HTMLInputElement>) {
    const previous = date;
    const next = event.target.value;
    setDate(next);
    startDateTransition(async () => {
      try {
        await setNextAction(accountId, next || null);
        toast.success("Volgende actie bijgewerkt");
      } catch {
        setDate(previous);
        toast.error("Volgende actie bijwerken mislukt");
      }
    });
  }

  function handleDoneToggle() {
    const previous = done;
    const next = !done;
    setDone(next);
    startDoneTransition(async () => {
      try {
        await toggleDone(accountId, next);
        toast.success(next ? "Gemarkeerd als afgehandeld" : "Markering afgehandeld verwijderd");
      } catch {
        setDone(previous);
        toast.error("Bijwerken mislukt");
      }
    });
  }

  function handleConvert() {
    startConvertTransition(async () => {
      try {
        await convertToCustomer(accountId);
        toast.success("Geconverteerd naar klant");
      } catch {
        toast.error("Converteren naar klant mislukt");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="next-action-date" className="text-xs text-muted-foreground">
          Volgende actiedatum
        </Label>
        <Input
          id="next-action-date"
          type="date"
          value={date}
          onChange={handleDateChange}
          disabled={isDatePending}
          className="w-full"
        />
      </div>

      <label className="flex items-center gap-2 text-sm select-none">
        <input
          type="checkbox"
          checked={done}
          onChange={handleDoneToggle}
          disabled={isDonePending}
          className="size-4 rounded border-input accent-foreground"
        />
        Afgehandeld
      </label>

      {type === "customer" ? (
        <p className="text-xs text-muted-foreground">Dit account is al klant.</p>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleConvert}
          disabled={isConvertPending}
        >
          {isConvertPending ? "Bezig…" : "Maak klant"}
        </Button>
      )}
    </div>
  );
}
