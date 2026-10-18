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
        <button id="closeBulkCollectBtn" class="close-button" type="button" aria-label="Close bulk collect">×</button>
      </div>

      <div class="bc-batch-row">
        <label class="bc-field bc-date">Batch date
          <input id="bulkCollectDate" type="date" required>
        </label>
        <div class="bc-totals" role="status" aria-live="polite">
          <span class="bc-totals-label">Batch total</span>
          <strong id="bulkCollectTotal">PKR 0</strong>
          <span id="bulkCollectCount">0 customers</span>
        </div>
      </div>

      <form id="bulkCollectEntryForm" class="bc-entry" autocomplete="off" novalidate>
        <div id="bulkCollectSelected" class="bc-selected" aria-live="polite">Pick customers below ↓</div>
        <div class="bc-entry-grid">
          <label class="bc-field">Amount (PKR)
            <input id="bulkCollectAmount" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0">
          </label>
          <label class="bc-field">Method
            <select id="bulkCollectMethod"></select>
          </label>
          <label class="bc-field bc-note">Collected by / location
            <input id="bulkCollectNote" type="text" maxlength="120" placeholder="e.g. Saad · Jia Musa round">
          </label>
        </div>
        <button id="bulkCollectAddBtn" class="primary-button bc-add-btn" type="submit" disabled>+ Add to batch</button>
      </form>

      <div class="bc-picker">
        <div class="qc-search-box">
          <input id="bulkCollectSearch" type="search" class="qc-search-input" placeholder="Search name, mobile or area…" aria-label="Search pending customers">
        </div>
        <p class="bc-hint">Only customers with a pending balance. Tap to select (multi-select allowed).</p>
        <div id="bulkCollectPickList" class="bc-pick-list" role="listbox" aria-multiselectable="true" aria-label="Pending customers"></div>
      </div>

      <div class="bc-review">
        <div class="bc-review-head">
          <h3>Review batch</h3>
          <button id="bulkCollectUndoBtn" class="secondary-button" type="button" disabled>↶ Undo</button>
        </div>
        <ol id="bulkCollectReviewList" class="bc-review-list"></ol>
      </div>

      <p id="bulkCollectStatus" class="bc-status" role="status" aria-live="polite" hidden></p>
      <div class="bc-footer">
        <button id="bulkCollectSaveBtn" class="primary-button" type="button" disabled>Save payments</button>
      </div>
    </section>
  </dialog>

  <dialog id="bulkDuplicateDialog" class="modal bulk-duplicate-modal" aria-labelledby="bulkDuplicateTitle" aria-describedby="bulkDuplicateBody">
    <section class="bulk-duplicate-card">
      <div class="modal-heading" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <h2 id="bulkDuplicateTitle" style="margin:0;">⚠ Already added</h2>
        <button id="closeBulkDuplicateModalBtn" class="close-button" type="button" aria-label="Close duplicate alert">×</button>
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

