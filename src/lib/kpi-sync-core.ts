import type { KpiResponse, KpiTenantBlock } from "@/lib/kpi-schema";

export type LinkedAccount = {
  id: string;
  equimanegeManegeId: number;
};

export type SnapshotMatch = {
  accountId: string;
  kpis: KpiTenantBlock;
};

/**
 * Koppelt de tenant-blokken uit de KPI-payload aan de gekoppelde accounts,
 * op `tenant.id === equimanegeManegeId`. Tenants zonder gekoppeld account
 * (en gekoppelde accounts zonder bijpassende tenant in de payload) worden
 * overgeslagen. Pure functie — geen DB/fetch — zodat de matching op zichzelf
 * getest kan worden.
 */
export function matchSnapshots(
  linkedAccounts: LinkedAccount[],
  payload: KpiResponse,
): SnapshotMatch[] {
  const accountsByManegeId = new Map<number, LinkedAccount>();
  for (const account of linkedAccounts) {
    accountsByManegeId.set(account.equimanegeManegeId, account);
  }

  const matches: SnapshotMatch[] = [];
  for (const tenantBlock of payload.tenants) {
    const account = accountsByManegeId.get(tenantBlock.tenant.id);
    if (!account) continue;
    matches.push({ accountId: account.id, kpis: tenantBlock });
  }
  return matches;
}
