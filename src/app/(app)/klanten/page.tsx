import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq, gte, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { accounts, accountSnapshots } from "@/db/schema";
import { requireUser } from "@/lib/auth-guards";
import { computeHealthScore, healthLevelRank } from "@/lib/health-score";
import { buildKpiSeries, daysAgoFromNow, findClosestSnapshot } from "@/lib/kpi-series";
import type { KpiTenantBlock } from "@/lib/kpi-schema";
import { KlantCard, type KlantCardData } from "@/components/klanten/klant-card";

// Leest rechtstreeks uit de DB — nooit statisch prerenderen.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Klanten — EquiManage CMS",
};

const DAY_MS = 24 * 60 * 60 * 1000;

type SnapshotRow = { capturedAt: Date; kpis: KpiTenantBlock };

function EmptyState() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Klanten</h1>
        <p className="text-sm text-muted-foreground">
          EquiManage-gezondheid en -cijfers van gekoppelde klanten.
        </p>
      </div>
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
        <p className="max-w-md text-sm text-muted-foreground">
          Nog geen enkele account is gekoppeld aan een EquiManage-manege.
          Koppel een klant-account aan zijn manege-ID op de accountpagina om
          hier gezondheidsscores en KPI-trends te zien.
        </p>
        <Link
          href="/"
          className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
        >
          Naar de accountenlijst →
        </Link>
      </div>
    </div>
  );
}

export default async function KlantenPage() {
  await requireUser();

  const klantRows = await db
    .select({
      id: accounts.id,
      name: accounts.name,
      gemeente: accounts.gemeente,
    })
    .from(accounts)
    .where(and(eq(accounts.type, "customer"), isNotNull(accounts.equimanegeManegeId)))
    .orderBy(accounts.name);

  if (klantRows.length === 0) {
    return <EmptyState />;
  }

  const ids = klantRows.map((row) => row.id);

  const snapshotRows = await db
    .select({
      accountId: accountSnapshots.accountId,
      capturedAt: accountSnapshots.capturedAt,
      kpis: accountSnapshots.kpis,
    })
    .from(accountSnapshots)
    .where(
      and(
        inArray(accountSnapshots.accountId, ids),
        gte(accountSnapshots.capturedAt, daysAgoFromNow(90)),
      ),
    )
    .orderBy(asc(accountSnapshots.capturedAt));

  const snapshotsByAccount = new Map<string, SnapshotRow[]>();
  for (const row of snapshotRows) {
    const list = snapshotsByAccount.get(row.accountId) ?? [];
    list.push({ capturedAt: row.capturedAt, kpis: row.kpis as KpiTenantBlock });
    snapshotsByAccount.set(row.accountId, list);
  }

  const now = new Date();

  const klanten: KlantCardData[] = klantRows.map((row) => {
    const snapshots = snapshotsByAccount.get(row.id) ?? [];

    if (snapshots.length === 0) {
      return {
        id: row.id,
        name: row.name,
        gemeente: row.gemeente,
        health: null,
        activeMembers: null,
        upcomingLessons: null,
        lastActiveAtIso: null,
        monthlyPrice: null,
        activeMembersSeries: [],
        lastSyncAt: null,
      };
    }

    const latestSnapshot = snapshots[snapshots.length - 1];
    const latest = latestSnapshot.kpis;
    const previousSnapshot = findClosestSnapshot(
      snapshots.slice(0, -1),
      latestSnapshot.capturedAt.getTime() - 30 * DAY_MS,
    );
    const health = computeHealthScore(latest, previousSnapshot?.kpis ?? null, now);

    return {
      id: row.id,
      name: row.name,
      gemeente: row.gemeente,
      health,
      activeMembers: latest.members.active,
      upcomingLessons: latest.lessons.upcoming,
      lastActiveAtIso: latest.engagement.last_active_at,
      monthlyPrice: latest.commercial.monthly_price,
      activeMembersSeries: buildKpiSeries(snapshots, (k) => k.members.active),
      lastSyncAt: latestSnapshot.capturedAt,
    };
  });

  // Rood eerst, dan oranje, dan groen — wie aandacht nodig heeft bovenaan.
  // Klanten zonder gegevens (health === null) staan onderaan.
  const sorted = [...klanten].sort((a, b) => {
    const rankA = a.health ? healthLevelRank(a.health.level) : -1;
    const rankB = b.health ? healthLevelRank(b.health.level) : -1;
    return rankB - rankA;
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Klanten</h1>
        <p className="text-sm text-muted-foreground">
          EquiManage-gezondheid en -cijfers van {klanten.length} gekoppelde{" "}
          {klanten.length === 1 ? "klant" : "klanten"}.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {sorted.map((klant) => (
          <KlantCard key={klant.id} klant={klant} now={now} />
        ))}
      </div>
    </div>
  );
}
