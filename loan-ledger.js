/**
 * loan-ledger.js — Personal loan ledger (owner's own lending/borrowing).
 *
 * Problem: the owner lends money to people and borrows from people, and
 * needs one place that answers, at a glance, how much is to be taken from
 * whom, how much is to be given to whom, and the grand totals across
 * everyone. This has nothing to do with the ISP business: it never touches
 * customer bills, receipts, business expenses, partner shares, profit, or
 * the home budget. It is a separate ledger by design.
 *
 * Direction semantics (owner's perspective, used everywhere, including the
 * UI labels): "Dena hai" = the owner OWES this person (owner borrowed from
 * them, repayment pending). "Lena hai" = this person OWES the owner (owner
 * lent to them, collection pending).
 *
 * Storage: loan entries live in localStorage under LOAN_KEY
 * (loan_ledger_v1) as a flat array of entry records. Balances are always
 * DERIVED (loans minus repayments per person per direction) — never stored
 * twice — so the book can never drift from its own log. Entries travel in
 * the JSON backup `settings.loans` section (see core.js), under the same
 * safe-merge rule as the stock book: adopted only when this device has none
 * stored yet.
 *
 * Repayment rule: a repayment may never exceed the outstanding balance in
 * that direction for that person — you cannot repay more than is owed, just
 * as stock out cannot drive inventory below zero. Overpayment is a data
 * error: delete the wrong entry and re-enter it.
 *
 * All helpers are pure except loadLoans/saveLoans. Tests use synthetic data
 * only.
 */

export const LOAN_KEY = 'loan_ledger_v1';

export const LOAN_DIRECTIONS = Object.freeze([
  { id: 'dena', label: 'Dena hai', hint: 'I owe them' },
  { id: 'lena', label: 'Lena hai', hint: 'They owe me' },
]);

export const LOAN_KINDS = Object.freeze(['loan', 'repayment']);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const LOAN_ID_RE = /^LN-(\d+)$/;

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function collapseSpaces(value) {
  return cleanText(value).replace(/\s+/gu, ' ');
}

export function loanPersonKey(name) {
  return collapseSpaces(name).toLowerCase();
}

function toCents(amount) {
  return Math.round(Number(amount) * 100);
}

function fromCents(cents) {
  return Math.round(cents) / 100;
}

function isValidAmount(amount) {
  const n = Number(amount);
  return Number.isFinite(n) && n > 0;
}

/** Drops malformed rows; keeps clean entries in stored order. */
export function sanitizeLoanEntries(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const row of value) {
    if (!row || typeof row !== 'object') continue;
    const person = collapseSpaces(row.person);
    const direction = row.direction === 'dena' || row.direction === 'lena' ? row.direction : null;
    const kind = row.kind === 'loan' || row.kind === 'repayment' ? row.kind : null;
    if (!person || !direction || !kind || !isValidAmount(row.amount)) continue;
    out.push({
      id: typeof row.id === 'string' && row.id ? row.id : '',
      person,
      phone: cleanText(row.phone),
      direction,
      kind,
      amount: Math.round(Number(row.amount) * 100) / 100,
      date: typeof row.date === 'string' && DATE_RE.test(row.date) ? row.date : '',
      note: cleanText(row.note),
      createdAt: typeof row.createdAt === 'string' ? row.createdAt : '',
    });
  }
  return out;
}

