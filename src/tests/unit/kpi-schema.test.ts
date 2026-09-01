import { expect, test } from "vitest";
import { kpiResponseSchema, kpiTenantBlockSchema } from "@/lib/kpi-schema";

function buildTenantBlock(overrides: Record<string, unknown> = {}) {
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
      monthly_price: 99.5,
      invoiced_30d: 1200.0,
      invoiced_ytd: 9000.0,
      invoices_paid_30d: 5,
      invoices_open: 2,
      invoices_overdue: 0,
      member_limit: 50,
      horse_limit: 30,
    },
    adoption: {
      horses: 18,
      pistes: 2,
      groups: 3,
      invoicing_in_use: true,
    },
    ...overrides,
  };
}

test("kpiTenantBlockSchema aanvaardt een geldig blok", () => {
  const result = kpiTenantBlockSchema.safeParse(buildTenantBlock());
  expect(result.success).toBe(true);
});

test("kpiTenantBlockSchema aanvaardt nullable last_active_at, member_limit en horse_limit", () => {
  const block = buildTenantBlock({
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
  });
  const result = kpiTenantBlockSchema.safeParse(block);
  expect(result.success).toBe(true);
});

test("kpiTenantBlockSchema weigert een ontbrekende sleutel", () => {
  const block = buildTenantBlock();
  // @ts-expect-error opzettelijk incompleet voor de test
  delete block.lessons.total;
  const result = kpiTenantBlockSchema.safeParse(block);
  expect(result.success).toBe(false);
});

test("kpiTenantBlockSchema weigert een verkeerd type", () => {
  const block = buildTenantBlock({
    members: {
      total: "25", // moet een getal zijn
      active: 20,
      pending: 1,
      expiring_30d: 3,
      new_30d: 2,
      instructors: 2,
    },
  });
  const result = kpiTenantBlockSchema.safeParse(block);
  expect(result.success).toBe(false);
});

test("kpiTenantBlockSchema weigert een ontbrekende groep", () => {
  const block = buildTenantBlock();
  // @ts-expect-error opzettelijk incompleet voor de test
  delete block.adoption;
  const result = kpiTenantBlockSchema.safeParse(block);
  expect(result.success).toBe(false);
});

test("kpiResponseSchema aanvaardt een geldige respons met meerdere tenants", () => {
  const result = kpiResponseSchema.safeParse({
    generated_at: "2026-09-01T05:00:00Z",
    tenants: [buildTenantBlock(), buildTenantBlock({ tenant: { ...buildTenantBlock().tenant, id: 2 } })],
  });
  expect(result.success).toBe(true);
});

test("kpiResponseSchema aanvaardt een lege tenants-lijst", () => {
  const result = kpiResponseSchema.safeParse({
    generated_at: "2026-09-01T05:00:00Z",
    tenants: [],
  });
  expect(result.success).toBe(true);
});

test("kpiResponseSchema weigert een ontbrekende generated_at", () => {
  const result = kpiResponseSchema.safeParse({
    tenants: [buildTenantBlock()],
  });
  expect(result.success).toBe(false);
});

test("kpiResponseSchema weigert wanneer tenants geen array is", () => {
  const result = kpiResponseSchema.safeParse({
    generated_at: "2026-09-01T05:00:00Z",
    tenants: buildTenantBlock(),
  });
  expect(result.success).toBe(false);
});
