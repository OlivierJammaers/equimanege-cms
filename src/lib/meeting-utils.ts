/**
 * Pure helpers voor de meeting-agenda-feature. Los van DB/server-code
 * gehouden zodat ze zonder runtime unit-testbaar zijn — zelfde patroon als
 * `format-nl.ts`.
 *
 * Belangrijk: de server draait op Vercel in UTC. Elke datum/tijd die de
 * admin of sales ziet/invoert is echter een Brussels wall-clock-tijdstip
 * (Europe/Brussels, met DST). `brusselsWallTimeToUtc` zet zo'n wall-clock
 * datum+tijd om naar het echte UTC-instant (voor opslag); `formatSlotTimeNl`
 * / `formatDayLabelNl` doen het omgekeerde voor weergave — beide expliciet
 * met `timeZone: "Europe/Brussels"`, nooit de serverlocale.
 */

const dayLabelFormatter = new Intl.DateTimeFormat("nl-BE", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Europe/Brussels",
});

const timeFormatter = new Intl.DateTimeFormat("nl-BE", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Europe/Brussels",
});

const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Brussels",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const offsetFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Brussels",
  timeZoneName: "shortOffset",
});

/**
 * Bepaalt het UTC-offset (in minuten, positief = vóór op UTC) van
 * Europe/Brussels op het gegeven instant, door de tijdzone-afkorting
 * ("GMT+1"/"GMT+2") te lezen i.p.v. een vaste offset aan te nemen — zo blijft
 * dit correct over de zomertijd-/wintertijdovergang heen.
 */
function brusselsOffsetMinutesAt(instant: Date): number {
  const parts = offsetFormatter.formatToParts(instant);
  const tzName = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+0";
  const match = /GMT([+-]\d+)(?::(\d+))?/.exec(tzName);
  if (!match) return 0;
  const hours = Number(match[1]);
  const minutes = match[2] ? Number(match[2]) : 0;
  return hours * 60 + (hours < 0 ? -minutes : minutes);
}

/**
 * Zet een Brussels wall-clock datum+tijd ("2026-09-17", "14:00") om naar het
 * bijhorende UTC-instant. Werkt door de offset te bepalen op een eerste gok
 * (de wall-clock-waarden geïnterpreteerd als UTC) — voldoende nauwkeurig
 * behalve exact tijdens de DST-overgang zelf, wat hier niet voorkomt (de
 * admin plant geen meetings op 02:00-03:00 op de omschakel-nacht).
 */
export function brusselsWallTimeToUtc(date: string, time: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const naiveUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0);
  const offsetMinutes = brusselsOffsetMinutesAt(new Date(naiveUtcMs));
  return new Date(naiveUtcMs - offsetMinutes * 60_000);
}

export type SlotTimeInput = {
  start: string;
  durationMinutes: number;
};

/** Bouwt `{startsAt, durationMinutes}`-rijen uit een datum + lijst tijden. */
export function slotTimesFromInput(
  date: string,
  times: SlotTimeInput[],
): { startsAt: Date; durationMinutes: number }[] {
  return times.map((t) => ({
    startsAt: brusselsWallTimeToUtc(date, t.start),
    durationMinutes: t.durationMinutes,
  }));
}

/** Formatteert een tijdsbereik in Brussels tijdzone, bv. "14:00 – 15:00". */
export function formatSlotTimeNl(startsAt: Date, durationMinutes: number): string {
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
  return `${timeFormatter.format(startsAt)} – ${timeFormatter.format(endsAt)}`;
}

/** Formatteert een NL-daglabel in Brussels tijdzone, bv. "woensdag 17 september". */
export function formatDayLabelNl(date: Date): string {
  return dayLabelFormatter.format(date);
}

/** Sleutel voor dag-groepering in Brussels tijdzone, bv. "2026-09-17". */
function dayKeyOf(date: Date): string {
  return dayKeyFormatter.format(date);
}

export type SlotForGrouping = {
  startsAt: Date;
  booked: boolean;
};

export type DayGroup<T> = {
  dayKey: string;
  dayLabel: string;
  slots: T[];
};

/**
 * Groepeert slots per dag (Brussels tijdzone), gesorteerd oplopend op tijd.
 * Sluit voorbije slots (`startsAt < now`) uit, en standaard ook geboekte
 * slots (`booked`) — zet `includeBooked: true` (admin-agenda, die ook
 * geboekte momenten toont) om die niet uit te sluiten.
 */
export function groupSlotsByDay<T extends SlotForGrouping>(
  slots: T[],
  now: Date,
  options?: { includeBooked?: boolean },
): DayGroup<T>[] {
  const includeBooked = options?.includeBooked ?? false;
  const upcoming = slots
    .filter((slot) => (includeBooked || !slot.booked) && slot.startsAt.getTime() >= now.getTime())
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  const groups: DayGroup<T>[] = [];
  for (const slot of upcoming) {
    const dayKey = dayKeyOf(slot.startsAt);
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.dayKey === dayKey) {
      lastGroup.slots.push(slot);
    } else {
      groups.push({ dayKey, dayLabel: formatDayLabelNl(slot.startsAt), slots: [slot] });
    }
  }
  return groups;
}
