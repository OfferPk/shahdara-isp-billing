/**
 * lineman-scorecard.js — SISP-39: Lineman Monthly Performance, Collection &
 * Ticket Scorecard ("لائن مین کارکردگی اور کلیکشن ریکارڈ").
 *
 * Problem: nobody could see, per field worker and per month, how many
 * complaints a lineman actually closed, how much drawer petty cash he
 * burned through, or how much cash the shop collectors took in. The raw
 * facts already exist across SISP-11/12/15 and the payment ledger — this
 * module is the read-only scorecard that aggregates them.
 *
 * ATTRIBUTION — only fields that really exist in the data model are used:
 * - Complaints/tickets resolved: complaint-tickets.js (SISP-12) tickets
 *   carry a free-text `technician`. A register complaint counts for a
 *   lineman through a ticket linked to it (ticket.complaintId) — and
 *   the linked pair is one job, counted once, never twice. SISP-173: a
 *   register complaint with NO linked ticket can instead name its
 *   resolver directly (resolvedByLineman on the register entry); the
 *   field is inert the moment any ticket links to the complaint, so a
 *   synced pair still attributes only via the ticket.
 * - Petty cash spent: roznamcha.js (SISP-11) outflows carry `lineman` +
 *   `category` on a dated day record.
 * - Cash collected: payments carry NO lineman field — the only recorded
 *   collectors are the shop collectors SISP-1 derives from the payment
 *   method ("Cash at <Name> shop", see shop-settlement.js
 *   resolveShopCollector). They get their own collector cards. Voided
 *   payments (SISP-34) never count as collected cash.
 * - New connections: the month total uses connectionDate / addedOn
 *   (PR #398). SISP-173: customers can record who installed the
 *   connection (installedByLineman, optional free text on the profile),
 *   so the total now splits per installer; connections without a
 *   recorded installer stay in an explicit "Team / not recorded"
 *   bucket, and split + bucket always sum back to the team total.
 *
 * Read-only aggregation: no storage key, no writes, no data changes.
 * All builders are pure; setupLinemanScorecardModal is the DOM controller
 * (returns null outside a browser, mirroring the sibling modules).
 */

import { sanitizeTickets, loadTickets } from './complaint-tickets.js';
import { sanitizeComplaints, loadComplaints } from './complaint-register.js';
import { sanitizeRoznamchaDays, loadRoznamchaDays } from './roznamcha.js';
import { resolveShopCollector } from './shop-settlement.js';
import { isVoidedPayment } from './payment-void-audit.js';
import { t } from './nav-language.js';

const PAKISTAN_TIME_ZONE = 'Asia/Karachi';
const MONTH_RE = /^\d{4}-\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function moneyValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function round2(value) {
  return Math.round(moneyValue(value) * 100) / 100;
}

export function formatScorecardPKR(value) {
  if (value === null || value === undefined || value === '') return 'Not set';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'Not set';
  const formatter = new Intl.NumberFormat('en-PK', {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2
  });
  return `PKR ${formatter.format(amount)}`;
}

function zonedParts(date) {
  return Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: PAKISTAN_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value])
  );
}

/** YYYY-MM in Pakistan time. */
export function scorecardMonthNow(referenceDate = new Date()) {
  const date = referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime())
    ? referenceDate
    : new Date();
  const parts = zonedParts(date);
  return `${parts.year}-${parts.month}`;
}

/** A valid YYYY-MM month string, or the current PKT month as fallback. */
export function normalizeScorecardMonth(month, referenceDate = new Date()) {
  return MONTH_RE.test(String(month || '')) ? String(month) : scorecardMonthNow(referenceDate);
}

/**
 * Grouping key for a free-text lineman/technician name: trimmed, internal
 * whitespace collapsed, case-insensitive — "Ali", "ali " and "ALI" are the
 * same person. Returns '' for blank names (never attributed).
 */
export function linemanNameKey(name) {
  return cleanText(name).replace(/\s+/g, ' ').toLowerCase();
}

function monthOfDateTime(value) {
  const text = String(value || '');
  return text.length >= 7 ? text.slice(0, 7) : '';
}

