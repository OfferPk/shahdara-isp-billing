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
  values.packageChangeStaffName = plan.staffName || 'Add customer';
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

export function setupInlineBillEdit({ win = window, doc = document, getController = () => win.quickCollectModalController } = {}) {
  let dialog = doc.getElementById('inlineBillEditDialog');
  if (!dialog) {
    dialog = doc.createElement('dialog');
    dialog.id = 'inlineBillEditDialog';
    dialog.className = 'modal inline-bill-dialog';
    dialog.setAttribute('aria-labelledby', 'inlineBillEditTitle');
    dialog.innerHTML = `
      <div class="modal-content inline-bill-modal-content">
        <div class="modal-heading">
          <div>
            <p class="eyebrow" id="inlineBillEditEyebrow">MONTHLY BILL</p>
            <h2 id="inlineBillEditTitle">Set monthly bill</h2>
          </div>
          <button class="close-button" type="button" data-close-dialog aria-label="Close">↩</button>
        </div>
        <form id="inlineBillEditForm" method="dialog" novalidate>
          <p id="inlineBillCustomerInfo" class="inline-bill-customer-info"></p>
          
          <div class="field-group">
            <label class="field-label" for="inlineBillFeeInput">Monthly fee (PKR) <span class="required-indicator">*</span></label>
            <input id="inlineBillFeeInput" name="monthlyFee" type="number" min="1" step="1" inputmode="numeric" placeholder="e.g. 1500" required>
          </div>

          <div class="inline-bill-quick-picks" aria-label="Quick pick common fees">
            <span class="quick-pick-label">Quick pick:</span>
            <div class="quick-pick-chips">
              <button type="button" class="chip-btn" data-fee="1000">Rs 1,000</button>
              <button type="button" class="chip-btn" data-fee="1500">Rs 1,500</button>
              <button type="button" class="chip-btn" data-fee="2000">Rs 2,000</button>
              <button type="button" class="chip-btn" data-fee="2500">Rs 2,500</button>
              <button type="button" class="chip-btn" data-fee="3000">Rs 3,000</button>
            </div>
          </div>

          <div class="field-group">
            <label class="field-label" for="inlineBillPackageSelect">Package <span class="optional-label">Optional · e.g. 15MBPS</span></label>
            <select id="inlineBillPackageSelect" name="packageId">
              ${packageOptions('No package yet / custom fee')}
            </select>
          </div>

          <p id="inlineBillError" class="field-error-message" role="alert" hidden></p>
          <p id="inlineBillHint" class="inline-bill-hint" aria-live="polite">
            This month's bill is created on save, so the customer shows as pending in Quick Collect and Bulk Collect.
          </p>

          <div class="modal-actions">
            <button id="inlineBillCancelBtn" class="secondary-button" type="button" data-close-dialog>Cancel</button>
            <button id="inlineBillSaveBtn" class="primary-button" type="submit">Save Bill</button>
          </div>
        </form>
      </div>`;
    doc.body.appendChild(dialog);
  }

  const form = dialog.querySelector('#inlineBillEditForm');
  const feeInput = dialog.querySelector('#inlineBillFeeInput');
  const pkgSelect = dialog.querySelector('#inlineBillPackageSelect');
  const eyebrowEl = dialog.querySelector('#inlineBillEditEyebrow');
  const titleEl = dialog.querySelector('#inlineBillEditTitle');
  const custInfoEl = dialog.querySelector('#inlineBillCustomerInfo');
  const errorBox = dialog.querySelector('#inlineBillError');
  const submitBtn = dialog.querySelector('#inlineBillSaveBtn');

  // Close handlers
  dialog.querySelectorAll('[data-close-dialog]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    });
  });

  // Package select changes fee
  pkgSelect.addEventListener('change', () => {
    const opt = pkgSelect.selectedOptions[0];
    const price = opt?.dataset.price;
    if (price) feeInput.value = price;
    if (errorBox) errorBox.hidden = true;
  });

  // Quick pick chips
  dialog.querySelectorAll('.inline-bill-quick-picks [data-fee]').forEach(btn => {
    btn.addEventListener('click', () => {
      feeInput.value = btn.dataset.fee;
      if (errorBox) errorBox.hidden = true;
      feeInput.focus();
    });
  });

  feeInput.addEventListener('input', () => {
    if (errorBox) errorBox.hidden = true;
  });

  function open(customerId) {
    const ctl = getController();
    const st = ctl?.getState?.();
    const customer = st?.customers?.find(c => c.id === customerId);
    if (!customer) return;

    dialog.dataset.customerId = customer.id;
    const hasFee = customer.monthlySellingAmount !== null && customer.monthlySellingAmount !== undefined && Number(customer.monthlySellingAmount) > 0;

    eyebrowEl.textContent = hasFee ? 'EDIT MONTHLY BILL' : 'SET MONTHLY BILL';
    titleEl.textContent = hasFee ? 'Edit monthly bill' : 'Set monthly bill';
    submitBtn.textContent = hasFee ? 'Update Bill' : 'Save Bill';

    custInfoEl.textContent = `#${customer.customerNumber} · ${customer.name}${customer.phone ? ` (${customer.phone})` : ''} · Area: ${customer.mohalla || customer.area || 'Not set'}`;

    feeInput.value = hasFee ? String(customer.monthlySellingAmount) : '';
    
    // Select package if matching
    pkgSelect.value = '';
    if (customer.packageSpeed) {
      const match = BILL_PACKAGES.find(p => p.label === customer.packageSpeed || p.id === customer.packageSpeed);
      if (match) pkgSelect.value = match.id;
    }

    if (errorBox) {
      errorBox.textContent = '';
      errorBox.hidden = true;
    }

    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }

    win.setTimeout(() => {
      feeInput.focus();
      feeInput.select?.();
    }, 50);
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    const feeVal = Number(feeInput.value.trim());
    if (!Number.isFinite(feeVal) || feeVal <= 0) {
      if (errorBox) {
        errorBox.textContent = 'Monthly fee must be a positive number greater than zero.';
        errorBox.hidden = false;
      }
      feeInput.focus();
      return;
    }

    const ctl = getController();
    const beforeState = ctl?.getState?.();
    const customerId = dialog.dataset.customerId;
    const customer = beforeState?.customers?.find(c => c.id === customerId);
    if (!customer) return;

    const selectedPkg = BILL_PACKAGES.find(p => p.id === pkgSelect.value);
    const plan = {
      packageLabel: selectedPkg ? selectedPkg.label : (customer.packageSpeed || ''),
      fee: feeVal,
      connectionDate: customer.connectionDate || null,
      staffName: 'Inline edit'
    };

    try {
      const { nextState } = applyCustomerPlan(beforeState, customer.id, plan);
      ctl.commitState(nextState);

      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');

      const custName = customer.name;
      const custNum = customer.customerNumber;
      if (typeof win.toast === 'function') {
        win.toast(`Monthly bill of PKR ${feeVal.toLocaleString()} set for #${custNum} ${custName}`, {
          type: 'success',
          actionLabel: 'Undo',
          duration: 8000,
          onAction: () => {
            ctl.commitState(beforeState);
            if (typeof win.toast === 'function') {
              win.toast(`Restored previous billing for #${custNum} ${custName}`);
            }
          }
        });
      }

      // Fast entry: move focus to next unset customer card
      win.setTimeout(() => {
        const nextUnset = doc.querySelector('.customer-billing-badge[data-inline-bill-edit][data-bill-unset="true"]');
        if (nextUnset) {
          nextUnset.focus();
        }
      }, 50);
    } catch (err) {
      if (errorBox) {
        errorBox.textContent = err.message;
        errorBox.hidden = false;
      }
    }
  });

  // Wire delegated click & keyboard on document for customer cards
  doc.addEventListener('click', event => {
    const btn = event.target.closest('[data-inline-bill-edit]');
    if (btn) {
      event.preventDefault();
      event.stopPropagation();
      const customerId = btn.dataset.inlineBillEdit;
      if (customerId) {
        open(customerId);
      }
    }
  });

  doc.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      const btn = event.target.closest('[data-inline-bill-edit]');
      if (btn) {
        event.preventDefault();
        const customerId = btn.dataset.inlineBillEdit;
        if (customerId) {
          open(customerId);
        }
      }
    }
  });

  if (win) {
    win.openInlineBillEditor = open;
  }

  return { open };
}

if (typeof window !== 'undefined' && typeof document !== 'undefined' && document.body) {
  setupCustomerPlan();
  setupInlineBillEdit();
}
