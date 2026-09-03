import { describe, expect, test } from "vitest";
import { candidateKey, classifyCandidates } from "@/lib/crawl-dedupe";

describe("candidateKey", () => {
  test("is hoofdletterongevoelig", () => {
    expect(candidateKey("Manege De Voorbeeld", "Hasselt")).toBe(
      candidateKey("manege de voorbeeld", "hasselt"),
    );
  });

  test("trimt spaties", () => {
    expect(candidateKey("  Manege  ", "  Hasselt  ")).toBe(candidateKey("Manege", "Hasselt"));
  });

  test("behandelt null/undefined gemeente als lege string", () => {
    expect(candidateKey("Manege", null)).toBe(candidateKey("Manege", undefined));
    expect(candidateKey("Manege", null)).toBe(candidateKey("Manege", ""));
  });

  test("verschillende namen geven verschillende sleutels", () => {
    expect(candidateKey("Manege A", "Hasselt")).not.toBe(candidateKey("Manege B", "Hasselt"));
  });
});

describe("classifyCandidates", () => {
  test("markeert een kandidaat die al bestaat als account als duplicate", () => {
    const existing = new Set([candidateKey("Manege De Voorbeeld", "Hasselt")]);
    const result = classifyCandidates(
      [{ name: "Manege De Voorbeeld", gemeente: "Hasselt" }],
      existing,
    );
    expect(result[0].status).toBe("duplicate");
  });

  test("markeert een nieuwe kandidaat als pending", () => {
    const existing = new Set<string>();
    const result = classifyCandidates([{ name: "Nieuwe Manege", gemeente: "Genk" }], existing);
    expect(result[0].status).toBe("pending");
  });

  test("is hoofdletter- en spatie-ongevoelig t.o.v. bestaande sleutels", () => {
    const existing = new Set([candidateKey("Manege De Voorbeeld", "Hasselt")]);
    const result = classifyCandidates(
      [{ name: "  manege DE voorbeeld  ", gemeente: "  HASSELT  " }],
      existing,
    );
    expect(result[0].status).toBe("duplicate");
  });

  test("herkent duplicaten binnen dezelfde batch — eerste blijft pending, tweede wordt duplicate", () => {
    const existing = new Set<string>();
    const result = classifyCandidates(
      [
        { name: "Manege Dubbel", gemeente: "Genk" },
        { name: "Manege Dubbel", gemeente: "Genk" },
      ],
      existing,
    );
    expect(result[0].status).toBe("pending");
    expect(result[1].status).toBe("duplicate");
  });

  test("gemeente null wordt correct vergeleken met een bestaande lege gemeente", () => {
    const existing = new Set([candidateKey("Manege Zonder Gemeente", null)]);
    const result = classifyCandidates(
      [{ name: "Manege Zonder Gemeente", gemeente: null }],
      existing,
    );
    expect(result[0].status).toBe("duplicate");
  });

  test("laat de existingKeys-set van de aanroeper ongewijzigd", () => {
    const existing = new Set<string>();
    classifyCandidates([{ name: "Manege X", gemeente: "Genk" }], existing);
    expect(existing.size).toBe(0);
  });

  test("verwerkt een lege lijst kandidaten", () => {
    expect(classifyCandidates([], new Set())).toEqual([]);
  });
});
