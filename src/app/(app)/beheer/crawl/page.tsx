import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { AlertTriangle } from "lucide-react";
import { db } from "@/db";
import { cmsUsers, crawlRuns } from "@/db/schema";
import { env } from "@/env";
import { requireAdmin } from "@/lib/auth-guards";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StartCrawlForm } from "@/components/crawl/start-crawl-form";
import { CrawlRunsTable } from "@/components/crawl/crawl-runs-table";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AI-onderzoek — EquiManage CRM",
};

export default async function CrawlAdminPage() {
  await requireAdmin();

  const hasApiKey = Boolean(env.ANTHROPIC_API_KEY);

  const rows = await db
    .select({
      id: crawlRuns.id,
      country: crawlRuns.country,
      region: crawlRuns.region,
      status: crawlRuns.status,
      totalJobs: crawlRuns.totalJobs,
      doneJobs: crawlRuns.doneJobs,
      candidatesFound: crawlRuns.candidatesFound,
      costUsd: crawlRuns.costUsd,
      createdAt: crawlRuns.createdAt,
      startedByName: cmsUsers.name,
    })
    .from(crawlRuns)
    .leftJoin(cmsUsers, eq(crawlRuns.startedBy, cmsUsers.id))
    .orderBy(desc(crawlRuns.createdAt));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">AI-onderzoek</h1>
        <p className="text-sm text-muted-foreground">
          Laat Claude een land + provincie onderzoeken op maneges, pensionstallen,
          opfok en sportstallingen. Resultaten komen als kandidaten in de{" "}
          review-wachtrij terecht.
        </p>
      </div>

      {!hasApiKey ? (
        <Card className="border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
          <CardContent className="flex items-start gap-3 pt-6 text-sm text-amber-900 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>
              ANTHROPIC_API_KEY ontbreekt — onderzoek starten kan pas zodra de
              sleutel is ingesteld.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <StartCrawlForm hasApiKey={hasApiKey} />

      <Card>
        <CardHeader>
          <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Onderzoeken
          </CardTitle>
          <CardDescription>
            Klik op een rij voor de jobs, voortgang en het verloop.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CrawlRunsTable rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
