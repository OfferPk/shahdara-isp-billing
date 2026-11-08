// Profile polish #9 — Customer installation dashboard: every
// customer and the installation fee they paid, fetched from the
// records, never hardcoded.
//
// The data source is the connection fee recorded on each customer
// record — the fee actually collected at installation, written
// onto the customer when the installation is completed and when
// a new customer is created. This module reads that recorded fee
// only: it adds no store, no new field, and no new record, and it
// never changes any installation, bill, payment, or customer
// record by itself.
//
// Totals: total customers, total fee collection in PKR, and how
// many customers have a fee recorded. The pie chart groups
// customers by the distinct fee amount they paid — each slice is
// that group's share of the customers with a recorded fee, and
// the whole-percent shares always add to 100 (largest-remainder
// rounding). A customer with no fee recorded is shown as "no fee
// recorded" and counted separately: never guessed as zero-paid,
// unless the record itself says the fee was zero, in which case
// the zero is a real recorded fee and groups with the other
// zero-fee customers. The chart is a plain CSS conic gradient —
// this app is offline with no chart library, so nothing is
// fetched and nothing is drawn by script.
//
// Money is always PKR (Rs) only, never converted. The module is
// pure and import-free: the caller supplies every customer, and
// the module never reads storage, the clock, or the network, and
// never mutates an input.

/** Pie slice colours, cycled in fee order when there are more fee groups than colours. */
export const INSTALLATION_FEE_PIE_COLORS = Object.freeze([
  '#16a34a',
  '#2563eb',
  '#d97706',
  '#dc2626',
  '#7c3aed',
  '#0d9488',
  '#db2777',
  '#64748b'
]);

function cleanText(value) {
  return String(value ?? '').trim();
}