function monthOfDate(value) {
  const text = String(value || '');
  return DATE_RE.test(text) ? text.slice(0, 7) : '';
}

/**
 * Per-lineman monthly scorecards.
 *
 * People are discovered from the attribution fields themselves: every
 * ticket `technician`, every roznamcha outflow `lineman`, every customer
 * `installedByLineman` and every unlinked complaint's
 * `resolvedByLineman`, across ALL months — so a lineman with no activity
 * in the target month still gets a card of zeros instead of silently
 * vanishing. Names are grouped by linemanNameKey; the display name is
 * the first-seen original spelling.
 *
 * @param {{tickets?: Array, complaints?: Array, roznamchaDays?: Array, customers?: Array}} sources
 * @param {string} month YYYY-MM
 * @returns {Array<{name, key, complaintsResolved, directComplaintsResolved,
 *   ticketsResolved, ticketsOpen, newConnections, pettyCashSpent,
 *   pettyCashByCategory: Array<{category, amount}>}>}
 *   Sorted by complaints resolved desc, then petty cash desc, then name.
 */
export function buildLinemanScorecards(sources = {}, month, referenceDate = new Date()) {
  const targetMonth = normalizeScorecardMonth(month, referenceDate);
  const tickets = sanitizeTickets(Array.isArray(sources?.tickets) ? sources.tickets : []);
  const complaints = sanitizeComplaints(Array.isArray(sources?.complaints) ? sources.complaints : []);
  const days = sanitizeRoznamchaDays(Array.isArray(sources?.roznamchaDays) ? sources.roznamchaDays : []);
  const customers = Array.isArray(sources?.customers) ? sources.customers : [];

  // Every complaint any ticket links to (SISP-44 pairs). Membership here
  // decides a complaint's attribution channel: the ticket's technician
  // when linked, the register's own resolvedByLineman when not.
  const linkedComplaintIdsAll = new Set();
  for (const ticket of tickets) if (ticket.complaintId) linkedComplaintIdsAll.add(ticket.complaintId);

  const people = new Map();
  const ensure = (rawName) => {
    const key = linemanNameKey(rawName);
    if (!key) return null;
    if (!people.has(key)) {
      people.set(key, {
        name: cleanText(rawName).replace(/\s+/g, ' '),
        key,
        complaintsResolved: 0,
        directComplaintsResolved: 0,
        ticketsResolved: 0,
        ticketsOpen: 0,
        newConnections: 0,
        pettyCashSpent: 0,
        pettyCashByCategory: []
      });
    }
    return people.get(key);
  };

  for (const ticket of tickets) ensure(ticket.technician);
  for (const day of days) {
    for (const outflow of (day.outflows || [])) ensure(outflow.lineman);
  }
  // SISP-173: people are also discovered from installer attribution on
  // customers and from direct register resolutions, so a lineman whose
  // only trace is installs or ticket-less fixes still gets a card. A
  // LINKED complaint's register field is inert, so it never discovers
  // (or credits) a second person for a synced pair.
  for (const customer of customers) {
    if (customer && typeof customer === 'object') ensure(customer.installedByLineman);
  }
  for (const complaint of complaints) {
    if (!linkedComplaintIdsAll.has(complaint.id)) ensure(complaint.resolvedByLineman);
  }

  // Complaints resolved: union of resolved-in-month work items. A resolved
  // ticket is one item (keyed by its linked complaint when it has one, so
  // ticket + register entry never double-count); a register complaint
  // resolved in the month counts for the lineman whose ticket links to it.
  for (const person of people.values()) {
    const itemKeys = new Set();
    const linkedComplaintIds = new Set();
    let resolvedCount = 0;
    for (const ticket of tickets) {
      if (linemanNameKey(ticket.technician) !== person.key) continue;
      if (ticket.complaintId) linkedComplaintIds.add(ticket.complaintId);
      if (ticket.status !== 'Resolved') {
        person.ticketsOpen += 1;
        continue;
      }
      if (monthOfDateTime(ticket.resolvedAt) !== targetMonth) continue;
      resolvedCount += 1;
      itemKeys.add(ticket.complaintId ? `cmp:${ticket.complaintId}` : `tkt:${ticket.id}`);
    }
    person.ticketsResolved = resolvedCount;
    for (const complaint of complaints) {
      if (complaint.status !== 'Resolved') continue;
      if (monthOfDateTime(complaint.resolvedAt) !== targetMonth) continue;
      if (linkedComplaintIds.has(complaint.id)) itemKeys.add(`cmp:${complaint.id}`);
    }
    // SISP-173: direct register work — a resolved complaint with NO
    // linked ticket attributes to the lineman named on the register
    // entry itself. Linked complaints are skipped on purpose: they
    // already entered via the ticket above, so the pair stays one job.
    let directCount = 0;
    for (const complaint of complaints) {
      if (complaint.status !== 'Resolved') continue;
      if (monthOfDateTime(complaint.resolvedAt) !== targetMonth) continue;
      if (linkedComplaintIdsAll.has(complaint.id)) continue;
      if (linemanNameKey(complaint.resolvedByLineman) !== person.key) continue;
      const itemKey = `cmp:${complaint.id}`;
      if (!itemKeys.has(itemKey)) { itemKeys.add(itemKey); directCount += 1; }
    }
    person.directComplaintsResolved = directCount;
    person.complaintsResolved = itemKeys.size;

    // SISP-173: new connections this lineman installed in the month
    // (join month = connectionDate first, then addedOn — the same rule
    // countNewConnections uses for the team total).
    let installed = 0;
    for (const customer of customers) {
      if (!customer || typeof customer !== 'object') continue;
      const joined = monthOfDate(customer.connectionDate) || monthOfDate(customer.addedOn);
      if (joined !== targetMonth) continue;
      if (linemanNameKey(customer.installedByLineman) === person.key) installed += 1;
    }
    person.newConnections = installed;
  }

  // Petty cash: roznamcha outflows on days inside the target month.
  const categoryTotals = new Map(); // person key -> Map(category -> amount)
  for (const day of days) {
    if (monthOfDate(day.date) !== targetMonth) continue;
    for (const outflow of (day.outflows || [])) {
      const person = ensure(outflow.lineman);
      if (!person) continue;
      person.pettyCashSpent = round2(person.pettyCashSpent + moneyValue(outflow.amount));
      if (!categoryTotals.has(person.key)) categoryTotals.set(person.key, new Map());
      const byCategory = categoryTotals.get(person.key);
      byCategory.set(outflow.category, round2((byCategory.get(outflow.category) || 0) + moneyValue(outflow.amount)));
    }
  }
  for (const person of people.values()) {
    const byCategory = categoryTotals.get(person.key);
    person.pettyCashByCategory = byCategory
      ? [...byCategory.entries()]
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category))
      : [];
    person.pettyCashSpent = round2(person.pettyCashSpent);
  }

  return [...people.values()].sort((a, b) =>
    b.complaintsResolved - a.complaintsResolved
    || b.pettyCashSpent - a.pettyCashSpent
    || a.name.localeCompare(b.name));
}

