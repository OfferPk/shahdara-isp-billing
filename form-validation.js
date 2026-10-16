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

/* ==========================================================================
   Subscriber KYC Identity Verification & PTA Regulatory Compliance Audit (agent3)
   ========================================================================== */

export const PAKISTAN_CNIC_PROVINCES = {
  '1': 'Khyber Pakhtunkhwa (KPK)',
  '2': 'FATA (Merged Districts)',
  '3': 'Punjab (Lahore / Shahdara)',
  '4': 'Sindh',
  '5': 'Balochistan',
  '6': 'Islamabad (ICT)',
  '7': 'Gilgit-Baltistan / AJK'
};

/**
 * Parses detailed metadata from a 13-digit Pakistani CNIC number.
 * @param {string} cnic
 * @returns {{ valid: boolean, formatted: string, raw: string, province: string, gender: string, error?: string }}
 */
export function parsePakistaniCnicDetails(cnic) {
  if (!cnic || typeof cnic !== 'string' || !cnic.trim()) {
    return {
      valid: false,
      formatted: '',
      raw: '',
      provinceCode: '',
      province: 'Unknown',
      provinceName: 'Unknown',
      genderCode: '',
      gender: 'Unspecified',
      error: 'CNIC number is missing or not provided.',
      reason: 'No CNIC provided'
    };
  }

  const clean = cnic.replace(/[^0-9]/g, '');
  if (clean.length !== 13) {
    return {
      valid: false,
      formatted: cnic.trim(),
      raw: clean,
      provinceCode: clean[0] || '',
      province: 'Unknown',
      provinceName: 'Unknown',
      genderCode: '',
      gender: 'Unspecified',
      error: `CNIC must contain exactly 13 digits (found ${clean.length}).`,
      reason: `CNIC must contain exactly 13 numeric digits (found ${clean.length}).`
    };
  }

  const provinceCode = clean[0];
  const province = PAKISTAN_CNIC_PROVINCES[provinceCode];
  if (!province) {
    return {
      valid: false,
      formatted: cnic.trim(),
      raw: clean,
      provinceCode,
      province: 'Unknown',
      provinceName: 'Unknown',
      genderCode: clean[12],
      gender: 'Unspecified',
      error: `Invalid province identifier code '${provinceCode}' in CNIC.`,
      reason: `Invalid province identifier code '${provinceCode}' in CNIC.`
    };
  }

  const lastDigit = Number(clean[12]);
  const gender = lastDigit % 2 !== 0 ? 'Male' : 'Female';
  const formatted = `${clean.slice(0, 5)}-${clean.slice(5, 12)}-${clean.slice(12, 13)}`;

  return {
    valid: true,
    formatted,
    raw: clean,
    provinceCode,
    province,
    provinceName: province,
    genderCode: String(lastDigit),
    gender,
    error: null,
    reason: null
  };
}

/**
 * Calculates network-wide subscriber KYC identity verification and regulatory PTA compliance.
 * @param {Object} state - Application state
 * @param {Object} [options]
 * @returns {Object} Complete KYC audit summary object
 */
export function calculateKycComplianceAudit(state, options = {}) {
  const customers = Array.isArray(state?.customers) ? state.customers : [];
  const includeArchived = Boolean(options.includeArchived);
  const activeCustomers = includeArchived ? customers : customers.filter(c => !c.archived);
  const nowStr = options.dateStr || new Date().toISOString().slice(0, 10);

  const cnicCounts = new Map();
  activeCustomers.forEach(cust => {
    const rawCnic = cust.cnic || cust.contractCnic;
    if (rawCnic && typeof rawCnic === 'string') {
      const clean = rawCnic.replace(/\D/g, '');
      if (clean.length === 13) {
        cnicCounts.set(clean, (cnicCounts.get(clean) || 0) + 1);
      }
    }
  });

  let verifiedCount = 0;
  let missingCount = 0;
  let invalidCount = 0;
  let duplicateCount = 0;

  const provinceCounts = {
    Punjab: 0,
    Sindh: 0,
    KPK: 0,
    Balochistan: 0,
    ICT: 0,
    Other: 0,
    Unknown: 0
  };

  const genderCounts = {
    Male: 0,
    Female: 0,
    Unspecified: 0
  };

  const records = activeCustomers.map((cust, idx) => {
    const rawCnic = cust.cnic || cust.contractCnic || '';
    const details = parsePakistaniCnicDetails(rawCnic);
    let status = 'VERIFIED';
    let statusLabel = 'Verified (PTA Compliant)';
    let discrepancyNote = '';

    if (!rawCnic || !rawCnic.trim()) {
      status = 'MISSING_CNIC';
      statusLabel = 'Missing CNIC';
      discrepancyNote = 'No CNIC identity card recorded on subscriber profile.';
      missingCount++;
      provinceCounts.Unknown++;
      genderCounts.Unspecified++;
    } else if (!details.valid) {
      status = 'INVALID_FORMAT';
      statusLabel = 'Invalid CNIC';
      discrepancyNote = details.error || details.reason || 'CNIC format invalid.';
      invalidCount++;
      provinceCounts.Unknown++;
      genderCounts.Unspecified++;
    } else if (cnicCounts.get(details.raw) > 1) {
      status = 'DUPLICATE_CNIC';
      statusLabel = 'Duplicate CNIC';
      discrepancyNote = `CNIC ${details.formatted} is shared across ${cnicCounts.get(details.raw)} active subscriptions.`;
      duplicateCount++;
      if (details.province.includes('Punjab')) provinceCounts.Punjab++;
      else if (details.province.includes('Sindh')) provinceCounts.Sindh++;
      else if (details.province.includes('KPK') || details.province.includes('FATA')) provinceCounts.KPK++;
      else if (details.province.includes('Balochistan')) provinceCounts.Balochistan++;
      else if (details.province.includes('Islamabad')) provinceCounts.ICT++;
      else provinceCounts.Other++;
      if (details.gender === 'Male') genderCounts.Male++;
      else genderCounts.Female++;
    } else {
      status = 'VERIFIED';
      statusLabel = 'Verified';
      verifiedCount++;
      if (details.province.includes('Punjab')) provinceCounts.Punjab++;
      else if (details.province.includes('Sindh')) provinceCounts.Sindh++;
      else if (details.province.includes('KPK') || details.province.includes('FATA')) provinceCounts.KPK++;
      else if (details.province.includes('Balochistan')) provinceCounts.Balochistan++;
      else if (details.province.includes('Islamabad')) provinceCounts.ICT++;
      else provinceCounts.Other++;
      if (details.gender === 'Male') genderCounts.Male++;
      else genderCounts.Female++;
    }

    const cleanPhone = String(cust.phone || '').replace(/\D/g, '');
    const intlPhone = cleanPhone.startsWith('92') ? cleanPhone : `92${cleanPhone.replace(/^0/, '')}`;
    const rawPhone = String(cust.phone || '').trim();
    const phoneUrl = rawPhone ? `tel:${rawPhone.startsWith('+') ? rawPhone : '+92' + (cleanPhone.startsWith('92') ? cleanPhone.slice(2) : cleanPhone.replace(/^0/, ''))}` : '';

    return {
      serialNumber: idx + 1,
      id: cust.id,
      customerId: cust.id,
      customerNumber: cust.customerNumber ?? (idx + 1),
      name: String(cust.name || 'Subscriber').trim(),
      username: String(cust.username || cust.id).trim(),
      phone: rawPhone,
      phoneUrl,
      whatsappIntlPhone: intlPhone,
      area: String(cust.area || cust.mohalla || 'Shahdara Town').trim(),
      mohalla: String(cust.mohalla || cust.area || 'Shahdara Town').trim(),
      address: String(cust.address || cust.mohalla || 'Shahdara Lahore').trim(),
      cnic: rawCnic ? (details.valid ? details.formatted : rawCnic.trim()) : '',
      formattedCnic: details.valid ? details.formatted : (rawCnic ? rawCnic.trim() : 'NOT_RECORDED'),
      cleanCnic: details.raw,
      isValidCnic: details.valid,
      isDuplicate: cnicCounts.get(details.raw) > 1,
      province: details.province,
      provinceName: details.provinceName || details.province,
      gender: details.gender,
      status,
      statusLabel,
      discrepancyNote,
      reason: discrepancyNote || (details.valid ? 'Valid CNIC' : details.reason)
    };
  });

  const totalSubscribers = activeCustomers.length;
  const complianceRate = totalSubscribers > 0 ? Number(((verifiedCount / totalSubscribers) * 100).toFixed(1)) : 100;

  let riskLevel = 'LOW_RISK';
  let riskBadge = 'PTA Compliant (Low Regulatory Risk)';
  if (complianceRate < 75) {
    riskLevel = 'HIGH_RISK';
    riskBadge = 'Critical Non-Compliance (License Audit Risk)';
  } else if (complianceRate < 90) {
    riskLevel = 'MODERATE_RISK';
    riskBadge = 'Attention Required (Notice Issued)';
  }

  const sectorSet = new Set(['All']);
  records.forEach(r => {
    if (r.area) sectorSet.add(r.area);
    if (r.mohalla) sectorSet.add(r.mohalla);
  });
  const sectors = Array.from(sectorSet).sort();

  return {
    auditDate: nowStr,
    generatedAt: new Date().toISOString(),
    totalSubscribers,
    totalAudited: totalSubscribers,
    verifiedCount,
    compliantCount: verifiedCount,
    missingCount,
    invalidCount,
    duplicateCount,
    attentionRequiredCount: missingCount + invalidCount + duplicateCount,
    complianceRate,
    riskLevel,
    riskBadge,
    riskLabel: riskBadge,
    provinceCounts,
    provinces: provinceCounts,
    genderCounts,
    genderCount: genderCounts,
    sectors,
    records
  };
}

/**
 * Filters KYC compliance records by status, sector, and search query.
 * @param {Array<Object>} records
 * @param {Object} [filters]
 * @returns {Array<Object>}
 */
