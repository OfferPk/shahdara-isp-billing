/*
 * Dashboard upcoming dues — the bills falling due in the next seven
 * days, split per day, with the seven-day total in PKR.
 *
 * The view is composed from the bills the app already keeps —
 * nothing here edits a bill, a payment, or a customer. Each bill
 * contributes the positive remaining balance of its own month, read
 * through the allocation engine, so a bill already paid in full
 * counts for nothing and a partly paid bill counts only its
 * remainder. Archived customers never appear, and a bill with no
 * usable amount never appears; no due date is ever invented.
 *
 * Window rule (seven calendar days, inclusive on both ends, no
 * clock read — the caller supplies the reference day):
 *   - dueDate == today ............ included (due today, not yet late)
 *   - today < dueDate <= today+6 .. included
 *   - dueDate < today ............. excluded (already overdue — that
 *     is the overdue list's job, not this view's)
 *   - dueDate > today+6 ........... excluded (outside the week)
 *   - no dueDate, or a due date that is not a strict calendar day
 *     ............................ excluded, never given an invented
 *     due date (a bill month's 5th is NOT assumed when no due date
 *     is stored)
 *   - remaining balance <= 0 ...... never appears
 *
 * This is the forward window the pre-due reminder queue already
 * uses, stretched to the full week and split per day instead of one
 * row per customer: Saad knows on Monday which doors to knock on
 * by Sunday. All money is PKR only, never converted to any other
 * currency, and a day with no dues reads zero, never a blank.
 */

import { calculatePaymentAllocations, formatPKR } from './core.js';
import { formatDateYmd, escapeHtml } from './dashboard-daily-closing.js';
import { t } from './nav-language.js';

export const UPCOMING_DUES_WINDOW_DAYS = 7;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year, month) {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return DAYS_IN_MONTH[month - 1];
}

/**
 * Adds whole calendar days to a strict YYYY-MM-DD date, using pure
 * calendar arithmetic — no clock is ever read here.
 *
 * @param {string} ymd - A strict YYYY-MM-DD date
 * @param {number} offset - Whole days to add (may be negative)
 * @returns {string} The resulting YYYY-MM-DD date, or '' when the
 *   input is not a strict calendar date
 */
