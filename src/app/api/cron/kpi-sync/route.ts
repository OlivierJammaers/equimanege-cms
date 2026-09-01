import { NextResponse } from "next/server";
import { env } from "@/env";
import { syncKpis } from "@/server/kpi-sync";

export const dynamic = "force-dynamic";

/**
 * Dagelijkse Vercel-cron (zie vercel.json, 05:00 UTC) die KPI-snapshots
 * ophaalt bij de EquiManage-backend. Vercel-cron stuurt automatisch
 * `Authorization: Bearer ${CRON_SECRET}` mee wanneer die env-var ingesteld
 * is; zonder correcte header wordt de aanroep fail-closed geweigerd.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");

  if (!env.CRON_SECRET || authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json(
      { error: "Niet geautoriseerd." },
      { status: 401 },
    );
  }

  try {
    const result = await syncKpis();
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout bij KPI-synchronisatie.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
