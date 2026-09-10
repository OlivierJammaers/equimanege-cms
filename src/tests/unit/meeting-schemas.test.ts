import { describe, expect, test } from "vitest";
import {
  bookMeetingSchema,
  createWindowsSchema,
  meetingIdSchema,
  windowIdSchema,
} from "@/lib/meeting-schemas";

describe("createWindowsSchema", () => {
  test("aanvaardt een geldige datum + van/tot-reeksen", () => {
    const parsed = createWindowsSchema.parse({
      date: "2026-09-17",
      ranges: [{ from: "13:00", to: "17:00" }],
    });
    expect(parsed.date).toBe("2026-09-17");
    expect(parsed.ranges).toHaveLength(1);
  });

  test("weigert een ongeldige datum", () => {
    expect(() =>
      createWindowsSchema.parse({
        date: "17-09-2026",
        ranges: [{ from: "13:00", to: "17:00" }],
      }),
    ).toThrow();
  });

  test("weigert een ongeldig tijdstip", () => {
    expect(() =>
      createWindowsSchema.parse({
        date: "2026-09-17",
        ranges: [{ from: "13u00", to: "17:00" }],
      }),
    ).toThrow();
  });

  test("weigert een lege reekslijst", () => {
    expect(() => createWindowsSchema.parse({ date: "2026-09-17", ranges: [] })).toThrow();
  });

  test("weigert een eindtijd die niet na de starttijd ligt", () => {
    expect(() =>
      createWindowsSchema.parse({
        date: "2026-09-17",
        ranges: [{ from: "17:00", to: "13:00" }],
      }),
    ).toThrow(/Eindtijd moet na de starttijd liggen/);

    expect(() =>
      createWindowsSchema.parse({
        date: "2026-09-17",
        ranges: [{ from: "13:00", to: "13:00" }],
      }),
    ).toThrow(/Eindtijd moet na de starttijd liggen/);
  });
});

describe("bookMeetingSchema", () => {
  const accountId = "11111111-1111-4111-8111-111111111111";
  const windowId = "22222222-2222-4222-8222-222222222222";
  const start = "2026-09-17T13:00:00.000Z";

  test("aanvaardt zonder notitie (undefined wordt null)", () => {
    const parsed = bookMeetingSchema.parse({ accountId, windowId, start, durationMinutes: 60 });
    expect(parsed.note).toBeNull();
  });

  test("trimt de notitie en zet lege string om naar null", () => {
    const parsed = bookMeetingSchema.parse({
      accountId,
      windowId,
      start,
      durationMinutes: 60,
      note: "  ",
    });
    expect(parsed.note).toBeNull();
  });

  test("bewaart een echte notitie getrimd", () => {
    const parsed = bookMeetingSchema.parse({
      accountId,
      windowId,
      start,
      durationMinutes: 60,
      note: "  Bespreken: prijzen  ",
    });
    expect(parsed.note).toBe("Bespreken: prijzen");
  });

  test("weigert een ongeldige accountId", () => {
    expect(() =>
      bookMeetingSchema.parse({ accountId: "niet-een-uuid", windowId, start, durationMinutes: 60 }),
    ).toThrow();
  });

  test("weigert een ongeldig start-instant", () => {
    expect(() =>
      bookMeetingSchema.parse({ accountId, windowId, start: "17:00", durationMinutes: 60 }),
    ).toThrow();
  });

  test("weigert een duur buiten 15-240 min", () => {
    expect(() =>
      bookMeetingSchema.parse({ accountId, windowId, start, durationMinutes: 10 }),
    ).toThrow();
    expect(() =>
      bookMeetingSchema.parse({ accountId, windowId, start, durationMinutes: 300 }),
    ).toThrow();
  });
});

describe("windowIdSchema / meetingIdSchema", () => {
  test("aanvaardt een geldige uuid", () => {
    expect(() =>
      windowIdSchema.parse({ windowId: "11111111-1111-4111-8111-111111111111" }),
    ).not.toThrow();
    expect(() =>
      meetingIdSchema.parse({ meetingId: "11111111-1111-4111-8111-111111111111" }),
    ).not.toThrow();
  });

  test("weigert een ongeldige uuid", () => {
    expect(() => windowIdSchema.parse({ windowId: "abc" })).toThrow();
    expect(() => meetingIdSchema.parse({ meetingId: "abc" })).toThrow();
  });
});
