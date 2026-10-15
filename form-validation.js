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


