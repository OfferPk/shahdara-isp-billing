// Plan 359 — Customer package history view on the profile.
//
// Problem: a customer changes package several times, but the profile
// shows only the current package, so nobody can say when the customer
// moved from 5 Mbps to 15 Mbps or what they paid before.
//
// This module composes the one read-only history view from the
// package-change entries already recorded on the customer record
// (each entry: date, old package, new package, old monthly rate, new
// monthly rate, staff name — the audit entries the profile save flow
// appends). It sets no package and re-prices nothing: the prices
// shown are the rates recorded in the entries and the profile's own
// current price, never a price resolved from any other record.
//
// How the view is built, honestly:
//   - Entries sort by date, oldest first; same-date entries keep
//     their recorded order. An entry whose date is not a strict
//     calendar date is never assigned a date — it is counted
//     separately as undated, and the view says so plainly.
//   - Each dated change closes one package period and opens the
//     next: the period before the first change starts at an
//     unrecorded date, and the current period has no end date.
//   - Where the record is silent, the view says so: a period whose
//     start or end the record never states reads "start not
//     recorded" / "end not recorded", and a missing rate reads
//     "price not recorded". No gap is ever claimed.
//   - A broken chain — a change whose old package is not the package
//     the previous change moved the customer to — means a change was
//     never recorded in between: the earlier period ends without a
//     recorded date and the later period starts without one, so the
//     gap stays visible instead of being papered over.
//   - The current period always matches the profile: the caller
//     supplies the profile's own current package label and price
//     (the same resolution the header strip uses). When the last
//     recorded change moved the customer to a different package than
//     the profile now shows, the record is silent about when the
//     current package began, so its start reads "not recorded".
//   - A change that changed nothing — same package and same rate —
//     opens no new period: there is no package period to show for
//     it. The entry itself still lives in the profile timeline;
//     this view only lists periods.
//
// The module is pure and import-free: the caller supplies the
// entries and the current package, and it never reads storage, the
// clock, or the network, never mutates its inputs, and holds no
// store of its own. Money is integer cents throughout, so no float
// drift; all figures are in PKR, never converted.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

// A strict YYYY-MM-DD calendar date, or null. A datetime string
// contributes only its date part; anything else is not a date.
export function validPackageHistoryDay(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return null;
  const datePart = raw.slice(0, 10);
  const match = DATE_RE.exec(datePart);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return null;
  const maxDay = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  if (day > maxDay) return null;
  return datePart;
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function packageKey(value) {
  return text(value).toLowerCase();
}

// A monthly amount in integer cents, or null when missing or
// unusable. Zero is a real figure; a blank, a boolean, a
// non-finite value, or a negative amount is not a figure at all.
function toLedgerCents(amount) {
  if (typeof amount === 'boolean' || amount === null || amount === undefined) return null;
  if (typeof amount === 'string' && amount.trim() === '') return null;
  const num = Number(amount);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num * 100);
}

function fromCents(cents) {
  return cents / 100;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// One recorded package-change entry, normalized. A non-object is
// refused (null). The date is null when it is not a strict calendar
// date; the entry is still returned, so the caller can count it as
// undated instead of silently dropping a recorded change.
export function normalizePackageHistoryEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    date: validPackageHistoryDay(raw.date),
    oldPackage: text(raw.oldPackage),
    newPackage: text(raw.newPackage),
    oldPriceCents: toLedgerCents(raw.oldMonthlyRate),
    newPriceCents: toLedgerCents(raw.newMonthlyRate),
    staffName: text(raw.staffName),
  };
}

// A list of recorded entries, normalized. A non-array is an empty
// list; refused entries are dropped. Inputs are never mutated.
export function normalizePackageHistoryList(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const entry of raw) {
    const normalized = normalizePackageHistoryEntry(entry);
    if (normalized) out.push(normalized);
  }
  return out;
}

