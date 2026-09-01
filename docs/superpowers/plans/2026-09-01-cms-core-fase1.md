# EquiManage CMS — Fase 1 (CMS-core) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Een intern sales-CRM (Next.js fullstack, eigen Neon-DB, `cms.equimanage.eu`) met login (admin/sales), een prospectenlijst + detail met belverslag/comment-tijdlijn, en import van de 453 Limburg-prospecten.

**Architecture:** Next.js 15 App Router met server components + server actions voor alle mutaties. Drizzle ORM tegen Neon Postgres. Auth.js v5 (Credentials, JWT) beschermt `/(app)`-routes via middleware. De prospectentabel is een client-component (TanStack Table) die server-actions aanroept voor status/comment-updates; die schrijven zowel het `accounts`-veld als een `activities`-tijdlijnrij.

**Tech Stack:** Next.js 15, TypeScript (strict), Tailwind CSS v4, shadcn/ui, Drizzle ORM + drizzle-kit, `@neondatabase/serverless`, Auth.js v5 (next-auth@beta), bcryptjs, Zod, TanStack Table, Vitest, Playwright.

## Global Constraints

- **Node** ≥ 20. Package manager: **npm**.
- **TypeScript strict** = true; geen `any` in nieuwe code.
- **Taal**: UI is NL-only. Geen i18next; UI-strings in `src/lib/copy.ts` (of inline, consistent NL).
- **Geen secrets committen.** `.env*` in `.gitignore`. Connection strings enkel lokaal / in Vercel env.
- **DB-driver**: overal `@neondatabase/serverless` via `drizzle-orm/neon-http` (of `neon-serverless` voor pooled). Nooit `pg`.
- **Elke mutatie loopt via een server action** in `src/server/actions/*` met Zod-validatie en een auth/rol-check aan het begin.
- **Rollen**: `admin` mag alles; `sales` mag lezen + tracking/comments schrijven, geen gebruikersbeheer/import.
- **Bel-status enum** (exact, overal identiek — DB, Zod, UI):
  `""`, `"gebeld-geen-gehoor"`, `"gesproken-interesse"`, `"gesproken-geen-interesse"`, `"afspraak-gepland"`, `"demo-gegeven"`, `"klant"`, `"niet-benaderen"`.
- **Prioriteit enum**: `A`,`B`,`C`,`D`,`N`,`X`.
- **Tests groen vóór oplevering**: `npm run test` (Vitest) en `npm run test:e2e` (Playwright) — conform monorepo-werkafspraak.
- **Branch**: `feat/cms-core-fase1` (al aangemaakt). PR zelf aanmaken via `gh`, Nederlandstalige titel/samenvatting.
- **Verificatiebron**: de 453 prospecten komen uit `/Users/olivierjammaers/Downloads/EquiManage_belllijst_Limburg.html`, veld `const DATA = [ ... ]`.

---

## File Structure

```
equimanege-cms/
  package.json, tsconfig.json, next.config.ts, tailwind/postcss config, drizzle.config.ts
  .env.example, .gitignore, .github/workflows/tests.yml
  vitest.config.ts, playwright.config.ts
  src/
    env.ts                      # Zod-gevalideerde env (DATABASE_URL, DATABASE_URL_UNPOOLED, AUTH_SECRET)
    db/
      index.ts                  # drizzle client
      schema.ts                 # cms_users, accounts, activities, account_snapshots + enums
    lib/
      constants.ts              # CALL_STATUSES, PRIORITIES, labels, kleuren
      copy.ts                   # NL UI-strings
      utils.ts                  # cn(), csv-helpers, formatters
      auth.ts                   # Auth.js config (authOptions/handlers, callbacks met role)
      auth-guards.ts            # requireUser(), requireAdmin() voor server actions/pages
      import-limburg.ts         # pure parser: html-string -> AccountSeed[]  (unit-getest)
      stats.ts                  # computeListStats(accounts) -> tegels/voortgang  (unit-getest)
    middleware.ts               # beschermt /(app)
    server/actions/
      accounts.ts               # updateCallStatus, addComment, setNextAction, toggleDone, convertToCustomer
      users.ts                  # createSalesUser, deactivateUser, resetPassword (admin-only)
    app/
      globals.css               # Tailwind v4 + Geist + shadcn tokens (zinc, dark-mode)
      layout.tsx                # root layout, Geist-font
      login/page.tsx            # login-form (client) -> signIn credentials
      (app)/
        layout.tsx              # app-shell: header/nav, sessie, uitloggen
        page.tsx                # dashboard/lijst (server: haalt accounts + stats)
        accounts/[id]/page.tsx  # detail (server)
        beheer/gebruikers/page.tsx  # admin: sales-CRUD
        beheer/import/page.tsx      # admin: import-knop
      api/auth/[...nextauth]/route.ts
    components/
      ui/*                      # shadcn-generated (button, input, card, table, select, badge, dialog, textarea, sonner...)
      accounts/accounts-table.tsx      # client, TanStack Table + filters
      accounts/stats-tiles.tsx         # server/client tegels + voortgangsbalk
      accounts/call-status-select.tsx  # inline status-select -> server action
      accounts/activity-timeline.tsx   # tijdlijn render
      accounts/add-comment-form.tsx    # client -> addComment
      accounts/export-csv-button.tsx
      layout/app-header.tsx
    scripts/
      seed-admin.ts             # eenmalig admin-account (env EMAIL/PASSWORD)
      run-import-limburg.ts     # leest html-bestand, roept parser aan, upsert in DB
    tests/
      unit/*.test.ts            # parser, stats, status-transitie, auth-guards, csv
      e2e/*.spec.ts             # login, lijst, detail-belverslag
      fixtures/limburg-sample.html
```

