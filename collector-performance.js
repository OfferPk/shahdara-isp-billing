// Plan 9 (Plan 1-100) — Collector performance view (visits, promises kept, cash).
//
// READ-ONLY. This module aggregates existing records into one
// per-collector view. It changes no payment, Waada, or commission
// record, and it recalculates nothing:
//
//   * Cash is the verbatim sum of the caller-supplied payment
//     records. Voided payments are skipped, exactly like the
//     existing monthly collector scorecard
//     (buildCollectorScorecards in lineman-scorecard.js) — that
//     scorecard already covers cash + payment count per month, so
//     this module does NOT duplicate it: its new figures are visit
//     coverage, first-attempt collections, and promises
//     made/kept/broken, which no existing view reports.
//   * Commission rules (Plan S / collector-commission.js) are
//     untouched: no commission figure is computed here at all.
//   * A 'paid' or 'partial' visit outcome is a visit note, never
//     money by itself: cash comes only from payment records.
//     Partial counts as a visit done (the collector did attend
//     and take a payment split); the money still comes from the
//     ledger, not from the outcome note.
//   * Promises are classified from the promise record itself:
//     kept when fulfilled (status fulfilled/kept/paid, or a
//     fulfilledAt / fulfilledPaymentId present), broken when
//     explicitly broken or when still pending past its promise
//     date, open otherwise. A pending promise with no usable
//     promise date is open, never silently broken.
//
// The module is import-free by design (like owner-digest.js and
// receivables-ageing.js), so the Analytics panel can use it
// without pulling in the app graph. It never mutates its inputs
// and never reads storage, dates from the clock, or any other
// module: the caller passes records and today's date explicitly.
//
// Collector grouping: names are trimmed and collapsed, grouped
// case-insensitively, and displayed with the first-seen spelling.
// A record with no collector name lands in the explicit
// "Unassigned" bucket — never dropped, never silently assigned
// to a person. That bucket is also what the Analytics panel uses
// today, because route visits and promises carry no collector
// name in storage yet (see the panel copy); the module itself is
// already per-collector for a future second collector.

export const UNASSIGNED_COLLECTOR = 'Unassigned';

// Outcomes that mean the collector attended and collected on
// that visit. 'pending' (no outcome recorded yet) and every
// non-collection outcome are not collections, and an
// unrecognised outcome is not a visit at all.
const COLLECTION_OUTCOMES = Object.freeze(['paid', 'partial']);

// Outcomes that mean the collector attended but did not collect.
const VISITED_OUTCOMES = Object.freeze([
  'promised',
  'not_home',
  'refused',
  'dispute',
  'no_answer',
  // QC-1: a call-later visit is attended too — no money, follow up
  // by phone — so it counts as visited, never as collected.
  'call_later',
]);

function str(value) {
  return value == null ? '' : String(value);
}

