"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type ProcessResponse = { processed: boolean; remaining: number; runId?: string };

/**
 * Client-driver op de run-detailpagina (fase 3): roept `POST
 * /api/crawl/process` sequentieel aan zolang de pagina open staat en er nog
 * werk is (Vercel-functielimiet maakt één-job-per-call nodig — zie
 * docs/superpowers/plans/2026-09-03-fase3-ai-crawl.md onder "Verwerking &
 * API-routes"). De route pakt de oudste `pending` job over álle `running`
 * runs heen (ook gebruikt door de nachtelijke cron); `router.refresh()` na
 * elke stap haalt de actuele stand van *deze* run op, dus zodra die
 * `done`/`paused` wordt, rendert de server component deze driver niet meer
 * en breekt de lus via de unmount-cleanup.
 */
export function CrawlRunDriver({
  runId,
  initialRemaining,
}: {
  runId: string;
  initialRemaining: number;
}) {
  const router = useRouter();
  const [remaining, setRemaining] = useState(initialRemaining);
  const [isActive, setIsActive] = useState(true);
  const stoppedRef = useRef(false);

  useEffect(() => {
    stoppedRef.current = false;

    async function loop() {
      while (!stoppedRef.current) {
        let result: ProcessResponse;
        try {
          const response = await fetch("/api/crawl/process", { method: "POST" });
          if (!response.ok) {
            const body: { error?: string } | null = await response
              .json()
              .catch(() => null);
            throw new Error(body?.error ?? `Verwerken mislukt (${response.status}).`);
          }
          result = (await response.json()) as ProcessResponse;
        } catch (error) {
          if (stoppedRef.current) return;
          setIsActive(false);
          toast.error(
            error instanceof Error ? error.message : "Onderzoek verwerken mislukt.",
          );
          return;
        }

        if (stoppedRef.current) return;

        if (result.runId === runId) {
          setRemaining(result.remaining);
        }
        router.refresh();

        if (!result.processed || result.remaining <= 0) {
          break;
        }
      }
      setIsActive(false);
    }

    loop();

    return () => {
      stoppedRef.current = true;
    };
  }, [runId, router]);

  function handleStop() {
    stoppedRef.current = true;
    setIsActive(false);
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-md border bg-muted/40 px-4 py-3 text-sm">
      <div className="flex flex-col gap-0.5">
        <p className="font-medium text-foreground">
          {isActive
            ? "Onderzoek draait — verwerkt volgende stap…"
            : "Gestopt — geen jobs meer verwerkt vanaf deze pagina."}
        </p>
        <p className="text-xs text-muted-foreground">
          Nog {remaining} {remaining === 1 ? "job" : "jobs"} te verwerken.
        </p>
      </div>
      {isActive ? (
        <Button type="button" variant="outline" size="sm" onClick={handleStop}>
          Stop
        </Button>
      ) : null}
    </div>
  );
}
