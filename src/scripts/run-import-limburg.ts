import "dotenv/config";
import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { parseLimburgHtml } from "@/lib/import-limburg";

const DEFAULT_HTML_PATH =
  "/Users/olivierjammaers/Downloads/EquiManage_belllijst_Limburg.html";

/**
 * Idempotente Limburg-import: leest de bell-lijst HTML-export, parseert 'm
 * met `parseLimburgHtml` naar AccountSeed-rijen en upsert die in `accounts`
 * op de unieke index (name, gemeente) — zie `accounts_name_gemeente_uq` in
 * src/db/schema.ts.
 *
 * Overschrijft bij een conflict alléén de bronvelden. De CRM-trackingvelden
 * (callStatus, nextActionDate, isDone, assignedTo, type,
 * equimanegeManegeId) worden nooit aangeraakt bij een update, zodat een
 * herimport nooit sales-voortgang wist.
 *
 * Gebruik: npm run import:limburg [pad-naar-html]
 * (Zonder argument wordt de standaard Downloads-locatie gebruikt.)
 */
async function main() {
  const htmlPath = process.argv[2] ?? DEFAULT_HTML_PATH;
  const html = readFileSync(htmlPath, "utf8");
  const seeds = parseLimburgHtml(html);

  let inserted = 0;
  let updated = 0;

  for (const seed of seeds) {
    // `xmax = 0` is een bekende Postgres-truc om na een INSERT ... ON
    // CONFLICT te onderscheiden of de rij nieuw ingevoegd (xmax = 0) dan wel
    // bijgewerkt (xmax != 0) werd.
    const [row] = await db
      .insert(accounts)
      .values(seed)
      .onConflictDoUpdate({
        target: [accounts.name, accounts.gemeente],
        set: {
          category: seed.category,
          deelgemeente: seed.deelgemeente,
          postcode: seed.postcode,
          address: seed.address,
          phone: seed.phone,
          email: seed.email,
          website: seed.website,
          facebook: seed.facebook,
          instagram: seed.instagram,
          contactPerson: seed.contactPerson,
          sizeInfo: seed.sizeInfo,
          pricingInfo: seed.pricingInfo,
          offer: seed.offer,
          infrastructure: seed.infrastructure,
          disciplines: seed.disciplines,
          givesLessons: seed.givesLessons,
          softwareStatus: seed.softwareStatus,
          softwareDetail: seed.softwareDetail,
          websiteTech: seed.websiteTech,
          salesAngle: seed.salesAngle,
          vatNumber: seed.vatNumber,
          sourceStatus: seed.sourceStatus,
          contactScore: seed.contactScore,
          sourceType: seed.sourceType,
          sourceNotes: seed.sourceNotes,
          source: seed.source,
          onYourList: seed.onYourList,
          opener: seed.opener,
          priority: seed.priority,
          score: seed.score,
          region: seed.region,
          country: seed.country,
          updatedAt: new Date(),
        },
      })
      .returning({ inserted: sql<boolean>`(xmax = 0)` });

    if (row?.inserted) {
      inserted++;
    } else {
      updated++;
    }
  }

  console.log(`Ingevoegd: ${inserted}, bijgewerkt: ${updated}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