---

## Task 1: Project-scaffold (Next.js + Tailwind + shadcn + tooling)

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx` (tijdelijk), `.gitignore`, `.env.example`, `components.json`, `src/lib/utils.ts`
- Create: `vitest.config.ts`, `src/tests/unit/smoke.test.ts`

**Interfaces:**
- Produces: werkende Next-app die buildt; `cn()` in `src/lib/utils.ts`; `npm run test` draait Vitest.

- [ ] **Step 1: Scaffold Next + Tailwind**

```bash
cd /Users/olivierjammaers/Documents/Projects/EquiManege/equimanege-cms
# scaffold in de bestaande (niet-lege: README + docs) map
npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack --use-npm
```
Bij de prompt "directory not empty" → doorgaan (README/docs blijven behouden; overschrijf niets kritisch). Controleer nadien dat `docs/` en `README.md` er nog staan.

- [ ] **Step 2: Voeg dev-dependencies + scripts toe**

```bash
npm i drizzle-orm @neondatabase/serverless zod next-auth@beta bcryptjs @tanstack/react-table sonner
npm i -D drizzle-kit vitest @vitejs/plugin-react tsx @types/bcryptjs @playwright/test dotenv
```
Voeg aan `package.json` scripts toe:
```json
"db:generate": "drizzle-kit generate",
"db:migrate": "drizzle-kit migrate",
"db:push": "drizzle-kit push",
"test": "vitest run",
"test:watch": "vitest",
"test:e2e": "playwright test",
"seed:admin": "tsx src/scripts/seed-admin.ts",
"import:limburg": "tsx src/scripts/run-import-limburg.ts"
```

- [ ] **Step 3: shadcn init + basiscomponenten**

```bash
npx shadcn@latest init -d   # style: default, base color: zinc
npx shadcn@latest add button input label card table select badge dialog sheet textarea dropdown-menu sonner tabs
```

- [ ] **Step 4: Geist-font + globale stijl**

In `src/app/layout.tsx`: gebruik `next/font` Geist Sans/Mono (Next levert deze mee), zet `lang="nl"`, dark-mode class-strategy. In `globals.css`: behoud shadcn-zinc-tokens.

- [ ] **Step 5: Vitest-config + smoke-test**

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  test: { environment: "node", include: ["src/tests/unit/**/*.test.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
```
`src/tests/unit/smoke.test.ts`:
```ts
import { expect, test } from "vitest";
test("smoke", () => { expect(1 + 1).toBe(2); });
```

- [ ] **Step 6: Draai build + test**

