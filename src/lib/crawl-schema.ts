import { z } from "zod";
import { PRIORITIES } from "@/lib/constants";

/**
 * Prompt-JSON-contract voor de AI-crawlpijplijn (fase 3): spiegelt exact de
 * "bronvelden"-set van AccountSeed (src/lib/import-limburg.ts) zodat een
 * goedgekeurde kandidaat rechtstreeks als account-insert kan worden
 * hergebruikt. Pure Zod, geen I/O. Zie
 * docs/superpowers/plans/2026-09-03-fase3-ai-crawl.md onder
 * "Onderzoeksmodule".
 */

const optionalText = z.string().trim().nullable().optional();

export const crawlCandidateSchema = z.object({
  name: z.string().trim().min(1, "Naam mag niet leeg zijn."),
  category: optionalText,
  gemeente: optionalText,
  deelgemeente: optionalText,
  postcode: optionalText,
  address: optionalText,
  phone: optionalText,
  email: optionalText,
  website: optionalText,
  facebook: optionalText,
  instagram: optionalText,
  contactPerson: optionalText,
  sizeInfo: optionalText,
  pricingInfo: optionalText,
  offer: optionalText,
  infrastructure: optionalText,
  disciplines: optionalText,
  givesLessons: optionalText,
  softwareStatus: optionalText,
  softwareDetail: optionalText,
  websiteTech: optionalText,
  salesAngle: optionalText,
  vatNumber: optionalText,
  sourceNotes: optionalText,
  source: optionalText,
  opener: optionalText,
  priority: z.enum(PRIORITIES).nullable().optional(),
  score: z.number().nullable().optional(),
});

export type CrawlCandidate = z.infer<typeof crawlCandidateSchema>;

export const crawlResponseSchema = z.object({
  candidates: z.array(crawlCandidateSchema),
});

export type CrawlResponse = z.infer<typeof crawlResponseSchema>;

export const discoveryResponseSchema = z.object({
  areas: z
    .array(z.string().trim().min(1))
    .max(80, "Te veel deelgebieden (max 80)."),
});

export type DiscoveryResponse = z.infer<typeof discoveryResponseSchema>;

/**
 * Haalt het laatste JSON-object uit een modelrespons. Claude's antwoord kan
 * ```json-fences bevatten of omringende proza — deze functie is robuust
 * voor beide. Gooit een fout als geen (afgesloten) JSON-object gevonden kan
 * worden.
 */
export function extractJson(text: string): string {
  const fenceMatches = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)];
  if (fenceMatches.length > 0) {
    const lastFenced = fenceMatches[fenceMatches.length - 1][1].trim();
    if (lastFenced.length > 0) {
      return lastFenced;
    }
  }

  const end = text.lastIndexOf("}");
  if (end === -1) {
    throw new Error("Geen JSON-object gevonden in de modelrespons.");
  }

  let depth = 0;
  let start = -1;
  for (let i = end; i >= 0; i--) {
    const char = text[i];
    if (char === "}") {
      depth++;
    } else if (char === "{") {
      depth--;
      if (depth === 0) {
        start = i;
        break;
      }
    }
  }

  if (start === -1) {
    throw new Error("Onafgesloten JSON-object in de modelrespons.");
  }

  return text.slice(start, end + 1);
}