function cleanKey(value) {
  return cleanText(value).toLowerCase();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Round money to two decimals, the way the rest of the app stores it. */
function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

/** PKR only, never converted: "Rs 20,000", decimals only when the amount has them. */
function formatRupees(value) {
  const amount = roundMoney(Number(value) || 0);
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  const whole = Math.floor(abs);
  const fraction = Math.round((abs - whole) * 100);
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction ? `Rs ${sign}${grouped}.${String(fraction).padStart(2, '0')}` : `Rs ${sign}${grouped}`;
}

/**
 * The recorded installation fee for one customer record: a finite
 * number of 0 or more, rounded to two decimals, or null when the
 * record carries no fee. A fee of exactly zero is a real recorded
 * fee, not a missing one; a negative or non-numeric fee is not a
 * recorded fee and reads as missing rather than guessed.
 */
function recordedFee(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return roundMoney(n);
}

/**
 * One dashboard row per customer record: the customer id, the
 * display name, and the recorded fee (a number, or null when no
 * fee is recorded). Entries that are not objects, or that carry
 * no usable name, are left out rather than listed nameless.
 * Inputs are never mutated.
 */
function normalizeInstallationFeeRow(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const name = cleanText(entry.name);
  if (!name) return null;
  return {
    id: cleanText(entry.id),
    name,
    fee: recordedFee(entry.connectionFee)
  };
}

export function normalizeInstallationFeeList(customers) {
  if (!Array.isArray(customers)) return [];
  const out = [];
  for (const entry of customers) {
    const row = normalizeInstallationFeeRow(entry);
    if (row) out.push(row);
  }
  return out;
}

/**
 * Rows in dashboard order: customers with a recorded fee first,
 * biggest fee first, then name order; customers with no fee
 * recorded last, in name order.
 */
export function installationFeeRows(customers) {
  const rows = normalizeInstallationFeeList(customers);
  rows.sort((a, b) => {
    const aHas = a.fee !== null && a.fee !== undefined;
    const bHas = b.fee !== null && b.fee !== undefined;
    if (aHas !== bHas) return aHas ? -1 : 1;
    if (aHas && bHas && a.fee !== b.fee) return b.fee - a.fee;
    const nameA = cleanKey(a.name);
    const nameB = cleanKey(b.name);
    if (nameA !== nameB) return nameA < nameB ? -1 : 1;
    return cleanKey(a.id) < cleanKey(b.id) ? -1 : 1;
  });
  return rows;
}

/**
 * Whole-percent shares that always add to 100 (largest-remainder
 * rounding, ties broken by group order). All zeros when nothing
 * is counted.
 */
function reconciledShares(counts, total) {
  if (total <= 0) return counts.map(() => 0);
  const exact = counts.map((count) => (count * 100) / total);
  const shares = exact.map((share) => Math.floor(share));
  let remainder = 100 - shares.reduce((sum, share) => sum + share, 0);
  const order = exact
    .map((share, index) => ({ index, frac: share - Math.floor(share) }))
    .sort((a, b) => b.frac - a.frac || a.index - b.index);
  for (let k = 0; k < remainder; k += 1) {
    shares[order[k % order.length].index] += 1;
  }
  return shares;
}

/** Totals across every row: customers, fees collected, and how many rows carry a fee. */
export function installationFeeTotals(rows) {
  const base = Array.isArray(rows) ? rows : [];
  let withFee = 0;
  let totalFees = 0;
  for (const row of base) {
    if (row && row.fee !== null && row.fee !== undefined) {
      withFee += 1;
      totalFees = roundMoney(totalFees + Number(row.fee));
    }
  }
  return {
    totalCustomers: base.length,
    withFee,
    withoutFee: base.length - withFee,
    totalFees
  };
}

/**
 * Fee groups: one group per distinct recorded fee amount, biggest
 * fee first, each with its customer count and its whole-percent
 * share of the customers with a recorded fee. Shares add to 100.
 * Customers with no fee recorded are never a group.
 */
export function installationFeeGroups(rows) {
  const base = Array.isArray(rows) ? rows : [];
  const byFee = new Map();
  for (const row of base) {
    if (!row || row.fee === null || row.fee === undefined) continue;
    const key = Number(row.fee);
    byFee.set(key, (byFee.get(key) || 0) + 1);
  }
  const fees = [...byFee.keys()].sort((a, b) => b - a);
  const counts = fees.map((fee) => byFee.get(fee));
  const withFee = counts.reduce((sum, count) => sum + count, 0);
  const shares = reconciledShares(counts, withFee);
  return fees.map((fee, index) => ({
    fee,
    count: counts[index],
    share: shares[index]
  }));
}

/** Pie slices in fee order, each with its label, colour, count, and reconciled share. */
export function installationFeePie(rows) {
  return installationFeeGroups(rows).map((group, index) => ({
    fee: group.fee,
    label: formatRupees(group.fee),
    color: INSTALLATION_FEE_PIE_COLORS[index % INSTALLATION_FEE_PIE_COLORS.length],
    count: group.count,
    share: group.share
  }));
}

/** Plain-words summary of the dashboard totals. */
export function installationFeeSummaryText(totals) {
  const base = totals && typeof totals === 'object' ? totals : installationFeeTotals([]);
  if (!base.totalCustomers) return 'No customers recorded yet.';
  const customerWord = base.totalCustomers === 1 ? 'customer' : 'customers';
  const feeWord = base.withFee === 1 ? 'customer' : 'customers';
  let text = `${base.totalCustomers} ${customerWord}, ${formatRupees(base.totalFees)} collected in installation fees. `
    + `${base.withFee} ${feeWord} with a fee recorded`;
  if (base.withoutFee) {
    text += `, ${base.withoutFee} with no fee recorded`;
  }
  return `${text}.`;
}

/** Plain-words line for one customer's row. */
export function installationFeeRowText(row) {
  if (!row || typeof row !== 'object') return '';
  const name = cleanText(row.name) || 'Customer';
  if (row.fee === null || row.fee === undefined) return `${name} — no fee recorded.`;
  return `${name} — ${formatRupees(row.fee)}.`;
}

function installationFeePieHtml(slices, withFee) {
  if (!withFee) return '<p>No installation fees recorded yet — the pie chart appears once a fee is recorded.</p>';
  let at = 0;
  const stops = slices.map((slice) => {
    const from = at;
    at += slice.share;
    return `${slice.color} ${from}% ${at}%`;
  }).join(', ');
  const legend = slices.map((slice) => `<li><span style="display:inline-block;width:12px;height:12px;background:${slice.color};border-radius:2px;"></span> ${escapeHtml(slice.label)} — ${slice.count} (${slice.share}%)</li>`).join('');
  return `<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;"><div role="img" aria-label="Installation fee pie chart: ${escapeHtml(slices.map((slice) => `${slice.label} ${slice.share}%`).join(', '))}" style="width:140px;height:140px;border-radius:50%;background:conic-gradient(${stops});flex:none;"></div><ul style="list-style:none;margin:0;padding:0;font-size:13px;line-height:1.9;">${legend}</ul></div>`;
}

/**
 * The dashboard: totals, pie chart, and the per-customer list.
 * The pie always covers every customer with a recorded fee;
 * the list shows every customer, fee recorded or not.
 * The optional third argument adds the join-month breakdown
 * (installationFeeMonthlyHtml); without it the dashboard renders
 * exactly as before.
 */
export function installationFeeHtml(totals, rows, monthly) {
  const base = totals && typeof totals === 'object' ? totals : installationFeeTotals([]);
  const list = Array.isArray(rows) ? rows : [];
  const slices = installationFeePie(list);
  const rowsHtml = list.length
    ? `<ul style="list-style:none;margin:8px 0 0;padding:0;">${list.map((row) => {
      const fee = row.fee === null || row.fee === undefined
        ? '<span style="color:#b91c1c;font-weight:700;">no fee recorded</span>'
        : `<strong>${escapeHtml(formatRupees(row.fee))}</strong>`;
      return `<li style="padding:6px 0;border-top:1px solid #e2e8f0;"><strong>${escapeHtml(row.name)}</strong> — ${fee}</li>`;
    }).join('')}</ul>`
    : '<p>No customers match this list.</p>';
  return `<p>${escapeHtml(installationFeeSummaryText(base))}</p>`
    + `<h4>Installation fee pie chart</h4>${installationFeePieHtml(slices, base.withFee || 0)}`
    + `<h4>Customers by installation fee</h4>${rowsHtml}`
    + installationFeeMonthlyHtml(monthly);
}

/**
 * The join-month breakdown: one row per month customers joined,
 * newest first — the month label, how many customers joined, and
 * the installation fees recorded for them. These are JOIN months,
 * never payment months: the fee total is the recorded fees of the
 * customers who joined that month, and customers with no join date
 * are never forced into a month (they are counted in the undated
 * note instead). The caller supplies the month rows (labels already
 * formatted), the translated heading, and the translated undated
 * note; `monthly` is optional — without rows there is no section.
 * This function records nothing and invents no payment date.
 */
export function installationFeeMonthlyHtml(monthly) {
  if (!monthly || !Array.isArray(monthly.rows) || !monthly.rows.length) return '';
  const heading = cleanText(monthly.heading) || 'Installation fees by join month';
  const rowsHtml = monthly.rows.map((entry) => {
    const label = cleanText(entry?.label) || cleanText(entry?.month) || '';
    const count = Number(entry?.count) || 0;
    const fees = roundMoney(Number(entry?.totalFees) || 0);
    return `<li style="padding:6px 0;border-top:1px solid #e2e8f0;"><strong>${escapeHtml(label)}</strong> — ${count} customers · <strong>${escapeHtml(formatRupees(fees))}</strong></li>`;
  }).join('');
  const undated = monthly.undatedCount
    ? `<p>${escapeHtml(monthly.undatedNote || '')}</p>` : '';
  return `<h4>${escapeHtml(heading)}</h4><ul style="list-style:none;margin:8px 0 0;padding:0;">${rowsHtml}</ul>${undated}`;
}

export function installationFeeCsv(rows) {
  const header = ['customer_id', 'name', 'installation_fee_pkr', 'fee_recorded'];
  const lines = [header.join(',')];
  for (const row of Array.isArray(rows) ? rows : []) {
    lines.push([
      row.id,
      row.name,
      row.fee === null || row.fee === undefined ? '' : String(row.fee),
      row.fee === null || row.fee === undefined ? 'no' : 'yes'
    ].map(csvCell).join(','));
  }
  return lines.join('\n');
}

export function installationFeeFilename() {
  return 'installation-dashboard.csv';
}