export function filterKycComplianceRecords(records = [], { status = 'all', sector = 'All', search = '' } = {}) {
  const safeList = Array.isArray(records) ? records : [];
  const normalizedSearch = String(search || '').trim().toLowerCase();
  const normalizedSector = String(sector || 'All').trim().toLowerCase();
  const rawStatus = String(status || 'all').trim();
  const normalizedStatus = rawStatus.toUpperCase();

  return safeList.filter(rec => {
    if (normalizedSector !== 'all') {
      const recArea = String(rec.area || rec.mohalla || '').toLowerCase();
      if (recArea !== normalizedSector) {
        return false;
      }
    }

    if (normalizedStatus === 'ATTENTION_REQUIRED') {
      if (rec.status === 'VERIFIED') return false;
    } else if (normalizedStatus !== 'ALL') {
      const recStatus = String(rec.status || '').toUpperCase();
      const statusMatches =
        recStatus === normalizedStatus ||
        (normalizedStatus === 'COMPLIANT' && recStatus === 'VERIFIED') ||
        (normalizedStatus === 'MISSING' && (recStatus === 'MISSING_CNIC' || recStatus === 'MISSING')) ||
        (normalizedStatus === 'INVALID' && (recStatus === 'INVALID_FORMAT' || recStatus === 'INVALID')) ||
        (normalizedStatus === 'DUPLICATE' && (recStatus === 'DUPLICATE_CNIC' || recStatus === 'DUPLICATE'));
      if (!statusMatches) return false;
    }

    if (normalizedSearch) {
      const matchName = String(rec.name || '').toLowerCase().includes(normalizedSearch);
      const matchUser = String(rec.username || '').toLowerCase().includes(normalizedSearch);
      const matchCnic = String(rec.cnic || '').toLowerCase().includes(normalizedSearch);
      const matchPhone = String(rec.phone || '').includes(normalizedSearch);
      const matchArea = String(rec.area || rec.mohalla || '').toLowerCase().includes(normalizedSearch);
      const matchId = String(rec.customerNumber || rec.customerId || '').toLowerCase().includes(normalizedSearch);
      if (!matchName && !matchUser && !matchCnic && !matchPhone && !matchArea && !matchId) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Builds formatted bilingual WhatsApp KYC verification reminder message.
 * @param {Object} customer
 * @returns {string} Formatted WhatsApp message string
 */
export function generateKycNoticeWhatsAppText(customer = {}) {
  if (!customer) return '';
  const name = customer.name || customer.customerName || 'Subscriber';
  const username = customer.username || '';
  const area = customer.area || 'Shahdara Town';

  let text = `🇵🇰 *پی ٹی اے بائیو میٹرک و شناختی تصدیقی نوٹس*\n`;
  text += `*PTA SUBSCRIBER IDENTITY VERIFICATION NOTICE*\n`;
  text += `─────────────────────────────────────────\n`;
  text += `محترم صارف *${name}* صاحب!\n`;
  if (username) text += `شاہدرہ فائبر نیٹ ورک کنکشن: *${username}* [${area}]\n`;
  text += `\n`;
  text += `پی ٹی اے (Pakistan Telecommunication Authority) اور الیکٹرانک جرائم کی روک تھام ایکٹ (PECA) کے تحت تمام فعال انٹرنیٹ کنکشنز کا نادرا شناختی کارڈ (CNIC) ریکارڈ میں تصدیق شدہ ہونا لازمی ہے۔\n\n`;
  text += `⚠️ *ضروری اطلاع:* آپ کے انٹرنیٹ کنکشن ریکارڈ میں شناختی کارڈ نمبر درج نہیں ہے یا تجدید طلب ہے۔\n\n`;
  text += `براہِ کرم بلاتعطل انٹرنیٹ سروس کے تسلسل کے لیے اپنا 13 ہندسی شناختی کارڈ نمبر یا شناختی کارڈ کی دونوں اطراف کی واضح تصویر بذریعہ واٹس ایپ فوری ارسال فرمائیں۔\n\n`;
  text += `شکریہ،\n`;
  text += `*انتظامیہ شاہدرہ فائبر براڈبینڈ نیٹ ورک*\n`;
  text += `📞 ہیلپ لائن: 0300-1234567 | 📍 مین بازار، شاہدرہ، لاہور`;

  return text;
}

/**
 * Generates RFC-4180 CSV compliance audit register with UTF-8 BOM.
 * @param {Object} auditData
 * @returns {string} CSV string
 */
export function generateKycComplianceCsv(auditData = {}) {
  if (!auditData) return '';
  const records = Array.isArray(auditData.records) ? auditData.records : [];
  const headers = [
    'Sr #',
    'Customer ID',
    'Subscriber Name',
    'Username',
    'Phone',
    'Area / Sector',
    'Street Address',
    'CNIC Number',
    'KYC Status',
    'Province',
    'Gender',
    'Discrepancy Notes'
  ];

  const escapeCell = (val) => {
    const s = String(val ?? '').replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = [headers.map(escapeCell).join(',')];
  records.forEach((r, idx) => {
    rows.push([
      escapeCell(idx + 1),
      escapeCell(r.id),
      escapeCell(r.name),
      escapeCell(r.username),
      escapeCell(r.phone),
      escapeCell(r.area || r.mohalla || ''),
      escapeCell(r.address),
      escapeCell(r.cnic),
      escapeCell(r.statusLabel),
      escapeCell(r.province),
      escapeCell(r.gender),
      escapeCell(r.discrepancyNote)
    ].join(','));
  });

  return '\uFEFF' + rows.join('\r\n');
}

/**
 * Generates formal printable regulatory KYC register for PTA audits.
 * @param {Object} auditData
 * @returns {string} HTML string
 */
export function generateKycCompliancePrintHtml(auditData = {}) {
  if (!auditData) return '';
  const date = auditData.auditDate || new Date().toISOString().slice(0, 10);
  const total = auditData.totalSubscribers ?? auditData.totalAudited ?? 0;
  const verified = auditData.verifiedCount ?? auditData.compliantCount ?? 0;
  const missing = auditData.missingCount ?? 0;
  const duplicate = auditData.duplicateCount ?? 0;
  const rate = auditData.complianceRate ?? 0;
  const records = Array.isArray(auditData.records) ? auditData.records : [];

  function esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  const rowsHtml = records.map((r, i) => `
    <tr>
      <td style="text-align: center;">${i + 1}</td>
      <td><strong>${esc(r.name)}</strong></td>
      <td style="font-family: monospace;">${esc(r.cnic || '—')}</td>
      <td>${esc(r.area || r.mohalla || '—')}</td>
      <td>${esc(r.phone)}</td>
      <td>${esc(r.province)} (${esc(r.gender)})</td>
      <td style="text-align: center; font-weight: bold; color: ${r.status === 'VERIFIED' ? '#047857' : '#b91c1c'};">${esc(r.statusLabel)}</td>
    </tr>
  `).join('');

  return `
    <div class="kyc-print-document" style="font-family: sans-serif; padding: 24px; color: #111;">
      <div style="border-bottom: 2px solid #0e5b4d; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <h1 style="margin: 0; font-size: 20px; color: #0e5b4d; text-transform: uppercase;">Shahdara Fiber Net — PTA Subscriber KYC Register</h1>
          <p style="margin: 4px 0 0; font-size: 13px; color: #555;">Regulatory Compliance Record under PTA Broadband Regulations &amp; PECA Identity Requirements</p>
        </div>
        <div style="text-align: right;">
          <strong style="font-size: 13px;">Date: ${esc(date)}</strong><br>
          <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; background: ${rate >= 90 ? '#d1fae5' : '#fee2e2'}; color: ${rate >= 90 ? '#065f46' : '#991b1b'};">
            ${esc(auditData.riskBadge || 'Audit Verified')}
          </span>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px;">
        <div style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 10px; border-radius: 6px;">
          <div style="font-size: 11px; color: #64748b; text-transform: uppercase;">Total Active Subscribers</div>
          <div style="font-size: 18px; font-weight: bold;">${total}</div>
        </div>
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 10px; border-radius: 6px;">
          <div style="font-size: 11px; color: #166534; text-transform: uppercase;">Verified CNIC Records</div>
          <div style="font-size: 18px; font-weight: bold; color: #166534;">${verified} (${rate}%)</div>
        </div>
        <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 10px; border-radius: 6px;">
          <div style="font-size: 11px; color: #991b1b; text-transform: uppercase;">Missing CNIC Cards</div>
          <div style="font-size: 18px; font-weight: bold; color: #991b1b;">${missing}</div>
        </div>
        <div style="background: #fffbeb; border: 1px solid #fde68a; padding: 10px; border-radius: 6px;">
          <div style="font-size: 11px; color: #92400e; text-transform: uppercase;">Duplicate / Multi-Line</div>
          <div style="font-size: 18px; font-weight: bold; color: #92400e;">${duplicate}</div>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
        <thead>
          <tr style="background: #0e5b4d; color: #fff;">
            <th style="padding: 6px 8px; border: 1px solid #0e5b4d;">#</th>
            <th style="padding: 6px 8px; border: 1px solid #0e5b4d; text-align: left;">Subscriber Name</th>
            <th style="padding: 6px 8px; border: 1px solid #0e5b4d; text-align: left;">CNIC Number</th>
            <th style="padding: 6px 8px; border: 1px solid #0e5b4d; text-align: left;">Area / Sector</th>
            <th style="padding: 6px 8px; border: 1px solid #0e5b4d; text-align: left;">Phone</th>
            <th style="padding: 6px 8px; border: 1px solid #0e5b4d; text-align: left;">Origin / Gender</th>
            <th style="padding: 6px 8px; border: 1px solid #0e5b4d; text-align: center;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <div style="margin-top: 40px; display: flex; justify-content: space-between; font-size: 12px; border-top: 1px solid #cbd5e1; padding-top: 16px;">
        <div>
          <strong>Certified by Network Operations Center (NOC):</strong><br>
          Shahdara Fiber Net Technical Lead
        </div>
        <div style="text-align: right;">
          <strong>Authorized Signature &amp; Stamp:</strong><br>
          ________________________________________
        </div>
      </div>
    </div>
  `;
}

/**
 * Interactive controller for `<dialog id="kycComplianceModal">`.
 */
export function setupKycComplianceModal({
  getState,
  onNavigateCustomer,
  onToast,
  clipboard = (typeof navigator !== 'undefined' ? navigator.clipboard : null)
} = {}) {
  if (typeof document === 'undefined') {
    return {
      recalculate: () => null,
      getAuditData: () => null,
      open: () => {},
      close: () => {},
      setState: () => {}
    };
  }

  const modal = document.getElementById('kycComplianceModal');
  if (!modal) {
    return {
      recalculate: () => null,
      getAuditData: () => null,
      open: () => {},
      close: () => {},
      setState: () => {}
    };
  }

  function esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  const closeBtn = document.getElementById('closeKycModalBtn');
  const sectorFilter = document.getElementById('kycSectorFilter');
  const statusFilter = document.getElementById('kycStatusFilter');
  const searchInput = document.getElementById('kycSearchInput');
  const tableBody = document.getElementById('kycTableBody');
  const emptyState = document.getElementById('kycEmptyState');

  const metricRate = document.getElementById('kycMetricRate');
  const metricVerified = document.getElementById('kycMetricVerified');
  const metricMissing = document.getElementById('kycMetricMissing');
  const metricDuplicates = document.getElementById('kycMetricDuplicates');

  const copyBtn = document.getElementById('copyKycStatementBtn');
  const downloadCsvBtn = document.getElementById('downloadKycCsvBtn');
  const printBtn = document.getElementById('printKycRegisterBtn');
  const openBtns = Array.from(document.querySelectorAll('[data-open-kyc-audit], #openKycAuditBtn'));

  let currentState = typeof getState === 'function' ? getState() : null;
  let lastAuditData = null;

  function updateUi() {
    currentState = typeof getState === 'function' ? getState() : currentState;
    const auditData = calculateKycComplianceAudit(currentState);
    lastAuditData = auditData;

    if (metricRate) metricRate.textContent = `${auditData.complianceRate}%`;
    if (metricVerified) metricVerified.textContent = String(auditData.verifiedCount);
    if (metricMissing) metricMissing.textContent = String(auditData.missingCount);
    if (metricDuplicates) metricDuplicates.textContent = String(auditData.duplicateCount);

    if (sectorFilter && auditData.sectors) {
      const currentVal = sectorFilter.value;
      const opts = auditData.sectors.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
      if (sectorFilter.dataset.lastSectors !== JSON.stringify(auditData.sectors)) {
        sectorFilter.innerHTML = opts;
        sectorFilter.dataset.lastSectors = JSON.stringify(auditData.sectors);
        if (auditData.sectors.includes(currentVal)) {
          sectorFilter.value = currentVal;
        } else {
          sectorFilter.value = 'All';
        }
      }
    }

    const filtered = filterKycComplianceRecords(auditData.records, {
      sector: sectorFilter?.value || 'All',
      status: statusFilter?.value || 'ATTENTION_REQUIRED',
      search: searchInput?.value || ''
    });

    if (tableBody) {
      tableBody.innerHTML = '';
      if (filtered.length === 0) {
        if (emptyState) emptyState.hidden = false;
      } else {
        if (emptyState) emptyState.hidden = true;
        filtered.forEach((rec, idx) => {
          const row = document.createElement('tr');
          const statusBadge = rec.status === 'VERIFIED'
            ? '<span class="role-badge role-primary">✅ Verified</span>'
            : rec.status === 'DUPLICATE_CNIC'
            ? '<span class="role-badge badge-warning">🟠 Duplicate</span>'
            : rec.status === 'INVALID_FORMAT'
            ? '<span class="role-badge badge-warning">🟡 Invalid</span>'
            : '<span class="role-badge role-alert">🔴 Missing</span>';

          const noticeText = encodeURIComponent(generateKycNoticeWhatsAppText(rec));
          const whatsappNoticeUrl = `https://wa.me/${rec.whatsappIntlPhone}?text=${noticeText}`;

          row.innerHTML = `
            <td class="text-center font-mono">${idx + 1}</td>
            <td>
              <strong class="kyc-row-name">${esc(rec.name)}</strong>
              ${rec.username ? `<span class="kyc-row-user">@${esc(rec.username)}</span>` : ''}
              ${rec.discrepancyNote ? `<div class="kyc-row-discrepancy">${esc(rec.discrepancyNote)}</div>` : ''}
            </td>
            <td class="font-mono">${esc(rec.cnic || '—')}</td>
            <td>${esc(rec.area)}</td>
            <td class="font-mono">${esc(rec.phone || '—')}</td>
            <td><span class="kyc-row-origin">${esc(rec.province)}</span><span class="kyc-row-gender">${esc(rec.gender)}</span></td>
            <td class="text-center">${statusBadge}</td>
            <td class="text-center kyc-actions-cell">
              ${rec.status !== 'VERIFIED' && rec.whatsappIntlPhone ? `<a href="${whatsappNoticeUrl}" target="_blank" rel="noopener noreferrer" class="action-btn-sm" title="Send WhatsApp KYC verification notice">💬 WhatsApp</a>` : ''}
              <button type="button" class="action-btn-sm" data-kyc-profile="${esc(rec.id)}">Profile</button>
            </td>
          `;
          tableBody.appendChild(row);
        });
      }
    }

    return auditData;
  }

  if (sectorFilter && !sectorFilter.dataset?.wiredKyc) {
    if (sectorFilter.dataset) sectorFilter.dataset.wiredKyc = 'true';
    sectorFilter.addEventListener('change', updateUi);
  }

  if (statusFilter && !statusFilter.dataset?.wiredKyc) {
    if (statusFilter.dataset) statusFilter.dataset.wiredKyc = 'true';
    statusFilter.addEventListener('change', updateUi);
  }

  if (searchInput && !searchInput.dataset?.wiredKyc) {
    if (searchInput.dataset) searchInput.dataset.wiredKyc = 'true';
    searchInput.addEventListener('input', updateUi);
  }

  if (tableBody && !tableBody.dataset?.wiredKyc) {
    if (tableBody.dataset) tableBody.dataset.wiredKyc = 'true';
    tableBody.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-kyc-profile]');
      if (btn) {
        const custId = btn.getAttribute('data-kyc-profile');
        if (typeof modal?.close === 'function') modal.close();
        else if (modal) modal.removeAttribute('open');
        if (typeof onNavigateCustomer === 'function') {
          onNavigateCustomer(custId);
        }
      }
    });
  }

  if (copyBtn && !copyBtn.dataset?.wiredKyc) {
    if (copyBtn.dataset) copyBtn.dataset.wiredKyc = 'true';
    copyBtn.addEventListener('click', async () => {
      const audit = updateUi();
      const text = `🇵🇰 *SHAHDARA FIBER NET — PTA SUBSCRIBER KYC AUDIT STATEMENT*\n` +
        `📅 Date: ${audit.auditDate}\n` +
        `📊 Active Subscribers: ${audit.totalSubscribers}\n` +
        `✅ Verified Compliant: ${audit.verifiedCount} (${audit.complianceRate}%)\n` +
        `🔴 Missing CNIC: ${audit.missingCount}\n` +
        `🟠 Duplicate / Shared CNIC: ${audit.duplicateCount}\n` +
        `🟡 Invalid Format: ${audit.invalidCount}\n` +
        `🏛️ Risk Assessment: ${audit.riskBadge}\n` +
        `─────────────────────────────────────────\n` +
        `Certified for PTA Broadband Regulatory Inspection.`;

      const clip = clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
      if (clip && typeof clip.writeText === 'function') {
        try {
          await clip.writeText(text);
          if (typeof onToast === 'function') onToast('PTA KYC Audit statement copied to clipboard!');
        } catch {
          if (typeof onToast === 'function') onToast('Failed to copy to clipboard.');
        }
      } else if (typeof onToast === 'function') {
        onToast('Clipboard not supported in this browser.');
      }
    });
  }

  if (downloadCsvBtn && !downloadCsvBtn.dataset?.wiredKyc) {
    if (downloadCsvBtn.dataset) downloadCsvBtn.dataset.wiredKyc = 'true';
    downloadCsvBtn.addEventListener('click', () => {
      const audit = updateUi();
      const csv = generateKycComplianceCsv(audit);
      const filename = `shahdara_pta_kyc_audit_${audit.auditDate}.csv`;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      if (typeof onToast === 'function') onToast(`Downloaded ${filename}`);
    });
  }

  if (printBtn && !printBtn.dataset?.wiredKyc) {
    if (printBtn.dataset) printBtn.dataset.wiredKyc = 'true';
    printBtn.addEventListener('click', () => {
      const audit = updateUi();
      const printHtml = generateKycCompliancePrintHtml(audit);
      const printWin = window.open('', '_blank');
      if (printWin) {
        printWin.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>PTA KYC Compliance Register - ${audit.auditDate}</title>
              <style>
                body { margin: 0; padding: 20px; font-family: sans-serif; }
                @media print { body { padding: 0; } }
              </style>
            </head>
            <body>
              ${printHtml}
              <script>window.onload = function() { window.print(); };</script>
            </body>
          </html>
        `);
        printWin.document.close();
      } else if (typeof onToast === 'function') {
        onToast('Pop-up blocked. Please allow pop-ups to print register.');
      }
    });
  }

  openBtns.forEach(btn => {
    if (!btn.dataset?.wiredKycOpen) {
      if (btn.dataset) btn.dataset.wiredKycOpen = 'true';
      btn.addEventListener('click', () => {
        updateUi();
        if (typeof modal?.showModal === 'function') modal.showModal();
        else if (modal) modal.setAttribute('open', '');
      });
    }
  });

  if (closeBtn && !closeBtn.dataset?.wiredKyc) {
    if (closeBtn.dataset) closeBtn.dataset.wiredKyc = 'true';
    closeBtn.addEventListener('click', () => {
      if (typeof modal?.close === 'function') modal.close();
      else if (modal) modal.removeAttribute('open');
    });
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        if (typeof modal?.close === 'function') modal.close();
        else modal.removeAttribute('open');
      }
    });
  }

  return {
    recalculate: updateUi,
    getAuditData: () => lastAuditData,
    open: () => {
      updateUi();
      if (typeof modal?.showModal === 'function') modal.showModal();
      else if (modal) modal.setAttribute('open', '');
    },
    close: () => {
      if (typeof modal?.close === 'function') modal.close();
      else if (modal) modal.removeAttribute('open');
    },
    setState: (newState) => {
      currentState = newState;
      updateUi();
    }
  };
}

/* =========================================================================
   Subscriber Equipment Retrieval & Hardware Custody Return Manifest System
   (واپسی و بازیابی آلات و راؤٹر مینی فیسٹ)
   ========================================================================= */

export const EQUIPMENT_RETRIEVAL_KEY = 'shahdara_equipment_retrievals_v1';

export const EQUIPMENT_TYPES = {
  ont_gpon: { id: 'ont_gpon', label: 'GPON ONT / ONU Optical Modem', defaultDeposit: 3500 },
  wifi_router: { id: 'wifi_router', label: 'Dual-Band Gigabit Wi-Fi Router', defaultDeposit: 3000 },
  fiber_patch_cord: { id: 'fiber_patch_cord', label: 'SC/UPC Fiber Drop Patch Cord', defaultDeposit: 500 },
  power_adapter: { id: 'power_adapter', label: '12V 1.5A/2A DC Power Adapter', defaultDeposit: 600 }
};

export const RETRIEVAL_STATUSES = {
  retrieved: { id: 'retrieved', label: 'Retrieved & In Custody', labelUrdu: 'موصول شدہ / برآمد', badgeClass: 'role-primary' },
  pending_retrieval: { id: 'pending_retrieval', label: 'Pending Field Retrieval', labelUrdu: 'بازیابی زیرِ التواء', badgeClass: 'badge-warning' },
  damaged_unusable: { id: 'damaged_unusable', label: 'Damaged / Hardware Fault', labelUrdu: 'خراب / ناقابلِ استعمال', badgeClass: 'role-alert' },
  subscriber_purchased: { id: 'subscriber_purchased', label: 'Subscriber Purchased', labelUrdu: 'گاہک نے خرید لیا', badgeClass: 'role-info' },
  waived_unrecoverable: { id: 'waived_unrecoverable', label: 'Unrecoverable / Waived', labelUrdu: 'ناقابلِ واپسی / معاف', badgeClass: 'role-muted' }
};

export const EQUIPMENT_CONDITIONS = {
  excellent: 'Excellent / Like New',
  good: 'Good Working Condition',
  minor_wear: 'Minor Scratches / Working',
  damaged_casing: 'Physical Casing Cracked / Damaged',
  burnt_power_surge: 'Burnt Port / Power Surge Defective',
  missing_parts: 'Missing Adapter / Cable Incomplete'
};

/**
 * Validates equipment retrieval input payload.
 */
export function validateEquipmentRetrieval(payload = {}) {
  const errors = {};
  if (!payload.customerId) {
    errors.customerId = 'Subscriber selection is required.';
  }
  if (!payload.equipmentType || !EQUIPMENT_TYPES[payload.equipmentType]) {
    errors.equipmentType = 'Valid equipment type must be selected.';
  }
  const cleanSerial = String(payload.serialNumber || '').trim();
  if (!cleanSerial || cleanSerial.length < 3) {
    errors.serialNumber = 'Hardware serial number is required (min 3 chars).';
  }
  if (!payload.retrievalStatus || !RETRIEVAL_STATUSES[payload.retrievalStatus]) {
    errors.retrievalStatus = 'Valid retrieval status must be selected.';
  }
  const cleanTech = String(payload.technicianName || '').trim();
  if (!cleanTech || cleanTech.length < 2) {
    errors.technicianName = 'Retrieving technician name must be at least 2 characters.';
  }
  const dateStr = String(payload.recoveryDate || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || isNaN(new Date(dateStr).getTime())) {
    errors.recoveryDate = 'Valid recovery date in YYYY-MM-DD format is required.';
  }
  if (payload.securityDepositHeld !== undefined && Number(payload.securityDepositHeld) < 0) {
    errors.securityDepositHeld = 'Security deposit cannot be negative.';
  }
  if (payload.damageDeduction !== undefined && Number(payload.damageDeduction) < 0) {
    errors.damageDeduction = 'Damage deduction cannot be negative.';
  }
  if (payload.unreturnedPenalty !== undefined && Number(payload.unreturnedPenalty) < 0) {
    errors.unreturnedPenalty = 'Unreturned penalty cannot be negative.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Calculates financial deposit refund and ledger settlement.
 */
export function calculateEquipmentSettlement({
  securityDepositHeld = 0,
  damageDeduction = 0,
  unreturnedPenalty = 0,
  monthlyArrears = 0
} = {}) {
  const deposit = Math.max(0, Number(securityDepositHeld) || 0);
  const damage = Math.max(0, Number(damageDeduction) || 0);
  const penalty = Math.max(0, Number(unreturnedPenalty) || 0);
  const arrears = Math.max(0, Number(monthlyArrears) || 0);

  const totalDeductions = damage + penalty + arrears;
  const netRefundToSubscriber = Math.max(0, deposit - totalDeductions);
  const netDueFromSubscriber = Math.max(0, totalDeductions - deposit);
  const isBalanced = netRefundToSubscriber === 0 && netDueFromSubscriber === 0;

  return {
    securityDepositHeld: deposit,
    damageDeduction: damage,
    unreturnedPenalty: penalty,
    monthlyArrears: arrears,
    totalDeductions,
    netRefundToSubscriber,
    netDueFromSubscriber,
    isBalanced
  };
}

/**
 * Builds an immutable Equipment Retrieval Return Manifest record.
 */
export function buildEquipmentRetrievalRecord({
  customer,
  equipmentType = 'ont_gpon',
  brandModel = 'Huawei EchoLife HG8546M',
  serialNumber = '',
  macAddress = '',
  opticalPort = 'PON 1',
  conditionRating = 'good',
  conditionNotes = '',
  retrievalStatus = 'retrieved',
  technicianName = 'Field Splicer Worker',
  recoveryDate = null,
  securityDepositHeld = 0,
  damageDeduction = 0,
  unreturnedPenalty = 0,
  monthlyArrears = 0,
  handoverNotes = '',
  existingCount = 0
} = {}) {
  const now = new Date();
  const dateStr = recoveryDate ? String(recoveryDate).slice(0, 10) : now.toISOString().slice(0, 10);
  const yearMonth = dateStr.slice(0, 7).replace('-', '');
  const seq = String(Number(existingCount || 0) + 1).padStart(4, '0');
  const manifestNumber = `RET-${yearMonth}-${seq}`;

  const eqTypeMeta = EQUIPMENT_TYPES[equipmentType] || EQUIPMENT_TYPES.ont_gpon;
  const statusMeta = RETRIEVAL_STATUSES[retrievalStatus] || RETRIEVAL_STATUSES.retrieved;

  const settlement = calculateEquipmentSettlement({
    securityDepositHeld,
    damageDeduction,
    unreturnedPenalty,
    monthlyArrears
  });

  return {
    id: `ret-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    manifestNumber,
    customerId: customer?.id || '',
    customerNumber: customer?.customerNumber || '',
    customerName: customer?.name || 'Unnamed Subscriber',
    customerPhone: customer?.phone || '',
    customerArea: customer?.area || customer?.mohalla || 'Shahdara Area',
    equipmentType: eqTypeMeta.id,
    equipmentTypeLabel: eqTypeMeta.label,
    brandModel: String(brandModel || 'Standard ISP Unit').trim(),
    serialNumber: String(serialNumber || '').trim(),
    macAddress: String(macAddress || '').trim(),
    opticalPort: String(opticalPort || 'PON 1').trim(),
    conditionRating: EQUIPMENT_CONDITIONS[conditionRating] ? conditionRating : 'good',
    conditionLabel: EQUIPMENT_CONDITIONS[conditionRating] || 'Good Working Condition',
    conditionNotes: String(conditionNotes || '').trim(),
    retrievalStatus: statusMeta.id,
    retrievalStatusLabel: statusMeta.label,
    retrievalStatusLabelUrdu: statusMeta.labelUrdu,
    badgeClass: statusMeta.badgeClass,
    technicianName: String(technicianName || 'Field Splicer Worker').trim(),
    recoveryDate: dateStr,
    settlement,
    handoverNotes: String(handoverNotes || '').trim(),
    createdAt: now.toISOString()
  };
}

export function getSavedEquipmentRetrievals(storage) {
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store || typeof store.getItem !== 'function') return [];
  try {
    const raw = store.getItem(EQUIPMENT_RETRIEVAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveEquipmentRetrieval(record, storage) {
  if (!record || !record.id) return null;
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  const list = getSavedEquipmentRetrievals(store);
  const existingIdx = list.findIndex(r => r.id === record.id || r.manifestNumber === record.manifestNumber);

  if (existingIdx !== -1) {
    list[existingIdx] = { ...list[existingIdx], ...record };
  } else {
    list.unshift(record);
  }

  if (store && typeof store.setItem === 'function') {
    try {
      store.setItem(EQUIPMENT_RETRIEVAL_KEY, JSON.stringify(list));
    } catch {}
  }
  return record;
}

export function updateEquipmentRetrievalStatus(retrievalId, newStatus, storage, { updatedBy = 'Store Inventory Manager', note = '' } = {}) {
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  const list = getSavedEquipmentRetrievals(store);
  const idx = list.findIndex(r => r.id === retrievalId || r.manifestNumber === retrievalId);
  if (idx === -1) return null;

  const statusMeta = RETRIEVAL_STATUSES[newStatus] || RETRIEVAL_STATUSES.retrieved;
  const updated = {
    ...list[idx],
    retrievalStatus: statusMeta.id,
    retrievalStatusLabel: statusMeta.label,
    retrievalStatusLabelUrdu: statusMeta.labelUrdu,
    badgeClass: statusMeta.badgeClass,
    statusUpdatedAt: new Date().toISOString(),
    statusUpdatedBy: updatedBy,
    statusUpdateNote: note || `Status updated to ${statusMeta.label}`
  };

  list[idx] = updated;
  if (store && typeof store.setItem === 'function') {
    try {
      store.setItem(EQUIPMENT_RETRIEVAL_KEY, JSON.stringify(list));
    } catch {}
  }
  return updated;
}

export function clearEquipmentRetrievals(storage) {
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store || typeof store.removeItem !== 'function') return;
  try {
    store.removeItem(EQUIPMENT_RETRIEVAL_KEY);
  } catch {}
}

export function calculateEquipmentRetrievalMetrics(retrievals = [], options = {}) {
  const list = Array.isArray(retrievals) ? retrievals : [];
  const statusFilter = options.statusFilter || 'all';
  const query = (options.query || '').toLowerCase().trim();

  let retrievedCount = 0;
  let pendingCount = 0;
  let damagedCount = 0;
  let purchasedCount = 0;
  let waivedCount = 0;
  let totalDepositHeld = 0;
  let totalRefunded = 0;
  let totalDeductions = 0;

  list.forEach(r => {
    if (r.retrievalStatus === 'retrieved') retrievedCount++;
    else if (r.retrievalStatus === 'pending_retrieval') pendingCount++;
    else if (r.retrievalStatus === 'damaged_unusable') damagedCount++;
    else if (r.retrievalStatus === 'subscriber_purchased') purchasedCount++;
    else if (r.retrievalStatus === 'waived_unrecoverable') waivedCount++;

    const set = r.settlement || {};
    totalDepositHeld += Number(set.securityDepositHeld || 0);
    totalRefunded += Number(set.netRefundToSubscriber || 0);
    totalDeductions += Number(set.totalDeductions || 0);
  });

  const totalCount = list.length;
  const recoveryRatePercent = totalCount > 0 ? Math.round(((retrievedCount + purchasedCount) / totalCount) * 100) : 100;

  const filtered = list.filter(r => {
    if (statusFilter !== 'all') {
      if (statusFilter === 'retrieved' && r.retrievalStatus !== 'retrieved') return false;
      if (statusFilter === 'pending' && r.retrievalStatus !== 'pending_retrieval') return false;
      if (statusFilter === 'damaged' && r.retrievalStatus !== 'damaged_unusable') return false;
      if (statusFilter === 'purchased' && r.retrievalStatus !== 'subscriber_purchased') return false;
      if (statusFilter === 'waived' && r.retrievalStatus !== 'waived_unrecoverable') return false;
    }

    if (query) {
      const matchManifest = (r.manifestNumber || '').toLowerCase().includes(query);
      const matchName = (r.customerName || '').toLowerCase().includes(query);
      const matchPhone = (r.customerPhone || '').toLowerCase().includes(query);
      const matchArea = (r.customerArea || '').toLowerCase().includes(query);
      const matchSerial = (r.serialNumber || '').toLowerCase().includes(query);
      const matchModel = (r.brandModel || '').toLowerCase().includes(query);
      const matchTech = (r.technicianName || '').toLowerCase().includes(query);
      if (!matchManifest && !matchName && !matchPhone && !matchArea && !matchSerial && !matchModel && !matchTech) {
        return false;
      }
    }
    return true;
  });

  return {
    metrics: {
      totalCount,
      retrievedCount,
      pendingCount,
      damagedCount,
      purchasedCount,
      waivedCount,
      totalDepositHeld,
      totalRefunded,
      totalDeductions,
      recoveryRatePercent
    },
    filtered
  };
}

export function formatEquipmentRetrievalWhatsApp(record) {
  if (!record) return '';
  const set = record.settlement || {};
  const formatPkr = (n) => `PKR ${Number(n || 0).toLocaleString()}`;

  const lines = [
    `📦 *SHAHDARA BROADBAND - HARDWARE RETRIEVAL MANIFEST* 📦`,
    `رسید واپسی آلات و سازوسامان`,
    `----------------------------------------`,
    `📋 *Manifest No:* \`${record.manifestNumber}\``,
    `📅 *Recovery Date:* ${record.recoveryDate}`,
    `👤 *Subscriber:* ${record.customerName} (#${record.customerNumber || record.customerId})`,
    `📍 *Area / Mohalla:* ${record.customerArea}`,
    `📞 *Contact:* ${record.customerPhone || 'N/A'}`,
    `----------------------------------------`,
    `⚙️ *EQUIPMENT SPECIFICATIONS:*`,
    `• Type: ${record.equipmentTypeLabel}`,
    `• Model: ${record.brandModel}`,
    `• Serial No (S/N): \`${record.serialNumber}\``,
    record.macAddress ? `• MAC Address: \`${record.macAddress}\`` : null,
    `• Physical Condition: ${record.conditionLabel}`,
    `• Custody Status: *${record.retrievalStatusLabel}* (${record.retrievalStatusLabelUrdu})`,
    `----------------------------------------`,
    `💰 *DEPOSIT & LEDGER SETTLEMENT:*`,
    `• Security Deposit Held: ${formatPkr(set.securityDepositHeld)}`,
    set.damageDeduction > 0 ? `• Damage / Fault Deduction: -${formatPkr(set.damageDeduction)}` : null,
    set.unreturnedPenalty > 0 ? `• Missing Cable/Parts Penalty: -${formatPkr(set.unreturnedPenalty)}` : null,
    set.monthlyArrears > 0 ? `• Overdue Monthly Dues: -${formatPkr(set.monthlyArrears)}` : null,
    `----------------------------------------`,
    set.netRefundToSubscriber > 0
      ? `🟢 *NET REFUND PAYABLE TO SUBSCRIBER:* *${formatPkr(set.netRefundToSubscriber)}*`
      : (set.netDueFromSubscriber > 0
        ? `🔴 *NET BALANCE DUE FROM SUBSCRIBER:* *${formatPkr(set.netDueFromSubscriber)}*`
        : `⚪ *LEDGER SETTLED:* *PKR 0 Balance*`),
    `----------------------------------------`,
    `👷 *Assigned Technician:* ${record.technicianName}`,
    record.conditionNotes ? `📝 *Inspector Notes:* ${record.conditionNotes}` : null,
    `----------------------------------------`,
    `Shahdara Fiber Net Field Ops & Hardware Custody Desk`,
    `Helpline / WhatsApp: +92 300 0000000`
  ].filter(Boolean);

  return lines.join('\n');
}

export function generateEquipmentRetrievalHtml(record, { format = 'standard' } = {}) {
  if (!record) return '<p>No retrieval record specified.</p>';
  const set = record.settlement || {};
  const formatPkr = (n) => `PKR ${Number(n || 0).toLocaleString()}`;

  if (format === 'thermal') {
    return `
      <div class="thermal-receipt-container" style="max-width: 320px; font-family: monospace; font-size: 12px; line-height: 1.3; color: #000; padding: 10px;">
        <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 8px;">
          <h3 style="margin: 0; font-size: 14px; text-transform: uppercase;">SHAHDARA BROADBAND</h3>
          <p style="margin: 2px 0; font-size: 11px;">Hardware Retrieval & Handover Slip</p>
          <p style="margin: 2px 0; font-size: 11px;">رسید واپسی آلات و سازوسامان</p>
        </div>
        <div style="margin-bottom: 8px; font-size: 11px;">
          <div>Manifest: <strong>${escapeHtml(record.manifestNumber)}</strong></div>
          <div>Date: ${escapeHtml(record.recoveryDate)}</div>
          <div>Sub: ${escapeHtml(record.customerName)} (#${escapeHtml(String(record.customerNumber || record.customerId))})</div>
          <div>Phone: ${escapeHtml(record.customerPhone || '—')}</div>
          <div>Area: ${escapeHtml(record.customerArea)}</div>
        </div>
        <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 6px 0; margin-bottom: 8px; font-size: 11px;">
          <div><strong>Hardware:</strong> ${escapeHtml(record.equipmentTypeLabel)}</div>
          <div>Model: ${escapeHtml(record.brandModel)}</div>
          <div>S/N: ${escapeHtml(record.serialNumber)}</div>
          <div>Cond: ${escapeHtml(record.conditionLabel)}</div>
          <div>Status: <strong>${escapeHtml(record.retrievalStatusLabel)}</strong></div>
        </div>
        <div style="margin-bottom: 8px; font-size: 11px;">
          <div>Deposit Held: ${formatPkr(set.securityDepositHeld)}</div>
          <div>Deductions: -${formatPkr(set.totalDeductions)}</div>
          <div style="border-top: 1px solid #000; margin-top: 4px; padding-top: 4px; font-weight: bold;">
            ${set.netRefundToSubscriber > 0
              ? `Refund Due: ${formatPkr(set.netRefundToSubscriber)}`
              : (set.netDueFromSubscriber > 0 ? `Balance Due: ${formatPkr(set.netDueFromSubscriber)}` : 'Balance: PKR 0')}
          </div>
        </div>
        <div style="margin-top: 15px; font-size: 10px; text-align: center;">
          <div style="display: flex; justify-content: space-between; margin-top: 20px;">
            <div style="border-top: 1px solid #000; width: 45%;">Tech Sign</div>
            <div style="border-top: 1px solid #000; width: 45%;">Client Sign</div>
          </div>
          <p style="margin-top: 8px;">Shahdara Fiber Net Field Ops Desk</p>
        </div>
      </div>
    `;
  }

  // Standard A4 Layout
  return `
    <div class="printable-contract-document" style="max-width: 800px; margin: 0 auto; padding: 25px; font-family: 'Segoe UI', system-ui, sans-serif; color: #1e293b; background: #ffffff;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0e5b4d; padding-bottom: 12px; margin-bottom: 18px;">
        <div>
          <h2 style="margin: 0; color: #0e5b4d; font-size: 22px; text-transform: uppercase;">SHAHDARA FIBER BROADBAND SERVICES</h2>
          <p style="margin: 3px 0; font-size: 13px; color: #64748b;">Licensed Local Internet Service Provider · Shahdara Lahore</p>
          <h3 style="margin: 6px 0 0; color: #1e293b; font-size: 16px;">SUBSCRIBER EQUIPMENT CUSTODY &amp; RETRIEVAL MANIFEST</h3>
          <p style="margin: 2px 0; font-size: 13px; color: #0e5b4d; font-weight: bold;" dir="rtl">فردِ بازیابی و حوالگی سامان و آلاتِ نیٹ ورک</p>
        </div>
        <div style="text-align: right;">
          <div style="font-family: monospace; font-size: 13px; font-weight: bold; background: #f1f5f9; padding: 6px 12px; border-radius: 6px; border: 1px solid #cbd5e1;">
            ${escapeHtml(record.manifestNumber)}
          </div>
          <p style="margin: 4px 0 0; font-size: 12px; color: #64748b;">Recovery Date: <strong>${escapeHtml(record.recoveryDate)}</strong></p>
          <span style="display: inline-block; margin-top: 4px; padding: 3px 8px; font-size: 11px; font-weight: bold; border-radius: 4px; background: #e0f2fe; color: #0369a1;">
            ${escapeHtml(record.retrievalStatusLabel)}
          </span>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 18px;">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px;">
          <h4 style="margin: 0 0 8px; font-size: 13px; text-transform: uppercase; color: #0e5b4d; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">Subscriber Details / گاہک کی تفصیلات</h4>
          <table style="width: 100%; font-size: 12px; line-height: 1.6;">
            <tr><td style="color: #64748b; width: 40%;">Name:</td><td><strong>${escapeHtml(record.customerName)}</strong></td></tr>
            <tr><td style="color: #64748b;">Account #:</td><td>#${escapeHtml(String(record.customerNumber || record.customerId))}</td></tr>
            <tr><td style="color: #64748b;">Area / Mohalla:</td><td>${escapeHtml(record.customerArea)}</td></tr>
            <tr><td style="color: #64748b;">Phone:</td><td>${escapeHtml(record.customerPhone || '—')}</td></tr>
          </table>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px;">
          <h4 style="margin: 0 0 8px; font-size: 13px; text-transform: uppercase; color: #0e5b4d; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">Hardware Custody / آلات کی معلومات</h4>
          <table style="width: 100%; font-size: 12px; line-height: 1.6;">
            <tr><td style="color: #64748b; width: 40%;">Hardware Type:</td><td><strong>${escapeHtml(record.equipmentTypeLabel)}</strong></td></tr>
            <tr><td style="color: #64748b;">Make &amp; Model:</td><td>${escapeHtml(record.brandModel)}</td></tr>
            <tr><td style="color: #64748b;">Serial No (S/N):</td><td style="font-family: monospace;"><strong>${escapeHtml(record.serialNumber)}</strong></td></tr>
            <tr><td style="color: #64748b;">Physical State:</td><td>${escapeHtml(record.conditionLabel)}</td></tr>
          </table>
        </div>
      </div>

      <div style="margin-bottom: 18px;">
        <h4 style="margin: 0 0 8px; font-size: 13px; text-transform: uppercase; color: #0e5b4d;">Security Deposit Settlement / تصفیہ زرضمانت و واجبات</h4>
        <table style="width: 100%; border-collapse: collapse; font-size: 12.5px;">
          <thead>
            <tr style="background: #f1f5f9; text-align: left;">
              <th style="padding: 8px; border: 1px solid #cbd5e1;">Ledger Settlement Item</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">Amount (PKR)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding: 8px; border: 1px solid #e2e8f0;">Refundable Hardware Security Deposit Held on File</td>
              <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right; font-weight: bold;">${formatPkr(set.securityDepositHeld)}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #e2e8f0; color: #b91c1c;">Hardware Damage / Port Defect / Burn Deduction</td>
              <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right; color: #b91c1c;">-${formatPkr(set.damageDeduction)}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #e2e8f0; color: #b91c1c;">Unreturned Patch Cord / Adapter / Accessories Penalty</td>
              <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right; color: #b91c1c;">-${formatPkr(set.unreturnedPenalty)}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #e2e8f0; color: #b91c1c;">Unpaid Monthly Subscription Arrears Offset</td>
              <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right; color: #b91c1c;">-${formatPkr(set.monthlyArrears)}</td>
            </tr>
            <tr style="background: #f8fafc; font-weight: bold; font-size: 13.5px;">
              <td style="padding: 10px; border: 2px solid #cbd5e1;">
                ${set.netRefundToSubscriber > 0
                  ? '<span style="color: #047857;">NET REFUND PAYABLE TO SUBSCRIBER (قابلِ واپسی رقم)</span>'
                  : (set.netDueFromSubscriber > 0
                    ? '<span style="color: #b91c1c;">NET BALANCE DUE FROM SUBSCRIBER (واجب الادا بقیہ)</span>'
                    : '<span>LEDGER FULLY SETTLED / NO OUTSTANDING</span>')}
              </td>
              <td style="padding: 10px; border: 2px solid #cbd5e1; text-align: right;">
                ${set.netRefundToSubscriber > 0
                  ? `<span style="color: #047857;">${formatPkr(set.netRefundToSubscriber)}</span>`
                  : (set.netDueFromSubscriber > 0
                    ? `<span style="color: #b91c1c;">${formatPkr(set.netDueFromSubscriber)}</span>`
                    : 'PKR 0')}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      ${record.conditionNotes ? `
        <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 6px; padding: 10px; margin-bottom: 18px; font-size: 12px;">
          <strong>Field Technician Condition Notes:</strong> ${escapeHtml(record.conditionNotes)}
        </div>
      ` : ''}

      <div style="border-top: 1px solid #e2e8f0; padding-top: 12px; margin-top: 25px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 35px; text-align: center;">
          <div>
            <div style="border-top: 1px solid #000; width: 70%; margin: 0 auto; padding-top: 5px; font-size: 12px; font-weight: bold;">
              ${escapeHtml(record.technicianName)}
            </div>
            <p style="margin: 2px 0; font-size: 11px; color: #64748b;">Authorized Field Ops Splicer / Collector</p>
          </div>
          <div>
            <div style="border-top: 1px solid #000; width: 70%; margin: 0 auto; padding-top: 5px; font-size: 12px; font-weight: bold;">
              ${escapeHtml(record.customerName)}
            </div>
            <p style="margin: 2px 0; font-size: 11px; color: #64748b;">Subscriber Acknowledging Handover</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function generateEquipmentRetrievalCsv(retrievals = []) {
  const list = Array.isArray(retrievals) ? retrievals : [];
  const headers = [
    'Manifest Number',
    'Date',
    'Customer ID',
    'Customer Name',
    'Customer Area',
    'Customer Phone',
    'Hardware Type',
    'Model',
    'Serial Number',
    'Physical Condition',
    'Status',
    'Deposit Held PKR',
    'Damage Deduction PKR',
    'Penalty Deduction PKR',
    'Arrears Offset PKR',
    'Net Refund PKR',
    'Net Due PKR',
    'Technician',
    'Notes'
  ];

  const escapeCsv = (val) => {
    const s = String(val ?? '').replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = list.map(r => {
    const set = r.settlement || {};
    return [
      escapeCsv(r.manifestNumber),
      escapeCsv(r.recoveryDate),
      escapeCsv(r.customerNumber || r.customerId),
      escapeCsv(r.customerName),
      escapeCsv(r.customerArea),
      escapeCsv(r.customerPhone),
      escapeCsv(r.equipmentTypeLabel),
      escapeCsv(r.brandModel),
      escapeCsv(r.serialNumber),
      escapeCsv(r.conditionLabel),
      escapeCsv(r.retrievalStatusLabel),
      escapeCsv(set.securityDepositHeld || 0),
      escapeCsv(set.damageDeduction || 0),
      escapeCsv(set.unreturnedPenalty || 0),
      escapeCsv(set.monthlyArrears || 0),
      escapeCsv(set.netRefundToSubscriber || 0),
      escapeCsv(set.netDueFromSubscriber || 0),
      escapeCsv(r.technicianName),
      escapeCsv(r.conditionNotes || '')
    ].join(',');
  });

  return '\uFEFF' + [headers.map(escapeCsv).join(','), ...rows].join('\r\n');
}

/**
 * Sets up and wires the Equipment Retrieval Modal dialog.
 */
export function setupEquipmentRetrievalModal({
  getState,
  storage,
  onToast,
  onNavigateCustomer,
  onEquipmentRetrieved
} = {}) {
  if (typeof document === 'undefined') {
    return { recalculate: () => {}, open: () => {}, close: () => {} };
  }

  const modal = document.getElementById('equipmentRetrievalModal');
  const closeBtn = document.getElementById('closeEquipmentRetrievalBtn');
  const openBtns = document.querySelectorAll('[data-open-equipment-retrieval]');

  const custSelect = document.getElementById('retrievalCustomerSelect');
  const typeSelect = document.getElementById('retrievalTypeSelect');
  const modelInput = document.getElementById('retrievalModelInput');
  const serialInput = document.getElementById('retrievalSerialInput');
  const conditionSelect = document.getElementById('retrievalConditionSelect');
  const statusSelect = document.getElementById('retrievalStatusSelect');
  const techInput = document.getElementById('retrievalTechInput');
  const dateInput = document.getElementById('retrievalDateInput');
  const notesInput = document.getElementById('retrievalNotesInput');

  const depositInput = document.getElementById('retrievalDepositInput');
  const damageInput = document.getElementById('retrievalDamageInput');
  const penaltyInput = document.getElementById('retrievalPenaltyInput');
  const arrearsInput = document.getElementById('retrievalArrearsInput');

  const netRefundEl = document.getElementById('retrievalNetRefundVal');
  const netDueEl = document.getElementById('retrievalNetDueVal');
  const formEl = document.getElementById('equipmentRetrievalForm');

  const statusFilter = document.getElementById('retrievalFilterStatus');
  const searchInput = document.getElementById('retrievalSearchInput');
  const tableBody = document.getElementById('equipmentRetrievalTableBody');

  const kpiTotal = document.getElementById('retrievalKpiTotal');
  const kpiRecovered = document.getElementById('retrievalKpiRecovered');
  const kpiPending = document.getElementById('retrievalKpiPending');
  const kpiRate = document.getElementById('retrievalKpiRate');

  const csvBtn = document.getElementById('exportEquipmentRetrievalCsvBtn');

  let currentSelectedCustomer = null;

  function recalculateSettlement() {
    const deposit = Number(depositInput?.value) || 0;
    const damage = Number(damageInput?.value) || 0;
    const penalty = Number(penaltyInput?.value) || 0;
    const arrears = Number(arrearsInput?.value) || 0;

    const res = calculateEquipmentSettlement({
      securityDepositHeld: deposit,
      damageDeduction: damage,
      unreturnedPenalty: penalty,
      monthlyArrears: arrears
    });

    if (netRefundEl) netRefundEl.textContent = `PKR ${res.netRefundToSubscriber.toLocaleString()}`;
    if (netDueEl) netDueEl.textContent = `PKR ${res.netDueFromSubscriber.toLocaleString()}`;
    return res;
  }

  [depositInput, damageInput, penaltyInput, arrearsInput].forEach(inp => {
    if (inp && !inp.dataset?.wiredRet) {
      if (inp.dataset) inp.dataset.wiredRet = 'true';
      inp.addEventListener('input', recalculateSettlement);
    }
  });

  function populateCustomerSelect() {
    if (!custSelect) return;
    const state = typeof getState === 'function' ? getState() : null;
    const customers = Array.isArray(state?.customers) ? state.customers : [];
    custSelect.innerHTML = '<option value="">-- Select Subscriber --</option>' +
      customers.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)} (#${escapeHtml(String(c.customerNumber || c.id))}) - ${escapeHtml(c.area || c.mohalla || 'Shahdara')}</option>`).join('');
  }

  function renderList() {
    const retrievals = getSavedEquipmentRetrievals(storage);
    const filter = statusFilter?.value || 'all';
    const query = searchInput?.value || '';

    const { metrics, filtered } = calculateEquipmentRetrievalMetrics(retrievals, { statusFilter: filter, query });

    if (kpiTotal) kpiTotal.textContent = String(metrics.totalCount);
    if (kpiRecovered) kpiRecovered.textContent = String(metrics.retrievedCount);
    if (kpiPending) kpiPending.textContent = String(metrics.pendingCount);
    if (kpiRate) kpiRate.textContent = `${metrics.recoveryRatePercent}%`;

    if (tableBody) {
      tableBody.innerHTML = '';
      if (filtered.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="8" class="text-center text-muted" style="padding: 16px;">No equipment retrieval manifests recorded.</td></tr>`;
      } else {
        filtered.forEach(r => {
          const tr = document.createElement('tr');
          const set = r.settlement || {};
          tr.innerHTML = `
            <td class="font-mono font-bold">${escapeHtml(r.manifestNumber)}</td>
            <td>${escapeHtml(r.recoveryDate)}</td>
            <td>
              <strong>${escapeHtml(r.customerName)}</strong>
              <div class="text-muted" style="font-size: 11px;">#${escapeHtml(String(r.customerNumber || r.customerId))} · ${escapeHtml(r.customerArea)}</div>
            </td>
            <td>
              <div><strong>${escapeHtml(r.equipmentTypeLabel)}</strong></div>
              <div class="font-mono" style="font-size: 11px;">S/N: ${escapeHtml(r.serialNumber)}</div>
            </td>
            <td>${escapeHtml(r.conditionLabel)}</td>
            <td class="text-center"><span class="role-badge ${escapeHtml(r.badgeClass || 'role-primary')}">${escapeHtml(r.retrievalStatusLabel)}</span></td>
            <td class="text-right font-bold">
              ${set.netRefundToSubscriber > 0
                ? `<span style="color: #059669;">+PKR ${set.netRefundToSubscriber.toLocaleString()}</span>`
                : (set.netDueFromSubscriber > 0
                  ? `<span style="color: #dc2626;">-PKR ${set.netDueFromSubscriber.toLocaleString()}</span>`
                  : 'PKR 0')}
            </td>
            <td class="text-center">
              <button type="button" class="action-btn-sm" data-ret-print-a4="${escapeHtml(r.manifestNumber)}" title="Print A4 Manifest">🖨️ A4</button>
              <button type="button" class="action-btn-sm" data-ret-print-slip="${escapeHtml(r.manifestNumber)}" title="Print Thermal Slip">🧾 Slip</button>
              <button type="button" class="action-btn-sm" data-ret-wa="${escapeHtml(r.manifestNumber)}" title="Send WhatsApp">💬</button>
            </td>
          `;
          tableBody.appendChild(tr);
        });
      }
    }
  }

  if (statusFilter && !statusFilter.dataset?.wiredRet) {
    if (statusFilter.dataset) statusFilter.dataset.wiredRet = 'true';
    statusFilter.addEventListener('change', renderList);
  }

  if (searchInput && !searchInput.dataset?.wiredRet) {
    if (searchInput.dataset) searchInput.dataset.wiredRet = 'true';
    searchInput.addEventListener('input', renderList);
  }

  if (tableBody && !tableBody.dataset?.wiredRet) {
    if (tableBody.dataset) tableBody.dataset.wiredRet = 'true';
    tableBody.addEventListener('click', (e) => {
      const a4Btn = e.target.closest('[data-ret-print-a4]');
      const slipBtn = e.target.closest('[data-ret-print-slip]');
      const waBtn = e.target.closest('[data-ret-wa]');

      const retrievals = getSavedEquipmentRetrievals(storage);

      if (a4Btn) {
        const num = a4Btn.getAttribute('data-ret-print-a4');
        const rec = retrievals.find(r => r.manifestNumber === num);
        if (rec) {
          const html = generateEquipmentRetrievalHtml(rec, { format: 'standard' });
          const win = window.open('', '_blank');
          if (win) {
            win.document.write(`<!DOCTYPE html><html><head><title>Manifest ${rec.manifestNumber}</title><style>body { margin: 0; padding: 20px; font-family: sans-serif; } @media print { body { padding: 0; } }</style></head><body>${html}<script>window.onload = function() { window.print(); };</script></body></html>`);
            win.document.close();
          }
        }
      } else if (slipBtn) {
        const num = slipBtn.getAttribute('data-ret-print-slip');
        const rec = retrievals.find(r => r.manifestNumber === num);
        if (rec) {
          const html = generateEquipmentRetrievalHtml(rec, { format: 'thermal' });
          const win = window.open('', '_blank');
          if (win) {
            win.document.write(`<!DOCTYPE html><html><head><title>Slip ${rec.manifestNumber}</title><style>body { margin: 0; padding: 10px; font-family: monospace; }</style></head><body>${html}<script>window.onload = function() { window.print(); };</script></body></html>`);
            win.document.close();
          }
        }
      } else if (waBtn) {
        const num = waBtn.getAttribute('data-ret-wa');
        const rec = retrievals.find(r => r.manifestNumber === num);
        if (rec) {
          const text = encodeURIComponent(formatEquipmentRetrievalWhatsApp(rec));
          const phone = (rec.customerPhone || '').replace(/\D/g, '');
          const intlPhone = phone.startsWith('0') ? '92' + phone.slice(1) : (phone.startsWith('92') ? phone : '92' + phone);
          window.open(`https://wa.me/${intlPhone}?text=${text}`, '_blank', 'noopener,noreferrer');
        }
      }
    });
  }

  if (formEl && !formEl.dataset?.wiredRet) {
    if (formEl.dataset) formEl.dataset.wiredRet = 'true';
    formEl.addEventListener('submit', (e) => {
      e.preventDefault();
      const state = typeof getState === 'function' ? getState() : null;
      const customers = Array.isArray(state?.customers) ? state.customers : [];
      const customerId = custSelect?.value || currentSelectedCustomer?.id;
      const cust = customers.find(c => c.id === customerId) || currentSelectedCustomer;

      if (!cust) {
        if (typeof onToast === 'function') onToast('Please select a subscriber.');
        return;
      }

      const payload = {
        customerId: cust.id,
        equipmentType: typeSelect?.value || 'ont_gpon',
        brandModel: modelInput?.value || 'Standard ISP Unit',
        serialNumber: serialInput?.value || '',
        conditionRating: conditionSelect?.value || 'good',
        conditionNotes: notesInput?.value || '',
        retrievalStatus: statusSelect?.value || 'retrieved',
        technicianName: techInput?.value || 'Field Splicer Worker',
        recoveryDate: dateInput?.value || new Date().toISOString().slice(0, 10),
        securityDepositHeld: Number(depositInput?.value) || 0,
        damageDeduction: Number(damageInput?.value) || 0,
        unreturnedPenalty: Number(penaltyInput?.value) || 0,
        monthlyArrears: Number(arrearsInput?.value) || 0
      };

      const val = validateEquipmentRetrieval(payload);
      if (!val.valid) {
        const firstErr = Object.values(val.errors)[0];
        if (typeof onToast === 'function') onToast(firstErr || 'Form validation failed.');
        return;
      }

      const existingCount = getSavedEquipmentRetrievals(storage).length;
      const record = buildEquipmentRetrievalRecord({
        customer: cust,
        ...payload,
        existingCount
      });

      saveEquipmentRetrieval(record, storage);
      renderList();
      formEl.reset();
      recalculateSettlement();

      if (typeof onToast === 'function') onToast(`Equipment manifest #${record.manifestNumber} created!`);
      if (typeof onEquipmentRetrieved === 'function') onEquipmentRetrieved(record);
    });
  }

  if (csvBtn && !csvBtn.dataset?.wiredRet) {
    if (csvBtn.dataset) csvBtn.dataset.wiredRet = 'true';
    csvBtn.addEventListener('click', () => {
      const retrievals = getSavedEquipmentRetrievals(storage);
      const csv = generateEquipmentRetrievalCsv(retrievals);
      const filename = `equipment_retrievals_${new Date().toISOString().slice(0, 10)}.csv`;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      if (typeof onToast === 'function') onToast(`Exported ${filename}`);
    });
  }

  openBtns.forEach(btn => {
    if (!btn.dataset?.wiredRetOpen) {
      if (btn.dataset) btn.dataset.wiredRetOpen = 'true';
      btn.addEventListener('click', () => {
        populateCustomerSelect();
        renderList();
        recalculateSettlement();
        if (typeof modal?.showModal === 'function') modal.showModal();
        else if (modal) modal.setAttribute('open', '');
      });
    }
  });

  if (closeBtn && !closeBtn.dataset?.wiredRet) {
    if (closeBtn.dataset) closeBtn.dataset.wiredRet = 'true';
    closeBtn.addEventListener('click', () => {
      if (typeof modal?.close === 'function') modal.close();
      else if (modal) modal.removeAttribute('open');
    });
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        if (typeof modal?.close === 'function') modal.close();
        else modal.removeAttribute('open');
      }
    });
  }

  return {
    recalculate: () => {
      renderList();
      recalculateSettlement();
    },
    open: (customer = null) => {
      currentSelectedCustomer = customer;
      populateCustomerSelect();
      if (customer && custSelect) {
        custSelect.value = customer.id;
      }
      if (dateInput && !dateInput.value) {
        dateInput.value = new Date().toISOString().slice(0, 10);
      }
      renderList();
      recalculateSettlement();
      if (typeof modal?.showModal === 'function') modal.showModal();
      else if (modal) modal.setAttribute('open', '');
    },
    close: () => {
      if (typeof modal?.close === 'function') modal.close();
      else if (modal) modal.removeAttribute('open');
    }
  };
}

/* ==========================================================================
   FIBER OPTIC SPLICING & JOINT ENCLOSURE QA INSPECTION MANIFEST
   ========================================================================== */

