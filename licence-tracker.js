// Plan 189 (Plan 101-202) — Licence and Subscription Tracker.
//
// Business tools renew on different dates, so a licence can lapse
// unnoticed and the shop only discovers it when the tool stops
// working. This module tracks dates and notes only: tool name,
// provider as entered, renewal date, cost as entered by the owner,
// renewal note, and status.
//
// What this module is NOT, stated plainly:
//   - It is not a reminder that sends anything. It tracks dates and
//     notes only and sends nothing automatically; the operator sees
//     an overdue renewal flagged and acts by hand.
//   - It is not an expense, bill, or payment record. The cost is
//     kept exactly as the owner entered it and is never parsed,
//     totalled, or written into any other record; recording a
//     licence never changes any expense, bill, or payment record
//     by itself.
//   - It is not a renewal itself. Marking a licence renewed only
//     records the renewed state; the past renewal stays in history
//     and is never removed or rewritten by that mark.
//   - It is not a second export pack. The accountant export pack
//     and any other existing module are neither read nor written
//     here.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every record
//     and the reference date, and the module never reads storage,
//     the clock, or the network, and never touches another record
//     type.
//   - Unknown fields are dropped, so no bill, payment, expense,
//     customer, or sending field can ever creep into a licence
//     record.
//   - Duplicate ids are never rewritten, and there is no edit
//     function at all: a licence is recorded, marked renewed, or
//     removed — never silently rewritten.

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function lower(value) {
  return text(value).toLowerCase();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeCsv(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function isStrictDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  const maxDay = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  return day >= 1 && day <= maxDay;
}

function normalizeLicence(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const toolName = text(raw.toolName);
  const renewalDate = text(raw.renewalDate);
  if (!id || !toolName) return null;
  if (!isStrictDate(renewalDate)) return null;
  const status = text(raw.status) === 'renewed' ? 'renewed' : 'active';
  const renewedDate = text(raw.renewedDate);
  if (renewedDate && !isStrictDate(renewedDate)) return null;
  return {
    id,
    toolName,
    provider: text(raw.provider),
    renewalDate,
    cost: text(raw.cost),
    renewalNote: text(raw.renewalNote),
    status,
    renewedDate: status === 'renewed' ? renewedDate : '',
  };
}

function normalizeLicenceList(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seenIds = new Set();
  for (const item of raw) {
    const licence = normalizeLicence(item);
    if (!licence) continue;
    if (seenIds.has(licence.id)) continue;
    seenIds.add(licence.id);
    out.push(licence);
  }
  return out;
}

function findLicence(list, id) {
  const licences = normalizeLicenceList(list);
  return licences.find((licence) => licence.id === text(id)) || null;
}

function recordLicence(list, raw) {
  const licences = normalizeLicenceList(list);
  const licence = normalizeLicence(raw);
  if (!licence) return licences;
  if (licences.some((item) => item.id === licence.id)) return licences;
  return [...licences, licence];
}

function removeLicence(list, id) {
  const licences = normalizeLicenceList(list);
  return licences.filter((licence) => licence.id !== text(id));
}

function markLicenceRenewed(list, id, renewedDate) {
  const licences = normalizeLicenceList(list);
  const date = text(renewedDate);
  if (date && !isStrictDate(date)) return licences;
  return licences.map((licence) => {
    if (licence.id !== text(id)) return licence;
    if (licence.status === 'renewed') return licence;
    return { ...licence, status: 'renewed', renewedDate: date };
  });
}

function compareText(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function licencesSorted(list) {
  return normalizeLicenceList(list).sort((a, b) =>
    compareText(a.renewalDate, b.renewalDate) ||
    compareText(lower(a.toolName), lower(b.toolName)) ||
    compareText(a.id, b.id));
}

function activeLicences(list) {
  return licencesSorted(list).filter((licence) => licence.status === 'active');
}

function renewedLicences(list) {
  return licencesSorted(list).filter((licence) => licence.status === 'renewed');
}

function overdueLicences(list, today) {
  const ref = text(today);
  if (!isStrictDate(ref)) return [];
  return activeLicences(list).filter((licence) => licence.renewalDate < ref);
}

function isLicenceOverdue(licence, today) {
  const entry = normalizeLicence(licence);
  const ref = text(today);
  if (!entry || !isStrictDate(ref)) return false;
  return entry.status === 'active' && entry.renewalDate < ref;
}

function licenceStatus(licence, today) {
  const entry = normalizeLicence(licence);
  if (!entry) return '';
  if (entry.status === 'renewed') return 'renewed';
  return isLicenceOverdue(entry, today) ? 'overdue' : 'active';
}

function licenceText(licence, today) {
  const entry = normalizeLicence(licence);
  if (!entry) return '';
  const parts = [
    entry.toolName,
    entry.provider ? `provider ${entry.provider}` : '',
    `renews ${entry.renewalDate}`,
  ];
  if (entry.cost) parts.push(`cost ${entry.cost}`);
  if (entry.status === 'renewed') parts.push(entry.renewedDate ? `renewed ${entry.renewedDate}` : 'renewed');
  else if (isLicenceOverdue(entry, today)) parts.push('OVERDUE');
  else parts.push('active');
  if (entry.renewalNote) parts.push(`note: ${entry.renewalNote}`);
  return parts.filter(Boolean).join(' — ');
}

function licenceSummaryText(list, today) {
  const licences = normalizeLicenceList(list);
  const renewed = licences.filter((licence) => licence.status === 'renewed').length;
  const overdue = overdueLicences(list, today).length;
  const active = licences.length - renewed;
  return `${licences.length} licence${licences.length === 1 ? '' : 's'} recorded: ${active} active, ${renewed} renewed, ${overdue} overdue`;
}

function licenceHtml(licence, today) {
  const entry = normalizeLicence(licence);
  if (!entry) return '';
  const overdue = isLicenceOverdue(entry, today);
  return `<p><strong>${escapeHtml(entry.toolName)}</strong>${entry.provider ? ` — provider ${escapeHtml(entry.provider)}` : ''}; renews ${escapeHtml(entry.renewalDate)}${entry.cost ? `; cost ${escapeHtml(entry.cost)}` : ''}; ${entry.status === 'renewed' ? (entry.renewedDate ? `renewed ${escapeHtml(entry.renewedDate)}` : 'renewed') : (overdue ? 'OVERDUE' : 'active')}.${entry.renewalNote ? ` ${escapeHtml(entry.renewalNote)}` : ''}</p>`;
}

function licenceAllHtml(list, today) {
  return licencesSorted(list).map((licence) => licenceHtml(licence, today)).join('');
}

function licenceCsv(list, today) {
  const rows = [['id', 'toolName', 'provider', 'renewalDate', 'cost', 'renewalNote', 'status', 'renewedDate', 'overdue']];
  for (const licence of licencesSorted(list)) {
    rows.push([licence.id, licence.toolName, licence.provider, licence.renewalDate, licence.cost, licence.renewalNote, licence.status, licence.renewedDate, isLicenceOverdue(licence, today) ? 'yes' : 'no']);
  }
  return rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
}

function licenceFilename() {
  return 'licences.csv';
}

export {
  isStrictDate,
  normalizeLicence,
  normalizeLicenceList,
  findLicence,
  recordLicence,
  removeLicence,
  markLicenceRenewed,
  licencesSorted,
  activeLicences,
  renewedLicences,
  overdueLicences,
  isLicenceOverdue,
  licenceStatus,
  licenceText,
  licenceSummaryText,
  licenceHtml,
  licenceAllHtml,
  licenceCsv,
  licenceFilename,
};
