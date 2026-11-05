// Plan 319 (Plan 203-350) — Per-mohalla year comparison view.
//
// The shop-wide year comparison (Plan 193) shows one total for the
// whole shop, so a mohalla that is shrinking hides inside a growing
// total. This module adds only the missing piece: a read-only
// per-mohalla year comparison — customers, collections, and dues
// outstanding per mohalla per year — composed from yearly figures
// that already exist in the yearly reports.
//
// What this module is NOT, stated plainly:
//   - It is not the shop-wide year comparison (Plan 193). That view
//     already exists and is neither read nor rewritten here; this
//     view breaks the same years down by mohalla and never replaces
//     the shop-wide view.
//   - It is not the monthly KPI record sheet (Plan 318). That sheet
//     records one month at a time; this view compares whole years
//     per mohalla and records no month.
//   - It is not a seasonal comparison (Plan 320). Seasons and
//     quarters belong to that later plan, not to this one.
//   - It is not a new yearly figure. Every figure in a record is a
//     copy of a figure that already exists in a yearly report; the
//     module creates no new measure and computes no figure to stand
//     in for a missing one.
//   - It is not a bill, payment, or customer change. Composing the
//     view never changes any bill, payment, or customer record: the
//     view only reads the figures its caller supplies.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every figure,
//     and the module never reads storage, the clock, or the network,
//     and never mutates an input.
//   - A figure is accepted only as a whole number of at least zero
//     — whole rupees for money figures, whole counts for customers.
//     A figure written as "Rs 1800", a negative, or a fraction is
//     refused, never repaired.
//   - A mohalla with no figure for a year says so plainly: that
//     cell reads "No figure for this year", and the view lists the
//     mohalla and year among its missing figures instead of filling
//     the gap by guesswork.
//   - Per-mohalla figures reconcile against the shop-wide yearly
//     figure on the same fixture: the view sums the mohalla figures
//     for a year and reports every year where the sum does not equal
//     the shop-wide figure, naming the figure and both numbers.

/**
 * The three figures in every yearly record, in view order. Money
 * figures are whole rupees; customers is a whole count.
 */
export const MOHALLA_YEAR_FIGURES = [
  { key: 'customers', label: 'Customers', unit: 'customers' },
  { key: 'collections', label: 'Collections', unit: 'PKR' },
  { key: 'dues', label: 'Dues outstanding', unit: 'PKR' },
];

const FIGURE_KEYS = MOHALLA_YEAR_FIGURES.map((figure) => figure.key);

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/** A year is a whole calendar year, 1900-2100, given as a number or a plain digit string. */
export function validMohallaYearComparisonYear(value) {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 1900 && value <= 2100 ? value : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) return null;
    const year = Number(trimmed);
    return year >= 1900 && year <= 2100 ? year : null;
  }
  return null;
}

/**
 * One figure value: a whole number of at least zero, given as an
 * integer or a plain digit string. A blank or missing value reads
 * as null, meaning that yearly report was not available — it is
 * never filled by guesswork. Anything else (a negative, a
 * fraction, a "Rs 1800"-style string, or any other text) is
 * invalid and reads as undefined, so the caller can refuse it.
 */
export function normalizeMohallaYearFigure(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 0 ? value : undefined;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    return /^\d+$/.test(trimmed) ? Number(trimmed) : undefined;
  }
  return undefined;
}

/** The figure definition for one key, or null for an unknown key. */
export function mohallaYearFigureDef(key) {
  return MOHALLA_YEAR_FIGURES.find((figure) => figure.key === key) ?? null;
}

function normalizeFigures(source) {
  const raw = source && typeof source === 'object' ? source : {};
  const figures = {};
  let present = 0;
  for (const key of FIGURE_KEYS) {
    const value = normalizeMohallaYearFigure(raw[key]);
    if (value === undefined) return null;
    figures[key] = value;
    if (value !== null) present += 1;
  }
  return { figures, present };
}

