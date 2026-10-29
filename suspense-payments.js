/**
 * suspense-payments.js — SISP-37: Unidentified / Suspense Online Payment
 * Register ("بے نامی / نامعلوم آن لائن پیمنٹ رجسٹر").
 *
 * Money sometimes lands in the owner's EasyPaisa / JazzCash / Raast wallet
 * with no idea who sent it: a customer paid from a relative's number, the
 * sender name on the wallet alert matches nobody, or the TID screenshot
 * arrived without a customer name. Before SISP-37 such transfers lived in
 * the owner's memory or a paper note — easy to lose, easy to double-count.
 *
 * The register stores each unmatched transfer as one suspense entry:
 *   { suspenseId (SUS-101+), amount (rupees, as received), wallet,
 *     senderName, senderMobile, tid, date, claimed,
 *     claimedCustomerId / claimedCustomerName / claimedAt / claimedMonth,
 *     createdAt }
 * Entries are NEVER deleted by a claim: claiming marks `claimed: true`
 * and stamps who it was linked to, so the audit trail survives. A manual
 * delete exists only for entries logged by mistake (unclaimed only).
 *
 * "Claim & Link to Customer" converts an entry into a VERIFIED customer
 * payment through the app's existing quick-collection path
 * (executeQuickCollection -> core addPayment), injected by the caller —
 * this module never mutates a balance itself and invents no parallel
 * ledger. The payment carries the entry's wallet as its method, the
 * entry's TID as its transaction reference and the sender as paidBy.
 *
 * Duplicate safety, two layers, both on SISP-21 TID semantics
 * (normalizeTid: strip ALL whitespace + lowercase; hyphens NOT stripped):
 *  - logging an entry whose TID is already in the register is refused;
 *  - claiming an entry whose TID is already recorded as a customer
 *    payment (findPaymentsByTid, wallet-reconciliation.js) is refused,
 *    so the same transfer can never be counted twice.
 *
 * Storage: entries live in localStorage under SUSPENSE_PAYMENTS_KEY
 * (sisp_suspense_payments_v1), a flat array. Backup: entries travel in
 * the JSON backup `settings.suspensePayments` section (see core.js),
 * under the same safe-merge rule as billing groups: adopted only when
 * this device has none stored yet.
 *
 * This module imports only the pure TID helpers from
 * wallet-reconciliation.js; customers, state and the payment executor
 * are passed in by callers, so the pure helpers stay testable without
 * the app. The modal controller at the bottom needs a DOM and is
 * inspection-verified (no DOM harness in node:test), like the other
 * modal controllers.
 */

import { normalizeTid, findPaymentsByTid } from './wallet-reconciliation.js';

export const SUSPENSE_PAYMENTS_KEY = 'sisp_suspense_payments_v1';

/** Wallets a suspense transfer can arrive in (canonical labels). */
export const SUSPENSE_WALLETS = Object.freeze(['Easypaisa', 'JazzCash', 'NayaPay', 'Bank Transfer', 'Raast']);

const ID_RE = /^SUS-(\d+)$/;

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

/** Whole rupees grouped, e.g. 6500 -> "Rs. 6,500"; paise shown only when nonzero. */
export function formatSuspensePKR(rupees) {
  const value = Number(rupees) || 0;
  return `Rs. ${value.toLocaleString('en-PK', {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2
  })}`;
}

