"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { accounts, activities } from "@/db/schema";
import { assertAdmin, requireUser } from "@/lib/auth-guards";
import { buildStatusChangeActivity } from "@/lib/activity-log";
import { CALL_STATUSES, type CallStatus } from "@/lib/constants";
import { accountFormSchema, type AccountFormInput } from "@/lib/account-schemas";

function revalidateAccountPaths(accountId: string) {
  revalidatePath("/");
  revalidatePath("/accounts/" + accountId);
}

const updateCallStatusSchema = z.object({
  accountId: z.string().uuid(),
  status: z.enum(CALL_STATUSES),
});

/**
 * Werkt de belstatus van een account bij en logt de wijziging als
 * `status_change`-activiteit (behalve bij een no-op naar dezelfde status).
 *
 * Let op: de neon-http driver ondersteunt geen `db.transaction` (die vereist
 * een sessiegebonden/WebSocket-verbinding). De update en de activiteit-insert
 * gebeuren daarom sequentieel i.p.v. atomair — acceptabel voor deze interne
 * CRM (geen concurrente schrijvers per account te verwachten).
 */
export async function updateCallStatus(accountId: string, status: CallStatus) {
  const user = await requireUser();

  const parsed = updateCallStatusSchema.parse({ accountId, status });

  const [current] = await db
    .select({ callStatus: accounts.callStatus })
    .from(accounts)
    .where(eq(accounts.id, parsed.accountId))
    .limit(1);

  if (!current || current.callStatus === parsed.status) {
    return;
  }

  await db
    .update(accounts)
    .set({ callStatus: parsed.status, updatedAt: new Date() })
    .where(eq(accounts.id, parsed.accountId));

  const activityRow = buildStatusChangeActivity(
    parsed.accountId,
    user.id,
    parsed.status,
    current.callStatus,
  );
  if (activityRow) {
    await db.insert(activities).values(activityRow);
  }

  revalidateAccountPaths(parsed.accountId);
}

const addCommentSchema = z.object({
  accountId: z.string().uuid(),
  body: z.string().trim().min(1, "Reactie mag niet leeg zijn.").max(5000),
});

/** Voegt een vrije-tekstreactie toe aan de activiteitenlog van een account. */
export async function addComment(accountId: string, body: string) {
  const user = await requireUser();

  const parsed = addCommentSchema.parse({ accountId, body });

  const [account] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.id, parsed.accountId))
    .limit(1);
  if (!account) throw new Error("Account niet gevonden");

  await db.insert(activities).values({
    accountId: parsed.accountId,
    userId: user.id,
    type: "comment",
    body: parsed.body,
  });

  revalidateAccountPaths(parsed.accountId);
}

const setNextActionSchema = z.object({
  accountId: z.string().uuid(),
  date: z.iso.date("Ongeldige datum.").nullable(),
});

/** Zet (of wist) de eerstvolgende actiedatum voor een account. */
export async function setNextAction(accountId: string, date: string | null) {
  await requireUser();

  const parsed = setNextActionSchema.parse({ accountId, date });

  await db
    .update(accounts)
    .set({ nextActionDate: parsed.date, updatedAt: new Date() })
    .where(eq(accounts.id, parsed.accountId));

  revalidateAccountPaths(parsed.accountId);
}

const toggleDoneSchema = z.object({
  accountId: z.string().uuid(),
  done: z.boolean(),
});

/** Markeert een account als (niet) afgehandeld. */
export async function toggleDone(accountId: string, done: boolean) {
  await requireUser();

  const parsed = toggleDoneSchema.parse({ accountId, done });

  await db
    .update(accounts)
    .set({ isDone: parsed.done, updatedAt: new Date() })
    .where(eq(accounts.id, parsed.accountId));

  revalidateAccountPaths(parsed.accountId);
}

const convertToCustomerSchema = z.object({
  accountId: z.string().uuid(),
});

/** Converteert een prospect naar klant en logt dit als systeemactiviteit. */
export async function convertToCustomer(accountId: string) {
  const user = await requireUser();

  const parsed = convertToCustomerSchema.parse({ accountId });

  const [account] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.id, parsed.accountId))
    .limit(1);
  if (!account) throw new Error("Account niet gevonden");

  await db
    .update(accounts)
    .set({ type: "customer", updatedAt: new Date() })
    .where(eq(accounts.id, parsed.accountId));

  await db.insert(activities).values({
    accountId: parsed.accountId,
    userId: user.id,
    type: "system",
    body: "Geconverteerd naar klant",
  });

  revalidateAccountPaths(parsed.accountId);
}

/**
 * Maakt handmatig een nieuw account aan (sales + admin). De accounts komen
 * normaal binnen via de Limburg-import; dit is de handmatige uitzondering
 * (bv. een prospect buiten die dataset).
 */
export async function createAccount(input: AccountFormInput) {
  const user = await requireUser();

  const parsed = accountFormSchema.parse(input);

  const [inserted] = await db
    .insert(accounts)
    .values({
      name: parsed.name,
      type: parsed.type,
      priority: parsed.priority,
      gemeente: parsed.gemeente,
      postcode: parsed.postcode,
      address: parsed.address,
      phone: parsed.phone,
      email: parsed.email,
      website: parsed.website,
      category: parsed.category,
      contactPerson: parsed.contactPerson,
      source: "Handmatig toegevoegd",
      country: "BE",
    })
    .returning({ id: accounts.id });

  await db.insert(activities).values({
    accountId: inserted.id,
    userId: user.id,
    type: "system",
    body: "Account handmatig aangemaakt",
  });

  revalidatePath("/");

  return { id: inserted.id };
}

const accountIdSchema = z.object({ accountId: z.string().uuid() });

/** Werkt de kernvelden van een account bij (sales + admin). */
export async function updateAccountDetails(
  accountId: string,
  input: AccountFormInput,
) {
  const user = await requireUser();

  const { accountId: parsedAccountId } = accountIdSchema.parse({ accountId });
  const parsed = accountFormSchema.parse(input);

  const [account] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.id, parsedAccountId))
    .limit(1);
  if (!account) throw new Error("Account niet gevonden");

  await db
    .update(accounts)
    .set({
      name: parsed.name,
      type: parsed.type,
      priority: parsed.priority,
      gemeente: parsed.gemeente,
      postcode: parsed.postcode,
      address: parsed.address,
      phone: parsed.phone,
      email: parsed.email,
      website: parsed.website,
      category: parsed.category,
      contactPerson: parsed.contactPerson,
      updatedAt: new Date(),
    })
    .where(eq(accounts.id, parsedAccountId));

  await db.insert(activities).values({
    accountId: parsedAccountId,
    userId: user.id,
    type: "system",
    body: "Gegevens bijgewerkt",
  });

  revalidateAccountPaths(parsedAccountId);
}

/**
 * Verwijdert een account (en cascade: activiteiten + KPI-snapshots).
 * Alleen door admins — destructieve actie, geen manier om ongedaan te maken.
 */
export async function deleteAccount(accountId: string) {
  const user = await requireUser();
  assertAdmin(user);

  const { accountId: parsedAccountId } = accountIdSchema.parse({ accountId });

  const [account] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.id, parsedAccountId))
    .limit(1);
  if (!account) throw new Error("Account niet gevonden");

  await db.delete(accounts).where(eq(accounts.id, parsedAccountId));

  revalidatePath("/");

  return { deleted: true };
}
