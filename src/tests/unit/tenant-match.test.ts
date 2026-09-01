import { expect, test } from "vitest";
import { suggestTenantMatches } from "@/lib/tenant-match";

const tenants = [
  { id: 1, name: "Manege De Zonnehoeve", company_name: null },
  { id: 2, name: "De Zonnehoeve", company_name: null },
  { id: 3, name: "Ruiterclub Noord", company_name: "Zonnehoeve Stalling" },
  { id: 4, name: "Volledig Ongerelateerd Bedrijf", company_name: "Iets Anders" },
];

test("exact match (naam) scoort hoger dan substring en woord-overlap", () => {
  const matches = suggestTenantMatches("Manege De Zonnehoeve", tenants);

  expect(matches.map((m) => m.id)).toEqual([1, 2, 3]);
  expect(matches[0].score).toBeGreaterThan(matches[1].score);
  expect(matches[1].score).toBeGreaterThan(matches[2].score);
});

test("geen enkele overlap levert een lege lijst op", () => {
  const matches = suggestTenantMatches("Compleet Andere Naam Zonder Raakvlak", [
    { id: 4, name: "Volledig Ongerelateerd Bedrijf", company_name: "Iets Anders" },
  ]);

  expect(matches).toEqual([]);
});

test("is ongevoelig voor hoofdletters en witruimte", () => {
  const matches = suggestTenantMatches("  MANEGE de   zonnehoeve  ", [
    { id: 1, name: "Manege De Zonnehoeve", company_name: null },
  ]);

  expect(matches).toHaveLength(1);
  expect(matches[0]).toEqual({ id: 1, score: 100 });
});

test("exacte match op company_name telt ook als volledige match", () => {
  const matches = suggestTenantMatches("Ruitersport Hoeve", [
    { id: 9, name: "Iets anders", company_name: "Ruitersport Hoeve" },
  ]);

  expect(matches).toEqual([{ id: 9, score: 100 }]);
});

test("resultaat is aflopend gesorteerd op score", () => {
  const matches = suggestTenantMatches("Manege De Zonnehoeve", tenants);

  for (let i = 1; i < matches.length; i++) {
    expect(matches[i - 1].score).toBeGreaterThanOrEqual(matches[i].score);
  }
});

test("tenants zonder company_name breken de functie niet", () => {
  const matches = suggestTenantMatches("De Zonnehoeve", [
    { id: 1, name: "De Zonnehoeve", company_name: null },
  ]);

  expect(matches).toEqual([{ id: 1, score: 100 }]);
});
