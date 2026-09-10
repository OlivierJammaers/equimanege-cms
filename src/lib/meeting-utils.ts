/**
 * Pure helpers voor de meeting-agenda-feature. Los van DB/server-code
 * gehouden zodat ze zonder runtime unit-testbaar zijn — zelfde patroon als
 * `format-nl.ts`.
 *
 * Belangrijk: de server draait op Vercel in UTC. Elke datum/tijd die de
 * admin of sales ziet/invoert is echter een Brussels wall-clock-tijdstip
 * (Europe/Brussels, met DST). `brusselsWallTimeToUtc` zet zo'n wall-clock
 * datum+tijd om naar het echte UTC-instant (voor opslag); `formatTimeRangeNl`
 * / `formatDayLabelNl` doen het omgekeerde voor weergave — beide expliciet
 * met `timeZone: "Europe/Brussels"`, nooit de serverlocale.
 *
 * Model (herbouw 2026-09): de admin publiceert enkel beschikbaarheidsvensters
 * ("van–tot" per dag, GEEN duur). De sales-persoon kiest bij het boeken zelf
 * een starttijd + duur binnen zo'n venster. `freeGaps` berekent welk deel van
 * een venster nog vrij is (na aftrek van al geboekte meetings), `startOptions`
 * rastert die vrije gaten naar bruikbare starttijden voor een gekozen duur.
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
 * admin plant geen beschikbaarheid op 02:00-03:00 op de omschakel-nacht).
 */
export function brusselsWallTimeToUtc(date: string, time: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const naiveUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0);
  const offsetMinutes = brusselsOffsetMinutesAt(new Date(naiveUtcMs));
  return new Date(naiveUtcMs - offsetMinutes * 60_000);
}

export type Interval = { startsAt: Date; endsAt: Date };

export type WindowRangeInput = { from: string; to: string };

/** Bouwt `{startsAt, endsAt}`-vensters uit een datum + lijst van van/tot-reeksen. */
export function windowRangesFromInput(date: string, ranges: WindowRangeInput[]): Interval[] {
  return ranges.map((r) => ({
    startsAt: brusselsWallTimeToUtc(date, r.from),
    endsAt: brusselsWallTimeToUtc(date, r.to),
  }));
}

/** Formatteert een tijdsbereik in Brussels tijdzone, bv. "13:00 – 17:00". */
export function formatTimeRangeNl(startsAt: Date, endsAt: Date): string {
  return `${timeFormatter.format(startsAt)} – ${timeFormatter.format(endsAt)}`;
}

/**
 * Is een meeting "Komend" (nog niet afgelopen) op het gegeven moment?
 * Bepaald door het eindmoment van de meeting, niet het begin — een meeting
 * die al gestart is maar nog niet geëindigd (in uitvoering) telt dus nog als
 * Komend. Gebruikt door de meetings-overzicht (`/meetings`) om
 * Komend/Afgelopen te splitsen.
 */
export function isMeetingUpcoming(endsAt: Date, now: Date): boolean {
  return endsAt.getTime() >= now.getTime();
}

/** Formatteert een NL-daglabel in Brussels tijdzone, bv. "woensdag 17 september". */
export function formatDayLabelNl(date: Date): string {
  return dayLabelFormatter.format(date);
}

/** Sleutel voor dag-groepering in Brussels tijdzone, bv. "2026-09-17". */
function dayKeyOf(date: Date): string {
  return dayKeyFormatter.format(date);
}

export type DayGroup<T> = {
  dayKey: string;
  dayLabel: string;
  slots: T[];
};

/**
 * Groepeert beschikbaarheidsvensters (of gelijkaardige `{startsAt, endsAt}`
 * items) per dag (Brussels tijdzone), gesorteerd oplopend op starttijd. Sluit
 * al afgelopen items uit (`endsAt < now`) — een nog lopend venster (gestart
 * maar niet geëindigd) blijft dus wél zichtbaar.
 */
export function groupWindowsByDay<T extends Interval>(items: T[], now: Date): DayGroup<T>[] {
  const upcoming = items
    .filter((item) => item.endsAt.getTime() >= now.getTime())
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  const groups: DayGroup<T>[] = [];
  for (const item of upcoming) {
    const dayKey = dayKeyOf(item.startsAt);
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.dayKey === dayKey) {
      lastGroup.slots.push(item);
    } else {
      groups.push({ dayKey, dayLabel: formatDayLabelNl(item.startsAt), slots: [item] });
    }
  }
  return groups;
}

/**
 * Berekent de vrije stukken van een beschikbaarheidsvenster na aftrek van
 * de al geboekte meetings erbinnen. De meetings hoeven niet gesorteerd te
 * zijn; overlappende/aaneensluitende meetings worden correct samengevoegd
 * (geen gat tussen twee aaneensluitende boekingen).
 */
export function freeGaps(window: Interval, meetings: Interval[]): Interval[] {
  const sorted = [...meetings].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  const gaps: Interval[] = [];
  let cursor = window.startsAt;
  for (const meeting of sorted) {
    if (meeting.startsAt.getTime() > cursor.getTime()) {
      gaps.push({ startsAt: cursor, endsAt: meeting.startsAt });
    }
    if (meeting.endsAt.getTime() > cursor.getTime()) {
      cursor = meeting.endsAt;
    }
  }
  if (cursor.getTime() < window.endsAt.getTime()) {
    gaps.push({ startsAt: cursor, endsAt: window.endsAt });
  }
  return gaps;
}

/**
 * Zet vrije gaten om naar bruikbare starttijden voor een gekozen duur: elke
 * optie ligt op een `stepMinutes`-raster uitgelijnd op het begin van haar
 * eigen gat (niet op een globale klok-raster), en start+duur past volledig
 * binnen dat gat.
 */
export function startOptions(gaps: Interval[], durationMinutes: number, stepMinutes = 30): Date[] {
  const stepMs = stepMinutes * 60_000;
  const durationMs = durationMinutes * 60_000;

  const options: Date[] = [];
  for (const gap of gaps) {
    let start = gap.startsAt.getTime();
    const gapEnd = gap.endsAt.getTime();
    while (start + durationMs <= gapEnd) {
      options.push(new Date(start));
      start += stepMs;
    }
  }
  return options;
}