Run: `npm run test` → PASS. Run: `npm run build` → slaagt (tijdelijke `page.tsx` mag).

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "chore: scaffold Next.js + Tailwind + shadcn + Vitest"
```

---

## Task 2: Env-validatie + Drizzle-client + schema

**Files:**
- Create: `src/env.ts`, `src/db/index.ts`, `src/db/schema.ts`, `drizzle.config.ts`, `.env.example`
- Test: `src/tests/unit/schema.test.ts`

**Interfaces:**
- Produces: `db` (drizzle client) uit `src/db/index.ts`; tabellen `cmsUsers`, `accounts`, `activities`, `accountSnapshots` + inferred types `Account`, `NewAccount`, `Activity`, `CmsUser` uit `src/db/schema.ts`; `env` uit `src/env.ts`.

- [ ] **Step 1: Env-schema**

`src/env.ts`:
```ts
import { z } from "zod";
const schema = z.object({
  DATABASE_URL: z.string().url(),
  DATABASE_URL_UNPOOLED: z.string().url().optional(),
  AUTH_SECRET: z.string().min(16),
});
export const env = schema.parse(process.env);
```

- [ ] **Step 2: Schema (Drizzle, pgEnum + tabellen)**

`src/db/schema.ts` — definieer:
```ts
import { pgTable, pgEnum, uuid, text, integer, boolean, timestamp, date, jsonb, index } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("cms_role", ["admin", "sales"]);
export const accountTypeEnum = pgEnum("account_type", ["prospect", "customer"]);
export const priorityEnum = pgEnum("priority", ["A","B","C","D","N","X"]);
export const callStatusEnum = pgEnum("call_status", [
  "","gebeld-geen-gehoor","gesproken-interesse","gesproken-geen-interesse",
  "afspraak-gepland","demo-gegeven","klant","niet-benaderen",
]);
export const activityTypeEnum = pgEnum("activity_type", ["comment","call","status_change","email","system"]);

export const cmsUsers = pgTable("cms_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: roleEnum("role").notNull().default("sales"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accounts = pgTable("accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: accountTypeEnum("type").notNull().default("prospect"),
  priority: priorityEnum("priority"),
  score: integer("score"),
  region: text("region"),
  country: text("country"),
  assignedTo: uuid("assigned_to").references(() => cmsUsers.id),
  equimanegeManegeId: integer("equimanege_manege_id"),
  callStatus: callStatusEnum("call_status").notNull().default(""),
  nextActionDate: date("next_action_date"),
  isDone: boolean("is_done").notNull().default(false),
  // bronvelden
  name: text("name").notNull(),
  category: text("category"), gemeente: text("gemeente"), deelgemeente: text("deelgemeente"),
  postcode: text("postcode"), address: text("address"), phone: text("phone"), email: text("email"),
  website: text("website"), facebook: text("facebook"), instagram: text("instagram"),
  contactPerson: text("contact_person"), sizeInfo: text("size_info"), pricingInfo: text("pricing_info"),
  offer: text("offer"), infrastructure: text("infrastructure"), disciplines: text("disciplines"),
  givesLessons: text("gives_lessons"), softwareStatus: text("software_status"),
  softwareDetail: text("software_detail"), websiteTech: text("website_tech"), salesAngle: text("sales_angle"),
  vatNumber: text("vat_number"), sourceStatus: text("source_status"), contactScore: text("contact_score"),
  sourceType: text("source_type"), sourceNotes: text("source_notes"), source: text("source"),
  onYourList: text("on_your_list"), opener: text("opener"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  gemeenteIdx: index("accounts_gemeente_idx").on(t.gemeente),
  priorityIdx: index("accounts_priority_idx").on(t.priority),
}));

export const activities = pgTable("activities", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => cmsUsers.id),
  type: activityTypeEnum("type").notNull(),
  body: text("body"),
  callOutcome: callStatusEnum("call_outcome"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ accIdx: index("activities_account_idx").on(t.accountId) }));

export const accountSnapshots = pgTable("account_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
  kpis: jsonb("kpis").notNull(),
});

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Activity = typeof activities.$inferSelect;
export type CmsUser = typeof cmsUsers.$inferSelect;
```

- [ ] **Step 3: Drizzle-client + config**

`src/db/index.ts`:
```ts
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { env } from "@/env";
import * as schema from "./schema";
export const db = drizzle(neon(env.DATABASE_URL), { schema });
```
`drizzle.config.ts`:
```ts
import "dotenv/config";
import { defineConfig } from "drizzle-kit";
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL! },
});
```
`.env.example`: lijst `DATABASE_URL=`, `DATABASE_URL_UNPOOLED=`, `AUTH_SECRET=`.

- [ ] **Step 4: Schema-vorm-test (geen DB nodig)**

`src/tests/unit/schema.test.ts` — assert dat enum-arrays de exacte waarden bevatten:
```ts
import { expect, test } from "vitest";
import { callStatusEnum, priorityEnum } from "@/db/schema";
test("call status enum values", () => {
  expect(callStatusEnum.enumValues).toContain("afspraak-gepland");
  expect(callStatusEnum.enumValues).toContain("");
  expect(callStatusEnum.enumValues.length).toBe(8);
});
test("priority enum", () => { expect(priorityEnum.enumValues).toEqual(["A","B","C","D","N","X"]); });
```

- [ ] **Step 5: Run test → PASS**

Run: `npm run test` → PASS. (Migreren gebeurt in Task 8 zodra de Neon-URL er is.)

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: env-validatie + Drizzle-client + schema"
```

