import { test, expect } from "@playwright/test";
import { getE2eCredentials, login } from "./helpers";

test.describe("Inloggen", () => {
  test.beforeAll(() => {
    // Faalt snel met een duidelijke NL-foutmelding als E2E_EMAIL/E2E_PASSWORD
    // ontbreken, i.p.v. pas te falen op een vage timeout in de eerste test.
    getE2eCredentials();
  });

  test("verkeerd wachtwoord toont een foutmelding en blijft op /login", async ({
    page,
  }) => {
    const { email } = getE2eCredentials();

    await page.goto("/login");
    await page.getByLabel("E-mailadres").fill(email);
    await page.getByLabel("Wachtwoord").fill("dit-is-zeker-fout-123");
    await page.getByRole("button", { name: "Inloggen" }).click();

    // Next injecteert een eigen role="alert" (route-announcer), dus filter op tekst.
    await expect(
      page.getByRole("alert").filter({ hasText: "Ongeldig" }),
    ).toHaveText("Ongeldig e-mailadres of wachtwoord.");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("correcte gegevens loggen in en tonen de prospectenlijst", async ({
    page,
  }) => {
    await login(page);

    await expect(page).toHaveURL("/");
    await expect(
      page.getByRole("heading", { name: "Prospecten", level: 1 }),
    ).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
  });

  test("e-mailadres is niet hoofdlettergevoelig bij het inloggen", async ({
    page,
  }) => {
    const email = process.env.E2E_EMAIL;
    const password = process.env.E2E_PASSWORD;
    if (!email || !password) {
      throw new Error("E2E_EMAIL en E2E_PASSWORD moeten ingesteld zijn.");
    }

    await page.goto("/login");
    await page.getByLabel("E-mailadres").fill(email.toUpperCase());
    await page.getByLabel("Wachtwoord").fill(password);
    await page.getByRole("button", { name: "Inloggen" }).click();

    await expect(page).toHaveURL("/");
    await expect(
      page.getByRole("heading", { name: "Prospecten", level: 1 }),
    ).toBeVisible();
  });
});
