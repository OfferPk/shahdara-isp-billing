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

// Plan 601 — labels object: the app passes t('prv_fb_*') values; every
// entry defaults to the exact English string this module used to
// hardcode, so existing callers are unchanged. The module never
// imports t(). The three zero-amount defaults stay VERBATIM
// ('Not recorded — counted as Rs 0' etc.): the dict carries them as
// {amount} templates because Sharafat 85 forbids the legacy currency
// token in nav-language.js, and the module fills 'Rs 0' at runtime —
// the fill is idempotent across both shapes, so the rendered English
// is byte-identical either way.
const DEFAULT_LABELS = {
  noPreview: 'No first-bill preview',
  summaryIncomplete: 'First-bill preview incomplete: {reasons}',
  lineInstallation: 'Installation fee',
  lineFirstPeriod: 'First-period charge',
  lineDeposit: 'Security deposit',
  waived: 'Waived — free connection',
  feeNotRecorded: 'Not recorded — counted as Rs 0',
  depositNotRecorded: 'No deposit recorded — counted as Rs 0',
  feeAssumption: 'Installation fee not recorded — counted as Rs 0',
  prorataNote: '{charged} of {days} days (from {date})',
  assumptions: 'Assumptions: {list}',
  incomplete: 'Preview incomplete — {reasons}. No total is shown until the monthly price and a valid start date are set.',
  summaryReady: '{name}First bill preview — installation PKR {fee}, first period PKR {charge} ({note}), deposit PKR {deposit}, total due PKR {total}',
  notShown: 'First-bill preview not shown yet',
  shownOn: 'First-bill preview shown on {date}',
  reasonPrice: 'monthly-price-missing',
  reasonDate: 'start-date-invalid',
  missingFigures: 'missing figures',
  tableItem: 'Item',
  tableAmount: 'Amount',
  tableNote: 'Note',
  totalDue: 'Total due',
  previewOnly: 'Preview only — no bill has been raised',
  fullMonth: 'Full month',
};

const fill = (template, params = {}) =>
  String(template ?? '').replaceAll(
    /\{(\w+)\}/g,
    (match, name) => (params[name] ?? match),
  );

function resolveLabels(labels) {
  return { ...DEFAULT_LABELS, ...(labels ?? {}) };
}

function reasonLabel(reason, labels) {
  if (reason === 'monthly-price-missing') return labels.reasonPrice;
  if (reason === 'start-date-invalid') return labels.reasonDate;
  return reason;
}

export function buildFirstBillPreview(input = {}, labels) {
  const L = resolveLabels(labels);
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
    installationFeeNote = L.waived;
  } else if (recordedFee !== null) {
    installationFee = recordedFee;
  } else {
    installationFee = 0;
    assumptions.push(fill(L.feeAssumption, { amount: 'Rs 0' }));
    installationFeeNote = fill(L.feeNotRecorded, { amount: 'Rs 0' });
  }

  // Deposit: optional, so an unrecorded deposit is 0, noted as such
  // only when it was actually absent (a recorded 0 needs no note).
  let deposit = 0;
  let depositNote = '';
  if (recordedDeposit !== null) {
    deposit = recordedDeposit;
  } else {
    depositNote = fill(L.depositNotRecorded, { amount: 'Rs 0' });
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
      ? L.fullMonth
      : fill(L.prorataNote, { charged: chargedDays, days: daysInMonth, date: startDate });
  }

  const ready = reasons.length === 0;
  const totalDue = ready
    ? roundMoney(installationFee + firstPeriodCharge + deposit)
    : null;

  const lines = [
    {
      id: 'installation-fee',
      label: L.lineInstallation,
      amount: installationFee,
      note: installationFeeNote,
    },
    {
      id: 'first-period',
      label: L.lineFirstPeriod,
      amount: firstPeriodCharge,
      note: firstPeriodNote,
    },
    {
      id: 'deposit',
      label: L.lineDeposit,
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
// overriding it changes only the pro-rata figure. Labels ride in
// options.labels (Plan 601) and reach buildFirstBillPreview.
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
  }, opts.labels);
}

export function firstBillPreviewSummaryText(preview, labels) {
  const L = resolveLabels(labels);
  if (!preview) return L.noPreview;
  if (preview.status !== 'ready') {
    return fill(L.summaryIncomplete, {
      reasons: preview.reasons.map((reason) => reasonLabel(reason, L)).join(', ') || L.missingFigures,
    });
  }
  const name = preview.customerName ? `${preview.customerName}: ` : '';
  // Plan 601 fix found while keying: buildFirstBillPreview never put
  // firstPeriodNote on the returned preview (only on the first-period
  // line), so the base rendered "(undefined)" here and a bare fill
  // would render "({note})". The note lives on the line — read it
  // from there, so the summary reads "(Full month)" as intended.
  const note = preview.firstPeriodNote
    ?? preview.lines?.find((line) => line.id === 'first-period')?.note
    ?? '';
  return fill(L.summaryReady, {
    name,
    fee: preview.installationFee,
    charge: preview.firstPeriodCharge,
    note,
    deposit: preview.deposit,
    total: preview.totalDue,
  });
}

export function firstBillPreviewHtml(preview, formatAmount, labels) {
  const L = resolveLabels(labels);
  if (!preview) return `<p class="empty-state">${escapeHtml(L.noPreview)}</p>`;
  const fmt = typeof formatAmount === 'function'
    ? formatAmount
    : (amount) => (amount === null || amount === undefined ? '—' : `PKR ${amount}`);
  const money = (amount) => (amount === null || amount === undefined ? '—' : escapeHtml(fmt(amount)));
  const rows = preview.lines.map((line) => `<tr><td>${escapeHtml(line.label)}</td>`
    + `<td>${money(line.amount)}</td>`
    + `<td>${line.note ? escapeHtml(line.note) : ''}</td></tr>`).join('');
  const assumptions = preview.assumptions.length
    ? `<p class="first-bill-preview-assumptions">${escapeHtml(fill(L.assumptions, { list: preview.assumptions.join(' · ') }))}</p>`
    : '';
  const incomplete = preview.status !== 'ready'
    ? `<p class="first-bill-preview-incomplete" role="alert">${escapeHtml(fill(L.incomplete, { reasons: preview.reasons.map((reason) => reasonLabel(reason, L)).join(', ') }))}</p>`
    : '';
  return `<div class="first-bill-preview"><table><thead><tr><th>${escapeHtml(L.tableItem)}</th><th>${escapeHtml(L.tableAmount)}</th><th>${escapeHtml(L.tableNote)}</th></tr></thead>`
    + `<tbody>${rows}</tbody>`
    + `<tfoot><tr><td>${escapeHtml(L.totalDue)}</td><td><strong>${money(preview.totalDue)}</strong></td><td>${escapeHtml(L.previewOnly)}</td></tr></tfoot></table>`
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

export function firstBillPreviewShownText(entry, labels) {
  const L = resolveLabels(labels);
  if (!entry) return L.notShown;
  return fill(L.shownOn, { date: entry.shownAt });
}