/**
 * One per-mohalla yearly figure record reduced to its stored shape
 * — id, mohalla, year, and the three figures (a whole number, or
 * null when that yearly report was missing) — or null when the
 * record is refused: no id, no mohalla, no valid year, every figure
 * missing, or any figure invalid. Unknown fields are dropped, so a
 * record can never grow a bill, payment, or customer field.
 */
export function normalizeMohallaYearFigureRecord(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const mohalla = text(raw.mohalla);
  const year = validMohallaYearComparisonYear(raw.year);
  if (!id || !mohalla || year === null) return null;
  const checked = normalizeFigures(raw.figures);
  if (!checked || checked.present === 0) return null;
  return { id, mohalla, year, figures: checked.figures };
}

/** A list of per-mohalla yearly figure records reduced to stored shape; refused records are dropped, never repaired. */
export function normalizeMohallaYearFigureRecordList(list) {
  if (!Array.isArray(list)) return [];
  const clean = [];
  for (const raw of list) {
    const record = normalizeMohallaYearFigureRecord(raw);
    if (!record) continue;
    if (clean.some((kept) => kept.id === record.id)) continue;
    if (clean.some((kept) => kept.mohalla === record.mohalla && kept.year === record.year)) continue;
    clean.push(record);
  }
  return clean;
}

/** The record for one mohalla in one year, or null when none is recorded. */
export function findMohallaYearFigureRecord(list, mohalla, year) {
  const clean = normalizeMohallaYearFigureRecordList(list);
  const wantedYear = validMohallaYearComparisonYear(year);
  if (!text(mohalla) || wantedYear === null) return null;
  return clean.find((record) => record.mohalla === text(mohalla) && record.year === wantedYear) ?? null;
}

/**
 * Record one per-mohalla yearly figure. Returns the new list, or
 * the unchanged list when the record is refused or a record for the
 * same mohalla and year is already recorded — the first record stays.
 */
export function recordMohallaYearFigure(list, record) {
  const clean = normalizeMohallaYearFigureRecordList(list);
  const next = normalizeMohallaYearFigureRecord(record);
  if (!next) return clean;
  if (clean.some((kept) => kept.id === next.id)) return clean;
  if (clean.some((kept) => kept.mohalla === next.mohalla && kept.year === next.year)) return clean;
  return [...clean, next];
}

/** Remove one per-mohalla yearly figure record by id; other records are untouched. */
export function removeMohallaYearFigure(list, id) {
  const clean = normalizeMohallaYearFigureRecordList(list);
  return clean.filter((record) => record.id !== text(id));
}

/** Mohalla names with a recorded figure, in first-seen order. */
export function mohallaYearFigureMohallas(list) {
  const clean = normalizeMohallaYearFigureRecordList(list);
  const names = [];
  for (const record of clean) {
    if (!names.includes(record.mohalla)) names.push(record.mohalla);
  }
  return names;
}

/** Years with a recorded per-mohalla figure, earliest first. */
export function mohallaYearFigureYears(list) {
  const clean = normalizeMohallaYearFigureRecordList(list);
  const years = [];
  for (const record of clean) {
    if (!years.includes(record.year)) years.push(record.year);
  }
  return years.sort((a, b) => a - b);
}

/**
 * One shop-wide yearly figure reduced to its stored shape — year
 * and the three figures — or null when it is refused: no valid
 * year, every figure missing, or any figure invalid. A shop-wide
 * figure is a copy of the figure in the shop-wide yearly report;
 * it is never computed from the mohalla figures.
 */
export function normalizeShopWideYearFigure(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const year = validMohallaYearComparisonYear(raw.year);
  if (year === null) return null;
  const checked = normalizeFigures(raw.figures);
  if (!checked || checked.present === 0) return null;
  return { year, figures: checked.figures };
}

/** A list of shop-wide yearly figures reduced to stored shape; refused figures are dropped, never repaired. */
export function normalizeShopWideYearFigureList(list) {
  if (!Array.isArray(list)) return [];
  const clean = [];
  for (const raw of list) {
    const figure = normalizeShopWideYearFigure(raw);
    if (!figure) continue;
    if (clean.some((kept) => kept.year === figure.year)) continue;
    clean.push(figure);
  }
  return clean;
}

