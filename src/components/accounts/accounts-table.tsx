"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Search,
} from "lucide-react";
import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_alphanumeric,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CallStatusSelect } from "@/components/accounts/call-status-select";
import { ExportCsvButton } from "@/components/accounts/export-csv-button";
import {
  CALL_STATUSES,
  CALL_STATUS_LABELS,
  PRIORITIES,
  PRIORITY_BADGE_CLASSES,
  type CallStatus,
  type Priority,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Account } from "@/db/schema";

const ALL_SENTINEL = "__alle__";
// Radix Select verbiedt een lege string als item-value; "" is een geldige
// belstatus ("nog niet gebeld"), dus die krijgt een eigen sentinel — apart
// van ALL_SENTINEL, anders is "nog niet gebeld" niet los filterbaar van "alle".
const STATUS_EMPTY_SENTINEL = "__status_leeg__";

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric },
});

const columnHelper = createColumnHelper<typeof features, Account>();

const columns = columnHelper.columns([
  columnHelper.accessor("priority", {
    id: "priority",
    header: "Prio",
    sortFn: "alphanumeric",
    cell: (info) => {
      const priority = info.getValue();
      if (!priority) return <span className="text-muted-foreground">—</span>;
      return (
        <Badge
          variant="outline"
          className={cn(
            "font-mono text-[11px] uppercase",
            PRIORITY_BADGE_CLASSES[priority],
          )}
        >
          {priority}
        </Badge>
      );
    },
  }),
  columnHelper.accessor("name", {
    id: "name",
    header: "Naam",
    sortFn: "alphanumeric",
    cell: (info) => {
      const account = info.row.original;
      return (
        <div className="flex flex-col">
          <span className="font-medium text-foreground">{account.name}</span>
          {account.category ? (
            <span className="text-xs text-muted-foreground">
              {account.category}
            </span>
          ) : null}
        </div>
      );
    },
  }),
  columnHelper.accessor("gemeente", {
    id: "gemeente",
    header: "Gemeente",
    sortFn: "alphanumeric",
    cell: (info) => info.getValue() ?? "—",
  }),
  columnHelper.accessor("phone", {
    id: "phone",
    header: "Telefoon",
    enableSorting: false,
    cell: (info) => {
      const phone = info.getValue();
      if (!phone) return <span className="text-muted-foreground">—</span>;
      return (
        <a
          href={`tel:${phone}`}
          onClick={(event) => event.stopPropagation()}
          className="font-mono text-xs text-foreground underline-offset-2 hover:underline"
        >
          {phone}
        </a>
      );
    },
  }),
  columnHelper.accessor("softwareStatus", {
    id: "softwareStatus",
    header: "Software",
    sortFn: "alphanumeric",
    cell: (info) => info.getValue() ?? "—",
  }),
  columnHelper.accessor("callStatus", {
    id: "callStatus",
    header: "Belstatus",
    sortFn: "alphanumeric",
    cell: (info) => {
      const account = info.row.original;
      return (
        <div onClick={(event) => event.stopPropagation()}>
          <CallStatusSelect
            accountId={account.id}
            value={account.callStatus as CallStatus}
          />
        </div>
      );
    },
  }),
  columnHelper.accessor("nextActionDate", {
    id: "nextActionDate",
    header: "Volgende actie",
    sortFn: "alphanumeric",
    cell: (info) => info.getValue() ?? "—",
  }),
]);

function SortIcon({ direction }: { direction: false | "asc" | "desc" }) {
  if (direction === "asc") return <ArrowUp className="size-3.5" />;
  if (direction === "desc") return <ArrowDown className="size-3.5" />;
  return <ArrowUpDown className="size-3.5 text-muted-foreground/50" />;
}

export function AccountsTable({ rows }: { rows: Account[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>(ALL_SENTINEL);
  const [gemeenteFilter, setGemeenteFilter] = useState<string>(ALL_SENTINEL);
  const [statusFilter, setStatusFilter] = useState<string>(ALL_SENTINEL);
  const [hideDone, setHideDone] = useState(false);

  const gemeenten = useMemo(() => {
    const unique = new Set<string>();
    for (const row of rows) {
      if (row.gemeente) unique.add(row.gemeente);
    }
    return Array.from(unique).sort((a, b) => a.localeCompare(b, "nl"));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return rows.filter((row) => {
      if (hideDone && row.isDone) return false;

      if (priorityFilter !== ALL_SENTINEL && row.priority !== priorityFilter) {
        return false;
      }

      if (gemeenteFilter !== ALL_SENTINEL && row.gemeente !== gemeenteFilter) {
        return false;
      }

      if (statusFilter !== ALL_SENTINEL) {
        const effectiveStatusFilter =
          statusFilter === STATUS_EMPTY_SENTINEL ? "" : statusFilter;
        if (row.callStatus !== effectiveStatusFilter) return false;
      }

      if (query) {
        const haystack = [
          row.name,
          row.gemeente,
          row.deelgemeente,
          row.phone,
          row.email,
          row.contactPerson,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      return true;
    });
  }, [rows, search, priorityFilter, gemeenteFilter, statusFilter, hideDone]);

  const table = useTable({
    features,
    columns,
    data: filteredRows,
    getRowId: (row) => row.id,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-14 z-30 flex flex-wrap items-center gap-2 border-b bg-background/95 py-3 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Zoeken op naam, gemeente, telefoon…"
            className="w-64 pl-8"
          />
        </div>

        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger size="sm" className="w-[130px]">
            <SelectValue placeholder="Prioriteit" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_SENTINEL}>Alle prioriteiten</SelectItem>
            {PRIORITIES.map((priority: Priority) => (
              <SelectItem key={priority} value={priority}>
                {priority}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={gemeenteFilter} onValueChange={setGemeenteFilter}>
          <SelectTrigger size="sm" className="w-[160px]">
            <SelectValue placeholder="Gemeente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_SENTINEL}>Alle gemeentes</SelectItem>
            {gemeenten.map((gemeente) => (
              <SelectItem key={gemeente} value={gemeente}>
                {gemeente}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger size="sm" className="w-[180px]">
            <SelectValue placeholder="Belstatus" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_SENTINEL}>Alle statussen</SelectItem>
            {CALL_STATUSES.map((status) => (
              <SelectItem
                key={status || "leeg"}
                value={status === "" ? STATUS_EMPTY_SENTINEL : status}
              >
                {CALL_STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <label className="flex items-center gap-2 text-sm text-muted-foreground select-none">
          <input
            type="checkbox"
            checked={hideDone}
            onChange={(event) => setHideDone(event.target.checked)}
            className="size-4 rounded border-input accent-foreground"
          />
          Afgehandeld verbergen
        </label>

        <span className="text-xs text-muted-foreground">
          {filteredRows.length} van {rows.length}
        </span>

        <div className="ml-auto">
          <ExportCsvButton rows={filteredRows} />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="flex items-center gap-1.5 select-none hover:text-foreground"
                      >
                        <table.FlexRender header={header} />
                        <SortIcon direction={header.column.getIsSorted()} />
                      </button>
                    ) : (
                      <table.FlexRender header={header} />
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  Geen accounts gevonden.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  onClick={() => router.push(`/accounts/${row.original.id}`)}
                  className={cn(
                    "cursor-pointer",
                    row.original.isDone && "opacity-60",
                  )}
                >
                  {row.getAllCells().map((cell) => (
                    <TableCell key={cell.id}>
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
