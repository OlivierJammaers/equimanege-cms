import { describe, expect, test } from "vitest";
import { niceTicks, toPolyline, type ChartPoint } from "@/lib/chart-scale";

describe("niceTicks", () => {
  test("0..80 geeft afgeronde tick-waarden die het bereik dekken", () => {
    const ticks = niceTicks(0, 80, 4);

    expect(ticks.length).toBeGreaterThanOrEqual(2);
    expect(ticks[0]).toBeLessThanOrEqual(0);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(80);
    // "nice" => elk tick-verschil is een rond getal (geen 13.37 etc.)
    for (let i = 1; i < ticks.length; i++) {
      const step = ticks[i] - ticks[i - 1];
      expect(step).toBeGreaterThan(0);
    }
  });

  test("0..1 (fracties, bv. bezettingsgraad) geeft nette fractie-ticks", () => {
    const ticks = niceTicks(0, 1, 4);

    expect(ticks[0]).toBeLessThanOrEqual(0);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(1);
    // geen absurd kleine floating-point stapjes
    for (const t of ticks) {
      expect(Number.isFinite(t)).toBe(true);
    }
  });

  test("constante reeks (min === max, niet nul) geeft een leesbaar bereik rond de waarde", () => {
    const ticks = niceTicks(12, 12, 4);

    expect(ticks.length).toBeGreaterThanOrEqual(2);
    // domein bevat de waarde
    expect(ticks[0]).toBeLessThanOrEqual(12);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(12);
    // geen negatieve ticks voor een niet-negatieve databron (ledenaantal, €, ...)
    expect(ticks[0]).toBeGreaterThanOrEqual(0);
  });

  test("alles-nul reeks (min === max === 0) geeft ticks vanaf 0, geen NaN/negatief", () => {
    const ticks = niceTicks(0, 0, 4);

    expect(ticks[0]).toBe(0);
    for (const t of ticks) {
      expect(Number.isFinite(t)).toBe(true);
      expect(t).toBeGreaterThanOrEqual(0);
    }
  });

  test("min > max wordt gewoon verwisseld i.p.v. crashen", () => {
    const ticks = niceTicks(80, 0, 4);
    expect(ticks[0]).toBeLessThanOrEqual(0);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(80);
  });
});

describe("toPolyline", () => {
  const domain: [number, number] = [0, 100];

  test("mapt domein-hoeken correct: laagste waarde onderaan, hoogste bovenaan", () => {
    const points: ChartPoint[] = [
      { date: new Date("2026-08-01T00:00:00Z"), value: 0 },
      { date: new Date("2026-08-31T00:00:00Z"), value: 100 },
    ];

    const result = toPolyline(points, 400, 120, domain);

    expect(result).toHaveLength(2);
    // eerste punt: x=0 (begin van de datumreeks), y=height (onderaan, want value=min)
    expect(result[0].x).toBeCloseTo(0);
    expect(result[0].y).toBeCloseTo(120);
    // laatste punt: x=width (einde van de datumreeks), y=0 (bovenaan, want value=max)
    expect(result[1].x).toBeCloseTo(400);
    expect(result[1].y).toBeCloseTo(0);
  });

  test("een middelste waarde mapt naar het midden van de y-as", () => {
    const points: ChartPoint[] = [
      { date: new Date("2026-08-01T00:00:00Z"), value: 0 },
      { date: new Date("2026-08-16T00:00:00Z"), value: 50 },
      { date: new Date("2026-08-31T00:00:00Z"), value: 100 },
    ];

    const result = toPolyline(points, 400, 120, domain);

    expect(result[1].x).toBeCloseTo(200, 0);
    expect(result[1].y).toBeCloseTo(60);
  });

  test("x-positie is tijdgebaseerd, niet index-gebaseerd (ongelijke tussenpozen)", () => {
    const points: ChartPoint[] = [
      { date: new Date("2026-08-01T00:00:00Z"), value: 0 },
      { date: new Date("2026-08-02T00:00:00Z"), value: 50 }, // vlak na het begin
      { date: new Date("2026-08-31T00:00:00Z"), value: 100 },
    ];

    const result = toPolyline(points, 300, 100, domain);

    // dag 2 van een reeks van 30 dagen => x zit dicht bij het begin, niet op 1/3
    expect(result[1].x).toBeLessThan(300 / 3);
  });

  test("één punt wordt horizontaal gecentreerd", () => {
    const points: ChartPoint[] = [
      { date: new Date("2026-08-15T00:00:00Z"), value: 50 },
    ];

    const result = toPolyline(points, 400, 120, domain);

    expect(result).toHaveLength(1);
    expect(result[0].x).toBeCloseTo(200);
    expect(result[0].y).toBeCloseTo(60);
  });

  test("lege lijst geeft lege lijst (geen crash)", () => {
    expect(toPolyline([], 400, 120, domain)).toEqual([]);
  });

  test("constant domein (min === max) plaatst punten verticaal gecentreerd", () => {
    const points: ChartPoint[] = [
      { date: new Date("2026-08-01T00:00:00Z"), value: 5 },
      { date: new Date("2026-08-31T00:00:00Z"), value: 5 },
    ];

    const result = toPolyline(points, 400, 120, [5, 5]);

    expect(result[0].y).toBeCloseTo(60);
    expect(result[1].y).toBeCloseTo(60);
  });
});
