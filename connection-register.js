// Plan 17 (Plan 1-100) — OLT port and ONU assignment register.
//
// Which OLT port, splitter, and ONU device serves a customer used to
// live in someone's head or a notebook, so a fault or a second
// connection could silently clash with an existing assignment. This
// module writes that assignment down, per customer, in one register:
// OLT (the first today, a second later), PON port, splitter, ONU
// serial, and install date, recorded at onboarding and editable on
// device swaps.
//
// Scope fence, stated plainly: this is a REGISTER ONLY, a manual
// record. It never polls a live OLT, never touches a bill, a payment,
// a balance, a PPPoE credential, or the identity search (Plan L keeps
// PPPoE/IP/MAC/router-serial search), and it never changes a service
// status. Assigning a port that another active customer already holds
// WARNS with the holder's name — it does not block, and it does not
// rewrite the holder's record. A swapped ONU keeps the old serial in
// history, so a device swap can always be traced back.
//
// How the fence is kept in this module:
//   - It is import-free (like onboarding-checklist.js): the caller
//     supplies every record, and the module never reads storage, the
//     clock, or the network, and never mutates an input. A swap date
//     is always caller-supplied, never invented.
//   - One record per customer: a repeated row for the same customer
//     keeps its LAST record, so re-saving updates the assignment
//     rather than piling up two assignments for one customer.
//   - A date that is not a real YYYY-MM-DD calendar date becomes
//     null, never a guessed date. PON ports and ONU serials are
//     compared case-insensitively (trimmed, upper-cased), so
//     "pon-3" and "PON-3" are the same port, never two.
//   - Free ports are only listed when the caller states how many PON
//     ports an OLT has. Without that total, free is unknown (null),
//     never guessed from the used ports alone. A non-numeric port
//     (e.g. "PON-A") is listed as used but also makes free unknown,
//     because a numeric free list cannot be trusted against it.
//   - Existing per-customer optical fields (splitter box/port, PON
//     port on the customer record) are NOT rewritten by this module:
//     the register lives in its own store, and the caller decides
//     whether to copy anything across. Nothing here reads or writes
//     those fields.

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function upper(value) {
  return text(value).toUpperCase();
}

// A real calendar date in YYYY-MM-DD form, or null. 2026-02-30 is
// rejected: the Date round-trip must reproduce the same string.
function validDate(value) {
  const str = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
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

// One normalised ONU history entry, or null when it names no serial.
// A history entry is a kept old serial, never a current one.
export function normalizeOnuHistoryEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
  const serial = upper(entry.serial ?? entry.onuSerial ?? entry.oldSerial);
  if (!serial) return null;
  return {
    serial,
    replacedAt: validDate(entry.replacedAt ?? entry.date ?? entry.swappedAt),
    note: text(entry.note ?? entry.reason),
  };
}

export function normalizeOnuHistory(history) {
  if (!Array.isArray(history)) return [];
  const out = [];
  for (const entry of history) {
    const normalised = normalizeOnuHistoryEntry(entry);
    if (normalised) out.push(normalised);
  }
  return out;
}

// One normalised connection record, or null when the row carries no
// customer to attach it to. An empty OLT id means "unassigned OLT":
// the record is kept and grouped under Unassigned OLT, never silently
// assigned to the first OLT.
export function normalizeConnectionRecord(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const customerId = text(raw.customerId ?? raw.id);
  if (!customerId) return null;
  return {
    customerId,
    customerName: text(raw.customerName ?? raw.name),
    oltId: text(raw.oltId ?? raw.olt ?? raw.oltName),
    ponPort: upper(raw.ponPort ?? raw.pon ?? raw.port),
    splitter: text(raw.splitter ?? raw.splitterId ?? raw.splitterBoxId ?? raw.box),
    onuSerial: upper(raw.onuSerial ?? raw.serial ?? raw.onu),
    installDate: validDate(raw.installDate ?? raw.installedAt ?? raw.date),
    onuHistory: normalizeOnuHistory(raw.onuHistory ?? raw.history),
  };
}

