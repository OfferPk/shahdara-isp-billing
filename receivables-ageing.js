// Plan 7 (Plan 1-100) — Receivables ageing by BILL age (not promise age).
//
// READ-ONLY. This module groups outstanding BILLS by how many whole
// calendar months have passed since the bill month, as of a given
// month:
//
//   current  — bill month is the as-of month (0 months old)
//   one      — bill month is 1 month before the as-of month
//   two      — bill month is 2 months before the as-of month
//   threePlus— bill month is 3 or more months before the as-of month
//
// This is deliberately NOT the other two ageing views in the app, and
// it replaces neither of them:
//   - dashboard-dues-aging.js buckets by DAYS past the due date
//     (0-30 / 31-60 / 61-90 / 90+ days overdue);
//   - Plan O Waada age bands (1-3 / 4-7 / 8-14 / 15+ days) bucket
//     PROMISE age, i.e. how long a promise has been broken.
// Plan 7 buckets BILL age only: a bill from three months ago sits in
// "3+ months" even if no Waada was ever made against it, and a
// Waada broken yesterday does not move a current bill into an
// older bucket. No Waada field is read here at all.
//
// The module is import-free by design (like owner-digest.js,
// route-sequencing.js and day-target.js), so it can be used without
// pulling in the app graph. The caller supplies bill-level entries
// (one per outstanding bill) together with the as-of month; the
// module never reads a record, never recounts a payment, and never
// changes a bill, a total, or a Waada record.
//
// Input entry shape:
//   {
//     customerId, customerName, mohalla (raw string, may be blank),
//     billMonth ("YYYY-MM"), amount (outstanding integer CENTS for
//     this bill — Sharafat 14: the module carries cents end-to-end
//     and rounds only at display; a caller passing rupees would
//     silently inflate ageing 100x, so never pass rupees here)
//   }
// Optional per-entry overrides: mohallaKey / mohallaLabel, when the
// caller has already resolved the mohalla through the app's
// canonical rule (phase3 canonicalMohalla). Otherwise the module
// derives a key itself: trimmed, upper-cased, with a leading
// "MOHALLA " prefix stripped, so "Bani", "MOHALLA BANI" and "BANII"
// spellings that canonicalise alike group together; a blank mohalla
// groups under "Unassigned" and is never dropped.
//
// Ageing rules, stated plainly:
//   - A bill dated in a FUTURE month relative to the as-of month
//     counts as current (age clamped to 0): it is not yet aged.
//   - An entry with an unparseable bill month is NOT silently put
//     in a bucket. It is listed in `unaged` and its amount still
//     counts in `totalOutstanding`, so nothing vanishes. The
//     invariant is: sum(bucket amounts) + unaged amount =
//     totalOutstanding, and when every entry has a valid month,
//     sum(bucket amounts) = totalOutstanding exactly.
//   - Entries with amount <= 0 are not outstanding bills and are
//     excluded, reported as `skippedNonOutstanding` (a count, not
//     an amount). Zero-amount bills therefore cannot inflate a
//     bucket or break the sum.
//   - Amounts are integer cents end-to-end (Sharafat 14): the caller
//     passes balanceDueCents straight through, buckets and totals
//     stay in cents, and only the display (formatAmount) rounds to
//     whole rupees; num() guards non-integer input by rounding to the
//     nearest cent. The CSV writes exact decimal rupees (ageingCsv).
//   - Nothing is mutated: input entries are read, never written.

export const AGEING_BUCKETS = Object.freeze([
  Object.freeze({ key: 'current', label: 'Current', ageMonths: 0, description: 'Bill month is the as-of month' }),
  Object.freeze({ key: 'one', label: '1 month', ageMonths: 1, description: 'Bill month is 1 month before the as-of month' }),
  Object.freeze({ key: 'two', label: '2 months', ageMonths: 2, description: 'Bill month is 2 months before the as-of month' }),
  Object.freeze({ key: 'threePlus', label: '3+ months', ageMonths: 3, description: 'Bill month is 3 or more months before the as-of month' }),
]);

export const AGEING_BUCKET_KEYS = Object.freeze(AGEING_BUCKETS.map((bucket) => bucket.key));

const MONTH_RE = /^(\d{4})-(\d{2})$/;

