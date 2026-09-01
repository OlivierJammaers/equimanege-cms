import { PRIORITIES, type Priority } from "@/lib/constants";

export interface ListStats {
  total: number;
  byPriority: Record<Priority, number>;
  done: number;
  progressPct: number;
}

interface Row {
  priority: Priority | null | undefined;
  isDone: boolean;
}

export function computeListStats(rows: Row[]): ListStats {
  // Initialize byPriority with all priorities set to 0
  const byPriority: Record<Priority, number> = {
    A: 0,
    B: 0,
    C: 0,
    D: 0,
    N: 0,
    X: 0,
  };

  let done = 0;

  // Count rows
  for (const row of rows) {
    // Count by priority
    if (row.priority && PRIORITIES.includes(row.priority)) {
      byPriority[row.priority]++;
    }

    // Count done
    if (row.isDone) {
      done++;
    }
  }

  const total = rows.length;

  // Calculate progress percentage, with divide-by-zero safety
  const progressPct = total === 0 ? 0 : Math.round((done / total) * 100);

  return {
    total,
    byPriority,
    done,
    progressPct,
  };
}
