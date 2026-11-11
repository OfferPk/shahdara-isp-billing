// Plan 93 (Plan 1-100) — Outage goodwill credit record: one written
// rule per resolved outage, so a long outage is owned honestly —
// same threshold, same formula, same credit for every affected
// household — instead of a silent "sorry" for some and nothing
// for others.
//
// This module is the RECORD only, and nothing else:
//
//   - It is pure and import-free: the caller supplies every outage
//     credit record and every customer, and the module never reads
//     storage, the clock, or the network, and never mutates an
//     input. It holds no bill, payment, or concession-amount field
//     of its own; the only concession trace it keeps is a reference
//     string the operator records AFTER applying the credit through
//     the existing concession path. Applying or viewing a credit
//     here never rewrites a past bill — the credit lands only on
//     the next bill, through that existing path.
//   - One record per resolved outage (Plan 22): an id, the outage
//     id and label, the operator-set qualifying threshold in hours,
//     the downtime in hours, the affected mohallas, and the month
//     the formula is measured against. The formula is stated in
//     plain words on the record itself: downtime hours divided by
//     the hours in the month, multiplied by the customer's monthly
//     package price, capped at that monthly price. The month's
//     hours come from the calendar month when one is recorded
//     (days in month x 24); with no usable month the standard
//     720-hour month is used and the formula text says so.
//   - Qualification: a record qualifies only when the downtime
//     meets the threshold — exactly at the threshold qualifies,
//     below it no customer receives a credit. A customer outside
//     the affected mohallas never receives a credit: such a
//     customer is listed under `excluded` with the reason stated,
//     never silently dropped and never credited.
//   - Planned maintenance windows (Plan 48) are excluded: a record
//     naming a maintenance window without an operator-recorded
//     reason to include it is refused outright. With a reason, the
//     reason stays visible on the record.
//   - Half-formed records are refused outright, never stored
//     half-formed: no id, no outage id, no affected mohalla, a
//     non-positive downtime or threshold, or a customer row with
//     no usable monthly price (such a row is excluded with its
//     reason, never zero-filled). A month that is not a real
//     YYYY-MM month is dropped to empty, and the 720-hour fallback
//     applies — never a guessed month.
//   - Amounts are integer cents. A field named *Cents is used
//     as-is; a plain monthly price in rupees converts once (x100,
//     rounded), so a stored record re-read through the normaliser
//     never inflates a hundredfold.
//   - Mohalla matching mirrors the Plan T canonical rule: a
//     leading generic "Mohalla" word is stripped, comparison is
//     case-insensitive, and known spellings collapse (bani ->
//     BANII, kishti -> KISHTII, chamyaa -> CHAMYAAA).
//
// Fence, checked first: the SISP-30 outage-linked concession
// calculator computes a suggested concession from logged
// downtime in the complaint register. It is neither read nor
// written here — this plan adds only the
// per-outage credit record with its threshold, formula, and
// affected customers, and leaves the applying itself to the
// existing concession path. Plan 22 outages and Plan 48 windows
// are linked by id only, never read or rewritten.

const DATE_MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

const MOHALLA_ALIASES = Object.freeze({
  bani: 'BANII',
  kishti: 'KISHTII',
  chamyaa: 'CHAMYAAA',
  // Owner-confirmed 2026-11-11: JABBIYAAA is the same mohalla as
  // JABBIYAA. Charyaa is NOT an alias — it is its own mohalla.
  jabbiyaaa: 'JABBIYAA',
});

export const OUTAGE_CREDIT_STATUSES = Object.freeze(['planned', 'applied']);

export const OUTAGE_CREDIT_STATUS_LABELS = Object.freeze({
  planned: 'Planned',
  applied: 'Applied via concession path',
});

/** Hours in the standard month used when no usable month is recorded. */
export const OUTAGE_CREDIT_STANDARD_MONTH_HOURS = 720;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
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

function positiveNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function centsFrom(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

function rupeesToCents(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

export function canonicalCreditMohalla(raw) {
  const cleaned = text(raw).replace(/^mohalla\s+/i, '').trim().toLowerCase();
  if (!cleaned) return null;
  const key = MOHALLA_ALIASES[cleaned] ? MOHALLA_ALIASES[cleaned].toLowerCase() : cleaned;
  return { key, label: text(raw) };
}

export function isValidCreditMonth(value) {
  return DATE_MONTH_PATTERN.test(text(value));
}

function daysInMonth(month) {
  const match = DATE_MONTH_PATTERN.exec(text(month));
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]);
  return new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
}

export function monthHoursFor(month) {
  const days = daysInMonth(month);
  return days === null ? OUTAGE_CREDIT_STANDARD_MONTH_HOURS : days * 24;
}

