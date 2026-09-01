"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { accounts, activities } from "@/db/schema";
import { assertAdmin, requireUser } from "@/lib/auth-guards";
import { fetchKpiResponse, syncKpis } from "@/server/kpi-sync";

function revalidateAccountPaths(accountId: string) {
  revalidatePath("/");
  revalidatePath("/accounts/" + accountId);
}

export type EquimanegeTenantOption = {
  id: number;
  name: string;
  companyName: string | null;
  email: string;
  role: string;
};

/**
 * Haalt de lijst van EquiManage-tenants op (alleen metadata, geen KPI's) voor
 * de koppel-dialoog. Hergebruikt dezelfde fetch als de KPI-sync (C1).
 * Alleen admins.
 */
export async function listEquimanegeTenants(): Promise<EquimanegeTenantOption[]> {
  const user = await requireUser();
  assertAdmin(user);

  let payload;
  try {
    payload = await fetchKpiResponse();
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Ophalen van EquiManage-tenants mislukt.";
    throw new Error(message);
  }

  return payload.tenants.map(({ tenant }) => ({
    id: tenant.id,
    name: tenant.name,
    companyName: tenant.company_name || null,
    email: tenant.email,
    role: tenant.role,
  }));
}

const linkAccountSchema = z.object({
  accountId: z.string().uuid(),
  tenantId: z.number().int().positive(),
  tenantName: z.string().trim().min(1, "Tenantnaam mag niet leeg zijn."),
});

/**
 * Koppelt een account aan een EquiManage-tenant: zet `equimanegeManegeId` en
 * forceert `type='customer'` (een gekoppelde tenant is per definitie klant).
 * Logt een systeemactiviteit. Alleen admins.
 */
export async function linkAccountToTenant(
  accountId: string,
  tenantId: number,
  tenantName: string,
) {
  const user = await requireUser();
  assertAdmin(user);

  const parsed = linkAccountSchema.parse({ accountId, tenantId, tenantName });

  const [account] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.id, parsed.accountId))
    .limit(1);
  if (!account) throw new Error("Account niet gevonden");

  await db
    .update(accounts)
    .set({
      equimanegeManegeId: parsed.tenantId,
      type: "customer",
      updatedAt: new Date(),
    })
    .where(eq(accounts.id, parsed.accountId));

  await db.insert(activities).values({
    accountId: parsed.accountId,
    userId: user.id,
    type: "system",
    body: `Gekoppeld aan EquiManage-tenant «${parsed.tenantName}»`,
  });

  revalidateAccountPaths(parsed.accountId);
}

const unlinkAccountSchema = z.object({
  accountId: z.string().uuid(),
});

/**
 * Verwijdert de EquiManage-koppeling van een account. `type` blijft
 * `customer` (een ontkoppeling is geen degradatie naar prospect). Alleen
 * admins.
 */
export async function unlinkAccountFromTenant(accountId: string) {
  const user = await requireUser();
  assertAdmin(user);

  const parsed = unlinkAccountSchema.parse({ accountId });

  const [account] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.id, parsed.accountId))
    .limit(1);
  if (!account) throw new Error("Account niet gevonden");

  await db
    .update(accounts)
    .set({ equimanegeManegeId: null, updatedAt: new Date() })
    .where(eq(accounts.id, parsed.accountId));

  await db.insert(activities).values({
    accountId: parsed.accountId,
    userId: user.id,
    type: "system",
    body: "EquiManage-koppeling verwijderd",
  });

  revalidateAccountPaths(parsed.accountId);
}

const runSyncSchema = z.object({
  accountId: z.string().uuid(),
});

/**
 * Handmatig een KPI-synchronisatie draaien vanaf een accountdetailpagina
 * ("Nu synchroniseren"-knop, C3). Roept dezelfde `syncKpis` aan als de
 * dagelijkse cron-route en revalideert alleen dat account. Alleen admins.
 */
export async function runKpiSyncNow(accountId: string) {
  const user = await requireUser();
  assertAdmin(user);

  const parsed = runSyncSchema.parse({ accountId });

  const result = await syncKpis();

  revalidateAccountPaths(parsed.accountId);

  return result;
}
