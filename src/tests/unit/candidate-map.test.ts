import { describe, expect, test } from "vitest";
import { candidatePayloadToAccountInsert } from "@/lib/candidate-map";
import type { CrawlCandidate } from "@/lib/crawl-schema";

const RUN = { region: "Limburg", country: "BE" };

const FULL_PAYLOAD: CrawlCandidate = {
  name: "Manege De Voorbeeld",
  category: "Manege",
  gemeente: "Hasselt",
  deelgemeente: "Kermt",
  postcode: "3500",
  address: "Teststraat 1",
  phone: "011 12 34 56",
  email: "info@devoorbeeld.be",
  website: "devoorbeeld.be",
  facebook: "facebook.com/devoorbeeld",
  instagram: "instagram.com/devoorbeeld",
  contactPerson: "Jan Janssens",
  sizeInfo: "40 boxen",
  pricingInfo: "€350/maand",
  offer: "Pensionstalling + lessen",
  infrastructure: "Binnenpiste, buitenpiste",
  disciplines: "Dressuur, springen",
  givesLessons: "Ja",
  softwareStatus: "Geen",
  softwareDetail: null,
  websiteTech: "Wordpress",
  salesAngle: "Geen software, groeiende stal",
  vatNumber: "BE0123456789",
  sourceNotes: "Gevonden via Google Maps",
  source: "Google Maps",
  opener: "Hoi Jan, ik zag dat jullie...",
  priority: "A",
  score: 87,
};

describe("candidatePayloadToAccountInsert", () => {
  test("mapt alle bronvelden 1-op-1 door", () => {
    const result = candidatePayloadToAccountInsert(FULL_PAYLOAD, RUN);

    expect(result).toMatchObject({
      type: "prospect",
      region: "Limburg",
      country: "BE",
      name: "Manege De Voorbeeld",
      category: "Manege",
      gemeente: "Hasselt",
      deelgemeente: "Kermt",
      postcode: "3500",
      address: "Teststraat 1",
      phone: "011 12 34 56",
      email: "info@devoorbeeld.be",
      website: "devoorbeeld.be",
      facebook: "facebook.com/devoorbeeld",
      instagram: "instagram.com/devoorbeeld",
      contactPerson: "Jan Janssens",
      sizeInfo: "40 boxen",
      pricingInfo: "€350/maand",
      offer: "Pensionstalling + lessen",
      infrastructure: "Binnenpiste, buitenpiste",
      disciplines: "Dressuur, springen",
      givesLessons: "Ja",
      softwareStatus: "Geen",
      softwareDetail: null,
      websiteTech: "Wordpress",
      salesAngle: "Geen software, groeiende stal",
      vatNumber: "BE0123456789",
      sourceNotes: "Gevonden via Google Maps",
      source: "Google Maps",
      opener: "Hoi Jan, ik zag dat jullie...",
      priority: "A",
      score: 87,
    });
  });

  test("gebruikt region/country van de run, niet van de payload", () => {
    const result = candidatePayloadToAccountInsert(FULL_PAYLOAD, {
      region: "Antwerpen",
      country: "NL",
    });
    expect(result.region).toBe("Antwerpen");
    expect(result.country).toBe("NL");
  });

  test("zet type altijd op prospect en callStatus op leeg", () => {
    const result = candidatePayloadToAccountInsert(FULL_PAYLOAD, RUN);
    expect(result.type).toBe("prospect");
    expect(result.callStatus).toBe("");
  });

  test("valt terug op 'AI-onderzoek' als source ontbreekt", () => {
    const result = candidatePayloadToAccountInsert(
      { ...FULL_PAYLOAD, source: undefined },
      RUN,
    );
    expect(result.source).toBe("AI-onderzoek");
  });

  test("valt terug op 'AI-onderzoek' als source null is", () => {
    const result = candidatePayloadToAccountInsert(
      { ...FULL_PAYLOAD, source: null },
      RUN,
    );
    expect(result.source).toBe("AI-onderzoek");
  });

  test("valt terug op 'AI-onderzoek' als source een lege string is", () => {
    const result = candidatePayloadToAccountInsert(
      { ...FULL_PAYLOAD, source: "" },
      RUN,
    );
    expect(result.source).toBe("AI-onderzoek");
  });

  test("behoudt een expliciete source", () => {
    const result = candidatePayloadToAccountInsert(
      { ...FULL_PAYLOAD, source: "LinkedIn" },
      RUN,
    );
    expect(result.source).toBe("LinkedIn");
  });

  test("mapt ontbrekende optionele velden op null, niet op undefined", () => {
    const minimal: CrawlCandidate = { name: "Kale Manege" };
    const result = candidatePayloadToAccountInsert(minimal, RUN);

    expect(result.category).toBeNull();
    expect(result.gemeente).toBeNull();
    expect(result.phone).toBeNull();
    expect(result.email).toBeNull();
    expect(result.website).toBeNull();
    expect(result.opener).toBeNull();
    expect(result.priority).toBeNull();
    expect(result.score).toBeNull();
    expect(result.source).toBe("AI-onderzoek");
    expect(result.name).toBe("Kale Manege");
  });
});
