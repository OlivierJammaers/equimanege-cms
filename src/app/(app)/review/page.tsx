import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { crawlCandidates, crawlRuns } from "@/db/schema";
import { requireUser } from "@/lib/auth-guards";
import { crawlCandidateSchema } from "@/lib/crawl-schema";
import { CandidateCard } from "@/components/review/candidate-card";
import {
  ReviewRunFilter,
  type ReviewRunOption,
} from "@/components/review/review-run-filter";
import { ApproveAllButton } from "@/components/review/approve-all-button";

// Leest rechtstreeks uit de DB — nooit statisch prerenderen.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Review — EquiManage CRM",
};

const runIdSchema = z.string().uuid();

export default async function ReviewPage({
  searchParams,
}: PageProps<"/review">) {
  const user = await requireUser();
  const isAdmin = user.role === "admin";

  const params = await searchParams;
  const rawRun = typeof params.run === "string" ? params.run : undefined;
  const selectedRunId =
    rawRun && runIdSchema.safeParse(rawRun).success ? rawRun : undefined;

  const runOptionRows = await db
    .selectDistinct({
      id: crawlRuns.id,
      region: crawlRuns.region,
      country: crawlRuns.country,
    })
    .from(crawlCandidates)
    .innerJoin(crawlRuns, eq(crawlCandidates.runId, crawlRuns.id))
    .where(eq(crawlCandidates.status, "pending"))
    .orderBy(asc(crawlRuns.region));
  const runOptions: ReviewRunOption[] = runOptionRows;

  const candidateRows = await db
    .select({
      id: crawlCandidates.id,
      name: crawlCandidates.name,
      gemeente: crawlCandidates.gemeente,
      payload: crawlCandidates.payload,
    })
    .from(crawlCandidates)
    .where(
      selectedRunId
        ? and(
            eq(crawlCandidates.status, "pending"),
            eq(crawlCandidates.runId, selectedRunId),
          )
        : eq(crawlCandidates.status, "pending"),
    )
    .orderBy(asc(crawlCandidates.createdAt));

  // payload is jsonb, geschreven vanuit een al-gevalideerde crawlCandidateSchema
  // (src/server/crawl/process.ts) — de safeParse hier is een defensieve extra
  // laag, geen verwachte foutbron; ongeldige rijen worden gewoon overgeslagen.
  const candidates = candidateRows.flatMap((row) => {
    const parsed = crawlCandidateSchema.safeParse(row.payload);
    if (!parsed.success) return [];
    return [{ ...row, payload: parsed.data }];
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Review</h1>
          <p className="text-sm text-muted-foreground">
            Beoordeel kandidaten uit AI-onderzoek voor je ze aan de prospectenlijst
            toevoegt.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ReviewRunFilter runs={runOptions} selectedRunId={selectedRunId} />
          {isAdmin && selectedRunId && candidates.length > 0 ? (
            <ApproveAllButton runId={selectedRunId} count={candidates.length} />
          ) : null}
        </div>
      </div>

      {candidates.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">
            Geen kandidaten te beoordelen.
          </p>
          {isAdmin ? (
            <Link
              href="/beheer/crawl"
              className="text-sm text-foreground underline-offset-2 hover:underline"
            >
              Nieuw onderzoek starten →
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {candidates.map((candidate) => (
            <CandidateCard
              key={candidate.id}
              candidateId={candidate.id}
              name={candidate.name}
              gemeente={candidate.gemeente}
              payload={candidate.payload}
            />
          ))}
        </div>
      )}
    </div>
  );
}
