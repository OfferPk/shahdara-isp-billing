// Plan 224 (Plan 203-350) — Receipt book issue log per collector.
//
// Physical receipt books are handed out with no issue and return
// record, so a missing book cannot be traced to who last held it.
// Series ranges (Plan 122) control receipt numbers, not the
// physical book itself: this module tracks custody of books only.
//
// One issue record per receipt book: a book identifier, the holder
// it was issued to, the date issued, the date returned (blank while
// outstanding), and the condition on return (blank until returned).
// An outstanding-books list shows unreturned books by holder and
// age, and returning a book clears it from that list while keeping
// its return date. A book issued to two holders at once is flagged.
//
// The fences, stated plainly:
//   - This module assigns no numbers and changes no receipt, no
//     payment, and no series record: the Plan 122 series module,
//     the Plan 121 receipt-reprint module, and the Plan 91 gap
//     audit are neither read nor rewritten, and no receipt,
//     payment, or series record is ever opened here. Book
//     identifiers, holders, and dates arrive as caller-supplied
//     values only.
//   - A returned book can never be un-returned or re-dated: the
//     first return date and condition are kept, and a later return
//     attempt leaves them untouched.
//   - A return dated before the issue date is refused outright,
//     never repaired.
//   - Inputs are never mutated, and the module never reads
//     storage, the clock, the network, or the page.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 30, 31, 30, 31, 30];

function validReceiptBookDate(value) {
  if (typeof value !== 'string') return false;
  const match = DATE_RE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  const limit = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  return day >= 1 && day <= limit;
}

function daysSinceEpoch(value) {
  const [year, month, day] = value.split('-').map(Number);
  const daysBeforeYear = (y) => 365 * (y - 1) + Math.floor((y - 1) / 4) - Math.floor((y - 1) / 100) + Math.floor((y - 1) / 400);
  let days = daysBeforeYear(year);
  for (let m = 1; m < month; m += 1) {
    days += m === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[m - 1];
  }
  return days + day;
}

// A raw record is usable only when it names its book, its holder,
// and a real issue date. Unknown fields are dropped, never kept.
function normalizeReceiptBook(value) {
  if (!value || typeof value !== 'object') return null;
  const id = text(value.id);
  const bookId = text(value.bookId);
  const issuedTo = text(value.issuedTo);
  const dateIssued = text(value.dateIssued);
  if (!id || !bookId || !issuedTo || !validReceiptBookDate(dateIssued)) return null;
  const dateReturned = text(value.dateReturned);
  const conditionOnReturn = text(value.conditionOnReturn);
  if (dateReturned && !validReceiptBookDate(dateReturned)) return null;
  if (dateReturned && daysSinceEpoch(dateReturned) < daysSinceEpoch(dateIssued)) return null;
  return {
    id,
    bookId,
    issuedTo,
    dateIssued,
    dateReturned: dateReturned || '',
    conditionOnReturn: conditionOnReturn || '',
  };
}

