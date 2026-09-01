"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { HealthLevel } from "@/lib/health-score";
import { cn } from "@/lib/utils";

const HEALTH_LABELS: Record<HealthLevel, string> = {
  groen: "Gezond",
  oranje: "Aandacht nodig",
  rood: "Actie vereist",
};

/**
 * Zelfde getemperde stijl als PriorityBadge (`priority-badge.tsx`):
 * ontverzadigde status-kleuren, geen felle vlakken.
 */
const HEALTH_BADGE_CLASSES: Record<HealthLevel, string> = {
  groen:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400",
  oranje:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400",
  rood: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400",
};

/**
 * Gezondheidsscore-badge met tooltip die de onderliggende redenen toont
 * (bv. "Meer dan 14 dagen niet actief"), zodat de kleurcode nooit de enige
 * drager van betekenis is.
 */
export function HealthBadge({
  level,
  reasons,
  className,
}: {
  level: HealthLevel;
  reasons: string[];
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={cn(
            "cursor-default text-[11px]",
            HEALTH_BADGE_CLASSES[level],
            className,
          )}
        >
          {HEALTH_LABELS[level]}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <ul className="flex flex-col gap-0.5">
          {reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}
