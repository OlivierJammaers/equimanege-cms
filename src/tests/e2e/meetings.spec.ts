import "dotenv/config";
import { test, expect } from "@playwright/test";
import { and, eq } from "drizzle-orm";
import { login } from "./helpers";
import { db } from "../../db";
import { accounts, activities, meetingSlots } from "../../db/schema";
import { formatSlotTimeNl } from "../../lib/meeting-utils";

/**
 * Meeting-agenda-flow: sales/admin boekt een meeting op het accountdetail
 * vanuit een fixture-slot, ziet het bevestigd, annuleert het weer.
 * Zelfreinigend — de fixture (één vrij slot) wordt rechtstreeks via Drizzle
 * geïnsert (er is geen UI om enkel een los slot te maken zonder de
 * admin-agenda te openen) en in `afterAll` weer volledig opgeruimd, samen
 * met de meeting-activiteiten die de test op Alfa Stables aanmaakt.
 *
 * "Alfa Stables" is een bestaand, al vrijgegeven prospect in de dev-DB (de
 * test-admin ziet elk account sowieso, vrijgegeven of niet).
 */

const ACCOUNT_NAME = "Alfa Stables";
const NOTE = "E2E-meeting";
const SEARCH_PLACEHOLDER = "Zoeken op naam, gemeente, telefoon…";
const UUID_PATH = /\/accounts\/[0-9a-f-]{36}$/;

let slotId: string;
let slotStartsAt: Date;
let accountId: string;

async function cleanup() {
  if (slotId) {
    // Cascadeert naar een eventuele meeting op dit slot.
    await db.delete(meetingSlots).where(eq(meetingSlots.id, slotId));
  }
  if (accountId) {
    // Alleen meeting-activiteiten opruimen (niet alle activiteiten van
    // Alfa Stables) zodat bestaande, niet-testgerelateerde geschiedenis
    // nooit geraakt wordt.
    await db
      .delete(activities)
      .where(and(eq(activities.accountId, accountId), eq(activities.type, "meeting")));
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
    await db
      .delete(activities)
      .where(and(eq(activities.accountId, accountId), eq(activities.type, "meeting")));

    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(10, 0, 0, 0);
    slotStartsAt = tomorrow;

    const [slot] = await db
      .insert(meetingSlots)
      .values({ startsAt: slotStartsAt, durationMinutes: 60 })
      .returning({ id: meetingSlots.id });
    slotId = slot.id;
  });

  test.afterAll(async () => {
    await cleanup();

    // Verifieer dat alles echt weg is.
    const [remainingSlot] = await db
      .select({ id: meetingSlots.id })
      .from(meetingSlots)
      .where(eq(meetingSlots.id, slotId))
      .limit(1);
    expect(remainingSlot).toBeUndefined();
  });

  test("plant een meeting in vanuit het accountdetail en annuleert ze weer", async ({
    page,
  }) => {
    await login(page);

    await page.goto("/");
    await page.getByPlaceholder(SEARCH_PLACEHOLDER).fill(ACCOUNT_NAME);
    await page.locator("table tbody tr").first().locator("td").nth(1).click();
    await page.waitForURL(UUID_PATH);
    await expect(
      page.getByRole("heading", { name: ACCOUNT_NAME, level: 1 }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Meeting inplannen" }).click();

    const dialog = page.getByRole("dialog").filter({ hasText: "Meeting inplannen" });
    await expect(dialog).toBeVisible();

    const slotLabel = formatSlotTimeNl(slotStartsAt, 60);
    await dialog.getByRole("button", { name: slotLabel, exact: true }).click();
    await dialog.getByPlaceholder("Notitie (optioneel)").fill(NOTE);
    await dialog.getByRole("button", { name: "Inplannen", exact: true }).click();

    await expect(page.getByText("Meeting ingepland").last()).toBeVisible();
    await expect(page.getByText(`Meeting: `, { exact: false })).toBeVisible();
    await expect(page.getByText(slotLabel, { exact: false }).first()).toBeVisible();

    // --- Annuleren -----------------------------------------------------
    await page.getByRole("button", { name: "Annuleren", exact: true }).click();
    const confirmDialog = page.getByRole("dialog").filter({
      hasText: "Meeting annuleren?",
    });
    await expect(confirmDialog).toBeVisible();
    await confirmDialog
      .getByRole("button", { name: "Annuleren", exact: true })
      .click();

    await expect(page.getByText("Meeting geannuleerd").last()).toBeVisible();
    await expect(page.getByText(`Meeting: `, { exact: false })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Meeting inplannen" }),
    ).toBeVisible();
  });
});