/** Pro-rata credit in integer cents, capped at the monthly price. */
export function creditForPrice(monthlyPriceCents, downtimeHours, monthHours) {
  const price = centsFrom(monthlyPriceCents);
  const hours = positiveNumber(downtimeHours);
  const total = positiveNumber(monthHours);
  if (price === null || hours === null || total === null) return null;
  return Math.min(price, Math.round((price * hours) / total));
}

export function outageCreditFormulaText(record) {
  const month = isValidCreditMonth(record?.month) ? record.month : null;
  const hours = month === null
    ? `${OUTAGE_CREDIT_STANDARD_MONTH_HOURS} hours (standard month)`
    : `${monthHoursFor(month)} hours (${month})`;
  return `Downtime hours ÷ ${hours} × monthly package price, capped at the monthly price.`;
}

function normalizeCustomerRow(raw, affectedKeys, monthHours, downtimeHours) {
  if (!raw || typeof raw !== 'object') return null;
  const customerId = text(raw.customerId ?? raw.id);
  if (!customerId) return null;
  const mohalla = text(raw.mohalla ?? raw.area);
  const canon = canonicalCreditMohalla(mohalla);
  const monthlyPriceCents = Number.isFinite(Number(raw.monthlyPriceCents)) && Number(raw.monthlyPriceCents) > 0
    ? Math.round(Number(raw.monthlyPriceCents))
    : rupeesToCents(raw.monthlyPrice ?? raw.monthlySellingAmount);
  const base = {
    customerId,
    customerName: text(raw.customerName ?? raw.name),
    mohalla,
    monthlyPriceCents,
  };
  if (monthlyPriceCents === null) {
    return { ...base, excluded: true, reason: 'no usable monthly price' };
  }
  if (!canon || !affectedKeys.has(canon.key)) {
    return { ...base, excluded: true, reason: 'outside affected mohallas' };
  }
  const creditCents = creditForPrice(monthlyPriceCents, downtimeHours, monthHours);
  if (creditCents === null) return { ...base, excluded: true, reason: 'credit could not be computed' };
  return {
    ...base,
    excluded: false,
    creditCents,
    status: 'planned',
    concessionRef: null,
  };
}

// One normalised outage credit record, or null when it cannot be a
// record: half-formed input, a maintenance window named without a
// reason to include it, or no affected mohalla. The returned
// object is fresh; the input is never mutated.
export function normalizeOutageCredit(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const outageId = text(raw.outageId);
  if (!id || !outageId) return null;
  const downtimeHours = positiveNumber(raw.downtimeHours);
  const thresholdHours = positiveNumber(raw.thresholdHours);
  if (downtimeHours === null || thresholdHours === null) return null;
  const affectedMohallas = (Array.isArray(raw.affectedMohallas) ? raw.affectedMohallas : [])
    .map((m) => text(m)).filter(Boolean);
  if (affectedMohallas.length === 0) return null;
  const maintenanceWindowId = text(raw.maintenanceWindowId);
  const maintenanceIncludeReason = text(raw.maintenanceIncludeReason);
  if (maintenanceWindowId && !maintenanceIncludeReason) return null;
  const month = isValidCreditMonth(raw.month) ? text(raw.month) : '';
  const monthHours = monthHoursFor(month);
  const qualifies = downtimeHours >= thresholdHours;
  const affectedKeys = new Set(
    affectedMohallas.map((m) => canonicalCreditMohalla(m)).filter(Boolean).map((c) => c.key),
  );
  const credits = [];
  const excluded = [];
  // A stored record re-read through the normaliser keeps its credit
  // rows exactly — including an applied status and its concession
  // reference — instead of being rebuilt from a `customers` array
  // it no longer carries. Only a fresh build (with `customers`)
  // computes rows from scratch.
  if (Array.isArray(raw.credits) || Array.isArray(raw.excluded)) {
    for (const row of Array.isArray(raw.credits) ? raw.credits : []) {
      if (!row || typeof row !== 'object') continue;
      const customerId = text(row.customerId);
      const monthlyPriceCents = centsFrom(row.monthlyPriceCents);
      const creditCents = centsFrom(row.creditCents);
      if (!customerId || monthlyPriceCents === null || creditCents === null) continue;
      const status = OUTAGE_CREDIT_STATUSES.includes(text(row.status)) ? text(row.status) : 'planned';
      if (!qualifies) {
        excluded.push({
          customerId,
          customerName: text(row.customerName),
          mohalla: text(row.mohalla),
          reason: 'downtime below qualifying threshold',
        });
      } else {
        credits.push({
          customerId,
          customerName: text(row.customerName),
          mohalla: text(row.mohalla),
          monthlyPriceCents,
          excluded: false,
          creditCents,
          status,
          concessionRef: status === 'applied' ? text(row.concessionRef) || null : null,
        });
      }
    }
    for (const row of Array.isArray(raw.excluded) ? raw.excluded : []) {
      if (!row || typeof row !== 'object') continue;
      const customerId = text(row.customerId);
      if (!customerId) continue;
      excluded.push({
        customerId,
        customerName: text(row.customerName),
        mohalla: text(row.mohalla),
        reason: text(row.reason) || 'excluded',
      });
    }
  } else {
    for (const rawCustomer of Array.isArray(raw.customers) ? raw.customers : []) {
      const row = normalizeCustomerRow(rawCustomer, affectedKeys, monthHours, downtimeHours);
      if (!row) continue;
      if (row.excluded || !qualifies) {
        excluded.push({
          customerId: row.customerId,
          customerName: row.customerName,
          mohalla: row.mohalla,
          reason: row.excluded ? row.reason : 'downtime below qualifying threshold',
        });
      } else {
        credits.push(row);
      }
    }
  }
  const record = {
    id,
    outageId,
    outageLabel: text(raw.outageLabel),
    month,
    downtimeHours,
    thresholdHours,
    affectedMohallas,
    maintenanceWindowId: maintenanceWindowId || null,
    maintenanceIncludeReason: maintenanceWindowId ? maintenanceIncludeReason : null,
    qualifies,
    credits,
    excluded,
  };
  record.formulaText = outageCreditFormulaText(record);
  return record;
}

