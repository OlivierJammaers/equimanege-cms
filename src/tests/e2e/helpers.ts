import type { Page } from "@playwright/test";

/**
 * Leest de e2e-inloggegevens uit de omgeving. Faalt snel met een duidelijke
 * NL-foutmelding als ze ontbreken, zodat een vergeten .env niet leidt tot
 * verwarrende Playwright-timeouts verderop in de suite.
 */
export function getE2eCredentials(): { email: string; password: string } {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "E2E_EMAIL en E2E_PASSWORD moeten beide ingesteld zijn in de omgeving " +
        "(zie playwright.config.ts) voordat de e2e-tests kunnen draaien.",
    );
  }

  return { email, password };
}

/**
 * Logt in via het loginformulier en wacht tot de prospectenlijst laadt.
 * Zonder argument worden de E2E_EMAIL/E2E_PASSWORD-omgevingsvariabelen
 * gebruikt; geef `credentials` mee om als een andere (bv. tijdelijke)
 * gebruiker in te loggen.
 */
export async function login(
  page: Page,
  credentials?: { email: string; password: string },
): Promise<void> {
  const { email, password } = credentials ?? getE2eCredentials();

  await page.goto("/login");
  await page.getByLabel("E-mailadres").fill(email);
  await page.getByLabel("Wachtwoord").fill(password);
  await page.getByRole("button", { name: "Inloggen" }).click();

  await page.waitForURL("/");
  await page
    .getByRole("heading", { name: "Prospecten", level: 1 })
    .waitFor();
}

/**
 * Leest de naam van de ingelogde gebruiker uit de headerbalk
 * (`src/components/layout/app-header.tsx`). Die naam staat in een <span>
 * zonder eigen rol/label, dus we vinden 'm structureel: de span die
 * onmiddellijk voorafgaat aan het "Uitloggen"-formulier, i.p.v. via een
 * klasse-selector (die ook de "CRM"-tekst in het merklogo zou raken).
 * De Uitloggen-knop is icon-only (aria-label i.p.v. zichtbare tekst) —
 * daarom een attribute-selector i.p.v. `:text()`.
 */
export async function getLoggedInUserName(page: Page): Promise<string> {
  const name = await page
    .locator('header form:has(button[aria-label="Uitloggen"])')
    .locator("xpath=preceding-sibling::span[1]")
    .innerText();
  return name.trim();
}
