/**
 * Filterlogica voor de "Activiteit"-Select in de prospectenlijst
 * (accounts-table.tsx). Pure functie zodat ze los van React/de tabel
 * getest kan worden — zie src/tests/unit/activity-window.test.ts.
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export type ActivityWindow = "all" | "24h" | "7d" | "30d" | "none";

export function matchesActivityWindow(
  lastActivityAt: Date | null,
  window: ActivityWindow,
  now: Date,
): boolean {
  if (window === "all") return true;
  if (window === "none") return lastActivityAt === null;

  if (lastActivityAt === null) return false;

  const diffMs = now.getTime() - lastActivityAt.getTime();
  switch (window) {
    case "24h":
      return diffMs <= 24 * HOUR_MS;
    case "7d":
      return diffMs <= 7 * DAY_MS;
    case "30d":
      return diffMs <= 30 * DAY_MS;
  }
}