function nextLoanId(entries) {
  let max = 0;
  for (const entry of entries) {
    const match = typeof entry.id === 'string' ? entry.id.match(LOAN_ID_RE) : null;
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `LN-${max + 1}`;
}

function outstandingByPersonDirection(entries, person, direction) {
  const key = loanPersonKey(person);
  let cents = 0;
  for (const entry of entries) {
    if (loanPersonKey(entry.person) !== key || entry.direction !== direction) continue;
    cents += entry.kind === 'loan' ? toCents(entry.amount) : -toCents(entry.amount);
  }
  return fromCents(cents);
}

/**
 * Appends one entry. Repayments are refused when they exceed the
 * outstanding balance in that direction for that person.
 */
export function addLoanEntry(entries, fields) {
  const list = sanitizeLoanEntries(entries);
  const person = collapseSpaces(fields?.person);
  if (!person) throw new Error('Enter the person’s name.');
  if (person.length > 100) throw new Error('Person name must be 100 characters or fewer.');
  const phone = cleanText(fields?.phone);
  if (phone.length > 40) throw new Error('Phone number must be 40 characters or fewer.');
  const direction = fields?.direction === 'dena' || fields?.direction === 'lena' ? fields.direction : null;
  if (!direction) throw new Error('Choose Dena hai or Lena hai.');
  const kind = fields?.kind === 'loan' || fields?.kind === 'repayment' ? fields.kind : null;
  if (!kind) throw new Error('Choose a new loan or a repayment.');
  if (!isValidAmount(fields?.amount)) throw new Error('Enter a positive loan amount.');
  const amount = Math.round(Number(fields.amount) * 100) / 100;
  const date = typeof fields?.date === 'string' && DATE_RE.test(fields.date) ? fields.date : '';
  if (!date) throw new Error('Enter the entry date.');
  const note = cleanText(fields?.note);
  if (note.length > 500) throw new Error('Note must be 500 characters or fewer.');
  if (kind === 'repayment') {
    const outstanding = outstandingByPersonDirection(list, person, direction);
    if (toCents(amount) > toCents(outstanding)) {
      throw new Error(`Repayment of PKR ${amount} exceeds the outstanding ${direction === 'dena' ? 'Dena hai' : 'Lena hai'} balance of PKR ${outstanding} for ${person}.`);
    }
  }
  return [...list, { id: nextLoanId(list), person, phone, direction, kind, amount, date, note, createdAt: new Date().toISOString() }];
}

/** Removes one entry by id; throws when the id is unknown. */
export function deleteLoanEntry(entries, id) {
  const list = sanitizeLoanEntries(entries);
  if (!list.some(entry => entry.id === id)) throw new Error('Loan entry not found.');
  return list.filter(entry => entry.id !== id);
}

/**
 * One running account per person: dena/lena balances derived from the log,
 * net position (positive net = net to receive, negative = net to pay), and
 * the person's entries in stored order. Sorted by outstanding balance
 * descending, then name — the biggest open positions first.
 */
export function loanPersonSummaries(entries) {
  const byKey = new Map();
  for (const entry of sanitizeLoanEntries(entries)) {
    const key = loanPersonKey(entry.person);
    if (!byKey.has(key)) {
      byKey.set(key, { key, name: entry.person, phone: '', denaCents: 0, lenaCents: 0, entries: [] });
    }
    const person = byKey.get(key);
    if (entry.phone) person.phone = entry.phone;
    if (entry.direction === 'dena') person.denaCents += entry.kind === 'loan' ? toCents(entry.amount) : -toCents(entry.amount);
    else person.lenaCents += entry.kind === 'loan' ? toCents(entry.amount) : -toCents(entry.amount);
    person.entries.push(entry);
  }
  return [...byKey.values()].map(person => {
    const dena = fromCents(person.denaCents);
    const lena = fromCents(person.lenaCents);
    return {
      key: person.key,
      name: person.name,
      phone: person.phone,
      dena,
      lena,
      net: fromCents(person.lenaCents - person.denaCents),
      outstanding: fromCents(person.denaCents + person.lenaCents),
      settled: person.denaCents + person.lenaCents === 0,
      entries: person.entries,
    };
  }).sort((a, b) => b.outstanding - a.outstanding || a.name.localeCompare(b.name));
}

/** Grand totals across everyone, always derived from the same log. */
export function loanGrandTotals(entries) {
  const summaries = loanPersonSummaries(entries);
  let denaCents = 0;
  let lenaCents = 0;
  for (const person of summaries) {
    denaCents += toCents(person.dena);
    lenaCents += toCents(person.lena);
  }
  return {
    dena: fromCents(denaCents),
    lena: fromCents(lenaCents),
    net: fromCents(lenaCents - denaCents),
    personCount: summaries.length,
    outstandingPersonCount: summaries.filter(person => !person.settled).length,
    entryCount: sanitizeLoanEntries(entries).length,
  };
}

/** Filters person summaries by name/phone search and by direction balance. */
export function filterLoanPersons(summaries, { query = '', direction = 'all' } = {}) {
  const q = cleanText(query).toLowerCase();
  return (summaries ?? []).filter(person => {
    if (q && !(person.name.toLowerCase().includes(q) || person.phone.toLowerCase().includes(q))) return false;
    if (direction === 'dena' && !(person.dena > 0)) return false;
    if (direction === 'lena' && !(person.lena > 0)) return false;
    return true;
  });
}

/** Loads entries from storage; never throws. */
export function loadLoans(storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return [];
    const raw = store.getItem(LOAN_KEY);
    if (!raw) return [];
    return sanitizeLoanEntries(JSON.parse(raw));
  } catch {
    return [];
  }
}

/** Persists entries; never throws. */
export function saveLoans(entries, storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return false;
    store.setItem(LOAN_KEY, JSON.stringify(sanitizeLoanEntries(entries)));
    return true;
  } catch {
    return false;
  }
}
