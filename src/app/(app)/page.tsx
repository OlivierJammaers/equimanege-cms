import type { Metadata } from "next";
import { desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { accounts, activities, cmsUsers } from "@/db/schema";
import { computeListStats } from "@/lib/stats";
import { requireUser } from "@/lib/auth-guards";
import { StatsTiles } from "@/components/accounts/stats-tiles";
import { AccountsTable } from "@/components/accounts/accounts-table";
import { NewAccountButton } from "@/components/accounts/new-account-button";
import { ReleaseCard } from "@/components/accounts/release-card";

// Leest rechtstreeks uit de DB — nooit statisch prerenderen (er is bovendien
// geen DATABASE_URL beschikbaar tijdens `next build`).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Prospecten — EquiManage CRM",
};

export default async function AccountsListPage() {
  const user = await requireUser();
  const isAdmin = user.role === "admin";

  // Sales ziet enkel vrijgegeven prospecten + alle klanten (vrijgave-per-25);
  // admin ziet alles. Zie src/lib/release-order.ts `visibleToSales`.
  const visibilityFilter = isAdmin
    ? undefined
    : or(sql`${accounts.releasedAt} IS NOT NULL`, eq(accounts.type, "customer"));

  // Laatste activiteit per account (voor de "Laatste activiteit"-kolom +
  // filter): de meest recente comment/call/status_change, met de naam van
  // de auteur. `selectDistinctOn` pakt per account enkel de nieuwste rij —
  // een JOIN met deze subquery is goedkoper dan een window-functie hier.
  const lastActivityPerAccount = db
    .selectDistinctOn([activities.accountId], {
      accountId: activities.accountId,
      createdAt: activities.createdAt,
      userId: activities.userId,
    })
    .from(activities)
    .where(inArray(activities.type, ["comment", "call", "status_change"]))
    .orderBy(activities.accountId, desc(activities.createdAt))
    .as("last_activity_per_account");

  // Bewust alléén de lijst-kolommen selecteren: de lange narratieve velden
  // (opener, aanbod, infrastructuur, …) maken de payload van 453 rijen
  // onnodig zwaar en horen bij het detail.
  const rowsQuery = db
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
      lastActivityAt: lastActivityPerAccount.createdAt,
      lastActivityBy: cmsUsers.name,
    })
    .from(accounts)
    .leftJoin(
      lastActivityPerAccount,
      eq(lastActivityPerAccount.accountId, accounts.id),
    )
    .leftJoin(cmsUsers, eq(cmsUsers.id, lastActivityPerAccount.userId))
    .orderBy(accounts.priority, accounts.name);
  const rows = visibilityFilter
    ? await rowsQuery.where(visibilityFilter)
    : await rowsQuery;
  const stats = computeListStats(rows);

  let releaseCounts: { released: number; total: number } | null = null;
  if (isAdmin) {
    const [{ total, released }] = await db
      .select({
        total: sql<number>`count(*)::int`,
        released: sql<number>`count(*) filter (where ${accounts.releasedAt} is not null)::int`,
      })
      .from(accounts)
      .where(eq(accounts.type, "prospect"));
    releaseCounts = { released, total };
  }

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
      {releaseCounts ? (
        <ReleaseCard
          released={releaseCounts.released}
          total={releaseCounts.total}
        />
      ) : null}
      <AccountsTable rows={rows} />
    </div>
  );
}
