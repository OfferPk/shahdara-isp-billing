// Plan 241 (Plan 203-350) — Planned outage customer notice checklist.
//
// Planned outages are announced unevenly — some customers hear in
// advance and others do not — because there is no checklist proving
// who was told what and when. This module adds only the missing
// piece: one checklist per planned outage — the outage reference,
// the mohallas affected, the notice method per mohalla, the date
// noticed, the operator who gave notice, and the customers not yet
// reached.
//
// The fences, stated plainly:
//   - This is not the maintenance calendar (Plan 48), which holds
//     scheduled windows; not the planned versus unplanned outage
//     distinction (Plan 134), which types an outage; and not the
//     maintenance notice draft (Plan 175), which prepares the words
//     of a notice. None of those modules is read or rewritten here,
//     and this module imports nothing.
//   - A checklist is complete only when every affected mohalla has
//     a notice method and date recorded, and unreached customers
//     are listed, not hidden: the unreached list is always shown,
//     even when it is empty. A completed checklist is never edited,
//     only annotated: there is no edit function, only record, add a
//     notice step, add an unreached customer, annotate, and remove.
//     A notice step fills in a mohalla that has no notice yet; once
//     a mohalla has a method and date, they are never rewritten.
//     An annotation never rewrites the outage reference, any
//     mohalla, any notice method or date, any operator, or any
//     unreached customer.
//   - Recording notice steps never changes any bill, payment,
//     customer, or outage record by itself, and it never sends any
//     message automatically: the module takes no bill, payment,
//     customer, or outage object in, edits none, and returns none.
//     Outage references, mohalla names, and customer names arrive
//     as plain text.
//   - Inputs are never mutated, and the module never reads
//     storage, the clock, the network, or the page.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validOutageNoticeDate(value) {
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

function compareText(a, b) {
  const lowerA = a.toLowerCase();
  const lowerB = b.toLowerCase();
  if (lowerA < lowerB) return -1;
  if (lowerA > lowerB) return 1;
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function cleanMohallaEntry(raw) {
  if (typeof raw === 'string') {
    const mohalla = text(raw);
    return mohalla ? { mohalla, method: '', date: '', operator: '' } : null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const mohalla = text(raw.mohalla);
  if (!mohalla) return null;
  const method = text(raw.method);
  const date = text(raw.date);
  const operator = text(raw.operator);
  // A notice counts only with a method and a real date. A half-formed
  // notice is dropped back to "not yet noticed" rather than kept.
  if (!method || !validOutageNoticeDate(date)) {
    return { mohalla, method: '', date: '', operator: '' };
  }
  return { mohalla, method, date, operator };
}

function cleanAnnotations(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const date = text(item.date);
    const note = text(item.note);
    if (!validOutageNoticeDate(date) || !note) continue;
    out.push({ date, note });
  }
  return out;
}

function cleanUnreached(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    const name = text(item);
    if (!name) continue;
    if (out.some((n) => n.toLowerCase() === name.toLowerCase())) continue;
    out.push(name);
  }
  return out;
}

// Keep only well-formed checklists. A checklist needs an id, an
// outage reference, and at least one named mohalla. Unknown fields
// are dropped, a second checklist with the same id never rewrites
// the first, and the input list is never mutated.
export function normalizeOutageNoticeList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const row of list) {
    if (!row || typeof row !== 'object') continue;
    const id = text(row.id);
    const outageRef = text(row.outageRef);
    if (!id || !outageRef || seen.has(id)) continue;
    if (!Array.isArray(row.mohallas) || row.mohallas.length === 0) continue;
    const mohallas = [];
    for (const entry of row.mohallas) {
      const clean = cleanMohallaEntry(entry);
      if (!clean) continue;
      if (mohallas.some((m) => m.mohalla.toLowerCase() === clean.mohalla.toLowerCase())) continue;
      mohallas.push(clean);
    }
    if (mohallas.length === 0) continue;
    seen.add(id);
    out.push({
      id,
      outageRef,
      mohallas,
      unreached: cleanUnreached(row.unreached),
      annotations: cleanAnnotations(row.annotations),
    });
  }
  return out;
}

