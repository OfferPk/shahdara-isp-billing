/**
 * Bulk Collect Cash (Quick Collect batch mode).
 *
 * A collector coming back from a round enters many cash payments in one go:
 * batch date (today by default), a fast entry row (customer, amount, method, collected-by /
 * location note), a picker over customers with a pending balance (search by name, mobile or
 * area; multi-select), a running total, a review list with remove + undo, and one Save that
 * records every payment through the existing Quick Collect payment path
 * (executeQuickCollection → core addPayment), then saves once via the app's onSaveState.
 *
 * Duplicates (same customer twice in the batch, or a payment already recorded for that
 * customer on the batch date) are blocked with an "Already added" popup unless confirmed.
 *
 * Isolated module: builds its own dialogs, opens from the Quick Collect picker, the
 * #/bulk-collect hash, and never replaces existing handlers.
 */
import { PAYMENT_METHODS } from './core.js';
import {
  getPendingCollectionCustomers,
  getCustomerPaymentDefaults,
  executeQuickCollection,
  getPakistanLocalDate,
  countCustomersWithoutFee,
  renderQuickCollectNeedsSetupHtml
} from './nav-quick-collect.js';

export const BULK_COLLECT_HASH = '#/bulk-collect';
/** #/bulk-collect, plus the #collect/bulk and #/collect/bulk aliases (#263). */
export const isBulkCollectHash = (hash = '') => {
  const raw = String(hash).trim().toLowerCase().replace(/^#\/?/, '').replace(/\/$/, '');
  return raw === 'bulk-collect' || raw === 'collect/bulk';
};
export const BULK_ALL_COLLECTED_TEXT = 'Sab ka bill wusool ho gaya';

const cents = value => Math.round(Number(value) * 100);
let entrySeq = 0;
const nextEntryId = () => `bulk-${Date.now().toString(36)}-${(entrySeq++).toString(36)}`;

/** A new, empty batch for `date` (YYYY-MM-DD, defaults to today in Pakistan time). */
export function createBatch(date = getPakistanLocalDate()) {
  return { date, entries: [], history: [] };
}

/**
 * Is `customerId` already in this batch, or does it already have a payment on `date`?
 * @returns {null | { kind: 'batch', entry } | { kind: 'recorded', payment, month }}
 */
export function findDuplicate(batch, state, customerId, date = batch?.date) {
  const entry = batch?.entries?.find(e => e.customerId === customerId);
  if (entry) return { kind: 'batch', entry };
  const customer = state?.customers?.find(c => c.id === customerId);
  for (const bill of customer?.bills ?? []) {
    const payment = (bill.payments ?? []).find(p => p.date === date);
    if (payment) return { kind: 'recorded', payment, month: bill.month };
  }
  return null;
}

/**
 * Add an entry. Returns { batch, added, duplicate }. A duplicate is NOT added unless
 * `allowDuplicate` is true (the user confirmed the "Already added" popup).
 */
export function addEntry(batch, state, fields, { allowDuplicate = false } = {}) {
  if (!fields.customerId) throw new Error('Choose a customer first.');
  // Duplicate check first, so the "Already added" popup shows even before an amount is typed.
  const duplicate = findDuplicate(batch, state, fields.customerId, batch.date);
  if (duplicate && !allowDuplicate) return { batch, added: null, duplicate };
  const amount = Number(fields.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Enter an amount greater than zero.');
  const method = fields.method || 'Cash';
  if (!PAYMENT_METHODS.includes(method)) throw new Error(`Choose a valid payment method from: ${PAYMENT_METHODS.join(', ')}`);
  const entry = {
    id: nextEntryId(),
    customerId: fields.customerId,
    customerNumber: fields.customerNumber ?? null,
    name: fields.name || '',
    phone: fields.phone || '',
    area: fields.area || '',
    month: fields.month || null,
    amount: cents(amount) / 100,
    method,
    note: String(fields.note ?? '').trim(),
    confirmedDuplicate: Boolean(duplicate)
  };
  return {
    batch: { ...batch, entries: [...batch.entries, entry], history: [...batch.history, { type: 'add', entryId: entry.id }] },
    added: entry,
    duplicate
  };
}

/** Remove one entry (undoable). */
export function removeEntry(batch, entryId) {
  const index = batch.entries.findIndex(e => e.id === entryId);
  if (index < 0) return batch;
  const entry = batch.entries[index];
  return {
    ...batch,
    entries: batch.entries.filter(e => e.id !== entryId),
    history: [...batch.history, { type: 'remove', entry, index }]
  };
}

/** Undo the last add or remove. */
export function undoLast(batch) {
  const last = batch.history[batch.history.length - 1];
  if (!last) return batch;
  const history = batch.history.slice(0, -1);
  if (last.type === 'add') return { ...batch, history, entries: batch.entries.filter(e => e.id !== last.entryId) };
  const entries = [...batch.entries];
  entries.splice(Math.min(last.index, entries.length), 0, last.entry);
  return { ...batch, history, entries };
}

export const canUndo = batch => batch.history.length > 0;

/** Running totals: { count, total, byMethod: { [method]: amount } } (exact to the paisa). */
export function batchTotals(batch) {
  let totalCents = 0;
  const byMethodCents = {};
  for (const e of batch.entries) {
    const c = cents(e.amount);
    totalCents += c;
    byMethodCents[e.method] = (byMethodCents[e.method] || 0) + c;
  }
  return {
    count: batch.entries.length,
    total: totalCents / 100,
    byMethod: Object.fromEntries(Object.entries(byMethodCents).map(([m, c]) => [m, c / 100]))
  };
}

/**
 * Picker rows: customers with a pending balance (fully paid excluded, partial stays with the
 * remaining amount), minus customers already in the batch. When a search is typed, matching
 * customers already in the batch are listed too, flagged `inBatch`, so tapping them shows
 * the "Already added" popup instead of silently missing.
 */
export function pendingForBatch(state, batch, query = '') {
  const inBatch = new Set(batch.entries.map(e => e.customerId));
  const pending = getPendingCollectionCustomers(state, query, 'all-dues');
  const rows = pending.filter(c => !inBatch.has(c.id)).map(c => ({ ...c, inBatch: false }));
  if (String(query).trim()) {
    const added = getPendingCollectionCustomers(state, query, 'all').filter(c => inBatch.has(c.id));
    return [...added.map(c => ({ ...c, inBatch: true })), ...rows];
  }
  return rows;
}

/** Nobody has a pending balance (and nothing is being searched): show the empty state. */
export function isAllCollected(state) {
  return getPendingCollectionCustomers(state, '', 'all-dues').length === 0;
}

/** Default entry fields for a customer: the pending amount still unbatched, target month, method. */
export function entryDefaults(state, batch, customerId) {
  const d = getCustomerPaymentDefaults(state, customerId);
  const batched = batch.entries.filter(e => e.customerId === customerId).reduce((s, e) => s + cents(e.amount), 0);
  const pendingCents = Math.max(0, cents(d.totalDues) - batched);
  return {
    customerId,
    customerNumber: d.customerNumber,
    name: d.name,
    phone: d.phone,
    area: d.area,
    month: d.targetMonth,
    amount: pendingCents / 100,
    totalDues: d.totalDues
  };
}

/**
 * Record every entry with the existing Quick Collect payment logic. All-or-nothing: if any
 * entry fails, nothing is returned for saving and the error names the customer.
 * @returns {{ nextState, receipts }}
 */
export function commitBatch(state, batch, execute = executeQuickCollection) {
  if (!batch.entries.length) throw new Error('Add at least one payment to the batch.');
  let next = state;
  const receipts = [];
  for (const e of batch.entries) {
    try {
      const { nextState, receipt } = execute(next, {
        customerId: e.customerId,
        month: e.month || undefined,
        amount: e.amount,
        date: batch.date,
        method: e.method,
        paidBy: e.note
      });
      next = nextState;
      receipts.push(receipt);
    } catch (err) {
      throw new Error(`${e.name || e.customerId}: ${err.message} — nothing was saved.`);
    }
  }
  return { nextState: next, receipts };
}

/**
 * Bulk picker rows (v2). Search ALWAYS covers every active customer (name, mobile, area,
 * mohalla, address, customer #; partial, case-insensitive), so a customer is found even when
 * no package/fee or bill exists yet. Pending customers sort first with their due; others are
 * marked 'no-bill' ("No bill set") or 'paid' and can still get a manually entered amount.
 * Empty search: the pending list, or every customer when nobody is pending (never empty).
 * Customers already in the batch are hidden, except while searching, where they are flagged
 * `inBatch` so adding them again shows the "Already added" popup.
 *
 * @returns {{ rows: Array<Object>, mode: 'pending'|'all'|'search', total: number }}
 */
export function searchCustomersForBatch(state, batch, query = '', { limit = 60 } = {}) {
  const q = String(query ?? '').trim();
  const inBatch = new Set((batch?.entries ?? []).map(e => e.customerId));
  const all = getPendingCollectionCustomers(state, q, 'all');
  const status = c => (c.totalDues > 0 ? 'due' : c.billsCount === 0 ? 'no-bill' : 'paid');
  let rows = all.map(c => ({ ...c, status: status(c), inBatch: inBatch.has(c.id) }));
  let mode = 'search';
  if (!q) {
    rows = rows.filter(r => !r.inBatch);
    const pending = rows.filter(r => r.status === 'due');
    mode = pending.length ? 'pending' : 'all';
    if (pending.length) rows = pending;
  }
  // Pending first (largest due first, as Quick Collect), then everyone else by customer #.
  const rank = r => (r.inBatch ? 3 : r.status === 'due' ? 0 : 1);
  rows.sort((a, b) => rank(a) - rank(b) || (b.totalDues - a.totalDues) || (a.customerNumber - b.customerNumber));
  return { rows: rows.slice(0, limit), mode, total: rows.length };
}

/* ------------------------------------------------------------------ UI ------------------ */

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const pkr = n => `PKR ${Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`;

function buildDialogs(doc) {
  const wrap = doc.createElement('div');
  wrap.innerHTML = `
  <dialog id="bulkCollectModal" class="modal bulk-collect-modal" aria-labelledby="bulkCollectTitle">
    <section class="bulk-collect-card">
      <div class="modal-heading">
        <div>
          <p class="eyebrow">FIELD RECOVERY · BATCH</p>
          <h2 id="bulkCollectTitle">Bulk Collect Cash</h2>
        </div>
        <button id="closeBulkCollectBtn" class="close-button" type="button" aria-label="Close bulk collect">↩</button>
      </div>

      <div class="bc-settings" role="group" aria-label="Batch settings (apply to every payment)">
        <label class="bc-field bc-date">Date
          <input id="bulkCollectDate" type="date" required>
        </label>
        <label class="bc-field">Method
          <select id="bulkCollectMethod"></select>
        </label>
        <label class="bc-field bc-note"><span>Collected by / location <span class="bc-optional">(optional)</span></span>
          <input id="bulkCollectNote" type="text" maxlength="120" placeholder="e.g. Saad · Jia Musa round">
        </label>
      </div>

      <div class="bc-search">
        <label class="bc-search-label" for="bulkCollectSearch">Find customer</label>
        <div class="bc-search-box">
          <span class="bc-search-icon" aria-hidden="true">🔍</span>
          <input id="bulkCollectSearch" type="search" class="bc-search-input" enterkeyhint="next" autocomplete="off" spellcheck="false"
                 placeholder="Name, mobile, area or #" aria-describedby="bulkCollectHint" aria-controls="bulkCollectPickList">
        </div>
        <p id="bulkCollectHint" class="bc-hint">Type to search all customers · Enter jumps to the amount · Enter again adds.</p>
      </div>

      <div id="bulkCollectPickList" class="bc-pick-list" role="list" aria-label="Customers" aria-live="polite"></div>

      <div class="bc-review">
        <div class="bc-review-head">
          <h3>In this batch <span id="bulkCollectCount" class="bc-count">0 customers</span></h3>
          <button id="bulkCollectUndoBtn" class="secondary-button" type="button" disabled>↶ Undo</button>
        </div>
        <ol id="bulkCollectReviewList" class="bc-review-list" aria-label="Payments in this batch"></ol>
      </div>

      <p id="bulkCollectStatus" class="bc-status" role="status" aria-live="polite" hidden></p>
      <div class="bc-footer">
        <div class="bc-total-line"><span>Batch total</span><strong id="bulkCollectTotal">PKR 0</strong></div>
        <button id="bulkCollectSaveBtn" class="primary-button" type="button" disabled>Save payments</button>
      </div>
    </section>
  </dialog>

  <dialog id="bulkDuplicateDialog" class="modal bulk-duplicate-modal" aria-labelledby="bulkDuplicateTitle" aria-describedby="bulkDuplicateBody">
    <section class="bulk-duplicate-card">
      <div class="modal-heading" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <h2 id="bulkDuplicateTitle" style="margin:0;">⚠ Already added</h2>
        <button id="closeBulkDuplicateModalBtn" class="close-button" type="button" aria-label="Close duplicate alert">↩</button>
      </div>
      <div id="bulkDuplicateBody" class="bc-dup-body"></div>
      <div class="bc-dup-actions">
        <button id="bulkDuplicateCancelBtn" class="secondary-button" type="button">Cancel · Skip</button>
        <button id="bulkDuplicateConfirmBtn" class="danger-button bc-dup-confirm" type="button">Add again anyway</button>
      </div>
    </section>
  </dialog>`;
  while (wrap.firstElementChild) doc.body.appendChild(wrap.firstElementChild);
}

const STATUS_BADGE = {
  due: c => `<span class="bc-badge bc-badge-due">Due ${esc(pkr(c.totalDues))}</span>`,
  'no-bill': () => '<span class="bc-badge bc-badge-nobill">No bill set</span>',
  paid: () => '<span class="bc-badge bc-badge-paid">Paid</span>'
};

export function setupBulkCollect({ win = window, doc = document, getController = () => win.quickCollectModalController, toast } = {}) {
  if (doc.getElementById('bulkCollectModal')) return win.bulkCollect;
  buildDialogs(doc);
  const $ = id => doc.getElementById(id);
  const modal = $('bulkCollectModal');
  const dupDialog = $('bulkDuplicateDialog');
  const dateInput = $('bulkCollectDate');
  const methodSelect = $('bulkCollectMethod');
  const noteInput = $('bulkCollectNote');
  const searchInput = $('bulkCollectSearch');
  const pickList = $('bulkCollectPickList');
  const reviewList = $('bulkCollectReviewList');
  const undoBtn = $('bulkCollectUndoBtn');
  const saveBtn = $('bulkCollectSaveBtn');
  const statusEl = $('bulkCollectStatus');

  methodSelect.innerHTML = PAYMENT_METHODS.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('');
  methodSelect.value = 'Cash';

  let batch = createBatch();
  let hashOnOpen = null;
  let resolveDup = null;
  const typed = new Map(); // customerId -> amount typed in its row (kept across re-renders)

  // The page toast sits under the top-layer dialog, so messages are shown inside the dialog.
  const say = (msg, kind = 'info') => {
    statusEl.textContent = msg;
    statusEl.dataset.kind = kind;
    statusEl.hidden = !msg;
    if (typeof toast === 'function' && msg) toast(msg);
  };
  const state = () => getController()?.getState?.();

  function allModeCaption(st, total) {
    if (getPendingCollectionCustomers(st, '', 'all-dues').length) return `All pending customers are in the batch — showing everyone else (${total}).`;
    if (countCustomersWithoutFee(st) > 0) return `No pending dues — showing all customers (${total}). Enter the amount received.`;
    return `${esc(BULK_ALL_COLLECTED_TEXT)} — showing all customers (${total}). Enter the amount received.`;
  }

  function renderPicker() {
    const st = state();
    if (!st) { pickList.innerHTML = ''; return; }
    const query = searchInput.value;
    const { rows, mode, total } = searchCustomersForBatch(st, batch, query);
    if (!rows.length) {
      const noFee = countCustomersWithoutFee(st);
      pickList.innerHTML = String(query).trim()
        ? `<div class="qc-empty-state" role="status"><span class="qc-empty-icon" aria-hidden="true">🔍</span><h4>No customer matches “${esc(query.trim())}”</h4><p>Search by name, mobile number, area or customer #.</p></div>`
        : batch.entries.length
          ? `<div class="qc-empty-state qc-all-collected" role="status"><span class="qc-empty-icon" aria-hidden="true">✅</span><h4>Sab customers batch mein add ho gaye</h4><p>Review the batch below and tap Save.</p></div>`
          : noFee ? renderQuickCollectNeedsSetupHtml(noFee, { showAll: false })
            : `<div class="qc-empty-state qc-all-collected" role="status"><span class="qc-empty-icon" aria-hidden="true">✅</span><h4>${esc(BULK_ALL_COLLECTED_TEXT)}</h4></div>`;
      return;
    }
    const head = mode === 'pending'
      ? `<p class="bc-list-caption">Pending customers (${total}) · search to find anyone else</p>`
      : mode === 'all'
        ? `<p class="bc-list-caption">${allModeCaption(st, total)}</p>`
        : `<p class="bc-list-caption">${total} match${total === 1 ? '' : 'es'}${total > rows.length ? ` · showing ${rows.length}, keep typing` : ''}</p>`;
    pickList.innerHTML = head + rows.map(c => {
      const d = entryDefaults(st, batch, c.id);
      const value = typed.has(c.id) ? typed.get(c.id) : (d.amount > 0 ? String(d.amount) : '');
      return `<div class="bc-row${c.inBatch ? ' is-in-batch' : ''}" role="listitem" data-bulk-row="${esc(c.id)}">
        <div class="bc-row-info">
          <span class="bc-row-name"><span class="bc-row-num">#${esc(c.customerNumber)}</span> ${esc(c.name)}</span>
          <span class="bc-row-meta">${esc(c.area)}${c.phone ? ' · ' + esc(c.phone) : ''}</span>
          <span class="bc-row-badges">${STATUS_BADGE[c.status](c)}${c.inBatch ? '<span class="bc-badge bc-badge-added">In batch ✓</span>' : ''}</span>
        </div>
        <div class="bc-row-entry">
          <input class="bc-amount" type="number" inputmode="decimal" min="0" step="0.01" enterkeyhint="done"
                 value="${esc(value)}" placeholder="${c.status === 'due' ? '0' : 'Enter amount'}"
                 data-bulk-amount="${esc(c.id)}" aria-label="Amount for ${esc(c.name)} (PKR)">
          <button type="button" class="primary-button bc-row-add" data-bulk-add="${esc(c.id)}" aria-label="Add ${esc(c.name)} to batch">Add</button>
        </div>
      </div>`;
    }).join('');
  }

  function renderReview() {
    const t = batchTotals(batch);
    $('bulkCollectTotal').textContent = pkr(t.total);
    $('bulkCollectCount').textContent = `${t.count} customer${t.count === 1 ? '' : 's'}`;
    reviewList.innerHTML = batch.entries.length ? batch.entries.slice().reverse().map(e => `
      <li class="bc-review-item" data-entry-id="${esc(e.id)}">
        <div class="bc-review-main"><strong class="bc-review-name">${esc(e.name)}</strong>
          <span class="bc-review-meta">#${esc(e.customerNumber)} · ${esc(e.method)}${e.note ? ' · ' + esc(e.note) : ''}${e.confirmedDuplicate ? ' · <b class="bc-dup-flag">duplicate confirmed</b>' : ''}</span></div>
        <strong class="bc-review-amt">${esc(pkr(e.amount))}</strong>
        <button type="button" class="bc-remove-btn" data-bulk-remove="${esc(e.id)}" aria-label="Remove ${esc(e.name)} from batch">Remove</button>
      </li>`).join('') : '<li class="bc-review-empty">Nothing added yet — find a customer above and tap Add.</li>';
    undoBtn.disabled = !canUndo(batch);
    saveBtn.disabled = t.count === 0;
    saveBtn.textContent = t.count ? `Save ${t.count} payment${t.count === 1 ? '' : 's'} · ${pkr(t.total)}` : 'Save payments';
  }

  const renderAll = () => { renderPicker(); renderReview(); };

  function showDuplicate(fields, duplicate) {
    const amount = duplicate.kind === 'batch' ? duplicate.entry.amount : duplicate.payment.amount;
    const where = duplicate.kind === 'batch'
      ? `is already in this batch for <b>${esc(batch.date)}</b>.`
      : `already has a payment recorded on <b>${esc(batch.date)}</b> (${esc(duplicate.payment.method || 'Cash')}, bill ${esc(duplicate.month)}).`;
    $('bulkDuplicateBody').innerHTML = `
      <p>This customer ${where}</p>
      <dl class="bc-dup-grid">
        <dt>Name</dt><dd id="bulkDuplicateName">${esc(fields.name)}</dd>
        <dt>Mobile</dt><dd id="bulkDuplicateMobile">${esc(fields.phone || 'Not saved')}</dd>
        <dt>Area</dt><dd id="bulkDuplicateArea">${esc(fields.area || 'Unassigned')}</dd>
        <dt>Amount</dt><dd id="bulkDuplicateAmount">${esc(pkr(amount))}</dd>
      </dl>
      <p class="bc-dup-warn">Adding again records a second payment. Only confirm if this really is a separate payment.</p>`;
    return new Promise(resolve => {
      resolveDup = resolve;
      try { dupDialog.showModal(); } catch { dupDialog.setAttribute('open', ''); }
      $('bulkDuplicateCancelBtn').focus();
    });
  }
  const closeDup = result => {
    if (dupDialog.open) dupDialog.close(); else dupDialog.removeAttribute('open');
    const r = resolveDup; resolveDup = null; r?.(result);
  };
  $('closeBulkDuplicateModalBtn')?.addEventListener('click', () => closeDup(false));
  $('bulkDuplicateCancelBtn').addEventListener('click', () => closeDup(false));
  $('bulkDuplicateConfirmBtn').addEventListener('click', () => closeDup(true));
  dupDialog.addEventListener('cancel', e => { e.preventDefault(); closeDup(false); });

  const amountBox = id => pickList.querySelector(`[data-bulk-amount="${CSS.escape(id)}"]`);

  function nextCustomer() {
    searchInput.value = '';
    renderAll();
    searchInput.focus({ preventScroll: true });
  }

  async function addCustomer(id) {
    const st = state();
    if (!st) return;
    const box = amountBox(id);
    const fields = { ...entryDefaults(st, batch, id), amount: Number(box?.value), method: methodSelect.value || 'Cash', note: noteInput.value };
    let res;
    try {
      res = addEntry(batch, st, fields);
      if (!res.added && res.duplicate) {
        if (!(await showDuplicate(fields, res.duplicate))) { say('Skipped — already added.'); box?.focus(); return; }
        res = addEntry(batch, st, fields, { allowDuplicate: true });
      }
    } catch (err) {
      say(err.message, 'error');
      box?.focus();
      box?.select?.();
      return;
    }
    batch = res.batch;
    typed.delete(id);
    say(`✓ ${res.added.name} · ${pkr(res.added.amount)} added · batch ${pkr(batchTotals(batch).total)}`, 'success');
    nextCustomer();
  }

  // Search: live as you type; Enter jumps to the first result's amount; Esc clears.
  searchInput.addEventListener('input', renderPicker);
  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const first = pickList.querySelector('[data-bulk-amount]');
      if (first) { first.focus(); first.select?.(); }
    } else if (e.key === 'Escape' && searchInput.value) {
      e.preventDefault();
      e.stopPropagation();
      nextCustomer();
    } else if (e.key === 'ArrowDown') {
      const first = pickList.querySelector('[data-bulk-amount]');
      if (first) { e.preventDefault(); first.focus(); first.select?.(); }
    }
  });
  pickList.addEventListener('input', e => {
    const box = e.target.closest('[data-bulk-amount]');
    if (box) typed.set(box.getAttribute('data-bulk-amount'), box.value);
  });
  pickList.addEventListener('keydown', e => {
    const box = e.target.closest('[data-bulk-amount]');
    if (!box) return;
    if (e.key === 'Enter') { e.preventDefault(); addCustomer(box.getAttribute('data-bulk-amount')); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const boxes = [...pickList.querySelectorAll('[data-bulk-amount]')];
      const i = boxes.indexOf(box) + (e.key === 'ArrowDown' ? 1 : -1);
      e.preventDefault();
      if (i < 0) searchInput.focus(); else if (boxes[i]) { boxes[i].focus(); boxes[i].select?.(); }
    } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); nextCustomer(); }
  });
  pickList.addEventListener('click', e => {
    const add = e.target.closest('[data-bulk-add]');
    if (add) { addCustomer(add.getAttribute('data-bulk-add')); return; }
    const row = e.target.closest('[data-bulk-row]');
    if (row && !e.target.closest('input')) { const box = row.querySelector('[data-bulk-amount]'); box?.focus(); box?.select?.(); }
  });
  reviewList.addEventListener('click', e => {
    const btn = e.target.closest('[data-bulk-remove]');
    if (!btn) return;
    batch = removeEntry(batch, btn.getAttribute('data-bulk-remove'));
    renderAll();
    say('Removed from batch — Undo to bring it back.');
  });
  undoBtn.addEventListener('click', () => { batch = undoLast(batch); renderAll(); });
  dateInput.addEventListener('change', () => {
    batch = { ...batch, date: dateInput.value || getPakistanLocalDate() };
    renderAll();
  });

  saveBtn.addEventListener('click', () => {
    const controller = getController();
    const st = state();
    if (!controller?.commitState || !st) { say('Payments are not ready yet — reload the app.', 'error'); return; }
    try {
      const totals = batchTotals(batch);
      const { nextState, receipts } = commitBatch(st, batch);
      controller.commitState(nextState);
      batch = createBatch(batch.date);
      typed.clear();
      searchInput.value = '';
      renderAll();
      say(`✓ ${receipts.length} payment${receipts.length === 1 ? '' : 's'} saved · ${pkr(totals.total)}`, 'success');
    } catch (err) {
      say(err.message, 'error');
    }
  });

  function open() {
    const today = getPakistanLocalDate();
    if (!batch.entries.length) batch = createBatch(today);
    dateInput.max = today;
    dateInput.value = batch.date;
    say('');
    const qc = getController();
    if (qc?.isOpen?.()) qc.close();
    searchInput.value = '';
    renderAll();
    if (!isBulkCollectHash(win.location.hash)) {
      // One history entry per sheet: Back closes Bulk and returns to where it was opened
      // (usually Quick Collect at #/collect, which re-opens) — the batch is kept in memory.
      hashOnOpen = win.location.hash || '#/home';
      win.history.pushState({ bulkCollect: true, bulkFrom: hashOnOpen }, '', BULK_COLLECT_HASH);
    } else {
      if (win.location.hash !== BULK_COLLECT_HASH) win.history.replaceState({ ...(win.history.state || {}), bulkCollect: true }, '', BULK_COLLECT_HASH);
      if (hashOnOpen === null) hashOnOpen = '#/home';
    }
    try { if (!modal.open) modal.showModal(); } catch { modal.setAttribute('open', ''); }
    win.setTimeout(() => searchInput.focus({ preventScroll: true }), 50);
  }

  function close() {
    if (modal.open) modal.close(); else modal.removeAttribute('open');
  }
  // Esc inside the search/amount boxes clears the search; it only closes the dialog when the search is empty.
  modal.addEventListener('cancel', e => {
    if (searchInput.value) { e.preventDefault(); nextCustomer(); }
  });
  modal.addEventListener('close', () => {
    // Closed with × / Esc while still on its own route: step back (Back already moved off it).
    if (isBulkCollectHash(win.location.hash)) {
      const from = win.history.state?.bulkCollect ? win.history.state.bulkFrom : null;
      if (from) {
        // × / Esc closes Bulk and the Quick Collect sheet under it (phone Back steps one sheet at a time).
        if (/^#\/?(collect|quick-collect)\/?$/i.test(from)) win.screenRouter?.collect?.skipNextOpen?.();
        win.history.back();
      }
      else win.history.replaceState({ ...(win.history.state || {}), bulkCollect: false }, '', '#/home');
    }
    hashOnOpen = null;
    getController()?.refresh?.();
  });
  $('closeBulkCollectBtn').addEventListener('click', close);

  // Entry point inside Quick Collect's picker step.
  const pick = doc.getElementById('quickCollectStepPick');
  if (pick && !doc.getElementById('openBulkCollectBtn')) {
    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.id = 'openBulkCollectBtn';
    btn.className = 'bc-open-btn';
    btn.innerHTML = '<span aria-hidden="true">💵</span> Bulk Collect Cash <small>many payments in one batch</small>';
    btn.addEventListener('click', open);
    pick.insertBefore(btn, pick.firstElementChild);
  }

  const onHash = () => { if (isBulkCollectHash(win.location.hash) && !modal.open) open(); };
  win.addEventListener('hashchange', onHash);
  win.addEventListener('popstate', () => {
    if (isBulkCollectHash(win.location.hash)) { if (!modal.open) open(); }
    else if (modal.open) { hashOnOpen = null; close(); }
  });

  const api = { open, close, isOpen: () => modal.open, refresh: () => { if (modal.open) renderAll(); }, get batch() { return batch; } };
  win.bulkCollect = api;
  // Deep link: #/bulk-collect (wait for the app to finish its own startup).
  if (isBulkCollectHash(win.location.hash)) win.setTimeout(onHash, 0);
  return api;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined' && document.body) {
  setupBulkCollect();
}
