import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/env";
import { COUNTRY_LABELS, type Country } from "@/lib/regions";
import {
  crawlResponseSchema,
  discoveryResponseSchema,
  extractJson,
  type CrawlResponse,
  type DiscoveryResponse,
} from "@/lib/crawl-schema";

/**
 * Claude-integratie voor de AI-crawlpijplijn (fase 3). Zie
 * docs/superpowers/plans/2026-09-03-fase3-ai-crawl.md onder
 * "Claude-integratie" en "Onderzoeksmodule".
 *
 * Werkt tegen een minimale structurele clientvorm (`ResearchClient`) i.p.v.
 * rechtstreeks tegen `Anthropic`, zodat unit-tests een mock-client kunnen
 * injecteren zonder netwerkverkeer. `getClient()` maakt de echte
 * `Anthropic`-client pas aan op het moment dat hij nodig is (nooit bij
 * module-load), zodat een ontbrekende `ANTHROPIC_API_KEY` de build niet
 * breekt — alleen een effectieve crawl-call.
 */

const MODEL = "claude-opus-4-8";
const MAX_TOKENS = 64000;
const MAX_CONTINUATIONS = 5;

export type Usage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
};

export type ResearchContentBlock = {
  type: string;
  text?: string;
  [key: string]: unknown;
};

export type ResearchMessage = {
  role: "assistant";
  content: ResearchContentBlock[];
  stop_reason: string | null;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
};

export type ResearchMessageParam = {
  role: "user" | "assistant";
  content: string | ResearchContentBlock[];
};

/**
 * Minimale structurele vorm van wat we van een Anthropic-client nodig
 * hebben. De echte `Anthropic`-instantie voldoet hieraan; testen geven een
 * lichte mock mee.
 */
export type ResearchClient = {
  messages: {
    stream: (params: Record<string, unknown>) => {
      finalMessage: () => Promise<ResearchMessage>;
    };
  };
};

/**
 * Maakt de echte Anthropic-client aan. Wordt pas aangeroepen wanneer geen
 * client geïnjecteerd is (dus nooit in unit-tests, en nooit tijdens de
 * build) — de foutmelding bij een ontbrekende API-key verschijnt dus pas
 * bij een effectieve crawl-aanroep.
 */
export function getClient(): ResearchClient {
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY ontbreekt — stel deze in om AI-onderzoek te draaien.",
    );
  }
  return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }) as unknown as ResearchClient;
}

/**
 * Opus 4.8-tarieven ($/M tokens): input $5, output $25, cache-write
 * (1.25× input) $6.25, cache-read (0.1× input) $0.5.
 */
export function computeCostUsd(usage: Usage): number {
  return (
    (usage.inputTokens * 5 +
      usage.cacheWriteTokens * 6.25 +
      usage.cacheReadTokens * 0.5 +
      usage.outputTokens * 25) /
    1_000_000
  );
}

function zeroUsage(): Usage {
  return { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
}

function addUsage(target: Usage, message: ResearchMessage["usage"]): void {
  target.inputTokens += message?.input_tokens ?? 0;
  target.outputTokens += message?.output_tokens ?? 0;
  target.cacheReadTokens += message?.cache_read_input_tokens ?? 0;
  target.cacheWriteTokens += message?.cache_creation_input_tokens ?? 0;
}

function extractText(content: ResearchContentBlock[]): string {
  return content
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text as string)
    .join("\n");
}

const RETRY_INSTRUCTION =
  "Je antwoord was geen geldige JSON. Antwoord met uitsluitend het gevraagde JSON-object.";

/**
 * Stuurt de conversatie (bestaande `messages`, in-place aangevuld) tot een
 * niet-`pause_turn`-antwoord binnenkomt, met een harde grens van
 * `MAX_CONTINUATIONS` hervattingen. Telt de token-usage van elke afzonderlijke
 * call op bij `usage` (in-place).
 */
async function runToCompletion(params: {
  client: ResearchClient;
  system?: string;
  tools: Record<string, unknown>[];
  messages: ResearchMessageParam[];
  usage: Usage;
}): Promise<string> {
  const { client, system, tools, messages, usage } = params;
  let continuations = 0;

  for (;;) {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      thinking: { type: "adaptive" },
      ...(system ? { system } : {}),
      tools,
      messages,
    });
    const message = await stream.finalMessage();
    addUsage(usage, message.usage);

    if (message.stop_reason === "pause_turn" && continuations < MAX_CONTINUATIONS) {
      continuations++;
      messages.push({ role: "assistant", content: message.content });
      continue;
    }

    messages.push({ role: "assistant", content: message.content });
    return extractText(message.content);
  }
}

