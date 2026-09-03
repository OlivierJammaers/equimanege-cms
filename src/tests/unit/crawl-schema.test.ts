import { describe, expect, test } from "vitest";
import {
  crawlCandidateSchema,
  crawlResponseSchema,
  discoveryResponseSchema,
  extractJson,
} from "@/lib/crawl-schema";

const VALID_FIXTURE = {
  candidates: [
    {
      name: "Manege De Voorbeeld",
      category: "Manege",
      gemeente: "Hasselt",
      deelgemeente: null,
      postcode: "3500",
      address: "Voorbeeldstraat 1",
      phone: "011 12 34 56",
      email: "info@devoorbeeld.be",
      website: "https://devoorbeeld.be",
      facebook: null,
      instagram: null,
      contactPerson: "Jan Voorbeeld",
      sizeInfo: "40 boxen, 120 leden",
      pricingInfo: null,
      offer: "Lessen, pensionstalling",
      infrastructure: "Buitenpiste, binnenpiste",
      disciplines: "Dressuur, springen",
      givesLessons: "Ja",
      softwareStatus: "Geen software gevonden",
      softwareDetail: null,
      websiteTech: "WordPress",
      salesAngle: "Actieve manege zonder digitale ledenadministratie",
      vatNumber: null,
      sourceNotes: "Gevonden via Facebook-pagina",
      source: "https://devoorbeeld.be, https://facebook.com/devoorbeeld",
      opener: "Ik zag dat jullie net een nieuwe piste hebben aangelegd — hoe bevalt die?",
      priority: "A",
      score: 150,
    },
  ],
};

describe("crawlCandidateSchema", () => {
  test("valideert een volledige kandidaat", () => {
    const result = crawlCandidateSchema.safeParse(VALID_FIXTURE.candidates[0]);
    expect(result.success).toBe(true);
  });

  test("weigert een kandidaat zonder naam", () => {
    const result = crawlCandidateSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  test("accepteert een minimale kandidaat met alleen naam", () => {
    const result = crawlCandidateSchema.safeParse({ name: "Enkel een naam" });
    expect(result.success).toBe(true);
  });

  test("weigert een ongeldige priority", () => {
    const result = crawlCandidateSchema.safeParse({
      name: "Test",
      priority: "Z",
    });
    expect(result.success).toBe(false);
  });
});

describe("crawlResponseSchema", () => {
  test("valideert de volledige fixture", () => {
    const result = crawlResponseSchema.safeParse(VALID_FIXTURE);
    expect(result.success).toBe(true);
  });

  test("weigert een payload zonder candidates-array", () => {
    const result = crawlResponseSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("discoveryResponseSchema", () => {
  test("valideert een lijst deelgebieden", () => {
    const result = discoveryResponseSchema.safeParse({
      areas: ["Hasselt", "Genk", "Sint-Truiden"],
    });
    expect(result.success).toBe(true);
  });

  test("weigert meer dan 80 deelgebieden", () => {
    const areas = Array.from({ length: 81 }, (_, i) => `Gebied ${i}`);
    const result = discoveryResponseSchema.safeParse({ areas });
    expect(result.success).toBe(false);
  });

  test("weigert lege gebiedsnamen", () => {
    const result = discoveryResponseSchema.safeParse({ areas: [""] });
    expect(result.success).toBe(false);
  });
});

describe("extractJson", () => {
  test("parseert een gewone JSON-tekst zonder fences", () => {
    const text = JSON.stringify(VALID_FIXTURE);
    const extracted = extractJson(text);
    expect(JSON.parse(extracted)).toEqual(VALID_FIXTURE);
  });

  test("haalt JSON uit een ```json-fence met omringend proza", () => {
    const text = `Hier is het resultaat van mijn onderzoek:\n\n\`\`\`json\n${JSON.stringify(
      VALID_FIXTURE,
      null,
      2,
    )}\n\`\`\`\n\nLaat het weten als je nog vragen hebt.`;
    const extracted = extractJson(text);
    expect(JSON.parse(extracted)).toEqual(VALID_FIXTURE);
  });

  test("pakt de laatste fence als er meerdere zijn", () => {
    const first = JSON.stringify({ candidates: [] });
    const second = JSON.stringify(VALID_FIXTURE);
    const text = `\`\`\`json\n${first}\n\`\`\`\n\nOeps, opnieuw:\n\n\`\`\`json\n${second}\n\`\`\``;
    const extracted = extractJson(text);
    expect(JSON.parse(extracted)).toEqual(VALID_FIXTURE);
  });

  test("gooit een fout wanneer er geen JSON-object te vinden is", () => {
    expect(() => extractJson("Sorry, ik kon dit niet voltooien.")).toThrow();
  });

  test("gooit een fout bij een onafgesloten JSON-object", () => {
    expect(() => extractJson('{"candidates": [')).toThrow();
  });

  test("parseert de laatste JSON-tekst uit kapotte omliggende tekst zonder fence", () => {
    const text = `blabla { not json here } meer tekst ${JSON.stringify(
      VALID_FIXTURE,
    )}`;
    const extracted = extractJson(text);
    expect(JSON.parse(extracted)).toEqual(VALID_FIXTURE);
  });
});
