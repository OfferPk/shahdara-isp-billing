/**
 * form-validation.js - Form validation and phone format helpers for Shahdara ISP Billing
 * Local-only, accessible, no external dependencies.
 */

/**
 * Validates a Pakistani or international phone number.
 * @param {string} phoneStr
 * @returns {{ valid: boolean, empty?: boolean, tip?: boolean, type?: string, message: string }}
 */
export function validatePakistanPhone(phoneStr) {
  if (!phoneStr || !phoneStr.trim()) {
    return { valid: true, empty: true, message: '' };
  }
  const raw = phoneStr.trim();
  if (!/^[+]?[\d\s\-()]+$/.test(raw)) {
    return { valid: false, message: 'Only numbers, spaces, dashes, or a leading + are allowed.' };
  }
  const digits = raw.replace(/\D/g, '');
  if (raw.startsWith('+92') || raw.startsWith('0092') || (raw.startsWith('92') && digits.length >= 12)) {
    const nationalDigits = raw.startsWith('+92') ? digits.slice(2) : raw.startsWith('0092') ? digits.slice(4) : digits.slice(2);
    if (nationalDigits.length === 10 && nationalDigits.startsWith('3')) {
      return {
        valid: true,
        type: 'pk-international',
        message: `✓ Valid Pakistani mobile (WhatsApp ready: +92 ${nationalDigits.slice(0, 3)} ${nationalDigits.slice(3)})`
      };
    }
    if (nationalDigits.length < 10) {
      return {
        valid: false,
        tip: true,
        message: `Incomplete Pakistani number (${nationalDigits.length}/10 national digits).`
      };
    }
  }
  if (digits.startsWith('03') && digits.length === 11) {
    const intl = '+92' + digits.slice(1);
    return {
      valid: true,
      type: 'pk-local',
      tip: true,
      message: `✓ Valid local mobile. For WhatsApp receipt drafts, use international: ${intl}`
    };
  }
  if (digits.startsWith('03') && digits.length < 11) {
    return {
      valid: false,
      tip: true,
      message: `Incomplete local number (${digits.length}/11 digits, expected 03xx-xxxxxxx).`
    };
  }
  if (digits.length >= 7 && digits.length <= 15) {
    return { valid: true, type: 'other', message: '✓ Valid phone format.' };
  }
  return { valid: false, message: 'Invalid phone length (expected 10 to 15 digits).' };
}

/**
 * Validates a positive numeric amount.
 * @param {string|number} value
 * @param {{ allowZero?: boolean, required?: boolean }} [options]
 * @returns {{ valid: boolean, value: number|null, message: string }}
 */
export function validatePositiveAmount(value, options = { allowZero: true, required: false }) {
  if (value === '' || value === null || value === undefined) {
    if (options.required) {
      return { valid: false, value: null, message: 'Amount is required.' };
    }
    return { valid: true, value: null, message: '' };
  }
  const num = Number(value);
  if (Number.isNaN(num)) {
    return { valid: false, value: null, message: 'Please enter a valid numeric amount.' };
  }
  if (num < 0) {
    return { valid: false, value: num, message: 'Amount cannot be negative.' };
  }
  if (!options.allowZero && num === 0) {
    return { valid: false, value: 0, message: 'Amount must be greater than zero.' };
  }
  return { valid: true, value: num, message: '' };
}

/**
 * Validates a customer name.
 * @param {string} name
 * @returns {{ valid: boolean, message: string, cleanName: string }}
 */
export function validateCustomerName(name) {
  if (name === null || name === undefined || typeof name !== 'string') {
    return { valid: false, message: 'Customer name is required.', cleanName: '' };
  }
  const cleanName = name.trim().replace(/\s+/g, ' ');
  if (!cleanName) {
    return { valid: false, message: 'Customer name cannot be empty or whitespace only.', cleanName: '' };
  }
  if (cleanName.length < 2) {
    return { valid: false, message: 'Customer name must be at least 2 characters long.', cleanName };
  }
  if (cleanName.length > 100) {
    return { valid: false, message: 'Customer name cannot exceed 100 characters.', cleanName };
  }
  return { valid: true, message: '', cleanName };
}

/**
 * Validates a date string in YYYY-MM-DD format within an allowed range.
 * @param {string} dateStr
 * @param {{ minDate?: string, maxDate?: string }} [options]
 * @returns {{ valid: boolean, message: string }}
 */
export function validateTransactionDate(dateStr, options = {}) {
  if (!dateStr || typeof dateStr !== 'string' || !dateStr.trim()) {
    return { valid: false, message: 'Date is required.' };
  }
  const trimmed = dateStr.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return { valid: false, message: 'Date must be in YYYY-MM-DD format.' };
  }
  const [year, month, day] = trimmed.split('-').map(Number);
  if (month < 1 || month > 12) {
    return { valid: false, message: 'Month must be between 01 and 12.' };
  }
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > daysInMonth) {
    return { valid: false, message: `Day must be between 01 and ${daysInMonth} for month ${String(month).padStart(2, '0')}.` };
  }
  const min = options.minDate || '2020-01-01';
  if (trimmed < min) {
    return { valid: false, message: `Date cannot be earlier than ${min}.` };
  }
  if (options.maxDate && trimmed > options.maxDate) {
    return { valid: false, message: `Date cannot be later than ${options.maxDate}.` };
  }
  return { valid: true, message: '' };
}

/**
 * Paginates an array of items.
 * @template T
 * @param {T[]} items
 * @param {number} [page=1]
 * @param {number|string} [pageSize=15]
 * @returns {{ items: T[], page: number, pageSize: number, totalPages: number, totalItems: number, startIndex: number, endIndex: number }}
 */
export function paginateRows(items, page = 1, pageSize = 15) {
  const list = Array.isArray(items) ? items : [];
  if (pageSize === 'all' || pageSize <= 0) {
    return {
      items: list,
      page: 1,
      pageSize: list.length || 1,
      totalPages: 1,
      totalItems: list.length,
      startIndex: 0,
      endIndex: list.length
    };
  }
  const size = Math.max(1, Number(pageSize) || 15);
  const totalPages = Math.max(1, Math.ceil(list.length / size));
  const currentPage = Math.max(1, Math.min(Number(page) || 1, totalPages));
  const startIndex = (currentPage - 1) * size;
  const endIndex = Math.min(startIndex + size, list.length);
  return {
    items: list.slice(startIndex, endIndex),
    page: currentPage,
    pageSize: size,
    totalPages,
    totalItems: list.length,
    startIndex,
    endIndex
  };
}

/**
 * Calculates aggregate stats for a list of transactions.
 * @param {Array<{ amount: number|string, method?: string }>} transactions
 * @returns {{ count: number, totalAmount: number, averageAmount: number, methodCounts: Record<string, number> }}
 */
export function calculateTransactionSummary(transactions) {
  const list = Array.isArray(transactions) ? transactions : [];
  const count = list.length;
  const totalAmount = list.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
  const averageAmount = count > 0 ? Math.round(totalAmount / count) : 0;
  const methodCounts = {};
  for (const tx of list) {
    const m = tx.method || 'Other';
    methodCounts[m] = (methodCounts[m] || 0) + 1;
  }
  return {
    count,
    totalAmount,
    averageAmount,
    methodCounts
  };
}

/**
 * Saves a form draft object to local storage.
 * @param {string} formId
 * @param {Record<string, any>} data
 * @param {Storage} [storage]
 * @returns {boolean}
 */
export function saveFormDraft(formId, data, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!formId || !storage) return false;
  const key = `shahdara_draft_${formId}`;
  if (!data || typeof data !== 'object') {
    try { storage.removeItem(key); } catch {}
    return false;
  }
  const hasContent = Object.entries(data).some(([k, v]) => !k.startsWith('_') && v !== null && v !== undefined && String(v).trim().length > 0);
  if (!hasContent) {
    try { storage.removeItem(key); } catch {}
    return false;
  }
  try {
    const payload = JSON.stringify({
      ...data,
      _savedAt: new Date().toISOString()
    });
    storage.setItem(key, payload);
    return true;
  } catch {
    return false;
  }
}

/**
 * Loads a form draft object from local storage.
 * @param {string} formId
 * @param {Storage} [storage]
 * @returns {Record<string, any>|null}
 */
export function loadFormDraft(formId, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!formId || !storage) return null;
  const key = `shahdara_draft_${formId}`;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Clears a form draft from local storage.
 * @param {string} formId
 * @param {Storage} [storage]
 * @returns {void}
 */
export function clearFormDraft(formId, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!formId || !storage) return;
  const key = `shahdara_draft_${formId}`;
  try {
    storage.removeItem(key);
  } catch {}
}

/**
 * Checks if a non-empty form draft exists.
 * @param {string} formId
 * @param {Storage} [storage]
 * @returns {boolean}
 */
export function hasFormDraft(formId, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  const draft = loadFormDraft(formId, storage);
  if (!draft) return false;
  return Object.entries(draft).some(([k, v]) => !k.startsWith('_') && v !== null && v !== undefined && String(v).trim().length > 0);
}

/**
 * Wires automatic form draft debounced saving and restoration.
 * @param {HTMLFormElement} formElement
 * @param {{ formId?: string, onRestore?: Function, onClear?: Function, storage?: Storage }} [options]
 * @returns {{ restore: () => boolean, clear: () => void, getDraft: () => object|null }}
 */
export function wireFormDraftAutosave(formElement, { formId, onRestore, onClear, storage } = {}) {
  const id = formId || formElement?.id;
  if (!formElement || !id) {
    return { restore: () => false, clear: () => {}, getDraft: () => null };
  }

  let debounceTimer = null;

  function collectFormData() {
    const data = {};
    const elements = formElement.elements;
    if (!elements) return data;
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      if (!el.name || el.type === 'submit' || el.type === 'button' || el.type === 'file' || el.type === 'hidden') continue;
      if (el.type === 'checkbox') {
        data[el.name] = el.checked;
      } else if (el.type === 'radio') {
        if (el.checked) data[el.name] = el.value;
      } else {
        data[el.name] = el.value;
      }
    }
    return data;
  }

  function handleInput() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const data = collectFormData();
      saveFormDraft(id, data, storage);
    }, 250);
  }

  if (typeof formElement.addEventListener === 'function') {
    formElement.addEventListener('input', handleInput);
    formElement.addEventListener('change', handleInput);
  }

  function restore() {
    const draft = loadFormDraft(id, storage);
    if (!draft) return false;
    let applied = false;
    const elements = formElement.elements;
    if (elements) {
      for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        if (!el.name || !(el.name in draft)) continue;
        if (el.type === 'checkbox') {
          el.checked = Boolean(draft[el.name]);
          applied = true;
        } else if (el.type === 'radio') {
          if (el.value === draft[el.name]) {
            el.checked = true;
            applied = true;
          }
        } else {
          el.value = draft[el.name] || '';
          applied = true;
        }
      }
    }
    if (applied && typeof onRestore === 'function') {
      onRestore(draft);
    }
    return applied;
  }

  function clear() {
    clearFormDraft(id, storage);
    if (typeof onClear === 'function') {
      onClear();
    }
  }

  return {
    restore,
    clear,
    getDraft: () => loadFormDraft(id, storage)
  };
}

/**
 * Generates an Excel-compatible CSV string with UTF-8 BOM, escaped quotes, and commas.
 * @param {Array<string|{ key: string, label: string }>} headers
 * @param {Array<Record<string, any>|Array<any>>} rows
 * @returns {string}
 */
