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
//
// QC Modal Fix: the customer field is a searchable combobox (not a
// native select) and the method field is a row of colour-coded
// 1-tap pills (not a native select) — the dark native selects are
// gone. The combobox choices come from the picker pool entries
// (id, name, number, mohalla, totalDues), pending-dues customers
// first; the pills group the offered methods (Cash, Easypaisa,
// JazzCash, NayaPay/Raast/Bank Transfer, Shop Drop-off) while the
// value each pill submits stays the exact stored method string —
// the shop pill is an alias over the four stored shop methods, and
// NayaPay/Raast/Bank stay three distinct values. The amount field
// is a POS-style display with a fixed PKR badge, and the save
// button names the amount it will save.
export const QUICK_COLLECT_ONE_SCREEN_CHOOSE_CUSTOMER_TEXT = 'Choose customer';
export const QUICK_COLLECT_ONE_SCREEN_CHOOSE_METHOD_TEXT = 'Choose method';
export const QUICK_COLLECT_ONE_SCREEN_SAVE_TEXT = '✓ Save Payment';
export const QUICK_COLLECT_ONE_SCREEN_BACK_TEXT = 'Back to picker';
export const QUICK_COLLECT_ONE_SCREEN_NO_CUSTOMER_TEXT = 'Choose a customer first.';
export const QUICK_COLLECT_ONE_SCREEN_NO_AMOUNT_TEXT = 'Enter an amount greater than zero.';
export const QUICK_COLLECT_ONE_SCREEN_NO_METHOD_TEXT = 'Choose a payment method.';
export const QUICK_COLLECT_ONE_SCREEN_BAD_DATE_TEXT = 'The payment date is not a valid date.';
export const QUICK_COLLECT_ONE_SCREEN_BAD_MONTH_TEXT = 'The bill month is not a valid month.';
export const QUICK_COLLECT_ONE_SCREEN_CUSTOMER_SEARCH_PLACEHOLDER = 'Type #ID, name or mohalla…';
export const QUICK_COLLECT_ONE_SCREEN_SHOP_LABEL = 'Shop Drop-off';

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

