import type { NewAccount } from "@/db/schema";
import type { CrawlCandidate } from "@/lib/crawl-schema";

/**
 * Puur veldenmapping voor de review-flow (fase 3): zet een gevalideerde
 * crawl-kandidaat (`crawlCandidateSchema`) om naar een accounts-insert. Los
 * van I/O gehouden zodat de mapping zelf unit-testbaar is — de DB/activity-
 * insert en dedupe-afhandeling zitten in approveCandidate()
 * (src/server/actions/review.ts).
 */

export type CandidateRunInfo = {
  region: string;
  country: string;
};

/** `optionalText`-velden uit crawlCandidateSchema kunnen "", null of undefined zijn. */
function nullIfEmpty(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value.length > 0 ? value : null;
}

export function candidatePayloadToAccountInsert(
  payload: CrawlCandidate,
  run: CandidateRunInfo,
): NewAccount {
  const source = nullIfEmpty(payload.source) ?? "AI-onderzoek";

  return {
    type: "prospect",
    priority: payload.priority ?? null,
    score: payload.score ?? null,
    region: run.region,
    country: run.country,
    callStatus: "",
    name: payload.name,
    category: nullIfEmpty(payload.category),
    gemeente: nullIfEmpty(payload.gemeente),
    deelgemeente: nullIfEmpty(payload.deelgemeente),
    postcode: nullIfEmpty(payload.postcode),
    address: nullIfEmpty(payload.address),
    phone: nullIfEmpty(payload.phone),
    email: nullIfEmpty(payload.email),
    website: nullIfEmpty(payload.website),
    facebook: nullIfEmpty(payload.facebook),
    instagram: nullIfEmpty(payload.instagram),
    contactPerson: nullIfEmpty(payload.contactPerson),
    sizeInfo: nullIfEmpty(payload.sizeInfo),
    pricingInfo: nullIfEmpty(payload.pricingInfo),
    offer: nullIfEmpty(payload.offer),
    infrastructure: nullIfEmpty(payload.infrastructure),
    disciplines: nullIfEmpty(payload.disciplines),
    givesLessons: nullIfEmpty(payload.givesLessons),
    softwareStatus: nullIfEmpty(payload.softwareStatus),
    softwareDetail: nullIfEmpty(payload.softwareDetail),
    websiteTech: nullIfEmpty(payload.websiteTech),
    salesAngle: nullIfEmpty(payload.salesAngle),
    vatNumber: nullIfEmpty(payload.vatNumber),
    sourceNotes: nullIfEmpty(payload.sourceNotes),
    source,
    opener: nullIfEmpty(payload.opener),
  };
}
