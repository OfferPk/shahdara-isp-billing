/**
 * #298 Payments list polish (Transactions screen).
 * - Compact rows (~64–72 px): name #id · PKR amount · method chip · date · Paid/Partial chip. Tapping the
 *   row expands its details and every action (WhatsApp receipt, Print, 80mm / 58mm slip, Edit, Delete).
 * - Day groups with a daily subtotal: "Today · 3 payments · PKR 3,000 (Cash 3,000)".
 * - Payment-deletion audit log kept on this device (with the optional reason the owner typed).
 * Pure helpers are exported for unit tests; setupPaymentsList() wires the expand / collapse behaviour.
 */

const LOG_KEY = 'shahdara_payment_deletion_log';
const LOG_MAX = 300;

export function pktDateKey(now = new Date()) {
  return new Date(now.getTime() + 5 * 3600 * 1000).toISOString().slice(0, 10);
}

export function paymentDayLabel(date, today = pktDateKey()) {
  if (!date) return 'No date';
  if (date === today) return 'Today';
  const t = new Date(`${today}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() - 1);
  if (date === t.toISOString().slice(0, 10)) return 'Yesterday';
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return String(date);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

const pkr = n => `PKR ${Math.round(Number(n) || 0).toLocaleString('en-PK')}`;

/** Totals for one day: count, total, and a per-method split (largest first). */
export function summarizeDay(transactions = []) {
  const byMethod = new Map();
  let total = 0;
  for (const tx of transactions) {
    const amount = Number(tx.amount) || 0;
    total += amount;
    const method = String(tx.method || 'Other');
    byMethod.set(method, (byMethod.get(method) || 0) + amount);
  }
  return { count: transactions.length, total, byMethod: [...byMethod.entries()].sort((a, b) => b[1] - a[1]) };
}

export function dayHeaderText(date, transactions, today = pktDateKey()) {
  const s = summarizeDay(transactions);
  const split = s.byMethod.map(([m, v]) => `${m} ${Math.round(v).toLocaleString('en-PK')}`).join(', ');
  return `${paymentDayLabel(date, today)} · ${s.count} ${s.count === 1 ? 'payment' : 'payments'} · ${pkr(s.total)}${split ? ` (${split})` : ''}`;
}

/** Group date-sorted transactions into days. Returns a Map(date -> transactions[]) in list order. */
export function groupByDay(transactions = []) {
  const groups = new Map();
  for (const tx of transactions) {
    const key = tx.date || '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(tx);
  }
  return groups;
}

/** The "Selected bill month" line only adds information when it differs from the payment's month. */
export function billMonthDiffers(tx) {
  return Boolean(tx?.month && tx?.date && String(tx.date).slice(0, 7) !== tx.month);
}

export function methodSlug(method = '') {
  return String(method).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'other';
}

/* ------------------------------ deletion audit log ------------------------------ */

export function readPaymentDeletionLog(storage = globalThis.localStorage) {
  try { const list = JSON.parse(storage?.getItem(LOG_KEY) || '[]'); return Array.isArray(list) ? list : []; } catch { return []; }
}

export function recordPaymentDeletion(entry, storage = globalThis.localStorage) {
  const item = {
    at: new Date().toISOString(),
    paymentId: String(entry.paymentId || ''),
    customerId: String(entry.customerId || ''),
    customerNumber: entry.customerNumber ?? null,
    customerName: String(entry.customerName || ''),
    month: String(entry.month || ''),
    date: String(entry.date || ''),
    amount: Number(entry.amount) || 0,
    method: String(entry.method || ''),
    reason: String(entry.reason || '').trim().slice(0, 200),
    undone: false
  };
  const list = readPaymentDeletionLog(storage);
  list.push(item);
  try { storage?.setItem(LOG_KEY, JSON.stringify(list.slice(-LOG_MAX))); } catch { /* storage full: the delete still works */ }
  return item;
}

export function markPaymentDeletionUndone(paymentId, storage = globalThis.localStorage) {
  const list = readPaymentDeletionLog(storage);
  for (let i = list.length - 1; i >= 0; i--) if (list[i].paymentId === paymentId && !list[i].undone) { list[i].undone = true; list[i].undoneAt = new Date().toISOString(); break; }
  try { storage?.setItem(LOG_KEY, JSON.stringify(list)); } catch {}
}

/* ------------------------------ expand / collapse ------------------------------ */

export function setupPaymentsList(doc = document, win = window) {
  const list = doc.getElementById('transactionsList');
  if (!list) return null;
  const expanded = new Set();
  const apply = () => {
    list.querySelectorAll('.transaction-card[data-payment-row]').forEach(li => {
      const open = expanded.has(li.dataset.paymentRow);
      const btn = li.querySelector('.tx-row');
      const details = li.querySelector('.tx-details');
      if (!btn || !details) return;
      btn.setAttribute('aria-expanded', String(open));
      details.hidden = !open;
      li.classList.toggle('is-expanded', open);
    });
  };
  list.addEventListener('click', e => {
    const btn = e.target.closest?.('.tx-row');
    if (!btn || !list.contains(btn)) return;
    const id = btn.closest('[data-payment-row]')?.dataset.paymentRow;
    if (!id) return;
    if (expanded.has(id)) expanded.delete(id); else expanded.add(id);
    apply();
  });
  // Keep rows open across re-renders (filters, saves).
  if (typeof win.MutationObserver === 'function') new win.MutationObserver(apply).observe(list, { childList: true });
  // The long filter explanation moves behind a small ⓘ.
  const help = doc.getElementById('transactionFilterHelp');
  if (help && !help.closest('details')) {
    const tip = doc.createElement('details');
    tip.className = 'help-tip tx-filter-help-tip';
    tip.innerHTML = '<summary class="help-icon" aria-label="How the payment filters work">i</summary>';
    help.replaceWith(tip);
    tip.appendChild(help);
  }
  return { expand: id => { expanded.add(id); apply(); }, collapseAll: () => { expanded.clear(); apply(); }, isExpanded: id => expanded.has(id) };
}