// Record one checklist, or return the list unchanged when the
// checklist is half-formed or its id is already taken.
export function recordOutageNotice(list, raw) {
  const clean = normalizeOutageNoticeList(Array.isArray(list) ? list : []);
  const fresh = normalizeOutageNoticeList([raw]);
  if (fresh.length === 0) return Array.isArray(list) ? list : [];
  if (clean.some((row) => row.id === fresh[0].id)) return Array.isArray(list) ? list : [];
  return [...clean, fresh[0]];
}

export function removeOutageNotice(list, id) {
  const clean = normalizeOutageNoticeList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((row) => row.id !== wanted);
}

export function findOutageNotice(list, id) {
  const clean = normalizeOutageNoticeList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((row) => row.id === wanted) ?? null;
}

// Fill in the notice for one mohalla that has none yet: the method,
// the date noticed, and the operator who gave notice. A mohalla that
// already has a notice is never rewritten, and a half-formed step
// (no method, no real date, no operator) leaves the list unchanged.
export function addOutageNoticeStep(list, id, mohalla, step) {
  const clean = normalizeOutageNoticeList(list);
  const wantedId = text(id);
  const wantedMohalla = text(mohalla);
  const method = text(step?.method);
  const date = text(step?.date);
  const operator = text(step?.operator);
  if (!wantedId || !wantedMohalla || !method || !validOutageNoticeDate(date) || !operator) {
    return Array.isArray(list) ? list : [];
  }
  let changed = false;
  const next = clean.map((row) => {
    if (row.id !== wantedId) return row;
    const mohallas = row.mohallas.map((entry) => {
      if (entry.mohalla.toLowerCase() !== wantedMohalla.toLowerCase()) return entry;
      if (entry.method && entry.date) return entry;
      changed = true;
      return { mohalla: entry.mohalla, method, date, operator };
    });
    return changed ? { ...row, mohallas } : row;
  });
  if (!changed) return Array.isArray(list) ? list : [];
  return next;
}

// Add one customer to the unreached list — a notice step that found
// someone not reached yet. The list is additive only: a customer
// already listed is not added twice, and nothing already recorded
// is rewritten.
export function addOutageNoticeUnreached(list, id, customer) {
  const clean = normalizeOutageNoticeList(list);
  const wantedId = text(id);
  const name = text(customer);
  if (!wantedId || !name) return Array.isArray(list) ? list : [];
  let changed = false;
  const next = clean.map((row) => {
    if (row.id !== wantedId) return row;
    if (row.unreached.some((n) => n.toLowerCase() === name.toLowerCase())) return row;
    changed = true;
    return { ...row, unreached: [...row.unreached, name] };
  });
  if (!changed) return Array.isArray(list) ? list : [];
  return next;
}

// A dated annotation only: it never rewrites the outage reference,
// any mohalla, any notice method or date, any operator, or any
// unreached customer. A bad date or an empty note leaves the list
// unchanged.
export function annotateOutageNotice(list, id, date, note) {
  const clean = normalizeOutageNoticeList(list);
  const wantedId = text(id);
  const cleanDate = text(date);
  const cleanNote = text(note);
  if (!wantedId || !validOutageNoticeDate(cleanDate) || !cleanNote) {
    return Array.isArray(list) ? list : [];
  }
  let changed = false;
  const next = clean.map((row) => {
    if (row.id !== wantedId) return row;
    changed = true;
    return { ...row, annotations: [...row.annotations, { date: cleanDate, note: cleanNote }] };
  });
  if (!changed) return Array.isArray(list) ? list : [];
  return next;
}

// A checklist is complete only when every affected mohalla has a
// notice method and a date recorded. Unreached customers do not
// block completion — they are listed, not hidden — but a checklist
// with a mohalla still unnoticed is never complete.
export function outageNoticeIsComplete(checklist) {
  if (!checklist || !Array.isArray(checklist.mohallas) || checklist.mohallas.length === 0) return false;
  return checklist.mohallas.every((entry) => Boolean(entry.method) && validOutageNoticeDate(entry.date));
}

export function outageNoticeSorted(list) {
  const clean = normalizeOutageNoticeList(list);
  return [...clean].sort((a, b) => {
    const byRef = compareText(a.outageRef, b.outageRef);
    if (byRef !== 0) return byRef;
    return compareText(a.id, b.id);
  });
}

