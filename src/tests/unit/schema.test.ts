import { expect, test } from "vitest";
import { callStatusEnum, priorityEnum } from "@/db/schema";

test("call status enum values", () => {
  expect(callStatusEnum.enumValues).toContain("afspraak-gepland");
  expect(callStatusEnum.enumValues).toContain("");
  expect(callStatusEnum.enumValues.length).toBe(8);
});

test("priority enum", () => {
  expect(priorityEnum.enumValues).toEqual(["A", "B", "C", "D", "N", "X"]);
});
