// Plan V — Digital payments and wallet polish: one reconciliation view.
//
// DISPLAY ONLY. This module computes NO new money figure and changes NO
// matching, void, or reconciliation logic. It only assembles, into one
// list with one action per row, what three existing sources already say:
//
//   - the ledger: buildWalletReconciliation(...) — matched (verified)
//     and unmatched (pending screenshot verification) recorded payments,
//     plus duplicate-TID groups (disputed);
//   - the Payments Inbox: received inbox items that still need review
//     or are still unrecorded;
//   - the suspense register: unidentified transfers that are still
//     unclaimed, or whose TID is already a recorded payment.
//
// BUCKET HONESTY — read this before summing anything:
//   - matched + unmatched rows ARE the report's recorded digital
//     payments, so their counts add up to report.digitalCount and
//     their amounts add up to report.digitalTotal. Those two identities
//     are pinned by tests.
//   - disputed rows OVERLAP the ledger rows by design: a duplicate-TID
//     group is the same payments, seen a second time as a dispute.
//     Bucket amounts therefore must NEVER be summed into a grand
//     total. Per-bucket totals are the only totals this view reports,
//     plus the ledger totals carried verbatim from the report.
//   - suspense-recorded rows are also overlaps (a suspense entry
//     pointing at an already-recorded payment), never new money.
//
// CP-01 (PR #689) — voided TIDs never block:
//   A suspense entry is "already recorded" only when
//   findPaymentsByTid(customers, tid) returns a match. That function
//   skips voided payments, so an entry whose TID matches ONLY a voided
//   payment stays suspense-unclaimed and actionable. This module does
//   not re-implement TID matching; it calls the existing function.
//
// Precedence, so no row appears twice:
//   - inbox: 'Needs review' beats unrecorded (a review item is shown
//     once, as review);
//   - suspense: already-recorded beats unclaimed; claimed entries are
//     audit history and are never shown (they need no action).
//   - only the report month is shown for inbox and suspense rows
//     (ledger rows are already month-scoped by the report itself).
//
// Inputs are never mutated: every row is a fresh object.

import { findPaymentsByTid, normalizeTid } from './wallet-reconciliation.js';

export const RECON_BUCKET_ORDER = Object.freeze([
  'matched',
  'unmatched',
  'disputed',
  'inbox-review',
  'inbox-unrecorded',
  'suspense-recorded',
  'suspense-unclaimed'
]);

export const RECON_BUCKET_LABELS = Object.freeze({
  matched: 'Matched — verified in statement',
  unmatched: 'Unmatched — pending screenshot verification',
  disputed: 'Disputed — duplicate transaction ID',
  'inbox-review': 'Inbox — needs review',
  'inbox-unrecorded': 'Inbox — unrecorded',
  'suspense-recorded': 'Suspense — already recorded',
  'suspense-unclaimed': 'Suspense — unclaimed'
});

export const RECON_BUCKET_ACTIONS = Object.freeze({
  matched: 'No action — verified in statement',
  unmatched: 'Check the screenshot, then mark verified in statement',
  disputed: 'Correct or delete the extra payment — do not log it again',
  'inbox-review': 'Review before recording',
  'inbox-unrecorded': 'Record against a customer, or log as suspense',
  'suspense-recorded': 'Already recorded — do not claim again',
  'suspense-unclaimed': 'Claim to a customer — or leave unclaimed'
});

function amountOf(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function textOf(value) {
  return value === null || value === undefined ? '' : String(value);
}

function dateOf(item) {
  const direct = textOf(item?.date);
  if (direct) return direct;
  const iso = textOf(item?.datetimeIso);
  return iso ? iso.slice(0, 10) : '';
}

function inMonth(dateStr, month) {
  return Boolean(month) && String(dateStr).slice(0, 7) === month;
}

function isValidDateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ''));
}

/** Settings checklist, display only: which payment channels the owner
 * has actually configured. The settings object itself is never changed
 * here; the Digital Payments & QR Settings dialog remains the only
 * place that edits it. */
export function describeDigitalSettings(settings) {
  const s = settings && typeof settings === 'object' ? settings : {};
  const ready = 'Ready';
  const add = 'Add in Digital Payments & QR Settings';
  return [
    { key: 'raast', label: 'Raast ID', configured: Boolean(textOf(s.ownerRaastId).trim()), action: textOf(s.ownerRaastId).trim() ? ready : add },
    { key: 'till', label: 'Merchant Till ID', configured: Boolean(textOf(s.ownerTillId).trim()), action: textOf(s.ownerTillId).trim() ? ready : add },
    { key: 'bank', label: 'Bank account', configured: Boolean(textOf(s.ownerAccountNumber).trim()), action: textOf(s.ownerAccountNumber).trim() ? ready : add },
    { key: 'qr', label: 'Static QR code', configured: textOf(s.ownerQrDataUrl).startsWith('data:image/'), action: textOf(s.ownerQrDataUrl).startsWith('data:image/') ? ready : add },
    { key: 'phone', label: 'WhatsApp phone', configured: Boolean(textOf(s.ownerPhone).trim()), action: textOf(s.ownerPhone).trim() ? ready : add }
  ];
}