function normalizeReceiptBookList(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const item of value) {
    const row = normalizeReceiptBook(item);
    if (!row || seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}

function compareText(a, b) {
  const lowerA = a.toLowerCase();
  const lowerB = b.toLowerCase();
  if (lowerA < lowerB) return -1;
  if (lowerA > lowerB) return 1;
  return 0;
}

// Books sorted by holder A-Z, then date issued, then book id.
function receiptBooksSorted(list) {
  const rows = normalizeReceiptBookList(list);
  rows.sort((a, b) => compareText(a.issuedTo, b.issuedTo)
    || (a.dateIssued < b.dateIssued ? -1 : a.dateIssued > b.dateIssued ? 1 : 0)
    || compareText(a.bookId, b.bookId)
    || compareText(a.id, b.id));
  return rows;
}

function findReceiptBook(list, id) {
  const wanted = text(id);
  if (!wanted) return null;
  return normalizeReceiptBookList(list).find((row) => row.id === wanted) || null;
}

// Recording an issue never changes any receipt, payment, or series
// record by itself. A half-formed issue is refused (null); a
// duplicate id is never rewritten (the existing list is returned).
function recordReceiptBook(list, value) {
  const rows = normalizeReceiptBookList(list);
  const row = normalizeReceiptBook(value);
  if (!row) return null;
  if (rows.some((item) => item.id === row.id)) return rows;
  // A fresh issue carries no return yet, whatever the caller passed.
  row.dateReturned = '';
  row.conditionOnReturn = '';
  return [...rows, row];
}

function removeReceiptBook(list, id) {
  const wanted = text(id);
  if (!wanted) return normalizeReceiptBookList(list);
  return normalizeReceiptBookList(list).filter((row) => row.id !== wanted);
}

// Returning a book clears it from the outstanding list while its
// return date and condition are kept. A book already returned keeps
// its first return date and condition; a return dated before the
// issue date is refused and leaves the list untouched.
function returnReceiptBook(list, id, dateReturned, conditionOnReturn) {
  const rows = normalizeReceiptBookList(list);
  const wanted = text(id);
  const returned = text(dateReturned);
  if (!wanted || !validReceiptBookDate(returned)) return rows;
  return rows.map((row) => {
    if (row.id !== wanted) return row;
    if (row.dateReturned) return row;
    if (daysSinceEpoch(returned) < daysSinceEpoch(row.dateIssued)) return row;
    return { ...row, dateReturned: returned, conditionOnReturn: text(conditionOnReturn) };
  });
}

function receiptBooksOutstanding(list) {
  return receiptBooksSorted(list).filter((row) => !row.dateReturned);
}

function receiptBooksReturned(list) {
  return receiptBooksSorted(list).filter((row) => row.dateReturned);
}

function receiptBooksForHolder(list, holder) {
  const wanted = text(holder).toLowerCase();
  if (!wanted) return receiptBooksSorted(list);
  return receiptBooksSorted(list).filter((row) => row.issuedTo.toLowerCase().includes(wanted));
}

// A book with more than one outstanding issue record is issued to
// two holders at once. Returned records never count: a book returned
// and re-issued is one holder at a time, not a double issue.
function doubleIssuedBooks(list) {
  const outstanding = receiptBooksOutstanding(list);
  const byBook = new Map();
  for (const row of outstanding) {
    if (!byBook.has(row.bookId)) byBook.set(row.bookId, []);
    byBook.get(row.bookId).push(row);
  }
  const out = [];
  for (const [bookId, rows] of byBook) {
    if (rows.length > 1) out.push({ bookId, holders: rows.map((row) => row.issuedTo), count: rows.length });
  }
  out.sort((a, b) => compareText(a.bookId, b.bookId));
  return out;
}

// Age in whole days against a caller-supplied as-of date. A bad
// as-of date yields null, never a guessed age.
function receiptBookAgeDays(row, asOf) {
  const clean = normalizeReceiptBook(row);
  if (!clean) return null;
  const asOfText = text(asOf);
  if (!validReceiptBookDate(asOfText)) return null;
  return daysSinceEpoch(asOfText) - daysSinceEpoch(clean.dateIssued);
}

function receiptBookText(row) {
  const clean = normalizeReceiptBook(row);
  if (!clean) return '';
  if (clean.dateReturned) {
    const condition = clean.conditionOnReturn || 'No condition noted.';
    return `Book ${clean.bookId} issued to ${clean.issuedTo} on ${clean.dateIssued}, returned on ${clean.dateReturned} (${condition}).`;
  }
  return `Book ${clean.bookId} issued to ${clean.issuedTo} on ${clean.dateIssued}, not yet returned.`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function receiptBookHtml(row) {
  const clean = normalizeReceiptBook(row);
  if (!clean) return '';
  const returned = clean.dateReturned
    ? `Returned ${escapeHtml(clean.dateReturned)} (${escapeHtml(clean.conditionOnReturn || 'No condition noted.')})`
    : 'Outstanding';
  return `<tr><td>${escapeHtml(clean.bookId)}</td><td>${escapeHtml(clean.issuedTo)}</td><td>${escapeHtml(clean.dateIssued)}</td><td>${returned}</td></tr>`;
}

function receiptBookAllHtml(list) {
  const rows = receiptBooksSorted(list);
  if (!rows.length) return '<p>No receipt books recorded.</p>';
  const body = rows.map((row) => receiptBookHtml(row)).join('');
  return `<table><thead><tr><th>Book</th><th>Issued to</th><th>Date issued</th><th>Return</th></tr></thead><tbody>${body}</tbody></table>`;
}

function receiptBookSummaryText(list) {
  const rows = normalizeReceiptBookList(list);
  const outstanding = rows.filter((row) => !row.dateReturned).length;
  const returned = rows.length - outstanding;
  const doubles = doubleIssuedBooks(list);
  const flag = doubles.length
    ? ` ${doubles.length} book(s) issued to two holders at once: ${doubles.map((item) => item.bookId).join(', ')}.`
    : '';
  return `${rows.length} receipt book(s) recorded: ${outstanding} outstanding, ${returned} returned.${flag}`;
}

function csvCell(value) {
  const raw = String(value ?? '');
  return /[",\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

function receiptBookCsv(list) {
  const rows = receiptBooksSorted(list);
  const lines = ['id,book_id,issued_to,date_issued,date_returned,condition_on_return'];
  for (const row of rows) {
    lines.push([row.id, row.bookId, row.issuedTo, row.dateIssued, row.dateReturned, row.conditionOnReturn].map(csvCell).join(','));
  }
  return lines.join('\n');
}

function receiptBookFilename() {
  return 'receipt-books.csv';
}

export {
  validReceiptBookDate,
  normalizeReceiptBook,
  normalizeReceiptBookList,
  receiptBooksSorted,
  findReceiptBook,
  recordReceiptBook,
  removeReceiptBook,
  returnReceiptBook,
  receiptBooksOutstanding,
  receiptBooksReturned,
  receiptBooksForHolder,
  doubleIssuedBooks,
  receiptBookAgeDays,
  receiptBookText,
  receiptBookHtml,
  receiptBookAllHtml,
  receiptBookSummaryText,
  receiptBookCsv,
  receiptBookFilename,
};