/**
 * Record one shop-wide yearly figure. Returns the new list, or the
 * unchanged list when the figure is refused or a figure for the
 * same year is already recorded — the first figure stays.
 */
export function recordShopWideYearFigure(list, figure) {
  const clean = normalizeShopWideYearFigureList(list);
  const next = normalizeShopWideYearFigure(figure);
  if (!next) return clean;
  if (clean.some((kept) => kept.year === next.year)) return clean;
  return [...clean, next];
}

/** Remove one shop-wide yearly figure by year; other years are untouched. */
export function removeShopWideYearFigure(list, year) {
  const clean = normalizeShopWideYearFigureList(list);
  const wantedYear = validMohallaYearComparisonYear(year);
  if (wantedYear === null) return clean;
  return clean.filter((figure) => figure.year !== wantedYear);
}

function emptyFigures() {
  const figures = {};
  for (const key of FIGURE_KEYS) figures[key] = null;
  return figures;
}

function sumFigures(records, year) {
  const figures = emptyFigures();
  for (const key of FIGURE_KEYS) {
    let total = 0;
    let seen = false;
    for (const record of records) {
      if (record.year !== year) continue;
      const value = record.figures[key];
      if (value !== null) {
        total += value;
        seen = true;
      }
    }
    figures[key] = seen ? total : null;
  }
  return figures;
}

/**
 * Compose the read-only per-mohalla year comparison from the
 * caller-supplied figures: per-mohalla yearly figure records and
 * shop-wide yearly figures. The inputs are never mutated — every
 * figure is copied through normalisation first. The view carries
 * the sorted years, the mohalla names, the shop-wide figures, the
 * per-mohalla figures (null where a mohalla has no figure for a
 * year), the per-year sums of the mohalla figures, whether each
 * year reconciles with its shop-wide figure, and the list of
 * mohalla-and-year pairs with no figure at all.
 */
export function buildMohallaYearComparison(perMohallaList, shopWideList) {
  const perMohalla = normalizeMohallaYearFigureRecordList(perMohallaList);
  const shopWide = normalizeShopWideYearFigureList(shopWideList);
  const yearSet = new Set();
  for (const record of perMohalla) yearSet.add(record.year);
  for (const figure of shopWide) yearSet.add(figure.year);
  const years = [...yearSet].sort((a, b) => a - b);
  const mohallas = mohallaYearFigureMohallas(perMohalla);
  const shopWideByYear = {};
  for (const figure of shopWide) shopWideByYear[figure.year] = { ...figure.figures };
  const figuresByMohalla = {};
  for (const mohalla of mohallas) {
    figuresByMohalla[mohalla] = {};
    for (const year of years) {
      const record = perMohalla.find((item) => item.mohalla === mohalla && item.year === year);
      figuresByMohalla[mohalla][year] = record ? { ...record.figures } : emptyFigures();
    }
  }
  const totals = {};
  const reconciles = {};
  for (const year of years) {
    totals[year] = sumFigures(perMohalla, year);
    const wide = shopWideByYear[year];
    if (!wide) {
      reconciles[year] = false;
      continue;
    }
    reconciles[year] = FIGURE_KEYS.every((key) => {
      if (wide[key] === null || totals[year][key] === null) return wide[key] === totals[year][key];
      return wide[key] === totals[year][key];
    });
  }
  const missing = [];
  for (const mohalla of mohallas) {
    for (const year of years) {
      const figures = figuresByMohalla[mohalla][year];
      if (FIGURE_KEYS.every((key) => figures[key] === null)) {
        missing.push({ mohalla, year });
      }
    }
  }
  return { years, mohallas, shopWide: shopWideByYear, perMohalla: figuresByMohalla, totals, reconciles, missing };
}

/** The years in a composed view, earliest first. */
export function mohallaYearComparisonYears(view) {
  if (!view || !Array.isArray(view.years)) return [];
  return [...view.years].sort((a, b) => a - b);
}

/** The mohalla names in a composed view, in first-seen order. */
export function mohallaYearComparisonMohallas(view) {
  if (!view || !Array.isArray(view.mohallas)) return [];
  return [...view.mohallas];
}

