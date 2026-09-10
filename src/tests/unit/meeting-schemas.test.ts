import { describe, expect, test } from "vitest";
import {
  bookMeetingSchema,
  createSlotsSchema,
  meetingIdSchema,
  slotIdSchema,
} from "@/lib/meeting-schemas";

describe("createSlotsSchema", () => {
  test("aanvaardt een geldige datum + tijden", () => {
    const parsed = createSlotsSchema.parse({
      date: "2026-09-17",
      times: [{ start: "14:00", durationMinutes: 60 }],
    });
    expect(parsed.date).toBe("2026-09-17");
    expect(parsed.times).toHaveLength(1);
  });

  test("weigert een ongeldige datum", () => {
    expect(() =>
      createSlotsSchema.parse({
        date: "17-09-2026",
        times: [{ start: "14:00", durationMinutes: 60 }],
      }),
    ).toThrow();
  });

  test("weigert een ongeldig tijdstip", () => {
    expect(() =>
      createSlotsSchema.parse({
        date: "2026-09-17",
        times: [{ start: "14u00", durationMinutes: 60 }],
      }),
    ).toThrow();
  });

  test("weigert een lege tijdenlijst", () => {
    expect(() =>
      createSlotsSchema.parse({ date: "2026-09-17", times: [] }),
    ).toThrow();
  });

  test("weigert een duur buiten 15-240 min", () => {
    expect(() =>
      createSlotsSchema.parse({
        date: "2026-09-17",
        times: [{ start: "14:00", durationMinutes: 10 }],
      }),
    ).toThrow();
    expect(() =>
      createSlotsSchema.parse({
        date: "2026-09-17",
        times: [{ start: "14:00", durationMinutes: 300 }],
      }),
    ).toThrow();
  });
});

describe("bookMeetingSchema", () => {
  const accountId = "11111111-1111-4111-8111-111111111111";
  const slotId = "22222222-2222-4222-8222-222222222222";

  test("aanvaardt zonder notitie (undefined wordt null)", () => {
    const parsed = bookMeetingSchema.parse({ accountId, slotId });
    expect(parsed.note).toBeNull();
  });

  test("trimt de notitie en zet lege string om naar null", () => {
    const parsed = bookMeetingSchema.parse({ accountId, slotId, note: "  " });
    expect(parsed.note).toBeNull();
  });

  test("bewaart een echte notitie getrimd", () => {
    const parsed = bookMeetingSchema.parse({
      accountId,
      slotId,
      note: "  Bespreken: prijzen  ",
    });
    expect(parsed.note).toBe("Bespreken: prijzen");
  });

  test("weigert een ongeldige accountId", () => {
    expect(() =>
      bookMeetingSchema.parse({ accountId: "niet-een-uuid", slotId }),
    ).toThrow();
  });
});

describe("slotIdSchema / meetingIdSchema", () => {
  test("aanvaardt een geldige uuid", () => {
    expect(() =>
      slotIdSchema.parse({ slotId: "11111111-1111-4111-8111-111111111111" }),
    ).not.toThrow();
    expect(() =>
      meetingIdSchema.parse({ meetingId: "11111111-1111-4111-8111-111111111111" }),
    ).not.toThrow();
  });

  test("weigert een ongeldige uuid", () => {
    expect(() => slotIdSchema.parse({ slotId: "abc" })).toThrow();
    expect(() => meetingIdSchema.parse({ meetingId: "abc" })).toThrow();
  });
});
