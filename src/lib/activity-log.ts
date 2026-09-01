import { CALL_STATUS_LABELS, type CallStatus } from "@/lib/constants";
import type { NewActivity } from "@/db/schema";

/**
 * Pure helper — bouwt de `activities`-insertrij voor een belstatuswijziging,
 * of `null` als de status niet écht wijzigt (voorkomt dubbele logregels bij
 * een no-op update). Los van de DB gehouden zodat dit unit-testbaar is
 * zonder Postgres/Neon.
 */
export function buildStatusChangeActivity(
  accountId: string,
  userId: string,
  status: CallStatus,
  previousStatus: CallStatus,
): Omit<NewActivity, "id" | "createdAt"> | null {
  if (status === previousStatus) {
    return null;
  }

  return {
    accountId,
    userId,
    type: "status_change",
    callOutcome: status,
    body: CALL_STATUS_LABELS[status],
  };
}
