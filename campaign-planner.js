// Plan 30 (Plan 1-100) — Seasonal collection campaign planner.
//
// Collection drives before a festival or a school-fees season are
// improvised, so some mohallas get a push and others are forgotten,
// and nobody can tell afterwards whether the drive worked. This module
// is the planner for such a drive: a campaign record only — an
// operator-set window, selected mohallas, and a target list drawn from
// existing dues — plus the closing summary that tracks collections
// recorded inside the window against the campaign's starting dues.
//
// Scope fence, stated plainly:
//   - It creates no discount, waiver, or billing change of its own.
//     A payment record is never written, edited, or voided here;
//     collections are only ATTRIBUTED to a campaign (read from the
//     caller-supplied payment records), never altered by it.
//   - Plans 11-12 keep individual reminders. This module sends no
//     reminder and builds no reminder draft; it only plans which
//     mohallas a drive covers and measures what came in.
//   - It is import-free (like pre-due-reminders.js, escalation-ladder.js
//     and coverage-register.js): the caller supplies every campaign,
//     every due row, and every payment record, and the module never
//     reads storage, the clock, or the network, and never mutates an
//     input.
//   - A mohalla is addressed by the Plan T canonical rule, mirrored
//     here so this module stays import-free: the leading generic
//     "Mohalla"/"Mohalaa" word is stripped before comparing, comparison
//     is case-insensitive after NFKC normalisation, known spellings
//     collapse (bani -> BANII, kishti -> KISHTII, chamyaa -> CHAMYAAA),
//     and an unknown name keeps its own key and readable label, so it
//     is addressed as written, never dropped. A customer with no
//     mohalla is counted as excluded, never guessed into a mohalla.
//   - Dates are real YYYY-MM-DD calendar dates (2026-02-30 is
//     rejected, never guessed). The window is inclusive at both ends:
//     a collection on the start date or the end date counts.
//   - A campaign with a blank name, a missing window, or a start date
//     after its end date is rejected (null), never silently repaired
//     by swapping dates or inventing a name. An empty mohalla
//     selection targets nobody, counted, never every mohalla.
//   - Money is whole rupees in the wiring (as in the pre-due queue),
//     but the module accepts any finite number and rounds to two
//     decimals, so a fractional test fixture still sums exactly.
//     Voided payments are never attributed. A payment for a customer
//     who is not a target is never attributed either.
//   - The closing summary always balances: starting dues plus any
//     over-collection equals collections attributed plus still
//     outstanding, on the same fixture. Over-collection (a target
//     customer paying more inside the window than their starting
//     dues) is shown separately, never hidden by capping collected
//     at starting dues and never by inflating still outstanding.

const DEFAULT_MOHALLAS = Object.freeze([
  'CHARYAA', 'GANGALL', 'KISHTII', 'BARRIAN', 'THALII', 'CHAMYAAA',
  'PALALIYAA', 'MALLA', 'NAKAR', 'BANII', 'SODAA', 'PULL SIDE',
  'JABBIYAA', 'MOHALLA CHUDRIYAA', 'MOHALLA end side farm house',
]);

const MOHALLA_ALIASES = Object.freeze({
  bani: 'BANII',
  kishti: 'KISHTII',
  chamyaa: 'CHAMYAAA',
});

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizedText(value) {
  return String(value ?? '').normalize('NFKC').replace(/\s+/gu, ' ').trim();
}

function comparisonKey(value) {
  return normalizedText(value).toLocaleLowerCase('en');
}

function stripMohallaPrefix(value) {
  const stripped = normalizedText(value).replace(/^(?:mohalla|mohalaa)\s+/iu, '');
  return stripped || normalizedText(value);
}

function readableLabel(value) {
  const readableWord = (word) => {
    const letters = word.match(/\p{L}/gu) ?? [];
    if (letters.length >= 2 && letters.length <= 3 && letters.every((letter) => letter === letter.toLocaleUpperCase('en-US'))) return word;
    const chars = Array.from(word);
    if (!chars.length) return word;
    return chars[0].toLocaleUpperCase('en-US') + chars.slice(1).join('').toLocaleLowerCase('en-US');
  };
  return normalizedText(value).split(' ').map(readableWord).join(' ');
}

