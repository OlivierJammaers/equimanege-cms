/**
 * Pure, dependency-vrije rangschikking van EquiManage-tenants op naamsgelijkenis
 * met een CMS-accountnaam. Gebruikt door de koppel-dialoog (C2) om suggesties
 * bovenaan te tonen. Geen fuzzy/Levenshtein-library — bewust simpel gehouden:
 *
 * 1. Exacte match (case/whitespace-ongevoelig) op naam of company_name → 100.
 * 2. Substring-bevatting in beide richtingen → 50.
 * 3. Gedeelde woorden (langer dan 2 tekens) → schaal 1..40 naar overlap-ratio.
 *
 * Alleen resultaten met score > 0 worden teruggegeven, aflopend gesorteerd.
 */

export type TenantMatchCandidate = {
  id: number;
  name: string;
  company_name: string | null;
};

export type TenantMatch = {
  id: number;
  score: number;
};

const MIN_WORD_LENGTH = 3;

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function wordsOf(value: string): Set<string> {
  return new Set(
    normalize(value)
      .split(" ")
      .filter((word) => word.length >= MIN_WORD_LENGTH),
  );
}

function scoreAgainstCandidate(accountName: string, candidateName: string): number {
  const normalizedAccount = normalize(accountName);
  const normalizedCandidate = normalize(candidateName);
  if (!normalizedAccount || !normalizedCandidate) return 0;

  if (normalizedAccount === normalizedCandidate) return 100;

  if (
    normalizedAccount.includes(normalizedCandidate) ||
    normalizedCandidate.includes(normalizedAccount)
  ) {
    return 50;
  }

  const accountWords = wordsOf(accountName);
  const candidateWords = wordsOf(candidateName);
  if (accountWords.size === 0 || candidateWords.size === 0) return 0;

  let overlap = 0;
  for (const word of accountWords) {
    if (candidateWords.has(word)) overlap += 1;
  }
  if (overlap === 0) return 0;

  const ratio = overlap / Math.max(accountWords.size, candidateWords.size);
  // Blijft onder de substring-score (50), zodat de rangorde exact > substring > overlap blijft.
  return Math.round(ratio * 40);
}

export function suggestTenantMatches(
  accountName: string,
  tenants: TenantMatchCandidate[],
): TenantMatch[] {
  const results: TenantMatch[] = [];

  for (const tenant of tenants) {
    const candidateNames = [tenant.name, tenant.company_name].filter(
      (value): value is string => Boolean(value && value.trim()),
    );

    let score = 0;
    for (const candidateName of candidateNames) {
      score = Math.max(score, scoreAgainstCandidate(accountName, candidateName));
    }

    if (score > 0) {
      results.push({ id: tenant.id, score });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}
