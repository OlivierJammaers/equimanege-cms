"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { releaseNextBatch, revokeLastBatch } from "@/server/actions/release";

/**
 * Admin-only beheerkaart voor vrijgave-per-25: toont hoeveel van de
 * prospecten al zichtbaar zijn voor sales en laat de admin de volgende
 * batch van 25 vrijgeven (best-eerst-volgorde, zie
 * src/lib/release-order.ts) of de laatst vrijgegeven batch terugtrekken.
 */
export function ReleaseCard({
  released,
  total,
}: {
  released: number;
  total: number;
}) {
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [isReleasing, startReleaseTransition] = useTransition();
  const [isRevoking, startRevokeTransition] = useTransition();

  const remaining = total - released;
  const allReleased = remaining <= 0;

  function handleRelease() {
    startReleaseTransition(async () => {
      try {
        const result = await releaseNextBatch();
        if (result.released === 0) {
          toast.info("Alles is al vrijgegeven");
        } else {
          toast.success(`${result.released} prospecten vrijgegeven`);
        }
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Vrijgeven mislukt.",
        );
      }
    });
  }

  function handleRevoke() {
    startRevokeTransition(async () => {
      try {
        await revokeLastBatch();
        toast.success("Laatste batch teruggetrokken");
        setRevokeOpen(false);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Terugtrekken mislukt.",
        );
      }
    });
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Vrijgave voor sales
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-4">
        <p className="font-mono text-sm tabular-nums text-foreground">
          {released} van {total} prospecten vrijgegeven
        </p>
        <div className="flex items-center gap-2">
          {released > 0 ? (
            <Dialog open={revokeOpen} onOpenChange={setRevokeOpen}>
              <DialogTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                >
                  Laatste 25 terugtrekken
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Laatste batch terugtrekken?</DialogTitle>
                  <DialogDescription>
                    Sales verliest zicht op de laatst vrijgegeven 25
                    prospecten.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setRevokeOpen(false)}
                    disabled={isRevoking}
                  >
                    Annuleren
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleRevoke}
                    disabled={isRevoking}
                  >
                    {isRevoking ? "Bezig…" : "Terugtrekken"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null}
          <Button
            type="button"
            size="sm"
            onClick={handleRelease}
            disabled={allReleased || isReleasing}
          >
            {isReleasing
              ? "Bezig…"
              : allReleased
                ? "Alles is vrijgegeven"
                : "Volgende 25 vrijgeven"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
