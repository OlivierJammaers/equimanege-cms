import { describe, expect, test, vi } from "vitest";
import {
  computeCostUsd,
  discoverAreas,
  researchArea,
  type ResearchClient,
  type ResearchMessage,
  type ResearchMessageParam,
  type Usage,
} from "@/server/crawl/research";

function textMessage(
  text: string,
  overrides: Partial<ResearchMessage> = {},
): ResearchMessage {
  return {
    role: "assistant",
    content: [{ type: "text", text }],
    stop_reason: "end_turn",
    usage: {
      input_tokens: 100,
      output_tokens: 50,
      cache_read_input_tokens: 10,
      cache_creation_input_tokens: 0,
      ...overrides.usage,
    },
    ...overrides,
  };
}

/** Bouwt een mock-client die de gegeven responses in volgorde teruggeeft. */
function makeMockClient(responses: ResearchMessage[]) {
  const calls: Record<string, unknown>[] = [];
  let index = 0;
  const client: ResearchClient = {
    messages: {
      stream: (params: Record<string, unknown>) => {
        calls.push(params);
        const response = responses[Math.min(index, responses.length - 1)];
        index++;
        return { finalMessage: async () => response };
      },
    },
  };
  return { client, calls, callCount: () => index };
}

const VALID_CANDIDATES_JSON = JSON.stringify({
  candidates: [
    {
      name: "Manege Testgebied",
      category: "Manege",
      gemeente: "Hasselt",
      priority: "A",
      score: 120,
      opener: "Ik zag dat jullie net een nieuwe piste hebben — hoe bevalt die?",
    },
  ],
});

const VALID_AREAS_JSON = JSON.stringify({ areas: ["Hasselt", "Genk"] });

describe("computeCostUsd", () => {
  test("berekent de kost volgens Opus 4.8-tarieven", () => {
    const usage: Usage = {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      cacheReadTokens: 1_000_000,
      cacheWriteTokens: 1_000_000,
    };
    // 5 + 25 + 0.5 + 6.25 = 36.75
    expect(computeCostUsd(usage)).toBeCloseTo(36.75, 6);
  });

  test("geeft 0 terug bij lege usage", () => {
    expect(
      computeCostUsd({
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      }),
    ).toBe(0);
  });
});

describe("researchArea", () => {
  test("parseert kandidaten uit een fenced JSON-antwoord en berekent de kost", async () => {
    const fenced = `Hier is mijn onderzoek:\n\n\`\`\`json\n${VALID_CANDIDATES_JSON}\n\`\`\``;
    const { client, callCount } = makeMockClient([textMessage(fenced)]);

    const result = await researchArea(
      {
        country: "BE",
        region: "Limburg",
        area: "Hasselt",
        knownNames: ["Bestaande Manege"],
      },
      client,
    );

    expect(callCount()).toBe(1);
    expect(result.data.candidates).toHaveLength(1);
    expect(result.data.candidates[0].name).toBe("Manege Testgebied");
    expect(result.usage.inputTokens).toBe(100);
    expect(result.usage.outputTokens).toBe(50);
    expect(result.costUsd).toBeGreaterThan(0);
    expect(result.costUsd).toBeCloseTo(computeCostUsd(result.usage), 10);
  });

  test("neemt knownNames op in de systeemprompt", async () => {
    const { client, calls } = makeMockClient([textMessage(VALID_CANDIDATES_JSON)]);

    await researchArea(
      {
        country: "BE",
        region: "Limburg",
        area: "Hasselt",
        knownNames: ["Manege Al Bekend"],
      },
      client,
    );

    const firstCall = calls[0] as { system?: string };
    expect(firstCall.system).toContain("Manege Al Bekend");
    expect(firstCall.system).toContain("Hasselt");
  });

  test("hervat de conversatie bij pause_turn en telt de usage van beide calls op", async () => {
    const paused = textMessage("Ik ben nog aan het zoeken...", {
      stop_reason: "pause_turn",
      content: [{ type: "text", text: "Ik ben nog aan het zoeken..." }],
      usage: {
        input_tokens: 200,
        output_tokens: 80,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
      },
    });
    const finished = textMessage(VALID_CANDIDATES_JSON, {
      usage: {
        input_tokens: 300,
        output_tokens: 60,
        cache_read_input_tokens: 5,
        cache_creation_input_tokens: 0,
      },
    });
    const { client, calls, callCount } = makeMockClient([paused, finished]);

    const result = await researchArea(
      { country: "BE", region: "Limburg", area: "Hasselt", knownNames: [] },
      client,
    );

    expect(callCount()).toBe(2);
    // De tweede call moet de assistant-turn van de eerste (gepauzeerde) call bevatten.
    const secondCallMessages = (calls[1] as { messages: ResearchMessageParam[] }).messages;
    expect(secondCallMessages.some((m) => m.role === "assistant")).toBe(true);

    expect(result.data.candidates).toHaveLength(1);
    expect(result.usage.inputTokens).toBe(500); // 200 + 300
    expect(result.usage.outputTokens).toBe(140); // 80 + 60
  });

  test("doet één hersteltoging bij ongeldige JSON en slaagt bij de tweede poging", async () => {
    const invalid = textMessage("Sorry, ik kon geen JSON opstellen deze keer.");
    const valid = textMessage(VALID_CANDIDATES_JSON);
    const { client, calls, callCount } = makeMockClient([invalid, valid]);

    const result = await researchArea(
      { country: "BE", region: "Limburg", area: "Hasselt", knownNames: [] },
      client,
    );

    expect(callCount()).toBe(2);
    const secondCallMessages = (calls[1] as { messages: ResearchMessageParam[] }).messages;
    // Bevat de mislukte assistant-poging en de vaste hersteltekst als user-message.
    expect(
      secondCallMessages.some(
        (m) => m.role === "user" && typeof m.content === "string" && m.content.includes("geen geldige JSON"),
      ),
    ).toBe(true);
    expect(result.data.candidates).toHaveLength(1);
  });

  test("gooit een fout wanneer ook de hersteltoging geen geldige JSON oplevert", async () => {
    const invalid1 = textMessage("Nog steeds geen JSON.");
    const invalid2 = textMessage("Opnieuw geen JSON.");
    const { client } = makeMockClient([invalid1, invalid2]);

    await expect(
      researchArea(
        { country: "BE", region: "Limburg", area: "Hasselt", knownNames: [] },
        client,
      ),
    ).rejects.toThrow();
  });
});

describe("discoverAreas", () => {
  test("parseert de deelgebieden-lijst", async () => {
    const { client, callCount, calls } = makeMockClient([textMessage(VALID_AREAS_JSON)]);

    const result = await discoverAreas("BE", "Limburg", client);

    expect(callCount()).toBe(1);
    expect(result.data.areas).toEqual(["Hasselt", "Genk"]);
    const firstCall = calls[0] as { tools?: Array<{ max_uses?: number }> };
    expect(firstCall.tools?.[0]?.max_uses).toBe(8);
  });
});

describe("getClient", () => {
  test("gooit een NL-foutmelding wanneer ANTHROPIC_API_KEY ontbreekt", async () => {
    vi.resetModules();
    const originalKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const mod = await import("@/server/crawl/research");
      expect(() => mod.getClient()).toThrow(/ANTHROPIC_API_KEY ontbreekt/);
    } finally {
      if (originalKey !== undefined) process.env.ANTHROPIC_API_KEY = originalKey;
      vi.resetModules();
    }
  });
});