export function normalizeOutageCreditList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const entry of list) {
    const record = normalizeOutageCredit(entry);
    if (record) out.push(record);
  }
  return out;
}

export function upsertOutageCredit(list, record) {
  const clean = normalizeOutageCreditList(list);
  const next = normalizeOutageCredit(record);
  if (!next) return clean;
  const index = clean.findIndex((entry) => entry.id === next.id);
  if (index === -1) return [...clean, next];
  return clean.map((entry, i) => (i === index ? next : entry));
}

export function removeOutageCredit(list, id) {
  const clean = normalizeOutageCreditList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((entry) => entry.id !== wanted);
}

export function findOutageCredit(list, id) {
  const wanted = text(id);
  if (!wanted) return null;
  return normalizeOutageCreditList(list).find((entry) => entry.id === wanted) ?? null;
}

// Mark one customer's credit applied through the existing
// concession path. Only the reference string is recorded here —
// the bill itself is never touched. A blank reference, an unknown
// record, or an already-applied row leaves everything unchanged.
export function markCreditApplied(list, creditId, customerId, concessionRef) {
  const clean = normalizeOutageCreditList(list);
  const ref = text(concessionRef);
  if (!ref) return clean;
  const wantedCredit = text(creditId);
  const wantedCustomer = text(customerId);
  if (!wantedCredit || !wantedCustomer) return clean;
  return clean.map((entry) => {
    if (entry.id !== wantedCredit) return entry;
    return {
      ...entry,
      credits: entry.credits.map((row) => (
        row.customerId === wantedCustomer && row.status === 'planned'
          ? { ...row, status: 'applied', concessionRef: ref }
          : row
      )),
    };
  });
}

export function reopenCredit(list, creditId, customerId) {
  const clean = normalizeOutageCreditList(list);
  const wantedCredit = text(creditId);
  const wantedCustomer = text(customerId);
  if (!wantedCredit || !wantedCustomer) return clean;
  return clean.map((entry) => {
    if (entry.id !== wantedCredit) return entry;
    return {
      ...entry,
      credits: entry.credits.map((row) => (
        row.customerId === wantedCustomer && row.status === 'applied'
          ? { ...row, status: 'planned', concessionRef: null }
          : row
      )),
    };
  });
}

export function filterOutageCredits(list, filters = {}) {
  const clean = normalizeOutageCreditList(list);
  const outageId = text(filters.outageId);
  const mohalla = canonicalCreditMohalla(filters.mohalla);
  return clean.filter((entry) => {
    if (outageId && entry.outageId !== outageId) return false;
    if (mohalla) {
      const affected = entry.affectedMohallas.some((m) => {
        const canon = canonicalCreditMohalla(m);
        return canon && canon.key === mohalla.key;
      });
      const credited = entry.credits.some((row) => {
        const canon = canonicalCreditMohalla(row.mohalla);
        return canon && canon.key === mohalla.key;
      });
      if (!affected && !credited) return false;
    }
    return true;
  });
}

export function buildOutageCreditSummary(list) {
  const clean = normalizeOutageCreditList(list);
  let creditedCustomers = 0;
  let appliedCustomers = 0;
  let totalCreditCents = 0;
  let excludedCustomers = 0;
  for (const entry of clean) {
    creditedCustomers += entry.credits.length;
    appliedCustomers += entry.credits.filter((row) => row.status === 'applied').length;
    totalCreditCents += entry.credits.reduce((sum, row) => sum + row.creditCents, 0);
    excludedCustomers += entry.excluded.length;
  }
  return {
    records: clean.length,
    qualifyingRecords: clean.filter((entry) => entry.qualifies).length,
    creditedCustomers,
    appliedCustomers,
    plannedCustomers: creditedCustomers - appliedCustomers,
    excludedCustomers,
    totalCreditCents,
  };
}

