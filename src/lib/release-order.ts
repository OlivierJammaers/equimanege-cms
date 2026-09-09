import { sql, type SQL } from "drizzle-orm";
import type { accounts } from "@/db/schema";
import type { Priority } from "@/lib/constants";

/**
 * "Best eerst"-volgorde voor prospecten: gebruikt zowel bij het vrijgeven
 * van batches (server-side SQL-sortering) als voor de fallback/unit-tests
 * (pure comparator). Beide implementaties moeten identiek gedrag geven:
 * prioriteit oplopend A,B,C,D,N,X met NULL laatst, dan score dalend met NULL
 * laatst, dan naam oplopend — volledig deterministisch.
 */

const PRIORITY_RANK: Record<Priority, number> = {
  A: 0,
  B: 1,
  C: 2,
  D: 3,
  N: 4,
  X: 5,
};

function priorityRank(priority: Priority | null | undefined): number {
  if (!priority) return 6;
  return PRIORITY_RANK[priority] ?? 6;
}

/**
 * Drizzle `orderBy`-fragmenten (best-eerst) voor de `accounts`-tabel.
 * Gebruik als: `.orderBy(...bestFirstOrderBy(accounts))`.
 */
export function bestFirstOrderBy(table: typeof accounts): SQL[] {
  return [
    sql`CASE ${table.priority}
      WHEN 'A' THEN 0
      WHEN 'B' THEN 1
      WHEN 'C' THEN 2
      WHEN 'D' THEN 3
      WHEN 'N' THEN 4
      WHEN 'X' THEN 5
      ELSE 6
    END`,
    sql`${table.score} DESC NULLS LAST`,
    sql`${table.name} ASC`,
  ];
}

interface ComparableRow {
  priority: Priority | null | undefined;
  score: number | null | undefined;
  name: string;
}

/** Pure comparator voor `Array.prototype.sort` — spiegelt `bestFirstOrderBy`. */
export function compareBestFirst(a: ComparableRow, b: ComparableRow): number {
  const priorityDiff = priorityRank(a.priority) - priorityRank(b.priority);
  if (priorityDiff !== 0) return priorityDiff;

  const scoreA = a.score ?? null;
  const scoreB = b.score ?? null;
  if (scoreA !== scoreB) {
    if (scoreA === null) return 1;
    if (scoreB === null) return -1;
    return scoreB - scoreA;
  }

  return a.name.localeCompare(b.name);
}

interface VisibilityRow {
  type: "prospect" | "customer";
  releasedAt: Date | null;
}

/** Zichtbaarheidsregel voor sales: klanten altijd, prospecten enkel vrijgegeven. */
export function visibleToSales(account: VisibilityRow): boolean {
  return account.releasedAt !== null || account.type === "customer";
}
