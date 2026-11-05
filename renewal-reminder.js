// Plan 302 (Plan 203-350) — Licence renewal reminder queue.
//
// A licence or subscription renewal date sits in the tracker and is
// still missed, because nothing surfaces it as an upcoming action.
// This module builds a reminder queue from the tracker entries the
// caller supplies: it lists tracker entries by renewal date with a
// reminder status, and adds no licence fields of its own; the tracker
// remains the record of record.
//
// What this module is NOT, stated plainly:
//   - It is not the tracker. It never records, edits, or removes a
//     licence or subscription entry; the tracker stays the record of
//     record and is only read through the entries the caller passes in.
//   - It is not a reminder that sends anything. Marking a reminder
//     seen only records that the operator has seen it; nothing is sent
//     automatically, and no licence, subscription, bill, or payment
//     record is changed by that mark.
//   - It is not a renewal itself. A reminder being seen, or a renewal
//     being overdue, never renews anything; renewal still happens in
//     the tracker by hand.
//   - It is not an expense, bill, or payment record. No amount is
//     parsed, totalled, or written into any other record here.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every tracker
//     entry, the reference date, and the list of seen reminder ids,
//     and the module never reads storage, the clock, or the network,
//     and never touches another record type.
//   - A reminder links to its tracker entry by id only, so the queue
//     can never rewrite the entry it points at.
//   - Unknown fields are dropped, so no bill, payment, expense,
//     customer, or sending field can ever creep into a reminder.
//   - The seen list only ever grows by id: marking a reminder seen
//     never mutates the caller's list.

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

function dateParts(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

function normalizeTrackerEntry(raw) {
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
    status,
    renewedDate: status === 'renewed' ? renewedDate : '',
  };
}

function normalizeTrackerEntryList(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seenIds = new Set();
  for (const item of raw) {
    const entry = normalizeTrackerEntry(item);
    if (!entry) continue;
    if (seenIds.has(entry.id)) continue;
    seenIds.add(entry.id);
    out.push(entry);
  }
  return out;
}

function reminderStatus(entry, today) {
  const item = normalizeTrackerEntry(entry);
  const ref = text(today);
  if (!item || !isStrictDate(ref)) return '';
  if (item.status === 'renewed') return 'renewed';
  return item.renewalDate < ref ? 'overdue' : 'upcoming';
}

function daysUntilRenewal(entry, today) {
  const item = normalizeTrackerEntry(entry);
  const ref = text(today);
  if (!item || !isStrictDate(ref)) return null;
  const [ry, rm, rd] = dateParts(item.renewalDate);
  const [ty, tm, td] = dateParts(ref);
  const renewalDay = Date.UTC(ry, rm - 1, rd) / 86400000;
  const todayDay = Date.UTC(ty, tm - 1, td) / 86400000;
  return renewalDay - todayDay;
}

