import { describe, expect, test } from "vitest";
import { REGIONS, COUNTRY_LABELS } from "@/lib/regions";

describe("REGIONS", () => {
  test("bevat 11 Belgische regio's (10 provincies + Brussels Hoofdstedelijk Gewest)", () => {
    expect(REGIONS.filter((r) => r.country === "BE")).toHaveLength(11);
  });

  test("bevat 12 Nederlandse provincies", () => {
    expect(REGIONS.filter((r) => r.country === "NL")).toHaveLength(12);
  });

  test("bevat 16 Duitse Bundesländer", () => {
    expect(REGIONS.filter((r) => r.country === "DE")).toHaveLength(16);
  });

  test("bevat 13 Franse métropolitaine régions", () => {
    expect(REGIONS.filter((r) => r.country === "FR")).toHaveLength(13);
  });

  test("heeft unieke codes over alle landen heen", () => {
    const codes = REGIONS.map((r) => r.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  test("elke regio heeft een niet-lege naam", () => {
    for (const region of REGIONS) {
      expect(region.name.trim().length).toBeGreaterThan(0);
    }
  });

  test("bevat Brussels Hoofdstedelijk Gewest voor BE", () => {
    expect(
      REGIONS.some((r) => r.country === "BE" && /Brussels/.test(r.name)),
    ).toBe(true);
  });

  test("COUNTRY_LABELS bevat een label voor elk land in REGIONS", () => {
    const countries = new Set(REGIONS.map((r) => r.country));
    for (const country of countries) {
      expect(COUNTRY_LABELS[country]).toBeTruthy();
    }
  });
});
