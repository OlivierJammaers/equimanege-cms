/**
 * Pure schaal-helpers voor `time-series-chart.tsx` — geen chart-library,
 * gewone SVG. Alles hier is zuiver (geen DOM/React) zodat het los te
 * unit-testen is (`src/tests/unit/chart-scale.test.ts`).
 */

export type ChartPoint = { date: Date; value: number };

/**
 * Klassiek "nice numbers for graph labels"-algoritme (Heckbert): rondt een
 * bereik af naar 1/2/5 × 10^n, zodat tick-stappen er altijd rond uitzien
 * (nooit 13.37).
 */
function niceNum(range: number, round: boolean): number {
  if (range === 0) return 0;
  const exponent = Math.floor(Math.log10(range));
  const fraction = range / 10 ** exponent;
  let niceFraction: number;

  if (round) {
    if (fraction < 1.5) niceFraction = 1;
    else if (fraction < 3) niceFraction = 2;
    else if (fraction < 7) niceFraction = 5;
    else niceFraction = 10;
  } else {
    if (fraction <= 1) niceFraction = 1;
    else if (fraction <= 2) niceFraction = 2;
    else if (fraction <= 5) niceFraction = 5;
    else niceFraction = 10;
  }

  return niceFraction * 10 ** exponent;
}

// Ruimt floating-point-restjes op (0.1 + 0.2 → 0.30000000000000004).
function roundTick(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/**
 * Levert afgeronde tick-waarden die [min, max] dekken (`count` is een
 * richtwaarde, geen harde belofte — het echte aantal volgt uit de nice-stap).
 * Alle databronnen in deze app zijn niet-negatief (ledenaantallen, %, €), dus
 * ticks zakken nooit onder 0 wanneer de invoer dat ook niet doet.
 */
export function niceTicks(min: number, max: number, count = 4): number[] {
  const safeCount = Math.max(2, count);
  let lo = min;
  let hi = max;

  if (lo > hi) {
    [lo, hi] = [hi, lo];
  }

  const inputWasNonNegative = lo >= 0;

  if (lo === hi) {
    // Constante reeks (incl. alles-nul): geef een kleine, zinvolle marge
    // zodat er toch leesbare gridlines zijn i.p.v. één enkele tick.
    hi = lo === 0 ? 1 : lo + Math.abs(lo);
    lo = 0;
  }

  const range = niceNum(hi - lo, false);
  const step = niceNum(range / (safeCount - 1), true);
  let niceMin = Math.floor(lo / step) * step;
  const niceMax = Math.ceil(hi / step) * step;

  if (inputWasNonNegative && niceMin < 0) {
    niceMin = 0;
  }

  const ticks: number[] = [];
  // + step/1e6 vangt floating-point-afrondingen op de bovengrens op.
  for (let v = niceMin; v <= niceMax + step / 1e6; v += step) {
    ticks.push(roundTick(v));
  }
  return ticks;
}

function yFor(value: number, domainMin: number, domainMax: number, height: number): number {
  if (domainMax === domainMin) return height / 2;
  const t = (value - domainMin) / (domainMax - domainMin);
  // SVG-y groeit naar beneden: hoge waarde => kleine y.
  return height - t * height;
}

/**
 * Zet chronologische `{date, value}`-punten om naar SVG-coördinaten binnen
 * `width` × `height`. X is tijdgebaseerd (evenredig met het aantal
 * milliseconden sinds het eerste punt), niet index-gebaseerd — onregelmatige
 * snapshot-intervallen blijven zo correct. Eén punt wordt horizontaal
 * gecentreerd (er is geen bereik om over te verdelen).
 */
export function toPolyline(
  points: ChartPoint[],
  width: number,
  height: number,
  domain: [number, number],
): { x: number; y: number }[] {
  if (points.length === 0) return [];

  const [domainMin, domainMax] = domain;

  if (points.length === 1) {
    return [{ x: width / 2, y: yFor(points[0].value, domainMin, domainMax, height) }];
  }

  const firstMs = points[0].date.getTime();
  const lastMs = points[points.length - 1].date.getTime();
  const span = lastMs - firstMs;

  return points.map((point) => {
    const x = span === 0 ? width / 2 : ((point.date.getTime() - firstMs) / span) * width;
    return { x, y: yFor(point.value, domainMin, domainMax, height) };
  });
}
