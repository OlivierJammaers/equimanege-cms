"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { requireUser } from "@/lib/auth-guards";
import { CALL_STATUSES, type CallStatus } from "@/lib/constants";

const updateCallStatusSchema = z.object({
  accountId: z.string().uuid(),
  status: z.enum(CALL_STATUSES),
});

/**
 * Werkt de belstatus van een account bij. Taak 7 breidt dit bestand uit met
 * activiteiten-logging en verdere acties — hou deze functie klein/losstaand.
 */
export async function updateCallStatus(accountId: string, status: CallStatus) {
  await requireUser();

  const parsed = updateCallStatusSchema.parse({ accountId, status });

  await db
    .update(accounts)
    .set({ callStatus: parsed.status, updatedAt: new Date() })
    .where(eq(accounts.id, parsed.accountId));

  revalidatePath("/");
}
