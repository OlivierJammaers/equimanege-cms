"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
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
import {
  AccountFormDialog,
  type AccountFormDefaultValues,
} from "@/components/accounts/account-form-dialog";
import { deleteAccount } from "@/server/actions/accounts";

/**
 * "Bewerken" (alle gebruikers) + "Verwijderen" (enkel admin) voor het
 * accountdetail. Los client-component nodig omdat de detailpagina zelf een
 * server component is (leest rechtstreeks uit de DB).
 */
export function AccountDetailActions({
  accountId,
  isAdmin,
  defaultValues,
}: {
  accountId: string;
  isAdmin: boolean;
  defaultValues: AccountFormDefaultValues;
}) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, startDeleteTransition] = useTransition();

  function handleDelete() {
    startDeleteTransition(async () => {
      try {
        await deleteAccount(accountId);
        toast.success("Account verwijderd");
        setDeleteOpen(false);
        router.push("/");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Verwijderen mislukt.",
        );
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <AccountFormDialog
        mode="edit"
        accountId={accountId}
        defaultValues={defaultValues}
        trigger={
          <Button type="button" variant="outline" size="sm">
            <Pencil className="size-3.5" />
            Bewerken
          </Button>
        }
      />

      {isAdmin ? (
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
              Verwijderen
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Account verwijderen?</DialogTitle>
              <DialogDescription>
                Dit verwijdert ook alle belverslagen en opmerkingen — dit kan
                niet ongedaan worden gemaakt.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteOpen(false)}
                disabled={isDeleting}
              >
                Annuleren
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? "Bezig…" : "Verwijderen"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
