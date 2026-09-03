import { NextResponse } from "next/server";
import { env } from "@/env";
import { auth } from "@/lib/auth";
import { processNextJob, shouldStopDraining } from "@/server/crawl/process";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Verwerkt crawl-jobs (fase 3). Twee geldige aanroepers, met bewust
 * verschillende semantiek per methode (final-review fix 1):
 * - **POST** — de client-driver op de run-pagina
 *   (`src/components/crawl/crawl-run-driver.tsx`, ingelogde admin). Die
 *   roept deze route zelf al herhaaldelijk aan zolang er werk is en
 *   verwacht per call voortgang (voor de voortgangsregel/`router.refresh()`)
 *   — dus POST verwerkt precies één job, zoals voorheen.
 * - **GET** — de nachtelijke Vercel-cron (`Authorization: Bearer
 *   CRON_SECRET`, geen sessiecookie, altijd een GET-request — zie
 *   `vercel.json`). Er is geen client die de cron in een lus houdt, dus GET
 *   "drained" zelf: het roept `processNextJob()` herhaald aan tot er geen
 *   werk meer is, tot ~240s verstreken zijn (ruim onder de 300s
 *   `maxDuration`) of tot 50 jobs verwerkt zijn — zie
 *   `shouldStopDraining()` in `src/server/crawl/process.ts`.
 */
async function isAuthorized(request: Request): Promise<boolean> {
  const authHeader = request.headers.get("authorization");
  if (env.CRON_SECRET && authHeader === `Bearer ${env.CRON_SECRET}`) {
    return true;
  }

  const session = await auth();
  return session?.user?.role === "admin";
}

/** POST: verwerkt precies één job (drive-per-call-semantiek voor de admin-driver). */
export async function POST(request: Request) {
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

/**
 * GET: de nachtelijke Vercel-cron-sweep. Verwerkt jobs in een lus tot
 * `shouldStopDraining()` stopt, en retourneert een geaggregeerd resultaat
 * (`processed` = aantal in deze aanroep verwerkte jobs, `remaining` = de
 * stand na de laatste verwerkte job).
 */
export async function GET(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Niet geautoriseerd." }, { status: 401 });
  }

  const start = Date.now();
  let processed = 0;
  let remaining = 0;

  try {
    while (true) {
      const result = await processNextJob();
      if (!result.processed) {
        remaining = result.remaining;
        break;
      }

      processed += 1;
      remaining = result.remaining;

      if (
        shouldStopDraining({
          remaining,
          jobsProcessed: processed,
          elapsedMs: Date.now() - start,
        })
      ) {
        break;
      }
    }

    return NextResponse.json({ processed, remaining }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Onbekende fout bij het verwerken van de crawl-job.";
    // processed telt de jobs die vóór de fout al succesvol verwerkt zijn.
    return NextResponse.json({ error: message, processed, remaining }, { status: 500 });
  }
}