---

## Task 3: Constants + import-parser (pure, unit-getest)

**Files:**
- Create: `src/lib/constants.ts`, `src/lib/import-limburg.ts`, `src/tests/fixtures/limburg-sample.html`
- Test: `src/tests/unit/import-limburg.test.ts`

**Interfaces:**
- Consumes: `NewAccount` uit schema (subset).
- Produces: `CALL_STATUSES`, `CALL_STATUS_LABELS`, `PRIORITIES` in `constants.ts`; `parseLimburgHtml(html: string): AccountSeed[]` in `import-limburg.ts` waar `AccountSeed` = `Pick<NewAccount, ...bronvelden...> & { priority, score, region, country, type }`.

- [ ] **Step 1: Constants**

`src/lib/constants.ts`:
```ts
export const CALL_STATUSES = ["","gebeld-geen-gehoor","gesproken-interesse","gesproken-geen-interesse","afspraak-gepland","demo-gegeven","klant","niet-benaderen"] as const;
export type CallStatus = typeof CALL_STATUSES[number];
export const CALL_STATUS_LABELS: Record<CallStatus, string> = {
  "": "—",
  "gebeld-geen-gehoor": "Gebeld – geen gehoor",
  "gesproken-interesse": "Gesproken – interesse",
  "gesproken-geen-interesse": "Gesproken – geen interesse",
  "afspraak-gepland": "Afspraak gepland",
  "demo-gegeven": "Demo gegeven",
  "klant": "Klant",
  "niet-benaderen": "Niet benaderen",
};
export const PRIORITIES = ["A","B","C","D","N","X"] as const;
export const PRIORITY_LABELS: Record<string,string> = {
  A: "A – bel deze week", B: "B – deze maand", C: "C – tweede ronde",
  D: "D – laag / onvolledig", N: "N – geen stal", X: "X – niet benaderen",
};
```

- [ ] **Step 2: Failing test met mini-fixture**

Maak `src/tests/fixtures/limburg-sample.html` met een `<script>const DATA = [ {..2 records..} ];</script>` inclusief HTML-entity (`&#x27;`) en één leeg veld. `src/tests/unit/import-limburg.test.ts`:
```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";
import { parseLimburgHtml } from "@/lib/import-limburg";

const html = readFileSync(path.join(__dirname, "../fixtures/limburg-sample.html"), "utf8");
test("parses records and maps fields", () => {
  const rows = parseLimburgHtml(html);
  expect(rows.length).toBe(2);
  expect(rows[0].name).toBe("Alfa Stables");
  expect(rows[0].priority).toBe("A");
  expect(rows[0].region).toBe("Limburg");
  expect(rows[0].country).toBe("BE");
  expect(rows[0].type).toBe("prospect");
});
test("decodes html entities", () => {
  const rows = parseLimburgHtml(html);
  expect(rows[0].contactPerson).toContain("'"); // &#x27; -> '
});
test("empty source field -> null/undefined not the string 'undefined'", () => {
  const rows = parseLimburgHtml(html);
  expect(rows[1].deelgemeente ?? "").not.toBe("undefined");
});
```

- [ ] **Step 3: Run → FAIL** (`parseLimburgHtml` niet gedefinieerd).

- [ ] **Step 4: Implementeer parser**

