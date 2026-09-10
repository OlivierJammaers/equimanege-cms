"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { UserCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={active ? "Deactiveren" : "Heractiveren"}
            onClick={handleToggle}
            disabled={isPending}
          >
            {active ? <UserX className="size-4" /> : <UserCheck className="size-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{active ? "Deactiveren" : "Heractiveren"}</TooltipContent>
      </Tooltip>
    </div>
  );
}
