// Plan 28 (Plan 1-100) — Customer referral tracking (activation-gated,
// no automatic credit).
//
// New customers arrive by word of mouth, but nobody records who
// referred them, so the households doing the recommending are never
// recognised and the channel cannot be measured. This module is the
// referral RECORD only, captured at onboarding (Plan 16): the referring
// customer (if any), the date, and a status of pending, activated, or
// not eligible. A referral counts as successful only once the referred
// customer is activated — the Plan 16 activation step ticked — never
// before.
//
// Scope fence, stated plainly:
//   - This grants nothing automatically and changes no bill, payment,
//     concession, or Waada record by itself. Any thank-you credit is
//     applied separately by the operator through the existing
//     concession/discount path with its own audit note.
//   - This is NOT the SISP-40 hamsaya referral credit engine and it
//     neither reads nor writes it. SISP-40 queues a credit when the
//     referred customer makes their FIRST real payment, and it keys off
//     the customer record's referredByCustomerId link. Plan 28 is a
//     different, activation-gated record: it is keyed off the Plan 16
//     activation step, it carries its own date and status, and it
//     produces a referrer report. Neither system touches the other.
//   - At most one referral record per new customer, ever. Recording a
//     second referrer for the same customer replaces the first record,
//     never piles up two.
//   - The module is import-free (like coverage-register.js): the caller
//     supplies every referral, every customer name, and the set of
//     activated customer ids, and the module never reads storage, the
//     clock, or the network, and never mutates an input.
//   - A date that is not a real YYYY-MM-DD calendar date becomes null,
//     never a guessed date. A missing date is shown as "Not recorded".

export const REFERRAL_STATUSES = Object.freeze([
  Object.freeze({ id: 'pending', label: 'Pending' }),
  Object.freeze({ id: 'activated', label: 'Activated' }),
  Object.freeze({ id: 'not_eligible', label: 'Not eligible' }),
]);

