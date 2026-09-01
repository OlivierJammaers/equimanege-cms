import type { Metadata } from "next";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { computeListStats } from "@/lib/stats";
import { StatsTiles } from "@/components/accounts/stats-tiles";
import { AccountsTable } from "@/components/accounts/accounts-table";

// Leest rechtstreeks uit de DB — nooit statisch prerenderen (er is bovendien
// geen DATABASE_URL beschikbaar tijdens `next build`).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Prospecten — EquiManege CMS",
};

export default async function AccountsListPage() {
  const rows = await db.select().from(accounts).orderBy(accounts.priority, accounts.name);
  const stats = computeListStats(rows);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Prospecten</h1>
        <p className="text-sm text-muted-foreground">
          Overzicht van alle accounts en hun belstatus.
        </p>
      </div>

      <StatsTiles stats={stats} />
      <AccountsTable rows={rows} />
    </div>
  );
}
