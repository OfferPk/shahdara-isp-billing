// Plan 43 (Plan 1-100) — Vendor and contract register with renewal dates.
//
// Upstream, rent, and maintenance agreements used to live as paper or
// memory, so a price rise or a renewal deadline arrived with no warning
// and no record of what was agreed. This module writes them down: one
// contract record per vendor agreement (vendor, service supplied,
// contract start and end dates, agreed rate, notice period, renewal
// note), plus an upcoming-renewal list that surfaces contracts ending
// inside an operator-set window, in date order.
//
// Scope fence, stated plainly:
//   - It is import-free: the caller supplies every contract, and the
//     module never reads storage, the clock, or the network, and never
//     mutates an input.
//   - It is a register only. It changes no bill, payment, or expense
//     record by itself, and it never alters any expense total —
//     editing a rate here only rewrites this register's own history.
//   - It shares Plan 41's vendor identity instead of building a
//     second vendor system: the vendor names known to the register
//     are the union of the contract vendors and the Plan 41 schedule
//     vendors (matched case-insensitively, first-seen casing kept),
//     so a contract and a recurring bill for the same vendor are
//     spelled the same way. Plan 41's schedules themselves are
//     neither read nor rewritten by this module — the caller passes
//     them in, and they come back untouched.
//   - A missing rate, date, or notice period stays "Not recorded",
//     never a guessed figure; an impossible date (2026-02-30) or a
//     non-positive rate rejects the record outright, never stored
//     half-formed.

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
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

function money(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100) / 100;
}

function parseDateParts(value) {
  const match = DATE_PATTERN.exec(text(value));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return { year, month, day };
}

// A real calendar date only: 2026-02-30 is rejected, never guessed.
export function isValidContractDate(value) {
  return parseDateParts(value) !== null;
}

function dateToMs(parts) {
  return Date.UTC(parts.year, parts.month - 1, parts.day);
}

function addDays(dateStr, days) {
  const parts = parseDateParts(dateStr);
  if (!parts) return null;
  const date = new Date(dateToMs(parts) + days * 24 * 60 * 60 * 1000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function daysBetween(from, to) {
  const a = parseDateParts(from);
  const b = parseDateParts(to);
  if (!a || !b) return null;
  return Math.round((dateToMs(b) - dateToMs(a)) / (24 * 60 * 60 * 1000));
}

function normalizeNoticeDays(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = typeof value === 'string' ? Number(value) : value;
  if (!Number.isInteger(num) || num < 0) return null;
  return num;
}

function normalizeRateHistory(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const rate = money(typeof entry.rate === 'string' ? Number(entry.rate) : entry.rate);
    if (rate === null) continue;
    const from = entry.from === null || entry.from === undefined || entry.from === '' ? null : text(entry.from);
    const to = entry.to === null || entry.to === undefined || entry.to === '' ? null : text(entry.to);
    if (from !== null && !isValidContractDate(from)) continue;
    if (to !== null && !isValidContractDate(to)) continue;
    out.push({ rate, from, to });
  }
  return out;
}

export function normalizeVendorContract(row) {
  if (!row || typeof row !== 'object') return null;
  const id = text(row.id);
  const vendor = text(row.vendor);
  if (!id || !vendor) return null;
  const service = text(row.service);
  const startDate = row.startDate === null || row.startDate === undefined || row.startDate === '' ? null : text(row.startDate);
  const endDate = row.endDate === null || row.endDate === undefined || row.endDate === '' ? null : text(row.endDate);
  if (startDate !== null && !isValidContractDate(startDate)) return null;
  if (endDate !== null && !isValidContractDate(endDate)) return null;
  if (startDate !== null && endDate !== null && endDate < startDate) return null;
  let rate = null;
  if (row.rate !== null && row.rate !== undefined && row.rate !== '') {
    rate = money(typeof row.rate === 'string' ? Number(row.rate) : row.rate);
    if (rate === null) return null;
  }
  const rateEffectiveDate = row.rateEffectiveDate === null || row.rateEffectiveDate === undefined || row.rateEffectiveDate === '' ? null : text(row.rateEffectiveDate);
  if (rateEffectiveDate !== null && !isValidContractDate(rateEffectiveDate)) return null;
  const noticeDays = normalizeNoticeDays(row.noticeDays);
  if (row.noticeDays !== null && row.noticeDays !== undefined && row.noticeDays !== '' && noticeDays === null) return null;
  return {
    id,
    vendor,
    service,
    startDate,
    endDate,
    rate,
    rateEffectiveDate,
    noticeDays,
    renewalNote: text(row.renewalNote),
    rateHistory: normalizeRateHistory(row.rateHistory),
  };
}

export function normalizeVendorContracts(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const row of list) {
    const contract = normalizeVendorContract(row);
    if (contract) out.push(contract);
  }
  return out;
}