/**
 * Per-shop-collector cash collected in a month (SISP-1 collectors derived
 * from payment methods). Voided payments (SISP-34) are never receipts, so
 * they never count as collected cash.
 *
 * @param {object} state ledger state ({ customers: [...] })
 * @param {string} month YYYY-MM (payment date month)
 * @returns {Array<{name, cashCollected, paymentCount}>} sorted by cash desc.
 */
export function buildCollectorScorecards(state, month, referenceDate = new Date()) {
  const targetMonth = normalizeScorecardMonth(month, referenceDate);
  const byCollector = new Map();
  const customers = Array.isArray(state?.customers) ? state.customers : [];
  for (const customer of customers) {
    if (!customer || typeof customer !== 'object') continue;
    for (const bill of (Array.isArray(customer.bills) ? customer.bills : [])) {
      if (!bill || typeof bill !== 'object') continue;
      for (const payment of (Array.isArray(bill.payments) ? bill.payments : [])) {
        if (!payment || typeof payment !== 'object') continue;
        if (isVoidedPayment(payment)) continue;
        if (monthOfDate(payment.date) !== targetMonth) continue;
        const collector = resolveShopCollector(payment.method, payment.paidBy);
        if (!collector) continue;
        const entry = byCollector.get(collector) || { name: collector, cashCollected: 0, paymentCount: 0 };
        entry.cashCollected = round2(entry.cashCollected + moneyValue(payment.amount));
        entry.paymentCount += 1;
        byCollector.set(collector, entry);
      }
    }
  }
  return [...byCollector.values()].sort((a, b) =>
    b.cashCollected - a.cashCollected || a.name.localeCompare(b.name));
}