// Build the package periods for one customer, newest first.
//
// The caller supplies the recorded entries plus the profile's own
// current package (label and price, or nulls when the profile has
// none). Returns { segments, undatedCount, totalChanges } where each
// segment is { packageLabel, priceCents, price, startDate, endDate,
// isCurrent, startKnown, endKnown, gapBefore } — dates are strict
// YYYY-MM-DD strings or null, and a null date always means the
// record is silent about that end of the period, never a guess.
export function packageHistorySegmentsFor({
  packageHistory,
  currentPackageLabel,
  currentPackagePrice,
} = {}) {
  const entries = normalizePackageHistoryList(packageHistory);
  const totalChanges = entries.length;
  const undated = entries.filter((entry) => !entry.date);
  const dated = entries
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => entry.date)
    .sort((a, b) => (a.entry.date < b.entry.date ? -1 : a.entry.date > b.entry.date ? 1 : a.index - b.index))
    .map(({ entry }) => entry);
  // A change that changed nothing opens no new period.
  const changes = dated.filter((entry) => {
    const samePackage = packageKey(entry.oldPackage) === packageKey(entry.newPackage);
    const samePrice = entry.oldPriceCents !== null
      && entry.oldPriceCents === entry.newPriceCents;
    return !(samePackage && samePrice);
  });
  const currentLabel = text(currentPackageLabel);
  const currentPriceCents = toLedgerCents(currentPackagePrice);

  const periods = [];
  let open = null;
  for (const change of changes) {
    if (open === null) {
      // The period before the first recorded change: the record is
      // silent about when it began.
      periods.push({
        packageLabel: change.oldPackage,
        priceCents: change.oldPriceCents,
        price: change.oldPriceCents === null ? null : fromCents(change.oldPriceCents),
        startDate: null,
        endDate: change.date,
        isCurrent: false,
        startKnown: false,
        endKnown: true,
        gapBefore: false,
      });
    } else if (packageKey(change.oldPackage) !== packageKey(open.packageLabel)) {
      // Broken chain: a change in between was never recorded. The
      // open period ends without a recorded date, and the period
      // before this change starts without one — the gap stays
      // visible instead of being claimed away.
      open.endDate = null;
      open.endKnown = false;
      periods.push(open);
      periods.push({
        packageLabel: change.oldPackage,
        priceCents: change.oldPriceCents,
        price: change.oldPriceCents === null ? null : fromCents(change.oldPriceCents),
        startDate: null,
        endDate: change.date,
        isCurrent: false,
        startKnown: false,
        endKnown: true,
        gapBefore: true,
      });
    } else {
      open.endDate = change.date;
      open.endKnown = true;
      periods.push(open);
    }
    open = {
      packageLabel: change.newPackage,
      priceCents: change.newPriceCents,
      price: change.newPriceCents === null ? null : fromCents(change.newPriceCents),
      startDate: change.date,
      endDate: null,
      isCurrent: false,
      startKnown: true,
      endKnown: false,
      gapBefore: false,
    };
  }
  if (open !== null) {
    // The current period always matches the profile. When the last
    // recorded change moved the customer to a different package than
    // the profile now shows, the record is silent about when the
    // current package began.
    if (currentLabel && packageKey(open.packageLabel) !== packageKey(currentLabel)) {
      open.endDate = null;
      open.endKnown = false;
      periods.push(open);
      periods.push({
        packageLabel: currentLabel,
        priceCents: currentPriceCents,
        price: currentPriceCents === null ? null : fromCents(currentPriceCents),
        startDate: null,
        endDate: null,
        isCurrent: true,
        startKnown: false,
        endKnown: false,
        gapBefore: true,
      });
    } else {
      if (currentLabel) open.packageLabel = currentLabel;
      if (currentPriceCents !== null) {
        open.priceCents = currentPriceCents;
        open.price = fromCents(currentPriceCents);
      }
      open.isCurrent = true;
      periods.push(open);
    }
  } else if (currentLabel) {
    // No recorded changes at all: the one period is the current
    // package, whose start the record never states.
    periods.push({
      packageLabel: currentLabel,
      priceCents: currentPriceCents,
      price: currentPriceCents === null ? null : fromCents(currentPriceCents),
      startDate: null,
      endDate: null,
      isCurrent: true,
      startKnown: false,
      endKnown: false,
      gapBefore: false,
    });
  }
  // Newest first: the current period at the top.
  const segments = periods.reverse();
  return { segments, undatedCount: undated.length, totalChanges };
}

