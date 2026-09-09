/**
 * Gedeelde NL-formatters voor cijfers/datums (Intl-wrappers + de
 * "relatieve tijd"-logica). Eerst geleefd in `kpi-dashboard.tsx`; hierheen
 * verhuisd zodat het Klanten-dashboard (`/klanten`) exact dezelfde
 * weergave gebruikt i.p.v. een tweede, licht afwijkende kopie.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const numberFormatter = new Intl.NumberFormat("nl-BE");
const decimalFormatter = new Intl.NumberFormat("nl-BE", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const currencyFormatter = new Intl.NumberFormat("nl-BE", {
  style: "currency",
  currency: "EUR",
});
const currencyCompactFormatter = new Intl.NumberFormat("nl-BE", {
  style: "currency",
  currency: "EUR",
  notation: "compact",
  maximumFractionDigits: 1,
});
const dateTimeFormatter = new Intl.DateTimeFormat("nl-BE", {
  dateStyle: "medium",
  timeStyle: "short",
});
const dateShortFormatter = new Intl.DateTimeFormat("nl-BE", {
  day: "numeric",
  month: "short",
});

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** dd-mm-jjjj, in de lokale tijdzone van de gebruiker. */
function formatDdMmYyyy(date: Date): string {
  return `${pad2(date.getDate())}-${pad2(date.getMonth() + 1)}-${date.getFullYear()}`;
}

export function formatInt(value: number): string {
  return numberFormatter.format(value);
}

export function formatDecimal(value: number): string {
  return decimalFormatter.format(value);
}

export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

/** Compacte euro-notatie voor grafiek-astekst (bv. "€1,2K"). */
export function formatCurrencyCompact(value: number): string {
  return currencyCompactFormatter.format(value);
}

export function formatDateTimeNl(date: Date): string {
  return dateTimeFormatter.format(date);
}

/** Korte NL-datum voor grafiek-assen, bv. "3 aug". */
export function formatDateShortNl(date: Date): string {
  return dateShortFormatter.format(date);
}

export function formatRelativeNl(isoDate: string | null, now: Date): string {
  if (!isoDate) return "Nooit actief geweest";

  const date = new Date(isoDate);
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const diffDays = Math.round(diffMs / DAY_MS);

  if (diffMinutes < 1) return "Zojuist";
  if (diffMinutes < 60) return `${diffMinutes} min geleden`;
  if (diffHours < 24) return `${diffHours} uur geleden`;
  if (diffDays === 1) return "Gisteren";
  if (diffDays < 30) return `${diffDays} dagen geleden`;

  const diffMonths = Math.round(diffDays / 30);
  if (diffMonths < 12) {
    return `${diffMonths} ${diffMonths === 1 ? "maand" : "maanden"} geleden`;
  }

  const diffYears = Math.round(diffDays / 365);
  return `${diffYears} jaar geleden`;
}

/**
 * Compacte relatieve tijd voor de "Laatste activiteit"-kolom
 * (prospectenlijst): "zojuist" / "X min geleden" / "X u geleden" /
 * "X d geleden" tot en met 30 dagen, daarna de absolute datum (dd-mm-jjjj).
 * Bewust een apart, korter format dan `formatRelativeNl` (die "Nooit actief
 * geweest" en het volledige "uur"/"dagen" gebruikt voor het KPI-dashboard en
 * de klantenkaart) — geen gedeelde functie om die bestaande weergaves niet
 * te wijzigen.
 */
export function formatLastActivityNl(date: Date | null, now: Date): string {
  if (!date) return "—";

  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / DAY_MS);

  if (diffMinutes < 1) return "zojuist";
  if (diffMinutes < 60) return `${diffMinutes} min geleden`;
  if (diffHours < 24) return `${diffHours} u geleden`;
  if (diffDays <= 30) return `${diffDays} d geleden`;

  return formatDdMmYyyy(date);
}
