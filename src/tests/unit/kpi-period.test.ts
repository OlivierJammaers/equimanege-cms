import { expect, test } from "vitest";
import { PERIOD_LABELS, periodDays, windowValues } from "@/lib/kpi-period";
import type { KpiTenantBlock } from "@/lib/kpi-schema";

function buildTenantBlock(overrides: Record<string, unknown> = {}): KpiTenantBlock {
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
      active: 20,
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
    ...overrides,
  } as KpiTenantBlock;
}

function buildWindow(seed: number) {
  return {
    completed_lessons: seed,
    cancelled_lessons: seed + 1,
    avg_participants: seed + 0.5,
    occupancy_rate: 0.1 * seed,
    new_members: seed + 2,
    invoiced: seed * 100,
    invoices_paid: seed + 3,
    announcements: seed + 4,
    chat_messages: seed * 10,
    active_push_devices: seed + 5,
  };
}

test("PERIOD_LABELS bevat de NL-labels voor alle drie periodes", () => {
  expect(PERIOD_LABELS["24h"]).toBe("24 uur");
  expect(PERIOD_LABELS["7d"]).toBe("7 dagen");
  expect(PERIOD_LABELS["30d"]).toBe("30 dagen");
});

test("periodDays geeft het juiste aantal dagen per periode", () => {
  expect(periodDays("24h")).toBe(1);
  expect(periodDays("7d")).toBe(7);
  expect(periodDays("30d")).toBe(30);
});

test("windowValues: geeft het venster rechtstreeks terug wanneer windows aanwezig is", () => {
  const kpis = buildTenantBlock({
    windows: {
      "24h": buildWindow(1),
      "7d": buildWindow(2),
      "30d": buildWindow(3),
    },
  });

  expect(windowValues(kpis, "24h")).toEqual(buildWindow(1));
  expect(windowValues(kpis, "7d")).toEqual(buildWindow(2));
  expect(windowValues(kpis, "30d")).toEqual(buildWindow(3));
});

test("windowValues: 24h zonder windows geeft null", () => {
  const kpis = buildTenantBlock();
  expect(windowValues(kpis, "24h")).toBeNull();
});

test("windowValues: 7d zonder windows geeft null", () => {
  const kpis = buildTenantBlock();
  expect(windowValues(kpis, "7d")).toBeNull();
});

test("windowValues: 30d zonder windows synthetiseert uit de legacy velden", () => {
  const kpis = buildTenantBlock();
  const result = windowValues(kpis, "30d");

  expect(result).toEqual({
    completed_lessons: kpis.lessons.completed_30d,
    cancelled_lessons: kpis.lessons.cancelled_30d,
    avg_participants: kpis.lessons.avg_participants_30d,
    occupancy_rate: kpis.lessons.occupancy_rate_30d,
    new_members: kpis.members.new_30d,
    invoiced: kpis.commercial.invoiced_30d,
    invoices_paid: kpis.commercial.invoices_paid_30d,
    announcements: kpis.engagement.announcements_30d,
    chat_messages: kpis.engagement.chat_messages_30d,
    active_push_devices: kpis.engagement.active_push_devices_30d,
  });
});

test("windowValues: 30d mét windows gebruikt windows.30d, niet de legacy synthese", () => {
  const kpis = buildTenantBlock({
    windows: {
      "24h": buildWindow(1),
      "7d": buildWindow(2),
      "30d": buildWindow(9),
    },
  });

  expect(windowValues(kpis, "30d")).toEqual(buildWindow(9));
});
