// Plan 111 (Plan 101-202) — Late fee policy record.
//
// Late fees, when charged, feel arbitrary because no written policy
// says when they apply, how much they are, or when they stop. This
// module is that written policy — and nothing more:
//
//   - one policy record: name, grace days, fee amount and/or a fee
//     basis stated in plain words, a maximum fee, which bills it
//     applies to (packages, or all bills), and an effective date;
//   - a late fee on a bill always names the policy and effective
//     date behind it, so the collector can explain it calmly
//     instead of defending a figure invented at the door;
//   - fees never apply to a bill before the policy's effective
//     date, and never during a recorded one-time extension
//     (Plan 38), which pauses a single bill;
//   - waiving a fee goes through the approval limits (Plan 110):
//     a waiver record here only ever references a Plan 110
//     approval id — it never grants anything by itself.
//
// What this module is NOT:
//   - It charges no fee and rewrites no bill. lateFeeForBill only
//     answers whether a fee applies and how much; the fee itself
//     is still posted through its own existing path, never here.
//   - It never reads or rewrites Plan 38 extensions or Plan 110
//     approvals. Extensions and approvals arrive as caller-supplied
//     data (an extension's extended due date, an approval's id),
//     and this module names no extension or approval store.
//   - No past bill gains a fee retroactively: a bill whose due
//     date is before the policy's effective date never qualifies,
//     and a policy effective after the assessment date never
//     applies either.
//
// Pure and import-free: no storage, no DOM, no network, no other
// module. Money is integer cents throughout; a *Cents figure is
// used as-is, while a plain rupees figure converts to cents
// exactly once on the way in.

function cleanText(value) {
  if (value === null || value === undefined) return '';
  return String(value).normalize('NFKC').trim();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function formatMoney(cents) {
  if (cents === null || cents === undefined) return 'not set';
  const sign = cents < 0 ? '-' : '';
  return `${sign}PKR ${Math.abs(cents / 100).toLocaleString('en-US')}`;
}

function toCents(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return Math.round(value * 100);
  }
  const text = cleanText(value);
  if (text === '') return null;
  const num = Number(text);
  if (!Number.isFinite(num)) return null;
  return Math.round(num * 100);
}

function toCentsField(raw, centsRaw) {
  // A *Cents figure is already cents and is used as-is; only a plain
  // rupees figure converts (exactly once) via toCents.
  if (centsRaw !== null && centsRaw !== undefined && centsRaw !== '') {
    if (typeof centsRaw === 'number' && Number.isFinite(centsRaw)) return Math.round(centsRaw);
    const text = cleanText(centsRaw);
    const num = Number(text);
    if (text !== '' && Number.isFinite(num)) return Math.round(num);
  }
  return toCents(raw);
}

