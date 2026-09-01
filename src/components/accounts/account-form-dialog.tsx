"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createAccount, updateAccountDetails } from "@/server/actions/accounts";
import { PRIORITIES, PRIORITY_LABELS, type Priority } from "@/lib/constants";

// Radix Select verbiedt een lege string als item-value — "geen prioriteit"
// krijgt daarom een eigen sentinel, net als in accounts-table.tsx.
const NO_PRIORITY_SENTINEL = "__geen_prioriteit__";

type AccountFormState = {
  name: string;
  type: "prospect" | "customer";
  priority: string;
  category: string;
  gemeente: string;
  postcode: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  contactPerson: string;
};

const EMPTY_FORM: AccountFormState = {
  name: "",
  type: "prospect",
  priority: "",
  category: "",
  gemeente: "",
  postcode: "",
  address: "",
  phone: "",
  email: "",
  website: "",
  contactPerson: "",
};

export type AccountFormDefaultValues = Omit<AccountFormState, "priority"> & {
  priority: string | null;
};

type AccountFormDialogProps =
  | {
      mode: "create";
      trigger: ReactNode;
    }
  | {
      mode: "edit";
      trigger: ReactNode;
      accountId: string;
      defaultValues: AccountFormDefaultValues;
    };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toFormState(defaultValues: AccountFormDefaultValues): AccountFormState {
  return { ...defaultValues, priority: defaultValues.priority ?? "" };
}

export function AccountFormDialog(props: AccountFormDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<AccountFormState>(() =>
    props.mode === "edit" ? toFormState(props.defaultValues) : EMPTY_FORM,
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    setError(null);
    if (nextOpen) {
      setForm(props.mode === "edit" ? toFormState(props.defaultValues) : EMPTY_FORM);
    }
  }

  function updateField<K extends keyof AccountFormState>(
    key: K,
    value: AccountFormState[K],
  ) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const isEmailInvalid = form.email.trim().length > 0 && !EMAIL_PATTERN.test(form.email.trim());
  const isNameEmpty = form.name.trim().length === 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isNameEmpty || isEmailInvalid) return;
    setError(null);

    startTransition(async () => {
      try {
        if (props.mode === "create") {
          const { id } = await createAccount(form);
          toast.success("Account aangemaakt");
          setOpen(false);
          router.push(`/accounts/${id}`);
        } else {
          await updateAccountDetails(props.accountId, form);
          toast.success("Account bijgewerkt");
          setOpen(false);
        }
      } catch (err) {
        const message =
          err instanceof Error && err.message ? err.message : "Opslaan mislukt.";
        setError(message);
        toast.error(message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{props.trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>
              {props.mode === "create" ? "Nieuw account" : "Account bewerken"}
            </DialogTitle>
            <DialogDescription>
              {props.mode === "create"
                ? "Voeg handmatig een nieuw account (prospect of klant) toe."
                : "Werk de kerngegevens van dit account bij."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="account-name">Naam *</Label>
              <Input
                id="account-name"
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                disabled={isPending}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="account-type">Type</Label>
              <Select
                value={form.type}
                onValueChange={(value) =>
                  updateField("type", value as AccountFormState["type"])
                }
              >
                <SelectTrigger id="account-type" disabled={isPending} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prospect">Prospect</SelectItem>
                  <SelectItem value="customer">Klant</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="account-priority">Prioriteit</Label>
              <Select
                value={form.priority === "" ? NO_PRIORITY_SENTINEL : form.priority}
                onValueChange={(value) =>
                  updateField(
                    "priority",
                    value === NO_PRIORITY_SENTINEL ? "" : value,
                  )
                }
              >
                <SelectTrigger id="account-priority" disabled={isPending} className="w-full">
                  <SelectValue placeholder="Geen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PRIORITY_SENTINEL}>Geen</SelectItem>
                  {PRIORITIES.map((priority: Priority) => (
                    <SelectItem key={priority} value={priority}>
                      {PRIORITY_LABELS[priority]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="account-category">Categorie</Label>
              <Input
                id="account-category"
                value={form.category}
                onChange={(event) => updateField("category", event.target.value)}
                disabled={isPending}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="account-gemeente">Gemeente</Label>
              <Input
                id="account-gemeente"
                value={form.gemeente}
                onChange={(event) => updateField("gemeente", event.target.value)}
                disabled={isPending}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="account-postcode">Postcode</Label>
              <Input
                id="account-postcode"
                value={form.postcode}
                onChange={(event) => updateField("postcode", event.target.value)}
                disabled={isPending}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="account-address">Adres</Label>
              <Input
                id="account-address"
                value={form.address}
                onChange={(event) => updateField("address", event.target.value)}
                disabled={isPending}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="account-phone">Telefoon</Label>
              <Input
                id="account-phone"
                value={form.phone}
                onChange={(event) => updateField("phone", event.target.value)}
                disabled={isPending}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="account-email">E-mail</Label>
              <Input
                id="account-email"
                type="email"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
                disabled={isPending}
                aria-invalid={isEmailInvalid || undefined}
              />
              {isEmailInvalid ? (
                <p className="text-xs text-destructive">Ongeldig e-mailadres.</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="account-website">Website</Label>
              <Input
                id="account-website"
                value={form.website}
                onChange={(event) => updateField("website", event.target.value)}
                disabled={isPending}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="account-contact-person">Contactpersoon</Label>
              <Input
                id="account-contact-person"
                value={form.contactPerson}
                onChange={(event) => updateField("contactPerson", event.target.value)}
                disabled={isPending}
              />
            </div>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Annuleren
            </Button>
            <Button type="submit" disabled={isPending || isNameEmpty || isEmailInvalid}>
              {isPending ? "Bezig…" : props.mode === "create" ? "Aanmaken" : "Opslaan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
