# Fase 3 — AI-crawlpijplijn (prospect-onderzoek per regio)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** Admin kiest een land + provincie/regio → Claude (Opus 4.8, server-side web search) onderzoekt het gebied per deelgebied en levert kandidaat-prospecten in exact het account-formaat → review-wachtrij → goedkeuren maakt er echte prospect-accounts van (met dedupe tegen de bestaande lijst).

**Architecture:** Alles in `equimanege-cms` (geen backend-wijziging). Een `crawl_runs`-record per gestart onderzoek; een discovery-stap splitst de regio in deelgebieden (`crawl_jobs`); elke job = één Claude-call die kandidaten oplevert (`crawl_candidates`, jsonb-payload). Jobs worden één-per-invocatie verwerkt (Vercel-functielimiet): een client-side "driver" op de run-pagina roept sequentieel `POST /api/crawl/process` aan zolang de pagina open staat; een nachtelijke cron veegt reststanden bij. Review-UI voor goedkeuren/afwijzen; goedkeuren hergebruikt het bestaande accounts-insert-pad met upsert-dedupe op (naam, gemeente).

**Claude-integratie (conform claude-api-skill):**
- SDK `@anthropic-ai/sdk`, model **`claude-opus-4-8`**, `thinking: {type:"adaptive"}`, streaming (`client.messages.stream` + `finalMessage()`), server tool **`web_search_20260209`** (`max_uses` begrensd), `max_tokens` ruim (64000).
- `pause_turn` afhandelen (assistant-turn terugsturen en hervatten, met `max_continuations`).
- Output: het model levert kandidaten als JSON in de tekst; Zod-parse (`crawlCandidateSchema`) met één herstel-poging bij parsefouten. (Geen `output_config.format` combineren met web search; prompt-JSON + Zod is robuust genoeg en verdraagt de zoektool-loop.)
- Kosten per call berekend uit `usage` ($5/M in, $25/M uit + cache-velden) en opgeteld per job/run; zichtbaar in de UI.
- `ANTHROPIC_API_KEY` optioneel in env; ontbreekt hij → nette NL-melding in de UI, alles behalve echte calls werkt (mock-modus voor tests).

## Regiocatalogus (`src/lib/regions.ts`)
Constante lijst: **BE** 10 provincies + Brussels Hoofdstedelijk Gewest; **NL** 12 provincies; **DE** 16 Bundesländer; **FR** 13 régions métropolitaines. `{country, code, name}`; unit-getest op aantallen/uniciteit.

## Schema-uitbreiding (`src/db/schema.ts` + migratie)
- `crawl_runs`: id, country, region, status enum (`pending|running|paused|done|failed`), startedBy (→cms_users), totalJobs, doneJobs, candidatesFound, costUsd numeric, createdAt/updatedAt.
- `crawl_jobs`: id, runId (cascade), area (deelgebied), status enum (`pending|running|done|failed`), candidatesFound, inputTokens, outputTokens, costUsd, error text, startedAt, finishedAt.
- `crawl_candidates`: id, runId, jobId, name, gemeente, payload jsonb (volledig account-veldenset incl. priority/score/opener), status enum (`pending|approved|rejected|duplicate`), reviewedBy, reviewedAt, accountId (→ accounts, nullable, gezet bij approve), createdAt.

## Onderzoeksmodule (`src/server/crawl/research.ts`)
- `discoverAreas(country, region)`: één call (web search) → JSON-lijst deelgebieden (BE/NL: gemeenten; DE: Kreise/steden; FR: departementen) — Zod-gevalideerd, max ~80.
- `researchArea({country, region, area, knownNames})`: de kern-call. Systeemprompt beschrijft doel (maneges/pensionstallen/opfok/sportstallen vinden voor EquiManage-sales), het exacte JSON-formaat (zelfde velden als de Limburg-import incl. `opener` in het Nederlands en prio A–X + score-heuristiek zoals de bron), en `knownNames` om dubbels over te slaan. Retourneert `{candidates, usage, costUsd}`.
- Prompt-JSON-contract gespiegeld in `src/lib/crawl-schema.ts` (Zod, pure, unit-getest met fixture).
- Client-injectie zodat tests een mock-client geven (geen netwerk in tests).

## Verwerking & API-routes
- Server actions (`src/server/actions/crawl.ts`, admin-only): `startCrawlRun(country, region)` (maakt run + discovery-job), `pauseRun`, `resumeRun`, `cancelRun`.
- `POST /api/crawl/process` (route, admin-sessie vereist óf `Authorization: Bearer CRON_SECRET`; `export const maxDuration = 300`): pakt de oudste `pending` job van een `running` run; discovery-job → maakt area-jobs; area-job → `researchArea`, schrijft candidates (status `duplicate` als naam+gemeente al bestaat in accounts of eerdere candidates), werkt tellers/kosten bij; retourneert `{processed, remaining}`. Vangt fouten per job (status `failed`, run loopt door).
- `vercel.json` cron-uitbreiding: dagelijks 04:00 UTC `/api/crawl/process` (veegt max 1 job — herhaalde aanroep binnen de functie tot ~4 min of geen werk).
- Client-driver op de run-pagina: roept process aan in lus zolang `remaining > 0` (met voortgang + stopknop).

## UI
- `/beheer/crawl` (admin): land-select → regio-select (catalogus), "Start onderzoek", lijst van runs (status, voortgang x/y, kandidaten, kosten €, gestart door). Run-rij → `/beheer/crawl/[id]`: jobtabel + live driver + pauze/annuleer + link naar review.
- `/review` (sales + admin, nav-item met badge-teller): wachtrij van `pending` kandidaten, kaart per kandidaat (kernvelden + opener + bron-links), knoppen **Goedkeuren** (→ insert account via bestaand pad, system-activity "Aangemaakt via AI-onderzoek run …", candidate → `approved`+accountId) / **Afwijzen**; filter per run/regio; "Alles van deze run goedkeuren behalve afgewezen" batch-actie.
- NL copy; Vercel-stijl consistent met de rest.

## Tests
- Unit: regions-catalogus, crawl-schema-parse (fixture + kapotte JSON → herstelpad), kandidaat→account-mapping, dedupe-beslisser, kostberekening uit usage-fixture, prompt-builder bevat knownNames/area.
- Research-module met gemockte Anthropic-client (fixture-response incl. pause_turn-scenario).
- E2E (zelfreinigend): review-flow met een handmatig geïnsert kandidaat → goedkeuren → account bestaat → opruimen.

## Verificatie
`npm run test` groen; build groen; e2e groen; UI-flow visueel (screenshots). Echte crawl-run (1 testgemeente) pas na ontvangst `ANTHROPIC_API_KEY` van Olivier — daarna kosten/kwaliteit rapporteren vóór een hele provincie draait.