const defaultFormatAmount = (value) => `PKR ${String(value ?? '')}`;

// One period in plain words, for text summaries and CSV rows.
export function packageHistorySegmentText(segment, formatAmount = defaultFormatAmount) {
  if (!segment || typeof segment !== 'object') return '';
  const format = typeof formatAmount === 'function' ? formatAmount : defaultFormatAmount;
  const label = text(segment.packageLabel) || 'Package not recorded';
  const price = segment.priceCents === null ? 'price not recorded' : `${format(segment.price)}/month`;
  const dates = segment.isCurrent
    ? (segment.startDate ? `since ${segment.startDate}` : 'since (start not recorded)')
    : (`${segment.startDate || '(start not recorded)'} to ${segment.endDate || '(end not recorded)'}`);
  const current = segment.isCurrent ? ' (current)' : '';
  return `${label} — ${price}, ${dates}${current}`;
}

// The whole view in plain words, newest first.
export function packageHistoryViewText(view, formatAmount = defaultFormatAmount) {
  if (!view || typeof view !== 'object') return 'Package history unavailable.';
  const segments = Array.isArray(view.segments) ? view.segments : [];
  if (segments.length === 0) return 'No package history recorded.';
  const parts = segments.map((segment) => packageHistorySegmentText(segment, formatAmount));
  if (view.undatedCount > 0) {
    parts.push(view.undatedCount === 1
      ? '1 package change without a recorded date.'
      : `${view.undatedCount} package changes without a recorded date.`);
  }
  return parts.join(' ');
}

// The read-only history section for the profile. currentPackage is
// { label, price } from the profile itself; formatAmount formats a
// monthly amount in PKR. No form, no button: the view sets no
// package and re-prices nothing.
export function packageHistoryViewSectionHtml(customer, currentPackage = {}, formatAmount = defaultFormatAmount) {
  const format = typeof formatAmount === 'function' ? formatAmount : defaultFormatAmount;
  const history = Array.isArray(customer?.packageHistory) ? customer.packageHistory : [];
  const view = packageHistorySegmentsFor({
    packageHistory: history,
    currentPackageLabel: currentPackage?.label,
    currentPackagePrice: currentPackage?.price,
  });
  const rows = view.segments.map((segment) => {
    const label = text(segment.packageLabel) || 'Package not recorded';
    const price = segment.priceCents === null
      ? 'Price not recorded'
      : `${escapeHtml(format(segment.price))}/month`;
    const dates = segment.isCurrent
      ? (segment.startDate ? `Since ${escapeHtml(segment.startDate)}` : 'Since (start not recorded)')
      : (`${segment.startDate ? escapeHtml(segment.startDate) : '(start not recorded)'} to ${segment.endDate ? escapeHtml(segment.endDate) : '(end not recorded)'}`);
    const current = segment.isCurrent ? ' <span class="phv-current">Current</span>' : '';
    const gap = segment.gapBefore ? ' <span class="phv-gap">Gap in the record</span>' : '';
    return `<li><span class="phv-package">${escapeHtml(label)}</span> <span class="phv-price">${price}</span> <span class="phv-dates">${dates}</span>${current}${gap}</li>`;
  }).join('');
  const list = rows
    ? `<ul id="phvList" class="phv-list">${rows}</ul>`
    : '<p class="phv-none">No package history recorded.</p>';
  const undated = view.undatedCount > 0
    ? `<p class="phv-undated">${view.undatedCount === 1 ? '1 package change without a recorded date.' : `${view.undatedCount} package changes without a recorded date.`}</p>`
    : '';
  const summary = view.segments.length > 0
    ? `<p class="phv-summary">${escapeHtml(packageHistoryViewText(view, format))}</p>`
    : '';
  return `<section class="profile-package-history" aria-label="Package history"><h4>Package history</h4><p>Every package this customer has been on, with the dates and the price at the time — from the package changes already recorded on the profile. This view sets no package and re-prices nothing; a package is only changed through the profile Edit form.</p>${list}${undated}${summary}</section>`;
}
