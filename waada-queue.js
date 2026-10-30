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
 * The "10th of Month" chip date: the 10th of the current month when today is
 * on or before the 10th, otherwise the 10th of next month (a promise date in
 * the past would instantly read as broken, so it always lands in the future).
 */
export function tenthOfMonthWaadaDate(todayStr) {
  const parts = parseWaadaParts(todayStr);
  if (!parts) return null;
  if (parts.day <= 10) return formatWaadaYmd(parts.year, parts.month, 10);
  let year = parts.year;
  let month = parts.month + 1;
  if (month > 12) {
    month = 1;
    year += 1;
  }
  return formatWaadaYmd(year, month, 10);
}

/**
 * One-tap chip dates. chip: 'plus2' | 'plus5' | 'tenth' | 'custom'.
 * Returns a YYYY-MM-DD string, or null for an unknown chip / invalid input.
 */
export function computeWaadaChipDate(chip, todayStr, customDate = null) {
  if (!isValidWaadaDate(todayStr)) return null;
  if (chip === 'plus2') return addWaadaDays(todayStr, 2);
  if (chip === 'plus5') return addWaadaDays(todayStr, 5);
  if (chip === 'tenth') return tenthOfMonthWaadaDate(todayStr);
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
 * Splits queue entries into the 3 tiers. entries: [{ customer, outstanding }].
 * Customers with no outstanding balance are excluded (they are not queued).
 * Sort: broken by promiseDate ascending (most overdue first), then
 * outstanding descending; active by outstanding descending; promised by
 * promiseDate ascending, then outstanding descending.
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
    if (tier === WAADA_TIERS.BROKEN) broken.push(item);
    else if (tier === WAADA_TIERS.PROMISED) promised.push(item);
    else active.push(item);
  }
  broken.sort((a, b) =>
    String(a.promiseDate).localeCompare(String(b.promiseDate)) || b.outstanding - a.outstanding);
  active.sort((a, b) => b.outstanding - a.outstanding);
  promised.sort((a, b) =>
    String(a.promiseDate).localeCompare(String(b.promiseDate)) || b.outstanding - a.outstanding);
  return { broken, active, promised };
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
