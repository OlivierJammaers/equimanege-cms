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

/** Logt in via het loginformulier en wacht tot de prospectenlijst laadt. */
export async function login(page: Page): Promise<void> {
  const { email, password } = getE2eCredentials();

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
 */
export async function getLoggedInUserName(page: Page): Promise<string> {
  const name = await page
    .locator('header form:has(button:text("Uitloggen"))')
    .locator("xpath=preceding-sibling::span[1]")
    .innerText();
  return name.trim();
}
