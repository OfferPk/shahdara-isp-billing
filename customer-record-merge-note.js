// Customer record merge note (Plan 348): one audit-trailed merge note per
// merge of two records for the same customer, so dues and history stop
// splitting across both. A note names the surviving record, the record
// merged away, the fields carried over, the operator, the approver, and
// the date. A merge without an approver is refused. The surviving record
// shows the full merged history and the merged-away record stays visible
// as merged, never deleted. Merged dues reconcile to the sum of both
// records on the same fixture. The note only records the merge: it never
// merges or deletes any record by itself and never silently changes any
// bill or payment total. It is distinct from the read-only combined dues
// view, which merges nothing, and from the void and correction pattern
// watch, both untouched. Inputs are never mutated, and the module never
// reads storage, the clock, the network, or the page.

const CUSTOMER_RECORD_MERGE_DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isCustomerRecordMergeLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validCustomerRecordMergeDay(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  let lastDay = CUSTOMER_RECORD_MERGE_DAYS_IN_MONTH[month - 1];
  if (month === 2 && isCustomerRecordMergeLeapYear(year)) lastDay = 29;
  return day >= 1 && day <= lastDay;
}

function cleanCustomerRecordMergeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeCustomerRecordMergeDues(value) {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 0 ? value : null;
  }
  if (typeof value === 'string') {
    const text = value.trim();
    if (!/^\d+$/.test(text)) return null;
    return Number(text);
  }
  return null;
}

function normalizeCustomerRecordMergeRefList(value) {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  const out = [];
  const seen = new Set();
  for (const item of raw) {
    const text = cleanCustomerRecordMergeText(item);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

export function normalizeCustomerRecordMerge(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanCustomerRecordMergeText(raw.id);
  const survivingRecord = cleanCustomerRecordMergeText(raw.survivingRecord);
  const mergedAwayRecord = cleanCustomerRecordMergeText(raw.mergedAwayRecord);
  const operator = cleanCustomerRecordMergeText(raw.operator);
  const approver = cleanCustomerRecordMergeText(raw.approver);
  const mergeDate = cleanCustomerRecordMergeText(raw.mergeDate);
  const mergedDues = normalizeCustomerRecordMergeDues(raw.mergedDues);
  if (!id) return null;
  if (!survivingRecord) return null;
  if (!mergedAwayRecord) return null;
  if (survivingRecord.toLowerCase() === mergedAwayRecord.toLowerCase()) return null;
  if (!operator) return null;
  if (!approver) return null;
  if (!validCustomerRecordMergeDay(mergeDate)) return null;
  if (mergedDues === null) return null;
  const recordsMerged = normalizeCustomerRecordMergeRefList(raw.recordsMerged);
  const fieldsCarriedOver = normalizeCustomerRecordMergeRefList(raw.fieldsCarriedOver);
  const merged = recordsMerged.length ? recordsMerged : [survivingRecord, mergedAwayRecord];
  if (!merged.some((ref) => ref.toLowerCase() === survivingRecord.toLowerCase())) return null;
  if (!merged.some((ref) => ref.toLowerCase() === mergedAwayRecord.toLowerCase())) return null;
  return {
    id,
    survivingRecord,
    mergedAwayRecord,
    recordsMerged: merged,
    fieldsCarriedOver,
    operator,
    approver,
    mergeDate,
    mergedDues,
  };
}

export function normalizeCustomerRecordMergeList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const raw of list) {
    const clean = normalizeCustomerRecordMerge(raw);
    if (clean) out.push(clean);
  }
  return out;
}

export function recordCustomerRecordMerge(list, merge) {
  const clean = normalizeCustomerRecordMerge(merge);
  if (!clean) return list;
  const known = normalizeCustomerRecordMergeList(list);
  if (known.some((item) => item.id === clean.id)) return list;
  if (known.some((item) => item.mergedAwayRecord.toLowerCase() === clean.mergedAwayRecord.toLowerCase())) return list;
  return [...known, clean];
}

export function customerRecordMergeForSurvivor(list, survivingRecord) {
  const known = normalizeCustomerRecordMergeList(list);
  const wanted = cleanCustomerRecordMergeText(survivingRecord).toLowerCase();
  if (!wanted) return null;
  const matches = known.filter((item) => item.survivingRecord.toLowerCase() === wanted);
  if (matches.length === 0) return null;
  matches.sort((a, b) => (a.mergeDate < b.mergeDate ? -1 : a.mergeDate > b.mergeDate ? 1 : a.id < b.id ? -1 : 1));
  return matches[0];
}

export function customerRecordMergedAway(list) {
  const known = normalizeCustomerRecordMergeList(list);
  const out = [];
  const seen = new Set();
  const sorted = [...known].sort((a, b) => (a.mergeDate < b.mergeDate ? -1 : a.mergeDate > b.mergeDate ? 1 : a.id < b.id ? -1 : 1));
  for (const item of sorted) {
    const key = item.mergedAwayRecord.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      record: item.mergedAwayRecord,
      survivingRecord: item.survivingRecord,
      mergeDate: item.mergeDate,
      noteId: item.id,
    });
  }
  return out;
}

function normalizeCustomerRecordMergeRecord(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const reference = cleanCustomerRecordMergeText(raw.reference);
  if (!reference) return null;
  const dues = normalizeCustomerRecordMergeDues(raw.dues);
  const history = [];
  if (Array.isArray(raw.history)) {
    for (const entry of raw.history) {
      if (!entry || typeof entry !== 'object') continue;
      const text = cleanCustomerRecordMergeText(entry.text);
      if (!text) continue;
      history.push({ date: cleanCustomerRecordMergeText(entry.date), text });
    }
  }
  return { reference, dues, history };
}

