/**
 * roznamcha.js — SISP-11: Daily Cash Roznamcha (Cash Drawer and Lineman
 * Petty Cash Register).
 *
 * Problem: during daily operations cash comes in from several sources
 * (door-to-door cash, Waseem Abbasi Shop handover, Hassan Shop handover)
 * while small field expenses (bike petrol, splicing tape, RJ45 connectors,
 * tea) are paid out of the cash drawer with no daily closing reconciliation.
 *
 * Design (reuse, not fork):
 * - Inflows are DERIVED live, never stored twice: today's direct Cash bill
 *   payments come from the ledger state (payment.method === 'Cash' and
 *   payment.date === day), and today's shop handovers come from the SISP-1
 *   settlement records (sisp_shop_settlements_v1, settlement.date === day).
 *   Shop-method bill payments are NOT direct drawer cash — they only enter
 *   the drawer when the shop hands the cash over, so they are never counted
 *   twice.
 * - The persistent day ledger (localStorage sisp_roznamcha_v1) stores only
 *   what the drawer itself owns: petty-cash outflows plus, once closed, a
 *   frozen snapshot (opening, inflows, expected closing, counted cash,
 *   discrepancy). A closed day never changes when later payments are
 *   corrected; reopening drops the snapshot and the day goes live again.
 * - Opening balance auto-carries from the latest CLOSED day before this
 *   date. An unclosed previous day does not carry — its expected closing
 *   is not a fact yet.
 * - Petty outflows live ONLY in this ledger. They are not written into the
 *   main Expenses ledger, so expense totals never double-count.
 *
 * This module imports loadShopSettlements from shop-settlement.js only.
 * shop-settlement.js imports nothing from core.js, so there is no module
 * cycle. PKR formatting and PKT dates are small local helpers mirroring
 * shop-settlement.js. Tests use synthetic data only.
 */

import { loadShopSettlements } from './shop-settlement.js';

export const ROZNAMCHA_KEY = 'sisp_roznamcha_v1';

export const ROZNAMCHA_CATEGORIES = Object.freeze([
  'Petrol / Bike Fuel',
  'RJ45 / Patch Cord',
  'Fiber Splicing',
  'Lineman Allowance',
  'Other'
]);

const PAKISTAN_TIME_ZONE = 'Asia/Karachi';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function moneyValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function cleanText(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\r\n\u2028\u2029]+/g, ' ').trim().slice(0, maxLength);
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

/** YYYY-MM-DD in Pakistan time. */
export function pakistanToday(referenceDate = new Date()) {
  const date = referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime())
    ? referenceDate
    : new Date();
  const parts = zonedParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function formatRoznamchaPKR(value) {
  if (value === null || value === undefined || value === '') return 'Not set';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'Not set';
  const formatter = new Intl.NumberFormat('en-PK', {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2
  });
  return `PKR ${formatter.format(amount)}`;
}

