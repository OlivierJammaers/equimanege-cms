/**
 * Dedupe-beslisser voor de AI-crawlpijplijn (fase 3): bepaalt of een
 * gevonden kandidaat een duplicaat is van een bestaand account of een
 * eerder gevonden kandidaat in dezelfde run, op (naam, gemeente),
 * hoofdletter- en spatie-ongevoelig. Pure functie — geen DB — zodat de
 * dedupe-logica op zichzelf getest kan worden (zie
 * src/server/crawl/process.ts voor de DB-orchestratie eromheen).
 */

/** Genormaliseerde sleutel voor een (naam, gemeente)-combinatie. */
export function candidateKey(name: string, gemeente: string | null | undefined): string {
  return `${name.trim().toLowerCase()}|${(gemeente ?? "").trim().toLowerCase()}`;
}

export type CandidateStatus = "pending" | "duplicate";

export type ClassifiedCandidate<T> = {
  candidate: T;
  status: CandidateStatus;
};

/**
 * Classificeert elke kandidaat als `pending` of `duplicate` t.o.v.
 * `existingKeys` (bestaande accounts + eerder in deze run gevonden
 * kandidaten). Duplicaten binnen dezelfde batch worden ook onderling
 * herkend: de eerste met een bepaalde sleutel telt als origineel, latere
 * kandidaten met dezelfde sleutel worden `duplicate`.
 */
export function classifyCandidates<T extends { name: string; gemeente?: string | null }>(
  candidates: T[],
  existingKeys: ReadonlySet<string>,
): ClassifiedCandidate<T>[] {
  const seen = new Set(existingKeys);
  return candidates.map((candidate) => {
    const key = candidateKey(candidate.name, candidate.gemeente);
    if (seen.has(key)) {
      return { candidate, status: "duplicate" as const };
    }
    seen.add(key);
    return { candidate, status: "pending" as const };
  });
}
