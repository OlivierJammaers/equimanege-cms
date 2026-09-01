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
import { createSalesUser } from "@/server/actions/users";

const EMPTY_FORM = { name: "", email: "", password: "" };

export function AddSalesUserDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      try {
        await createSalesUser(form);
        toast.success("Sales-gebruiker aangemaakt");
        setForm(EMPTY_FORM);
        setOpen(false);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Aanmaken mislukt");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm">
          Sales-gebruiker toevoegen
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Sales-gebruiker toevoegen</DialogTitle>
            <DialogDescription>
              Maakt een nieuw account aan met de rol &quot;sales&quot;.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-user-name">Naam</Label>
            <Input
              id="new-user-name"
              value={form.name}
              onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))}
              disabled={isPending}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-user-email">E-mailadres</Label>
            <Input
              id="new-user-email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(event) => setForm((f) => ({ ...f, email: event.target.value }))}
              disabled={isPending}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-user-password">Wachtwoord</Label>
            <Input
              id="new-user-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={form.password}
              onChange={(event) => setForm((f) => ({ ...f, password: event.target.value }))}
              disabled={isPending}
              required
            />
            <p className="text-xs text-muted-foreground">Minstens 8 tekens.</p>
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={
                isPending ||
                form.name.trim().length === 0 ||
                form.email.trim().length === 0 ||
                form.password.length < 8
              }
            >
              {isPending ? "Bezig…" : "Toevoegen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
