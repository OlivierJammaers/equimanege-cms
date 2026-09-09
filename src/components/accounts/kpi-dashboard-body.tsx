"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { HealthBadge } from "@/components/accounts/health-badge";
import { KpiSyncButton } from "@/components/accounts/kpi-sync-button";
import { PeriodToggle } from "@/components/accounts/period-toggle";
import { Sparkline } from "@/components/accounts/sparkline";
import { DeltaBadge } from "@/components/accounts/delta-badge";
import type { HealthScore } from "@/lib/health-score";
import { buildKpiSeries, deltaPct } from "@/lib/kpi-series";
import { periodDays, windowValues, type KpiPeriod } from "@/lib/kpi-period";
import type { KpiTenantBlock, KpiWindow } from "@/lib/kpi-schema";
import {
  formatCurrency,
  formatDateTimeNl,
  formatDecimal,
  formatInt,
  formatPercent,
  formatRelativeNl,
} from "@/lib/format-nl";

const DAY_MS = 24 * 60 * 60 * 1000;

const PERIOD_SUFFIX: Record<KpiPeriod, string> = {
  "24h": "24u",
  "7d": "7d",
  "30d": "30d",
};

function KpiGroupCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col divide-y divide-border/60">
        {children}
      </CardContent>
    </Card>
  );
}

function MetricRow({
  label,
  valueLabel,
  series,
  upIsGood = true,
}: {
  label: string;
  valueLabel: React.ReactNode;
  series?: number[];
  upIsGood?: boolean;
}) {
  const delta = series ? deltaPct(series) : null;

  return (
    <div className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-sm font-medium tabular-nums text-foreground">
          {valueLabel}
        </span>
      </div>
      {series !== undefined ? (
        <div className="flex shrink-0 items-center gap-2">
          <Sparkline
            values={series}
            ariaLabel={`${label}: van ${series[0]} naar ${series[series.length - 1]}`}
          />
          <DeltaBadge delta={delta} upIsGood={upIsGood} />
        </div>
      ) : null}
    </div>
  );
}

type SnapshotRow = {
  capturedAt: Date;
  kpis: KpiTenantBlock;
};

/**
 * Client-body van het KPI-dashboard op het accountdetail: houdt de
 * geselecteerde periode (24u/7d/30d, standaard 30d) bij en rendert de
 * header (incl. periodetoggle, naast "Nu synchroniseren") + de stat-kaarten.
 * Window-metrics (bv. "Gefactureerd") lezen hun waarde via
 * `windowValues(latest, period)` (`@/lib/kpi-period`); niet-window-metrics
 * (actieve leden, geplande lessen, maandprijs, adoptie, laatst actief)
 * blijven ongewijzigd over elke periode. Verplaatst uit het voormalige
 * server component `kpi-dashboard.tsx` omdat de periodetoggle client-state
 * nodig heeft.
 */
