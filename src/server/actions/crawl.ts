"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { crawlJobs, crawlRuns } from "@/db/schema";
import { assertAdmin, requireUser } from "@/lib/auth-guards";
import { DISCOVERY_AREA } from "@/lib/crawl-constants";
import { REGIONS } from "@/lib/regions";

/**
 * Server actions voor de AI-crawlpijplijn (fase 3, `/beheer/crawl`) —
 * uitsluitend admins. Zie
 * docs/superpowers/plans/2026-09-03-fase3-ai-crawl.md onder
 * "Verwerking & API-routes".
 */

function revalidateCrawlPaths() {
  revalidatePath("/beheer/crawl");
}

const startCrawlRunSchema = z.object({
  country: z.enum(["BE", "NL", "DE", "FR"]),
  region: z.string().trim().min(1, "Kies een regio."),
});

/**
 * Start een nieuw onderzoek: valideert land+regio tegen de catalogus
 * (`src/lib/regions.ts`), maakt een `crawl_runs`-record (status `running`)
 * aan en zet daar één discovery-job (`area = "__discovery__"`) voor klaar.
 * De discovery-job splitst de regio in deelgebieden zodra
 * `POST /api/crawl/process` hem oppikt.
 */
export async function startCrawlRun(country: string, region: string) {
  const user = await requireUser();
  assertAdmin(user);

  const parsed = startCrawlRunSchema.parse({ country, region });
  const match = REGIONS.find(
    (r) => r.country === parsed.country && r.name === parsed.region,
  );
  if (!match) {
    throw new Error("Onbekende regio voor dit land.");
  }

  const [inserted] = await db
    .insert(crawlRuns)
    .values({
      country: match.country,
      region: match.name,
      status: "running",
      startedBy: user.id,
      totalJobs: 1,
    })
    .returning({ id: crawlRuns.id });

  await db.insert(crawlJobs).values({
    runId: inserted.id,
    area: DISCOVERY_AREA,
    status: "pending",
  });

  revalidateCrawlPaths();
  return { id: inserted.id };
}

const runIdSchema = z.object({ id: z.string().uuid() });

async function getRunStatus(id: string) {
  const [run] = await db
    .select({ status: crawlRuns.status })
    .from(crawlRuns)
    .where(eq(crawlRuns.id, id))
    .limit(1);
  return run?.status ?? null;
}

/** Pauzeert een lopende run (`running` → `paused`). No-op in elke andere status. */
export async function pauseRun(id: string) {
  const user = await requireUser();
  assertAdmin(user);
  const parsed = runIdSchema.parse({ id });

  const status = await getRunStatus(parsed.id);
  if (status !== "running") return;

  await db
    .update(crawlRuns)
    .set({ status: "paused", updatedAt: new Date() })
    .where(eq(crawlRuns.id, parsed.id));

  revalidateCrawlPaths();
}

/** Hervat een gepauzeerde run (`paused` → `running`). No-op in elke andere status. */
export async function resumeRun(id: string) {
  const user = await requireUser();
  assertAdmin(user);
  const parsed = runIdSchema.parse({ id });

  const status = await getRunStatus(parsed.id);
  if (status !== "paused") return;

  await db
    .update(crawlRuns)
    .set({ status: "running", updatedAt: new Date() })
    .where(eq(crawlRuns.id, parsed.id));

  revalidateCrawlPaths();
}

/** Annuleert een run definitief (→ `failed`, met foutmelding "Geannuleerd"). */
export async function cancelRun(id: string) {
  const user = await requireUser();
  assertAdmin(user);
  const parsed = runIdSchema.parse({ id });

  await db
    .update(crawlRuns)
    .set({ status: "failed", error: "Geannuleerd", updatedAt: new Date() })
    .where(eq(crawlRuns.id, parsed.id));

  revalidateCrawlPaths();
}
