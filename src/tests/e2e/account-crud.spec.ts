import { test, expect } from "@playwright/test";
import { login } from "./helpers";

const UUID_PATH = /\/accounts\/[0-9a-f-]{36}$/;
const ACCOUNT_NAME = "E2E CRUD-test";
const SEARCH_PLACEHOLDER = "Zoeken op naam, gemeente, telefoon…";

test.describe("Account aanmaken, bewerken en verwijderen", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("volledige cyclus: aanmaken → bewerken → verwijderen (self-cleaning)", async ({
    page,
  }) => {
    // --- Aanmaken ---------------------------------------------------------
    await page.getByRole("button", { name: "Nieuw account" }).click();
    await page.getByLabel("Naam *").fill(ACCOUNT_NAME);
    await page.getByRole("button", { name: "Aanmaken" }).click();

    await page.waitForURL(UUID_PATH);
    await expect(
      page.getByRole("heading", { name: ACCOUNT_NAME, level: 1 }),
    ).toBeVisible();
    await expect(page.getByText("Account aangemaakt").last()).toBeVisible();

    // --- Bewerken -----------------------------------------------------
    await page.getByRole("button", { name: "Bewerken" }).click();
    const gemeenteInput = page.getByLabel("Gemeente");
    await gemeenteInput.fill("Testgemeente-bewerkt");
    await page.getByRole("button", { name: "Opslaan" }).click();

    await expect(page.getByText("Account bijgewerkt").last()).toBeVisible();
    await expect(page.getByText("Testgemeente-bewerkt").first()).toBeVisible();

    // --- Verwijderen (admin) -------------------------------------------
    await page.getByRole("button", { name: "Verwijderen", exact: true }).click();
    const confirmDialog = page.getByRole("dialog").filter({
      hasText: "Account verwijderen?",
    });
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog).toContainText(
      "Dit verwijdert ook alle belverslagen en opmerkingen",
    );
    await confirmDialog
      .getByRole("button", { name: "Verwijderen", exact: true })
      .click();

    await page.waitForURL("/");
    await expect(page.getByText("Account verwijderd").last()).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Prospecten", level: 1 }),
    ).toBeVisible();

    // Bevestig dat het account echt weg is: zoeken op de naam levert niets op.
    await page.getByPlaceholder(SEARCH_PLACEHOLDER).fill(ACCOUNT_NAME);
    await expect(page.getByText("Geen accounts gevonden.")).toBeVisible();
  });
});