export const SPLICE_INSPECTIONS_KEY = 'shahdara_splice_inspections_v1';

export const SPLICE_CATEGORIES = [
  { id: 'NEW_DEPLOYMENT', label: 'New Feeder / Distribution Deployment', urdu: 'نئی فیڈر و ڈسٹری بیوشن تنصیب' },
  { id: 'CUT_REPAIR', label: 'Emergency Fiber Cut Splicing Repair', urdu: 'ہنگامی فائبر کٹ جوائنٹ مرمت' },
  { id: 'SPLITTER_EXPANSION', label: 'Splitter Expansion / FAT Branching', urdu: 'اسپلٹر توسیع و ایف اے ٹی برانچنگ' },
  { id: 'MAINTENANCE_AUDIT', label: 'Scheduled Maintenance & Cleaning Audit', urdu: 'شیڈولڈ معائنہ و صفائی آڈٹ' },
  { id: 'WEATHER_RESTORATION', label: 'Monsoon / Wind Storm Recovery', urdu: 'بارش و طوفان بحالی اسپلائسنگ' }
];

export const FIBER_COLOR_CODES = [
  'Blue (1)', 'Orange (2)', 'Green (3)', 'Brown (4)', 'Slate (5)', 'White (6)',
  'Red (7)', 'Black (8)', 'Yellow (9)', 'Violet (10)', 'Rose (11)', 'Aqua (12)'
];

export const SPLICE_VERDICTS = [
  { id: 'PASSED_CERTIFIED', label: '🟢 Certified Passed (Loss ≤ 0.05 dB)', statusClass: 'status-passed', urdu: 'کامیاب تصدیق شدہ' },
  { id: 'CONDITIONAL_PASS', label: '🟡 Conditional Pass (Loss 0.06 - 0.12 dB)', statusClass: 'status-conditional', urdu: 'مشروط منظوری' },
  { id: 'FAILED_REWORK', label: '🔴 Failed - Rework Required (Loss > 0.12 dB)', statusClass: 'status-failed', urdu: 'ناکام - دوبارہ اسپلائسنگ درکار' }
];

export function validateSpliceInspection(formData = {}) {
  const errors = [];
  const enclosureId = String(formData.enclosureId ?? '').trim();
  const location = String(formData.location ?? '').trim();
  const inspectorName = String(formData.inspectorName ?? '').trim();
  const inspectionDate = String(formData.inspectionDate ?? '').trim();
  const category = String(formData.category ?? '').trim();

  if (!enclosureId || enclosureId.length < 3) {
    errors.push('Enclosure / Pole ID is required (min 3 characters).');
  }

  if (!location || location.length < 3) {
    errors.push('Installation location / area is required (min 3 characters).');
  }

  if (!inspectorName || inspectorName.length < 3) {
    errors.push('Lead Splicer / Inspector Name is required (min 3 characters).');
  }

  if (!inspectionDate || !/^\d{4}-\d{2}-\d{2}$/.test(inspectionDate)) {
    errors.push('Valid inspection date in YYYY-MM-DD format is required.');
  }

  const validCategories = SPLICE_CATEGORIES.map(c => c.id);
  if (!category || !validCategories.includes(category)) {
    errors.push('A valid splicing operation category must be selected.');
  }

  const coresCount = Number(formData.coresCount);
  if (isNaN(coresCount) || coresCount < 1 || coresCount > 96 || !Number.isInteger(coresCount)) {
    errors.push('Number of cores spliced must be an integer between 1 and 96.');
  }

  const averageLossDb = Number(formData.averageLossDb);
  if (isNaN(averageLossDb) || averageLossDb < 0.001 || averageLossDb > 2.0) {
    errors.push('Average splice loss must be a positive number between 0.001 and 2.0 dB per joint.');
  }

  let inputPowerDbm = null;
  if (formData.inputPowerDbm !== undefined && formData.inputPowerDbm !== '' && formData.inputPowerDbm !== null) {
    const num = Number(formData.inputPowerDbm);
    if (isNaN(num) || num < -40 || num > 15) {
      errors.push('Input optical power must be between -40 dBm and +15 dBm.');
    } else {
      inputPowerDbm = Number(num.toFixed(2));
    }
  }

  let outputPowerDbm = null;
  if (formData.outputPowerDbm !== undefined && formData.outputPowerDbm !== '' && formData.outputPowerDbm !== null) {
    const num = Number(formData.outputPowerDbm);
    if (isNaN(num) || num < -40 || num > 15) {
      errors.push('Output optical power must be between -40 dBm and +15 dBm.');
    } else {
      outputPowerDbm = Number(num.toFixed(2));
    }
  }

  const checklist = {
    closureSealed: Boolean(formData.checklist?.closureSealed),
    spliceTraysOrganized: Boolean(formData.checklist?.spliceTraysOrganized),
    cableTiesSecured: Boolean(formData.checklist?.cableTiesSecured),
    dropPigtailsLabeled: Boolean(formData.checklist?.dropPigtailsLabeled),
    silicaGelReplaced: Boolean(formData.checklist?.silicaGelReplaced)
  };

  const sanitized = {
    enclosureId,
    location,
    inspectorName,
    inspectionDate,
    category,
    coresCount: Number(coresCount) || 1,
    averageLossDb: Number(averageLossDb.toFixed(3)),
    inputPowerDbm,
    outputPowerDbm,
    checklist,
    notes: String(formData.notes ?? '').trim()
  };

  return {
    isValid: errors.length === 0,
    errors,
    sanitized
  };
}

export function calculateSpliceInsertionLoss(inputDbm, outputDbm) {
  if (inputDbm === null || inputDbm === undefined || inputDbm === '' ||
      outputDbm === null || outputDbm === undefined || outputDbm === '') {
    return null;
  }
  const inVal = Number(inputDbm);
  const outVal = Number(outputDbm);
  if (isNaN(inVal) || isNaN(outVal)) return null;
  const diff = inVal - outVal;
  return Number(Math.max(0, diff).toFixed(2));
}

export function determineSpliceVerdict(averageLossDb, checklist = {}) {
  const loss = Number(averageLossDb);
  const isLossValid = !isNaN(loss) && loss > 0;
  const sealed = Boolean(checklist.closureSealed);
  const organized = Boolean(checklist.spliceTraysOrganized);
  const secured = Boolean(checklist.cableTiesSecured);
  const labeled = Boolean(checklist.dropPigtailsLabeled);
  const silica = Boolean(checklist.silicaGelReplaced);

  if (isLossValid && loss <= 0.05 && sealed && organized && secured) {
    return {
      verdict: 'PASSED_CERTIFIED',
      label: '🟢 Certified Passed',
      statusClass: 'status-passed',
      reason: `Superior fusion joint quality (${loss.toFixed(3)} dB/joint) and enclosure fully sealed.`
    };
  } else if (isLossValid && loss <= 0.12 && sealed) {
    return {
      verdict: 'CONDITIONAL_PASS',
      label: '🟡 Conditional Pass',
      statusClass: 'status-conditional',
      reason: `Acceptable splice attenuation (${loss.toFixed(3)} dB/joint). Verify tray coiling and labels.`
    };
  } else {
    let reason = `High joint attenuation (${isLossValid ? loss.toFixed(3) : 0} dB/joint > 0.12 dB threshold).`;
    if (!sealed) reason += ' Enclosure rubber gasket not sealed.';
    return {
      verdict: 'FAILED_REWORK',
      label: '🔴 Failed - Rework Required',
      statusClass: 'status-failed',
      reason
    };
  }
}

export function buildSpliceInspectionRecord(data) {
  const validation = validateSpliceInspection(data);
  if (!validation.isValid) {
    throw new Error(`Invalid splice inspection data: ${validation.errors.join(' ')}`);
  }

  const s = validation.sanitized;
  const verdictObj = determineSpliceVerdict(s.averageLossDb, s.checklist);
  const insertionLossDb = calculateSpliceInsertionLoss(s.inputPowerDbm, s.outputPowerDbm);

  const dateParts = s.inspectionDate.split('-');
  const yyyymm = dateParts.length >= 2 ? `${dateParts[0]}${dateParts[1]}` : new Date().toISOString().slice(0, 7).replace('-', '');
  const randNum = Math.floor(1000 + Math.random() * 9000);
  const id = `SPL-${yyyymm}-${randNum}`;

  return {
    id,
    createdAt: new Date().toISOString(),
    enclosureId: s.enclosureId,
    location: s.location,
    inspectorName: s.inspectorName,
    inspectionDate: s.inspectionDate,
    category: s.category,
    coresCount: s.coresCount,
    averageLossDb: s.averageLossDb,
    inputPowerDbm: s.inputPowerDbm,
    outputPowerDbm: s.outputPowerDbm,
    insertionLossDb,
    checklist: s.checklist,
    verdict: verdictObj.verdict,
    verdictLabel: verdictObj.label,
    verdictClass: verdictObj.statusClass,
    verdictReason: verdictObj.reason,
    notes: s.notes
  };
}

export function getSavedSpliceInspections(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(SPLICE_INSPECTIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSpliceInspection(record, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage || !record) return;
  try {
    const list = getSavedSpliceInspections(storage);
    list.unshift(record);
    if (list.length > 200) list.length = 200;
    storage.setItem(SPLICE_INSPECTIONS_KEY, JSON.stringify(list));
  } catch {}
}

export function updateSpliceInspectionStatus(id, newVerdict, notes = '', storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage || !id) return null;
  try {
    const list = getSavedSpliceInspections(storage);
    const target = list.find(r => r.id === id);
    if (target) {
      target.verdict = newVerdict;
      const vObj = SPLICE_VERDICTS.find(v => v.id === newVerdict);
      if (vObj) {
        target.verdictLabel = vObj.label;
        target.verdictClass = vObj.statusClass;
      }
      if (notes) {
        target.notes = target.notes ? `${target.notes} | ${notes}` : notes;
      }
      target.updatedAt = new Date().toISOString();
      storage.setItem(SPLICE_INSPECTIONS_KEY, JSON.stringify(list));
      return target;
    }
  } catch {}
  return null;
}

export function clearSpliceInspections(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return;
  try {
    storage.removeItem(SPLICE_INSPECTIONS_KEY);
  } catch {}
}

export function calculateSpliceInspectionMetrics(records = [], options = {}) {
  const list = Array.isArray(records) ? records : [];
  const categoryFilter = options.category || 'all';
  const verdictFilter = options.verdict || 'all';
  const query = String(options.search || '').toLowerCase().trim();

  let totalInspections = list.length;
  let passedCount = 0;
  let conditionalCount = 0;
  let failedCount = 0;
  let totalLossSum = 0;
  let totalCoresSpliced = 0;

  for (const r of list) {
    if (r.verdict === 'PASSED_CERTIFIED') passedCount++;
    else if (r.verdict === 'CONDITIONAL_PASS') conditionalCount++;
    else if (r.verdict === 'FAILED_REWORK') failedCount++;

    totalLossSum += (Number(r.averageLossDb) || 0);
    totalCoresSpliced += (Number(r.coresCount) || 0);
  }

  const averageLossDb = totalInspections > 0 ? Number((totalLossSum / totalInspections).toFixed(3)) : 0;
  const passRatePct = totalInspections > 0 ? Math.round((passedCount / totalInspections) * 100) : 100;

  let filtered = list;
  if (categoryFilter !== 'all') {
    filtered = filtered.filter(r => r.category === categoryFilter);
  }
  if (verdictFilter !== 'all') {
    filtered = filtered.filter(r => r.verdict === verdictFilter);
  }
  if (query) {
    filtered = filtered.filter(r =>
      String(r.id || '').toLowerCase().includes(query) ||
      String(r.enclosureId || '').toLowerCase().includes(query) ||
      String(r.location || '').toLowerCase().includes(query) ||
      String(r.inspectorName || '').toLowerCase().includes(query) ||
      String(r.notes || '').toLowerCase().includes(query)
    );
  }

  return {
    totalInspections,
    passedCount,
    conditionalCount,
    failedCount,
    passRatePct,
    averageLossDb,
    totalCoresSpliced,
    reworkPendingCount: failedCount,
    filteredRecords: filtered
  };
}

export function formatSpliceInspectionWhatsApp(record) {
  if (!record) return '';
  const catObj = SPLICE_CATEGORIES.find(c => c.id === record.category);
  const catLabel = catObj ? `${catObj.label} (${catObj.urdu})` : (record.category || 'Standard');

  const checkSymbols = (val) => val ? '✅' : '❌';

  return `*SHAHDARA FIBER NETWORK — OSP SPLICING QA CERTIFICATE*
*Inspection Ticket:* ${record.id}
*Date:* ${record.inspectionDate}
*Enclosure / Pole ID:* ${record.enclosureId}
*Location:* ${record.location}
*Lead Splicer:* ${record.inspectorName}
*Category:* ${catLabel}

*TECHNICAL OPTICAL METRICS:*
- Spliced Cores: ${record.coresCount} Cores
- Average Loss: ${Number(record.averageLossDb).toFixed(3)} dB / joint (Threshold ≤ 0.05 dB)
${record.insertionLossDb !== null ? `- Total Insertion Loss: ${record.insertionLossDb} dB (In: ${record.inputPowerDbm ?? '—'} dBm, Out: ${record.outputPowerDbm ?? '—'} dBm)\n` : ''}- Final Verdict: ${record.verdictLabel || record.verdict}

*ENCLOSURE INTEGRITY QA CHECKLIST:*
- Closure Gasket Sealed: ${checkSymbols(record.checklist?.closureSealed)}
- Trays & Bend Radius Organised: ${checkSymbols(record.checklist?.spliceTraysOrganized)}
- Cable Armor Clamped: ${checkSymbols(record.checklist?.cableTiesSecured)}
- Drop Pigtails Labeled: ${checkSymbols(record.checklist?.dropPigtailsLabeled)}
- Silica Gel Desiccant Replaced: ${checkSymbols(record.checklist?.silicaGelReplaced)}

*Notes:* ${record.notes || 'No defects recorded.'}
_Shahdara Outside Plant Maintenance QA Portal_`;
}

export function generateSpliceInspectionHtml(record, options = {}) {
  if (!record) return '<p>No inspection record provided.</p>';
  const format = options.format || 'standard'; // 'standard' (A4) or 'thermal' (80mm)
  const catObj = SPLICE_CATEGORIES.find(c => c.id === record.category);
  const catLabel = catObj ? catObj.label : (record.category || 'Standard');

  const checkBadge = (val) => val ? '<span style="color:#10b981;font-weight:bold;">[✔] PASS</span>' : '<span style="color:#ef4444;font-weight:bold;">[✘] FAIL</span>';

  if (format === 'thermal') {
    return `
      <div class="thermal-splice-slip" style="font-family:monospace;width:76mm;margin:0 auto;padding:6mm;background:#fff;color:#000;font-size:11px;line-height:1.35;">
        <div style="text-align:center;border-bottom:1px dashed #000;padding-bottom:5px;margin-bottom:6px;">
          <h2 style="font-size:14px;margin:0;font-weight:900;">SHAHDARA FIBER NET</h2>
          <p style="margin:2px 0 0;font-size:10px;">OSP Fiber Splicing QA Slip</p>
          <strong style="font-size:12px;">${record.id}</strong>
        </div>
        <div style="margin-bottom:6px;">
          <div>Date: <strong>${record.inspectionDate}</strong></div>
          <div>Pole/Node: <strong>${escapeHtml(record.enclosureId)}</strong></div>
          <div>Area: <strong>${escapeHtml(record.location)}</strong></div>
          <div>Splicer: <strong>${escapeHtml(record.inspectorName)}</strong></div>
          <div>Type: <strong>${escapeHtml(catLabel)}</strong></div>
        </div>
        <div style="border-top:1px dashed #000;border-bottom:1px dashed #000;padding:5px 0;margin:6px 0;">
          <div>Cores Spliced: <strong>${record.coresCount}</strong></div>
          <div>Avg Joint Loss: <strong>${Number(record.averageLossDb).toFixed(3)} dB</strong></div>
          ${record.insertionLossDb !== null ? `<div>Insertion Loss: <strong>${record.insertionLossDb} dB</strong></div>` : ''}
          <div style="margin-top:4px;font-size:12px;"><strong>VERDICT: ${escapeHtml(record.verdictLabel || record.verdict)}</strong></div>
        </div>
        <div style="font-size:10px;margin-bottom:6px;">
          <div>Sealed: ${record.checklist?.closureSealed ? 'YES' : 'NO'} | Trays: ${record.checklist?.spliceTraysOrganized ? 'YES' : 'NO'}</div>
          <div>Clamped: ${record.checklist?.cableTiesSecured ? 'YES' : 'NO'} | Labeled: ${record.checklist?.dropPigtailsLabeled ? 'YES' : 'NO'}</div>
          <div>Desiccant: ${record.checklist?.silicaGelReplaced ? 'YES' : 'NO'}</div>
        </div>
        <div style="border-top:1px dashed #000;padding-top:12px;margin-top:10px;text-align:center;font-size:10px;">
          <div>_______________________</div>
          <div>Splicer Sign &amp; Date</div>
        </div>
      </div>
    `;
  }

  return `
    <div class="splice-certificate-doc" style="max-width:800px;margin:0 auto;padding:24px;background:#fff;color:#182e2a;font-family:Manrope,system-ui,sans-serif;border:1px solid #e2ece7;border-radius:8px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0f766e;padding-bottom:14px;margin-bottom:18px;">
        <div>
          <h1 style="margin:0;font-size:20px;font-weight:900;color:#0f766e;letter-spacing:0.5px;">SHAHDARA FIBER NETWORK (PVT) LTD</h1>
          <p style="margin:3px 0 0;font-size:12px;color:#60756c;font-weight:600;">OSP Fiber Optic Splicing &amp; Joint Enclosure Quality Assurance Certificate</p>
          <p style="margin:2px 0 0;font-size:13px;font-weight:700;color:#134e4a;" dir="rtl">فائبر اسپلائسنگ و جوائنٹ کلوزر کوالٹی ایکسیپٹنس سرٹیفکیٹ</p>
        </div>
        <div style="text-align:right;">
          <div style="font-size:11px;font-weight:700;color:#60756c;">MANIFEST ID</div>
          <strong style="font-size:16px;color:#0f766e;font-family:monospace;">${record.id}</strong>
          <div style="font-size:11px;color:#60756c;margin-top:3px;">Dated: ${record.inspectionDate}</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px;background:#f8fafc;padding:14px;border-radius:6px;border:1px solid #e2e8f0;">
        <div>
          <div style="font-size:11px;color:#64748b;font-weight:700;">ENCLOSURE / POLE IDENTIFIER</div>
          <div style="font-size:14px;font-weight:800;color:#0f172a;">${escapeHtml(record.enclosureId)}</div>
          <div style="font-size:12px;color:#475569;margin-top:2px;">Location: ${escapeHtml(record.location)}</div>
        </div>
        <div>
          <div style="font-size:11px;color:#64748b;font-weight:700;">OPERATION CATEGORY &amp; SPLICER</div>
          <div style="font-size:13px;font-weight:800;color:#0f172a;">${escapeHtml(catLabel)}</div>
          <div style="font-size:12px;color:#475569;margin-top:2px;">Lead Technician: <strong>${escapeHtml(record.inspectorName)}</strong></div>
        </div>
      </div>

      <div style="margin-bottom:18px;">
        <h3 style="font-size:14px;margin:0 0 8px;font-weight:800;color:#0f766e;text-transform:uppercase;">1. Optical Splicing Telemetry</h3>
        <table style="width:100%;border-collapse:collapse;font-size:12.5px;">
          <thead>
            <tr style="background:#f1f5f9;text-align:left;">
              <th style="padding:6px 10px;border:1px solid #cbd5e1;">Cores Spliced</th>
              <th style="padding:6px 10px;border:1px solid #cbd5e1;">Average Joint Loss</th>
              <th style="padding:6px 10px;border:1px solid #cbd5e1;">Optical Input (dBm)</th>
              <th style="padding:6px 10px;border:1px solid #cbd5e1;">Optical Output (dBm)</th>
              <th style="padding:6px 10px;border:1px solid #cbd5e1;">Insertion Loss</th>
              <th style="padding:6px 10px;border:1px solid #cbd5e1;">QA Verdict</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding:8px 10px;border:1px solid #cbd5e1;font-weight:700;">${record.coresCount} Cores</td>
              <td style="padding:8px 10px;border:1px solid #cbd5e1;font-weight:800;color:#0284c7;">${Number(record.averageLossDb).toFixed(3)} dB / joint</td>
              <td style="padding:8px 10px;border:1px solid #cbd5e1;">${record.inputPowerDbm !== null ? `${record.inputPowerDbm} dBm` : '—'}</td>
              <td style="padding:8px 10px;border:1px solid #cbd5e1;">${record.outputPowerDbm !== null ? `${record.outputPowerDbm} dBm` : '—'}</td>
              <td style="padding:8px 10px;border:1px solid #cbd5e1;font-weight:700;">${record.insertionLossDb !== null ? `${record.insertionLossDb} dB` : '—'}</td>
              <td style="padding:8px 10px;border:1px solid #cbd5e1;font-weight:800;">${escapeHtml(record.verdictLabel || record.verdict)}</td>
            </tr>
          </tbody>
        </table>
        <div style="font-size:11px;color:#64748b;margin-top:4px;">* Standard Shahdara ISP tolerance: Single-mode G.652.D fusion splice loss must not exceed 0.05 dB per core.</div>
      </div>

      <div style="margin-bottom:18px;">
        <h3 style="font-size:14px;margin:0 0 8px;font-weight:800;color:#0f766e;text-transform:uppercase;">2. Physical Enclosure Integrity Checklist</h3>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <tbody>
            <tr>
              <td style="padding:6px 10px;border:1px solid #e2e8f0;width:75%;">Waterproof rubber gasket sealed &amp; mechanical bolts tightened against dust/rain:</td>
              <td style="padding:6px 10px;border:1px solid #e2e8f0;text-align:right;">${checkBadge(record.checklist?.closureSealed)}</td>
            </tr>
            <tr>
              <td style="padding:6px 10px;border:1px solid #e2e8f0;">Splice trays organized, heat shrink sleeves locked &amp; bend radius &gt; 30mm maintained:</td>
              <td style="padding:6px 10px;border:1px solid #e2e8f0;text-align:right;">${checkBadge(record.checklist?.spliceTraysOrganized)}</td>
            </tr>
            <tr>
              <td style="padding:6px 10px;border:1px solid #e2e8f0;">Strength member clamp secured &amp; cable armored ground wire bonded:</td>
              <td style="padding:6px 10px;border:1px solid #e2e8f0;text-align:right;">${checkBadge(record.checklist?.cableTiesSecured)}</td>
            </tr>
            <tr>
              <td style="padding:6px 10px;border:1px solid #e2e8f0;">Drop pigtails and fiber buffer tubes labeled with subscriber ferrule tags:</td>
              <td style="padding:6px 10px;border:1px solid #e2e8f0;text-align:right;">${checkBadge(record.checklist?.dropPigtailsLabeled)}</td>
            </tr>
            <tr>
              <td style="padding:6px 10px;border:1px solid #e2e8f0;">Silica gel moisture absorbing desiccant pack refreshed inside closure:</td>
              <td style="padding:6px 10px;border:1px solid #e2e8f0;text-align:right;">${checkBadge(record.checklist?.silicaGelReplaced)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style="margin-bottom:20px;background:#f8fafc;padding:10px 14px;border-radius:6px;border:1px solid #e2e8f0;font-size:12px;">
        <strong>Splicer Notes &amp; Observations:</strong> ${escapeHtml(record.notes || 'Enclosure cleared QA standards with zero microbends detected.')}
      </div>

      <div style="display:flex;justify-content:space-between;margin-top:28px;padding-top:14px;border-top:1px solid #cbd5e1;font-size:11px;color:#475569;">
        <div style="text-align:center;width:200px;">
          <div style="border-bottom:1px solid #000;padding-bottom:30px;margin-bottom:4px;"></div>
          <strong>Lead Splicer Signature</strong>
        </div>
        <div style="text-align:center;width:200px;">
          <div style="border-bottom:1px solid #000;padding-bottom:30px;margin-bottom:4px;"></div>
          <strong>OSP QA Manager / NOC Sign-off</strong>
        </div>
      </div>
    </div>
  `;
}

export function generateSpliceInspectionCsv(records = []) {
  const list = Array.isArray(records) ? records : [];
  const header = [
    'Inspection ID',
    'Date',
    'Enclosure / Pole ID',
    'Location',
    'Category',
    'Cores Spliced',
    'Average Joint Loss (dB)',
    'Input Power (dBm)',
    'Output Power (dBm)',
    'Insertion Loss (dB)',
    'Closure Sealed',
    'Trays Organized',
    'Cables Clamped',
    'Pigtails Labeled',
    'Silica Gel Replaced',
    'Verdict',
    'Inspector Name',
    'Notes'
  ];

  const rows = list.map(r => [
    r.id,
    r.inspectionDate,
    r.enclosureId,
    r.location,
    r.category,
    r.coresCount,
    r.averageLossDb,
    r.inputPowerDbm ?? '',
    r.outputPowerDbm ?? '',
    r.insertionLossDb ?? '',
    r.checklist?.closureSealed ? 'PASS' : 'FAIL',
    r.checklist?.spliceTraysOrganized ? 'PASS' : 'FAIL',
    r.checklist?.cableTiesSecured ? 'PASS' : 'FAIL',
    r.checklist?.dropPigtailsLabeled ? 'PASS' : 'FAIL',
    r.checklist?.silicaGelReplaced ? 'PASS' : 'FAIL',
    r.verdict,
    r.inspectorName,
    r.notes ?? ''
  ]);

  return generateCsvContent(header, rows);
}