export function setupBulkCollect({ win = window, doc = document, getController = () => win.quickCollectModalController, toast } = {}) {
  if (doc.getElementById('bulkCollectModal')) return win.bulkCollect;
  buildDialogs(doc);
  const $ = id => doc.getElementById(id);
  const modal = $('bulkCollectModal');
  const dupDialog = $('bulkDuplicateDialog');
  const dateInput = $('bulkCollectDate');
  const amountInput = $('bulkCollectAmount');
  const methodSelect = $('bulkCollectMethod');
  const noteInput = $('bulkCollectNote');
  const addBtn = $('bulkCollectAddBtn');
  const selectedEl = $('bulkCollectSelected');
  const searchInput = $('bulkCollectSearch');
  const pickList = $('bulkCollectPickList');
  const reviewList = $('bulkCollectReviewList');
  const undoBtn = $('bulkCollectUndoBtn');
  const saveBtn = $('bulkCollectSaveBtn');

  methodSelect.innerHTML = PAYMENT_METHODS.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('');
  methodSelect.value = 'Cash';

  let batch = createBatch();
  let selected = []; // customer ids, in tap order
  let amountTouched = false;
  let hashOnOpen = null;
  let resolveDup = null;
  let pendingDuplicateOk = null; // customer id whose duplicate was confirmed, awaiting an amount

  const statusEl = $('bulkCollectStatus');
  // The page toast sits under the top-layer dialog, so messages are shown inside the dialog.
  const say = (msg, kind = 'info') => {
    statusEl.textContent = msg;
    statusEl.dataset.kind = kind;
    statusEl.hidden = !msg;
    if (typeof toast === 'function') toast(msg);
  };
  const state = () => getController()?.getState?.();

  function renderSelected() {
    const st = state();
    if (!selected.length) {
      selectedEl.textContent = 'Pick customers below ↓';
      amountInput.disabled = false;
      if (!amountTouched) amountInput.value = '';
    } else if (selected.length === 1) {
      const d = entryDefaults(st, batch, selected[0]);
      selectedEl.innerHTML = `<strong>${esc(d.name)}</strong> <span>#${esc(d.customerNumber)} · ${esc(d.area)}${d.phone ? ' · ' + esc(d.phone) : ''}</span> <em>Pending ${esc(pkr(d.totalDues))}</em>`;
      amountInput.disabled = false;
      if (!amountTouched) amountInput.value = d.amount > 0 ? String(d.amount) : '';
    } else {
      const total = selected.reduce((s, id) => s + cents(entryDefaults(st, batch, id).amount), 0) / 100;
      selectedEl.innerHTML = `<strong>${selected.length} customers selected</strong> <em>${esc(pkr(total))} · each customer's pending amount</em>`;
      amountInput.disabled = true;
      amountInput.value = String(total);
    }
    addBtn.disabled = selected.length === 0;
    addBtn.textContent = selected.length > 1 ? `+ Add ${selected.length} to batch` : '+ Add to batch';
  }

  function renderPicker() {
    const st = state();
    if (!st) { pickList.innerHTML = ''; return; }
    const query = searchInput.value;
    const rows = pendingForBatch(st, batch, query);
    if (!rows.length) {
      const noFee = isAllCollected(st) ? countCustomersWithoutFee(st) : 0;
      pickList.innerHTML = !String(query).trim() && noFee > 0
        ? renderQuickCollectNeedsSetupHtml(noFee, { showAll: false })
        : !String(query).trim()
        ? `<div class="qc-empty-state qc-all-collected" role="status"><span class="qc-empty-icon" aria-hidden="true">✅</span><h4>${esc(isAllCollected(st) ? BULK_ALL_COLLECTED_TEXT : 'Sab pending customers batch mein add ho gaye')}</h4><p>${isAllCollected(st) ? 'No pending dues right now.' : 'Everyone with a pending balance is in this batch — review and save.'}</p></div>`
        : `<div class="qc-empty-state" role="status"><span class="qc-empty-icon" aria-hidden="true">🔍</span><h4>No pending customer matches</h4><p>Search by name, mobile number or area.</p></div>`;
      return;
    }
    pickList.innerHTML = rows.map(c => {
      const isSel = selected.includes(c.id);
      return `<button type="button" role="option" aria-selected="${isSel}" class="bc-pick-card${isSel ? ' is-selected' : ''}${c.inBatch ? ' is-in-batch' : ''}" data-bulk-customer="${esc(c.id)}">
        <span class="bc-check" aria-hidden="true">${isSel ? '✓' : ''}</span>
        <span class="bc-pick-info"><span class="bc-pick-name">#${esc(c.customerNumber)} ${esc(c.name)}</span>
        <span class="bc-pick-meta">${esc(c.area)}${c.phone ? ' · ' + esc(c.phone) : ''}</span></span>
        <span class="bc-pick-due">${c.inBatch ? '<span class="bc-added-tag">Added ✓</span>' : esc(pkr(c.totalDues))}</span>
      </button>`;
    }).join('');
  }

  function renderReview() {
    const t = batchTotals(batch);
    $('bulkCollectTotal').textContent = pkr(t.total);
    $('bulkCollectCount').textContent = `${t.count} customer${t.count === 1 ? '' : 's'}`;
    reviewList.innerHTML = batch.entries.length ? batch.entries.map(e => `
      <li class="bc-review-item" data-entry-id="${esc(e.id)}">
        <div class="bc-review-main"><strong>${esc(e.name)}</strong> <span class="bc-review-meta">#${esc(e.customerNumber)} · ${esc(e.area)}${e.phone ? ' · ' + esc(e.phone) : ''}</span>
        <span class="bc-review-meta">${esc(e.method)}${e.note ? ' · ' + esc(e.note) : ''}${e.confirmedDuplicate ? ' · <b class="bc-dup-flag">duplicate confirmed</b>' : ''}</span></div>
        <strong class="bc-review-amt">${esc(pkr(e.amount))}</strong>
        <button type="button" class="bc-remove-btn" data-bulk-remove="${esc(e.id)}" aria-label="Remove ${esc(e.name)} from batch">Remove</button>
      </li>`).join('') : '<li class="bc-review-empty">No payments in this batch yet.</li>';
    undoBtn.disabled = !canUndo(batch);
    saveBtn.disabled = t.count === 0;
    saveBtn.textContent = t.count ? `Save ${t.count} payment${t.count === 1 ? '' : 's'} · ${pkr(t.total)}` : 'Save payments';
  }

  const renderAll = () => { renderSelected(); renderPicker(); renderReview(); };

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

  async function addSelected() {
    const st = state();
    if (!st || !selected.length) return;
    const single = selected.length === 1;
    const ids = [...selected];
    let addedCount = 0;
    for (const id of ids) {
      const d = entryDefaults(st, batch, id);
      const fields = { ...d, amount: single ? Number(amountInput.value) : d.amount, method: methodSelect.value || 'Cash', note: noteInput.value };
      if (!single && !(fields.amount > 0)) continue;
      let res;
      try { res = addEntry(batch, st, fields); } catch (err) { say(err.message, 'error'); amountInput.focus(); return; }
      if (!res.added && res.duplicate && pendingDuplicateOk === id) {
        pendingDuplicateOk = null;
        try { res = addEntry(batch, st, fields, { allowDuplicate: true }); } catch (err) { say(err.message, 'error'); amountInput.focus(); return; }
      }
      if (!res.added && res.duplicate) {
        const ok = await showDuplicate(fields, res.duplicate);
        if (!ok) { selected = selected.filter(x => x !== id); continue; }
        if (!(fields.amount > 0)) {
          // Confirmed, but nothing left pending to prefill: keep it selected and ask for the amount.
          selected = [id];
          amountTouched = false;
          renderAll();
          pendingDuplicateOk = id;
          say('Confirmed — enter the extra amount, then tap Add.', 'info');
          amountInput.focus();
          return;
        }
        res = addEntry(batch, st, fields, { allowDuplicate: true });
      }
      batch = res.batch;
      selected = selected.filter(x => x !== id);
      addedCount++;
    }
    amountTouched = false;
    renderAll();
    if (addedCount) say(`${addedCount} added · batch ${pkr(batchTotals(batch).total)}`);
    searchInput.focus({ preventScroll: true });
  }

  async function toggleCustomer(id) {
    const st = state();
    const row = pendingForBatch(st, batch, searchInput.value).find(r => r.id === id);
    if (row?.inBatch) {
      // Already in the batch: tapping it goes straight to the "Already added" check.
      selected = [id];
      amountTouched = false;
      renderSelected();
      await addSelected();
      return;
    }
    selected = selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id];
    amountTouched = false;
    renderSelected();
    renderPicker();
  }

  pickList.addEventListener('click', e => {
    const card = e.target.closest('[data-bulk-customer]');
    if (card) toggleCustomer(card.getAttribute('data-bulk-customer'));
  });
  searchInput.addEventListener('input', renderPicker);
  amountInput.addEventListener('input', () => { amountTouched = true; });
  $('bulkCollectEntryForm').addEventListener('submit', e => { e.preventDefault(); addSelected(); });
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
    if (!controller?.commitState || !st) { say('Payments are not ready yet — reload the app.'); return; }
    try {
      const totals = batchTotals(batch);
      const { nextState, receipts } = commitBatch(st, batch);
      controller.commitState(nextState);
      batch = createBatch(batch.date);
      selected = [];
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
    renderAll();
    if (win.location.hash !== BULK_COLLECT_HASH) {
      hashOnOpen = win.location.hash || '#/home';
      win.history.pushState({ ...(win.history.state || {}), bulkCollect: true }, '', BULK_COLLECT_HASH);
    } else if (hashOnOpen === null) {
      hashOnOpen = '#/home';
    }
    try { if (!modal.open) modal.showModal(); } catch { modal.setAttribute('open', ''); }
    win.setTimeout(() => searchInput.focus({ preventScroll: true }), 50);
  }

  function close() {
    if (modal.open) modal.close(); else modal.removeAttribute('open');
  }
  modal.addEventListener('close', () => {
    if (win.location.hash === BULK_COLLECT_HASH) {
      win.history.replaceState({ ...(win.history.state || {}), bulkCollect: false }, '', hashOnOpen || '#/home');
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

  const onHash = () => { if (win.location.hash === BULK_COLLECT_HASH && !modal.open) open(); };
  win.addEventListener('hashchange', onHash);
  win.addEventListener('popstate', () => {
    if (win.location.hash === BULK_COLLECT_HASH) { if (!modal.open) open(); }
    else if (modal.open) { hashOnOpen = null; close(); }
  });

  const api = { open, close, isOpen: () => modal.open, refresh: () => { if (modal.open) renderAll(); }, get batch() { return batch; } };
  win.bulkCollect = api;
  // Deep link: #/bulk-collect (wait for the app to finish its own startup).
  if (win.location.hash === BULK_COLLECT_HASH) win.setTimeout(onHash, 0);
  return api;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined' && document.body) {
  setupBulkCollect();
}
