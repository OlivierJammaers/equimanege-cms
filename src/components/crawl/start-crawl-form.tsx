"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { COUNTRY_LABELS, REGIONS, type Country } from "@/lib/regions";
import { startCrawlRun } from "@/server/actions/crawl";

const COUNTRIES = Object.keys(COUNTRY_LABELS) as Country[];

/**
 * Start-formulier voor een nieuw AI-onderzoek (`/beheer/crawl`): land → regio
 * (gefilterd op de gekozen land) → "Start onderzoek". Bij succes navigeert
 * de admin meteen naar de run-detailpagina, waar de client-driver het
 * onderzoek daadwerkelijk aan het draaien krijgt.
 */
export function StartCrawlForm({ hasApiKey }: { hasApiKey: boolean }) {
  const router = useRouter();
  const [country, setCountry] = useState<Country>("BE");
  const [region, setRegion] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  const regionsForCountry = useMemo(
    () => REGIONS.filter((r) => r.country === country),
    [country],
  );

  function handleCountryChange(value: string) {
    setCountry(value as Country);
    setRegion("");
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!region) {
      toast.error("Kies eerst een regio.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await startCrawlRun(country, region);
        toast.success("Onderzoek gestart");
        router.push(`/beheer/crawl/${result.id}`);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Onderzoek starten mislukt.",
        );
      }
    });
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 sm:flex-row sm:items-end"
        >
          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor="crawl-country" className="text-xs text-muted-foreground">
              Land
            </label>
            <Select
              value={country}
              onValueChange={handleCountryChange}
              disabled={isPending || !hasApiKey}
            >
              <SelectTrigger id="crawl-country" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((code) => (
                  <SelectItem key={code} value={code}>
                    {COUNTRY_LABELS[code]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor="crawl-region" className="text-xs text-muted-foreground">
              Provincie / regio
            </label>
            <Select
              value={region}
              onValueChange={setRegion}
              disabled={isPending || !hasApiKey}
            >
              <SelectTrigger id="crawl-region" className="w-full">
                <SelectValue placeholder="Kies een regio…" />
              </SelectTrigger>
              <SelectContent>
                {regionsForCountry.map((r) => (
                  <SelectItem key={r.code} value={r.name}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" disabled={isPending || !hasApiKey || !region}>
            {isPending ? "Bezig…" : "Start onderzoek"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
