/**
 * Package, monthly fee and connection date on "Add a customer" (#289).
 *
 * The Add Customer form only asked for name / CNIC / phone / address / area / zone, so a new
 * connection had no fee and never showed up in Quick Collect or Bulk Collect until the owner
 * found Customer Info → Edit. This module adds three optional fields to the form:
 *  - Package: a pick from the package catalogue (BILL_PACKAGES), which fills in the fee;
 *  - Monthly fee (PKR): editable, so a custom price works too;
 *  - Connection date: defaults to today (Pakistan date).
 * After the app saves the new customer (its own validation and duplicate check are untouched),
 * the plan goes through the existing billing logic: core updateCustomerProfile (the same path as
 * the profile Edit form, keeping package history) and generateMonthlyBillsThroughCurrentMonth,
 * committed via the app's normal save (quickCollectModalController.commitState). The customer
 * is pending in Quick Collect / Bulk Collect straight away. Name-only adds still work.
 *
 * The profile Edit form already has Package / speed, Monthly selling amount and Connection date;
 * it gets the same package picker, which fills both fields.
 */
import { updateCustomerProfile, generateMonthlyBillsThroughCurrentMonth } from './core.js';
import { BILL_PACKAGES } from './package-catalog.js';
import { getPakistanLocalDate } from './nav-quick-collect.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const pkr = n => `PKR ${Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`;

/** Read the plan fields. Returns null when nothing billing-related was entered. */
export function normalizePlan({ packageId = '', fee = '', connectionDate = '' } = {}) {
  const plan = packageId ? BILL_PACKAGES.find(p => p.id === packageId) : null;
  if (packageId && !plan) throw new Error('Choose one of the available packages.');
  const rawFee = String(fee ?? '').trim();
  const amount = rawFee === '' ? (plan ? plan.price : null) : Number(rawFee);
  if (amount !== null && (!Number.isFinite(amount) || amount <= 0)) throw new Error('Monthly fee must be greater than zero, or leave it empty.');
  if (!plan && amount === null) return connectionDate ? { packageLabel: '', fee: null, connectionDate } : null;
  return { packageLabel: plan ? plan.label : '', fee: amount, connectionDate: connectionDate || null };
}

/**
 * Apply a plan to a (new) customer with the existing billing logic and create this month's bill.
 * Returns { nextState, billed } where billed is the current month's bill (or null).
 */
export function applyCustomerPlan(state, customerId, plan, referenceDate = new Date()) {
  if (!plan) return { nextState: state, billed: null };
  const values = {};
  if (plan.packageLabel) values.packageSpeed = plan.packageLabel;
  if (plan.fee !== null && plan.fee !== undefined) values.monthlySellingAmount = plan.fee;
  if (plan.connectionDate) values.connectionDate = plan.connectionDate;
  if (!Object.keys(values).length) return { nextState: state, billed: null };
  values.packageChangeStaffName = 'Add customer';
  let next = updateCustomerProfile(state, customerId, values, referenceDate);
  if (values.monthlySellingAmount) next = generateMonthlyBillsThroughCurrentMonth(next, referenceDate);
  const month = getPakistanLocalDate(referenceDate).slice(0, 7);
  const billed = next.customers.find(c => c.id === customerId)?.bills?.find(b => b.month === month) ?? null;
  return { nextState: next, billed };
}

const packageOptions = (placeholder) => `<option value="">${esc(placeholder)}</option>${BILL_PACKAGES.map(p =>
  `<option value="${esc(p.id)}" data-price="${p.price}">${esc(p.label)} · ${esc(pkr(p.price))}</option>`).join('')}`;

