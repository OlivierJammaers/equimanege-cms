import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CrawlRunStatusBadge } from "@/components/crawl/crawl-status-badge";
import { COUNTRY_LABELS, type Country } from "@/lib/regions";
import type { CrawlRunStatus } from "@/lib/crawl-constants";

export type CrawlRunRow = {
  id: string;
  country: string;
  region: string;
  status: CrawlRunStatus;
  totalJobs: number;
  doneJobs: number;
  candidatesFound: number;
  costUsd: number;
  createdAt: Date;
  startedByName: string | null;
};

function formatApproxEur(costUsd: number): string {
  return `± € ${costUsd.toFixed(2).replace(".", ",")}`;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("nl-BE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function CrawlRunsTable({ rows }: { rows: CrawlRunRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nog geen onderzoeken gestart.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Regio</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Voortgang</TableHead>
            <TableHead>Kandidaten</TableHead>
            <TableHead>Kosten</TableHead>
            <TableHead>Gestart</TableHead>
            <TableHead>Door</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.id}
              className="cursor-pointer hover:bg-accent/50"
            >
              <TableCell className="p-0">
                <Link
                  href={`/beheer/crawl/${row.id}`}
                  className="flex flex-col gap-0.5 px-4 py-2.5"
                >
                  <span className="font-medium text-foreground">{row.region}</span>
                  <span className="text-xs text-muted-foreground">
                    {COUNTRY_LABELS[row.country as Country] ?? row.country}
                  </span>
                </Link>
              </TableCell>
              <TableCell>
                <CrawlRunStatusBadge status={row.status} />
              </TableCell>
              <TableCell className="font-mono text-xs">
                {row.doneJobs} / {row.totalJobs}
              </TableCell>
              <TableCell className="font-mono text-xs">
                {row.candidatesFound}
              </TableCell>
              <TableCell className="font-mono text-xs">
                {formatApproxEur(row.costUsd)}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {formatDate(row.createdAt)}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {row.startedByName ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
