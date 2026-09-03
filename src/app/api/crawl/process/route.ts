import { NextResponse } from "next/server";
import { env } from "@/env";
import { auth } from "@/lib/auth";
import { processNextJob } from "@/server/crawl/process";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Verwerkt precies één crawl-job (fase 3). Twee geldige aanroepers:
 * - een ingelogde admin (de client-driver op de run-pagina, die deze route
 *   in een lus aanroept zolang er werk is — heeft een sessiecookie, dus de
 *   proxy laat de request al door);
 * - de nachtelijke Vercel-cron (`Authorization: Bearer CRON_SECRET`, geen
 *   sessiecookie — vandaar de expliciete bearer-check hieronder, net als
 *   `src/app/api/cron/kpi-sync/route.ts`).
 */
async function isAuthorized(request: Request): Promise<boolean> {
  const authHeader = request.headers.get("authorization");
  if (env.CRON_SECRET && authHeader === `Bearer ${env.CRON_SECRET}`) {
    return true;
  }

  const session = await auth();
  return session?.user?.role === "admin";
}

async function handle(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Niet geautoriseerd." }, { status: 401 });
  }

  try {
    const result = await processNextJob();
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Onbekende fout bij het verwerken van de crawl-job.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Primair pad voor de client-driver op de run-pagina (admin-sessie).
export async function POST(request: Request) {
  return handle(request);
}

// Vercel-cron stuurt altijd een GET-request (zie vercel.json) — vandaar
// dezelfde afhandeling ook op GET, zodat de nachtelijke sweep werkt.
export async function GET(request: Request) {
  return handle(request);
}
