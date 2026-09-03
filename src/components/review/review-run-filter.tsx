"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COUNTRY_LABELS, type Country } from "@/lib/regions";

const ALL_SENTINEL = "__alle__";

export type ReviewRunOption = {
  id: string;
  region: string;
  country: string;
};

/** Filtert de review-wachtrij (`/review`) op run via de `?run=`-querystring. */
export function ReviewRunFilter({
  runs,
  selectedRunId,
}: {
  runs: ReviewRunOption[];
  selectedRunId: string | undefined;
}) {
  const router = useRouter();

  function handleChange(value: string) {
    router.push(value === ALL_SENTINEL ? "/review" : `/review?run=${value}`);
  }

  return (
    <Select value={selectedRunId ?? ALL_SENTINEL} onValueChange={handleChange}>
      <SelectTrigger className="w-full sm:w-64">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_SENTINEL}>Alle runs</SelectItem>
        {runs.map((run) => (
          <SelectItem key={run.id} value={run.id}>
            {run.region} ({COUNTRY_LABELS[run.country as Country] ?? run.country})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
