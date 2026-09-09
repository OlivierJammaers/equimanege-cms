import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { db } from "@/db";
import { accounts, accountSnapshots } from "@/db/schema";
import { requireUser } from "@/lib/auth-guards";
import { computeHealthScore } from "@/lib/health-score";
import { daysAgoFromNow, findClosestSnapshot } from "@/lib/kpi-series";
import type { KpiTenantBlock } from "@/lib/kpi-schema";
import { KlantKpiCharts } from "@/components/klanten/klant-kpi-charts";
import { Card, CardContent } from "@/components/ui/card";

// Leest rechtstreeks uit de DB — nooit statisch prerenderen.
export const dynamic = "force-dynamic";

const idSchema = z.string().uuid();
const DAY_MS = 24 * 60 * 60 * 1000;

type SnapshotRow = { capturedAt: Date; kpis: KpiTenantBlock };

export default async function KlantDetailPage({
  params,
}: PageProps<"/klanten/[id]">) {
  const { id } = await params;

  await requireUser();

  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) notFound();

  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, parsedId.data))
    .limit(1);

  if (!account) notFound();
  if (account.type !== "customer" || account.equimanegeManegeId === null) {
    notFound();
  }

  const snapshotRows = await db
    .select({
      capturedAt: accountSnapshots.capturedAt,
      kpis: accountSnapshots.kpis,
    })
    .from(accountSnapshots)
    .where(
      and(
        eq(accountSnapshots.accountId, account.id),
        gte(accountSnapshots.capturedAt, daysAgoFromNow(90)),
      ),
    )
    .orderBy(asc(accountSnapshots.capturedAt));

  const snapshots: SnapshotRow[] = snapshotRows.map((row) => ({
    capturedAt: row.capturedAt,
    kpis: row.kpis as KpiTenantBlock,
  }));

  const now = new Date();

  const header = (
    <div className="flex flex-col gap-4">
      <Link
        href="/klanten"
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Terug naar Klanten
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{account.name}</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {account.gemeente ?? "—"}
          </p>
        </div>
        <Link
          href={`/accounts/${account.id}`}
          className="flex items-center gap-1.5 text-sm font-medium text-foreground underline-offset-4 hover:underline"
        >
          Naar accountdetail
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );

  if (snapshots.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              Nog geen KPI-gegevens voor deze klant — de eerste synchronisatie
              draait vannacht.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const latestSnapshot = snapshots[snapshots.length - 1];
  const latest = latestSnapshot.kpis;
  const previousSnapshot = findClosestSnapshot(
    snapshots.slice(0, -1),
    latestSnapshot.capturedAt.getTime() - 30 * DAY_MS,
  );
  const health = computeHealthScore(latest, previousSnapshot?.kpis ?? null, now);

  return (
    <div className="flex flex-col gap-6">
      {header}
      <KlantKpiCharts snapshots={snapshots} health={health} />
    </div>
  );
}
