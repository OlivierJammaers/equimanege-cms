"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deactivateUser, reactivateUser } from "@/server/actions/users";
import { ResetPasswordDialog } from "@/components/admin/reset-password-dialog";

export function UserRowActions({
  userId,
  isActive,
}: {
  userId: string;
  isActive: boolean;
}) {
  const [active, setActive] = useState(isActive);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    const next = !active;
    startTransition(async () => {
      try {
        if (next) {
          await reactivateUser(userId);
        } else {
          await deactivateUser(userId);
        }
        setActive(next);
        toast.success(next ? "Gebruiker heractiveerd" : "Gebruiker gedeactiveerd");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Bijwerken mislukt");
      }
    });
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <ResetPasswordDialog userId={userId} />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleToggle}
        disabled={isPending}
      >
        {isPending ? "Bezig…" : active ? "Deactiveren" : "Heractiveren"}
      </Button>
    </div>
  );
}
