import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";
import { parseLimburgHtml } from "@/lib/import-limburg";

const html = readFileSync(
  path.join(__dirname, "../fixtures/limburg-sample.html"),
  "utf8",
);

test("parses records and maps fields", () => {
  const rows = parseLimburgHtml(html);
  expect(rows.length).toBe(2);
  expect(rows[0].name).toBe("Alfa Stables");
  expect(rows[0].priority).toBe("A");
  expect(rows[0].region).toBe("Limburg");
  expect(rows[0].country).toBe("BE");
  expect(rows[0].type).toBe("prospect");
  expect(rows[0].score).toBe(85);
  expect(rows[0].gemeente).toBe("Hasselt");
  expect(rows[0].category).toBe("Manege");
});

test("decodes html entities", () => {
  const rows = parseLimburgHtml(html);
  expect(rows[0].contactPerson).toContain("'"); // &#x27; -> '
  expect(rows[0].contactPerson).toBe("Jan D'Hondt");
  expect(rows[0].offer).toBe("Pension & lessen"); // &amp; -> &
  expect(rows[0].infrastructure).toBe("Binnenpiste – buitenpiste"); // &ndash; -> –
  expect(rows[0].disciplines).toBe("Dressuur · springen"); // &middot; -> ·
});

test("empty source field -> null, not the string 'undefined'", () => {
  const rows = parseLimburgHtml(html);
  expect(rows[1].deelgemeente).toBeNull();
  expect(rows[1].deelgemeente).not.toBe("undefined");
  expect(rows[1].email).toBeNull();
  expect(rows[1].pricingInfo).toBeNull();
});

test("survives a narrative field containing a ']' character without truncating the array", () => {
  const rows = parseLimburgHtml(html);
  // Notities on record 0 deliberately contains a ']' — a naive indexOf('];')
  // search would truncate the DATA array right there and lose record 1.
  expect(rows[0].sourceNotes).toContain("]");
  expect(rows[0].sourceNotes).toBe(
    "Extra info: zie bijlage [1] voor details; opvolgen na demo.",
  );
  expect(rows.length).toBe(2);
  expect(rows[1].name).toBe("Beta Stal");
  expect(rows[1].priority).toBe("B");
});

test("second record priority and score parsed correctly", () => {
  const rows = parseLimburgHtml(html);
  expect(rows[1].score).toBe(40);
  expect(rows[1].contactScore).toBeNull(); // "" -> null
});
