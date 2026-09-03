import { cn } from "@/lib/utils";

/**
 * Kleine ↑/↓-badge voor een `deltaPct`-waarde (`@/lib/kpi-series`).
 * `upIsGood` bepaalt of een stijging groen (goed) of rood (slecht) is —
 * bv. actieve leden omhoog = goed, annuleringsgraad omhoog = slecht.
 * Gedeeld door `KpiDashboard` (accountdetail) en het Klanten-dashboard.
 */
export function DeltaBadge({
  delta,
  upIsGood = true,
  className,
}: {
  delta: number | null;
  upIsGood?: boolean;
  className?: string;
}) {
  if (delta === null || Math.round(delta) === 0) {
    return (
      <span
        className={cn(
          "w-11 shrink-0 text-right text-xs tabular-nums text-muted-foreground",
          className,
        )}
      >
        =
      </span>
    );
  }

  const isUp = delta > 0;
  const isGood = isUp === upIsGood;
  const colorClass = isGood
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-red-600 dark:text-red-400";

  return (
    <span className={cn("w-11 shrink-0 text-right text-xs tabular-nums", colorClass, className)}>
      {isUp ? "↑" : "↓"} {Math.abs(Math.round(delta))}%
    </span>
  );
}