/** A strict YYYY-MM-DD date that really exists on the calendar. */
export function validLateFeeDate(value) {
  const text = cleanText(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  if (month === 2) {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    if (day > (leap ? 29 : 28)) return false;
  } else if (day > daysInMonth) {
    return false;
  }
  return true;
}

function daysBetween(earlier, later) {
  const a = new Date(`${earlier}T00:00:00Z`).getTime();
  const b = new Date(`${later}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
}

function splitList(value) {
  if (Array.isArray(value)) return value.map((v) => cleanText(v)).filter(Boolean);
  return cleanText(value).split(',').map((v) => v.trim()).filter(Boolean);
}

function dedupe(list) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const key = item.toLowerCase();
    if (!seen.has(key)) { seen.add(key); out.push(item); }
  }
  return out;
}

/**
 * Normalise one late-fee policy. Returns null when half-formed:
 * no id, blank name, blank fee basis, a negative grace-days figure,
 * a non-positive fee or maximum, or an impossible effective date.
 * A policy needs a fee amount OR a basis in plain words; the basis
 * text is always required so the fee is explainable at the door.
 * appliesToPackages empty means the policy applies to all bills.
 */
export function normalizeLateFeePolicy(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanText(raw.id);
  const name = cleanText(raw.name);
  const basis = cleanText(raw.basis || raw.feeBasis);
  const effectiveDate = cleanText(raw.effectiveDate);
  if (!id || !name || !basis || !validLateFeeDate(effectiveDate)) return null;
  let graceDays = 0;
  if (raw.graceDays !== null && raw.graceDays !== undefined && raw.graceDays !== '') {
    const num = Number(raw.graceDays);
    if (!Number.isFinite(num) || num < 0 || Math.floor(num) !== num) return null;
    graceDays = num;
  }
  const feeCents = toCentsField(raw.feeAmount, raw.feeCents);
  if (feeCents !== null && feeCents <= 0) return null;
  const maximumCents = toCentsField(raw.maximumFee, raw.maximumFeeCents);
  if (maximumCents !== null && maximumCents <= 0) return null;
  return {
    id,
    name,
    graceDays,
    feeCents,
    basis,
    maximumFeeCents: maximumCents,
    appliesToPackages: dedupe(splitList(raw.appliesToPackages ?? raw.appliesTo ?? '')),
    effectiveDate,
  };
}

export function normalizeLateFeePolicyList(rawList) {
  if (!Array.isArray(rawList)) return [];
  const out = [];
  for (const raw of rawList) {
    const policy = normalizeLateFeePolicy(raw);
    if (policy) out.push(policy);
  }
  return out;
}

/** Upsert by id; a half-formed policy leaves the list exactly unchanged. */
export function upsertLateFeePolicy(list, raw) {
  const base = normalizeLateFeePolicyList(list);
  const policy = normalizeLateFeePolicy(raw);
  if (!policy) return base;
  const next = base.filter((p) => p.id !== policy.id);
  next.push(policy);
  return next;
}

export function removeLateFeePolicy(list, id) {
  return normalizeLateFeePolicyList(list).filter((p) => p.id !== cleanText(id));
}

export function findLateFeePolicy(list, id) {
  return normalizeLateFeePolicyList(list).find((p) => p.id === cleanText(id)) ?? null;
}

/**
 * The policy in force on a date: the latest effective date on or
 * before that date. A policy effective after the date never applies.
 */
export function policyForDate(list, date) {
  const policies = normalizeLateFeePolicyList(list).filter((p) => p.effectiveDate <= cleanText(date));
  if (!policies.length) return null;
  policies.sort((a, b) => (a.effectiveDate < b.effectiveDate ? 1 : a.effectiveDate > b.effectiveDate ? -1 : a.id.localeCompare(b.id)));
  return policies[0];
}

function extensionMatches(extension, bill) {
  if (!extension || typeof extension !== 'object') return false;
  const extBillId = cleanText(extension.billId);
  const billId = cleanText(bill.billId ?? bill.id);
  if (extBillId && billId) return extBillId === billId;
  const extMonth = cleanText(extension.billMonth);
  const billMonth = cleanText(bill.billMonth);
  const extCustomer = cleanText(extension.customerId);
  const billCustomer = cleanText(bill.customerId);
  if (extMonth && billMonth && extCustomer && billCustomer) {
    return extMonth === billMonth && extCustomer === billCustomer;
  }
  return false;
}

/**
 * Answer whether a late fee applies to one bill on one assessment
 * date. The bill is caller-supplied plain data ({ dueDate,
 * billMonth/billId, customerId, package }); extensions are
 * caller-supplied Plan 38 records ({ extendedDueDate, ... }) —
 * nothing is read from any store here.
 *
 * Returns { applies, reason, feeCents, policyId, policyName,
 * effectiveDate, daysOverdue, graceDays, effectiveDueDate }.
 * feeCents is null when the policy states only a basis in plain
 * words and no fixed amount — the fee is then named, not priced,
 * by this answer. A bill already paid is never charged: pass
 * bill.paid === true and the answer is "already paid".
 */
export function lateFeeForBill({ policies, bill, extensions = [], asOfDate }) {
  const asOf = cleanText(asOfDate);
  const empty = (reason) => ({
    applies: false, reason, feeCents: null, policyId: null,
    policyName: null, effectiveDate: null, daysOverdue: null,
    graceDays: null, effectiveDueDate: null,
  });
  if (!bill || typeof bill !== 'object') return empty('No bill supplied.');
  if (!validLateFeeDate(asOf)) return empty('Assessment date is not a real date.');
  const dueDate = cleanText(bill.dueDate);
  if (!validLateFeeDate(dueDate)) return empty('Bill due date is not a real date.');
  if (bill.paid === true) return empty('Bill already paid.');
  const policy = policyForDate(policies, asOf);
  if (!policy) return empty('No late-fee policy in force on this date.');
  if (dueDate < policy.effectiveDate) {
    return { ...empty('Bill due before the policy effective date.'), policyId: policy.id, policyName: policy.name, effectiveDate: policy.effectiveDate };
  }
  const packages = policy.appliesToPackages;
  const billPackage = cleanText(bill.package);
  if (packages.length && billPackage && !packages.some((p) => p.toLowerCase() === billPackage.toLowerCase())) {
    return { ...empty('Policy does not apply to this bill package.'), policyId: policy.id, policyName: policy.name, effectiveDate: policy.effectiveDate };
  }
  let effectiveDue = dueDate;
  const extension = (Array.isArray(extensions) ? extensions : []).find((e) => extensionMatches(e, bill));
  if (extension) {
    const extended = cleanText(extension.extendedDueDate);
    if (validLateFeeDate(extended)) {
      if (asOf <= extended) {
        return { ...empty('Bill inside a recorded extension.'), policyId: policy.id, policyName: policy.name, effectiveDate: policy.effectiveDate, effectiveDueDate: extended };
      }
      effectiveDue = extended;
    }
  }
  const daysOverdue = daysBetween(effectiveDue, asOf);
  if (daysOverdue <= policy.graceDays) {
    return { ...empty(daysOverdue <= 0 ? 'Bill not yet due.' : 'Bill inside the grace period.'), policyId: policy.id, policyName: policy.name, effectiveDate: policy.effectiveDate, daysOverdue, graceDays: policy.graceDays, effectiveDueDate: effectiveDue };
  }
  let feeCents = policy.feeCents;
  if (feeCents !== null && policy.maximumFeeCents !== null && feeCents > policy.maximumFeeCents) {
    feeCents = policy.maximumFeeCents;
  }
  return {
    applies: true,
    reason: feeCents === null
      ? `Late fee applies under "${policy.name}" (effective ${policy.effectiveDate}): ${policy.basis}. No fixed amount in the policy — set the amount through the existing path.`
      : `Late fee of ${formatMoney(feeCents)} under "${policy.name}" (effective ${policy.effectiveDate}).`,
    feeCents,
    policyId: policy.id,
    policyName: policy.name,
    effectiveDate: policy.effectiveDate,
    daysOverdue,
    graceDays: policy.graceDays,
    effectiveDueDate: effectiveDue,
  };
}

/**
 * Record a late-fee waiver. This grants nothing by itself: a waiver
 * is refused outright without a Plan 110 approval id and a reason,
 * so waiving always goes through the approval limits. A duplicate
 * waiver id is refused and the list is left unchanged.
 */
export function normalizeLateFeeWaiver(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanText(raw.id);
  const billId = cleanText(raw.billId ?? raw.billMonth);
  const customerId = cleanText(raw.customerId);
  const approvalId = cleanText(raw.approvalId);
  const reason = cleanText(raw.reason);
  const date = cleanText(raw.date);
  if (!id || !billId || !customerId || !approvalId || !reason || !validLateFeeDate(date)) return null;
  const feeCents = toCentsField(raw.feeAmount, raw.feeCents);
  if (feeCents === null || feeCents <= 0) return null;
  return { id, billId, customerId, approvalId, reason, date, feeCents };
}

export function normalizeLateFeeWaiverList(rawList) {
  if (!Array.isArray(rawList)) return [];
  const out = [];
  for (const raw of rawList) {
    const waiver = normalizeLateFeeWaiver(raw);
    if (waiver) out.push(waiver);
  }
  return out;
}

/** Add a waiver; a half-formed or duplicate id leaves the list unchanged. */
export function addLateFeeWaiver(list, raw) {
  const base = normalizeLateFeeWaiverList(list);
  const waiver = normalizeLateFeeWaiver(raw);
  if (!waiver) return base;
  if (base.some((w) => w.id === waiver.id)) return base;
  return [...base, waiver];
}

export function removeLateFeeWaiver(list, id) {
  return normalizeLateFeeWaiverList(list).filter((w) => w.id !== cleanText(id));
}

export function waiversForCustomer(list, customerId) {
  return normalizeLateFeeWaiverList(list).filter((w) => w.customerId === cleanText(customerId));
}

export function lateFeePolicySummaryText(policies) {
  const list = normalizeLateFeePolicyList(policies);
  if (!list.length) return 'No late-fee policy recorded yet.';
  return list.map((p) => {
    const applies = p.appliesToPackages.length ? `applies to ${p.appliesToPackages.join(', ')}` : 'applies to all bills';
    const fee = p.feeCents === null ? `basis: ${p.basis}` : `${formatMoney(p.feeCents)}${p.maximumFeeCents !== null ? `, capped at ${formatMoney(p.maximumFeeCents)}` : ''} (${p.basis})`;
    return `${p.name}: ${p.graceDays} grace days, ${fee}, ${applies}, effective ${p.effectiveDate}.`;
  }).join(' ');
}

export function lateFeePolicyHtml(policy) {
  const p = normalizeLateFeePolicy(policy);
  if (!p) return '';
  const fee = p.feeCents === null ? escapeHtml(p.basis) : `${escapeHtml(formatMoney(p.feeCents))}${p.maximumFeeCents !== null ? ` (capped at ${escapeHtml(formatMoney(p.maximumFeeCents))})` : ''} — ${escapeHtml(p.basis)}`;
  return `<div><strong>${escapeHtml(p.name)}</strong> — ${p.graceDays} grace days · ${fee} · ${p.appliesToPackages.length ? `applies to ${escapeHtml(p.appliesToPackages.join(', '))}` : 'applies to all bills'} · effective ${escapeHtml(p.effectiveDate)}</div>`;
}

export function lateFeeResultHtml(result) {
  if (!result || typeof result !== 'object') return '';
  const fee = result.applies
    ? (result.feeCents === null ? 'Fee applies (amount per policy basis, not fixed)' : `Fee: ${escapeHtml(formatMoney(result.feeCents))}`)
    : 'No fee applies';
  return `<div>${escapeHtml(fee)}${result.policyName ? ` — policy "${escapeHtml(result.policyName)}" (effective ${escapeHtml(result.effectiveDate ?? '')})` : ''} · ${escapeHtml(result.reason ?? '')}</div>`;
}

export function lateFeePolicyCsv(policies) {
  const header = 'id,name,graceDays,feeCents,basis,maximumFeeCents,appliesToPackages,effectiveDate';
  const rows = normalizeLateFeePolicyList(policies).map((p) => [
    p.id, p.name, p.graceDays, p.feeCents ?? '', p.basis, p.maximumFeeCents ?? '', p.appliesToPackages.join(';'), p.effectiveDate,
  ].map(csvCell).join(','));
  return [header, ...rows].join('\n');
}

export function lateFeePolicyFilename() {
  return 'late-fee-policies.csv';
}
