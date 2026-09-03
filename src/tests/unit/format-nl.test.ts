import { describe, expect, test } from "vitest";
import {
  formatCurrency,
  formatDateTimeNl,
  formatDateShortNl,
  formatDecimal,
  formatInt,
  formatPercent,
  formatRelativeNl,
} from "@/lib/format-nl";

describe("formatRelativeNl", () => {
  const now = new Date("2026-09-01T12:00:00Z");

  test("null geeft 'Nooit actief geweest'", () => {
    expect(formatRelativeNl(null, now)).toBe("Nooit actief geweest");
  });

  test("minder dan een minuut geleden geeft 'Zojuist'", () => {
    expect(formatRelativeNl("2026-09-01T11:59:45Z", now)).toBe("Zojuist");
  });

  test("minuten geleden", () => {
    expect(formatRelativeNl("2026-09-01T11:45:00Z", now)).toBe("15 min geleden");
  });

  test("uren geleden", () => {
    expect(formatRelativeNl("2026-09-01T06:00:00Z", now)).toBe("6 uur geleden");
  });

  test("exact één dag geleden geeft 'Gisteren'", () => {
    expect(formatRelativeNl("2026-08-31T12:00:00Z", now)).toBe("Gisteren");
  });

  test("dagen geleden", () => {
    expect(formatRelativeNl("2026-08-25T12:00:00Z", now)).toBe("7 dagen geleden");
  });

  test("maanden geleden (enkelvoud)", () => {
    expect(formatRelativeNl("2026-08-01T12:00:00Z", now)).toBe("1 maand geleden");
  });

  test("maanden geleden (meervoud)", () => {
    expect(formatRelativeNl("2026-05-01T12:00:00Z", now)).toBe("4 maanden geleden");
  });

  test("jaren geleden", () => {
    expect(formatRelativeNl("2023-09-01T12:00:00Z", now)).toBe("3 jaar geleden");
  });
});

describe("formatters (smoke)", () => {
  test("formatInt gebruikt NL-duizendtalnotatie", () => {
    expect(formatInt(12345)).toContain("12");
  });

  test("formatDecimal toont één decimaal", () => {
    expect(formatDecimal(4.5)).toContain("4,5");
  });

  test("formatPercent zet een fractie om naar een afgeronde %", () => {
    expect(formatPercent(0.753)).toBe("75%");
  });

  test("formatCurrency toont een euroteken", () => {
    expect(formatCurrency(99)).toContain("99");
  });

  test("formatDateTimeNl geeft een niet-lege string", () => {
    expect(formatDateTimeNl(new Date("2026-08-15T10:30:00Z")).length).toBeGreaterThan(0);
  });

  test("formatDateShortNl geeft een korte NL-datum (dag + maandnaam)", () => {
    const label = formatDateShortNl(new Date("2026-08-03T00:00:00Z"));
    expect(label).toMatch(/3/);
    expect(label.length).toBeLessThan(10);
  });
});
