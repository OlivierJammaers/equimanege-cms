import { expect, test } from "vitest";
import { matchSnapshots } from "@/lib/kpi-sync-core";
import type { KpiResponse, KpiTenantBlock } from "@/lib/kpi-schema";

function buildTenantBlock(id: number): KpiTenantBlock {
  return {
    tenant: {
      id,
      name: `Tenant ${id}`,
      email: `tenant${id}@example.com`,
      company_name: `Manege ${id}`,
      role: "manege_owner",
      created_at: "2026-01-01T00:00:00Z",
    },
    lessons: {
      total: 0,
      upcoming: 0,
      this_week: 0,
      completed_30d: 0,
      completed_90d: 0,
      cancelled_30d: 0,
      cancellation_rate_90d: 0,
      avg_participants_30d: 0,
      occupancy_rate_30d: 0,
      pending_registrations: 0,
    },
    members: {
      total: 0,
      active: 0,
      pending: 0,
      expiring_30d: 0,
      new_30d: 0,
      instructors: 0,
    },
    engagement: {
      last_active_at: null,
      active_push_devices_30d: 0,
      announcements_30d: 0,
      chat_messages_30d: 0,
    },
    commercial: {
      monthly_price: 0,
      invoiced_30d: 0,
      invoiced_ytd: 0,
      invoices_paid_30d: 0,
      invoices_open: 0,
      invoices_overdue: 0,
      member_limit: null,
      horse_limit: null,
    },
    adoption: {
      horses: 0,
      pistes: 0,
      groups: 0,
      invoicing_in_use: false,
    },
  };
}

function buildResponse(tenantIds: number[]): KpiResponse {
  return {
    generated_at: "2026-09-01T05:00:00Z",
    tenants: tenantIds.map(buildTenantBlock),
  };
}

test("koppelt tenants aan het juiste account op basis van equimanegeManegeId", () => {
  const linkedAccounts = [
    { id: "acc-1", equimanegeManegeId: 1 },
    { id: "acc-2", equimanegeManegeId: 2 },
  ];
  const payload = buildResponse([1, 2]);

  const matches = matchSnapshots(linkedAccounts, payload);

  expect(matches).toHaveLength(2);
  expect(matches.find((m) => m.accountId === "acc-1")?.kpis.tenant.id).toBe(1);
  expect(matches.find((m) => m.accountId === "acc-2")?.kpis.tenant.id).toBe(2);
});

test("slaat tenants zonder gekoppeld account over", () => {
  const linkedAccounts = [{ id: "acc-1", equimanegeManegeId: 1 }];
  const payload = buildResponse([1, 99]); // tenant 99 heeft geen gekoppeld account

  const matches = matchSnapshots(linkedAccounts, payload);

  expect(matches).toHaveLength(1);
  expect(matches[0].accountId).toBe("acc-1");
});

test("slaat gekoppelde accounts zonder bijpassende tenant in de payload over", () => {
  const linkedAccounts = [
    { id: "acc-1", equimanegeManegeId: 1 },
    { id: "acc-2", equimanegeManegeId: 2 }, // geen tenant 2 in de payload
  ];
  const payload = buildResponse([1]);

  const matches = matchSnapshots(linkedAccounts, payload);

  expect(matches).toHaveLength(1);
  expect(matches[0].accountId).toBe("acc-1");
});

test("geeft een lege lijst terug bij een lege payload", () => {
  const linkedAccounts = [{ id: "acc-1", equimanegeManegeId: 1 }];
  const payload = buildResponse([]);

  expect(matchSnapshots(linkedAccounts, payload)).toEqual([]);
});

test("geeft een lege lijst terug wanneer er geen gekoppelde accounts zijn", () => {
  const payload = buildResponse([1, 2]);

  expect(matchSnapshots([], payload)).toEqual([]);
});
