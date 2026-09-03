import type { CrawlJob, CrawlRun } from "@/db/schema";

/**
 * Speciale `area`-waarde voor de discovery-job van een crawl-run: de job die
 * de regio in deelgebieden opsplitst (zie src/server/crawl/process.ts).
 */
export const DISCOVERY_AREA = "__discovery__";

export type CrawlRunStatus = CrawlRun["status"];
export type CrawlJobStatus = CrawlJob["status"];

/** NL-labels + getemperde badgekleuren voor de crawl-admin-UI (`/beheer/crawl`). */
export const CRAWL_RUN_STATUS_LABELS: Record<CrawlRunStatus, string> = {
  pending: "In wachtrij",
  running: "Bezig",
  paused: "Gepauzeerd",
  done: "Klaar",
  failed: "Mislukt",
};

export const CRAWL_RUN_STATUS_BADGE_CLASSES: Record<CrawlRunStatus, string> = {
  pending: "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400",
  running: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-400",
  paused: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400",
  done: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400",
  failed: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400",
};

export const CRAWL_JOB_STATUS_LABELS: Record<CrawlJobStatus, string> = {
  pending: "In wachtrij",
  running: "Bezig",
  done: "Klaar",
  failed: "Mislukt",
};

export const CRAWL_JOB_STATUS_BADGE_CLASSES: Record<CrawlJobStatus, string> = {
  pending: "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400",
  running: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-400",
  done: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400",
  failed: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400",
};