function normalizeSeenList(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seen = new Set();
  for (const item of raw) {
    const id = text(item);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function isReminderSeen(seenIds, licenceId) {
  return normalizeSeenList(seenIds).includes(text(licenceId));
}

function markReminderSeen(seenIds, licenceId) {
  const seen = normalizeSeenList(seenIds);
  const id = text(licenceId);
  if (!id || seen.includes(id)) return seen;
  return [...seen, id];
}

function compareText(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function buildReminder(entry, today, seenIds) {
  const item = normalizeTrackerEntry(entry);
  if (!item) return null;
  const status = reminderStatus(item, today);
  if (!status) return null;
  return {
    licenceId: item.id,
    toolName: item.toolName,
    provider: item.provider,
    renewalDate: item.renewalDate,
    status,
    seen: isReminderSeen(seenIds, item.id),
    daysUntil: daysUntilRenewal(item, today),
  };
}

function renewalReminderQueue(list, today, seenIds) {
  const entries = normalizeTrackerEntryList(list);
  const queue = [];
  for (const entry of entries) {
    const reminder = buildReminder(entry, today, seenIds);
    if (reminder) queue.push(reminder);
  }
  return queue.sort((a, b) =>
    compareText(a.renewalDate, b.renewalDate) ||
    compareText(lower(a.toolName), lower(b.toolName)) ||
    compareText(a.licenceId, b.licenceId));
}

function upcomingReminders(list, today, seenIds) {
  return renewalReminderQueue(list, today, seenIds).filter((reminder) => reminder.status === 'upcoming');
}

function overdueReminders(list, today, seenIds) {
  return renewalReminderQueue(list, today, seenIds).filter((reminder) => reminder.status === 'overdue');
}

function unseenReminders(queue) {
  if (!Array.isArray(queue)) return [];
  return queue.filter((reminder) => reminder && reminder.seen === false);
}

function renewalReminderText(reminder) {
  if (!reminder || typeof reminder !== 'object') return '';
  const licenceId = text(reminder.licenceId);
  const toolName = text(reminder.toolName);
  const renewalDate = text(reminder.renewalDate);
  const status = text(reminder.status);
  if (!licenceId || !toolName || !isStrictDate(renewalDate)) return '';
  if (status !== 'upcoming' && status !== 'overdue' && status !== 'renewed') return '';
  const parts = [
    toolName,
    reminder.provider ? `provider ${text(reminder.provider)}` : '',
    `renews ${renewalDate}`,
  ];
  if (status === 'renewed') parts.push('renewed');
  else if (status === 'overdue') parts.push(typeof reminder.daysUntil === 'number' ? `OVERDUE by ${-reminder.daysUntil} day${-reminder.daysUntil === 1 ? '' : 's'}` : 'OVERDUE');
  else parts.push(typeof reminder.daysUntil === 'number' ? (reminder.daysUntil === 0 ? 'due today' : `due in ${reminder.daysUntil} day${reminder.daysUntil === 1 ? '' : 's'}`) : 'upcoming');
  parts.push(reminder.seen ? 'seen' : 'unseen');
  return parts.filter(Boolean).join(' — ');
}

function renewalReminderSummaryText(queue) {
  const reminders = Array.isArray(queue) ? queue.filter((reminder) => reminder && typeof reminder === 'object') : [];
  const overdue = reminders.filter((reminder) => reminder.status === 'overdue').length;
  const upcoming = reminders.filter((reminder) => reminder.status === 'upcoming').length;
  const renewed = reminders.filter((reminder) => reminder.status === 'renewed').length;
  const unseen = reminders.filter((reminder) => reminder.seen === false).length;
  return `${reminders.length} renewal${reminders.length === 1 ? '' : 's'} in queue: ${overdue} overdue, ${upcoming} upcoming, ${renewed} renewed, ${unseen} unseen`;
}

function renewalReminderHtml(reminder) {
  if (!reminder || typeof reminder !== 'object') return '';
  const textLine = renewalReminderText(reminder);
  if (!textLine) return '';
  return `<p><strong>${escapeHtml(text(reminder.toolName))}</strong>${reminder.provider ? ` — provider ${escapeHtml(text(reminder.provider))}` : ''}; renews ${escapeHtml(text(reminder.renewalDate))}; ${escapeHtml(text(reminder.status))}${text(reminder.status) === 'overdue' && typeof reminder.daysUntil === 'number' ? ` by ${-reminder.daysUntil} day${-reminder.daysUntil === 1 ? '' : 's'}` : ''}${text(reminder.status) === 'upcoming' && typeof reminder.daysUntil === 'number' ? (reminder.daysUntil === 0 ? ' today' : ` in ${reminder.daysUntil} day${reminder.daysUntil === 1 ? '' : 's'}`) : ''}; ${reminder.seen ? 'seen' : 'unseen'}. Tracker entry ${escapeHtml(text(reminder.licenceId))}.</p>`;
}

function renewalReminderQueueHtml(queue) {
  if (!Array.isArray(queue)) return '';
  return queue.map((reminder) => renewalReminderHtml(reminder)).join('');
}

function renewalReminderCsv(queue) {
  const rows = [['licenceId', 'toolName', 'provider', 'renewalDate', 'status', 'daysUntil', 'seen']];
  const reminders = Array.isArray(queue) ? queue : [];
  for (const reminder of reminders) {
    if (!reminder || typeof reminder !== 'object') continue;
    rows.push([
      text(reminder.licenceId),
      text(reminder.toolName),
      text(reminder.provider),
      text(reminder.renewalDate),
      text(reminder.status),
      typeof reminder.daysUntil === 'number' ? String(reminder.daysUntil) : '',
      reminder.seen ? 'yes' : 'no',
    ]);
  }
  return rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
}

function renewalReminderFilename() {
  return 'renewal-reminders.csv';
}

export {
  isStrictDate,
  normalizeTrackerEntry,
  normalizeTrackerEntryList,
  reminderStatus,
  daysUntilRenewal,
  normalizeSeenList,
  isReminderSeen,
  markReminderSeen,
  buildReminder,
  renewalReminderQueue,
  upcomingReminders,
  overdueReminders,
  unseenReminders,
  renewalReminderText,
  renewalReminderSummaryText,
  renewalReminderHtml,
  renewalReminderQueueHtml,
  renewalReminderCsv,
  renewalReminderFilename,
};