`src/lib/import-limburg.ts`: vind `const DATA = [` t/m matchend `];`, `JSON.parse`, decodeer HTML-entities (`&#x27;`→`'`, `&amp;`,`&ndash;`,`&middot;` etc.), map de NL-bronsleutels op camelCase-kolommen. Mapping-tabel (bron→kolom): `Bedrijf→name`, `Categorie→category`, `Gemeente→gemeente`, `Deelgemeente→deelgemeente`, `Postcode→postcode`, `Adres→address`, `Telefoon→phone`, `E-mail→email`, `Website→website`, `Facebook→facebook`, `Instagram→instagram`, `Contactpersoon / eigenaar→contactPerson`, `Omvang (boxen/paarden/leden)→sizeInfo`, `Tarieven→pricingInfo`, `Aanbod→offer`, `Infrastructuur→infrastructure`, `Disciplines→disciplines`, `Geeft lessen→givesLessons`, `Softwarestatus→softwareStatus`, `Software-detail→softwareDetail`, `Website-techniek→websiteTech`, `Verkoophoek→salesAngle`, `BTW-nummer→vatNumber`, `Status→sourceStatus`, `Contactscore (0-5)→contactScore`, `Type (ruwe bron)→sourceType`, `Notities→sourceNotes`, `Bron→source`, `Op jouw lijst→onYourList`, `Opener→opener`, `Prio→priority`, `Score→score`. Zet `region:"Limburg"`, `country:"BE"`, `type:"prospect"`. Lege strings → `null`.

