import { and, asc, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import {
  accounts,
  crawlCandidates,
  crawlJobs,
  crawlRuns,
  type CrawlJob,
  type CrawlRun,
} from "@/db/schema";
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
 *
 * Final-review-fixes (zie .superpowers/sdd/f3-ui-report.md, "Fix:
 * final-review-findings"): fix 2 (atomische job-claim), fix 4 (vastgelopen
 * jobs terugzetten), fix 5 (run niet naar `done` overschrijven als hij niet
 * meer `running` is) en de pure drain-stopconditie voor fix 1 leven allemaal
 * hier.
 */

export type ProcessNextJobResult = {
  processed: boolean;
  remaining: number;
  runId?: string;
};

/** Aantal claim-pogingen (verschillende kandidaat-jobs) vóór processNextJob opgeeft. */
const CLAIM_ATTEMPTS = 3;

/** Jobs die langer dan dit `running` staan, worden als vastgelopen beschouwd (fix 4). */
const STUCK_JOB_THRESHOLD_MS = 15 * 60 * 1000;

/**
 * Drain-lus grenzen voor de cron-route (`GET /api/crawl/process`, fix 1):
 * exportabel/puur getest via {@link shouldStopDraining} zodat de
 * stopconditie zonder database getest kan worden.
 */
export const DRAIN_MAX_DURATION_MS = 240_000;
export const DRAIN_MAX_JOBS = 50;

/**
 * Pure stopconditie voor de cron-drain-lus: stopt zodra er niets meer te
 * verwerken is, de tijdslimiet (ruim onder de 300s `maxDuration`) bereikt
 * is, of het maximum aantal jobs per aanroep verwerkt is.
 */
export function shouldStopDraining(state: {
  remaining: number;
  jobsProcessed: number;
  elapsedMs: number;
}): boolean {
  return (
    state.remaining <= 0 ||
    state.jobsProcessed >= DRAIN_MAX_JOBS ||
    state.elapsedMs >= DRAIN_MAX_DURATION_MS
  );
}

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
    // Fix 5: alleen naar `done` zetten als de run nog `running` is — een
    // ondertussen gepauzeerde of geannuleerde (`failed`) run mag hier niet
    // overschreven worden (bv. laatste job rondt af net na een pauzeklik).
    await db
      .update(crawlRuns)
      .set({ status: "done", updatedAt: new Date() })
      .where(and(eq(crawlRuns.id, runId), eq(crawlRuns.status, "running")));
  }
  return remaining;
}

/**
 * Fix 4: zet jobs die langer dan {@link STUCK_JOB_THRESHOLD_MS} `running`
 * staan terug naar `pending`. Dit vangt het geval op waarbij een vorige
 * `processNextJob`-aanroep een job claimde maar nooit afrondde (bv. een
 * getimeoute serverless-invocation) — de al gemaakte onderzoekskost voor die
 * poging is dan verloren, wat aanvaardbaar is t.o.v. een job die voor altijd
 * `running` blijft hangen.
 */
async function reclaimStuckJobs(): Promise<void> {
  const threshold = new Date(Date.now() - STUCK_JOB_THRESHOLD_MS);
  await db
    .update(crawlJobs)
    .set({ status: "pending", startedAt: null })
    .where(and(eq(crawlJobs.status, "running"), lt(crawlJobs.startedAt, threshold)));
}

/**
 * Fix 2: claimt atomisch de oudste `pending` job van een `running` run.
 * Selecteert een klein aantal kandidaten (oplopend op `createdAt`) en
 * probeert ze één voor één te claimen met een conditionele UPDATE
 * (`status = 'pending'` in de WHERE) — de `neon-http`-driver ondersteunt
 * geen transacties, dus dit sluit het select-dan-update-race-window tussen
 * gelijktijdige aanroepen (bv. de cron-drain-lus en een admin-driver) zonder
 * transactie. Als de UPDATE niets teruggeeft, heeft een andere aanroep de
 * job ondertussen al gepakt: probeer de volgende kandidaat (bounded, zie
 * {@link CLAIM_ATTEMPTS}).
 */
async function claimNextPendingJob(): Promise<{ job: CrawlJob; run: CrawlRun } | null> {
  const candidates = await db
    .select({ job: crawlJobs, run: crawlRuns })
    .from(crawlJobs)
    .innerJoin(crawlRuns, eq(crawlJobs.runId, crawlRuns.id))
    .where(and(eq(crawlJobs.status, "pending"), eq(crawlRuns.status, "running")))
    .orderBy(asc(crawlJobs.createdAt))
    .limit(CLAIM_ATTEMPTS);

  for (const { job, run } of candidates) {
    const claimed = await db
      .update(crawlJobs)
      .set({ status: "running", startedAt: new Date() })
      .where(and(eq(crawlJobs.id, job.id), eq(crawlJobs.status, "pending")))
      .returning({ id: crawlJobs.id });

    if (claimed.length > 0) {
      return { job, run };
    }
  }

  return null;
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
  await reclaimStuckJobs();

  const claimed = await claimNextPendingJob();
  if (!claimed) {
    return { processed: false, remaining: 0 };
  }

  const { job, run } = claimed;
  const country = run.country as Country;

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