export function findVendorContract(list, id) {
  const key = text(id);
  if (!key) return null;
  return normalizeVendorContracts(list).find((row) => row.id === key) ?? null;
}

// Last write wins per contract id; inputs are never mutated.
export function upsertVendorContract(list, row) {
  const contract = normalizeVendorContract(row);
  if (!contract) return normalizeVendorContracts(list);
  const kept = normalizeVendorContracts(list).filter((entry) => entry.id !== contract.id);
  kept.push(contract);
  kept.sort((a, b) => a.vendor.localeCompare(b.vendor) || a.service.localeCompare(b.service) || a.id.localeCompare(b.id));
  return kept;
}

export function removeVendorContract(list, id) {
  const key = text(id);
  if (!key) return normalizeVendorContracts(list);
  return normalizeVendorContracts(list).filter((entry) => entry.id !== key);
}

// Editing a rate keeps the previous rate and its dates in history:
// the old rate is appended with the dates it covered (from its own
// effective date, or the contract start, until the new rate takes
// effect), and the contract then carries the new rate. A missing
// contract, a non-positive rate, or a bad effective date leaves the
// list unchanged; re-saving the same rate is a no-op, never a
// duplicate history entry.
export function updateContractRate(list, id, newRate, effectiveDate) {
  const contracts = normalizeVendorContracts(list);
  const contract = contracts.find((row) => row.id === text(id));
  if (!contract) return contracts;
  const rate = money(typeof newRate === 'string' ? Number(newRate) : newRate);
  const effective = text(effectiveDate);
  if (rate === null || !isValidContractDate(effective)) return contracts;
  if (contract.rate === rate) return contracts;
  const previous = {
    rate: contract.rate,
    from: contract.rateEffectiveDate ?? contract.startDate,
    to: effective,
  };
  const history = contract.rate === null
    ? contract.rateHistory
    : [...contract.rateHistory, previous].filter((entry) => entry.rate !== null);
  const updated = {
    ...contract,
    rate,
    rateEffectiveDate: effective,
    rateHistory: normalizeRateHistory(history),
  };
  return contracts.map((row) => (row.id === contract.id ? updated : row));
}

