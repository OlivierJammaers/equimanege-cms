import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeltaBadge } from "@/components/accounts/delta-badge";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import type { ChartPoint } from "@/lib/chart-scale";

/**
 * Eén grafiek-kaart op het klant-detail-dashboard: titel + huidige waarde
 * groot (tabular-nums) + delta-badge (30d, via `deltaPct`) + de tijdreeks
 * zelf. Server component, puur props in.
 */
export function MetricChartCard({
  title,
  currentValueLabel,
  delta,
  upIsGood = true,
  points,
  series2,
  seriesLabels,
  yFormat,
  yDomain,
}: {
  title: string;
  currentValueLabel: string;
  delta: number | null;
  upIsGood?: boolean;
  points: ChartPoint[];
  series2?: ChartPoint[];
  seriesLabels?: { primary: string; secondary?: string };
  yFormat?: (value: number) => string;
  yDomain?: [number, number];
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {title}
            </CardTitle>
            <span className="text-2xl font-semibold tabular-nums text-foreground">
              {currentValueLabel}
            </span>
          </div>
          <DeltaBadge delta={delta} upIsGood={upIsGood} className="mt-1" />
        </div>
      </CardHeader>
      <CardContent>
        <TimeSeriesChart
          points={points}
          series2={series2}
          labels={seriesLabels}
          yFormat={yFormat}
          yDomain={yDomain}
        />
      </CardContent>
    </Card>
  );
}
