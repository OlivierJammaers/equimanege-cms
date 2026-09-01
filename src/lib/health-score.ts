import type { KpiTenantBlock } from "@/lib/kpi-schema";

export type HealthLevel = "groen" | "oranje" | "rood";

export type HealthScore = {
  level: HealthLevel;
  reasons: string[];
};

const LEVEL_RANK: Record<HealthLevel, number> = { groen: 0, oranje: 1, rood: 2 };
const MS_PER_DAY = 1000 * 60 * 60 * 24;

function worse(a: HealthLevel, b: HealthLevel): HealthLevel {
  return LEVEL_RANK[b] > LEVEL_RANK[a] ? b : a;
}

/**
 * Pure gezondheidsscore-berekening op basis van het huidige KPI-blok
 * (`latest`) en optioneel een eerder blok (`previous`, meestal ~30d terug)
 * om trends te herkennen. "Ergste regel wint" voor het niveau; alle
 * getriggerde redenen worden opgeteld (NL). Geen enkele regel getriggerd →
 * groen met "Actief en stabiel".
 */
export function computeHealthScore(
  latest: KpiTenantBlock,
  previous: KpiTenantBlock | null,
  now: Date,
): HealthScore {
  let level: HealthLevel = "groen";
  const reasons: string[] = [];

  // Regel 1: inactiviteit (null of ouder dan 30d → rood, ouder dan 14d → oranje)
  const lastActiveAt = latest.engagement.last_active_at;
  if (lastActiveAt === null) {
    level = worse(level, "rood");
    reasons.push("Meer dan 30 dagen niet actief");
  } else {
    const daysSinceActive =
      (now.getTime() - new Date(lastActiveAt).getTime()) / MS_PER_DAY;
    if (daysSinceActive > 30) {
      level = worse(level, "rood");
      reasons.push("Meer dan 30 dagen niet actief");
    } else if (daysSinceActive > 14) {
      level = worse(level, "oranje");
      reasons.push("Meer dan 14 dagen niet actief");
    }
  }

  // Regel 2: actieve leden gedaald t.o.v. het vorige blok
  if (previous && previous.members.active > 0) {
    const prevActive = previous.members.active;
    const curActive = latest.members.active;
    const dropPct = ((prevActive - curActive) / prevActive) * 100;

    if (dropPct > 20) {
      level = worse(level, "rood");
      reasons.push(
        `Actieve leden gedaald met ${Math.round(dropPct)}% (${prevActive} → ${curActive})`,
      );
    } else if (dropPct > 0) {
      level = worse(level, "oranje");
      reasons.push(
        `Actieve leden gedaald met ${Math.round(dropPct)}% (${prevActive} → ${curActive})`,
      );
    }
  }

  // Regel 3: geen geplande lessen bij een manege-eigenaar
  if (latest.lessons.upcoming === 0 && latest.tenant.role === "manege_owner") {
    level = worse(level, "oranje");
    reasons.push("Geen geplande lessen");
  }

  if (reasons.length === 0) {
    reasons.push("Actief en stabiel");
  }

  return { level, reasons };
}
