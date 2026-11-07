// Plan 450 — Quick Collect new-customer quick add: a brand-new
// customer who walks in ready to pay is added from the picker
// itself — name, phone number, mohalla, package — and the payment
// form opens for them straight away, so the operator never leaves
// Quick Collect for a first payment. The full onboarding details
// can follow later instead of blocking the first payment.
//
// What already exists, and what this plan does NOT rebuild: the
// customer record itself (core addCustomer — name, phone, mohalla,
// automatic connection number), the package catalogue
// (BILL_PACKAGES), the billing path that turns a chosen package
// into a package label + monthly fee + this month's bill (core
// updateCustomerProfile + generateMonthlyBillsThroughCurrentMonth —
// the same path the Add Customer plan path uses), the name and
// phone validators (form-validation.js), and the picker + payment
// form (nav-quick-collect.js). The full onboarding checklist
// (Plan 16) is the one thing this plan never opens, reads, or
// changes: the quick-add creates the customer only and replaces
// no onboarding step. This module adds only the missing piece:
// the four-field validation, the creation through those existing
// paths, and the form markup.
//
// The module is standalone: it reads no storage, no clock, and no
// page, takes no other module's state, and never mutates an input.
// Every figure comes from the caller: the state, the four fields,
// and the reference date. A figure that is not a number is "not a
// number", never zero. A package is optional: with one, this
// month's bill is generated so the payment form opens with the
// full dues already suggested; without one, the customer is saved
// with no bill and the operator types the amount.

import { addCustomer, updateCustomerProfile, generateMonthlyBillsThroughCurrentMonth } from './core.js';
import { BILL_PACKAGES } from './package-catalog.js';
import { canonicalMohalla } from './phase3.js';
import { validateCustomerName, validatePakistanPhone } from './form-validation.js';

const QUICK_ADD_PHONE_CAP = 40;
const QUICK_ADD_MOHALLA_CAP = 100;

/** The quick-add form's element ids, in one place so the wiring and the tests agree. */
export const QUICK_ADD_FIELD_IDS = Object.freeze({
  form: 'ncaQuickAddForm',
  button: 'ncaNewCustomerButton',
  name: 'ncaName',
  phone: 'ncaPhone',
  mohalla: 'ncaMohalla',
  package: 'ncaPackage',
  error: 'ncaError',
  add: 'ncaAddButton',
  cancel: 'ncaCancelButton',
});

