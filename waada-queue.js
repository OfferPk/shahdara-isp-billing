/**
 * waada-queue.js — "Waada Tareekh" (Promise-to-Pay) & 3-Tier Reminder Snooze Queue (SISP-3)
 *
 * Spec model (distinct from the older store-based promises in reminder-queue.js,
 * which live under shahdara_collection_promises_v1 and are left untouched):
 * promise metadata lives ON the customer record:
 *   promiseDate (YYYY-MM-DD), promiseAmount (PKR or null), promiseNote (string).
 *
 * Tiers for unpaid customers (outstanding > 0):
 *   - 'broken'   : promiseDate < today (overdue promise, pinned at the top)
 *   - 'promised' : promiseDate >= today (snoozed — kept OUT of daily collection lists)
 *   - 'active'   : no promise set (standard unpaid subscriber)
 * Customers with no outstanding balance have no tier (null) — they are not in
 * any collection queue, and a full payment auto-clears their promise.
 *
 * This module is dependency-free on purpose: reminder-queue.js,
 * dashboard-top-defaulters.js and app.js all import it, and it imports nothing,
 * so no module cycle is possible. All date math is UTC-calendar based on
 * YYYY-MM-DD strings (lexicographic compare == chronological compare).
 */

export const WAADA_TIERS = Object.freeze({
  BROKEN: 'broken',
  ACTIVE: 'active',
  PROMISED: 'promised'
});

/**
 * Today's date as YYYY-MM-DD in Pakistan Standard Time (Asia/Karachi).
 * Same Intl pattern as reminder-queue.js, duplicated here so this module
 * stays dependency-free.
 */
export function getWaadaTodayString(date = new Date()) {
  try {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) throw new Error('Invalid date');
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Karachi',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const parts = Object.fromEntries(
      formatter.formatToParts(d).filter(p => p.type !== 'literal').map(p => [p.type, p.value])
    );
    return `${parts.year}-${parts.month}-${parts.day}`;
  } catch {
    const d = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

/** Strict YYYY-MM-DD validation against the real calendar (leap-aware). */
export function isValidWaadaDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}

function parseWaadaParts(dateStr) {
  if (!isValidWaadaDate(dateStr)) return null;
  const [year, month, day] = dateStr.trim().split('-').map(Number);
  return { year, month, day };
}

