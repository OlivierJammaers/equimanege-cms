import { expect, test } from "vitest";
import { computeListStats } from "@/lib/stats";

test("counts totals, priorities and progress", () => {
  const s = computeListStats([
    { priority: "A", isDone: false },
    { priority: "A", isDone: true },
    { priority: "B", isDone: false },
  ]);
  expect(s.total).toBe(3);
  expect(s.byPriority.A).toBe(2);
  expect(s.done).toBe(1);
  expect(s.progressPct).toBe(33); // 1/3 afgerond
});

test("handles empty list", () => {
  const s = computeListStats([]);
  expect(s.total).toBe(0);
  expect(s.done).toBe(0);
  expect(s.progressPct).toBe(0); // no divide by zero
});

test("initializes all priority counts to 0", () => {
  const s = computeListStats([
    { priority: "A", isDone: false },
  ]);
  expect(s.byPriority.A).toBe(1);
  expect(s.byPriority.B).toBe(0);
  expect(s.byPriority.C).toBe(0);
  expect(s.byPriority.D).toBe(0);
  expect(s.byPriority.N).toBe(0);
  expect(s.byPriority.X).toBe(0);
});

test("counts all priorities correctly", () => {
  const s = computeListStats([
    { priority: "A", isDone: false },
    { priority: "B", isDone: false },
    { priority: "C", isDone: false },
    { priority: "D", isDone: false },
    { priority: "N", isDone: false },
    { priority: "X", isDone: false },
  ]);
  expect(s.total).toBe(6);
  expect(s.byPriority.A).toBe(1);
  expect(s.byPriority.B).toBe(1);
  expect(s.byPriority.C).toBe(1);
  expect(s.byPriority.D).toBe(1);
  expect(s.byPriority.N).toBe(1);
  expect(s.byPriority.X).toBe(1);
});

test("calculates correct progress percentage", () => {
  const s = computeListStats([
    { priority: "A", isDone: true },
    { priority: "A", isDone: true },
    { priority: "B", isDone: false },
    { priority: "B", isDone: false },
    { priority: "C", isDone: false },
  ]);
  expect(s.total).toBe(5);
  expect(s.done).toBe(2);
  expect(s.progressPct).toBe(40); // 2/5 = 0.4 = 40%
});

test("handles rows with null priority", () => {
  const s = computeListStats([
    { priority: null, isDone: false },
    { priority: "A", isDone: false },
  ]);
  expect(s.total).toBe(2);
  expect(s.byPriority.A).toBe(1);
  // null priority rows should not increment any priority
});