/** One petty-cash outflow, sanitized — null when unusable. */
export function sanitizeOutflow(outflow) {
  if (!outflow || typeof outflow !== 'object') return null;
  const category = ROZNAMCHA_CATEGORIES.includes(outflow.category) ? outflow.category : null;
  const amount = moneyValue(outflow.amount);
  if (!category || !(amount > 0) || Math.round(amount * 100) !== amount * 100) return null;
  return {
    id: typeof outflow.id === 'string' && outflow.id ? outflow.id : `out-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    category,
    amount: round2(amount),
    lineman: cleanText(outflow.lineman, 100),
    note: cleanText(outflow.note, 200)
  };
}

/** One day record, sanitized — null when the date is unusable. */
export function sanitizeRoznamchaDay(day) {
  if (!day || typeof day !== 'object') return null;
  if (typeof day.date !== 'string' || !DATE_RE.test(day.date)) return null;
  const outflows = Array.isArray(day.outflows) ? day.outflows.map(sanitizeOutflow).filter(Boolean) : [];
  const closed = day.closed === true;
  const record = { date: day.date, outflows, closed };
  if (day.openingBalance !== undefined) record.openingBalance = round2(moneyValue(day.openingBalance));
  if (closed) {
    record.openingBalance = round2(moneyValue(day.openingBalance));
    record.cashIn = round2(moneyValue(day.cashIn));
    record.shopIn = round2(moneyValue(day.shopIn));
    record.cashPayments = Array.isArray(day.cashPayments) ? day.cashPayments.map((p) => ({
      customerName: cleanText(p?.customerName, 100),
      customerNumber: cleanText(p?.customerNumber, 100),
      amount: round2(moneyValue(p?.amount))
    })).filter((p) => p.amount > 0) : [];
    record.handovers = Array.isArray(day.handovers) ? day.handovers.map((h) => ({
      shop: cleanText(h?.shop, 100),
      amount: round2(moneyValue(h?.amount))
    })).filter((h) => h.amount > 0) : [];
    record.expectedClosing = round2(moneyValue(day.expectedClosing));
    record.closingBalance = round2(moneyValue(day.closingBalance));
    record.countedCash = round2(moneyValue(day.countedCash));
    record.discrepancy = round2(moneyValue(day.discrepancy));
    if (typeof day.closedAt === 'string') record.closedAt = day.closedAt;
  }
  return record;
}

/** Whole day ledger, sanitized and sorted by date. */
export function sanitizeRoznamchaDays(days) {
  if (!Array.isArray(days)) return [];
  const cleaned = days.map(sanitizeRoznamchaDay).filter(Boolean);
  cleaned.sort((a, b) => a.date.localeCompare(b.date));
  return cleaned;
}

export function loadRoznamchaDays(storage) {
  const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
  if (!store) return [];
  try {
    const raw = store.getItem(ROZNAMCHA_KEY);
    if (!raw) return [];
    return sanitizeRoznamchaDays(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveRoznamchaDays(days, storage) {
  const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
  if (!store) return;
  try {
    store.setItem(ROZNAMCHA_KEY, JSON.stringify(sanitizeRoznamchaDays(days)));
  } catch {
    /* storage unavailable — the modal toasts instead of failing silently */
  }
}

function findDay(days, date) {
  return (Array.isArray(days) ? days : []).find((d) => d.date === date) || null;
}

function upsertDay(days, day) {
  const list = sanitizeRoznamchaDays(days);
  const index = list.findIndex((d) => d.date === day.date);
  if (index >= 0) list[index] = sanitizeRoznamchaDay(day);
  else list.push(sanitizeRoznamchaDay(day));
  list.sort((a, b) => a.date.localeCompare(b.date));
  return list.filter(Boolean);
}

/** Direct drawer cash: bill payments with method exactly 'Cash' on this date. */
export function collectDirectCashPayments(state, date) {
  const payments = [];
  const customers = Array.isArray(state?.customers) ? state.customers : [];
  for (const customer of customers) {
    const bills = Array.isArray(customer?.bills) ? customer.bills : [];
    for (const bill of bills) {
      const list = Array.isArray(bill?.payments) ? bill.payments : [];
      for (const payment of list) {
        // SISP-34: voided cash is not drawer cash anymore.
        if (payment?.voided === true) continue;
        if (payment?.date === date && payment?.method === 'Cash') {
          const amount = moneyValue(payment.amount);
          if (amount > 0) {
            payments.push({
              customerName: cleanText(customer.name, 100),
              customerNumber: cleanText(customer.customerNumber, 100),
              amount: round2(amount)
            });
          }
        }
      }
    }
  }
  return payments;
}

/** Shop cash handed over on this date (SISP-1 settlement records). */
export function collectShopHandovers(settlements, date) {
  const handovers = [];
  for (const settlement of Array.isArray(settlements) ? settlements : []) {
    if (settlement?.date === date) {
      const amount = moneyValue(settlement.amount);
      if (amount > 0) {
        handovers.push({ shop: cleanText(settlement.shop, 100), amount: round2(amount) });
      }
    }
  }
  return handovers;
}

/** Opening balance: latest CLOSED day before this date, else 0. */
export function openingBalanceFor(days, date) {
  const closed = sanitizeRoznamchaDays(days)
    .filter((d) => d.closed && d.date < date)
    .sort((a, b) => b.date.localeCompare(a.date));
  if (closed.length === 0) return 0;
  return round2(moneyValue(closed[0].closingBalance));
}

/**
 * Full day view. For a closed day the frozen snapshot is returned, so later
 * payment corrections never rewrite a locked day. For an open day inflows
 * are derived live and the expected closing is computed.
 */
export function buildRoznamchaDay(state, days, date, settlements) {
  const list = sanitizeRoznamchaDays(days);
  const stored = findDay(list, date);
  if (stored?.closed) {
    const outflows = stored.outflows;
    const outTotal = round2(outflows.reduce((sum, o) => sum + o.amount, 0));
    const totalIn = round2(stored.cashIn + stored.shopIn);
    return {
      date,
      closed: true,
      openingBalance: stored.openingBalance,
      cashPayments: stored.cashPayments,
      cashIn: stored.cashIn,
      handovers: stored.handovers,
      shopIn: stored.shopIn,
      totalIn,
      outflows,
      outTotal,
      netToday: round2(totalIn - outTotal),
      expectedClosing: stored.expectedClosing,
      closingBalance: stored.closingBalance,
      countedCash: stored.countedCash,
      discrepancy: stored.discrepancy,
      closedAt: stored.closedAt || ''
    };
  }
  const cashPayments = collectDirectCashPayments(state, date);
  const cashIn = round2(cashPayments.reduce((sum, p) => sum + p.amount, 0));
  const handovers = collectShopHandovers(settlements, date);
  const shopIn = round2(handovers.reduce((sum, h) => sum + h.amount, 0));
  const totalIn = round2(cashIn + shopIn);
  const outflows = stored ? stored.outflows : [];
  const outTotal = round2(outflows.reduce((sum, o) => sum + o.amount, 0));
  const openingBalance = openingBalanceFor(list, date);
  return {
    date,
    closed: false,
    openingBalance,
    cashPayments,
    cashIn,
    handovers,
    shopIn,
    totalIn,
    outflows,
    outTotal,
    netToday: round2(totalIn - outTotal),
    expectedClosing: round2(openingBalance + totalIn - outTotal),
    closingBalance: null,
    countedCash: null,
    discrepancy: null,
    closedAt: ''
  };
}

/** Append a petty-cash outflow to an open day. Throws when closed/invalid. */
export function addRoznamchaOutflow(days, date, outflow) {
  const list = sanitizeRoznamchaDays(days);
  const stored = findDay(list, date);
  if (stored?.closed) throw new Error('This day is closed. Reopen it before adding an expense.');
  const clean = sanitizeOutflow(outflow);
  if (!clean) throw new Error('Enter a valid expense category and an amount greater than zero.');
  const next = stored ? { ...stored, outflows: [...stored.outflows, clean] } : { date, outflows: [clean], closed: false };
  return upsertDay(list, next);
}

/** Remove one petty-cash outflow from an open day. */
export function deleteRoznamchaOutflow(days, date, outflowId) {
  const list = sanitizeRoznamchaDays(days);
  const stored = findDay(list, date);
  if (stored?.closed) throw new Error('This day is closed. Reopen it before removing an expense.');
  if (!stored) return list;
  return upsertDay(list, { ...stored, outflows: stored.outflows.filter((o) => o.id !== outflowId) });
}

/**
 * Lock a day. countedCash null/empty means "counted equals expected".
 * closingBalance is the physical truth (counted cash); discrepancy is
 * counted minus expected (negative = short, positive = extra).
 */
export function closeRoznamchaDay(days, view, countedCash) {
  if (!view || typeof view !== 'object' || view.closed) throw new Error('This day is already closed.');
  const counted = countedCash === null || countedCash === undefined || countedCash === ''
    ? view.expectedClosing
    : round2(moneyValue(countedCash));
  if (!Number.isFinite(counted) || counted < 0) throw new Error('Enter a valid counted cash amount.');
  const frozen = {
    date: view.date,
    outflows: clone(view.outflows),
    closed: true,
    openingBalance: view.openingBalance,
    cashIn: view.cashIn,
    shopIn: view.shopIn,
    cashPayments: clone(view.cashPayments),
    handovers: clone(view.handovers),
    expectedClosing: view.expectedClosing,
    closingBalance: counted,
    countedCash: counted,
    discrepancy: round2(counted - view.expectedClosing),
    closedAt: new Date().toISOString()
  };
  return upsertDay(days, frozen);
}

/** Unlock a day: the snapshot drops and the day goes live again. */
export function reopenRoznamchaDay(days, date) {
  const list = sanitizeRoznamchaDays(days);
  const stored = findDay(list, date);
  if (!stored?.closed) return list;
  return upsertDay(list, { date, outflows: stored.outflows, closed: false });
}

/** Compact Roman Urdu summary — the WhatsApp and thermal text. */
export function generateRoznamchaSummaryText(view) {
  const lines = [];
  lines.push(`📒 Roznamcha — ${view.date}${view.closed ? ' (Band / Closed)' : ''}`);
  lines.push(`Opening: ${formatRoznamchaPKR(view.openingBalance)}`);
  lines.push(`Cash in (door-to-door): ${formatRoznamchaPKR(view.cashIn)} (${view.cashPayments.length} payment${view.cashPayments.length === 1 ? '' : 's'})`);
  for (const handover of view.handovers) {
    lines.push(`Shop handover — ${handover.shop || 'Shop'}: ${formatRoznamchaPKR(handover.amount)}`);
  }
  lines.push(`Total cash in: ${formatRoznamchaPKR(view.totalIn)}`);
  if (view.outflows.length === 0) {
    lines.push('Petty cash out: PKR 0 (koi kharcha nahi)');
  } else {
    for (const outflow of view.outflows) {
      lines.push(`Kharcha — ${outflow.category}: ${formatRoznamchaPKR(outflow.amount)}${outflow.lineman ? ` (${outflow.lineman})` : ''}${outflow.note ? ` — ${outflow.note}` : ''}`);
    }
  }
  lines.push(`Total petty out: ${formatRoznamchaPKR(view.outTotal)}`);
  lines.push(`Net today cash: ${formatRoznamchaPKR(view.netToday)}`);
  lines.push(`Expected closing: ${formatRoznamchaPKR(view.expectedClosing)}`);
  if (view.closed) {
    lines.push(`Counted cash: ${formatRoznamchaPKR(view.countedCash)}`);
    const discrepancy = view.discrepancy;
    lines.push(discrepancy === 0
      ? 'Farq: PKR 0 (barabar)'
      : discrepancy < 0
        ? `Farq: ${formatRoznamchaPKR(Math.abs(discrepancy))} SHORT`
        : `Farq: ${formatRoznamchaPKR(discrepancy)} EXTRA`);
    lines.push(`Closing balance: ${formatRoznamchaPKR(view.closingBalance)}`);
  }
  lines.push('— Shahdara ISP Billing (SIP)');
  return lines.join('\n');
}

/**
 * Dashboard modal controller. Mirrors setupDowntimeAnalyticsModal: the module
 * wires its own open button, renders from getState() + the day ledger, and
 * reports changes through onChanged so the dashboard card refreshes.
 */
export function setupRoznamchaModal(getState, { onToast, onChanged } = {}) {
  const dialog = typeof document !== 'undefined' ? document.getElementById('roznamchaModal') : null;
  if (!dialog) return null;
  const $ = (id) => dialog.querySelector(`#${id}`);
  let date = pakistanToday();

  function currentView() {
    const state = typeof getState === 'function' ? getState() : {};
    return buildRoznamchaDay(state, loadRoznamchaDays(), date, loadShopSettlements());
  }

  function render() {
    const view = currentView();
    const dateInput = $('roznamchaDate');
    if (dateInput && dateInput.value !== date) dateInput.value = date;
    const summaryEl = $('roznamchaSummaryLine');
    if (summaryEl) {
      summaryEl.textContent = view.closed
        ? `Closed day — closing ${formatRoznamchaPKR(view.closingBalance)} · farq ${formatRoznamchaPKR(view.discrepancy)}`
        : `Opening ${formatRoznamchaPKR(view.openingBalance)} · cash in ${formatRoznamchaPKR(view.totalIn)} · petty out ${formatRoznamchaPKR(view.outTotal)} · expected closing ${formatRoznamchaPKR(view.expectedClosing)}`;
    }
    const inflowsEl = $('roznamchaInflows');
    if (inflowsEl) {
      const cashLines = view.cashPayments.length === 0
        ? '<p class="roznamcha-empty">Aaj koi direct cash payment nahi.</p>'
        : view.cashPayments.map((p) => `<p><span>${escapeHtml(p.customerName || p.customerNumber || 'Customer')}</span><strong>${escapeHtml(formatRoznamchaPKR(p.amount))}</strong></p>`).join('');
      const shopLines = view.handovers.length === 0
        ? ''
        : view.handovers.map((h) => `<p><span>Shop handover — ${escapeHtml(h.shop || 'Shop')}</span><strong>${escapeHtml(formatRoznamchaPKR(h.amount))}</strong></p>`).join('');
      inflowsEl.innerHTML = cashLines + shopLines;
    }
    const outflowsEl = $('roznamchaOutflows');
    if (outflowsEl) {
      outflowsEl.innerHTML = view.outflows.length === 0
        ? '<p class="roznamcha-empty">Aaj koi petty kharcha nahi.</p>'
        : view.outflows.map((o) => `<p><span>${escapeHtml(o.category)}${o.lineman ? ` · ${escapeHtml(o.lineman)}` : ''}${o.note ? ` — ${escapeHtml(o.note)}` : ''}</span><strong>${escapeHtml(formatRoznamchaPKR(o.amount))}</strong>${view.closed ? '' : ` <button type="button" class="text-button" data-roznamcha-delete-outflow="${escapeHtml(o.id)}" aria-label="Remove expense">✕</button>`}</p>`).join('');
      if (!view.closed) {
        outflowsEl.querySelectorAll('[data-roznamcha-delete-outflow]').forEach((btn) => {
          btn.addEventListener('click', () => {
            try {
              saveRoznamchaDays(deleteRoznamchaOutflow(loadRoznamchaDays(), date, btn.getAttribute('data-roznamcha-delete-outflow')));
              render();
              if (typeof onChanged === 'function') onChanged();
            } catch (error) {
              if (typeof onToast === 'function') onToast(error.message);
            }
          });
        });
      }
    }
    const expectedEl = $('roznamchaExpectedLine');
    if (expectedEl) {
      expectedEl.textContent = view.closed
        ? `Closing balance: ${formatRoznamchaPKR(view.closingBalance)}`
        : `Expected closing cash in hand: ${formatRoznamchaPKR(view.expectedClosing)}`;
    }
    const closeBlock = $('roznamchaCloseBlock');
    if (closeBlock) closeBlock.hidden = view.closed;
    const reopenBlock = $('roznamchaReopenBlock');
    if (reopenBlock) reopenBlock.hidden = !view.closed;
    const form = $('roznamchaOutflowForm');
    if (form) form.hidden = view.closed;
  }

  const dateInput = $('roznamchaDate');
  if (dateInput) {
    dateInput.value = date;
    dateInput.addEventListener('change', () => {
      if (DATE_RE.test(dateInput.value)) { date = dateInput.value; render(); }
    });
  }
  const addBtn = $('roznamchaAddOutflowBtn');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      try {
        const category = $('roznamchaOutCategory')?.value || '';
        const amount = Number($('roznamchaOutAmount')?.value || '');
        const lineman = $('roznamchaOutLineman')?.value || '';
        const note = $('roznamchaOutNote')?.value || '';
        saveRoznamchaDays(addRoznamchaOutflow(loadRoznamchaDays(), date, { category, amount, lineman, note }));
        const amountEl = $('roznamchaOutAmount');
        const linemanEl = $('roznamchaOutLineman');
        const noteEl = $('roznamchaOutNote');
        if (amountEl) amountEl.value = '';
        if (linemanEl) linemanEl.value = '';
        if (noteEl) noteEl.value = '';
        render();
        if (typeof onChanged === 'function') onChanged();
        if (typeof onToast === 'function') onToast('Petty kharcha darj ho gaya.');
      } catch (error) {
        if (typeof onToast === 'function') onToast(error.message);
      }
    });
  }
  const closeBtn = $('roznamchaCloseDayBtn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      try {
        const countedRaw = $('roznamchaCountedCash')?.value || '';
        const counted = countedRaw === '' ? null : Number(countedRaw);
        saveRoznamchaDays(closeRoznamchaDay(loadRoznamchaDays(), currentView(), counted));
        const countedEl = $('roznamchaCountedCash');
        if (countedEl) countedEl.value = '';
        render();
        if (typeof onChanged === 'function') onChanged();
        if (typeof onToast === 'function') onToast('Roznamcha band ho gaya — din lock ho gaya.');
      } catch (error) {
        if (typeof onToast === 'function') onToast(error.message);
      }
    });
  }
  const reopenBtn = $('roznamchaReopenBtn');
  if (reopenBtn) {
    reopenBtn.addEventListener('click', () => {
      saveRoznamchaDays(reopenRoznamchaDay(loadRoznamchaDays(), date));
      render();
      if (typeof onChanged === 'function') onChanged();
      if (typeof onToast === 'function') onToast('Din dobara khol diya gaya.');
    });
  }
  const copyBtn = $('roznamchaCopySummaryBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const text = generateRoznamchaSummaryText(currentView());
      try {
        await navigator.clipboard.writeText(text);
        if (typeof onToast === 'function') onToast('Roznamcha summary copy ho gaya — WhatsApp par paste karein.');
      } catch {
        if (typeof onToast === 'function') onToast(text);
      }
    });
  }
  const closeDialogBtn = $('roznamchaCloseBtn');
  if (closeDialogBtn) closeDialogBtn.addEventListener('click', () => dialog.close());
  const openBtn = typeof document !== 'undefined' ? document.getElementById('openRoznamchaModalBtn') : null;
  if (openBtn) {
    openBtn.addEventListener('click', () => {
      date = pakistanToday();
      render();
      dialog.showModal();
    });
  }
  return {
    open({ date: requestedDate } = {}) {
      if (requestedDate && DATE_RE.test(requestedDate)) date = requestedDate;
      render();
      dialog.showModal();
    },
    refresh() { render(); }
  };
}