function formatWaadaYmd(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Adds N calendar days to a YYYY-MM-DD string. Returns null for invalid input. */
export function addWaadaDays(dateStr, days) {
  const parts = parseWaadaParts(dateStr);
  if (!parts) return null;
  const d = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  d.setUTCDate(d.getUTCDate() + days);
  return formatWaadaYmd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/**
 * A day-of-month chip date: that day of the current month when today is on
 * or before it, otherwise the same day of next month (a promise date in the
 * past would instantly read as broken, so it always lands in the future).
 */
export function dayOfMonthWaadaDate(todayStr, dayOfMonth) {
  const parts = parseWaadaParts(todayStr);
  const day = Math.floor(Number(dayOfMonth));
  if (!parts || !Number.isFinite(day) || day < 1 || day > 28) return null;
  if (parts.day <= day) return formatWaadaYmd(parts.year, parts.month, day);
  let year = parts.year;
  let month = parts.month + 1;
  if (month > 12) {
    month = 1;
    year += 1;
  }
  return formatWaadaYmd(year, month, day);
}

/**
 * The "10th of Month" chip date: the 10th of the current month when today is
 * on or before the 10th, otherwise the 10th of next month (a promise date in
 * the past would instantly read as broken, so it always lands in the future).
 */
export function tenthOfMonthWaadaDate(todayStr) {
  return dayOfMonthWaadaDate(todayStr, 10);
}

/** The "15th of Month" chip date — same rule as the 10th, for the 15th. */
export function fifteenthOfMonthWaadaDate(todayStr) {
  return dayOfMonthWaadaDate(todayStr, 15);
}

/**
 * One-tap chip dates. chip: 'plus2' | 'plus5' | 'tenth' | 'custom', plus the
 * SISP-126 remainder-waada chips 'plus3' | 'plus7' | 'fifteenth'.
 * Returns a YYYY-MM-DD string, or null for an unknown chip / invalid input.
 */
export function computeWaadaChipDate(chip, todayStr, customDate = null) {
  if (!isValidWaadaDate(todayStr)) return null;
  if (chip === 'plus2') return addWaadaDays(todayStr, 2);
  if (chip === 'plus5') return addWaadaDays(todayStr, 5);
  if (chip === 'plus3') return addWaadaDays(todayStr, 3);
  if (chip === 'plus7') return addWaadaDays(todayStr, 7);
  if (chip === 'tenth') return tenthOfMonthWaadaDate(todayStr);
  if (chip === 'fifteenth') return fifteenthOfMonthWaadaDate(todayStr);
  if (chip === 'custom') return isValidWaadaDate(customDate) ? customDate.trim() : null;
  return null;
}

/**
 * Sets (or replaces) the Waada promise on a customer record. Returns a NEW
 * customer object; the input is never mutated. Throws on an invalid date.
 */
export function setCustomerWaada(customer, { promiseDate, promiseAmount = null, promiseNote = '' } = {}) {
  if (!customer || typeof customer !== 'object') throw new Error('Customer required');
  if (!isValidWaadaDate(promiseDate)) throw new Error('Promise date must be YYYY-MM-DD');
  const amount = promiseAmount === null || promiseAmount === undefined || promiseAmount === ''
    ? null
    : Math.max(0, Number(promiseAmount));
  return {
    ...customer,
    promiseDate: promiseDate.trim(),
    promiseAmount: Number.isFinite(amount) ? amount : null,
    promiseNote: String(promiseNote ?? '').trim()
  };
}

/** Removes the Waada promise fields from a customer record. New object, input untouched. */
export function clearCustomerWaada(customer) {
  if (!customer || typeof customer !== 'object') return customer;
  const next = { ...customer };
  delete next.promiseDate;
  delete next.promiseAmount;
  delete next.promiseNote;
  return next;
}

// ---------------------------------------------------------------------------
// SISP-126: Partial Payment "Remainder Waada" — when a collection leaves a
// balance behind, the collector can promise the REST with one tap. The
// promise itself is an ordinary SISP-3 waada written through
// setCustomerWaada above (promiseDate / promiseAmount / promiseNote on the
// customer); this section only holds the shared pure arithmetic so the
// Quick Collect modal and Field Mode compute the remainder identically.
// The remainder ALWAYS derives from the caller's engine figure (the same
// total due the collect surface displays) minus the amount being paid —
// never from a second hand-summed computation here.
// ---------------------------------------------------------------------------

/** Marker note stamped on every remainder waada (and on the payment stamp). */
export const REMAINDER_WAADA_NOTE = 'Remainder waada — partial payment';

/**
 * The remainder of a partial payment: totalDue − amountPaid, in PKR rounded
 * to cents. Returns { remainder } ONLY for a true partial
 * (0 < amountPaid < totalDue); null for a full payment, an overpayment, a
 * zero/invalid amount, or no due at all — in those cases no waada row shows
 * and no promise may be written.
 */
export function computeRemainderWaada(totalDue, amountPaid) {
  const due = Number(totalDue);
  const paid = Number(amountPaid);
  if (!Number.isFinite(due) || !Number.isFinite(paid)) return null;
  if (due <= 0 || paid <= 0 || paid >= due) return null;
  const remainder = Math.round((due - paid) * 100) / 100;
  return remainder > 0 ? { remainder } : null;
}

/**
 * The four remainder-waada chip dates for a payment made on baseDateStr
 * (the payment's own date, YYYY-MM-DD): +3 days, +7 days, the 10th and the
 * 15th (this month's when still ahead, otherwise next month's — a chip
 * never offers a past date). Returns null for an invalid base date.
 */
export function remainderWaadaChipDates(baseDateStr) {
  if (!isValidWaadaDate(baseDateStr)) return null;
  const base = baseDateStr.trim();
  return {
    plus3: addWaadaDays(base, 3),
    plus7: addWaadaDays(base, 7),
    tenth: tenthOfMonthWaadaDate(base),
    fifteenth: fifteenthOfMonthWaadaDate(base)
  };
}

/**
 * Reads the remainder-waada stamp a partial payment carries
 * (payment.remainderWaada = { promiseDate, promiseAmount, previousWaada? },
 * written by the collect recorder in the same save as the payment itself).
 * Returns a validated { promiseDate, promiseAmount } or null — receipts and
 * the void path trust only this reader, never the raw stamp.
 */
export function remainderWaadaOf(payment) {
  const stamp = payment?.remainderWaada;
  if (!stamp || typeof stamp !== 'object') return null;
  const promiseDate = typeof stamp.promiseDate === 'string' ? stamp.promiseDate.trim() : '';
  const promiseAmount = Number(stamp.promiseAmount);
  if (!isValidWaadaDate(promiseDate)) return null;
  if (!Number.isFinite(promiseAmount) || promiseAmount <= 0) return null;
  return { promiseDate, promiseAmount: Math.round(promiseAmount * 100) / 100 };
}

/**
 * True when the customer's live promise is still exactly the remainder
 * waada a stamp describes (same date, same amount, the remainder marker
 * note) — the void/undo paths use this so they only ever roll back the
 * promise the payment itself set, never a newer one set afterwards.
 */
export function isRemainderWaadaCurrent(customer, stamp) {
  if (!customer || typeof customer !== 'object' || !stamp) return false;
  return customer.promiseDate === stamp.promiseDate
    && Number(customer.promiseAmount) === Number(stamp.promiseAmount)
    && String(customer.promiseNote ?? '') === REMAINDER_WAADA_NOTE;
}

/**
 * The promise a remainder waada replaced, as kept on the payment stamp
 * (previousWaada), validated for the void/undo restore paths. Returns
 * { promiseDate, promiseAmount, promiseNote } or null when the stamp holds
 * no usable previous promise.
 */
export function remainderWaadaPreviousOf(payment) {
  const prev = payment?.remainderWaada?.previousWaada;
  if (!prev || typeof prev !== 'object') return null;
  const promiseDate = typeof prev.promiseDate === 'string' ? prev.promiseDate.trim() : '';
  if (!isValidWaadaDate(promiseDate)) return null;
  const amount = prev.promiseAmount === null || prev.promiseAmount === undefined || prev.promiseAmount === ''
    ? null
    : Number(prev.promiseAmount);
  return {
    promiseDate,
    promiseAmount: Number.isFinite(amount) ? amount : null,
    promiseNote: String(prev.promiseNote ?? '')
  };
}

// ---------------------------------------------------------------------------
// Sharafat 3: SISP-34 cleared-waada restore for the delete-undo paths.
// Recording a FULL payment auto-clears the customer's promise (SISP-3)
// and stamps the cleared promise onto that payment as clearedWaada
// (core.addPayment). Only voiding the payment restored it — the
// five-second delete-undo never did, so undoing a full payment left
// the promise gone with no payment behind it. These readers mirror
// voidPayment's restore discipline exactly: the stamp is data, the
// restore happens only while no newer promise exists, and a damaged
// stamp (no usable date) restores nothing.
// ---------------------------------------------------------------------------

/**
 * Reads the SISP-34 cleared-waada stamp a full payment carries
 * (payment.clearedWaada = { promiseDate, promiseAmount, promiseNote },
 * written by core.addPayment when the payment cleared the customer's
 * promise). Returns a validated { promiseDate, promiseAmount,
 * promiseNote } or null — the undo paths trust only this reader,
 * never the raw stamp. Unlike the remainder-waada reader, no amount
 * is required: a promise with no recorded amount still clears and
 * still restores, exactly as voidPayment treats it.
 */
export function clearedWaadaOf(payment) {
  const stamp = payment?.clearedWaada;
  if (!stamp || typeof stamp !== 'object') return null;
  const promiseDate = typeof stamp.promiseDate === 'string' ? stamp.promiseDate.trim() : '';
  if (!isValidWaadaDate(promiseDate)) return null;
  return {
    promiseDate,
    promiseAmount: stamp.promiseAmount ?? null,
    promiseNote: typeof stamp.promiseNote === 'string' ? stamp.promiseNote : ''
  };
}

/**
 * Restores the promise a cleared-waada stamp describes onto a customer,
 * exactly as voidPayment does it: the stamped date (trimmed), the
 * stamped amount only when the stamp carries one, the stamped note
 * only when it is a non-empty string. Returns a NEW customer object;
 * the input is never mutated. Returns null — and restores nothing —
 * when the stamp holds no usable date, or when the customer already
 * carries a live promise (a newer promise set after the payment is
 * never clobbered by undoing the old one).
 */
export function restoreClearedWaada(customer, stamp) {
  if (!customer || typeof customer !== 'object' || !stamp || typeof stamp !== 'object') return null;
  const promiseDate = typeof stamp.promiseDate === 'string' ? stamp.promiseDate.trim() : '';
  if (!isValidWaadaDate(promiseDate)) return null;
  if (typeof customer.promiseDate === 'string' && customer.promiseDate.trim() !== '') return null;
  const next = { ...customer, promiseDate };
  if (stamp.promiseAmount !== null && stamp.promiseAmount !== undefined && stamp.promiseAmount !== '') {
    next.promiseAmount = stamp.promiseAmount;
  }
  if (typeof stamp.promiseNote === 'string' && stamp.promiseNote !== '') {
    next.promiseNote = stamp.promiseNote;
  }
  return next;
}

/**
 * Plan N: stamp a profile-form partial payment exactly as Quick Collect
 * does (SISP-126). Returns a NEW customer object — the payment inside
 * the given month's bill carries remainderWaada { promiseDate,
 * promiseAmount, previousWaada? } and the customer's live promise is set
 * through setCustomerWaada with REMAINDER_WAADA_NOTE — or null when
 * nothing may be stamped (invalid date, non-positive remainder, unknown
 * customer/month/payment). The input customer is never mutated, and a
 * payment that is not stamped leaves the customer's promise untouched.
 * Callers must only call this after the payment itself is recorded, and
 * only when a remainder is genuinely still due, so a waada can never
 * exist without its payment.
 */
export function stampRemainderWaada(customer, month, paymentId, { promiseDate, promiseAmount } = {}) {
  if (!customer || typeof customer !== 'object') return null;
  if (!isValidWaadaDate(promiseDate)) return null;
  const amount = Number(promiseAmount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const bills = Array.isArray(customer.bills) ? customer.bills : [];
  const bill = bills.find((row) => row?.month === month);
  const payment = bill?.payments?.find((row) => row?.id === paymentId);
  if (!payment) return null;
  const previousWaada = (typeof customer.promiseDate === 'string' && customer.promiseDate.trim() !== '')
    ? {
      promiseDate: customer.promiseDate,
      promiseAmount: customer.promiseAmount ?? null,
      promiseNote: customer.promiseNote ?? ''
    }
    : null;
  const stamp = {
    promiseDate: promiseDate.trim(),
    promiseAmount: Math.round(amount * 100) / 100,
    ...(previousWaada ? { previousWaada } : {})
  };
  const waadaed = setCustomerWaada(customer, {
    promiseDate: promiseDate.trim(),
    promiseAmount: Math.round(amount * 100) / 100,
    promiseNote: REMAINDER_WAADA_NOTE
  });
  return {
    ...waadaed,
    bills: bills.map((row) => row.month !== month ? row : {
      ...row,
      payments: (row.payments ?? []).map((rowPayment) => rowPayment.id === paymentId
        ? { ...rowPayment, remainderWaada: stamp }
        : rowPayment)
    })
  };
}

/**
 * Tier of one customer in a collection queue. outstanding must be the
 * customer's total unpaid balance (PKR). Returns 'broken' | 'promised' |
 * 'active', or null when the customer has no outstanding balance (not queued).
 * An invalid stored promiseDate is treated as no promise.
 */
export function getWaadaTier(customer, outstanding, todayStr = getWaadaTodayString()) {
  if (!customer || typeof customer !== 'object') return null;
  if (!(Number(outstanding) > 0)) return null;
  const promiseDate = typeof customer.promiseDate === 'string' ? customer.promiseDate.trim() : '';
  if (!promiseDate || !isValidWaadaDate(promiseDate)) return WAADA_TIERS.ACTIVE;
  return promiseDate < todayStr ? WAADA_TIERS.BROKEN : WAADA_TIERS.PROMISED;
}

/**
 * SISP-71: which Template Studio template (SISP-25, sisp_wa_templates_v1)
 * speaks for a Waada tier once the operator customizes it — broken
 * promises use the Broken Waada Alert, every other queued tier uses the
 * Polite Reminder. A pure string mapping on purpose: this module imports
 * nothing, and the rendering itself lives in whatsapp-templates.js
 * (renderCustomWaTemplate), which callers combine with this id.
 */
export function waadaTemplateIdForTier(tier) {
  if (tier === WAADA_TIERS.BROKEN) return 'brokenWaada';
  if (tier === WAADA_TIERS.ACTIVE || tier === WAADA_TIERS.PROMISED) return 'politeReminder';
  return null;
}

/** Badge label for a customer's promise, or null when no badge applies. */
export function waadaBadgeLabel(customer, todayStr = getWaadaTodayString()) {
  if (!customer || typeof customer !== 'object') return null;
  const promiseDate = typeof customer.promiseDate === 'string' ? customer.promiseDate.trim() : '';
  if (!promiseDate || !isValidWaadaDate(promiseDate)) return null;
  return promiseDate < todayStr
    ? `Waada Expired: ${promiseDate}`
    : `Waada: ${promiseDate}`;
}

/**
 * Plan O — overdue-age bands for broken promises, derived from
 * promiseDate vs today (no new stored fields). The plan lists the bands
 * as 1–3, 4–7, 8–15, 15+ days; day 15 cannot belong to two bands, so the
 * bands are read as 1–3, 4–7, 8–14, 15+ — every overdue day lands in
 * exactly one band, and the 15+ band still starts at day 15 as written.
 */
export const WAADA_AGE_BANDS = Object.freeze([
  Object.freeze({ id: '1-3', min: 1, max: 3, label: '1–3 days overdue' }),
  Object.freeze({ id: '4-7', min: 4, max: 7, label: '4–7 days overdue' }),
  Object.freeze({ id: '8-14', min: 8, max: 14, label: '8–14 days overdue' }),
  Object.freeze({ id: '15+', min: 15, max: Infinity, label: '15+ days overdue' })
]);

/**
 * Whole days a promise is overdue: today minus promiseDate in UTC
 * calendar days. Returns null for an invalid promiseDate, and 0 for a
 * promise that is due today or still in the future (not overdue).
 */
export function waadaOverdueDays(promiseDate, todayStr = getWaadaTodayString()) {
  const promise = parseWaadaParts(typeof promiseDate === 'string' ? promiseDate.trim() : '');
  const today = parseWaadaParts(typeof todayStr === 'string' ? todayStr.trim() : '');
  if (!promise || !today) return null;
  const promiseMs = Date.UTC(promise.year, promise.month - 1, promise.day);
  const todayMs = Date.UTC(today.year, today.month - 1, today.day);
  return Math.max(0, Math.round((todayMs - promiseMs) / 86400000));
}

/** Age-band id for a promise ('1-3' | '4-7' | '8-14' | '15+'), or null when not overdue. */
export function waadaAgeBand(promiseDate, todayStr = getWaadaTodayString()) {
  const days = waadaOverdueDays(promiseDate, todayStr);
  if (days === null || days < 1) return null;
  return (WAADA_AGE_BANDS.find((band) => days >= band.min && days <= band.max) || WAADA_AGE_BANDS[WAADA_AGE_BANDS.length - 1]).id;
}

/**
 * Splits queue entries into the 3 tiers. entries: [{ customer, outstanding }].
 * Customers with no outstanding balance are excluded (they are not queued).
 * Sort: broken by promiseDate ascending (most overdue first), then
 * outstanding descending; active by outstanding descending; promised by
 * promiseDate ascending, then outstanding descending.
 * Plan O: broken items also carry overdueDays + ageBand, and the return
 * gains brokenByAgeBand (the same broken items grouped by band, in band
 * order) plus brokenAgeBandCounts — the follow-up queue is grouped by
 * age band without changing the existing tier buckets.
 */
export function tierWaadaQueue(entries, todayStr = getWaadaTodayString()) {
  const broken = [];
  const active = [];
  const promised = [];
  for (const entry of Array.isArray(entries) ? entries : []) {
    const customer = entry?.customer;
    const outstanding = Number(entry?.outstanding ?? 0);
    if (!customer || !(outstanding > 0)) continue;
    const tier = getWaadaTier(customer, outstanding, todayStr);
    if (!tier) continue;
    const item = {
      customer,
      outstanding,
      tier,
      promiseDate: typeof customer.promiseDate === 'string' ? customer.promiseDate.trim() : null,
      promiseAmount: customer.promiseAmount ?? null,
      promiseNote: customer.promiseNote ?? ''
    };
    if (tier === WAADA_TIERS.BROKEN) {
      item.overdueDays = waadaOverdueDays(customer.promiseDate, todayStr);
      item.ageBand = waadaAgeBand(customer.promiseDate, todayStr);
      broken.push(item);
    }
    else if (tier === WAADA_TIERS.PROMISED) promised.push(item);
    else active.push(item);
  }
  broken.sort((a, b) =>
    String(a.promiseDate).localeCompare(String(b.promiseDate)) || b.outstanding - a.outstanding);
  active.sort((a, b) => b.outstanding - a.outstanding);
  promised.sort((a, b) =>
    String(a.promiseDate).localeCompare(String(b.promiseDate)) || b.outstanding - a.outstanding);
  const brokenByAgeBand = {};
  for (const band of WAADA_AGE_BANDS) brokenByAgeBand[band.id] = [];
  for (const item of broken) {
    if (item.ageBand && brokenByAgeBand[item.ageBand]) brokenByAgeBand[item.ageBand].push(item);
  }
  const brokenAgeBandCounts = {};
  for (const band of WAADA_AGE_BANDS) brokenAgeBandCounts[band.id] = brokenByAgeBand[band.id].length;
  return { broken, active, promised, brokenByAgeBand, brokenAgeBandCounts };
}

/**
 * Plan O: the broken-promise follow-up list grouped by age band.
 * Returns [{ id, label, count, totalOutstanding, items }] in band
 * order — the same items tierWaadaQueue puts in `broken`, grouped so a
 * collector works the oldest band first. Bands with no items are kept
 * (count 0) so the UI can show every band, not just the populated ones.
 */
export function groupBrokenWaadaByAgeBand(entries, todayStr = getWaadaTodayString()) {
  const { broken, brokenByAgeBand } = tierWaadaQueue(entries, todayStr);
  void broken;
  return WAADA_AGE_BANDS.map((band) => {
    const items = brokenByAgeBand[band.id];
    return {
      id: band.id,
      label: band.label,
      count: items.length,
      totalOutstanding: Math.round(items.reduce((sum, item) => sum + item.outstanding, 0) * 100) / 100,
      items
    };
  });
}

/**
 * Auto-clear rule (spec): recording a FULL payment of the customer's pending
 * balance clears the promise. Pure helper — the caller supplies the
 * post-payment outstanding balance.
 * Returns { customer, cleared } (customer is a new object when cleared).
 */
export function clearWaadaOnFullPayment(customer, outstanding) {
  if (!customer || typeof customer !== 'object') return { customer, cleared: false };
  const hasPromise = typeof customer.promiseDate === 'string' && customer.promiseDate.trim() !== '';
  if (!hasPromise || Number(outstanding) > 0) return { customer, cleared: false };
  return { customer: clearCustomerWaada(customer), cleared: true };
}

// ============================================================================
// WAADA RELIABILITY SCORE (SISP-98)
// ============================================================================

/**
 * SISP-98: Waada reliability score — how many of a customer's promises were
 * KEPT vs BROKEN, derived PURELY from recorded data. There are deliberately
 * NO stored counters: the score is a pure function of the ledger, so
 * re-renders, reloads and backup restores recompute the identical numbers
 * and can never double-count a resolution.
 *
 *   kept   — a non-voided payment carries a SISP-34 `clearedWaada` stamp
 *            (recording it fully settled the balance, so core.addPayment
 *            auto-cleared the promise and stamped the payment with it) and
 *            the payment's own date is on or before the stamped promise
 *            date: the customer paid on/before the promised date.
 *   broken — the mirror image: a stamped payment dated AFTER the stamped
 *            promise date (the promise expired unpaid, then was paid
 *            late), PLUS the customer's currently-live promise when its
 *            tier is 'broken' right now (expired, still unpaid) — judged
 *            by the same getWaadaTier definition the queues use, never a
 *            second broken-promise definition.
 *
 * Void interplay (SISP-34): voided payments are skipped everywhere in this
 * app, so a voided clearing payment's stamp counts for nothing — and the
 * void itself restores the stamped promise onto the customer, where the
 * live-tier term picks it up again while it is expired and unpaid. A void
 * therefore unwinds the score exactly, with no bookkeeping of its own.
 *
 * Honest limits (nothing is invented): a promise enters the score only
 * when it resolves ON THE RECORD. Kept/late-paid resolutions need the
 * SISP-34 stamp, so promises cleared by payments recorded before that
 * stamp existed leave no trace and are not reconstructed. Snoozing a
 * promise replaces its date (setCustomerWaada), so a re-promised promise
 * is judged at its new date — exactly how the queues judge it — and a
 * promise the owner clears by hand without payment leaves no trace
 * either.
 *
 * outstanding is the customer's total unpaid balance (PKR) from the same
 * allocation engine the tiers use. Returns { kept, broken, total }.
 */
export function computeWaadaScore(customer, outstanding, todayStr = getWaadaTodayString()) {
  const score = { kept: 0, broken: 0, total: 0 };
  if (!customer || typeof customer !== 'object') return score;
  for (const bill of Array.isArray(customer.bills) ? customer.bills : []) {
    for (const payment of Array.isArray(bill?.payments) ? bill.payments : []) {
      if (!payment || typeof payment !== 'object' || payment.voided === true) continue;
      const stamp = payment.clearedWaada;
      if (!stamp || typeof stamp !== 'object') continue;
      const promised = typeof stamp.promiseDate === 'string' ? stamp.promiseDate.trim() : '';
      const paidOn = typeof payment.date === 'string' ? payment.date.trim() : '';
      if (!isValidWaadaDate(promised) || !isValidWaadaDate(paidOn)) continue;
      if (paidOn <= promised) score.kept += 1;
      else score.broken += 1;
    }
  }
  if (getWaadaTier(customer, outstanding, todayStr) === WAADA_TIERS.BROKEN) score.broken += 1;
  score.total = score.kept + score.broken;
  return score;
}

// ============================================================================
// CHIP DIALOG CONTROLLER (DOM; returns null outside a browser)
// ============================================================================

/**
 * Wires the small Waada chip dialog (markup lives in index.html).
 * options: getCustomer(id) -> live customer object (or null),
 *          getToday() -> YYYY-MM-DD (defaults to PKT today),
 *          onApply(updatedCustomer) -> host persists + refreshes views,
 *          onToast(msg) -> optional toast.
 * Returns { open(customerId), close() } or null when no document exists.
 * The dialog never touches storage itself — the host owns persistence.
 */
export function setupWaadaChipDialog({ getCustomer, getToday, onApply, onToast } = {}) {
  if (typeof document === 'undefined') return null;
  const dialog = document.getElementById('waadaChipDialog');
  if (!dialog) return null;
  const customerLabel = document.getElementById('waadaChipCustomerLabel');
  const currentLine = document.getElementById('waadaChipCurrent');
  const customInput = document.getElementById('waadaChipCustomDate');
  const setCustomBtn = document.getElementById('waadaChipSetCustomBtn');
  const clearBtn = document.getElementById('waadaChipClearBtn');
  const closeBtn = document.getElementById('waadaChipCloseBtn');

  let currentCustomerId = null;
  const todayStr = () => (typeof getToday === 'function' ? getToday() : getWaadaTodayString());

  const close = () => {
    if (dialog.close) dialog.close();
    else dialog.hidden = true;
    currentCustomerId = null;
  };

  const renderCurrent = (customer) => {
    if (customerLabel) {
      customerLabel.textContent = customer
        ? `${customer.name || 'Subscriber'}${customer.customerNumber != null ? ` (#${customer.customerNumber})` : ''}`
        : 'No customer selected';
    }
    if (currentLine) {
      if (!customer) {
        currentLine.textContent = '';
      } else if (customer.promiseDate) {
        const pd = String(customer.promiseDate).trim();
        const badge = isValidWaadaDate(pd) && pd < todayStr() ? ' — Waada Expired' : ' — Waada set';
        currentLine.textContent = `Current: ${customer.promiseDate}${customer.promiseAmount ? ` · PKR ${Number(customer.promiseAmount).toLocaleString()}` : ''}${customer.promiseNote ? ` · ${customer.promiseNote}` : ''}${badge}`;
      } else {
        currentLine.textContent = 'Current: no promise set.';
      }
    }
    if (customInput) customInput.value = '';
  };

  const apply = (updated, message) => {
    if (typeof onApply === 'function') onApply(updated);
    if (message && typeof onToast === 'function') onToast(message);
    const customer = typeof getCustomer === 'function' ? getCustomer(currentCustomerId) : null;
    if (customer) renderCurrent(customer);
    else close();
  };

  const applyChip = (chip) => {
    const customer = typeof getCustomer === 'function' ? getCustomer(currentCustomerId) : null;
    if (!customer) {
      if (typeof onToast === 'function') onToast('Customer not found.');
      return;
    }
    const date = computeWaadaChipDate(chip, todayStr(), customInput ? customInput.value : null);
    if (!date) {
      if (typeof onToast === 'function') onToast('Pick a valid date first.');
      return;
    }
    try {
      const updated = setCustomerWaada(customer, {
        promiseDate: date,
        promiseAmount: customer.promiseAmount ?? null,
        promiseNote: customer.promiseNote ?? ''
      });
      apply(updated, `Waada set: ${date}.`);
    } catch (err) {
      if (typeof onToast === 'function') onToast(err?.message || 'Could not set promise.');
    }
  };

  dialog.querySelectorAll('[data-waada-chip]').forEach(btn => {
    btn.addEventListener('click', () => applyChip(btn.getAttribute('data-waada-chip')));
  });
  if (setCustomBtn) setCustomBtn.addEventListener('click', () => applyChip('custom'));
  if (clearBtn) clearBtn.addEventListener('click', () => {
    const customer = typeof getCustomer === 'function' ? getCustomer(currentCustomerId) : null;
    if (!customer) return;
    apply(clearCustomerWaada(customer), 'Waada promise cleared.');
  });
  if (closeBtn) closeBtn.addEventListener('click', close);
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) close();
  });

  return {
    open(customerId) {
      currentCustomerId = customerId;
      const customer = typeof getCustomer === 'function' ? getCustomer(customerId) : null;
      renderCurrent(customer);
      if (dialog.showModal) dialog.showModal();
      else dialog.hidden = false;
    },
    close
  };
}