function compareNames(a, b) {
  const nameA = (a.customerName || a.customerId).toLowerCase();
  const nameB = (b.customerName || b.customerId).toLowerCase();
  if (nameA < nameB) return -1;
  if (nameA > nameB) return 1;
  return a.customerId < b.customerId ? -1 : a.customerId > b.customerId ? 1 : 0;
}

// Records normalised, de-duplicated (last row per customer wins),
// sorted by customer name A–Z. Inputs are never mutated.
export function normalizeConnectionRecords(records) {
  const byCustomer = new Map();
  for (const raw of Array.isArray(records) ? records : []) {
    const normalised = normalizeConnectionRecord(raw);
    if (normalised) byCustomer.set(normalised.customerId, normalised);
  }
  return [...byCustomer.values()].sort(compareNames);
}

// One register from stored rows. When activeCustomerIds is supplied
// (an array or Set of ids), rows for anyone else go to `excluded`:
// they are kept, but they hold no port and raise no clash, because
// only an active customer's assignment can clash with a new one.
// When it is omitted, every row counts.
export function buildConnectionRegister(records, activeCustomerIds) {
  const normalised = normalizeConnectionRecords(records);
  let active = normalised;
  let excluded = [];
  if (activeCustomerIds !== undefined && activeCustomerIds !== null) {
    const activeSet = activeCustomerIds instanceof Set
      ? activeCustomerIds
      : new Set((Array.isArray(activeCustomerIds) ? activeCustomerIds : []).map((id) => text(id)).filter(Boolean));
    active = [];
    for (const record of normalised) {
      if (activeSet.has(record.customerId)) active.push(record);
      else excluded.push(record);
    }
  }
  return { records: active, excluded, clashes: findPortClashes(active) };
}

// The holder of a port, or null. A clash needs the same OLT id
// (two unassigned-OLT rows count as the same OLT, because the port
// is ambiguous without one) and the same non-empty PON port, held by
// a DIFFERENT customer. A record never clashes with itself.
export function findPortClash(records, record) {
  const candidate = normalizeConnectionRecord(record);
  if (!candidate || !candidate.ponPort) return null;
  for (const other of normalizeConnectionRecords(records)) {
    if (other.customerId === candidate.customerId) continue;
    if (other.ponPort === candidate.ponPort && other.oltId === candidate.oltId) return other;
  }
  return null;
}

// Every clash group among the records: one entry per (OLT, port)
// held by more than one customer, with the holders in name order.
export function findPortClashes(records) {
  const normalised = normalizeConnectionRecords(records);
  const byPort = new Map();
  for (const record of normalised) {
    if (!record.ponPort) continue;
    const key = `${record.oltId}\n${record.ponPort}`;
    if (!byPort.has(key)) byPort.set(key, []);
    byPort.get(key).push(record);
  }
  const clashes = [];
  for (const holders of byPort.values()) {
    if (holders.length > 1) {
      clashes.push({
        oltId: holders[0].oltId,
        ponPort: holders[0].ponPort,
        holders: [...holders].sort(compareNames),
      });
    }
  }
  clashes.sort((a, b) => (a.oltId < b.oltId ? -1 : a.oltId > b.oltId ? 1
    : a.ponPort < b.ponPort ? -1 : a.ponPort > b.ponPort ? 1 : 0));
  return clashes;
}

// Save (or re-save) one customer's record. The record is always
// saved — a clash is a WARNING, not a block — and the warning is
// returned alongside so the caller can show the holder's name. The
// holder's own record is never touched.
export function upsertConnectionRecord(records, record) {
  const candidate = normalizeConnectionRecord(record);
  if (!candidate) return { records: normalizeConnectionRecords(records), clash: null, saved: null };
  const normalised = normalizeConnectionRecords(records);
  const clash = findPortClash(normalised, candidate);
  const next = normalised.filter((r) => r.customerId !== candidate.customerId);
  next.push(candidate);
  next.sort(compareNames);
  return { records: next, clash, saved: candidate };
}

