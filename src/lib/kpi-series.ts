import type { KpiTenantBlock } from "@/lib/kpi-schema";

export type KpiSnapshotLike = {
  capturedAt: Date;
  kpis: KpiTenantBlock;
};

/**
 * Zet een lijst snapshots om naar een chronologische reeks getallen via
 * `pick` (bv. `(k) => k.members.active`). Puur — muteert de invoer niet.
 */
export function buildKpiSeries(
  snapshots: KpiSnapshotLike[],
  pick: (kpis: KpiTenantBlock) => number,
): number[] {
  return [...snapshots]
    .sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime())
    .map((snapshot) => pick(snapshot.kpis));
}

/**
 * Procentueel verschil tussen de laatste en de eerste waarde in een
 * chronologische reeks. `null` bij minder dan 2 punten of als de eerste
 * waarde 0 is (delen door nul).
 */
export function deltaPct(series: number[]): number | null {
  if (series.length < 2) return null;
  const first = series[0];
  const last = series[series.length - 1];
  if (first === 0) return null;
  return ((last - first) / first) * 100;
}

/**
 * `days` dagen vóór nu. Kleine helper zodat het impure `Date.now()` niet
 * rechtstreeks in een server component staat (react-hooks/purity-lint).
 */
export function daysAgoFromNow(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/**
 * Zoekt de snapshot waarvan `capturedAt` het dichtst bij `targetMs` ligt
 * (bv. "~30 dagen vóór de laatste snapshot", voor de vorige-periode-vergelijking
 * in `computeHealthScore`). `null` bij een lege lijst. Gedeeld door
 * `KpiDashboard` (accountdetail) en het Klanten-dashboard.
 */
export function findClosestSnapshot<T extends KpiSnapshotLike>(
  snapshots: T[],
  targetMs: number,
): T | null {
  if (snapshots.length === 0) return null;
  let closest = snapshots[0];
  let closestDiff = Math.abs(closest.capturedAt.getTime() - targetMs);
  for (const snapshot of snapshots) {
    const diff = Math.abs(snapshot.capturedAt.getTime() - targetMs);
    if (diff < closestDiff) {
      closest = snapshot;
      closestDiff = diff;
    }
  }
  return closest;
}