export function setupSpliceInspectionModal({
  getState,
  storage = (typeof localStorage !== 'undefined' ? localStorage : null),
  onToast
} = {}) {
  if (typeof document === 'undefined') {
    return { recalculate: () => {}, open: () => {}, close: () => {} };
  }

  const modal = document.getElementById('spliceInspectionModal');
  const closeBtn = document.getElementById('spliceInspectionCloseBtn');
  const form = document.getElementById('spliceInspectionForm');

  const enclosureInput = document.getElementById('spliceEnclosureIdInput');
  const locationInput = document.getElementById('spliceLocationInput');
  const inspectorInput = document.getElementById('spliceInspectorInput');
  const dateInput = document.getElementById('spliceDateInput');
  const categorySelect = document.getElementById('spliceCategorySelect');
  const coresInput = document.getElementById('spliceCoresInput');
  const lossInput = document.getElementById('spliceLossInput');
  const inputPowerInput = document.getElementById('spliceInputPowerInput');
  const outputPowerInput = document.getElementById('spliceOutputPowerInput');
  const insertionLossDisplay = document.getElementById('spliceInsertionLossDisplay');
  const verdictPreviewBadge = document.getElementById('spliceVerdictPreviewBadge');
  const notesInput = document.getElementById('spliceNotesInput');

  // Checklist checkboxes
  const checkSealed = document.getElementById('spliceCheckSealed');
  const checkTrays = document.getElementById('spliceCheckTrays');
  const checkTies = document.getElementById('spliceCheckTies');
  const checkLabeled = document.getElementById('spliceCheckLabeled');
  const checkSilica = document.getElementById('spliceCheckSilica');

  // Metrics Ribbon
  const kpiTotal = document.getElementById('spliceKpiTotal');
  const kpiPassRate = document.getElementById('spliceKpiPassRate');
  const kpiAvgLoss = document.getElementById('spliceKpiAvgLoss');
  const kpiFailed = document.getElementById('spliceKpiFailed');

  // Toolbar & Table
  const filterVerdictSelect = document.getElementById('spliceFilterVerdictSelect');
  const filterCategorySelect = document.getElementById('spliceFilterCategorySelect');
  const searchInput = document.getElementById('spliceSearchInput');
  const tableBody = document.getElementById('spliceTableBody');
  const exportCsvBtn = document.getElementById('spliceExportCsvBtn');

  // Trigger buttons
  const openBtns = document.querySelectorAll('[data-open-splice-inspection]');

  let currentVerdictFilter = 'all';
  let currentCategoryFilter = 'all';
  let searchQuery = '';

  function recalculateLivePreview() {
    const inVal = inputPowerInput?.value;
    const outVal = outputPowerInput?.value;
    const insLoss = calculateSpliceInsertionLoss(inVal, outVal);
    if (insertionLossDisplay) {
      insertionLossDisplay.textContent = insLoss !== null ? `${insLoss} dB` : '—';
    }

    const lossVal = Number(lossInput?.value);
    const checklist = {
      closureSealed: Boolean(checkSealed?.checked),
      spliceTraysOrganized: Boolean(checkTrays?.checked),
      cableTiesSecured: Boolean(checkTies?.checked),
      dropPigtailsLabeled: Boolean(checkLabeled?.checked),
      silicaGelReplaced: Boolean(checkSilica?.checked)
    };

    const verdictObj = determineSpliceVerdict(lossVal, checklist);
    if (verdictPreviewBadge) {
      verdictPreviewBadge.textContent = verdictObj.label;
      verdictPreviewBadge.className = `splice-status-badge ${verdictObj.statusClass}`;
    }
  }

  function renderList() {
    const records = getSavedSpliceInspections(storage);
    const metrics = calculateSpliceInspectionMetrics(records, {
      category: currentCategoryFilter,
      verdict: currentVerdictFilter,
      search: searchQuery
    });

    if (kpiTotal) kpiTotal.textContent = String(metrics.totalInspections);
    if (kpiPassRate) kpiPassRate.textContent = `${metrics.passRatePct}%`;
    if (kpiAvgLoss) kpiAvgLoss.textContent = `${metrics.averageLossDb} dB`;
    if (kpiFailed) kpiFailed.textContent = `${metrics.reworkPendingCount} Rework`;

    if (!tableBody) return;

    if (!metrics.filteredRecords || metrics.filteredRecords.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center empty-muted" style="padding: 24px;">
            No fiber joint inspections found matching current filters.
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = metrics.filteredRecords.map(r => {
      const catObj = SPLICE_CATEGORIES.find(c => c.id === r.category);
      const catShort = catObj ? catObj.label.split('/')[0].trim() : r.category;
      return `
        <tr>
          <td><strong class="font-mono">${escapeHtml(r.id)}</strong></td>
          <td>${escapeHtml(r.inspectionDate)}</td>
          <td>
            <strong>${escapeHtml(r.enclosureId)}</strong>
            <div class="table-sub-meta">${escapeHtml(r.location)}</div>
          </td>
          <td>${escapeHtml(catShort)}</td>
          <td>${r.coresCount} cores</td>
          <td>
            <strong class="font-mono ${r.averageLossDb <= 0.05 ? 'highlight-green' : (r.averageLossDb <= 0.12 ? 'highlight-amber' : 'highlight-red')}">${Number(r.averageLossDb).toFixed(3)} dB</strong>
          </td>
          <td>
            <span class="splice-status-badge ${r.verdictClass || 'status-passed'}">${escapeHtml(r.verdictLabel || r.verdict)}</span>
          </td>
          <td>
            <div class="table-action-btn-group">
              <button type="button" class="action-btn-sm" data-splice-view="${escapeHtml(r.id)}" title="Print Certificate Slip">🖨️ Slip</button>
              <button type="button" class="action-btn-sm" data-splice-wa="${escapeHtml(r.id)}" title="Share on WhatsApp">💬 WA</button>
              ${r.verdict === 'FAILED_REWORK' ? `<button type="button" class="action-btn-sm highlight-green-btn" data-splice-pass="${escapeHtml(r.id)}" title="Mark Rework Passed">✔ Pass</button>` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Wire table row action buttons
    tableBody.querySelectorAll('[data-splice-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-splice-view');
        const rec = records.find(r => r.id === id);
        if (rec) {
          const html = generateSpliceInspectionHtml(rec, { format: 'standard' });
          const win = window.open('', '_blank');
          if (win) {
            win.document.write(`<!DOCTYPE html><html><head><title>${rec.id} - Splice QA Certificate</title><style>@page{size:A4;margin:10mm;}</style></head><body>${html}<script>window.print();</script></body></html>`);
            win.document.close();
          }
        }
      });
    });

    tableBody.querySelectorAll('[data-splice-wa]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-splice-wa');
        const rec = records.find(r => r.id === id);
        if (rec) {
          const text = formatSpliceInspectionWhatsApp(rec);
          const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
          window.open(url, '_blank');
          if (typeof onToast === 'function') onToast(`Opened WhatsApp for ${rec.id}`);
        }
      });
    });

    tableBody.querySelectorAll('[data-splice-pass]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-splice-pass');
        updateSpliceInspectionStatus(id, 'PASSED_CERTIFIED', 'Rework verified and certified by Lead Splicer.', storage);
        if (typeof onToast === 'function') onToast(`Marked ${id} as PASSED_CERTIFIED`);
        renderList();
      });
    });
  }

  // Live input events
  [lossInput, inputPowerInput, outputPowerInput, checkSealed, checkTrays, checkTies, checkLabeled, checkSilica].forEach(el => {
    if (el && !el.dataset?.wiredSplice) {
      if (el.dataset) el.dataset.wiredSplice = 'true';
      el.addEventListener('input', recalculateLivePreview);
      el.addEventListener('change', recalculateLivePreview);
    }
  });

  // Filter events
  if (filterVerdictSelect && !filterVerdictSelect.dataset?.wiredSplice) {
    if (filterVerdictSelect.dataset) filterVerdictSelect.dataset.wiredSplice = 'true';
    filterVerdictSelect.addEventListener('change', () => {
      currentVerdictFilter = filterVerdictSelect.value;
      renderList();
    });
  }

  if (filterCategorySelect && !filterCategorySelect.dataset?.wiredSplice) {
    if (filterCategorySelect.dataset) filterCategorySelect.dataset.wiredSplice = 'true';
    filterCategorySelect.addEventListener('change', () => {
      currentCategoryFilter = filterCategorySelect.value;
      renderList();
    });
  }

  if (searchInput && !searchInput.dataset?.wiredSplice) {
    if (searchInput.dataset) searchInput.dataset.wiredSplice = 'true';
    searchInput.addEventListener('input', () => {
      searchQuery = searchInput.value;
      renderList();
    });
  }

  // Form submission
  if (form && !form.dataset?.wiredSplice) {
    if (form.dataset) form.dataset.wiredSplice = 'true';
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const payload = {
        enclosureId: enclosureInput?.value,
        location: locationInput?.value,
        inspectorName: inspectorInput?.value,
        inspectionDate: dateInput?.value || new Date().toISOString().slice(0, 10),
        category: categorySelect?.value,
        coresCount: Number(coresInput?.value) || 1,
        averageLossDb: Number(lossInput?.value) || 0.03,
        inputPowerDbm: inputPowerInput?.value,
        outputPowerDbm: outputPowerInput?.value,
        checklist: {
          closureSealed: Boolean(checkSealed?.checked),
          spliceTraysOrganized: Boolean(checkTrays?.checked),
          cableTiesSecured: Boolean(checkTies?.checked),
          dropPigtailsLabeled: Boolean(checkLabeled?.checked),
          silicaGelReplaced: Boolean(checkSilica?.checked)
        },
        notes: notesInput?.value
      };

      const val = validateSpliceInspection(payload);
      if (!val.isValid) {
        if (typeof onToast === 'function') onToast(`Error: ${val.errors[0]}`);
        return;
      }

      const record = buildSpliceInspectionRecord(payload);
      saveSpliceInspection(record, storage);
      if (typeof onToast === 'function') onToast(`Logged Inspection ${record.id} (${record.verdictLabel})`);

      // Reset form
      form.reset();
      if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
      if (checkSealed) checkSealed.checked = true;
      if (checkTrays) checkTrays.checked = true;
      if (checkTies) checkTies.checked = true;
      if (checkLabeled) checkLabeled.checked = true;
      if (checkSilica) checkSilica.checked = true;
      recalculateLivePreview();
      renderList();
    });
  }

  // Export CSV
  if (exportCsvBtn && !exportCsvBtn.dataset?.wiredSplice) {
    if (exportCsvBtn.dataset) exportCsvBtn.dataset.wiredSplice = 'true';
    exportCsvBtn.addEventListener('click', () => {
      const records = getSavedSpliceInspections(storage);
      const csv = generateSpliceInspectionCsv(records);
      const filename = `shahdara_fiber_splice_inspections_${new Date().toISOString().slice(0, 10)}.csv`;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      if (typeof onToast === 'function') onToast(`Exported ${filename}`);
    });
  }

  openBtns.forEach(btn => {
    if (!btn.dataset?.wiredSpliceOpen) {
      if (btn.dataset) btn.dataset.wiredSpliceOpen = 'true';
      btn.addEventListener('click', () => {
        if (dateInput && !dateInput.value) {
          dateInput.value = new Date().toISOString().slice(0, 10);
        }
        recalculateLivePreview();
        renderList();
        if (typeof modal?.showModal === 'function') modal.showModal();
        else if (modal) modal.setAttribute('open', '');
      });
    }
  });

  if (closeBtn && !closeBtn.dataset?.wiredSplice) {
    if (closeBtn.dataset) closeBtn.dataset.wiredSplice = 'true';
    closeBtn.addEventListener('click', () => {
      if (typeof modal?.close === 'function') modal.close();
      else if (modal) modal.removeAttribute('open');
    });
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        if (typeof modal?.close === 'function') modal.close();
        else modal.removeAttribute('open');
      }
    });
  }

  return {
    recalculate: () => {
      recalculateLivePreview();
      renderList();
    },
    open: () => {
      if (dateInput && !dateInput.value) {
        dateInput.value = new Date().toISOString().slice(0, 10);
      }
      recalculateLivePreview();
      renderList();
      if (typeof modal?.showModal === 'function') modal.showModal();
      else if (modal) modal.setAttribute('open', '');
    },
    close: () => {
      if (typeof modal?.close === 'function') modal.close();
      else if (modal) modal.removeAttribute('open');
    }
  };
}

/* ==========================================================================
   CUSTOMER SERVICE PLAN MIGRATION & MID-CYCLE PRORATION VOUCHER SYSTEM
   (پیکج تبدیلی و اسپیڈ اپ گریڈ واؤچر)
   ========================================================================== */

export const PLAN_MIGRATIONS_KEY = 'shahdara_plan_migrations_v1';

export const MIGRATION_TYPES = {
  UPGRADE: 'UPGRADE',
  DOWNGRADE: 'DOWNGRADE',
  LATERAL_SWITCH: 'LATERAL_SWITCH',
  SUSPENSION_HOLD: 'SUSPENSION_HOLD'
};

export const MIGRATION_STATUSES = {
  COMPLETED: 'COMPLETED',
  PENDING_PROVISIONING: 'PENDING_PROVISIONING',
  CANCELLED_REVERTED: 'CANCELLED_REVERTED'
};

export const SHAHDARA_BROADBAND_PLANS = [
  { id: 'plan-10m', name: '10 Mbps Standard Basic', speedMbps: 10, monthlyPrice: 1200, category: 'Home Basic' },
  { id: 'plan-15m', name: '15 Mbps Family Streamer', speedMbps: 15, monthlyPrice: 1500, category: 'Residential' },
  { id: 'plan-25m', name: '25 Mbps Turbo Broadband', speedMbps: 25, monthlyPrice: 2000, category: 'Residential Pro' },
  { id: 'plan-40m', name: '40 Mbps Ultra Fiber HD', speedMbps: 40, monthlyPrice: 2800, category: 'High Speed' },
  { id: 'plan-60m', name: '60 Mbps Pro Power User', speedMbps: 60, monthlyPrice: 3800, category: 'Ultra Fast' },
  { id: 'plan-100m', name: '100 Mbps Gigabit Commercial', speedMbps: 100, monthlyPrice: 5500, category: 'Commercial' }
];

/**
 * Calculates days in a calendar month for a given ISO date.
 */
export function getDaysInCalendarMonth(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  if (isNaN(d.getTime())) return 30;
  const year = d.getFullYear();
  const month = d.getMonth();
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Calculates mathematical mid-cycle proration for plan migrations.
 */
export function calculatePlanMigrationProration(currentRate, targetRate, effectiveDateStr, customDaysInMonth = null) {
  const cRate = Math.max(0, Number(currentRate) || 0);
  const tRate = Math.max(0, Number(targetRate) || 0);
  
  const d = effectiveDateStr ? new Date(effectiveDateStr) : new Date();
  const effectiveDay = isNaN(d.getTime()) ? 1 : Math.max(1, d.getDate());
  const daysInMonth = Number(customDaysInMonth) || getDaysInCalendarMonth(effectiveDateStr);

  const clampedDay = Math.min(daysInMonth, effectiveDay);
  const daysElapsed = clampedDay - 1;
  const daysRemaining = daysInMonth - daysElapsed;

  const dailyOldRate = Math.round((cRate / daysInMonth) * 100) / 100;
  const dailyNewRate = Math.round((tRate / daysInMonth) * 100) / 100;

  // Unearned old plan credit for remaining days
  const oldPlanCredit = Math.round((cRate / daysInMonth) * daysRemaining);
  // Prorated new plan charge for remaining days
  const newPlanCharge = Math.round((tRate / daysInMonth) * daysRemaining);

  const netAdjustment = newPlanCharge - oldPlanCredit;
  const mrrDelta = tRate - cRate;

  let actionLabel = 'Lateral Exchange';
  if (netAdjustment > 0) {
    actionLabel = `Subscriber Owes +PKR ${netAdjustment.toLocaleString()}`;
  } else if (netAdjustment < 0) {
    actionLabel = `Credit Refund PKR ${Math.abs(netAdjustment).toLocaleString()}`;
  } else {
    actionLabel = 'Zero Difference';
  }

  return {
    daysInMonth,
    effectiveDay: clampedDay,
    daysElapsed,
    daysRemaining,
    dailyOldRate,
    dailyNewRate,
    oldPlanCredit,
    newPlanCharge,
    netAdjustment,
    mrrDelta,
    actionLabel
  };
}

/**
 * Parses numeric speed in Mbps from a package title string.
 */
export function parseSpeedFromPlanName(planName) {
  if (!planName) return 15;
  const match = String(planName).match(/(\d+)\s*(?:mbps|mb|m)/i);
  return match ? parseInt(match[1], 10) : 15;
}

/**
 * Assesses bandwidth delta and hardware compatibility between plans.
 */
export function assessPlanCompatibility(currentPlan, targetPlan, ontPortType = 'GE') {
  const curSpeed = parseSpeedFromPlanName(currentPlan);
  const tgtSpeed = parseSpeedFromPlanName(targetPlan);
  const speedDelta = tgtSpeed - curSpeed;

  let migrationType = MIGRATION_TYPES.LATERAL_SWITCH;
  if (speedDelta > 0) {
    migrationType = MIGRATION_TYPES.UPGRADE;
  } else if (speedDelta < 0) {
    migrationType = MIGRATION_TYPES.DOWNGRADE;
  }

  const isFE = String(ontPortType).toUpperCase() === 'FE';
  let isHardwareCompatible = true;
  let warningNotice = null;

  if (isFE && tgtSpeed > 100) {
    isHardwareCompatible = false;
    warningNotice = 'FastEthernet ONT hardware bottleneck: subscriber ONT cannot negotiate speeds above 100 Mbps. Gigabit ONT swap required.';
  } else if (isFE && tgtSpeed >= 80) {
    warningNotice = 'Subscribers on FastEthernet ONT may experience throughput capping near 85-90 Mbps due to Ethernet framing overhead.';
  }

  return {
    migrationType,
    currentSpeed: curSpeed,
    targetSpeed: tgtSpeed,
    speedDelta,
    isHardwareCompatible,
    warningNotice
  };
}

/**
 * Validates input for creating a plan migration record.
 */
export function validatePlanMigration(formData = {}) {
  const errors = [];

  if (!formData.customerId || !String(formData.customerId).trim()) {
    errors.push('Subscriber profile selection is required.');
  }

  if (!formData.currentPlan || !String(formData.currentPlan).trim()) {
    errors.push('Current plan specification is required.');
  }

  if (!formData.targetPlan || !String(formData.targetPlan).trim()) {
    errors.push('Target plan specification is required.');
  } else if (String(formData.currentPlan).trim().toLowerCase() === String(formData.targetPlan).trim().toLowerCase()) {
    errors.push('Target plan must be different from current active plan.');
  }

  if (formData.targetRate == null || isNaN(Number(formData.targetRate)) || Number(formData.targetRate) <= 0) {
    errors.push('Target monthly rate must be a valid positive amount.');
  }

  if (!formData.effectiveDate || !/^\d{4}-\d{2}-\d{2}$/.test(formData.effectiveDate)) {
    errors.push('Valid effective date (YYYY-MM-DD) is required.');
  }

  if (!formData.authorizedBy || String(formData.authorizedBy).trim().length < 3) {
    errors.push('Authorizing NOC/billing operator name is required (minimum 3 characters).');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Builds an immutable, sequentially identified Plan Migration voucher record.
 */
export function buildPlanMigrationRecord(data = {}) {
  const now = new Date();
  const yearMonth = now.toISOString().slice(0, 7).replace('-', '');
  const randSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const id = `MIG-${yearMonth}-${randSuffix}`;

  const currentRate = Number(data.currentRate) || 0;
  const targetRate = Number(data.targetRate) || 0;
  const effectiveDate = data.effectiveDate || now.toISOString().slice(0, 10);

  const proration = calculatePlanMigrationProration(currentRate, targetRate, effectiveDate);
  const compatibility = assessPlanCompatibility(data.currentPlan, data.targetPlan, data.ontPortType || 'GE');

  return {
    id,
    timestamp: data.timestamp || now.toISOString(),
    customerId: String(data.customerId || '').trim(),
    customerName: String(data.customerName || 'Subscriber').trim(),
    customerPhone: String(data.customerPhone || '').trim(),
    customerArea: String(data.customerArea || '').trim(),
    currentPlan: String(data.currentPlan || '').trim(),
    currentRate,
    targetPlan: String(data.targetPlan || '').trim(),
    targetRate,
    effectiveDate,
    migrationType: compatibility.migrationType,
    speedDelta: compatibility.speedDelta,
    proration,
    compatibility,
    netAdjustment: proration.netAdjustment,
    mrrDelta: proration.mrrDelta,
    status: data.status || MIGRATION_STATUSES.COMPLETED,
    notes: String(data.notes || '').trim(),
    authorizedBy: String(data.authorizedBy || 'Shahdara NOC').trim()
  };
}

/**
 * Retrieves saved plan migration vouchers from local storage.
 */
export function getSavedPlanMigrations(storage = null) {
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store) return [];
  try {
    const raw = store.getItem(PLAN_MIGRATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Saves a plan migration voucher into local storage.
 */
export function savePlanMigration(record, storage = null) {
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store || !record) return false;
  try {
    const records = getSavedPlanMigrations(store);
    records.unshift(record);
    store.setItem(PLAN_MIGRATIONS_KEY, JSON.stringify(records));
    return true;
  } catch {
    return false;
  }
}

/**
 * Updates the status of a saved plan migration voucher.
 */
export function updatePlanMigrationStatus(id, newStatus, storage = null) {
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store || !id) return false;
  try {
    const records = getSavedPlanMigrations(store);
    const index = records.findIndex(r => r.id === id);
    if (index === -1) return false;
    records[index].status = newStatus;
    records[index].updatedAt = new Date().toISOString();
    store.setItem(PLAN_MIGRATIONS_KEY, JSON.stringify(records));
    return true;
  } catch {
    return false;
  }
}

/**
 * Clears saved plan migration records (used for testing or resetting).
 */
export function clearPlanMigrations(storage = null) {
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store) return false;
  try {
    store.removeItem(PLAN_MIGRATIONS_KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * Calculates aggregate performance and financial metrics across plan migrations.
 */
export function calculatePlanMigrationMetrics(records = [], options = {}) {
  const list = Array.isArray(records) ? records : [];
  const { searchQuery = '', filterType = 'ALL' } = options;

  let totalMigrations = 0;
  let upgradeCount = 0;
  let downgradeCount = 0;
  let lateralCount = 0;
  let totalNetAdjustmentPkr = 0;
  let totalMrrDeltaPkr = 0;

  const filtered = list.filter(r => {
    if (filterType !== 'ALL' && r.migrationType !== filterType) {
      return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = String(r.customerName || '').toLowerCase().includes(q);
      const matchId = String(r.customerId || '').toLowerCase().includes(q);
      const matchVoucher = String(r.id || '').toLowerCase().includes(q);
      const matchPlan = String(r.targetPlan || '').toLowerCase().includes(q);
      if (!matchName && !matchId && !matchVoucher && !matchPlan) return false;
    }
    return true;
  });

  list.forEach(r => {
    totalMigrations++;
    if (r.migrationType === MIGRATION_TYPES.UPGRADE) upgradeCount++;
    else if (r.migrationType === MIGRATION_TYPES.DOWNGRADE) downgradeCount++;
    else lateralCount++;

    totalNetAdjustmentPkr += (Number(r.netAdjustment) || 0);
    totalMrrDeltaPkr += (Number(r.mrrDelta) || 0);
  });

  const upgradeRatePct = totalMigrations > 0 ? Math.round((upgradeCount / totalMigrations) * 100) : 0;

  return {
    totalMigrations,
    upgradeCount,
    downgradeCount,
    lateralCount,
    upgradeRatePct,
    totalNetAdjustmentPkr,
    totalMrrDeltaPkr,
    filteredRecords: filtered
  };
}

/**
 * Formats a bilingual Urdu & English WhatsApp subscriber dispatch slip.
 */
export function formatPlanMigrationWhatsApp(record) {
  if (!record) return '';
  const p = record.proration || {};
  const deltaSign = (record.speedDelta || 0) > 0 ? `+${record.speedDelta} Mbps` : `${record.speedDelta || 0} Mbps`;
  const adjText = record.netAdjustment > 0
    ? `Payable Now: PKR ${record.netAdjustment.toLocaleString()}`
    : (record.netAdjustment < 0 ? `Credit Balance: PKR ${Math.abs(record.netAdjustment).toLocaleString()}` : `Net Difference: PKR 0`);

  return [
    `================================================================`,
    `📡 SHAHDARA FIBER NET — PLAN MIGRATION VOUCHER`,
    `واؤچر تبدیلی پیکج و اسپیڈ اپ گریڈ`,
    `================================================================`,
    `Voucher Ref : ${record.id}`,
    `Subscriber  : ${record.customerName} [${record.customerId}]`,
    `Area/Sector : ${record.customerArea || 'Shahdara Core'}`,
    `Effective   : ${record.effectiveDate}`,
    ``,
    `PACKAGE TRANSITION / پیکج کی تفصیل:`,
    `  • Previous Plan : ${record.currentPlan} (PKR ${record.currentRate?.toLocaleString()}/mo)`,
    `  • New Plan      : ${record.targetPlan} (PKR ${record.targetRate?.toLocaleString()}/mo)`,
    `  • Bandwidth Δ   : ${deltaSign} Speed Adjustment`,
    `  • Migration     : ${record.migrationType}`,
    ``,
    `MID-CYCLE PRORATION / درمیانی ایام کا حساب:`,
    `  • Month Length  : ${p.daysInMonth || 30} Days (Effective Day: ${p.effectiveDay || 1})`,
    `  • Days on Old   : ${p.daysElapsed || 0} days`,
    `  • Days on New   : ${p.daysRemaining || 30} days`,
    `  • Unearned Cr.  : PKR ${(p.oldPlanCredit || 0).toLocaleString()}`,
    `  • Prorated Chg. : PKR ${(p.newPlanCharge || 0).toLocaleString()}`,
    `  • ${adjText}`,
    ``,
    `NOTICE & ADVISORY / اہم ہدایات:`,
    `  1. Please power-cycle your optical fiber router for 30 seconds to lock onto the new OLT profile bandwidth.`,
    `  2. آئندہ ماہانہ بل میں نئے پیکج کے مطابق ریٹ وصول کیا جائے گا۔`,
    `  3. Support Helpline: 0300-1234567 | Shahdara NOC`,
    `================================================================`,
    `* Digital Provisioning Approved by ${record.authorizedBy} *`
  ].join('\n');
}

/**
 * Generates printable HTML documents (A4 Sheet and 80mm POS Thermal Slip).
 */
export function generatePlanMigrationHtml(record, options = {}) {
  if (!record) return '<p>No migration record provided.</p>';
  const format = options.format === 'thermal' ? 'thermal' : 'standard';
  const p = record.proration || {};
  const c = record.compatibility || {};

  function esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  if (format === 'thermal') {
    return `
      <div class="thermal-migration-slip" style="width: 280px; font-family: monospace; font-size: 11px; padding: 6px; color: #000; line-height: 1.4;">
        <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px;">
          <strong style="font-size: 13px;">SHAHDARA FIBER NET</strong><br>
          <span>PLAN MIGRATION RECEIPT</span><br>
          <small>Ref: ${esc(record.id)}</small>
        </div>
        <div>
          <strong>Subscriber:</strong> ${esc(record.customerName)}<br>
          <strong>ID:</strong> ${esc(record.customerId)} | ${esc(record.customerArea)}<br>
          <strong>Date:</strong> ${esc(record.effectiveDate)}
        </div>
        <div style="border-top: 1px dashed #000; margin: 6px 0; padding-top: 6px;">
          <strong>OLD:</strong> ${esc(record.currentPlan)}<br>
          <strong>NEW:</strong> ${esc(record.targetPlan)}<br>
          <strong>Bandwidth:</strong> ${record.speedDelta > 0 ? '+' : ''}${record.speedDelta} Mbps (${esc(record.migrationType)})
        </div>
        <div style="border-top: 1px dashed #000; margin: 6px 0; padding-top: 6px;">
          Days Old: ${p.daysElapsed} | Days New: ${p.daysRemaining}<br>
          Old Credit: PKR ${(p.oldPlanCredit || 0).toLocaleString()}<br>
          New Charge: PKR ${(p.newPlanCharge || 0).toLocaleString()}<br>
          <strong style="font-size: 12px;">NET: PKR ${(record.netAdjustment || 0).toLocaleString()}</strong>
        </div>
        <div style="border-top: 1px dashed #000; padding-top: 6px; text-align: center; font-size: 10px;">
          Please reboot your ONT router.<br>
          Helpline: 0300-1234567<br>
          Auth: ${esc(record.authorizedBy)}
        </div>
      </div>
    `;
  }

  return `
    <div class="plan-migration-document" style="font-family: 'DM Sans', system-ui, sans-serif; padding: 24px; color: #1e293b; max-width: 760px; margin: 0 auto; background: #ffffff;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0e5b4d; padding-bottom: 14px; margin-bottom: 20px;">
        <div>
          <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #0e5b4d; letter-spacing: -0.02em;">SHAHDARA FIBER NET</h1>
          <p style="margin: 4px 0 0; font-size: 12px; color: #64748b; font-weight: 600;">SERVICE PLAN MIGRATION &amp; BANDWIDTH UPGRADE VOUCHER</p>
          <p style="margin: 2px 0 0; font-size: 11px; color: #059669; font-weight: 700;">واؤچر تبدیلی و تجدید براڈ بینڈ پیکج</p>
        </div>
        <div style="text-align: right;">
          <div style="font-family: monospace; font-size: 13px; font-weight: 800; color: #0e5b4d;">${esc(record.id)}</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Effective: <strong>${esc(record.effectiveDate)}</strong></div>
          <span style="display: inline-block; margin-top: 6px; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; background: ${record.migrationType === 'UPGRADE' ? '#d1fae5' : '#fef3c7'}; color: ${record.migrationType === 'UPGRADE' ? '#065f46' : '#92400e'};">
            ${esc(record.migrationType)} (${record.speedDelta > 0 ? '+' : ''}${record.speedDelta} Mbps)
          </span>
        </div>
      </div>

      <!-- Subscriber Info Ribbon -->
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 20px;">
        <div>
          <span style="font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 700;">SUBSCRIBER</span>
          <div style="font-size: 13px; font-weight: 700; color: #0f172a;">${esc(record.customerName)}</div>
          <div style="font-size: 11px; color: #64748b;">ID: ${esc(record.customerId)}</div>
        </div>
        <div>
          <span style="font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 700;">SECTOR &amp; PHONE</span>
          <div style="font-size: 13px; font-weight: 600; color: #0f172a;">${esc(record.customerArea || 'Shahdara Core')}</div>
          <div style="font-size: 11px; color: #64748b;">${esc(record.customerPhone || '—')}</div>
        </div>
        <div>
          <span style="font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 700;">PROVISIONING STATUS</span>
          <div style="font-size: 13px; font-weight: 700; color: #059669;">${esc(record.status)}</div>
          <div style="font-size: 11px; color: #64748b;">By: ${esc(record.authorizedBy)}</div>
        </div>
      </div>

      <!-- Plan Comparison Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px;">
        <thead>
          <tr style="background: #f1f5f9;">
            <th style="padding: 8px 10px; text-align: left; border: 1px solid #e2e8f0;">Plan Component</th>
            <th style="padding: 8px 10px; text-align: left; border: 1px solid #e2e8f0;">Previous Plan (سابقہ پیکج)</th>
            <th style="padding: 8px 10px; text-align: left; border: 1px solid #e2e8f0; background: #f0fdf4;">New Target Plan (نیا پیکج)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding: 8px 10px; border: 1px solid #e2e8f0; font-weight: 600;">Service Plan Name</td>
            <td style="padding: 8px 10px; border: 1px solid #e2e8f0;">${esc(record.currentPlan)}</td>
            <td style="padding: 8px 10px; border: 1px solid #e2e8f0; font-weight: 700; color: #0e5b4d; background: #f0fdf4;">${esc(record.targetPlan)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 10px; border: 1px solid #e2e8f0; font-weight: 600;">Allocated Bandwidth</td>
            <td style="padding: 8px 10px; border: 1px solid #e2e8f0;">${c.currentSpeed || 15} Mbps</td>
            <td style="padding: 8px 10px; border: 1px solid #e2e8f0; font-weight: 700; color: #0e5b4d; background: #f0fdf4;">${c.targetSpeed || 25} Mbps (${record.speedDelta > 0 ? '+' : ''}${record.speedDelta} Mbps)</td>
          </tr>
          <tr>
            <td style="padding: 8px 10px; border: 1px solid #e2e8f0; font-weight: 600;">Monthly Tariff (PKR)</td>
            <td style="padding: 8px 10px; border: 1px solid #e2e8f0;">PKR ${(record.currentRate || 0).toLocaleString()}</td>
            <td style="padding: 8px 10px; border: 1px solid #e2e8f0; font-weight: 700; color: #0e5b4d; background: #f0fdf4;">PKR ${(record.targetRate || 0).toLocaleString()} (MRR Δ: PKR ${(record.mrrDelta || 0).toLocaleString()})</td>
          </tr>
        </tbody>
      </table>

      <!-- Proration Settlement Card -->
      <div style="background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 8px; padding: 14px; margin-bottom: 20px;">
        <h4 style="margin: 0 0 10px; font-size: 13px; color: #0e5b4d; text-transform: uppercase;">Mid-Cycle Proration Calculation (درمیانی ایام کا گوشوارہ)</h4>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; font-size: 11.5px;">
          <div>
            <span style="color: #78716c;">Billing Month Days:</span><br>
            <strong>${p.daysInMonth || 30} Days</strong>
          </div>
          <div>
            <span style="color: #78716c;">Days on Old Plan:</span><br>
            <strong>${p.daysElapsed || 0} Days</strong>
          </div>
          <div>
            <span style="color: #78716c;">Days on New Plan:</span><br>
            <strong>${p.daysRemaining || 30} Days</strong>
          </div>
          <div>
            <span style="color: #78716c;">Net Proration Due:</span><br>
            <strong style="font-size: 14px; color: ${record.netAdjustment > 0 ? '#b91c1c' : '#047857'};">
              PKR ${(record.netAdjustment || 0).toLocaleString()}
            </strong>
          </div>
        </div>
        <div style="margin-top: 10px; font-size: 11px; color: #78716c; border-top: 1px dashed #d6d3d1; padding-top: 8px;">
          Unearned Credit from Old Plan: <strong>PKR ${(p.oldPlanCredit || 0).toLocaleString()}</strong> &nbsp;|&nbsp; 
          Prorated Charge for New Plan: <strong>PKR ${(p.newPlanCharge || 0).toLocaleString()}</strong>
        </div>
      </div>

      <!-- Notes -->
      ${record.notes ? `
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; margin-bottom: 20px; font-size: 11.5px;">
          <strong>Technician / NOC Notes:</strong> ${esc(record.notes)}
        </div>
      ` : ''}

      <!-- Signatures -->
      <div style="display: flex; justify-content: space-between; margin-top: 40px; border-top: 1px solid #cbd5e1; padding-top: 14px; font-size: 11px;">
        <div>
          <strong>Subscriber Acceptance:</strong><br>
          <span style="display: inline-block; margin-top: 25px; border-top: 1px solid #94a3b8; width: 180px; text-align: center;">Customer Signature</span>
        </div>
        <div style="text-align: right;">
          <strong>Authorized by Shahdara ISP NOC:</strong><br>
          <span style="display: inline-block; margin-top: 25px; border-top: 1px solid #94a3b8; width: 180px; text-align: center;">NOC Engineer / Stamp</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Generates RFC-4180 CSV export of plan migrations with UTF-8 BOM.
 */
export function generatePlanMigrationsCsv(records = []) {
  const list = Array.isArray(records) ? records : [];
  const headers = [
    'Voucher ID',
    'Timestamp',
    'Customer ID',
    'Subscriber Name',
    'Phone',
    'Area',
    'Current Plan',
    'Current Rate PKR',
    'Target Plan',
    'Target Rate PKR',
    'Effective Date',
    'Migration Type',
    'Speed Delta Mbps',
    'Days Elapsed',
    'Days Remaining',
    'Unearned Credit PKR',
    'Prorated Charge PKR',
    'Net Adjustment PKR',
    'MRR Delta PKR',
    'Status',
    'Authorized By',
    'Notes'
  ];

  const escapeCell = (v) => {
    const s = String(v ?? '').replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = [headers.map(escapeCell).join(',')];
  list.forEach(r => {
    const p = r.proration || {};
    rows.push([
      escapeCell(r.id),
      escapeCell(r.timestamp),
      escapeCell(r.customerId),
      escapeCell(r.customerName),
      escapeCell(r.customerPhone),
      escapeCell(r.customerArea),
      escapeCell(r.currentPlan),
      escapeCell(r.currentRate),
      escapeCell(r.targetPlan),
      escapeCell(r.targetRate),
      escapeCell(r.effectiveDate),
      escapeCell(r.migrationType),
      escapeCell(r.speedDelta),
      escapeCell(p.daysElapsed),
      escapeCell(p.daysRemaining),
      escapeCell(p.oldPlanCredit),
      escapeCell(p.newPlanCharge),
      escapeCell(r.netAdjustment),
      escapeCell(r.mrrDelta),
      escapeCell(r.status),
      escapeCell(r.authorizedBy),
      escapeCell(r.notes)
    ].join(','));
  });

  return '\uFEFF' + rows.join('\r\n');
}

/**
 * Sets up and wires the Plan Migration & Mid-Cycle Proration dialog modal.
 */
export function setupPlanMigrationModal(options = {}) {
  const {
    getState = () => ({}),
    storage = null,
    onToast = null,
    onMigrationSaved = null,
    clipboard = null
  } = options;

  if (typeof document === 'undefined') {
    return { open: () => {}, close: () => {}, recalculate: () => {} };
  }

  const modal = document.getElementById('customerPlanMigrationModal');
  const openBtns = document.querySelectorAll('[data-open-plan-migration], #openPlanMigrationBtn');
  const closeBtn = document.getElementById('planMigrationCloseBtn');

  // Customer context fields
  const customerNameEl = document.getElementById('migCustomerName');
  const customerMetaEl = document.getElementById('migCustomerMeta');
  const currentPlanEl = document.getElementById('migCurrentPlan');
  const currentRateEl = document.getElementById('migCurrentRate');

  // Form controls
  const targetPlanSelect = document.getElementById('migTargetPlanSelect');
  const targetRateInput = document.getElementById('migTargetRateInput');
  const effectiveDateInput = document.getElementById('migEffectiveDateInput');
  const ontPortSelect = document.getElementById('migOntPortSelect');
  const notesInput = document.getElementById('migNotesInput');
  const authorizerInput = document.getElementById('migAuthorizerInput');

  // Preview elements
  const speedDeltaBadge = document.getElementById('migSpeedDeltaBadge');
  const prorationSummaryBox = document.getElementById('migProrationSummaryBox');
  const netDueVal = document.getElementById('migNetDueVal');
  const mrrDeltaVal = document.getElementById('migMrrDeltaVal');
  const hardwareWarningBanner = document.getElementById('migHardwareWarningBanner');

  // Actions
  const submitBtn = document.getElementById('planMigrationSubmitBtn');
  const printA4Btn = document.getElementById('planMigrationPrintA4Btn');
  const printThermalBtn = document.getElementById('planMigrationPrintThermalBtn');
  const copyWhatsAppBtn = document.getElementById('planMigrationCopyWhatsAppBtn');
  const exportCsvBtn = document.getElementById('planMigrationExportCsvBtn');

  // Audit table & filter elements
  const filterTypeSelect = document.getElementById('migFilterTypeSelect');
  const searchInput = document.getElementById('migSearchInput');
  const tableBody = document.getElementById('migHistoryTableBody');
  const countBadge = document.getElementById('migTotalCountBadge');
  const kpiUpgrades = document.getElementById('migKpiUpgrades');
  const kpiNetMrr = document.getElementById('migKpiNetMrr');
  const kpiProratedTotal = document.getElementById('migKpiProratedTotal');

  let activeCustomer = null;
  let lastRecordedRecord = null;

  function populatePlanSelect() {
    if (targetPlanSelect && targetPlanSelect.children.length === 0) {
      SHAHDARA_BROADBAND_PLANS.forEach(plan => {
        const opt = document.createElement('option');
        opt.value = plan.name;
        opt.dataset.price = String(plan.monthlyPrice);
        opt.dataset.speed = String(plan.speedMbps);
        opt.textContent = `${plan.name} — PKR ${plan.monthlyPrice.toLocaleString()}/mo`;
        targetPlanSelect.appendChild(opt);
      });
    }
  }

  function getSelectedTargetPlanInfo() {
    const selectedOpt = targetPlanSelect?.selectedOptions?.[0];
    const planName = targetPlanSelect?.value || '25 Mbps Turbo Broadband';
    const price = selectedOpt ? Number(selectedOpt.dataset.price) : 2000;
    const speed = selectedOpt ? Number(selectedOpt.dataset.speed) : 25;
    return { planName, price, speed };
  }

  function recalculateLivePreview() {
    const state = typeof getState === 'function' ? getState() : {};
    const curPlan = activeCustomer?.package || activeCustomer?.plan || '15 Mbps Family Streamer';
    const curRate = Number(activeCustomer?.monthlyFee ?? activeCustomer?.rate ?? 1500) || 1500;

    const tgtPlan = targetPlanSelect?.value || '25 Mbps Turbo Broadband';
    const tgtRate = Number(targetRateInput?.value) || 2000;
    const effDate = effectiveDateInput?.value || new Date().toISOString().slice(0, 10);
    const ontPort = ontPortSelect?.value || 'GE';

    const proration = calculatePlanMigrationProration(curRate, tgtRate, effDate);
    const compat = assessPlanCompatibility(curPlan, tgtPlan, ontPort);

    if (speedDeltaBadge) {
      const sign = compat.speedDelta > 0 ? '+' : '';
      speedDeltaBadge.textContent = `${sign}${compat.speedDelta} Mbps (${compat.migrationType})`;
      speedDeltaBadge.className = `sim-delta-badge ${compat.migrationType === 'UPGRADE' ? 'badge-success' : (compat.migrationType === 'DOWNGRADE' ? 'badge-warning' : 'badge-info')}`;
    }

    if (netDueVal) {
      netDueVal.textContent = `PKR ${proration.netAdjustment.toLocaleString()}`;
      netDueVal.style.color = proration.netAdjustment > 0 ? '#b91c1c' : (proration.netAdjustment < 0 ? '#047857' : 'inherit');
    }

    if (mrrDeltaVal) {
      const sign = proration.mrrDelta > 0 ? '+' : '';
      mrrDeltaVal.textContent = `${sign}PKR ${proration.mrrDelta.toLocaleString()}/mo`;
      mrrDeltaVal.style.color = proration.mrrDelta > 0 ? '#047857' : (proration.mrrDelta < 0 ? '#b91c1c' : 'inherit');
    }

    if (prorationSummaryBox) {
      prorationSummaryBox.innerHTML = `
        <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:11px;">
          <span>Billing Month Length: <strong>${proration.daysInMonth} Days</strong></span>
          <span>Effective Day: <strong>Day ${proration.effectiveDay}</strong></span>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:11px;">
          <span>Days on Old Plan: <strong>${proration.daysElapsed} days</strong> (Cr: PKR ${proration.oldPlanCredit.toLocaleString()})</span>
          <span>Days on New Plan: <strong>${proration.daysRemaining} days</strong> (Chg: PKR ${proration.newPlanCharge.toLocaleString()})</span>
        </div>
      `;
    }

    if (hardwareWarningBanner) {
      if (compat.warningNotice) {
        hardwareWarningBanner.textContent = compat.warningNotice;
        hardwareWarningBanner.removeAttribute('hidden');
      } else {
        hardwareWarningBanner.setAttribute('hidden', '');
      }
    }
  }

  function renderList() {
    const records = getSavedPlanMigrations(storage);
    const filter = filterTypeSelect?.value || 'ALL';
    const query = searchInput?.value || '';

    const metrics = calculatePlanMigrationMetrics(records, { filterType: filter, searchQuery: query });

    if (countBadge) countBadge.textContent = `${metrics.filteredRecords.length} records`;
    if (kpiUpgrades) kpiUpgrades.textContent = `${metrics.upgradeCount} (${metrics.upgradeRatePct}%)`;
    if (kpiNetMrr) kpiNetMrr.textContent = `+PKR ${metrics.totalMrrDeltaPkr.toLocaleString()}`;
    if (kpiProratedTotal) kpiProratedTotal.textContent = `PKR ${metrics.totalNetAdjustmentPkr.toLocaleString()}`;

    if (tableBody) {
      if (metrics.filteredRecords.length === 0) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align:center; padding:18px; color:var(--muted, #64748b);">
              No plan migration records match the criteria.
            </td>
          </tr>
        `;
      } else {
        tableBody.innerHTML = metrics.filteredRecords.map(r => {
          const p = r.proration || {};
          const isUp = r.migrationType === 'UPGRADE';
          return `
            <tr>
              <td>
                <strong>${r.customerName}</strong>
                <div style="font-size:10px; color:var(--muted, #64748b);">${r.customerId} · ${r.customerArea || 'Shahdara'}</div>
              </td>
              <td>
                <div>${r.currentPlan}</div>
                <div style="font-size:10px; color:var(--muted, #64748b);">PKR ${r.currentRate?.toLocaleString()}/mo</div>
              </td>
              <td>
                <strong style="color:var(--brand-teal, #0e5b4d);">${r.targetPlan}</strong>
                <div style="font-size:10px; color:var(--muted, #64748b);">PKR ${r.targetRate?.toLocaleString()}/mo</div>
              </td>
              <td>
                <span class="sim-delta-badge ${isUp ? 'badge-success' : 'badge-warning'}" style="font-size:10px;">
                  ${r.migrationType} (${r.speedDelta > 0 ? '+' : ''}${r.speedDelta}M)
                </span>
              </td>
              <td>
                <strong>PKR ${r.netAdjustment?.toLocaleString()}</strong>
                <div style="font-size:10px; color:var(--muted, #64748b);">Day ${p.effectiveDay}/${p.daysInMonth}</div>
              </td>
              <td><span style="font-family:monospace; font-size:11px;">${r.effectiveDate}</span></td>
              <td>
                <button type="button" class="table-action-btn" data-print-mig="${r.id}" title="Print Voucher" style="padding:2px 6px; font-size:11px;">🖨️</button>
                <button type="button" class="table-action-btn" data-wa-mig="${r.id}" title="WhatsApp Slip" style="padding:2px 6px; font-size:11px;">💬</button>
              </td>
            </tr>
          `;
        }).join('');

        tableBody.querySelectorAll('[data-print-mig]').forEach(b => {
          b.addEventListener('click', () => {
            const id = b.dataset.printMig;
            const item = records.find(x => x.id === id);
            if (item) {
              const html = generatePlanMigrationHtml(item, { format: 'standard' });
              const w = window.open('', '_blank');
              if (w) {
                w.document.write(`<html><head><title>${item.id}</title></head><body>${html}</body></html>`);
                w.document.close();
                w.print();
              }
            }
          });
        });

        tableBody.querySelectorAll('[data-wa-mig]').forEach(b => {
          b.addEventListener('click', async () => {
            const id = b.dataset.waMig;
            const item = records.find(x => x.id === id);
            if (item) {
              const text = formatPlanMigrationWhatsApp(item);
              const clip = clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
              if (clip && typeof clip.writeText === 'function') {
                try {
                  await clip.writeText(text);
                  if (typeof onToast === 'function') onToast('WhatsApp migration voucher copied!');
                } catch {
                  if (typeof onToast === 'function') onToast('Failed to copy text.');
                }
              }
            }
          });
        });
      }
    }
  }

  function setCustomerContext(cust) {
    activeCustomer = cust;
    if (customerNameEl) customerNameEl.textContent = cust?.name || 'Active Subscriber';
    if (customerMetaEl) customerMetaEl.textContent = `ID: ${cust?.id || '—'} · Sector: ${cust?.area || cust?.mohalla || 'Shahdara Core'}`;
    if (currentPlanEl) currentPlanEl.textContent = cust?.package || cust?.plan || '15 Mbps Family Streamer';
    if (currentRateEl) currentRateEl.textContent = `PKR ${(cust?.monthlyFee ?? cust?.rate ?? 1500).toLocaleString()}/mo`;

    populatePlanSelect();
    if (effectiveDateInput && !effectiveDateInput.value) {
      effectiveDateInput.value = new Date().toISOString().slice(0, 10);
    }
    if (targetPlanSelect && targetPlanSelect.options.length > 0) {
      targetPlanSelect.selectedIndex = Math.min(2, targetPlanSelect.options.length - 1);
      const info = getSelectedTargetPlanInfo();
      if (targetRateInput) targetRateInput.value = String(info.price);
    }
    recalculateLivePreview();
    renderList();
  }

  populatePlanSelect();

  if (targetPlanSelect && !targetPlanSelect.dataset?.wiredMig) {
    targetPlanSelect.dataset.wiredMig = 'true';
    targetPlanSelect.addEventListener('change', () => {
      const info = getSelectedTargetPlanInfo();
      if (targetRateInput) targetRateInput.value = String(info.price);
      recalculateLivePreview();
    });
  }

  if (targetRateInput && !targetRateInput.dataset?.wiredMig) {
    targetRateInput.dataset.wiredMig = 'true';
    targetRateInput.addEventListener('input', recalculateLivePreview);
  }

  if (effectiveDateInput && !effectiveDateInput.dataset?.wiredMig) {
    effectiveDateInput.dataset.wiredMig = 'true';
    effectiveDateInput.addEventListener('input', recalculateLivePreview);
  }

  if (ontPortSelect && !ontPortSelect.dataset?.wiredMig) {
    ontPortSelect.dataset.wiredMig = 'true';
    ontPortSelect.addEventListener('change', recalculateLivePreview);
  }

  if (filterTypeSelect && !filterTypeSelect.dataset?.wiredMig) {
    filterTypeSelect.dataset.wiredMig = 'true';
    filterTypeSelect.addEventListener('change', renderList);
  }

  if (searchInput && !searchInput.dataset?.wiredMig) {
    searchInput.dataset.wiredMig = 'true';
    searchInput.addEventListener('input', renderList);
  }

  // Submit Plan Migration
  if (submitBtn && !submitBtn.dataset?.wiredMig) {
    submitBtn.dataset.wiredMig = 'true';
    submitBtn.addEventListener('click', () => {
      const custId = activeCustomer?.id || 'CUST-DEMO';
      const custName = activeCustomer?.name || 'Subscriber';
      const custPhone = activeCustomer?.phone || '';
      const custArea = activeCustomer?.area || activeCustomer?.mohalla || 'Shahdara Core';
      const curPlan = activeCustomer?.package || activeCustomer?.plan || '15 Mbps Family Streamer';
      const curRate = Number(activeCustomer?.monthlyFee ?? activeCustomer?.rate ?? 1500) || 1500;
      const tgtPlan = targetPlanSelect?.value || '25 Mbps Turbo Broadband';
      const tgtRate = Number(targetRateInput?.value) || 2000;
      const effDate = effectiveDateInput?.value || new Date().toISOString().slice(0, 10);
      const auth = authorizerInput?.value || 'NOC Operator';
      const notes = notesInput?.value || '';

      const val = validatePlanMigration({
        customerId: custId,
        currentPlan: curPlan,
        targetPlan: tgtPlan,
        currentRate: curRate,
        targetRate: tgtRate,
        effectiveDate: effDate,
        authorizedBy: auth
      });

      if (!val.valid) {
        if (typeof onToast === 'function') onToast(val.errors[0]);
        return;
      }

      const record = buildPlanMigrationRecord({
        customerId: custId,
        customerName: custName,
        customerPhone: custPhone,
        customerArea: custArea,
        currentPlan: curPlan,
        currentRate: curRate,
        targetPlan: tgtPlan,
        targetRate: tgtRate,
        effectiveDate: effDate,
        notes,
        authorizedBy: auth,
        ontPortType: ontPortSelect?.value || 'GE'
      });

      savePlanMigration(record, storage);
      lastRecordedRecord = record;

      if (typeof onMigrationSaved === 'function') {
        onMigrationSaved(record);
      }

      if (typeof onToast === 'function') {
        onToast(`Migration voucher ${record.id} recorded successfully!`);
      }

      if (notesInput) notesInput.value = '';
      renderList();
    });
  }

  // Copy WhatsApp slip
  if (copyWhatsAppBtn && !copyWhatsAppBtn.dataset?.wiredMig) {
    copyWhatsAppBtn.dataset.wiredMig = 'true';
    copyWhatsAppBtn.addEventListener('click', async () => {
      const records = getSavedPlanMigrations(storage);
      const target = lastRecordedRecord || records[0];
      if (!target) {
        if (typeof onToast === 'function') onToast('No plan migration voucher to copy.');
        return;
      }
      const text = formatPlanMigrationWhatsApp(target);
      const clip = clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
      if (clip && typeof clip.writeText === 'function') {
        try {
          await clip.writeText(text);
          if (typeof onToast === 'function') onToast('WhatsApp migration voucher copied!');
        } catch {
          if (typeof onToast === 'function') onToast('Failed to copy text.');
        }
      }
    });
  }

  // Print A4
  if (printA4Btn && !printA4Btn.dataset?.wiredMig) {
    printA4Btn.dataset.wiredMig = 'true';
    printA4Btn.addEventListener('click', () => {
      const records = getSavedPlanMigrations(storage);
      const target = lastRecordedRecord || records[0];
      if (!target) {
        if (typeof onToast === 'function') onToast('No plan migration voucher to print.');
        return;
      }
      const html = generatePlanMigrationHtml(target, { format: 'standard' });
      const w = window.open('', '_blank');
      if (w) {
        w.document.write(`<html><head><title>${target.id}</title></head><body>${html}</body></html>`);
        w.document.close();
        w.print();
      }
    });
  }

  // Print Thermal
  if (printThermalBtn && !printThermalBtn.dataset?.wiredMig) {
    printThermalBtn.dataset.wiredMig = 'true';
    printThermalBtn.addEventListener('click', () => {
      const records = getSavedPlanMigrations(storage);
      const target = lastRecordedRecord || records[0];
      if (!target) {
        if (typeof onToast === 'function') onToast('No plan migration voucher to print.');
        return;
      }
      const html = generatePlanMigrationHtml(target, { format: 'thermal' });
      const w = window.open('', '_blank');
      if (w) {
        w.document.write(`<html><head><title>${target.id}</title></head><body>${html}</body></html>`);
        w.document.close();
        w.print();
      }
    });
  }

  // Export CSV
  if (exportCsvBtn && !exportCsvBtn.dataset?.wiredMig) {
    exportCsvBtn.dataset.wiredMig = 'true';
    exportCsvBtn.addEventListener('click', () => {
      const records = getSavedPlanMigrations(storage);
      const csv = generatePlanMigrationsCsv(records);
      const filename = `shahdara_plan_migrations_${new Date().toISOString().slice(0, 10)}.csv`;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      if (typeof onToast === 'function') onToast(`Exported ${filename}`);
    });
  }

  // Modal open triggers
  openBtns.forEach(btn => {
    if (!btn.dataset?.wiredMigOpen) {
      btn.dataset.wiredMigOpen = 'true';
      btn.addEventListener('click', () => {
        const state = typeof getState === 'function' ? getState() : {};
        const cust = activeCustomer || state?.customers?.[0] || null;
        setCustomerContext(cust);
        if (typeof modal?.showModal === 'function') modal.showModal();
        else if (modal) modal.setAttribute('open', '');
      });
    }
  });

  if (closeBtn && !closeBtn.dataset?.wiredMig) {
    closeBtn.dataset.wiredMig = 'true';
    closeBtn.addEventListener('click', () => {
      if (typeof modal?.close === 'function') modal.close();
      else if (modal) modal.removeAttribute('open');
    });
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        if (typeof modal?.close === 'function') modal.close();
        else modal.removeAttribute('open');
      }
    });
  }

  return {
    open: (cust) => {
      setCustomerContext(cust);
      if (typeof modal?.showModal === 'function') modal.showModal();
      else if (modal) modal.setAttribute('open', '');
    },
    close: () => {
      if (typeof modal?.close === 'function') modal.close();
      else if (modal) modal.removeAttribute('open');
    },
    setCustomer: setCustomerContext,
    recalculate: () => {
      recalculateLivePreview();
      renderList();
    }
  };
}

// =========================================================================
// Subscriber ONT Optical Power Calibration & Rx/Tx Decibel QA Acceptance Certificate
// =========================================================================

export const OPTICAL_ACCEPTANCE_KEY = 'shahdara_optical_acceptance_v1';

export const STANDARD_SPLIT_RATIOS = {
  '1:2': 3.5,
  '1:4': 7.2,
  '1:8': 10.5,
  '1:16': 13.8,
  '1:32': 17.1,
  '1:64': 20.5
};

export const STANDARD_WAVELENGTHS = [1310, 1490, 1550];

/**
 * Evaluates ONT Received Optical Power (Rx dBm) against ITU-T G.984 GPON Class B+ standards.
 */
export function evaluateOpticalRxPower(rxDbm, options = {}) {
  const val = Number(rxDbm);
  if (isNaN(val)) {
    return {
      status: 'INVALID',
      label: 'Invalid Measurement',
      badgeClass: 'badge-danger',
      headroomDb: 0,
      advice: 'Please enter a valid numeric Rx power reading in dBm.'
    };
  }

  // Thresholds for Class B+ Optical Receiver (-8 dBm to -27 dBm)
  if (val > -8.0) {
    return {
      status: 'CRITICAL_SATURATION',
      label: 'Photodiode Saturation Overload',
      badgeClass: 'badge-danger',
      headroomDb: Math.round((val - (-8.0)) * 100) / 100,
      advice: 'DANGER: Received signal exceeds -8 dBm. Risk of optical detector burnout. Install 5dB/10dB fixed optical attenuator immediately.'
    };
  } else if (val >= -12.0 && val <= -8.0) {
    return {
      status: 'HIGH_POWER',
      label: 'High Optical Power (Acceptable)',
      badgeClass: 'badge-warning',
      headroomDb: Math.round((val - (-8.0)) * 100) / 100,
      advice: 'Signal is on the higher boundary. Monitor customer ONT receiver temperature.'
    };
  } else if (val >= -22.5 && val < -12.0) {
    return {
      status: 'PASS_OPTIMAL',
      label: 'Pristine GPON Class B+ Link',
      badgeClass: 'badge-success',
      headroomDb: Math.round((val - (-27.0)) * 100) / 100,
      advice: 'Optimal optical transmission. Negligible bit error rate and lowest latency.'
    };
  } else if (val >= -26.9 && val < -22.5) {
    return {
      status: 'CONDITIONAL_PASS',
      label: 'Conditional Pass (Marginal Headroom)',
      badgeClass: 'badge-warning',
      headroomDb: Math.round((val - (-27.0)) * 100) / 100,
      advice: 'Acceptable but close to sensitivity floor. Inspect drop cable bends and clean SC/APC optical end-faces with isopropanol.'
    };
  } else {
    // val < -27.0 dBm
    return {
      status: 'FAILED_ATTENUATION',
      label: 'Excessive Link Attenuation (Fail)',
      badgeClass: 'badge-danger',
      headroomDb: Math.round((val - (-27.0)) * 100) / 100,
      advice: 'REJECTED: Signal is below -27 dBm sensitivity limit. Will cause packet loss and flapping. Check for fiber micro-bending, dirty patchcord, or bad fusion splice.'
    };
  }
}

/**
 * Calculates theoretical optical link budget vs measured insertion loss.
 */
export function calculateOpticalLossBudget({
  txPowerDbm = 2.5,
  rxPowerDbm = -19.5,
  wavelengthNm = 1490,
  distanceMeters = 800,
  splitRatio = '1:16',
  spliceCount = 3,
  adapterCount = 2
} = {}) {
  const tx = Number(txPowerDbm) || 2.5;
  const rx = Number(rxPowerDbm) || -19.5;
  const distKm = Math.max(0, (Number(distanceMeters) || 0) / 1000);
  const splices = Math.max(0, Number(spliceCount) || 0);
  const adapters = Math.max(0, Number(adapterCount) || 0);

  // Fiber attenuation rate (dB/km)
  const fiberLossPerKm = Number(wavelengthNm) === 1310 ? 0.35 : 0.22;
  const fiberLoss = Math.round(distKm * fiberLossPerKm * 100) / 100;

  // Splitter insertion loss
  const splitterLoss = STANDARD_SPLIT_RATIOS[splitRatio] ?? 13.8;

  // Mechanical / fusion splice loss (0.05 dB per splice)
  const spliceLoss = Math.round(splices * 0.05 * 100) / 100;

  // Connector / adapter loss (0.25 dB per mate)
  const adapterLoss = Math.round(adapters * 0.25 * 100) / 100;

  // Total theoretical loss
  const theoreticalLoss = Math.round((fiberLoss + splitterLoss + spliceLoss + adapterLoss) * 100) / 100;

  // Actual measured loss = Tx - Rx
  const actualLoss = Math.round((tx - rx) * 100) / 100;

  // Excess loss delta
  const excessLoss = Math.round((actualLoss - theoreticalLoss) * 100) / 100;

  const evaluation = evaluateOpticalRxPower(rx);

  return {
    txPowerDbm: tx,
    rxPowerDbm: rx,
    wavelengthNm,
    distanceMeters: Math.round(distKm * 1000),
    fiberLoss,
    splitterLoss,
    spliceLoss,
    adapterLoss,
    theoreticalLoss,
    actualLoss,
    excessLoss,
    evaluation
  };
}

/**
 * Loads persistent optical certificates from localStorage.
 */
export function getSavedOpticalCertificates(storage) {
  const s = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!s) return [];
  try {
    const raw = s.getItem(OPTICAL_ACCEPTANCE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Saves an optical certificate to localStorage.
 */
export function saveOpticalCertificate(record, storage) {
  const s = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!s || !record) return false;
  try {
    const existing = getSavedOpticalCertificates(s);
    const updated = [record, ...existing.filter(r => r.id !== record.id)];
    s.setItem(OPTICAL_ACCEPTANCE_KEY, JSON.stringify(updated));
    return true;
  } catch {
    return false;
  }
}

/**
 * Clears saved optical certificates from localStorage.
 */
export function clearOpticalCertificates(storage) {
  const s = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!s) return false;
  try {
    s.removeItem(OPTICAL_ACCEPTANCE_KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates optical acceptance form fields.
 */
export function validateOpticalCertificate(formData) {
  const errors = {};
  if (!formData.customerId || !String(formData.customerId).trim()) {
    errors.customerId = 'Valid subscriber account is required.';
  }
  const rx = Number(formData.rxPowerDbm);
  if (formData.rxPowerDbm === undefined || formData.rxPowerDbm === null || formData.rxPowerDbm === '' || isNaN(rx)) {
    errors.rxPowerDbm = 'Valid Rx Optical Power (dBm) reading is required.';
  } else if (rx < -45 || rx > 10) {
    errors.rxPowerDbm = 'Rx Power must be between -45 dBm and +10 dBm.';
  }

  const tx = Number(formData.txPowerDbm);
  if (formData.txPowerDbm !== undefined && formData.txPowerDbm !== null && formData.txPowerDbm !== '') {
    if (isNaN(tx) || tx < -10 || tx > 20) {
      errors.txPowerDbm = 'Tx Power must be between -10 dBm and +20 dBm.';
    }
  }

  if (!formData.inspector || String(formData.inspector).trim().length < 2) {
    errors.inspector = 'Inspector or Field Lineman name is required (min 2 chars).';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Builds a sequential optical certificate record (OPT-YYYYMM-XXXX).
 */
export function buildOpticalCertificateRecord(customer, formData, options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  const yearMonth = now.toISOString().slice(0, 7).replace('-', '');
  const seq = String(options.sequence || Math.floor(1000 + Math.random() * 9000)).padStart(4, '0');
  const certId = `OPT-${yearMonth}-${seq}`;

  const budget = calculateOpticalLossBudget({
    txPowerDbm: formData.txPowerDbm ?? 2.5,
    rxPowerDbm: formData.rxPowerDbm,
    wavelengthNm: formData.wavelengthNm ?? 1490,
    distanceMeters: formData.distanceMeters ?? 650,
    splitRatio: formData.splitRatio ?? '1:16',
    spliceCount: formData.spliceCount ?? 3,
    adapterCount: formData.adapterCount ?? 2
  });

  return {
    id: certId,
    createdAt: now.toISOString(),
    customer: {
      id: customer?.id || formData.customerId,
      name: customer?.name || formData.customerName || 'Subscriber',
      customerNumber: customer?.customerNumber || '',
      area: customer?.area || formData.area || 'Shahdara Town',
      phone: customer?.phone || formData.phone || '',
      package: customer?.package || customer?.currentPlan || 'Broadband'
    },
    telemetry: {
      ontSerial: formData.ontSerial || 'HG8245H-GPON-01',
      oltPort: formData.oltPort || 'OLT-01 / PON-02',
      powerMeterSerial: formData.powerMeterSerial || 'OPM-GW-8902',
      wavelengthNm: Number(formData.wavelengthNm) || 1490,
      txPowerDbm: budget.txPowerDbm,
      rxPowerDbm: budget.rxPowerDbm,
      distanceMeters: budget.distanceMeters,
      splitRatio: formData.splitRatio || '1:16',
      spliceCount: Number(formData.spliceCount) || 3,
      adapterCount: Number(formData.adapterCount) || 2,
      connectorCondition: formData.connectorCondition || 'Clean & Inspected',
      theoreticalLoss: budget.theoreticalLoss,
      actualLoss: budget.actualLoss,
      excessLoss: budget.excessLoss,
      status: budget.evaluation.status,
      statusLabel: budget.evaluation.label,
      headroomDb: budget.evaluation.headroomDb,
      advice: budget.evaluation.advice
    },
    inspector: formData.inspector || 'QA Lineman Team',
    notes: formData.notes || 'Optical link commissioned and verified under PTA standards.'
  };
}

/**
 * Generates formatted WhatsApp text message for optical QA acceptance.
 */
export function formatOpticalAcceptanceWhatsApp(cert) {
  const t = cert.telemetry;
  const statusEmoji = t.status === 'PASS_OPTIMAL' ? '✅' : t.status === 'CONDITIONAL_PASS' ? '⚠️' : '❌';
  return [
    `========================================`,
    `📡 SHAHDARA FTTH OPTICAL ACCEPTANCE CERTIFICATE`,
    `Voucher: ${cert.id} | Date: ${cert.createdAt.slice(0, 10)}`,
    `========================================`,
    ``,
    `SUBSCRIBER DETAILS:`,
    `- Name: ${cert.customer.name} (#${cert.customer.customerNumber || cert.customer.id})`,
    `- Area / Sector: ${cert.customer.area}`,
    `- Service Plan: ${cert.customer.package}`,
    `- ONT Serial No: ${t.ontSerial}`,
    ``,
    `OPTICAL POWER TELEMETRY (Class B+):`,
    `- Wavelength: ${t.wavelengthNm} nm`,
    `- OLT Tx Power: +${t.txPowerDbm} dBm`,
    `- Subscriber Rx Power: ${t.rxPowerDbm} dBm`,
    `- Drop Distance: ${t.distanceMeters} meters`,
    `- Splitter Configuration: ${t.splitRatio}`,
    `- Theoretical Link Loss: ${t.theoreticalLoss} dB`,
    `- Measured Total Loss: ${t.actualLoss} dB`,
    `- Headroom to -27 dBm Floor: ${t.headroomDb} dB`,
    ``,
    `QA COMMISSIONING VERDICT:`,
    `${statusEmoji} STATUS: [ ${t.statusLabel.toUpperCase()} ]`,
    `- Technical Advice: ${t.advice}`,
    `- Certified By: ${cert.inspector}`,
    `- Notes: ${cert.notes}`,
    ``,
    `PTA Compliance Verified · Shahdara Fiber Operations`
  ].join('\n');
}

/**
 * Generates printable HTML for formal A4 certificate or 80mm thermal slip.
 */
export function generateOpticalCertificateHtml(cert, options = {}) {
  const mode = options.mode || 'a4';
  const t = cert.telemetry;
  const statusColor = t.status === 'PASS_OPTIMAL' ? '#059669' : t.status === 'CONDITIONAL_PASS' ? '#d97706' : '#dc2626';

  if (mode === 'thermal') {
    return `
      <div class="thermal-slip-wrapper optical-thermal-slip" style="font-family: monospace; width: 280px; padding: 10px; font-size: 11px; line-height: 1.4;">
        <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 8px;">
          <h2 style="margin: 0; font-size: 14px;">SHAHDARA FTTH</h2>
          <p style="margin: 2px 0; font-size: 10px;">Optical QA Acceptance Slip</p>
          <p style="margin: 2px 0; font-size: 9px;">Cert: ${cert.id}</p>
          <p style="margin: 2px 0; font-size: 9px;">${cert.createdAt.slice(0, 10)} PKT</p>
        </div>

        <div style="margin-bottom: 6px;">
          <strong>Sub:</strong> ${cert.customer.name} (#${cert.customer.customerNumber || cert.customer.id})<br>
          <strong>Area:</strong> ${cert.customer.area}<br>
          <strong>ONT S/N:</strong> ${t.ontSerial}<br>
          <strong>Port:</strong> ${t.oltPort}
        </div>

        <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 6px 0; margin-bottom: 6px;">
          <table style="width: 100%; font-size: 10px;">
            <tr><td>Rx Power:</td><td style="text-align: right; font-weight: bold;">${t.rxPowerDbm} dBm</td></tr>
            <tr><td>OLT Tx Power:</td><td style="text-align: right;">+${t.txPowerDbm} dBm</td></tr>
            <tr><td>Drop Length:</td><td style="text-align: right;">${t.distanceMeters} m</td></tr>
            <tr><td>Split Ratio:</td><td style="text-align: right;">${t.splitRatio}</td></tr>
            <tr><td>Actual Loss:</td><td style="text-align: right;">${t.actualLoss} dB</td></tr>
            <tr><td>Loss Budget:</td><td style="text-align: right;">${t.theoreticalLoss} dB</td></tr>
          </table>
        </div>

        <div style="text-align: center; margin-bottom: 8px;">
          <div style="display: inline-block; padding: 3px 8px; border: 1px solid ${statusColor}; color: ${statusColor}; font-weight: bold; border-radius: 4px;">
            ${t.statusLabel}
          </div>
          <p style="margin: 4px 0 0; font-size: 9px;">Headroom: ${t.headroomDb} dB</p>
        </div>

        <div style="border-top: 1px dashed #000; padding-top: 6px; font-size: 9px;">
          Inspector: ${cert.inspector}<br>
          Signature: __________________
        </div>
      </div>
    `;
  }

  // Formal A4 Certificate
  return `
    <div class="a4-voucher-page optical-a4-certificate" style="max-width: 780px; margin: 0 auto; padding: 24px; font-family: system-ui, -apple-system, sans-serif; color: #1e293b; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f766e; padding-bottom: 14px; margin-bottom: 18px;">
        <div>
          <h1 style="margin: 0; font-size: 20px; color: #0f766e; text-transform: uppercase; letter-spacing: 0.5px;">Shahdara Fiber Optic Network Operations</h1>
          <p style="margin: 4px 0 0; font-size: 13px; color: #64748b;">Outside Plant Engineering &amp; Optical Power Meter QA Acceptance Certificate</p>
        </div>
        <div style="text-align: right;">
          <span style="display: inline-block; padding: 4px 10px; background: #f0fdfa; border: 1px solid #0f766e; color: #0f766e; font-weight: 700; border-radius: 4px; font-size: 13px;">${cert.id}</span>
          <p style="margin: 4px 0 0; font-size: 11px; color: #64748b;">Date: ${cert.createdAt.slice(0, 10)} PKT</p>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 18px;">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px;">
          <h3 style="margin: 0 0 8px; font-size: 13px; color: #0f766e; text-transform: uppercase;">1. Subscriber Installation Profile</h3>
          <p style="margin: 3px 0; font-size: 12px;"><strong>Subscriber Name:</strong> ${cert.customer.name}</p>
          <p style="margin: 3px 0; font-size: 12px;"><strong>Account Number:</strong> #${cert.customer.customerNumber || cert.customer.id}</p>
          <p style="margin: 3px 0; font-size: 12px;"><strong>Area / Mohalla:</strong> ${cert.customer.area}</p>
          <p style="margin: 3px 0; font-size: 12px;"><strong>Service Plan:</strong> ${cert.customer.package}</p>
          <p style="margin: 3px 0; font-size: 12px;"><strong>Phone Contact:</strong> ${cert.customer.phone || 'Not recorded'}</p>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px;">
          <h3 style="margin: 0 0 8px; font-size: 13px; color: #0f766e; text-transform: uppercase;">2. Optical Hardware &amp; Splice Node</h3>
          <p style="margin: 3px 0; font-size: 12px;"><strong>ONT Equipment Serial:</strong> ${t.ontSerial}</p>
          <p style="margin: 3px 0; font-size: 12px;"><strong>OLT Feeder / PON Port:</strong> ${t.oltPort}</p>
          <p style="margin: 3px 0; font-size: 12px;"><strong>OPM Meter Serial:</strong> ${t.powerMeterSerial}</p>
          <p style="margin: 3px 0; font-size: 12px;"><strong>Connector End-Face:</strong> ${t.connectorCondition}</p>
          <p style="margin: 3px 0; font-size: 12px;"><strong>Drop Cable Length:</strong> ${t.distanceMeters} meters</p>
        </div>
      </div>

      <div style="margin-bottom: 18px;">
        <h3 style="margin: 0 0 8px; font-size: 13px; color: #0f766e; text-transform: uppercase;">3. Optical Link Attenuation &amp; Loss Budget Analysis</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background: #e2e8f0; color: #334155;">
              <th style="padding: 6px 10px; text-align: left; border: 1px solid #cbd5e1;">Parameter</th>
              <th style="padding: 6px 10px; text-align: center; border: 1px solid #cbd5e1;">Design Target</th>
              <th style="padding: 6px 10px; text-align: center; border: 1px solid #cbd5e1;">Measured / Actual</th>
              <th style="padding: 6px 10px; text-align: left; border: 1px solid #cbd5e1;">Headroom / Variance</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding: 6px 10px; border: 1px solid #cbd5e1;">Received Optical Power (Rx)</td>
              <td style="padding: 6px 10px; text-align: center; border: 1px solid #cbd5e1;">-15.0 to -22.5 dBm</td>
              <td style="padding: 6px 10px; text-align: center; font-weight: bold; border: 1px solid #cbd5e1; color: ${statusColor};">${t.rxPowerDbm} dBm</td>
              <td style="padding: 6px 10px; border: 1px solid #cbd5e1;">${t.headroomDb} dB above sensitivity floor</td>
            </tr>
            <tr>
              <td style="padding: 6px 10px; border: 1px solid #cbd5e1;">OLT Transmit Power (Tx)</td>
              <td style="padding: 6px 10px; text-align: center; border: 1px solid #cbd5e1;">+1.5 to +5.0 dBm</td>
              <td style="padding: 6px 10px; text-align: center; border: 1px solid #cbd5e1;">+${t.txPowerDbm} dBm</td>
              <td style="padding: 6px 10px; border: 1px solid #cbd5e1;">Nominal Class B+ transmitter</td>
            </tr>
            <tr>
              <td style="padding: 6px 10px; border: 1px solid #cbd5e1;">Splitter Insertion Loss (${t.splitRatio})</td>
              <td style="padding: 6px 10px; text-align: center; border: 1px solid #cbd5e1;">${t.splitterLoss} dB</td>
              <td style="padding: 6px 10px; text-align: center; border: 1px solid #cbd5e1;">${t.splitterLoss} dB</td>
              <td style="padding: 6px 10px; border: 1px solid #cbd5e1;">PLC fused planar splitter</td>
            </tr>
            <tr>
              <td style="padding: 6px 10px; border: 1px solid #cbd5e1;">Total Link Loss Budget</td>
              <td style="padding: 6px 10px; text-align: center; border: 1px solid #cbd5e1;">${t.theoreticalLoss} dB</td>
              <td style="padding: 6px 10px; text-align: center; font-weight: bold; border: 1px solid #cbd5e1;">${t.actualLoss} dB</td>
              <td style="padding: 6px 10px; border: 1px solid #cbd5e1;">${t.excessLoss >= 0 ? '+' : ''}${t.excessLoss} dB delta from theoretical</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style="background: #f1f5f9; border-left: 4px solid ${statusColor}; padding: 12px; border-radius: 4px; margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong style="font-size: 14px; color: ${statusColor};">COMMISSIONING VERDICT: ${t.statusLabel.toUpperCase()}</strong>
          <span style="font-size: 11px; background: #fff; padding: 2px 8px; border-radius: 3px; border: 1px solid #cbd5e1;">Wavelength: ${t.wavelengthNm}nm</span>
        </div>
        <p style="margin: 6px 0 0; font-size: 12px; color: #475569;">${t.advice}</p>
        <p style="margin: 4px 0 0; font-size: 11px; color: #64748b;"><strong>Field Notes:</strong> ${cert.notes}</p>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 36px; padding-top: 14px; border-top: 1px solid #e2e8f0;">
        <div style="text-align: center; width: 200px;">
          <div style="border-bottom: 1px solid #000; height: 32px; margin-bottom: 4px;"></div>
          <span style="font-size: 11px; font-weight: bold;">Field Technician / Lineman</span><br>
          <span style="font-size: 10px; color: #64748b;">${cert.inspector}</span>
        </div>
        <div style="text-align: center; width: 200px;">
          <div style="border-bottom: 1px solid #000; height: 32px; margin-bottom: 4px;"></div>
          <span style="font-size: 11px; font-weight: bold;">QA Audit Supervisor</span><br>
          <span style="font-size: 10px; color: #64748b;">Outside Plant Engineering</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Generates RFC-4180 compliant CSV export of optical certificates.
 */
export function generateOpticalCertificatesCsv(records) {
  const headers = [
    'Certificate ID',
    'Date',
    'Customer ID',
    'Subscriber Name',
    'Area',
    'Service Plan',
    'ONT Serial',
    'OLT Port',
    'Wavelength (nm)',
    'Tx Power (dBm)',
    'Rx Power (dBm)',
    'Drop Distance (m)',
    'Split Ratio',
    'Total Loss (dB)',
    'Status',
    'Inspector',
    'Notes'
  ];

  const escape = (val) => {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const rows = (records || []).map(r => [
    r.id,
    r.createdAt ? r.createdAt.slice(0, 10) : '',
    r.customer?.id || '',
    r.customer?.name || '',
    r.customer?.area || '',
    r.customer?.package || '',
    r.telemetry?.ontSerial || '',
    r.telemetry?.oltPort || '',
    r.telemetry?.wavelengthNm || '',
    r.telemetry?.txPowerDbm || '',
    r.telemetry?.rxPowerDbm || '',
    r.telemetry?.distanceMeters || '',
    r.telemetry?.splitRatio || '',
    r.telemetry?.actualLoss || '',
    r.telemetry?.status || '',
    r.inspector || '',
    r.notes || ''
  ].map(escape).join(','));

  return '\uFEFF' + [headers.map(escape).join(','), ...rows].join('\r\n');
}

/**
 * Interactive Modal Controller for Optical QA Acceptance & Calibration Suite.
 */
export function setupOpticalAcceptanceModal({
  getState,
  storage,
  onToast
} = {}) {
  if (typeof document === 'undefined') {
    return {
      open: () => {},
      close: () => {},
      setCustomer: () => {},
      recalculate: () => {}
    };
  }

  const modal = document.getElementById('opticalAcceptanceModal');
  const closeBtn = document.getElementById('opticalAcceptanceCloseBtn');
  const openBtns = document.querySelectorAll('[data-open-optical-acceptance], #openOpticalAcceptanceBtn');

  // Input elements
  const ontSerialInput = document.getElementById('optOntSerialInput');
  const oltPortInput = document.getElementById('optOltPortInput');
  const wavelengthSelect = document.getElementById('optWavelengthSelect');
  const txPowerInput = document.getElementById('optTxPowerInput');
  const rxPowerInput = document.getElementById('optRxPowerInput');
  const rxPowerSlider = document.getElementById('optRxPowerSlider');
  const distanceInput = document.getElementById('optDistanceInput');
  const splitRatioSelect = document.getElementById('optSplitRatioSelect');
  const spliceCountInput = document.getElementById('optSpliceCountInput');
  const inspectorInput = document.getElementById('optInspectorInput');
  const notesInput = document.getElementById('optNotesInput');

  // Preview elements
  const customerNameEl = document.getElementById('optCustomerName');
  const customerMetaEl = document.getElementById('optCustomerMeta');
  const kpiTotalCertificates = document.getElementById('optKpiTotalCertificates');
  const kpiAverageRx = document.getElementById('optKpiAverageRx');
  const kpiPassRate = document.getElementById('optKpiPassRate');
  const kpiAttenuationAlerts = document.getElementById('optKpiAttenuationAlerts');
  const statusBadgeEl = document.getElementById('optStatusBadge');
  const lossBudgetBoxEl = document.getElementById('optLossBudgetBox');

  // Buttons
  const submitBtn = document.getElementById('opticalAcceptanceSubmitBtn');
  const copyWhatsAppBtn = document.getElementById('opticalAcceptanceCopyWhatsAppBtn');
  const printA4Btn = document.getElementById('opticalAcceptancePrintA4Btn');
  const printThermalBtn = document.getElementById('opticalAcceptancePrintThermalBtn');
  const exportCsvBtn = document.getElementById('opticalAcceptanceExportCsvBtn');

  // Table & filters
  const historyTableBody = document.getElementById('optHistoryTableBody');
  const filterStatusSelect = document.getElementById('optFilterStatusSelect');
  const searchInput = document.getElementById('optSearchInput');

  let activeCustomer = null;
  let currentEvaluation = null;

  function recalculateLivePreview() {
    const rx = Number(rxPowerInput?.value ?? -19.5);
    const tx = Number(txPowerInput?.value ?? 2.5);
    const wave = Number(wavelengthSelect?.value ?? 1490);
    const dist = Number(distanceInput?.value ?? 650);
    const split = splitRatioSelect?.value ?? '1:16';
    const splices = Number(spliceCountInput?.value ?? 3);

    const budget = calculateOpticalLossBudget({
      txPowerDbm: tx,
      rxPowerDbm: rx,
      wavelengthNm: wave,
      distanceMeters: dist,
      splitRatio: split,
      spliceCount: splices,
      adapterCount: 2
    });

    currentEvaluation = budget;

    if (statusBadgeEl) {
      statusBadgeEl.textContent = budget.evaluation.label;
      statusBadgeEl.className = `sim-delta-badge ${budget.evaluation.badgeClass}`;
    }

    if (lossBudgetBoxEl) {
      const isPass = budget.evaluation.status === 'PASS_OPTIMAL';
      const color = isPass ? '#059669' : budget.evaluation.status === 'CONDITIONAL_PASS' ? '#d97706' : '#dc2626';
      lossBudgetBoxEl.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span><strong>Measured Total Loss:</strong> ${budget.actualLoss} dB</span>
          <span><strong>Design Budget:</strong> ${budget.theoreticalLoss} dB</span>
          <span style="color: ${color}; font-weight: bold;">Delta: ${budget.excessLoss >= 0 ? '+' : ''}${budget.excessLoss} dB</span>
        </div>
        <p style="margin: 0; font-size: 11px; color: ${color};">${budget.evaluation.advice}</p>
      `;
    }
  }

  function setCustomerContext(customer) {
    activeCustomer = customer;
    if (customerNameEl) customerNameEl.textContent = customer?.name || 'Select a Subscriber';
    if (customerMetaEl) {
      customerMetaEl.textContent = customer
        ? `#${customer.customerNumber || customer.id} · ${customer.area || 'Shahdara Town'} · ${customer.package || customer.currentPlan || '15 Mbps'}`
        : 'Choose a customer to bind optical test';
    }
    recalculateLivePreview();
    renderList();
    renderKpis();
  }

  function renderKpis() {
    const records = getSavedOpticalCertificates(storage);
    const total = records.length;
    let avgRx = 'N/A';
    let passRate = '100%';
    let attenuationAlerts = 0;

    if (total > 0) {
      const rxSum = records.reduce((acc, r) => acc + (Number(r.telemetry?.rxPowerDbm) || 0), 0);
      avgRx = `${(rxSum / total).toFixed(1)} dBm`;
      const passed = records.filter(r => r.telemetry?.status === 'PASS_OPTIMAL' || r.telemetry?.status === 'CONDITIONAL_PASS').length;
      passRate = `${Math.round((passed / total) * 100)}%`;
      attenuationAlerts = records.filter(r => r.telemetry?.status === 'FAILED_ATTENUATION' || r.telemetry?.status === 'CRITICAL_SATURATION').length;
    }

    if (kpiTotalCertificates) kpiTotalCertificates.textContent = String(total);
    if (kpiAverageRx) kpiAverageRx.textContent = avgRx;
    if (kpiPassRate) kpiPassRate.textContent = passRate;
    if (kpiAttenuationAlerts) kpiAttenuationAlerts.textContent = String(attenuationAlerts);
  }

  function renderList() {
    if (!historyTableBody) return;
    const records = getSavedOpticalCertificates(storage);
    const filter = filterStatusSelect?.value || 'ALL';
    const query = (searchInput?.value || '').trim().toLowerCase();

    const filtered = records.filter(r => {
      if (filter !== 'ALL' && r.telemetry?.status !== filter) return false;
      if (query) {
        const text = `${r.id} ${r.customer?.name} ${r.customer?.area} ${r.telemetry?.ontSerial} ${r.inspector}`.toLowerCase();
        if (!text.includes(query)) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      historyTableBody.innerHTML = `<tr><td colspan="7" class="text-center" style="padding: 18px; color: var(--muted, #64748b);">No optical acceptance certificates match criteria.</td></tr>`;
      return;
    }

    historyTableBody.innerHTML = filtered.map(r => {
      const t = r.telemetry;
      const badgeCls = t.status === 'PASS_OPTIMAL' ? 'badge-success' : t.status === 'CONDITIONAL_PASS' ? 'badge-warning' : 'badge-danger';
      return `
        <tr>
          <td><strong>${r.id}</strong><br><span style="font-size: 10px; color: var(--muted, #64748b);">${r.createdAt ? r.createdAt.slice(0, 10) : ''}</span></td>
          <td><strong>${r.customer?.name || 'N/A'}</strong><br><span style="font-size: 10px; color: var(--muted, #64748b);">${r.customer?.area || ''}</span></td>
          <td>${t.ontSerial}<br><span style="font-size: 10px; color: var(--muted, #64748b);">${t.oltPort}</span></td>
          <td><strong>${t.rxPowerDbm} dBm</strong><br><span style="font-size: 10px; color: var(--muted, #64748b);">Tx: +${t.txPowerDbm} dBm</span></td>
          <td>${t.actualLoss} dB<br><span style="font-size: 10px; color: var(--muted, #64748b);">Target: ${t.theoreticalLoss} dB</span></td>
          <td><span class="sim-delta-badge ${badgeCls}">${t.statusLabel}</span></td>
          <td class="text-center">
            <button type="button" class="action-link-btn" data-opt-action="whatsapp" data-opt-id="${r.id}" title="Send WhatsApp">💬</button>
            <button type="button" class="action-link-btn" data-opt-action="a4" data-opt-id="${r.id}" title="Print A4">🖨️</button>
            <button type="button" class="action-link-btn" data-opt-action="thermal" data-opt-id="${r.id}" title="Print 80mm">🧾</button>
          </td>
        </tr>
      `;
    }).join('');

    // Wire action links
    historyTableBody.querySelectorAll('[data-opt-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.optAction;
        const certId = btn.dataset.optId;
        const cert = records.find(c => c.id === certId);
        if (!cert) return;

        if (action === 'whatsapp') {
          const text = formatOpticalAcceptanceWhatsApp(cert);
          if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(text);
            if (typeof onToast === 'function') onToast(`WhatsApp certificate ${cert.id} copied!`);
          }
        } else if (action === 'a4') {
          const html = generateOpticalCertificateHtml(cert, { mode: 'a4' });
          const win = window.open('', '_blank');
          if (win) {
            win.document.write(`<html><head><title>${cert.id}</title></head><body>${html}</body></html>`);
            win.document.close();
            win.print();
          }
        } else if (action === 'thermal') {
          const html = generateOpticalCertificateHtml(cert, { mode: 'thermal' });
          const win = window.open('', '_blank');
          if (win) {
            win.document.write(`<html><head><title>${cert.id}</title></head><body>${html}</body></html>`);
            win.document.close();
            win.print();
          }
        }
      });
    });
  }

  // Reactive inputs
  [rxPowerInput, txPowerInput, distanceInput, splitRatioSelect, spliceCountInput, wavelengthSelect].forEach(input => {
    if (input && !input.dataset?.wiredOpt) {
      input.dataset.wiredOpt = 'true';
      input.addEventListener('input', () => {
        if (input === rxPowerInput && rxPowerSlider) rxPowerSlider.value = rxPowerInput.value;
        recalculateLivePreview();
      });
      input.addEventListener('change', recalculateLivePreview);
    }
  });

  if (rxPowerSlider && !rxPowerSlider.dataset?.wiredOpt) {
    rxPowerSlider.dataset.wiredOpt = 'true';
    rxPowerSlider.addEventListener('input', () => {
      if (rxPowerInput) rxPowerInput.value = rxPowerSlider.value;
      recalculateLivePreview();
    });
  }

  if (filterStatusSelect && !filterStatusSelect.dataset?.wiredOpt) {
    filterStatusSelect.dataset.wiredOpt = 'true';
    filterStatusSelect.addEventListener('change', renderList);
  }

  if (searchInput && !searchInput.dataset?.wiredOpt) {
    searchInput.dataset.wiredOpt = 'true';
    searchInput.addEventListener('input', renderList);
  }

  // Submit button
  if (submitBtn && !submitBtn.dataset?.wiredOpt) {
    submitBtn.dataset.wiredOpt = 'true';
    submitBtn.addEventListener('click', () => {
      const state = typeof getState === 'function' ? getState() : {};
      const cust = activeCustomer || state?.customers?.[0] || null;
      if (!cust) {
        if (typeof onToast === 'function') onToast('Select an active subscriber first.');
        return;
      }

      const formData = {
        customerId: cust.id,
        customerName: cust.name,
        area: cust.area,
        phone: cust.phone,
        package: cust.package || cust.currentPlan,
        ontSerial: ontSerialInput?.value || 'HG8245H-GPON-01',
        oltPort: oltPortInput?.value || 'OLT-01 / PON-02',
        wavelengthNm: Number(wavelengthSelect?.value) || 1490,
        txPowerDbm: Number(txPowerInput?.value) || 2.5,
        rxPowerDbm: Number(rxPowerInput?.value) || -19.5,
        distanceMeters: Number(distanceInput?.value) || 650,
        splitRatio: splitRatioSelect?.value || '1:16',
        spliceCount: Number(spliceCountInput?.value) || 3,
        inspector: inspectorInput?.value || 'Field QA Lineman',
        notes: notesInput?.value || 'Commissioned under ITU-T G.984 Class B+ specs.'
      };

      const validation = validateOpticalCertificate(formData);
      if (!validation.isValid) {
        const firstErr = Object.values(validation.errors)[0];
        if (typeof onToast === 'function') onToast(firstErr || 'Invalid form input.');
        return;
      }

      const record = buildOpticalCertificateRecord(cust, formData);
      saveOpticalCertificate(record, storage);
      renderList();
      renderKpis();
      if (typeof onToast === 'function') onToast(`Issued Certificate: ${record.id} (${record.telemetry.statusLabel})`);
    });
  }

  // Copy WhatsApp button
  if (copyWhatsAppBtn && !copyWhatsAppBtn.dataset?.wiredOpt) {
    copyWhatsAppBtn.dataset.wiredOpt = 'true';
    copyWhatsAppBtn.addEventListener('click', () => {
      const state = typeof getState === 'function' ? getState() : {};
      const cust = activeCustomer || state?.customers?.[0] || null;
      if (!cust) return;

      const formData = {
        customerId: cust.id,
        customerName: cust.name,
        area: cust.area,
        phone: cust.phone,
        package: cust.package,
        ontSerial: ontSerialInput?.value || 'HG8245H-GPON-01',
        oltPort: oltPortInput?.value || 'OLT-01 / PON-02',
        wavelengthNm: Number(wavelengthSelect?.value) || 1490,
        txPowerDbm: Number(txPowerInput?.value) || 2.5,
        rxPowerDbm: Number(rxPowerInput?.value) || -19.5,
        distanceMeters: Number(distanceInput?.value) || 650,
        splitRatio: splitRatioSelect?.value || '1:16',
        spliceCount: Number(spliceCountInput?.value) || 3,
        inspector: inspectorInput?.value || 'Field QA Lineman',
        notes: notesInput?.value || ''
      };

      const record = buildOpticalCertificateRecord(cust, formData);
      const text = formatOpticalAcceptanceWhatsApp(record);
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text);
        if (typeof onToast === 'function') onToast('WhatsApp optical certificate copied to clipboard!');
      }
    });
  }

  // Print A4 button
  if (printA4Btn && !printA4Btn.dataset?.wiredOpt) {
    printA4Btn.dataset.wiredOpt = 'true';
    printA4Btn.addEventListener('click', () => {
      const state = typeof getState === 'function' ? getState() : {};
      const cust = activeCustomer || state?.customers?.[0] || null;
      if (!cust) return;

      const formData = {
        customerId: cust.id,
        customerName: cust.name,
        area: cust.area,
        phone: cust.phone,
        package: cust.package,
        ontSerial: ontSerialInput?.value || 'HG8245H-GPON-01',
        oltPort: oltPortInput?.value || 'OLT-01 / PON-02',
        wavelengthNm: Number(wavelengthSelect?.value) || 1490,
        txPowerDbm: Number(txPowerInput?.value) || 2.5,
        rxPowerDbm: Number(rxPowerInput?.value) || -19.5,
        distanceMeters: Number(distanceInput?.value) || 650,
        splitRatio: splitRatioSelect?.value || '1:16',
        spliceCount: Number(spliceCountInput?.value) || 3,
        inspector: inspectorInput?.value || 'Field QA Lineman',
        notes: notesInput?.value || ''
      };

      const record = buildOpticalCertificateRecord(cust, formData);
      const html = generateOpticalCertificateHtml(record, { mode: 'a4' });
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(`<html><head><title>${record.id}</title></head><body>${html}</body></html>`);
        win.document.close();
        win.print();
      }
    });
  }

  // Print 80mm POS slip button
  if (printThermalBtn && !printThermalBtn.dataset?.wiredOpt) {
    printThermalBtn.dataset.wiredOpt = 'true';
    printThermalBtn.addEventListener('click', () => {
      const state = typeof getState === 'function' ? getState() : {};
      const cust = activeCustomer || state?.customers?.[0] || null;
      if (!cust) return;

      const formData = {
        customerId: cust.id,
        customerName: cust.name,
        area: cust.area,
        phone: cust.phone,
        package: cust.package,
        ontSerial: ontSerialInput?.value || 'HG8245H-GPON-01',
        oltPort: oltPortInput?.value || 'OLT-01 / PON-02',
        wavelengthNm: Number(wavelengthSelect?.value) || 1490,
        txPowerDbm: Number(txPowerInput?.value) || 2.5,
        rxPowerDbm: Number(rxPowerInput?.value) || -19.5,
        distanceMeters: Number(distanceInput?.value) || 650,
        splitRatio: splitRatioSelect?.value || '1:16',
        spliceCount: Number(spliceCountInput?.value) || 3,
        inspector: inspectorInput?.value || 'Field QA Lineman',
        notes: notesInput?.value || ''
      };

      const record = buildOpticalCertificateRecord(cust, formData);
      const html = generateOpticalCertificateHtml(record, { mode: 'thermal' });
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(`<html><head><title>${record.id}</title></head><body>${html}</body></html>`);
        win.document.close();
        win.print();
      }
    });
  }

  // Export CSV button
  if (exportCsvBtn && !exportCsvBtn.dataset?.wiredOpt) {
    exportCsvBtn.dataset.wiredOpt = 'true';
    exportCsvBtn.addEventListener('click', () => {
      const records = getSavedOpticalCertificates(storage);
      const csv = generateOpticalCertificatesCsv(records);
      const filename = `shahdara_optical_qa_${new Date().toISOString().slice(0, 10)}.csv`;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      if (typeof onToast === 'function') onToast(`Exported ${filename}`);
    });
  }

  // Open triggers
  openBtns.forEach(btn => {
    if (!btn.dataset?.wiredOptOpen) {
      btn.dataset.wiredOptOpen = 'true';
      btn.addEventListener('click', () => {
        const state = typeof getState === 'function' ? getState() : {};
        const cust = activeCustomer || state?.customers?.[0] || null;
        setCustomerContext(cust);
        if (typeof modal?.showModal === 'function') modal.showModal();
        else if (modal) modal.setAttribute('open', '');
      });
    }
  });

  if (closeBtn && !closeBtn.dataset?.wiredOpt) {
    closeBtn.dataset.wiredOpt = 'true';
    closeBtn.addEventListener('click', () => {
      if (typeof modal?.close === 'function') modal.close();
      else if (modal) modal.removeAttribute('open');
    });
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        if (typeof modal?.close === 'function') modal.close();
        else modal.removeAttribute('open');
      }
    });
  }

  return {
    open: (cust) => {
      setCustomerContext(cust);
      if (typeof modal?.showModal === 'function') modal.showModal();
      else if (modal) modal.setAttribute('open', '');
    },
    close: () => {
      if (typeof modal?.close === 'function') modal.close();
      else if (modal) modal.removeAttribute('open');
    },
    setCustomer: setCustomerContext,
    recalculate: () => {
      recalculateLivePreview();
      renderList();
      renderKpis();
    }
  };
}

