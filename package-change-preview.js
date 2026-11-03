// Plan 46 (Plan 1-100) — Package upgrade and downgrade preview with
// next-bill estimate.
//
// A customer asking "what if I move to a faster or cheaper package?"
// used to get a verbal guess, so the change was agreed without the
// customer seeing what the next bill will actually be. This module
// shows that next bill BEFORE any change is applied.
//
// Scope fence, stated plainly: this is a PREVIEW ONLY. It applies
// nothing and changes no billing, package-history, or lifecycle rule:
// Plan U keeps the change history itself, Plan 34 keeps the price
// history, and the existing package-change save flow is the only
// place a change is ever applied. The preview is kept as a note on
// that change (see attachPreviewNoteToChange) — a note, never a
// second history entry and never a rewritten bill.
//
// How it differs from the profile's existing mid-month pro-rata
// preview (SISP): that preview prices today's migration from the
// typed rates and stamps a pro-rata adjustment into the change
// itself. This preview instead:
//   - resolves both packages' prices through the Plan 34 rule —
//     latest revision effective on or before the bill month's first
//     day, else the caller-supplied baseline (catalogue price or the
//     customer's own monthly amount), else null, never guessed —
//     so its prices match the package records and price history on
//     the same fixture;
//   - takes a caller-chosen effective date and a caller-chosen next
//     bill month, and changing the effective date updates the
//     estimate (full month when the change is already effective at
//     the month's start, pro-rata by calendar days when it falls
//     inside the month, old price alone when it falls after the
//     month — the same pro-rata idea as Plan 18's first-bill
//     preview, inclusive of the effective date for the new package);
//   - estimates the NEXT BILL only, never the current month's bill.
//
// It is import-free (like first-bill-preview.js and
// package-price-history.js): the caller supplies every input, and
// the module never reads storage, the clock, or the network, and
// never mutates an input. Money is summed in integer cents, so no
// float drift: a pro-rata split's two shares always add up exactly
// to the estimated total.

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// Package keys match case-insensitively with collapsed whitespace,
// exactly as Plan 34's normalizePackageKey, so a catalogue id and a
// stored label that differ only in case or spacing still resolve to
// the same package history.
export function normalizeChangePackageKey(value) {
  const cleaned = text(value);
  if (!cleaned) return '';
  return cleaned.replace(/\s+/g, ' ').toLowerCase();
}

