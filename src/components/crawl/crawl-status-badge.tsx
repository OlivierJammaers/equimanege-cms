import { Badge } from "@/components/ui/badge";
import {
  CRAWL_JOB_STATUS_BADGE_CLASSES,
  CRAWL_JOB_STATUS_LABELS,
  CRAWL_RUN_STATUS_BADGE_CLASSES,
  CRAWL_RUN_STATUS_LABELS,
  type CrawlJobStatus,
  type CrawlRunStatus,
} from "@/lib/crawl-constants";
import { cn } from "@/lib/utils";

export function CrawlRunStatusBadge({
  status,
  className,
}: {
  status: CrawlRunStatus;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(CRAWL_RUN_STATUS_BADGE_CLASSES[status], className)}
    >
      {CRAWL_RUN_STATUS_LABELS[status]}
    </Badge>
  );
}

export function CrawlJobStatusBadge({
  status,
  className,
}: {
  status: CrawlJobStatus;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(CRAWL_JOB_STATUS_BADGE_CLASSES[status], className)}
    >
      {CRAWL_JOB_STATUS_LABELS[status]}
    </Badge>
  );
}
