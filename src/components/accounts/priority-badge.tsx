"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  PRIORITY_BADGE_CLASSES,
  PRIORITY_LABELS,
  type Priority,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * Prioriteit-badge met tooltip die de betekenis uitlegt
 * (bv. "A – bel deze week"), zodat sales de codes niet hoeft te kennen.
 */
export function PriorityBadge({
  priority,
  className,
}: {
  priority: Priority;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={cn(
            "cursor-default font-mono text-[11px] uppercase",
            PRIORITY_BADGE_CLASSES[priority],
            className,
          )}
        >
          {priority}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{PRIORITY_LABELS[priority]}</TooltipContent>
    </Tooltip>
  );
}
