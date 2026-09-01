import { expect, test } from "vitest";
import { buildKpiSeries, deltaPct } from "@/lib/kpi-series";
import type { KpiTenantBlock } from "@/lib/kpi-schema";

function buildTenantBlock(activeMembers: number): KpiTenantBlock {
  return {
    tenant: {
      id: 1,
      name: "Jan Janssen",
      email: "jan@example.com",
      company_name: "Manege De Wei",
      role: "manege_owner",
      created_at: "2026-01-01T00:00:00Z",
    },
    lessons: {
      total: 10,
      upcoming: 3,
      this_week: 2,
      completed_30d: 8,
      completed_90d: 20,
      cancelled_30d: 1,
      cancellation_rate_90d: 0.05,
      avg_participants_30d: 4.5,
      occupancy_rate_30d: 0.75,
      pending_registrations: 2,
    },
    members: {
      total: 25,
      active: activeMembers,
      pending: 1,
      expiring_30d: 3,
      new_30d: 2,
      instructors: 2,
    },
    engagement: {
      last_active_at: "2026-08-30T12:00:00Z",
      active_push_devices_30d: 15,
      announcements_30d: 4,
      chat_messages_30d: 120,
    },
    commercial: {
      monthly_price: 99,
      invoiced_30d: 500,
      invoiced_ytd: 4500,
      invoices_paid_30d: 5,
      invoices_open: 1,
      invoices_overdue: 0,
      member_limit: null,
      horse_limit: null,
    },
    adoption: {
      horses: 10,
      pistes: 2,
      groups: 3,
      invoicing_in_use: true,
    },
  };
}

test("buildKpiSeries sorteert chronologisch en past pick toe", () => {
  const snapshots = [
    { capturedAt: new Date("2026-08-03T00:00:00Z"), kpis: buildTenantBlock(30) },
    { capturedAt: new Date("2026-08-01T00:00:00Z"), kpis: buildTenantBlock(10) },
    { capturedAt: new Date("2026-08-02T00:00:00Z"), kpis: buildTenantBlock(20) },
  ];

  const series = buildKpiSeries(snapshots, (k) => k.members.active);

  expect(series).toEqual([10, 20, 30]);
});

test("buildKpiSeries laat de invoer-array onaangeroerd (geen mutatie)", () => {
  const snapshots = [
    { capturedAt: new Date("2026-08-03T00:00:00Z"), kpis: buildTenantBlock(30) },
    { capturedAt: new Date("2026-08-01T00:00:00Z"), kpis: buildTenantBlock(10) },
  ];
  const original = [...snapshots];

  buildKpiSeries(snapshots, (k) => k.members.active);

  expect(snapshots).toEqual(original);
});

test("buildKpiSeries met lege lijst geeft lege reeks", () => {
  expect(buildKpiSeries([], (k) => k.members.active)).toEqual([]);
});

test("deltaPct: laatste vs eerste, als percentage", () => {
  expect(deltaPct([10, 20, 15, 20])).toBe(100);
  expect(deltaPct([20, 10])).toBe(-50);
});

test("deltaPct: minder dan 2 punten geeft null", () => {
  expect(deltaPct([])).toBeNull();
  expect(deltaPct([42])).toBeNull();
});

test("deltaPct: eerste waarde 0 geeft null (delen door nul)", () => {
  expect(deltaPct([0, 10])).toBeNull();
});
