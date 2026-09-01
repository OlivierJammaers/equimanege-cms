"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { runKpiSyncNow } from "@/server/actions/kpi-link";

/**
 * Admin-only knop die de KPI-sync handmatig triggert (zelfde `syncKpis` als
 * de nachtelijke cron), zodat een net gekoppelde tenant niet tot de
 * volgende nacht hoeft te wachten op de eerste snapshot.
 */
export function KpiSyncButton({ accountId }: { accountId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      try {
        const result = await runKpiSyncNow(accountId);
        toast.success(
          `Synchronisatie voltooid — ${result.synced} nieuw, ${result.skippedExisting} al vandaag gesynchroniseerd.`,
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Synchronisatie mislukt",
        );
      }
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={isPending}
    >
      {isPending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <RefreshCw className="size-3.5" />
      )}
      Nu synchroniseren
    </Button>
  );
}