export function generateCsvContent(headers, rows) {
  if (!Array.isArray(headers) || headers.length === 0) return '';
  const headerSpecs = headers.map((h, index) => {
    if (typeof h === 'string') {
      return { key: h, label: h, index };
    }
    return {
      key: h.key || String(index),
      label: h.label || h.key || String(index),
      index
    };
  });

  function formatCell(val) {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  const headerLine = headerSpecs.map(h => formatCell(h.label)).join(',');
  const rowLines = (Array.isArray(rows) ? rows : []).map(row => {
    return headerSpecs.map(h => {
      const cellVal = Array.isArray(row) ? row[h.index] : (row ? row[h.key] : '');
      return formatCell(cellVal);
    }).join(',');
  });

  return '\uFEFF' + [headerLine, ...rowLines].join('\r\n');
}

/**
 * Triggers a client-side download of a CSV file.
 * @param {string} filename
 * @param {string} csvContent
 * @param {Document} [doc]
 * @returns {boolean}
 */
export function downloadCsvFile(filename, csvContent, doc = (typeof document !== 'undefined' ? document : null)) {
  if (!doc || typeof Blob === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return false;
  }
  try {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = doc.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename || 'export.csv');
    link.style.display = 'none';
    if (doc.body) doc.body.appendChild(link);
    link.click();
    if (link.remove) link.remove();
    else if (link.parentNode) link.parentNode.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generates semantic printable batch receipt HTML for a given month.
 * @param {Array<any>} customers
 * @param {string} month - Format: YYYY-MM
 * @param {any} [state]
 * @param {{ filter?: 'all'|'pending'|'paid' }} [options]
 * @returns {string}
 */
export function generateBatchReceiptHtml(customers, month, state, { filter = 'all' } = {}) {
  const list = Array.isArray(customers) ? customers.filter(c => !c.archived) : [];
  if (list.length === 0) {
    return '<div class="batch-empty-state">No customer accounts available for billing slips.</div>';
  }

  const slips = [];

  for (const customer of list) {
    const bill = Array.isArray(customer.bills) ? customer.bills.find(b => b.month === month) : null;
    const dueAmount = Number(bill?.dueAmount || customer.monthlyPrice || customer.packagePrice || 0);
    const paidAmount = Number(bill?.paidAmount || 0);
    const balance = Math.max(0, dueAmount - paidAmount);
    const isPaid = balance === 0 && dueAmount > 0;
    const statusLabel = isPaid ? 'PAID' : balance < dueAmount && paidAmount > 0 ? 'PARTIAL' : 'PENDING';

    if (filter === 'pending' && isPaid) continue;
    if (filter === 'paid' && !isPaid) continue;

    slips.push(`
      <article class="batch-receipt-slip" data-customer-id="${customer.id}">
        <header class="batch-slip-header">
          <div class="batch-slip-brand">
            <strong>SHAHDARA FIBER NET</strong>
            <span>CUSTOMER BILLING SLIP</span>
          </div>
          <div class="batch-slip-status status-${statusLabel.toLowerCase()}">${statusLabel}</div>
        </header>
        <div class="batch-slip-grid">
          <div class="batch-slip-field">
            <span class="batch-field-label">Customer ID / Name:</span>
            <strong>#${customer.id} · ${customer.name || 'Unnamed'}</strong>
          </div>
          <div class="batch-slip-field">
            <span class="batch-field-label">Billing Month:</span>
            <strong>${month}</strong>
          </div>
          <div class="batch-slip-field">
            <span class="batch-field-label">Area / Mohalla:</span>
            <span>${customer.area || customer.mohalla || 'General'}</span>
          </div>
          <div class="batch-slip-field">
            <span class="batch-field-label">Phone:</span>
            <span>${customer.phone || 'N/A'}</span>
          </div>
          <div class="batch-slip-field">
            <span class="batch-field-label">Package Plan:</span>
            <span>${customer.package || customer.servicePlan || 'Standard'}</span>
          </div>
          <div class="batch-slip-field">
            <span class="batch-field-label">Total Due (PKR):</span>
            <strong class="batch-amount">PKR ${dueAmount.toLocaleString()}</strong>
          </div>
          <div class="batch-slip-field">
            <span class="batch-field-label">Paid Amount:</span>
            <span>PKR ${paidAmount.toLocaleString()}</span>
          </div>
          <div class="batch-slip-field">
            <span class="batch-field-label">Balance Payable:</span>
            <strong class="batch-balance">PKR ${balance.toLocaleString()}</strong>
          </div>
        </div>
        <footer class="batch-slip-footer">
          <div class="batch-slip-note">Payment is due by 5th of each month. Inquiries: Shahdara ISP Support</div>
          <div class="batch-slip-stub">
            <span class="batch-stub-cut">✂ Office Tear-off Stub</span>
            <span>#${customer.id} · ${customer.name} · PKR ${balance.toLocaleString()} due for ${month}</span>
          </div>
        </footer>
      </article>
    `);
  }

  if (slips.length === 0) {
    return `<div class="batch-empty-state">No customer slips matched the '${filter}' filter for month ${month}.</div>`;
  }

  return slips.join('\n');
}

/**
 * Formats a phone input string to Pakistani mobile mask format (03XX-XXXXXXX) if applicable,
 * or cleanly preserves international numbers (+92 3XX XXXXXXX).
 * @param {string} val
 * @returns {string}
 */
export function maskPakistanPhone(val) {
  if (!val) return '';
  const str = String(val).trim();
  if (str.startsWith('+')) {
    const cleaned = '+' + str.slice(1).replace(/[^\d\s]/g, '');
    return cleaned;
  }
  const digits = str.replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('03')) {
    if (digits.length <= 4) {
      return digits;
    }
    return `${digits.slice(0, 4)}-${digits.slice(4, 11)}`;
  } else if (digits.startsWith('923')) {
    return `+${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 12)}`;
  }
  return str;
}

/**
 * Wires real-time phone input masking on an HTML input element.
 * @param {HTMLInputElement} inputEl
 */
export function wirePhoneInputMask(inputEl) {
  if (!inputEl || inputEl.dataset?.masked) return;
  if (inputEl.dataset) inputEl.dataset.masked = 'true';

  inputEl.addEventListener('input', () => {
    const original = inputEl.value;
    const formatted = maskPakistanPhone(original);
    if (formatted !== original) {
      inputEl.value = formatted;
    }
  });
}

/**
 * Formats a complete chronological customer ledger statement with running balance and range filtering.
 * @param {Object} customer
 * @param {Object} [options]
 * @param {'all'|'3m'|'6m'|'12m'|'ytd'} [options.range='all']
 * @param {Date} [options.referenceDate=new Date()]
 * @returns {Object}
 */
export function formatCustomerStatement(customer, { range = 'all', referenceDate = new Date() } = {}) {
  if (!customer) {
    return {
      customer: null,
      range,
      openingBalance: 0,
      totalBilled: 0,
      totalPaid: 0,
      currentBalance: 0,
      events: []
    };
  }

  const allEvents = [];

  // Gather bill charges
  const bills = Array.isArray(customer.bills) ? customer.bills : [];
  for (const bill of bills) {
    const billDate = bill.dueDate || (bill.month ? `${bill.month}-05` : '1970-01-01');
    const charge = Number(bill.dueAmount ?? 0);
    allEvents.push({
      date: billDate,
      type: 'bill',
      month: bill.month || '',
      description: `Monthly Bill (${bill.month || 'Current'})`,
      charge: charge > 0 ? charge : 0,
      credit: 0,
      method: 'Billed Snapshot',
      ref: bill.id || ''
    });

    // Gather bill payments
    const payments = Array.isArray(bill.payments) ? bill.payments : [];
    for (const payment of payments) {
      const pDate = payment.date || (bill.month ? `${bill.month}-05` : '1970-01-01');
      const credit = Number(payment.amount ?? 0);
      allEvents.push({
        date: pDate,
        type: 'payment',
        month: bill.month || '',
        description: `Payment Received · ${payment.method || 'Cash'}${payment.reference ? ` (Ref: ${payment.reference})` : ''}`,
        charge: 0,
        credit: credit > 0 ? credit : 0,
        method: payment.method || 'Cash',
        ref: payment.id || payment.reference || ''
      });
    }
  }

  // Sort chronologically ascending. On same date, bills come before payments so charge is debited before credited.
  allEvents.sort((a, b) => {
    const cmp = String(a.date).localeCompare(String(b.date));
    if (cmp !== 0) return cmp;
    if (a.type === 'bill' && b.type !== 'bill') return -1;
    if (a.type !== 'bill' && b.type === 'bill') return 1;
    return 0;
  });

  // Calculate cutoff date string for range filtering
  let cutoffDate = null;
  const ref = referenceDate instanceof Date && !isNaN(referenceDate) ? new Date(referenceDate) : new Date();

  if (range === '3m') {
    const d = new Date(ref);
    d.setMonth(d.getMonth() - 3);
    cutoffDate = d.toISOString().slice(0, 10);
  } else if (range === '6m') {
    const d = new Date(ref);
    d.setMonth(d.getMonth() - 6);
    cutoffDate = d.toISOString().slice(0, 10);
  } else if (range === '12m') {
    const d = new Date(ref);
    d.setMonth(d.getMonth() - 12);
    cutoffDate = d.toISOString().slice(0, 10);
  } else if (range === 'ytd') {
    cutoffDate = `${ref.getFullYear()}-01-01`;
  }

  let openingBalance = 0;
  const filteredEvents = [];

  for (const ev of allEvents) {
    if (cutoffDate && ev.date < cutoffDate) {
      openingBalance += ev.charge - ev.credit;
    } else {
      filteredEvents.push(ev);
    }
  }

  let runningBalance = openingBalance;
  let totalBilled = 0;
  let totalPaid = 0;

  const eventsWithBalance = filteredEvents.map(ev => {
    runningBalance += ev.charge - ev.credit;
    totalBilled += ev.charge;
    totalPaid += ev.credit;
    return {
      ...ev,
      runningBalance
    };
  });

  return {
    customer: {
      id: customer.id,
      customerNumber: customer.customerNumber,
      name: customer.name || 'Customer',
      phone: customer.phone || 'N/A',
      area: customer.area || customer.mohalla || 'General',
      package: customer.package || customer.packageSpeed || 'Standard',
      serviceStatus: customer.serviceStatus || 'not-set'
    },
    range,
    cutoffDate,
    openingBalance,
    totalBilled,
    totalPaid,
    currentBalance: runningBalance,
    events: eventsWithBalance
  };
}

/**
 * Generates printable HTML statement document for customer account ledger.
 * @param {Object} statement
 * @returns {string}
 */
export function generateCustomerStatementHtml(statement) {
  if (!statement || !statement.customer) {
    return '<div class="statement-empty">No customer data provided for statement.</div>';
  }

  const { customer, range, openingBalance, totalBilled, totalPaid, currentBalance, events } = statement;
  const rangeLabels = {
    all: 'All-time Ledger',
    '3m': 'Last 3 Months',
    '6m': 'Last 6 Months',
    '12m': 'Last 12 Months',
    ytd: 'Current Calendar Year'
  };
  const rangeLabel = rangeLabels[range] || 'All-time Ledger';
  const today = new Date().toISOString().slice(0, 10);

  const rowsHtml = events.map(ev => `
    <tr>
      <td class="col-date">${ev.date}</td>
      <td class="col-desc"><strong>${ev.description}</strong></td>
      <td class="col-month">${ev.month || '—'}</td>
      <td class="col-num charge-num">${ev.charge > 0 ? `PKR ${ev.charge.toLocaleString()}` : '—'}</td>
      <td class="col-num credit-num">${ev.credit > 0 ? `PKR ${ev.credit.toLocaleString()}` : '—'}</td>
      <td class="col-num balance-num ${ev.runningBalance > 0 ? 'is-due' : 'is-settled'}">PKR ${ev.runningBalance.toLocaleString()}</td>
    </tr>
  `).join('');

  return `
    <article class="customer-account-statement" data-customer-id="${customer.id}">
      <header class="statement-header">
        <div class="statement-brand">
          <div class="statement-brand-title">SHAHDARA FIBER NET</div>
          <div class="statement-brand-sub">LOCAL ISP BROADBAND &amp; NETWORK LEDGER</div>
          <div class="statement-doc-type">CUSTOMER ACCOUNT STATEMENT (کھاتہ اسٹیٹمنٹ)</div>
        </div>
        <div class="statement-meta-badge">
          <div>Statement Date: <strong>${today}</strong></div>
          <div>Period Scope: <strong>${rangeLabel}</strong></div>
          <div>Status: <strong>${customer.serviceStatus.toUpperCase()}</strong></div>
        </div>
      </header>

      <section class="statement-info-box">
        <div class="statement-info-col">
          <div><span class="info-label">Customer ID / No:</span> <strong>#${customer.customerNumber || customer.id}</strong></div>
          <div><span class="info-label">Subscriber Name:</span> <strong>${customer.name}</strong></div>
          <div><span class="info-label">Phone Contact:</span> <span>${customer.phone}</span></div>
        </div>
        <div class="statement-info-col">
          <div><span class="info-label">Coverage Area:</span> <span>${customer.area}</span></div>
          <div><span class="info-label">Package Plan:</span> <span>${customer.package}</span></div>
          <div><span class="info-label">Opening Balance:</span> <span>PKR ${openingBalance.toLocaleString()}</span></div>
        </div>
      </section>

      <div class="statement-summary-strip">
        <div class="statement-summary-card">
          <span class="summary-card-label">Total Billed Charges</span>
          <strong class="summary-card-val">PKR ${totalBilled.toLocaleString()}</strong>
        </div>
        <div class="statement-summary-card">
          <span class="summary-card-label">Total Payments Received</span>
          <strong class="summary-card-val text-success">PKR ${totalPaid.toLocaleString()}</strong>
        </div>
        <div class="statement-summary-card summary-card-balance ${currentBalance > 0 ? 'balance-overdue' : 'balance-cleared'}">
          <span class="summary-card-label">Ending Net Balance</span>
          <strong class="summary-card-val">PKR ${currentBalance.toLocaleString()}</strong>
        </div>
      </div>

      <div class="statement-table-wrap">
        <table class="statement-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description / Transaction</th>
              <th>Billing Month</th>
              <th class="num-col">Charges (Debit)</th>
              <th class="num-col">Payments (Credit)</th>
              <th class="num-col">Running Balance</th>
            </tr>
          </thead>
          <tbody>
            ${openingBalance !== 0 ? `
              <tr class="opening-balance-row">
                <td class="col-date">—</td>
                <td class="col-desc"><em>Opening Balance Carried Forward</em></td>
                <td class="col-month">—</td>
                <td class="col-num">—</td>
                <td class="col-num">—</td>
                <td class="col-num balance-num">PKR ${openingBalance.toLocaleString()}</td>
              </tr>
            ` : ''}
            ${rowsHtml || '<tr><td colspan="6" class="text-center muted">No billing or payment records found for this period.</td></tr>'}
          </tbody>
        </table>
      </div>

      <footer class="statement-footer">
        <p class="statement-notes">
          All transactions are maintained locally in accordance with Shahdara ISP Billing terms. Payments made after the statement date will appear in the next cycle.
        </p>
        <div class="statement-sign-block">
          <div class="statement-sig-item">
            <div class="sig-line"></div>
            <span>ISP Authorized Representative</span>
          </div>
          <div class="statement-sig-item">
            <div class="sig-line"></div>
            <span>Customer Signature</span>
          </div>
        </div>
      </footer>
    </article>
  `;
}

/**
 * Exports customer ledger statement to CSV file and triggers download.
 * @param {Object} statement
 * @param {Document} [doc]
 * @returns {boolean}
 */
export function downloadCustomerStatementCsv(statement, doc = (typeof document !== 'undefined' ? document : null)) {
  if (!statement || !statement.customer) return false;

  const headerSpecs = [
    { label: 'Date', key: 'date' },
    { label: 'Type', key: 'type' },
    { label: 'Month', key: 'month' },
    { label: 'Description', key: 'description' },
    { label: 'Method / Channel', key: 'method' },
    { label: 'Charges (PKR)', key: 'charge' },
    { label: 'Payments (PKR)', key: 'credit' },
    { label: 'Running Balance (PKR)', key: 'runningBalance' }
  ];

  const csvRows = statement.events.map(ev => ({
    date: ev.date,
    type: ev.type.toUpperCase(),
    month: ev.month || '',
    description: ev.description,
    method: ev.method || '',
    charge: ev.charge || 0,
    credit: ev.credit || 0,
    runningBalance: ev.runningBalance
  }));

  const csv = generateCsvContent(headerSpecs, csvRows);
  const custName = (statement.customer.name || 'customer').replace(/[^\w-]/g, '_');
  const filename = `statement_${custName}_${statement.range}_${new Date().toISOString().slice(0, 10)}.csv`;
  return downloadCsvFile(filename, csv, doc);
}

/**
 * Normalizes a Pakistani or international phone number and builds a WhatsApp click-to-chat URL.
 * Handles 03XX, +923XX, 00923XX, removes non-digit characters.
 * @param {string} phoneStr
 * @param {string} [messageText='']
 * @returns {{ url: string, validPhone: boolean, formattedPhone: string, text: string }}
 */
export function formatWhatsAppUrl(phoneStr, messageText = '') {
  if (!phoneStr || typeof phoneStr !== 'string') {
    return { url: '', validPhone: false, formattedPhone: '', text: messageText };
  }
  const digits = phoneStr.replace(/\D/g, '');
  let intlDigits = '';

  if (digits.startsWith('92') && digits.length >= 12) {
    intlDigits = digits;
  } else if (digits.startsWith('0092') && digits.length >= 14) {
    intlDigits = digits.slice(2);
  } else if (digits.startsWith('03') && digits.length === 11) {
    intlDigits = '92' + digits.slice(1);
  } else if (digits.length >= 10 && digits.length <= 15) {
    intlDigits = digits;
  }

  if (!intlDigits || intlDigits.length < 10) {
    return { url: '', validPhone: false, formattedPhone: phoneStr.trim(), text: messageText };
  }

  const encodedText = encodeURIComponent(messageText);
  const url = `https://wa.me/${intlDigits}${messageText ? `?text=${encodedText}` : ''}`;
  const formattedPhone = `+${intlDigits.slice(0, 2)} ${intlDigits.slice(2, 5)} ${intlDigits.slice(5)}`;

  return {
    url,
    validPhone: true,
    formattedPhone,
    text: messageText
  };
}

/**
 * Builds personalized payment reminder and notification message templates.
 * @param {Object} params
 * @param {Object} params.customer
 * @param {string} [params.templateType='due'] - 'due', 'overdue', 'disconnection', 'payment', 'welcome'
 * @param {Object} [params.billingData={}] - { month, billAmount, balance, dueDate, paidAmount, paymentDate, packageName }
 * @param {string} [params.customNote='']
 * @returns {string}
 */
export function buildPaymentReminderMessage({
  customer,
  templateType = 'due',
  billingData = {},
  customNote = ''
} = {}) {
  const name = customer?.name || 'Valued Customer';
  const custNum = customer?.customerNumber ? `#${customer.customerNumber}` : 'Account';
  const area = customer?.area || customer?.mohalla || 'Shahdara';
  const month = billingData.month || new Date().toISOString().slice(0, 7);
  const amount = Number(billingData.billAmount || billingData.amount || 0).toLocaleString();
  const balance = Number(billingData.balance !== undefined ? billingData.balance : (billingData.billAmount || 0)).toLocaleString();
  const dueDate = billingData.dueDate || '5th of this month';
  const paidAmount = Number(billingData.paidAmount || 0).toLocaleString();
  const paymentDate = billingData.paymentDate || new Date().toISOString().slice(0, 10);
  const packageName = customer?.package || billingData.packageName || 'Internet Package';

  let msg = '';

  switch (templateType) {
    case 'overdue':
      msg = `*Shahdara ISP - Overdue Payment Notice*\n\nAssalam-o-Alaikum ${name},\nYour internet account ${custNum} (${area}) has an outstanding overdue balance of *PKR ${balance}*.\n\nKindly deposit your payment today via cash collection or online transfer (EasyPaisa / JazzCash) to avoid late service disruption.\n\nHelpline & Inquiries: Shahdara ISP Support`;
      break;

    case 'disconnection':
      msg = `*⚠️ FINAL NOTICE / آخری اطلاع - Shahdara ISP*\n\nDear ${name},\nConnection ${custNum} is scheduled for *temporary disconnection* due to pending dues of *PKR ${balance}*.\n\nPlease clear the balance today to keep your high-speed internet active.\n\n_If you have already paid today, please ignore this notice or reply with your receipt slip._`;
      break;

    case 'payment':
      msg = `*Shahdara ISP - Payment Received Acknowledgement*\n\nDear ${name},\nWe have successfully received payment of *PKR ${paidAmount}* for account ${custNum} on ${paymentDate}.\n\nRemaining Balance: *PKR ${balance}*\n\nThank you for choosing Shahdara ISP Services!`;
      break;

    case 'welcome':
      msg = `*Welcome to Shahdara ISP! / خوش آمدید*\n\nDear ${name},\nYour new high-speed internet connection ${custNum} (${packageName}) is active in ${area}.\n\nFor speed tests, billing assistance, or technical support, contact our local team.\n\nThank you for joining our network!`;
      break;

    case 'due':
    default:
      msg = `*Shahdara ISP - Monthly Bill Reminder*\n\nAssalam-o-Alaikum ${name},\nYour internet bill for the month of *${month}* is *PKR ${amount}*, due by *${dueDate}*.\n\nAccount: ${custNum} (${area})\nTotal Payable: *PKR ${balance}*\n\nPlease settle your bill on or before the due date for uninterrupted service.\n\nThank you!\nShahdara ISP`;
      break;
  }

  if (customNote && customNote.trim()) {
    msg += `\n\nNote: ${customNote.trim()}`;
  }

  return msg;
}

/**
 * Generates an 80mm printable reminder slip HTML card.
 * @param {Object} params
 * @returns {string}
 */
export function generatePaymentReminderSlipHtml({
  customer,
  templateType = 'due',
  billingData = {},
  customNote = ''
} = {}) {
  const name = escapeHtml(customer?.name || 'Customer');
  const custNum = customer?.customerNumber ? `#${customer.customerNumber}` : '—';
  const phone = escapeHtml(customer?.phone || 'Not set');
  const area = escapeHtml(customer?.area || customer?.mohalla || 'Shahdara Area');
  const balance = Number(billingData.balance !== undefined ? billingData.balance : (billingData.billAmount || 0)).toLocaleString();
  const month = billingData.month || new Date().toISOString().slice(0, 7);
  const dueDate = billingData.dueDate || '5th of this month';
  const currentDate = new Date().toISOString().slice(0, 10);

  const titleMap = {
    due: 'Monthly Bill Due Reminder',
    overdue: 'Overdue Dues Notice',
    disconnection: 'Disconnection Warning',
    payment: 'Payment Acknowledgement',
    welcome: 'Welcome New Connection'
  };
  const title = titleMap[templateType] || 'Payment Reminder';

  return `
    <article class="reminder-print-slip thermal-receipt" aria-label="Customer payment reminder slip">
      <header class="thermal-header">
        <h2 class="thermal-company">Shahdara ISP Network</h2>
        <p class="thermal-tagline">شاہدرہ انٹرنیٹ سروسز · بل یاد دہانی</p>
        <div class="thermal-rule">================================</div>
        <p class="thermal-title"><strong>${title.toUpperCase()}</strong></p>
        <p class="thermal-date">Date: ${currentDate} · Cycle: ${month}</p>
        <div class="thermal-rule">--------------------------------</div>
      </header>

      <section class="thermal-customer-meta">
        <div class="thermal-row"><span>Account No:</span><strong>${custNum}</strong></div>
        <div class="thermal-row"><span>Customer:</span><strong>${name}</strong></div>
        <div class="thermal-row"><span>Phone:</span><span>${phone}</span></div>
        <div class="thermal-row"><span>Area / Mohalla:</span><span>${area}</span></div>
        <div class="thermal-row"><span>Due Date:</span><span>${dueDate}</span></div>
      </section>

      <div class="thermal-rule">--------------------------------</div>

      <section class="thermal-breakdown">
        <div class="thermal-row thermal-total-row">
          <span>Amount Payable:</span>
          <strong>PKR ${balance}</strong>
        </div>
      </section>

      ${customNote ? `
        <div class="thermal-rule">--------------------------------</div>
        <p class="thermal-notes"><strong>Note:</strong> ${escapeHtml(customNote)}</p>
      ` : ''}

      <div class="thermal-rule">================================</div>

      <footer class="thermal-footer">
        <p class="thermal-urgent">Pay by due date to avoid service disconnection.</p>
        <p class="thermal-payment-modes">EasyPaisa · JazzCash · Cash Collection</p>
        <div class="thermal-sig-block">
          <div class="thermal-sig-line"></div>
          <span>Collector / Officer Signature</span>
        </div>
        <p class="thermal-closing">Thank you for your cooperation!</p>
      </footer>
    </article>
  `;
}

/**
 * Calculates itemized billing invoice data for a customer for a given month.
 * @param {Object} customer
 * @param {string} [targetMonth] e.g. '2026-10'
 * @param {Object} [options]
 * @returns {Object}
 */
export function buildCustomerBillInvoiceData(customer, targetMonth = null, { referenceDate = new Date() } = {}) {
  if (!customer) {
    return {
      isValid: false,
      invoiceNumber: 'INV-000000-000',
      billingMonth: 'N/A',
      issueDate: 'N/A',
      dueDate: 'N/A',
      customerNumber: '000',
      customerName: 'Valued Subscriber',
      phone: 'Not recorded',
      area: 'Shahdara Town',
      packageName: 'Broadband Package',
      monthlyCharge: 0,
      arrears: 0,
      payments: 0,
      advanceCredit: 0,
      netPayable: 0,
      status: 'NO_BILL'
    };
  }

  const bills = Array.isArray(customer.bills) ? customer.bills : [];
  
  // Sort bills chronologically by month
  const sortedBills = [...bills].sort((a, b) => (a.month || '').localeCompare(b.month || ''));

  // If targetMonth not provided, use latest bill month or current PKT month
  let selectedBill = null;
  if (targetMonth) {
    selectedBill = sortedBills.find(b => b.month === targetMonth);
  }
  if (!selectedBill && sortedBills.length > 0) {
    selectedBill = sortedBills[sortedBills.length - 1];
  }

  const billingMonth = selectedBill?.month || targetMonth || new Date().toISOString().slice(0, 7);
  const custNum = customer.customerNumber ? String(customer.customerNumber).padStart(3, '0') : (customer.id || '001');
  const invoiceNumber = `INV-${billingMonth.replace('-', '')}-${custNum}`;

  // Issue date: 1st of billing month
  const issueDate = `${billingMonth}-01`;
  const dueDate = selectedBill?.dueDate || customer.customDueDate || `${billingMonth}-05`;

  const monthlyCharge = Number(selectedBill?.dueAmount ?? customer.monthlySellingAmount ?? 0);

  // Arrears: sum unpaid balances on all bills strictly BEFORE this billingMonth
  let arrears = 0;
  for (const b of sortedBills) {
    if ((b.month || '') < billingMonth) {
      const bDue = Number(b.dueAmount ?? 0);
      const bPaid = Array.isArray(b.payments) ? b.payments.reduce((sum, p) => sum + Number(p.amount ?? 0), 0) : 0;
      const bBal = Math.max(0, bDue - bPaid);
      arrears += bBal;
    }
  }

  // Payments applied to selected bill
  const billPayments = Array.isArray(selectedBill?.payments)
    ? selectedBill.payments.reduce((sum, p) => sum + Number(p.amount ?? 0), 0)
    : 0;

  // Total balance for this bill
  const netBillBalance = Math.max(0, monthlyCharge - billPayments);
  const totalPayable = netBillBalance + arrears;

  let status = 'UNPAID';
  if (!selectedBill && monthlyCharge === 0) {
    status = 'NO_BILL';
  } else if (totalPayable === 0) {
    status = 'PAID';
  } else if (billPayments > 0 || (monthlyCharge > 0 && totalPayable < (monthlyCharge + arrears))) {
    status = 'PARTIAL';
  }

  const area = [customer.mohalla, customer.zone].filter(Boolean).join(', ') || 'Shahdara Town';
  const packageName = customer.packageSpeed ? `${customer.packageSpeed} Mbps Fiber` : 'Standard Package';

  return {
    isValid: true,
    invoiceNumber,
    billingMonth,
    issueDate,
    dueDate,
    customerNumber: custNum,
    customerName: customer.name || 'Valued Subscriber',
    phone: customer.phone || 'Not recorded',
    address: customer.address || '',
    area,
    packageName,
    serviceStatus: customer.serviceStatus || 'active',
    monthlyCharge,
    arrears,
    payments: billPayments,
    advanceCredit: 0,
    netPayable: totalPayable,
    status
  };
}

/**
 * Generates semantic printable HTML for a customer billing invoice slip.
 * @param {Object} data - Output of buildCustomerBillInvoiceData
 * @param {Object} [options]
 * @param {'standard'|'thermal'} [options.format='standard']
 * @returns {string}
 */
export function generateBillInvoiceHtml(data, { format = 'standard', customNote = '' } = {}) {
  if (!data || !data.isValid) {
    return `<div class="empty-state">No invoice data available for this subscriber.</div>`;
  }

  const formatPkr = (n) => new Intl.NumberFormat('en-PK').format(n || 0);

  if (format === 'thermal') {
    return `
      <article class="bill-invoice-slip thermal-receipt" aria-label="Customer 80mm thermal bill invoice slip">
        <header class="thermal-header">
          <h2 class="thermal-company">Shahdara ISP Network</h2>
          <p class="thermal-tagline">شاہدرہ انٹرنیٹ سروسز · ماہانہ بل انوائس</p>
          <div class="thermal-rule">================================</div>
          <p class="thermal-title"><strong>MONTHLY BILL INVOICE</strong></p>
          <p class="thermal-date">Invoice: ${escapeHtml(data.invoiceNumber)}</p>
          <p class="thermal-date">Billing Month: ${escapeHtml(data.billingMonth)}</p>
          <div class="thermal-rule">--------------------------------</div>
        </header>

        <section class="thermal-customer-meta">
          <div class="thermal-row"><span>Account No:</span><strong>#${escapeHtml(data.customerNumber)}</strong></div>
          <div class="thermal-row"><span>Subscriber:</span><strong>${escapeHtml(data.customerName)}</strong></div>
          <div class="thermal-row"><span>Phone:</span><span>${escapeHtml(data.phone)}</span></div>
          <div class="thermal-row"><span>Area:</span><span>${escapeHtml(data.area)}</span></div>
          <div class="thermal-row"><span>Package:</span><span>${escapeHtml(data.packageName)}</span></div>
          <div class="thermal-row"><span>Status:</span><span>${escapeHtml(data.status)}</span></div>
        </section>

        <div class="thermal-rule">--------------------------------</div>

        <section class="thermal-breakdown">
          <div class="thermal-row"><span>Monthly Charge:</span><span>PKR ${formatPkr(data.monthlyCharge)}</span></div>
          ${data.arrears > 0 ? `<div class="thermal-row"><span>Arrears / Previous Due:</span><span>PKR ${formatPkr(data.arrears)}</span></div>` : ''}
          ${data.payments > 0 ? `<div class="thermal-row"><span>Payments Received:</span><span>- PKR ${formatPkr(data.payments)}</span></div>` : ''}
          <div class="thermal-rule">--------------------------------</div>
          <div class="thermal-row thermal-total-row">
            <span>TOTAL AMOUNT DUE:</span>
            <strong>PKR ${formatPkr(data.netPayable)}</strong>
          </div>
          <div class="thermal-row thermal-due-row">
            <span>DUE DATE:</span>
            <strong>${escapeHtml(data.dueDate)}</strong>
          </div>
        </section>

        ${customNote ? `
          <div class="thermal-rule">--------------------------------</div>
          <p class="thermal-notes"><strong>Note:</strong> ${escapeHtml(customNote)}</p>
        ` : ''}

        <div class="thermal-rule">================================</div>

        <footer class="thermal-footer">
          <p class="thermal-urgent">Please pay on or before due date to ensure uninterrupted connectivity.</p>
          <p class="thermal-payment-modes">Payment: EasyPaisa · JazzCash · Doorstep Cash</p>
          <div class="thermal-sig-block">
            <div class="thermal-sig-line"></div>
            <span>Billing Representative Signature</span>
          </div>
          <p class="thermal-closing">Thank you for choosing Shahdara ISP!</p>
        </footer>
      </article>
    `;
  }

  // Standard A4 / Executive Invoice Sheet
  return `
    <article class="bill-invoice-sheet" aria-label="Customer monthly bill invoice sheet">
      <header class="invoice-header">
        <div class="invoice-brand-block">
          <div class="invoice-brand-badge" aria-hidden="true">S</div>
          <div>
            <h1 class="invoice-title">Shahdara ISP Network</h1>
            <p class="invoice-subtitle">High-Speed Broadband &amp; Optical Fiber Services</p>
            <p class="invoice-urdu-tag">شاہدرہ انٹرنیٹ سروسز · کسٹمر بل انوائس</p>
          </div>
        </div>
        <div class="invoice-meta-block">
          <div class="invoice-badge ${data.status.toLowerCase()}">${escapeHtml(data.status)}</div>
          <p class="invoice-number"><strong>Invoice #:</strong> ${escapeHtml(data.invoiceNumber)}</p>
          <p class="invoice-date"><strong>Issue Date:</strong> ${escapeHtml(data.issueDate)}</p>
          <p class="invoice-due-date"><strong>Due Date:</strong> ${escapeHtml(data.dueDate)}</p>
          <p class="invoice-cycle"><strong>Billing Cycle:</strong> ${escapeHtml(data.billingMonth)}</p>
        </div>
      </header>

      ${customNote ? `
      <div class="invoice-note-banner">
        <strong>Special Notice:</strong> ${escapeHtml(customNote)}
      </div>
      ` : ''}

      <div class="invoice-parties-grid">
        <div class="invoice-party-box">
          <p class="party-label">BILLED TO (SUBSCRIBER)</p>
          <h2 class="party-name">${escapeHtml(data.customerName)}</h2>
          <p class="party-line"><strong>Account No:</strong> #${escapeHtml(data.customerNumber)}</p>
          <p class="party-line"><strong>Phone:</strong> ${escapeHtml(data.phone)}</p>
          <p class="party-line"><strong>Area / Zone:</strong> ${escapeHtml(data.area)}</p>
          ${data.address ? `<p class="party-line"><strong>Address:</strong> ${escapeHtml(data.address)}</p>` : ''}
        </div>
        <div class="invoice-party-box service-box">
          <p class="party-label">SUBSCRIPTION PROFILE</p>
          <h2 class="party-name">${escapeHtml(data.packageName)}</h2>
          <p class="party-line"><strong>Service State:</strong> ${escapeHtml(data.serviceStatus)}</p>
          <p class="party-line"><strong>Service Period:</strong> 01-${escapeHtml(data.billingMonth)} to Month End</p>
          <p class="party-line"><strong>Provider Gateway:</strong> Shahdara Core Optical</p>
        </div>
      </div>

      <table class="invoice-table" aria-label="Invoice charge breakdown">
        <thead>
          <tr>
            <th scope="col" class="col-desc">Description &amp; Service Item</th>
            <th scope="col" class="col-period">Period</th>
            <th scope="col" class="col-rate text-right">Nominal Rate</th>
            <th scope="col" class="col-amount text-right">Amount (PKR)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>${escapeHtml(data.packageName)}</strong>
              <div class="invoice-item-sub">Monthly recurring internet broadband package subscription</div>
            </td>
            <td>${escapeHtml(data.billingMonth)}</td>
            <td class="text-right">PKR ${formatPkr(data.monthlyCharge)}</td>
            <td class="text-right">PKR ${formatPkr(data.monthlyCharge)}</td>
          </tr>
          ${data.arrears > 0 ? `
          <tr class="arrears-row">
            <td>
              <strong>Previous Arrears / Unpaid Balance</strong>
              <div class="invoice-item-sub">Accumulated balance from prior unclosed billing cycles</div>
            </td>
            <td>Prior Cycles</td>
            <td class="text-right">—</td>
            <td class="text-right">PKR ${formatPkr(data.arrears)}</td>
          </tr>
          ` : ''}
          ${data.payments > 0 ? `
          <tr class="credits-row">
            <td>
              <strong>Recorded Payments / Installments</strong>
              <div class="invoice-item-sub">Direct receipts credited against this month's bill</div>
            </td>
            <td>${escapeHtml(data.billingMonth)}</td>
            <td class="text-right">—</td>
            <td class="text-right">- PKR ${formatPkr(data.payments)}</td>
          </tr>
          ` : ''}
        </tbody>
      </table>

      <div class="invoice-summary-section">
        <div class="invoice-payment-guidance">
          <h3>Payment Instructions (طریقہ ادائیگی)</h3>
          <ul>
            <li><strong>EasyPaisa / JazzCash:</strong> Send to operator account with Account No #${escapeHtml(data.customerNumber)} in reference.</li>
            <li><strong>Doorstep Collection:</strong> Hand over to authorized billing team (Umair / Saad) and request immediate digital receipt.</li>
            <li><strong>Helpline &amp; Support:</strong> Contact field technician for line latency or billing queries.</li>
          </ul>
        </div>
        <div class="invoice-totals-box">
          <div class="totals-row">
            <span>Current Month Charges:</span>
            <span>PKR ${formatPkr(data.monthlyCharge)}</span>
          </div>
          ${data.arrears > 0 ? `
          <div class="totals-row">
            <span>Previous Arrears:</span>
            <span>PKR ${formatPkr(data.arrears)}</span>
          </div>
          ` : ''}
          ${data.payments > 0 ? `
          <div class="totals-row">
            <span>Payments Deducted:</span>
            <span>- PKR ${formatPkr(data.payments)}</span>
          </div>
          ` : ''}
          <div class="totals-divider"></div>
          <div class="totals-row grand-total">
            <span>Net Payable by Due Date:</span>
            <strong>PKR ${formatPkr(data.netPayable)}</strong>
          </div>
          <div class="totals-row due-date-highlight">
            <span>Payment Due Date:</span>
            <strong>${escapeHtml(data.dueDate)}</strong>
          </div>
        </div>
      </div>

      <footer class="invoice-footer">
        <p class="notice">Notice: Please clear dues on or before <strong>${escapeHtml(data.dueDate)}</strong> to avoid automatic service suspension. For complaints or speed upgrades, contact our office.</p>
        <div class="invoice-auth-block">
          <div class="auth-sig-line"></div>
          <span>Authorized Signature &amp; Stamp</span>
        </div>
      </footer>
    </article>
  `;
}

/**
 * Builds clean WhatsApp text message for the customer monthly bill invoice.
 * @param {Object} data - Output of buildCustomerBillInvoiceData
 * @param {string} [customNote='']
 * @returns {string}
 */
export function buildWhatsAppBillInvoiceText(data, customNote = '') {
  if (!data || !data.isValid) return '';
  const formatPkr = (n) => new Intl.NumberFormat('en-PK').format(n || 0);

  const lines = [
    `*SHAHDARA ISP NETWORK - MONTHLY BILL INVOICE*`,
    `----------------------------------------`,
    `محترم صارف: *${data.customerName}*`,
    `اکاؤنٹ نمبر: *#${data.customerNumber}*`,
    `پیکج: *${data.packageName}*`,
    `بل کا مہینہ: *${data.billingMonth}*`,
    `انوائس نمبر: *${data.invoiceNumber}*`,
    `----------------------------------------`,
    `*تفصیلات بل (Bill Details):*`,
    `• رواں ماہ کے چارجز: PKR ${formatPkr(data.monthlyCharge)}`
  ];

  if (data.arrears > 0) {
    lines.push(`• پچھلے بقایا جات (Arrears): PKR ${formatPkr(data.arrears)}`);
  }
  if (data.payments > 0) {
    lines.push(`• ادا شدہ رقم (Paid): PKR ${formatPkr(data.payments)}`);
  }

  if (customNote) {
    lines.push(`• ضروری نوٹ (Notice): ${customNote}`);
  }

  lines.push(`----------------------------------------`);
  lines.push(`*کل قابل ادا رقم (Net Due): PKR ${formatPkr(data.netPayable)}*`);
  lines.push(`*آخری تاریخ (Due Date): ${data.dueDate}*`);
  lines.push(`----------------------------------------`);
  lines.push(`برائے مہربانی آخری تاریخ سے پہلے ادائیگی یقینی بنائیں تاکہ انٹرنیٹ سروس بلاتعطل جاری رہے۔`);
  lines.push(`ادائیگی بذریعہ: EasyPaisa / JazzCash یا کیش کلیکٹر۔`);
  lines.push(`شکریہ! شاہدرہ انٹرنیٹ سروسز نیٹ ورک`);

  return lines.join('\n');
}

/**
 * Generates a complete standalone HTML document with embedded styles for offline saving/viewing.
 * @param {Object} data
 * @param {Object} [options]
 * @returns {string}
 */
export function generateStandaloneInvoiceDocument(data, { format = 'standard', customNote = '' } = {}) {
  const bodyHtml = generateBillInvoiceHtml(data, { format, customNote });
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Invoice - ${escapeHtml(data?.invoiceNumber || 'INV')} - Shahdara ISP</title>
  <style>
    body { font-family: Manrope, system-ui, -apple-system, sans-serif; background: #f7fafc; margin: 0; padding: 24px; display: flex; justify-content: center; }
    .bill-invoice-sheet { background: #fff; max-width: 760px; width: 100%; padding: 32px; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
    .invoice-header { display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; }
    .invoice-brand-block { display: flex; gap: 14px; align-items: center; }
    .invoice-brand-badge { width: 46px; height: 46px; border-radius: 10px; background: #0e5b4d; color: #fff; font: 800 24px/46px sans-serif; text-align: center; }
    .invoice-title { font-size: 20px; font-weight: 800; color: #0e5b4d; margin: 0; }
    .invoice-subtitle { font-size: 12px; color: #718096; margin: 2px 0 0; }
    .invoice-urdu-tag { font-size: 13px; color: #2d3748; margin: 2px 0 0; direction: rtl; }
    .invoice-meta-block { text-align: right; font-size: 12px; color: #4a5568; }
    .invoice-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-weight: 700; font-size: 11px; text-transform: uppercase; margin-bottom: 6px; }
    .invoice-badge.unpaid { background: #fed7d7; color: #c53030; }
    .invoice-badge.paid { background: #c6f6d5; color: #22543d; }
    .invoice-badge.partial { background: #feebc8; color: #c05621; }
    .invoice-parties-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 24px 0; }
    .invoice-party-box { background: #f7fafc; padding: 16px; border-radius: 8px; border: 1px solid #edf2f7; }
    .party-label { font-size: 10px; font-weight: 700; color: #718096; margin: 0 0 6px; }
    .party-name { font-size: 16px; font-weight: 700; color: #1a202c; margin: 0 0 8px; }
    .party-line { font-size: 12px; color: #4a5568; margin: 3px 0; }
    .invoice-table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px; }
    .invoice-table th { background: #edf2f7; color: #2d3748; padding: 10px 14px; text-align: left; }
    .invoice-table td { padding: 12px 14px; border-bottom: 1px solid #edf2f7; }
    .text-right { text-align: right; }
    .invoice-summary-section { display: grid; grid-template-columns: 1.2fr 1fr; gap: 24px; margin-top: 20px; padding-top: 16px; border-top: 2px solid #e2e8f0; }
    .invoice-payment-guidance { font-size: 11px; color: #4a5568; }
    .invoice-totals-box { background: #f7fafc; padding: 16px; border-radius: 8px; border: 1px solid #edf2f7; }
    .totals-row { display: flex; justify-content: space-between; font-size: 12px; margin: 4px 0; color: #4a5568; }
    .totals-divider { height: 1px; background: #cbd5e0; margin: 8px 0; }
    .totals-row.grand-total { font-size: 15px; font-weight: 800; color: #0e5b4d; }
    .totals-row.due-date-highlight { font-size: 13px; font-weight: 700; color: #c53030; margin-top: 6px; }
    .invoice-footer { margin-top: 28px; padding-top: 16px; border-top: 1px dashed #cbd5e0; display: flex; justify-content: space-between; align-items: flex-end; }
    .invoice-footer .notice { font-size: 11px; color: #718096; max-width: 440px; margin: 0; line-height: 1.4; }
    .auth-sig-line { width: 140px; border-bottom: 1px solid #718096; margin-bottom: 4px; }
    .invoice-note-banner { background: #fffaf0; border: 1px solid #feebc8; border-left: 4px solid #dd6b20; padding: 10px 14px; border-radius: 6px; margin: 16px 0; font-size: 12px; color: #7b341e; }
    .standalone-print-bar { max-width: 760px; width: 100%; margin-bottom: 12px; display: flex; justify-content: flex-end; }
    .standalone-print-btn { background: #0e5b4d; color: #fff; border: none; border-radius: 6px; padding: 8px 16px; font-weight: 700; cursor: pointer; font-size: 13px; }
    @media print { .standalone-print-bar { display: none !important; } body { background: #fff; padding: 0; } .bill-invoice-sheet { box-shadow: none; padding: 0; } }
  </style>
</head>
<body>
  <div class="standalone-print-bar">
    <button type="button" class="standalone-print-btn" onclick="window.print()">🖨️ Print / Save PDF</button>
  </div>
  ${bodyHtml}
</body>
</html>`;
}

/**
 * Triggers browser download of HTML content as a file.
 * @param {string} filename
 * @param {string} htmlContent
 * @param {Document} [doc]
 * @returns {boolean}
 */
export function downloadHtmlFile(filename, htmlContent, doc = (typeof document !== 'undefined' ? document : null)) {
  if (!doc || typeof Blob === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return false;
  }
  try {
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = doc.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename || 'invoice.html');
    if (link.style) link.style.display = 'none';
    if (doc.body) doc.body.appendChild(link);
    link.click();
    if (doc.body) doc.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
}

/**
 * Helper to convert YYYY-MM to human readable label.
 */
function formatAuditMonthLabel(monthStr) {
  if (!monthStr || !monthStr.includes('-')) return monthStr || '—';
  const [y, m] = monthStr.split('-');
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthIndex = parseInt(m, 10) - 1;
  if (monthIndex >= 0 && monthIndex < 12) {
    return `${monthNames[monthIndex]} ${y}`;
  }
  return monthStr;
}

/**
 * Reconciles and audits a customer's entire multi-month billing and payment history.
 * Detects discrepancies, lingering arrears, unapplied credits, and timing mismatches.
 * @param {Object} customer
 * @param {Object} [state]
 * @returns {Object}
 */
export function reconcileCustomerLedger(customer, state = {}) {
  if (!customer) {
    return {
      customer: null,
      reconciliationStatus: 'CLEAN',
      statusLabel: 'No Record',
      statusClass: 'audit-pill-clean',
      totalBilled: 0,
      totalPaid: 0,
      netOutstanding: 0,
      unappliedCredit: 0,
      monthsBilledCount: 0,
      monthsPaidCount: 0,
      monthsPendingCount: 0,
      monthsPartialCount: 0,
      discrepancyCount: 0,
      discrepancies: [],
      auditRows: []
    };
  }

  const bills = Array.isArray(customer.bills) ? customer.bills : [];
  const discrepancies = [];
  const auditRows = [];

  let totalBilledCents = 0;
  let totalPaidCents = 0;
  let monthsPaidCount = 0;
  let monthsPendingCount = 0;
  let monthsPartialCount = 0;
  let unappliedCreditCents = 0;

  const receiptDatesMap = new Map();
  const sortedBills = [...bills].sort((a, b) => (a.month || '').localeCompare(b.month || ''));

  sortedBills.forEach(bill => {
    const dueCents = Math.round(Number(bill.dueAmount ?? 0) * 100);
    totalBilledCents += dueCents > 0 ? dueCents : 0;

    const payments = Array.isArray(bill.payments) ? bill.payments : [];
    let billDirectPaidCents = 0;

    payments.forEach(p => {
      const pCents = Math.round(Number(p.amount ?? 0) * 100);
      if (pCents > 0) {
        billDirectPaidCents += pCents;
        totalPaidCents += pCents;

        if (p.date) {
          const count = receiptDatesMap.get(p.date) || 0;
          receiptDatesMap.set(p.date, count + 1);

          if (bill.month) {
            const billYear = parseInt(bill.month.slice(0, 4), 10);
            const billMonth = parseInt(bill.month.slice(5, 7), 10);
            const pDate = new Date(p.date);
            const pYear = pDate.getFullYear();
            const pMonth = pDate.getMonth() + 1;
            const diffMonths = (pYear - billYear) * 12 + (pMonth - billMonth);
            if (diffMonths >= 3) {
              discrepancies.push({
                type: 'DELAYED_PAYMENT',
                severity: 'warning',
                month: bill.month,
                message: `Payment of PKR ${(pCents / 100).toLocaleString()} on ${p.date} was settled ${diffMonths} months after service month ${bill.month}.`
              });
            }
          }
        }
      }
    });

    const isPaid = bill.paid === true || (dueCents > 0 && billDirectPaidCents >= dueCents);
    const isPartial = !isPaid && billDirectPaidCents > 0 && billDirectPaidCents < dueCents;
    const isPending = !isPaid && !isPartial && dueCents > 0;

    if (isPaid) monthsPaidCount++;
    else if (isPartial) {
      monthsPartialCount++;
      const unpaidDiff = (dueCents - billDirectPaidCents) / 100;
      discrepancies.push({
        type: 'LINGERING_PARTIAL',
        severity: 'warning',
        month: bill.month,
        message: `Month ${bill.month || 'unspecified'} has partial balance of PKR ${unpaidDiff.toLocaleString()} remaining.`
      });
    } else if (isPending) {
      monthsPendingCount++;
      discrepancies.push({
        type: 'OVERDUE_ARREARS',
        severity: 'danger',
        month: bill.month,
        message: `Month ${bill.month || 'unspecified'} is unpaid with outstanding balance of PKR ${(dueCents / 100).toLocaleString()}.`
      });
    }

    const rowStatus = isPaid ? 'PAID' : isPartial ? 'PARTIAL' : isPending ? 'PENDING' : 'NOT_SET';
    const rowBalanceCents = Math.max(0, dueCents - billDirectPaidCents);

    auditRows.push({
      month: bill.month || '—',
      monthLabel: formatAuditMonthLabel(bill.month),
      dueDate: bill.dueDate || (bill.month ? `${bill.month}-05` : '—'),
      billedAmount: dueCents / 100,
      paidAmount: billDirectPaidCents / 100,
      balanceAmount: rowBalanceCents / 100,
      status: rowStatus,
      receiptCount: payments.length
    });
  });

  for (const [date, count] of receiptDatesMap.entries()) {
    if (count > 1) {
      discrepancies.push({
        type: 'DUPLICATE_RECEIPT_DATE',
        severity: 'info',
        date,
        message: `${count} separate payment receipts recorded on the same date (${date}). Verify if these are multiple installments or accidental duplicates.`
      });
    }
  }

  if (customer.serviceStatus === 'active' && (!bills.length || totalBilledCents === 0)) {
    discrepancies.push({
      type: 'ACTIVE_UNBILLED',
      severity: 'danger',
      message: `Customer is marked Active in service status but has 0 recorded bill snapshots.`
    });
  }

  if (totalPaidCents > totalBilledCents) {
    unappliedCreditCents = totalPaidCents - totalBilledCents;
    discrepancies.push({
      type: 'SURPLUS_CREDIT',
      severity: 'info',
      message: `Total collections exceed total billed by PKR ${(unappliedCreditCents / 100).toLocaleString()} (advance prepaid credit).`
    });
  }

  const netOutstandingCents = Math.max(0, totalBilledCents - totalPaidCents);

  let reconciliationStatus = 'CLEAN';
  let statusLabel = 'Balanced & Clean';
  let statusClass = 'audit-pill-clean';

  if (discrepancies.some(d => d.severity === 'danger')) {
    reconciliationStatus = 'ARREARS_PENDING';
    statusLabel = 'Arrears / Attention Required';
    statusClass = 'audit-pill-danger';
  } else if (unappliedCreditCents > 0) {
    reconciliationStatus = 'CREDIT_SURPLUS';
    statusLabel = 'Credit Surplus / Advance Paid';
    statusClass = 'audit-pill-info';
  } else if (discrepancies.length > 0) {
    reconciliationStatus = 'DISCREPANCIES_FOUND';
    statusLabel = 'Minor Audit Flags';
    statusClass = 'audit-pill-warning';
  }

  return {
    customer,
    reconciliationStatus,
    statusLabel,
    statusClass,
    totalBilled: totalBilledCents / 100,
    totalPaid: totalPaidCents / 100,
    netOutstanding: netOutstandingCents / 100,
    unappliedCredit: unappliedCreditCents / 100,
    monthsBilledCount: bills.length,
    monthsPaidCount,
    monthsPendingCount,
    monthsPartialCount,
    discrepancyCount: discrepancies.length,
    discrepancies,
    auditRows
  };
}

/**
 * Formats a comprehensive plaintext & WhatsApp-ready briefing report.
 * @param {Object} auditResult
 * @param {Object} [customer]
 * @returns {string}
 */
export function generateLedgerAuditReport(auditResult, customer) {
  if (!auditResult) return '';
  const c = customer || auditResult.customer || {};
  const dateStr = new Date().toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' });
  const lines = [
    `═══════════════════════════════════════════════════════`,
    `SHAHDARA ISP BILLING · CUSTOMER LEDGER AUDIT REPORT`,
    `═══════════════════════════════════════════════════════`,
    `Customer: ${c.name || 'Unnamed'} (ID: ${c.customerNumber ? `#${c.customerNumber}` : (c.id || '—')})`,
    `Phone: ${c.phone || 'Not provided'} | Area: ${c.area || c.mohalla || 'Shahdara Network'}`,
    `Audit Date: ${dateStr}`,
    `Reconciliation Status: [${auditResult.statusLabel || auditResult.reconciliationStatus}]`,
    `───────────────────────────────────────────────────────`,
    `FINANCIAL SUMMARY:`,
    `  Total Billed:       PKR ${Number(auditResult.totalBilled || 0).toLocaleString()}`,
    `  Total Collected:    PKR ${Number(auditResult.totalPaid || 0).toLocaleString()}`,
    `  Net Outstanding:    PKR ${Number(auditResult.netOutstanding || 0).toLocaleString()}`,
    `  Prepaid Credit:     PKR ${Number(auditResult.unappliedCredit || 0).toLocaleString()}`,
    `  Months Monitored:   ${auditResult.monthsBilledCount || 0} (${auditResult.monthsPaidCount || 0} paid in full, ${auditResult.monthsPartialCount || 0} partial, ${auditResult.monthsPendingCount || 0} unpaid)`,
    `───────────────────────────────────────────────────────`
  ];

  if (auditResult.discrepancies && auditResult.discrepancies.length > 0) {
    lines.push(`AUDIT DISCREPANCIES & FINDINGS (${auditResult.discrepancies.length}):`);
    auditResult.discrepancies.forEach((d, i) => {
      const tag = d.severity === 'danger' ? '⚠️ CRITICAL' : d.severity === 'warning' ? '⚡ WARNING' : 'ℹ️ NOTICE';
      lines.push(`  ${i + 1}. [${tag}] ${d.message}`);
    });
    lines.push(`───────────────────────────────────────────────────────`);
  } else {
    lines.push(`AUDIT FINDINGS:`);
    lines.push(`  ✓ All recorded bill snapshots match actual receipt ledger perfectly.`);
    lines.push(`  ✓ No orphaned balances, arrears, or unapplied carry-forwards detected.`);
    lines.push(`───────────────────────────────────────────────────────`);
  }

  lines.push(`MONTHLY LEDGER BREAKDOWN:`);
  lines.push(`Month     | Billed (PKR) | Paid (PKR)   | Balance Due  | Status`);
  lines.push(`----------+--------------+--------------+--------------+---------`);
  if (Array.isArray(auditResult.auditRows) && auditResult.auditRows.length > 0) {
    auditResult.auditRows.forEach(r => {
      const m = String(r.month).padEnd(9);
      const b = String(Number(r.billedAmount).toLocaleString()).padStart(12);
      const p = String(Number(r.paidAmount).toLocaleString()).padStart(12);
      const bal = String(Number(r.balanceAmount).toLocaleString()).padStart(12);
      lines.push(`${m} | ${b} | ${p} | ${bal} | ${r.status}`);
    });
  } else {
    lines.push(`No historical billing months recorded for this subscriber.`);
  }

  lines.push(`═══════════════════════════════════════════════════════`);
  lines.push(`Generated by Shahdara ISP Accounting & Quality Assurance`);
  return lines.join('\n');
}

/**
 * Generates RFC-4180 CSV export of audited ledger.
 * @param {Object} auditResult
 * @param {Object} [customer]
 * @returns {string}
 */
export function generateLedgerAuditCsv(auditResult, customer) {
  if (!auditResult) return '';
  const headers = ['Month', 'Month_Label', 'Due_Date', 'Billed_PKR', 'Paid_PKR', 'Balance_Due_PKR', 'Status', 'Receipts_Count'];
  const rows = [];

  if (Array.isArray(auditResult.auditRows)) {
    auditResult.auditRows.forEach(r => {
      rows.push([
        r.month || '',
        r.monthLabel || '',
        r.dueDate || '',
        String(r.billedAmount ?? 0),
        String(r.paidAmount ?? 0),
        String(r.balanceAmount ?? 0),
        r.status || '',
        String(r.receiptCount ?? 0)
      ]);
    });
  }

  return generateCsvContent(headers, rows);
}

/**
 * Generates printable HTML representation of audited ledger.
 * @param {Object} auditResult
 * @param {Object} [customer]
 * @returns {string}
 */
export function generateLedgerAuditPrintHtml(auditResult, customer) {
  if (!auditResult) return '';
  const c = customer || auditResult.customer || {};
  const dateStr = new Date().toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' });

  const rowsHtml = (auditResult.auditRows || []).map(r => `
    <tr>
      <td>${escapeHtml(r.monthLabel || r.month)}</td>
      <td>${escapeHtml(r.dueDate)}</td>
      <td class="text-right">PKR ${Number(r.billedAmount || 0).toLocaleString()}</td>
      <td class="text-right">PKR ${Number(r.paidAmount || 0).toLocaleString()}</td>
      <td class="text-right font-bold">PKR ${Number(r.balanceAmount || 0).toLocaleString()}</td>
      <td class="text-center"><span class="audit-status-tag ${escapeHtml((r.status || '').toLowerCase())}">${escapeHtml(r.status)}</span></td>
    </tr>
  `).join('');

  const discrepanciesHtml = (auditResult.discrepancies || []).map(d => `
    <li class="audit-disc-item ${escapeHtml(d.severity)}">
      <strong>[${escapeHtml(d.severity.toUpperCase())}]</strong> ${escapeHtml(d.message)}
    </li>
  `).join('');

  return `
  <div class="audit-print-document">
    <div class="audit-print-header">
      <div class="brand">
        <h2>SHAHDARA ISP NETWORKS</h2>
        <p>Customer Ledger Reconciliation &amp; Financial Quality Assurance Audit</p>
      </div>
      <div class="meta">
        <p><strong>Audit Date:</strong> ${escapeHtml(dateStr)}</p>
        <p><strong>Status:</strong> <span class="badge ${escapeHtml(auditResult.statusClass)}">${escapeHtml(auditResult.statusLabel)}</span></p>
      </div>
    </div>

    <div class="audit-client-card">
      <p><strong>Subscriber:</strong> ${escapeHtml(c.name || 'Unnamed')} (#${escapeHtml(c.customerNumber || c.id)})</p>
      <p><strong>Phone:</strong> ${escapeHtml(c.phone || '—')} | <strong>Location:</strong> ${escapeHtml(c.area || c.mohalla || 'Shahdara Network')}</p>
      <p><strong>Service Status:</strong> ${escapeHtml(c.serviceStatus || 'Not set')} | <strong>Package:</strong> ${escapeHtml(c.packageSpeed || 'Standard')}</p>
    </div>

    <div class="audit-kpi-ribbon">
      <div class="kpi-box"><span class="kpi-label">TOTAL BILLED</span><span class="kpi-value">PKR ${Number(auditResult.totalBilled || 0).toLocaleString()}</span></div>
      <div class="kpi-box"><span class="kpi-label">TOTAL COLLECTED</span><span class="kpi-value">PKR ${Number(auditResult.totalPaid || 0).toLocaleString()}</span></div>
      <div class="kpi-box"><span class="kpi-label">NET BALANCE DUE</span><span class="kpi-value highlight-red">PKR ${Number(auditResult.netOutstanding || 0).toLocaleString()}</span></div>
      <div class="kpi-box"><span class="kpi-label">PREPAID CREDIT</span><span class="kpi-value highlight-green">PKR ${Number(auditResult.unappliedCredit || 0).toLocaleString()}</span></div>
    </div>

    ${auditResult.discrepancies?.length ? `
      <div class="audit-disc-section">
        <h3>Audit Discrepancies &amp; Findings (${auditResult.discrepancies.length})</h3>
        <ul class="audit-disc-list">${discrepanciesHtml}</ul>
      </div>
    ` : `
      <div class="audit-clean-banner">
        <p>✓ All recorded bill snapshots match payment ledger receipts. No unaccounted imbalances detected.</p>
      </div>
    `}

    <table class="audit-print-table">
      <thead>
        <tr>
          <th>Service Month</th>
          <th>Due Date</th>
          <th class="text-right">Billed Amount</th>
          <th class="text-right">Collections</th>
          <th class="text-right">Balance Due</th>
          <th class="text-center">Status</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || '<tr><td colspan="6" class="text-center">No billing history found.</td></tr>'}
      </tbody>
    </table>

    <div class="audit-footer-signatures">
      <div class="sig-col">
        <div class="sig-line"></div>
        <p>Accounting Auditor / QA Officer</p>
      </div>
      <div class="sig-col">
        <div class="sig-line"></div>
        <p>Network Operations Director</p>
      </div>
    </div>
  </div>`;
}

/**
 * Calculates sum of cash note denominations.
 * @param {Object} denominations - Map of denomination to count, e.g. { 5000: 2, 1000: 5, ... }
 * @returns {number}
 */
export function calculateDenominationTotal(denominations = {}) {
  if (!denominations || typeof denominations !== 'object') return 0;
  const noteValues = [5000, 1000, 500, 100, 50, 20, 10];
  let total = 0;
  for (const val of noteValues) {
    const count = Number(denominations[val]) || 0;
    if (count > 0) {
      total += count * val;
    }
  }
  return total;
}

/**
 * Builds itemized financial daily cash register dataset (Roshnamcha / روزنامچہ کیش رجسٹر).
 * Aggregates all collections dated on selectedDate, categorizes by payment method (cash vs digital),
 * balances against operating expenses dated on selectedDate, incorporates opening cash float,
 * and audits physical cash count denominations.
 *
 * @param {Object} state - The ISP ledger state
 * @param {string} selectedDateStr - Target calendar date 'YYYY-MM-DD'
 * @param {Object} [options]
 * @param {number} [options.openingCash=0] - Initial physical cash in drawer
 * @param {Object} [options.denominations={}] - Physical note counts { 5000: N, 1000: N, ... }
 * @returns {Object}
 */
export function buildDailyRegisterData(state, selectedDateStr, options = {}) {
  const targetDate = String(selectedDateStr || new Date().toISOString().slice(0, 10)).trim();
  const openingCash = Math.max(0, Number(options.openingCash) || 0);
  const denominations = options.denominations || {};

  const payments = [];
  if (state && Array.isArray(state.customers)) {
    for (const cust of state.customers) {
      if (Array.isArray(cust.bills)) {
        for (const bill of cust.bills) {
          if (Array.isArray(bill.payments)) {
            for (let idx = 0; idx < bill.payments.length; idx++) {
              const p = bill.payments[idx];
              const pDate = String(p.date || '').slice(0, 10);
              if (pDate === targetDate) {
                const amount = Number(p.amount) || 0;
                const method = String(p.method || 'Cash').trim();
                const isCash = method.toLowerCase() === 'cash';
                payments.push({
                  customerId: cust.id,
                  customerNumber: cust.customerNumber || '',
                  customerName: cust.name || 'Unnamed',
                  billMonth: bill.month || '',
                  amount,
                  method,
                  isCash,
                  notes: p.notes || '',
                  receiptId: p.receiptId || `REC-${targetDate.replace(/-/g, '')}-${cust.customerNumber || '0'}-${idx + 1}`
                });
              }
            }
          }
        }
      }
    }
  }

  // Sort payments chronologically or by customer number
  payments.sort((a, b) => Number(a.customerNumber || 0) - Number(b.customerNumber || 0));

  const expenses = [];
  if (state && Array.isArray(state.expenses)) {
    for (const exp of state.expenses) {
      const expDate = String(exp.date || '').slice(0, 10);
      if (expDate === targetDate) {
        expenses.push({
          id: exp.id,
          category: exp.category || 'General',
          amount: Number(exp.amount) || 0,
          notes: exp.notes || ''
        });
      }
    }
  }

  // Financial aggregates
  let cashCollections = 0;
  let digitalCollections = 0;
  const collectionsByMethod = {
    Cash: { count: 0, total: 0 },
    EasyPaisa: { count: 0, total: 0 },
    JazzCash: { count: 0, total: 0 },
    'Bank Transfer': { count: 0, total: 0 },
    Other: { count: 0, total: 0 }
  };

  for (const p of payments) {
    if (p.isCash) {
      cashCollections += p.amount;
      collectionsByMethod.Cash.count++;
      collectionsByMethod.Cash.total += p.amount;
    } else {
      digitalCollections += p.amount;
      const normalizedKey = Object.keys(collectionsByMethod).find(
        k => k.toLowerCase() === p.method.toLowerCase()
      ) || 'Other';
      collectionsByMethod[normalizedKey].count++;
      collectionsByMethod[normalizedKey].total += p.amount;
    }
  }

  const totalCollections = cashCollections + digitalCollections;
  const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  // Net physical cash in register
  const netPhysicalCash = openingCash + cashCollections - totalExpenses;

  // Physical note count audit
  const physicalCountTotal = calculateDenominationTotal(denominations);
  const hasCountedNotes = Object.values(denominations).some(c => Number(c) > 0);
  const cashVariance = hasCountedNotes ? (physicalCountTotal - netPhysicalCash) : 0;

  let varianceStatus = 'uncounted';
  let varianceLabel = 'Physical count pending';
  if (hasCountedNotes) {
    if (cashVariance === 0) {
      varianceStatus = 'balanced';
      varianceLabel = 'Register Balanced (PKR 0 discrepancy)';
    } else if (cashVariance > 0) {
      varianceStatus = 'surplus';
      varianceLabel = `Cash Surplus (+PKR ${cashVariance.toLocaleString()})`;
    } else {
      varianceStatus = 'deficit';
      varianceLabel = `Cash Deficit (-PKR ${Math.abs(cashVariance).toLocaleString()})`;
    }
  }

  return {
    date: targetDate,
    payments,
    expenses,
    collectionsByMethod,
    cashCollections,
    digitalCollections,
    totalCollections,
    totalExpenses,
    openingCash,
    netPhysicalCash,
    physicalCountTotal,
    hasCountedNotes,
    cashVariance,
    varianceStatus,
    varianceLabel,
    denominations,
    transactionCount: payments.length,
    expenseCount: expenses.length
  };
}

/**
 * Builds professional WhatsApp message text for the daily register closing.
 * @param {Object} data - Output of buildDailyRegisterData
 * @returns {string}
 */
export function formatDailyRegisterWhatsAppText(data) {
  if (!data) return '';
  const formatPkr = (n) => Number(n || 0).toLocaleString();

  const lines = [
    `📊 *SHAHDARA BROADBAND - DAILY REGISTER (ROSHNAMCHA)* 📊`,
    `📅 *تاریخ (Date):* ${data.date}`,
    `----------------------------------------`,
    `💵 *کیش کاؤنٹر (PHYSICAL CASH REGISTER):*`,
    `• ابتدائی کیش (Opening Float): PKR ${formatPkr(data.openingCash)}`,
    `• کیش وصولی (Cash Collections): + PKR ${formatPkr(data.cashCollections)} (${data.collectionsByMethod?.Cash?.count || 0} رسیدیں)`,
    `• یومیہ اخراجات (Cash Outflows): - PKR ${formatPkr(data.totalExpenses)} (${data.expenseCount} انٹریز)`,
    `----------------------------------------`,
    `💰 *نیٹ کیش دراز (NET PHYSICAL CASH IN REGISTER):*`,
    `👉 *PKR ${formatPkr(data.netPhysicalCash)}*`,
    ``,
    `💳 *ڈیجیٹل و آن لائن وصولی (DIGITAL COLLECTIONS):*`,
    `• ایزی پیسہ / جاز کیش / بینک: PKR ${formatPkr(data.digitalCollections)} (${data.transactionCount - (data.collectionsByMethod?.Cash?.count || 0)} رسیدیں)`,
    ``,
    `📈 *کل یومیہ وصولی (GRAND TOTAL INFLOWS):*`,
    `👉 *PKR ${formatPkr(data.totalCollections)}* (${data.transactionCount} کل ٹرانزیکشنز)`
  ];

  if (data.hasCountedNotes) {
    lines.push(`----------------------------------------`);
    lines.push(`🔍 *فزیکل کیش آڈٹ (PHYSICAL COUNT AUDIT):*`);
    lines.push(`• گنتی کی رقم (Note Count Total): PKR ${formatPkr(data.physicalCountTotal)}`);
    lines.push(`• آڈٹ کیفیت (Audit Result): *${data.varianceLabel}*`);
  }

  lines.push(`----------------------------------------`);
  lines.push(`تصدیق شدہ برائے فیلڈ ریکوری اور حساب کتاب`);
  lines.push(`شاہدرہ انٹرنیٹ سروسز لیجر (آف لائن محفوظ)`);

  return lines.join('\n');
}

/**
 * Generates RFC-4180 CSV export of the daily cash register closing statement.
 * @param {Object} data - Output of buildDailyRegisterData
 * @returns {string}
 */
export function generateDailyRegisterCsv(data) {
  if (!data) return '';

  const summaryHeaders = ['Metric', 'Amount_PKR', 'Details'];
  const summaryRows = [
    ['Register_Date', data.date, ''],
    ['Opening_Cash_Float', String(data.openingCash), 'Cash carried forward at shift start'],
    ['Cash_Collections', String(data.cashCollections), `${data.collectionsByMethod?.Cash?.count || 0} cash receipts`],
    ['Digital_Collections', String(data.digitalCollections), `${data.transactionCount - (data.collectionsByMethod?.Cash?.count || 0)} digital receipts`],
    ['Total_Day_Collections', String(data.totalCollections), `${data.transactionCount} total customer payments`],
    ['Total_Day_Expenses', String(data.totalExpenses), `${data.expenseCount} expense entries`],
    ['Net_Physical_Cash_Expected', String(data.netPhysicalCash), 'Opening + Cash Inflow - Cash Outflow'],
    ['Physical_Count_Total', String(data.physicalCountTotal), data.hasCountedNotes ? 'Audited' : 'Uncounted'],
    ['Cash_Variance', String(data.cashVariance), data.varianceLabel]
  ];

  const receiptHeaders = ['Type', 'Customer_No', 'Customer_Name', 'Bill_Month', 'Payment_Method', 'Amount_PKR', 'Receipt_ID', 'Notes'];
  const receiptRows = (data.payments || []).map(p => [
    'COLLECTION',
    String(p.customerNumber || ''),
    p.customerName || '',
    p.billMonth || '',
    p.method || '',
    String(p.amount || 0),
    p.receiptId || '',
    p.notes || ''
  ]);

  const expenseRows = (data.expenses || []).map(e => [
    'EXPENSE',
    '',
    '',
    '',
    e.category || '',
    String(e.amount || 0),
    e.id || '',
    e.notes || ''
  ]);

  const allRows = [
    ...summaryRows.map(r => ['SUMMARY', ...r]),
    ['', '', '', '', '', '', '', ''],
    receiptHeaders,
    ...receiptRows,
    ['', '', '', '', '', '', '', ''],
    ['Type', '', '', '', 'Category', 'Amount_PKR', 'Expense_ID', 'Description'],
    ...expenseRows
  ];

  return generateCsvContent(['Section', 'Col1', 'Col2', 'Col3', 'Col4', 'Col5', 'Col6', 'Col7'], allRows);
}

/**
 * Generates formal printable HTML representation for Daily Cash Register / Roshnamcha sheet.
 * @param {Object} data - Output of buildDailyRegisterData
 * @returns {string}
 */
export function generateDailyRegisterPrintHtml(data) {
  if (!data) return '';
  const formatPkr = (n) => Number(n || 0).toLocaleString();

  const receiptsRows = (data.payments || []).map((p, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>#${escapeHtml(p.customerNumber)}</td>
      <td><strong>${escapeHtml(p.customerName)}</strong></td>
      <td>${escapeHtml(p.billMonth)}</td>
      <td><span class="pay-method-pill ${p.isCash ? 'method-cash' : 'method-digital'}">${escapeHtml(p.method)}</span></td>
      <td class="text-right font-mono font-bold">PKR ${formatPkr(p.amount)}</td>
    </tr>
  `).join('');

  const expensesRows = (data.expenses || []).map((e, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><strong>${escapeHtml(e.category)}</strong></td>
      <td>${escapeHtml(e.notes || '—')}</td>
      <td class="text-right font-mono font-bold highlight-red">PKR ${formatPkr(e.amount)}</td>
    </tr>
  `).join('');

  const denomRows = [5000, 1000, 500, 100, 50, 20, 10].map(val => {
    const count = Number(data.denominations?.[val]) || 0;
    const subtotal = count * val;
    return `
      <div class="denom-row-item">
        <span class="denom-val">PKR ${val.toLocaleString()} × ${count}</span>
        <span class="denom-total font-mono">PKR ${subtotal.toLocaleString()}</span>
      </div>
    `;
  }).join('');

  return `
    <div class="register-print-document">
      <header class="register-print-header">
        <div class="brand">
          <h2>SHAHDARA BROADBAND &amp; ISP NETWORKS</h2>
          <p class="subtitle">Daily Cash Register &amp; Day-End Closing Statement (روزنامچہ کیش رجسٹر)</p>
        </div>
        <div class="register-meta-badge">
          <p><strong>Register Date:</strong> ${escapeHtml(data.date)}</p>
          <p><strong>Status:</strong> <span class="variance-pill variance-${escapeHtml(data.varianceStatus)}">${escapeHtml(data.varianceLabel)}</span></p>
        </div>
      </header>

      <div class="register-summary-ribbon">
        <div class="reg-kpi-card">
          <span class="reg-kpi-lbl">Opening Cash Float</span>
          <span class="reg-kpi-val font-mono">PKR ${formatPkr(data.openingCash)}</span>
        </div>
        <div class="reg-kpi-card">
          <span class="reg-kpi-lbl">Cash Collections (${data.collectionsByMethod?.Cash?.count || 0})</span>
          <span class="reg-kpi-val font-mono highlight-green">+ PKR ${formatPkr(data.cashCollections)}</span>
        </div>
        <div class="reg-kpi-card">
          <span class="reg-kpi-lbl">Operating Outflows (${data.expenseCount})</span>
          <span class="reg-kpi-val font-mono highlight-red">- PKR ${formatPkr(data.totalExpenses)}</span>
        </div>
        <div class="reg-kpi-card highlight-box">
          <span class="reg-kpi-lbl">Net Physical Cash</span>
          <span class="reg-kpi-val font-mono font-bold">PKR ${formatPkr(data.netPhysicalCash)}</span>
        </div>
        <div class="reg-kpi-card">
          <span class="reg-kpi-lbl">Digital Inflows (${data.transactionCount - (data.collectionsByMethod?.Cash?.count || 0)})</span>
          <span class="reg-kpi-val font-mono">PKR ${formatPkr(data.digitalCollections)}</span>
        </div>
        <div class="reg-kpi-card">
          <span class="reg-kpi-lbl">Grand Total Inflows</span>
          <span class="reg-kpi-val font-mono font-bold">PKR ${formatPkr(data.totalCollections)}</span>
        </div>
      </div>

      <div class="register-sections-grid">
        <section class="reg-section">
          <h3 class="reg-section-title">1. Itemized Customer Collections (${data.transactionCount})</h3>
          <table class="reg-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Acc #</th>
                <th>Customer Name</th>
                <th>Bill Month</th>
                <th>Method</th>
                <th class="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${receiptsRows || '<tr><td colspan="6" class="text-center">No customer payments recorded on this date.</td></tr>'}
            </tbody>
          </table>
        </section>

        <section class="reg-section">
          <h3 class="reg-section-title">2. Operational Outflows &amp; Expenses (${data.expenseCount})</h3>
          <table class="reg-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Category</th>
                <th>Description / Notes</th>
                <th class="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${expensesRows || '<tr><td colspan="4" class="text-center">No expenses recorded on this date.</td></tr>'}
            </tbody>
          </table>
        </section>
      </div>

      ${data.hasCountedNotes ? `
      <section class="reg-section denom-audit-section">
        <h3 class="reg-section-title">3. Physical Cash Count &amp; Denominations Audit</h3>
        <div class="denom-grid">
          ${denomRows}
        </div>
        <div class="denom-summary-bar">
          <span>Physical Counted Total: <strong>PKR ${formatPkr(data.physicalCountTotal)}</strong></span>
          <span>Variance: <strong class="variance-${escapeHtml(data.varianceStatus)}">${escapeHtml(data.varianceLabel)}</strong></span>
        </div>
      </section>
      ` : ''}

      <footer class="register-print-signatures">
        <div class="sig-box">
          <div class="sig-line"></div>
          <p>Cashier / Field Collector Signature</p>
        </div>
        <div class="sig-box">
          <div class="sig-line"></div>
          <p>Managing Accountant (Saad / Umair)</p>
        </div>
      </footer>
    </div>
  `;
}

/**
 * Sets up Daily Cash Register (Roshnamcha) Modal Controller.
 */
export function setupDailyRegisterModal({
  getState,
  storage = (typeof localStorage !== 'undefined' ? localStorage : null),
  onToast,
  clipboard = (typeof navigator !== 'undefined' ? navigator.clipboard : null),
  openWindow = (typeof window !== 'undefined' ? window.open : null)
} = {}) {
  if (typeof document === 'undefined') {
    return {
      open: () => {},
      close: () => {},
      setDate: () => {},
      refresh: () => {},
      getData: () => null
    };
  }

  const modal = document.getElementById('dailyCashRegisterModal');
  if (!modal) {
    return {
      open: () => {},
      close: () => {},
      setDate: () => {},
      refresh: () => {},
      getData: () => null
    };
  }

  const closeBtn = document.getElementById('closeDailyRegisterModalBtn');
  const dateInput = document.getElementById('registerDateInput');
  const openingCashInput = document.getElementById('registerOpeningCash');
  const netCashVal = document.getElementById('registerNetCashVal');
  const digitalTotalVal = document.getElementById('registerDigitalTotalVal');
  const totalInflowsVal = document.getElementById('registerTotalInflowsVal');
  const totalExpensesVal = document.getElementById('registerTotalExpensesVal');
  const physicalCountVal = document.getElementById('registerPhysicalCountVal');
  const varianceBadge = document.getElementById('registerVarianceBadge');
  const receiptsTableBody = document.getElementById('registerReceiptsTableBody');
  const expensesTableBody = document.getElementById('registerExpensesTableBody');
  const receiptsCountBadge = document.getElementById('registerReceiptsCountBadge');
  const expensesCountBadge = document.getElementById('registerExpensesCountBadge');

  // Denomination note count inputs
  const denomInputs = {
    5000: document.getElementById('noteCount5000'),
    1000: document.getElementById('noteCount1000'),
    500: document.getElementById('noteCount500'),
    100: document.getElementById('noteCount100'),
    50: document.getElementById('noteCount50'),
    20: document.getElementById('noteCount20'),
    10: document.getElementById('noteCount10')
  };

  // Action buttons
  const printBtn = document.getElementById('printDailyRegisterBtn');
  const whatsappBtn = document.getElementById('sendWhatsAppRegisterBtn');
  const csvBtn = document.getElementById('exportDailyRegisterCsvBtn');
  const copyBtn = document.getElementById('copyRegisterTextBtn');
  const triggerBtn = document.getElementById('quickActionDailyClosingSlip');

  let currentDate = new Date().toISOString().slice(0, 10);
  let currentRegisterData = null;

  function getStoredOpeningCash(date) {
    if (!storage) return 0;
    try {
      const val = storage.getItem(`shahdara_daily_register_opening_${date}`);
      return val !== null && !isNaN(Number(val)) ? Number(val) : 0;
    } catch {
      return 0;
    }
  }

  function saveStoredOpeningCash(date, val) {
    if (!storage) return;
    try {
      storage.setItem(`shahdara_daily_register_opening_${date}`, String(val));
    } catch {
      // Ignore quota
    }
  }

  function getStoredDenominations(date) {
    if (!storage) return {};
    try {
      const raw = storage.getItem(`shahdara_daily_register_notes_${date}`);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function saveStoredDenominations(date, denoms) {
    if (!storage) return;
    try {
      storage.setItem(`shahdara_daily_register_notes_${date}`, JSON.stringify(denoms));
    } catch {
      // Ignore quota
    }
  }

  function renderRegister() {
    const state = typeof getState === 'function' ? getState() : {};
    const openingCash = openingCashInput ? Number(openingCashInput.value) || 0 : 0;

    const denominations = {};
    for (const [val, input] of Object.entries(denomInputs)) {
      if (input) {
        denominations[val] = Number(input.value) || 0;
      }
    }

    currentRegisterData = buildDailyRegisterData(state, currentDate, {
      openingCash,
      denominations
    });

    const formatPkr = (n) => Number(n || 0).toLocaleString();

    if (netCashVal) netCashVal.textContent = `PKR ${formatPkr(currentRegisterData.netPhysicalCash)}`;
    if (digitalTotalVal) digitalTotalVal.textContent = `PKR ${formatPkr(currentRegisterData.digitalCollections)}`;
    if (totalInflowsVal) totalInflowsVal.textContent = `PKR ${formatPkr(currentRegisterData.totalCollections)}`;
    if (totalExpensesVal) totalExpensesVal.textContent = `PKR ${formatPkr(currentRegisterData.totalExpenses)}`;
    if (physicalCountVal) physicalCountVal.textContent = `PKR ${formatPkr(currentRegisterData.physicalCountTotal)}`;

    if (varianceBadge) {
      varianceBadge.textContent = currentRegisterData.varianceLabel;
      varianceBadge.className = `register-variance-badge status-${currentRegisterData.varianceStatus}`;
    }

    if (receiptsCountBadge) {
      receiptsCountBadge.textContent = `${currentRegisterData.transactionCount} items`;
    }
    if (expensesCountBadge) {
      expensesCountBadge.textContent = `${currentRegisterData.expenseCount} entries`;
    }

    // Render receipts table
    if (receiptsTableBody) {
      if (currentRegisterData.payments.length === 0) {
        receiptsTableBody.innerHTML = '<tr><td colspan="5" class="text-center empty-muted">No collections recorded for this date.</td></tr>';
      } else {
        receiptsTableBody.innerHTML = currentRegisterData.payments.map((p, idx) => `
          <tr>
            <td>${idx + 1}</td>
            <td>#${escapeHtml(p.customerNumber)} <strong>${escapeHtml(p.customerName)}</strong></td>
            <td>${escapeHtml(p.billMonth)}</td>
            <td><span class="pay-method-badge ${p.isCash ? 'badge-cash' : 'badge-digital'}">${escapeHtml(p.method)}</span></td>
            <td class="text-right font-mono font-bold">PKR ${formatPkr(p.amount)}</td>
          </tr>
        `).join('');
      }
    }

    // Render expenses table
    if (expensesTableBody) {
      if (currentRegisterData.expenses.length === 0) {
        expensesTableBody.innerHTML = '<tr><td colspan="4" class="text-center empty-muted">No operational expenses recorded for this date.</td></tr>';
      } else {
        expensesTableBody.innerHTML = currentRegisterData.expenses.map((e, idx) => `
          <tr>
            <td>${idx + 1}</td>
            <td><strong>${escapeHtml(e.category)}</strong></td>
            <td>${escapeHtml(e.notes || '—')}</td>
            <td class="text-right font-mono font-bold highlight-red">PKR ${formatPkr(e.amount)}</td>
          </tr>
        `).join('');
      }
    }
  }

  function setDate(dateStr) {
    if (!dateStr) return;
    currentDate = String(dateStr).slice(0, 10);
    if (dateInput) dateInput.value = currentDate;

    // Restore saved opening cash & denominations for this date
    const savedOpening = getStoredOpeningCash(currentDate);
    if (openingCashInput) openingCashInput.value = String(savedOpening);

    const savedNotes = getStoredDenominations(currentDate);
    for (const [val, input] of Object.entries(denomInputs)) {
      if (input) {
        input.value = savedNotes[val] ? String(savedNotes[val]) : '0';
      }
    }

    renderRegister();
  }

  function open(dateStr) {
    const target = dateStr || currentDate || new Date().toISOString().slice(0, 10);
    setDate(target);

    if (typeof modal.showModal === 'function') {
      try { modal.showModal(); } catch { modal.setAttribute('open', ''); }
    } else {
      modal.setAttribute('open', '');
    }
  }

  function close() {
    if (typeof modal.close === 'function') {
      try { modal.close(); } catch { modal.removeAttribute('open'); }
    } else {
      modal.removeAttribute('open');
    }
  }

  // Event Listeners
  if (closeBtn && !closeBtn.dataset?.wiredReg) {
    if (closeBtn.dataset) closeBtn.dataset.wiredReg = 'true';
    closeBtn.addEventListener('click', close);
  }

  if (dateInput && !dateInput.dataset?.wiredReg) {
    if (dateInput.dataset) dateInput.dataset.wiredReg = 'true';
    dateInput.addEventListener('change', () => {
      setDate(dateInput.value);
    });
  }

  if (openingCashInput && !openingCashInput.dataset?.wiredReg) {
    if (openingCashInput.dataset) openingCashInput.dataset.wiredReg = 'true';
    openingCashInput.addEventListener('input', () => {
      const val = Number(openingCashInput.value) || 0;
      saveStoredOpeningCash(currentDate, val);
      renderRegister();
    });
  }

  // Denominations inputs
  for (const [val, input] of Object.entries(denomInputs)) {
    if (input && !input.dataset?.wiredReg) {
      if (input.dataset) input.dataset.wiredReg = 'true';
      input.addEventListener('input', () => {
        const denoms = {};
        for (const [k, el] of Object.entries(denomInputs)) {
          if (el) denoms[k] = Number(el.value) || 0;
        }
        saveStoredDenominations(currentDate, denoms);
        renderRegister();
      });
    }
  }

  // Quick Action / Trigger button
  if (triggerBtn && !triggerBtn.dataset?.wiredDailyModal) {
    if (triggerBtn.dataset) triggerBtn.dataset.wiredDailyModal = 'true';
    triggerBtn.addEventListener('click', () => {
      open();
    });
  }

  const triggerTile = document.getElementById('quickActionDailyRegisterTile');
  if (triggerTile && !triggerTile.dataset?.wiredDailyModal) {
    if (triggerTile.dataset) triggerTile.dataset.wiredDailyModal = 'true';
    triggerTile.addEventListener('click', () => {
      open();
    });
  }

  // Export CSV
  if (csvBtn && !csvBtn.dataset?.wiredReg) {
    if (csvBtn.dataset) csvBtn.dataset.wiredReg = 'true';
    csvBtn.addEventListener('click', () => {
      if (!currentRegisterData) return;
      const csv = generateDailyRegisterCsv(currentRegisterData);
      downloadCsvFile(`shahdara_daily_register_${currentDate}.csv`, csv);
      if (typeof onToast === 'function') onToast('Daily Register CSV downloaded.');
    });
  }

  // Copy text
  if (copyBtn && !copyBtn.dataset?.wiredReg) {
    if (copyBtn.dataset) copyBtn.dataset.wiredReg = 'true';
    copyBtn.addEventListener('click', async () => {
      if (!currentRegisterData) return;
      const text = formatDailyRegisterWhatsAppText(currentRegisterData);
      let copied = false;
      if (clipboard && typeof clipboard.writeText === 'function') {
        try {
          await clipboard.writeText(text);
          copied = true;
        } catch {
          copied = false;
        }
      }
      if (typeof onToast === 'function') {
        onToast(copied ? 'Daily Register briefing copied to clipboard!' : 'Daily Register briefing ready.');
      }
    });
  }

  // Send WhatsApp
  if (whatsappBtn && !whatsappBtn.dataset?.wiredReg) {
    if (whatsappBtn.dataset) whatsappBtn.dataset.wiredReg = 'true';
    whatsappBtn.addEventListener('click', () => {
      if (!currentRegisterData) return;
      const text = formatDailyRegisterWhatsAppText(currentRegisterData);
      const url = formatWhatsAppUrl('', text);
      if (typeof window !== 'undefined' && typeof window.open === 'function') {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    });
  }

  // Print
  if (printBtn && !printBtn.dataset?.wiredReg) {
    if (printBtn.dataset) printBtn.dataset.wiredReg = 'true';
    printBtn.addEventListener('click', () => {
      if (!currentRegisterData) return;
      const printHtml = generateDailyRegisterPrintHtml(currentRegisterData);
      const win = openWindow ? openWindow('', '_blank') : null;
      if (win && win.document) {
        win.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>Daily Register - ${currentRegisterData.date}</title>
            <style>
              body { font-family: system-ui, sans-serif; margin: 20px; color: #182e2a; }
              .register-print-document { max-width: 820px; margin: 0 auto; }
              .register-print-header { display: flex; justify-content: space-between; border-bottom: 2px solid #0e5b4d; padding-bottom: 12px; margin-bottom: 16px; }
              .register-summary-ribbon { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin-bottom: 20px; background: #f8faf9; padding: 12px; border: 1px solid #ddd; border-radius: 8px; }
              .reg-kpi-card { display: flex; flex-direction: column; }
              .reg-kpi-lbl { font-size: 11px; color: #60756c; }
              .reg-kpi-val { font-size: 14px; font-weight: 700; }
              .reg-section-title { font-size: 14px; margin: 16px 0 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
              .reg-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 16px; }
              .reg-table th, .reg-table td { border: 1px solid #e0e0e0; padding: 6px 8px; text-align: left; }
              .text-right { text-align: right; }
              .font-mono { font-family: monospace; }
              .highlight-green { color: #0e5b4d; }
              .highlight-red { color: #b91c1c; }
              .denom-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; font-size: 12px; margin-bottom: 12px; }
              .denom-row-item { display: flex; justify-content: space-between; padding: 4px 8px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 4px; }
              .register-print-signatures { display: flex; justify-content: space-between; margin-top: 40px; }
              .sig-box { width: 220px; text-align: center; }
              .sig-line { border-bottom: 1px solid #000; margin-bottom: 6px; height: 30px; }
              @media print { button { display: none !important; } }
            </style>
          </head>
          <body>
            ${printHtml}
            <script>window.onload = function() { window.print(); };</script>
          </body>
          </html>
        `);
        win.document.close();
      } else if (typeof window !== 'undefined' && typeof window.print === 'function') {
        window.print();
      }
    });
  }

  // Keyboard navigation
  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  });

  return {
    open,
    close,
    setDate,
    refresh: renderRegister,
    getData: () => currentRegisterData
  };
}

/* ==========================================================================
   CUSTOMER ACCOUNT ADJUSTMENT & OUTAGE VOUCHER ENGINE (Tarmeem-e-Khata واؤچر)
   ========================================================================== */

export const ADJUSTMENT_VOUCHERS_KEY = 'shahdara_customer_adjustments';

export const ADJUSTMENT_CATEGORIES = Object.freeze({
  downtime_credit: {
    id: 'downtime_credit',
    label: 'Fiber Cut / Outage Downtime Credit',
    labelUrdu: 'انٹرنیٹ خرابی کٹوتی',
    defaultReason: 'Broadband outage downtime compensation'
  },
  billing_dispute: {
    id: 'billing_dispute',
    label: 'Billing Dispute / Overcharge Settlement',
    labelUrdu: 'بل تنازعہ حل',
    defaultReason: 'Resolution of disputed billing charge'
  },
  promotional_discount: {
    id: 'promotional_discount',
    label: 'Promotional Discount / Retention Waiver',
    labelUrdu: 'خصوصی رعایت',
    defaultReason: 'Customer loyalty retention discount'
  },
  ont_fee_waiver: {
    id: 'ont_fee_waiver',
    label: 'ONT Router Fee / Deposit Waiver',
    labelUrdu: 'راؤٹر فیس چھوٹ',
    defaultReason: 'ONT installation/device concession'
  },
  manager_waiver: {
    id: 'manager_waiver',
    label: 'Management Special Concession',
    labelUrdu: 'منیجر رعایت',
    defaultReason: 'Special administrative concession'
  },
  custom: {
    id: 'custom',
    label: 'Other Account Ledger Adjustment',
    labelUrdu: 'دیگر ترمیم',
    defaultReason: 'General ledger adjustment'
  }
});

/**
 * Prorates outage credit based on monthly recurring rate, downtime days, and downtime hours.
 * @param {number} monthlyRate - Customer's monthly package subscription rate in PKR
 * @param {Object} [downtime]
 * @param {number} [downtime.days=0] - Number of full days without service
 * @param {number} [downtime.hours=0] - Additional hours without service
 * @param {number} [downtime.daysInMonth=30] - Base days in month (default 30)
 * @returns {number} Prorated credit amount in PKR rounded to nearest whole rupee
 */
export function calculateOutageCredit(monthlyRate, { days = 0, hours = 0, daysInMonth = 30 } = {}) {
  const rate = Math.max(0, Number(monthlyRate) || 0);
  const totalDays = Math.max(1, Number(daysInMonth) || 30);
  const outageDays = Math.max(0, Number(days) || 0);
  const outageHours = Math.max(0, Math.min(23, Number(hours) || 0));

  if (rate === 0 || (outageDays === 0 && outageHours === 0)) {
    return 0;
  }

  const dailyRate = rate / totalDays;
  const hourlyRate = dailyRate / 24;
  const rawCredit = (outageDays * dailyRate) + (outageHours * hourlyRate);

  return Math.min(rate, Math.round(rawCredit));
}

/**
 * Validates adjustment voucher input parameters.
 * @param {Object} fields
 * @param {string} fields.customerId
 * @param {number|string} fields.amount
 * @param {string} fields.category
 * @param {string} fields.reason
 * @param {string} fields.authorizedBy
 * @returns {{ valid: boolean, errors: Object }}
 */
export function validateAdjustmentVoucher({ customerId, amount, category, reason, authorizedBy }) {
  const errors = {};

  if (!customerId || String(customerId).trim() === '') {
    errors.customerId = 'Customer is required.';
  }

  const numAmount = Number(amount);
  if (!Number.isFinite(numAmount) || numAmount <= 0) {
    errors.amount = 'Credit voucher amount must be a positive number greater than 0.';
  } else if (numAmount > 100000) {
    errors.amount = 'Credit voucher amount cannot exceed PKR 100,000.';
  }

  const cleanCategory = String(category || '').trim();
  if (!cleanCategory) {
    errors.category = 'Adjustment category is required.';
  }

  const cleanReason = String(reason || '').trim();
  if (!cleanReason || cleanReason.length < 5) {
    errors.reason = 'Reason for adjustment must be at least 5 characters.';
  }

  const cleanAuth = String(authorizedBy || '').trim();
  if (!cleanAuth || cleanAuth.length < 2) {
    errors.authorizedBy = 'Authorizer name/title must be at least 2 characters.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Assembles an immutable Adjustment Voucher record.
 * @param {Object} params
 * @returns {Object} Complete voucher object
 */
export function buildAdjustmentVoucherData({
  customer,
  category = 'downtime_credit',
  amount = 0,
  reason = '',
  authorizedBy = 'Manager',
  date = null,
  outageDetails = null,
  existingVouchersCount = 0
} = {}) {
  const numAmount = Math.max(0, Number(amount) || 0);
  const now = new Date();
  const dateStr = date ? String(date).slice(0, 10) : now.toISOString().slice(0, 10);
  const yearMonth = dateStr.slice(0, 7).replace('-', '');
  const seq = String(Number(existingVouchersCount || 0) + 1).padStart(4, '0');
  const voucherNumber = `ADJ-${yearMonth}-${seq}`;

  const categoryMeta = ADJUSTMENT_CATEGORIES[category] || {
    id: category,
    label: category,
    labelUrdu: 'ترمیم کھاتہ',
    defaultReason: 'Account balance adjustment'
  };

  const bills = Array.isArray(customer?.bills) ? customer.bills : [];
  let currentBalance = 0;
  bills.forEach(b => {
    const due = Number(b.dueAmount || 0);
    const paid = (b.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);
    currentBalance += Math.max(0, due - paid);
  });

  const projectedBalance = Math.max(0, currentBalance - numAmount);

  return {
    id: `adj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    voucherNumber,
    customerId: customer?.id || '',
    customerNumber: customer?.customerNumber || '',
    customerName: customer?.name || 'Unnamed Subscriber',
    customerPhone: customer?.phone || '',
    customerArea: customer?.area || customer?.mohalla || '',
    category: categoryMeta.id,
    categoryLabel: categoryMeta.label,
    categoryLabelUrdu: categoryMeta.labelUrdu,
    amount: numAmount,
    previousBalance: currentBalance,
    projectedBalance,
    reason: String(reason || categoryMeta.defaultReason).trim(),
    authorizedBy: String(authorizedBy || 'Manager').trim(),
    date: dateStr,
    createdAt: now.toISOString(),
    outageDetails: outageDetails ? {
      days: Number(outageDetails.days) || 0,
      hours: Number(outageDetails.hours) || 0,
      monthlyRate: Number(outageDetails.monthlyRate) || 0,
      calculatedCredit: Number(outageDetails.calculatedCredit) || 0
    } : null
  };
}

/**
 * Formats a professional bilingual WhatsApp notification for the customer.
 * @param {Object} voucher
 * @returns {string}
 */
export function formatAdjustmentVoucherWhatsApp(voucher) {
  if (!voucher) return '';
  const formatPkr = (n) => Number(n || 0).toLocaleString();

  const lines = [
    `🧾 *SHAHDARA BROADBAND - CREDIT ADJUSTMENT VOUCHER* 🧾`,
    `واؤچر برائے رعایت / کھاتہ ترمیم`,
    `----------------------------------------`,
    `🔢 *Voucher No:* \`${voucher.voucherNumber}\``,
    `👤 *Subscriber:* ${voucher.customerName} (#${voucher.customerNumber})`,
    `📅 *Date:* ${voucher.date}`,
    `📌 *Category:* ${voucher.categoryLabel} (${voucher.categoryLabelUrdu})`,
    `----------------------------------------`,
    `💰 *CREDIT ADJUSTED (رعایت):*`,
    `👉 *PKR ${formatPkr(voucher.amount)}* (مبارک ہو! آپ کے کھاتے میں کریڈٹ کر دیا گیا ہے)`,
    `----------------------------------------`,
    `📝 *Reason / Notes:* ${voucher.reason}`
  ];

  if (voucher.outageDetails && (voucher.outageDetails.days > 0 || voucher.outageDetails.hours > 0)) {
    lines.push(`⚡ *Downtime Compensated:* ${voucher.outageDetails.days} days, ${voucher.outageDetails.hours} hours outage`);
  }

  lines.push(`📊 *Adjusted Balance:* PKR ${formatPkr(voucher.projectedBalance)}`);
  lines.push(`✍️ *Authorized By:* ${voucher.authorizedBy}`);
  lines.push(`----------------------------------------`);
  lines.push(`شکریہ، شاہدرہ انٹرنیٹ سروسز ہیلپ لائن: 0300-1234567`);

  return lines.join('\n');
}

/**
 * Generates RFC-4180 CSV export of adjustment vouchers.
 * @param {Array<Object>} vouchers
 * @returns {string}
 */
export function generateAdjustmentLedgerCsv(vouchers = []) {
  const headers = [
    'Voucher_No',
    'Date',
    'Customer_No',
    'Customer_Name',
    'Category',
    'Credit_PKR',
    'Previous_Balance_PKR',
    'Projected_Balance_PKR',
    'Reason',
    'Authorized_By',
    'Created_At'
  ];

  const rows = (Array.isArray(vouchers) ? vouchers : []).map(v => [
    v.voucherNumber || '',
    v.date || '',
    String(v.customerNumber || ''),
    v.customerName || '',
    v.categoryLabel || v.category || '',
    String(v.amount ?? 0),
    String(v.previousBalance ?? 0),
    String(v.projectedBalance ?? 0),
    v.reason || '',
    v.authorizedBy || '',
    v.createdAt || ''
  ]);

  return generateCsvContent(headers, rows);
}

/**
 * Generates printable voucher slip (80mm thermal or standard A4).
 * @param {Object} voucher
 * @param {Object} [options]
 * @param {string} [options.format='slip'] - 'slip' (thermal 80mm) or 'sheet' (formal A4)
 * @returns {string} HTML string
 */
export function generateAdjustmentVoucherHtml(voucher, { format = 'slip' } = {}) {
  if (!voucher) return '';
  const formatPkr = (n) => Number(n || 0).toLocaleString();

  const isSlip = format === 'slip';

  return `
    <div class="adj-voucher-document ${isSlip ? 'adj-thermal-slip' : 'adj-formal-sheet'}">
      <header class="adj-slip-header">
        <div class="adj-brand">
          <h3>SHAHDARA ISP NETWORKS</h3>
          <p class="adj-subtitle">Official Credit Note &amp; Adjustment Slip</p>
          <p class="adj-urdu-title">رسید کھاتہ ترمیم و کٹوتی واؤچر</p>
        </div>
        <div class="adj-voucher-code">
          <span class="v-num">${escapeHtml(voucher.voucherNumber)}</span>
          <span class="v-date">${escapeHtml(voucher.date)}</span>
        </div>
      </header>

      <div class="adj-divider"></div>

      <section class="adj-slip-customer">
        <div class="adj-row"><span>Subscriber:</span><strong>#${escapeHtml(voucher.customerNumber)} ${escapeHtml(voucher.customerName)}</strong></div>
        ${voucher.customerPhone ? `<div class="adj-row"><span>Phone:</span><span>${escapeHtml(voucher.customerPhone)}</span></div>` : ''}
        ${voucher.customerArea ? `<div class="adj-row"><span>Area:</span><span>${escapeHtml(voucher.customerArea)}</span></div>` : ''}
      </section>

      <div class="adj-divider"></div>

      <section class="adj-slip-details">
        <div class="adj-row"><span>Adjustment Type:</span><span>${escapeHtml(voucher.categoryLabel)}</span></div>
        <div class="adj-row adj-urdu-row"><span>قسم ترمیم:</span><span>${escapeHtml(voucher.categoryLabelUrdu)}</span></div>
        ${voucher.outageDetails && (voucher.outageDetails.days > 0 || voucher.outageDetails.hours > 0) ? `
          <div class="adj-row"><span>Outage Compensated:</span><span>${voucher.outageDetails.days}d ${voucher.outageDetails.hours}h</span></div>
        ` : ''}
        <div class="adj-row adj-amount-highlight">
          <span>CREDIT AMOUNT:</span>
          <strong class="font-mono">PKR ${formatPkr(voucher.amount)}</strong>
        </div>
        <div class="adj-row"><span>Reason:</span><span class="adj-reason-text">${escapeHtml(voucher.reason)}</span></div>
      </section>

      <div class="adj-divider"></div>

      <section class="adj-slip-balance">
        <div class="adj-row"><span>Previous Dues:</span><span>PKR ${formatPkr(voucher.previousBalance)}</span></div>
        <div class="adj-row adj-new-balance"><span>Updated Balance:</span><strong>PKR ${formatPkr(voucher.projectedBalance)}</strong></div>
      </section>

      <footer class="adj-slip-footer">
        <div class="adj-sig-block">
          <div class="adj-sig-line"></div>
          <p>Authorized: ${escapeHtml(voucher.authorizedBy)}</p>
        </div>
        <p class="adj-slip-notes">Computer generated credit note. Valid without physical stamp for Shahdara ISP accounting.</p>
      </footer>
    </div>
  `;
}

/**
 * Retrieves saved adjustment vouchers from localStorage.
 * @param {Storage} [storage]
 * @param {string} [customerId=null] - Optional filter by customerId
 * @returns {Array<Object>}
 */
export function getSavedAdjustmentVouchers(storage = (typeof localStorage !== 'undefined' ? localStorage : null), customerId = null) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(ADJUSTMENT_VOUCHERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    if (!customerId) return parsed;
    return parsed.filter(v => v.customerId === customerId);
  } catch {
    return [];
  }
}

/**
 * Saves a new adjustment voucher to localStorage.
 * @param {Storage} [storage]
 * @param {Object} voucher
 * @returns {Array<Object>} Updated list of vouchers
 */
export function saveAdjustmentVoucher(storage = (typeof localStorage !== 'undefined' ? localStorage : null), voucher) {
  if (!storage || !voucher) return [];
  try {
    const existing = getSavedAdjustmentVouchers(storage);
    const updated = [voucher, ...existing];
    storage.setItem(ADJUSTMENT_VOUCHERS_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

/**
 * Helper to determine customer's monthly billing rate from profile or latest bill.
 * @param {Object} customer
 * @returns {number}
 */
export function getCustomerMonthlyRate(customer) {
  if (!customer) return 1500;
  if (customer.monthlySellingAmount && Number(customer.monthlySellingAmount) > 0) {
    return Number(customer.monthlySellingAmount);
  }
  const bills = Array.isArray(customer.bills) ? customer.bills : [];
  const latestBill = bills.find(b => Number(b.dueAmount) > 0);
  if (latestBill) return Number(latestBill.dueAmount);
  return 1500;
}

/**
 * Sets up and binds the Customer Adjustment & Outage Voucher Modal Controller.
 * @param {Object} options
 * @returns {Object} Controller with { open, close, refresh, getVouchers }
 */
export function setupAdjustmentVoucherModal({
  modalId = 'customerAdjustmentModal',
  storage = (typeof localStorage !== 'undefined' ? localStorage : null),
  onToast = (msg) => {},
  onVoucherIssued = (voucher) => {},
  openWindow = (typeof window !== 'undefined' ? window.open : null)
} = {}) {
  if (typeof document === 'undefined') {
    return {
      open: () => {},
      close: () => {},
      refresh: () => {},
      getVouchers: () => []
    };
  }

  const modal = document.getElementById(modalId);
  if (!modal) {
    return {
      open: () => {},
      close: () => {},
      refresh: () => {},
      getVouchers: () => []
    };
  }

  const closeBtn = document.getElementById('closeAdjustmentModalBtn');
  const closeSecondaryBtn = document.getElementById('closeAdjustmentModalSecondaryBtn');
  const openTriggerBtn = document.getElementById('openAdjustmentModalBtn');

  // Customer strip elements
  const custNameEl = document.getElementById('adjCustomerName');
  const custMetaEl = document.getElementById('adjCustomerMeta');
  const currBalEl = document.getElementById('adjCurrentBalance');
  const projBalEl = document.getElementById('adjProjectedBalance');

  // Outage calculator elements
  const toggleCalcBtn = document.getElementById('adjToggleCalculatorBtn');
  const calcBody = document.getElementById('adjCalculatorBody');
  const toggleCalcIcon = document.getElementById('adjToggleCalcIcon');
  const outageDaysInput = document.getElementById('adjOutageDays');
  const outageHoursInput = document.getElementById('adjOutageHours');
  const monthlyRateDisplay = document.getElementById('adjMonthlyRateDisplay');
  const calcCreditPkr = document.getElementById('adjCalcCreditPkr');
  const applyCalcBtn = document.getElementById('adjApplyCalcBtn');

  // Form inputs
  const form = document.getElementById('customerAdjustmentForm');
  const categorySelect = document.getElementById('adjCategorySelect');
  const amountInput = document.getElementById('adjAmountInput');
  const dateInput = document.getElementById('adjDateInput');
  const authorizedByInput = document.getElementById('adjAuthorizedByInput');
  const reasonInput = document.getElementById('adjReasonInput');

  // Errors
  const amountError = document.getElementById('adjAmountError');
  const authError = document.getElementById('adjAuthError');
  const reasonError = document.getElementById('adjReasonError');

  // Preview elements
  const previewVoucherNum = document.getElementById('adjPreviewVoucherNum');
  const previewAmount = document.getElementById('adjPreviewAmount');
  const previewCategory = document.getElementById('adjPreviewCategory');
  const previewNewBal = document.getElementById('adjPreviewNewBal');

  // Actions
  const submitBtn = document.getElementById('submitAdjustmentVoucherBtn');
  const printBtn = document.getElementById('printAdjustmentSlipBtn');
  const whatsappBtn = document.getElementById('sendAdjustmentWhatsAppBtn');

  // History table
  const historyTableBody = document.getElementById('adjHistoryTableBody');
  const historyCountBadge = document.getElementById('adjHistoryCountBadge');

  let currentCustomer = null;
  let activeVoucher = null;
  let outageCreditCalculated = 0;

  function calculateCustomerBalance(customer) {
    if (!customer) return 0;
    const bills = Array.isArray(customer.bills) ? customer.bills : [];
    let balance = 0;
    bills.forEach(b => {
      const due = Number(b.dueAmount || 0);
      const paid = (b.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);
      balance += Math.max(0, due - paid);
    });
    return balance;
  }

  function getCustomerMonthlyRate(customer) {
    if (!customer) return 1500;
    if (customer.monthlySellingAmount && Number(customer.monthlySellingAmount) > 0) {
      return Number(customer.monthlySellingAmount);
    }
    const bills = Array.isArray(customer.bills) ? customer.bills : [];
    const latestBill = bills.find(b => Number(b.dueAmount) > 0);
    if (latestBill) return Number(latestBill.dueAmount);
    return 1500;
  }

  function updateProrationCalculation() {
    const rate = currentCustomer ? getCustomerMonthlyRate(currentCustomer) : 1500;
    const days = outageDaysInput ? Number(outageDaysInput.value) || 0 : 0;
    const hours = outageHoursInput ? Number(outageHoursInput.value) || 0 : 0;

    outageCreditCalculated = calculateOutageCredit(rate, { days, hours, daysInMonth: 30 });
    if (calcCreditPkr) {
      calcCreditPkr.textContent = `PKR ${outageCreditCalculated.toLocaleString()}`;
    }
  }

  function updateLivePreview() {
    const curBal = calculateCustomerBalance(currentCustomer);
    const amount = amountInput ? Math.max(0, Number(amountInput.value) || 0) : 0;
    const projected = Math.max(0, curBal - amount);

    if (currBalEl) currBalEl.textContent = `PKR ${curBal.toLocaleString()}`;
    if (projBalEl) projBalEl.textContent = `PKR ${projected.toLocaleString()}`;

    if (previewAmount) previewAmount.textContent = `PKR ${amount.toLocaleString()}`;
    if (previewNewBal) previewNewBal.textContent = `PKR ${projected.toLocaleString()}`;

    const catKey = categorySelect?.value || 'downtime_credit';
    const catMeta = ADJUSTMENT_CATEGORIES[catKey];
    if (previewCategory) {
      previewCategory.textContent = catMeta ? catMeta.label : catKey;
    }

    const allVouchers = getSavedAdjustmentVouchers(storage);
    const yearMonth = (dateInput?.value || new Date().toISOString().slice(0, 10)).slice(0, 7).replace('-', '');
    const seq = String(allVouchers.length + 1).padStart(4, '0');
    if (previewVoucherNum) {
      previewVoucherNum.textContent = `ADJ-${yearMonth}-${seq}`;
    }
  }

  function renderHistory() {
    if (!historyTableBody) return;
    if (!currentCustomer) {
      historyTableBody.innerHTML = '<tr><td colspan="6" class="text-center empty-muted">Select a customer to view voucher history.</td></tr>';
      if (historyCountBadge) historyCountBadge.textContent = '0 vouchers';
      return;
    }

    const vouchers = getSavedAdjustmentVouchers(storage, currentCustomer.id);
    if (historyCountBadge) {
      historyCountBadge.textContent = `${vouchers.length} voucher${vouchers.length === 1 ? '' : 's'}`;
    }

    if (vouchers.length === 0) {
      historyTableBody.innerHTML = '<tr><td colspan="6" class="text-center empty-muted">No adjustment vouchers issued for this customer yet.</td></tr>';
      return;
    }

    historyTableBody.innerHTML = vouchers.map(v => `
      <tr>
        <td class="font-mono font-bold">${escapeHtml(v.voucherNumber)}</td>
        <td>${escapeHtml(v.date)}</td>
        <td><span class="adj-cat-tag">${escapeHtml(v.categoryLabel || v.category)}</span></td>
        <td class="adj-reason-cell">${escapeHtml(v.reason)}</td>
        <td class="text-right font-mono font-bold highlight-green">PKR ${Number(v.amount || 0).toLocaleString()}</td>
        <td>${escapeHtml(v.authorizedBy)}</td>
      </tr>
    `).join('');
  }

  function open(customer) {
    currentCustomer = customer || null;
    activeVoucher = null;

    if (currentCustomer) {
      if (custNameEl) custNameEl.textContent = `#${currentCustomer.customerNumber || ''} ${currentCustomer.name || 'Unnamed'}`;
      if (custMetaEl) custMetaEl.textContent = `${currentCustomer.phone || 'No phone'} · ${currentCustomer.area || currentCustomer.mohalla || 'Shahdara'}`;
      const monthlyRate = getCustomerMonthlyRate(currentCustomer);
      if (monthlyRateDisplay) monthlyRateDisplay.value = monthlyRate;
    } else {
      if (custNameEl) custNameEl.textContent = 'No Subscriber Selected';
      if (custMetaEl) custMetaEl.textContent = '—';
    }

    // Default dates
    if (dateInput && !dateInput.value) {
      dateInput.value = new Date().toISOString().slice(0, 10);
    }
    if (outageDaysInput) outageDaysInput.value = '0';
    if (outageHoursInput) outageHoursInput.value = '0';

    updateProrationCalculation();
    updateLivePreview();
    renderHistory();

    // Reset error banners
    if (amountError) amountError.hidden = true;
    if (authError) authError.hidden = true;
    if (reasonError) reasonError.hidden = true;

    if (typeof modal.showModal === 'function') {
      try { modal.showModal(); } catch { modal.setAttribute('open', ''); }
    } else {
      modal.setAttribute('open', '');
    }
  }

  function close() {
    if (typeof modal.close === 'function') {
      try { modal.close(); } catch { modal.removeAttribute('open'); }
    } else {
      modal.removeAttribute('open');
    }
  }

  // Toggle calculator
  if (toggleCalcBtn && !toggleCalcBtn.dataset?.wiredAdj) {
    if (toggleCalcBtn.dataset) toggleCalcBtn.dataset.wiredAdj = 'true';
    toggleCalcBtn.addEventListener('click', () => {
      const isHidden = calcBody ? calcBody.hidden : true;
      if (calcBody) calcBody.hidden = !isHidden;
      toggleCalcBtn.setAttribute('aria-expanded', String(!isHidden));
      if (toggleCalcIcon) {
        toggleCalcIcon.textContent = !isHidden ? '▲' : '▼';
      }
    });
  }

  if (outageDaysInput && !outageDaysInput.dataset?.wiredAdj) {
    if (outageDaysInput.dataset) outageDaysInput.dataset.wiredAdj = 'true';
    outageDaysInput.addEventListener('input', updateProrationCalculation);
  }

  if (outageHoursInput && !outageHoursInput.dataset?.wiredAdj) {
    if (outageHoursInput.dataset) outageHoursInput.dataset.wiredAdj = 'true';
    outageHoursInput.addEventListener('input', updateProrationCalculation);
  }

  if (applyCalcBtn && !applyCalcBtn.dataset?.wiredAdj) {
    if (applyCalcBtn.dataset) applyCalcBtn.dataset.wiredAdj = 'true';
    applyCalcBtn.addEventListener('click', () => {
      if (outageCreditCalculated > 0 && amountInput) {
        amountInput.value = String(outageCreditCalculated);
        if (categorySelect) categorySelect.value = 'downtime_credit';
        if (reasonInput && (!reasonInput.value || reasonInput.value.length < 5)) {
          const days = outageDaysInput?.value || 0;
          const hrs = outageHoursInput?.value || 0;
          reasonInput.value = `Outage compensation: ${days} day(s) and ${hrs} hour(s) network downtime credited.`;
        }
        updateLivePreview();
        onToast(`Applied PKR ${outageCreditCalculated.toLocaleString()} outage credit.`);
      } else {
        onToast('Calculate a credit amount greater than 0 first.');
      }
    });
  }

  if (amountInput && !amountInput.dataset?.wiredAdj) {
    if (amountInput.dataset) amountInput.dataset.wiredAdj = 'true';
    amountInput.addEventListener('input', () => {
      if (amountError) amountError.hidden = true;
      updateLivePreview();
    });
  }

  if (categorySelect && !categorySelect.dataset?.wiredAdj) {
    if (categorySelect.dataset) categorySelect.dataset.wiredAdj = 'true';
    categorySelect.addEventListener('change', () => {
      const catKey = categorySelect.value;
      const catMeta = ADJUSTMENT_CATEGORIES[catKey];
      if (reasonInput && (!reasonInput.value || reasonInput.value.trim().length === 0)) {
        if (catMeta) reasonInput.value = catMeta.defaultReason;
      }
      updateLivePreview();
    });
  }

  if (reasonInput && !reasonInput.dataset?.wiredAdj) {
    if (reasonInput.dataset) reasonInput.dataset.wiredAdj = 'true';
    reasonInput.addEventListener('input', () => {
      if (reasonError) reasonError.hidden = true;
    });
  }

  if (authorizedByInput && !authorizedByInput.dataset?.wiredAdj) {
    if (authorizedByInput.dataset) authorizedByInput.dataset.wiredAdj = 'true';
    authorizedByInput.addEventListener('input', () => {
      if (authError) authError.hidden = true;
    });
  }

  // Issue credit voucher
  if (submitBtn && !submitBtn.dataset?.wiredAdj) {
    if (submitBtn.dataset) submitBtn.dataset.wiredAdj = 'true';
    submitBtn.addEventListener('click', () => {
      if (!currentCustomer) {
        onToast('Please select a subscriber first.');
        return;
      }

      const amountVal = amountInput ? amountInput.value : '';
      const catVal = categorySelect ? categorySelect.value : 'downtime_credit';
      const reasonVal = reasonInput ? reasonInput.value : '';
      const authVal = authorizedByInput ? authorizedByInput.value : '';
      const dateVal = dateInput ? dateInput.value : new Date().toISOString().slice(0, 10);

      const validation = validateAdjustmentVoucher({
        customerId: currentCustomer.id,
        amount: amountVal,
        category: catVal,
        reason: reasonVal,
        authorizedBy: authVal
      });

      if (!validation.valid) {
        if (validation.errors.amount && amountError) {
          amountError.textContent = validation.errors.amount;
          amountError.hidden = false;
        }
        if (validation.errors.reason && reasonError) {
          reasonError.textContent = validation.errors.reason;
          reasonError.hidden = false;
        }
        if (validation.errors.authorizedBy && authError) {
          authError.textContent = validation.errors.authorizedBy;
          authError.hidden = false;
        }
        onToast('Please correct form validation errors.');
        return;
      }

      const allVouchers = getSavedAdjustmentVouchers(storage);
      const voucher = buildAdjustmentVoucherData({
        customer: currentCustomer,
        category: catVal,
        amount: Number(amountVal),
        reason: reasonVal,
        authorizedBy: authVal,
        date: dateVal,
        outageDetails: {
          days: outageDaysInput ? Number(outageDaysInput.value) || 0 : 0,
          hours: outageHoursInput ? Number(outageHoursInput.value) || 0 : 0,
          monthlyRate: getCustomerMonthlyRate(currentCustomer),
          calculatedCredit: outageCreditCalculated
        },
        existingVouchersCount: allVouchers.length
      });

      saveAdjustmentVoucher(storage, voucher);
      activeVoucher = voucher;

      renderHistory();
      updateLivePreview();

      if (typeof onVoucherIssued === 'function') {
        onVoucherIssued(voucher);
      }

      onToast(`Adjustment Voucher #${voucher.voucherNumber} issued successfully!`);
    });
  }

  // Print voucher slip
  if (printBtn && !printBtn.dataset?.wiredAdj) {
    if (printBtn.dataset) printBtn.dataset.wiredAdj = 'true';
    printBtn.addEventListener('click', () => {
      const voucherToPrint = activeVoucher || (currentCustomer ? getSavedAdjustmentVouchers(storage, currentCustomer.id)[0] : null);
      if (!voucherToPrint) {
        onToast('Issue a voucher first or select an existing voucher to print.');
        return;
      }

      const html = generateAdjustmentVoucherHtml(voucherToPrint, { format: 'slip' });
      const win = openWindow ? openWindow('', '_blank') : null;
      if (win && win.document) {
        win.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>Credit Voucher - ${voucherToPrint.voucherNumber}</title>
            <style>
              body { font-family: 'Courier New', Courier, monospace, system-ui; margin: 10px; color: #000; font-size: 13px; }
              .adj-voucher-document { max-width: 320px; margin: 0 auto; padding: 10px; }
              .adj-slip-header { text-align: center; }
              .adj-slip-header h3 { margin: 0; font-size: 16px; font-weight: 800; }
              .adj-subtitle { margin: 2px 0; font-size: 11px; }
              .adj-urdu-title { margin: 2px 0 6px; font-size: 12px; }
              .adj-voucher-code { display: flex; justify-content: space-between; font-weight: bold; font-size: 12px; margin-top: 6px; }
              .adj-divider { border-top: 1px dashed #000; margin: 8px 0; }
              .adj-row { display: flex; justify-content: space-between; margin: 3px 0; }
              .adj-urdu-row { direction: rtl; }
              .adj-amount-highlight { font-size: 14px; font-weight: bold; margin: 6px 0; }
              .adj-reason-text { font-size: 11px; max-width: 180px; text-align: right; }
              .adj-new-balance { font-weight: bold; }
              .adj-slip-footer { text-align: center; margin-top: 16px; font-size: 10px; }
              .adj-sig-block { margin-bottom: 8px; }
              .adj-sig-line { width: 140px; border-bottom: 1px solid #000; margin: 20px auto 4px; }
              @media print { body { margin: 0; } }
            </style>
          </head>
          <body>
            ${html}
            <script>window.onload = function() { window.print(); };</script>
          </body>
          </html>
        `);
        win.document.close();
      } else if (typeof window !== 'undefined' && typeof window.print === 'function') {
        window.print();
      }
    });
  }

  // Send WhatsApp notice
  if (whatsappBtn && !whatsappBtn.dataset?.wiredAdj) {
    if (whatsappBtn.dataset) whatsappBtn.dataset.wiredAdj = 'true';
    whatsappBtn.addEventListener('click', () => {
      const voucherToSend = activeVoucher || (currentCustomer ? getSavedAdjustmentVouchers(storage, currentCustomer.id)[0] : null);
      if (!voucherToSend) {
        onToast('Issue a voucher first to generate WhatsApp notice.');
        return;
      }

      const text = formatAdjustmentVoucherWhatsApp(voucherToSend);
      const phone = voucherToSend.customerPhone || currentCustomer?.phone || '';
      const url = formatWhatsAppUrl(phone, text);
      if (typeof window !== 'undefined' && typeof window.open === 'function') {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    });
  }

  // Close triggers
  if (closeBtn && !closeBtn.dataset?.wiredAdj) {
    if (closeBtn.dataset) closeBtn.dataset.wiredAdj = 'true';
    closeBtn.addEventListener('click', close);
  }
  if (closeSecondaryBtn && !closeSecondaryBtn.dataset?.wiredAdj) {
    if (closeSecondaryBtn.dataset) closeSecondaryBtn.dataset.wiredAdj = 'true';
    closeSecondaryBtn.addEventListener('click', close);
  }

  // Backdrop click to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      close();
    }
  });

  // Escape key to close
  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  });

  return {
    open,
    close,
    refresh: () => {
      updateLivePreview();
      renderHistory();
    },
    getVouchers: (cid = null) => getSavedAdjustmentVouchers(storage, cid)
  };
}

export const SERVICE_CONTRACTS_KEY = 'shahdara_service_agreements';

/**
 * Validates Pakistani Computerized National Identity Card (CNIC) format.
 * Expects 13 digits, optionally formatted as XXXXX-XXXXXXX-X.
 * @param {string} cnic
 * @returns {{ valid: boolean, formatted: string, raw: string, error?: string }}
 */
export function validatePakistanCnic(cnic) {
  if (!cnic || typeof cnic !== 'string') {
    return { valid: false, formatted: '', raw: '', error: 'CNIC is required.' };
  }
  const clean = cnic.replace(/[^0-9]/g, '');
  if (clean.length !== 13) {
    return {
      valid: false,
      formatted: cnic.trim(),
      raw: clean,
      error: `CNIC must contain exactly 13 digits (found ${clean.length}).`
    };
  }
  const formatted = `${clean.slice(0, 5)}-${clean.slice(5, 12)}-${clean.slice(12, 13)}`;
  return {
    valid: true,
    formatted,
    raw: clean
  };
}

/**
 * Validates Service Contract agreement form fields.
 * @param {Object} data
 * @returns {{ valid: boolean, errors: Object }}
 */
export function validateServiceContract(data = {}) {
  const errors = {};

  if (!data.customerId) {
    errors.customer = 'Please select a subscriber profile.';
  }

  if (data.cnic) {
    const cnicCheck = validatePakistanCnic(data.cnic);
    if (!cnicCheck.valid) {
      errors.cnic = cnicCheck.error;
    }
  }

  const monthlyRate = Number(data.monthlyRate);
  if (isNaN(monthlyRate) || monthlyRate < 0) {
    errors.monthlyRate = 'Monthly rate must be a valid positive amount.';
  }

  const installFee = Number(data.installationFee ?? 0);
  if (isNaN(installFee) || installFee < 0) {
    errors.installationFee = 'Installation fee must be 0 or a positive amount.';
  }

  const deposit = Number(data.securityDeposit ?? 0);
  if (isNaN(deposit) || deposit < 0) {
    errors.securityDeposit = 'Security deposit must be 0 or a positive amount.';
  }

  if (!data.packageSpeed || typeof data.packageSpeed !== 'string' || !data.packageSpeed.trim()) {
    errors.packageSpeed = 'Subscribed package speed is required.';
  }

  if (!data.technicianName || typeof data.technicianName !== 'string' || !data.technicianName.trim()) {
    errors.technicianName = 'Authorized technician / installer name is required.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Builds formal Service Agreement record with unique contract number.
 * @param {Object} params
 * @returns {Object}
 */
export function buildServiceContractData({
  customer,
  cnic = '',
  packageSpeed = '15 Mbps Turbo',
  monthlyRate = 1500,
  installationFee = 1000,
  securityDeposit = 1500,
  ontModel = 'Huawei HG8546M GPON',
  ontSerial = '',
  dropCableMeters = 75,
  opticalPowerDbm = -21.5,
  contractMonths = 12,
  startDate,
  technicianName = 'Shahdara Field Tech',
  notes = '',
  existingContractsCount = 0
} = {}) {
  const c = customer || {};
  const cnicVal = cnic ? validatePakistanCnic(cnic).formatted : '';
  const now = new Date();
  const start = (startDate && !isNaN(new Date(startDate))) ? new Date(startDate) : now;
  const startIso = start.toISOString().slice(0, 10);

  let expiryIso = 'Open Month-to-Month';
  if (contractMonths && contractMonths > 0) {
    const expiryDate = new Date(start);
    expiryDate.setMonth(expiryDate.getMonth() + Number(contractMonths));
    expiryIso = expiryDate.toISOString().slice(0, 10);
  }

  const yearMonth = startIso.slice(0, 7).replace('-', '');
  const seq = String(existingContractsCount + 1).padStart(4, '0');
  const agreementNumber = `AGR-${yearMonth}-${seq}`;

  const numMonthlyRate = Math.max(0, Number(monthlyRate) || 0);
  const numInstallFee = Math.max(0, Number(installationFee) || 0);
  const numDeposit = Math.max(0, Number(securityDeposit) || 0);
  const totalInitialPayment = numMonthlyRate + numInstallFee + numDeposit;

  return {
    agreementNumber,
    timestamp: now.toISOString(),
    startDate: startIso,
    expiryDate: expiryIso,
    contractMonths: Number(contractMonths) || 0,
    customer: {
      id: c.id || '',
      customerNumber: c.customerNumber || '',
      name: c.name || 'Subscriber',
      phone: c.phone || '',
      area: c.area || '',
      mohalla: c.mohalla || '',
      address: c.address || ''
    },
    cnic: cnicVal,
    packageSpeed: String(packageSpeed || 'Standard').trim(),
    monthlyRate: numMonthlyRate,
    installationFee: numInstallFee,
    securityDeposit: numDeposit,
    totalInitialPayment,
    equipment: {
      ontModel: String(ontModel || 'GPON ONU').trim(),
      ontSerial: String(ontSerial || '').trim().toUpperCase(),
      dropCableMeters: Math.max(0, Number(dropCableMeters) || 0),
      opticalPowerDbm: Number(opticalPowerDbm) || -22.0
    },
    technicianName: String(technicianName || 'Field Ops').trim(),
    notes: String(notes || '').trim(),
    slaTerms: {
      uptimeGuarantee: '99.0%',
      faultResolutionHours: 24,
      billingCycleDay: 5,
      fairUsagePolicy: 'Unlimited High-Speed Broadband with Standard Residential SLA'
    }
  };
}

/**
 * Retrieves saved service agreements from storage.
 * @param {Object} storage
 * @param {string} [customerId]
 * @returns {Array<Object>}
 */
export function getSavedServiceContracts(storage, customerId = null) {
  if (!storage || typeof storage.getItem !== 'function') return [];
  try {
    const raw = storage.getItem(SERVICE_CONTRACTS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    if (customerId) {
      return list.filter(item => item?.customer?.id === customerId);
    }
    return list;
  } catch {
    return [];
  }
}

/**
 * Persists a new service agreement in storage.
 * @param {Object} storage
 * @param {Object} contract
 * @returns {boolean}
 */
export function saveServiceContract(storage, contract) {
  if (!storage || typeof storage.setItem !== 'function' || !contract) return false;
  try {
    const list = getSavedServiceContracts(storage);
    list.unshift(contract);
    storage.setItem(SERVICE_CONTRACTS_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

/**
 * Formats WhatsApp customer copy of service agreement.
 * @param {Object} contract
 * @returns {string}
 */
export function formatServiceContractWhatsApp(contract) {
  if (!contract) return '';
  const c = contract.customer || {};
  const eq = contract.equipment || {};
  const formatPkr = (n) => Number(n || 0).toLocaleString();

  const lines = [
    `📜 *SHAHDARA BROADBAND - SERVICE AGREEMENT* 📜`,
    `*معاہدہ انٹرنیٹ سروس و انسٹالیشن آرڈر*`,
    `----------------------------------------`,
    `🔢 *Agreement No:* ${contract.agreementNumber}`,
    `📅 *Start Date:* ${contract.startDate} | *Tenure:* ${contract.contractMonths > 0 ? `${contract.contractMonths} Months (Valid till ${contract.expiryDate})` : 'Month-to-Month'}`,
    `👤 *Subscriber:* ${c.name} (Acc #${c.customerNumber || c.id})`,
    `📞 *Phone:* ${c.phone || '—'}`,
    `📍 *Location:* ${c.area || ''} ${c.mohalla || ''}`,
    contract.cnic ? `🪪 *CNIC:* ${contract.cnic}` : '',
    `----------------------------------------`,
    `🚀 *INTERNET TARIFF & CHARGES:*`,
    `• Package Speed: *${contract.packageSpeed}*`,
    `• Monthly Subscription: *PKR ${formatPkr(contract.monthlyRate)}/month*`,
    `• One-Time Installation: PKR ${formatPkr(contract.installationFee)}`,
    `• Refundable ONU Deposit: PKR ${formatPkr(contract.securityDeposit)}`,
    `💰 *Initial Total Paid:* *PKR ${formatPkr(contract.totalInitialPayment)}*`,
    `----------------------------------------`,
    `🛠️ *EQUIPMENT & OPTICAL DETAILS:*`,
    `• ONU / Router: ${eq.ontModel} (S/N: ${eq.ontSerial || 'Assigned'})`,
    `• Fiber Drop Length: ${eq.dropCableMeters} meters`,
    `• Optical Rx Power: ${eq.opticalPowerDbm} dBm (Optimal Link)`,
    `• Installed By: ${contract.technicianName}`,
    `----------------------------------------`,
    `📋 *SERVICE TERMS & SLA:*`,
    `• Monthly bill is payable by 5th of each calendar month.`,
    `• 24-hour optical line support & fault resolution SLA.`,
    `• Equipment remains provider property on security deposit.`,
    `📞 *Helpline / WhatsApp:* 0300-0000000 | Shahdara Network Ops`
  ].filter(Boolean);

  return lines.join('\n');
}

/**
 * Generates RFC-4180 CSV export of service agreements.
 * @param {Array<Object>} contracts
 * @returns {string}
 */
export function generateServiceContractCsv(contracts = []) {
  const headers = [
    'Agreement_No',
    'Date',
    'Expiry_Date',
    'Customer_No',
    'Customer_Name',
    'Phone',
    'CNIC',
    'Area',
    'Package_Speed',
    'Monthly_PKR',
    'Install_Fee_PKR',
    'Deposit_PKR',
    'Total_Initial_PKR',
    'ONT_Model',
    'ONT_Serial',
    'Fiber_Meters',
    'Optical_dBm',
    'Technician',
    'Notes'
  ];

  const rows = (contracts || []).map(cnt => [
    cnt.agreementNumber || '',
    cnt.startDate || '',
    cnt.expiryDate || '',
    String(cnt.customer?.customerNumber || ''),
    cnt.customer?.name || '',
    cnt.customer?.phone || '',
    cnt.cnic || '',
    cnt.customer?.area || '',
    cnt.packageSpeed || '',
    String(cnt.monthlyRate ?? 0),
    String(cnt.installationFee ?? 0),
    String(cnt.securityDeposit ?? 0),
    String(cnt.totalInitialPayment ?? 0),
    cnt.equipment?.ontModel || '',
    cnt.equipment?.ontSerial || '',
    String(cnt.equipment?.dropCableMeters ?? 0),
    String(cnt.equipment?.opticalPowerDbm ?? ''),
    cnt.technicianName || '',
    cnt.notes || ''
  ]);

  return generateCsvContent(headers, rows);
}

/**
 * Generates formal printable HTML representation for Service Agreement.
 * @param {Object} contract
 * @param {{ format?: 'a4' | 'slip' }} [options]
 * @returns {string}
 */
export function generateServiceContractHtml(contract, { format = 'a4' } = {}) {
  if (!contract) return '';
  const c = contract.customer || {};
  const eq = contract.equipment || {};
  const formatPkr = (n) => Number(n || 0).toLocaleString();

  if (format === 'slip') {
    return `
      <div class="contract-slip-document">
        <div class="contract-slip-header">
          <h3>SHAHDARA BROADBAND</h3>
          <p class="slip-sub">Fiber Internet Work Order &amp; Agreement</p>
          <p class="slip-urdu">معاہدہ انٹرنیٹ سروس و انسٹالیشن رسید</p>
          <div class="slip-code">
            <span>Agr: ${escapeHtml(contract.agreementNumber)}</span>
            <span>Date: ${escapeHtml(contract.startDate)}</span>
          </div>
        </div>
        <div class="slip-divider"></div>
        <div class="slip-row"><span>Subscriber:</span><strong>${escapeHtml(c.name)} (#${escapeHtml(c.customerNumber || c.id)})</strong></div>
        <div class="slip-row"><span>Phone:</span><span>${escapeHtml(c.phone || '—')}</span></div>
        ${contract.cnic ? `<div class="slip-row"><span>CNIC:</span><span>${escapeHtml(contract.cnic)}</span></div>` : ''}
        <div class="slip-row"><span>Location:</span><span>${escapeHtml(c.area || '')} ${escapeHtml(c.mohalla || '')}</span></div>
        <div class="slip-divider"></div>
        <div class="slip-row"><span>Package Speed:</span><strong>${escapeHtml(contract.packageSpeed)}</strong></div>
        <div class="slip-row"><span>Monthly Tariff:</span><strong>PKR ${formatPkr(contract.monthlyRate)}/mo</strong></div>
        <div class="slip-row"><span>Installation Fee:</span><span>PKR ${formatPkr(contract.installationFee)}</span></div>
        <div class="slip-row"><span>Security Deposit:</span><span>PKR ${formatPkr(contract.securityDeposit)}</span></div>
        <div class="slip-row highlight-bold"><span>Total Paid:</span><strong>PKR ${formatPkr(contract.totalInitialPayment)}</strong></div>
        <div class="slip-divider"></div>
        <div class="slip-row"><span>ONU / Router:</span><span>${escapeHtml(eq.ontModel)}</span></div>
        <div class="slip-row"><span>Serial No:</span><span>${escapeHtml(eq.ontSerial || 'Recorded')}</span></div>
        <div class="slip-row"><span>Fiber Cable:</span><span>${escapeHtml(eq.dropCableMeters)} meters</span></div>
        <div class="slip-row"><span>Optical Rx:</span><span>${escapeHtml(eq.opticalPowerDbm)} dBm</span></div>
        <div class="slip-row"><span>Technician:</span><span>${escapeHtml(contract.technicianName)}</span></div>
        <div class="slip-divider"></div>
        <p class="slip-terms-text">Bill due on 5th of each month. 24h SLA response. Equipment remains provider custody.</p>
        <div class="slip-signatures">
          <div class="slip-sig-col">
            <div class="slip-sig-line"></div>
            <span>Subscriber Sign</span>
          </div>
          <div class="slip-sig-col">
            <div class="slip-sig-line"></div>
            <span>Technician Sign</span>
          </div>
        </div>
      </div>
    `;
  }

  // Formal A4 Contract
  return `
    <div class="contract-a4-document">
      <header class="contract-a4-header">
        <div class="brand-left">
          <h2>SHAHDARA FIBER NETWORKS &amp; BROADBAND</h2>
          <p class="tagline">Licensed Local Internet Service Provider · Shahdara Lahore</p>
          <p class="urdu-title">معاہدہ برائے فراہمی انٹرنیٹ سروس و سامان تنصیب</p>
        </div>
        <div class="meta-right">
          <div class="doc-badge">FORMAL SERVICE AGREEMENT</div>
          <p><strong>Agreement No:</strong> <span class="font-mono">${escapeHtml(contract.agreementNumber)}</span></p>
          <p><strong>Effective Date:</strong> ${escapeHtml(contract.startDate)}</p>
          <p><strong>Expiry / Renewal:</strong> ${escapeHtml(contract.expiryDate)}</p>
        </div>
      </header>

      <div class="contract-grid-two">
        <section class="contract-block">
          <h4 class="block-title">1. SUBSCRIBER PARTICULARS (صارف کی تفصیلات)</h4>
          <table class="contract-data-table">
            <tr><td>Subscriber Name:</td><td><strong>${escapeHtml(c.name)}</strong></td></tr>
            <tr><td>Account / ID:</td><td>#${escapeHtml(c.customerNumber || c.id)}</td></tr>
            <tr><td>Contact Number:</td><td>${escapeHtml(c.phone || '—')}</td></tr>
            <tr><td>National ID (CNIC):</td><td><strong>${escapeHtml(contract.cnic || 'Verified on file')}</strong></td></tr>
            <tr><td>Installation Address:</td><td>${escapeHtml(c.address || c.mohalla || c.area || 'Shahdara')}</td></tr>
            <tr><td>Network Zone:</td><td>${escapeHtml(c.area || 'Shahdara Central')}</td></tr>
          </table>
        </section>

        <section class="contract-block">
          <h4 class="block-title">2. SUBSCRIPTION TARIFF &amp; PAYMENT SCHEDULE (نرخ نامہ و ادائیگی)</h4>
          <table class="contract-data-table">
            <tr><td>Subscribed Package:</td><td><strong>${escapeHtml(contract.packageSpeed)}</strong></td></tr>
            <tr><td>Monthly Subscription:</td><td class="font-bold">PKR ${formatPkr(contract.monthlyRate)} / month</td></tr>
            <tr><td>Setup &amp; Installation:</td><td>PKR ${formatPkr(contract.installationFee)} (One-time)</td></tr>
            <tr><td>Equipment Security Deposit:</td><td>PKR ${formatPkr(contract.securityDeposit)} (Refundable)</td></tr>
            <tr class="highlight-row"><td>Total Paid on Sign-up:</td><td class="font-bold text-success">PKR ${formatPkr(contract.totalInitialPayment)}</td></tr>
            <tr><td>Monthly Bill Due Date:</td><td>5th of each calendar month</td></tr>
          </table>
        </section>
      </div>

      <section class="contract-block" style="margin-top: 12px;">
        <h4 class="block-title">3. HARDWARE CUSTODY &amp; OPTICAL SPECIFICATIONS (تنصیب شدہ سامان کی تفصیل)</h4>
        <div class="hardware-specs-row">
          <div class="spec-cell"><span>ONU / Router Model:</span><strong>${escapeHtml(eq.ontModel)}</strong></div>
          <div class="spec-cell"><span>Hardware Serial (S/N):</span><strong class="font-mono">${escapeHtml(eq.ontSerial || 'RECORDED')}</strong></div>
          <div class="spec-cell"><span>Drop Cable Length:</span><strong>${escapeHtml(eq.dropCableMeters)} meters</strong></div>
          <div class="spec-cell"><span>Optical Power (Rx):</span><strong>${escapeHtml(eq.opticalPowerDbm)} dBm</strong> (Within -28dBm spec)</div>
          <div class="spec-cell"><span>Lead Technician:</span><strong>${escapeHtml(contract.technicianName)}</strong></div>
        </div>
      </section>

      <section class="contract-terms-section" style="margin-top: 12px;">
        <h4 class="block-title">4. TERMS OF SERVICE &amp; SLA GUARANTEE (شرائط و ضوابط)</h4>
        <div class="terms-bilingual-grid">
          <div class="terms-col-en">
            <ol>
              <li><strong>Billing &amp; Payment:</strong> Monthly charges are due by the 5th of each month. Late dues are subject to temporary suspension.</li>
              <li><strong>Hardware Custody:</strong> The ONU/Optical device remains provider property. In case of termination, equipment must be returned in good working condition for deposit refund.</li>
              <li><strong>SLA &amp; Support:</strong> Shahdara ISP maintains a 99.0% network uptime target. Optical breakages and connectivity faults are attended within 24 hours of ticketing.</li>
              <li><strong>Fair Usage &amp; Lawful Use:</strong> Connection is for residential/commercial bandwidth use only in compliance with Pakistan telecommunications laws.</li>
            </ol>
          </div>
          <div class="terms-col-ur" dir="rtl">
            <ol>
              <li><strong>بلنگ و ادائیگی:</strong> انٹرنیٹ بل ہر ماہ کی 5 تاریخ تک ادا کرنا لازمی ہے۔ تاخیر کی صورت میں سروس معطل کی جا سکتی ہے۔</li>
              <li><strong>سامان کی تحویل:</strong> فراہم کردہ راؤٹر/ڈیوائس کمپنی کی ملکیت ہے۔ کنکشن ختم کرنے پر سامان واپس کر کے سیکیورٹی رقم حاصل کی جا سکتی ہے۔</li>
              <li><strong>شکایات کا ازالہ:</strong> آپٹیکل فائبر کٹنے یا خرابی کی صورت میں 24 گھنٹے کے اندر اندر سروس بحال کی جائے گی۔</li>
              <li><strong>قانونی استعمال:</strong> انٹرنیٹ کا استعمال پاکستان ٹیلی کمیونیکیشن کے وضع کردہ قواعد کے مطابق ہونا ضروری ہے۔</li>
            </ol>
          </div>
        </div>
      </section>

      <footer class="contract-signatures-footer" style="margin-top: 24px;">
        <div class="sig-col">
          <div class="sig-space"></div>
          <p class="sig-name">${escapeHtml(c.name)}</p>
          <p class="sig-title">Subscriber Signature / دستخط صارف</p>
        </div>
        <div class="sig-col">
          <div class="sig-space"></div>
          <p class="sig-name">${escapeHtml(contract.technicianName)}</p>
          <p class="sig-title">Field Installation Engineer / تصدیق ٹیکنیشن</p>
        </div>
        <div class="sig-col">
          <div class="sig-space stamp-box">SEAL</div>
          <p class="sig-name">Authorized Signatory</p>
          <p class="sig-title">Shahdara Broadband Operations</p>
        </div>
      </footer>
    </div>
  `;
}

/**
 * Sets up Service Contract & Installation Work Order Modal Dialog Controller.
 */
export function setupServiceContractModal({
  getState,
  storage = (typeof localStorage !== 'undefined' ? localStorage : null),
  onToast = (msg) => { if (typeof console !== 'undefined') console.log(msg); },
  clipboard = (typeof navigator !== 'undefined' ? navigator.clipboard : null),
  openWindow = (typeof window !== 'undefined' ? window.open : null),
  onContractCreated
} = {}) {
  if (typeof document === 'undefined') {
    return {
      open: () => {},
      close: () => {},
      refresh: () => {},
      getContracts: () => []
    };
  }

  const modal = document.getElementById('customerServiceContractModal');
  if (!modal) {
    return {
      open: () => {},
      close: () => {},
      refresh: () => {},
      getContracts: () => []
    };
  }

  const closeBtn = document.getElementById('closeServiceContractModalBtn');
  const closeSecondaryBtn = document.getElementById('closeServiceContractSecondaryBtn');
  const submitBtn = document.getElementById('submitServiceContractBtn');
  const printA4Btn = document.getElementById('printServiceContractA4Btn');
  const printSlipBtn = document.getElementById('printServiceContractSlipBtn');
  const whatsappBtn = document.getElementById('whatsappServiceContractBtn');
  const exportCsvBtn = document.getElementById('exportServiceContractCsvBtn');

  // Customer header fields
  const custNameEl = document.getElementById('contractCustName');
  const custPhoneEl = document.getElementById('contractCustPhone');
  const custLocationEl = document.getElementById('contractCustLocation');
  const custPackageEl = document.getElementById('contractCustCurrentPackage');

  // Inputs
  const cnicInput = document.getElementById('contractCnicInput');
  const packageSpeedInput = document.getElementById('contractPackageSelect');
  const monthlyRateInput = document.getElementById('contractMonthlyRateInput');
  const installFeeInput = document.getElementById('contractInstallFeeInput');
  const depositInput = document.getElementById('contractDepositInput');
  const ontModelInput = document.getElementById('contractOntModelInput');
  const ontSerialInput = document.getElementById('contractOntSerialInput');
  const cableMetersInput = document.getElementById('contractCableMetersInput');
  const opticalPowerInput = document.getElementById('contractOpticalPowerInput');
  const tenureSelect = document.getElementById('contractTenureSelect');
  const startDateInput = document.getElementById('contractStartDateInput');
  const techNameInput = document.getElementById('contractTechNameInput');
  const notesInput = document.getElementById('contractNotesInput');

  // Preview elements
  const previewAgrNumber = document.getElementById('contractPreviewAgrNumber');
  const previewExpiryDate = document.getElementById('contractPreviewExpiry');
  const previewTotalInitial = document.getElementById('contractPreviewTotalInitial');
  const previewOntSummary = document.getElementById('contractPreviewOntSummary');

  // Errors
  const cnicError = document.getElementById('contractCnicError');
  const monthlyRateError = document.getElementById('contractMonthlyRateError');
  const techError = document.getElementById('contractTechError');

  // History table
  const historyTableBody = document.getElementById('contractHistoryTableBody');

  let currentCustomer = null;
  let activeContract = null;

  function maskCnicInput() {
    if (!cnicInput) return;
    const digits = cnicInput.value.replace(/[^0-9]/g, '').slice(0, 13);
    let formatted = '';
    if (digits.length <= 5) {
      formatted = digits;
    } else if (digits.length <= 12) {
      formatted = `${digits.slice(0, 5)}-${digits.slice(5)}`;
    } else {
      formatted = `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12, 13)}`;
    }
    cnicInput.value = formatted;
  }

  function recalculatePreview() {
    const start = startDateInput?.value ? new Date(startDateInput.value) : new Date();
    const tenure = parseInt(tenureSelect?.value || '12', 10);
    let expiry = 'Open Month-to-Month';
    if (tenure > 0) {
      const exp = new Date(start);
      exp.setMonth(exp.getMonth() + tenure);
      expiry = exp.toISOString().slice(0, 10);
    }
    if (previewExpiryDate) previewExpiryDate.textContent = expiry;

    const rate = Number(monthlyRateInput?.value) || 0;
    const install = Number(installFeeInput?.value) || 0;
    const deposit = Number(depositInput?.value) || 0;
    const total = rate + install + deposit;

    if (previewTotalInitial) {
      previewTotalInitial.textContent = `PKR ${total.toLocaleString()}`;
    }

    if (previewOntSummary) {
      const model = ontModelInput?.value || 'ONT Router';
      const serial = ontSerialInput?.value ? `(S/N: ${ontSerialInput.value.trim().toUpperCase()})` : '';
      previewOntSummary.textContent = `${model} ${serial}`.trim();
    }
  }

  function renderHistory() {
    if (!historyTableBody) return;
    const cid = currentCustomer ? currentCustomer.id : null;
    const contracts = getSavedServiceContracts(storage, cid);

    if (!contracts.length) {
      historyTableBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No service agreements issued yet.</td></tr>`;
      return;
    }

    historyTableBody.innerHTML = contracts.map(cnt => `
      <tr>
        <td class="font-mono font-bold">${escapeHtml(cnt.agreementNumber)}</td>
        <td>${escapeHtml(cnt.startDate)}</td>
        <td>${escapeHtml(cnt.packageSpeed)}</td>
        <td class="text-right font-mono">PKR ${Number(cnt.monthlyRate || 0).toLocaleString()}</td>
        <td class="text-right font-mono font-bold">PKR ${Number(cnt.totalInitialPayment || 0).toLocaleString()}</td>
        <td><span class="role-badge role-primary">${escapeHtml(cnt.contractMonths > 0 ? `${cnt.contractMonths} Mo` : 'Open')}</span></td>
        <td class="text-center">
          <button type="button" class="action-btn-sm" data-print-agr="${escapeHtml(cnt.agreementNumber)}" title="Print Formal A4">🖨️ A4</button>
          <button type="button" class="action-btn-sm" data-print-slip="${escapeHtml(cnt.agreementNumber)}" title="Print Thermal Slip">🧾 Slip</button>
        </td>
      </tr>
    `).join('');

    const printAgrBtns = historyTableBody.querySelectorAll('[data-print-agr]');
    printAgrBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const num = btn.getAttribute('data-print-agr');
        const found = contracts.find(c => c.agreementNumber === num);
        if (found) printDocument(found, 'a4');
      });
    });

    const printSlipBtns = historyTableBody.querySelectorAll('[data-print-slip]');
    printSlipBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const num = btn.getAttribute('data-print-slip');
        const found = contracts.find(c => c.agreementNumber === num);
        if (found) printDocument(found, 'slip');
      });
    });
  }

  function printDocument(contract, format = 'a4') {
    if (!contract) return;
    const html = generateServiceContractHtml(contract, { format });
    const win = openWindow ? openWindow('', '_blank') : null;
    if (win && win.document) {
      win.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>${format === 'slip' ? 'Work Order Slip' : 'Service Agreement'} - ${contract.agreementNumber}</title>
          <style>
            body { font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 20px; color: #111; font-size: 13px; line-height: 1.4; }
            .contract-a4-document { max-width: 820px; margin: 0 auto; padding: 24px; border: 1px solid #ddd; background: #fff; }
            .contract-a4-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0e5b4d; padding-bottom: 12px; margin-bottom: 16px; }
            .contract-a4-header h2 { margin: 0; color: #0e5b4d; font-size: 20px; font-weight: 800; letter-spacing: 0.5px; }
            .tagline { margin: 2px 0; font-size: 12px; color: #666; }
            .urdu-title { margin: 4px 0 0; font-size: 14px; font-weight: bold; color: #0f172a; direction: rtl; }
            .meta-right { text-align: right; font-size: 12px; }
            .doc-badge { display: inline-block; background: #0e5b4d; color: #fff; font-size: 10px; font-weight: bold; padding: 3px 8px; border-radius: 4px; margin-bottom: 6px; }
            .contract-grid-two { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
            .contract-block { border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; background: #f8fafc; }
            .block-title { margin: 0 0 8px; font-size: 12px; font-weight: 800; text-transform: uppercase; color: #0e5b4d; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
            .contract-data-table { width: 100%; border-collapse: collapse; font-size: 12px; }
            .contract-data-table td { padding: 4px 6px; border-bottom: 1px solid #f1f5f9; }
            .contract-data-table tr.highlight-row { background: rgba(16, 185, 129, 0.1); }
            .hardware-specs-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; font-size: 11px; }
            .spec-cell span { display: block; color: #64748b; font-size: 10px; }
            .terms-bilingual-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 11px; color: #334155; line-height: 1.5; }
            .terms-bilingual-grid ol { margin: 0; padding-left: 18px; }
            .terms-col-ur ol { padding-right: 18px; padding-left: 0; }
            .contract-signatures-footer { display: flex; justify-content: space-between; margin-top: 32px; padding-top: 16px; border-top: 1px solid #cbd5e1; text-align: center; font-size: 11px; }
            .sig-col { width: 180px; }
            .sig-space { height: 45px; border-bottom: 1px solid #000; margin-bottom: 6px; }
            .sig-space.stamp-box { border: 1px dashed #64748b; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-weight: bold; font-size: 10px; }
            .sig-name { font-weight: bold; margin: 0; }
            .sig-title { margin: 2px 0 0; color: #64748b; font-size: 10px; }
            /* Thermal Slip layout */
            .contract-slip-document { max-width: 320px; margin: 0 auto; font-family: monospace, system-ui; font-size: 12px; color: #000; padding: 10px; }
            .contract-slip-header { text-align: center; }
            .contract-slip-header h3 { margin: 0; font-size: 15px; font-weight: 800; }
            .slip-sub, .slip-urdu { margin: 2px 0; font-size: 11px; }
            .slip-code { display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; margin-top: 4px; }
            .slip-divider { border-top: 1px dashed #000; margin: 6px 0; }
            .slip-row { display: flex; justify-content: space-between; margin: 2px 0; }
            .slip-row.highlight-bold { font-weight: bold; font-size: 13px; margin: 4px 0; }
            .slip-terms-text { font-size: 10px; margin: 6px 0; text-align: center; }
            .slip-signatures { display: flex; justify-content: space-between; margin-top: 16px; text-align: center; font-size: 10px; }
            .slip-sig-col { width: 120px; }
            .slip-sig-line { border-bottom: 1px solid #000; height: 25px; margin-bottom: 4px; }
            @media print {
              body { margin: 0; padding: 0; }
              .contract-a4-document { border: none; padding: 0; max-width: 100%; }
            }
          </style>
        </head>
        <body>
          ${html}
          <script>window.onload = function() { window.print(); };</script>
        </body>
        </html>
      `);
      win.document.close();
    } else if (typeof window !== 'undefined' && typeof window.print === 'function') {
      window.print();
    }
  }

  function open(customer = null) {
    if (customer) currentCustomer = customer;
    else if (typeof getState === 'function') {
      const st = getState();
      if (st && Array.isArray(st.customers) && st.selectedCustomerId) {
        currentCustomer = st.customers.find(c => c.id === st.selectedCustomerId) || st.customers[0];
      } else if (st && Array.isArray(st.customers) && st.customers.length > 0) {
        currentCustomer = st.customers[0];
      }
    }

    if (custNameEl) custNameEl.textContent = currentCustomer?.name || 'Subscriber';
    if (custPhoneEl) custPhoneEl.textContent = currentCustomer?.phone || 'Not set';
    if (custLocationEl) custLocationEl.textContent = `${currentCustomer?.area || 'Shahdara'} ${currentCustomer?.mohalla ? `· ${currentCustomer.mohalla}` : ''}`;
    if (custPackageEl) custPackageEl.textContent = currentCustomer?.packageSpeed || '15 Mbps';

    if (packageSpeedInput && currentCustomer?.packageSpeed) {
      packageSpeedInput.value = currentCustomer.packageSpeed;
    }

    const rate = getCustomerMonthlyRate(currentCustomer);
    if (monthlyRateInput && rate > 0) {
      monthlyRateInput.value = rate;
    }

    if (startDateInput && !startDateInput.value) {
      startDateInput.value = new Date().toISOString().slice(0, 10);
    }

    // Auto-generate preview agreement number
    const allContracts = getSavedServiceContracts(storage);
    const yrMo = new Date().toISOString().slice(0, 7).replace('-', '');
    const seq = String(allContracts.length + 1).padStart(4, '0');
    if (previewAgrNumber) {
      previewAgrNumber.textContent = `AGR-${yrMo}-${seq}`;
    }

    recalculatePreview();
    renderHistory();

    if (typeof modal.showModal === 'function') {
      modal.showModal();
    } else {
      modal.setAttribute('open', '');
    }
  }

  function close() {
    if (typeof modal.close === 'function') {
      modal.close();
    } else {
      modal.removeAttribute('open');
    }
  }

  // Bind input recalculations and masking
  if (cnicInput && !cnicInput.dataset?.wiredContract) {
    if (cnicInput.dataset) cnicInput.dataset.wiredContract = 'true';
    cnicInput.addEventListener('input', () => {
      maskCnicInput();
      if (cnicError) cnicError.hidden = true;
    });
  }

  [monthlyRateInput, installFeeInput, depositInput, tenureSelect, startDateInput, ontModelInput, ontSerialInput].forEach(inp => {
    if (inp && !inp.dataset?.wiredContract) {
      if (inp.dataset) inp.dataset.wiredContract = 'true';
      inp.addEventListener('input', recalculatePreview);
      inp.addEventListener('change', recalculatePreview);
    }
  });

  // Issue agreement button
  if (submitBtn && !submitBtn.dataset?.wiredContract) {
    if (submitBtn.dataset) submitBtn.dataset.wiredContract = 'true';
    submitBtn.addEventListener('click', () => {
      if (!currentCustomer) {
        onToast('Please select a subscriber first.');
        return;
      }

      const cnicVal = cnicInput ? cnicInput.value : '';
      const pkgVal = packageSpeedInput ? packageSpeedInput.value : '15 Mbps Turbo';
      const rateVal = monthlyRateInput ? monthlyRateInput.value : '1500';
      const feeVal = installFeeInput ? installFeeInput.value : '1000';
      const depVal = depositInput ? depositInput.value : '1500';
      const techVal = techNameInput ? techNameInput.value : 'Field Ops';

      const validation = validateServiceContract({
        customerId: currentCustomer.id,
        cnic: cnicVal,
        packageSpeed: pkgVal,
        monthlyRate: rateVal,
        installationFee: feeVal,
        securityDeposit: depVal,
        technicianName: techVal
      });

      if (!validation.valid) {
        if (validation.errors.cnic && cnicError) {
          cnicError.textContent = validation.errors.cnic;
          cnicError.hidden = false;
        }
        if (validation.errors.monthlyRate && monthlyRateError) {
          monthlyRateError.textContent = validation.errors.monthlyRate;
          monthlyRateError.hidden = false;
        }
        if (validation.errors.technicianName && techError) {
          techError.textContent = validation.errors.technicianName;
          techError.hidden = false;
        }
        onToast('Please correct form validation errors.');
        return;
      }

      const all = getSavedServiceContracts(storage);
      const contract = buildServiceContractData({
        customer: currentCustomer,
        cnic: cnicVal,
        packageSpeed: pkgVal,
        monthlyRate: Number(rateVal),
        installationFee: Number(feeVal),
        securityDeposit: Number(depVal),
        ontModel: ontModelInput ? ontModelInput.value : 'Huawei GPON ONU',
        ontSerial: ontSerialInput ? ontSerialInput.value : '',
        dropCableMeters: cableMetersInput ? Number(cableMetersInput.value) || 0 : 50,
        opticalPowerDbm: opticalPowerInput ? Number(opticalPowerInput.value) || -22.0 : -22.0,
        contractMonths: tenureSelect ? Number(tenureSelect.value) || 0 : 12,
        startDate: startDateInput ? startDateInput.value : new Date().toISOString().slice(0, 10),
        technicianName: techVal,
        notes: notesInput ? notesInput.value : '',
        existingContractsCount: all.length
      });

      saveServiceContract(storage, contract);
      activeContract = contract;

      renderHistory();
      recalculatePreview();

      if (typeof onContractCreated === 'function') {
        onContractCreated(contract);
      }

      onToast(`Service Agreement #${contract.agreementNumber} issued successfully!`);
    });
  }

  // Print A4
  if (printA4Btn && !printA4Btn.dataset?.wiredContract) {
    if (printA4Btn.dataset) printA4Btn.dataset.wiredContract = 'true';
    printA4Btn.addEventListener('click', () => {
      const cnt = activeContract || (currentCustomer ? getSavedServiceContracts(storage, currentCustomer.id)[0] : null);
      if (!cnt) {
        onToast('Issue a contract first or select one from history to print.');
        return;
      }
      printDocument(cnt, 'a4');
    });
  }

  // Print 80mm Slip
  if (printSlipBtn && !printSlipBtn.dataset?.wiredContract) {
    if (printSlipBtn.dataset) printSlipBtn.dataset.wiredContract = 'true';
    printSlipBtn.addEventListener('click', () => {
      const cnt = activeContract || (currentCustomer ? getSavedServiceContracts(storage, currentCustomer.id)[0] : null);
      if (!cnt) {
        onToast('Issue a contract first or select one from history to print.');
        return;
      }
      printDocument(cnt, 'slip');
    });
  }

  // WhatsApp
  if (whatsappBtn && !whatsappBtn.dataset?.wiredContract) {
    if (whatsappBtn.dataset) whatsappBtn.dataset.wiredContract = 'true';
    whatsappBtn.addEventListener('click', () => {
      const cnt = activeContract || (currentCustomer ? getSavedServiceContracts(storage, currentCustomer.id)[0] : null);
      if (!cnt) {
        onToast('Issue a contract first to generate WhatsApp copy.');
        return;
      }
      const text = formatServiceContractWhatsApp(cnt);
      const phone = cnt.customer?.phone || currentCustomer?.phone || '';
      const url = formatWhatsAppUrl(phone, text);
      if (typeof window !== 'undefined' && typeof window.open === 'function') {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    });
  }

  // Export CSV
  if (exportCsvBtn && !exportCsvBtn.dataset?.wiredContract) {
    if (exportCsvBtn.dataset) exportCsvBtn.dataset.wiredContract = 'true';
    exportCsvBtn.addEventListener('click', () => {
      const all = getSavedServiceContracts(storage);
      if (!all.length) {
        onToast('No service agreements found to export.');
        return;
      }
      const csv = generateServiceContractCsv(all);
      const filename = `shahdara_service_agreements_${new Date().toISOString().slice(0, 10)}.csv`;
      downloadCsvFile(filename, csv);
      onToast('Service agreements CSV downloaded.');
    });
  }

  // Close triggers
  if (closeBtn && !closeBtn.dataset?.wiredContract) {
    if (closeBtn.dataset) closeBtn.dataset.wiredContract = 'true';
    closeBtn.addEventListener('click', close);
  }
  if (closeSecondaryBtn && !closeSecondaryBtn.dataset?.wiredContract) {
    if (closeSecondaryBtn.dataset) closeSecondaryBtn.dataset.wiredContract = 'true';
    closeSecondaryBtn.addEventListener('click', close);
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });

  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  });

  return {
    open,
    close,
    refresh: () => {
      recalculatePreview();
      renderHistory();
    },
    getContracts: (cid = null) => getSavedServiceContracts(storage, cid)
  };
}

/* ==========================================================================
   Customer Formal Billing Dispute Resolution & Discrepancy Claims Form (agent3 - shahdara-forms-qa)
   ========================================================================== */

export const DISPUTE_CLAIMS_KEY = 'shahdara_dispute_claims';

export const DISPUTE_CATEGORIES = {
  unrecorded_payment: {
    label: 'Unrecorded Cash / Direct Payment',
    labelUrdu: 'غیر اندراج شدہ کیش ادائیگی',
    requiresClaimDate: true
  },
  rate_mismatch: {
    label: 'Package Tariff / Rate Discrepancy',
    labelUrdu: 'پیکج ریٹ و ٹیرف فرق',
    requiresClaimDate: false
  },
  downtime_dispute: {
    label: 'Prolonged Service Outage / Fiber Cut',
    labelUrdu: 'طویل سروس تعطل و خرابی',
    requiresClaimDate: true
  },
  wrong_billing_period: {
    label: 'Incorrect Service Period / Shifted Month',
    labelUrdu: 'غلط بلنگ دورانیہ',
    requiresClaimDate: false
  },
  duplicate_charge: {
    label: 'Duplicate Charge / Arrears Double-Entry',
    labelUrdu: 'ڈبل بلنگ یا دوہرا اندراج',
    requiresClaimDate: false
  },
  unauthorized_addon: {
    label: 'Unrecognized Equipment / Surcharge',
    labelUrdu: 'غیر مصدقہ سازوسامان چارج',
    requiresClaimDate: false
  },
  other: {
    label: 'General Billing Inquiry / Discrepancy',
    labelUrdu: 'دیگر متنازعہ بلنگ استفسار',
    requiresClaimDate: false
  }
};

export function validateDisputeClaim({
  customerId,
  category,
  disputedAmount,
  reason,
  filedBy
} = {}) {
  const errors = {};

  if (!customerId || typeof customerId !== 'string' || !customerId.trim()) {
    errors.customerId = 'Valid subscriber account must be selected.';
  }

  if (!category || !DISPUTE_CATEGORIES[category]) {
    errors.category = 'A valid dispute category is required.';
  }

  const amt = Number(disputedAmount);
  if (isNaN(amt) || amt <= 0) {
    errors.disputedAmount = 'Disputed amount must be greater than zero.';
  }

  if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
    errors.reason = 'Please provide detailed reason for the claim (at least 5 characters).';
  }

  if (!filedBy || typeof filedBy !== 'string' || filedBy.trim().length < 2) {
    errors.filedBy = 'Officer or subscriber filing name is required (min 2 characters).';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

export function assessDisputeClaim(claimData = {}, customer = {}) {
  let currentBalance = 0;
  if (Array.isArray(customer.bills)) {
    for (const b of customer.bills) {
      const due = Number(b.dueAmount) || 0;
      if (due > 0 && b.status !== 'paid') {
        currentBalance += due;
      }
    }
  }

  const disputedAmt = Math.max(0, Number(claimData.disputedAmount) || 0);
  const approvedAmt = claimData.approvedAmount !== undefined
    ? Math.max(0, Number(claimData.approvedAmount) || 0)
    : disputedAmt;

  const netProjectedBalance = Math.max(0, currentBalance - approvedAmt);
  const categoryMeta = DISPUTE_CATEGORIES[claimData.category] || DISPUTE_CATEGORIES.other;

  let isPlausible = true;
  let recommendation = 'Standard verification required with subscriber billing history.';

  if (claimData.category === 'unrecorded_payment') {
    if (currentBalance >= disputedAmt) {
      recommendation = 'Claim matches or is within outstanding arrears. Check collector logbook and physical receipts.';
      isPlausible = true;
    } else {
      recommendation = 'Claimed payment exceeds total outstanding balance. Audit for advance credit or duplicate entry.';
      isPlausible = false;
    }
  } else if (claimData.category === 'rate_mismatch') {
    recommendation = 'Verify subscribed speed tier in bandwidth throttle records vs invoice snapshot.';
  } else if (claimData.category === 'downtime_dispute') {
    recommendation = 'Cross-reference optical link down-events and area outage log for claimed period.';
  }

  return {
    currentBalance,
    disputedAmount: disputedAmt,
    approvedAmount: approvedAmt,
    netProjectedBalance,
    categoryLabel: categoryMeta.label,
    categoryLabelUrdu: categoryMeta.labelUrdu,
    isPlausible,
    recommendation
  };
}

export function buildDisputeClaimRecord({
  customer = {},
  category = 'other',
  disputedAmount = 0,
  approvedAmount = null,
  reason = '',
  filedBy = 'Billing Staff',
  status = 'SUBMITTED',
  resolvedBy = '',
  resolutionNotes = '',
  billMonth = '',
  claimedDate = '',
  evidenceRef = '',
  existingClaimsCount = 0
} = {}) {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const seq = String(existingClaimsCount + 1).padStart(4, '0');
  const ticketNumber = `DSP-${yyyy}${mm}-${seq}`;

  const categoryMeta = DISPUTE_CATEGORIES[category] || DISPUTE_CATEGORIES.other;
  const assessment = assessDisputeClaim({
    category,
    disputedAmount,
    approvedAmount: approvedAmount !== null ? approvedAmount : (status && status.startsWith('APPROVED') ? disputedAmount : 0)
  }, customer);

  return {
    ticketNumber,
    customerId: customer.id || '',
    customerNumber: customer.customerNumber || null,
    customerName: customer.name || 'Subscriber',
    customerPhone: customer.phone || '',
    customerArea: customer.area || customer.mohalla || '',
    category,
    categoryLabel: categoryMeta.label,
    categoryLabelUrdu: categoryMeta.labelUrdu,
    disputedAmount: Number(disputedAmount) || 0,
    approvedAmount: Number(assessment.approvedAmount) || 0,
    previousBalance: assessment.currentBalance,
    projectedBalance: assessment.netProjectedBalance,
    reason: (reason || '').trim(),
    filedBy: (filedBy || '').trim(),
    status: status || 'SUBMITTED',
    resolvedBy: (resolvedBy || '').trim(),
    resolutionNotes: (resolutionNotes || '').trim(),
    billMonth: billMonth || '',
    claimedDate: claimedDate || '',
    evidenceRef: (evidenceRef || '').trim(),
    createdAt: new Date().toISOString()
  };
}

export function getSavedDisputeClaims(storage, customerId = null) {
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store || typeof store.getItem !== 'function') return [];
  try {
    const raw = store.getItem(DISPUTE_CLAIMS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    if (customerId) {
      return list.filter(c => c.customerId === customerId);
    }
    return list;
  } catch {
    return [];
  }
}

export function saveDisputeClaim(claim, storage) {
  if (!claim || !claim.ticketNumber) return null;
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  const existing = getSavedDisputeClaims(store);
  const updated = [claim, ...existing.filter(c => c.ticketNumber !== claim.ticketNumber)];
  if (store && typeof store.setItem === 'function') {
    try {
      store.setItem(DISPUTE_CLAIMS_KEY, JSON.stringify(updated));
    } catch {}
  }
  return claim;
}

export function updateDisputeClaimStatus(ticketNumber, {
  status = 'APPROVED_FULL',
  approvedAmount = null,
  resolvedBy = '',
  resolutionNotes = ''
} = {}, storage) {
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  const existing = getSavedDisputeClaims(store);
  let updatedClaim = null;

  const modified = existing.map(item => {
    if (item.ticketNumber === ticketNumber) {
      const finalApproved = approvedAmount !== null
        ? Number(approvedAmount)
        : (status === 'APPROVED_FULL' ? item.disputedAmount : (status === 'REJECTED' ? 0 : item.approvedAmount));

      updatedClaim = {
        ...item,
        status,
        approvedAmount: finalApproved,
        projectedBalance: Math.max(0, item.previousBalance - finalApproved),
        resolvedBy: resolvedBy || item.resolvedBy,
        resolutionNotes: resolutionNotes || item.resolutionNotes,
        resolvedAt: new Date().toISOString()
      };
      return updatedClaim;
    }
    return item;
  });

  if (store && typeof store.setItem === 'function') {
    try {
      store.setItem(DISPUTE_CLAIMS_KEY, JSON.stringify(modified));
    } catch {}
  }

  return updatedClaim;
}

export function formatDisputeClaimWhatsApp(claim = {}) {
  const statusIcon = claim.status === 'APPROVED_FULL' ? '✅ [APPROVED IN FULL]'
    : claim.status === 'APPROVED_PARTIAL' ? '⚠️ [PARTIAL CREDIT APPROVED]'
    : claim.status === 'REJECTED' ? '❌ [CLAIM REJECTED]'
    : claim.status === 'UNDER_INVESTIGATION' ? '🔍 [UNDER AUDIT]'
    : '⏳ [SUBMITTED]';

  const lines = [
    `*SHAHDARA FIBER NET - BILLING DISPUTE TICKET*`,
    `📋 Ticket Ref: ${claim.ticketNumber || 'DSP-0000'}`,
    `👤 Subscriber: ${claim.customerName || 'Customer'}${claim.customerNumber ? ` (#${claim.customerNumber})` : ''}`,
    `🏷️ Category: ${claim.categoryLabel || 'Billing Dispute'} (${claim.categoryLabelUrdu || ''})`,
    `💰 Disputed Amount: PKR ${Number(claim.disputedAmount || 0).toLocaleString()}`,
    `📌 Status: ${statusIcon}`,
    `⚖️ Approved Adjustment: PKR ${Number(claim.approvedAmount || 0).toLocaleString()}`,
    `💳 Balance After Settlement: PKR ${Number(claim.projectedBalance || 0).toLocaleString()}`,
    `───────────────────────`,
    `📝 Grounds: ${claim.reason || 'Subscriber billing inquiry'}`,
    claim.evidenceRef ? `📎 Evidence Ref: ${claim.evidenceRef}` : '',
    claim.billMonth ? `📅 Disputed Service Month: ${claim.billMonth}` : '',
    claim.resolutionNotes ? `🔎 Settlement Finding: ${claim.resolutionNotes}` : '',
    claim.resolvedBy ? `👨‍💼 Decided By: ${claim.resolvedBy}` : '',
    `───────────────────────`,
    `Helpline: 0300-1234567 | Shahdara Network Accounts`
  ].filter(Boolean);

  return lines.join('\n');
}

export function generateDisputeClaimsCsv(claims = []) {
  const headers = [
    'Ticket_No', 'Date', 'Customer_No', 'Customer_Name', 'Phone', 'Area',
    'Category', 'Disputed_PKR', 'Approved_Credit_PKR', 'Net_Balance_PKR',
    'Status', 'Filed_By', 'Resolved_By', 'Evidence_Ref', 'Reason'
  ];

  const rows = claims.map(c => [
    c.ticketNumber || '',
    (c.createdAt || '').slice(0, 10),
    String(c.customerNumber || ''),
    c.customerName || '',
    c.customerPhone || '',
    c.customerArea || '',
    c.categoryLabel || '',
    String(c.disputedAmount || 0),
    String(c.approvedAmount || 0),
    String(c.projectedBalance || 0),
    c.status || '',
    c.filedBy || '',
    c.resolvedBy || '',
    c.evidenceRef || '',
    c.reason || ''
  ]);

  return generateCsvContent(headers, rows);
}

export function generateDisputeClaimHtml(claim = {}, options = {}) {
  const format = options.format || 'a4';
  const c = claim || {};

  if (format === 'slip') {
    return `
      <div class="dispute-thermal-slip" style="font-family: monospace; max-width: 300px; padding: 10px; border: 1px dashed #ccc; line-height: 1.3; font-size: 12px;">
        <div style="text-align: center; border-bottom: 1px dashed #444; padding-bottom: 6px; margin-bottom: 8px;">
          <h2 style="font-size: 14px; margin: 0;">SHAHDARA FIBER NET</h2>
          <p style="font-size: 11px; margin: 2px 0;">BILLING DISPUTE CLAIM SLIP</p>
          <p style="font-size: 10px; margin: 0; color: #555;">تنازعہ بلنگ و کھاتہ تصدیق واؤچر</p>
        </div>
        <div style="margin-bottom: 6px;">
          <strong>Ticket #: </strong><span>${escapeHtml(c.ticketNumber)}</span><br>
          <strong>Date: </strong><span>${escapeHtml((c.createdAt || '').slice(0, 10))}</span><br>
          <strong>Customer: </strong><span>${escapeHtml(c.customerName)} (#${escapeHtml(c.customerNumber || '')})</span><br>
          <strong>Category: </strong><span>${escapeHtml(c.categoryLabel)}</span><br>
          <strong>Status: </strong><span>${escapeHtml(c.status)}</span>
        </div>
        <div style="border-top: 1px dashed #444; border-bottom: 1px dashed #444; padding: 6px 0; margin: 6px 0;">
          <div style="display:flex; justify-content:space-between;">
            <span>Disputed Amount:</span>
            <strong>PKR ${Number(c.disputedAmount || 0).toLocaleString()}</strong>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span>Approved Credit:</span>
            <strong style="color: #047857;">PKR ${Number(c.approvedAmount || 0).toLocaleString()}</strong>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span>Net Balance:</span>
            <strong>PKR ${Number(c.projectedBalance || 0).toLocaleString()}</strong>
          </div>
        </div>
        <div style="font-size: 11px; margin-bottom: 8px;">
          <strong>Grounds: </strong><span>${escapeHtml(c.reason)}</span><br>
          ${c.evidenceRef ? `<strong>Ref: </strong><span>${escapeHtml(c.evidenceRef)}</span><br>` : ''}
          ${c.resolutionNotes ? `<strong>Resolution: </strong><span>${escapeHtml(c.resolutionNotes)}</span><br>` : ''}
        </div>
        <div style="border-top: 1px dashed #444; padding-top: 8px; display:flex; justify-content:space-between; font-size: 10px;">
          <div><br>Subscriber Sign</div>
          <div><br>Accountant Sign</div>
        </div>
      </div>
    `;
  }

  return `
    <div class="dispute-formal-sheet" style="font-family: sans-serif; max-width: 720px; margin: 0 auto; padding: 24px; border: 1px solid #ddd; background: #fff; line-height: 1.4; color: #111;">
      <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #0e5b4d; padding-bottom: 12px; margin-bottom: 16px;">
        <div>
          <h1 style="font-size: 20px; margin: 0; color: #0e5b4d;">SHAHDARA FIBER BROADBAND NETWORK</h1>
          <p style="font-size: 12px; margin: 2px 0; color: #444;">Main Bazar, Shahdara, Lahore · Accounts &amp; Revenue Dispute Tribunal</p>
          <h3 style="font-size: 14px; margin: 4px 0 0 0; color: #333;">FORMAL BILLING DISPUTE SETTLEMENT VOUCHER</h3>
        </div>
        <div style="text-align: right;">
          <h2 style="font-size: 16px; margin: 0; color: #0e5b4d;" dir="rtl">درخواست برائے تصفیہ متنازعہ واجبات</h2>
          <p style="font-size: 12px; margin: 4px 0; font-family: monospace;"><strong>${escapeHtml(c.ticketNumber)}</strong></p>
          <span style="display: inline-block; padding: 2px 8px; font-size: 11px; font-weight: bold; background: #f0fdf4; border: 1px solid #86efac; border-radius: 4px; color: #166534;">${escapeHtml(c.status)}</span>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; background: #f9fafb; padding: 12px; border-radius: 8px; border: 1px solid #e5e7eb;">
        <div>
          <p style="margin: 3px 0; font-size: 13px;"><strong>Subscriber Name:</strong> ${escapeHtml(c.customerName)}</p>
          <p style="margin: 3px 0; font-size: 13px;"><strong>Account #:</strong> #${escapeHtml(c.customerNumber || '—')}</p>
          <p style="margin: 3px 0; font-size: 13px;"><strong>Phone:</strong> ${escapeHtml(c.customerPhone || '—')}</p>
          <p style="margin: 3px 0; font-size: 13px;"><strong>Service Area:</strong> ${escapeHtml(c.customerArea || 'Shahdara')}</p>
        </div>
        <div>
          <p style="margin: 3px 0; font-size: 13px;"><strong>Dispute Category:</strong> ${escapeHtml(c.categoryLabel)}</p>
          <p style="margin: 3px 0; font-size: 13px;"><strong>Category (Urdu):</strong> <span dir="rtl">${escapeHtml(c.categoryLabelUrdu)}</span></p>
          <p style="margin: 3px 0; font-size: 13px;"><strong>Filing Date:</strong> ${escapeHtml((c.createdAt || '').slice(0, 10))}</p>
          <p style="margin: 3px 0; font-size: 13px;"><strong>Evidence Reference:</strong> ${escapeHtml(c.evidenceRef || 'None on file')}</p>
        </div>
      </div>

      <div style="margin-bottom: 16px;">
        <h4 style="margin: 0 0 6px 0; font-size: 14px; border-bottom: 1px solid #ddd; padding-bottom: 4px;">1. Claim Grounds &amp; Subscriber Statement</h4>
        <p style="margin: 4px 0; font-size: 13px; background: #fff; border: 1px solid #e5e7eb; padding: 10px; border-radius: 6px;">${escapeHtml(c.reason)}</p>
      </div>

      <div style="margin-bottom: 16px;">
        <h4 style="margin: 0 0 6px 0; font-size: 14px; border-bottom: 1px solid #ddd; padding-bottom: 4px;">2. Financial Audit &amp; Settlement Adjustment</h4>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr style="background: #f3f4f6;">
              <th style="border: 1px solid #d1d5db; padding: 6px 10px; text-align: left;">Audit Metric</th>
              <th style="border: 1px solid #d1d5db; padding: 6px 10px; text-align: right;">Amount (PKR)</th>
              <th style="border: 1px solid #d1d5db; padding: 6px 10px; text-align: left;">Remarks</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="border: 1px solid #d1d5db; padding: 6px 10px;">Ledger Outstanding Prior to Claim</td>
              <td style="border: 1px solid #d1d5db; padding: 6px 10px; text-align: right;">PKR ${Number(c.previousBalance || 0).toLocaleString()}</td>
              <td style="border: 1px solid #d1d5db; padding: 6px 10px;">Recorded ledger arrears</td>
            </tr>
            <tr>
              <td style="border: 1px solid #d1d5db; padding: 6px 10px;">Disputed Amount Claimed</td>
              <td style="border: 1px solid #d1d5db; padding: 6px 10px; text-align: right; color: #b91c1c;">PKR ${Number(c.disputedAmount || 0).toLocaleString()}</td>
              <td style="border: 1px solid #d1d5db; padding: 6px 10px;">Submitted by subscriber</td>
            </tr>
            <tr style="background: #f0fdf4;">
              <td style="border: 1px solid #d1d5db; padding: 6px 10px; font-weight: bold;">Approved Ledger Credit Adjustment</td>
              <td style="border: 1px solid #d1d5db; padding: 6px 10px; text-align: right; font-weight: bold; color: #047857;">PKR ${Number(c.approvedAmount || 0).toLocaleString()}</td>
              <td style="border: 1px solid #d1d5db; padding: 6px 10px;">Credit applied to ledger</td>
            </tr>
            <tr style="background: #fefce8;">
              <td style="border: 1px solid #d1d5db; padding: 6px 10px; font-weight: bold;">Net Remaining Payable Balance</td>
              <td style="border: 1px solid #d1d5db; padding: 6px 10px; text-align: right; font-weight: bold;">PKR ${Number(c.projectedBalance || 0).toLocaleString()}</td>
              <td style="border: 1px solid #d1d5db; padding: 6px 10px;">Updated dues payable</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style="margin-bottom: 20px;">
        <h4 style="margin: 0 0 6px 0; font-size: 14px; border-bottom: 1px solid #ddd; padding-bottom: 4px;">3. Audit Findings &amp; Resolution Order</h4>
        <p style="margin: 4px 0; font-size: 13px; background: #fff; border: 1px solid #e5e7eb; padding: 10px; border-radius: 6px;">
          ${escapeHtml(c.resolutionNotes || 'Claim assessed against network logs, physical collector scrolls, and OLT session records.')}
        </p>
      </div>

      <div style="display: flex; justify-content: space-between; margin-top: 40px; padding-top: 10px;">
        <div style="border-top: 1px solid #444; width: 220px; text-align: center; font-size: 12px;">
          Subscriber Acceptance Signature<br>
          <span style="color: #666; font-size: 11px;">(دستخط صارف / کسٹمر)</span>
        </div>
        <div style="border-top: 1px solid #444; width: 220px; text-align: center; font-size: 12px;">
          Accounts Officer / Manager Sign<br>
          <span style="color: #666; font-size: 11px;">${escapeHtml(c.resolvedBy || 'Saad Accounting')}</span>
        </div>
      </div>
    </div>
  `;
}

export function setupDisputeClaimModal({
  getState,
  onApplyLedgerCredit,
  onToast,
  storage
} = {}) {
  if (typeof document === 'undefined') {
    return {
      open: () => {},
      close: () => {},
      refresh: () => {},
      getClaims: () => []
    };
  }

  const modal = document.getElementById('customerDisputeModal');
  if (!modal) {
    return {
      open: () => {},
      close: () => {},
      refresh: () => {},
      getClaims: () => []
    };
  }

  const closeBtn = document.getElementById('closeDisputeModalBtn');
  const closeSecondaryBtn = document.getElementById('closeDisputeSecondaryBtn');
  const custNameEl = document.getElementById('disputeCustName');
  const custPhoneEl = document.getElementById('disputeCustPhone');
  const custBalanceEl = document.getElementById('disputeCustBalance');

  const categorySelect = document.getElementById('disputeCategorySelect');
  const billMonthSelect = document.getElementById('disputeBillMonthSelect');
  const amountInput = document.getElementById('disputeAmountInput');
  const claimedDateInput = document.getElementById('disputeClaimedDateInput');
  const evidenceInput = document.getElementById('disputeEvidenceInput');
  const reasonInput = document.getElementById('disputeReasonInput');
  const filedByInput = document.getElementById('disputeFiledByInput');
  const statusSelect = document.getElementById('disputeStatusSelect');
  const approvedAmountInput = document.getElementById('disputeApprovedAmountInput');
  const resolutionNotesInput = document.getElementById('disputeResolutionNotesInput');
  const resolvedByInput = document.getElementById('disputeResolvedByInput');

  const prevTicketEl = document.getElementById('disputePreviewTicket');
  const prevCreditEl = document.getElementById('disputePreviewCredit');
  const prevNetBalEl = document.getElementById('disputePreviewNetBal');
  const prevRecEl = document.getElementById('disputePreviewRecommendation');

  const submitBtn = document.getElementById('submitDisputeClaimBtn');
  const printA4Btn = document.getElementById('printDisputeA4Btn');
  const printSlipBtn = document.getElementById('printDisputeSlipBtn');
  const whatsappBtn = document.getElementById('whatsappDisputeBtn');
  const exportCsvBtn = document.getElementById('exportDisputeCsvBtn');
  const historyTbody = document.getElementById('disputeHistoryTableBody');

  let currentCustomer = null;
  let activeClaim = null;

  function recalculatePreview() {
    if (!currentCustomer) return;
    const cat = categorySelect ? categorySelect.value : 'unrecorded_payment';
    const disAmt = amountInput ? Number(amountInput.value) || 0 : 0;

    let appAmt = approvedAmountInput ? Number(approvedAmountInput.value) : 0;
    if (statusSelect && statusSelect.value === 'APPROVED_FULL') {
      appAmt = disAmt;
      if (approvedAmountInput) approvedAmountInput.value = disAmt;
    } else if (statusSelect && statusSelect.value === 'REJECTED') {
      appAmt = 0;
      if (approvedAmountInput) approvedAmountInput.value = 0;
    }

    const assessment = assessDisputeClaim({
      category: cat,
      disputedAmount: disAmt,
      approvedAmount: appAmt
    }, currentCustomer);

    if (prevCreditEl) prevCreditEl.textContent = `PKR ${assessment.approvedAmount.toLocaleString()}`;
    if (prevNetBalEl) prevNetBalEl.textContent = `PKR ${assessment.netProjectedBalance.toLocaleString()}`;
    if (prevRecEl) prevRecEl.textContent = assessment.recommendation;

    return assessment;
  }

  function renderHistory() {
    if (!historyTbody) return;
    const claims = currentCustomer
      ? getSavedDisputeClaims(storage, currentCustomer.id)
      : getSavedDisputeClaims(storage);

    if (!claims.length) {
      historyTbody.innerHTML = '<tr><td colspan="7" class="text-center empty-muted">No dispute claims recorded for this subscriber yet.</td></tr>';
      return;
    }

    historyTbody.innerHTML = claims.map(c => `
      <tr data-dispute-ticket="${escapeHtml(c.ticketNumber)}">
        <td class="font-mono font-bold">${escapeHtml(c.ticketNumber)}</td>
        <td>${escapeHtml((c.createdAt || '').slice(0, 10))}</td>
        <td>${escapeHtml(c.categoryLabel)}</td>
        <td class="text-right">PKR ${Number(c.disputedAmount || 0).toLocaleString()}</td>
        <td class="text-right font-bold" style="color: #047857;">PKR ${Number(c.approvedAmount || 0).toLocaleString()}</td>
        <td class="text-center"><span class="role-badge ${c.status && c.status.startsWith('APPROVED') ? 'role-primary' : c.status === 'REJECTED' ? 'role-danger' : 'role-warn'}">${escapeHtml(c.status)}</span></td>
        <td class="text-center">
          <button type="button" class="action-btn-sm" data-action="print-a4" data-ticket="${escapeHtml(c.ticketNumber)}">A4</button>
          <button type="button" class="action-btn-sm" data-action="print-slip" data-ticket="${escapeHtml(c.ticketNumber)}">Slip</button>
          <button type="button" class="action-btn-sm" data-action="wa-ticket" data-ticket="${escapeHtml(c.ticketNumber)}">WhatsApp</button>
        </td>
      </tr>
    `).join('');
  }

  function open(customer) {
    currentCustomer = customer || null;
    activeClaim = null;

    if (custNameEl) custNameEl.textContent = customer?.name || 'Customer Profile';
    if (custPhoneEl) custPhoneEl.textContent = customer?.phone || 'No phone';

    let bal = 0;
    if (customer && Array.isArray(customer.bills)) {
      for (const b of customer.bills) {
        const d = Number(b.dueAmount) || 0;
        if (d > 0 && b.status !== 'paid') bal += d;
      }
    }
    if (custBalanceEl) custBalanceEl.textContent = `PKR ${bal.toLocaleString()}`;

    if (billMonthSelect) {
      billMonthSelect.innerHTML = '<option value="">All / Entire Ledger</option>';
      if (customer && Array.isArray(customer.bills)) {
        customer.bills.forEach(b => {
          const opt = document.createElement('option');
          opt.value = b.month || b.billingMonth || '';
          opt.textContent = `${b.month || b.billingMonth || 'Month'} (Due: PKR ${Number(b.dueAmount || 0).toLocaleString()})`;
          billMonthSelect.appendChild(opt);
        });
      }
    }

    if (amountInput) amountInput.value = bal > 0 ? bal : 1500;
    if (claimedDateInput) claimedDateInput.value = new Date().toISOString().slice(0, 10);
    if (reasonInput) reasonInput.value = '';
    if (evidenceInput) evidenceInput.value = '';
    if (resolutionNotesInput) resolutionNotesInput.value = '';

    const allClaims = getSavedDisputeClaims(storage);
    const d = new Date();
    const seq = String(allClaims.length + 1).padStart(4, '0');
    if (prevTicketEl) prevTicketEl.textContent = `DSP-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}-${seq}`;

    recalculatePreview();
    renderHistory();

    triggerHaptic('medium');
    if (typeof modal.showModal === 'function') modal.showModal();
    else modal.setAttribute('open', '');
  }

  function close() {
    if (typeof modal.close === 'function') modal.close();
    else modal.removeAttribute('open');
  }

  [categorySelect, amountInput, statusSelect, approvedAmountInput].forEach(inp => {
    if (inp && !inp.dataset?.wiredDispute) {
      if (inp.dataset) inp.dataset.wiredDispute = 'true';
      inp.addEventListener('input', recalculatePreview);
      inp.addEventListener('change', recalculatePreview);
    }
  });

  if (historyTbody && !historyTbody.dataset?.wiredDispute) {
    if (historyTbody.dataset) historyTbody.dataset.wiredDispute = 'true';
    historyTbody.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const act = btn.getAttribute('data-action');
      const ticket = btn.getAttribute('data-ticket');
      const claim = getSavedDisputeClaims(storage).find(c => c.ticketNumber === ticket);
      if (!claim) return;

      if (act === 'print-a4') {
        printDisputeDoc(claim, 'a4');
      } else if (act === 'print-slip') {
        printDisputeDoc(claim, 'slip');
      } else if (act === 'wa-ticket') {
        const text = formatDisputeClaimWhatsApp(claim);
        const url = formatWhatsAppUrl(claim.customerPhone, text);
        if (typeof window !== 'undefined' && typeof window.open === 'function') {
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      }
    });
  }

  function printDisputeDoc(claim, fmt) {
    const html = generateDisputeClaimHtml(claim, { format: fmt });
    const printWindow = window.open('', '_blank', 'width=800,height=700');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>${claim.ticketNumber} - Dispute Settlement</title>
          <style>
            @media print { body { margin: 0; } }
            body { margin: 20px; font-family: sans-serif; }
          </style>
        </head>
        <body>
          ${html}
          <script>window.onload = function() { window.print(); };<\/script>
        </body>
        </html>
      `);
      printWindow.document.close();
    }
  }

  if (submitBtn && !submitBtn.dataset?.wiredDispute) {
    if (submitBtn.dataset) submitBtn.dataset.wiredDispute = 'true';
    submitBtn.addEventListener('click', () => {
      if (!currentCustomer) {
        if (typeof onToast === 'function') onToast('Please select a customer first.');
        return;
      }

      const validation = validateDisputeClaim({
        customerId: currentCustomer.id,
        category: categorySelect?.value,
        disputedAmount: amountInput?.value,
        reason: reasonInput?.value,
        filedBy: filedByInput?.value
      });

      if (!validation.isValid) {
        const firstErr = Object.values(validation.errors)[0];
        if (typeof onToast === 'function') onToast(`Validation Error: ${firstErr}`);
        return;
      }

      const allClaims = getSavedDisputeClaims(storage);
      const claim = buildDisputeClaimRecord({
        customer: currentCustomer,
        category: categorySelect.value,
        disputedAmount: Number(amountInput.value),
        approvedAmount: approvedAmountInput ? Number(approvedAmountInput.value) : null,
        reason: reasonInput.value,
        filedBy: filedByInput ? filedByInput.value : 'Customer',
        status: statusSelect ? statusSelect.value : 'SUBMITTED',
        resolvedBy: resolvedByInput ? resolvedByInput.value : 'Saad Accounting',
        resolutionNotes: resolutionNotesInput ? resolutionNotesInput.value : '',
        billMonth: billMonthSelect ? billMonthSelect.value : '',
        claimedDate: claimedDateInput ? claimedDateInput.value : '',
        evidenceRef: evidenceInput ? evidenceInput.value : '',
        existingClaimsCount: allClaims.length
      });

      saveDisputeClaim(claim, storage);
      activeClaim = claim;

      if (typeof onApplyLedgerCredit === 'function' && claim.status && claim.status.startsWith('APPROVED') && claim.approvedAmount > 0) {
        onApplyLedgerCredit(claim);
      }

      triggerHaptic('success');
      renderHistory();
      if (typeof onToast === 'function') onToast(`Dispute ticket ${claim.ticketNumber} saved successfully.`);
    });
  }

  if (printA4Btn && !printA4Btn.dataset?.wiredDispute) {
    if (printA4Btn.dataset) printA4Btn.dataset.wiredDispute = 'true';
    printA4Btn.addEventListener('click', () => {
      const claim = activeClaim || (currentCustomer ? getSavedDisputeClaims(storage, currentCustomer.id)[0] : null);
      if (!claim) {
        if (typeof onToast === 'function') onToast('Submit or select a dispute claim first to print.');
        return;
      }
      printDisputeDoc(claim, 'a4');
    });
  }

  if (printSlipBtn && !printSlipBtn.dataset?.wiredDispute) {
    if (printSlipBtn.dataset) printSlipBtn.dataset.wiredDispute = 'true';
    printSlipBtn.addEventListener('click', () => {
      const claim = activeClaim || (currentCustomer ? getSavedDisputeClaims(storage, currentCustomer.id)[0] : null);
      if (!claim) {
        if (typeof onToast === 'function') onToast('Submit or select a dispute claim first to print.');
        return;
      }
      printDisputeDoc(claim, 'slip');
    });
  }

  if (whatsappBtn && !whatsappBtn.dataset?.wiredDispute) {
    if (whatsappBtn.dataset) whatsappBtn.dataset.wiredDispute = 'true';
    whatsappBtn.addEventListener('click', () => {
      const claim = activeClaim || (currentCustomer ? getSavedDisputeClaims(storage, currentCustomer.id)[0] : null);
      if (!claim) {
        if (typeof onToast === 'function') onToast('Submit or select a dispute claim first for WhatsApp.');
        return;
      }
      const text = formatDisputeClaimWhatsApp(claim);
      const url = formatWhatsAppUrl(claim.customerPhone, text);
      if (typeof window !== 'undefined' && typeof window.open === 'function') {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    });
  }

  if (exportCsvBtn && !exportCsvBtn.dataset?.wiredDispute) {
    if (exportCsvBtn.dataset) exportCsvBtn.dataset.wiredDispute = 'true';
    exportCsvBtn.addEventListener('click', () => {
      const all = getSavedDisputeClaims(storage);
      if (!all.length) {
        if (typeof onToast === 'function') onToast('No dispute claims found to export.');
        return;
      }
      const csv = generateDisputeClaimsCsv(all);
      const filename = `shahdara_billing_disputes_${new Date().toISOString().slice(0, 10)}.csv`;
      downloadCsvFile(filename, csv);
      if (typeof onToast === 'function') onToast('Billing disputes CSV downloaded.');
    });
  }

  if (closeBtn && !closeBtn.dataset?.wiredDispute) {
    if (closeBtn.dataset) closeBtn.dataset.wiredDispute = 'true';
    closeBtn.addEventListener('click', close);
  }
  if (closeSecondaryBtn && !closeSecondaryBtn.dataset?.wiredDispute) {
    if (closeSecondaryBtn.dataset) closeSecondaryBtn.dataset.wiredDispute = 'true';
    closeSecondaryBtn.addEventListener('click', close);
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });

  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  });

  return {
    open,
    close,
    refresh: () => {
      recalculatePreview();
      renderHistory();
    },
    getClaims: (cid = null) => getSavedDisputeClaims(storage, cid)
  };
}

/**
 * Computes aggregated executive metrics and statistics across dispute claims.
 * @param {Array<Object>} claims
 * @returns {Object}
 */
export function exportDisputeClaimsSummaryStats(claims = []) {
  const safeList = Array.isArray(claims) ? claims : [];
  let totalDisputedAmount = 0;
  let totalApprovedAmount = 0;
  let pendingCount = 0;
  let approvedCount = 0;
  let rejectedCount = 0;
  const categoryBreakdown = {};
  const statusCounts = {
    SUBMITTED: 0,
    UNDER_INVESTIGATION: 0,
    APPROVED_FULL: 0,
    APPROVED_PARTIAL: 0,
    REJECTED: 0
  };

  safeList.forEach(c => {
    const disputed = Number(c.disputedAmount) || 0;
    const approved = Number(c.approvedAmount) || 0;
    totalDisputedAmount += disputed;
    totalApprovedAmount += approved;

    const cat = c.category || 'other';
    categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;

    const status = c.status || 'SUBMITTED';
    if (Object.prototype.hasOwnProperty.call(statusCounts, status)) {
      statusCounts[status]++;
    } else {
      statusCounts[status] = 1;
    }

    if (status === 'SUBMITTED' || status === 'UNDER_INVESTIGATION') {
      pendingCount++;
    } else if (status === 'APPROVED_FULL' || status === 'APPROVED_PARTIAL') {
      approvedCount++;
    } else if (status === 'REJECTED') {
      rejectedCount++;
    }
  });

  const recoveryRate = totalDisputedAmount > 0
    ? Math.round((totalApprovedAmount / totalDisputedAmount) * 1000) / 10
    : 0;

  return {
    totalClaims: safeList.length,
    totalDisputedAmount,
    totalApprovedAmount,
    pendingCount,
    approvedCount,
    rejectedCount,
    statusCounts,
    categoryBreakdown,
    recoveryRate
  };
}

/**
 * Filters dispute claims according to criteria (status, category, text search).
 * @param {Array<Object>} claims
 * @param {Object} [filters]
 * @returns {Array<Object>}
 */
export function filterDisputeClaims(claims = [], { status = 'all', category = 'all', search = '' } = {}) {
  const safeList = Array.isArray(claims) ? claims : [];
  const normalizedSearch = String(search || '').trim().toLowerCase();

  return safeList.filter(claim => {
    if (status && status !== 'all' && claim.status !== status) {
      return false;
    }
    if (category && category !== 'all' && claim.category !== category) {
      return false;
    }
    if (normalizedSearch) {
      const matchTicket = String(claim.ticketNumber || '').toLowerCase().includes(normalizedSearch);
      const matchName = String(claim.customerName || '').toLowerCase().includes(normalizedSearch);
      const matchPhone = String(claim.customerPhone || '').toLowerCase().includes(normalizedSearch);
      const matchReason = String(claim.reason || '').toLowerCase().includes(normalizedSearch);
      if (!matchTicket && !matchName && !matchPhone && !matchReason) {
        return false;
      }
    }
    return true;
  });
}

