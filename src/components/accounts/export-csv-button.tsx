"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CALL_STATUS_LABELS } from "@/lib/constants";
import { toCsv } from "@/lib/utils";
import type { Account } from "@/db/schema";

function toExportRow(account: Account): Record<string, unknown> {
  return {
    Naam: account.name,
    Categorie: account.category ?? "",
    Prioriteit: account.priority ?? "",
    Gemeente: account.gemeente ?? "",
    Telefoon: account.phone ?? "",
    "E-mail": account.email ?? "",
    Software: account.softwareStatus ?? "",
    Belstatus: CALL_STATUS_LABELS[account.callStatus],
    "Volgende actie": account.nextActionDate ?? "",
    Afgehandeld: account.isDone ? "ja" : "nee",
  };
}

export function ExportCsvButton({ rows }: { rows: Account[] }) {
  function handleExport() {
    const csv = toCsv(rows.map(toExportRow));
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `prospecten-${date}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={rows.length === 0}
    >
      <Download className="size-4" />
      Exporteer CSV
    </Button>
  );
}
