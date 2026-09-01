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

/**
 * Getemperde, prioriteit-gebonden badgekleuren (licht + donker). Zelfde
 * geest als de bronpalet (A=groen, B=amber, C=oranje, D/N=grijs, X=rood)
 * maar ontverzadigd voor een rustig, Vercel-achtig oppervlak.
 */
export const PRIORITY_BADGE_CLASSES: Record<Priority, string> = {
  A: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400",
  B: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400",
  C: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-400",
  D: "border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400",
  N: "border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-500",
  X: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400",
};
