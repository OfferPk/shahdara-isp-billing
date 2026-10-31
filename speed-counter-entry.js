/**
 * speed-counter-entry.js — SISP-99: Keyboard-First "Speed Batch Counter
 * Entry" modal (Ctrl+Shift+E).
 *
 * The evening counter problem: 20–40 paper slips and shop receipts come
 * in after the field rounds. Entering them one by one through Quick
 * Collect (search, open sheet, confirm, close, repeat) is slow. This
 * module is a spreadsheet-style sheet for that pile: one row per slip —
 * Connection ID/Name → Tab → Amount → Tab → Method letter → Enter — with
 * session running totals, built for keyboard-only flow.
 *
 * Layers, deliberately separated:
 *  - PURE mapping + resolution + validation: the method letters map onto
 *    the app's REAL recorded payment-method values (core PAYMENT_METHODS)
 *    — C Cash, W "Cash at Waseem Abbasi shop", H "Cash at Hassan shop",
 *    B "Cash at Balla shop", E Easypaisa, N NayaPay. No new method string
 *    is ever invented: a wrong string would silently corrupt method
 *    totals and shop settlement. (JazzCash, Bank Transfer and Raast have
 *    no speed letter — the spec names exactly C/W/H/B/E/N — and stay
 *    available in Quick Collect as before.)
 *  - PURE batch submit (submitSpeedEntryBatch): rows are validated and
 *    recorded ONE BY ONE through the injected recorder — in the app that
 *    is executeQuickCollection from nav-quick-collect.js, the exact same
 *    payment path as a hand-entered Quick Collect (SISP-33 FIFO
 *    allocation, normal receipt, shop balances). This module never
 *    writes a payment itself. A row that fails validation (unknown or
 *    ambiguous customer, archived, FREE connection, bad amount, bad
 *    method letter) or whose recording throws is reported per-row and
 *    left editable; rows already recorded stay recorded — a retry only
 *    ever touches rows that are not yet recorded, so nothing is ever
 *    double-submitted or rolled back.
 *  - THIN browser glue (setupSpeedCounterEntryModal): the dialog grid.
 *    Typing only edits the in-memory sheet — NOTHING is recorded until a
 *    row is submitted (Enter on the row, or "Record all pending rows").
 *    Closing the modal mid-session loses nothing already recorded: the
 *    host persists each recorded row through the normal save path.
 *
 * Customer resolution: a digits-only cell is the connection ID
 * (customerNumber, exact). Anything else goes through the house search
 * (core searchCustomers / customerMatchesQuery) over non-archived
 * customers; an exact full-name match wins outright, exactly one match
 * resolves, more than one is AMBIGUOUS — the row asks the operator to
 * pick, it never guesses, so a payment can never land on the wrong
 * customer silently.
 *
 * Tests use synthetic data only.
 */

import { PAYMENT_METHODS, formatPKR, searchCustomers } from './core.js';
import { t } from './nav-language.js';

// ---------------------------------------------------------------- constants

/**
 * Speed letter → real recorded payment method. Every value MUST stay a
 * member of core PAYMENT_METHODS (the batch tests pin this):
 *  C — 'Cash'                        (core.js PAYMENT_METHODS)
 *  W — 'Cash at Waseem Abbasi shop'  (shop-settlement.js collector)
 *  H — 'Cash at Hassan shop'         (legacy string, kept per SISP-99)
 *  B — 'Cash at Balla shop'          (legacy string, kept per SISP-99)
 *  E — 'Easypaisa'                   (core.js PAYMENT_METHODS)
 *  N — 'NayaPay'                     (core.js PAYMENT_METHODS)
 *
 * OWNER-CASH-SHOP: H and B keep their legacy recorded strings (the
 * letters' meaning never changed), and both settle onto the ONE unified
 * collector "Hassan Balla Shop" through resolveShopCollector.
 */
export const SPEED_ENTRY_METHOD_KEYS = Object.freeze({
  C: 'Cash',
  W: 'Cash at Waseem Abbasi shop',
  H: 'Cash at Hassan shop',
  B: 'Cash at Balla shop',
  E: 'Easypaisa',
  N: 'NayaPay'
});

/** Rows the sheet opens with; Enter on the last row grows it as needed. */
export const SPEED_ENTRY_INITIAL_ROWS = 5;
/** Hard cap so a runaway sheet can never freeze the counter UI. */
export const SPEED_ENTRY_MAX_ROWS = 100;

// ---------------------------------------------------------------- helpers

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function normalizeName(value) {
  return String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase();
}

