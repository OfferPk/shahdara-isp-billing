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
