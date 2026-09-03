import "dotenv/config";
import { test, expect } from "@playwright/test";
import { eq } from "drizzle-orm";
import { login } from "./helpers";
import { db } from "../../db";
import { accounts, crawlCandidates, crawlJobs, crawlRuns } from "../../db/schema";

/**
 * Review-flow (fase 3, `/review`): een kandidaat goedkeuren maakt er een
 * account van en de kaart verdwijnt. Zelfreinigend — de fixture (run + job +
 * kandidaat) wordt rechtstreeks via Drizzle geïnsert (er is geen UI om een
 * crawl-run te vullen zonder echte Anthropic-calls) en in `afterAll` weer
 * volledig opgeruimd, samen met het account dat de test aanmaakt.
 *
 * Volgorde bij opruimen is belangrijk: `crawl_candidates.account_id`
 * verwijst (zonder cascade) naar `accounts`, dus eerst de run verwijderen
 * (cascadeert naar jobs + kandidaten) en pas dàn het account.
 */

const CANDIDATE_NAME = "E2E Crawl-kandidaat";
const CANDIDATE_GEMEENTE = "E2E-Stad";
const SEARCH_PLACEHOLDER = "Zoeken op naam, gemeente, telefoon…";
const UUID_PATH = /\/accounts\/[0-9a-f-]{36}$/;

let runId: string;

async function cleanup() {
  if (runId) {
    await db.delete(crawlRuns).where(eq(crawlRuns.id, runId));
  }
  await db.delete(accounts).where(eq(accounts.name, CANDIDATE_NAME));
}

test.describe("Review-wachtrij: kandidaat goedkeuren (self-cleaning)", () => {
  test.beforeAll(async () => {
    // Opruimen van een eventuele leftover uit een eerdere afgebroken run,
    // vóórdat de nieuwe fixture wordt aangemaakt (voorkomt een conflict op
    // de (naam, gemeente)-unieke index).
    await db.delete(accounts).where(eq(accounts.name, CANDIDATE_NAME));

    const [run] = await db
      .insert(crawlRuns)
      .values({
        country: "BE",
        region: "E2E-test",
        status: "done",
        totalJobs: 1,
        doneJobs: 1,
        candidatesFound: 1,
      })
      .returning({ id: crawlRuns.id });
    runId = run.id;

    const [job] = await db
      .insert(crawlJobs)
      .values({
        runId,
        area: "E2E-gebied",
        status: "done",
        candidatesFound: 1,
      })
      .returning({ id: crawlJobs.id });

    await db.insert(crawlCandidates).values({
      runId,
      jobId: job.id,
      name: CANDIDATE_NAME,
      gemeente: CANDIDATE_GEMEENTE,
      status: "pending",
      payload: {
        name: CANDIDATE_NAME,
        gemeente: CANDIDATE_GEMEENTE,
        category: "Manege",
        phone: "011 00 00 00",
        email: "info@e2e-test.be",
        website: "e2e-test.be",
        opener: "Hoi, dit is een E2E-testopener.",
        priority: "B",
        score: 42,
        source: "E2E-test",
      },
    });
  });

  test.afterAll(async () => {
    await cleanup();
  });

  test("goedkeuren maakt een account aan en de kaart verdwijnt uit de wachtrij", async ({
    page,
  }) => {
    await login(page);

    await page.goto(`/review?run=${runId}`);
    await expect(page.getByRole("heading", { name: "Review" })).toBeVisible();
    await expect(page.getByText(CANDIDATE_NAME, { exact: true })).toBeVisible();
    await expect(page.getByText(CANDIDATE_GEMEENTE, { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Goedkeuren", exact: true }).click();

    await expect(
      page.getByText("Goedgekeurd — account aangemaakt").last(),
    ).toBeVisible();
    await expect(page.getByText(CANDIDATE_NAME, { exact: true })).toHaveCount(0);

    // Verifieer dat het account echt bestaat in de prospectenlijst.
    await page.goto("/");
    await page.getByPlaceholder(SEARCH_PLACEHOLDER).fill(CANDIDATE_NAME);
    await page.locator("table tbody tr").first().locator("td").nth(1).click();
    await page.waitForURL(UUID_PATH);
    await expect(
      page.getByRole("heading", { name: CANDIDATE_NAME, level: 1 }),
    ).toBeVisible();
    await expect(page.getByText(CANDIDATE_GEMEENTE).first()).toBeVisible();
  });
});
