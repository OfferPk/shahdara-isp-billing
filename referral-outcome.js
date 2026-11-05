// Plan 263 (Plan 203-350) — Referral outcome log per referrer.
//
// Referrals are tracked, but what happened to each referred customer
// afterwards (joined, stayed, left) is not logged per referrer, so
// the best referrers cannot be recognised. This module adds only
// the missing piece: one outcome entry per referred customer after
// activation — the referrer, the referred customer, the outcome
// (joined, stayed, or left), the date, and a note, plus dated
// follow-up notes.
//
// What this module is NOT, stated plainly:
//   - It is not the referral record itself. The Plan 28 referral
//     record stores who referred whom at onboarding; this module
//     only logs what happened afterwards, and it is neither read
//     nor rewritten here. The caller supplies the referral links,
//     and this module never touches them.
//   - It is not the thank-you draft. The Plan 170 draft prepares
//     one thank-you per referring customer per new customer; it is
//     neither read nor rewritten here. This module logs outcomes
//     only and prepares no draft.
//   - It is not the hamsaya credit engine, and it neither reads
//     nor writes it. An outcome entry carries no credit, discount,
//     or offer field at all, and recording an outcome never grants
//     any credit.
//   - It never changes any referral record, any customer record,
//     any bill, or any payment. Recording an outcome never changes
//     any of those, and this module holds no customer, bill, or
//     payment field beyond the names on the entry itself, so there
//     is nothing here that could rewrite one.
//   - A referrer page shows referred customers with their latest
//     outcome, and counts that sum to the referrals recorded: the
//     caller supplies the referred customers for a referrer, and
//     the joined, stayed, left, and no-outcome counts always add
//     up to that supplied list.
//   - An outcome entry is never edited, only annotated. There is
//     no edit function: only record, annotate, and remove. A dated
//     follow-up never rewrites the referrer, the referred
//     customer, the outcome, the date, or the note.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     record, and the module never reads storage, the clock, or
//     the network, and never mutates an input.
//   - A record with no id, no referrer, no referred customer, no
//     clear outcome, or no strict date is refused outright. The
//     outcome must be joined, stayed, or left. Unknown fields are
//     dropped, so a record can never grow a credit, bill, or
//     payment field.
//   - A duplicate id is never rewritten, and a second entry for
//     the same referred customer on the same date is refused, so
//     the latest outcome for a referred customer is always the
//     entry with the latest date.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const REFERRAL_OUTCOMES = Object.freeze([
  Object.freeze({ id: 'joined', label: 'Joined' }),
  Object.freeze({ id: 'stayed', label: 'Stayed' }),
  Object.freeze({ id: 'left', label: 'Left' }),
]);

export const REFERRAL_OUTCOME_IDS = Object.freeze(
  REFERRAL_OUTCOMES.map((outcome) => outcome.id),
);

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validReferralOutcomeDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  let limit = DAYS_IN_MONTH[month - 1];
  if (month === 2 && isLeapYear(year)) limit = 29;
  return day <= limit;
}

function cleanOutcome(raw) {
  const value = text(raw).toLowerCase();
  return REFERRAL_OUTCOME_IDS.includes(value) ? value : null;
}

function cleanFollowup(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const date = text(raw.date);
  const note = text(raw.note);
  if (!validReferralOutcomeDate(date) || !note) return null;
  return { date, note };
}

function normalizeEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const referrer = text(raw.referrer);
  const referredCustomer = text(raw.referredCustomer);
  const date = text(raw.date);
  if (!id || !referrer || !referredCustomer) return null;
  if (!validReferralOutcomeDate(date)) return null;
  const outcome = cleanOutcome(raw.outcome);
  if (!outcome) return null;
  const note = text(raw.note);
  const followups = Array.isArray(raw.followups)
    ? raw.followups.map(cleanFollowup).filter(Boolean)
    : [];
  return { id, referrer, referredCustomer, outcome, date, note, followups };
}

export function normalizeReferralOutcomeList(list) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const seenCustomerDates = new Set();
  const out = [];
  for (const raw of list) {
    const entry = normalizeEntry(raw);
    if (!entry) continue;
    if (seenIds.has(entry.id)) continue;
    const key = `${entry.referredCustomer.toLowerCase()}|${entry.date}`;
    if (seenCustomerDates.has(key)) continue;
    seenIds.add(entry.id);
    seenCustomerDates.add(key);
    out.push(entry);
  }
  return out;
}

export function recordReferralOutcome(list, raw) {
  const clean = normalizeReferralOutcomeList(list);
  const entry = normalizeEntry(raw);
  if (!entry) return clean;
  if (clean.some((item) => item.id === entry.id)) return clean;
  if (clean.some((item) => item.referredCustomer.toLowerCase() === entry.referredCustomer.toLowerCase() && item.date === entry.date)) return clean;
  return [...clean, entry];
}

export function removeReferralOutcome(list, id) {
  const clean = normalizeReferralOutcomeList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((item) => item.id !== wanted);
}

export function findReferralOutcome(list, id) {
  const clean = normalizeReferralOutcomeList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((item) => item.id === wanted) || null;
}