type ParseResult<T> = { success: true; data: T } | { success: false; error: string };

function parseJson<T>(text: string, schema: { safeParse: (v: unknown) => { success: boolean; data?: T; error?: unknown } }): ParseResult<T> {
  try {
    const jsonText = extractJson(text);
    const parsed = JSON.parse(jsonText) as unknown;
    const result = schema.safeParse(parsed);
    if (!result.success) {
      return { success: false, error: JSON.stringify(result.error) };
    }
    return { success: true, data: result.data as T };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Voert een volledige "vraag Claude om JSON"-conversatie uit: initiële
 * user-message, `pause_turn`-afhandeling via `runToCompletion`, en bij een
 * ongeldig/onparseerbaar antwoord één hersteltoging (assistant-tekst blijft
 * in de conversatie staan, gevolgd door de vaste NL-hersteltekst).
 */
async function requestJson<T>(params: {
  client: ResearchClient;
  system?: string;
  userText: string;
  tools: Record<string, unknown>[];
  schema: { safeParse: (v: unknown) => { success: boolean; data?: T; error?: unknown } };
}): Promise<{ data: T; usage: Usage }> {
  const { client, system, userText, tools, schema } = params;
  const usage = zeroUsage();
  const messages: ResearchMessageParam[] = [{ role: "user", content: userText }];

  const firstText = await runToCompletion({ client, system, tools, messages, usage });
  let parsed = parseJson<T>(firstText, schema);

  if (!parsed.success) {
    messages.push({ role: "user", content: RETRY_INSTRUCTION });
    const retryText = await runToCompletion({ client, system, tools, messages, usage });
    parsed = parseJson<T>(retryText, schema);
  }

  if (!parsed.success) {
    throw new Error(
      `Claude leverde geen geldig JSON-antwoord op, ook niet na een hersteltoging: ${parsed.error}`,
    );
  }

  return { data: parsed.data, usage };
}

function countryLabel(country: Country): string {
  return COUNTRY_LABELS[country] ?? country;
}

function buildDiscoveryPrompt(country: Country, region: string): string {
  return `Je bent een onderzoeksassistent voor EquiManage, software voor maneges, opfokkers en sportstallingen (lessen, leden, stallingen, pistes, facturatie).

Stel een volledige lijst samen van de deelgebieden van de regio "${region}" in ${countryLabel(country)}. Gebruik hiervoor:
- voor België (BE) en Nederland (NL): alle gemeenten binnen deze regio;
- voor Duitsland (DE): alle Kreise en kreisfreie Städte binnen dit Bundesland;
- voor Frankrijk (FR): alle départements binnen deze région.

Gebruik de web-zoekfunctie om een volledige en actuele lijst samen te stellen. Neem geen deelgemeenten of steden op, enkel de officiële deelgebieden zoals hierboven beschreven.

Antwoord UITSLUITEND met een JSON-object in exact dit formaat, zonder omringende tekst of uitleg:
{"areas": ["<deelgebied 1>", "<deelgebied 2>", "..."]}`;
}

function buildResearchSystemPrompt(
  country: Country,
  region: string,
  area: string,
  knownNames: string[],
): string {
  const knownNamesBlock =
    knownNames.length > 0
      ? `\n\nDe volgende bedrijven zijn al bekend — sla ze over in je resultaat (rapporteer ze niet opnieuw):\n${knownNames.map((n) => `- ${n}`).join("\n")}`
      : "";

  return `Je bent een sales-onderzoeksassistent voor EquiManage, software voor paardensportbedrijven (lessen, leden, stallingen, pistes, facturatie).

Zoek ALLE maneges, pensionstallen, opfok-/fokkerijbedrijven, sportstallen en ruiterclubs in "${area}" (${region}, ${countryLabel(country)}). Gebruik de web-zoekfunctie grondig: zoek per bedrijf de website, Facebook-pagina en/of Instagram-account op en verzamel daaruit de onderstaande velden.

Lever voor elk gevonden bedrijf een object met exact deze velden (gebruik null wanneer een veld niet te achterhalen is):
- name (verplicht): bedrijfsnaam
- category: type bedrijf, bv. "Manege", "Pensionstal", "Opfokbedrijf", "Sportstal", "Ruiterclub"
- gemeente: gemeente
- deelgemeente: deelgemeente, indien van toepassing
- postcode
- address: straat en nummer
- phone
- email
- website
- facebook: URL van de Facebook-pagina
- instagram: URL van het Instagram-account
- contactPerson: naam van de eigenaar of contactpersoon
- sizeInfo: omvang (aantal boxen/paarden/leden), indien gevonden
- pricingInfo: tarieven, indien gevonden
- offer: aanbod (lessen, pensionstalling, verkoop, ...)
- infrastructure: infrastructuur (buitenpiste, binnenpiste, stapmolen, ...)
- disciplines: disciplines (dressuur, springen, western, ...)
- givesLessons: geeft het bedrijf lessen? ("Ja", "Nee" of "Onbekend")
- softwareStatus: gebruikt het bedrijf al software voor lessen/leden/facturatie, en welke indicatie daarvoor is gevonden
- softwareDetail: naam van de gebruikte software, indien gevonden
- websiteTech: technologie van de website (bv. "WordPress", "Wix", "Handgemaakt", "Geen website")
- salesAngle: korte Nederlandstalige analyse waarom dit bedrijf een goede prospect is voor EquiManage
- vatNumber: BTW-/ondernemingsnummer, indien gevonden
- sourceNotes: overige relevante opmerkingen
- source: de URL(s) die je als bron gebruikt hebt voor dit bedrijf
- opener: 2-3 zinnen Nederlandstalige gespreksopener voor een salesgesprek, die verwijst naar iets specifieks van dit bedrijf (bv. een recente post, een nieuwe piste, een uitbreiding)
- priority: prioriteit A t/m X — A = veel leden/lessen, actief, zonder zichtbare software; B = actief maar kleiner; C = onduidelijk/te weinig info om te prioriteren; D = weinig informatie gevonden; N = geen stal of duidelijk hobbymatig; X = niet benaderen (gestopt, dubbel, of duidelijk al klant elders)
- score: heuristische score van 0 tot 200 op basis van geschatte grootte × kans dat er nog geen passende software gebruikt wordt (hoger = interessanter)
${knownNamesBlock}

Antwoord UITSLUITEND met een JSON-object in exact dit formaat, zonder omringende tekst of uitleg:
{"candidates": [{"name": "...", "category": null, "gemeente": null, "deelgemeente": null, "postcode": null, "address": null, "phone": null, "email": null, "website": null, "facebook": null, "instagram": null, "contactPerson": null, "sizeInfo": null, "pricingInfo": null, "offer": null, "infrastructure": null, "disciplines": null, "givesLessons": null, "softwareStatus": null, "softwareDetail": null, "websiteTech": null, "salesAngle": null, "vatNumber": null, "sourceNotes": null, "source": null, "opener": null, "priority": null, "score": null}]}`;
}

/**
 * Eén Claude-call die de deelgebieden van een land+regio opzoekt (BE/NL:
 * gemeenten; DE: Kreise/kreisfreie Städte; FR: départements).
 */
export async function discoverAreas(
  country: Country,
  region: string,
  client?: ResearchClient,
): Promise<{ data: DiscoveryResponse; usage: Usage; costUsd: number }> {
  const activeClient = client ?? getClient();
  const { data, usage } = await requestJson<DiscoveryResponse>({
    client: activeClient,
    userText: buildDiscoveryPrompt(country, region),
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 8 }],
    schema: discoveryResponseSchema,
  });
  return { data, usage, costUsd: computeCostUsd(usage) };
}

export type ResearchAreaInput = {
  country: Country;
  region: string;
  area: string;
  knownNames: string[];
};

/**
 * Kern-call: onderzoekt één deelgebied en levert kandidaat-prospecten op in
 * het account-veldenformaat.
 */
export async function researchArea(
  input: ResearchAreaInput,
  client?: ResearchClient,
): Promise<{ data: CrawlResponse; usage: Usage; costUsd: number }> {
  const activeClient = client ?? getClient();
  const system = buildResearchSystemPrompt(
    input.country,
    input.region,
    input.area,
    input.knownNames,
  );
  const { data, usage } = await requestJson<CrawlResponse>({
    client: activeClient,
    system,
    userText: `Start het onderzoek voor "${input.area}" en lever uitsluitend het gevraagde JSON-object op.`,
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 12 }],
    schema: crawlResponseSchema,
  });
  return { data, usage, costUsd: computeCostUsd(usage) };
}
