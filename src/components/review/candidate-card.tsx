"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PriorityBadge } from "@/components/accounts/priority-badge";
import { approveCandidate, rejectCandidate } from "@/server/actions/review";
import type { CrawlCandidate } from "@/lib/crawl-schema";
import type { Priority } from "@/lib/constants";

function toExternalHref(value: string): string {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

const KEY_FIELDS: { key: keyof CrawlCandidate; label: string }[] = [
  { key: "category", label: "Categorie" },
  { key: "phone", label: "Telefoon" },
  { key: "email", label: "E-mail" },
  { key: "contactPerson", label: "Contactpersoon" },
];

const MORE_FIELDS: { key: keyof CrawlCandidate; label: string }[] = [
  { key: "address", label: "Adres" },
  { key: "postcode", label: "Postcode" },
  { key: "deelgemeente", label: "Deelgemeente" },
  { key: "facebook", label: "Facebook" },
  { key: "instagram", label: "Instagram" },
  { key: "sizeInfo", label: "Omvang" },
  { key: "pricingInfo", label: "Tarieven" },
  { key: "offer", label: "Aanbod" },
  { key: "infrastructure", label: "Infrastructuur" },
  { key: "disciplines", label: "Disciplines" },
  { key: "givesLessons", label: "Geeft lessen" },
  { key: "softwareStatus", label: "Softwarestatus" },
  { key: "softwareDetail", label: "Software-detail" },
  { key: "websiteTech", label: "Websitetechnologie" },
  { key: "salesAngle", label: "Verkoophoek" },
  { key: "vatNumber", label: "BTW-nummer" },
  { key: "sourceNotes", label: "Bronnotities" },
];

/**
 * Eén kandidaat-kaart in de review-wachtrij (`/review`). Verdwijnt lokaal
 * meteen na een geslaagde actie en triggert daarna `router.refresh()` zodat
 * de badge-teller in de header en andere kaarten (bv. bij "Alles
 * goedkeuren") ook meteen kloppen.
 */
export function CandidateCard({
  candidateId,
  name,
  gemeente,
  payload,
}: {
  candidateId: string;
  name: string;
  gemeente: string | null;
  payload: CrawlCandidate;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [hidden, setHidden] = useState(false);

  function handleApprove() {
    startTransition(async () => {
      try {
        const result = await approveCandidate(candidateId);
        if (result.duplicate) {
          toast.info("Al aanwezig — als duplicaat gemarkeerd");
        } else {
          toast.success("Goedgekeurd — account aangemaakt");
        }
        setHidden(true);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Goedkeuren mislukt.");
      }
    });
  }

  function handleReject() {
    startTransition(async () => {
      try {
        await rejectCandidate(candidateId);
        toast.success("Afgewezen");
        setHidden(true);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Afwijzen mislukt.");
      }
    });
  }

  if (hidden) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold text-foreground">{name}</span>
            {payload.priority ? (
              <PriorityBadge priority={payload.priority as Priority} />
            ) : null}
            {payload.score !== null && payload.score !== undefined ? (
              <span className="font-mono text-xs text-muted-foreground">
                score {payload.score}
              </span>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">{gemeente ?? "—"}</p>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid gap-3 sm:grid-cols-2">
          {KEY_FIELDS.map(({ key, label }) => {
            const value = payload[key];
            if (!value) return null;
            return (
              <div key={key} className="flex min-w-0 flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="text-sm text-foreground [overflow-wrap:anywhere]">
                  {key === "email" ? (
                    <a
                      href={`mailto:${String(value)}`}
                      className="underline-offset-2 hover:underline"
                    >
                      {String(value)}
                    </a>
                  ) : key === "phone" ? (
                    <a
                      href={`tel:${String(value)}`}
                      className="font-mono underline-offset-2 hover:underline"
                    >
                      {String(value)}
                    </a>
                  ) : (
                    String(value)
                  )}
                </dd>
              </div>
            );
          })}
          {payload.website ? (
            <div className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">Website</dt>
              <dd className="text-sm [overflow-wrap:anywhere]">
                <a
                  href={toExternalHref(payload.website)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline-offset-2 hover:underline"
                >
                  {payload.website}
                </a>
              </dd>
            </div>
          ) : null}
        </dl>

        {payload.source ? (
          <p className="text-xs text-muted-foreground">
            Bron:{" "}
            {/^https?:\/\//i.test(payload.source) ? (
              <a
                href={payload.source}
                target="_blank"
                rel="noopener noreferrer"
                className="underline-offset-2 hover:underline"
              >
                {payload.source}
              </a>
            ) : (
              <span className="text-foreground">{payload.source}</span>
            )}
          </p>
        ) : null}

        {payload.opener ? (
          <div className="rounded-md border-l-4 border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-600 dark:bg-amber-950/30 dark:text-amber-200">
            {payload.opener}
          </div>
        ) : null}

        {MORE_FIELDS.some(({ key }) => Boolean(payload[key])) ? (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Meer velden
            </summary>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              {MORE_FIELDS.map(({ key, label }) => {
                const value = payload[key];
                if (!value) return null;
                return (
                  <div key={key} className="flex min-w-0 flex-col gap-0.5">
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="text-sm text-foreground [overflow-wrap:anywhere]">
                      {String(value)}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </details>
        ) : null}

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" onClick={handleReject} disabled={isPending}>
            Afwijzen
          </Button>
          <Button type="button" onClick={handleApprove} disabled={isPending}>
            {isPending ? "Bezig…" : "Goedkeuren"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