export function addDaysYmd(ymd, offset) {
  if (typeof ymd !== 'string' || !DATE_RE.test(ymd)) return '';
  let year = Number(ymd.slice(0, 4));
  let month = Number(ymd.slice(5, 7));
  let day = Number(ymd.slice(8, 10));
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return '';
  let remaining = Math.trunc(offset) || 0;
  if (remaining >= 0) {
    while (remaining > 0) {
      const room = daysInMonth(year, month) - day;
      if (remaining <= room) {
        day += remaining;
        remaining = 0;
      } else {
        remaining -= (room + 1);
        day = 1;
        month += 1;
        if (month > 12) {
          month = 1;
          year += 1;
        }
      }
    }
  } else {
    while (remaining < 0) {
      if (day + remaining >= 1) {
        day += remaining;
        remaining = 0;
      } else {
        remaining += day;
        month -= 1;
        if (month < 1) {
          month = 12;
          year -= 1;
        }
        day = daysInMonth(year, month);
      }
    }
  }
  const pad = (value) => String(value).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * Reads a strict YYYY-MM-DD date the way the ledger reads it:
 * "5 Nov 2026".
 *
 * @param {string} ymd - A strict YYYY-MM-DD date
 * @returns {string} The day label, or '' for anything else
 */
export function formatDayLabel(ymd) {
  if (typeof ymd !== 'string' || !DATE_RE.test(ymd)) return '';
  const year = Number(ymd.slice(0, 4));
  const month = Number(ymd.slice(5, 7));
  const day = Number(ymd.slice(8, 10));
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return '';
  return `${day} ${MONTH_NAMES[month - 1]} ${year}`;
}

function toCents(amount) {
  return Math.round(Number(amount || 0) * 100);
}

/**
 * Calculates the upcoming-dues view for the seven days starting on
 * the reference day.
 *
 * @param {Object} state - Application state
 * @param {Date} referenceDate - The first day of the window
 *   (required; the caller owns the clock, this module never reads it)
 * @returns {Object} { startDate, endDate, days, totalCents,
 *   totalCount } — money in integer cents; days always holds all
 *   seven days in order, each with its own bills, day total, and
 *   count, even when a day has no dues
 */
export function calculateUpcomingDues(state, referenceDate) {
  const startDate = formatDateYmd(referenceDate);
  const summary = {
    startDate,
    endDate: '',
    days: [],
    totalCents: 0,
    totalCount: 0
  };
  if (!startDate) return summary;

  const days = [];
  for (let offset = 0; offset < UPCOMING_DUES_WINDOW_DAYS; offset += 1) {
    const date = addDaysYmd(startDate, offset);
    days.push({
      date,
      label: formatDayLabel(date),
      bills: [],
      dayTotalCents: 0,
      dayCount: 0
    });
  }
  summary.endDate = days[days.length - 1].date;
  summary.days = days;
  const byDate = new Map(days.map((day) => [day.date, day]));

  const allocations = calculatePaymentAllocations(state ?? {});
  for (const customer of (state?.customers ?? [])) {
    if (customer.archived) continue;
    const bills = Array.isArray(customer.bills) ? customer.bills : [];
    for (const bill of bills) {
      const slot = byDate.get(bill.dueDate);
      if (!slot) continue;
      const amount = bill.dueAmount;
      if (amount === null || amount === undefined || amount === '' || !Number.isFinite(Number(amount))) continue;
      const allocation = allocations.forMonth(customer.id, bill.month);
      const balanceCents = allocation?.balanceDueCents ?? toCents(amount);
      if (balanceCents <= 0) continue;
      slot.bills.push({
        customerId: customer.id,
        customerName: customer.name,
        mohalla: customer.mohalla || customer.area || '',
        month: bill.month,
        amountCents: balanceCents
      });
      slot.dayTotalCents += balanceCents;
      slot.dayCount += 1;
      summary.totalCents += balanceCents;
      summary.totalCount += 1;
    }
  }
  return summary;
}

/**
 * Builds the per-day list HTML for the upcoming-dues view: one
 * group per day, in window order, each with its bills (name, PKR
 * amount, mohalla and bill month) and its day total. A day with no
 * dues reads plainly, never a blank.
 *
 * @param {Object} summary - Output of calculateUpcomingDues
 * @returns {string} The day groups HTML (empty when the summary
 *   carries no days)
 */
export function upcomingDuesSectionHtml(summary) {
  const days = Array.isArray(summary?.days) ? summary.days : [];
  return days.map((day) => {
    const billsHtml = day.bills.length === 0
      ? `<p class="fcst-area-sub">${escapeHtml(t('dash_upcoming_day_empty'))}</p>`
      : `<ul class="provider-cost-list">${day.bills.map((bill) => {
        const meta = [bill.mohalla, bill.month].filter(Boolean).join(' · ');
        return `<li><span class="provider-breakdown-name">${escapeHtml(bill.customerName)}</span><strong>${escapeHtml(formatPKR(bill.amountCents / 100))}</strong>${meta ? `<span class="provider-breakdown-meta">${escapeHtml(meta)}</span>` : ''}</li>`;
      }).join('')}</ul>`;
    const countText = t(day.dayCount === 1 ? 'dash_upcoming_bills_sing' : 'dash_upcoming_bills_plur', null, { count: day.dayCount });
    return `<div class="fcst-area-row"><div class="fcst-area-head"><span class="fcst-area-label">${escapeHtml(day.label)}</span><span class="fcst-area-figures">${escapeHtml(formatPKR(day.dayTotalCents / 100))}</span></div><p class="fcst-area-sub">${escapeHtml(countText)}</p>${billsHtml}</div>`;
  }).join('');
}

/**
 * Renders the upcoming-dues view into the billing dashboard.
 *
 * @param {Document} doc - The host page for the view
 * @param {Object} summary - Output of calculateUpcomingDues
 */
export function renderUpcomingDues(doc, summary) {
  if (!doc || !summary) return;
  const totalEl = doc.getElementById('dudSevenDayTotal');
  if (totalEl) totalEl.textContent = formatPKR((summary.totalCents ?? 0) / 100);
  const lineEl = doc.getElementById('dudSevenDayLine');
  if (lineEl) {
    lineEl.textContent = summary.startDate && summary.endDate
      ? t('dash_upcoming_period', null, { start: formatDayLabel(summary.startDate), end: formatDayLabel(summary.endDate) })
      : '';
  }
  const hasBills = (summary.totalCount ?? 0) > 0;
  const daysEl = doc.getElementById('dudUpcomingDays');
  if (daysEl) daysEl.innerHTML = hasBills ? upcomingDuesSectionHtml(summary) : '';
  const emptyEl = doc.getElementById('dudUpcomingEmpty');
  if (emptyEl) emptyEl.hidden = hasBills;
}