export function KpiDashboardBody({
  snapshots,
  health,
  isAdmin,
  accountId,
  now,
}: {
  snapshots: SnapshotRow[];
  health: HealthScore;
  isAdmin: boolean;
  accountId: string;
  now: Date;
}) {
  const [period, setPeriod] = useState<KpiPeriod>("30d");

  const latestSnapshot = snapshots[snapshots.length - 1];
  const latest = latestSnapshot.kpis;

  // Vaste 30d-reeks voor metrics die niet per periode wijzigen.
  const fixed30dStartMs = latestSnapshot.capturedAt.getTime() - 30 * DAY_MS;
  const fixed30d = snapshots.filter(
    (snapshot) => snapshot.capturedAt.getTime() >= fixed30dStartMs,
  );
  function fixedSeriesFor(pick: (k: KpiTenantBlock) => number): number[] {
    return buildKpiSeries(fixed30d, pick);
  }

  const windowStartMs =
    latestSnapshot.capturedAt.getTime() - periodDays(period) * DAY_MS;
  const inWindowSnapshots = snapshots.filter(
    (snapshot) => snapshot.capturedAt.getTime() >= windowStartMs,
  );

  const currentWindow = windowValues(latest, period);
  const windowUnavailable = currentWindow === null;

  function windowSeriesFor(pick: (w: KpiWindow) => number): number[] {
    const values: number[] = [];
    for (const snapshot of inWindowSnapshots) {
      const w = windowValues(snapshot.kpis, period);
      if (w) values.push(pick(w));
    }
    return values;
  }

  function windowValueLabel(
    format: (n: number) => string,
    pick: (w: KpiWindow) => number,
  ): string {
    return currentWindow ? format(pick(currentWindow)) : "—";
  }

  function windowSeries(
    pick: (w: KpiWindow) => number,
  ): number[] | undefined {
    return currentWindow ? windowSeriesFor(pick) : undefined;
  }

  const suffix = PERIOD_SUFFIX[period];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
            EquiManage KPI&apos;s
          </h2>
          <HealthBadge level={health.level} reasons={health.reasons} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <PeriodToggle value={period} onValueChange={setPeriod} />
          <span className="text-xs text-muted-foreground">
            Laatste sync: {formatDateTimeNl(latestSnapshot.capturedAt)}
          </span>
          {isAdmin ? <KpiSyncButton accountId={accountId} /> : null}
        </div>
      </div>

      {windowUnavailable ? (
        <p className="text-xs text-muted-foreground">
          Beschikbaar na de volgende synchronisatie.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiGroupCard title="Lessen">
          <MetricRow
            label="Geplande lessen"
            valueLabel={formatInt(latest.lessons.upcoming)}
            series={fixedSeriesFor((k) => k.lessons.upcoming)}
          />
          <MetricRow
            label={`Gem. deelnemers (${suffix})`}
            valueLabel={windowValueLabel(formatDecimal, (w) => w.avg_participants)}
            series={windowSeries((w) => w.avg_participants)}
          />
          <MetricRow
            label={`Bezettingsgraad (${suffix})`}
            valueLabel={windowValueLabel(formatPercent, (w) => w.occupancy_rate)}
            series={windowSeries((w) => w.occupancy_rate)}
          />
          <MetricRow
            label="Annuleringsgraad (90d)"
            valueLabel={formatPercent(latest.lessons.cancellation_rate_90d)}
            series={fixedSeriesFor((k) => k.lessons.cancellation_rate_90d)}
            upIsGood={false}
          />
        </KpiGroupCard>

        <KpiGroupCard title="Leden">
          <MetricRow
            label="Actieve leden"
            valueLabel={`${formatInt(latest.members.active)} / ${formatInt(latest.members.total)}`}
            series={fixedSeriesFor((k) => k.members.active)}
          />
          <MetricRow
            label={`Nieuw (${suffix})`}
            valueLabel={windowValueLabel(formatInt, (w) => w.new_members)}
            series={windowSeries((w) => w.new_members)}
          />
          <MetricRow
            label="Vervalt binnenkort (30d)"
            valueLabel={formatInt(latest.members.expiring_30d)}
            series={fixedSeriesFor((k) => k.members.expiring_30d)}
            upIsGood={false}
          />
        </KpiGroupCard>

        <KpiGroupCard title="Engagement">
          <MetricRow
            label="Laatst actief"
            valueLabel={formatRelativeNl(latest.engagement.last_active_at, now)}
          />
          <MetricRow
            label={`Actieve pushdevices (${suffix})`}
            valueLabel={windowValueLabel(formatInt, (w) => w.active_push_devices)}
            series={windowSeries((w) => w.active_push_devices)}
          />
          <MetricRow
            label={`Chatberichten (${suffix})`}
            valueLabel={windowValueLabel(formatInt, (w) => w.chat_messages)}
            series={windowSeries((w) => w.chat_messages)}
          />
        </KpiGroupCard>

        <KpiGroupCard title="Commercieel">
          <MetricRow
            label="Maandprijs"
            valueLabel={formatCurrency(latest.commercial.monthly_price)}
            series={fixedSeriesFor((k) => k.commercial.monthly_price)}
          />
          <MetricRow
            label={`Gefactureerd (${suffix})`}
            valueLabel={windowValueLabel(formatCurrency, (w) => w.invoiced)}
            series={windowSeries((w) => w.invoiced)}
          />
          <MetricRow
            label="Facturen achterstallig"
            valueLabel={formatInt(latest.commercial.invoices_overdue)}
            series={fixedSeriesFor((k) => k.commercial.invoices_overdue)}
            upIsGood={false}
          />
        </KpiGroupCard>

        <KpiGroupCard title="Adoptie">
          <MetricRow
            label="Paarden"
            valueLabel={formatInt(latest.adoption.horses)}
            series={fixedSeriesFor((k) => k.adoption.horses)}
          />
          <MetricRow
            label="Piste's"
            valueLabel={formatInt(latest.adoption.pistes)}
            series={fixedSeriesFor((k) => k.adoption.pistes)}
          />
          <MetricRow
            label="Groepen"
            valueLabel={formatInt(latest.adoption.groups)}
            series={fixedSeriesFor((k) => k.adoption.groups)}
          />
          <MetricRow
            label="Facturatie in gebruik"
            valueLabel={latest.adoption.invoicing_in_use ? "Ja" : "Nee"}
          />
        </KpiGroupCard>
      </div>
    </div>
  );
}