/** Mohalla-and-year pairs with no figure at all, in view order. */
export function mohallaYearComparisonMissing(view) {
  if (!view || !Array.isArray(view.missing)) return [];
  return view.missing.map((entry) => ({ mohalla: entry.mohalla, year: entry.year }));
}

/**
 * Years where the mohalla figures do not sum to the shop-wide
 * figure, naming the figure and both numbers on each mismatch. A
 * year with no shop-wide figure at all is listed with a plain
 * "no shop-wide figure" note instead of a number comparison.
 */
export function mohallaYearComparisonMismatches(view) {
  if (!view || !Array.isArray(view.years)) return [];
  const mismatches = [];
  for (const year of view.years) {
    const wide = view.shopWide ? view.shopWide[year] : undefined;
    if (!wide) {
      mismatches.push({ year, figure: null, shopWide: null, summed: null, note: 'No shop-wide figure for this year' });
      continue;
    }
    for (const figure of MOHALLA_YEAR_FIGURES) {
      const summed = view.totals ? view.totals[year]?.[figure.key] ?? null : null;
      if (wide[figure.key] === null && summed === null) continue;
      if (wide[figure.key] !== summed) {
        mismatches.push({ year, figure: figure.key, shopWide: wide[figure.key], summed });
      }
    }
  }
  return mismatches;
}

/**
 * The change in one figure for one mohalla between one year and
 * the year before it — { from, to, change } in whole numbers — or
 * null when either year has no figure for that mohalla, so a missing
 * year never produces a guessed change.
 */
export function mohallaYearComparisonChange(view, mohalla, figureKey, year) {
  if (!view || !view.perMohalla || !view.perMohalla[mohalla]) return null;
  if (!FIGURE_KEYS.includes(figureKey)) return null;
  const wantedYear = validMohallaYearComparisonYear(year);
  if (wantedYear === null) return null;
  const years = mohallaYearComparisonYears(view);
  const index = years.indexOf(wantedYear);
  if (index <= 0) return null;
  const previousYear = years[index - 1];
  const from = view.perMohalla[mohalla][previousYear]?.[figureKey] ?? null;
  const to = view.perMohalla[mohalla][wantedYear]?.[figureKey] ?? null;
  if (from === null || to === null) return null;
  return { from, to, change: to - from };
}

/** One figure shown in plain words, or the plain "no figure" line when it is missing. */
export function mohallaYearFigureText(figureKey, value) {
  const def = mohallaYearFigureDef(figureKey);
  if (!def) return 'No figure for this year';
  if (value === null || value === undefined) return 'No figure for this year';
  return def.unit === 'PKR' ? `Rs ${value}` : `${value} ${def.unit}`;
}