// Shared vendor identity with Plan 41: the union of contract vendors
// and schedule vendors, matched case-insensitively, first-seen casing
// kept, sorted A–Z. Schedules are only read for their vendor names.
export function sharedVendorNames(contracts, schedules) {
  const seen = new Map();
  for (const row of normalizeVendorContracts(contracts)) {
    const key = row.vendor.toLowerCase();
    if (!seen.has(key)) seen.set(key, row.vendor);
  }
  if (Array.isArray(schedules)) {
    for (const schedule of schedules) {
      const vendor = text(schedule?.vendor);
      if (!vendor) continue;
      const key = vendor.toLowerCase();
      if (!seen.has(key)) seen.set(key, vendor);
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

// Contracts ending inside [today, today + windowDays], earliest end
// first, then vendor A–Z. An invalid today or window falls back to
// no list at all for a bad today, and to a 30-day window for a bad
// window — a bad window never hides the list or widens it silently
// into "all contracts".
export function buildRenewalList(contracts, options = {}) {
  const today = text(options.today);
  if (!isValidContractDate(today)) return [];
  let windowDays = 30;
  if (options.windowDays !== null && options.windowDays !== undefined && options.windowDays !== '') {
    const num = typeof options.windowDays === 'string' ? Number(options.windowDays) : options.windowDays;
    if (Number.isInteger(num) && num >= 0) windowDays = num;
  }
  const windowEnd = addDays(today, windowDays);
  const rows = [];
  for (const contract of normalizeVendorContracts(contracts)) {
    if (contract.endDate === null) continue;
    if (contract.endDate < today || contract.endDate > windowEnd) continue;
    const daysRemaining = daysBetween(today, contract.endDate);
    const noticeDueDate = contract.noticeDays === null ? null : addDays(contract.endDate, -contract.noticeDays);
    rows.push({
      ...contract,
      daysRemaining,
      noticeDueDate,
      noticeDue: noticeDueDate !== null && noticeDueDate <= today,
    });
  }
  rows.sort((a, b) => a.endDate.localeCompare(b.endDate) || a.vendor.localeCompare(b.vendor) || a.id.localeCompare(b.id));
  return rows;
}

export function renewalSummaryText(contracts, renewalList, windowDays = 30) {
  const dated = normalizeVendorContracts(contracts).filter((row) => row.endDate !== null).length;
  const noticeDue = renewalList.filter((row) => row.noticeDue).length;
  return `${contracts.length} vendor contract(s) on file (${dated} with an end date). ${renewalList.length} ending within ${windowDays} day(s)${noticeDue ? `, ${noticeDue} with notice already due` : ''}.`;
}

function contractRowHtml(row) {
  const history = row.rateHistory.length === 0
    ? 'No earlier rate'
    : row.rateHistory.map((entry) => `${entry.rate} PKR${entry.from ? ` from ${escapeHtml(entry.from)}` : ''}${entry.to ? ` until ${escapeHtml(entry.to)}` : ''}`).join('; ');
  return `<tr><td>${escapeHtml(row.vendor)}</td><td>${row.service ? escapeHtml(row.service) : 'Not recorded'}</td>`
    + `<td>${row.startDate ? escapeHtml(row.startDate) : 'Not recorded'} — ${row.endDate ? escapeHtml(row.endDate) : 'Not recorded'}</td>`
    + `<td>${row.rate === null ? 'Not recorded' : `${row.rate} PKR${row.rateEffectiveDate ? ` from ${escapeHtml(row.rateEffectiveDate)}` : ''}`}</td>`
    + `<td>${row.noticeDays === null ? 'Not recorded' : `${row.noticeDays} day(s)`}</td>`
    + `<td>${row.renewalNote ? escapeHtml(row.renewalNote) : '—'}</td><td>${escapeHtml(history)}</td></tr>`;
}

export function vendorContractsHtml(contracts, renewalList) {
  contracts = normalizeVendorContracts(contracts);
  const allRows = contracts.length === 0
    ? '<tr><td colspan="7">No vendor contracts yet.</td></tr>'
    : contracts.map(contractRowHtml).join('');
  const renewalRows = renewalList.length === 0
    ? '<tr><td colspan="6">No contracts ending inside the renewal window.</td></tr>'
    : renewalList.map((row) => `<tr><td>${escapeHtml(row.vendor)}</td><td>${row.service ? escapeHtml(row.service) : 'Not recorded'}</td>`
      + `<td>${escapeHtml(row.endDate)}</td><td>${row.daysRemaining} day(s) left</td>`
      + `<td>${row.noticeDueDate ? escapeHtml(row.noticeDueDate) : 'Not recorded'}</td>`
      + `<td>${row.noticeDue ? 'Notice due — act now' : 'Notice not yet due'}</td></tr>`).join('');
  return `<h4>Upcoming renewals</h4><table><thead><tr><th>Vendor</th><th>Service</th><th>Ends</th><th>Time left</th><th>Notice due by</th><th>Notice status</th></tr></thead><tbody>${renewalRows}</tbody></table>`
    // Owner 5-part fix: the seven-column contracts table scrolls
    // inside its own card on a phone instead of clipping the
    // right-side columns. (The narrow renewals table fits and keeps
    // no wrapper.)
    + `<h4>All contracts</h4><div class="table-scroll"><table><thead><tr><th>Vendor</th><th>Service</th><th>Contract dates</th><th>Agreed rate</th><th>Notice period</th><th>Renewal note</th><th>Earlier rates</th></tr></thead><tbody>${allRows}</tbody></table></div>`;
}

export function vendorContractsCsv(contracts) {
  const lines = ['vendor,service,start_date,end_date,rate,rate_effective_date,notice_days,renewal_note,earlier_rates'];
  for (const row of normalizeVendorContracts(contracts)) {
    const history = row.rateHistory.map((entry) => `${entry.rate} PKR${entry.from ? ` from ${entry.from}` : ''}${entry.to ? ` until ${entry.to}` : ''}`).join('; ');
    lines.push([
      csvCell(row.vendor), csvCell(row.service), csvCell(row.startDate ?? ''), csvCell(row.endDate ?? ''),
      csvCell(row.rate === null ? '' : row.rate), csvCell(row.rateEffectiveDate ?? ''),
      csvCell(row.noticeDays === null ? '' : row.noticeDays), csvCell(row.renewalNote), csvCell(history),
    ].join(','));
  }
  return lines.join('\n');
}

export function vendorContractsFilename() {
  return 'vendor-contracts.csv';
}