// A real calendar date in YYYY-MM-DD form, or null. 2026-02-30 is
// rejected: the Date round-trip must reproduce the same string.
export function isValidChangeDate(value) {
  const str = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const parsed = new Date(`${str}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === str;
}

export function validChangeDate(value) {
  return isValidChangeDate(value) ? text(value) : null;
}

// A bill month in YYYY-MM form, or null.
export function validBillMonth(value) {
  const str = text(value);
  if (!/^\d{4}-\d{2}$/.test(str)) return null;
  const month = Number(str.slice(5, 7));
  return month >= 1 && month <= 12 ? str : null;
}

function finiteAmount(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const amount = Number(value);
    return Number.isFinite(amount) ? amount : null;
  }
  return null;
}

function moneyOrNull(value) {
  const amount = finiteAmount(value);
  return amount !== null && amount >= 0 ? Math.round(amount * 100) / 100 : null;
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

function normalizeRevision(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const key = normalizeChangePackageKey(
    input.packageKey ?? input.packageId ?? input.label ?? input.packageLabel,
  );
  if (!key) return null;
  const amount = moneyOrNull(input.amount ?? input.price ?? input.newAmount);
  if (amount === null) return null;
  const effectiveDate = validChangeDate(input.effectiveDate ?? input.date);
  if (!effectiveDate) return null;
  return { packageKey: key, amount, effectiveDate };
}

function normalizeHistory(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const item of list) {
    const revision = normalizeRevision(item);
    if (revision) out.push(revision);
  }
  out.sort((a, b) => (
    a.effectiveDate.localeCompare(b.effectiveDate)
    || a.packageKey.localeCompare(b.packageKey)
    || a.amount - b.amount
  ));
  return out;
}

// The Plan 34 price rule, mirrored here so this import-free module
// can resolve a price on its own: the latest revision effective on
// or before the bill date, else the caller-supplied baseline, else
// null. A bill month counts as its first day, so a mid-month
// revision applies from the following month's bills, never
// retroactively. Returns the price and where it came from, so the
// preview can say so instead of presenting a baseline as a revision.
export function resolveChangePackagePrice(history, packageKey, billDateOrMonth, baseline = null) {
  const key = normalizeChangePackageKey(packageKey);
  let date = validChangeDate(billDateOrMonth);
  if (!date) {
    const month = validBillMonth(billDateOrMonth);
    date = month ? `${month}-01` : null;
  }
  if (!key || !date) return { price: null, source: 'missing', effectiveDate: null };
  const revisions = normalizeHistory(history)
    .filter((revision) => revision.packageKey === key);
  let applicable = null;
  for (const revision of revisions) {
    if (revision.effectiveDate <= date) applicable = revision;
    else break;
  }
  if (applicable) {
    return { price: applicable.amount, source: 'revision', effectiveDate: applicable.effectiveDate };
  }
  const base = moneyOrNull(baseline);
  if (base !== null) return { price: base, source: 'baseline', effectiveDate: null };
  return { price: null, source: 'missing', effectiveDate: null };
}

// The estimate mode the caller asked for, resolved to a real mode.
// Anything unknown falls back to 'auto', never to a silent 'full'.
export function normalizeChangeMode(value) {
  const mode = text(value).toLowerCase();
  return mode === 'full' || mode === 'prorata' ? mode : 'auto';
}

function packageLabel(input, fallback) {
  if (typeof input === 'string') return text(input);
  if (input && typeof input === 'object') {
    return text(input.label ?? input.packageLabel ?? input.packageKey ?? input.packageId ?? input.name);
  }
  return text(fallback);
}

function packageBaseline(input, fallback) {
  if (input && typeof input === 'object') {
    return input.price ?? input.amount ?? input.monthlyPrice ?? input.monthlySellingAmount ?? fallback;
  }
  return fallback;
}

export function buildPackageChangePreview(input = {}) {
  const source = input ?? {};
  const customerId = text(source.customerId);
  const customerName = text(source.customerName ?? source.name);
  const currentLabel = packageLabel(source.currentPackage, source.currentPackageLabel);
  const proposedLabel = packageLabel(source.proposedPackage, source.proposedPackageLabel);
  const currentKey = normalizeChangePackageKey(source.currentPackageKey ?? currentLabel);
  const proposedKey = normalizeChangePackageKey(source.proposedPackageKey ?? proposedLabel);
  const history = source.priceHistory ?? source.history ?? [];
  const billMonth = validBillMonth(source.billMonth ?? source.nextBillMonth ?? source.month);
  const effectiveDate = validChangeDate(source.effectiveDate ?? source.changeDate);
  const requestedMode = normalizeChangeMode(source.mode ?? source.estimateMode);

  const reasons = [];
  if (!currentLabel || !proposedLabel) reasons.push('package-missing');
  if (effectiveDate === null) reasons.push('effective-date-invalid');
  if (billMonth === null) reasons.push('bill-month-invalid');

  // Prices resolve through the Plan 34 rule at the bill month's
  // first day, from the caller's baselines (catalogue price or the
  // customer's own monthly amount) when no revision applies.
  const currentResolved = resolveChangePackagePrice(
    history, currentKey, billMonth,
    packageBaseline(source.currentPackage, source.currentPrice ?? source.currentBaseline),
  );
  const proposedResolved = resolveChangePackagePrice(
    history, proposedKey, billMonth,
    packageBaseline(source.proposedPackage, source.proposedPrice ?? source.proposedBaseline),
  );
  if (currentResolved.price === null) reasons.push('current-price-missing');
  if (proposedResolved.price === null) reasons.push('proposed-price-missing');

  const ready = reasons.length === 0;
  const currentPrice = currentResolved.price;
  const proposedPrice = proposedResolved.price;
  const monthlyDifference = ready
    ? Math.round((proposedPrice - currentPrice) * 100) / 100
    : null;
  const direction = !ready ? null
    : monthlyDifference > 0 ? 'upgrade'
    : monthlyDifference < 0 ? 'downgrade'
    : 'lateral';

  // The estimate itself. All three branches are honest about what
  // the next bill contains; none of them invents a charge for a
  // month the change had not reached, or a full month for a
  // mid-month change the caller did not ask to charge in full.
  let resolvedMode = requestedMode;
  let daysInMonth = null;
  let oldDays = null;
  let newDays = null;
  let lines = [];
  let estimatedNextBill = null;
  let estimateNote = '';
  if (ready) {
    const year = Number(billMonth.slice(0, 4));
    const month = Number(billMonth.slice(5, 7));
    daysInMonth = daysInMonthOf(year, month);
    const monthStart = `${billMonth}-01`;
    const monthEnd = `${billMonth}-${String(daysInMonth).padStart(2, '0')}`;
    const effectiveDay = Number(effectiveDate.slice(8, 10));
    if (effectiveDate > monthEnd) {
      // The change lands after this bill month: the next bill is
      // still the old package in full, and the preview says so.
      resolvedMode = 'not-yet-effective';
      oldDays = daysInMonth;
      newDays = 0;
      lines = [{
        id: 'current-package',
        label: currentLabel,
        amount: currentPrice,
        note: `Full month — change takes effect ${effectiveDate}, after this bill month`,
      }];
      estimatedNextBill = currentPrice;
      estimateNote = 'Change takes effect after this bill month, so the next bill is still the current package in full.';
    } else if (requestedMode === 'full' || effectiveDate <= monthStart) {
      resolvedMode = 'full';
      oldDays = 0;
      newDays = daysInMonth;
      lines = [{
        id: 'proposed-package',
        label: proposedLabel,
        amount: proposedPrice,
        note: 'Full month',
      }];
      estimatedNextBill = proposedPrice;
      estimateNote = requestedMode === 'full'
        ? 'Full month at the proposed package price, as requested.'
        : 'Change already effective at the start of the bill month, so the whole month is at the proposed package price.';
    } else {
      // Pro-rata by calendar days, Plan 18 style: the effective
      // date itself belongs to the new package.
      resolvedMode = 'prorata';
      oldDays = effectiveDay - 1;
      newDays = daysInMonth - effectiveDay + 1;
      const oldShareCents = Math.round(currentPrice * 100 * oldDays / daysInMonth);
      const newShareCents = Math.round(proposedPrice * 100 * newDays / daysInMonth);
      lines = [
        {
          id: 'current-package-share',
          label: currentLabel,
          amount: oldShareCents / 100,
          note: `${oldDays} of ${daysInMonth} days (before ${effectiveDate})`,
        },
        {
          id: 'proposed-package-share',
          label: proposedLabel,
          amount: newShareCents / 100,
          note: `${newDays} of ${daysInMonth} days (from ${effectiveDate})`,
        },
      ];
      estimatedNextBill = (oldShareCents + newShareCents) / 100;
      estimateNote = `Pro-rata by calendar days: ${oldDays} day${oldDays === 1 ? '' : 's'} at the current price, ${newDays} day${newDays === 1 ? '' : 's'} at the proposed price.`;
    }
  }

  return {
    customerId,
    customerName,
    currentPackage: currentLabel,
    currentPackageKey: currentKey,
    currentPrice,
    currentPriceSource: currentResolved.source,
    currentPriceEffectiveDate: currentResolved.effectiveDate,
    proposedPackage: proposedLabel,
    proposedPackageKey: proposedKey,
    proposedPrice,
    proposedPriceSource: proposedResolved.source,
    proposedPriceEffectiveDate: proposedResolved.effectiveDate,
    monthlyDifference,
    direction,
    effectiveDate,
    billMonth,
    requestedMode,
    estimateMode: resolvedMode,
    daysInMonth,
    oldDays,
    newDays,
    lines,
    estimatedNextBill,
    estimateNote,
    reasons,
    status: ready ? 'ready' : 'incomplete',
  };
}

export function packageChangePreviewSummaryText(preview) {
  if (!preview) return 'No package change preview';
  if (preview.status !== 'ready') {
    return `Package change preview incomplete: ${preview.reasons.join(', ') || 'missing figures'}`;
  }
  const name = preview.customerName ? `${preview.customerName}: ` : '';
  const directionWord = preview.direction === 'upgrade' ? 'upgrade'
    : preview.direction === 'downgrade' ? 'downgrade' : 'lateral change';
  return `${name}Package change preview (${directionWord}) — ${preview.currentPackage} (PKR ${preview.currentPrice}) → `
    + `${preview.proposedPackage} (PKR ${preview.proposedPrice}), monthly difference PKR ${preview.monthlyDifference}, `
    + `effective ${preview.effectiveDate}, next bill ${preview.billMonth} estimated PKR ${preview.estimatedNextBill}`;
}

// The note kept on the applied change: the same one-line summary,
// or null when the preview was never ready — an incomplete preview
// must never be kept as if it had been shown.
export function packageChangePreviewNote(preview) {
  if (!preview || preview.status !== 'ready') return null;
  return packageChangePreviewSummaryText(preview);
}

// Does this preview describe the change in `change`? A match is by
// proposed package key (case-insensitive, whitespace-collapsed), so
// the note is only ever kept on the change it was previewed for.
export function previewMatchesChange(preview, change) {
  if (!preview || preview.status !== 'ready' || !change || typeof change !== 'object') return false;
  const proposed = normalizeChangePackageKey(preview.proposedPackageKey ?? preview.proposedPackage);
  const changed = normalizeChangePackageKey(change.newPackage ?? change.proposedPackage);
  return proposed !== '' && proposed === changed;
}

// Keep the preview as a note on the change it was previewed for.
// Returns a fresh object; the input change is never mutated, and a
// non-matching or incomplete preview leaves the change untouched
// (a fresh copy, so callers cannot observe an aliasing surprise).
export function attachPreviewNoteToChange(change, preview) {
  const base = change && typeof change === 'object' && !Array.isArray(change) ? { ...change } : {};
  const note = packageChangePreviewNote(preview);
  if (note !== null && previewMatchesChange(preview, change)) {
    base.packageChangePreviewNote = note;
  }
  return base;
}

export function packageChangePreviewHtml(preview, formatAmount) {
  if (!preview) return '<p class="empty-state">No package change preview</p>';
  const fmt = typeof formatAmount === 'function'
    ? formatAmount
    : (amount) => (amount === null || amount === undefined ? '—' : `PKR ${amount}`);
  const money = (amount) => (amount === null || amount === undefined ? '—' : escapeHtml(fmt(amount)));
  if (preview.status !== 'ready') {
    return `<div class="package-change-preview"><p class="package-change-preview-incomplete" role="alert">Preview incomplete — ${escapeHtml(preview.reasons.join(', '))}. No estimate is shown until both packages have a price and a valid effective date and bill month are set.</p></div>`;
  }
  const rows = preview.lines.map((line) => `<tr><td>${escapeHtml(line.label)}</td>`
    + `<td>${money(line.amount)}</td>`
    + `<td>${line.note ? escapeHtml(line.note) : ''}</td></tr>`).join('');
  return `<div class="package-change-preview"><p>${escapeHtml(packageChangePreviewSummaryText(preview))}</p>`
    + `<table><thead><tr><th>Item</th><th>Amount</th><th>Note</th></tr></thead>`
    + `<tbody>${rows}</tbody>`
    + `<tfoot><tr><td>Estimated next bill (${escapeHtml(preview.billMonth)})</td><td><strong>${money(preview.estimatedNextBill)}</strong></td><td>${escapeHtml(preview.estimateNote)}</td></tr></tfoot></table>`
    + `<p>Preview only — no package, bill, or lifecycle record has changed.</p></div>`;
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function packageChangePreviewCsv(preview) {
  if (!preview) return 'customer,current_package,current_price,proposed_package,proposed_price,monthly_difference,effective_date,bill_month,estimated_next_bill\n';
  const row = [
    preview.customerName || preview.customerId || '',
    preview.currentPackage,
    preview.currentPrice,
    preview.proposedPackage,
    preview.proposedPrice,
    preview.monthlyDifference,
    preview.effectiveDate,
    preview.billMonth,
    preview.estimatedNextBill,
  ];
  return 'customer,current_package,current_price,proposed_package,proposed_price,monthly_difference,effective_date,bill_month,estimated_next_bill\n'
    + `${row.map(csvCell).join(',')}\n`;
}

export function packageChangePreviewFilename() {
  return 'package-change-preview.csv';
}

// --- Preview-kept-as-note tracking (caller-owned list, no storage here) ---
//
// The app keeps the latest ready preview per customer in its own
// store, so that when the operator applies that change through the
// existing package-change flow, the preview's note can ride on the
// change's history entry. Recording a preview writes no bill, no
// payment and no lifecycle field.

export function findPackageChangePreview(list, customerId) {
  const id = text(customerId);
  if (!id || !Array.isArray(list)) return null;
  return list.find((entry) => entry && text(entry.customerId) === id) ?? null;
}

// Only a READY preview is ever recorded; an incomplete attempt
// leaves the list unchanged, and a bad customer id invents nothing.
export function recordPackageChangePreview(list, preview) {
  const base = Array.isArray(list) ? [...list] : [];
  if (!preview || preview.status !== 'ready') return base;
  const id = text(preview.customerId);
  if (!id) return base;
  const entry = { ...preview, customerId: id };
  const existingIndex = base.findIndex((item) => item && text(item.customerId) === id);
  if (existingIndex >= 0) base[existingIndex] = entry;
  else base.push(entry);
  return base;
}

export function removePackageChangePreview(list, customerId) {
  const base = Array.isArray(list) ? [...list] : [];
  const id = text(customerId);
  if (!id) return base;
  return base.filter((entry) => !(entry && text(entry.customerId) === id));
}

export function packageChangePreviewStoredText(entry) {
  if (!entry) return 'No package change preview kept yet';
  return `Package change preview kept: ${entry.proposedPackage} from ${entry.effectiveDate}, next bill ${entry.billMonth} estimated PKR ${entry.estimatedNextBill}`;
}