/**
 * New connections recorded in a month (PR #398 dating: connectionDate
 * first, then addedOn — the dashboard.js join-month rule). This is the
 * team total; splitNewConnectionsByInstaller breaks the same total down
 * per installer.
 */
export function countNewConnections(customers, month, referenceDate = new Date()) {
  const targetMonth = normalizeScorecardMonth(month, referenceDate);
  let count = 0;
  for (const customer of (Array.isArray(customers) ? customers : [])) {
    if (!customer || typeof customer !== 'object') continue;
    const joined = monthOfDate(customer.connectionDate) || monthOfDate(customer.addedOn);
    if (joined === targetMonth) count += 1;
  }
  return count;
}

/**
 * SISP-173: the month's new connections split by the installer recorded
 * on each customer (installedByLineman, grouped by linemanNameKey).
 * Conservation invariant: sum(byInstaller.count) + unrecorded === total,
 * and total === countNewConnections for the same input — connections
 * with no recorded installer are never dropped, they land in the
 * explicit unrecorded ("Team / not recorded") bucket.
 *
 * @returns {{total: number, byInstaller: Array<{name, key, count}>, unrecorded: number}}
 *   byInstaller sorted by count desc, then name.
 */
export function splitNewConnectionsByInstaller(customers, month, referenceDate = new Date()) {
  const targetMonth = normalizeScorecardMonth(month, referenceDate);
  const byKey = new Map();
  let unrecorded = 0;
  let total = 0;
  for (const customer of (Array.isArray(customers) ? customers : [])) {
    if (!customer || typeof customer !== 'object') continue;
    const joined = monthOfDate(customer.connectionDate) || monthOfDate(customer.addedOn);
    if (joined !== targetMonth) continue;
    total += 1;
    const key = linemanNameKey(customer.installedByLineman);
    if (!key) { unrecorded += 1; continue; }
    const entry = byKey.get(key) || { name: cleanText(customer.installedByLineman).replace(/\s+/g, ' '), key, count: 0 };
    entry.count += 1;
    byKey.set(key, entry);
  }
  const byInstaller = [...byKey.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return { total, byInstaller, unrecorded };
}

/** The full monthly scorecard bundle the dashboard card + modal render. */
export function buildMonthlyScorecard({ state, tickets, complaints, roznamchaDays } = {}, month, referenceDate = new Date()) {
  const targetMonth = normalizeScorecardMonth(month, referenceDate);
  return {
    month: targetMonth,
    linemen: buildLinemanScorecards({ tickets, complaints, roznamchaDays, customers: state?.customers }, targetMonth),
    collectors: buildCollectorScorecards(state, targetMonth),
    newConnections: countNewConnections(state?.customers, targetMonth),
    newConnectionsSplit: splitNewConnectionsByInstaller(state?.customers, targetMonth)
  };
}

/**
 * Dashboard card + modal controller. getState() returns the live ledger
 * state; tickets / complaints / roznamcha days are read through their own
 * modules' loaders, exactly like the dashboard's other summary cards.
 * Returns null when the dialog is absent (non-browser / tests).
 */
export function setupLinemanScorecardModal(getState) {
  const dialog = typeof document !== 'undefined' ? document.getElementById('linemanScorecardModal') : null;
  if (!dialog) return null;
  const $ = (id) => dialog.querySelector(`#${id}`);

  const readScorecard = (month) => {
    let state = null;
    try { state = typeof getState === 'function' ? getState() : null; } catch { state = null; }
    return buildMonthlyScorecard({
      state,
      tickets: loadTickets(),
      complaints: loadComplaints(),
      roznamchaDays: loadRoznamchaDays()
    }, month);
  };

  function render() {
    const monthInput = $('linemanScorecardMonth');
    const month = normalizeScorecardMonth(monthInput?.value || scorecardMonthNow());
    if (monthInput && monthInput.value !== month) monthInput.value = month;
    const scorecard = readScorecard(month);

    const newConnEl = $('linemanScorecardNewConnections');
    if (newConnEl) {
      const split = scorecard.newConnectionsSplit || { byInstaller: [], unrecorded: 0 };
      newConnEl.innerHTML = `<p><span>${escapeHtml(t('lineman_new_connections', null, { count: scorecard.newConnections }))}</span></p>`
        + split.byInstaller.map((entry) => `<p><span>${escapeHtml(t('lineman_new_connections_installer', null, { name: entry.name }))}</span><strong>${entry.count}</strong></p>`).join('')
        + (split.unrecorded > 0 ? `<p><span>${escapeHtml(t('lineman_new_connections_unrecorded'))}</span><strong>${split.unrecorded}</strong></p>` : '')
        + `<p class="lineman-note">${escapeHtml(t('lineman_new_connections_note'))}</p>`;
    }

    const listEl = $('linemanScorecardList');
    if (listEl) {
      listEl.innerHTML = scorecard.linemen.length === 0
        ? `<p class="lineman-empty">${escapeHtml(t('lineman_empty'))}</p>`
        : scorecard.linemen.map((person) => `
          <article class="lineman-card">
            <p class="lineman-card-name"><strong>${escapeHtml(person.name)}</strong></p>
            <p><span>${escapeHtml(t('lineman_complaints_resolved'))}</span><strong>${person.complaintsResolved}</strong></p>
            <p><span>${escapeHtml(t('lineman_tickets_resolved'))}</span><strong>${person.ticketsResolved}</strong></p>
            <p><span>${escapeHtml(t('lineman_tickets_open'))}</span><strong>${person.ticketsOpen}</strong></p>
            <p><span>${escapeHtml(t('lineman_installed_count'))}</span><strong>${person.newConnections}</strong></p>
            <p><span>${escapeHtml(t('lineman_petty_spent'))}</span><strong>${escapeHtml(formatScorecardPKR(person.pettyCashSpent))}</strong></p>
            ${person.pettyCashByCategory.map((line) => `<p class="lineman-sub"><span>${escapeHtml(line.category)}</span><strong>${escapeHtml(formatScorecardPKR(line.amount))}</strong></p>`).join('')}
          </article>`).join('');
    }

    const collectorsEl = $('linemanCollectorList');
    if (collectorsEl) {
      collectorsEl.innerHTML = scorecard.collectors.length === 0
        ? `<p class="lineman-empty">${escapeHtml(t('lineman_collectors_empty'))}</p>`
        : scorecard.collectors.map((collector) => `
          <article class="lineman-card">
            <p class="lineman-card-name"><strong>${escapeHtml(collector.name)}</strong></p>
            <p><span>${escapeHtml(t('lineman_cash_collected'))}</span><strong>${escapeHtml(formatScorecardPKR(collector.cashCollected))}</strong></p>
            <p><span>${escapeHtml(t('lineman_payments_count', null, { count: collector.paymentCount }))}</span><strong>${collector.paymentCount}</strong></p>
          </article>`).join('');
    }
  }

  const monthInput = $('linemanScorecardMonth');
  if (monthInput) {
    monthInput.value = scorecardMonthNow();
    monthInput.addEventListener('change', render);
  }
  const closeBtn = $('linemanScorecardCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', () => dialog.close());
  const openBtn = typeof document !== 'undefined' ? document.getElementById('openLinemanScorecardModalBtn') : null;
  if (openBtn) {
    openBtn.addEventListener('click', () => {
      render();
      dialog.showModal();
    });
  }

  return { render };
}
