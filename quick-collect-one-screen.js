// Plan 426 — Quick Collect one-screen payment flow:
// one single screen for the whole quick payment (customer, amount,
// method, save) with no navigation in between. The screen only
// collects the four fields and validates them into a draft; the
// payment itself is recorded by the normal Quick Collect submit
// path, so a payment recorded on the one screen appears in the
// ledger exactly as a payment recorded the normal way. Leaving the
// screen without saving records nothing: this module records
// nothing, keeps no store, and never changes any bill, payment
// total, or customer record by itself.
export const QUICK_COLLECT_ONE_SCREEN_CHOOSE_CUSTOMER_TEXT = 'Choose customer';
export const QUICK_COLLECT_ONE_SCREEN_CHOOSE_METHOD_TEXT = 'Choose method';
export const QUICK_COLLECT_ONE_SCREEN_SAVE_TEXT = 'Save payment';
export const QUICK_COLLECT_ONE_SCREEN_BACK_TEXT = 'Back to picker';
export const QUICK_COLLECT_ONE_SCREEN_NO_CUSTOMER_TEXT = 'Choose a customer first.';
export const QUICK_COLLECT_ONE_SCREEN_NO_AMOUNT_TEXT = 'Enter an amount greater than zero.';
export const QUICK_COLLECT_ONE_SCREEN_NO_METHOD_TEXT = 'Choose a payment method.';
export const QUICK_COLLECT_ONE_SCREEN_BAD_DATE_TEXT = 'The payment date is not a valid date.';
export const QUICK_COLLECT_ONE_SCREEN_BAD_MONTH_TEXT = 'The bill month is not a valid month.';

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function customerDisplayName(customer) {
  if (!customer || typeof customer !== 'object') return '';
  const name = String(customer.name ?? customer.customerName ?? '').trim();
  return name;
}

function customerDisplayNumber(customer) {
  if (!customer || typeof customer !== 'object') return '';
  const number = customer.customerNumber ?? customer.number ?? '';
  const text = String(number).trim();
  return text;
}

// The customer options for the one-screen picker, sorted by name so
// the operator finds the customer without scrolling a long list.
// Entries without a usable id or name are skipped, never guessed.
// Archived customers are skipped too — the same rule as the picker
// (getPendingCollectionCustomers): an archived customer cannot
// receive payments, so the one screen never offers one.
export function quickCollectOneScreenCustomerOptions(customers) {
  const list = Array.isArray(customers) ? customers : [];
  const options = [];
  for (const customer of list) {
    if (!customer || typeof customer !== 'object') continue;
    if (customer.archived) continue;
    const id = String(customer.id ?? '').trim();
    const name = customerDisplayName(customer);
    if (!id || !name) continue;
    const number = customerDisplayNumber(customer);
    options.push({ value: id, label: number ? `${name} (#${number})` : name });
  }
  options.sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase()));
  return options;
}

// The method options for the one-screen picker, in the caller's
// order. Empty entries are skipped, never offered as a choice.
export function quickCollectOneScreenMethodOptions(methods) {
  const list = Array.isArray(methods) ? methods : [];
  const options = [];
  for (const method of list) {
    const value = String(method ?? '').trim();
    if (!value) continue;
    options.push({ value, label: value });
  }
  return options;
}

// The amount on the one screen, in cents. A null, undefined, empty,
// or boolean figure is "not a number", never zero; a figure that is
// not finite or not greater than zero is not an amount either.
export function quickCollectOneScreenAmountCents(amountText) {
  if (amountText === null || amountText === undefined || typeof amountText === 'boolean') return null;
  const text = String(amountText).trim();
  if (text === '') return null;
  const amount = Number(text);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100);
}

