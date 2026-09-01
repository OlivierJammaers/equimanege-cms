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

    await expect(page.getByRole("alert")).toHaveText(
      "Ongeldig e-mailadres of wachtwoord.",
    );
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
});
