import { Card, CardContent } from "@/components/ui/card";
import { KpiSyncButton } from "@/components/accounts/kpi-sync-button";
import { KpiDashboardBody } from "@/components/accounts/kpi-dashboard-body";
import { computeHealthScore } from "@/lib/health-score";
import { findClosestSnapshot } from "@/lib/kpi-series";
import type { KpiTenantBlock } from "@/lib/kpi-schema";

const DAY_MS = 24 * 60 * 60 * 1000;

type SnapshotRow = {
  capturedAt: Date;
  kpis: KpiTenantBlock;
};

/**
 * KPI-dashboard op het accountdetail voor gekoppelde klanten. Bepaalt de
 * gezondheidsscore (`computeHealthScore`, `src/lib/health-score.ts`) en
 * geeft de gesorteerde snapshots door aan `KpiDashboardBody` (client — houdt
 * de 24u/7d/30d-periodetoggle bij). Server component: leest alleen props,
 * geen eigen databasetoegang.
 */
export function KpiDashboard({
  snapshots,
  isAdmin,
  accountId,
}: {
  snapshots: SnapshotRow[];
  isAdmin: boolean;
  accountId: string;
}) {
  const sorted = [...snapshots].sort(
    (a, b) => a.capturedAt.getTime() - b.capturedAt.getTime(),
  );

  if (sorted.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            Nog geen KPI-gegevens — de eerste synchronisatie draait
            vannacht.
          </p>
          {isAdmin ? <KpiSyncButton accountId={accountId} /> : null}
        </CardContent>
      </Card>
    );
  }

  const latestSnapshot = sorted[sorted.length - 1];
  const latest = latestSnapshot.kpis;
  const now = new Date();

  const olderSnapshots = sorted.slice(0, -1);
  const previousSnapshot = findClosestSnapshot(
    olderSnapshots,
    latestSnapshot.capturedAt.getTime() - 30 * DAY_MS,
  );
  const previous = previousSnapshot?.kpis ?? null;

  const health = computeHealthScore(latest, previous, now);

  return (
    <KpiDashboardBody
      snapshots={sorted}
      health={health}
      isAdmin={isAdmin}
      accountId={accountId}
      now={now}
    />
  );
}
