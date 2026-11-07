// History entry annotation (Plan 420): one operator note per history
// entry — a short note in plain words, with the date it was written
// and who wrote it, attached to the entry without changing it.
//
// The full history list is read-only, so when an old entry needs a
// short explanation — "customer says this was for his brother" — the
// explanation lives on paper and is lost. The other history displays
// already exist and are left alone: the type, date, method, amount,
// disputed and connection filters, the running balance, the monthly
// and yearly summaries, the CSV export, the printed statement, the
// gap view, the largest-payment highlight, the first-dates line, the
// refund, credit and adjustment displays and the month comparison
// all keep their own behaviour. This module is the missing piece:
// the annotation itself, and the list that shows it beside its entry.
//
// An annotation is keyed to its entry by the entry's own identity —
// its type and its record reference — so it travels with the entry
// itself. One annotation per entry: recording a second note on the
// same entry replaces the first in place. Removing an annotation
// removes only the annotation; the entry stays visible and unchanged.
// Annotating never changes any bill, payment, correction, credit,
// refund, connection, or customer record by itself: the module reads
// no store but its own, and writes to no record but its own list.
//
// The module never reads storage, the clock, the network, or the
// page. Inputs are never mutated. The caller supplies the date, so
// tests pin annotations on fixed fixture dates. A null, undefined,
// empty, or boolean figure is "not a number", never zero.

export const HISTORY_ENTRY_ANNOTATION_STORE_KEY = 'shahdara_hea_notes_v1';

export const HISTORY_ENTRY_ANNOTATION_MAX_TEXT = 300;
export const HISTORY_ENTRY_ANNOTATION_MAX_BY = 60;

const HISTORY_ENTRY_ANNOTATION_TYPES = Object.freeze([
  'charge',
  'payment',
  'advance',
  'credit',
  'refund',
  'adjustment',
]);

const HISTORY_ENTRY_ANNOTATION_TYPE_LABELS = Object.freeze({
  charge: 'Charge',
  payment: 'Payment',
  advance: 'Advance',
  credit: 'Credit',
  refund: 'Refund',
  adjustment: 'Adjustment',
});

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 30, 31, 30, 31, 30];

function isLeapAnnotationYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function isStrictHistoryEntryAnnotationDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const lastDay = month === 2 && isLeapAnnotationYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  return day <= lastDay;
}

function cleanAnnotationKey(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function cleanAnnotationText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function capAnnotationText(value, max) {
  return cleanAnnotationText(value).slice(0, max);
}

// The entry's own identity: its type and its record reference. An
// entry with no usable reference cannot be annotated — the note
// would have nothing to attach to, and it is refused rather than
// guessed onto the wrong entry.
export function historyEntryAnnotationKey(entry) {
  if (!entry || typeof entry !== 'object') return '';
  const type = cleanAnnotationKey(entry.type);
  if (!HISTORY_ENTRY_ANNOTATION_TYPES.includes(type)) return '';
  const ref = cleanAnnotationText(entry.ref);
  if (ref === '') return '';
  return `${type}:${ref}`;
}

function nextAnnotationId(used) {
  let n = 1;
  while (used.has(`hea-${n}`)) n += 1;
  return `hea-${n}`;
}

export function normalizeHistoryEntryAnnotations(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const usedIds = new Set();
  const out = [];
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const customerId = cleanAnnotationKey(raw.customerId);
    if (customerId === '') continue;
    const type = cleanAnnotationKey(raw.entryType);
    if (!HISTORY_ENTRY_ANNOTATION_TYPES.includes(type)) continue;
    const ref = cleanAnnotationText(raw.entryRef);
    if (ref === '') continue;
    const entryKey = `${type}:${ref}`;
    const key = `${customerId}|${entryKey}`;
    if (seen.has(key)) continue;
    const text = capAnnotationText(raw.text, HISTORY_ENTRY_ANNOTATION_MAX_TEXT);
    if (text === '') continue;
    if (!isStrictHistoryEntryAnnotationDate(raw.date)) continue;
    seen.add(key);
    let id = cleanAnnotationText(raw.id);
    if (id === '' || usedIds.has(id)) id = nextAnnotationId(usedIds);
    usedIds.add(id);
    out.push({
      id,
      customerId,
      entryKey,
      entryType: type,
      entryRef: ref,
      text,
      date: raw.date,
      by: capAnnotationText(raw.by, HISTORY_ENTRY_ANNOTATION_MAX_BY),
    });
  }
  return out;
}