function isValidDateString(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function isValidPerformanceDate(value) {
  return isValidDateString(value);
}

// Canonical collector display name for a raw value, or
// 'Unassigned' when none is recorded.
export function normalizeCollectorName(value) {
  const name = str(value).trim().replace(/\s+/g, ' ');
  return name || UNASSIGNED_COLLECTOR;
}

function collectorKey(value) {
  return normalizeCollectorName(value).toLowerCase();
}

// Canonicalises a raw visit outcome to 'collected', 'visited',
// or null (pending, empty, or unrecognised — not a visit).
export function normalizePerformanceOutcome(value) {
  const raw = str(value).trim().toLowerCase();
  if (!raw) return null;
  if (COLLECTION_OUTCOMES.includes(raw)) return 'collected';
  if (VISITED_OUTCOMES.includes(raw)) return 'visited';
  return null;
}

// Classifies one promise record. `today` must be a valid
// YYYY-MM-DD date for date-based broken detection; when it is
// not, only explicitly kept/broken promises are classified and
// everything else stays open.
export function classifyPromise(promise, today) {
  if (!promise || typeof promise !== 'object') return 'open';
  const status = str(promise.status).trim().toLowerCase();
  if (status === 'fulfilled' || status === 'kept' || status === 'paid') return 'kept';
  if (promise.fulfilledAt || promise.fulfilledPaymentId) return 'kept';
  if (status === 'broken' || status === 'missed') return 'broken';
  const promisedDate = str(promise.promisedDate || promise.promiseDate).trim();
  if (isValidDateString(today) && isValidDateString(promisedDate) && promisedDate < today) return 'broken';
  return 'open';
}

function moneyValue(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function escapeHtml(value) {
  return str(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeCsv(value) {
  const text = str(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function ratePercent(numerator, denominator) {
  if (!(denominator > 0)) return null;
  return Math.round((numerator / denominator) * 100);
}

function emptyRow(name) {
  return {
    collector: name,
    visitsPlanned: 0,
    visitsDone: 0,
    plannedVisitsDone: 0,
    unplannedVisitsDone: 0,
    firstAttemptCollections: 0,
    promisesMade: 0,
    promisesKept: 0,
    promisesBroken: 0,
    promisesOpen: 0,
    cashCollected: 0,
    paymentCount: 0,
    visitCoverageRate: null,
    firstAttemptRate: null,
    promiseKeptRate: null,
  };
}

function finalizeRow(row) {
  row.visitCoverageRate = ratePercent(row.plannedVisitsDone, row.visitsPlanned);
  row.firstAttemptRate = ratePercent(row.firstAttemptCollections, row.visitsDone);
  row.promiseKeptRate = ratePercent(row.promisesKept, row.promisesMade);
  return row;
}

// Builds the per-collector view from caller-supplied records:
//   plannedVisits: [{ collector, customerId }] — the route plan.
//   visits: [{ collector, customerId, outcome, attempt }] —
//     recorded visit outcomes. `attempt` is the visit attempt
//     number for that customer; a missing attempt counts as the
//     first attempt (a single recorded visit is, by definition,
//     the first attempt). A customer visited more than once
//     counts once in visitsDone; the first-attempt collection
//     test uses the lowest attempt number recorded.
//   payments: [{ collector, amount, voided }] — the ledger.
//     Voided payments are skipped, never counted as cash.
//   promises: [{ collector, customerId, promisedDate, status,
//     fulfilledAt, fulfilledPaymentId }] — the promise register.
//   today: YYYY-MM-DD, for broken-promise detection only.
//
// Every figure is derived from these records and nothing else,
// so on the same fixture the view matches its source screens
// exactly: planned/done from the route plan and visit outcomes,
// cash from the payment ledger, promises from the register.
export function buildCollectorPerformance(input = {}) {
  const today = str(input.today).trim();
  const valid = isValidDateString(today);
  const rowsByKey = new Map();

  const rowFor = (collector) => {
    const key = collectorKey(collector);
    if (!rowsByKey.has(key)) rowsByKey.set(key, emptyRow(normalizeCollectorName(collector)));
    return rowsByKey.get(key);
  };

  // Planned visits, deduplicated per collector + customer.
  const plannedByCollector = new Map();
  for (const planned of Array.isArray(input.plannedVisits) ? input.plannedVisits : []) {
    if (!planned || typeof planned !== 'object') continue;
    const customerId = str(planned.customerId).trim();
    if (!customerId) continue;
    const key = collectorKey(planned.collector);
    if (!plannedByCollector.has(key)) plannedByCollector.set(key, new Set());
    const plannedSet = plannedByCollector.get(key);
    if (plannedSet.has(customerId)) continue;
    plannedSet.add(customerId);
    rowFor(planned.collector).visitsPlanned += 1;
  }

  // Recorded visits, grouped per collector + customer so a
  // repeat visit never inflates visitsDone.
  const visitsByCollectorCustomer = new Map();
  for (const visit of Array.isArray(input.visits) ? input.visits : []) {
    if (!visit || typeof visit !== 'object') continue;
    const kind = normalizePerformanceOutcome(visit.outcome);
    if (kind === null) continue;
    const customerId = str(visit.customerId).trim();
    if (!customerId) continue;
    const key = `${collectorKey(visit.collector)}\n${customerId}`;
    if (!visitsByCollectorCustomer.has(key)) {
      visitsByCollectorCustomer.set(key, {
        collector: visit.collector,
        customerId,
        lowestAttempt: null,
        lowestAttemptCollected: false,
      });
    }
    const group = visitsByCollectorCustomer.get(key);
    const attemptRaw = Number(visit.attempt);
    const attempt = Number.isFinite(attemptRaw) && attemptRaw >= 1 ? Math.floor(attemptRaw) : 1;
    if (group.lowestAttempt === null || attempt < group.lowestAttempt) {
      group.lowestAttempt = attempt;
      group.lowestAttemptCollected = kind === 'collected';
    } else if (attempt === group.lowestAttempt && kind === 'collected') {
      group.lowestAttemptCollected = true;
    }
  }
  for (const group of visitsByCollectorCustomer.values()) {
    const row = rowFor(group.collector);
    row.visitsDone += 1;
    const plannedSet = plannedByCollector.get(collectorKey(group.collector));
    if (plannedSet && plannedSet.has(group.customerId)) {
      row.plannedVisitsDone += 1;
    } else {
      row.unplannedVisitsDone += 1;
    }
    if (group.lowestAttemptCollected) row.firstAttemptCollections += 1;
  }

  // Promises, classified from the record itself.
  for (const promise of Array.isArray(input.promises) ? input.promises : []) {
    if (!promise || typeof promise !== 'object') continue;
    const row = rowFor(promise.collector);
    row.promisesMade += 1;
    const classification = classifyPromise(promise, valid ? today : null);
    if (classification === 'kept') row.promisesKept += 1;
    else if (classification === 'broken') row.promisesBroken += 1;
    else row.promisesOpen += 1;
  }

  // Cash, verbatim from the payment ledger; voided skipped.
  for (const payment of Array.isArray(input.payments) ? input.payments : []) {
    if (!payment || typeof payment !== 'object') continue;
    if (payment.voided === true) continue;
    const row = rowFor(payment.collector);
    row.cashCollected += moneyValue(payment.amount);
    row.paymentCount += 1;
  }

  const collectors = [...rowsByKey.values()].map(finalizeRow).sort(
    (a, b) => b.cashCollected - a.cashCollected || a.collector.localeCompare(b.collector),
  );

  const totals = emptyRow('Total');
  for (const row of collectors) {
    totals.visitsPlanned += row.visitsPlanned;
    totals.visitsDone += row.visitsDone;
    totals.plannedVisitsDone += row.plannedVisitsDone;
    totals.unplannedVisitsDone += row.unplannedVisitsDone;
    totals.firstAttemptCollections += row.firstAttemptCollections;
    totals.promisesMade += row.promisesMade;
    totals.promisesKept += row.promisesKept;
    totals.promisesBroken += row.promisesBroken;
    totals.promisesOpen += row.promisesOpen;
    totals.cashCollected += row.cashCollected;
    totals.paymentCount += row.paymentCount;
  }
  finalizeRow(totals);

  return { valid, today: valid ? today : null, collectors, totals };
}

export function collectorPerformanceSummaryText(view) {
  if (!view || !view.valid) return 'Collector performance unavailable — the view needs a valid today date.';
  const { totals } = view;
  const coverage = totals.visitCoverageRate === null ? '—' : `${totals.visitCoverageRate}%`;
  const firstAttempt = totals.firstAttemptRate === null ? '—' : `${totals.firstAttemptRate}%`;
  const kept = totals.promiseKeptRate === null ? '—' : `${totals.promiseKeptRate}%`;
  return `${view.collectors.length} collector${view.collectors.length === 1 ? '' : 's'} · ${totals.visitsDone} of ${totals.visitsPlanned} planned visits done (${coverage} coverage) · ${totals.firstAttemptCollections} first-attempt collections (${firstAttempt}) · ${totals.promisesKept} of ${totals.promisesMade} promises kept (${kept}) · Rs. ${totals.cashCollected} collected.`;
}

function rateCell(rate) {
  return rate === null ? '—' : `${rate}%`;
}

export function collectorPerformanceHtml(view) {
  if (!view || !view.valid) return '';
  const rows = [...view.collectors, view.totals].map((row, index) => {
    const isTotal = index === view.collectors.length;
    const label = isTotal ? 'Total' : row.collector;
    return `<tr${isTotal ? ' style="font-weight: bold;"' : ''}><td>${escapeHtml(label)}</td><td>${row.visitsPlanned}</td><td>${row.visitsDone}</td><td>${rateCell(row.visitCoverageRate)}</td><td>${row.firstAttemptCollections}</td><td>${rateCell(row.firstAttemptRate)}</td><td>${row.promisesMade}</td><td>${row.promisesKept}</td><td>${row.promisesBroken}</td><td>${row.promisesOpen}</td><td>Rs. ${row.cashCollected}</td><td>${row.paymentCount}</td></tr>`;
  }).join('');
  return `<p>${escapeHtml(collectorPerformanceSummaryText(view))}</p><table class="data-table"><thead><tr><th>Collector</th><th>Planned</th><th>Done</th><th>Coverage</th><th>First-attempt collections</th><th>First-attempt rate</th><th>Promises made</th><th>Kept</th><th>Broken</th><th>Open</th><th>Cash collected</th><th>Payments</th></tr></thead><tbody>${rows}</tbody></table><p style="font-size: 12px;">Sources: route plan + visit outcomes for visits, promise register for promises, payment ledger for cash (voided payments skipped). No commission figure is shown here — commission rules are untouched.</p>`;
}

export function collectorPerformanceCsv(view) {
  if (!view || !view.valid) return '';
  const header = 'Collector,Planned,Done,Planned done,Unplanned done,Coverage %,First-attempt collections,First-attempt %,Promises made,Kept,Broken,Open,Kept %,Cash collected,Payments';
  const lines = [...view.collectors, view.totals].map((row, index) => [
    index < view.collectors.length ? row.collector : 'Total',
    row.visitsPlanned,
    row.visitsDone,
    row.plannedVisitsDone,
    row.unplannedVisitsDone,
    row.visitCoverageRate === null ? '' : row.visitCoverageRate,
    row.firstAttemptCollections,
    row.firstAttemptRate === null ? '' : row.firstAttemptRate,
    row.promisesMade,
    row.promisesKept,
    row.promisesBroken,
    row.promisesOpen,
    row.promiseKeptRate === null ? '' : row.promiseKeptRate,
    row.cashCollected,
    row.paymentCount,
  ].map(escapeCsv).join(','));
  return [header, ...lines].join('\n');
}

export function collectorPerformanceFilename(view) {
  const date = view && view.valid && view.today ? view.today : 'collector-performance';
  return `collector-performance-${date}.csv`;
}