export function customerRecordMergeMergedHistory(merge, records) {
  const clean = normalizeCustomerRecordMerge(merge);
  if (!clean) return null;
  const supplied = Array.isArray(records) ? records.map(normalizeCustomerRecordMergeRecord).filter(Boolean) : [];
  const byRef = new Map();
  for (const record of supplied) byRef.set(record.reference.toLowerCase(), record);
  const surviving = byRef.get(clean.survivingRecord.toLowerCase());
  const mergedAway = byRef.get(clean.mergedAwayRecord.toLowerCase());
  const history = [];
  for (const [record, ref] of [[surviving, clean.survivingRecord], [mergedAway, clean.mergedAwayRecord]]) {
    if (!record) continue;
    for (const entry of record.history) {
      history.push({ date: entry.date, text: entry.text, record: ref });
    }
  }
  history.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.record !== b.record) return a.record < b.record ? -1 : 1;
    return a.text < b.text ? -1 : a.text > b.text ? 1 : 0;
  });
  const dues = (surviving && surviving.dues !== null ? surviving.dues : 0)
    + (mergedAway && mergedAway.dues !== null ? mergedAway.dues : 0);
  return {
    survivingRecord: clean.survivingRecord,
    mergedAwayRecord: clean.mergedAwayRecord,
    dues,
    history,
  };
}

export function customerRecordMergeDuesReconciles(merge, records) {
  const clean = normalizeCustomerRecordMerge(merge);
  if (!clean) return { reconciles: false, expected: null, merged: null };
  const supplied = Array.isArray(records) ? records.map(normalizeCustomerRecordMergeRecord).filter(Boolean) : [];
  const byRef = new Map();
  for (const record of supplied) byRef.set(record.reference.toLowerCase(), record);
  const surviving = byRef.get(clean.survivingRecord.toLowerCase());
  const mergedAway = byRef.get(clean.mergedAwayRecord.toLowerCase());
  if (!surviving || !mergedAway) return { reconciles: false, expected: null, merged: clean.mergedDues };
  if (surviving.dues === null || mergedAway.dues === null) return { reconciles: false, expected: null, merged: clean.mergedDues };
  const expected = surviving.dues + mergedAway.dues;
  return { reconciles: expected === clean.mergedDues, expected, merged: clean.mergedDues };
}

export function customerRecordMergeCountsAll(list) {
  const known = normalizeCustomerRecordMergeList(list);
  const surviving = new Set(known.map((item) => item.survivingRecord.toLowerCase()));
  const mergedAway = new Set(known.map((item) => item.mergedAwayRecord.toLowerCase()));
  return { notes: known.length, surviving: surviving.size, mergedAway: mergedAway.size };
}

export function customerRecordMergeSummaryText(list) {
  const counts = customerRecordMergeCountsAll(list);
  if (counts.notes === 0) return 'No customer record merges recorded.';
  return `${counts.notes} merge note${counts.notes === 1 ? '' : 's'} recorded, ${counts.surviving} surviving record${counts.surviving === 1 ? '' : 's'}, ${counts.mergedAway} record${counts.mergedAway === 1 ? '' : 's'} merged away.`;
}

export function customerRecordMergeText(merge) {
  const clean = normalizeCustomerRecordMerge(merge);
  if (!clean) return '';
  const fields = clean.fieldsCarriedOver.length ? `, fields carried over: ${clean.fieldsCarriedOver.join(', ')}` : ', no fields carried over';
  return `${clean.mergeDate} — ${clean.mergedAwayRecord} merged into ${clean.survivingRecord}, approved by ${clean.approver}, merged dues Rs ${clean.mergedDues}${fields}.`;
}

function escapeCustomerRecordMergeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function customerRecordMergeCompare(a, b) {
  if (a.mergeDate !== b.mergeDate) return a.mergeDate < b.mergeDate ? 1 : -1;
  if (a.id !== b.id) return a.id < b.id ? 1 : -1;
  return 0;
}

export function customerRecordMergesHtml(list) {
  const known = normalizeCustomerRecordMergeList(list);
  const items = [...known].sort(customerRecordMergeCompare).map((item) => `<li>${escapeCustomerRecordMergeHtml(customerRecordMergeText(item))}</li>`).join('');
  return `<ul>${items}</ul>`;
}

export function customerRecordMergedAwayHtml(list) {
  const items = customerRecordMergedAway(list).map((entry) => `<li>${escapeCustomerRecordMergeHtml(entry.record)} — merged into ${escapeCustomerRecordMergeHtml(entry.survivingRecord)} on ${escapeCustomerRecordMergeHtml(entry.mergeDate)} (note ${escapeCustomerRecordMergeHtml(entry.noteId)}), kept as merged, never deleted.</li>`).join('');
  return `<ul>${items}</ul>`;
}

function customerRecordMergeCsvCell(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function customerRecordMergeCsv(list) {
  const known = normalizeCustomerRecordMergeList(list);
  const header = ['id', 'mergeDate', 'survivingRecord', 'mergedAwayRecord', 'recordsMerged', 'fieldsCarriedOver', 'operator', 'approver', 'mergedDues'];
  const lines = [header.map(customerRecordMergeCsvCell).join(',')];
  for (const item of [...known].sort(customerRecordMergeCompare)) {
    lines.push([
      item.id,
      item.mergeDate,
      item.survivingRecord,
      item.mergedAwayRecord,
      item.recordsMerged.join('; '),
      item.fieldsCarriedOver.join('; '),
      item.operator,
      item.approver,
      item.mergedDues,
    ].map(customerRecordMergeCsvCell).join(','));
  }
  return lines.join('\n');
}

export function customerRecordMergeFilename() {
  return 'customer-record-merge-notes.csv';
}
