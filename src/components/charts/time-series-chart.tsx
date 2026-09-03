import { niceTicks, toPolyline, type ChartPoint } from "@/lib/chart-scale";
import { formatDateShortNl } from "@/lib/format-nl";
import { cn } from "@/lib/utils";

const VIEW_WIDTH = 480;
const PADDING_LEFT = 40;
const PADDING_RIGHT = 8;
const PADDING_TOP = 10;
const PADDING_BOTTOM = 22;
const TICK_COUNT = 4;

function pathD(points: { x: number; y: number }[]): string {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(" ");
}

function areaD(points: { x: number; y: number }[], baselineY: number): string {
  if (points.length === 0) return "";
  const first = points[0];
  const last = points[points.length - 1];
  return `${pathD(points)} L${last.x.toFixed(2)},${baselineY.toFixed(2)} L${first.x.toFixed(2)},${baselineY.toFixed(2)} Z`;
}

/**
 * Herbruikbare, pure-SVG tijdreeksgrafiek — géén chart-library (dataviz-skill).
 * Server component: alles wordt berekend uit props via `chart-scale.ts`
 * (`niceTicks`/`toPolyline`), geen client-state of interactiviteit.
 *
 * Marks: 2px lijn (`stroke-currentColor`, primaire reeks in de tekstkleur
 * van de wrapper), tweede reeks gedempt + gestippeld, subtiele vlakvulling
 * (~6% opacity), hairline-gridlines, tick-labels in `tabular-nums`.
 * Sparse states: 0 punten → gedempt "—"; 1 punt → grote waarde + NL-notitie
 * i.p.v. een lijn die niets toont.
 */
export function TimeSeriesChart({
  points,
  series2,
  labels,
  yFormat = (value) => String(Math.round(value)),
  yDomain,
  height = 140,
  className,
  ariaLabel,
}: {
  points: ChartPoint[];
  series2?: ChartPoint[];
  labels?: { primary: string; secondary?: string };
  yFormat?: (value: number) => string;
  yDomain?: [number, number];
  height?: number;
  className?: string;
  ariaLabel?: string;
}) {
  const hasSecondary = (series2?.length ?? 0) > 0;
  const totalPoints = points.length + (series2?.length ?? 0);

  if (totalPoints === 0) {
    return (
      <div
        role="img"
        aria-label={ariaLabel ?? "Geen gegevens beschikbaar"}
        className={cn("flex items-center justify-center text-sm text-muted-foreground", className)}
        style={{ height }}
      >
        —
      </div>
    );
  }

  if (points.length <= 1 && (!hasSecondary || series2!.length <= 1)) {
    const value = points[0]?.value ?? series2![0]?.value ?? 0;
    return (
      <div
        role="img"
        aria-label={ariaLabel ?? `Eén meting: ${yFormat(value)}. Trends verschijnen na meerdere snapshots.`}
        className={cn("flex h-full flex-col items-center justify-center gap-1 text-center", className)}
        style={{ height }}
      >
        <span className="text-lg font-semibold tabular-nums text-foreground">{yFormat(value)}</span>
        <p className="text-xs text-muted-foreground">
          Trends verschijnen na meerdere snapshots
        </p>
      </div>
    );
  }

  const allValues = [...points, ...(series2 ?? [])].map((p) => p.value);
  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);

  const ticks = yDomain
    ? niceTicks(yDomain[0], yDomain[1], TICK_COUNT)
    : niceTicks(rawMin, rawMax, TICK_COUNT);
  const domain: [number, number] = [ticks[0], ticks[ticks.length - 1]];

  const plotWidth = VIEW_WIDTH - PADDING_LEFT - PADDING_RIGHT;
  const plotHeight = Math.max(1, height - PADDING_TOP - PADDING_BOTTOM);
  const baselineY = PADDING_TOP + plotHeight;

  function toPlot(pts: ChartPoint[]) {
    return toPolyline(pts, plotWidth, plotHeight, domain).map((p) => ({
      x: p.x + PADDING_LEFT,
      y: p.y + PADDING_TOP,
    }));
  }

  const primaryPts = points.length > 0 ? toPlot(points) : [];
  const secondaryPts = hasSecondary ? toPlot(series2!) : [];

  const dateSource = points.length > 0 ? points : series2!;
  const firstDate = dateSource[0].date;
  const lastDate = dateSource[dateSource.length - 1].date;

  const lastPrimary = primaryPts[primaryPts.length - 1];
  const lastSecondary = secondaryPts[secondaryPts.length - 1];

  const description =
    ariaLabel ??
    `${labels?.primary ?? "Waarde"} van ${yFormat(points[0]?.value ?? 0)} naar ${yFormat(points[points.length - 1]?.value ?? 0)} tussen ${formatDateShortNl(firstDate)} en ${formatDateShortNl(lastDate)}`;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${height}`}
        preserveAspectRatio="none"
        className="h-auto w-full text-foreground"
        style={{ height }}
        role="img"
        aria-label={description}
      >
        {/* Gridlines + y-tick-labels */}
        {ticks.map((tick) => {
          const [dMin, dMax] = domain;
          const t = dMax === dMin ? 0.5 : (tick - dMin) / (dMax - dMin);
          const y = baselineY - t * plotHeight;
          return (
            <g key={tick}>
              <line
                x1={PADDING_LEFT}
                x2={VIEW_WIDTH - PADDING_RIGHT}
                y1={y}
                y2={y}
                className="stroke-border"
                strokeWidth={1}
              />
              <text
                x={PADDING_LEFT - 6}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-muted-foreground tabular-nums"
                style={{ fontSize: 10 }}
              >
                {yFormat(tick)}
              </text>
            </g>
          );
        })}

        {/* X-as: eerste en laatste datum */}
        <text
          x={PADDING_LEFT}
          y={height - 6}
          textAnchor="start"
          className="fill-muted-foreground"
          style={{ fontSize: 10 }}
        >
          {formatDateShortNl(firstDate)}
        </text>
        <text
          x={VIEW_WIDTH - PADDING_RIGHT}
          y={height - 6}
          textAnchor="end"
          className="fill-muted-foreground"
          style={{ fontSize: 10 }}
        >
          {formatDateShortNl(lastDate)}
        </text>

        {/* Secundaire reeks: gedempt + gestippeld, geen vlakvulling */}
        {secondaryPts.length > 0 ? (
          <g className="text-muted-foreground">
            <path
              d={pathD(secondaryPts)}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="5 4"
            />
            {lastSecondary ? (
              <circle
                cx={lastSecondary.x}
                cy={lastSecondary.y}
                r={3}
                fill="currentColor"
                stroke="var(--background)"
                strokeWidth={2}
              />
            ) : null}
          </g>
        ) : null}

        {/* Primaire reeks: subtiele vlakvulling + 2px lijn + eindpunt */}
        {primaryPts.length > 0 ? (
          <>
            <path d={areaD(primaryPts, baselineY)} fill="currentColor" fillOpacity={0.06} stroke="none" />
            <path
              d={pathD(primaryPts)}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {lastPrimary ? (
              <circle
                cx={lastPrimary.x}
                cy={lastPrimary.y}
                r={3}
                fill="currentColor"
                stroke="var(--background)"
                strokeWidth={2}
              />
            ) : null}
          </>
        ) : null}
      </svg>

      {hasSecondary && labels ? (
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 rounded-full bg-foreground" aria-hidden="true" />
            {labels.primary}
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="h-0.5 w-3 rounded-full border-t-2 border-dashed border-muted-foreground"
              aria-hidden="true"
            />
            {labels.secondary}
          </span>
        </div>
      ) : null}
    </div>
  );
}
