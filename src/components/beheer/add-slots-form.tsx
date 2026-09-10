"use client";

import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createSlots } from "@/server/actions/meetings";

const DURATION_OPTIONS = [30, 45, 60, 90] as const;

type TimeRow = {
  key: string;
  start: string;
  durationMinutes: number;
};

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function newRow(): TimeRow {
  return { key: crypto.randomUUID(), start: "", durationMinutes: 60 };
}

/**
 * Admin-only formulier op `/beheer/agenda`: kiest een datum + één of meer
 * tijdstippen (met duur) en publiceert ze als vrije meetingmomenten via
 * `createSlots`.
 */
export function AddSlotsForm() {
  const idPrefix = useId();
  const [date, setDate] = useState(todayIso());
  const [rows, setRows] = useState<TimeRow[]>([newRow()]);
  const [isPending, startTransition] = useTransition();

  function updateRow(key: string, patch: Partial<TimeRow>) {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows((prev) => [...prev, newRow()]);
  }

  function removeRow(key: string) {
    setRows((prev) => (prev.length > 1 ? prev.filter((row) => row.key !== key) : prev));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const times = rows
      .filter((row) => row.start.length > 0)
      .map((row) => ({ start: row.start, durationMinutes: row.durationMinutes }));

    if (times.length === 0) {
      toast.error("Voeg minstens één tijdstip toe.");
      return;
    }

    startTransition(async () => {
      try {
        await createSlots({ date, times });
        toast.success(
          times.length === 1 ? "Moment toegevoegd" : `${times.length} momenten toegevoegd`,
        );
        setRows([newRow()]);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Toevoegen mislukt.");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Momenten toevoegen</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${idPrefix}-date`}>Datum</Label>
            <Input
              id={`${idPrefix}-date`}
              type="date"
              min={todayIso()}
              value={date}
              onChange={(event) => setDate(event.target.value)}
              disabled={isPending}
              className="w-fit"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Tijdstippen</Label>
            {rows.map((row) => (
              <div key={row.key} className="flex items-center gap-2">
                <Input
                  type="time"
                  aria-label="Tijdstip"
                  value={row.start}
                  onChange={(event) => updateRow(row.key, { start: event.target.value })}
                  disabled={isPending}
                  className="w-32"
                />
                <Select
                  value={String(row.durationMinutes)}
                  onValueChange={(value) =>
                    updateRow(row.key, { durationMinutes: Number(value) })
                  }
                  disabled={isPending}
                >
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
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeRow(row.key)}
                  disabled={isPending || rows.length === 1}
                  aria-label="Rij verwijderen"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addRow}
              disabled={isPending}
              className="self-start"
            >
              <Plus className="size-3.5" />
              Rij toevoegen
            </Button>
          </div>

          <Button type="submit" disabled={isPending} className="self-end">
            {isPending ? "Bezig…" : "Toevoegen"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