// ---------------------------------------------------------------- method map

/** The real payment method for a speed letter ('c', ' W ', 'b'…), or null. */
export function methodForSpeedKey(key) {
  const letter = String(key ?? '').trim().toUpperCase().charAt(0);
  return Object.hasOwn(SPEED_ENTRY_METHOD_KEYS, letter) ? SPEED_ENTRY_METHOD_KEYS[letter] : null;
}

/** The speed letter for a real payment method, or null when it has none. */
export function speedKeyForMethod(method) {
  for (const [letter, value] of Object.entries(SPEED_ENTRY_METHOD_KEYS)) {
    if (value === method) return letter;
  }
  return null;
}

// ---------------------------------------------------------------- resolution

/**
 * Resolve the "Connection ID/Name" cell against the ledger.
 * Returns one of:
 *  { status: 'empty' }
 *  { status: 'resolved', customer }
 *  { status: 'ambiguous', candidates }  — operator must pick; never guess
 *  { status: 'archived', customer }     — only match(es) are archived
 *  { status: 'not-found' }
 * Archived customers never resolve: they cannot receive payments.
 */
export function resolveSpeedEntryCustomer(state, queryText) {
  const query = String(queryText ?? '').trim();
  if (!query) return { status: 'empty' };
  const customers = Array.isArray(state?.customers) ? state.customers : [];

  // Connection ID: digits (an optional leading # is the roster style).
  // A digits-only cell is ALWAYS a connection ID and never falls through
  // to the fuzzy house search: the search also matches ledger fields
  // (bill ids, amounts, months), so a missing number could otherwise
  // "resolve" against a random bill id — a digits miss is a hard
  // not-found, deterministically.
  const numberText = query.replace(/^#\s*/, '').trim();
  if (/^\d+$/.test(numberText)) {
    const byNumber = customers.find((c) => Number(c.customerNumber) === Number(numberText));
    if (!byNumber) return { status: 'not-found' };
    return byNumber.archived
      ? { status: 'archived', customer: byNumber }
      : { status: 'resolved', customer: byNumber };
  }

  const matches = searchCustomers(state, query);
  const active = matches.filter((c) => !c.archived);
  if (active.length === 0) {
    return matches.length > 0
      ? { status: 'archived', customer: matches[0] }
      : { status: 'not-found' };
  }
  if (active.length === 1) return { status: 'resolved', customer: active[0] };

  // Several house-search hits: an exact full-name entry wins outright
  // (the other hits matched fuzzily through ledger fields), otherwise
  // the operator picks — the sheet never guesses.
  const wanted = normalizeName(query);
  const exact = active.filter((c) => normalizeName(c.name) === wanted || normalizeName(c.nameUrdu) === wanted);
  if (exact.length === 1) return { status: 'resolved', customer: exact[0] };
  const sorted = [...active].sort((a, b) => (a.customerNumber ?? 0) - (b.customerNumber ?? 0));
  return { status: 'ambiguous', candidates: sorted };
}

// ---------------------------------------------------------------- validation

/** True when a sheet row carries no input at all (a blank draft line). */
export function isBlankSpeedRow(row) {
  if (!row) return true;
  return String(row.customerQuery ?? '').trim() === ''
    && String(row.amount ?? '').trim() === ''
    && String(row.methodKey ?? '').trim() === '';
}

/**
 * Validate one sheet row against the (current) ledger state.
 * Returns { ok, customer, amount, method, status, candidates, errors }
 * where errors are { code, message } — codes are stable for tests, the
 * messages are localized display text. A FREE connection is refused
 * here: FREE connections are never billed, so counter money for one is
 * always an operator mistake worth surfacing, never a silent recording.
 */
export function validateSpeedEntryRow(state, row) {
  const errors = [];
  let customer = null;
  let status = 'error';
  let candidates = null;

  const resolution = resolveSpeedEntryCustomer(state, row?.customerQuery);
  if (resolution.status === 'resolved') {
    customer = resolution.customer;
    status = 'ok';
    if (customer.isFreeConnection === true) {
      errors.push({ code: 'free-connection', message: t('speed_entry_error_free') });
    }
  } else if (resolution.status === 'ambiguous') {
    status = 'ambiguous';
    candidates = resolution.candidates;
    errors.push({ code: 'ambiguous-customer', message: t('speed_entry_error_ambiguous') });
  } else if (resolution.status === 'archived') {
    errors.push({ code: 'archived-customer', message: t('speed_entry_error_archived') });
  } else if (resolution.status === 'empty') {
    errors.push({ code: 'customer-required', message: t('speed_entry_error_customer_required') });
  } else {
    errors.push({ code: 'customer-not-found', message: t('speed_entry_error_not_found') });
  }

  const amount = Number(row?.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    errors.push({ code: 'invalid-amount', message: t('speed_entry_error_amount') });
  }

  const method = methodForSpeedKey(row?.methodKey);
  if (!method) {
    errors.push({ code: 'invalid-method', message: t('speed_entry_error_method') });
  }

  return {
    ok: errors.length === 0 && customer !== null,
    customer,
    amount: Number.isFinite(amount) ? amount : NaN,
    method,
    status: errors.length === 0 ? 'ok' : status,
    candidates,
    errors
  };
}

// ---------------------------------------------------------------- batch submit

/**
 * Session totals over submit results: RECORDED rows only.
 * Returns { count, amount, byMethod: { [method]: { count, amount } } }.
 */
export function summarizeSpeedEntryResults(results) {
  const byMethod = {};
  let count = 0;
  let amount = 0;
  for (const result of Array.isArray(results) ? results : []) {
    if (!result || result.status !== 'recorded') continue;
    const value = Number(result.amount);
    if (!Number.isFinite(value)) continue;
    count += 1;
    amount += value;
    const bucket = byMethod[result.method] ?? (byMethod[result.method] = { count: 0, amount: 0 });
    bucket.count += 1;
    bucket.amount += value;
  }
  return { count, amount, byMethod };
}

/**
 * Record a batch of sheet rows, one by one, through the injected
 * recorder (`execute` — executeQuickCollection in the app). State is
 * threaded row to row, so a second slip for the same customer sees the
 * first slip already recorded, exactly like hand entry.
 *
 * Rows already marked status 'recorded' are echoed back as recorded and
 * NEVER submitted again; blank draft rows are skipped silently. Every
 * other row is validated against the evolving state and either recorded
 * or reported with its errors — one bad row never blocks or rolls back
 * the rest of the batch.
 *
 * Returns { nextState, results, totals, recordedCount } where results
 * has one entry per input row, in order:
 *  { rowId, status: 'recorded', receipt, customerId, customerName,
 *    customerNumber, amount, method }
 *  { rowId, status: 'ambiguous', errors, candidates }
 *  { rowId, status: 'error', errors }
 *  { rowId, status: 'blank' }
 */
export function submitSpeedEntryBatch(state, rows, { execute, month, date, referenceDate = new Date() } = {}) {
  if (typeof execute !== 'function') {
    throw new Error('submitSpeedEntryBatch requires an execute recorder (executeQuickCollection).');
  }
  let nextState = state;
  const results = [];
  let recordedCount = 0;

  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row) continue;
    if (row.status === 'recorded') {
      // Already in the ledger from an earlier submit in this session:
      // echo it for the totals, never record it twice.
      results.push({
        rowId: row.id,
        status: 'recorded',
        skipped: true,
        receipt: row.receipt ?? null,
        customerId: row.customerId ?? null,
        customerName: row.customerName ?? '',
        customerNumber: row.customerNumber ?? '',
        amount: Number(row.amount),
        method: methodForSpeedKey(row.methodKey) ?? row.method ?? null
      });
      continue;
    }
    if (isBlankSpeedRow(row)) {
      results.push({ rowId: row.id, status: 'blank' });
      continue;
    }
    const check = validateSpeedEntryRow(nextState, row);
    if (!check.ok) {
      results.push({
        rowId: row.id,
        status: check.status === 'ambiguous' ? 'ambiguous' : 'error',
        errors: check.errors,
        candidates: check.candidates ?? null
      });
      continue;
    }
    try {
      const { nextState: after, receipt } = execute(nextState, {
        customerId: check.customer.id,
        month,
        amount: check.amount,
        date,
        method: check.method
      }, referenceDate);
      nextState = after;
      recordedCount += 1;
      results.push({
        rowId: row.id,
        status: 'recorded',
        receipt,
        customerId: check.customer.id,
        customerName: check.customer.name,
        customerNumber: check.customer.customerNumber,
        amount: check.amount,
        method: check.method
      });
    } catch (error) {
      results.push({
        rowId: row.id,
        status: 'error',
        errors: [{ code: 'recorder-failed', message: error?.message ?? String(error) }]
      });
    }
  }

  return { nextState, results, totals: summarizeSpeedEntryResults(results), recordedCount };
}

