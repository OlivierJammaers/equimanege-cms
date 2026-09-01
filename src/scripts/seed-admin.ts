import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { cmsUsers } from "@/db/schema";

/**
 * Idempotent admin-seed: leest ADMIN_EMAIL/ADMIN_PASSWORD uit env, hasht het
 * wachtwoord en upsert de gebruiker (op e-mail) als admin. Wordt pas
 * uitgevoerd zodra er een DB-URL beschikbaar is (zie taak 10) — dit script
 * is hier alleen geschreven, niet gedraaid.
 *
 * Gebruik: npm run seed:admin
 */
async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "ADMIN_EMAIL en ADMIN_PASSWORD moeten beide ingesteld zijn in de omgeving.",
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const [existing] = await db
    .select({ id: cmsUsers.id })
    .from(cmsUsers)
    .where(eq(cmsUsers.email, email))
    .limit(1);

  await db
    .insert(cmsUsers)
    .values({
      email,
      passwordHash,
      name: "Admin",
      role: "admin",
      isActive: true,
    })
    .onConflictDoUpdate({
      target: cmsUsers.email,
      set: {
        passwordHash,
        role: "admin",
        isActive: true,
      },
    });

  console.log(
    existing
      ? `Admin-gebruiker ${email} bijgewerkt.`
      : `Admin-gebruiker ${email} aangemaakt.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
