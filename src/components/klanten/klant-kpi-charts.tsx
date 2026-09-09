"use client";

import { useState } from "react";
import { HealthBadge } from "@/components/accounts/health-badge";
import { PeriodToggle } from "@/components/accounts/period-toggle";
import { MetricChartCard } from "@/components/klanten/metric-chart-card";
import { buildKpiSeries, deltaPct } from "@/lib/kpi-series";
import { periodDays, windowValues, type KpiPeriod } from "@/lib/kpi-period";
import type { KpiTenantBlock, KpiWindow } from "@/lib/kpi-schema";
import type { ChartPoint } from "@/lib/chart-scale";
import type { HealthScore } from "@/lib/health-score";
import {
  formatCurrency,
  formatDateTimeNl,
  formatDecimal,
  formatInt,
} from "@/lib/format-nl";

const DAY_MS = 24 * 60 * 60 * 1000;
// "24 uur" heeft geen zinvol eigen snapshot-interval (nachtelijke sync) —
// neem de laatste 2 snapshot-dagen zodat er wel een lijn te tekenen valt.
const RANGE_24H_DAYS = 2;

const PERIOD_SUFFIX: Record<KpiPeriod, string> = {
  "24h": "24u",
  "7d": "7d",
  "30d": "30d",
};

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

/** Zoals `toChartPoints`, maar leest via `windowValues` — slaat snapshots
 * zonder het gevraagde venster over (oudere snapshots zonder `windows`). */
function toWindowChartPoints(
  snapshots: SnapshotRow[],
  period: KpiPeriod,
  pick: (w: KpiWindow) => number,
): ChartPoint[] {
  const points: ChartPoint[] = [];
  for (const snapshot of snapshots) {
    const w = windowValues(snapshot.kpis, period);
    if (w) points.push({ date: snapshot.capturedAt, value: pick(w) });
  }
  return points;
}

/**
 * Client-body van de klant-grafiekenpagina (`/klanten/[id]`): houdt de
 * geselecteerde periode (24u/7d/30d, standaard 30d) bij en bepaalt zowel het
 * grafiekbereik (welke snapshots) als — voor metrics met een venster-
 * equivalent (bezettingsgraad, gefactureerd, gem. deelnemers, voltooide
 * lessen) — de geplotte waarden via `windowValues` (`@/lib/kpi-period`).
 * Voorraad-achtige metrics (actieve leden, geplande lessen, pushdevices)
 * gebruiken altijd hun huidige veld en volgen enkel het bereik.
 */
export function KlantKpiCharts({
  snapshots,
  health,
}: {
  snapshots: SnapshotRow[];
  health: HealthScore;
}) {
  const [period, setPeriod] = useState<KpiPeriod>("30d");

  const latestSnapshot = snapshots[snapshots.length - 1];
  const latest = latestSnapshot.kpis;

  const rangeDays = period === "24h" ? RANGE_24H_DAYS : periodDays(period);
  const rangeStartMs = latestSnapshot.capturedAt.getTime() - rangeDays * DAY_MS;
  const rangeSnapshots = snapshots.filter(
    (snapshot) => snapshot.capturedAt.getTime() >= rangeStartMs,
  );

  function deltaFor(pick: (kpis: KpiTenantBlock) => number): number | null {
    return deltaPct(buildKpiSeries(rangeSnapshots, pick));
  }

  const currentWindow = windowValues(latest, period);
  const windowUnavailable = currentWindow === null;
  const suffix = PERIOD_SUFFIX[period];

  function windowDelta(pick: (w: KpiWindow) => number): number | null {
    const points = toWindowChartPoints(rangeSnapshots, period, pick).map(
      (p) => p.value,
    );
    return deltaPct(points);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <HealthBadge level={health.level} reasons={health.reasons} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <PeriodToggle value={period} onValueChange={setPeriod} />
          <span className="text-xs text-muted-foreground">
            Laatste sync: {formatDateTimeNl(latestSnapshot.capturedAt)}
          </span>
        </div>
      </div>

      {windowUnavailable ? (
        <p className="text-xs text-muted-foreground">
          Beschikbaar na de volgende synchronisatie.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricChartCard
          title="Actieve leden"
          currentValueLabel={formatInt(latest.members.active)}
          delta={deltaFor((k) => k.members.active)}
          points={toChartPoints(rangeSnapshots, (k) => k.members.active)}
          yFormat={formatInt}
        />

        <MetricChartCard
          title="Geplande & voltooide lessen"
          currentValueLabel={formatInt(latest.lessons.upcoming)}
          delta={deltaFor((k) => k.lessons.upcoming)}
          points={toChartPoints(rangeSnapshots, (k) => k.lessons.upcoming)}
          series2={toWindowChartPoints(
            rangeSnapshots,
            period,
            (w) => w.completed_lessons,
          )}
          seriesLabels={{ primary: "Gepland", secondary: `Voltooid (${suffix})` }}
          yFormat={formatInt}
        />

        <MetricChartCard
          title={`Bezettingsgraad (${suffix})`}
          currentValueLabel={
            currentWindow ? `${Math.round(currentWindow.occupancy_rate * 100)}%` : "—"
          }
          delta={currentWindow ? windowDelta((w) => w.occupancy_rate) : null}
          points={toWindowChartPoints(
            rangeSnapshots,
            period,
            (w) => w.occupancy_rate * 100,
          )}
          yFormat={(value) => `${Math.round(value)}%`}
          yDomain={[0, 100]}
        />

        <MetricChartCard
          title={`Gefactureerd (${suffix})`}
          currentValueLabel={currentWindow ? formatCurrency(currentWindow.invoiced) : "—"}
          delta={currentWindow ? windowDelta((w) => w.invoiced) : null}
          points={toWindowChartPoints(rangeSnapshots, period, (w) => w.invoiced)}
          yFormat={formatCurrency}
        />

        <MetricChartCard
          title="Actieve pushdevices"
          currentValueLabel={formatInt(latest.engagement.active_push_devices_30d)}
          delta={deltaFor((k) => k.engagement.active_push_devices_30d)}
          points={toChartPoints(
            rangeSnapshots,
            (k) => k.engagement.active_push_devices_30d,
          )}
          yFormat={formatInt}
        />

        <MetricChartCard
          title={`Gem. deelnemers per les (${suffix})`}
          currentValueLabel={
            currentWindow ? formatDecimal(currentWindow.avg_participants) : "—"
          }
          delta={currentWindow ? windowDelta((w) => w.avg_participants) : null}
          points={toWindowChartPoints(
            rangeSnapshots,
            period,
            (w) => w.avg_participants,
          )}
          yFormat={formatDecimal}
        />
      </div>
    </div>
  );
}
