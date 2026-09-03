import type { Metadata } from "next";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { computeListStats } from "@/lib/stats";
import { StatsTiles } from "@/components/accounts/stats-tiles";
import { AccountsTable } from "@/components/accounts/accounts-table";
import { NewAccountButton } from "@/components/accounts/new-account-button";

// Leest rechtstreeks uit de DB — nooit statisch prerenderen (er is bovendien
// geen DATABASE_URL beschikbaar tijdens `next build`).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Prospecten — EquiManage CRM",
};

export default async function AccountsListPage() {
  // Bewust alléén de lijst-kolommen selecteren: de lange narratieve velden
  // (opener, aanbod, infrastructuur, …) maken de payload van 453 rijen
  // onnodig zwaar en horen bij het detail.
  const rows = await db
    .select({
      id: accounts.id,
      priority: accounts.priority,
      name: accounts.name,
      category: accounts.category,
      gemeente: accounts.gemeente,
      deelgemeente: accounts.deelgemeente,
      phone: accounts.phone,
      email: accounts.email,
      contactPerson: accounts.contactPerson,
      softwareStatus: accounts.softwareStatus,
      callStatus: accounts.callStatus,
      nextActionDate: accounts.nextActionDate,
      isDone: accounts.isDone,
    })
    .from(accounts)
    .orderBy(accounts.priority, accounts.name);
  const stats = computeListStats(rows);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Prospecten</h1>
          <p className="text-sm text-muted-foreground">
            Overzicht van alle accounts en hun belstatus.
          </p>
        </div>
        <NewAccountButton />
      </div>

      <StatsTiles stats={stats} />
      <AccountsTable rows={rows} />
    </div>
  );
}