// The save button's label for the typed amount: the amount inside
// the label once there is one to save ("✓ Save Payment
// (PKR 3,000)"), the plain label while the amount is empty. The
// label only names the figure; it never changes it.
export function quickCollectOneScreenSaveLabel(amountText) {
  const cents = quickCollectOneScreenAmountCents(amountText);
  if (cents === null) return QUICK_COLLECT_ONE_SCREEN_SAVE_TEXT;
  return `${QUICK_COLLECT_ONE_SCREEN_SAVE_TEXT} (${quickCollectOneScreenFormatAmount(cents)})`;
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

// --- QC Modal Fix: the searchable customer combobox ---
//
// The combobox choices come from the picker pool entries (the same
// entries the picker list renders), not from raw customer records:
// each entry already carries the outstanding figure, so the option
// can show its Mohalla + Outstanding badge without recomputing the
// ledger. Pending-dues customers sort on top (largest dues first,
// then name); settled customers follow by name. An entry without a
// usable id or name is skipped, never guessed; an archived entry is
// skipped too. A dues figure that is missing or unusable is NOT
// shown as Paid — the option carries no badge at all, never a
// guessed figure.
//
// The High-dues tone boundary is the caller's threshold (the shared
// QC2_HIGH_DUES_MIN_RUPEES in production, 2000 by default): at or
// above it the badge is red, below it amber — the same figure the
// "High ≥ 2k" filter uses, so the badge and the filter agree.

function comboboxDues(entry) {
  const value = entry?.totalDues;
  if (value === null || value === undefined || typeof value === 'boolean' || value === '') return null;
  const dues = Number(value);
  return Number.isFinite(dues) && dues >= 0 ? dues : null;
}

function comboboxMohalla(entry) {
  const value = String(entry?.mohalla ?? entry?.area ?? '').trim();
  return value && value !== 'Unassigned' ? value : 'Not recorded';
}

export function quickCollectOneScreenComboboxChoices(entries, highDuesMinRupees = 2000) {
  const list = Array.isArray(entries) ? entries : [];
  const threshold = Number(highDuesMinRupees);
  const highAt = Number.isFinite(threshold) && threshold > 0 ? threshold : 2000;
  const choices = [];
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    if (entry.archived) continue;
    const id = String(entry.id ?? '').trim();
    const name = customerDisplayName(entry);
    if (!id || !name) continue;
    const number = customerDisplayNumber(entry);
    const totalDues = comboboxDues(entry);
    const dueTone = totalDues === null ? 'unknown' : totalDues <= 0 ? 'paid' : totalDues >= highAt ? 'high' : 'medium';
    choices.push({
      value: id,
      name,
      number,
      mohalla: comboboxMohalla(entry),
      totalDues,
      hasDues: totalDues !== null && totalDues > 0,
      dueTone,
    });
  }
  const byName = (a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  choices.sort((a, b) => {
    const aDue = a.totalDues !== null && a.totalDues > 0;
    const bDue = b.totalDues !== null && b.totalDues > 0;
    if (aDue && bDue) {
      if (a.totalDues !== b.totalDues) return b.totalDues - a.totalDues;
      return byName(a, b);
    }
    if (aDue && !bDue) return -1;
    if (!aDue && bDue) return 1;
    return byName(a, b);
  });
  return choices;
}

// The combobox filter: the typed query matches the name, the
// customer number (with or without #), or the mohalla — the same
// three the search box promises. An empty query matches everything.
export function quickCollectOneScreenComboboxFilter(choices, query = '') {
  const list = Array.isArray(choices) ? choices : [];
  const normalized = String(query ?? '').normalize('NFKC').trim().toLowerCase();
  if (!normalized) return [...list];
  return list.filter((choice) => {
    if (!choice || typeof choice !== 'object') return false;
    const number = String(choice.number ?? '');
    return choice.name.toLowerCase().includes(normalized)
      || number.includes(normalized)
      || `#${number}`.includes(normalized)
      || String(choice.mohalla ?? '').toLowerCase().includes(normalized);
  });
}

function comboboxBadgeHtml(choice) {
  if (!choice || choice.totalDues === null || choice.totalDues === undefined) return '';
  if (choice.totalDues <= 0) return '<span class="qos-due-badge qos-due-badge--paid">Paid</span>';
  const amount = `PKR ${Number(choice.totalDues).toLocaleString('en-PK')}`;
  const tone = choice.dueTone === 'high' ? 'qos-due-badge--high' : 'qos-due-badge--medium';
  return `<span class="qos-due-badge ${tone}">${escapeHtml(amount)} Due</span>`;
}

// One combobox option: name + #ID, mohalla, and the Outstanding
// badge (red/amber Due, green Paid, none when the figure is
// unknown). All user text is escaped.
export function quickCollectOneScreenComboboxOptionHtml(choice, selected = false) {
  if (!choice || typeof choice !== 'object') return '';
  const label = choice.number ? `${choice.name} (#${choice.number})` : choice.name;
  return `<li class="qos-combobox-option" role="option" aria-selected="${selected ? 'true' : 'false'}" data-qos-customer-id="${escapeHtml(choice.value)}"><span class="qos-option-main"><span class="qos-option-name">${escapeHtml(label)}</span><span class="qos-option-mohalla">${escapeHtml(choice.mohalla)}</span></span>${comboboxBadgeHtml(choice)}</li>`;
}

// The combobox itself: a text input the operator types into, a
// hidden input that carries the picked customer id (the same id the
// old select carried, so the caller's change/submit wiring reads it
// unchanged), and the option list — rendered with every choice up
// front so the list is searchable without a first keystroke, and
// re-rendered by the caller as the operator types.
export function quickCollectOneScreenComboboxHtml(choices, selectedId) {
  const list = Array.isArray(choices) ? choices : [];
  const selected = String(selectedId ?? '').trim();
  const picked = list.find((choice) => choice.value === selected) || null;
  const searchValue = picked ? (picked.number ? `${picked.name} (#${picked.number})` : picked.name) : '';
  const options = list.map((choice) => quickCollectOneScreenComboboxOptionHtml(choice, choice.value === selected)).join('');
  return `<div class="qos-combobox">` +
    `<input id="qosOneScreenCustomerSearch" type="text" class="qc-input qos-combobox-input" role="combobox" aria-expanded="false" aria-controls="qosOneScreenCustomerList" aria-autocomplete="list" placeholder="${escapeHtml(QUICK_COLLECT_ONE_SCREEN_CUSTOMER_SEARCH_PLACEHOLDER)}" autocomplete="off" value="${escapeHtml(searchValue)}">` +
    `<input id="qosOneScreenCustomer" type="hidden" value="${escapeHtml(selected)}">` +
    `<ul id="qosOneScreenCustomerList" class="qos-combobox-list" role="listbox" aria-label="Matching customers" hidden>${options}</ul>` +
    `</div>`;
}

// --- QC Modal Fix: the method pills ---
//
// The pill each offered method becomes. The kind decides the pill's
// colour family; the value is always the exact stored method string
// the draft submits, so a pill never renames a method. The four
// stored shop methods ("Cash at … shop") are NOT pills: they share
// one "Shop Drop-off" group pill, and the shop they name is picked
// from the small sub-row that pill opens. NayaPay, Raast and Bank
// Transfer share the indigo family but stay three distinct values.
// A method the classifier does not know becomes a neutral pill with
// its exact value — an offered method is never dropped.

export function quickCollectOneScreenMethodKind(method) {
  const value = String(method ?? '').trim();
  if (value === 'Cash') return 'cash';
  if (value === 'Easypaisa') return 'easypaisa';
  if (value === 'JazzCash') return 'jazzcash';
  if (value === 'NayaPay' || value === 'Raast' || value === 'Bank Transfer') return 'indigo';
  if (value.startsWith('Cash at ') && value.endsWith(' shop')) return 'shop';
  return 'neutral';
}

// The pill set for the offered methods, in display order: Cash,
// Easypaisa, JazzCash, NayaPay, Raast, Bank Transfer, Shop
// Drop-off, then any unrecognised method in the caller's order.
// shopMethods lists the stored shop values the group pill aliases,
// in the caller's order. Empty entries are skipped, never offered.
export function quickCollectOneScreenMethodPills(methods) {
  const list = Array.isArray(methods) ? methods : [];
  const seen = new Set();
  const pills = [];
  const shopMethods = [];
  for (const method of list) {
    const value = String(method ?? '').trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    const kind = quickCollectOneScreenMethodKind(value);
    if (kind === 'shop') {
      shopMethods.push(value);
      continue;
    }
    pills.push({ kind, label: value, value });
  }
  const order = { cash: 0, easypaisa: 1, jazzcash: 2, indigo: 3, neutral: 5 };
  pills.sort((a, b) => (order[a.kind] ?? 5) - (order[b.kind] ?? 5));
  if (shopMethods.length > 0) {
    const shopPill = { kind: 'shop', label: QUICK_COLLECT_ONE_SCREEN_SHOP_LABEL, value: null, group: 'shop' };
    const neutralAt = pills.findIndex((pill) => pill.kind === 'neutral');
    if (neutralAt === -1) pills.push(shopPill);
    else pills.splice(neutralAt, 0, shopPill);
  }
  return { pills, shopMethods };
}

// The short label a shop pill shows in the sub-row: the shop's own
// name ("Hassan", "Balla", "Hassan Balla", "Waseem Abbasi") — the
// full stored value stays on the pill's data attribute and title,
// so the short label never renames the method.
export function quickCollectOneScreenShopShortLabel(method) {
  const value = String(method ?? '').trim();
  return value.replace(/^Cash at /, '').replace(/ shop$/, '') || value;
}

// The method the pills resolve to: the picked method when it is one
// of the offered values (a shop value counts — the group pill shows
// selected for it), Cash when nothing usable was picked (Cash is
// pre-selected on the one screen), else the first offered pill.
// A picked value outside the offered list never wins — it falls
// back to Cash rather than submitting a method nobody offered.
export function quickCollectOneScreenResolveMethod(method, methods) {
  const { pills, shopMethods } = quickCollectOneScreenMethodPills(methods);
  const picked = String(method ?? '').trim();
  if (picked && pills.some((pill) => pill.value === picked)) return picked;
  if (picked && shopMethods.includes(picked)) return picked;
  if (pills.some((pill) => pill.value === 'Cash')) return 'Cash';
  return pills[0]?.value ?? '';
}

// The method pills row + shop sub-row + the hidden input that
// carries the picked method (the same id the old select carried, so
// the caller's draft/submit wiring reads it unchanged). The Cash
// pill is pre-selected when nothing was picked; a picked shop
// method selects the group pill and opens its sub-row on the shop.
export function quickCollectOneScreenMethodPillsHtml(methods, selectedMethod) {
  const { pills, shopMethods } = quickCollectOneScreenMethodPills(methods);
  const selected = quickCollectOneScreenResolveMethod(selectedMethod, methods);
  const isShopSelected = shopMethods.includes(selected);
  const pillHtml = pills.map((pill) => {
    if (pill.kind === 'shop') {
      return `<button type="button" class="qos-method-pill qos-method--shop" role="radio" aria-checked="${isShopSelected}" data-qos-method-group="shop">${escapeHtml(pill.label)}</button>`;
    }
    return `<button type="button" class="qos-method-pill qos-method--${pill.kind}" role="radio" aria-checked="${selected === pill.value}" data-qos-method="${escapeHtml(pill.value)}">${escapeHtml(pill.label)}</button>`;
  }).join('');
  const shopHtml = shopMethods.map((value) => (
    `<button type="button" class="qos-method-pill qos-shop-pill" role="radio" aria-checked="${selected === value}" data-qos-method="${escapeHtml(value)}" title="${escapeHtml(value)}">${escapeHtml(quickCollectOneScreenShopShortLabel(value))}</button>`
  )).join('');
  return `<div id="qosOneScreenMethodPills" class="qos-method-pills" role="radiogroup" aria-label="Payment method">${pillHtml}</div>` +
    `<div id="qosOneScreenShopRow" class="qos-shop-row" role="radiogroup" aria-label="Shop"${isShopSelected ? '' : ' hidden'}>${shopHtml}</div>` +
    `<input id="qosOneScreenMethod" type="hidden" value="${escapeHtml(selected)}">`;
}

// The one-screen panel: customer, amount, method, save — every field
// the quick payment needs, on one screen, with no navigation in
// between. All user text is escaped; the dues line stays empty until
// a customer is picked. (QC-7: the amount field carries the keypad
// host — an empty div the caller populates with the Plan 442 keypad
// component, so the one screen gets the same on-screen keys as the
// form step. The module itself stays pure: it renders no keys and
// wires no clicks.)
// QC Modal Fix: the customer select is a searchable combobox, the
// method select is a row of 1-tap pills, the amount input sits in
// its POS-style display with a fixed PKR badge, and the save button
// is pinned in its own bar at the bottom and names the amount it
// will save. `entries` are the picker pool entries (with dues);
// `customers` is the legacy alias for the same list without dues.
export function quickCollectOneScreenHtml({ entries, customers, methods, selectedCustomerId, amountText, method } = {}) {
  const choices = quickCollectOneScreenComboboxChoices(entries ?? customers ?? []);
  const selectedId = String(selectedCustomerId ?? '').trim();
  const amount = String(amountText ?? '').trim();
  return `
    <div class="qc-one-screen-top-row">
      <button id="qosOneScreenBackBtn" class="secondary-button qc-back-btn" type="button" aria-label="Back to customer list">
        ← ${escapeHtml(QUICK_COLLECT_ONE_SCREEN_BACK_TEXT)}
      </button>
      <span class="qc-step-badge">One screen</span>
    </div>
    <div class="qc-field-group">
      <label for="qosOneScreenCustomerSearch" class="qc-label">Customer <span class="qc-required">*</span></label>
      ${quickCollectOneScreenComboboxHtml(choices, selectedId)}
      <p id="qosOneScreenDues" class="txp-prefill-line" hidden></p>
    </div>
    <div class="qc-field-group">
      <label for="qosOneScreenAmount" class="qc-label">Amount Collected (PKR) <span class="qc-required">*</span></label>
      <div class="qos-amount-display">
        <span class="qos-pkr-badge" aria-hidden="true">PKR</span>
        <input id="qosOneScreenAmount" type="number" step="0.01" min="0.01" max="999999" required inputmode="decimal" placeholder="Enter amount" class="qc-input qc-amount-input qos-amount-value" value="${escapeHtml(amount)}">
      </div>
      <div id="qosOneScreenKeypad" class="kpd-keypad" role="group" aria-label="Amount keypad"></div>
    </div>
    <div class="qc-field-group">
      <label class="qc-label" id="qosOneScreenMethodLabel">Payment Method <span class="qc-required">*</span></label>
      ${quickCollectOneScreenMethodPillsHtml(methods, method)}
    </div>
    <div class="qos-save-bar">
      <button id="qosOneScreenSaveBtn" class="primary-button qc-one-screen-save" type="button">${escapeHtml(quickCollectOneScreenSaveLabel(amount))}</button>
    </div>`;
}