export function setupCustomerPlan({ win = window, doc = document, getController = () => win.quickCollectModalController } = {}) {
  const form = doc.getElementById('addCustomerForm');
  const fields = doc.getElementById('newCustomerFields');
  if (!form || !fields || doc.getElementById('newCustomerPackage')) return null;
  const today = () => getPakistanLocalDate();

  const group = doc.createElement('div');
  group.className = 'cp-plan-group';
  group.innerHTML = `
    <p class="cp-plan-heading">Package &amp; billing <span class="optional-label">Optional · makes the customer collectable today</span></p>
    <label class="field-label" for="newCustomerPackage">Package</label>
    <select id="newCustomerPackage" name="packageId">${packageOptions('No package yet / custom fee')}</select>
    <div class="cp-plan-row">
      <div class="cp-plan-cell">
        <label class="field-label" for="newCustomerFee">Monthly fee (PKR)</label>
        <input id="newCustomerFee" name="monthlyFee" type="number" min="1" step="1" inputmode="numeric" placeholder="e.g. 1500">
      </div>
      <div class="cp-plan-cell">
        <label class="field-label" for="newCustomerConnectionDate">Connection date</label>
        <input id="newCustomerConnectionDate" name="connectionDate" type="date">
      </div>
    </div>
    <p id="newCustomerPlanHint" class="cp-plan-hint" aria-live="polite"></p>`;
  const errorBox = doc.getElementById('addCustomerError');
  // Right after Name / CNIC / Phone, before the optional address fields.
  const anchor = doc.getElementById('newCustomerPhoneHint')?.nextElementSibling || errorBox || fields.lastElementChild;
  fields.insertBefore(group, anchor);

  const pkgSel = group.querySelector('#newCustomerPackage');
  const feeInput = group.querySelector('#newCustomerFee');
  const dateInput = group.querySelector('#newCustomerConnectionDate');
  const hint = group.querySelector('#newCustomerPlanHint');
  const setToday = () => { const t = today(); dateInput.max = ''; dateInput.defaultValue = t; if (!dateInput.value) dateInput.value = t; };
  setToday();

  const updateHint = () => {
    const fee = Number(feeInput.value);
    hint.textContent = fee > 0
      ? `This month's bill of ${pkr(fee)} is created on save, so the customer shows as pending in Quick Collect and Bulk Collect.`
      : 'No fee: the customer is saved without a bill (set it later in Customer Info → Edit).';
    hint.dataset.state = fee > 0 ? 'billed' : 'none';
  };
  pkgSel.addEventListener('change', () => {
    const price = pkgSel.selectedOptions[0]?.dataset.price;
    if (price) feeInput.value = price;
    updateHint();
  });
  feeInput.addEventListener('input', () => {
    // A typed fee keeps the package label but no longer has to match its list price.
    updateHint();
  });
  form.addEventListener('reset', () => win.setTimeout(() => { setToday(); updateHint(); }, 0));
  doc.getElementById('addCustomerButton')?.addEventListener('click', () => win.setTimeout(() => { setToday(); updateHint(); }, 0));
  updateHint();

  // Apply the plan once the app has saved the customer (submit or "continue anyway").
  function watchSave() {
    const before = getController()?.getState?.();
    if (!before) return;
    const known = new Set(before.customers.map(c => c.id));
    let plan;
    try {
      plan = normalizePlan({ packageId: pkgSel.value, fee: feeInput.value, connectionDate: dateInput.value });
    } catch (err) {
      return err; // reported by the capture listener
    }
    win.setTimeout(() => {
      const ctl = getController();
      const st = ctl?.getState?.();
      const added = st?.customers?.find(c => !known.has(c.id));
      if (!added || !plan) return;
      try {
        const { nextState, billed } = applyCustomerPlan(st, added.id, plan);
        ctl.commitState(nextState);
        const due = billed ? Number(billed.dueAmount) || 0 : 0;
        if (typeof win.toast === 'function' && due > 0) {
          win.toast(`Customer #${added.customerNumber} added · ${pkr(due)} bill created — pending in Quick Collect.`, {
            actionLabel: 'Collect first payment', onAction: () => getController()?.open?.(added.id), duration: 6000
          });
        }
        doc.dispatchEvent(new win.CustomEvent('customer-plan:applied', { detail: { customerId: added.id, due } }));
      } catch (err) {
        if (typeof win.toast === 'function') win.toast(`Customer saved, but the package/fee was not applied: ${err.message}`, { type: 'error', title: 'Package not applied' });
      }
    }, 0);
    return null;
  }
  form.addEventListener('submit', event => {
    const err = watchSave();
    if (err) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (errorBox) { errorBox.textContent = err.message; errorBox.hidden = false; }
      feeInput.focus();
    }
  }, true);
  doc.getElementById('continueNewCustomerAnyway')?.addEventListener('click', () => { watchSave(); }, true);

  // Profile Edit form: a package picker that fills Package / speed + Monthly selling amount.
  const speedInput = doc.getElementById('packageSpeedInput');
  const sellInput = doc.getElementById('monthlySellingAmountInput');
  const speedLabel = speedInput?.closest('label');
  if (speedLabel && sellInput && !doc.getElementById('profilePackagePicker')) {
    const pick = doc.createElement('label');
    pick.className = 'profile-field cp-profile-picker';
    pick.setAttribute('for', 'profilePackagePicker');
    pick.innerHTML = `<span class="field-label">Pick a package <span class="optional-label">Fills package and monthly amount · still editable</span></span><select id="profilePackagePicker">${packageOptions('Choose a package…')}</select>`;
    speedLabel.parentNode.insertBefore(pick, speedLabel);
    const sel = pick.querySelector('select');
    sel.addEventListener('change', () => {
      const plan = BILL_PACKAGES.find(p => p.id === sel.value);
      if (!plan) return;
      speedInput.value = plan.label;
      sellInput.value = String(plan.price);
      for (const el of [speedInput, sellInput]) {
        el.dispatchEvent(new win.Event('input', { bubbles: true }));
        el.dispatchEvent(new win.Event('change', { bubbles: true }));
      }
    });
  }
  return { normalizePlan, applyCustomerPlan };
}

if (typeof window !== 'undefined' && typeof document !== 'undefined' && document.body) {
  setupCustomerPlan();
}