export function outageNoticeForOutage(list, outageRef) {
  const clean = normalizeOutageNoticeList(list);
  const wanted = text(outageRef);
  if (!wanted) return [];
  return clean.filter((row) => row.outageRef.toLowerCase() === wanted.toLowerCase());
}

export function outageNoticeRefs(list) {
  const clean = normalizeOutageNoticeList(list);
  const refs = [];
  for (const row of clean) {
    if (!refs.some((r) => r.toLowerCase() === row.outageRef.toLowerCase())) {
      refs.push(row.outageRef);
    }
  }
  refs.sort(compareText);
  return refs;
}

export function outageNoticeIncomplete(list) {
  return normalizeOutageNoticeList(list).filter((row) => !outageNoticeIsComplete(row));
}

export function outageNoticeMohallasPending(checklist) {
  if (!checklist || !Array.isArray(checklist.mohallas)) return [];
  return checklist.mohallas
    .filter((entry) => !entry.method || !validOutageNoticeDate(entry.date))
    .map((entry) => entry.mohalla);
}

export function outageNoticeText(checklist) {
  if (!checklist) return 'No checklist to show.';
  const noticed = checklist.mohallas.filter((entry) => entry.method && validOutageNoticeDate(entry.date));
  const pending = outageNoticeMohallasPending(checklist);
  const unreached = checklist.unreached.length
    ? checklist.unreached.join(', ')
    : 'No customers unreached.';
  const state = outageNoticeIsComplete(checklist)
    ? 'Complete: every affected mohalla was told.'
    : `Incomplete: still to tell — ${pending.join(', ')}.`;
  return `Outage ${checklist.outageRef}: ${noticed.length} of ${checklist.mohallas.length} mohalla(s) told. ${state} Customers not yet reached: ${unreached}`;
}

export function outageNoticeSummaryText(list) {
  const clean = normalizeOutageNoticeList(list);
  if (clean.length === 0) return 'No outage notice checklists recorded.';
  const complete = clean.filter((row) => outageNoticeIsComplete(row)).length;
  const pendingMohallas = clean.reduce(
    (sum, row) => sum + outageNoticeMohallasPending(row).length,
    0,
  );
  const unreached = clean.reduce((sum, row) => sum + row.unreached.length, 0);
  return `${clean.length} checklist(s); ${complete} complete; ${pendingMohallas} mohalla(s) still unnoticed; ${unreached} customer(s) not yet reached.`;
}

function outageNoticeEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function outageNoticeHtml(checklist) {
  if (!checklist) return '<p>No checklist to show.</p>';
  const lines = checklist.mohallas.map((entry) => {
    const notice = entry.method && validOutageNoticeDate(entry.date)
      ? `${outageNoticeEscape(entry.method)} on ${outageNoticeEscape(entry.date)} by ${outageNoticeEscape(entry.operator || 'Operator not noted.')}`
      : 'Not yet told.';
    return `<li>${outageNoticeEscape(entry.mohalla)} — ${notice}</li>`;
  }).join('');
  const unreached = checklist.unreached.length
    ? outageNoticeEscape(checklist.unreached.join(', '))
    : 'No customers unreached.';
  const state = outageNoticeIsComplete(checklist) ? 'Complete' : 'Incomplete';
  return `<p>Outage ${outageNoticeEscape(checklist.outageRef)} (${state}):</p><ul>${lines}</ul><p>Customers not yet reached: ${unreached}</p>`;
}

function outageNoticeCsvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function outageNoticeCsv(list) {
  const rows = outageNoticeSorted(list);
  const lines = ['Outage reference,Checklist id,Mohalla,Notice method,Date noticed,Operator,Unreached customers,Complete'];
  for (const row of rows) {
    const unreached = row.unreached.join('; ');
    for (const entry of row.mohallas) {
      lines.push([
        outageNoticeCsvCell(row.outageRef),
        outageNoticeCsvCell(row.id),
        outageNoticeCsvCell(entry.mohalla),
        outageNoticeCsvCell(entry.method || ''),
        outageNoticeCsvCell(entry.date || ''),
        outageNoticeCsvCell(entry.operator || ''),
        outageNoticeCsvCell(unreached),
        outageNoticeCsvCell(outageNoticeIsComplete(row) ? 'Yes' : 'No'),
      ].join(','));
    }
  }
  return lines.join('\n');
}

export function outageNoticeFilename() {
  return 'outage-notice-checklists.csv';
}
