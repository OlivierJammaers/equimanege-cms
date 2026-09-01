"use client";

import { useState, useTransition, type FormEvent } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPassword } from "@/server/actions/users";

export function ResetPasswordDialog({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      try {
        await resetPassword(userId, newPassword);
        toast.success("Wachtwoord gereset");
        setNewPassword("");
        setOpen(false);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Wachtwoord resetten mislukt");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          Wachtwoord resetten
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Wachtwoord resetten</DialogTitle>
            <DialogDescription>
              Stel een nieuw wachtwoord in voor deze gebruiker en deel het veilig door.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reset-new-password">Nieuw wachtwoord</Label>
            <Input
              id="reset-new-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              disabled={isPending}
              required
            />
            <p className="text-xs text-muted-foreground">Minstens 8 tekens.</p>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending || newPassword.length < 8}>
              {isPending ? "Bezig…" : "Wachtwoord resetten"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