export const REFERRAL_STATUS_IDS = Object.freeze(
  REFERRAL_STATUSES.map((status) => status.id),
);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function validDate(value) {
  const str = text(value);
  if (!DATE_RE.test(str)) return null;
  const parsed = new Date(`${str}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10) === str ? str : null;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function csvCell(value) {
  const str = String(value ?? '');
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function statusLabel(statusId) {
  return REFERRAL_STATUSES.find((status) => status.id === statusId)?.label ?? 'Pending';
}

function nameFor(names, id) {
  if (typeof names === 'function') return text(names(id)) || id;
  if (names && typeof names === 'object') return text(names[id]) || id;
  return id;
}

// One normalised referral record, or null when the row names no real
// pair: a missing referred customer, a missing referrer, or a
// self-referral is rejected, never invented. An unknown status falls
// back to pending; a bad date becomes null.
export function normalizeReferral(record) {
  const referredCustomerId = text(
    record?.referredCustomerId ?? record?.referredId ?? record?.customerId,
  );
  const referrerCustomerId = text(
    record?.referrerCustomerId ?? record?.referrerId ?? record?.referredByCustomerId,
  );
  if (!referredCustomerId || !referrerCustomerId) return null;
  if (referredCustomerId === referrerCustomerId) return null;
  const status = REFERRAL_STATUS_IDS.includes(record?.status) ? record.status : 'pending';
  return {
    referredCustomerId,
    referrerCustomerId,
    date: validDate(record?.date ?? record?.referredAt ?? record?.at),
    note: text(record?.note) || null,
    status,
  };
}

export function normalizeReferrals(records) {
  const byReferred = new Map();
  for (const record of Array.isArray(records) ? records : []) {
    const normalised = normalizeReferral(record);
    if (normalised) byReferred.set(normalised.referredCustomerId, normalised);
  }
  return [...byReferred.values()];
}

export function findReferral(referrals, referredCustomerId) {
  const id = text(referredCustomerId);
  if (!id) return null;
  return (Array.isArray(referrals) ? referrals : [])
    .map((record) => normalizeReferral(record))
    .find((record) => record && record.referredCustomerId === id) ?? null;
}

// At most one record per referred customer: upserting replaces the
// existing record for that customer, never adds a second one. Inputs
// are never mutated.
export function upsertReferral(referrals, record) {
  const normalised = normalizeReferral(record);
  if (!normalised) return normalizeReferrals(referrals);
  const next = normalizeReferrals(referrals)
    .filter((row) => row.referredCustomerId !== normalised.referredCustomerId);
  next.push(normalised);
  return next;
}

export function removeReferral(referrals, referredCustomerId) {
  const id = text(referredCustomerId);
  return normalizeReferrals(referrals)
    .filter((row) => row.referredCustomerId !== id);
}

// The activation gate, derived fresh every time: a record the operator
// marked not eligible stays not eligible (a manual override, never
// silently cleared); a referred customer in the activated set counts
// as activated; every other record is pending. Nothing here writes a
// bill, a payment, a concession, or a Waada record.
export function deriveReferralStatuses(referrals, activatedCustomerIds) {
  const activated = new Set(
    (Array.isArray(activatedCustomerIds) ? activatedCustomerIds : []).map((id) => text(id)).filter(Boolean),
  );
  return normalizeReferrals(referrals).map((row) => {
    if (row.status === 'not_eligible') return { ...row };
    return { ...row, status: activated.has(row.referredCustomerId) ? 'activated' : 'pending' };
  });
}

// The referral report: one row per referrer, with their referrals and
// counts. Sorted by activated referrals first, then total referrals,
// then referrer name A–Z; referrals inside a row by date (undated
// last), then referred name A–Z. A customer id with no supplied name
// is shown as its id, never as a guessed name.
export function buildReferralReport(referrals, options = {}) {
  const names = options.names ?? options.customerNames ?? {};
  const byReferrer = new Map();
  for (const row of normalizeReferrals(referrals)) {
    const referrerId = row.referrerCustomerId;
    if (!byReferrer.has(referrerId)) {
      byReferrer.set(referrerId, {
        referrerCustomerId: referrerId,
        referrerName: nameFor(names, referrerId),
        referrals: [],
      });
    }
    byReferrer.get(referrerId).referrals.push({
      referredCustomerId: row.referredCustomerId,
      referredName: nameFor(names, row.referredCustomerId),
      date: row.date,
      note: row.note,
      status: row.status,
    });
  }
  const rows = [...byReferrer.values()].map((group) => {
    const referrals = [...group.referrals].sort((a, b) => {
      if (a.date && b.date) return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
      if (a.date) return -1;
      if (b.date) return 1;
      return a.referredName.localeCompare(b.referredName);
    });
    return {
      ...group,
      referrals,
      total: referrals.length,
      activated: referrals.filter((r) => r.status === 'activated').length,
      pending: referrals.filter((r) => r.status === 'pending').length,
      notEligible: referrals.filter((r) => r.status === 'not_eligible').length,
    };
  });
  rows.sort((a, b) => (
    b.activated - a.activated
    || b.total - a.total
    || a.referrerName.localeCompare(b.referrerName)
  ));
  return rows;
}

export function referralSummaryText(referrals) {
  const rows = normalizeReferrals(referrals);
  const activated = rows.filter((r) => r.status === 'activated').length;
  const pending = rows.filter((r) => r.status === 'pending').length;
  const notEligible = rows.filter((r) => r.status === 'not_eligible').length;
  const referrers = new Set(rows.map((r) => r.referrerCustomerId)).size;
  return `${rows.length} referral${rows.length === 1 ? '' : 's'} · ${activated} activated · ${pending} pending · ${notEligible} not eligible · ${referrers} referrer${referrers === 1 ? '' : 's'}`;
}

export function referralReportHtml(report) {
  const rows = Array.isArray(report) ? report : [];
  if (!rows.length) return '<p class="empty-state">No referral records yet.</p>';
  return rows.map((group) => `<h4>${escapeHtml(group.referrerName)} — ${group.activated} activated of ${group.total}</h4><table class="data-table"><thead><tr><th>Referred customer</th><th>Date</th><th>Status</th><th></th></tr></thead><tbody>${group.referrals.map((r) => `<tr><td>${escapeHtml(r.referredName)}</td><td>${r.date ? escapeHtml(r.date) : 'Not recorded'}</td><td>${escapeHtml(statusLabel(r.status))}</td><td>${r.status === 'not_eligible' ? '' : `<button type="button" class="secondary-button btn-sm" data-referral-not-eligible="${escapeHtml(r.referredCustomerId)}">Mark not eligible</button>`}</td></tr>`).join('')}</tbody></table>`).join('');
}

export function referralReportCsv(report) {
  const rows = Array.isArray(report) ? report : [];
  const lines = ['referrer_id,referrer_name,referred_id,referred_name,date,status'];
  for (const group of rows) {
    for (const r of group.referrals) {
      lines.push([
        group.referrerCustomerId, group.referrerName,
        r.referredCustomerId, r.referredName,
        r.date ?? '', statusLabel(r.status),
      ].map(csvCell).join(','));
    }
  }
  return lines.join('\n');
}

export function referralReportFilename() {
  return 'referral-report.csv';
}