// PKR amounts on the one screen use the app's min-0 decimals: whole
// rupees print without decimals, paisa prints only when present.
export function quickCollectOneScreenFormatAmount(cents) {
  if (cents === null || cents === undefined || typeof cents === 'boolean') return '';
  const value = Number(cents);
  if (!Number.isFinite(value)) return '';
  const rupees = value / 100;
  return `PKR ${rupees.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

// The dues line shown once a customer is picked on the one screen.
// Empty when the dues figure is not a usable number. (Plan 525: the
// line names the payable figure — the same figure the amount field
// prefills — so a pending charge never makes the line disagree with
// the amount above it. The caller passes the prefilled figure; this
// function only formats and labels it.)
export function quickCollectOneScreenDuesText(duesCents) {
  if (duesCents === null || duesCents === undefined || typeof duesCents === 'boolean') return '';
  const value = Number(duesCents);
  if (!Number.isFinite(value) || value < 0) return '';
  return `Total payable: ${quickCollectOneScreenFormatAmount(value)}`;
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year, month) {
  const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return days[month - 1] ?? 0;
}

// A strict YYYY-MM-DD date. A month-only value or an impossible day
// (for example 2026-02-30) is not a date, never a guessed one.
export function quickCollectOneScreenIsStrictDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > daysInMonth(year, month)) return false;
  return true;
}

// A strict YYYY-MM bill month.
export function quickCollectOneScreenIsStrictMonth(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return false;
  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

// Validate the four one-screen fields into a payment draft. The date
// and month are optional here: an empty date means today and an empty
// month means the customer's target month, both supplied by the
// caller at save time, exactly as the normal form defaults them. A
// draft that fails validation names the field that needs fixing, so
// the screen can point the operator straight at it.
export function quickCollectOneScreenDraft({ customerId, amountText, method, methods, dateText, month } = {}) {
  const customer = String(customerId ?? '').trim();
  if (!customer) {
    return { ok: false, field: 'customer', reason: QUICK_COLLECT_ONE_SCREEN_NO_CUSTOMER_TEXT };
  }
  const amountCents = quickCollectOneScreenAmountCents(amountText);
  if (amountCents === null) {
    return { ok: false, field: 'amount', reason: QUICK_COLLECT_ONE_SCREEN_NO_AMOUNT_TEXT };
  }
  const pickedMethod = String(method ?? '').trim();
  if (!pickedMethod) {
    return { ok: false, field: 'method', reason: QUICK_COLLECT_ONE_SCREEN_NO_METHOD_TEXT };
  }
  if (Array.isArray(methods) && methods.length > 0 && !methods.map((entry) => String(entry ?? '').trim()).includes(pickedMethod)) {
    return { ok: false, field: 'method', reason: QUICK_COLLECT_ONE_SCREEN_NO_METHOD_TEXT };
  }
  const date = String(dateText ?? '').trim();
  if (date !== '' && !quickCollectOneScreenIsStrictDate(date)) {
    return { ok: false, field: 'date', reason: QUICK_COLLECT_ONE_SCREEN_BAD_DATE_TEXT };
  }
  const billMonth = String(month ?? '').trim();
  if (billMonth !== '' && !quickCollectOneScreenIsStrictMonth(billMonth)) {
    return { ok: false, field: 'month', reason: QUICK_COLLECT_ONE_SCREEN_BAD_MONTH_TEXT };
  }
  return {
    ok: true,
    draft: {
      customerId: customer,
      amountCents,
      amount: amountCents / 100,
      method: pickedMethod,
      date,
      month: billMonth,
    },
  };
}

// The one-screen panel: customer, amount, method, save — every field
// the quick payment needs, on one screen, with no navigation in
// between. All user text is escaped; the dues line stays empty until
// a customer is picked.
export function quickCollectOneScreenHtml({ customers, methods, selectedCustomerId, amountText, method } = {}) {
  const customerOptions = quickCollectOneScreenCustomerOptions(customers);
  const methodOptions = quickCollectOneScreenMethodOptions(methods);
  const selectedId = String(selectedCustomerId ?? '').trim();
  const amount = String(amountText ?? '').trim();
  const pickedMethod = String(method ?? '').trim();
  const customerChoices = [
    `<option value="">${escapeHtml(QUICK_COLLECT_ONE_SCREEN_CHOOSE_CUSTOMER_TEXT)}</option>`,
    ...customerOptions.map((option) => (
      `<option value="${escapeHtml(option.value)}"${option.value === selectedId ? ' selected' : ''}>${escapeHtml(option.label)}</option>`
    )),
  ].join('');
  const methodChoices = [
    `<option value="">${escapeHtml(QUICK_COLLECT_ONE_SCREEN_CHOOSE_METHOD_TEXT)}</option>`,
    ...methodOptions.map((option) => (
      `<option value="${escapeHtml(option.value)}"${option.value === pickedMethod ? ' selected' : ''}>${escapeHtml(option.label)}</option>`
    )),
  ].join('');
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
      <button id="qosOneScreenBackBtn" class="secondary-button qc-back-btn" type="button" aria-label="Back to customer list">
        ← ${escapeHtml(QUICK_COLLECT_ONE_SCREEN_BACK_TEXT)}
      </button>
      <span class="qc-step-badge">One screen</span>
    </div>
    <div class="qc-field-group">
      <label for="qosOneScreenCustomer" class="qc-label">Customer <span class="qc-required">*</span></label>
      <select id="qosOneScreenCustomer" class="qc-input" required>${customerChoices}</select>
      <p id="qosOneScreenDues" class="txp-prefill-line" hidden></p>
    </div>
    <div class="qc-field-group">
      <label for="qosOneScreenAmount" class="qc-label">Amount Collected (PKR) <span class="qc-required">*</span></label>
      <input id="qosOneScreenAmount" type="number" step="0.01" min="0.01" max="999999" required inputmode="decimal" placeholder="Enter amount" class="qc-input qc-amount-input" value="${escapeHtml(amount)}">
    </div>
    <div class="qc-field-group">
      <label for="qosOneScreenMethod" class="qc-label">Payment Method <span class="qc-required">*</span></label>
      <select id="qosOneScreenMethod" class="qc-input" required>${methodChoices}</select>
    </div>
    <div class="qc-field-group">
      <button id="qosOneScreenSaveBtn" class="primary-button" type="button" style="width:100%;">${escapeHtml(QUICK_COLLECT_ONE_SCREEN_SAVE_TEXT)}</button>
    </div>`;
}
