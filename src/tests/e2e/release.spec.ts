import "dotenv/config";
import { test, expect } from "@playwright/test";
import bcrypt from "bcryptjs";
import { and, eq, isNull, sql } from "drizzle-orm";
import { login } from "./helpers";
import { db } from "../../db";
import { accounts, cmsUsers } from "../../db/schema";

/**
 * Vrijgave-per-25 (fase 4): admin ziet de vrijgavekaart met tellers, sales
 * ziet ze niet en heeft geen zicht op een nog-niet-vrijgegeven prospect.
 * Zelfreinigend en bewust read-only t.o.v. de vrijgave-status zelf: de
 * "Volgende 25 vrijgeven"-knop wordt hier NIET aangeklikt (dat zou echte
 * `released_at`-rijen zetten in de dev-DB) — enkel de kaart/tellers en de
 * zichtbaarheidsregel worden gecontroleerd, tegen de huidige DB-toestand.
 *
 * De tijdelijke sales-gebruiker wordt rechtstreeks via Drizzle aangemaakt
 * (met een vooraf gehashte wachtwoord, zoals src/scripts/seed-admin.ts) en
 * in `afterAll` weer verwijderd.
 */

const SALES_EMAIL = "e2e-sales@equimanage.eu";
const SALES_PASSWORD = "E2e-Test-Wachtwoord-1!";
const SEARCH_PLACEHOLDER = "Zoeken op naam, gemeente, telefoon…";
const NO_RESULTS_TEXT = "Geen accounts gevonden.";

let unreleasedProspectName: string;

async function cleanup() {
  await db.delete(cmsUsers).where(eq(cmsUsers.email, SALES_EMAIL));
}

test.describe("Vrijgave per 25 (self-cleaning, read-only t.o.v. release-status)", () => {
  test.beforeAll(async () => {
    // Opruimen van een eventuele leftover uit een eerder afgebroken run.
    await cleanup();

    const passwordHash = await bcrypt.hash(SALES_PASSWORD, 10);
    await db.insert(cmsUsers).values({
      email: SALES_EMAIL,
      passwordHash,
      name: "E2E Sales",
      role: "sales",
      isActive: true,
    });

    const [prospect] = await db
      .select({ name: accounts.name })
      .from(accounts)
      .where(and(eq(accounts.type, "prospect"), isNull(accounts.releasedAt)))
      .limit(1);
    if (!prospect) {
      throw new Error(
        "Geen niet-vrijgegeven prospect gevonden in de dev-DB — kan de " +
          "zichtbaarheidsregel niet testen. Draai `npm run import:limburg`.",
      );
    }
    unreleasedProspectName = prospect.name;
  });

  test.afterAll(async () => {
    await cleanup();
  });

  test("admin ziet de vrijgavekaart met correcte tellers en vindt een niet-vrijgegeven prospect", async ({
    page,
  }) => {
    await login(page);

    const [{ total, released }] = await db
      .select({
        total: sql<number>`count(*)::int`,
        released: sql<number>`count(*) filter (where ${accounts.releasedAt} is not null)::int`,
      })
      .from(accounts)
      .where(eq(accounts.type, "prospect"));

    await expect(
      page.getByText(`${released} van ${total} prospecten vrijgegeven`),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Volgende 25 vrijgeven" }),
    ).toBeVisible();

    await page.getByPlaceholder(SEARCH_PLACEHOLDER).fill(unreleasedProspectName);
    await expect(
      page.getByText(unreleasedProspectName, { exact: true }),
    ).toBeVisible();
  });

  test("sales ziet geen vrijgavekaart en geen niet-vrijgegeven prospect", async ({
    page,
  }) => {
    await login(page, { email: SALES_EMAIL, password: SALES_PASSWORD });

    await expect(page.getByText("Vrijgave voor sales")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Volgende 25 vrijgeven" }),
    ).toHaveCount(0);

    await page.getByPlaceholder(SEARCH_PLACEHOLDER).fill(unreleasedProspectName);
    await expect(page.getByText(NO_RESULTS_TEXT)).toBeVisible();
    await expect(
      page.getByText(unreleasedProspectName, { exact: true }),
    ).toHaveCount(0);
  });
});