// Mirrors phase3.js canonicalMohalla without importing the app graph.
// Returns { key, label, stored } or null when blank.
export function canonicalCampaignMohalla(value) {
  const raw = text(value);
  if (!raw) return null;
  const stripped = stripMohallaPrefix(raw);
  const key = comparisonKey(stripped);
  const canonical = DEFAULT_MOHALLAS.find((name) => comparisonKey(stripMohallaPrefix(name)) === key) ?? MOHALLA_ALIASES[key];
  if (canonical) return { key: comparisonKey(stripMohallaPrefix(canonical)), label: readableLabel(canonical), stored: canonical };
  return { key, label: readableLabel(stripped), stored: raw };
}

// A real calendar date in YYYY-MM-DD form, or null. 2026-02-30 is
// rejected: the Date round-trip must reproduce the same string.
export function validCampaignDate(value) {
  const str = text(value);
  if (!DATE_RE.test(str)) return null;
  const parsed = new Date(`${str}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10) === str ? str : null;
}

function money(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

// The campaign window, normalised. Valid only when both dates are
// real calendar dates and the start is not after the end.
export function normalizeCampaignWindow(startDate, endDate) {
  const start = validCampaignDate(startDate);
  const end = validCampaignDate(endDate);
  if (!start || !end) return { valid: false, startDate: start, endDate: end, reason: !start && !end ? 'missing-window' : (!start ? 'missing-start' : 'missing-end') };
  if (start > end) return { valid: false, startDate: start, endDate: end, reason: 'start-after-end' };
  return { valid: true, startDate: start, endDate: end, reason: null };
}

// Canonical mohalla keys for a selection, deduplicated in first-seen
// order. Blanks are dropped; an empty selection yields no keys.
export function campaignMohallaKeys(mohallas) {
  const keys = [];
  const seen = new Set();
  for (const raw of Array.isArray(mohallas) ? mohallas : [mohallas]) {
    const canon = canonicalCampaignMohalla(raw);
    if (!canon || seen.has(canon.key)) continue;
    seen.add(canon.key);
    keys.push(canon.key);
  }
  return keys;
}

export function campaignMohallaLabels(mohallas) {
  const labels = [];
  const seen = new Set();
  for (const raw of Array.isArray(mohallas) ? mohallas : [mohallas]) {
    const canon = canonicalCampaignMohalla(raw);
    if (!canon || seen.has(canon.key)) continue;
    seen.add(canon.key);
    labels.push(canon.label);
  }
  return labels;
}

// One campaign record, normalised, or null when it cannot be a
// campaign: blank id, blank name, or an invalid window.
export function normalizeCampaign(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const name = text(raw.name);
  if (!id || !name) return null;
  const window = normalizeCampaignWindow(raw.startDate, raw.endDate);
  if (!window.valid) return null;
  const mohallas = campaignMohallaKeys(raw.mohallas);
  return {
    id,
    name,
    startDate: window.startDate,
    endDate: window.endDate,
    mohallas,
    mohallaLabels: campaignMohallaLabels(raw.mohallas),
    note: text(raw.note),
  };
}

export function buildCampaign({ id, name, startDate, endDate, mohallas, note } = {}) {
  return normalizeCampaign({ id, name, startDate, endDate, mohallas, note });
}

export function findCampaign(campaigns, id) {
  const wanted = text(id);
  if (!wanted) return null;
  for (const row of Array.isArray(campaigns) ? campaigns : []) {
    const campaign = normalizeCampaign(row);
    if (campaign && campaign.id === wanted) return campaign;
  }
  return null;
}

// One campaign per id: upserting under an existing id replaces it,
// never piles up two campaigns with the same id. Invalid rows are
// dropped, never stored as a silent broken campaign.
export function upsertCampaign(campaigns, raw) {
  const campaign = normalizeCampaign(raw);
  if (!campaign) return (Array.isArray(campaigns) ? campaigns : []).map((row) => normalizeCampaign(row)).filter(Boolean);
  const kept = [];
  for (const row of Array.isArray(campaigns) ? campaigns : []) {
    const existing = normalizeCampaign(row);
    if (existing && existing.id !== campaign.id) kept.push(existing);
  }
  kept.push(campaign);
  return kept;
}

export function removeCampaign(campaigns, id) {
  const wanted = text(id);
  return (Array.isArray(campaigns) ? campaigns : [])
    .map((row) => normalizeCampaign(row))
    .filter((campaign) => campaign && campaign.id !== wanted);
}

// The campaign's target list: exactly the selected mohallas' due
// customers on the same fixture. One row per customer, dues summed
// across that customer's due rows, sorted by name A–Z then id.
// A due row with no customer, a non-positive balance, a mohalla
// outside the selection, or no mohalla at all is counted as
// excluded, never invented into the list.
export function buildCampaignTargets({ campaign, dues } = {}) {
  const norm = normalizeCampaign(campaign);
  const counts = {
    totalDues: 0,
    includedDues: 0,
    excludedZeroBalance: 0,
    excludedOtherMohalla: 0,
    excludedNoMohalla: 0,
    excludedInvalid: 0,
  };
  if (!norm) {
    return { valid: false, campaign: null, targets: [], totalStartingDues: 0, targetCount: 0, counts };
  }
  const selected = new Set(norm.mohallas);
  const byCustomer = new Map();
  for (const due of Array.isArray(dues) ? dues : []) {
    counts.totalDues += 1;
    const customerId = text(due?.customerId);
    if (!customerId) { counts.excludedInvalid += 1; continue; }
    const balanceDue = money(due?.balanceDue);
    if (!(balanceDue > 0)) { counts.excludedZeroBalance += 1; continue; }
    const canon = canonicalCampaignMohalla(due?.mohalla);
    if (!canon) { counts.excludedNoMohalla += 1; continue; }
    if (!selected.has(canon.key)) { counts.excludedOtherMohalla += 1; continue; }
    counts.includedDues += 1;
    let row = byCustomer.get(customerId);
    if (!row) {
      row = {
        customerId,
        customerName: text(due?.customerName) || '—',
        mohalla: canon.label,
        mohallaKey: canon.key,
        startingDues: 0,
        dueCount: 0,
      };
      byCustomer.set(customerId, row);
    }
    row.startingDues = round2(row.startingDues + balanceDue);
    row.dueCount += 1;
  }
  const targets = [...byCustomer.values()].sort((a, b) => {
    const byName = a.customerName.localeCompare(b.customerName, 'en');
    return byName !== 0 ? byName : a.customerId.localeCompare(b.customerId, 'en');
  });
  const totalStartingDues = round2(targets.reduce((sum, row) => sum + row.startingDues, 0));
  return { valid: true, campaign: norm, targets, totalStartingDues, targetCount: targets.length, counts };
}

// Collections inside the window, attributed to the campaign's
// targets. A payment is attributed only when it is not voided, its
// amount is positive, its date is a real date inside the window
// (inclusive both ends), and its customer is a target. Nothing here
// writes, edits, or voids a payment record.
export function attributeCampaignCollections({ campaign, targets, payments } = {}) {
  const norm = normalizeCampaign(campaign);
  const counts = {
    totalPayments: 0,
    attributedPayments: 0,
    excludedVoided: 0,
    excludedZeroBalance: 0,
    excludedOutsideWindow: 0,
    excludedNonTarget: 0,
    excludedInvalid: 0,
  };
  const targetIds = new Set();
  for (const row of Array.isArray(targets) ? targets : []) {
    if (text(row?.customerId)) targetIds.add(text(row.customerId));
  }
  if (!norm) {
    return { valid: false, campaign: null, perTarget: [], collected: 0, counts };
  }
  const collectedBy = new Map();
  for (const payment of Array.isArray(payments) ? payments : []) {
    counts.totalPayments += 1;
    const customerId = text(payment?.customerId);
    if (!customerId || !targetIds.has(customerId)) {
      if (!customerId) counts.excludedInvalid += 1;
      else counts.excludedNonTarget += 1;
      continue;
    }
    if (payment?.voided === true) { counts.excludedVoided += 1; continue; }
    const amount = money(payment?.amount);
    if (!(amount > 0)) { counts.excludedZeroBalance += 1; continue; }
    const date = validCampaignDate(payment?.date);
    if (!date || date < norm.startDate || date > norm.endDate) { counts.excludedOutsideWindow += 1; continue; }
    counts.attributedPayments += 1;
    const entry = collectedBy.get(customerId) ?? { customerId, collected: 0, paymentCount: 0 };
    entry.collected = round2(entry.collected + amount);
    entry.paymentCount += 1;
    collectedBy.set(customerId, entry);
  }
  const perTarget = (Array.isArray(targets) ? targets : []).map((row) => {
    const entry = collectedBy.get(row.customerId);
    const collected = entry ? entry.collected : 0;
    return {
      ...row,
      collected,
      paymentCount: entry ? entry.paymentCount : 0,
      stillOutstanding: round2(Math.max(0, row.startingDues - collected)),
      overCollected: round2(Math.max(0, collected - row.startingDues)),
    };
  });
  const collected = round2(perTarget.reduce((sum, row) => sum + row.collected, 0));
  return { valid: true, campaign: norm, perTarget, collected, counts };
}

// The closing summary: starting dues, collected inside the window,
// and still outstanding, all matching the ledger rows supplied.
// Collection rate is null when starting dues are zero, never 0%
// presented as a rate over nothing.
export function buildCampaignSummary({ campaign, dues, payments } = {}) {
  const targetResult = buildCampaignTargets({ campaign, dues });
  if (!targetResult.valid) {
    return {
      valid: false, campaign: null, targets: [], targetCount: 0,
      startingDues: 0, collected: 0, stillOutstanding: 0, overCollected: 0,
      collectionRatePercent: null, targetCounts: targetResult.counts,
      paymentCounts: { totalPayments: 0, attributedPayments: 0, excludedVoided: 0, excludedZeroBalance: 0, excludedOutsideWindow: 0, excludedNonTarget: 0, excludedInvalid: 0 },
    };
  }
  const attribution = attributeCampaignCollections({ campaign: targetResult.campaign, targets: targetResult.targets, payments });
  const startingDues = targetResult.totalStartingDues;
  const collected = attribution.collected;
  const stillOutstanding = round2(attribution.perTarget.reduce((sum, row) => sum + row.stillOutstanding, 0));
  const overCollected = round2(attribution.perTarget.reduce((sum, row) => sum + row.overCollected, 0));
  return {
    valid: true,
    campaign: targetResult.campaign,
    targets: attribution.perTarget,
    targetCount: attribution.perTarget.length,
    startingDues,
    collected,
    stillOutstanding,
    overCollected,
    collectionRatePercent: startingDues > 0 ? Math.round((collected / startingDues) * 1000) / 10 : null,
    targetCounts: targetResult.counts,
    paymentCounts: attribution.counts,
  };
}

export function campaignSummaryText(summary) {
  if (!summary || !summary.valid) return 'No campaign selected.';
  const rate = summary.collectionRatePercent === null ? 'no starting dues' : `${summary.collectionRatePercent}% collected`;
  return `${summary.campaign.name} (${summary.campaign.startDate} to ${summary.campaign.endDate}): ${summary.targetCount} target customers, starting dues PKR ${summary.startingDues}, collected PKR ${summary.collected}, still outstanding PKR ${summary.stillOutstanding} (${rate}).`;
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

export function campaignHtml(summary) {
  if (!summary || !summary.valid) return '<p class="empty-state">No campaign selected.</p>';
  const rows = summary.targets.map((row) => `<tr><td>${escapeHtml(row.customerName)}</td><td>${escapeHtml(row.mohalla)}</td><td>${row.startingDues}</td><td>${row.collected}</td><td>${row.stillOutstanding}</td><td>${row.paymentCount}</td></tr>`).join('');
  return `<p>${escapeHtml(campaignSummaryText(summary))}</p>`
    + `<table><thead><tr><th>Customer</th><th>Mohalla</th><th>Starting dues</th><th>Collected in window</th><th>Still outstanding</th><th>Payments</th></tr></thead>`
    + `<tbody>${rows || '<tr><td colspan="6">No target customers in the selected mohallas.</td></tr>'}</tbody></table>`;
}

export function campaignCsv(summary) {
  if (!summary || !summary.valid) return 'Customer,Mohalla,Starting dues,Collected in window,Still outstanding,Payments\n';
  const lines = ['Customer,Mohalla,Starting dues,Collected in window,Still outstanding,Payments'];
  for (const row of summary.targets) {
    lines.push([row.customerName, row.mohalla, row.startingDues, row.collected, row.stillOutstanding, row.paymentCount].map(csvCell).join(','));
  }
  lines.push(['TOTAL', '', summary.startingDues, summary.collected, summary.stillOutstanding, ''].map(csvCell).join(','));
  return `${lines.join('\n')}\n`;
}

export function campaignFilename(summary) {
  const name = summary?.campaign?.name ? String(summary.campaign.name).toLocaleLowerCase('en').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : 'campaign';
  return `campaign-${name || 'campaign'}.csv`;
}