export function historyEntryAnnotationForEntry(annotations, customerId, entry) {
  const customer = cleanAnnotationKey(customerId);
  if (customer === '') return null;
  const key = historyEntryAnnotationKey(entry);
  if (key === '') return null;
  const list = normalizeHistoryEntryAnnotations(annotations);
  return list.find((item) => item.customerId === customer && item.entryKey === key) ?? null;
}

export function historyEntryAnnotationsForCustomer(annotations, customerId) {
  const customer = cleanAnnotationKey(customerId);
  if (customer === '') return [];
  return normalizeHistoryEntryAnnotations(annotations)
    .filter((item) => item.customerId === customer);
}

export function historyEntriesHaveAnnotations(entries, annotations, customerId) {
  if (!Array.isArray(entries)) return false;
  return entries.some((entry) => historyEntryAnnotationForEntry(annotations, customerId, entry) !== null);
}

// Record one annotation. A second note on the same entry replaces
// the first in place and keeps its id, so the entry never carries
// two notes. A refused record — no customer, no annotatable entry,
// no note text, or no strict date — returns the very list passed
// in, unchanged.
export function recordHistoryEntryAnnotation(annotations, input = {}) {
  if (!input || typeof input !== 'object') return annotations;
  const customerId = cleanAnnotationKey(input.customerId);
  if (customerId === '') return annotations;
  const entryKey = historyEntryAnnotationKey(input.entry);
  if (entryKey === '') return annotations;
  const text = capAnnotationText(input.text, HISTORY_ENTRY_ANNOTATION_MAX_TEXT);
  if (text === '') return annotations;
  if (!isStrictHistoryEntryAnnotationDate(input.date)) return annotations;
  const by = capAnnotationText(input.by, HISTORY_ENTRY_ANNOTATION_MAX_BY);
  const list = normalizeHistoryEntryAnnotations(annotations);
  const existing = list.find((item) => item.customerId === customerId && item.entryKey === entryKey);
  if (existing) {
    return list.map((item) => (item === existing
      ? { ...item, text, date: input.date, by }
      : item));
  }
  const usedIds = new Set(list.map((item) => item.id));
  const type = cleanAnnotationKey(input.entry.type);
  const ref = cleanAnnotationText(input.entry.ref);
  return [...list, {
    id: nextAnnotationId(usedIds),
    customerId,
    entryKey,
    entryType: type,
    entryRef: ref,
    text,
    date: input.date,
    by,
  }];
}

// Remove one annotation. Removing an unknown id returns the very
// list passed in, unchanged — and removing an annotation never
// touches the entry it was attached to.
export function removeHistoryEntryAnnotation(annotations, annotationId) {
  const id = cleanAnnotationText(annotationId);
  if (id === '') return annotations;
  const list = normalizeHistoryEntryAnnotations(annotations);
  if (!list.some((item) => item.id === id)) return annotations;
  return list.filter((item) => item.id !== id);
}

export function historyEntryAnnotationLineText(annotation) {
  if (!annotation || typeof annotation !== 'object') return '';
  const text = capAnnotationText(annotation.text, HISTORY_ENTRY_ANNOTATION_MAX_TEXT);
  if (text === '') return '';
  if (!isStrictHistoryEntryAnnotationDate(annotation.date)) return '';
  const by = capAnnotationText(annotation.by, HISTORY_ENTRY_ANNOTATION_MAX_BY);
  return `Note: ${text} · ${annotation.date}${by === '' ? '' : ` · by ${by}`}`;
}

