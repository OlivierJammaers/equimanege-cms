# Fase 2 — EquiManage-integratie + klant-KPI-dashboard

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** CMS-klanten koppelen aan EquiManage-tenants en per klant een KPI-dashboard met trends tonen, gevoed door een geheim-beveiligd read-only endpoint op de Laravel-backend + dagelijkse snapshots via Vercel-cron.

**Architecture:** Backend levert per owner-tenant een raw KPI-blok (`GET /api/internal/cms-kpis`, header `X-Kpi-Secret`, patroon = `VerifyCronSecret`). CMS-cron (`/api/cron/kpi-sync`, dagelijks, `CRON_SECRET`) haalt dat op en schrijft per gekoppelde klant een rij in `account_snapshots` (bestaat al, jsonb). Dashboard-tab op het account-detail (alleen `type=customer` mét koppeling) toont actuele KPI's + 30/90d-trends uit snapshots. Gezondheidsscore (groen/oranje/rood) wordt in het CMS berekend (pure functie) — backend blijft raw.

**Tech:** Laravel 12 + PHPUnit (Docker-Postgres 5433); Next.js/Drizzle/Vercel-cron; sparklines als lichte inline SVG (geen chartlib). **Vóór chart-code: dataviz-skill lezen.**

## Global Constraints

- **Mergevolgorde: backend-PR eerst** (merge = auto-deploy Fly); CMS-PR verwijst ernaar en andersom. NL-titels/samenvattingen, `gh`.
- Backend: nieuwe env `KPI_SYNC_SECRET` (Fly-secret + `.env.example`); header **`X-Kpi-Secret`**; `hash_equals`; fail-closed 503 als secret ontbreekt (kopie `VerifyCronSecret`-gedrag). Endpoint read-only, geen Sanctum.
- CMS: env `KPI_SYNC_SECRET` + `CRON_SECRET` + `EQUIMANEGE_API_URL` (default `https://api.equimanage.eu/api`); cron-route verifieert `Authorization: Bearer ${CRON_SECRET}` (Vercel-cron stuurt die automatisch mee bij een ingestelde CRON_SECRET-env).
- Tenant-id = `users.id` van de owner (rollen `manege_owner`,`opfokker_owner`,`sportstalling_owner`); alle aggregaties `WHERE manege_id = :id`.
- Alle nieuwe UI NL; TS strict; tests bij elke wijziging (PHPUnit / Vitest); backend-tests nooit tegen niet-lokale DB (TestCase-guard bestaat).
- Payload-contract (backend → CMS), per tenant exact:
  ```json
  { "tenant": {"id":1,"name":"…","email":"…","company_name":"…","role":"manege_owner","created_at":"…"},
    "lessons": {"total":0,"upcoming":0,"this_week":0,"completed_30d":0,"completed_90d":0,"cancelled_30d":0,"cancellation_rate_90d":0.0,"avg_participants_30d":0.0,"occupancy_rate_30d":0.0,"pending_registrations":0},
    "members": {"total":0,"active":0,"pending":0,"expiring_30d":0,"new_30d":0,"instructors":0},
    "engagement": {"last_active_at":null,"active_push_devices_30d":0,"announcements_30d":0,"chat_messages_30d":0},
    "commercial": {"monthly_price":0.0,"invoiced_30d":0.0,"invoiced_ytd":0.0,"invoices_paid_30d":0,"invoices_open":0,"invoices_overdue":0,"member_limit":null,"horse_limit":null},
    "adoption": {"horses":0,"pistes":0,"groups":0,"invoicing_in_use":false} }
  ```
  Response: `{ "generated_at": "...", "tenants": [ ...bovenstaand... ] }`.

## Taken

### B1 (backend): middleware + route + controller-skelet
- Create: `app/Http/Middleware/VerifyKpiSecret.php` (kopie VerifyCronSecret; header `X-Kpi-Secret`, env `KPI_SYNC_SECRET`, config `services.kpi_sync_secret`), registratie als alias `kpi.secret` (zelfde plek als `cron.secret`), route `GET /internal/cms-kpis` in `routes/api.php` → `Api\Internal\CmsKpiController@index`.
- Test: `tests/Feature`? — NEE: unit-suite-afspraak. Test de middleware-klasse unit-matig (request met/zonder/fout secret → 503/403/pass) naar analogie met bestaande VerifyCronSecret-tests (zoek die op; bestaan ze niet, test dan de controller-gate via de container). PHPUnit groen.

### B2 (backend): KPI-aggregaties
- Create: `app/Services/CmsKpiService.php` — `tenants(): array` conform payload-contract. Hergebruik query-patronen uit `LessonController::stats`/`MemberController::stats`. Bronnen: `lessons` (status/lesson_date/current_participants/max_participants), `lesson_registrations` (accepted), `members` (status/membership_end_date/is_instructor/accepted), `personal_access_tokens.last_used_at`, `push_devices.last_seen_at`+`enabled`, `sessions.last_activity`, `announcements`, `chat_messages`, `invoices` (status/total_amount/invoice_date/paid_at), `horses`, `pistes`, `user_groups`, owner-`users`-kolommen (`monthly_price`,`member_limit`,`horse_limit`,`company_name`). `last_active_at` = max over de engagement-bronnen (owner + alle member-user-ids).
- Controller roept service; `generated_at` = now ISO.
- Tests: `tests/Unit/CmsKpiServiceTest.php` — seed 1 tenant + members/lessons/registraties/facturen met bekende aantallen; assert exacte KPI-waarden (incl. avg_participants, occupancy, cancellation_rate, last_active_at-keuze). Lege tenant → nullen/null. `composer test` volledig groen (201+).

