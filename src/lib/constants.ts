export const CALL_STATUSES = [
  "",
  "gebeld-geen-gehoor",
  "gesproken-interesse",
  "gesproken-geen-interesse",
  "afspraak-gepland",
  "demo-gegeven",
  "klant",
  "niet-benaderen",
] as const;
export type CallStatus = (typeof CALL_STATUSES)[number];

export const CALL_STATUS_LABELS: Record<CallStatus, string> = {
  "": "—",
  "gebeld-geen-gehoor": "Gebeld – geen gehoor",
  "gesproken-interesse": "Gesproken – interesse",
  "gesproken-geen-interesse": "Gesproken – geen interesse",
  "afspraak-gepland": "Afspraak gepland",
  "demo-gegeven": "Demo gegeven",
  klant: "Klant",
  "niet-benaderen": "Niet benaderen",
};

export const PRIORITIES = ["A", "B", "C", "D", "N", "X"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_LABELS: Record<Priority, string> = {
  A: "A – bel deze week",
  B: "B – deze maand",
  C: "C – tweede ronde",
  D: "D – laag / onvolledig",
  N: "N – geen stal",
  X: "X – niet benaderen",
};
