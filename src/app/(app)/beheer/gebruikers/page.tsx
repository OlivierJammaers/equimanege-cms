import type { Metadata } from "next";
import { db } from "@/db";
import { cmsUsers } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-guards";
import { AddSalesUserDialog } from "@/components/admin/add-sales-user-dialog";
import { UsersTable } from "@/components/admin/users-table";

// Adminpagina die rechtstreeks uit de DB leest en requireAdmin() aanroept —
// nooit statisch prerenderen.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Gebruikers — EquiManage CRM",
};

export default async function UsersPage() {
  await requireAdmin();

  const users = await db
    .select({
      id: cmsUsers.id,
      name: cmsUsers.name,
      email: cmsUsers.email,
      role: cmsUsers.role,
      isActive: cmsUsers.isActive,
      createdAt: cmsUsers.createdAt,
    })
    .from(cmsUsers)
    .orderBy(cmsUsers.name);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Gebruikers</h1>
          <p className="text-sm text-muted-foreground">
            Beheer sales- en adminaccounts voor het CRM.
          </p>
        </div>
        <AddSalesUserDialog />
      </div>

      <UsersTable users={users} />
    </div>
  );
}