- [ ] **Step 5: Run → PASS**. Run: `npm run test`.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: constants + Limburg import-parser (unit-getest)"
```

---

## Task 4: Lijst-statistieken (pure functie, unit-getest)

**Files:**
- Create: `src/lib/stats.ts`
- Test: `src/tests/unit/stats.test.ts`

**Interfaces:**
- Consumes: `Account[]` (minimaal `{priority, callStatus, isDone}`).
- Produces: `computeListStats(rows)` → `{ total, byPriority: Record<Priority,number>, done, progressPct }`.

- [ ] **Step 1: Failing test**

```ts
import { expect, test } from "vitest";
import { computeListStats } from "@/lib/stats";
test("counts totals, priorities and progress", () => {
  const s = computeListStats([
    { priority: "A", callStatus: "", isDone: false },
    { priority: "A", callStatus: "klant", isDone: true },
    { priority: "B", callStatus: "", isDone: false },
  ] as any);
  expect(s.total).toBe(3);
  expect(s.byPriority.A).toBe(2);
  expect(s.done).toBe(1);
  expect(s.progressPct).toBe(33); // 1/3 afgerond
});
```

- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implementeer `computeListStats`** (tel per prioriteit, `done`=`isDone`, `progressPct`=`Math.round(done/total*100)`).
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** `git commit -am "feat: lijst-statistieken"`

---

## Task 5: Auth (Auth.js Credentials) + guards + middleware

**Files:**
- Create: `src/lib/auth.ts`, `src/lib/auth-guards.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/middleware.ts`, `src/app/login/page.tsx`, `src/scripts/seed-admin.ts`
- Test: `src/tests/unit/auth-guards.test.ts`

**Interfaces:**
- Consumes: `cmsUsers` uit schema; `bcryptjs`.
- Produces: `auth()`, `handlers`, `signIn`, `signOut` uit `src/lib/auth.ts`; `requireUser()` → `{id, role, name, email}` (throwt/redirect anders) en `requireAdmin()` uit `src/lib/auth-guards.ts`. Sessie-`user` bevat `id` en `role`.

- [ ] **Step 1: Auth-config**

`src/lib/auth.ts`: `NextAuth({ session:{strategy:"jwt"}, providers:[Credentials({ authorize })], callbacks:{ jwt: voeg role+id toe, session: exposeer role+id }, pages:{ signIn:"/login" } })`. `authorize`: zoek `cmsUsers` op email, check `isActive`, `bcrypt.compare(password, passwordHash)`; return `{id,email,name,role}` of `null`. Export `handlers, auth, signIn, signOut`.

- [ ] **Step 2: Route + middleware**

`src/app/api/auth/[...nextauth]/route.ts`: `export const { GET, POST } = handlers;`. `src/middleware.ts`: `export { auth as middleware } from "@/lib/auth";` met `config.matcher` op `["/((?!login|api/auth|_next|favicon).*)"]` → redirect ongeauthenticeerd naar `/login`.

- [ ] **Step 3: Guards + test**

`src/lib/auth-guards.ts`: `requireUser()` roept `auth()`; geen sessie → `redirect("/login")`; geeft `session.user`. `requireAdmin()` → als `role!=="admin"` → `redirect("/")`. Test met gemockte `auth()`:
```ts
import { expect, test, vi } from "vitest";
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
import { auth } from "@/lib/auth";
import { assertAdmin } from "@/lib/auth-guards";
test("assertAdmin throws for sales", () => {
  expect(() => assertAdmin({ role: "sales" } as any)).toThrow();
  expect(() => assertAdmin({ role: "admin" } as any)).not.toThrow();
});
```
(Voeg een pure `assertUser(user)`/`assertAdmin(user)` toe naast de redirect-varianten, zodat unit-testbaar.)

- [ ] **Step 4: Login-pagina**

`src/app/login/page.tsx` (client): shadcn `Card`+`Input`+`Button`, roept `signIn("credentials",{email,password,redirectTo:"/"})`, toont foutmelding bij `?error`.

- [ ] **Step 5: Seed-admin-script**

`src/scripts/seed-admin.ts`: leest `ADMIN_EMAIL`/`ADMIN_PASSWORD` env, `bcrypt.hash`, upsert in `cmsUsers` met `role:"admin"`. Idempotent op email.

- [ ] **Step 6: Run test → PASS.** Commit `git commit -am "feat: Auth.js credentials + guards + login + admin-seed"`

---

## Task 6: App-shell + lijst + stats-tegels + tabel + CSV-export

**Files:**
- Create: `src/app/(app)/layout.tsx`, `src/app/(app)/page.tsx`, `src/components/layout/app-header.tsx`, `src/components/accounts/stats-tiles.tsx`, `src/components/accounts/accounts-table.tsx`, `src/components/accounts/call-status-select.tsx`, `src/components/accounts/export-csv-button.tsx`
- Modify: verwijder tijdelijke `src/app/page.tsx`
- Test: `src/tests/unit/csv.test.ts`

**Interfaces:**
- Consumes: `db`, `accounts`, `computeListStats`, `CALL_STATUSES`, server action `updateCallStatus` (Task 7).
- Produces: `toCsv(rows): string` in `src/lib/utils.ts`.

- [ ] **Step 1: App-shell**

`(app)/layout.tsx`: `await requireUser()`; render `AppHeader` (logo "EquiManage CMS", nav: Lijst, [admin] Beheer, uitloggen via `signOut`) + `{children}` in een `max-w`-container.

- [ ] **Step 2: Lijst-page (server)**

`(app)/page.tsx`: `const rows = await db.select().from(accounts).orderBy(...)`; `const stats = computeListStats(rows)`; render `<StatsTiles stats/>` + `<AccountsTable rows/>`. Filteren/sorteren client-side in de tabel.

- [ ] **Step 3: Stats-tegels**

`stats-tiles.tsx`: shadcn `Card`-grid met totaal, per-prio (A–X badges), voortgangsbalk (`progressPct`).

- [ ] **Step 4: Tabel (client, TanStack)**

`accounts-table.tsx`: kolommen prio-badge, naam+categorie(sub), gemeente, telefoon (klikbare `tel:`), softwarestatus, inline `<CallStatusSelect>`, next-action; globale zoekfilter + prio/gemeente/status-selects (shadcn `Select`) + "afgehandeld verbergen"-toggle; rij-klik → `router.push('/accounts/'+id)`. Done-rijen dimmen.

- [ ] **Step 5: CSV-export + test**

`toCsv` in `utils.ts` (headers + escaping). Test:
```ts
import { expect, test } from "vitest";
import { toCsv } from "@/lib/utils";
test("csv escapes commas/quotes", () => {
  const out = toCsv([{ a: 'x,y', b: 'he"llo' }]);
  expect(out).toContain('"x,y"');
  expect(out).toContain('"he""llo"');
});
```
`export-csv-button.tsx`: bouwt CSV van de zichtbare rijen, triggert download (Blob).

- [ ] **Step 6: Run test → PASS**, `npm run build` slaagt. Commit `git commit -am "feat: app-shell + prospectenlijst + tegels + tabel + CSV-export"`

---

## Task 7: Server actions — belverslag, comment, next-action, done, convert

**Files:**
- Create: `src/server/actions/accounts.ts`
- Modify: `src/components/accounts/call-status-select.tsx`, `src/app/(app)/accounts/[id]/page.tsx` (Task 8 gebruikt deze)
- Test: `src/tests/unit/status-transition.test.ts`

**Interfaces:**
- Consumes: `db`, `accounts`, `activities`, `requireUser`, Zod, `revalidatePath`.
- Produces: `updateCallStatus(accountId, status)`, `addComment(accountId, body)`, `setNextAction(accountId, date|null)`, `toggleDone(accountId, done)`, `convertToCustomer(accountId)` — allemaal `"use server"`, met auth-check + Zod-validatie.

- [ ] **Step 1: Failing test op de log-helper**

Extraheer een pure helper `buildStatusChangeActivity(accountId, userId, status)` → `{accountId,userId,type:"status_change",callOutcome:status,body:label}`. Test dat een lege/gelijke status geen dubbele log maakt en dat de outcome/label kloppen.

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implementeer actions**

Elke action: `const user = await requireUser();` → Zod-parse args → DB-update in een transactie: bij `updateCallStatus` zowel `accounts.callStatus` zetten als een `activities`-rij (`type:"status_change"`, `callOutcome`) inserten via de helper; `addComment` → `activities`(`type:"comment"`, `body`); `setNextAction` → `accounts.nextActionDate`; `toggleDone` → `accounts.isDone`; `convertToCustomer` → `accounts.type="customer"` + system-activity. Elk eindigt met `revalidatePath("/")` en `revalidatePath("/accounts/"+id)`.

- [ ] **Step 4: Bedraad `call-status-select.tsx`** → `onValueChange` roept `updateCallStatus` (server action) via `startTransition`, toont `sonner`-toast.

- [ ] **Step 5: Run test → PASS.** Commit `git commit -am "feat: server actions belverslag/comment/next-action/done/convert"`

---

## Task 8: Account-detail (bronvelden + tijdlijn + comment-form)

**Files:**
- Create: `src/app/(app)/accounts/[id]/page.tsx`, `src/components/accounts/activity-timeline.tsx`, `src/components/accounts/add-comment-form.tsx`, `src/components/accounts/next-action-controls.tsx`
- Test: (dekt via e2e in Task 11)

**Interfaces:**
- Consumes: `db`, `accounts`, `activities`, actions uit Task 7, `CALL_STATUS_LABELS`.

- [ ] **Step 1: Detail-page (server)**

Haal account + `activities` (desc op `createdAt`, join `cmsUsers.name`). Render secties in shadcn `Card`s: Kop (naam, prio-badge, gemeente, `CallStatusSelect`, done-toggle, "Maak klant"-knop); Contact (adres/tel/mail/web/social); Omvang & tarieven; Aanbod & infrastructuur; Software; Verkoophoek + **Opener** (uitgelicht kader); daarnaast een kolom met `NextActionControls`, `AddCommentForm` en `ActivityTimeline`.

- [ ] **Step 2: Tijdlijn** — `activity-timeline.tsx`: lijst met per item auteur, tijdstip (NL-datum), type-badge, body/outcome-label.

- [ ] **Step 3: Comment-form** — client `textarea`+`Button` → `addComment`, reset + toast.

- [ ] **Step 4: Next-action** — datumveld → `setNextAction`.

- [ ] **Step 5: `npm run build` slaagt.** Commit `git commit -am "feat: account-detail met bronvelden, tijdlijn en comment-form"`

---

## Task 9: Admin — gebruikersbeheer + import-scherm

**Files:**
- Create: `src/server/actions/users.ts`, `src/app/(app)/beheer/gebruikers/page.tsx`, `src/app/(app)/beheer/import/page.tsx`, `src/scripts/run-import-limburg.ts`
- Test: `src/tests/unit/users-action.test.ts` (validatie/rolcheck via pure guard)

**Interfaces:**
- Consumes: `db`, `cmsUsers`, `assertAdmin`, `bcryptjs`, `parseLimburgHtml`.
- Produces: `createSalesUser({name,email,password})`, `deactivateUser(id)`, `resetPassword(id,newPw)` (admin-only); import-runner-script.

- [ ] **Step 1: Users-actions** — elk begint met `assertAdmin(user)`; Zod-validatie (email, min-wachtwoord 8); `createSalesUser` hasht + insert (`role:"sales"`).
- [ ] **Step 2: Test** — `assertAdmin` blokkeert sales; email-Zod weigert ongeldig.
- [ ] **Step 3: Gebruikers-page (admin)** — tabel van `cmsUsers` + dialog "sales toevoegen" + deactiveren/reset-knoppen.
- [ ] **Step 4: Import-runner** — `run-import-limburg.ts`: leest het HTML-pad (arg of default Downloads-pad), `parseLimburgHtml`, **upsert op `(name,gemeente)`** (idempotent), print aantal ingevoegd/bijgewerkt.
- [ ] **Step 5: Import-page (admin)** — knop toont instructie + (later) upload; voor nu documenteert het de CLI `npm run import:limburg`.
- [ ] **Step 6: Run test → PASS.** Commit `git commit -am "feat: admin-gebruikersbeheer + Limburg-import-runner"`

---

## Task 10: DB migreren + seeden + import draaien (vereist Neon-URL)

> **Blokkerend op Olivier:** `DATABASE_URL` (pooled) + `DATABASE_URL_UNPOOLED` (direct) + `ADMIN_EMAIL`/`ADMIN_PASSWORD`. Tot die er zijn, zijn Task 1–9 volledig te bouwen/testen (unit); deze task voert ze uit tegen de echte DB.

**Files:** Create: `drizzle/` (gegenereerde migraties), `.env` (lokaal, niet gecommit)

- [ ] **Step 1:** `.env` invullen met de Neon-strings + `AUTH_SECRET=$(openssl rand -base64 32)`.
- [ ] **Step 2:** `npm run db:generate` → controleer de SQL-migratie in `drizzle/`.
- [ ] **Step 3:** `npm run db:migrate` → tabellen aangemaakt (verifieer met een `select` of Neon-console).
- [ ] **Step 4:** `ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run seed:admin` → admin-account.
- [ ] **Step 5:** `npm run import:limburg` → verwacht ~453 accounts ingevoegd; verifieer count.
- [ ] **Step 6: Commit** de gegenereerde migraties: `git add drizzle && git commit -m "chore: initiële DB-migraties"`

---

## Task 11: E2E (Playwright) + CI-workflow

**Files:**
- Create: `playwright.config.ts`, `src/tests/e2e/login.spec.ts`, `src/tests/e2e/list-and-detail.spec.ts`, `.github/workflows/tests.yml`

- [ ] **Step 1: Playwright-config** — `webServer: npm run build && npm run start` op poort 3000; `baseURL`.
- [ ] **Step 2: Login-spec** — verkeerd wachtwoord → fout; juist → land op lijst.
- [ ] **Step 3: Lijst+detail-spec** — filter op prio A → minder rijen; open een prospect; kies bel-status "Afspraak gepland" → tijdlijn toont een `status_change`; voeg comment toe → verschijnt in tijdlijn.
- [ ] **Step 4: CI-workflow** — `tests.yml`: Node 20, `npm ci`, `npm run test`; e2e met een Postgres-service of tegen een test-Neon-branch (zo niet beschikbaar: alleen unit + build in CI, e2e lokaal — documenteer de keuze).
- [ ] **Step 5:** `npm run test:e2e` lokaal groen. Commit `git commit -am "test: e2e (login/lijst/detail) + CI-workflow"`

---

## Task 12: Deploy (Vercel) + domein

> Aan het eind van fase 1, samen met Olivier.

- [ ] **Step 1:** `vercel link` naar de `equimanege-cms`-repo (of via dashboard).
- [ ] **Step 2:** Env-vars in Vercel: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `AUTH_SECRET`.
- [ ] **Step 3:** Deploy preview → smoke-test login + lijst.
- [ ] **Step 4:** Domein `cms.equimanage.eu` toevoegen (DNS-CNAME) → productie.
- [ ] **Step 5: PR** aanmaken via `gh` (NL titel/samenvatting) en pas mergen bij groene `tests`-check.

---

## Self-Review

- **Spec-dekking:** auth+rollen (T5,T9) ✓; prospectenlijst+filters+sorteren+tegels+CSV (T6) ✓; detail+belverslag+comment-tijdlijn+next-action+done+convert (T7,T8) ✓; import Limburg (T3,T9,T10) ✓; gebruikersbeheer (T9) ✓; Vercel-look/shadcn (T1,T6,T8) ✓; deploy+domein (T12) ✓; datamodel incl. `equimanege_manege_id`+`account_snapshots` voor fase 2 (T2) ✓; tests (T3,T4,T6,T7,T9,T11) ✓.
- **Enum-consistentie:** `callStatusEnum` (schema T2) == `CALL_STATUSES` (T3) == Zod in actions (T7) — 8 waarden incl. `""`. Prio A/B/C/D/N/X overal gelijk.
- **Blokkade duidelijk:** T10/T12 vereisen Neon/Vercel-input van Olivier; T1–T9 + T11-unit zijn zonder DB te bouwen (unit-tests zijn puur, geen DB-hits).
