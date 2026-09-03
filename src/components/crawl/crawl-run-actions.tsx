"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cancelRun, pauseRun, resumeRun } from "@/server/actions/crawl";
import type { CrawlRunStatus } from "@/lib/crawl-constants";

/** Pauzeer/hervat/annuleer-knoppen op de run-detailpagina (admin-only). */
export function CrawlRunActions({
  runId,
  status,
}: {
  runId: string;
  status: CrawlRunStatus;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [cancelOpen, setCancelOpen] = useState(false);

  function handlePause() {
    startTransition(async () => {
      try {
        await pauseRun(runId);
        toast.success("Onderzoek gepauzeerd");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Pauzeren mislukt.");
      }
    });
  }

  function handleResume() {
    startTransition(async () => {
      try {
        await resumeRun(runId);
        toast.success("Onderzoek hervat");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Hervatten mislukt.");
      }
    });
  }

  function handleCancel() {
    startTransition(async () => {
      try {
        await cancelRun(runId);
        toast.success("Onderzoek geannuleerd");
        setCancelOpen(false);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Annuleren mislukt.");
      }
    });
  }

  const canPause = status === "running";
  const canResume = status === "paused";
  const canCancel = status === "running" || status === "paused" || status === "pending";

  if (!canPause && !canResume && !canCancel) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {canPause ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handlePause}
          disabled={isPending}
        >
          Pauzeer
        </Button>
      ) : null}
      {canResume ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleResume}
          disabled={isPending}
        >
          Hervat
        </Button>
      ) : null}
      {canCancel ? (
        <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={isPending}
            >
              Annuleer
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Onderzoek annuleren?</DialogTitle>
              <DialogDescription>
                Dit stopt het onderzoek definitief — dit kan niet ongedaan worden gemaakt.
                Al gevonden kandidaten blijven bewaard.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCancelOpen(false)}
                disabled={isPending}
              >
                Terug
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleCancel}
                disabled={isPending}
              >
                {isPending ? "Bezig…" : "Definitief annuleren"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