/* ==========================================================================
   Subscriber Fiber Drop Cable Tension, Rooftop Routing & Grounding Safety QA Certificate (agent3)
   ========================================================================== */

export const DROP_INSPECTIONS_KEY = 'shahdara_drop_inspections_v1';

export const DROP_ANCHOR_TYPES = [
  'J-Hook Tension Clamp',
  'Dead-End Helical Guy Grip',
  'Span Clamp with Hook',
  'Direct Wall Anchor Expansion Bolt',
  'Porcelain Spool Insulator'
];

export const DROP_CABLE_TYPES = [
  '1-Core Round Aerial Drop (Steel Messenger)',
  '2-Core Bow-Type Flat Drop (FRP)',
  '4-Core Self-Supporting Figure-8',
  'Armored Direct Burial / Duct Drop'
];

export const DROP_SURFACE_TYPES = [
  'Brick Wall / Plaster',
  'RCC Roof Parapet',
  'Galvanized Steel Pole',
  'Wood Mast / Purlin'
];

export const DROP_SAFETY_VERDICTS = {
  CERTIFIED_PASS: 'CERTIFIED_PASS',
  CONDITIONAL_PASS: 'CONDITIONAL_PASS',
  FAILED_SAFETY_HAZARD: 'FAILED_SAFETY_HAZARD'
};