function emptyView(month) {
  const buckets = {};
  for (const bucket of RECON_BUCKET_ORDER) {
    buckets[bucket] = {
      bucket,
      label: RECON_BUCKET_LABELS[bucket],
      action: RECON_BUCKET_ACTIONS[bucket],
      count: 0,
      amount: 0,
      rows: []
    };
  }
  return {
    month: month || '',
    buckets,
    rows: [],
    openItems: 0,
    ledger: { digitalTotal: 0, digitalCount: 0, pendingVerificationCount: 0, duplicateGroupCount: 0 },
    settings: []
  };
}

function pushRow(buckets, allRows, bucket, row) {
  const full = { bucket, action: RECON_BUCKET_ACTIONS[bucket], ...row };
  buckets[bucket].rows.push(full);
  buckets[bucket].count += 1;
  buckets[bucket].amount += amountOf(full.amount);
  allRows.push(full);
}

/**
 * Build the one reconciliation view for a report month.
 *
 * @param {object} args.report - buildWalletReconciliation(...) output.
 * @param {Array} args.customers - state.customers, used ONLY through
 *   findPaymentsByTid for the suspense-recorded check (CP-01).
 * @param {Array} args.inboxItems - Payments Inbox items (plain objects).
 * @param {Array} args.suspenseEntries - suspense register entries.
 * @param {object|null} args.settings - digital payments settings, or null
 *   to omit the settings checklist.
 */
