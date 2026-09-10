import { describe, expect, test } from "vitest";
import {
  brusselsWallTimeToUtc,
  formatDayLabelNl,
  formatSlotTimeNl,
  groupSlotsByDay,
  slotTimesFromInput,
} from "@/lib/meeting-utils";

describe("brusselsWallTimeToUtc", () => {
  test("zomer (CEST, +02:00): 17 sep 14:00 lokaal wordt 12:00 UTC", () => {
    const result = brusselsWallTimeToUtc("2026-09-17", "14:00");
    expect(result.toISOString()).toBe("2026-09-17T12:00:00.000Z");
  });

  test("winter (CET, +01:00): 17 jan 14:00 lokaal wordt 13:00 UTC", () => {
    const result = brusselsWallTimeToUtc("2026-01-17", "14:00");
    expect(result.toISOString()).toBe("2026-01-17T13:00:00.000Z");
  });

  test("middernacht in de zomer", () => {
    const result = brusselsWallTimeToUtc("2026-06-01", "00:00");
    expect(result.toISOString()).toBe("2026-05-31T22:00:00.000Z");
  });
});

describe("slotTimesFromInput", () => {
  test("zet datum + tijden om naar Date-instanties (Brussels wall-clock)", () => {
    const result = slotTimesFromInput("2026-09-17", [
      { start: "09:00", durationMinutes: 60 },
      { start: "14:30", durationMinutes: 45 },
    ]);
    expect(result).toEqual([
      { startsAt: new Date("2026-09-17T07:00:00.000Z"), durationMinutes: 60 },
      { startsAt: new Date("2026-09-17T12:30:00.000Z"), durationMinutes: 45 },
    ]);
  });
});

describe("formatSlotTimeNl", () => {
  test("formatteert een tijdsbereik in Brussels tijdzone", () => {
    const startsAt = new Date("2026-09-17T12:00:00.000Z"); // 14:00 lokaal (zomer)
    expect(formatSlotTimeNl(startsAt, 60)).toBe("14:00 – 15:00");
  });

  test("werkt ook over het uur heen", () => {
    const startsAt = new Date("2026-01-17T13:45:00.000Z"); // 14:45 lokaal (winter)
    expect(formatSlotTimeNl(startsAt, 30)).toBe("14:45 – 15:15");
  });
});

describe("formatDayLabelNl", () => {
  test("geeft de NL-daglabel in Brussels tijdzone", () => {
    const date = new Date("2026-09-17T12:00:00.000Z");
    expect(formatDayLabelNl(date)).toBe("donderdag 17 september");
  });

  test("blijft correct rond middernacht UTC (tijdzoneverschil)", () => {
    // 23:30 UTC op 30 sep = 01:30 lokaal op 1 okt (zomer, +2)
    const date = new Date("2026-09-30T23:30:00.000Z");
    expect(formatDayLabelNl(date)).toBe("donderdag 1 oktober");
  });
});

describe("groupSlotsByDay", () => {
  const now = new Date("2026-09-17T10:00:00.000Z");

  test("sluit voorbije slots uit", () => {
    const slots = [
      { id: "past", startsAt: new Date("2026-09-17T08:00:00.000Z"), booked: false },
      { id: "future", startsAt: new Date("2026-09-17T12:00:00.000Z"), booked: false },
    ];
    const groups = groupSlotsByDay(slots, now);
    const ids = groups.flatMap((g) => g.slots.map((s) => s.id));
    expect(ids).toEqual(["future"]);
  });

  test("sluit geboekte slots uit", () => {
    const slots = [
      { id: "booked", startsAt: new Date("2026-09-17T12:00:00.000Z"), booked: true },
      { id: "free", startsAt: new Date("2026-09-17T13:00:00.000Z"), booked: false },
    ];
    const groups = groupSlotsByDay(slots, now);
    const ids = groups.flatMap((g) => g.slots.map((s) => s.id));
    expect(ids).toEqual(["free"]);
  });

  test("groepeert per dag (Brussels tijdzone) en sorteert oplopend", () => {
    const slots = [
      { id: "day2-late", startsAt: new Date("2026-09-18T14:00:00.000Z"), booked: false },
      { id: "day1-late", startsAt: new Date("2026-09-17T16:00:00.000Z"), booked: false },
      { id: "day1-early", startsAt: new Date("2026-09-17T12:00:00.000Z"), booked: false },
    ];
    const groups = groupSlotsByDay(slots, now);
    expect(groups).toHaveLength(2);
    expect(groups[0].dayKey).toBe("2026-09-17");
    expect(groups[0].dayLabel).toBe("donderdag 17 september");
    expect(groups[0].slots.map((s) => s.id)).toEqual(["day1-early", "day1-late"]);
    expect(groups[1].dayKey).toBe("2026-09-18");
    expect(groups[1].slots.map((s) => s.id)).toEqual(["day2-late"]);
  });

  test("lege input geeft lege lijst", () => {
    expect(groupSlotsByDay([], now)).toEqual([]);
  });

  test("includeBooked: true houdt geboekte slots erbij (voor de admin-agenda)", () => {
    const slots = [
      { id: "booked", startsAt: new Date("2026-09-17T12:00:00.000Z"), booked: true },
      { id: "free", startsAt: new Date("2026-09-17T13:00:00.000Z"), booked: false },
    ];
    const groups = groupSlotsByDay(slots, now, { includeBooked: true });
    const ids = groups.flatMap((g) => g.slots.map((s) => s.id));
    expect(ids).toEqual(["booked", "free"]);
  });
});
