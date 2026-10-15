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