export function buildWalletReconView({ report, customers = [], inboxItems = [], suspenseEntries = [], settings = null } = {}) {
  if (!report || typeof report !== 'object') return emptyView('');
  const month = textOf(report.month);
  const view = emptyView(month);
  const { buckets } = view;
  const allRows = [];

  // 1. Ledger rows, verbatim from the report.
  const payments = Array.isArray(report.payments) ? report.payments : [];
  for (const p of payments) {
    if (!p || typeof p !== 'object') continue;
    const bucket = p.walletVerified === true ? 'matched' : 'unmatched';
    pushRow(buckets, allRows, bucket, {
      source: 'ledger',
      date: textOf(p.date),
      amount: amountOf(p.amount),
      method: textOf(p.method),
      tid: textOf(p.transactionId),
      customerNumber: p.customerNumber ?? '',
      customerName: textOf(p.customerName),
      senderLabel: textOf(p.senderLabel),
      paymentId: textOf(p.paymentId),
      billMonth: textOf(p.billMonth)
    });
  }

  // 2. Disputed rows: one per duplicate-TID group (overlap, see header).
  const groups = Array.isArray(report.duplicateGroups) ? report.duplicateGroups : [];
  for (const group of groups) {
    if (!group || typeof group !== 'object') continue;
    const members = Array.isArray(group.payments) ? group.payments : [];
    const names = [...new Set(members.map((m) => textOf(m.customerName)).filter(Boolean))];
    pushRow(buckets, allRows, 'disputed', {
      source: 'duplicate',
      date: textOf(members[0]?.date),
      amount: members.reduce((sum, m) => sum + amountOf(m.amount), 0),
      method: 'Multiple',
      tid: textOf(group.displayTid || group.normalizedTid),
      customerNumber: '',
      customerName: names.join(', '),
      senderLabel: '',
      paymentCount: members.length,
      detail: `${members.length} payments share this TID`
    });
  }

  // 3. Inbox rows for this month: review beats unrecorded, recorded and
  // sent items need no reconciliation action here.
  const inbox = Array.isArray(inboxItems) ? inboxItems : [];
  const inboxRows = [];
  for (const item of inbox) {
    if (!item || typeof item !== 'object') continue;
    const date = dateOf(item);
    if (!inMonth(date, month)) continue;
    if (String(item.direction ?? '').toLowerCase() !== 'received') continue;
    if (item.status === 'Needs review') {
      inboxRows.push(['inbox-review', item, date]);
    } else if (!item.recorded) {
      inboxRows.push(['inbox-unrecorded', item, date]);
    }
  }
  inboxRows.sort((a, b) => String(b[2]).localeCompare(String(a[2])));
  for (const [bucket, item, date] of inboxRows) {
    pushRow(buckets, allRows, bucket, {
      source: 'inbox',
      date,
      amount: amountOf(item.amount),
      method: textOf(item.method || item.wallet || 'Easypaisa'),
      tid: textOf(item.txnId),
      customerNumber: '',
      customerName: textOf(item.senderName),
      senderLabel: textOf(item.senderName),
      paymentId: textOf(item.txnId)
    });
  }

  // 4. Suspense rows for this month. Claimed entries are audit history
  // and are never shown; unclaimed entries whose TID is already a
  // recorded (non-voided) payment are already-recorded, never claimed.
  const suspense = Array.isArray(suspenseEntries) ? suspenseEntries : [];
  const suspenseRows = [];
  for (const entry of suspense) {
    if (!entry || typeof entry !== 'object') continue;
    if (entry.claimed === true) continue;
    if (!(amountOf(entry.amount) > 0)) continue;
    if (!textOf(entry.wallet).trim()) continue;
    if (!isValidDateKey(entry.date) || !inMonth(entry.date, month)) continue;
    const tid = textOf(entry.tid);
    const matches = tid && normalizeTid(tid)
      ? findPaymentsByTid(Array.isArray(customers) ? customers : [], tid)
      : [];
    if (matches.length > 0) {
      suspenseRows.push(['suspense-recorded', entry, matches[0]]);
    } else {
      suspenseRows.push(['suspense-unclaimed', entry, null]);
    }
  }
  suspenseRows.sort((a, b) => String(b[1].date).localeCompare(String(a[1].date)));
  for (const [bucket, entry, match] of suspenseRows) {
    pushRow(buckets, allRows, bucket, {
      source: 'suspense',
      date: textOf(entry.date),
      amount: amountOf(entry.amount),
      method: textOf(entry.wallet),
      tid: textOf(entry.tid),
      customerNumber: match ? match.customerNumber ?? '' : '',
      customerName: match ? textOf(match.customerName) : textOf(entry.senderName),
      senderLabel: textOf(entry.senderName),
      paymentId: textOf(entry.suspenseId),
      detail: match ? `Recorded for #${match.customerNumber ?? ''} ${textOf(match.customerName)}` : ''
    });
  }

  view.rows = allRows;
  view.openItems = allRows.filter((r) => r.bucket !== 'matched').length;
  view.ledger = {
    digitalTotal: amountOf(report.digitalTotal),
    digitalCount: Number(report.digitalCount) || 0,
    pendingVerificationCount: Array.isArray(report.pendingVerification)
      ? report.pendingVerification.length
      : buckets.unmatched.count,
    duplicateGroupCount: groups.length
  };
  view.settings = settings ? describeDigitalSettings(settings) : [];
  return view;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Render the view as HTML for the wallet ledger dialog. Every value
 * is escaped; a bucket filter of 'All' (default) shows every bucket. */
export function walletReconViewHtml(recon, { bucketFilter = 'All' } = {}) {
  if (!recon || typeof recon !== 'object' || !recon.buckets || !recon.month) {
    return '<p class="wallet-ledger-empty">No reconciliation data for this month.</p>';
  }
  const shown = RECON_BUCKET_ORDER.filter((b) => bucketFilter === 'All' || b === bucketFilter);
  const sections = shown.map((bucket) => {
    const b = recon.buckets[bucket];
    if (!b) return '';
    const rowsHtml = b.rows.length === 0
      ? '<p class="wallet-ledger-empty">Nothing here.</p>'
      : `<ul>${b.rows.map((r) => `<li><strong>${escapeHtml(r.customerName || r.tid || '—')}</strong> · ${escapeHtml(r.date)} · ${escapeHtml(r.method)}${r.tid ? ` · TID ${escapeHtml(r.tid)}` : ''} · <strong>${escapeHtml(String(r.amount))}</strong><br><span>${escapeHtml(r.action)}${r.detail ? ` — ${escapeHtml(r.detail)}` : ''}</span></li>`).join('')}</ul>`;
    return `<article class="wallet-recon-bucket"><h4>${escapeHtml(b.label)}</h4><p>${b.count} entries · ${escapeHtml(String(b.amount))} · ${escapeHtml(b.action)}</p>${rowsHtml}</article>`;
  }).join('');
  const settingsHtml = Array.isArray(recon.settings) && recon.settings.length > 0
    ? `<article class="wallet-recon-bucket"><h4>Digital payment channels</h4><ul>${recon.settings.map((s) => `<li>${escapeHtml(s.label)}: ${s.configured ? 'Ready' : escapeHtml(s.action)}</li>`).join('')}</ul></article>`
    : '';
  return `<div class="wallet-recon-view"><p>${recon.openItems} items need action in ${escapeHtml(recon.month)}.</p>${sections}${settingsHtml}</div>`;
}