/**
 * Calculates catenary tension load on aerial fiber drop cable span.
 * Formula: T = (w * L^2) / (8 * s) in Newtons.
 * @param {number} spanMeters
 * @param {number} sagCm
 * @param {number} [cableWeightGPerM=35]
 * @returns {{ tensionNewtons: number, safeWorkingLoadMarginPercent: number, isTensionSafe: boolean }}
 */
export function calculateDropTensionLoad(spanMeters, sagCm, cableWeightGPerM = 35) {
  const span = Number(spanMeters) || 0;
  const sagCmVal = Number(sagCm);
  const sagMeters = sagCmVal / 100;
  const weightKgM = (Math.max(1, Number(cableWeightGPerM) || 35)) / 1000;
  const weightNM = weightKgM * 9.80665; // N/m

  if (span <= 0 || isNaN(sagCmVal) || sagCmVal <= 0 || sagMeters <= 0) {
    return {
      tensionNewtons: 0,
      horizontalTensionNewtons: 0,
      safeWorkingLoadMarginPercent: 100,
      isTensionSafe: true,
      loadStatus: 'INVALID',
      sagRatioPercent: 0
    };
  }

  // Catenary tension: T = (w * L^2) / (8 * s)
  const tension = (weightNM * Math.pow(span, 2)) / (8 * sagMeters);
  const roundedTension = Math.round(tension * 10) / 10;
  const swlMax = 250; // 250N safe continuous working load limit
  const margin = Math.round(((swlMax - roundedTension) / swlMax) * 100);
  const sagRatioPercent = span > 0 ? Math.round(((sagCmVal / (span * 100)) * 100) * 10) / 10 : 0;

  let loadStatus = 'OPTIMAL';
  if (roundedTension > 400) {
    loadStatus = 'EXCESSIVE_TENSION';
  } else if (sagRatioPercent > 2.5) {
    loadStatus = 'EXCESSIVE_SAG';
  }

  return {
    tensionNewtons: roundedTension,
    horizontalTensionNewtons: roundedTension,
    safeWorkingLoadMarginPercent: margin,
    isTensionSafe: roundedTension <= swlMax,
    loadStatus,
    sagRatioPercent
  };
}

/**
 * Evaluates comprehensive civil, optical and electrical safety compliance for drop installation.
 * @param {object} params
 * @returns {{ verdict: string, verdictBadgeClass: string, verdictLabel: string, recommendations: string[], verdictKey: string, isHazard: boolean, hazards: string[], warnings: string[] }}
 */
export function evaluateDropSafetyCompliance(params = {}) {
  const {
    spanMeters = 0,
    sagCm = 0,
    tensionNewtons = 0,
    bendRadiusMm = 30,
    groundResistanceOhms = 5,
    checklist = {}
  } = params;

  const recs = [];
  let tension = Number(tensionNewtons) || 0;
  if (!tension && spanMeters && sagCm) {
    tension = calculateDropTensionLoad(spanMeters, sagCm).horizontalTensionNewtons;
  }
  const bend = Number(bendRadiusMm) || 0;
  const ground = Number(groundResistanceOhms) || 0;
  const clearance = Number(params.clearanceMeters ?? 2.0);
  const electricalCrossing = !!params.electricalCrossing;
  const anchorType = String(params.anchorType || '');
  const surfaceType = String(params.surfaceType || '');
  const groundingBonded = params.groundingBonded !== undefined
    ? !!params.groundingBonded
    : (checklist.lightningSurgeArrester !== false);
  const dripLoop = params.dripLoopInstalled !== undefined
    ? !!params.dripLoopInstalled
    : (checklist.dripLoopInstalled !== false);
  const uvProtected = params.uvConduitProtected !== undefined
    ? !!params.uvConduitProtected
    : (checklist.uvTiesSecured !== false);

  const hasDripLoop = dripLoop;
  const hasUvTies = uvProtected;
  const hasConduit = checklist.wallConduitSleeve !== false;
  const hasSeal = checklist.siliconeWeatherproofSeal !== false;
  const hasSurgeGround = groundingBonded;

  // Severe hazard checks
  if (clearance < 0.6 || (electricalCrossing && clearance < 1.0)) {
    recs.push('CRITICAL: Clearance from electrical distribution line is dangerously low (< 0.6m). Electrocution / arc flash hazard.');
  }
  if (anchorType.includes('Makeshift') || anchorType.includes('Direct Cable Tie') || surfaceType.includes('Loose') || surfaceType.includes('Wooden Rafter')) {
    recs.push('CRITICAL: Makeshift anchoring hardware or unstable wooden/plaster surface. Pullout collapse hazard.');
  }
  if (tension > 600 || tension > 450) {
    recs.push('CRITICAL: Tensile load exceeds safe working capacity (> 450N). Snap hazard under high wind.');
  }
  if (bend < 15 && bend > 0) {
    recs.push('CRITICAL: Macro-bending radius is under 15mm. Immediate optical core breakage / severe attenuation hazard.');
  }
  if (ground > 50) {
    recs.push('CRITICAL: Ground resistance > 50 Ohms exceeds lightning surge safety limit (target < 10 Ohms).');
  }

  if (recs.length > 0) {
    return {
      verdict: DROP_SAFETY_VERDICTS.FAILED_SAFETY_HAZARD,
      verdictKey: 'FAILED_SAFETY_HAZARD',
      verdictBadgeClass: 'badge-danger',
      verdictLabel: 'Safety Hazard (Rectification Required)',
      recommendations: recs,
      hazards: recs,
      warnings: [],
      isHazard: true
    };
  }

  // Conditional warnings
  const condRecs = [];
  if (tension > 250) {
    condRecs.push('High mechanical tension (> 250N). Increase mid-span sag or add intermediate strain clamp.');
  }
  if (ground > 10 && ground <= 50) {
    condRecs.push('Grounding resistance is 10-50 Ohms. Recommend deepening ground rod or chemical earthing salt.');
  }
  if (!dripLoop) {
    condRecs.push('Water ingress drip loop omitted at exterior wall entry. Rainwater tracking towards ONT entry possible.');
  }
  if (!uvProtected) {
    condRecs.push('Standard zip ties used without UV conduit sleeve. Sunlight degradation expected.');
  }
  if (!groundingBonded) {
    condRecs.push('ONT electrical grounding not bonded to ground bus.');
  }

  if (condRecs.length > 0) {
    return {
      verdict: DROP_SAFETY_VERDICTS.CONDITIONAL_PASS,
      verdictKey: 'CONDITIONAL_PASS',
      verdictBadgeClass: 'badge-warning',
      verdictLabel: 'Conditional Pass (Advisory Monitoring)',
      recommendations: condRecs,
      hazards: [],
      warnings: condRecs,
      isHazard: false
    };
  }

  return {
    verdict: DROP_SAFETY_VERDICTS.CERTIFIED_PASS,
    verdictKey: 'CERTIFIED_PASS',
    verdictBadgeClass: 'badge-success',
    verdictLabel: 'Certified Safe & Compliant',
    recommendations: ['All ITU-T & civil safety standards verified. Installation approved for service.'],
    hazards: [],
    warnings: [],
    isHazard: false
  };
}

/**
 * Validates drop safety inspection form inputs.
 * @param {object} data
 * @returns {{ isValid: boolean, errors: Array<string> & object }}
 */
export function validateDropSafetyInspection(data = {}) {
  const errors = {};

  const span = Number(data.spanMeters);
  if (isNaN(span) || span <= 0 || span > 300) {
    errors.spanMeters = 'Span length must be between 1 and 300 meters.';
  }

  const sag = Number(data.sagCm);
  if (isNaN(sag) || sag <= 0 || sag > 200) {
    errors.sagCm = 'Mid-span sag must be between 1 and 200 cm.';
  }

  const inspector = data.inspectorName || data.technicianName;
  if (!inspector || !String(inspector).trim()) {
    errors.technicianName = 'Lead inspector / lineman name is required.';
  }

  const errorList = Object.values(errors);
  const compositeErrors = Object.assign(errorList, errors);

  return {
    isValid: errorList.length === 0,
    errors: compositeErrors
  };
}

/**
 * Builds a structured Drop Safety Inspection Record.
 * @param {object} customer
 * @param {object} formData
 * @param {object} [options]
 * @returns {object} Record with ID DRP-YYYYMM-XXXX
 */
export function buildDropInspectionRecord(customer = {}, formData = {}, options = {}) {
  const d = options.now ? new Date(options.now) : new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const existing = options.sequence ? (options.sequence - 1) : (options.existingCount || 0);
  const seq = String(existing + 1).padStart(4, '0');
  const recordId = options.id || `DRP-${yyyy}${mm}-${seq}`;

  const spanMeters = Number(formData.spanMeters) || 45;
  const sagCm = Number(formData.sagCm) || 25;
  const cableWeight = Number(formData.cableWeightGPerM) || 35;
  const tensionInfo = calculateDropTensionLoad(spanMeters, sagCm, cableWeight);

  const bendRadiusMm = Number(formData.bendRadiusMm) || 35;
  const groundResistanceOhms = Number(formData.groundResistanceOhms) || 4.5;
  const checklist = {
    dripLoopInstalled: formData.dripLoopInstalled !== false,
    uvTiesSecured: formData.uvTiesSecured !== false,
    wallConduitSleeve: formData.wallConduitSleeve !== false,
    siliconeWeatherproofSeal: formData.siliconeWeatherproofSeal !== false,
    lightningSurgeArrester: formData.lightningSurgeArrester !== false
  };

  const evalCompliance = evaluateDropSafetyCompliance({
    spanMeters,
    sagCm,
    tensionNewtons: tensionInfo.tensionNewtons,
    bendRadiusMm,
    groundResistanceOhms,
    checklist,
    anchorType: formData.anchorType,
    surfaceType: formData.surfaceType,
    clearanceMeters: formData.clearanceMeters,
    electricalCrossing: formData.electricalCrossing,
    groundingBonded: formData.groundingBonded,
    dripLoopInstalled: formData.dripLoopInstalled,
    uvConduitProtected: formData.uvConduitProtected
  });

  const inspector = formData.inspectorName || formData.technicianName || 'Field QA Lineman';

  return {
    id: recordId,
    customerId: customer.id || '',
    customerName: customer.name || 'Subscriber',
    customerPhone: customer.phone || '',
    customerArea: customer.area || 'Shahdara',
    anchorType: formData.anchorType || 'J-Hook Tension Clamp',
    cableType: formData.cableType || '1-Core Round Aerial Drop (Steel Messenger)',
    surfaceType: formData.surfaceType || 'Brick Wall / Plaster',
    spanMeters,
    sagCm,
    cableWeightGPerM: cableWeight,
    tensionNewtons: tensionInfo.tensionNewtons,
    safeWorkingLoadMarginPercent: tensionInfo.safeWorkingLoadMarginPercent,
    isTensionSafe: tensionInfo.isTensionSafe,
    bendRadiusMm,
    groundResistanceOhms,
    checklist,
    verdict: evalCompliance.verdict,
    verdictBadgeClass: evalCompliance.verdictBadgeClass,
    verdictLabel: evalCompliance.verdictLabel,
    recommendations: evalCompliance.recommendations,
    technicianName: inspector,
    inspectorName: inspector,
    compliance: {
      verdictKey: evalCompliance.verdict,
      verdictLabel: evalCompliance.verdictLabel,
      isHazard: evalCompliance.verdict === 'FAILED_SAFETY_HAZARD',
      recommendations: evalCompliance.recommendations
    },
    tension: {
      horizontalTensionNewtons: tensionInfo.tensionNewtons,
      loadStatus: tensionInfo.isTensionSafe ? 'OPTIMAL' : 'EXCESSIVE_TENSION',
      sagRatioPercent: tensionInfo.sagRatioPercent || ((sagCm / (spanMeters * 100)) * 100)
    },
    status: formData.status || 'ACTIVE',
    inspectionDate: formData.inspectionDate || d.toISOString().slice(0, 10),
    timestamp: d.toISOString(),
    notes: formData.notes || ''
  };
}

/**
 * Resolves local storage safely in Node or Browser contexts.
 */
function resolveDropStorage(storage) {
  if (storage) return storage;
  if (typeof localStorage !== 'undefined') return localStorage;
  return null;
}

/**
 * Retrieves saved Drop Safety Inspection records from storage.
 * @param {Storage} [storage]
 * @param {string} [customerId]
 * @returns {Array<object>}
 */