// Amounts print with no decimals for whole rupees (PKR 1,500) and one
// decimal for a paisa remainder (PKR 1,500.5), the same shape the
// entry-screen formatters use. A null, undefined, empty, or boolean
// figure is not a number, never zero.
export function formatHistoryEntryAnnotationAmount(cents) {
  if (cents === null || cents === undefined || typeof cents === 'boolean' || cents === '') return 'PKR 0';
  const amount = Number(cents);
  if (!Number.isFinite(amount)) return 'PKR 0';
  const sign = amount < 0 ? '-' : '';
  const text = (Math.abs(amount) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${sign}PKR ${text}`;
}

export function historyEntryAnnotationRunningNote(balanceCents) {
  if (balanceCents === null || balanceCents === undefined || typeof balanceCents === 'boolean' || balanceCents === '') return 'Settled';
  const balance = Number(balanceCents);
  if (!Number.isFinite(balance) || balance === 0) return 'Settled';
  if (balance > 0) return `Still owed ${formatHistoryEntryAnnotationAmount(balance)}`;
  return `Credit ${formatHistoryEntryAnnotationAmount(-balance)}`;
}

function escapeAnnotationHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function annotationFlagText(entry) {
  if (!entry || typeof entry !== 'object') return '';
  const ref = entry.disputedCaseRef;
  if (typeof ref !== 'string' || ref === '') return '';
  return ` · Disputed · ${ref}`;
}

export function historyEntryAnnotationOptionText(entry) {
  if (!entry || typeof entry !== 'object') return '';
  const label = HISTORY_ENTRY_ANNOTATION_TYPE_LABELS[cleanAnnotationKey(entry.type)] || 'Payment';
  const date = entry.date ? entry.date : 'date not recorded';
  const amount = formatHistoryEntryAnnotationAmount(entry.amountCents);
  const voided = entry.voided ? ' · VOID' : '';
  return `${date} · ${label}${voided} · ${amount}`;
}

// The history list with its annotations: the same rows the full
// history renders — label, amount, date, method, note and running
// balance, with the disputed flag kept on every flagged row — and
// the annotation line inside the row of every annotated entry, with
// its date, who wrote it, and a Remove button. With no annotated
// row the output is the ordinary list, unchanged.
export function historyAnnotatedListHtml(entries, annotations, customerId) {
  const list = Array.isArray(entries) ? entries : [];
  if (list.length === 0) return '';
  const rows = list.map((entry) => {
    if (!entry || typeof entry !== 'object') return '';
    const label = HISTORY_ENTRY_ANNOTATION_TYPE_LABELS[cleanAnnotationKey(entry.type)] || 'Payment';
    const date = entry.date ? entry.date : 'date not recorded';
    const amount = formatHistoryEntryAnnotationAmount(entry.amountCents);
    const note = historyEntryAnnotationRunningNote(entry.runningBalanceCents);
    const details = [date, entry.method, entry.note].filter(Boolean).join(' · ');
    const voided = entry.voided ? ' · VOID' : '';
    const annotation = historyEntryAnnotationForEntry(annotations, customerId, entry);
    const annotationSpan = annotation === null
      ? ''
      : `<span class="payment-meta hea-annotation">${escapeAnnotationHtml(historyEntryAnnotationLineText(annotation))} <button class="secondary-button btn-sm" type="button" data-hea-remove="${escapeAnnotationHtml(annotation.id)}">Remove</button></span>`;
    return `<li class="payment-row"><span class="payment-main"><span class="payment-amount">${escapeAnnotationHtml(label)} · ${escapeAnnotationHtml(amount)}${escapeAnnotationHtml(voided)}</span><span class="payment-meta">${escapeAnnotationHtml(details)} · ${escapeAnnotationHtml(note)}${escapeAnnotationHtml(annotationFlagText(entry))}</span>${annotationSpan}</span></li>`;
  });
  return `<ul class="payment-list">${rows.join('')}</ul>`;
}

// The add form: one entry picker, one note, who wrote it, and the
// date. Only entries that can take a note are offered — an entry
// with no usable reference cannot be annotated, and an entry that
// already carries a note is not offered again, because one entry
// carries one annotation. With nothing annotatable there is no
// form at all.
export function historyEntryAnnotationFormHtml(entries, annotations, customerId, today) {
  const list = Array.isArray(entries) ? entries : [];
  const options = list.filter((entry) => historyEntryAnnotationKey(entry) !== ''
    && historyEntryAnnotationForEntry(annotations, customerId, entry) === null);
  if (options.length === 0) return '';
  const dateValue = isStrictHistoryEntryAnnotationDate(today) ? today : '';
  const optionHtml = options.map((entry) => `<option value="${escapeAnnotationHtml(historyEntryAnnotationKey(entry))}">${escapeAnnotationHtml(historyEntryAnnotationOptionText(entry))}</option>`).join('');
  return `<div class="hea-annotation-form"><p>Add a note to an entry</p><label>Entry <select id="heaHistoryEntryAnnotationEntry">${optionHtml}</select></label> <label>Note <input id="heaHistoryEntryAnnotationText" type="text" maxlength="300"></label> <label>Written by <input id="heaHistoryEntryAnnotationBy" type="text" maxlength="60"></label> <label>Date <input id="heaHistoryEntryAnnotationDate" type="date" value="${escapeAnnotationHtml(dateValue)}"></label> <button id="heaHistoryEntryAnnotationAdd" class="secondary-button" type="button">Add note</button></div>`;
}
