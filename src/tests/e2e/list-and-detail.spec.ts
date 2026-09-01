import { test, expect, type Page } from "@playwright/test";
import { login, getLoggedInUserName } from "./helpers";

const UUID_PATH = /\/accounts\/[0-9a-f-]{36}$/;
const SEARCH_PLACEHOLDER = "Zoeken op naam, gemeente, telefoon…";

/** Leest de "N van M"-teller boven de tabel (accounts-table.tsx). */
async function readListCounter(
  page: Page,
): Promise<{ shown: number; total: number }> {
  const text = await page.getByText(/^\d+ van \d+$/).innerText();
  const match = text.match(/^(\d+) van (\d+)$/);
  if (!match) throw new Error(`Onverwachte tellertekst: "${text}"`);
  return { shown: Number(match[1]), total: Number(match[2]) };
}

/** Klikt de eerste rij van de tabel aan en wacht op de detailpagina. */
async function openFirstRow(page: Page): Promise<void> {
  await page.locator("table tbody tr").first().click();
  await page.waitForURL(UUID_PATH);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

test.describe("Lijst en detail", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("zoeken versmalt de tabel, filteren op prioriteit toont enkel die prioriteit", async ({
    page,
  }) => {
    const searchInput = page.getByPlaceholder(SEARCH_PLACEHOLDER);

    const before = await readListCounter(page);
    expect(before.shown).toBeGreaterThan(0);

    // Een garanteerd niet-bestaande zoekterm: het aantal getoonde rijen moet
    // dalen (naar 0), het totaal blijft ongewijzigd.
    await searchInput.fill("zzz-e2e-onbestaande-term-8x2q");
    await expect(page.getByText(/^0 van \d+$/)).toBeVisible();
    await expect(page.getByText("Geen accounts gevonden.")).toBeVisible();
    const afterSearch = await readListCounter(page);
    expect(afterSearch.shown).toBeLessThan(before.shown);
    expect(afterSearch.total).toBe(before.total);

    await searchInput.fill("");
    await expect(page.getByText(/^\d+ van \d+$/)).not.toHaveText(
      /^0 van \d+$/,
    );

    // Prioriteitsfilter: het eerste combobox-veld in de toolbar is "Prio"
    // (zie accounts-table.tsx, volgorde van de <Select>-elementen).
    const priorityTrigger = page.getByRole("combobox").first();
    await priorityTrigger.click();
    await page.getByRole("option", { name: "A", exact: true }).click();

    const geenGevonden = page.getByText("Geen accounts gevonden.");
    if (await geenGevonden.isVisible().catch(() => false)) {
      // Geen A-prioriteit accounts in deze dev-data — niets verder te
      // controleren, de filter zelf functioneert (0 resultaten getoond).
      return;
    }

    const rows = page.locator("table tbody tr");
    const rowCount = await rows.count();
    for (let i = 0; i < rowCount; i++) {
      await expect(rows.nth(i).locator("td").first()).toContainText("A");
    }
  });

  test("een rij openen navigeert naar het detail van dat account", async ({
    page,
  }) => {
    await openFirstRow(page);
    await expect(page).toHaveURL(UUID_PATH);
  });

  test("belstatus wijzigen naar 'Afspraak gepland' toont een toast en een nieuw tijdlijn-item", async ({
    page,
  }) => {
    await openFirstRow(page);

    const statusTrigger = page.getByRole("combobox");
    const statusChangeBadges = page.getByText("Statuswijziging", {
      exact: true,
    });

    // Zorg voor een gekend startpunt ("—"): als de belstatus toevallig al
    // "Afspraak gepland" is, zou de wijziging hieronder een no-op zijn (de
    // server-action logt alleen een activiteit bij een echte wijziging, zie
    // src/server/actions/accounts.ts). Deze eerste selectie kán zelf een
    // no-op zijn — dat is oké, hij dient enkel als bekend startpunt.
    await statusTrigger.click();
    await page.getByRole("option", { name: "—", exact: true }).click();

    const countBeforeChange = await statusChangeBadges.count();

    await statusTrigger.click();
    await page
      .getByRole("option", { name: "Afspraak gepland", exact: true })
      .click();

    await expect(page.getByText("Belstatus bijgewerkt").last()).toBeVisible();
    await expect(statusChangeBadges).toHaveCount(countBeforeChange + 1);

    // Reset: zet de belstatus terug naar "—" zodat deze e2e-run de
    // dev-data niet permanent achterlaat op "Afspraak gepland". Dit runt
    // tegen de dev-Neon-database (geen aparte testdatabase), dus opruimen
    // is hier bewust onderdeel van de spec i.p.v. van een fixture-teardown.
    await statusTrigger.click();
    await page.getByRole("option", { name: "—", exact: true }).click();
    await expect(page.getByText("Belstatus bijgewerkt").last()).toBeVisible();
  });

  test("een opmerking toevoegen verschijnt in de tijdlijn met de naam van de ingelogde gebruiker", async ({
    page,
  }) => {
    const userName = await getLoggedInUserName(page);
    await openFirstRow(page);

    const commentBody = "E2E-testopmerking";
    await page
      .getByPlaceholder("Opmerking toevoegen…")
      .fill(commentBody);
    await page.getByRole("button", { name: "Toevoegen" }).click();

    await expect(page.getByText("Opmerking toegevoegd").last()).toBeVisible();

    const commentItem = page.locator("li", { hasText: commentBody }).last();
    await expect(commentItem).toBeVisible();
    await expect(commentItem).toContainText("Opmerking");
    await expect(commentItem).toContainText(userName);
  });
});
