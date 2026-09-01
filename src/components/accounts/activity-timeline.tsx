import { Badge } from "@/components/ui/badge";
import { CALL_STATUS_LABELS, type CallStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Activity } from "@/db/schema";

export type ActivityWithAuthor = {
  id: string;
  type: Activity["type"];
  body: string | null;
  callOutcome: CallStatus | null;
  createdAt: Date;
  authorName: string | null;
};

const ACTIVITY_TYPE_LABELS: Record<Activity["type"], string> = {
  comment: "Opmerking",
  call: "Belverslag",
  status_change: "Statuswijziging",
  email: "E-mail",
  system: "Systeem",
};

const ACTIVITY_TYPE_BADGE_CLASSES: Record<Activity["type"], string> = {
  comment:
    "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300",
  call: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-400",
  status_change:
    "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-400",
  email:
    "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-400",
  system:
    "border-zinc-200 bg-zinc-100 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-500",
};

// Vaste tijdzone i.p.v. de serverlocale, zodat de opmaak deterministisch
// blijft (dit is een server component: geen client-hydratie, maar wel
// mogelijk door meerdere servers/omgevingen gerenderd).
function formatDateTime(date: Date): string {
  return date.toLocaleString("nl-BE", {
    timeZone: "Europe/Brussels",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ActivityTimeline({
  activities,
}: {
  activities: ActivityWithAuthor[];
}) {
  if (activities.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nog geen activiteit voor dit account.
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-4">
      {activities.map((activity) => (
        <li
          key={activity.id}
          className="flex flex-col gap-1.5 border-l-2 border-border pl-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                "text-[11px]",
                ACTIVITY_TYPE_BADGE_CLASSES[activity.type],
              )}
            >
              {ACTIVITY_TYPE_LABELS[activity.type]}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatDateTime(activity.createdAt)}
            </span>
            <span className="text-xs text-muted-foreground">
              &middot; {activity.authorName ?? "Systeem"}
            </span>
          </div>

          {activity.body ? (
            <p className="text-sm whitespace-pre-wrap text-foreground">
              {activity.body}
            </p>
          ) : null}

          {activity.callOutcome ? (
            <p className="text-xs text-muted-foreground">
              Uitkomst: {CALL_STATUS_LABELS[activity.callOutcome]}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
