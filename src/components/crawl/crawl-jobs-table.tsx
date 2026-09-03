import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CrawlJobStatusBadge } from "@/components/crawl/crawl-status-badge";
import { DISCOVERY_AREA } from "@/lib/crawl-constants";
import type { CrawlJob } from "@/db/schema";

function formatApproxEur(costUsd: number): string {
  return `± € ${costUsd.toFixed(2).replace(".", ",")}`;
}

function areaLabel(area: string): string {
  return area === DISCOVERY_AREA ? "Deelgebieden bepalen" : area;
}

export function CrawlJobsTable({ jobs }: { jobs: CrawlJob[] }) {
  if (jobs.length === 0) {
    return <p className="text-sm text-muted-foreground">Nog geen jobs.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Deelgebied</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Kandidaten</TableHead>
            <TableHead>Kosten</TableHead>
            <TableHead>Fout</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((job) => (
            <TableRow key={job.id}>
              <TableCell className="font-medium">{areaLabel(job.area)}</TableCell>
              <TableCell>
                <CrawlJobStatusBadge status={job.status} />
              </TableCell>
              <TableCell className="font-mono text-xs">{job.candidatesFound}</TableCell>
              <TableCell className="font-mono text-xs">
                {formatApproxEur(job.costUsd)}
              </TableCell>
              <TableCell className="max-w-xs truncate text-xs text-destructive">
                {job.error ?? ""}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
