import { expect, test } from "vitest";
import { toCsv } from "@/lib/utils";

test("csv escapes commas/quotes", () => {
  const out = toCsv([{ a: "x,y", b: 'he"llo' }]);
  expect(out).toContain('"x,y"');
  expect(out).toContain('"he""llo"');
});

test("csv includes header row from object keys", () => {
  const out = toCsv([{ naam: "Manege A", gemeente: "Hasselt" }]);
  const lines = out.split("\r\n");
  expect(lines[0]).toBe("naam,gemeente");
  expect(lines[1]).toBe("Manege A,Hasselt");
});

test("csv wraps fields containing newlines", () => {
  const out = toCsv([{ notities: "regel1\nregel2" }]);
  expect(out).toContain('"regel1\nregel2"');
});

test("csv handles empty rows array", () => {
  expect(toCsv([])).toBe("");
});

test("csv leaves plain values unquoted", () => {
  const out = toCsv([{ a: "hello", b: 42 }]);
  expect(out).toContain("hello,42");
});
