import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { db } from "@/db";
import { cmsUsers, crawlJobs, crawlRuns } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-guards";
import { COUNTRY_LABELS, type Country } from "@/lib/regions";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CrawlRunStatusBadge } from "@/components/crawl/crawl-status-badge";
import { CrawlRunActions } from "@/components/crawl/crawl-run-actions";
import { CrawlJobsTable } from "@/components/crawl/crawl-jobs-table";
import { CrawlRunDriver } from "@/components/crawl/crawl-run-driver";

// Leest rechtstreeks uit de DB — nooit statisch prerenderen.
export const dynamic = "force-dynamic";

const idSchema = z.string().uuid();

function formatApproxEur(costUsd: number): string {
  return `± € ${costUsd.toFixed(2).replace(".", ",")}`;
}

function StatTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="font-mono text-lg">{value}</CardContent>
    </Card>
  );
}

export default async function CrawlRunDetailPage({
  params,
}: PageProps<"/beheer/crawl/[id]">) {
  await requireAdmin();
  const { id } = await params;

  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) notFound();

  const [run] = await db
    .select({
      id: crawlRuns.id,
      country: crawlRuns.country,
      region: crawlRuns.region,
      status: crawlRuns.status,
      totalJobs: crawlRuns.totalJobs,
      doneJobs: crawlRuns.doneJobs,
      candidatesFound: crawlRuns.candidatesFound,
      costUsd: crawlRuns.costUsd,
      error: crawlRuns.error,
      createdAt: crawlRuns.createdAt,
      startedByName: cmsUsers.name,
    })
    .from(crawlRuns)
    .leftJoin(cmsUsers, eq(crawlRuns.startedBy, cmsUsers.id))
    .where(eq(crawlRuns.id, parsedId.data))
    .limit(1);

  if (!run) notFound();

  const jobs = await db
    .select()
    .from(crawlJobs)
    .where(eq(crawlJobs.runId, run.id))
    .orderBy(asc(crawlJobs.createdAt));

  const pendingJobsCount = jobs.filter((job) => job.status === "pending").length;
  const showDriver = run.status === "running" && pendingJobsCount > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Link
          href="/beheer/crawl"
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Terug naar overzicht
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{run.region}</h1>
              <CrawlRunStatusBadge status={run.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {COUNTRY_LABELS[run.country as Country] ?? run.country} · gestart door{" "}
              {run.startedByName ?? "—"}
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <CrawlRunActions runId={run.id} status={run.status} />
            <Link
              href={`/review?run=${run.id}`}
              className="text-sm text-foreground underline-offset-2 hover:underline"
            >
              Naar review-wachtrij →
            </Link>
          </div>
        </div>
      </div>

      {run.status === "failed" && run.error ? (
        <Card className="border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
          <CardContent className="pt-6 text-sm text-red-900 dark:text-red-200">
            {run.error}
          </CardContent>
        </Card>
      ) : null}

      {showDriver ? (
        <CrawlRunDriver runId={run.id} initialRemaining={pendingJobsCount} />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Voortgang"
          value={`${run.doneJobs} / ${run.totalJobs}`}
        />
        <StatTile label="Kandidaten" value={run.candidatesFound} />
        <StatTile label="Kosten" value={formatApproxEur(run.costUsd)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Jobs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CrawlJobsTable jobs={jobs} />
        </CardContent>
      </Card>
    </div>
  );
}
