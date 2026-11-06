// Plan 360 — Customer service start date and tenure display on the profile.
//
// Problem: the profile never says plainly how long a customer has been
// with Shahdara, so long-standing customers are treated the same as last
// month's joiners.
//
// What already exists, and what this plan adds: the profile already shows
// tenure as a flat month count in the receipts summary, and profile age
// as months plus days — but nowhere does it say whole months AND years in
// plain words ("3 years 2 months"), which is what Saad needs to greet a
// three-year customer as a three-year customer. That years-and-months
// display is the one missing piece this module adds. It creates no
// recognition list and no anniversary milestone — those live elsewhere
// and are untouched here.
//
// How the tenure is computed, honestly:
//   - The service start date is the recorded connection date on the
//     customer record — the same source the existing tenure summary
//     uses. Profile creation, billing start, and manual online status
//     are never used as substitutes, and no date is ever invented.
//   - Whole calendar months are counted inclusively, exactly like the
//     existing tenure summary: the connection month itself counts as
//     month one, so this display never disagrees with the month count
//     the profile already shows. Years are whole years of those
//     months (12 months = 1 year), the rest are whole months.
//   - A customer whose service has ended (cancelled, expired, or
//     archived) counts tenure only up to the earliest recorded end
//     date, never past it. An ended customer with no recorded end
//     date reads as end-date-unknown, never as a guessed duration.
//   - A start date in the future reads as not started. A start date
//     after the recorded end date reads as a date problem to check.
//   - A customer with no recorded connection date reads as not
//     recorded instead of a guessed tenure.
//
// The module is pure and import-free: the caller supplies the customer
// record and the "today" date (so tests can pin tenure on a fixed
// fixture date), and it never reads storage, the clock, or the network,
// never mutates its inputs, and holds no store of its own. All wording
// comes from the labels the caller supplies, so the display follows
// the app's current language.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

// A strict YYYY-MM-DD calendar date, or null. A datetime string
// contributes only its date part; anything else is not a date.
export function validServiceTenureDay(value) {
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

function monthIndex(date) {
  return Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1;
}

function fillTemplate(template, date) {
  return String(template ?? '').replace('{date}', date ?? '');
}

function fillCount(template, count) {
  return String(template ?? '').replace('{n}', String(count));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// The service tenure of one customer, from the recorded connection
// date. `today` is the reference date supplied by the caller as a
// YYYY-MM-DD string. Returns { status, startDate, endDate,
// totalMonths, years, months } where status is one of 'current',
// 'ended', 'future', 'not-recorded', 'end-date-unknown' or
// 'date-review'. totalMonths, years and months are null whenever no
// duration can honestly be stated.
export function serviceTenureFor(customer, today) {
  const startDate = validServiceTenureDay(customer?.connectionDate);
  const todayDay = validServiceTenureDay(today);
  if (!startDate || !todayDay) {
    return { status: 'not-recorded', startDate: null, endDate: null, totalMonths: null, years: null, months: null };
  }
  if (startDate > todayDay) {
    return { status: 'future', startDate, endDate: null, totalMonths: null, years: null, months: null };
  }
  const cancellationDate = validServiceTenureDay(customer?.cancellationDate);
  const expiryDate = validServiceTenureDay(customer?.expiryDate);
  const archiveDate = customer?.archived === true
    ? validServiceTenureDay(typeof customer.archivedAt === 'string' ? customer.archivedAt.slice(0, 10) : customer.archivedAt)
    : null;
  const ended = customer?.archived === true
    || Boolean(cancellationDate && cancellationDate <= todayDay)
    || Boolean(expiryDate && expiryDate < todayDay);
  const endDate = [
    cancellationDate && cancellationDate <= todayDay ? cancellationDate : null,
    expiryDate && expiryDate < todayDay ? expiryDate : null,
    archiveDate && archiveDate <= todayDay ? archiveDate : null,
  ].filter(Boolean).sort()[0] ?? null;
  if (ended && !endDate) {
    return { status: 'end-date-unknown', startDate, endDate: null, totalMonths: null, years: null, months: null };
  }
  const effectiveEnd = endDate ?? todayDay;
  if (effectiveEnd < startDate) {
    return { status: 'date-review', startDate, endDate: effectiveEnd, totalMonths: null, years: null, months: null };
  }
  const totalMonths = monthIndex(effectiveEnd) - monthIndex(startDate) + 1;
  return {
    status: endDate ? 'ended' : 'current',
    startDate,
    endDate,
    totalMonths,
    years: Math.floor(totalMonths / 12),
    months: totalMonths % 12,
  };
}

// The tenure in plain words — whole years and whole months, e.g.
// "3 years 2 months", "1 year", "5 months". `labels` supplies the
// wording in the app's current language: { yearOne, years, monthOne,
// months, notRecorded, notStarted, endUnknown, checkDates }, where
// `years` and `months` are templates holding a {n} count.
export function serviceTenureWords(tenure, labels) {
  if (!tenure || tenure.status === 'not-recorded') return labels?.notRecorded ?? '';
  if (tenure.status === 'future') return labels?.notStarted ?? '';
  if (tenure.status === 'end-date-unknown') return labels?.endUnknown ?? '';
  if (tenure.status === 'date-review') return labels?.checkDates ?? '';
  const years = tenure.years ?? 0;
  const months = tenure.months ?? 0;
  const pieces = [];
  if (years > 0) pieces.push(years === 1 ? (labels?.yearOne ?? '') : fillCount(labels?.years, years));
  if (months > 0) pieces.push(months === 1 ? (labels?.monthOne ?? '') : fillCount(labels?.months, months));
  if (!pieces.length) pieces.push(labels?.monthOne ?? '');
  return pieces.join(' ');
}

// The detail line under the tenure words: the recorded start date (or
// end date) in plain words, or '' when there is nothing honest to add.
export function serviceTenureDetail(tenure, labels) {
  if (!tenure) return '';
  if (tenure.status === 'current') return fillTemplate(labels?.connectedSince, tenure.startDate);
  if (tenure.status === 'ended') return fillTemplate(labels?.ended, tenure.endDate);
  if (tenure.status === 'future') return fillTemplate(labels?.recordedDate, tenure.startDate);
  if (tenure.status === 'end-date-unknown') return fillTemplate(labels?.durationUnknown, tenure.startDate);
  if (tenure.status === 'date-review') return fillTemplate(labels?.endBeforeConnection, tenure.endDate);
  return '';
}

// The tenure section for the profile: heading, tenure in plain words,
// and the recorded-date detail line. Always renders — a customer with
// no recorded start date shows the not-recorded wording instead of a
// guessed tenure. Read-only: it never changes any record.
export function serviceTenureSectionHtml(customer, today, labels) {
  const tenure = serviceTenureFor(customer, today);
  const primary = serviceTenureWords(tenure, labels);
  const detail = serviceTenureDetail(tenure, labels);
  return `<section class="service-tenure-section stv-section" aria-label="${escapeHtml(labels?.heading ?? '')}"><h3>${escapeHtml(labels?.heading ?? '')}</h3><p class="stv-primary">${escapeHtml(primary)}</p>${detail ? `<p class="stv-detail">${escapeHtml(detail)}</p>` : ''}</section>`;
}
