import "dotenv/config";
import { test, expect } from "@playwright/test";
import { and, eq } from "drizzle-orm";
import { login } from "./helpers";
import { db } from "../../db";
import { accounts, activities, availabilityWindows, meetings } from "../../db/schema";
import { formatTimeRangeNl } from "../../lib/meeting-utils";

/**
 * Meeting-flow (herbouw 2026-09): de admin publiceert enkel een
 * "van–tot"-beschikbaarheidsvenster; de sales-persoon kiest bij het boeken
 * zelf een duur + starttijd binnen dat venster. Deze test dekt: inplannen
 * vanaf het accountdetail, zichtbaarheid in "Meeting:"-blok + /meetings
 * (Komend), en annuleren.
 *
 * Zelfreinigend — de fixture (één beschikbaarheidsvenster) wordt
 * rechtstreeks via Drizzle geïnsert (er is geen UI om enkel een los venster
 * te maken zonder de admin-agenda te openen) en in `afterAll` weer volledig
 * opgeruimd, samen met de meetings + meeting-activiteiten die de test op
 * Alfa Stables aanmaakt.
 *
 * "Alfa Stables" is een bestaand, al vrijgegeven prospect in de dev-DB (de
 * test-admin ziet elk account sowieso, vrijgegeven of niet).
 */

const ACCOUNT_NAME = "Alfa Stables";
const NOTE = "E2E-meeting";
const SEARCH_PLACEHOLDER = "Zoeken op naam, gemeente, telefoon…";
const UUID_PATH = /\/accounts\/[0-9a-f-]{36}$/;

let windowId: string;
let windowStartsAt: Date;
let windowEndsAt: Date;
let accountId: string;

async function cleanup() {
  if (accountId) {
    // Alle meetings op dit account opruimen (er is geen FK naar het
    // venster, dus dit is de enige manier om ze zeker kwijt te raken) en
    // alleen meeting-activiteiten opruimen (niet alle activiteiten van Alfa
    // Stables) zodat bestaande, niet-testgerelateerde geschiedenis nooit
    // geraakt wordt.
    await db.delete(meetings).where(eq(meetings.accountId, accountId));
    await db
      .delete(activities)
      .where(and(eq(activities.accountId, accountId), eq(activities.type, "meeting")));
  }
  if (windowId) {
    await db.delete(availabilityWindows).where(eq(availabilityWindows.id, windowId));
  }
}

test.describe("Meeting inplannen en annuleren (self-cleaning)", () => {
  test.beforeAll(async () => {
    const [account] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.name, ACCOUNT_NAME))
      .limit(1);
    if (!account) {
      throw new Error(
        `Account "${ACCOUNT_NAME}" niet gevonden in de dev-DB — kan de meeting-flow niet testen.`,
      );
    }
    accountId = account.id;

    // Ruim een eventuele leftover van deze test op vóór de nieuwe fixture.
    await db.delete(meetings).where(eq(meetings.accountId, accountId));
    await db
      .delete(activities)
      .where(and(eq(activities.accountId, accountId), eq(activities.type, "meeting")));

    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(9, 0, 0, 0);
    windowStartsAt = tomorrow;
    windowEndsAt = new Date(windowStartsAt.getTime() + 3 * 60 * 60 * 1000); // 09:00–12:00 UTC

    const [window] = await db
      .insert(availabilityWindows)
      .values({ startsAt: windowStartsAt, endsAt: windowEndsAt })
      .returning({ id: availabilityWindows.id });
    windowId = window.id;
  });

  test.afterAll(async () => {
    await cleanup();

    // Verifieer dat alles echt weg is.
    const [remainingWindow] = await db
      .select({ id: availabilityWindows.id })
      .from(availabilityWindows)
      .where(eq(availabilityWindows.id, windowId))
      .limit(1);
    expect(remainingWindow).toBeUndefined();

    const remainingMeetings = await db
      .select({ id: meetings.id })
      .from(meetings)
      .where(eq(meetings.accountId, accountId));
    expect(remainingMeetings).toHaveLength(0);
  });

  test("plant een meeting in vanuit het accountdetail en annuleert ze weer", async ({ page }) => {
    await login(page);

    await page.goto("/");
    await page.getByPlaceholder(SEARCH_PLACEHOLDER).fill(ACCOUNT_NAME);
    await page.locator("table tbody tr").first().locator("td").nth(1).click();
    await page.waitForURL(UUID_PATH);
    await expect(page.getByRole("heading", { name: ACCOUNT_NAME, level: 1 })).toBeVisible();

    await page.getByRole("button", { name: "Meeting inplannen" }).click();

    const dialog = page.getByRole("dialog").filter({ hasText: "Meeting inplannen" });
    await expect(dialog).toBeVisible();

    const windowLabel = formatTimeRangeNl(windowStartsAt, windowEndsAt);
    await dialog.getByRole("button", { name: windowLabel, exact: true }).click();

    // Duur staat standaard al op 60 min — niet aanpassen. Kies de eerste
    // beschikbare starttijd (het venster is volledig vrij, dus dat is het
    // begin van het venster zelf).
    await dialog.getByRole("combobox", { name: "Starttijd" }).click();
    await page.getByRole("option").first().click();

    await dialog.getByPlaceholder("Notitie (optioneel)").fill(NOTE);
    await dialog.getByRole("button", { name: "Inplannen", exact: true }).click();

    await expect(page.getByText("Meeting ingepland").last()).toBeVisible();
    await expect(page.getByText(`Meeting: `, { exact: false })).toBeVisible();

    // --- /meetings-overzicht --------------------------------------------
    await page.goto("/meetings");
    await expect(page.getByRole("heading", { name: "Meetings", level: 1 })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Komend" })).toHaveAttribute(
      "data-state",
      "active",
    );
    await expect(page.getByRole("link", { name: ACCOUNT_NAME })).toBeVisible();
    await expect(page.getByText(NOTE)).toBeVisible();

    // --- Annuleren (terug op het accountdetail) -------------------------
    await page.goto(`/accounts/${accountId}`);
    await expect(page.getByText(`Meeting: `, { exact: false })).toBeVisible();

    await page.getByRole("button", { name: "Annuleren", exact: true }).click();
    const confirmDialog = page.getByRole("dialog").filter({ hasText: "Meeting annuleren?" });
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole("button", { name: "Annuleren", exact: true }).click();

    await expect(page.getByText("Meeting geannuleerd").last()).toBeVisible();
    await expect(page.getByText(`Meeting: `, { exact: false })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Meeting inplannen" })).toBeVisible();
  });
});
