import { defineConfig, devices } from "@playwright/test";

/**
 * E2E-config (Task 11). Draait NIET in CI: er is geen Neon-testdatabase
 * beschikbaar (het project gebruikt @neondatabase/serverless, dat alleen
 * tegen Neon's HTTP-proxy werkt — een lokale Postgres via een GH Actions
 * service-container volstaat niet). Zie .github/workflows/tests.yml voor de
 * onderbouwing van die keuze.
 *
 * Om deze suite lokaal te draaien (`npm run test:e2e`) moet vooraf:
 *  1. `.env` ingevuld zijn met een echte DATABASE_URL/DATABASE_URL_UNPOOLED
 *     (dev-Neon) en AUTH_SECRET.
 *  2. De migraties gedraaid zijn (`npm run db:migrate`).
 *  3. Een admin geseed zijn via `npm run seed:admin`
 *     (ADMIN_EMAIL/ADMIN_PASSWORD in de env).
 *  4. De Limburg-import gedraaid zijn (`npm run import:limburg`), zodat er
 *     voldoende accounts bestaan om te filteren/openen.
 *  5. E2E_EMAIL en E2E_PASSWORD in de omgeving staan — de inloggegevens
 *     waarmee de specs inloggen (meestal dezelfde als ADMIN_EMAIL/PASSWORD).
 *
 * `webServer` bouwt en start de productie-build zelf; laat dus voldoende
 * tijd voor `next build` in het timeout-budget.
 */
export default defineConfig({
  testDir: "src/tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "html",
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
