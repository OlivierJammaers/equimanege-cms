import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { HealthBadge } from "@/components/accounts/health-badge";
import { KpiSyncButton } from "@/components/accounts/kpi-sync-button";
import { Sparkline } from "@/components/accounts/sparkline";
import { DeltaBadge } from "@/components/accounts/delta-badge";
import { computeHealthScore } from "@/lib/health-score";
import { buildKpiSeries, deltaPct, findClosestSnapshot } from "@/lib/kpi-series";
import type { KpiTenantBlock } from "@/lib/kpi-schema";
import {
  formatCurrency,
  formatDateTimeNl,
  formatDecimal,
  formatInt,
  formatPercent,
  formatRelativeNl,
} from "@/lib/format-nl";

const DAY_MS = 24 * 60 * 60 * 1000;

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
            ariaLabel={`${label}, laatste 30 dagen: van ${series[0]} naar ${series[series.length - 1]}`}
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
 * KPI-dashboard op het accountdetail voor gekoppelde klanten. Toont de
 * actuele EquiManage-cijfers per groep, een 30d-sparkline + delta per
 * metriek, en de gezondheidsscore (`computeHealthScore`, `src/lib/health-score.ts`)
 * prominent bij de kop. Server component — leest alleen props, geen eigen
 * databasetoegang.
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

  const windowStartMs = latestSnapshot.capturedAt.getTime() - 30 * DAY_MS;
  const last30d = sorted.filter(
    (snapshot) => snapshot.capturedAt.getTime() >= windowStartMs,
  );

  function seriesFor(pick: (k: KpiTenantBlock) => number): number[] {
    return buildKpiSeries(last30d, pick);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
            EquiManage KPI&apos;s
          </h2>
          <HealthBadge level={health.level} reasons={health.reasons} />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            Laatste sync: {formatDateTimeNl(latestSnapshot.capturedAt)}
          </span>
          {isAdmin ? <KpiSyncButton accountId={accountId} /> : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiGroupCard title="Lessen">
          <MetricRow
            label="Geplande lessen"
            valueLabel={formatInt(latest.lessons.upcoming)}
            series={seriesFor((k) => k.lessons.upcoming)}
          />
          <MetricRow
            label="Gem. deelnemers (30d)"
            valueLabel={formatDecimal(latest.lessons.avg_participants_30d)}
            series={seriesFor((k) => k.lessons.avg_participants_30d)}
          />
          <MetricRow
            label="Bezettingsgraad (30d)"
            valueLabel={formatPercent(latest.lessons.occupancy_rate_30d)}
            series={seriesFor((k) => k.lessons.occupancy_rate_30d)}
          />
          <MetricRow
            label="Annuleringsgraad (90d)"
            valueLabel={formatPercent(latest.lessons.cancellation_rate_90d)}
            series={seriesFor((k) => k.lessons.cancellation_rate_90d)}
            upIsGood={false}
          />
        </KpiGroupCard>

        <KpiGroupCard title="Leden">
          <MetricRow
            label="Actieve leden"
            valueLabel={`${formatInt(latest.members.active)} / ${formatInt(latest.members.total)}`}
            series={seriesFor((k) => k.members.active)}
          />
          <MetricRow
            label="Nieuw (30d)"
            valueLabel={formatInt(latest.members.new_30d)}
            series={seriesFor((k) => k.members.new_30d)}
          />
          <MetricRow
            label="Vervalt binnenkort (30d)"
            valueLabel={formatInt(latest.members.expiring_30d)}
            series={seriesFor((k) => k.members.expiring_30d)}
            upIsGood={false}
          />
        </KpiGroupCard>

        <KpiGroupCard title="Engagement">
          <MetricRow
            label="Laatst actief"
            valueLabel={formatRelativeNl(latest.engagement.last_active_at, now)}
          />
          <MetricRow
            label="Actieve pushdevices (30d)"
            valueLabel={formatInt(latest.engagement.active_push_devices_30d)}
            series={seriesFor((k) => k.engagement.active_push_devices_30d)}
          />
          <MetricRow
            label="Chatberichten (30d)"
            valueLabel={formatInt(latest.engagement.chat_messages_30d)}
            series={seriesFor((k) => k.engagement.chat_messages_30d)}
          />
        </KpiGroupCard>

        <KpiGroupCard title="Commercieel">
          <MetricRow
            label="Maandprijs"
            valueLabel={formatCurrency(latest.commercial.monthly_price)}
            series={seriesFor((k) => k.commercial.monthly_price)}
          />
          <MetricRow
            label="Gefactureerd (30d)"
            valueLabel={formatCurrency(latest.commercial.invoiced_30d)}
            series={seriesFor((k) => k.commercial.invoiced_30d)}
          />
          <MetricRow
            label="Facturen achterstallig"
            valueLabel={formatInt(latest.commercial.invoices_overdue)}
            series={seriesFor((k) => k.commercial.invoices_overdue)}
            upIsGood={false}
          />
        </KpiGroupCard>

        <KpiGroupCard title="Adoptie">
          <MetricRow
            label="Paarden"
            valueLabel={formatInt(latest.adoption.horses)}
            series={seriesFor((k) => k.adoption.horses)}
          />
          <MetricRow
            label="Piste's"
            valueLabel={formatInt(latest.adoption.pistes)}
            series={seriesFor((k) => k.adoption.pistes)}
          />
          <MetricRow
            label="Groepen"
            valueLabel={formatInt(latest.adoption.groups)}
            series={seriesFor((k) => k.adoption.groups)}
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