function rupeesOf(amount) {
  const n = Number(amount);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function canonicalWallet(method) {
  const m = String(method ?? '').trim().toLowerCase();
  if (m === 'easypaisa' || m === 'easy paisa') return 'Easypaisa';
  if (m === 'jazzcash' || m === 'jazz cash') return 'JazzCash';
  if (m === 'nayapay' || m === 'naya pay') return 'NayaPay';
  if (m === 'bank transfer' || m === 'bank') return 'Bank Transfer';
  if (m === 'raast') return 'Raast';
  return '';
}

function isValidDateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Next entry id: one above the highest SUS-N already stored (starts at 101). */
export function nextSuspenseId(entries) {
  let max = 100;
  for (const entry of Array.isArray(entries) ? entries : []) {
    const match = ID_RE.exec(String(entry?.suspenseId || ''));
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `SUS-${max + 1}`;
}

/** Drops malformed rows; keeps clean entries in stored order. */
export function sanitizeSuspensePayments(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const amount = rupeesOf(entry.amount);
    if (!(amount > 0)) continue;
    const wallet = canonicalWallet(entry.wallet);
    if (!wallet) continue;
    if (!isValidDateKey(entry.date)) continue;
    out.push({
      suspenseId: ID_RE.test(String(entry.suspenseId || '')) ? String(entry.suspenseId) : '',
      amount,
      wallet,
      senderName: cleanText(entry.senderName).slice(0, 100),
      senderMobile: cleanText(entry.senderMobile).slice(0, 32),
      tid: cleanText(entry.tid).slice(0, 64),
      date: entry.date,
      claimed: entry.claimed === true,
      claimedCustomerId: cleanText(entry.claimedCustomerId),
      claimedCustomerName: cleanText(entry.claimedCustomerName).slice(0, 100),
      claimedAt: typeof entry.claimedAt === 'string' ? entry.claimedAt : '',
      claimedMonth: typeof entry.claimedMonth === 'string' ? entry.claimedMonth : '',
      createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : ''
    });
  }
  // Fill in ids for rows that arrived without one, in stored order.
  let next = 101;
  const used = new Set(out.map((e) => e.suspenseId).filter(Boolean));
  for (const entry of out) {
    if (!entry.suspenseId) {
      while (used.has(`SUS-${next}`)) next++;
      entry.suspenseId = `SUS-${next}`;
      used.add(entry.suspenseId);
      next++;
    }
  }
  return out;
}

/** Validates a log-entry form payload; throws with a plain message. */
export function buildSuspenseFields(input) {
  const amount = rupeesOf(input?.amount);
  if (!(amount > 0)) throw new Error('Amount is required — enter the amount received in the wallet (Rs.).');
  const wallet = canonicalWallet(input?.wallet);
  if (!wallet) {
    throw new Error(`Wallet is required — choose one of: ${SUSPENSE_WALLETS.join(', ')}.`);
  }
  const date = cleanText(input?.date);
  if (!isValidDateKey(date)) throw new Error('Date is required — enter the date the transfer was received.');
  return {
    amount,
    wallet,
    senderName: cleanText(input?.senderName).slice(0, 100),
    senderMobile: cleanText(input?.senderMobile).slice(0, 32),
    tid: cleanText(input?.tid).slice(0, 64),
    date
  };
}

/**
 * Finds a register entry (claimed or not) whose TID matches `tid` under
 * SISP-21 normalizeTid semantics. Empty TIDs never match anything.
 */
export function findSuspenseByTid(entries, tid, excludeSuspenseId = '') {
  const normalized = normalizeTid(tid);
  if (!normalized) return null;
  for (const entry of sanitizeSuspensePayments(entries)) {
    if (excludeSuspenseId && String(entry.suspenseId) === String(excludeSuspenseId)) continue;
    if (normalizeTid(entry.tid) === normalized) return entry;
  }
  return null;
}

export function addSuspensePayment(entries, input) {
  const fields = buildSuspenseFields(input);
  const clean = sanitizeSuspensePayments(entries);
  const duplicate = findSuspenseByTid(clean, fields.tid);
  if (duplicate) {
    throw new Error(`This TID is already in the suspense register (${duplicate.suspenseId}${duplicate.claimed ? ', already claimed' : ''}). It was not logged twice.`);
  }
  return [...clean, {
    suspenseId: nextSuspenseId(clean),
    ...fields,
    claimed: false,
    claimedCustomerId: '',
    claimedCustomerName: '',
    claimedAt: '',
    claimedMonth: '',
    createdAt: new Date().toISOString()
  }];
}

/** Removes an UNCLAIMED entry (logged by mistake). Claimed entries are audit history and stay. */
export function deleteSuspensePayment(entries, suspenseId) {
  const clean = sanitizeSuspensePayments(entries);
  const target = clean.find((e) => String(e.suspenseId) === String(suspenseId));
  if (!target) throw new Error('Suspense entry not found.');
  if (target.claimed) throw new Error('Claimed entries are kept for audit and cannot be deleted.');
  return clean.filter((e) => String(e.suspenseId) !== String(suspenseId));
}

export function unclaimedSuspense(entries) {
  return sanitizeSuspensePayments(entries).filter((e) => !e.claimed);
}

/** Register totals for the dashboard card + modal header. */
export function suspenseSummary(entries) {
  const clean = sanitizeSuspensePayments(entries);
  const unclaimed = clean.filter((e) => !e.claimed);
  const claimed = clean.filter((e) => e.claimed);
  const sum = (list) => Math.round(list.reduce((s, e) => s + e.amount, 0) * 100) / 100;
  return {
    totalCount: clean.length,
    unclaimedCount: unclaimed.length,
    unclaimedAmount: sum(unclaimed),
    claimedCount: claimed.length,
    claimedAmount: sum(claimed)
  };
}

/**
 * Claims one suspense entry for one customer through the app's existing
 * payment path. `execute` is the app's quick-collection function
 * (state, {customerId, month, amount, date, method, paidBy, transactionId})
 * -> { nextState, receipt }. The payment is recorded for `month` (the
 * caller passes the current billing month) on the ENTRY's own date, with
 * the entry's wallet as method and its TID as the transaction reference.
 *
 * Refusals (nothing is changed): unknown entry, already-claimed entry,
 * unknown or archived customer, or a TID that is already recorded as a
 * customer payment anywhere in the ledger (double-count guard).
 *
 * Returns { nextState, entries, entry, paymentReceipt } where `entries`
 * is the register with this entry marked claimed: true (kept, not
 * deleted) and `entry` is that updated entry.
 */
export function claimSuspensePayment(state, entries, suspenseId, { customerId, month, date, execute } = {}) {
  if (typeof execute !== 'function') throw new Error('A payment executor is required.');
  if (!month) throw new Error('Billing month is required.');
  const clean = sanitizeSuspensePayments(entries);
  const entry = clean.find((e) => String(e.suspenseId) === String(suspenseId));
  if (!entry) throw new Error('Suspense entry not found.');
  if (entry.claimed) throw new Error(`This entry (${entry.suspenseId}) is already claimed for ${entry.claimedCustomerName || 'a customer'}.`);
  const customer = (Array.isArray(state?.customers) ? state.customers : []).find((c) => String(c.id) === String(customerId));
  if (!customer) throw new Error('Customer not found — pick the customer this transfer belongs to.');
  if (customer.archived) throw new Error('Archived customers cannot receive payments. Unarchive the customer first.');
  const alreadyRecorded = findPaymentsByTid(state?.customers, entry.tid);
  if (alreadyRecorded.length > 0) {
    const first = alreadyRecorded[0];
    throw new Error(`This TID is already recorded as a payment for ${first.customerName} (#${first.customerNumber}) on ${first.date}. Claiming it again would count the same transfer twice.`);
  }
  const result = execute(state, {
    customerId: customer.id,
    month,
    amount: entry.amount,
    date: date || entry.date,
    method: entry.wallet,
    paidBy: entry.senderName || entry.senderMobile || 'Suspense claim',
    transactionId: entry.tid || undefined
  });
  if (!result || !result.nextState) throw new Error('The payment could not be recorded.');
  const claimedAt = new Date().toISOString();
  const updatedEntry = {
    ...entry,
    claimed: true,
    claimedCustomerId: String(customer.id),
    claimedCustomerName: String(customer.name || ''),
    claimedAt,
    claimedMonth: month
  };
  return {
    nextState: result.nextState,
    entries: clean.map((e) => (String(e.suspenseId) === String(suspenseId) ? updatedEntry : e)),
    entry: updatedEntry,
    paymentReceipt: result.receipt ?? null
  };
}

/** Receipt for a claimed entry: plain thermal/print text + WhatsApp draft. */
export function buildSuspenseReceipt({ entry, customerName, customerNumber, month, receiptNumber }) {
  const amountLine = formatSuspensePKR(entry?.amount);
  const text = [
    'SHAHDARA FIBER NET — Payment Receipt',
    `Customer: ${customerName} (#${customerNumber})`,
    `Billing month: ${month}`,
    `Date: ${entry?.date || ''} · Method: ${entry?.wallet || ''}`,
    ...(entry?.tid ? [`TID: ${entry.tid}`] : []),
    `Suspense entry: ${entry?.suspenseId || ''} (claimed & linked)`,
    ...(receiptNumber ? [`Receipt: ${receiptNumber}`] : []),
    '--------------------------------',
    `TOTAL: ${amountLine}`,
    'Unidentified wallet transfer — now linked to this customer.'
  ].join('\n');
  const whatsappText = [
    '🧾 Payment Receipt / رسید',
    `Customer: ${customerName} (#${customerNumber})`,
    `Billing month: ${month} · Date: ${entry?.date || ''} · Method: ${entry?.wallet || ''}`,
    ...(entry?.tid ? [`TID: ${entry.tid}`] : []),
    `رقم / Amount: ${amountLine}`,
    'Shahdara Fiber Net — thank you! / شکریہ!'
  ].join('\n');
  return { text, whatsappText };
}

export function loadSuspensePayments(storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return [];
    const raw = store.getItem(SUSPENSE_PAYMENTS_KEY);
    if (!raw) return [];
    return sanitizeSuspensePayments(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveSuspensePayments(entries, storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return false;
    store.setItem(SUSPENSE_PAYMENTS_KEY, JSON.stringify(sanitizeSuspensePayments(entries)));
    return true;
  } catch {
    return false;
  }
}

function pakistanToday() {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date());
    const get = (type) => parts.find((p) => p.type === type)?.value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/**
 * Dashboard + modal controller, following the Group Billing pattern:
 * open() / refresh(), open button wired by id, close button, log-entry
 * form, entry list with per-entry customer picker + 1-click claim,
 * delete for unclaimed entries, receipt panel with Copy / WhatsApp /
 * Print. getState supplies the live app state; currentMonth supplies
 * the billing month; onClaim(entry, { customerId }) is the app's claim
 * implementation (quick-collection + persist) and must return
 * { ...claimResult, receipt } or throw.
 */
export function setupSuspensePaymentsModal(getState, {
  onEntriesChanged, onToast, onConfirm, onClaim, currentMonth
} = {}) {
  const dialog = typeof document !== 'undefined' ? document.getElementById('suspensePaymentsModal') : null;
  if (!dialog) return null;
  const $ = (id) => dialog.querySelector(`#${id}`);
  const getCustomers = () => {
    try {
      const state = typeof getState === 'function' ? getState() : null;
      return Array.isArray(state?.customers) ? state.customers : [];
    } catch {
      return [];
    }
  };
  const getMonth = () => {
    try {
      return typeof currentMonth === 'function' ? currentMonth() : '';
    } catch {
      return '';
    }
  };

  function showReceipt(receipt) {
    const panel = $('suspenseReceiptPanel');
    const pre = $('suspenseReceiptText');
    if (!panel || !pre || !receipt) return;
    pre.textContent = receipt.text;
    panel.hidden = false;
    const waBtn = $('suspenseWhatsAppBtn');
    if (waBtn) waBtn.href = `https://wa.me/?text=${encodeURIComponent(receipt.whatsappText)}`;
    panel.scrollIntoView({ block: 'nearest' });
  }

  function render() {
    const customers = getCustomers();
    const state = (() => {
      try { return typeof getState === 'function' ? getState() : null; } catch { return null; }
    })();
    const entries = loadSuspensePayments();
    const summary = suspenseSummary(entries);
    const customerOptions = customers
      .filter((c) => !c.archived)
      .sort((a, b) => (a.customerNumber ?? 0) - (b.customerNumber ?? 0))
      .map((c) => `<option value="${escapeHtml(String(c.id))}">${escapeHtml(c.name)} (#${escapeHtml(String(c.customerNumber ?? ''))})</option>`)
      .join('');
    const listEl = $('suspensePaymentsList');
    if (listEl) {
      listEl.innerHTML = entries.length === 0
        ? '<p class="suspense-empty">No suspense entries yet. Log an unidentified wallet transfer above — it stays here, safe, until its owner is found.</p>'
        : [...entries].reverse().map((entry) => {
          const senderLine = [entry.senderName, entry.senderMobile].filter(Boolean).join(' · ') || 'Sender unknown';
          const tidLine = entry.tid ? `TID: ${entry.tid}` : 'No TID noted';
          if (entry.claimed) {
            return `
          <article class="suspense-card suspense-card-claimed">
            <p><span>${escapeHtml(entry.suspenseId)} · ${escapeHtml(entry.wallet)}</span><strong>${escapeHtml(formatSuspensePKR(entry.amount))}</strong></p>
            <p><span>${escapeHtml(senderLine)}</span><span>${escapeHtml(entry.date)} · ${escapeHtml(tidLine)}</span></p>
            <p><span>Claimed</span><strong>✅ Linked to ${escapeHtml(entry.claimedCustomerName || entry.claimedCustomerId)} (${escapeHtml(entry.claimedMonth || '')})</strong></p>
          </article>`;
          }
          const alreadyRecorded = state ? findPaymentsByTid(state.customers, entry.tid) : [];
          const warn = alreadyRecorded.length > 0
            ? `<p class="suspense-warn">⚠️ This TID is already recorded as a payment for ${escapeHtml(alreadyRecorded[0].customerName)} — claiming is blocked to avoid double-counting.</p>`
            : '';
          return `
          <article class="suspense-card">
            <p><span>${escapeHtml(entry.suspenseId)} · ${escapeHtml(entry.wallet)}</span><strong>${escapeHtml(formatSuspensePKR(entry.amount))}</strong></p>
            <p><span>${escapeHtml(senderLine)}</span><span>${escapeHtml(entry.date)} · ${escapeHtml(tidLine)}</span></p>
            ${warn}
            <div class="suspense-claim-bar">
              <label for="suspenseCustomer-${escapeHtml(entry.suspenseId)}">Customer</label>
              <select id="suspenseCustomer-${escapeHtml(entry.suspenseId)}" class="form-input" data-suspense-customer aria-label="Customer for ${escapeHtml(entry.suspenseId)}">
                <option value="">— Select customer —</option>
                ${customerOptions}
              </select>
              <button type="button" class="primary-button" data-suspense-claim="${escapeHtml(entry.suspenseId)}">✅ Claim &amp; Link to Customer</button>
              <button type="button" class="secondary-button text-button danger" data-suspense-delete="${escapeHtml(entry.suspenseId)}">🗑 Delete</button>
            </div>
          </article>`;
        }).join('');
    }
    const countNote = $('suspensePaymentsCountNote');
    if (countNote) {
      countNote.textContent = summary.totalCount === 0
        ? 'Register is empty.'
        : `${summary.unclaimedCount} unclaimed (${formatSuspensePKR(summary.unclaimedAmount)}) · ${summary.claimedCount} claimed (${formatSuspensePKR(summary.claimedAmount)}). Claimed entries stay here for audit — they are never deleted.`;
    }
    const dateInput = $('suspenseDate');
    if (dateInput && !dateInput.value) dateInput.value = pakistanToday();
  }

  const form = $('suspensePaymentForm');
  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      try {
        const updated = addSuspensePayment(loadSuspensePayments(), {
          amount: $('suspenseAmount')?.value,
          wallet: $('suspenseWallet')?.value,
          senderName: $('suspenseSenderName')?.value,
          senderMobile: $('suspenseSenderMobile')?.value,
          tid: $('suspenseTid')?.value,
          date: $('suspenseDate')?.value
        });
        saveSuspensePayments(updated);
        form.reset();
        render();
        if (typeof onEntriesChanged === 'function') onEntriesChanged();
        if (typeof onToast === 'function') onToast('Suspense entry logged.');
      } catch (error) {
        if (typeof onToast === 'function') onToast(error.message || 'Could not log this entry.');
      }
    });
  }

  const copyBtn = $('suspenseCopyBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const text = $('suspenseReceiptText')?.textContent || '';
      try {
        await navigator.clipboard.writeText(text);
        if (typeof onToast === 'function') onToast('Receipt copied.');
      } catch {
        if (typeof onToast === 'function') onToast('Copy failed — select the receipt text manually.');
      }
    });
  }
  const printBtn = $('suspensePrintBtn');
  if (printBtn) {
    printBtn.addEventListener('click', () => {
      const text = $('suspenseReceiptText')?.textContent || '';
      try {
        const win = window.open('', '_blank');
        if (!win) throw new Error('popup blocked');
        win.document.write(`<pre style="font-family: monospace; white-space: pre-wrap;">${escapeHtml(text)}</pre>`);
        win.document.close();
        win.focus();
        win.print();
      } catch {
        if (typeof onToast === 'function') onToast('Print popup blocked — copy the receipt instead.');
      }
    });
  }

  const listEl = $('suspensePaymentsList');
  if (listEl) {
    listEl.addEventListener('click', async (event) => {
      const claimBtn = event.target.closest('[data-suspense-claim]');
      const deleteBtn = event.target.closest('[data-suspense-delete]');
      try {
        if (claimBtn) {
          const entry = loadSuspensePayments().find((e) => String(e.suspenseId) === String(claimBtn.dataset.suspenseClaim));
          if (!entry) return;
          const select = dialog.querySelector(`#suspenseCustomer-${entry.suspenseId}`);
          const customerId = select?.value || '';
          if (!customerId) {
            if (typeof onToast === 'function') onToast('Pick the customer this transfer belongs to first.');
            return;
          }
          if (typeof onClaim !== 'function') {
            if (typeof onToast === 'function') onToast('Claim is not wired yet.');
            return;
          }
          const result = await onClaim(entry, { customerId, month: getMonth() });
          if (result?.receipt) showReceipt(result.receipt);
          render();
          if (typeof onEntriesChanged === 'function') onEntriesChanged();
          if (typeof onToast === 'function') onToast(`Claimed: ${formatSuspensePKR(entry.amount)} linked to ${result?.entry?.claimedCustomerName || 'customer'}.`);
          return;
        }
        if (deleteBtn) {
          const entry = loadSuspensePayments().find((e) => String(e.suspenseId) === String(deleteBtn.dataset.suspenseDelete));
          if (!entry) return;
          if (typeof onConfirm === 'function') {
            const confirmed = await onConfirm({
              tone: 'danger',
              title: 'Delete this suspense entry?',
              subject: `${entry.suspenseId} · ${formatSuspensePKR(entry.amount)}`,
              message: 'Only for entries logged by mistake. Claimed entries cannot be deleted.',
              confirmLabel: 'Delete'
            });
            if (confirmed !== 'confirm') return;
          }
          saveSuspensePayments(deleteSuspensePayment(loadSuspensePayments(), entry.suspenseId));
          render();
          if (typeof onEntriesChanged === 'function') onEntriesChanged();
          if (typeof onToast === 'function') onToast('Suspense entry deleted.');
        }
      } catch (error) {
        if (typeof onToast === 'function') onToast(error.message || 'Could not complete this suspense action.');
      }
    });
  }
  const closeBtn = $('suspensePaymentsCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', () => dialog.close());
  const openBtn = typeof document !== 'undefined' ? document.getElementById('openSuspensePaymentsModalBtn') : null;
  if (openBtn) openBtn.addEventListener('click', () => {
    render();
    dialog.showModal();
  });

  return {
    open() {
      render();
      dialog.showModal();
    },
    refresh: render
  };
}
