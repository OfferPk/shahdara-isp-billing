// Plan 18 (Plan 1-100) — First-bill preview for a new customer.
//
// A new customer is quoted a monthly price, but the first bill —
// installation fee, first-period charge, deposit — arrives as a
// surprise, and disputes start on day one. This module shows that
// first bill BEFORE activation, so the figure can be agreed before
// the cable is laid.
//
// Scope fence, stated plainly: this is a PREVIEW ONLY. It creates no
// bill, raises no bill, and changes no calculation: the billing
// engine, the bill presentation (Plan P) and every stored record are
// untouched. The preview is composed from the package price and fee
// settings the operator already uses on the customer record
// (monthlySellingAmount, connectionFee, securityDeposit), never from
// a second price source, so its line items match those settings on
// the same fixture.
//
// How the fence is kept in this module:
//   - It is import-free (like onboarding-checklist.js and
//     connection-register.js): the caller supplies every input, and
//     the module never reads storage, the clock, or the network, and
//     never mutates an input. A start date is always caller-supplied,
//     never invented.
//   - Money follows the installation-cost.js rule: blank, non-numeric
//     or negative inputs become null (not recorded), never 0, never
//     an error. A missing monthly price or a bad start date makes the
//     preview INCOMPLETE (total null, reasons listed) instead of a
//     guessed total. A missing installation fee or deposit is the one
//     exception: those charges are optional, so an unrecorded one is
//     counted as 0 in the total AND listed in `assumptions`, so the
//     operator sees exactly what was assumed.
//   - First-period charge, by start date (mode 'auto'): a start on the
//     1st of the month is a full month; any later start is pro-rata
//     by calendar days, inclusive of the start date
//     (chargedDays = daysInMonth - dayOfMonth + 1), rounded to two
//     decimals. An explicit mode 'full' always charges the whole
//     month; 'prorata' always pro-rates (a 1st start then charges
//     the whole month anyway, by the same formula). Changing the
//     start date therefore updates the pro-rata figure, and nothing
//     else in the preview moves with it.
//   - A free connection (isFreeConnection) waives the installation
//     fee: the line reads 0 with a waived note, and the fee setting
//     is never rewritten.
//   - Whether a preview was shown is tracked in its own caller-owned
//     list (recordFirstBillPreviewShown / findFirstBillPreviewShown),
//     exactly like Plan 16's checklist ticks: marking a preview shown
//     writes no bill, no payment and no lifecycle field. The caller
//     decides where that list lives (the app keeps it in its own
//     localStorage store, apart from billing records).

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
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

function moneyOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return Math.round(number * 100) / 100;
}

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

