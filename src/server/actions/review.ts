"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  accounts,
  activities,
  crawlCandidates,
  crawlRuns,
  type CrawlCandidateRow,
  type CrawlRun,
} from "@/db/schema";
import { assertAdmin, requireUser } from "@/lib/auth-guards";
import { candidatePayloadToAccountInsert } from "@/lib/candidate-map";
import { crawlCandidateSchema } from "@/lib/crawl-schema";

/**
 * Review-server-actions voor de AI-crawlpijplijn (fase 3, `/review`) — zie
 * docs/superpowers/plans/2026-09-03-fase3-ai-crawl.md onder "UI". Goedkeuren
 * hergebruikt het bestaande accounts-insert-pad (vgl.
 * src/server/actions/accounts.ts `createAccount`) met een dedupe-vangnet op
 * de (naam, gemeente)-unieke index — een conflict daar betekent dat de
 * kandidaat een duplicaat is van een ondertussen al bestaand account.
 */

function revalidateReviewPaths() {
  revalidatePath("/review");
  revalidatePath("/");
}

export type ApproveResult = {
  approved: boolean;
  accountId?: string;
  duplicate?: boolean;
};

/**
 * Kernlogica van het goedkeuren, herbruikbaar voor zowel de enkelvoudige
 * als de batch-actie. Verwacht een `pending`-kandidaat; de aanroeper is
 * verantwoordelijk voor die check (voorkomt dubbel werk bij de batch-lus,
 * die de kandidaten al gefilterd op `pending` heeft opgehaald).
 */
async function approveOne(
  candidate: CrawlCandidateRow,
  run: CrawlRun,
  userId: string,
): Promise<ApproveResult> {
  const parsedPayload = crawlCandidateSchema.parse(candidate.payload);
  const insertValues = candidatePayloadToAccountInsert(parsedPayload, {
    region: run.region,
    country: run.country,
  });

  const inserted = await db
    .insert(accounts)
    .values(insertValues)
    .onConflictDoNothing({ target: [accounts.name, accounts.gemeente] })
    .returning({ id: accounts.id });

  if (inserted.length === 0) {
    await db
      .update(crawlCandidates)
      .set({ status: "duplicate", reviewedBy: userId, reviewedAt: new Date() })
      .where(eq(crawlCandidates.id, candidate.id));
    return { approved: false, duplicate: true };
  }

  const accountId = inserted[0].id;

  await db.insert(activities).values({
    accountId,
    userId,
    type: "system",
    body: `Aangemaakt via AI-onderzoek (${run.region})`,
  });

  await db
    .update(crawlCandidates)
    .set({
      status: "approved",
      accountId,
      reviewedBy: userId,
      reviewedAt: new Date(),
    })
    .where(eq(crawlCandidates.id, candidate.id));

  return { approved: true, accountId };
}

async function loadPendingCandidateWithRun(
  candidateId: string,
): Promise<{ candidate: CrawlCandidateRow; run: CrawlRun } | null> {
  const [row] = await db
    .select({ candidate: crawlCandidates, run: crawlRuns })
    .from(crawlCandidates)
    .innerJoin(crawlRuns, eq(crawlCandidates.runId, crawlRuns.id))
    .where(eq(crawlCandidates.id, candidateId))
    .limit(1);
  return row ?? null;
}

const candidateIdSchema = z.object({ candidateId: z.string().uuid() });

/**
 * Keurt één kandidaat goed (sales + admin). Maakt een prospect-account aan
 * via het bestaande insert-pad, logt een systeemactiviteit en markeert de
 * kandidaat `approved` — of `duplicate` als (naam, gemeente) ondertussen al
 * bestaat.
 */
export async function approveCandidate(candidateId: string): Promise<ApproveResult> {
  const user = await requireUser();
  const parsed = candidateIdSchema.parse({ candidateId });

  const row = await loadPendingCandidateWithRun(parsed.candidateId);
  if (!row) throw new Error("Kandidaat niet gevonden.");
  if (row.candidate.status !== "pending") {
    throw new Error("Kandidaat is al beoordeeld.");
  }

  const result = await approveOne(row.candidate, row.run, user.id);
  revalidateReviewPaths();
  return result;
}

/** Wijst één kandidaat af (sales + admin). */
export async function rejectCandidate(candidateId: string) {
  const user = await requireUser();
  const parsed = candidateIdSchema.parse({ candidateId });

  const [candidate] = await db
    .select({ id: crawlCandidates.id, status: crawlCandidates.status })
    .from(crawlCandidates)
    .where(eq(crawlCandidates.id, parsed.candidateId))
    .limit(1);
  if (!candidate) throw new Error("Kandidaat niet gevonden.");
  if (candidate.status !== "pending") {
    throw new Error("Kandidaat is al beoordeeld.");
  }

  await db
    .update(crawlCandidates)
    .set({ status: "rejected", reviewedBy: user.id, reviewedAt: new Date() })
    .where(eq(crawlCandidates.id, parsed.candidateId));

  revalidateReviewPaths();
}

const runIdSchema = z.object({ runId: z.string().uuid() });

/**
 * Keurt alle `pending`-kandidaten van een run in één keer goed (admin-only —
 * de knop staat alleen in de UI voor admins, maar de server-action zelf
 * handhaaft dat ook). Retourneert tellers voor de bevestigingstoast.
 */
export async function approveAllPending(runId: string) {
  const user = await requireUser();
  assertAdmin(user);
  const parsed = runIdSchema.parse({ runId });

  const [run] = await db
    .select()
    .from(crawlRuns)
    .where(eq(crawlRuns.id, parsed.runId))
    .limit(1);
  if (!run) throw new Error("Run niet gevonden.");

  const pending = await db
    .select()
    .from(crawlCandidates)
    .where(
      and(eq(crawlCandidates.runId, parsed.runId), eq(crawlCandidates.status, "pending")),
    );

  let approvedCount = 0;
  let duplicateCount = 0;

  for (const candidate of pending) {
    const result = await approveOne(candidate, run, user.id);
    if (result.approved) {
      approvedCount++;
    } else if (result.duplicate) {
      duplicateCount++;
    }
  }

  revalidateReviewPaths();
  return { approvedCount, duplicateCount, total: pending.length };
}
