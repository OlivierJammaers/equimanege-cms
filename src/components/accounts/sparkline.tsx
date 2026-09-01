import { cn } from "@/lib/utils";

const VIEW_WIDTH = 100;
const VIEW_HEIGHT = 32;
const PADDING = 3;

/**
 * Kleine inline trendlijn zonder chart-library (dataviz-skill: enkele hue,
 * geen assen/gridlines op dit schaalniveau, punt-marker aan het einde).
 * `stroke-currentColor` — kleur wordt bepaald door de tekstkleur van de
 * omringende container (standaard gedempt, dataviz "de-emphasis hue").
 */
export function Sparkline({
  values,
  className,
  ariaLabel,
}: {
  values: number[];
  className?: string;
  ariaLabel?: string;
}) {
  if (values.length < 2) {
    return (
      <span className={cn("text-xs text-muted-foreground", className)} aria-hidden="true">
        —
      </span>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;

  const points = values.map((value, index) => {
    const x =
      PADDING + (index / (values.length - 1)) * (VIEW_WIDTH - PADDING * 2);
    // Vlakke reeks (range 0) → horizontale lijn op het midden.
    const y =
      range === 0
        ? VIEW_HEIGHT / 2
        : VIEW_HEIGHT -
          PADDING -
          ((value - min) / range) * (VIEW_HEIGHT - PADDING * 2);
    return { x, y };
  });

  const pathD = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(" ");

  const last = points[points.length - 1];
  const first = values[0];
  const lastValue = values[values.length - 1];
  const description =
    ariaLabel ?? `Trend van ${first} naar ${lastValue} over ${values.length} metingen`;

  return (
    <svg
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      preserveAspectRatio="none"
      className={cn("h-8 w-24 overflow-visible text-muted-foreground", className)}
      role="img"
      aria-label={description}
    >
      <path
        d={pathD}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last.x} cy={last.y} r={2} fill="currentColor" />
    </svg>
  );
}
