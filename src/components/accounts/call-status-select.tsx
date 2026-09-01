"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CALL_STATUSES, CALL_STATUS_LABELS, type CallStatus } from "@/lib/constants";
import { updateCallStatus } from "@/server/actions/accounts";

// Radix Select verbiedt een lege string als item-value; "" is echter een
// geldige belstatus (nog niet gebeld), dus we mappen 'm op een sentinel.
const EMPTY_SENTINEL = "__leeg__";

function toItemValue(status: CallStatus): string {
  return status === "" ? EMPTY_SENTINEL : status;
}

function fromItemValue(value: string): CallStatus {
  return value === EMPTY_SENTINEL ? "" : (value as CallStatus);
}

export function CallStatusSelect({
  accountId,
  value,
}: {
  accountId: string;
  value: CallStatus;
}) {
  const [optimisticValue, setOptimisticValue] = useState<CallStatus>(value);
  const [isPending, startTransition] = useTransition();

  function handleChange(itemValue: string) {
    const previousStatus = optimisticValue;
    const nextStatus = fromItemValue(itemValue);
    setOptimisticValue(nextStatus);
    startTransition(async () => {
      try {
        await updateCallStatus(accountId, nextStatus);
        toast.success("Belstatus bijgewerkt");
      } catch {
        setOptimisticValue(previousStatus);
        toast.error("Belstatus bijwerken mislukt");
      }
    });
  }

  return (
    <Select value={toItemValue(optimisticValue)} onValueChange={handleChange}>
      <SelectTrigger
        size="sm"
        disabled={isPending}
        className="h-8 w-full min-w-[11rem] text-xs"
        onClick={(event) => event.stopPropagation()}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent onClick={(event) => event.stopPropagation()}>
        {CALL_STATUSES.map((status) => (
          <SelectItem key={status || "leeg"} value={toItemValue(status)}>
            {CALL_STATUS_LABELS[status]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