### B3 (backend): PR
- `.env.example` + `config/services.php` entry; `fly secrets set KPI_SYNC_SECRET=…` (met Olivier's gegenereerde secret — zelf genereren, in beide omgevingen zetten, NIET committen). PR met verwijzing naar CMS-PR + mergevolgorde. CI groen vóór merge.

### C1 (cms): sync-module + cron-route
- Create: `src/server/kpi-sync.ts` — `syncKpis(): Promise<{synced:number, skipped:number}>`: fetch `${EQUIMANEGE_API_URL}/internal/cms-kpis` met `X-Kpi-Secret`; Zod-parse payload (schema `src/lib/kpi-schema.ts`, gespiegeld aan contract); voor elk account met `equimanegeManegeId` in de payload → insert `account_snapshots` (kpis = tenant-blok). Max 1 snapshot per account per dag (upsert op accountId+datum of skip als vandaag al bestaat).
- Create: `src/app/api/cron/kpi-sync/route.ts` — GET; verifieert `Authorization: Bearer ${env.CRON_SECRET}`; roept `syncKpis`; JSON-resultaat. `vercel.json`: `{"crons":[{"path":"/api/cron/kpi-sync","schedule":"0 5 * * *"}]}`.
- Env-schema uitbreiden (`src/env.ts`): `KPI_SYNC_SECRET`, `CRON_SECRET`, `EQUIMANEGE_API_URL` (met default; alle drie optional zodat bestaande build niet breekt zonder).
- Tests (Vitest): kpi-schema parse (geldig/ongeldig fixture), sync-mapping pure delen (payload→snapshot-rows, dagdedup) met gemockte fetch/db of geëxtraheerde pure functies.

### C2 (cms): koppel-UI (admin)
- Op account-detail (admin, alle types): sectie "EquiManage-koppeling": toont huidige koppeling; knop opent dialog die tenants ophaalt via server action `listEquimanegeTenants()` (zelfde endpoint, alleen tenant-metadata), auto-suggestie op naamsgelijkenis (simpele includes/levenshtein-light), selecteren → server action `linkAccountToTenant(accountId, tenantId)`: zet `equimanegeManegeId` + `type='customer'` + system-activity "Gekoppeld aan EquiManage-tenant …". Ontkoppelen kan (`null` + activity, type blijft customer).
- Zod + `assertAdmin` in de actions; revalidate detail.
- Test: pure suggestie-functie (`suggestTenantMatches(accountName, tenants)`) unit-getest.

### C3 (cms): KPI-dashboard-tab
- **Eerst dataviz-skill lezen.** Detail-pagina: bij `type=customer` && gekoppeld → KPI-sectie boven de bronvelden: kaarten per groep (Lessen, Leden, Engagement/Gezondheid, Commercieel, Adoptie) met actuele waarde + 30d-sparkline (inline SVG, `stroke-currentColor`, tabular-nums) + delta-badge (↑/↓ vs 30d geleden). Gezondheidsscore-badge (groen/oranje/rood) prominent bij de kop.
- Create: `src/lib/health-score.ts` — pure: `computeHealthScore(latest, previous30d)` → `{level:'groen'|'oranje'|'rood', reasons:string[]}` op basis van: `last_active_at` ouder dan 14d → oranje, ouder dan 30d → rood; actieve leden gedaald >20% → oranje/rood; 0 upcoming lessons bij manege_owner → oranje; combineer ergste. Unit-getest met fixtures.
- Snapshot-data: server component leest `account_snapshots` (laatste + reeks 90d).
- Geen snapshots → nette lege staat ("Nog geen KPI-gegevens — eerste synchronisatie volgt 's nachts" + admin-knop "Nu synchroniseren" → server action die `syncKpis` draait, admin-only).

### C4 (cms): secrets + e2e-verificatie + PR
- Secrets genereren (`openssl rand -hex 32`): `KPI_SYNC_SECRET` → Fly (backend) + Vercel; `CRON_SECRET` → Vercel; beide + `EQUIMANEGE_API_URL` lokaal in `.env`.
- End-to-end lokaal: backend `php artisan serve` (8000) met secret in `.env`; CMS dev tegen `EQUIMANEGE_API_URL=http://127.0.0.1:8000/api`; koppel testklant (dev-Neon backend bevat Olivier's dev-data) → "Nu synchroniseren" → snapshot in DB → dashboard rendert; screenshots. Daarna prod: na beide merges cron-route eenmalig handmatig triggeren (curl met secret) en dashboard op cms.equimanage.eu controleren.
- PR's: CMS-PR verwijst naar backend-PR, mergevolgorde backend eerst. CI groen.

## Verificatie
- Backend: `composer test` groen (bestaand + nieuw); handmatig `curl -H "X-Kpi-Secret: …" localhost:8000/api/internal/cms-kpis | jq` toont correct contract; zonder header → 403/503.
- CMS: `npm run test` groen; koppel-flow + dashboard visueel geverifieerd (screenshots, ook mobiel); cron-route met/zonder juiste Authorization → 200/401.
