import { describe, expect, test } from "vitest";
import { matchesActivityWindow } from "@/lib/activity-window";

describe("matchesActivityWindow", () => {
  const now = new Date("2026-09-09T12:00:00Z");

  test("'all' matcht altijd, ook zonder activiteit", () => {
    expect(matchesActivityWindow(null, "all", now)).toBe(true);
    expect(
      matchesActivityWindow(new Date("2026-01-01T00:00:00Z"), "all", now),
    ).toBe(true);
  });

  test("'none' matcht enkel bij null", () => {
    expect(matchesActivityWindow(null, "none", now)).toBe(true);
    expect(
      matchesActivityWindow(new Date("2026-09-09T11:00:00Z"), "none", now),
    ).toBe(false);
  });

  test("'24h' matcht activiteit binnen de laatste 24 uur", () => {
    expect(
      matchesActivityWindow(new Date("2026-09-09T00:00:01Z"), "24h", now),
    ).toBe(true);
    expect(
      matchesActivityWindow(new Date("2026-09-08T11:00:00Z"), "24h", now),
    ).toBe(false);
    expect(matchesActivityWindow(null, "24h", now)).toBe(false);
  });

  test("'24h' grens: exact 24 uur geleden matcht nog wel", () => {
    expect(
      matchesActivityWindow(new Date("2026-09-08T12:00:00Z"), "24h", now),
    ).toBe(true);
  });

  test("'7d' matcht activiteit binnen de laatste 7 dagen", () => {
    expect(
      matchesActivityWindow(new Date("2026-09-03T12:00:00Z"), "7d", now),
    ).toBe(true);
    expect(
      matchesActivityWindow(new Date("2026-09-01T00:00:00Z"), "7d", now),
    ).toBe(false);
    expect(matchesActivityWindow(null, "7d", now)).toBe(false);
  });

  test("'30d' matcht activiteit binnen de laatste 30 dagen", () => {
    expect(
      matchesActivityWindow(new Date("2026-08-10T12:00:00Z"), "30d", now),
    ).toBe(true);
    expect(
      matchesActivityWindow(new Date("2026-08-01T00:00:00Z"), "30d", now),
    ).toBe(false);
    expect(matchesActivityWindow(null, "30d", now)).toBe(false);
  });

  test("toekomstige datums (klokverschil) tellen als binnen elk venster", () => {
    expect(
      matchesActivityWindow(new Date("2026-09-09T13:00:00Z"), "24h", now),
    ).toBe(true);
  });
});
