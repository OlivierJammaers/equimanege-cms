"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { cmsUsers } from "@/db/schema";
import { assertAdmin, requireUser } from "@/lib/auth-guards";
import {
  createSalesUserSchema,
  resetPasswordSchema,
  userIdSchema,
  type CreateSalesUserInput,
} from "@/lib/user-schemas";

const USERS_PATH = "/beheer/gebruikers";

/**
 * Herkent een Postgres unique-constraint-violatie (23505), ongeacht welke
 * driver de fout gooit — gebruikt om een vriendelijke NL-melding te tonen
 * i.p.v. de generieke DB-foutmelding.
 */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}

/** Maakt een nieuwe sales-gebruiker aan. Alleen door admins. */
export async function createSalesUser(input: CreateSalesUserInput) {
  const user = await requireUser();
  assertAdmin(user);

  const parsed = createSalesUserSchema.parse(input);

  const [existing] = await db
    .select({ id: cmsUsers.id })
    .from(cmsUsers)
    .where(eq(cmsUsers.email, parsed.email))
    .limit(1);
  if (existing) {
    throw new Error("E-mailadres bestaat al");
  }

  const passwordHash = await bcrypt.hash(parsed.password, 10);

  try {
    await db.insert(cmsUsers).values({
      name: parsed.name,
      email: parsed.email,
      passwordHash,
      role: "sales",
      isActive: true,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new Error("E-mailadres bestaat al");
    }
    throw error;
  }

  revalidatePath(USERS_PATH);
}

/** Deactiveert een gebruiker (kan niet meer inloggen). Alleen door admins. */
export async function deactivateUser(id: string) {
  const user = await requireUser();
  assertAdmin(user);

  const parsed = userIdSchema.parse({ id });

  await db.update(cmsUsers).set({ isActive: false }).where(eq(cmsUsers.id, parsed.id));

  revalidatePath(USERS_PATH);
}

/** Heractiveert een eerder gedeactiveerde gebruiker. Alleen door admins. */
export async function reactivateUser(id: string) {
  const user = await requireUser();
  assertAdmin(user);

  const parsed = userIdSchema.parse({ id });

  await db.update(cmsUsers).set({ isActive: true }).where(eq(cmsUsers.id, parsed.id));

  revalidatePath(USERS_PATH);
}

/** Zet een nieuw wachtwoord voor een gebruiker. Alleen door admins. */
export async function resetPassword(id: string, newPassword: string) {
  const user = await requireUser();
  assertAdmin(user);

  const parsed = resetPasswordSchema.parse({ id, newPassword });
  const passwordHash = await bcrypt.hash(parsed.newPassword, 10);

  await db.update(cmsUsers).set({ passwordHash }).where(eq(cmsUsers.id, parsed.id));

  revalidatePath(USERS_PATH);
}
