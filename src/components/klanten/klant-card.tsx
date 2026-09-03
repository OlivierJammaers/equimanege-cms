import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HealthBadge } from "@/components/accounts/health-badge";
import { Sparkline } from "@/components/accounts/sparkline";
import type { HealthScore } from "@/lib/health-score";
import { formatCurrency, formatInt, formatRelativeNl } from "@/lib/format-nl";

export type KlantCardData = {
  id: string;
  name: string;
  gemeente: string | null;
  health: HealthScore | null;
  activeMembers: number | null;
  upcomingLessons: number | null;
  lastActiveAtIso: string | null;
  monthlyPrice: number | null;
  activeMembersSeries: number[];
  lastSyncAt: Date | null;
};

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="truncate text-sm font-medium tabular-nums text-foreground">
        {value}
      </span>
    </div>
  );
}

/**
 * Eén klant-rij op `/klanten`. Klanten zonder snapshots (nog geen sync
 * gedraaid) krijgen een gedempte variant i.p.v. lege/foute cijfers — zie
 * "Klanten zonder snapshots" in de feature-omschrijving.
 */
export function KlantCard({ klant, now }: { klant: KlantCardData; now: Date }) {
  const subtitle = klant.gemeente ?? "—";

  if (!klant.health) {
    return (
      <Link href={`/klanten/${klant.id}`} className="block">
        <Card className="border-dashed text-muted-foreground transition-colors hover:border-foreground/30">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium text-foreground">
                {klant.name}
              </span>
              <Badge variant="outline" className="shrink-0 text-[11px] text-muted-foreground">
                Nog geen gegevens
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {subtitle} · eerste synchronisatie is nog niet gedraaid.
            </p>
          </CardContent>
        </Card>
      </Link>
    );
  }

  return (
    <Link href={`/klanten/${klant.id}`} className="block">
      <Card className="transition-colors hover:border-foreground/30">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-sm font-medium text-foreground">
                {klant.name}
              </span>
              <span className="text-xs text-muted-foreground">{subtitle}</span>
            </div>
            <HealthBadge
              level={klant.health.level}
              reasons={klant.health.reasons}
              className="shrink-0"
            />
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Metric
              label="Actieve leden"
              value={klant.activeMembers !== null ? formatInt(klant.activeMembers) : "—"}
            />
            <Metric
              label="Geplande lessen"
              value={klant.upcomingLessons !== null ? formatInt(klant.upcomingLessons) : "—"}
            />
            <Metric
              label="Laatst actief"
              value={formatRelativeNl(klant.lastActiveAtIso, now)}
            />
            <Metric
              label="Maandprijs"
              value={klant.monthlyPrice !== null ? formatCurrency(klant.monthlyPrice) : "—"}
            />
          </div>

          <div className="flex items-center justify-between gap-3 border-t pt-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] text-muted-foreground">Actieve leden — trend</span>
              <Sparkline
                values={klant.activeMembersSeries}
                className="text-muted-foreground"
                ariaLabel={`Actieve leden trend voor ${klant.name}`}
              />
            </div>
            <span className="shrink-0 text-[11px] text-muted-foreground">
              Sync: {klant.lastSyncAt ? formatRelativeNl(klant.lastSyncAt.toISOString(), now) : "—"}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
