import type { NewAccount } from "@/db/schema";
import { PRIORITIES, type Priority } from "@/lib/constants";

/**
 * The "bronvelden" subset of the accounts table: columns that are filled
 * directly from the Limburg source spreadsheet/HTML export.
 */
type BronVeld =
  | "name"
  | "category"
  | "gemeente"
  | "deelgemeente"
  | "postcode"
  | "address"
  | "phone"
  | "email"
  | "website"
  | "facebook"
  | "instagram"
  | "contactPerson"
  | "sizeInfo"
  | "pricingInfo"
  | "offer"
  | "infrastructure"
  | "disciplines"
  | "givesLessons"
  | "softwareStatus"
  | "softwareDetail"
  | "websiteTech"
  | "salesAngle"
  | "vatNumber"
  | "sourceStatus"
  | "contactScore"
  | "sourceType"
  | "sourceNotes"
  | "source"
  | "onYourList"
  | "opener";

export type AccountSeed = Pick<NewAccount, BronVeld> & {
  priority: Priority | null;
  score: number | null;
  region: string;
  country: string;
  type: NewAccount["type"];
};

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  ndash: "–",
  mdash: "—",
  middot: "·",
  quot: '"',
  apos: "'",
  nbsp: " ",
  lt: "<",
  gt: ">",
  euro: "€",
};

/**
 * Decodes HTML entities in a plain string. Must only ever be called on
 * already-parsed JSON string *values*, never on the raw JSON text itself
 * (decoding e.g. `&quot;` before JSON.parse would corrupt the structure).
 */
function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, hex: string) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_match, dec: string) =>
      String.fromCodePoint(parseInt(dec, 10)),
    )
    .replace(/&([a-zA-Z]+);/g, (match, name: string) => {
      const key = name.toLowerCase();
      return key in NAMED_ENTITIES ? NAMED_ENTITIES[key] : match;
    });
}

/**
 * Locates the `const DATA = [ ... ];` array in the source HTML and returns
 * the exact substring `[ ... ]` (matching brackets), so it can be handed to
 * JSON.parse. Uses bracket-depth matching that skips over string literals,
 * because narrative fields in the data may themselves contain `]` or `;`
 * characters — a naive `indexOf('];')` would truncate the array early.
 */
function extractDataArrayText(html: string): string {
  const marker = "const DATA = [";
  const markerIdx = html.indexOf(marker);
  if (markerIdx === -1) {
    throw new Error("Kon 'const DATA = [' niet vinden in de HTML-bron.");
  }
  const startIdx = markerIdx + marker.length - 1; // index of the opening '['

  let depth = 0;
  let inString: '"' | "'" | null = null;
  let i = startIdx;
  for (; i < html.length; i++) {
    const ch = html[i];

    if (inString) {
      if (ch === "\\") {
        i++; // skip escaped character
        continue;
      }
      if (ch === inString) {
        inString = null;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = ch;
      continue;
    }

    if (ch === "[" || ch === "{") {
      depth++;
    } else if (ch === "]" || ch === "}") {
      depth--;
      if (depth === 0) {
        break;
      }
    }
  }

  if (depth !== 0) {
    throw new Error("Onafgesloten DATA-array in de HTML-bron.");
  }

  return html.slice(startIdx, i + 1);
}

function isPriority(value: string): value is Priority {
  return (PRIORITIES as readonly string[]).includes(value);
}

function str(raw: Record<string, unknown>, key: string): string {
  const value = raw[key];
  if (typeof value === "string") return decodeHtmlEntities(value);
  if (typeof value === "number") return String(value);
  return "";
}

function nullableStr(raw: Record<string, unknown>, key: string): string | null {
  const value = str(raw, key);
  return value === "" ? null : value;
}

function mapRecord(raw: Record<string, unknown>): AccountSeed {
  const seed: AccountSeed = {
    name: str(raw, "Bedrijf"),
    category: nullableStr(raw, "Categorie"),
    gemeente: nullableStr(raw, "Gemeente"),
    deelgemeente: nullableStr(raw, "Deelgemeente"),
    postcode: nullableStr(raw, "Postcode"),
    address: nullableStr(raw, "Adres"),
    phone: nullableStr(raw, "Telefoon"),
    email: nullableStr(raw, "E-mail"),
    website: nullableStr(raw, "Website"),
    facebook: nullableStr(raw, "Facebook"),
    instagram: nullableStr(raw, "Instagram"),
    contactPerson: nullableStr(raw, "Contactpersoon / eigenaar"),
    sizeInfo: nullableStr(raw, "Omvang (boxen/paarden/leden)"),
    pricingInfo: nullableStr(raw, "Tarieven"),
    offer: nullableStr(raw, "Aanbod"),
    infrastructure: nullableStr(raw, "Infrastructuur"),
    disciplines: nullableStr(raw, "Disciplines"),
    givesLessons: nullableStr(raw, "Geeft lessen"),
    softwareStatus: nullableStr(raw, "Softwarestatus"),
    softwareDetail: nullableStr(raw, "Software-detail"),
    websiteTech: nullableStr(raw, "Website-techniek"),
    salesAngle: nullableStr(raw, "Verkoophoek"),
    vatNumber: nullableStr(raw, "BTW-nummer"),
    sourceStatus: nullableStr(raw, "Status"),
    contactScore: nullableStr(raw, "Contactscore (0-5)"),
    sourceType: nullableStr(raw, "Type (ruwe bron)"),
    sourceNotes: nullableStr(raw, "Notities"),
    source: nullableStr(raw, "Bron"),
    onYourList: nullableStr(raw, "Op jouw lijst"),
    opener: nullableStr(raw, "Opener"),
    priority: null,
    score: null,
    region: "Limburg",
    country: "BE",
    type: "prospect",
  };

  const prioRaw = str(raw, "Prio").trim().toUpperCase();
  seed.priority = isPriority(prioRaw) ? prioRaw : null;

  const scoreValue = raw["Score"];
  const parsedScore =
    typeof scoreValue === "number"
      ? scoreValue
      : typeof scoreValue === "string" && scoreValue !== ""
        ? Number(scoreValue)
        : null;
  seed.score = parsedScore !== null && Number.isNaN(parsedScore) ? null : parsedScore;

  return seed;
}

function isRecordArray(value: unknown): value is Record<string, unknown>[] {
  return (
    Array.isArray(value) &&
    value.every((entry) => typeof entry === "object" && entry !== null)
  );
}

/**
 * Parses the Limburg belllijst export HTML (a `const DATA = [ {...}, ... ];`
 * array embedded in a <script> tag) into account seed objects ready to be
 * inserted into the `accounts` table. Pure function: no I/O, no DB.
 *
 * Field mapping (source NL key -> AccountSeed column) is done explicitly in
 * mapRecord() above, per the task-3 brief's mapping table.
 */
export function parseLimburgHtml(html: string): AccountSeed[] {
  const arrayText = extractDataArrayText(html);
  const parsed: unknown = JSON.parse(arrayText);
  if (!isRecordArray(parsed)) {
    throw new Error("DATA is geen array van objecten.");
  }
  return parsed.map(mapRecord);
}
