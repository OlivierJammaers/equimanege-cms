import { describe, expect, test } from "vitest";
import {
  brusselsWallTimeToUtc,
  formatDayLabelNl,
  formatTimeRangeNl,
  freeGaps,
  groupWindowsByDay,
  isMeetingUpcoming,
  startOptions,
  windowRangesFromInput,
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

describe("windowRangesFromInput", () => {
  test("zet datum + van/tot-reeksen om naar UTC start/eind-instanties", () => {
    const result = windowRangesFromInput("2026-09-17", [
      { from: "09:00", to: "12:00" },
      { from: "13:00", to: "17:00" },
    ]);
    expect(result).toEqual([
      {
        startsAt: new Date("2026-09-17T07:00:00.000Z"),
        endsAt: new Date("2026-09-17T10:00:00.000Z"),
      },
      {
        startsAt: new Date("2026-09-17T11:00:00.000Z"),
        endsAt: new Date("2026-09-17T15:00:00.000Z"),
      },
    ]);
  });
});

describe("formatTimeRangeNl", () => {
  test("formatteert een tijdsbereik in Brussels tijdzone", () => {
    const startsAt = new Date("2026-09-17T11:00:00.000Z"); // 13:00 lokaal (zomer)
    const endsAt = new Date("2026-09-17T15:00:00.000Z"); // 17:00 lokaal
    expect(formatTimeRangeNl(startsAt, endsAt)).toBe("13:00 – 17:00");
  });

  test("werkt ook in de winter", () => {
    const startsAt = new Date("2026-01-17T13:45:00.000Z"); // 14:45 lokaal (winter)
    const endsAt = new Date("2026-01-17T14:15:00.000Z"); // 15:15 lokaal
    expect(formatTimeRangeNl(startsAt, endsAt)).toBe("14:45 – 15:15");
  });
});

describe("formatDayLabelNl", () => {
  test("geeft de NL-daglabel in Brussels tijdzone", () => {
    const date = new Date("2026-09-17T12:00:00.000Z");
    expect(formatDayLabelNl(date)).toBe("donderdag 17 september");
  });

  test("blijft correct rond middernacht UTC (tijdzoneverschil)", () => {
    const date = new Date("2026-09-30T23:30:00.000Z");
    expect(formatDayLabelNl(date)).toBe("donderdag 1 oktober");
  });
});

describe("isMeetingUpcoming", () => {
  const now = new Date("2026-09-17T10:00:00.000Z");

  test("een meeting die nog niet geëindigd is, is Komend", () => {
    expect(isMeetingUpcoming(new Date("2026-09-17T10:45:00.000Z"), now)).toBe(true);
  });

  test("een reeds afgelopen meeting is niet Komend", () => {
    expect(isMeetingUpcoming(new Date("2026-09-17T09:00:00.000Z"), now)).toBe(false);
  });

  test("exact op het eindmoment is nog Komend (inclusief)", () => {
    expect(isMeetingUpcoming(new Date("2026-09-17T10:00:00.000Z"), now)).toBe(true);
  });
});

describe("groupWindowsByDay", () => {
  const now = new Date("2026-09-17T10:00:00.000Z");

  test("sluit voorbije vensters uit (op eindtijd)", () => {
    const windows = [
      {
        id: "past",
        startsAt: new Date("2026-09-17T06:00:00.000Z"),
        endsAt: new Date("2026-09-17T08:00:00.000Z"),
      },
      {
        id: "future",
        startsAt: new Date("2026-09-17T12:00:00.000Z"),
        endsAt: new Date("2026-09-17T14:00:00.000Z"),
      },
    ];
    const groups = groupWindowsByDay(windows, now);
    expect(groups.flatMap((g) => g.slots.map((s) => s.id))).toEqual(["future"]);
  });

  test("een nog lopend venster (gestart maar niet geëindigd) blijft erbij", () => {
    const windows = [
      {
        id: "ongoing",
        startsAt: new Date("2026-09-17T09:00:00.000Z"),
        endsAt: new Date("2026-09-17T11:00:00.000Z"),
      },
    ];
    const groups = groupWindowsByDay(windows, now);
    expect(groups.flatMap((g) => g.slots.map((s) => s.id))).toEqual(["ongoing"]);
  });

  test("groepeert per dag (Brussels tijdzone) en sorteert oplopend", () => {
    const windows = [
      {
        id: "day2",
        startsAt: new Date("2026-09-18T14:00:00.000Z"),
        endsAt: new Date("2026-09-18T16:00:00.000Z"),
      },
      {
        id: "day1-late",
        startsAt: new Date("2026-09-17T16:00:00.000Z"),
        endsAt: new Date("2026-09-17T18:00:00.000Z"),
      },
      {
        id: "day1-early",
        startsAt: new Date("2026-09-17T12:00:00.000Z"),
        endsAt: new Date("2026-09-17T14:00:00.000Z"),
      },
    ];
    const groups = groupWindowsByDay(windows, now);
    expect(groups).toHaveLength(2);
    expect(groups[0].dayKey).toBe("2026-09-17");
    expect(groups[0].dayLabel).toBe("donderdag 17 september");
    expect(groups[0].slots.map((s) => s.id)).toEqual(["day1-early", "day1-late"]);
    expect(groups[1].dayKey).toBe("2026-09-18");
    expect(groups[1].slots.map((s) => s.id)).toEqual(["day2"]);
  });

  test("lege input geeft lege lijst", () => {
    expect(groupWindowsByDay([], now)).toEqual([]);
  });
});

describe("freeGaps", () => {
  const window = {
    startsAt: new Date("2026-09-17T13:00:00.000Z"),
    endsAt: new Date("2026-09-17T17:00:00.000Z"),
  };

  test("geen meetings -> het hele venster is vrij", () => {
    expect(freeGaps(window, [])).toEqual([
      { startsAt: window.startsAt, endsAt: window.endsAt },
    ]);
  });

  test("een meeting in het midden splitst het venster in twee gaten", () => {
    const meeting = {
      startsAt: new Date("2026-09-17T14:00:00.000Z"),
      endsAt: new Date("2026-09-17T15:00:00.000Z"),
    };
    expect(freeGaps(window, [meeting])).toEqual([
      { startsAt: window.startsAt, endsAt: meeting.startsAt },
      { startsAt: meeting.endsAt, endsAt: window.endsAt },
    ]);
  });

  test("aaneensluitende meetings laten geen gat tussen zich", () => {
    const first = {
      startsAt: new Date("2026-09-17T13:00:00.000Z"),
      endsAt: new Date("2026-09-17T14:00:00.000Z"),
    };
    const second = {
      startsAt: new Date("2026-09-17T14:00:00.000Z"),
      endsAt: new Date("2026-09-17T15:00:00.000Z"),
    };
    expect(freeGaps(window, [first, second])).toEqual([
      { startsAt: second.endsAt, endsAt: window.endsAt },
    ]);
  });

  test("een meeting die het hele venster dekt geeft geen gaten", () => {
    const meeting = { startsAt: window.startsAt, endsAt: window.endsAt };
    expect(freeGaps(window, [meeting])).toEqual([]);
  });

  test("meetings buiten volgorde worden toch correct verwerkt", () => {
    const late = {
      startsAt: new Date("2026-09-17T16:00:00.000Z"),
      endsAt: new Date("2026-09-17T16:30:00.000Z"),
    };
    const early = {
      startsAt: new Date("2026-09-17T13:30:00.000Z"),
      endsAt: new Date("2026-09-17T14:00:00.000Z"),
    };
    expect(freeGaps(window, [late, early])).toEqual([
      { startsAt: window.startsAt, endsAt: early.startsAt },
      { startsAt: early.endsAt, endsAt: late.startsAt },
      { startsAt: late.endsAt, endsAt: window.endsAt },
    ]);
  });
});

describe("startOptions", () => {
  test("volledig gat: startopties op het 30-min-raster, uitgelijnd op het gat-begin", () => {
    const gap = {
      startsAt: new Date("2026-09-17T13:00:00.000Z"),
      endsAt: new Date("2026-09-17T14:00:00.000Z"),
    };
    const result = startOptions([gap], 30);
    expect(result).toEqual([
      new Date("2026-09-17T13:00:00.000Z"),
      new Date("2026-09-17T13:30:00.000Z"),
    ]);
  });

  test("duur groter dan elk gat geeft geen opties", () => {
    const gap = {
      startsAt: new Date("2026-09-17T13:00:00.000Z"),
      endsAt: new Date("2026-09-17T13:45:00.000Z"),
    };
    expect(startOptions([gap], 60)).toEqual([]);
  });

  test("laatste optie in een gat is precies waar duur nog past", () => {
    const gap = {
      startsAt: new Date("2026-09-17T13:00:00.000Z"),
      endsAt: new Date("2026-09-17T14:10:00.000Z"),
    };
    // 60 min duur: 13:00 (eindigt 14:00, past), 13:30 (eindigt 14:30, past niet)
    expect(startOptions([gap], 60)).toEqual([new Date("2026-09-17T13:00:00.000Z")]);
  });

  test("meerdere gaten worden na elkaar geraster", () => {
    const gaps = [
      {
        startsAt: new Date("2026-09-17T09:15:00.000Z"),
        endsAt: new Date("2026-09-17T10:15:00.000Z"),
      },
      {
        startsAt: new Date("2026-09-17T13:00:00.000Z"),
        endsAt: new Date("2026-09-17T14:00:00.000Z"),
      },
    ];
    // eerste gat begint niet op een "rond" uur -> raster start op 09:15 zelf
    const result = startOptions(gaps, 30);
    expect(result).toEqual([
      new Date("2026-09-17T09:15:00.000Z"),
      new Date("2026-09-17T09:45:00.000Z"),
      new Date("2026-09-17T13:00:00.000Z"),
      new Date("2026-09-17T13:30:00.000Z"),
    ]);
  });

  test("aangepaste stepMinutes", () => {
    const gap = {
      startsAt: new Date("2026-09-17T13:00:00.000Z"),
      endsAt: new Date("2026-09-17T13:45:00.000Z"),
    };
    expect(startOptions([gap], 15, 15)).toEqual([
      new Date("2026-09-17T13:00:00.000Z"),
      new Date("2026-09-17T13:15:00.000Z"),
      new Date("2026-09-17T13:30:00.000Z"),
    ]);
  });

  test("lege gatenlijst geeft geen opties", () => {
    expect(startOptions([], 30)).toEqual([]);
  });
});
