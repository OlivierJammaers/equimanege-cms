"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
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
import { PriorityBadge } from "@/components/accounts/priority-badge";
import { CallStatusSelect } from "@/components/accounts/call-status-select";
import { ExportCsvButton } from "@/components/accounts/export-csv-button";
import {
  CALL_STATUSES,
  CALL_STATUS_LABELS,
  PRIORITIES,
  type CallStatus,
  type Priority,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { Account } from "@/db/schema";

/**
 * Alleen de kolommen die de lijst echt nodig heeft (weergave + zoeken).
 * De lange narratieve velden (opener, aanbod, …) blijven op de server —
 * dat houdt de payload van 453 rijen klein. `src/app/(app)/page.tsx`
 * selecteert exact deze kolommen.
 */
export type AccountListRow = Pick<
  Account,
  | "id"
  | "priority"
  | "name"
  | "category"
  | "gemeente"
  | "deelgemeente"
  | "phone"
  | "email"
  | "contactPerson"
  | "softwareStatus"
  | "callStatus"
  | "nextActionDate"
  | "isDone"
>;

const PAGE_SIZE = 50;

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

const columnHelper = createColumnHelper<typeof features, AccountListRow>();

const columns = columnHelper.columns([
  columnHelper.accessor("priority", {
    id: "priority",
    header: "Prio",
    sortFn: "alphanumeric",
    cell: (info) => {
      const priority = info.getValue();
      if (!priority) return <span className="text-muted-foreground">—</span>;
      return <PriorityBadge priority={priority} />;
    },
  }),
  columnHelper.accessor("name", {
    id: "name",
    header: "Naam",
    sortFn: "alphanumeric",
    cell: (info) => {
      const account = info.row.original;
      return (
        <div className="flex max-w-[320px] flex-col">
          <span className="truncate font-medium text-foreground">
            {account.name}
          </span>
          {account.category ? (
            <span
              className="truncate text-xs text-muted-foreground"
              title={account.category}
            >
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
      // Bronveld kan meerdere nummers bevatten ("011 … ; 0475 …"): bel het
      // eerste nummer, toon de rest afgekapt met de volledige tekst als title.
      const firstNumber = phone.split(/[;/]/)[0]?.trim() ?? phone;
      return (
        <a
          href={`tel:${firstNumber}`}
          onClick={(event) => event.stopPropagation()}
          title={phone}
          className="block max-w-[170px] truncate font-mono text-xs text-foreground underline-offset-2 hover:underline"
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
    cell: (info) => {
      const value = info.getValue();
      if (!value) return <span className="text-muted-foreground">—</span>;
      return (
        <span className="block max-w-[180px] truncate" title={value}>
          {value}
        </span>
      );
    },
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

export function AccountsTable({ rows }: { rows: AccountListRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>(ALL_SENTINEL);
  const [gemeenteFilter, setGemeenteFilter] = useState<string>(ALL_SENTINEL);
  const [statusFilter, setStatusFilter] = useState<string>(ALL_SENTINEL);
  const [hideDone, setHideDone] = useState(false);
  const [page, setPage] = useState(0);

  // Terug naar pagina 1 zodra een filter of de zoekterm wijzigt — de
  // paginatie is puur visueel en mag een filterresultaat nooit verbergen.
  // (Render-time reset i.p.v. useEffect, zie React-docs "adjusting state".)
  const filterKey = [
    search,
    priorityFilter,
    gemeenteFilter,
    statusFilter,
    hideDone,
  ].join("|");
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(0);
  }

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

  // Pagineren gebeurt pas ná filteren én sorteren (visueel; filters en
  // CSV-export blijven op de volledige set werken).
  const sortedRows = table.getRowModel().rows;
  const pageCount = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pagedRows = sortedRows.slice(
    safePage * PAGE_SIZE,
    (safePage + 1) * PAGE_SIZE,
  );

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

      <div className="overflow-x-auto rounded-lg border shadow-sm">
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
            {pagedRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  Geen accounts gevonden.
                </TableCell>
              </TableRow>
            ) : (
              pagedRows.map((row) => (
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

      {sortedRows.length > PAGE_SIZE ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {safePage * PAGE_SIZE + 1}–
            {Math.min((safePage + 1) * PAGE_SIZE, sortedRows.length)} van{" "}
            {sortedRows.length}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={safePage === 0}
              onClick={() => setPage(safePage - 1)}
            >
              <ChevronLeft className="size-4" />
              Vorige
            </Button>
            <span className="tabular-nums">
              Pagina {safePage + 1} van {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage(safePage + 1)}
            >
              Volgende
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