export function getSavedDropInspections(storage = null, customerId = null) {
  const store = resolveDropStorage(storage);
  if (!store) return [];
  try {
    const raw = store.getItem(DROP_INSPECTIONS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    if (customerId) {
      return list.filter(r => r.customerId === customerId);
    }
    return list;
  } catch (err) {
    console.error('Failed to get saved drop inspections:', err);
    return [];
  }
}

/**
 * Saves a new Drop Safety Inspection record into storage.
 * @param {Storage} storage
 * @param {object} record
 * @returns {boolean} Success
 */
export function saveDropInspection(storage, record) {
  const store = resolveDropStorage(storage);
  if (!store || !record) return false;
  try {
    const list = getSavedDropInspections(store);
    const existingIdx = list.findIndex(r => r.id === record.id);
    if (existingIdx >= 0) {
      list[existingIdx] = record;
    } else {
      list.unshift(record);
    }
    store.setItem(DROP_INSPECTIONS_KEY, JSON.stringify(list));
    return true;
  } catch (err) {
    console.error('Failed to save drop inspection:', err);
    return false;
  }
}

/**
 * Updates status of a drop inspection.
 * @param {Storage} storage
 * @param {string} recordId
 * @param {string} newStatus
 * @param {string} [notes]
 * @returns {boolean}
 */
export function updateDropInspectionStatus(storage, recordId, newStatus, notes = '') {
  const store = resolveDropStorage(storage);
  if (!store || !recordId) return null;
  try {
    const list = getSavedDropInspections(store);
    const item = list.find(r => r.id === recordId);
    if (!item) return null;
    item.status = newStatus;
    if (newStatus === 'SAFETY_RECTIFIED') {
      if (!item.compliance) item.compliance = {};
      item.compliance.verdictLabel = 'Safety Rectified';
      item.compliance.isHazard = false;
    }
    if (notes) {
      item.notes = (item.notes ? `${item.notes} | ` : '') + notes;
      item.remediationNotes = notes;
    }
    store.setItem(DROP_INSPECTIONS_KEY, JSON.stringify(list));
    return item;
  } catch (err) {
    console.error('Failed to update drop inspection status:', err);
    return null;
  }
}

/**
 * Clears saved drop inspections.
 * @param {Storage} storage
 * @returns {boolean}
 */
export function clearDropInspections(storage) {
  const store = resolveDropStorage(storage);
  if (!store) return false;
  try {
    store.removeItem(DROP_INSPECTIONS_KEY);
    return true;
  } catch (err) {
    console.error('Failed to clear drop inspections:', err);
    return false;
  }
}

/**
 * Aggregates summary KPIs from inspection records.
 * @param {Array<object>} records
 * @returns {object} Summary metrics
 */
export function calculateDropInspectionMetrics(records = []) {
  if (!Array.isArray(records) || records.length === 0) {
    return {
      total: 0,
      totalInspections: 0,
      certifiedCount: 0,
      conditionalCount: 0,
      hazardCount: 0,
      passRate: 100,
      passRatePercent: 100,
      averageSpanMeters: 0,
      averageTensionNewtons: 0,
      highTensionCount: 0
    };
  }

  let cert = 0;
  let cond = 0;
  let haz = 0;
  let totalSpan = 0;
  let totalTension = 0;
  let highTension = 0;

  for (const r of records) {
    const v = r.compliance?.verdictKey || r.verdict;
    if (v === DROP_SAFETY_VERDICTS.CERTIFIED_PASS || v === 'CERTIFIED_PASS') cert++;
    else if (v === DROP_SAFETY_VERDICTS.CONDITIONAL_PASS || v === 'CONDITIONAL_PASS') cond++;
    else if (v === DROP_SAFETY_VERDICTS.FAILED_SAFETY_HAZARD || v === 'FAILED_SAFETY_HAZARD') haz++;

    const span = (Number(r.spanMeters) || 0);
    const tension = (Number(r.tensionNewtons) || Number(r.tension?.horizontalTensionNewtons) || 0);
    totalSpan += span;
    totalTension += tension;
    if (tension > 250) highTension++;
  }

  const total = records.length;
  const passRate = total > 0 ? Math.round((cert / total) * 100) : 100;
  const passRatePercent = total > 0 ? Math.round(((cert + cond) / total) * 1000) / 10 : 100;

  return {
    total,
    totalInspections: total,
    certifiedCount: cert,
    conditionalCount: cond,
    hazardCount: haz,
    passRate,
    passRatePercent,
    averageSpanMeters: total > 0 ? Math.round((totalSpan / total) * 10) / 10 : 0,
    averageTensionNewtons: total > 0 ? Math.round((totalTension / total) * 10) / 10 : 0,
    highTensionCount: highTension
  };
}

/**
 * Formats a bilingual WhatsApp dispatch notification.
 * @param {object} record
 * @returns {string} WhatsApp-ready text
 */
export function formatDropInspectionWhatsApp(record) {
  if (!record) return '';
  const vEmoji = record.verdict === DROP_SAFETY_VERDICTS.CERTIFIED_PASS ? '✅' : record.verdict === DROP_SAFETY_VERDICTS.CONDITIONAL_PASS ? '⚠️' : '🔴';

  return `🏗️ *SHAHDARA ISP - DROP CABLE SAFETY QA CERTIFICATE*
📄 *Certificate #:* ${record.id}
👤 *Subscriber:* ${record.customerName} (${record.customerArea})
📅 *Date:* ${record.inspectionDate}

📐 *Engineering Specifications:*
• Anchor: ${record.anchorType} on ${record.surfaceType}
• Span Length: ${record.spanMeters}m | Mid-Span Sag: ${record.sagCm}cm
• Calculated Tension: ${record.tensionNewtons} N (SWL Margin: ${record.safeWorkingLoadMarginPercent}%)
• Min Bend Radius: ${record.bendRadiusMm} mm
• Grounding Resistance: ${record.groundResistanceOhms} Ω

🛡️ *Safety Checklist:*
• Drip Loop: ${record.checklist?.dripLoopInstalled ? 'Yes ✅' : 'No ❌'}
• UV Ties: ${record.checklist?.uvTiesSecured ? 'Yes ✅' : 'No ❌'}
• Wall Conduit: ${record.checklist?.wallConduitSleeve ? 'Yes ✅' : 'No ❌'}
• Silicone Seal: ${record.checklist?.siliconeWeatherproofSeal ? 'Yes ✅' : 'No ❌'}
• Ground Arrester: ${record.checklist?.lightningSurgeArrester ? 'Yes ✅' : 'No ❌'}

${vEmoji} *QA Verdict:* ${record.verdictLabel}
👷 *Inspector:* ${record.technicianName}

_Shahdara Outside Plant (OSP) Structural & Electrical Safety Compliance_`;
}

/**
 * Generates printable HTML representation for Drop Cable Safety QA Inspection.
 * @param {object} record
 * @param {{ mode?: 'a4' | 'thermal' }} [options]
 * @returns {string}
 */
export function generateDropInspectionHtml(record, { mode = 'a4' } = {}) {
  if (!record) return '';

  if (mode === 'thermal') {
    return `
      <div class="thermal-receipt drop-thermal-slip" style="width: 280px; font-family: monospace; font-size: 11px; padding: 10px; color: #000;">
        <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px;">
          <h3 style="margin: 0; font-size: 14px;">SHAHDARA BROADBAND</h3>
          <p style="margin: 2px 0;">DROP CABLE SAFETY SLIP</p>
          <p style="margin: 0; font-size: 10px;">سرٹیفکیٹ کیبل تنصیب و ارتھنگ</p>
          <div style="font-size: 10px; margin-top: 4px;"><strong>${escapeHtml(record.id)}</strong></div>
        </div>

        <div style="margin-bottom: 6px; border-bottom: 1px dashed #000; padding-bottom: 6px;">
          <div>Sub: <strong>${escapeHtml(record.customerName)}</strong></div>
          <div>Area: ${escapeHtml(record.customerArea)}</div>
          <div>Date: ${escapeHtml(record.inspectionDate)}</div>
        </div>

        <div style="margin-bottom: 6px; border-bottom: 1px dashed #000; padding-bottom: 6px;">
          <div>Span: <strong>${record.spanMeters}m</strong> | Sag: <strong>${record.sagCm}cm</strong></div>
          <div>Tension: <strong>${record.tensionNewtons} N</strong> (${record.isTensionSafe ? 'Safe' : 'High'})</div>
          <div>Bend: <strong>${record.bendRadiusMm}mm</strong></div>
          <div>Earthing: <strong>${record.groundResistanceOhms} Ω</strong></div>
        </div>

        <div style="margin-bottom: 6px; border-bottom: 1px dashed #000; padding-bottom: 6px; text-align: center;">
          <div style="font-weight: bold; font-size: 12px;">${escapeHtml(record.verdictLabel)}</div>
          <div style="font-size: 9px; margin-top: 2px;">Tech: ${escapeHtml(record.technicianName)}</div>
        </div>

        <div style="display: flex; justify-content: space-between; margin-top: 15px; font-size: 9px; text-align: center;">
          <div style="border-top: 1px solid #000; width: 45%; padding-top: 2px;">Tech Sign</div>
          <div style="border-top: 1px solid #000; width: 45%; padding-top: 2px;">Subscriber Sign</div>
        </div>
      </div>
    `;
  }

  // Formal A4 Certificate
  return `
    <div class="a4-document drop-a4-cert" style="max-width: 800px; margin: 0 auto; padding: 24px; font-family: system-ui, sans-serif; color: #0f172a; line-height: 1.4;">
      <header style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 18px;">
        <div>
          <h2 style="margin: 0; color: #0369a1; font-size: 20px; font-weight: 800;">SHAHDARA FIBER BROADBAND SERVICES</h2>
          <p style="margin: 3px 0 0; font-size: 12px; color: #475569;">Outside Plant (OSP) Engineering &amp; Civil Safety Quality Assurance Directorate</p>
          <p style="margin: 3px 0 0; font-size: 13px; font-weight: bold; color: #0284c7; direction: rtl;">فائبر آپٹک ڈراپ کیبل تنصیب، کھنچاؤ اور حفاظتی سرٹیفکیٹ</p>
        </div>
        <div style="text-align: right;">
          <span style="display: inline-block; background: #0284c7; color: #fff; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">QA CERTIFICATE</span>
          <div style="font-family: monospace; font-weight: bold; font-size: 13px; margin-top: 4px;">${escapeHtml(record.id)}</div>
          <div style="font-size: 11px; color: #64748b;">${escapeHtml(record.inspectionDate)}</div>
        </div>
      </header>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
        <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; background: #f8fafc;">
          <h4 style="margin: 0 0 8px; font-size: 12px; text-transform: uppercase; color: #0369a1; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">1. Subscriber &amp; Location Details</h4>
          <table style="width: 100%; font-size: 12px;">
            <tr><td style="color: #64748b; width: 130px;">Subscriber Name:</td><td><strong>${escapeHtml(record.customerName)}</strong></td></tr>
            <tr><td style="color: #64748b;">Phone Number:</td><td>${escapeHtml(record.customerPhone || 'N/A')}</td></tr>
            <tr><td style="color: #64748b;">Installation Area:</td><td>${escapeHtml(record.customerArea)}</td></tr>
            <tr><td style="color: #64748b;">Surface Material:</td><td>${escapeHtml(record.surfaceType)}</td></tr>
          </table>
        </div>

        <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; background: #f8fafc;">
          <h4 style="margin: 0 0 8px; font-size: 12px; text-transform: uppercase; color: #0369a1; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">2. Hardware &amp; Anchor Specs</h4>
          <table style="width: 100%; font-size: 12px;">
            <tr><td style="color: #64748b; width: 130px;">Anchor Hardware:</td><td><strong>${escapeHtml(record.anchorType)}</strong></td></tr>
            <tr><td style="color: #64748b;">Cable Specification:</td><td>${escapeHtml(record.cableType)}</td></tr>
            <tr><td style="color: #64748b;">Span &amp; Sag:</td><td>${record.spanMeters}m span / ${record.sagCm}cm sag</td></tr>
            <tr><td style="color: #64748b;">Calculated Tension:</td><td><strong>${record.tensionNewtons} N</strong> (${record.safeWorkingLoadMarginPercent}% margin)</td></tr>
          </table>
        </div>
      </div>

      <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; margin-bottom: 16px; background: #fff;">
        <h4 style="margin: 0 0 8px; font-size: 12px; text-transform: uppercase; color: #0369a1; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">3. Physical Safety &amp; Electrical Protection Checklist</h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; font-size: 12px;">
          <div>Drip Loop Wall Entry: <strong>${record.checklist?.dripLoopInstalled ? '✅ Verified' : '❌ Missing'}</strong></div>
          <div>UV-Stabilized Cable Ties: <strong>${record.checklist?.uvTiesSecured ? '✅ Verified' : '❌ Standard Ties'}</strong></div>
          <div>Conduit Wall Sleeve: <strong>${record.checklist?.wallConduitSleeve ? '✅ Installed' : '❌ Omitted'}</strong></div>
          <div>Silicone Seal Weatherproof: <strong>${record.checklist?.siliconeWeatherproofSeal ? '✅ Sealed' : '❌ Unsealed'}</strong></div>
          <div>Lightning Ground Arrester: <strong>${record.checklist?.lightningSurgeArrester ? '✅ Connected' : '❌ Omitted'}</strong></div>
          <div>Min Bend Radius: <strong>${record.bendRadiusMm} mm</strong> (Target &ge;30mm)</div>
          <div>Ground Resistance: <strong>${record.groundResistanceOhms} &Omega;</strong> (Target &le;10&Omega;)</div>
        </div>
      </div>

      <div style="border: 2px solid ${record.verdict === DROP_SAFETY_VERDICTS.CERTIFIED_PASS ? '#10b981' : record.verdict === DROP_SAFETY_VERDICTS.CONDITIONAL_PASS ? '#f59e0b' : '#ef4444'}; border-radius: 8px; padding: 14px; background: ${record.verdict === DROP_SAFETY_VERDICTS.CERTIFIED_PASS ? '#f0fdf4' : record.verdict === DROP_SAFETY_VERDICTS.CONDITIONAL_PASS ? '#fffbeb' : '#fef2f2'}; margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <h4 style="margin: 0; font-size: 14px; font-weight: 800; color: #0f172a;">Quality &amp; Safety Compliance Verdict</h4>
          <span style="font-weight: bold; font-size: 13px; color: ${record.verdict === DROP_SAFETY_VERDICTS.CERTIFIED_PASS ? '#059669' : record.verdict === DROP_SAFETY_VERDICTS.CONDITIONAL_PASS ? '#d97706' : '#dc2626'};">${escapeHtml(record.verdictLabel)}</span>
        </div>
        <ul style="margin: 0; padding-left: 20px; font-size: 12px; color: #334155;">
          ${(record.recommendations || []).map(r => `<li>${escapeHtml(r)}</li>`).join('')}
        </ul>
      </div>

      <footer style="display: flex; justify-content: space-between; padding-top: 16px; border-top: 1px solid #cbd5e1; font-size: 11px; text-align: center;">
        <div style="width: 200px;">
          <div style="height: 40px; border-bottom: 1px solid #000; margin-bottom: 4px;"></div>
          <strong>${escapeHtml(record.technicianName)}</strong>
          <div style="color: #64748b;">Field QA Inspector</div>
        </div>
        <div style="width: 200px;">
          <div style="height: 40px; border-bottom: 1px solid #000; margin-bottom: 4px;"></div>
          <strong>${escapeHtml(record.customerName)}</strong>
          <div style="color: #64748b;">Subscriber Sign-off</div>
        </div>
        <div style="width: 200px;">
          <div style="height: 40px; border: 1px dashed #94a3b8; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-weight: bold; margin-bottom: 4px;">OFFICIAL STAMP</div>
          <strong>Shahdara OSP Operations</strong>
          <div style="color: #64748b;">Authorized QA Seal</div>
        </div>
      </footer>
    </div>
  `;
}

/**
 * Generates RFC-4180 compliant CSV export of Drop Safety Inspection records.
 * @param {Array<object>} records
 * @returns {string} CSV with UTF-8 BOM
 */
export function generateDropInspectionsCsv(records = []) {
  const headers = [
    'Certificate ID',
    'Customer ID',
    'Subscriber Name',
    'Area',
    'Anchor Type',
    'Surface Type',
    'Span (m)',
    'Sag (cm)',
    'Tension (N)',
    'Tension Safe',
    'Bend Radius (mm)',
    'Ground Resistance (Ohms)',
    'Verdict',
    'Inspector',
    'Inspection Date',
    'Status'
  ];

  const escapeCsv = (val) => {
    const s = String(val ?? '').replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = (records || []).map(r => [
    escapeCsv(r.id),
    escapeCsv(r.customerId),
    escapeCsv(r.customerName),
    escapeCsv(r.customerArea),
    escapeCsv(r.anchorType),
    escapeCsv(r.surfaceType),
    escapeCsv(r.spanMeters),
    escapeCsv(r.sagCm),
    escapeCsv(r.tensionNewtons),
    escapeCsv(r.isTensionSafe ? 'YES' : 'NO'),
    escapeCsv(r.bendRadiusMm),
    escapeCsv(r.groundResistanceOhms),
    escapeCsv(r.verdict),
    escapeCsv(r.technicianName),
    escapeCsv(r.inspectionDate),
    escapeCsv(r.status)
  ].join(','));

  return '\uFEFF' + [headers.map(h => `"${h}"`).join(','), ...rows].join('\r\n');
}

/**
 * Sets up the interactive controller for `#dropSafetyInspectionModal`.
 * @param {object} options
 */
export function setupDropSafetyInspectionModal(options = {}) {
  const modal = options.modalElement || document.getElementById('dropSafetyInspectionModal');
  if (!modal) return null;

  const storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  const getState = options.getState || (() => ({}));
  const onToast = options.onToast || console.log;

  // Header and elements
  const subNameEl = modal.querySelector('#dropSubName');
  const subAreaEl = modal.querySelector('#dropSubArea');
  const kpiTotal = modal.querySelector('#dropKpiTotal');
  const kpiCert = modal.querySelector('#dropKpiCert');
  const kpiRate = modal.querySelector('#dropKpiRate');
  const kpiHazard = modal.querySelector('#dropKpiHazard');

  // Form inputs
  const anchorTypeSelect = modal.querySelector('#dropAnchorTypeSelect');
  const surfaceTypeSelect = modal.querySelector('#dropSurfaceTypeSelect');
  const spanInput = modal.querySelector('#dropSpanInput');
  const sagInput = modal.querySelector('#dropSagInput');
  const bendInput = modal.querySelector('#dropBendInput');
  const groundInput = modal.querySelector('#dropGroundInput');
  const techInput = modal.querySelector('#dropTechInput');
  const notesInput = modal.querySelector('#dropNotesInput');

  // Checkboxes
  const chkDrip = modal.querySelector('#dropChkDripLoop');
  const chkUv = modal.querySelector('#dropChkUvTies');
  const chkConduit = modal.querySelector('#dropChkConduit');
  const chkSeal = modal.querySelector('#dropChkSeal');
  const chkArrester = modal.querySelector('#dropChkArrester');

  // Live preview box
  const previewTensionN = modal.querySelector('#dropPreviewTension');
  const previewVerdictBadge = modal.querySelector('#dropPreviewVerdictBadge');
  const previewRecsList = modal.querySelector('#dropPreviewRecsList');

  // Table & filters
  const filterVerdictSelect = modal.querySelector('#dropFilterVerdictSelect');
  const searchInput = modal.querySelector('#dropSearchInput');
  const tableBody = modal.querySelector('#dropHistoryTableBody');

  // Actions
  const submitBtn = modal.querySelector('#dropSubmitBtn');
  const whatsappBtn = modal.querySelector('#dropCopyWhatsAppBtn');
  const printA4Btn = modal.querySelector('#dropPrintA4Btn');
  const printThermalBtn = modal.querySelector('#dropPrintThermalBtn');
  const exportCsvBtn = modal.querySelector('#dropExportCsvBtn');
  const closeBtn = modal.querySelector('#closeDropSafetyModalBtn');

  let activeCustomer = null;

  function setCustomerContext(cust) {
    activeCustomer = cust || null;
    if (subNameEl) subNameEl.textContent = activeCustomer ? activeCustomer.name : 'All Subscribers';
    if (subAreaEl) subAreaEl.textContent = activeCustomer ? (activeCustomer.area || 'Shahdara') : 'Network Wide';
    recalculateLivePreview();
    renderList();
    renderKpis();
  }

  function recalculateLivePreview() {
    const span = Number(spanInput?.value) || 45;
    const sag = Number(sagInput?.value) || 25;
    const bend = Number(bendInput?.value) || 35;
    const ground = Number(groundInput?.value) || 5;

    const tensionInfo = calculateDropTensionLoad(span, sag);
    if (previewTensionN) {
      previewTensionN.textContent = `${tensionInfo.tensionNewtons} N (${tensionInfo.safeWorkingLoadMarginPercent}% margin)`;
    }

    const checklist = {
      dripLoopInstalled: chkDrip ? chkDrip.checked : true,
      uvTiesSecured: chkUv ? chkUv.checked : true,
      wallConduitSleeve: chkConduit ? chkConduit.checked : true,
      siliconeWeatherproofSeal: chkSeal ? chkSeal.checked : true,
      lightningSurgeArrester: chkArrester ? chkArrester.checked : true
    };

    const comp = evaluateDropSafetyCompliance({
      spanMeters: span,
      sagCm: sag,
      tensionNewtons: tensionInfo.tensionNewtons,
      bendRadiusMm: bend,
      groundResistanceOhms: ground,
      checklist
    });

    if (previewVerdictBadge) {
      previewVerdictBadge.className = `sim-delta-badge ${comp.verdictBadgeClass}`;
      previewVerdictBadge.textContent = comp.verdictLabel;
    }

    if (previewRecsList) {
      previewRecsList.innerHTML = comp.recommendations.map(r => `<li>${escapeHtml(r)}</li>`).join('');
    }
  }

  function renderKpis() {
    const records = getSavedDropInspections(storage);
    const metrics = calculateDropInspectionMetrics(records);

    if (kpiTotal) kpiTotal.textContent = String(metrics.totalInspections);
    if (kpiCert) kpiCert.textContent = String(metrics.certifiedCount);
    if (kpiRate) kpiRate.textContent = `${metrics.passRatePercent}%`;
    if (kpiHazard) kpiHazard.textContent = String(metrics.hazardCount);
  }

  function renderList() {
    if (!tableBody) return;
    const all = getSavedDropInspections(storage);
    const vFilter = filterVerdictSelect ? filterVerdictSelect.value : 'ALL';
    const q = (searchInput?.value || '').trim().toLowerCase();

    const filtered = all.filter(r => {
      if (vFilter !== 'ALL' && r.verdict !== vFilter) return false;
      if (q) {
        const text = `${r.id} ${r.customerName} ${r.customerArea} ${r.anchorType} ${r.technicianName}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding:16px;">No drop safety inspections found matching filters.</td></tr>`;
      return;
    }

    tableBody.innerHTML = filtered.map(r => `
      <tr>
        <td class="font-mono font-bold">${escapeHtml(r.id)}</td>
        <td>
          <div style="font-weight:600;">${escapeHtml(r.customerName)}</div>
          <small class="text-muted">${escapeHtml(r.customerArea)}</small>
        </td>
        <td>
          <div>${escapeHtml(r.anchorType)}</div>
          <small class="text-muted">${r.spanMeters}m span / ${r.sagCm}cm sag</small>
        </td>
        <td class="font-mono">
          <strong>${r.tensionNewtons} N</strong>
        </td>
        <td class="font-mono">
          <span>${r.groundResistanceOhms} &Omega;</span>
        </td>
        <td>
          <span class="sim-delta-badge ${r.verdictBadgeClass}">${escapeHtml(r.verdictLabel)}</span>
        </td>
        <td class="text-center">
          <button type="button" class="action-btn-sm" data-action="print-a4" data-id="${r.id}" title="Print A4 Certificate">🖨️ A4</button>
          <button type="button" class="action-btn-sm" data-action="print-slip" data-id="${r.id}" title="Print POS Slip">🧾 Slip</button>
          <button type="button" class="action-btn-sm" data-action="whatsapp" data-id="${r.id}" title="Share WhatsApp">💬 WhatsApp</button>
        </td>
      </tr>
    `).join('');

    // Wire table actions
    tableBody.querySelectorAll('[data-action="print-a4"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const rec = all.find(x => x.id === id);
        if (rec) {
          const html = generateDropInspectionHtml(rec, { mode: 'a4' });
          const win = window.open('', '_blank');
          if (win) {
            win.document.write(`<html><head><title>${rec.id}</title></head><body>${html}</body></html>`);
            win.document.close();
            win.print();
          }
        }
      });
    });

    tableBody.querySelectorAll('[data-action="print-slip"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const rec = all.find(x => x.id === id);
        if (rec) {
          const html = generateDropInspectionHtml(rec, { mode: 'thermal' });
          const win = window.open('', '_blank');
          if (win) {
            win.document.write(`<html><head><title>${rec.id}</title></head><body>${html}</body></html>`);
            win.document.close();
            win.print();
          }
        }
      });
    });

    tableBody.querySelectorAll('[data-action="whatsapp"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const rec = all.find(x => x.id === id);
        if (rec) {
          const text = formatDropInspectionWhatsApp(rec);
          if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(text).then(() => {
              onToast('WhatsApp notification copied to clipboard! Opening WhatsApp...');
              window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
            }).catch(() => {
              window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
            });
          } else {
            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
          }
        }
      });
    });
  }

  // Bind input listeners for live preview
  [spanInput, sagInput, bendInput, groundInput, chkDrip, chkUv, chkConduit, chkSeal, chkArrester].forEach(el => {
    if (el) {
      el.addEventListener('input', recalculateLivePreview);
      el.addEventListener('change', recalculateLivePreview);
    }
  });

  if (filterVerdictSelect) filterVerdictSelect.addEventListener('change', renderList);
  if (searchInput) searchInput.addEventListener('input', renderList);

  // Submit button
  if (submitBtn) {
    submitBtn.addEventListener('click', () => {
      const state = typeof getState === 'function' ? getState() : {};
      const cust = activeCustomer || state?.customers?.[0] || { id: 'CUST-GEN-01', name: 'General Subscriber', area: 'Shahdara' };

      const formData = {
        anchorType: anchorTypeSelect?.value || 'J-Hook Tension Clamp',
        surfaceType: surfaceTypeSelect?.value || 'Brick Wall / Plaster',
        spanMeters: Number(spanInput?.value) || 45,
        sagCm: Number(sagInput?.value) || 25,
        cableWeightGPerM: 35,
        bendRadiusMm: Number(bendInput?.value) || 35,
        groundResistanceOhms: Number(groundInput?.value) || 5,
        dripLoopInstalled: chkDrip ? chkDrip.checked : true,
        uvTiesSecured: chkUv ? chkUv.checked : true,
        wallConduitSleeve: chkConduit ? chkConduit.checked : true,
        siliconeWeatherproofSeal: chkSeal ? chkSeal.checked : true,
        lightningSurgeArrester: chkArrester ? chkArrester.checked : true,
        technicianName: techInput?.value || 'Field QA Lineman',
        notes: notesInput?.value || ''
      };

      const val = validateDropSafetyInspection({
        customerId: cust.id,
        spanMeters: formData.spanMeters,
        sagCm: formData.sagCm,
        bendRadiusMm: formData.bendRadiusMm,
        groundResistanceOhms: formData.groundResistanceOhms,
        technicianName: formData.technicianName
      });

      if (!val.isValid) {
        alert('Validation error: ' + Object.values(val.errors).join(', '));
        return;
      }

      const all = getSavedDropInspections(storage);
      const record = buildDropInspectionRecord(cust, formData, { existingCount: all.length });
      saveDropInspection(storage, record);

      onToast(`Drop Safety QA Certificate #${record.id} issued!`);
      renderList();
      renderKpis();
    });
  }

  // Copy WhatsApp
  if (whatsappBtn) {
    whatsappBtn.addEventListener('click', () => {
      const state = typeof getState === 'function' ? getState() : {};
      const cust = activeCustomer || state?.customers?.[0] || { id: 'CUST-GEN-01', name: 'General Subscriber', area: 'Shahdara' };
      const formData = {
        anchorType: anchorTypeSelect?.value || 'J-Hook Tension Clamp',
        surfaceType: surfaceTypeSelect?.value || 'Brick Wall / Plaster',
        spanMeters: Number(spanInput?.value) || 45,
        sagCm: Number(sagInput?.value) || 25,
        bendRadiusMm: Number(bendInput?.value) || 35,
        groundResistanceOhms: Number(groundInput?.value) || 5,
        technicianName: techInput?.value || 'Field QA Lineman'
      };
      const record = buildDropInspectionRecord(cust, formData);
      const text = formatDropInspectionWhatsApp(record);
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(() => {
          onToast('WhatsApp notification copied to clipboard! Opening WhatsApp...');
          window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
        }).catch(() => {
          window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
        });
      } else {
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
      }
    });
  }

  // Print A4
  if (printA4Btn) {
    printA4Btn.addEventListener('click', () => {
      const state = typeof getState === 'function' ? getState() : {};
      const cust = activeCustomer || state?.customers?.[0] || { id: 'CUST-GEN-01', name: 'General Subscriber', area: 'Shahdara' };
      const formData = {
        anchorType: anchorTypeSelect?.value || 'J-Hook Tension Clamp',
        surfaceType: surfaceTypeSelect?.value || 'Brick Wall / Plaster',
        spanMeters: Number(spanInput?.value) || 45,
        sagCm: Number(sagInput?.value) || 25,
        bendRadiusMm: Number(bendInput?.value) || 35,
        groundResistanceOhms: Number(groundInput?.value) || 5,
        technicianName: techInput?.value || 'Field QA Lineman'
      };
      const record = buildDropInspectionRecord(cust, formData);
      const html = generateDropInspectionHtml(record, { mode: 'a4' });
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(`<html><head><title>${record.id}</title></head><body>${html}</body></html>`);
        win.document.close();
        win.print();
      }
    });
  }

  // Print thermal
  if (printThermalBtn) {
    printThermalBtn.addEventListener('click', () => {
      const state = typeof getState === 'function' ? getState() : {};
      const cust = activeCustomer || state?.customers?.[0] || { id: 'CUST-GEN-01', name: 'General Subscriber', area: 'Shahdara' };
      const formData = {
        anchorType: anchorTypeSelect?.value || 'J-Hook Tension Clamp',
        surfaceType: surfaceTypeSelect?.value || 'Brick Wall / Plaster',
        spanMeters: Number(spanInput?.value) || 45,
        sagCm: Number(sagInput?.value) || 25,
        bendRadiusMm: Number(bendInput?.value) || 35,
        groundResistanceOhms: Number(groundInput?.value) || 5,
        technicianName: techInput?.value || 'Field QA Lineman'
      };
      const record = buildDropInspectionRecord(cust, formData);
      const html = generateDropInspectionHtml(record, { mode: 'thermal' });
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(`<html><head><title>${record.id}</title></head><body>${html}</body></html>`);
        win.document.close();
        win.print();
      }
    });
  }

  // Export CSV
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      const records = getSavedDropInspections(storage);
      const csv = generateDropInspectionsCsv(records);
      const filename = `shahdara_drop_safety_${new Date().toISOString().slice(0, 10)}.csv`;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      onToast(`Exported ${filename}`);
    });
  }

  // Trigger buttons
  const openBtns = document.querySelectorAll('[data-open-drop-inspection], #openDropInspectionBtn');
  openBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const state = typeof getState === 'function' ? getState() : {};
      const cust = activeCustomer || state?.customers?.[0] || null;
      setCustomerContext(cust);
      if (typeof modal.showModal === 'function') modal.showModal();
      else modal.setAttribute('open', '');
    });
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      if (typeof modal.close === 'function') modal.close();
      else modal.removeAttribute('open');
    });
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      if (typeof modal.close === 'function') modal.close();
      else modal.removeAttribute('open');
    }
  });

  return {
    open: (cust) => {
      setCustomerContext(cust);
      if (typeof modal.showModal === 'function') modal.showModal();
      else modal.setAttribute('open', '');
    },
    close: () => {
      if (typeof modal.close === 'function') modal.close();
      else modal.removeAttribute('open');
    },
    setCustomer: setCustomerContext,
    recalculate: () => {
      recalculateLivePreview();
      renderList();
      renderKpis();
    }
  };
}

/* ==========================================================================
   SUBSCRIBER LAN ETHERNET CABLING, RJ45 WIRE MAP & GIGABIT LINK SPEED QA CERTIFICATION
   ANSI/TIA-568-C.2 Cat6/Cat5e Fluke-style Transmission & Wire Map Evaluator
   ========================================================================== */

export const ETHERNET_CERT_STORAGE_KEY = 'shahdara_ethernet_cert_v1';

export const ETHERNET_CABLE_GRADES = {
  'CAT6': {
    name: 'Cat6 UTP / STP (250 MHz Gigabit+)',
    bandwidthMhz: 250,
    baseLossDbPer100m: 19.8,
    maxSpecMeters: 100,
    gigabitCapable: true,
    delayNsPerMeter: 4.85
  },
  'CAT5E': {
    name: 'Cat5e UTP (100 MHz Gigabit)',
    bandwidthMhz: 100,
    baseLossDbPer100m: 22.0,
    maxSpecMeters: 100,
    gigabitCapable: true,
    delayNsPerMeter: 5.10
  },
  'CAT5': {
    name: 'Cat5 Legacy (100 MHz Fast Ethernet)',
    bandwidthMhz: 100,
    baseLossDbPer100m: 24.5,
    maxSpecMeters: 100,
    gigabitCapable: false,
    delayNsPerMeter: 5.40
  },
  'CAT7': {
    name: 'Cat7 S/FTP Shielded (600 MHz 10G Ready)',
    bandwidthMhz: 600,
    baseLossDbPer100m: 17.5,
    maxSpecMeters: 100,
    gigabitCapable: true,
    delayNsPerMeter: 4.60
  }
};

export const WIRING_STANDARDS = {
  'T568B': {
    name: 'ANSI/TIA-568-C.2 T568B (Commercial Standard)',
    description: 'Standard ISP premises LAN pinout (Pair 2 on pins 1-2, Pair 3 on pins 3-6)',
    pinColors: [
      'White/Orange', 'Orange', 'White/Green', 'Blue',
      'White/Blue', 'Green', 'White/Brown', 'Brown'
    ]
  },
  'T568A': {
    name: 'ANSI/TIA-568-C.2 T568A (Residential Standard)',
    description: 'Residential telecom pinout (Pair 3 on pins 1-2, Pair 2 on pins 3-6)',
    pinColors: [
      'White/Green', 'Green', 'White/Orange', 'Blue',
      'White/Blue', 'Orange', 'White/Brown', 'Brown'
    ]
  }
};

export const ETHERNET_WIRE_PAIRS = [
  { pairNum: 2, pins: [1, 2], name: 'Pair 2 (Tx+ / Tx-)', baseColor: '#f97316' },
  { pairNum: 3, pins: [3, 6], name: 'Pair 3 (Rx+ / Rx-)', baseColor: '#10b981' },
  { pairNum: 1, pins: [4, 5], name: 'Pair 1 (Data+ / Data-)', baseColor: '#3b82f6' },
  { pairNum: 4, pins: [7, 8], name: 'Pair 4 (Data+ / Data-)', baseColor: '#a16207' }
];

/**
 * Evaluates an 8-conductor RJ45 termination wire map against TIA-568 standards.
 */
export function evaluateEthernetWireMap({ standard = 'T568B', faultType = 'NONE', customPinMap = null } = {}) {
  const std = WIRING_STANDARDS[standard] || WIRING_STANDARDS['T568B'];
  const pinColors = std.pinColors;

  let pinMap = [];
  for (let pin = 1; pin <= 8; pin++) {
    pinMap.push({
      pin,
      farPin: pin,
      color: pinColors[pin - 1],
      status: 'PASS',
      pair: pin === 1 || pin === 2 ? 2 : (pin === 3 || pin === 6 ? 3 : (pin === 4 || pin === 5 ? 1 : 4))
    });
  }

  let wireMapGrade = 'STRAIGHT_THROUGH_PASS';
  let pass = true;
  let gigabitSupported = true;
  let statusLabel = 'Straight-Through T568B Pass';
  let badgeClass = 'badge-success';
  let statusColor = '#10b981';
  let faultDescription = 'All 8 conductors pinned 1-to-1 in full compliance with ANSI/TIA-568.';

  if (faultType === 'OPEN_PIN_4') {
    pinMap[3].farPin = null;
    pinMap[3].status = 'OPEN';
    wireMapGrade = 'OPEN_FAULT';
    pass = false;
    gigabitSupported = false;
    statusLabel = 'Conductor 4 Open / Disconnected';
    badgeClass = 'badge-danger';
    statusColor = '#ef4444';
    faultDescription = 'Pin 4 (Blue) is disconnected or broken. Gigabit 1000BASE-T link will fail.';
  } else if (faultType === 'OPEN_PIN_7_8') {
    pinMap[6].farPin = null;
    pinMap[6].status = 'OPEN';
    pinMap[7].farPin = null;
    pinMap[7].status = 'OPEN';
    wireMapGrade = 'OPEN_FAULT_GIGABIT_DROPPED';
    pass = false;
    gigabitSupported = false;
    statusLabel = 'Pair 4 Open (Pins 7-8 Disconnected)';
    badgeClass = 'badge-warning';
    statusColor = '#f59e0b';
    faultDescription = 'Pins 7 & 8 (Brown pair) are severed. Link drops from 1000 Mbps Gigabit to 100 Mbps Fast Ethernet.';
  } else if (faultType === 'SHORT_PINS_1_2') {
    pinMap[0].status = 'SHORT';
    pinMap[1].status = 'SHORT';
    pinMap[0].farPin = '1+2';
    pinMap[1].farPin = '1+2';
    wireMapGrade = 'SHORT_FAULT';
    pass = false;
    gigabitSupported = false;
    statusLabel = 'Conductor Short on Pins 1 & 2';
    badgeClass = 'badge-danger';
    statusColor = '#ef4444';
    faultDescription = 'Short circuit detected between Pins 1 and 2 (Orange pair). Physical layer cannot synchronize.';
  } else if (faultType === 'SPLIT_PAIR_3_6') {
    pinMap[2].status = 'SPLIT';
    pinMap[3].status = 'SPLIT';
    wireMapGrade = 'SPLIT_PAIR_FAULT';
    pass = false;
    gigabitSupported = false;
    statusLabel = 'Split Pair Error (High NEXT Crosstalk)';
    badgeClass = 'badge-danger';
    statusColor = '#dc2626';
    faultDescription = 'Pin 3 & 4 split across different twisted pairs. Severe Near-End Crosstalk (NEXT) will cause packet loss.';
  } else if (faultType === 'REVERSED_PAIR_2') {
    pinMap[0].farPin = 2;
    pinMap[0].status = 'REVERSED';
    pinMap[1].farPin = 1;
    pinMap[1].status = 'REVERSED';
    wireMapGrade = 'REVERSED_PAIR';
    pass = false;
    gigabitSupported = false;
    statusLabel = 'Reversed Polarity on Pair 2';
    badgeClass = 'badge-warning';
    statusColor = '#f59e0b';
    faultDescription = 'Pins 1 and 2 are swapped at far end. Auto-MDIX may compensate, but fails formal TIA certification.';
  } else if (faultType === 'CROSSOVER') {
    pinMap[0].farPin = 3;
    pinMap[1].farPin = 6;
    pinMap[2].farPin = 1;
    pinMap[5].farPin = 2;
    wireMapGrade = 'CROSSOVER_MDIX';
    pass = true;
    gigabitSupported = true;
    statusLabel = 'T568A / T568B Crossover Cable';
    badgeClass = 'badge-info';
    statusColor = '#38bdf8';
    faultDescription = 'One end wired T568A and other T568B. Auto-MDIX gigabit switches support this, but straight-through is standard.';
  }

  if (Array.isArray(customPinMap) && customPinMap.length === 8) {
    pinMap = customPinMap;
  }

  return {
    standard,
    standardName: std.name,
    faultType,
    wireMapGrade,
    pass,
    gigabitSupported,
    statusLabel,
    badgeClass,
    statusColor,
    faultDescription,
    pinMap
  };
}

