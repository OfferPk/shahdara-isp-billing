// Plan 270 (Plan 203-350) — New-package uptake per mohalla.
//
// A new package is announced per mohalla, but nobody counts how many
// customers in each mohalla actually took it up, so the announcement's
// success is guessed. This module is the UPTAKE VIEW for that question:
// one view per mohalla per package, composed from caller-supplied
// package-change rows only — customers offered, customers moved, and
// the uptake count. Uptake counts per mohalla sum to the total package
// moves for that package on the same rows, and a mohalla with no uptake
// shows zero, not a blank.
//
// What this module is NOT, stated plainly:
//   - It is not the new-package announcement draft (Plan 166). That
//     draft prepares the announcement wording per mohalla, and it is
//     neither read nor written here: the caller supplies every row,
//     and this module imports nothing.
//   - It is not a package change. It applies nothing, enrols nobody,
//     and changes no package, bill, or payment record: there is no
//     record, edit, or remove function here at all. This module only
//     reads the rows it is given.
//   - It is not a score. Counts are simple totals only — how many
//     customers were offered the package, how many moved to it —
//     never a blended score, average, or percentage rating.
//   - It is not proof that a customer really wanted the package. The
//     view says what the supplied rows say; the module verifies
//     format and ordering, not truth.
//   - Viewing uptake never changes any package, bill, or payment
//     record.
//
// How the module keeps those fences:
//   - It is pure and import-free: no storage, no clock, no network.
//   - A row is mohalla + package + customer + a strict date + whether
//     the customer moved. Bad rows are dropped, never guessed at, and
//     the caller's list is never mutated.
//   - Uptake is the count of customers who moved; offered is the count
//     of customers in the rows, so offered, moved, and uptake always
//     add up exactly across mohallas.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or null. */
function strictDate(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return null;
  const limit = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  if (day > limit) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

/** True when value is a real calendar date in YYYY-MM-DD form. */
export function validPackageUptakeDate(value) {
  return strictDate(value) !== null;
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Whether the customer moved to the package: true, false, or null when
 * the value cannot be read. "moved", "yes", "true", and "1" mean moved;
 * "offered", "no", "false", "0", and a blank mean offered only.
 */
function normalizeMoved(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
    return null;
  }
  if (typeof value !== 'string') return null;
  const folded = value.trim().toLowerCase();
  if (folded === 'moved' || folded === 'yes' || folded === 'true' || folded === '1') return true;
  if (folded === 'offered' || folded === 'no' || folded === 'false' || folded === '0' || folded === '') return false;
  return null;
}

/** One uptake row, or null when half-formed. Never mutates its input. */
export function normalizePackageUptakeRow(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
  const mohalla = text(row.mohalla);
  const pkg = text(row.package);
  const customer = text(row.customer);
  const date = strictDate(row.date);
  const moved = normalizeMoved(row.moved);
  if (!mohalla || !pkg || !customer || !date || moved === null) return null;
  return { mohalla, package: pkg, customer, date, moved };
}

/** Normalised rows only; bad rows are dropped, order is kept. */
export function normalizePackageUptakeRows(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const raw of list) {
    const row = normalizePackageUptakeRow(raw);
    if (row) out.push(row);
  }
  return out;
}

/** True when from/to are real dates with from on or before to. */
function validPeriod(from, to) {
  const a = strictDate(from);
  const b = strictDate(to);
  return a !== null && b !== null && a <= b;
}

/** Rows inside the inclusive period; a bad period gives no rows. */
export function packageUptakeInPeriod(rows, from, to) {
  const list = normalizePackageUptakeRows(rows);
  if (!validPeriod(from, to)) return [];
  const a = strictDate(from);
  const b = strictDate(to);
  return list.filter((row) => row.date >= a && row.date <= b);
}

function sortAZ(a, b) {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return x < y ? -1 : x > y ? 1 : 0;
}

/**
 * One mohalla's uptake for one package in a period, or null for a bad
 * package, mohalla, or period. A mohalla with no uptake for the package
 * shows zero, not a blank. Counts always sum to that mohalla's rows.
 */
export function packageUptakeFor(rows, packageName, mohalla, from, to) {
  const pkg = text(packageName);
  const name = text(mohalla);
  if (!pkg || !name || !validPeriod(from, to)) return null;
  const a = strictDate(from);
  const b = strictDate(to);
  const scoped = normalizePackageUptakeRows(rows).filter((row) =>
    row.package.toLowerCase() === pkg.toLowerCase()
    && row.mohalla.toLowerCase() === name.toLowerCase()
    && row.date >= a && row.date <= b);
  const moved = scoped.filter((row) => row.moved).length;
  return {
    package: scoped.length ? scoped[0].package : pkg,
    mohalla: scoped.length ? scoped[0].mohalla : name,
    from: a,
    to: b,
    offered: scoped.length,
    moved,
    uptake: moved,
    hasUptake: moved > 0,
  };
}

/** One uptake per mohalla present for the package in the period, mohalla A-Z. Bad period gives []. */
export function packageUptakesByMohalla(rows, packageName, from, to) {
  const pkg = text(packageName);
  if (!pkg || !validPeriod(from, to)) return [];
  const inPeriod = packageUptakeInPeriod(rows, from, to)
    .filter((row) => row.package.toLowerCase() === pkg.toLowerCase());
  const names = new Map();
  for (const row of inPeriod) {
    const key = row.mohalla.toLowerCase();
    if (!names.has(key)) names.set(key, row.mohalla);
  }
  return [...names.values()]
    .sort(sortAZ)
    .map((name) => packageUptakeFor(rows, pkg, name, from, to));
}

