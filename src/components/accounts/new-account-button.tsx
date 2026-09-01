"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AccountFormDialog } from "@/components/accounts/account-form-dialog";

/**
 * Client-wrapper rond de "Nieuw account"-dialog: de lijst-pagina zelf is een
 * server component (leest rechtstreeks uit de DB), dus de interactieve
 * trigger-knop leeft in een klein losstaand client-component.
 */
export function NewAccountButton() {
  return (
    <AccountFormDialog
      mode="create"
      trigger={
        <Button type="button" size="sm">
          <Plus className="size-4" />
          Nieuw account
        </Button>
      }
    />
  );
}
