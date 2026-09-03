import { describe, expect, test } from "vitest";
import {
  DRAIN_MAX_DURATION_MS,
  DRAIN_MAX_JOBS,
  shouldStopDraining,
} from "@/server/crawl/process";

/**
 * Test voor de pure drain-stopconditie van de cron-route (final-review fix
 * 1, `GET /api/crawl/process`). `processNextJob()` zelf is DB-gebonden en
 * blijft — consistent met de rest van dit project (zie
 * `src/tests/unit/crawl-dedupe.test.ts`) — niet met een live database
 * unit-getest.
 */
describe("shouldStopDraining", () => {
  test("gaat door als er nog werk is en er ruim tijd/budget over is", () => {
    expect(
      shouldStopDraining({ remaining: 5, jobsProcessed: 1, elapsedMs: 1_000 }),
    ).toBe(false);
  });

  test("stopt zodra er niets meer te verwerken is", () => {
    expect(
      shouldStopDraining({ remaining: 0, jobsProcessed: 3, elapsedMs: 1_000 }),
    ).toBe(true);
  });

  test("stopt bij een negatief 'remaining' (defensief, zou niet mogen voorkomen)", () => {
    expect(
      shouldStopDraining({ remaining: -1, jobsProcessed: 0, elapsedMs: 0 }),
    ).toBe(true);
  });

  test("stopt zodra het max aantal jobs per aanroep bereikt is", () => {
    expect(
      shouldStopDraining({
        remaining: 10,
        jobsProcessed: DRAIN_MAX_JOBS,
        elapsedMs: 1_000,
      }),
    ).toBe(true);
    expect(
      shouldStopDraining({
        remaining: 10,
        jobsProcessed: DRAIN_MAX_JOBS - 1,
        elapsedMs: 1_000,
      }),
    ).toBe(false);
  });

  test("stopt zodra de tijdslimiet bereikt is (ruim onder de 300s maxDuration)", () => {
    expect(
      shouldStopDraining({
        remaining: 10,
        jobsProcessed: 1,
        elapsedMs: DRAIN_MAX_DURATION_MS,
      }),
    ).toBe(true);
    expect(
      shouldStopDraining({
        remaining: 10,
        jobsProcessed: 1,
        elapsedMs: DRAIN_MAX_DURATION_MS - 1,
      }),
    ).toBe(false);
  });

  test("de tijdslimiet blijft ruim onder de 300s Vercel-functielimiet", () => {
    expect(DRAIN_MAX_DURATION_MS).toBeLessThan(300_000);
  });
});
