// Plan 27 (Plan 1-100) — Mohalla coverage register: premises passed
// versus connected.
//
// The owner knows how many customers exist but not how many households
// each mohalla could still yield, so growth effort is aimed by
// guesswork. This register is a planning record only: per mohalla, an
// operator-entered estimate of premises passed (with the date and basis
// noted), the active customers in that mohalla, and a take-up rate
// derived from exactly those two figures. It is not a billing view and
// not an area-dues view — Plan T keeps area operations, and nothing
// here reads or writes any bill, payment, or area-dues record.
//
// What this module NEVER does, stated plainly:
//   - it never invents a premises figure. A mohalla with no recorded
//     estimate shows as "not surveyed", never as zero, and its take-up
//     rate is unknown (null), never 0% and never 100% by default;
//   - it never drops a customer. Customers with no mohalla appear in an
//     "Unassigned" row, and customers in a mohalla with no estimate
//     still count toward that mohalla's active total;
//   - it never rewrites history. Editing a premises estimate moves the
//     old figure — with its date and basis — into that mohalla's
//     history, so the previous survey is still visible;
//   - it never changes a customer, billing, or lifecycle record. The
//     estimates live in a caller-owned list apart from every ledger
//     record by construction.
//
// Addressing rule (the Plan T canonical rule, mirrored here so this
// module stays import-free, as Plan 14 does):
//   - the leading generic "Mohalla"/"Mohalaa" word is not part of a
//     mohalla's identity and is stripped before comparing;
//   - comparison is case-insensitive after NFKC normalisation;
//   - known spellings collapse: bani -> BANII, kishti -> KISHTII,
//     chamyaa -> CHAMYAAA, and every name in DEFAULT_MOHALLAS
//     resolves to its stored spelling;
//   - an unknown name keeps its own key and readable label, so it is
//     addressed as written, never dropped.
//
// The module is import-free by design (like pre-due-reminders.js,
// escalation-ladder.js and payment-confirmation.js): the caller supplies
// every customer, every estimate, and every date, and the module never
// reads storage, the clock, or the network.

const DEFAULT_MOHALLAS = Object.freeze([
  'CHARYAA', 'GANGALL', 'KISHTII', 'BARRIAN', 'THALII', 'CHAMYAAA',
  'PALALIYAA', 'MALLA', 'NAKAR', 'BANII', 'SODAA', 'PULL SIDE',
  'JABBIYAA', 'MOHALLA CHUDRIYAA', 'MOHALLA end side farm house',
]);

const MOHALLA_ALIASES = Object.freeze({
  bani: 'BANII',
  kishti: 'KISHTII',
  chamyaa: 'CHAMYAAA',
  // Owner-confirmed 2026-11-11: JABBIYAAA is the same mohalla as
  // JABBIYAA. Charyaa is NOT an alias — it is its own mohalla.
  jabbiyaaa: 'JABBIYAA',
});

