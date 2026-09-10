"use client";

import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createWindows } from "@/server/actions/meetings";

type RangeRow = {
  key: string;
  from: string;
  to: string;
};

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function newRow(): RangeRow {
  return { key: crypto.randomUUID(), from: "", to: "" };
}

/**
 * Admin-only formulier op `/beheer/agenda`: kiest een datum + één of meer
 * "van–tot"-tijdsblokken (GEEN duur — die kiest de sales-persoon zelf bij
 * het boeken) en publiceert ze als beschikbaarheidsvensters via
 * `createWindows`.
 */
export function AddWindowsForm() {
  const idPrefix = useId();
  const [date, setDate] = useState(todayIso());
  const [rows, setRows] = useState<RangeRow[]>([newRow()]);
  const [isPending, startTransition] = useTransition();

  function updateRow(key: string, patch: Partial<RangeRow>) {
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

    const ranges = rows
      .filter((row) => row.from.length > 0 && row.to.length > 0)
      .map((row) => ({ from: row.from, to: row.to }));

    if (ranges.length === 0) {
      toast.error("Voeg minstens één tijdsblok toe.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await createWindows({ date, ranges });
        toast.success(
          result.count === 1 ? "Beschikbaarheidsblok toegevoegd" : `${result.count} blokken toegevoegd`,
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
        <CardTitle>Beschikbaarheid toevoegen</CardTitle>
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
            <Label>Tijdsblokken</Label>
            {rows.map((row) => (
              <div key={row.key} className="flex items-center gap-2">
                <Input
                  type="time"
                  aria-label="Van"
                  value={row.from}
                  onChange={(event) => updateRow(row.key, { from: event.target.value })}
                  disabled={isPending}
                  className="w-32"
                />
                <span className="text-sm text-muted-foreground">tot</span>
                <Input
                  type="time"
                  aria-label="Tot"
                  value={row.to}
                  onChange={(event) => updateRow(row.key, { to: event.target.value })}
                  disabled={isPending}
                  className="w-32"
                />
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