// ---------------------------------------------------------------- modal glue

/**
 * Dialog controller, following the house modal pattern (Group Billing /
 * Suspense Payments): getState supplies the live app state; onRecordBatch
 * (rows, { date, month }) is the app's batch implementation — it runs
 * submitSpeedEntryBatch with executeQuickCollection, persists, re-renders
 * and returns its result (or throws). currentMonth / today supply the
 * PKT billing month and date defaults.
 *
 * Ctrl+Shift+E opens the sheet — but only when no other dialog owns the
 * keyboard (any other open <dialog> suppresses the shortcut), so the
 * sheet never hijacks a flow already in progress.
 */
export function setupSpeedCounterEntryModal(getState, {
  onRecordBatch, onToast, onConfirm, currentMonth, today
} = {}) {
  const dialog = typeof document !== 'undefined' ? document.getElementById('speedEntryModal') : null;
  if (!dialog) return null;
  const $ = (id) => dialog.querySelector(`#${id}`);
  const rowsEl = $('speedEntryRows');
  const totalsEl = $('speedEntryTotals');
  const dateEl = $('speedEntryDate');
  if (!rowsEl || !totalsEl) return null;

  let rowSeq = 0;
  const newRow = () => ({
    id: `speed-row-${++rowSeq}`,
    customerQuery: '',
    amount: '',
    methodKey: '',
    status: 'draft',
    errors: [],
    candidates: null,
    receipt: null,
    customerId: null,
    customerName: '',
    customerNumber: ''
  });
  // The sheet survives close/reopen within the page session: recorded
  // rows stay visible (and locked) and unsubmitted drafts are not lost
  // to an accidental Esc. Recorded payments themselves are already
  // persisted by the host the moment they record.
  let rows = Array.from({ length: SPEED_ENTRY_INITIAL_ROWS }, () => newRow());
  let sessionResults = [];

  const getMonth = () => {
    try { return typeof currentMonth === 'function' ? currentMonth() : ''; } catch { return ''; }
  };
  const getToday = () => {
    try { return typeof today === 'function' ? today() : ''; } catch { return ''; }
  };

  function rowStatusHtml(row) {
    if (row.status === 'recorded') {
      const receiptNo = row.receipt?.receiptNumber ? ` · ${escapeHtml(row.receipt.receiptNumber)}` : '';
      return `<div class="speed-entry-status-cell"><span class="speed-entry-status speed-entry-status-ok">✓ ${escapeHtml(t('speed_entry_status_recorded'))}${receiptNo}</span></div>`;
    }
    if (row.errors?.length) {
      const picks = row.status === 'ambiguous' && Array.isArray(row.candidates)
        ? `<span class="speed-entry-picks">${escapeHtml(t('speed_entry_status_pick'))} ${row.candidates.map((c) => `<button type="button" class="speed-entry-pick" data-speed-pick="${escapeHtml(row.id)}" data-speed-customer-number="${escapeHtml(String(c.customerNumber ?? ''))}">#${escapeHtml(String(c.customerNumber ?? ''))} ${escapeHtml(c.name ?? '')}</button>`).join(' ')}</span>`
        : '';
      return `<div class="speed-entry-status-cell"><span class="speed-entry-status speed-entry-status-error">${escapeHtml(row.errors[0].message)}</span>${picks}</div>`;
    }
    return '<div class="speed-entry-status-cell"><span class="speed-entry-status"></span></div>';
  }

  function render(focusRowId = null, focusField = 'customer') {
    rowsEl.innerHTML = rows.map((row, index) => {
      const locked = row.status === 'recorded';
      return `
      <div class="speed-entry-row${locked ? ' speed-entry-row-recorded' : ''}" data-speed-row="${escapeHtml(row.id)}">
        <span class="speed-entry-rownum" aria-hidden="true">${index + 1}</span>
        <input class="form-input speed-entry-customer" type="text" data-speed-field="customer" value="${escapeHtml(row.customerQuery)}" placeholder="${escapeHtml(t('speed_entry_customer_placeholder'))}" aria-label="${escapeHtml(t('speed_entry_col_customer'))}" autocomplete="off" autocapitalize="off" spellcheck="false" ${locked ? 'disabled' : ''}>
        <input class="form-input speed-entry-amount" type="number" min="1" step="any" inputmode="decimal" data-speed-field="amount" value="${escapeHtml(row.amount)}" placeholder="${escapeHtml(t('speed_entry_amount_placeholder'))}" aria-label="${escapeHtml(t('speed_entry_col_amount'))}" ${locked ? 'disabled' : ''}>
        <input class="form-input speed-entry-method" type="text" maxlength="1" data-speed-field="method" value="${escapeHtml(row.methodKey)}" placeholder="${escapeHtml(t('speed_entry_method_placeholder'))}" aria-label="${escapeHtml(t('speed_entry_col_method'))}" autocomplete="off" autocapitalize="characters" spellcheck="false" ${locked ? 'disabled' : ''}>
        <span class="speed-entry-method-name">${escapeHtml(methodForSpeedKey(row.methodKey) ?? '')}</span>
        ${rowStatusHtml(row)}
      </div>`;
    }).join('');
    const totals = summarizeSpeedEntryResults(sessionResults);
    totalsEl.textContent = totals.count > 0
      ? t('speed_entry_totals', null, { count: totals.count, amount: formatPKR(totals.amount) })
      : t('speed_entry_totals_empty');
    if (focusRowId) {
      const target = rowsEl.querySelector(`[data-speed-row="${CSS.escape(focusRowId)}"] [data-speed-field="${focusField}"]`);
      target?.focus();
      target?.select?.();
    }
  }

  function syncRowFromDom(rowEl) {
    const row = rows.find((r) => r.id === rowEl.dataset.speedRow);
    if (!row || row.status === 'recorded') return null;
    row.customerQuery = rowEl.querySelector('[data-speed-field="customer"]')?.value ?? '';
    row.amount = rowEl.querySelector('[data-speed-field="amount"]')?.value ?? '';
    row.methodKey = (rowEl.querySelector('[data-speed-field="method"]')?.value ?? '').toUpperCase();
    return row;
  }

  function applyResults(results) {
    sessionResults = results;
    for (const result of results) {
      const row = rows.find((r) => r.id === result.rowId);
      if (!row) continue;
      if (result.status === 'recorded') {
        row.status = 'recorded';
        row.errors = [];
        row.candidates = null;
        row.receipt = result.receipt ?? row.receipt;
        row.customerId = result.customerId ?? row.customerId;
        row.customerName = result.customerName ?? '';
        row.customerNumber = result.customerNumber ?? '';
        if (result.receipt?.customerName) row.customerQuery = result.receipt.customerName;
      } else if (result.status === 'ambiguous' || result.status === 'error') {
        row.status = result.status;
        row.errors = result.errors ?? [];
        row.candidates = result.candidates ?? null;
      }
    }
  }

  function submitRows(subset) {
    if (typeof onRecordBatch !== 'function') return { recordedCount: 0 };
    // Submitting one row still sends the whole sheet: rows recorded
    // earlier in the session are echoed back as recorded (never
    // re-recorded), and rows outside the subset are sent blank so the
    // batch skips them untouched this round.
    const wanted = subset ? new Set(subset.map((r) => r.id)) : null;
    const payload = rows.map((row) => {
      if (row.status === 'recorded') return row;
      if (wanted && !wanted.has(row.id)) return { ...row, customerQuery: '', amount: '', methodKey: '' };
      return row;
    });
    let outcome;
    try {
      outcome = onRecordBatch(payload, { date: dateEl?.value || getToday(), month: getMonth() });
    } catch (error) {
      if (typeof onToast === 'function') onToast(error?.message ?? String(error));
      return { recordedCount: 0 };
    }
    if (outcome?.results) applyResults(outcome.results);
    // Session totals derive from the sheet itself: every recorded row,
    // counted exactly once, at the amount/method it was recorded with.
    sessionResults = rows.filter((r) => r.status === 'recorded').map((r) => ({
      rowId: r.id, status: 'recorded', amount: Number(r.amount), method: methodForSpeedKey(r.methodKey)
    }));
    return outcome ?? { recordedCount: 0 };
  }

  function focusNextDraft(afterRowId) {
    const start = rows.findIndex((r) => r.id === afterRowId);
    const next = rows.slice(start + 1).find((r) => r.status !== 'recorded')
      ?? rows.find((r) => r.status !== 'recorded');
    if (next) render(next.id, 'customer');
    else render();
  }

  function ensureTrailingRow() {
    const last = rows[rows.length - 1];
    if (last && !isBlankSpeedRow(last) && rows.length < SPEED_ENTRY_MAX_ROWS) {
      rows.push(newRow());
    }
  }

  // Typing only edits the in-memory sheet — nothing records here.
  rowsEl.addEventListener('input', (event) => {
    const rowEl = event.target.closest('[data-speed-row]');
    if (!rowEl) return;
    const row = syncRowFromDom(rowEl);
    if (!row) return;
    if (event.target.dataset.speedField === 'method') {
      event.target.value = row.methodKey;
      const nameEl = rowEl.querySelector('.speed-entry-method-name');
      if (nameEl) nameEl.textContent = methodForSpeedKey(row.methodKey) ?? '';
    }
    if (row.status === 'error' || row.status === 'ambiguous') {
      row.status = 'draft';
      row.errors = [];
      row.candidates = null;
      const statusEl = rowEl.querySelector('.speed-entry-status');
      if (statusEl) statusEl.textContent = '';
      rowEl.querySelector('.speed-entry-picks')?.remove();
    }
  });

  rowsEl.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    const rowEl = event.target.closest('[data-speed-row]');
    if (!rowEl) return;
    event.preventDefault();
    const row = syncRowFromDom(rowEl);
    if (!row || row.status === 'recorded' || isBlankSpeedRow(row)) {
      if (row) focusNextDraft(row.id);
      return;
    }
    ensureTrailingRow();
    submitRows([row]);
    if (row.status === 'recorded') {
      // Per-row feedback lives in the row's status cell; no toast spam.
      focusNextDraft(row.id);
    } else {
      // Send the operator back to the first field that needs fixing.
      const codes = (row.errors ?? []).map((e) => e.code);
      const field = codes.includes('invalid-amount') ? 'amount'
        : codes.includes('invalid-method') ? 'method'
        : 'customer';
      render(row.id, field);
    }
  });

  rowsEl.addEventListener('click', (event) => {
    const pick = event.target.closest('[data-speed-pick]');
    if (!pick) return;
    const row = rows.find((r) => r.id === pick.dataset.speedPick);
    if (!row) return;
    // Picking a candidate fills the cell with its connection ID — the
    // digits path then resolves exactly that customer on resubmit.
    row.customerQuery = String(pick.dataset.speedCustomerNumber ?? '');
    row.status = 'draft';
    row.errors = [];
    row.candidates = null;
    submitRows([row]);
    if (row.status === 'recorded') focusNextDraft(row.id);
    else render(row.id, 'customer');
  });

  $('speedEntryAddRowBtn')?.addEventListener('click', () => {
    if (rows.length >= SPEED_ENTRY_MAX_ROWS) return;
    const row = newRow();
    rows.push(row);
    render(row.id, 'customer');
  });

  $('speedEntrySubmitAllBtn')?.addEventListener('click', () => {
    for (const rowEl of rowsEl.querySelectorAll('[data-speed-row]')) syncRowFromDom(rowEl);
    const outcome = submitRows(null);
    render();
    if (typeof onToast === 'function') {
      if (outcome?.recordedCount > 0) {
        const totals = summarizeSpeedEntryResults(sessionResults);
        onToast(t('speed_entry_toast_recorded', null, { count: outcome.recordedCount, amount: formatPKR(totals.amount) }));
      } else {
        onToast(t('speed_entry_toast_none'));
      }
    }
  });

  $('speedEntryClearBtn')?.addEventListener('click', () => {
    const reset = () => {
      rows = Array.from({ length: SPEED_ENTRY_INITIAL_ROWS }, () => newRow());
      sessionResults = [];
      render(rows[0]?.id, 'customer');
    };
    if (typeof onConfirm === 'function') {
      onConfirm({
        title: t('speed_entry_clear'),
        message: t('speed_entry_clear_confirm'),
        onConfirm: reset
      });
    } else {
      reset();
    }
  });

  $('speedEntryCloseBtn')?.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  function open() {
    if (dialog.open) return;
    if (dateEl && !dateEl.value) dateEl.value = getToday();
    render();
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    const firstDraft = rows.find((r) => r.status !== 'recorded');
    if (firstDraft) render(firstDraft.id, 'customer');
  }

  // Ctrl+Shift+E opens the sheet — unless another dialog already owns
  // the keyboard (Quick Collect, the command palette, any open modal),
  // in which case the shortcut belongs to that flow and we stay out.
  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('keydown', (event) => {
      if (!event.ctrlKey || !event.shiftKey || event.altKey || event.metaKey) return;
      if (String(event.key ?? '').toUpperCase() !== 'E') return;
      if (dialog.open) return;
      if (document.querySelector('dialog[open]')) return;
      event.preventDefault();
      open();
    });
  }

  return { open, close: () => dialog.close(), render };
}
