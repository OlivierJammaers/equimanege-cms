import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PRIORITIES,
  PRIORITY_BADGE_CLASSES,
  PRIORITY_LABELS,
} from "@/lib/constants";
import type { ListStats } from "@/lib/stats";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function StatsTiles({ stats }: { stats: ListStats }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Totaal aantal accounts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-mono text-3xl font-semibold tabular-nums">
            {stats.total}
          </p>
        </CardContent>
      </Card>

      <Card className="sm:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Per prioriteit
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {PRIORITIES.map((priority) => (
            <Tooltip key={priority}>
              <TooltipTrigger asChild>
                <span
                  className={cn(
                    "inline-flex cursor-default items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-xs uppercase",
                    PRIORITY_BADGE_CLASSES[priority],
                  )}
                >
                  <span className="font-semibold">{priority}</span>
                  <span className="tabular-nums">
                    {stats.byPriority[priority]}
                  </span>
                </span>
              </TooltipTrigger>
              <TooltipContent>{PRIORITY_LABELS[priority]}</TooltipContent>
            </Tooltip>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Voortgang
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-2xl font-semibold tabular-nums">
              {stats.progressPct}%
            </span>
            <span className="text-xs text-muted-foreground">
              {stats.done}/{stats.total} afgehandeld
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-foreground transition-[width]"
              style={{ width: `${stats.progressPct}%` }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
