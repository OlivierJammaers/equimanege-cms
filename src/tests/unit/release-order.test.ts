import { expect, test } from "vitest";
import { compareBestFirst, visibleToSales } from "@/lib/release-order";

function acc(
  overrides: Partial<{
    priority: "A" | "B" | "C" | "D" | "N" | "X" | null;
    score: number | null;
    name: string;
  }>,
) {
  return {
    priority: null,
    score: null,
    name: "",
    ...overrides,
  };
}

test("orders by priority ascending A,B,C,D,N,X", () => {
  const rows = [
    acc({ priority: "X", name: "x" }),
    acc({ priority: "A", name: "a" }),
    acc({ priority: "N", name: "n" }),
    acc({ priority: "C", name: "c" }),
  ];
  const sorted = [...rows].sort(compareBestFirst);
  expect(sorted.map((r) => r.priority)).toEqual(["A", "C", "N", "X"]);
});

test("puts NULL priority last", () => {
  const rows = [
    acc({ priority: null, name: "geen" }),
    acc({ priority: "X", name: "x" }),
    acc({ priority: "A", name: "a" }),
  ];
  const sorted = [...rows].sort(compareBestFirst);
  expect(sorted.map((r) => r.priority)).toEqual(["A", "X", null]);
});

test("breaks ties on score descending, nulls last", () => {
  const rows = [
    acc({ priority: "A", score: null, name: "geen-score" }),
    acc({ priority: "A", score: 10, name: "laag" }),
    acc({ priority: "A", score: 90, name: "hoog" }),
  ];
  const sorted = [...rows].sort(compareBestFirst);
  expect(sorted.map((r) => r.name)).toEqual(["hoog", "laag", "geen-score"]);
});

test("breaks final tie on name ascending", () => {
  const rows = [
    acc({ priority: "B", score: 5, name: "Zebra" }),
    acc({ priority: "B", score: 5, name: "Aap" }),
    acc({ priority: "B", score: 5, name: "Mies" }),
  ];
  const sorted = [...rows].sort(compareBestFirst);
  expect(sorted.map((r) => r.name)).toEqual(["Aap", "Mies", "Zebra"]);
});

test("is deterministic across a mixed set", () => {
  const rows = [
    acc({ priority: "D", score: 1, name: "d1" }),
    acc({ priority: null, score: 99, name: "null-hoog" }),
    acc({ priority: "A", score: null, name: "a-geen-score" }),
    acc({ priority: "A", score: 50, name: "a-score" }),
    acc({ priority: "X", score: 1, name: "x1" }),
  ];
  const sorted = [...rows].sort(compareBestFirst);
  expect(sorted.map((r) => r.name)).toEqual([
    "a-score",
    "a-geen-score",
    "d1",
    "x1",
    "null-hoog",
  ]);
});

test("visibleToSales: released prospect is visible", () => {
  expect(
    visibleToSales({ type: "prospect", releasedAt: new Date() }),
  ).toBe(true);
});

test("visibleToSales: unreleased prospect is not visible", () => {
  expect(visibleToSales({ type: "prospect", releasedAt: null })).toBe(false);
});

test("visibleToSales: customer is always visible, released or not", () => {
  expect(visibleToSales({ type: "customer", releasedAt: null })).toBe(true);
  expect(visibleToSales({ type: "customer", releasedAt: new Date() })).toBe(
    true,
  );
});