// Swap the ONU on one record. The old serial is kept in history with
// the caller-supplied swap date and note; a missing old serial keeps
// no history entry (there is nothing to keep), and swapping to the
// same serial changes nothing and adds no duplicate history entry.
// The input record is never mutated.
export function swapOnu(record, newSerial, options) {
  const current = normalizeConnectionRecord(record);
  if (!current) return null;
  const nextSerial = upper(newSerial);
  if (!nextSerial || nextSerial === current.onuSerial) return current;
  const history = [...current.onuHistory];
  if (current.onuSerial) {
    history.push({
      serial: current.onuSerial,
      replacedAt: validDate(options?.replacedAt ?? options?.date ?? options?.swappedAt),
      note: text(options?.note ?? options?.reason),
    });
  }
  return { ...current, onuSerial: nextSerial, onuHistory: history };
}

// One register row for one customer profile, for the wiring layer:
// the profile's name wins when the stored record has none.
export function buildConnectionEntry(customer, record) {
  const normalised = normalizeConnectionRecord(record);
  return {
    customerId: normalised?.customerId || text(customer?.id),
    customerName: normalised?.customerName || text(customer?.customerName ?? customer?.name),
    record: normalised,
  };
}

function isNumericPort(port) {
  return /^\d+$/.test(port);
}