export const COVERAGE_UNASSIGNED_KEY = '__unassigned__';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizedText(value) {
  return String(value ?? '').normalize('NFKC').replace(/\s+/gu, ' ').trim();
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function comparisonKey(value) {
  return normalizedText(value).toLowerCase().normalize('NFKC');
}

function stripMohallaPrefix(value) {
  const stripped = normalizedText(value).replace(/^(?:mohalla|mohalaa)\s+/iu, '');
  return stripped || normalizedText(value);
}

function readableLabel(value) {
  const readableWord = (word) => {
    const letters = word.match(/\p{L}/gu) ?? [];
    if (letters.length >= 2 && letters.length <= 3 && letters.every((letter) => letter === letter.toLocaleUpperCase('en-US'))) return word;
    const chars = Array.from(word);
    if (!chars.length) return word;
    return chars[0].toLocaleUpperCase('en-US') + chars.slice(1).join('').toLocaleLowerCase('en-US');
  };
  return normalizedText(value).split(' ').map((word) => word.split(/([-–—/])/u).map((part) => /^[-–—/]$/u.test(part) ? part : readableWord(part)).join('')).join(' ');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function csvCell(value) {
  const cell = String(value ?? '');
  return /[",\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell;
}

// Mirrors phase3.js canonicalMohalla without importing the app graph.
// Returns { key, label, stored } or null when blank.
export function canonicalCoverageMohalla(value) {
  const raw = normalizedText(value);
  if (!raw) return null;
  const stripped = stripMohallaPrefix(raw);
  const key = comparisonKey(stripped);
  const canonical = DEFAULT_MOHALLAS.find((name) => comparisonKey(stripMohallaPrefix(name)) === key) ?? MOHALLA_ALIASES[key];
  if (canonical) return { key: comparisonKey(stripMohallaPrefix(canonical)), label: readableLabel(canonical), stored: canonical };
  return { key, label: readableLabel(stripped), stored: raw };
}

// A real calendar date (YYYY-MM-DD), or null. 2026-02-30 is rejected:
// the Date round-trip must reproduce the input exactly.
export function normalizeCoverageDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value.trim())) return null;
  const date = new Date(`${value.trim()}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10) === value.trim() ? value.trim() : null;
}

// One premises estimate, normalised. A premises figure must be a whole
// number of at least 1: zero, negative, fractional and non-numeric
// figures are rejected (null), never stored as a silent zero, because a
// stored zero would make every take-up rate divide by zero. The date
// and basis are noted when supplied and valid; a missing date is null
// ("date not recorded" in the view), never guessed, and a missing basis
// is an empty string. History entries keep the same shape.
export function normalizeCoverageEstimate(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const canon = canonicalCoverageMohalla(raw.mohalla ?? raw.label ?? raw.key ?? '');
  if (!canon) return null;
  const premises = Number(raw.premises);
  if (!Number.isFinite(premises) || !Number.isInteger(premises) || premises < 1) return null;
  const history = Array.isArray(raw.history) ? raw.history.map((entry) => {
    if (!entry || typeof entry !== 'object') return null;
    const p = Number(entry.premises);
    if (!Number.isFinite(p) || !Number.isInteger(p) || p < 1) return null;
    return { premises: p, date: normalizeCoverageDate(entry.date), basis: text(entry.basis) };
  }).filter(Boolean) : [];
  return {
    key: canon.key,
    label: canon.label,
    stored: canon.stored,
    premises,
    date: normalizeCoverageDate(raw.date),
    basis: text(raw.basis),
    history,
  };
}

// Estimates, deduplicated by canonical mohalla key: the last row per
// mohalla wins, sorted label A–Z, inputs never mutated.
export function normalizeCoverageEstimates(estimates) {
  const byKey = new Map();
  for (const raw of Array.isArray(estimates) ? estimates : []) {
    const entry = normalizeCoverageEstimate(raw);
    if (entry) byKey.set(entry.key, entry);
  }
  return [...byKey.values()].sort((a, b) => (a.label < b.label ? -1 : a.label > b.label ? 1 : a.key < b.key ? -1 : 1));
}

export function findCoverageEstimate(estimates, mohalla) {
  const canon = canonicalCoverageMohalla(mohalla ?? '');
  if (!canon) return null;
  return normalizeCoverageEstimates(estimates).find((entry) => entry.key === canon.key) ?? null;
}

// Upsert one estimate into a caller-owned list, returning a new list.
// When the mohalla already has an estimate and the new figure differs,
// the old figure — with its date and basis — is appended to history
// before replacement, so the previous survey stays visible. Re-saving
// the identical figure is a no-op: no duplicate history entry is made.
// Inputs are never mutated.
export function upsertCoverageEstimate(estimates, entry) {
  const next = normalizeCoverageEstimate(entry);
  if (!next) return normalizeCoverageEstimates(estimates);
  const list = normalizeCoverageEstimates(estimates);
  const index = list.findIndex((row) => row.key === next.key);
  if (index === -1) {
    return [...list, next].sort((a, b) => (a.label < b.label ? -1 : a.label > b.label ? 1 : a.key < b.key ? -1 : 1));
  }
  const current = list[index];
  if (current.premises === next.premises) return list;
  const replaced = {
    ...next,
    history: [...current.history, { premises: current.premises, date: current.date, basis: current.basis }],
  };
  const out = [...list];
  out[index] = replaced;
  return out;
}

// The coverage register itself. Active customers are the caller-supplied
// customers with archived falsy — the same active roster the Plan 17
// register and Plan 26 forecast use — grouped by canonical mohalla.
// A mohalla with an estimate but no customers still appears (surveyed,
// 0 active, 0% take-up); a mohalla with customers but no estimate
// appears as "not surveyed" with a null take-up rate; customers with no
// mohalla appear in the Unassigned row, never dropped. Take-up is
// active ÷ premises × 100, rounded to one decimal, computed from the
// recorded figures on the same fixture. Remaining premises is premises
// minus active (it can go negative when connections already exceed the
// estimate — that is the honest signal, not an error to hide).
export function buildCoverageRegister({ customers, estimates } = {}) {
  const estimateList = normalizeCoverageEstimates(estimates);
  const byKey = new Map();
  const addRow = (key, label) => {
    if (!byKey.has(key)) {
      byKey.set(key, {
        key,
        label,
        activeCount: 0,
        premises: null,
        date: null,
        basis: '',
        history: [],
        surveyed: false,
        takeUpPercent: null,
        remainingPremises: null,
      });
    }
    return byKey.get(key);
  };
  for (const estimate of estimateList) {
    const row = addRow(estimate.key, estimate.label);
    row.premises = estimate.premises;
    row.date = estimate.date;
    row.basis = estimate.basis;
    row.history = estimate.history;
    row.surveyed = true;
  }
  let totalActive = 0;
  for (const customer of Array.isArray(customers) ? customers : []) {
    if (!customer || customer.archived) continue;
    const canon = canonicalCoverageMohalla(customer.mohalla ?? customer.area ?? '');
    const row = canon
      ? addRow(canon.key, canon.label)
      : addRow(COVERAGE_UNASSIGNED_KEY, 'Unassigned');
    row.activeCount += 1;
    totalActive += 1;
  }
  const rows = [...byKey.values()].map((row) => {
    if (!row.surveyed) return row;
    const takeUpPercent = Math.round((row.activeCount / row.premises) * 1000) / 10;
    return { ...row, takeUpPercent, remainingPremises: row.premises - row.activeCount };
  });
  rows.sort((a, b) => {
    if (a.key === COVERAGE_UNASSIGNED_KEY) return 1;
    if (b.key === COVERAGE_UNASSIGNED_KEY) return -1;
    return a.label < b.label ? -1 : a.label > b.label ? 1 : 0;
  });
  const surveyedRows = rows.filter((row) => row.surveyed);
  const totalPremises = surveyedRows.reduce((sum, row) => sum + row.premises, 0);
  return {
    rows,
    totalActive,
    totalPremises,
    surveyedCount: surveyedRows.length,
    notSurveyedCount: rows.length - surveyedRows.length,
    overallTakeUpPercent: totalPremises > 0
      ? Math.round((surveyedRows.reduce((sum, row) => sum + row.activeCount, 0) / totalPremises) * 1000) / 10
      : null,
  };
}

export function coverageRegisterSummaryText(register) {
  if (!register || !register.rows.length) return 'No mohallas recorded yet.';
  const surveyed = `${register.surveyedCount} surveyed, ${register.notSurveyedCount} not surveyed`;
  const overall = register.overallTakeUpPercent === null
    ? 'overall take-up unknown (no premises surveyed yet)'
    : `overall take-up ${register.overallTakeUpPercent}% across surveyed mohallas`;
  return `${register.rows.length} mohallas · ${register.totalActive} active customers · ${register.totalPremises} premises surveyed · ${surveyed} · ${overall}.`;
}

export function coverageRegisterHtml(register) {
  if (!register || !register.rows.length) return '<p class="empty-state">No mohallas recorded yet. Add a premises estimate to start the register.</p>';
  const rows = register.rows.map((row) => {
    const takeUp = !row.surveyed ? 'Not surveyed' : `${row.takeUpPercent}%`;
    const premises = !row.surveyed ? 'Not surveyed' : String(row.premises);
    const remaining = !row.surveyed ? '—' : String(row.remainingPremises);
    const date = !row.surveyed ? '—' : (row.date ?? 'Date not recorded');
    const basis = !row.surveyed ? '—' : (row.basis || 'No basis noted');
    const history = row.history.length
      ? row.history.map((entry) => `${entry.premises} (${entry.date ?? 'date not recorded'}${entry.basis ? `, ${entry.basis}` : ''})`).join('; ')
      : '—';
    return `<tr><td>${escapeHtml(row.label)}</td><td>${row.activeCount}</td><td>${escapeHtml(premises)}</td><td>${escapeHtml(takeUp)}</td><td>${escapeHtml(remaining)}</td><td>${escapeHtml(date)}</td><td>${escapeHtml(basis)}</td><td>${escapeHtml(history)}</td></tr>`;
  }).join('');
  // Owner 5-part fix: the eight-column table scrolls inside its own
  // card on a phone instead of clipping the right-side columns.
  return `<div class="table-scroll"><table class="data-table"><thead><tr><th>Mohalla</th><th>Active customers</th><th>Premises passed</th><th>Take-up</th><th>Remaining premises</th><th>Survey date</th><th>Basis</th><th>Previous estimates</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

export function coverageRegisterCsv(register) {
  if (!register) return '';
  const header = ['Mohalla', 'Active customers', 'Premises passed', 'Take-up (%)', 'Remaining premises', 'Survey date', 'Basis', 'Previous estimates'].map(csvCell).join(',');
  const lines = register.rows.map((row) => [
    row.label,
    row.activeCount,
    row.surveyed ? row.premises : 'Not surveyed',
    row.surveyed ? row.takeUpPercent : 'Not surveyed',
    row.surveyed ? row.remainingPremises : '',
    row.surveyed ? (row.date ?? 'Date not recorded') : '',
    row.surveyed ? row.basis : '',
    row.history.map((entry) => `${entry.premises} (${entry.date ?? 'date not recorded'}${entry.basis ? `, ${entry.basis}` : ''})`).join('; '),
  ].map(csvCell).join(','));
  return [header, ...lines].join('\n');
}

export function coverageRegisterFilename() {
  return 'mohalla-coverage-register.csv';
}