/** Totals for one package in a period; per-mohalla counts sum to these. */
export function packageUptakeTotal(rows, packageName, from, to) {
  const pkg = text(packageName);
  if (!pkg || !validPeriod(from, to)) return null;
  const scoped = packageUptakeInPeriod(rows, from, to)
    .filter((row) => row.package.toLowerCase() === pkg.toLowerCase());
  const moved = scoped.filter((row) => row.moved).length;
  return {
    package: scoped.length ? scoped[0].package : pkg,
    from: strictDate(from),
    to: strictDate(to),
    offered: scoped.length,
    moved,
    uptake: moved,
  };
}

/** Unique packages in the rows, first spelling kept, A-Z. */
export function packageUptakePackages(rows) {
  const names = new Map();
  for (const row of normalizePackageUptakeRows(rows)) {
    const key = row.package.toLowerCase();
    if (!names.has(key)) names.set(key, row.package);
  }
  return [...names.values()].sort(sortAZ);
}

/** Unique mohallas in the rows, first spelling kept, A-Z. */
export function packageUptakeMohallas(rows) {
  const names = new Map();
  for (const row of normalizePackageUptakeRows(rows)) {
    const key = row.mohalla.toLowerCase();
    if (!names.has(key)) names.set(key, row.mohalla);
  }
  return [...names.values()].sort(sortAZ);
}

/** Plain-words text for one uptake; a mohalla with no uptake shows zero plainly. */
export function packageUptakeText(uptake) {
  if (!uptake) return 'Give a package, a mohalla, and a real period to see its uptake.';
  if (!uptake.hasUptake) {
    if (uptake.offered === 0) {
      return `No uptake recorded for ${uptake.mohalla} — ${uptake.package} — from ${uptake.from} to ${uptake.to}: 0 offered, 0 moved.`;
    }
    return `${uptake.mohalla} — ${uptake.package} — from ${uptake.from} to ${uptake.to}: ${uptake.offered} offered, 0 moved, uptake 0.`;
  }
  const customerWord = uptake.offered === 1 ? 'customer' : 'customers';
  return `${uptake.mohalla} — ${uptake.package} — from ${uptake.from} to ${uptake.to}: ${uptake.offered} ${customerWord} offered, ${uptake.moved} moved, uptake ${uptake.uptake}.`;
}

/** Plain-words summary for one package across mohallas for a period. */
export function packageUptakeSummaryText(rows, packageName, from, to) {
  const pkg = text(packageName);
  if (!pkg) return 'Give a package to summarise its uptake.';
  if (!validPeriod(from, to)) return 'Give a real period to summarise package uptake.';
  const uptakes = packageUptakesByMohalla(rows, pkg, from, to);
  const total = packageUptakeTotal(rows, pkg, from, to);
  if (!total || total.offered === 0) {
    return `No uptake recorded for ${pkg} from ${strictDate(from)} to ${strictDate(to)}.`;
  }
  const mohallaWord = uptakes.length === 1 ? 'mohalla' : 'mohallas';
  return `${uptakes.length} ${mohallaWord}, ${total.offered} offered, ${total.moved} moved, uptake ${total.uptake} for ${total.package} in the period.`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Escaped HTML for one uptake. */
export function packageUptakeHtml(uptake) {
  if (!uptake) return '<p>Give a package, a mohalla, and a real period to see its uptake.</p>';
  if (!uptake.hasUptake) {
    return `<p>No uptake recorded for ${escapeHtml(uptake.mohalla)} — ${escapeHtml(uptake.package)} — from ${escapeHtml(uptake.from)} to ${escapeHtml(uptake.to)}: ${uptake.offered} offered, 0 moved, uptake 0.</p>`;
  }
  return `<div><p><strong>${escapeHtml(uptake.mohalla)}</strong> — ${escapeHtml(uptake.package)} — ${escapeHtml(uptake.from)} to ${escapeHtml(uptake.to)}</p>`
    + `<p>${uptake.offered} offered, ${uptake.moved} moved, uptake ${uptake.uptake}</p></div>`;
}

/** Escaped HTML for a list of uptakes. */
export function packageUptakesHtml(uptakes) {
  if (!Array.isArray(uptakes) || !uptakes.length) return '<p>No package uptake to show for this period.</p>';
  return uptakes.map((uptake) => packageUptakeHtml(uptake)).join('');
}

function csvCell(value) {
  const cell = String(value ?? '');
  return /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

/** CSV for a list of uptakes, one row per mohalla. */
export function packageUptakeCsv(uptakes) {
  const lines = ['package,mohalla,from,to,offered,moved,uptake'];
  for (const uptake of Array.isArray(uptakes) ? uptakes : []) {
    lines.push([
      uptake.package, uptake.mohalla, uptake.from, uptake.to,
      uptake.offered, uptake.moved, uptake.uptake,
    ].map(csvCell).join(','));
  }
  return `${lines.join('\n')}\n`;
}

export function packageUptakeFilename() {
  return 'package-uptakes.csv';
}
