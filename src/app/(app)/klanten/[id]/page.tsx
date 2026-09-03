import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { db } from "@/db";
import { accounts, accountSnapshots } from "@/db/schema";
import { requireUser } from "@/lib/auth-guards";
import { computeHealthScore } from "@/lib/health-score";
import { HealthBadge } from "@/components/accounts/health-badge";
import {
  buildKpiSeries,
  daysAgoFromNow,
  deltaPct,
  findClosestSnapshot,
} from "@/lib/kpi-series";
import type { KpiTenantBlock } from "@/lib/kpi-schema";
import type { ChartPoint } from "@/lib/chart-scale";
import {
  formatCurrency,
  formatDateTimeNl,
  formatDecimal,
  formatInt,
} from "@/lib/format-nl";
import { MetricChartCard } from "@/components/klanten/metric-chart-card";
import { Card, CardContent } from "@/components/ui/card";

// Leest rechtstreeks uit de DB — nooit statisch prerenderen.
export const dynamic = "force-dynamic";

const idSchema = z.string().uuid();
const DAY_MS = 24 * 60 * 60 * 1000;

type SnapshotRow = { capturedAt: Date; kpis: KpiTenantBlock };

function toChartPoints(
  snapshots: SnapshotRow[],
  pick: (kpis: KpiTenantBlock) => number,
): ChartPoint[] {
  return snapshots.map((snapshot) => ({
    date: snapshot.capturedAt,
    value: pick(snapshot.kpis),
  }));
}

export default async function KlantDetailPage({
  params,
}: PageProps<"/klanten/[id]">) {
  const { id } = await params;

  await requireUser();

  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) notFound();

  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, parsedId.data))
    .limit(1);

  if (!account) notFound();
  if (account.type !== "customer" || account.equimanegeManegeId === null) {
    notFound();
  }

  const snapshotRows = await db
    .select({
      capturedAt: accountSnapshots.capturedAt,
      kpis: accountSnapshots.kpis,
    })
    .from(accountSnapshots)
    .where(
      and(
        eq(accountSnapshots.accountId, account.id),
        gte(accountSnapshots.capturedAt, daysAgoFromNow(90)),
      ),
    )
    .orderBy(asc(accountSnapshots.capturedAt));

  const snapshots: SnapshotRow[] = snapshotRows.map((row) => ({
    capturedAt: row.capturedAt,
    kpis: row.kpis as KpiTenantBlock,
  }));

  const now = new Date();

  const header = (
    <div className="flex flex-col gap-4">
      <Link
        href="/klanten"
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Terug naar Klanten
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{account.name}</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {account.gemeente ?? "—"}
          </p>
        </div>
        <Link
          href={`/accounts/${account.id}`}
          className="flex items-center gap-1.5 text-sm font-medium text-foreground underline-offset-4 hover:underline"
        >
          Naar accountdetail
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );

  if (snapshots.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              Nog geen KPI-gegevens voor deze klant — de eerste synchronisatie
              draait vannacht.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const latestSnapshot = snapshots[snapshots.length - 1];
  const latest = latestSnapshot.kpis;
  const previousSnapshot = findClosestSnapshot(
    snapshots.slice(0, -1),
    latestSnapshot.capturedAt.getTime() - 30 * DAY_MS,
  );
  const health = computeHealthScore(latest, previousSnapshot?.kpis ?? null, now);

  const windowStartMs = latestSnapshot.capturedAt.getTime() - 30 * DAY_MS;
  const last30d = snapshots.filter(
    (snapshot) => snapshot.capturedAt.getTime() >= windowStartMs,
  );

  function deltaFor(pick: (kpis: KpiTenantBlock) => number): number | null {
    return deltaPct(buildKpiSeries(last30d, pick));
  }

  const occupancyPoints = toChartPoints(
    snapshots,
    (k) => k.lessons.occupancy_rate_30d * 100,
  );

  return (
    <div className="flex flex-col gap-6">
      {header}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <HealthBadge level={health.level} reasons={health.reasons} />
        </div>
        <span className="text-xs text-muted-foreground">
          Laatste sync: {formatDateTimeNl(latestSnapshot.capturedAt)}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricChartCard
          title="Actieve leden"
          currentValueLabel={formatInt(latest.members.active)}
          delta={deltaFor((k) => k.members.active)}
          points={toChartPoints(snapshots, (k) => k.members.active)}
          yFormat={formatInt}
        />

        <MetricChartCard
          title="Geplande & voltooide lessen"
          currentValueLabel={formatInt(latest.lessons.upcoming)}
          delta={deltaFor((k) => k.lessons.upcoming)}
          points={toChartPoints(snapshots, (k) => k.lessons.upcoming)}
          series2={toChartPoints(snapshots, (k) => k.lessons.completed_30d)}
          seriesLabels={{ primary: "Gepland", secondary: "Voltooid (30d)" }}
          yFormat={formatInt}
        />

        <MetricChartCard
          title="Bezettingsgraad (30d)"
          currentValueLabel={`${Math.round(latest.lessons.occupancy_rate_30d * 100)}%`}
          delta={deltaFor((k) => k.lessons.occupancy_rate_30d)}
          points={occupancyPoints}
          yFormat={(value) => `${Math.round(value)}%`}
          yDomain={[0, 100]}
        />

        <MetricChartCard
          title="Gefactureerd (30d)"
          currentValueLabel={formatCurrency(latest.commercial.invoiced_30d)}
          delta={deltaFor((k) => k.commercial.invoiced_30d)}
          points={toChartPoints(snapshots, (k) => k.commercial.invoiced_30d)}
          yFormat={formatCurrency}
        />

        <MetricChartCard
          title="Actieve pushdevices"
          currentValueLabel={formatInt(latest.engagement.active_push_devices_30d)}
          delta={deltaFor((k) => k.engagement.active_push_devices_30d)}
          points={toChartPoints(snapshots, (k) => k.engagement.active_push_devices_30d)}
          yFormat={formatInt}
        />

        <MetricChartCard
          title="Gem. deelnemers per les"
          currentValueLabel={formatDecimal(latest.lessons.avg_participants_30d)}
          delta={deltaFor((k) => k.lessons.avg_participants_30d)}
          points={toChartPoints(snapshots, (k) => k.lessons.avg_participants_30d)}
          yFormat={formatDecimal}
        />
      </div>
    </div>
  );
}
