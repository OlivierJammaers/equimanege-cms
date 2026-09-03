import { expect, test } from "vitest";
import { computeHealthScore, healthLevelRank } from "@/lib/health-score";
import type { KpiTenantBlock } from "@/lib/kpi-schema";

function buildTenantBlock(overrides: {
  role?: string;
  lastActiveAt?: string | null;
  activeMembers?: number;
  upcomingLessons?: number;
} = {}): KpiTenantBlock {
  return {
    tenant: {
      id: 1,
      name: "Jan Janssen",
      email: "jan@example.com",
      company_name: "Manege De Wei",
      role: overrides.role ?? "manege_owner",
      created_at: "2026-01-01T00:00:00Z",
    },
    lessons: {
      total: 10,
      upcoming: overrides.upcomingLessons ?? 3,
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
      active: overrides.activeMembers ?? 20,
      pending: 1,
      expiring_30d: 3,
      new_30d: 2,
      instructors: 2,
    },
    engagement: {
      last_active_at:
        overrides.lastActiveAt !== undefined
          ? overrides.lastActiveAt
          : "2026-08-30T12:00:00Z",
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

const NOW = new Date("2026-09-01T12:00:00Z");

test("default groen met reden 'Actief en stabiel' als niks afwijkt", () => {
  const latest = buildTenantBlock({ lastActiveAt: NOW.toISOString() });
  const result = computeHealthScore(latest, null, NOW);

  expect(result.level).toBe("groen");
  expect(result.reasons).toEqual(["Actief en stabiel"]);
});

test("last_active_at null → rood", () => {
  const latest = buildTenantBlock({ lastActiveAt: null });
  const result = computeHealthScore(latest, null, NOW);

  expect(result.level).toBe("rood");
  expect(result.reasons).toContain("Meer dan 30 dagen niet actief");
});

test("last_active_at ouder dan 30 dagen → rood", () => {
  const oldDate = new Date(NOW.getTime() - 31 * 24 * 60 * 60 * 1000).toISOString();
  const latest = buildTenantBlock({ lastActiveAt: oldDate });
  const result = computeHealthScore(latest, null, NOW);

  expect(result.level).toBe("rood");
  expect(result.reasons).toContain("Meer dan 30 dagen niet actief");
});

test("last_active_at tussen 14 en 30 dagen → oranje", () => {
  const midDate = new Date(NOW.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString();
  const latest = buildTenantBlock({ lastActiveAt: midDate });
  const result = computeHealthScore(latest, null, NOW);

  expect(result.level).toBe("oranje");
  expect(result.reasons).toContain("Meer dan 14 dagen niet actief");
});

test("last_active_at binnen 14 dagen → geen inactiviteitsreden", () => {
  const recentDate = new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
  const latest = buildTenantBlock({ lastActiveAt: recentDate });
  const result = computeHealthScore(latest, null, NOW);

  expect(result.level).toBe("groen");
  expect(result.reasons.some((r) => r.includes("niet actief"))).toBe(false);
});

test("actieve leden gedaald met meer dan 20% → rood, met percentage en aantallen", () => {
  const previous = buildTenantBlock({
    lastActiveAt: NOW.toISOString(),
    activeMembers: 20,
  });
  const latest = buildTenantBlock({
    lastActiveAt: NOW.toISOString(),
    activeMembers: 10,
  });
  const result = computeHealthScore(latest, previous, NOW);

  expect(result.level).toBe("rood");
  expect(result.reasons.some((r) => r.includes("50%") && r.includes("20") && r.includes("10"))).toBe(
    true,
  );
});

test("actieve leden gedaald met 0-20% → oranje", () => {
  const previous = buildTenantBlock({
    lastActiveAt: NOW.toISOString(),
    activeMembers: 20,
  });
  const latest = buildTenantBlock({
    lastActiveAt: NOW.toISOString(),
    activeMembers: 18,
  });
  const result = computeHealthScore(latest, previous, NOW);

  expect(result.level).toBe("oranje");
  expect(result.reasons.some((r) => r.includes("niet actief"))).toBe(false);
  expect(result.reasons.some((r) => r.includes("10%"))).toBe(true);
});

test("actieve leden gestegen → geen ledenreden", () => {
  const previous = buildTenantBlock({
    lastActiveAt: NOW.toISOString(),
    activeMembers: 20,
  });
  const latest = buildTenantBlock({
    lastActiveAt: NOW.toISOString(),
    activeMembers: 25,
  });
  const result = computeHealthScore(latest, previous, NOW);

  expect(result.level).toBe("groen");
  expect(result.reasons).toEqual(["Actief en stabiel"]);
});

test("previous.members.active === 0 → geen deling door nul, regel wordt overgeslagen", () => {
  const previous = buildTenantBlock({
    lastActiveAt: NOW.toISOString(),
    activeMembers: 0,
  });
  const latest = buildTenantBlock({
    lastActiveAt: NOW.toISOString(),
    activeMembers: 5,
  });
  const result = computeHealthScore(latest, previous, NOW);

  expect(result.level).toBe("groen");
});

test("geen geplande lessen bij manege_owner → oranje", () => {
  const latest = buildTenantBlock({
    lastActiveAt: NOW.toISOString(),
    upcomingLessons: 0,
    role: "manege_owner",
  });
  const result = computeHealthScore(latest, null, NOW);

  expect(result.level).toBe("oranje");
  expect(result.reasons).toContain("Geen geplande lessen");
});

test("geen geplande lessen bij niet-manege_owner → geen reden", () => {
  const latest = buildTenantBlock({
    lastActiveAt: NOW.toISOString(),
    upcomingLessons: 0,
    role: "opfokker_owner",
  });
  const result = computeHealthScore(latest, null, NOW);

  expect(result.level).toBe("groen");
  expect(result.reasons).toEqual(["Actief en stabiel"]);
});

test("worst wins: rood-inactiviteit overschrijft oranje-lessen, maar beide redenen blijven", () => {
  const oldDate = new Date(NOW.getTime() - 40 * 24 * 60 * 60 * 1000).toISOString();
  const latest = buildTenantBlock({
    lastActiveAt: oldDate,
    upcomingLessons: 0,
    role: "manege_owner",
  });
  const result = computeHealthScore(latest, null, NOW);

  expect(result.level).toBe("rood");
  expect(result.reasons).toContain("Meer dan 30 dagen niet actief");
  expect(result.reasons).toContain("Geen geplande lessen");
  expect(result.reasons.length).toBe(2);
});

test("combinatie van meerdere oranje-redenen blijft oranje", () => {
  const midDate = new Date(NOW.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString();
  const previous = buildTenantBlock({
    lastActiveAt: NOW.toISOString(),
    activeMembers: 20,
  });
  const latest = buildTenantBlock({
    lastActiveAt: midDate,
    activeMembers: 18,
    upcomingLessons: 0,
    role: "manege_owner",
  });
  const result = computeHealthScore(latest, previous, NOW);

  expect(result.level).toBe("oranje");
  expect(result.reasons.length).toBe(3);
});

test("healthLevelRank: rood > oranje > groen (voor sorteren, ernstigste eerst)", () => {
  expect(healthLevelRank("rood")).toBeGreaterThan(healthLevelRank("oranje"));
  expect(healthLevelRank("oranje")).toBeGreaterThan(healthLevelRank("groen"));
});