export function outageCreditSummaryText(summary) {
  return `${summary.records} credit record${summary.records === 1 ? '' : 's'} · `
    + `${summary.creditedCustomers} customer${summary.creditedCustomers === 1 ? '' : 's'} credited · `
    + `${summary.appliedCustomers} applied · `
    + `${summary.excludedCustomers} excluded · `
    + `total Rs. ${(summary.totalCreditCents / 100).toFixed(2)}`;
}

function moneyCents(cents) {
  return `Rs. ${(cents / 100).toFixed(2)}`;
}

export function outageCreditHtml(list) {
  const clean = normalizeOutageCreditList(list);
  if (clean.length === 0) return '<p>No outage credit records yet.</p>';
  const rows = clean.map((entry) => {
    const creditRows = entry.credits.map((row) => (
      `<tr><td>${escapeHtml(row.customerName || row.customerId)}</td>`
      + `<td>${escapeHtml(row.mohalla || 'not recorded')}</td>`
      + `<td>${moneyCents(row.monthlyPriceCents)}</td>`
      + `<td>${moneyCents(row.creditCents)}</td>`
      + `<td>${OUTAGE_CREDIT_STATUS_LABELS[row.status]}</td>`
      + `<td>${escapeHtml(row.concessionRef || '—')}</td></tr>`
    )).join('');
    const excludedRows = entry.excluded.map((row) => (
      `<tr><td>${escapeHtml(row.customerName || row.customerId)}</td>`
      + `<td>${escapeHtml(row.mohalla || 'not recorded')}</td>`
      + `<td colspan="4">No credit — ${escapeHtml(row.reason)}</td></tr>`
    )).join('');
    return `<h4>${escapeHtml(entry.id)} — outage ${escapeHtml(entry.outageId)}`
      + `${entry.outageLabel ? ` (${escapeHtml(entry.outageLabel)})` : ''}</h4>`
      + `<p>${escapeHtml(entry.formulaText)} · Downtime ${entry.downtimeHours}h, threshold ${entry.thresholdHours}h`
      + ` · ${entry.qualifies ? 'Qualifies' : 'Does not qualify — downtime below threshold'}`
      + ` · Mohallas: ${escapeHtml(entry.affectedMohallas.join(', '))}`
      + `${entry.maintenanceWindowId ? ` · Maintenance window ${escapeHtml(entry.maintenanceWindowId)} included: ${escapeHtml(entry.maintenanceIncludeReason)}` : ''}</p>`
      + '<table><thead><tr><th>Customer</th><th>Mohalla</th><th>Monthly price</th><th>Credit</th><th>Status</th><th>Concession ref</th></tr></thead>'
      + `<tbody>${creditRows || '<tr><td colspan="6">No customers credited.</td></tr>'}${excludedRows}</tbody></table>`;
  }).join('');
  return rows;
}

export function outageCreditCsv(list) {
  const clean = normalizeOutageCreditList(list);
  const lines = ['credit_id,outage_id,month,downtime_hours,threshold_hours,qualifies,customer_id,customer_name,mohalla,monthly_price_cents,credit_cents,status,concession_ref,excluded_reason'];
  for (const entry of clean) {
    for (const row of entry.credits) {
      lines.push([entry.id, entry.outageId, entry.month, entry.downtimeHours, entry.thresholdHours, 'yes',
        row.customerId, row.customerName, row.mohalla, row.monthlyPriceCents, row.creditCents, row.status, row.concessionRef ?? '',
        ''].map(csvCell).join(','));
    }
    for (const row of entry.excluded) {
      lines.push([entry.id, entry.outageId, entry.month, entry.downtimeHours, entry.thresholdHours,
        entry.qualifies ? 'yes' : 'no', row.customerId, row.customerName, row.mohalla, '', '', '', '', row.reason].map(csvCell).join(','));
    }
    if (entry.credits.length === 0 && entry.excluded.length === 0) {
      lines.push([entry.id, entry.outageId, entry.month, entry.downtimeHours, entry.thresholdHours,
        entry.qualifies ? 'yes' : 'no', '', '', '', '', '', '', '', ''].map(csvCell).join(','));
    }
  }
  return lines.join('\n');
}

export function outageCreditFilename(today) {
  const stamp = /^\d{4}-\d{2}-\d{2}$/.test(text(today)) ? text(today) : 'outage-credits';
  return `outage-credits-${stamp}.csv`;
}
