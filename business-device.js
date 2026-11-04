// Plan 188 (Plan 101-202) — Business Device Inventory.
//
// Shop phones, laptops, and other business devices are tracked
// informally, so when one breaks or goes missing it is unclear what
// it was, who held it, and what it was used for. This module records
// business devices only: device kind, make/model as entered, serial
// if known, holder, date issued, condition note, and date returned.
//
// What this module is NOT, stated plainly:
//   - It is not customer equipment. Customer premises equipment,
//     field tools, shop stock, and equipment cycles live in their
//     own modules and are neither read nor written here; a business
//     device record never changes any of them.
//   - It is not a bill, payment, or expense. Recording a device
//     never changes any bill, payment, or customer equipment record.
//   - It is not a transfer. A device has exactly one current holder
//     at a time because each device is one record with one holder
//     field; nothing here reassigns a device to someone else.
//   - It is not a deletion of history. A returned device stays in
//     the list under the returned status; marking returned only
//     records the return date, it never removes the device.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every record,
//     and the module never reads storage, the clock, or the network,
//     and never touches another record type.
//   - Unknown fields are dropped, so no bill, payment, customer,
//     or sending field can ever creep into a device record.
//   - Duplicate ids are never rewritten, and there is no edit
//     function at all: a device is recorded, marked returned, or
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

function normalizeBusinessDevice(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const kind = text(raw.kind);
  const holder = text(raw.holder);
  const dateIssued = text(raw.dateIssued);
  if (!id || !kind || !holder) return null;
  if (!isStrictDate(dateIssued)) return null;
  const dateReturned = text(raw.dateReturned);
  if (dateReturned) {
    if (!isStrictDate(dateReturned)) return null;
    if (dateReturned < dateIssued) return null;
  }
  return {
    id,
    kind,
    makeModel: text(raw.makeModel),
    serial: text(raw.serial),
    holder,
    dateIssued,
    conditionNote: text(raw.conditionNote),
    dateReturned,
  };
}

function normalizeBusinessDeviceList(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seenIds = new Set();
  for (const item of raw) {
    const device = normalizeBusinessDevice(item);
    if (!device) continue;
    if (seenIds.has(device.id)) continue;
    seenIds.add(device.id);
    out.push(device);
  }
  return out;
}

function findBusinessDevice(list, id) {
  const devices = normalizeBusinessDeviceList(list);
  return devices.find((device) => device.id === text(id)) || null;
}

function recordBusinessDevice(list, raw) {
  const devices = normalizeBusinessDeviceList(list);
  const device = normalizeBusinessDevice(raw);
  if (!device) return devices;
  if (devices.some((item) => item.id === device.id)) return devices;
  return [...devices, device];
}

function removeBusinessDevice(list, id) {
  const devices = normalizeBusinessDeviceList(list);
  return devices.filter((device) => device.id !== text(id));
}

function markBusinessDeviceReturned(list, id, dateReturned) {
  const devices = normalizeBusinessDeviceList(list);
  const date = text(dateReturned);
  if (!isStrictDate(date)) return devices;
  return devices.map((device) => {
    if (device.id !== text(id)) return device;
    if (device.dateReturned) return device;
    if (date < device.dateIssued) return device;
    return { ...device, dateReturned: date };
  });
}

function compareText(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function businessDevicesSorted(list) {
  return normalizeBusinessDeviceList(list).sort((a, b) =>
    compareText(lower(a.holder), lower(b.holder)) ||
    compareText(lower(a.kind), lower(b.kind)) ||
    compareText(a.id, b.id));
}

function devicesByHolder(list, holder) {
  const wanted = lower(holder);
  if (!wanted) return [];
  return businessDevicesSorted(list).filter(
    (device) => lower(device.holder) === wanted);
}

function deviceHolders(list) {
  const seen = new Set();
  const out = [];
  for (const device of businessDevicesSorted(list)) {
    const key = lower(device.holder);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(device.holder);
  }
  return out;
}

function issuedBusinessDevices(list) {
  return businessDevicesSorted(list).filter((device) => !device.dateReturned);
}

function returnedBusinessDevices(list) {
  return businessDevicesSorted(list).filter((device) => device.dateReturned);
}

function businessDeviceStatus(device) {
  const entry = normalizeBusinessDevice(device);
  if (!entry) return '';
  return entry.dateReturned ? 'returned' : 'issued';
}

function businessDeviceText(device) {
  const entry = normalizeBusinessDevice(device);
  if (!entry) return '';
  const parts = [
    `${entry.kind}${entry.makeModel ? ` (${entry.makeModel})` : ''}`,
    `held by ${entry.holder}`,
    `issued ${entry.dateIssued}`,
  ];
  if (entry.serial) parts.push(`serial ${entry.serial}`);
  if (entry.dateReturned) parts.push(`returned ${entry.dateReturned}`);
  else parts.push('currently issued');
  if (entry.conditionNote) parts.push(`note: ${entry.conditionNote}`);
  return parts.join(' — ');
}

function businessDeviceSummaryText(list) {
  const devices = normalizeBusinessDeviceList(list);
  const issued = devices.filter((device) => !device.dateReturned).length;
  const returned = devices.length - issued;
  return `${devices.length} business device${devices.length === 1 ? '' : 's'} recorded: ${issued} issued, ${returned} returned`;
}

function businessDeviceHtml(device) {
  const entry = normalizeBusinessDevice(device);
  if (!entry) return '';
  return `<p><strong>${escapeHtml(entry.kind)}${entry.makeModel ? ` (${escapeHtml(entry.makeModel)})` : ''}</strong> — held by ${escapeHtml(entry.holder)}; issued ${escapeHtml(entry.dateIssued)}${entry.serial ? `; serial ${escapeHtml(entry.serial)}` : ''}; ${entry.dateReturned ? `returned ${escapeHtml(entry.dateReturned)}` : 'currently issued'}.${entry.conditionNote ? ` ${escapeHtml(entry.conditionNote)}` : ''}</p>`;
}

function businessDeviceAllHtml(list) {
  return businessDevicesSorted(list).map((device) => businessDeviceHtml(device)).join('');
}

function businessDeviceCsv(list) {
  const rows = [['id', 'kind', 'makeModel', 'serial', 'holder', 'dateIssued', 'conditionNote', 'dateReturned', 'status']];
  for (const device of businessDevicesSorted(list)) {
    rows.push([device.id, device.kind, device.makeModel, device.serial, device.holder, device.dateIssued, device.conditionNote, device.dateReturned, businessDeviceStatus(device)]);
  }
  return rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
}

function businessDeviceFilename() {
  return 'business-devices.csv';
}

export {
  isStrictDate,
  normalizeBusinessDevice,
  normalizeBusinessDeviceList,
  findBusinessDevice,
  recordBusinessDevice,
  removeBusinessDevice,
  markBusinessDeviceReturned,
  businessDevicesSorted,
  devicesByHolder,
  deviceHolders,
  issuedBusinessDevices,
  returnedBusinessDevices,
  businessDeviceStatus,
  businessDeviceText,
  businessDeviceSummaryText,
  businessDeviceHtml,
  businessDeviceAllHtml,
  businessDeviceCsv,
  businessDeviceFilename,
};
