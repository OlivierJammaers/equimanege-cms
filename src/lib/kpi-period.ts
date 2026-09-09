import type { KpiTenantBlock, KpiWindow } from "@/lib/kpi-schema";

/**
 * De drie periodes van de KPI-periodetoggle (accountdetail + klant-grafieken).
 * Spiegelt de sleutels van het optionele `windows`-blok in de backend-payload
 * (backend PR #26, `equimanege-backend`).
 */
export type KpiPeriod = "24h" | "7d" | "30d";

export const PERIOD_LABELS: Record<KpiPeriod, string> = {
  "24h": "24 uur",
  "7d": "7 dagen",
  "30d": "30 dagen",
};

/** Aantal dagen dat een periode beslaat — voor sparkline-/grafiekbereiken. */
export function periodDays(period: KpiPeriod): number {
  switch (period) {
    case "24h":
      return 1;
    case "7d":
      return 7;
    case "30d":
      return 30;
  }
}

/**
 * Levert de window-metrics voor `period` uit `kpis`.
 *
 * - Als `kpis.windows` aanwezig is (backend PR #26 of later): geeft
 *   `windows[period]` rechtstreeks terug voor alle drie periodes.
 * - Als `windows` ontbreekt (oudere snapshot): voor `"30d"` wordt het venster
 *   gesynthetiseerd uit de bestaande legacy `*_30d`-velden (die per definitie
 *   gelijk zijn aan `windows.30d` wanneer dat wél aanwezig is). Voor `"24h"`
 *   en `"7d"` bestaat er geen legacy-equivalent, dus `null`.
 */
export function windowValues(
  kpis: KpiTenantBlock,
  period: KpiPeriod,
): KpiWindow | null {
  if (kpis.windows) {
    return kpis.windows[period];
  }

  if (period !== "30d") return null;

  return {
    completed_lessons: kpis.lessons.completed_30d,
    cancelled_lessons: kpis.lessons.cancelled_30d,
    avg_participants: kpis.lessons.avg_participants_30d,
    occupancy_rate: kpis.lessons.occupancy_rate_30d,
    new_members: kpis.members.new_30d,
    invoiced: kpis.commercial.invoiced_30d,
    invoices_paid: kpis.commercial.invoices_paid_30d,
    announcements: kpis.engagement.announcements_30d,
    chat_messages: kpis.engagement.chat_messages_30d,
    active_push_devices: kpis.engagement.active_push_devices_30d,
  };
}
