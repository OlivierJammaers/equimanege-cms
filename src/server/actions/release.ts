"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { assertAdmin, requireUser } from "@/lib/auth-guards";
import { bestFirstOrderBy } from "@/lib/release-order";

const BATCH_SIZE = 25;

/**
 * Geeft de eerstvolgende batch van 25 nog-niet-vrijgegeven prospecten vrij
 * voor sales, in "best eerst"-volgorde (zie `src/lib/release-order.ts`).
 * Admin-only. Idempotent-veilig: bij minder dan 25 resterende prospecten
 * wordt gewoon de volledige rest vrijgegeven.
 */
export async function releaseNextBatch(): Promise<{
  released: number;
  remaining: number;
}> {
  const user = await requireUser();
  assertAdmin(user);

  const candidates = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.type, "prospect"), isNull(accounts.releasedAt)))
    .orderBy(...bestFirstOrderBy(accounts))
    .limit(BATCH_SIZE);

  if (candidates.length === 0) {
    return { released: 0, remaining: 0 };
  }

  const ids = candidates.map((c) => c.id);
  const now = new Date();

  await db
    .update(accounts)
    .set({ releasedAt: now })
    .where(inArray(accounts.id, ids));

  const [{ count: remaining }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(accounts)
    .where(and(eq(accounts.type, "prospect"), isNull(accounts.releasedAt)));

  revalidatePath("/");

  return { released: ids.length, remaining };
}

/**
 * Trekt de laatst vrijgegeven batch weer in (max. 25 rijen — batches delen
 * één `releasedAt`-timestamp per vrijgave-call, dus "laatste batch" = alle
 * rijen met exact de hoogste `released_at`-waarde). Admin-only.
 */
export async function revokeLastBatch(): Promise<{ revoked: number }> {
  const user = await requireUser();
  assertAdmin(user);

  const [{ maxReleasedAt }] = await db
    .select({ maxReleasedAt: sql<Date | null>`max(${accounts.releasedAt})` })
    .from(accounts)
    .where(and(eq(accounts.type, "prospect"), isNotNull(accounts.releasedAt)));

  if (!maxReleasedAt) {
    return { revoked: 0 };
  }

  const revokedRows = await db
    .update(accounts)
    .set({ releasedAt: null })
    .where(
      and(
        eq(accounts.type, "prospect"),
        eq(accounts.releasedAt, maxReleasedAt),
      ),
    )
    .returning({ id: accounts.id });

  revalidatePath("/");

  return { revoked: revokedRows.length };
}