function daysInMonthOf(year, month) {
  // month is 1-based; day 0 of the next month is the last day of this one.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>\"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

// The first-period mode the caller asked for, resolved to a real mode.
// Anything unknown falls back to 'auto', never to a silent 'full'.
export function normalizeFirstPeriodMode(value) {
  const mode = text(value).toLowerCase();
  return mode === 'full' || mode === 'prorata' ? mode : 'auto';
}

export function buildFirstBillPreview(input = {}) {
  const source = input ?? {};
  const customerName = text(source.customerName ?? source.name);
  const monthlyAmount = moneyOrNull(source.monthlyAmount ?? source.monthlySellingAmount);
  const recordedFee = moneyOrNull(source.connectionFee ?? source.installationFee);
  const recordedDeposit = moneyOrNull(source.securityDeposit ?? source.deposit);
  const isFreeConnection = source.isFreeConnection === true;
  const startDate = validDate(source.startDate ?? source.connectionDate);
  const requestedMode = normalizeFirstPeriodMode(source.firstPeriodMode);

  const reasons = [];
  if (monthlyAmount === null) reasons.push('monthly-price-missing');
  if (startDate === null) reasons.push('start-date-invalid');

  // Installation fee: waived on a free connection, otherwise the
  // recorded fee, otherwise 0 with an assumption the operator sees.
  const assumptions = [];
  let installationFee;
  let installationFeeWaived = false;
  let installationFeeNote = '';
  if (isFreeConnection) {
    installationFee = 0;
    installationFeeWaived = true;
    installationFeeNote = 'Waived — free connection';
  } else if (recordedFee !== null) {
    installationFee = recordedFee;
  } else {
    installationFee = 0;
    assumptions.push('Installation fee not recorded — counted as Rs 0');
    installationFeeNote = 'Not recorded — counted as Rs 0';
  }

  // Deposit: optional, so an unrecorded deposit is 0, noted as such
  // only when it was actually absent (a recorded 0 needs no note).
  let deposit = 0;
  let depositNote = '';
  if (recordedDeposit !== null) {
    deposit = recordedDeposit;
  } else {
    depositNote = 'No deposit recorded — counted as Rs 0';
  }

  // First-period charge.
  let resolvedMode = requestedMode;
  let chargedDays = null;
  let daysInMonth = null;
  let firstPeriodCharge = null;
  let firstPeriodNote = '';
  if (monthlyAmount !== null && startDate !== null) {
    const year = Number(startDate.slice(0, 4));
    const month = Number(startDate.slice(5, 7));
    const day = Number(startDate.slice(8, 10));
    daysInMonth = daysInMonthOf(year, month);
    if (resolvedMode === 'auto') resolvedMode = day === 1 ? 'full' : 'prorata';
    chargedDays = resolvedMode === 'full' ? daysInMonth : daysInMonth - day + 1;
    firstPeriodCharge = roundMoney((monthlyAmount * chargedDays) / daysInMonth);
    firstPeriodNote = resolvedMode === 'full'
      ? 'Full month'
      : `${chargedDays} of ${daysInMonth} days (from ${startDate})`;
  }

  const ready = reasons.length === 0;
  const totalDue = ready
    ? roundMoney(installationFee + firstPeriodCharge + deposit)
    : null;

  const lines = [
    {
      id: 'installation-fee',
      label: 'Installation fee',
      amount: installationFee,
      note: installationFeeNote,
    },
    {
      id: 'first-period',
      label: 'First-period charge',
      amount: firstPeriodCharge,
      note: firstPeriodNote,
    },
    {
      id: 'deposit',
      label: 'Security deposit',
      amount: deposit,
      note: depositNote,
    },
  ];

  return {
    customerName,
    monthlyAmount,
    installationFee,
    installationFeeWaived,
    recordedInstallationFee: recordedFee,
    deposit,
    recordedDeposit,
    startDate,
    requestedMode,
    firstPeriodMode: resolvedMode,
    chargedDays,
    daysInMonth,
    firstPeriodCharge,
    lines,
    assumptions,
    reasons,
    status: ready ? 'ready' : 'incomplete',
    totalDue,
  };
}

// Convenience bridge: build the preview from a customer record's own
// package price and fee settings, so the preview can never drift from
// the settings the operator already uses for that customer. The
// start date defaults to the customer's connection date when the
// caller does not supply one; the caller may always override it, and
// overriding it changes only the pro-rata figure.
export function previewFromCustomer(customer = {}, options = {}) {
  const source = customer ?? {};
  const opts = options ?? {};
  return buildFirstBillPreview({
    customerName: source.name ?? source.customerName,
    monthlyAmount: source.monthlySellingAmount,
    connectionFee: source.connectionFee,
    securityDeposit: source.securityDeposit,
    isFreeConnection: source.isFreeConnection,
    startDate: opts.startDate ?? source.connectionDate,
    firstPeriodMode: opts.firstPeriodMode,
  });
}

export function firstBillPreviewSummaryText(preview) {
  if (!preview) return 'No first-bill preview';
  if (preview.status !== 'ready') {
    return `First-bill preview incomplete: ${preview.reasons.join(', ') || 'missing figures'}`;
  }
  const name = preview.customerName ? `${preview.customerName}: ` : '';
  return `${name}First bill preview — installation PKR ${preview.installationFee}, `
    + `first period PKR ${preview.firstPeriodCharge} (${preview.firstPeriodNote}), `
    + `deposit PKR ${preview.deposit}, total due PKR ${preview.totalDue}`;
}

export function firstBillPreviewHtml(preview, formatAmount) {
  if (!preview) return '<p class="empty-state">No first-bill preview</p>';
  const fmt = typeof formatAmount === 'function'
    ? formatAmount
    : (amount) => (amount === null || amount === undefined ? '—' : `PKR ${amount}`);
  const money = (amount) => (amount === null || amount === undefined ? '—' : escapeHtml(fmt(amount)));
  const rows = preview.lines.map((line) => `<tr><td>${escapeHtml(line.label)}</td>`
    + `<td>${money(line.amount)}</td>`
    + `<td>${line.note ? escapeHtml(line.note) : ''}</td></tr>`).join('');
  const assumptions = preview.assumptions.length
    ? `<p class="first-bill-preview-assumptions">Assumptions: ${escapeHtml(preview.assumptions.join(' · '))}</p>`
    : '';
  const incomplete = preview.status !== 'ready'
    ? `<p class="first-bill-preview-incomplete" role="alert">Preview incomplete — ${escapeHtml(preview.reasons.join(', '))}. No total is shown until the monthly price and a valid start date are set.</p>`
    : '';
  return `<div class="first-bill-preview"><table><thead><tr><th>Item</th><th>Amount</th><th>Note</th></tr></thead>`
    + `<tbody>${rows}</tbody>`
    + `<tfoot><tr><td>Total due</td><td><strong>${money(preview.totalDue)}</strong></td><td>Preview only — no bill has been raised</td></tr></tfoot></table>`
    + `${assumptions}${incomplete}</div>`;
}

// --- Preview-shown tracking (caller-owned list, no storage here) ---

export function findFirstBillPreviewShown(list, customerId) {
  const id = text(customerId);
  if (!id || !Array.isArray(list)) return null;
  return list.find((entry) => entry && text(entry.customerId) === id) ?? null;
}

// Marking a preview shown records only that fact (customer + date).
// A bad customer id or a bad date leaves the list unchanged — a shown
// flag must never be invented for nobody, or for no date.
export function recordFirstBillPreviewShown(list, customerId, shownAt) {
  const base = Array.isArray(list) ? [...list] : [];
  const id = text(customerId);
  const date = validDate(shownAt);
  if (!id || date === null) return base;
  const existingIndex = base.findIndex((entry) => entry && text(entry.customerId) === id);
  const entry = { customerId: id, shownAt: date };
  if (existingIndex >= 0) base[existingIndex] = entry;
  else base.push(entry);
  return base;
}

export function firstBillPreviewShownText(entry) {
  if (!entry) return 'First-bill preview not shown yet';
  return `First-bill preview shown on ${entry.shownAt}`;
}