/** Plain-words summary of a composed view: years, mohallas, reconciliation, and missing figures. */
export function mohallaYearComparisonSummaryText(view) {
  if (!view || !Array.isArray(view.years) || view.years.length === 0) {
    return 'No per-mohalla year comparison: no yearly figures recorded.';
  }
  const years = mohallaYearComparisonYears(view);
  const reconciled = years.filter((year) => view.reconciles?.[year]);
  const missing = mohallaYearComparisonMissing(view);
  const parts = [
    `${view.mohallas.length} mohalla${view.mohallas.length === 1 ? '' : 's'} compared across ${years.length} year${years.length === 1 ? '' : 's'} (${years.join(', ')}).`,
    reconciled.length === years.length
      ? 'Every year reconciles: the mohalla figures sum exactly to the shop-wide yearly figure.'
      : `${reconciled.length} of ${years.length} years reconcile with the shop-wide yearly figure.`,
  ];
  if (missing.length > 0) {
    parts.push(`${missing.length} mohalla-year ${missing.length === 1 ? 'pair' : 'pairs'} with no figure: ${missing.map((entry) => `${entry.mohalla} ${entry.year}`).join(', ')}.`);
  }
  return parts.join(' ');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** One mohalla as a table: one row per year, one column per figure, with the change from the previous year shown beside each figure. */
export function mohallaYearComparisonForMohallaHtml(view, mohalla) {
  if (!view || !view.perMohalla || !view.perMohalla[mohalla]) return '<p>No figure for this mohalla.</p>';
  const years = mohallaYearComparisonYears(view);
  const rows = years.map((year) => {
    const figures = view.perMohalla[mohalla][year] ?? emptyFigures();
    const cells = MOHALLA_YEAR_FIGURES.map((figure) => {
      const value = figures[figure.key];
      const shown = mohallaYearFigureText(figure.key, value);
      const change = mohallaYearComparisonChange(view, mohalla, figure.key, year);
      const changeText = change === null ? '' : ` (${change.change >= 0 ? '+' : ''}${change.change})`;
      return `<td>${escapeHtml(shown)}${escapeHtml(changeText)}</td>`;
    }).join('');
    return `<tr><td>${escapeHtml(String(year))}</td>${cells}</tr>`;
  }).join('');
  const header = MOHALLA_YEAR_FIGURES.map((figure) => `<th>${escapeHtml(figure.label)}</th>`).join('');
  return `<h4>${escapeHtml(mohalla)}</h4>`
    + `<table class="audit-log-table"><thead><tr><th>Year</th>${header}</tr></thead><tbody>${rows}</tbody></table>`;
}

/** The whole comparison: every mohalla in turn, with a reconciliation line per year. */
export function mohallaYearComparisonAllHtml(view) {
  if (!view || !Array.isArray(view.mohallas) || view.mohallas.length === 0) {
    return '<p>No per-mohalla yearly figures recorded.</p>';
  }
  const lines = mohallaYearComparisonYears(view).map((year) => {
    const wide = view.shopWide?.[year];
    if (!wide) return `${year}: no shop-wide figure recorded, so this year cannot be reconciled`;
    return view.reconciles?.[year]
      ? `${year}: mohalla figures sum exactly to the shop-wide yearly figure`
      : `${year}: mohalla figures do not sum to the shop-wide yearly figure — see the mismatches below`;
  }).join('; ');
  const mismatchRows = mohallaYearComparisonMismatches(view)
    .filter((entry) => entry.figure !== null)
    .map((entry) => `<p>${escapeHtml(String(entry.year))} — ${escapeHtml(mohallaYearFigureDef(entry.figure)?.label ?? entry.figure)}: shop-wide ${escapeHtml(mohallaYearFigureText(entry.figure, entry.shopWide))}, mohalla figures sum to ${escapeHtml(mohallaYearFigureText(entry.figure, entry.summed))}.</p>`)
    .join('');
  return `<p>${escapeHtml(lines)}.</p>`
    + view.mohallas.map((mohalla) => mohallaYearComparisonForMohallaHtml(view, mohalla)).join('')
    + mismatchRows;
}

function csvCell(value) {
  const cell = String(value ?? '');
  return /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

/** The whole comparison as CSV: one row per mohalla per year per figure, with the shop-wide figure and the summed figure beside it. */
export function mohallaYearComparisonCsv(view) {
  const lines = ['mohalla,year,figure,value,shop_wide_value,mohalla_sum,reconciles'];
  if (!view || !Array.isArray(view.mohallas)) return lines.join('\n');
  for (const mohalla of view.mohallas) {
    for (const year of mohallaYearComparisonYears(view)) {
      for (const figure of MOHALLA_YEAR_FIGURES) {
        const value = view.perMohalla?.[mohalla]?.[year]?.[figure.key] ?? null;
        const wide = view.shopWide?.[year]?.[figure.key] ?? null;
        const summed = view.totals?.[year]?.[figure.key] ?? null;
        lines.push([mohalla, year, figure.label, value === null ? '' : value, wide === null ? '' : wide, summed === null ? '' : summed, view.reconciles?.[year] ? 'yes' : 'no'].map(csvCell).join(','));
      }
    }
  }
  return lines.join('\n');
}

/** Fixed filename for the per-mohalla year comparison CSV. */
export function mohallaYearComparisonFilename() {
  return 'mohalla-year-comparison.csv';
}