export function addReferralOutcomeNote(list, id, date, note) {
  const clean = normalizeReferralOutcomeList(list);
  const wanted = text(id);
  const followup = cleanFollowup({ date, note });
  if (!wanted || !followup) return clean;
  let changed = false;
  const out = clean.map((item) => {
    if (item.id !== wanted) return item;
    changed = true;
    return { ...item, followups: [...item.followups, followup] };
  });
  return changed ? out : clean;
}

function compareEntries(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.referrer.toLowerCase() !== b.referrer.toLowerCase()) return a.referrer.toLowerCase() < b.referrer.toLowerCase() ? -1 : 1;
  if (a.referredCustomer.toLowerCase() !== b.referredCustomer.toLowerCase()) return a.referredCustomer.toLowerCase() < b.referredCustomer.toLowerCase() ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

export function referralOutcomeSorted(list) {
  return normalizeReferralOutcomeList(list).sort(compareEntries);
}

export function latestReferralOutcome(list, referredCustomer) {
  const wanted = text(referredCustomer).toLowerCase();
  if (!wanted) return null;
  const matches = referralOutcomeSorted(list).filter(
    (item) => item.referredCustomer.toLowerCase() === wanted,
  );
  return matches.length ? matches[matches.length - 1] : null;
}

export function referralOutcomesForReferrer(list, referrer) {
  const wanted = text(referrer).toLowerCase();
  if (!wanted) return [];
  const clean = normalizeReferralOutcomeList(list);
  const seen = new Set();
  const customers = [];
  for (const item of clean) {
    if (item.referrer.toLowerCase() !== wanted) continue;
    const key = item.referredCustomer.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    customers.push(item.referredCustomer);
  }
  customers.sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1));
  const own = clean.filter((item) => item.referrer.toLowerCase() === wanted);
  return customers.map((customer) => {
    const latest = latestReferralOutcome(own, customer);
    return {
      referredCustomer: customer,
      outcome: latest.outcome,
      date: latest.date,
      note: latest.note,
      id: latest.id,
    };
  });
}

export function referralOutcomeCounts(list, referrer, referredCustomers) {
  const wanted = text(referrer).toLowerCase();
  const counts = { joined: 0, stayed: 0, left: 0, noOutcome: 0, total: 0 };
  if (!wanted || !Array.isArray(referredCustomers)) return counts;
  const seen = new Set();
  const customers = [];
  for (const raw of referredCustomers) {
    const name = text(raw);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    customers.push(name);
  }
  counts.total = customers.length;
  for (const customer of customers) {
    const latest = latestReferralOutcome(list, customer);
    if (!latest || latest.referrer.toLowerCase() !== wanted) {
      counts.noOutcome += 1;
    } else {
      counts[latest.outcome] += 1;
    }
  }
  return counts;
}

export function referralOutcomeReferrers(list) {
  const seen = new Set();
  const out = [];
  for (const item of referralOutcomeSorted(list)) {
    const key = item.referrer.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item.referrer);
  }
  return out;
}

export function referralOutcomeSummaryText(list) {
  const clean = normalizeReferralOutcomeList(list);
  if (!clean.length) return 'No referral outcomes recorded.';
  const joined = clean.filter((item) => item.outcome === 'joined').length;
  const stayed = clean.filter((item) => item.outcome === 'stayed').length;
  const left = clean.filter((item) => item.outcome === 'left').length;
  return `${clean.length} referral outcome${clean.length === 1 ? '' : 's'}: ${joined} joined, ${stayed} stayed, ${left} left.`;
}

export function referralOutcomeText(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return 'No referral outcome recorded.';
  const note = clean.note ? ` Note: ${clean.note.replace(/\.+$/, '')}.` : '';
  const notes = clean.followups.length
    ? ` Follow-ups: ${clean.followups.map((f) => `${f.date}: ${f.note}`).join('; ')}`
    : '';
  return `${clean.referredCustomer} referred by ${clean.referrer} — ${clean.outcome} on ${clean.date}.${note}${notes}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function referralOutcomeHtml(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return '<p>No referral outcome recorded.</p>';
  return `<p>${escapeHtml(referralOutcomeText(clean))}</p>`;
}

export function referralOutcomeAllHtml(list) {
  const sorted = referralOutcomeSorted(list);
  if (!sorted.length) return '<p>No referral outcomes recorded.</p>';
  return `<ul>${sorted.map((entry) => `<li>${escapeHtml(referralOutcomeText(entry))}</li>`).join('')}</ul>`;
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function referralOutcomeCsv(list) {
  const sorted = referralOutcomeSorted(list);
  const header = ['id', 'referrer', 'referred customer', 'outcome', 'date', 'note', 'follow-ups'];
  const rows = sorted.map((item) => [
    item.id,
    item.referrer,
    item.referredCustomer,
    item.outcome,
    item.date,
    item.note,
    item.followups.map((f) => `${f.date}: ${f.note}`).join('; '),
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

export function referralOutcomeFilename() {
  return 'referral-outcomes.csv';
}
