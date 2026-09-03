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
import { approveAllPending } from "@/server/actions/review";

/** Admin-only batch-goedkeuring van alle pending kandidaten van één run. */
export function ApproveAllButton({ runId, count }: { runId: string; count: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      try {
        const result = await approveAllPending(runId);
        const parts = [`${result.approvedCount} goedgekeurd`];
        if (result.duplicateCount > 0) {
          parts.push(`${result.duplicateCount} als duplicaat gemarkeerd`);
        }
        toast.success(parts.join(", "));
        setOpen(false);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Alles goedkeuren mislukt.",
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          Alles goedkeuren
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Alles goedkeuren?</DialogTitle>
          <DialogDescription>
            Dit keurt alle {count} openstaande kandidaten van deze run in één keer goed.
            Kandidaten die ondertussen al als account bestaan worden automatisch als
            duplicaat gemarkeerd in plaats van goedgekeurd.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Annuleren
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={isPending}>
            {isPending ? "Bezig…" : `Goedkeuren (${count})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
