import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, crawlCandidates, crawlJobs, crawlRuns } from "@/db/schema";
import { DISCOVERY_AREA } from "@/lib/crawl-constants";
import { candidateKey, classifyCandidates } from "@/lib/crawl-dedupe";
import type { Country } from "@/lib/regions";
import { discoverAreas, researchArea } from "@/server/crawl/research";

/**
 * Verwerking van crawl-jobs (fase 3). Zie
 * docs/superpowers/plans/2026-09-03-fase3-ai-crawl.md onder
 * "Verwerking & API-routes". Neon-http ondersteunt geen `db.transaction`
 * (vereist een sessiegebonden verbinding) — schrijven gebeuren sequentieel,
 * zoals elders in dit project (zie src/server/kpi-sync.ts).
 */

export type ProcessNextJobResult = {
  processed: boolean;
  remaining: number;
  runId?: string;
};

async function countPendingJobs(runId: string): Promise<number> {
  const rows = await db
    .select({ id: crawlJobs.id })
    .from(crawlJobs)
    .where(and(eq(crawlJobs.runId, runId), eq(crawlJobs.status, "pending")));
  return rows.length;
}

/**
 * Werkt de run-tellers bij na het afronden van één job (succes of fout) en
 * markeert de run als `done` zodra er geen `pending` jobs meer over zijn.
 * Leest-dan-schrijft sequentieel (geen transactie beschikbaar) — voor deze
 * interne CRM met één actieve driver per run is dat aanvaardbaar, net als
 * bij de bestaande call-status-update (src/server/actions/accounts.ts).
 */
async function bumpRunAfterJob(
  runId: string,
  opts: { candidatesFound?: number; costUsd?: number; totalJobsDelta?: number },
): Promise<number> {
  const [run] = await db.select().from(crawlRuns).where(eq(crawlRuns.id, runId)).limit(1);
  if (run) {
    await db
      .update(crawlRuns)
      .set({
        totalJobs: run.totalJobs + (opts.totalJobsDelta ?? 0),
        doneJobs: run.doneJobs + 1,
        candidatesFound: run.candidatesFound + (opts.candidatesFound ?? 0),
        costUsd: run.costUsd + (opts.costUsd ?? 0),
        updatedAt: new Date(),
      })
      .where(eq(crawlRuns.id, runId));
  }

  const remaining = await countPendingJobs(runId);
  if (remaining === 0) {
    await db
      .update(crawlRuns)
      .set({ status: "done", updatedAt: new Date() })
      .where(eq(crawlRuns.id, runId));
  }
  return remaining;
}

async function loadKnownNames(runId: string): Promise<string[]> {
  const [accountRows, candidateRows] = await Promise.all([
    db.select({ name: accounts.name }).from(accounts),
    db
      .select({ name: crawlCandidates.name })
      .from(crawlCandidates)
      .where(eq(crawlCandidates.runId, runId)),
  ]);
  const names = new Set<string>();
  for (const row of accountRows) names.add(row.name);
  for (const row of candidateRows) names.add(row.name);
  return [...names];
}

async function loadExistingKeys(runId: string): Promise<Set<string>> {
  const [accountRows, candidateRows] = await Promise.all([
    db.select({ name: accounts.name, gemeente: accounts.gemeente }).from(accounts),
    db
      .select({ name: crawlCandidates.name, gemeente: crawlCandidates.gemeente })
      .from(crawlCandidates)
      .where(eq(crawlCandidates.runId, runId)),
  ]);
  const keys = new Set<string>();
  for (const row of [...accountRows, ...candidateRows]) {
    keys.add(candidateKey(row.name, row.gemeente));
  }
  return keys;
}

/**
 * Verwerkt precies één job: de oudste `pending` job van een `running` run.
 * - Geen enkele pending job in een running run → `{processed:false, remaining:0}`.
 * - Discovery-job (`area === "__discovery__"`) → splitst de regio in
 *   deelgebieden en maakt daar één `pending`-job per aan.
 * - Area-job → onderzoekt het deelgebied en schrijft kandidaten (status
 *   `duplicate` bij een match op naam+gemeente met een bestaand account of
 *   een eerdere kandidaat in deze run, anders `pending`).
 * - Fouten worden per job opgevangen (job → `failed`, foutmelding
 *   bewaard); de run loopt door met de volgende job.
 * - Zodra er geen `pending` jobs meer over zijn voor de run → run → `done`.
 */
export async function processNextJob(): Promise<ProcessNextJobResult> {
  const [row] = await db
    .select({ job: crawlJobs, run: crawlRuns })
    .from(crawlJobs)
    .innerJoin(crawlRuns, eq(crawlJobs.runId, crawlRuns.id))
    .where(and(eq(crawlJobs.status, "pending"), eq(crawlRuns.status, "running")))
    .orderBy(asc(crawlJobs.createdAt))
    .limit(1);

  if (!row) {
    return { processed: false, remaining: 0 };
  }

  const { job, run } = row;
  const country = run.country as Country;

  await db
    .update(crawlJobs)
    .set({ status: "running", startedAt: new Date() })
    .where(eq(crawlJobs.id, job.id));

  try {
    if (job.area === DISCOVERY_AREA) {
      const result = await discoverAreas(country, run.region);

      if (result.data.areas.length > 0) {
        await db.insert(crawlJobs).values(
          result.data.areas.map((area) => ({
            runId: run.id,
            area,
            status: "pending" as const,
          })),
        );
      }

      await db
        .update(crawlJobs)
        .set({
          status: "done",
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          costUsd: result.costUsd,
          finishedAt: new Date(),
        })
        .where(eq(crawlJobs.id, job.id));

      const remaining = await bumpRunAfterJob(run.id, {
        costUsd: result.costUsd,
        totalJobsDelta: result.data.areas.length,
      });
      return { processed: true, remaining, runId: run.id };
    }

    const [knownNames, existingKeys] = await Promise.all([
      loadKnownNames(run.id),
      loadExistingKeys(run.id),
    ]);

    const result = await researchArea({
      country,
      region: run.region,
      area: job.area,
      knownNames,
    });

    const classified = classifyCandidates(result.data.candidates, existingKeys);
    if (classified.length > 0) {
      await db.insert(crawlCandidates).values(
        classified.map(({ candidate, status }) => ({
          runId: run.id,
          jobId: job.id,
          name: candidate.name,
          gemeente: candidate.gemeente ?? null,
          payload: candidate,
          status,
        })),
      );
    }

    await db
      .update(crawlJobs)
      .set({
        status: "done",
        candidatesFound: result.data.candidates.length,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        costUsd: result.costUsd,
        finishedAt: new Date(),
      })
      .where(eq(crawlJobs.id, job.id));

    const remaining = await bumpRunAfterJob(run.id, {
      candidatesFound: result.data.candidates.length,
      costUsd: result.costUsd,
    });
    return { processed: true, remaining, runId: run.id };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Onbekende fout tijdens crawl-job.";
    await db
      .update(crawlJobs)
      .set({ status: "failed", error: message, finishedAt: new Date() })
      .where(eq(crawlJobs.id, job.id));

    const remaining = await bumpRunAfterJob(run.id, {});
    return { processed: true, remaining, runId: run.id };
  }
}