/**
 * Calculates physical layer transmission parameters (attenuation, return loss, NEXT, delay skew, link speed).
 */
export function calculateEthernetTransmission({
  cableGrade = 'CAT6',
  lengthMeters = 25,
  wireMapResult = null,
  planSpeedMbps = 100
} = {}) {
  const gradeKey = ETHERNET_CABLE_GRADES[cableGrade] ? cableGrade : 'CAT6';
  const grade = ETHERNET_CABLE_GRADES[gradeKey];
  const L = Math.max(1, Math.min(200, Number(lengthMeters) || 25));
  const wireMap = wireMapResult || evaluateEthernetWireMap({ standard: 'T568B', faultType: 'NONE' });

  // Insertion Loss / Attenuation (dB at nominal 100 MHz)
  const lossDb = Math.round((L * (grade.baseLossDbPer100m / 100)) * 100) / 100;
  const isLossCompliant = lossDb <= 24.0 && L <= 100;

  // Return Loss (dB)
  const returnLossDb = Math.max(8.0, Math.round((26.0 - L * 0.055) * 10) / 10);
  const isReturnLossCompliant = returnLossDb >= 19.0;

  // Near-End Crosstalk (NEXT) (dB)
  let nextMarginDb = Math.round((46.0 - L * 0.075) * 10) / 10;
  if (!wireMap.pass) {
    nextMarginDb = Math.min(nextMarginDb, 14.5);
  }
  const isNextCompliant = nextMarginDb >= 35.0;

  // Propagation Delay & Delay Skew
  const propDelayNs = Math.round(L * grade.delayNsPerMeter * 10) / 10;
  const delaySkewNs = Math.round((12.0 + L * 0.16) * 10) / 10;
  const isSkewCompliant = delaySkewNs <= 50.0;

  // Negotiated Link Speed
  let negotiatedSpeed = '1000BASE-T Full Duplex (1000 Mbps)';
  let speedMbps = 1000;
  let isBottleneck = false;
  let bottleneckNotice = null;

  if (wireMap.gigabitSupported && L <= 100 && grade.gigabitCapable && isNextCompliant) {
    negotiatedSpeed = '1000BASE-T Full Duplex (1000 Mbps)';
    speedMbps = 1000;
  } else if (wireMap.pinMap[0]?.status !== 'SHORT' && wireMap.pinMap[1]?.status !== 'SHORT' &&
             wireMap.pinMap[0]?.farPin && wireMap.pinMap[1]?.farPin &&
             wireMap.pinMap[2]?.farPin && wireMap.pinMap[5]?.farPin) {
    negotiatedSpeed = '100BASE-TX Full Duplex (100 Mbps)';
    speedMbps = 100;
    if (planSpeedMbps > 100) {
      isBottleneck = true;
      bottleneckNotice = `Subscriber subscribed to ${planSpeedMbps} Mbps but Ethernet LAN link is capped at 100 Mbps!`;
    }
  } else {
    negotiatedSpeed = '10BASE-T Half Duplex (10 Mbps Degraded)';
    speedMbps = 10;
    isBottleneck = true;
    bottleneckNotice = 'Severe physical wiring fault; link downgraded to 10 Mbps.';
  }

  // Length warning
  const isLengthExceeded = L > 100;

  // Overall QA Verdict
  let verdictKey = 'FLUKE_CERTIFIED_PASS';
  let verdictLabel = 'Fluke Certified Pass (Gigabit Ready)';
  let verdictClass = 'badge-success';
  let verdictColor = '#10b981';

  if (!wireMap.pass || isLengthExceeded || !isNextCompliant) {
    verdictKey = 'FAILED_TERMINATION_FAULT';
    verdictLabel = 'Failed - Wiring or Length Fault';
    verdictClass = 'badge-danger';
    verdictColor = '#ef4444';
  } else if (speedMbps < 1000 || L > 85) {
    verdictKey = 'CONDITIONAL_PASS';
    verdictLabel = 'Conditional Pass (Sub-optimal Span)';
    verdictClass = 'badge-warning';
    verdictColor = '#f59e0b';
  }

  return {
    cableGrade: gradeKey,
    cableName: grade.name,
    bandwidthMhz: grade.bandwidthMhz,
    lengthMeters: L,
    isLengthExceeded,
    insertionLossDb: lossDb,
    isLossCompliant,
    returnLossDb,
    isReturnLossCompliant,
    nextMarginDb,
    isNextCompliant,
    propagationDelayNs: propDelayNs,
    delaySkewNs,
    isSkewCompliant,
    negotiatedSpeed,
    speedMbps,
    isBottleneck,
    bottleneckNotice,
    verdictKey,
    verdictLabel,
    verdictClass,
    verdictColor,
    isCertified: verdictKey === 'FLUKE_CERTIFIED_PASS'
  };
}

/**
 * Validates subscriber Ethernet certification form input.
 */
export function validateEthernetCertification(formData = {}) {
  const errors = {};
  if (!formData.customerId || !String(formData.customerId).trim()) {
    errors.customerId = 'Customer selection is required.';
  }
  if (!formData.technicianName || !String(formData.technicianName).trim()) {
    errors.technicianName = 'Technician name is required.';
  }
  const len = Number(formData.lengthMeters);
  if (isNaN(len) || len < 1 || len > 200) {
    errors.lengthMeters = 'Cable length must be between 1 and 200 meters.';
  }
  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Builds a structured Ethernet certification record with sequential identifier.
 */
export function buildEthernetCertRecord(formData = {}, existingCount = 0) {
  const d = formData.timestamp ? new Date(formData.timestamp) : new Date();
  const yearMonth = d.toISOString().slice(0, 7).replace('-', '');
  const seqNum = String(Number(existingCount || 0) + 1).padStart(4, '0');
  const certId = `ETH-${yearMonth}-${seqNum}`;

  const wireMap = evaluateEthernetWireMap({
    standard: formData.wiringStandard || 'T568B',
    faultType: formData.faultType || 'NONE'
  });

  const transmission = calculateEthernetTransmission({
    cableGrade: formData.cableGrade || 'CAT6',
    lengthMeters: Number(formData.lengthMeters) || 25,
    wireMapResult: wireMap,
    planSpeedMbps: Number(formData.planSpeedMbps) || 100
  });

  return {
    id: certId,
    certNumber: certId,
    customerId: formData.customerId || '',
    customerName: formData.customerName || 'Subscriber',
    customerPhone: formData.customerPhone || '',
    customerArea: formData.customerArea || '',
    technicianName: formData.technicianName || 'Shahdara Network Crew',
    cableGrade: transmission.cableGrade,
    cableName: transmission.cableName,
    lengthMeters: transmission.lengthMeters,
    wiringStandard: wireMap.standard,
    wiringStandardName: wireMap.standardName,
    wireMap,
    transmission,
    verdict: transmission.verdictKey,
    verdictLabel: transmission.verdictLabel,
    verdictColor: transmission.verdictColor,
    status: formData.status || 'ACTIVE',
    inspectionDate: formData.inspectionDate || d.toISOString().slice(0, 10),
    timestamp: d.toISOString(),
    notes: formData.notes || ''
  };
}

function resolveEthernetStorage(storage) {
  if (storage) return storage;
  if (typeof localStorage !== 'undefined') return localStorage;
  return null;
}

/**
 * Retrieves saved Ethernet certification records from storage.
 */
export function getSavedEthernetCerts(storage = null, customerId = null) {
  const store = resolveEthernetStorage(storage);
  if (!store) return [];
  try {
    const raw = store.getItem(ETHERNET_CERT_STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    if (customerId) {
      return list.filter(r => r.customerId === customerId);
    }
    return list;
  } catch (err) {
    return [];
  }
}

/**
 * Saves a new Ethernet certification record into storage.
 */
export function saveEthernetCert(storage, record) {
  const store = resolveEthernetStorage(storage);
  if (!store || !record) return false;
  try {
    const list = getSavedEthernetCerts(store);
    const existingIdx = list.findIndex(r => r.id === record.id);
    if (existingIdx >= 0) {
      list[existingIdx] = record;
    } else {
      list.unshift(record);
    }
    store.setItem(ETHERNET_CERT_STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Updates status of an Ethernet certification record.
 */
export function updateEthernetCertStatus(storage, recordId, newStatus, notes = '') {
  const store = resolveEthernetStorage(storage);
  if (!store || !recordId) return null;
  try {
    const list = getSavedEthernetCerts(store);
    const item = list.find(r => r.id === recordId);
    if (!item) return null;
    item.status = newStatus;
    if (newStatus === 'RE_TERMINATED_PASS') {
      item.verdictLabel = 'Re-Terminated & Certified';
      item.verdict = 'FLUKE_CERTIFIED_PASS';
      item.transmission.isCertified = true;
    }
    if (notes) {
      item.notes = (item.notes ? `${item.notes} | ` : '') + notes;
    }
    store.setItem(ETHERNET_CERT_STORAGE_KEY, JSON.stringify(list));
    return item;
  } catch (err) {
    return null;
  }
}

/**
 * Clears saved Ethernet certifications.
 */
export function clearEthernetCerts(storage) {
  const store = resolveEthernetStorage(storage);
  if (!store) return false;
  try {
    store.removeItem(ETHERNET_CERT_STORAGE_KEY);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Calculates aggregate summary metrics from Ethernet certification records.
 */
export function calculateEthernetCertMetrics(records = []) {
  if (!Array.isArray(records) || records.length === 0) {
    return {
      total: 0,
      totalInspections: 0,
      certifiedCount: 0,
      conditionalCount: 0,
      failedCount: 0,
      gigabitRatePercent: 100,
      passRatePercent: 100,
      averageLengthMeters: 0,
      bottleneckAlerts: 0
    };
  }

  let cert = 0;
  let cond = 0;
  let fail = 0;
  let gigabitCount = 0;
  let totalLen = 0;
  let bottlenecks = 0;

  for (const r of records) {
    const v = r.verdict || r.transmission?.verdictKey;
    if (v === 'FLUKE_CERTIFIED_PASS') cert++;
    else if (v === 'CONDITIONAL_PASS') cond++;
    else fail++;

    if (r.transmission?.speedMbps >= 1000) gigabitCount++;
    if (r.transmission?.isBottleneck) bottlenecks++;
    totalLen += Number(r.lengthMeters || r.transmission?.lengthMeters) || 0;
  }

  const total = records.length;
  return {
    total,
    totalInspections: total,
    certifiedCount: cert,
    conditionalCount: cond,
    failedCount: fail,
    gigabitRatePercent: Math.round((gigabitCount / total) * 100),
    passRatePercent: Math.round(((cert + cond) / total) * 100),
    averageLengthMeters: Math.round((totalLen / total) * 10) / 10,
    bottleneckAlerts: bottlenecks
  };
}

/**
 * Formats a bilingual WhatsApp dispatch message for subscriber LAN verification.
 */
export function formatEthernetCertWhatsApp(cert = {}) {
  const c = cert.customerName || 'Valued Subscriber';
  const id = cert.id || 'ETH-CERT';
  const cable = cert.cableName || 'Cat6 UTP';
  const len = cert.lengthMeters || 25;
  const speed = cert.transmission?.negotiatedSpeed || '1000 Mbps Full Duplex';
  const verdict = cert.verdictLabel || 'Fluke Certified Pass';
  const tech = cert.technicianName || 'Shahdara Network Crew';

  return [
    '========================================',
    '🔌 SHAHDARA ISP - LAN ETHERNET & GIGABIT QA CERTIFICATE',
    'لین کیبلنگ اور گیگابٹ سپیڈ سرٹیفکیٹ',
    '========================================',
    `📋 Certificate #: ${id}`,
    `👤 Customer: ${c} (${cert.customerArea || 'Shahdara'})`,
    `🧵 Cable Spec: ${cable} · Length: ${len} meters`,
    `📌 Wire Map: ${cert.wireMap?.statusLabel || 'Straight-Through T568B Pass'}`,
    `⚡ Negotiated Speed: ${speed}`,
    `📉 Insertion Loss: ${cert.transmission?.insertionLossDb || '0.0'} dB`,
    `🏆 Quality Verdict: ${verdict}`,
    `🛠 Tested by: ${tech}`,
    '----------------------------------------',
    '✅ Your internal LAN cabling has been verified for Gigabit fiber throughput.',
    'آپ کی اندرونی لین وائرنگ گیگابٹ براڈبینڈ کیلئے تصدیق شدہ ہے۔',
    'Shahdara Fiber Net · Fast · Reliable · Local'
  ].join('\n');
}

/**
 * Generates printable HTML for formal A4 certificate or 80mm thermal field slip.
 */
export function generateEthernetCertHtml(cert = {}, options = {}) {
  const format = options.format || 'a4';
  const isThermal = format === 'thermal' || format === 'slip';
  const t = cert.transmission || {};
  const w = cert.wireMap || {};

  if (isThermal) {
    return `
      <div class="eth-thermal-slip" style="max-width: 290px; font-family: monospace; font-size: 11px; line-height: 1.35; color: #000; padding: 4px;">
        <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px;">
          <h3 style="margin: 0; font-size: 14px; font-weight: bold;">SHAHDARA FIBER NET</h3>
          <p style="margin: 2px 0; font-size: 10px;">PREMISES LAN CABLE QA SLIP</p>
          <p style="margin: 0; font-weight: bold;">#${cert.id || ''}</p>
        </div>
        <div style="margin-bottom: 6px;">
          <div><strong>Customer:</strong> ${cert.customerName || ''}</div>
          <div><strong>Area:</strong> ${cert.customerArea || ''}</div>
          <div><strong>Date:</strong> ${cert.inspectionDate || ''}</div>
          <div><strong>Tech:</strong> ${cert.technicianName || ''}</div>
        </div>
        <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 4px 0; margin-bottom: 6px;">
          <div><strong>Cable:</strong> ${cert.cableGrade || 'CAT6'} (${cert.lengthMeters || 25}m)</div>
          <div><strong>Standard:</strong> ${cert.wiringStandard || 'T568B'}</div>
          <div><strong>Wire Map:</strong> ${w.wireMapGrade || 'PASS'}</div>
          <div><strong>Link Speed:</strong> ${t.speedMbps || 1000} Mbps</div>
          <div><strong>Loss:</strong> ${t.insertionLossDb || 0} dB</div>
        </div>
        <div style="text-align: center; font-weight: bold; font-size: 12px; margin-bottom: 6px;">
          VERDICT: ${cert.verdictLabel || 'PASS'}
        </div>
        <div style="text-align: center; font-size: 9px; border-top: 1px dashed #000; padding-top: 6px;">
          Thank you for choosing Shahdara Fiber Net
        </div>
      </div>
    `;
  }

  // A4 Document
  return `
    <div class="eth-a4-cert" style="max-width: 720px; margin: 0 auto; padding: 24px; font-family: system-ui, -apple-system, sans-serif; color: #0f172a; background: #fff; border: 2px solid #0284c7; border-radius: 8px;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 16px;">
        <div>
          <h1 style="margin: 0; font-size: 20px; color: #0369a1; text-transform: uppercase;">Outside Plant & Premises LAN Engineering</h1>
          <h2 style="margin: 4px 0 0; font-size: 15px; font-weight: normal; color: #475569;">Gigabit Ethernet Cabling & Wire Map QA Certificate</h2>
        </div>
        <div style="text-align: right;">
          <span style="display: inline-block; padding: 6px 12px; border-radius: 4px; background: #0284c7; color: #fff; font-weight: bold; font-size: 13px;">${cert.id || ''}</span>
          <p style="margin: 4px 0 0; font-size: 11px; color: #64748b;">ANSI/TIA-568-C.2 Verified</p>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; background: #f8fafc; padding: 12px; border-radius: 6px; margin-bottom: 16px; border: 1px solid #e2e8f0;">
        <div>
          <p style="margin: 0 0 4px; font-size: 11px; color: #64748b; font-weight: bold;">SUBSCRIBER INFORMATION</p>
          <p style="margin: 0; font-size: 14px; font-weight: 600;">${cert.customerName || ''}</p>
          <p style="margin: 2px 0; font-size: 12px; color: #334155;">📞 ${cert.customerPhone || 'N/A'} · 📍 ${cert.customerArea || 'Shahdara'}</p>
        </div>
        <div>
          <p style="margin: 0 0 4px; font-size: 11px; color: #64748b; font-weight: bold;">INSPECTION AUDIT DETAILS</p>
          <p style="margin: 0; font-size: 12px;"><strong>Technician:</strong> ${cert.technicianName || ''}</p>
          <p style="margin: 2px 0; font-size: 12px;"><strong>Date:</strong> ${cert.inspectionDate || ''}</p>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12px;">
        <thead>
          <tr style="background: #e0f2fe; text-align: left;">
            <th style="padding: 8px; border: 1px solid #bae6fd;">Test Parameter</th>
            <th style="padding: 8px; border: 1px solid #bae6fd;">Measured Value</th>
            <th style="padding: 8px; border: 1px solid #bae6fd;">Specification Limit</th>
            <th style="padding: 8px; border: 1px solid #bae6fd;">Result</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">Cable Specification</td>
            <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">${cert.cableName || 'Cat6'}</td>
            <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">TIA Cat5e / Cat6</td>
            <td style="padding: 6px 8px; border: 1px solid #e2e8f0; color: #10b981; font-weight: bold;">PASS</td>
          </tr>
          <tr>
            <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">Physical Cable Length (TDR)</td>
            <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">${cert.lengthMeters || 25} meters</td>
            <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">&le; 100.0 meters</td>
            <td style="padding: 6px 8px; border: 1px solid #e2e8f0; color: ${t.isLengthExceeded ? '#ef4444' : '#10b981'}; font-weight: bold;">${t.isLengthExceeded ? 'FAIL' : 'PASS'}</td>
          </tr>
          <tr>
            <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">8-Conductor Wire Map</td>
            <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">${w.statusLabel || 'Straight-Through'}</td>
            <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">Pin 1-8 Continuity</td>
            <td style="padding: 6px 8px; border: 1px solid #e2e8f0; color: ${w.pass ? '#10b981' : '#ef4444'}; font-weight: bold;">${w.pass ? 'PASS' : 'FAIL'}</td>
          </tr>
          <tr>
            <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">Insertion Loss (Attenuation)</td>
            <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">${t.insertionLossDb || '0.0'} dB</td>
            <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">&le; 24.0 dB @ 100MHz</td>
            <td style="padding: 6px 8px; border: 1px solid #e2e8f0; color: #10b981; font-weight: bold;">PASS</td>
          </tr>
          <tr>
            <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">Near-End Crosstalk (NEXT)</td>
            <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">${t.nextMarginDb || '44.0'} dB</td>
            <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">&ge; 35.3 dB</td>
            <td style="padding: 6px 8px; border: 1px solid #e2e8f0; color: ${t.isNextCompliant ? '#10b981' : '#ef4444'}; font-weight: bold;">${t.isNextCompliant ? 'PASS' : 'FAIL'}</td>
          </tr>
          <tr>
            <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">Negotiated Link Speed</td>
            <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: bold;">${t.negotiatedSpeed || '1000 Mbps'}</td>
            <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">1000BASE-T Full Duplex</td>
            <td style="padding: 6px 8px; border: 1px solid #e2e8f0; color: ${t.speedMbps >= 1000 ? '#10b981' : '#f59e0b'}; font-weight: bold;">${t.speedMbps >= 1000 ? 'PASS' : 'WARN'}</td>
          </tr>
        </tbody>
      </table>

      <div style="background: ${cert.verdictColor || '#10b981'}15; border: 1px solid ${cert.verdictColor || '#10b981'}; padding: 12px; border-radius: 6px; text-align: center; margin-bottom: 16px;">
        <h3 style="margin: 0; font-size: 15px; color: ${cert.verdictColor || '#10b981'}; text-transform: uppercase;">FINAL QA VERDICT: ${cert.verdictLabel || 'PASS'}</h3>
        <p style="margin: 4px 0 0; font-size: 12px; color: #334155;">${w.faultDescription || ''}</p>
      </div>

      <div style="display: flex; justify-content: space-between; margin-top: 24px; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 12px;">
        <div>Shahdara ISP Network Operations Center · QA Division</div>
        <div>Certified Field Engineer Signature: _______________________</div>
      </div>
    </div>
  `;
}

/**
 * Generates RFC-4180 CSV export with UTF-8 BOM.
 */
export function generateEthernetCertsCsv(records = []) {
  const BOM = '\uFEFF';
  const headers = [
    'Certificate ID', 'Customer ID', 'Customer Name', 'Phone', 'Area',
    'Inspection Date', 'Technician', 'Cable Grade', 'Length (m)',
    'Wiring Standard', 'Wire Map Grade', 'Negotiated Speed', 'Loss (dB)',
    'NEXT (dB)', 'Verdict', 'Notes'
  ];

  const rows = (records || []).map(r => {
    return [
      `"${r.id || ''}"`,
      `"${r.customerId || ''}"`,
      `"${(r.customerName || '').replace(/"/g, '""')}"`,
      `"${r.customerPhone || ''}"`,
      `"${(r.customerArea || '').replace(/"/g, '""')}"`,
      `"${r.inspectionDate || ''}"`,
      `"${(r.technicianName || '').replace(/"/g, '""')}"`,
      `"${r.cableGrade || ''}"`,
      r.lengthMeters || 0,
      `"${r.wiringStandard || ''}"`,
      `"${r.wireMap?.wireMapGrade || ''}"`,
      `"${r.transmission?.negotiatedSpeed || ''}"`,
      r.transmission?.insertionLossDb || 0,
      r.transmission?.nextMarginDb || 0,
      `"${r.verdictLabel || ''}"`,
      `"${(r.notes || '').replace(/"/g, '""')}"`
    ].join(',');
  });

  return BOM + [headers.join(','), ...rows].join('\r\n');
}

/**
 * Renders an interactive SVG diagram of the 8-pin RJ45 wire map connector.
 */
export function renderRj45WireMapSvg(wireMapResult = null) {
  const wm = wireMapResult || evaluateEthernetWireMap({ standard: 'T568B', faultType: 'NONE' });
  const pins = wm.pinMap || [];

  const pinWidth = 28;
  const pinSpacing = 36;
  const startX = 26;

  const pinElements = pins.map((p, idx) => {
    const x = startX + idx * pinSpacing;
    const isPass = p.status === 'PASS';
    const pinColor = p.status === 'PASS' ? '#10b981' : (p.status === 'OPEN' ? '#94a3b8' : '#ef4444');
    const label = p.farPin !== null ? `${p.pin} ➔ ${p.farPin}` : `${p.pin} ✕`;

    return `
      <!-- Pin ${p.pin} Column -->
      <g transform="translate(${x}, 0)">
        <!-- Near-End Pin Box -->
        <rect x="0" y="24" width="${pinWidth}" height="28" rx="4" fill="#1e293b" stroke="${pinColor}" stroke-width="2" />
        <text x="${pinWidth / 2}" y="42" text-anchor="middle" font-size="12px" font-weight="bold" fill="#f8fafc">${p.pin}</text>

        <!-- Connecting Wire Trace -->
        <line x1="${pinWidth / 2}" y1="52" x2="${pinWidth / 2}" y2="108" stroke="${pinColor}" stroke-width="${isPass ? '3.5' : '2'}" stroke-dasharray="${p.status === 'OPEN' ? '4,4' : 'none'}" />

        <!-- Far-End Pin Box -->
        <rect x="0" y="108" width="${pinWidth}" height="28" rx="4" fill="#1e293b" stroke="${pinColor}" stroke-width="2" />
        <text x="${pinWidth / 2}" y="126" text-anchor="middle" font-size="11px" font-weight="bold" fill="#f8fafc">${p.farPin || '✕'}</text>

        <!-- Wire Color Indicator Dot -->
        <circle cx="${pinWidth / 2}" y="80" r="5" fill="${pinColor}" />
        <text x="${pinWidth / 2}" y="152" text-anchor="middle" font-size="8px" fill="#94a3b8">${p.color.split('/')[0].slice(0, 3)}</text>
      </g>
    `;
  }).join('');

  return `
    <svg class="rj45-wiremap-svg" viewBox="0 0 340 165" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="RJ45 8-Pin Wire Map Diagram">
      <rect x="4" y="4" width="332" height="157" rx="8" fill="#0b1120" stroke="#334155" stroke-width="1.5" />

      <!-- Headers -->
      <text x="14" y="18" font-size="9px" font-weight="bold" fill="#38bdf8">${wm.standardName || 'T568B'}</text>
      <text x="326" y="18" text-anchor="end" font-size="9px" font-weight="bold" fill="${wm.statusColor}">${wm.wireMapGrade}</text>

      <!-- Label Track -->
      <text x="10" y="42" font-size="8px" fill="#64748b">ONT</text>
      <text x="10" y="126" font-size="8px" fill="#64748b">LAN</text>

      ${pinElements}
    </svg>
  `;
}

/**
 * Initializes and wires events for the Subscriber Ethernet Certification Modal Dialog.
 */
export function setupEthernetCertModal(options = {}) {
  const modal = document.getElementById('ethernetCertModal');
  if (!modal) return null;

  const storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  const onToast = typeof options.onToast === 'function' ? options.onToast : () => {};
  const getState = typeof options.getState === 'function' ? options.getState : () => ({});

  // DOM elements
  const closeBtn = document.getElementById('closeEthernetCertModalBtn');
  const custSelect = document.getElementById('ethCustomerSelect');
  const techInput = document.getElementById('ethTechInput');
  const cableSelect = document.getElementById('ethCableSelect');
  const standardSelect = document.getElementById('ethStandardSelect');
  const lengthSlider = document.getElementById('ethLengthSlider');
  const lengthInput = document.getElementById('ethLengthInput');
  const faultSelect = document.getElementById('ethFaultSelect');

  // KPI elements
  const kpiWireMap = document.getElementById('ethKpiWireMap');
  const kpiLoss = document.getElementById('ethKpiLoss');
  const kpiDelay = document.getElementById('ethKpiDelay');
  const kpiSpeed = document.getElementById('ethKpiSpeed');
  const kpiVerdict = document.getElementById('ethKpiVerdict');
  const svgContainer = document.getElementById('ethWireMapSvgContainer');

  // Form buttons
  const saveBtn = document.getElementById('ethSaveBtn');
  const printBtn = document.getElementById('ethPrintBtn');
  const whatsappBtn = document.getElementById('ethWhatsAppBtn');
  const csvBtn = document.getElementById('ethCsvBtn');
  const historyList = document.getElementById('ethHistoryList');
  const notesInput = document.getElementById('ethNotesInput');

  let activeCustomer = null;
  let activeRecord = null;

  function recalculate() {
    const std = standardSelect?.value || 'T568B';
    const fault = faultSelect?.value || 'NONE';
    const cable = cableSelect?.value || 'CAT6';
    const len = Number(lengthInput?.value || lengthSlider?.value || 25);

    const wireMap = evaluateEthernetWireMap({ standard: std, faultType: fault });
    const trans = calculateEthernetTransmission({
      cableGrade: cable,
      lengthMeters: len,
      wireMapResult: wireMap
    });

    if (svgContainer) {
      svgContainer.innerHTML = renderRj45WireMapSvg(wireMap);
    }

    if (kpiWireMap) {
      kpiWireMap.textContent = wireMap.statusLabel;
      kpiWireMap.style.color = wireMap.statusColor;
    }

    if (kpiLoss) {
      kpiLoss.textContent = `${trans.insertionLossDb.toFixed(2)} dB`;
    }

    if (kpiDelay) {
      kpiDelay.textContent = `${trans.delaySkewNs.toFixed(1)} ns`;
    }

    if (kpiSpeed) {
      kpiSpeed.textContent = trans.negotiatedSpeed.split(' ')[0];
    }

    if (kpiVerdict) {
      kpiVerdict.textContent = trans.verdictLabel;
      kpiVerdict.className = `badge ${trans.verdictClass}`;
      kpiVerdict.style.color = trans.verdictColor;
    }

    return { wireMap, trans };
  }

  function renderHistory() {
    if (!historyList) return;
    const records = getSavedEthernetCerts(storage, activeCustomer?.id);
    if (records.length === 0) {
      historyList.innerHTML = '<li style="padding: 8px; color: var(--muted, #94a3b8); font-size: 12px; text-align: center;">No LAN certificates recorded yet.</li>';
      return;
    }

    historyList.innerHTML = records.slice(0, 15).map(r => `
      <li class="eth-cert-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; background: rgba(15, 23, 42, 0.4); border-radius: 6px; border: 1px solid var(--border, #334155); margin-bottom: 6px; font-size: 12px;">
        <div>
          <span style="font-weight: bold; color: #38bdf8;">${r.id}</span> ·
          <span>${r.cableGrade} (${r.lengthMeters}m)</span> ·
          <span style="color: ${r.verdictColor || '#10b981'}; font-weight: bold;">${r.verdictLabel || 'PASS'}</span>
          <div style="font-size: 11px; color: var(--muted, #94a3b8);">${r.inspectionDate} by ${r.technicianName}</div>
        </div>
        <div style="display: flex; gap: 4px;">
          <button class="icon-button btn-print-single" data-cert-id="${r.id}" type="button" title="Print Certificate" style="padding: 2px 6px; font-size: 11px;">🖨️</button>
        </div>
      </li>
    `).join('');

    historyList.querySelectorAll('.btn-print-single').forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-cert-id');
        const c = records.find(x => x.id === id);
        if (c) printCert(c);
      };
    });
  }

  function setCustomerContext(cust) {
    activeCustomer = cust;
    if (custSelect && cust) {
      custSelect.value = cust.id;
    }
    recalculate();
    renderHistory();
  }

  function printCert(cert) {
    const html = generateEthernetCertHtml(cert, { format: 'a4' });
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>LAN Ethernet Certificate - ${cert.id}</title>
          <style>body { margin: 15px; background: #fff; }</style>
        </head>
        <body>
          ${html}
          <script>window.onload = function() { window.print(); };</script>
        </body>
        </html>
      `);
      win.document.close();
    } else {
      window.print();
    }
  }

  // Hook input changes
  if (lengthSlider) {
    lengthSlider.oninput = (e) => {
      if (lengthInput) lengthInput.value = e.target.value;
      recalculate();
    };
  }
  if (lengthInput) {
    lengthInput.oninput = (e) => {
      if (lengthSlider) lengthSlider.value = e.target.value;
      recalculate();
    };
  }
  if (cableSelect) cableSelect.onchange = recalculate;
  if (standardSelect) standardSelect.onchange = recalculate;
  if (faultSelect) faultSelect.onchange = recalculate;

  if (saveBtn) {
    saveBtn.onclick = () => {
      const state = getState();
      const currentCust = activeCustomer || state?.customers?.find(c => c.id === custSelect?.value) || state?.customers?.[0];
      const formData = {
        customerId: currentCust?.id || 'CUST-GENERAL',
        customerName: currentCust?.name || 'Walk-in Subscriber',
        customerPhone: currentCust?.phone || '',
        customerArea: currentCust?.area || 'Baradari Road',
        technicianName: techInput?.value || 'Lineman Bilal',
        cableGrade: cableSelect?.value || 'CAT6',
        lengthMeters: Number(lengthInput?.value || 25),
        wiringStandard: standardSelect?.value || 'T568B',
        faultType: faultSelect?.value || 'NONE',
        notes: notesInput?.value || ''
      };

      const val = validateEthernetCertification(formData);
      if (!val.valid) {
        onToast(Object.values(val.errors)[0]);
        return;
      }

      const allCerts = getSavedEthernetCerts(storage);
      const record = buildEthernetCertRecord(formData, allCerts.length);
      saveEthernetCert(storage, record);
      activeRecord = record;
      renderHistory();
      onToast(`✓ Recorded LAN Certificate #${record.id} (${record.verdictLabel})`);
    };
  }

  if (printBtn) {
    printBtn.onclick = () => {
      const all = getSavedEthernetCerts(storage, activeCustomer?.id);
      const target = activeRecord || all[0];
      if (!target) {
        onToast('Please save or select a certification record first.');
        return;
      }
      printCert(target);
    };
  }

  if (whatsappBtn) {
    whatsappBtn.onclick = async () => {
      const all = getSavedEthernetCerts(storage, activeCustomer?.id);
      const target = activeRecord || all[0];
      if (!target) {
        onToast('Please save or select a certification record first.');
        return;
      }
      const text = formatEthernetCertWhatsApp(target);
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(text);
          onToast('✓ WhatsApp LAN Certificate copied to clipboard');
        } catch (_) {
          onToast('Generated WhatsApp certificate');
        }
      }
    };
  }

  if (csvBtn) {
    csvBtn.onclick = () => {
      const all = getSavedEthernetCerts(storage);
      if (all.length === 0) {
        onToast('No LAN records to export');
        return;
      }
      const csv = generateEthernetCertsCsv(all);
      const filename = `shahdara_lan_certs_${new Date().toISOString().slice(0, 10)}.csv`;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onToast(`Exported ${filename}`);
    };
  }

  // Trigger buttons
  document.querySelectorAll('[data-open-ethernet-cert], #openEthernetCertBtn').forEach(btn => {
    btn.onclick = () => {
      const state = getState();
      const cust = activeCustomer || state?.customers?.[0] || null;
      setCustomerContext(cust);
      if (typeof modal.showModal === 'function') modal.showModal();
      else modal.setAttribute('open', '');
    };
  });

  if (closeBtn) {
    closeBtn.onclick = () => {
      if (typeof modal.close === 'function') modal.close();
      else modal.removeAttribute('open');
    };
  }

  return {
    open: (cust) => {
      setCustomerContext(cust);
      if (typeof modal.showModal === 'function') modal.showModal();
      else modal.setAttribute('open', '');
    },
    close: () => {
      if (typeof modal.close === 'function') modal.close();
      else modal.removeAttribute('open');
    },
    setCustomer: setCustomerContext,
    recalculate
  };
}

export {
  ORL_CERT_STORAGE_KEY,
  ORL_CONNECTOR_POLISHES,
  ORL_END_FACE_ZONES,
  ORL_DEFECT_TYPES,
  ORL_VERDICTS,
  calculateReflectanceFromOrl,
  calculateOrlFromReflectance,
  evaluateOrlReflectance,
  generateOrlCertId,
  validateOrlCertification,
  validateOrlCertInput,
  buildOrlCertRecord,
  getSavedOrlCerts,
  saveOrlCert,
  updateOrlCertStatus,
  clearOrlCerts,
  calculateOrlCertMetrics,
  formatOrlCertWhatsApp,
  generateOrlCertHtml,
  generateOrlCertsCsv,
  renderFerruleEndfaceSvg,
  setupOrlCertModal
} from './qa-orl-reflectance.js';
