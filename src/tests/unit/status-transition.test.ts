import { expect, test } from "vitest";
import { buildStatusChangeActivity } from "@/lib/activity-log";

test("geen dubbele log wanneer status ongewijzigd blijft", () => {
  const result = buildStatusChangeActivity(
    "11111111-1111-1111-1111-111111111111",
    "22222222-2222-2222-2222-222222222222",
    "klant",
    "klant",
  );
  expect(result).toBeNull();
});

test("lege status → zelfde lege status geeft ook geen log", () => {
  const result = buildStatusChangeActivity(
    "11111111-1111-1111-1111-111111111111",
    "22222222-2222-2222-2222-222222222222",
    "",
    "",
  );
  expect(result).toBeNull();
});

test("van lege status naar 'afspraak-gepland' bouwt een status_change-activiteit met NL-label", () => {
  const accountId = "11111111-1111-1111-1111-111111111111";
  const userId = "22222222-2222-2222-2222-222222222222";
  const result = buildStatusChangeActivity(accountId, userId, "afspraak-gepland", "");

  expect(result).toEqual({
    accountId,
    userId,
    type: "status_change",
    callOutcome: "afspraak-gepland",
    body: "Afspraak gepland",
  });
});

test("van 'gebeld-geen-gehoor' naar 'klant' bouwt een status_change-activiteit met NL-label", () => {
  const accountId = "11111111-1111-1111-1111-111111111111";
  const userId = "22222222-2222-2222-2222-222222222222";
  const result = buildStatusChangeActivity(accountId, userId, "klant", "gebeld-geen-gehoor");

  expect(result).toEqual({
    accountId,
    userId,
    type: "status_change",
    callOutcome: "klant",
    body: "Klant",
  });
});