/** Format an amount the way the app shows money (min-0 decimals). */
export function formatQuickAddAmount(amount) {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return 'Not set';
  return `PKR ${Number(amount).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function cleanQuickAddText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/** Escapes HTML characters for safe template string interpolation. */
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

/**
 * Validate the four quick-add fields, or return the errors. Name,
 * phone number and mohalla are all required: a quick-add with no
 * name, no number, or no mohalla is refused. The phone must be a
 * usable number, not just typed characters — an incomplete number
 * (the validator's tip-only result) is refused too, because a
 * half-typed number can never receive a receipt or a follow-up.
 * The package is optional: blank means no package yet, and a
 * non-blank value must name one of the catalogue packages.
 *
 * @param {Object} input - { name, phone, mohalla, packageId }.
 * @returns {{ values: { name: string, phone: string, mohalla: string, packageId: string, package: Object|null }, errors: Object }}
 */
export function validateQuickAddCustomer(input = {}) {
  const errors = {};
  const values = { name: '', phone: '', mohalla: '', packageId: '', package: null };

  const nameCheck = validateCustomerName(input?.name);
  if (!nameCheck.valid) {
    errors.name = nameCheck.message || 'Customer name is required.';
  } else {
    values.name = nameCheck.cleanName;
  }

  const phone = cleanQuickAddText(input?.phone);
  if (!phone) {
    errors.phone = 'Phone number is required.';
  } else if (phone.length > QUICK_ADD_PHONE_CAP) {
    errors.phone = 'Phone number must be 40 characters or fewer.';
  } else {
    const phoneCheck = validatePakistanPhone(phone);
    if (!phoneCheck.valid) {
      errors.phone = phoneCheck.message || 'Please enter a valid phone number.';
    } else {
      values.phone = phone;
    }
  }

  const mohallaRaw = cleanQuickAddText(input?.mohalla);
  if (!mohallaRaw) {
    errors.mohalla = 'Mohalla is required.';
  } else if (mohallaRaw.length > QUICK_ADD_MOHALLA_CAP) {
    errors.mohalla = 'Mohalla must be 100 characters or fewer.';
  } else {
    values.mohalla = canonicalMohalla(mohallaRaw)?.stored ?? mohallaRaw;
  }

  const packageId = cleanQuickAddText(input?.packageId);
  if (packageId !== '') {
    const plan = BILL_PACKAGES.find((p) => p.id === packageId) ?? null;
    if (!plan) {
      errors.package = 'Choose one of the available packages.';
    } else {
      values.packageId = plan.id;
      values.package = plan;
    }
  }

  return { values, errors };
}

/**
 * Create the quick-added customer through the existing paths and
 * return the new state with them in it, or return the errors and
 * create nothing. The record is built by core addCustomer (name,
 * phone, mohalla, automatic connection number); a chosen package
 * then goes through the same billing path as the Add Customer plan
 * path — package label + monthly fee on the profile, then this
 * month's bill generated — so the new customer shows dues in the
 * picker straight away. Without a package there is no bill and no
 * fee, and the operator types the amount. A name that already
 * exists is refused (addCustomer's own duplicate guard) so the
 * operator picks the existing customer instead of making a second
 * record. Nothing else is touched: no bill, payment, or other
 * customer record ever changes, and no onboarding step is opened
 * or recorded.
 *
 * @param {Object} state - the app state.
 * @param {Object} input - { name, phone, mohalla, packageId }.
 * @param {Date} [referenceDate] - passed through to the core paths.
 * @returns {{ ok: true, nextState: Object, customer: Object, billed: Object|null, package: Object|null } | { ok: false, errors: Object }}
 */
export function quickAddCustomer(state, input, referenceDate) {
  const { values, errors } = validateQuickAddCustomer(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  let added;
  try {
    added = addCustomer(state, values.name, referenceDate, {
      phone: values.phone,
      mohalla: values.mohalla,
    });
  } catch (err) {
    const message = err?.message ? String(err.message) : 'Could not add this customer.';
    return { ok: false, errors: { name: message } };
  }
  const createdId = added.customers.at(-1)?.id ?? null;
  if (!createdId) return { ok: false, errors: { form: 'Could not add this customer.' } };
  let next = added;
  let billed = null;
  if (values.package) {
    try {
      next = updateCustomerProfile(next, createdId, {
        packageSpeed: values.package.label,
        monthlySellingAmount: values.package.price,
        packageChangeStaffName: 'Quick Collect',
      }, referenceDate);
      next = generateMonthlyBillsThroughCurrentMonth(next, referenceDate);
    } catch (err) {
      const message = err?.message ? String(err.message) : 'Could not set the package for this customer.';
      return { ok: false, errors: { form: message } };
    }
    const created = next.customers.find((c) => c.id === createdId);
    const bills = [...(created?.bills ?? [])].sort((a, b) => String(b.month ?? '').localeCompare(String(a.month ?? '')));
    billed = bills[0] ?? null;
  }
  const customer = next.customers.find((c) => c.id === createdId) ?? null;
  if (!customer) return { ok: false, errors: { form: 'Could not add this customer.' } };
  return { ok: true, nextState: next, customer, billed, package: values.package };
}

/**
 * The quick-added customer as one plain-text line, for the
 * screen-reader announcement and for tests: connection number,
 * name, mohalla, and — when a package was picked — the package
 * with its monthly fee and this month's bill. Without a package
 * the line says so plainly, so the operator knows to type the
 * amount instead of expecting dues.
 */
export function quickAddCustomerSummaryText(result) {
  if (!result || result.ok !== true || !result.customer) return '';
  const customer = result.customer;
  const base = `New customer #${customer.customerNumber} ${customer.name} (${customer.mohalla || 'Mohalla not recorded'}) added`;
  if (result.package && result.billed) {
    return `${base} · ${result.package.label} — ${formatQuickAddAmount(result.package.price)}/month · This month's bill ${formatQuickAddAmount(result.billed.dueAmount)}`;
  }
  if (result.package) {
    return `${base} · ${result.package.label} — ${formatQuickAddAmount(result.package.price)}/month · No bill yet`;
  }
  return `${base} · No package yet — type the amount`;
}

/**
 * The quick-add form's fields, rendered into the picker step's
 * form host by the wiring. Name, phone and mohalla are required;
 * the mohalla input reuses the app's mohalla list; the package
 * select lists the catalogue with each monthly fee, blank for no
 * package yet. No user value is ever rendered here, so nothing
 * needs escaping.
 */
export function quickAddFormFieldsHtml() {
  const packageOptions = `<option value="">No package yet</option>${BILL_PACKAGES.map((p) =>
    `<option value="${escapeHtml(p.id)}">${escapeHtml(p.label)} · ${escapeHtml(formatQuickAddAmount(p.price))}/month</option>`).join('')}`;
  return `<p>New customer — name, phone, mohalla, package. The full onboarding details can follow later.</p>`
    + `<div class="qc-field-group"><label class="field-label" for="ncaName">Name <span class="qc-required">*</span></label>`
    + `<input id="ncaName" class="qc-input" type="text" maxlength="100" autocomplete="off" placeholder="Customer name"></div>`
    + `<div class="qc-field-group"><label class="field-label" for="ncaPhone">Phone number <span class="qc-required">*</span></label>`
    + `<input id="ncaPhone" class="qc-input" type="tel" inputmode="tel" maxlength="40" autocomplete="off" placeholder="03012345678"></div>`
    + `<div class="qc-field-group"><label class="field-label" for="ncaMohalla">Mohalla <span class="qc-required">*</span></label>`
    + `<input id="ncaMohalla" class="qc-input" type="text" list="mohallaOptions" maxlength="100" autocomplete="off" placeholder="Pick a mohalla or type a new one"></div>`
    + `<div class="qc-field-group"><label class="field-label" for="ncaPackage">Package <span class="optional-label">Optional</span></label>`
    + `<select id="ncaPackage" class="qc-input">${packageOptions}</select></div>`
    + `<p id="ncaError" class="field-error" role="alert" hidden></p>`
    + `<div><button id="ncaAddButton" type="submit" class="primary-button">Add &amp; continue to payment</button> `
    + `<button id="ncaCancelButton" type="button" class="secondary-button">Cancel</button></div>`;
}
