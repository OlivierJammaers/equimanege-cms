import { and, eq, gte, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { accounts, accountSnapshots } from "@/db/schema";
import { env } from "@/env";
import { kpiResponseSchema } from "@/lib/kpi-schema";
import { matchSnapshots } from "@/lib/kpi-sync-core";

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export type SyncKpisResult = {
  synced: number;
  skippedExisting: number;
  tenantsInPayload: number;
};

/**
 * Haalt de KPI-payload op bij de EquiManage-backend en schrijft per
 * gekoppeld account maximaal één snapshot per (UTC-)kalenderdag naar
 * `account_snapshots`. Wordt aangeroepen vanuit de cron-route
 * (`src/app/api/cron/kpi-sync/route.ts`) en straks vanuit een
 * admin-server-action ("Nu synchroniseren", C3).
 */
export async function syncKpis(): Promise<SyncKpisResult> {
  if (!env.KPI_SYNC_SECRET) {
    throw new Error("KPI_SYNC_SECRET ontbreekt — kan niet synchroniseren met EquiManage.");
  }

  const response = await fetch(`${env.EQUIMANEGE_API_URL}/internal/cms-kpis`, {
    headers: { "X-Kpi-Secret": env.KPI_SYNC_SECRET },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `KPI-ophaling bij EquiManage mislukt (status ${response.status}).`,
    );
  }

  const json = await response.json();
  const payload = kpiResponseSchema.parse(json);

  const linkedAccounts = await db
    .select({ id: accounts.id, equimanegeManegeId: accounts.equimanegeManegeId })
    .from(accounts)
    .where(isNotNull(accounts.equimanegeManegeId));

  const matches = matchSnapshots(
    linkedAccounts.map((a) => ({
      id: a.id,
      equimanegeManegeId: a.equimanegeManegeId as number,
    })),
    payload,
  );

  const today = startOfTodayUtc();
  let synced = 0;
  let skippedExisting = 0;

  for (const match of matches) {
    const [existing] = await db
      .select({ id: accountSnapshots.id })
      .from(accountSnapshots)
      .where(
        and(
          eq(accountSnapshots.accountId, match.accountId),
          gte(accountSnapshots.capturedAt, today),
        ),
      )
      .limit(1);

    if (existing) {
      skippedExisting += 1;
      continue;
    }

    await db.insert(accountSnapshots).values({
      accountId: match.accountId,
      kpis: match.kpis,
    });
    synced += 1;
  }

  return { synced, skippedExisting, tenantsInPayload: payload.tenants.length };
}