// Sharafat 14: amounts are integer cents — Math.round here is only
// the guard against non-integer input, never a rupee rounding.
function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function str(value) {
  return value == null ? '' : String(value);
}

function escapeHtml(value) {
  return str(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function csvCell(value) {
  const text = str(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function formatAmount(value) {
  // Sharafat 14: value is integer cents — round to whole rupees ONLY
  // at display, so 150050 cents prints "Rs. 1,501", never "Rs. 150,050".
  return `Rs. ${Math.round(num(value) / 100).toLocaleString('en-US')}`;
}

// Sharafat 14 (parent decision 2026-11-13): the CSV writes exact
// decimal rupees — 150050 cents is "1500.50", never "150050" (cents
// in a CSV would be misread as rupees). Two decimals always, so the
// row section and the mohalla-totals section reconcile to the paisa.
function formatCsvAmount(cents) {
  return (num(cents) / 100).toFixed(2);
}

/** Strict YYYY-MM validation against the real calendar (month 01-12). */
export function isValidBillMonth(value) {
  if (typeof value !== 'string') return false;
  const match = MONTH_RE.exec(value.trim());
  if (!match) return false;
  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

/**
 * Whole calendar months between a bill month and the as-of month.
 * Positive when the bill is older, 0 for the as-of month itself,
 * negative for a future bill month. Returns null when either month
 * is not a valid YYYY-MM value.
 */
export function billAgeMonths(billMonth, asOfMonth) {
  if (!isValidBillMonth(billMonth) || !isValidBillMonth(asOfMonth)) return null;
  const [billYear, billMon] = billMonth.trim().split('-').map(Number);
  const [asOfYear, asOfMon] = asOfMonth.trim().split('-').map(Number);
  return (asOfYear - billYear) * 12 + (asOfMon - billMon);
}

/**
 * Bucket key for a bill age in months, or null when the age is
 * unknown. Future bills (negative age) count as current.
 */
export function ageingBucketForMonths(ageMonths) {
  if (ageMonths === null || ageMonths === undefined || !Number.isFinite(ageMonths)) return null;
  if (ageMonths <= 0) return 'current';
  if (ageMonths === 1) return 'one';
  if (ageMonths === 2) return 'two';
  return 'threePlus';
}

/** Bucket key for one bill month as of a given month, or null. */
export function ageingBucketForBill(billMonth, asOfMonth) {
  return ageingBucketForMonths(billAgeMonths(billMonth, asOfMonth));
}

/**
 * Default mohalla grouping key: trimmed, upper-cased, leading
 * "MOHALLA " stripped, internal whitespace collapsed. Blank input
 * maps to the sentinel key "UNASSIGNED" so unassigned bills are
 * grouped, never dropped. A caller that already resolved the
 * canonical mohalla may pass mohallaKey / mohallaLabel on the
 * entry instead; those win over this derivation.
 */
export function ageingMohallaKey(raw) {
  const text = str(raw).trim().replace(/\s+/g, ' ');
  if (!text) return 'UNASSIGNED';
  const upper = text.toUpperCase();
  const stripped = upper.startsWith('MOHALLA ') ? upper.slice('MOHALLA '.length) : upper;
  // Owner-confirmed 2026-11-11: JABBIYAAA is the same mohalla as
  // JABBIYAA, so it folds to the same key. Charyaa is its own
  // mohalla and never folds to Chamyaa.
  return stripped === 'JABBIYAAA' ? 'JABBIYAA' : stripped;
}

export function ageingMohallaLabel(raw) {
  const text = str(raw).trim().replace(/\s+/g, ' ');
  if (!text) return 'Unassigned';
  // Owner 5-part fix: display label in consistent Title Case, so a
  // stored 'CHARYAA' and a stored 'Charyaa' read the same; the folded
  // JABBIYAAA spelling reads as its canonical 'Jabbiyaa'.
  if (ageingMohallaKey(raw) === 'JABBIYAA') return 'Jabbiyaa';
  return text.split(' ').map((word) => {
    const chars = Array.from(word);
    if (!chars.length) return word;
    // Same rule as phase3's readableLabel: a 2–3-letter all-caps
    // word (an acronym or a short label such as 'X<Y') keeps its
    // own casing instead of being forced to Title Case.
    const letters = word.match(/\p{L}/gu) ?? [];
    if (letters.length >= 2 && letters.length <= 3 && letters.every((letter) => letter === letter.toLocaleUpperCase('en-US'))) return word;
    return chars[0].toLocaleUpperCase('en-US') + chars.slice(1).join('').toLocaleLowerCase('en-US');
  }).join(' ');
}

function compareEntries(a, b) {
  if (b.amount !== a.amount) return b.amount - a.amount;
  return str(a.customerName).localeCompare(str(b.customerName));
}

function compareCustomers(a, b) {
  if (b.amount !== a.amount) return b.amount - a.amount;
  return str(a.customerName).localeCompare(str(b.customerName));
}

function compareMohallas(a, b, compareAreas = null) {
  if (b.total !== a.total) return b.total - a.total;
  // Mohalla Numbering: the amount stays the primary rank; ties break
  // by the caller's mohalla order when given (the app passes the
  // numbered order), otherwise by label — the module stays
  // import-free, so the order is supplied, never copied here.
  if (typeof compareAreas === 'function') return compareAreas(a.label, b.label);
  return str(a.label).localeCompare(str(b.label));
}

/**
 * Build the ageing view for one as-of month.
 *
 * Returns:
 *   {
 *     valid, asOfMonth,
 *     buckets: { current, one, two, threePlus } — each
 *       { key, label, description, amount, billCount,
 *         customerCount, customers: [
 *           { customerId, customerName, mohallaKey, mohallaLabel,
 *             amount, billCount, billMonths[] } ] } (amount desc),
 *     mohallaTotals: [ { key, label, total, billCount,
 *       byBucket: { current, one, two, threePlus } } ] (total desc),
 *     bucketTotal, unaged: [ { customerId, customerName,
 *       mohallaKey, mohallaLabel, billMonth, amount } ],
 *     unagedAmount, totalOutstanding,
 *     billCount, customerCount, skippedNonOutstanding,
 *     sumsMatch  // mohalla totals sum === totalOutstanding
 *   }
 *
 * `valid` is false (and every total is 0) when asOfMonth is not a
 * valid YYYY-MM value; the caller must not render an invalid view.
 */
export function buildReceivablesAgeing(entries, asOfMonth, compareAreas = null) {
  const emptyBuckets = () => {
    const out = {};
    for (const bucket of AGEING_BUCKETS) {
      out[bucket.key] = {
        key: bucket.key,
        label: bucket.label,
        description: bucket.description,
        amount: 0,
        billCount: 0,
        customerCount: 0,
        customers: [],
      };
    }
    return out;
  };
  const empty = (valid) => ({
    valid,
    asOfMonth: isValidBillMonth(asOfMonth) ? asOfMonth.trim() : '',
    buckets: emptyBuckets(),
    mohallaTotals: [],
    bucketTotal: 0,
    unaged: [],
    unagedAmount: 0,
    totalOutstanding: 0,
    billCount: 0,
    customerCount: 0,
    skippedNonOutstanding: 0,
    sumsMatch: true,
  });
  if (!isValidBillMonth(asOfMonth)) return empty(false);

  const asOf = asOfMonth.trim();
  const buckets = emptyBuckets();
  const unaged = [];
  const mohallaMap = new Map();
  const customerIds = new Set();
  let skippedNonOutstanding = 0;

  const addToMohalla = (key, label, bucketKey, amount) => {
    let row = mohallaMap.get(key);
    if (!row) {
      row = {
        key,
        label,
        total: 0,
        billCount: 0,
        byBucket: { current: 0, one: 0, two: 0, threePlus: 0 },
      };
      mohallaMap.set(key, row);
    }
    row.total += amount;
    row.billCount += 1;
    if (bucketKey) row.byBucket[bucketKey] += amount;
  };

  for (const entry of Array.isArray(entries) ? entries : []) {
    if (!entry) continue;
    const amount = num(entry.amount);
    if (!(amount > 0)) {
      skippedNonOutstanding += 1;
      continue;
    }
    const customerId = str(entry.customerId);
    const customerName = str(entry.customerName);
    const mohallaKey = str(entry.mohallaKey) || ageingMohallaKey(entry.mohalla);
    const mohallaLabel = str(entry.mohallaLabel) || ageingMohallaLabel(entry.mohalla);
    const billMonth = str(entry.billMonth).trim();
    const bucketKey = ageingBucketForBill(billMonth, asOf);
    if (bucketKey === null) {
      unaged.push({ customerId, customerName, mohallaKey, mohallaLabel, billMonth, amount });
      addToMohalla(mohallaKey, mohallaLabel, null, amount);
      if (customerId) customerIds.add(customerId);
      continue;
    }
    const bucket = buckets[bucketKey];
    bucket.amount += amount;
    bucket.billCount += 1;
    let customer = bucket.customers.find((c) => c.customerId === customerId && c.customerName === customerName);
    if (!customer) {
      customer = {
        customerId,
        customerName,
        mohallaKey,
        mohallaLabel,
        amount: 0,
        billCount: 0,
        billMonths: [],
      };
      bucket.customers.push(customer);
    }
    customer.amount += amount;
    customer.billCount += 1;
    if (billMonth && !customer.billMonths.includes(billMonth)) customer.billMonths.push(billMonth);
    addToMohalla(mohallaKey, mohallaLabel, bucketKey, amount);
    if (customerId) customerIds.add(customerId);
  }

  let bucketTotal = 0;
  let billCount = 0;
  for (const bucket of Object.values(buckets)) {
    bucket.customers.sort(compareCustomers);
    for (const customer of bucket.customers) customer.billMonths.sort();
    bucket.customerCount = bucket.customers.length;
    bucketTotal += bucket.amount;
    billCount += bucket.billCount;
  }
  const unagedAmount = unaged.reduce((sum, item) => sum + item.amount, 0);
  const mohallaTotals = [...mohallaMap.values()].sort((a, b) => compareMohallas(a, b, compareAreas));
  const mohallaSum = mohallaTotals.reduce((sum, row) => sum + row.total, 0);
  return {
    valid: true,
    asOfMonth: asOf,
    buckets,
    mohallaTotals,
    bucketTotal,
    unaged: unaged.sort(compareEntries),
    unagedAmount,
    totalOutstanding: bucketTotal + unagedAmount,
    billCount: billCount + unaged.length,
    customerCount: customerIds.size,
    skippedNonOutstanding,
    // Independent cross-check: mohalla totals are accumulated on a
    // separate path from the buckets, so their sum must agree with
    // the headline total. (bucketTotal + unagedAmount is the
    // definition of totalOutstanding; the mohalla sum is the check.)
    sumsMatch: mohallaSum === bucketTotal + unagedAmount,
  };
}

/** Headline figures for a view, in bucket order. */
export function ageingSummary(view) {
  if (!view || !view.valid) return null;
  return {
    asOfMonth: view.asOfMonth,
    totalOutstanding: view.totalOutstanding,
    billCount: view.billCount,
    customerCount: view.customerCount,
    buckets: AGEING_BUCKETS.map((bucket) => ({
      key: bucket.key,
      label: bucket.label,
      amount: view.buckets[bucket.key].amount,
      billCount: view.buckets[bucket.key].billCount,
      customerCount: view.buckets[bucket.key].customerCount,
    })),
  };
}

/** Printable HTML for a view: bucket table, mohalla table, customer lists. */
export function ageingHtml(view) {
  if (!view || !view.valid) return '';
  const bucketRows = AGEING_BUCKETS.map((bucket) => {
    const b = view.buckets[bucket.key];
    return `<tr><td>${escapeHtml(b.label)}</td><td>${escapeHtml(b.description)}</td><td>${formatAmount(b.amount)}</td><td>${b.billCount}</td><td>${b.customerCount}</td></tr>`;
  }).join('');
  const mohallaRows = view.mohallaTotals.map((row) => `<tr><td>${escapeHtml(row.label)}</td><td>${formatAmount(row.total)}</td><td>${row.billCount}</td><td>${formatAmount(row.byBucket.current)}</td><td>${formatAmount(row.byBucket.one)}</td><td>${formatAmount(row.byBucket.two)}</td><td>${formatAmount(row.byBucket.threePlus)}</td></tr>`).join('')
    || '<tr><td colspan="7">No outstanding bills.</td></tr>';
  const customerSections = AGEING_BUCKETS.map((bucket) => {
    const b = view.buckets[bucket.key];
    if (b.customers.length === 0) return '';
    const rows = b.customers.map((c) => `<tr><td>${escapeHtml(c.customerName || '—')}</td><td>${escapeHtml(c.mohallaLabel)}</td><td>${formatAmount(c.amount)}</td><td>${c.billCount}</td><td>${escapeHtml(c.billMonths.join(', '))}</td></tr>`).join('');
    return `<h4>${escapeHtml(b.label)} — customers</h4><table><thead><tr><th>Customer</th><th>Mohalla</th><th>Amount</th><th>Bills</th><th>Bill months</th></tr></thead><tbody>${rows}</tbody></table>`;
  }).join('');
  const unagedSection = view.unaged.length === 0 ? ''
    : `<h4>Bills without a readable bill month (counted in the total, in no bucket)</h4><table><thead><tr><th>Customer</th><th>Mohalla</th><th>Amount</th><th>Bill month as recorded</th></tr></thead><tbody>${view.unaged.map((item) => `<tr><td>${escapeHtml(item.customerName || '—')}</td><td>${escapeHtml(item.mohallaLabel)}</td><td>${formatAmount(item.amount)}</td><td>${escapeHtml(item.billMonth || '—')}</td></tr>`).join('')}</tbody></table>`;
  return `<p>Receivables ageing by bill month, as of ${escapeHtml(view.asOfMonth)}. Bill age only — not promise age (Waada) and not days past the due date. Read-only: it changes no bill, total, or Waada record. Bill outstanding only; manual baqaya is not a bill and is not included here.</p>`
    + `<table><thead><tr><th>Age bucket</th><th>Meaning</th><th>Amount</th><th>Bills</th><th>Customers</th></tr></thead><tbody>${bucketRows}</tbody>`
    + `<tfoot><tr><td colspan="2">Total outstanding (bills)</td><td>${formatAmount(view.totalOutstanding)}</td><td>${view.billCount}</td><td>${view.customerCount}</td></tr></tfoot></table>`
    // Owner 5-part fix: the seven-column mohalla totals table scrolls
    // inside its own card on a phone instead of clipping the
    // right-side columns. (The narrow bucket and per-customer tables
    // fit and keep no wrapper.)
    + `<h4>Mohalla totals</h4><div class="table-scroll"><table><thead><tr><th>Mohalla</th><th>Total</th><th>Bills</th><th>Current</th><th>1 month</th><th>2 months</th><th>3+ months</th></tr></thead><tbody>${mohallaRows}</tbody></table></div>`
    + customerSections + unagedSection;
}

/** CSV export: one row per aged bill entry, then mohalla totals. */
export function ageingCsv(view, agedEntries) {
  if (!view || !view.valid) return '';
  const lines = ['bucket,customer,mohalla,bill month,amount'];
  for (const entry of Array.isArray(agedEntries) ? agedEntries : []) {
    const bucketKey = ageingBucketForBill(str(entry.billMonth).trim(), view.asOfMonth);
    if (bucketKey === null) continue;
    lines.push([
      csvCell(view.buckets[bucketKey].label),
      csvCell(entry.customerName),
      csvCell(str(entry.mohallaLabel) || ageingMohallaLabel(entry.mohalla)),
      csvCell(str(entry.billMonth).trim()),
      csvCell(formatCsvAmount(entry.amount)),
    ].join(','));
  }
  lines.push('');
  lines.push('mohalla,total,bills,current,1 month,2 months,3+ months');
  for (const row of view.mohallaTotals) {
    lines.push([
      csvCell(row.label),
      csvCell(formatCsvAmount(row.total)),
      csvCell(row.billCount),
      csvCell(formatCsvAmount(row.byBucket.current)),
      csvCell(formatCsvAmount(row.byBucket.one)),
      csvCell(formatCsvAmount(row.byBucket.two)),
      csvCell(formatCsvAmount(row.byBucket.threePlus)),
    ].join(','));
  }
  return lines.join('\n');
}

export function ageingFilename(view) {
  return `receivables-ageing-${view && view.asOfMonth ? view.asOfMonth : 'unknown'}.csv`;
}