function comparePorts(a, b) {
  const numericA = isNumericPort(a);
  const numericB = isNumericPort(b);
  if (numericA && numericB) return Number(a) - Number(b);
  if (numericA) return -1;
  if (numericB) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

// Free versus used ports per OLT. portTotals maps an OLT id to its
// total PON port count (caller-supplied, e.g. { 'OLT-1': 16 }); an
// OLT with no stated total, or with a non-numeric used port, reports
// freePorts/freeCount as null — unknown, never guessed. An OLT that
// appears only in portTotals still appears, with everything free.
export function buildPortRegister(records, portTotals) {
  const normalised = normalizeConnectionRecords(records);
  const totals = {};
  if (portTotals && typeof portTotals === 'object' && !Array.isArray(portTotals)) {
    for (const [oltId, total] of Object.entries(portTotals)) {
      const n = Number(total);
      if (text(oltId) && Number.isInteger(n) && n > 0) totals[text(oltId)] = n;
    }
  }
  const byOlt = new Map();
  const ensure = (oltId) => {
    if (!byOlt.has(oltId)) {
      byOlt.set(oltId, { oltId, holders: [], unassignedCustomers: [] });
    }
    return byOlt.get(oltId);
  };
  for (const record of normalised) {
    const group = ensure(record.oltId);
    if (record.ponPort) group.holders.push(record);
    else group.unassignedCustomers.push(record);
  }
  for (const oltId of Object.keys(totals)) ensure(oltId);
  const clashes = findPortClashes(normalised);
  const olts = [...byOlt.values()].map((group) => {
    const usedPorts = [...new Set(group.holders.map((r) => r.ponPort))].sort(comparePorts);
    const totalPorts = totals[group.oltId] ?? null;
    const allNumeric = usedPorts.every(isNumericPort);
    let freePorts = null;
    if (totalPorts !== null && allNumeric) {
      const usedNumbers = new Set(usedPorts.map(Number));
      freePorts = [];
      for (let port = 1; port <= totalPorts; port += 1) {
        if (!usedNumbers.has(port)) freePorts.push(String(port));
      }
    }
    return {
      oltId: group.oltId,
      label: group.oltId || 'Unassigned OLT',
      usedPorts,
      usedCount: usedPorts.length,
      totalPorts,
      freePorts,
      freeCount: freePorts === null ? null : freePorts.length,
      holders: [...group.holders].sort((a, b) => comparePorts(a.ponPort, b.ponPort) || compareNames(a, b)),
      unassignedCustomers: [...group.unassignedCustomers].sort(compareNames),
      clashes: clashes.filter((c) => c.oltId === group.oltId),
    };
  }).sort((a, b) => (a.oltId < b.oltId ? -1 : a.oltId > b.oltId ? 1 : 0));
  return {
    olts,
    totalUsed: new Set(normalised.filter((r) => r.ponPort).map((r) => `${r.oltId}\n${r.ponPort}`)).size,
    totalRecords: normalised.length,
    clashCount: clashes.length,
    clashes,
  };
}

export function connectionSummaryText(records, portRegister) {
  const normalised = normalizeConnectionRecords(records);
  const withPort = normalised.filter((r) => r.ponPort).length;
  const clashNote = portRegister && portRegister.clashCount
    ? ` · ${portRegister.clashCount} port clash${portRegister.clashCount === 1 ? ' needs' : 'es need'} attention`
    : '';
  return `${normalised.length} connection record${normalised.length === 1 ? '' : 's'} · ${withPort} port${withPort === 1 ? '' : 's'} assigned${clashNote}`;
}

export function connectionRegisterHtml(portRegister, records) {
  const normalised = normalizeConnectionRecords(records);
  const register = portRegister ?? buildPortRegister(normalised, null);
  const oltRows = register.olts.map((olt) => `<tr><td>${escapeHtml(olt.label)}</td><td>${escapeHtml(olt.usedPorts.join(', ') || '—')}</td><td>${olt.freePorts === null ? 'Unknown (set total ports)' : escapeHtml(olt.freePorts.join(', ') || 'None free')}</td><td>${olt.totalPorts === null ? '—' : olt.totalPorts}</td></tr>`).join('');
  const clashRows = register.clashes.map((clash) => `<p class="register-clash">⚠️ Port ${escapeHtml(clash.ponPort)} on ${escapeHtml(clash.oltId || 'Unassigned OLT')} is held by ${clash.holders.map((h) => escapeHtml(h.customerName || h.customerId)).join(', ')} — check before assigning it again.</p>`).join('');
  const recordRows = normalised.map((r) => `<tr><td>${escapeHtml(r.customerName || r.customerId)}</td><td>${escapeHtml(r.oltId || '—')}</td><td>${escapeHtml(r.ponPort || '—')}</td><td>${escapeHtml(r.splitter || '—')}</td><td>${escapeHtml(r.onuSerial || '—')}</td><td>${escapeHtml(r.installDate || '—')}</td><td>${escapeHtml(r.onuHistory.map((h) => h.serial).join(', ') || '—')}</td></tr>`).join('');
  // Owner 5-part fix: the seven-column connection-records table
  // scrolls inside its own card on a phone instead of clipping the
  // right-side columns. (The narrow four-column ports table fits and
  // keeps no wrapper.)
  return `<div class="olt-onu-register"><h4>Ports per OLT — free versus used</h4><table><thead><tr><th>OLT</th><th>Used ports</th><th>Free ports</th><th>Total ports</th></tr></thead><tbody>${oltRows || '<tr><td colspan="4">No connection records yet</td></tr>'}</tbody></table>${clashRows}<h4>Connection records</h4><div class="table-scroll"><table><thead><tr><th>Customer</th><th>OLT</th><th>PON port</th><th>Splitter</th><th>ONU serial</th><th>Install date</th><th>Previous ONU serials</th></tr></thead><tbody>${recordRows || '<tr><td colspan="7">No connection records yet</td></tr>'}</tbody></table></div></div>`;
}

export function connectionRegisterCsv(records) {
  const normalised = normalizeConnectionRecords(records);
  const header = 'Customer ID,Customer Name,OLT,PON Port,Splitter,ONU Serial,Install Date,Previous ONU Serials';
  const rows = normalised.map((r) => [
    r.customerId, r.customerName, r.oltId, r.ponPort, r.splitter, r.onuSerial, r.installDate ?? '',
    r.onuHistory.map((h) => h.serial).join('; '),
  ].map(csvCell).join(','));
  return [header, ...rows].join('\n');
}
