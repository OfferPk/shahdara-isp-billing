/**
 * reminder-queue.js - WhatsApp Reminder Queue & Promise-to-Pay (Wada) Follow-up Suite
 *
 * Implements GitHub Issue #222 (P1 grok-review):
 * 1. Configurable reminder stages (default: 2 days before due date, on due date, +3, +7, +15 days).
 * 2. "Reminders Today" queue:
 *    - Automatically identifies customers with outstanding dues matching reminder stage rules for today in PKT.
 *    - Sequential queue traversal: Next, Previous, Skip navigation with queue progress badge (e.g. "Customer 2 of 10").
 *    - 1-tap WhatsApp dispatch with bilingual prefilled message (Urdu & English) and normalized 923xx mobile links.
 *    - Automatic dispatch auditing: records "reminded on <date>, stage N" into persistent history.
 *    - Safe offline-first architecture: no automated messaging without explicit operator tap.
 * 3. Promise-to-Pay ("Wada") Follow-up List:
 *    - Tracks customer payment commitments (date, amount, note, status).
 *    - Categorizes promises for today, broken/overdue wada follow-ups, upcoming, and fulfilled.
 *    - Automatic fulfillment sync when payments are recorded.
 *    - 1-tap WhatsApp follow-up reminder and 1-tap Quick Collect handoff.
 * 4. Customer profile integration:
 *    - History of sent reminders and active/past promises visible directly on subscriber card.
 * 5. Full JSON backup & restore compatibility with registered storage keys.
 */

import {
  calculatePaymentAllocations,
  formatPKR,
  derivedBillStatus,
  whatsappPhoneFor
} from './core.js';
import {
  formatWhatsAppUrl,
  normalizePakistaniWhatsAppPhone,
  buildPaymentReminderMessage,
  escapeHtml
} from './form-validation.js';
import { getWaadaTier, WAADA_TIERS, waadaTemplateIdForTier } from './waada-queue.js';
import { getWaTemplates, renderCustomWaTemplate } from './whatsapp-templates.js';

export const PAKISTAN_TIME_ZONE = 'Asia/Karachi';
export const REMINDER_STAGES_SETTINGS_KEY = 'shahdara_reminder_stages_v1';
export const REMINDER_HISTORY_STORAGE_KEY = 'shahdara_reminder_history_v1';
export const COLLECTION_PROMISES_STORAGE_KEY = 'shahdara_collection_promises_v1';

export const DEFAULT_REMINDER_STAGES = Object.freeze([
  {
    id: 'pre_due',
    label: 'Before Due Date',
    offsetDays: -2,
    template: 'due',
    enabled: true,
    description: '2 days before due date (e.g. 3rd of month)'
  },
  {
    id: 'on_due',
    label: 'On Due Date',
    offsetDays: 0,
    template: 'due',
    enabled: true,
    description: 'On due date (e.g. 5th of month)'
  },
  {
    id: 'overdue_3',
    label: 'Overdue +3 Days',
    offsetDays: 3,
    template: 'overdue',
    enabled: true,
    description: '3 days after due date (e.g. 8th of month)'
  },
  {
    id: 'overdue_7',
    label: 'Overdue +7 Days',
    offsetDays: 7,
    template: 'overdue',
    enabled: true,
    description: '7 days after due date (e.g. 12th of month)'
  },
  {
    id: 'overdue_15',
    label: 'Overdue +15 Days (Disconnection Warning)',
    offsetDays: 15,
    template: 'disconnection',
    enabled: true,
    description: '15 days after due date (e.g. 20th of month)'
  }
]);

/**
 * Returns today's date formatted as YYYY-MM-DD in Pakistan Standard Time (Asia/Karachi).
 * @param {Date|string|number} [date]
 * @returns {string} YYYY-MM-DD
 */
export function getTodayDateString(date = new Date()) {
  try {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) throw new Error('Invalid date');
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: PAKISTAN_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const parts = Object.fromEntries(
      formatter.formatToParts(d).filter(p => p.type !== 'literal').map(p => [p.type, p.value])
    );
    return `${parts.year}-${parts.month}-${parts.day}`;
  } catch {
    const d = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

/**
 * Parses YYYY-MM-DD into numeric year, month, day components.
 * @param {string} dateStr
 * @returns {{ year: number, month: number, day: number }|null}
 */
export function parseDateParts(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

/**
 * Calculates calendar day difference (dateStrA - dateStrB).
 * Positive if dateStrA is later than dateStrB; negative if earlier.
 * Safe across month and year boundaries.
 *
 * @param {string} dateStrA
 * @param {string} dateStrB
 * @returns {number}
 */
export function calendarDaysDifference(dateStrA, dateStrB) {
  const pA = parseDateParts(dateStrA);
  const pB = parseDateParts(dateStrB);
  if (!pA || !pB) return 0;
  const utcA = Date.UTC(pA.year, pA.month - 1, pA.day);
  const utcB = Date.UTC(pB.year, pB.month - 1, pB.day);
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.round((utcA - utcB) / MS_PER_DAY);
}

/**
 * Formats a date string (YYYY-MM-DD) into readable human-friendly text.
 * @param {string} dateStr
 * @returns {string}
 */
export function formatDisplayDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const monthName = monthNames[monthIdx] || parts[1];
  return `${parseInt(parts[2], 10)} ${monthName} ${parts[0]}`;
}

/**
 * Retrieves configured reminder stages from storage or returns defaults.
 * @param {Storage|object} [storage]
 * @returns {Array<Object>}
 */
export function getReminderStagesSettings(storage = null) {
  const targetStorage = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!targetStorage || typeof targetStorage.getItem !== 'function') {
    return DEFAULT_REMINDER_STAGES.map(s => ({ ...s }));
  }
  try {
    const raw = targetStorage.getItem(REMINDER_STAGES_SETTINGS_KEY);
    if (!raw) return DEFAULT_REMINDER_STAGES.map(s => ({ ...s }));
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return DEFAULT_REMINDER_STAGES.map(s => ({ ...s }));
    }
    return parsed;
  } catch {
    return DEFAULT_REMINDER_STAGES.map(s => ({ ...s }));
  }
}

/**
 * Saves reminder stages configuration to storage.
 * @param {Array<Object>} stages
 * @param {Storage|object} [storage]
 * @returns {Array<Object>}
 */
export function saveReminderStagesSettings(stages, storage = null) {
  const targetStorage = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!Array.isArray(stages) || stages.length === 0) {
    return DEFAULT_REMINDER_STAGES.map(s => ({ ...s }));
  }
  const clean = stages.map(s => ({
    id: String(s.id || 'stage_' + Math.random().toString(36).slice(2, 6)),
    label: String(s.label || 'Reminder Stage').trim(),
    offsetDays: Number.isFinite(Number(s.offsetDays)) ? Number(s.offsetDays) : 0,
    template: String(s.template || 'due'),
    enabled: s.enabled !== false,
    description: String(s.description || '')
  }));
  if (targetStorage && typeof targetStorage.setItem === 'function') {
    try {
      targetStorage.setItem(REMINDER_STAGES_SETTINGS_KEY, JSON.stringify(clean));
    } catch {}
  }
  return clean;
}

/**
 * Resets reminder stages configuration to defaults.
 * @param {Storage|object} [storage]
 * @returns {Array<Object>}
 */
export function resetReminderStagesSettings(storage = null) {
  const targetStorage = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  if (targetStorage && typeof targetStorage.removeItem === 'function') {
    try {
      targetStorage.removeItem(REMINDER_STAGES_SETTINGS_KEY);
    } catch {}
  }
  return DEFAULT_REMINDER_STAGES.map(s => ({ ...s }));
}

/**
 * Determines customer due day (default 5th, or customDueDate clamped 1..28).
 * @param {Object} customer
 * @returns {number}
 */
export function calculateCustomerDueDay(customer) {
  if (!customer) return 5;
  const raw = customer.customDueDate ?? customer.dueDay;
  if (raw !== null && raw !== undefined && raw !== '') {
    const num = parseInt(raw, 10);
    if (!isNaN(num) && num >= 1 && num <= 28) {
      return num;
    }
  }
  return 5;
}

/**
 * Calculates the exact target due date (YYYY-MM-DD) for a customer in a specified month.
 * @param {Object} customer
 * @param {string} [monthStr] - YYYY-MM
 * @returns {{ dueDateString: string, dueDay: number, month: string }}
 */
export function calculateCustomerDueDate(customer, monthStr) {
  const targetMonth = (typeof monthStr === 'string' && /^\d{4}-\d{2}$/.test(monthStr))
    ? monthStr
    : getTodayDateString().slice(0, 7);

  const dueDay = calculateCustomerDueDay(customer);
  const dueDayPadded = String(dueDay).padStart(2, '0');
  const dueDateString = `${targetMonth}-${dueDayPadded}`;

  return {
    dueDateString,
    dueDay,
    month: targetMonth
  };
}

/**
 * Checks whether a customer has received a reminder for a specific stage in a billing month.
 *
 * @param {string|Object} customerOrId
 * @param {string} stageId
 * @param {string} targetMonth - YYYY-MM
 * @param {Storage|object} [storage]
 * @param {Array<Object>} [historyList]
 * @param {string} [todayStr]
 * @returns {{ sent: boolean, record: Object|null, sentToday: boolean, sentPriorDate: boolean }}
 */
export function getCustomerStageDispatchStatus(customerOrId, stageId, targetMonth, storage = null, historyList = null, todayStr = getTodayDateString()) {
  if (!customerOrId || !stageId) {
    return { sent: false, record: null, sentToday: false, sentPriorDate: false };
  }
  const custId = typeof customerOrId === 'object' ? String(customerOrId.id || '') : String(customerOrId);
  const targetStorage = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  const history = Array.isArray(historyList) ? historyList : getReminderHistory(targetStorage);

  // Check storage history
  const matchInHistory = history.find(r =>
    String(r.customerId) === custId &&
    r.stageId === stageId &&
    (r.month === targetMonth || (r.date && r.date.slice(0, 7) === targetMonth))
  );

  if (matchInHistory) {
    const sentToday = matchInHistory.date === todayStr;
    const sentPriorDate = !sentToday && matchInHistory.date < todayStr;
    return { sent: true, record: matchInHistory, sentToday, sentPriorDate };
  }

  // Also check customer.reminders if customer object passed
  if (typeof customerOrId === 'object' && Array.isArray(customerOrId.reminders)) {
    const matchInCust = customerOrId.reminders.find(r =>
      r.stageId === stageId &&
      (r.month === targetMonth || (r.date && r.date.slice(0, 7) === targetMonth))
    );
    if (matchInCust) {
      const sentToday = matchInCust.date === todayStr;
      const sentPriorDate = !sentToday && matchInCust.date < todayStr;
      return { sent: true, record: matchInCust, sentToday, sentPriorDate };
    }
  }

  return { sent: false, record: null, sentToday: false, sentPriorDate: false };
}

/**
 * Checks if a customer has any unpaid bills from months prior to currentMonth.
 *
 * @param {Object} customer
 * @param {string} currentMonth - YYYY-MM
 * @returns {boolean}
 */
export function hasUnpaidDuesFromPreviousMonths(customer, currentMonth) {
  if (!customer) return false;
  const bills = Array.isArray(customer.bills) ? customer.bills : [];
  if (bills.length === 0) return false;
  return bills.some(b => {
    if (!b || !b.month || b.month >= currentMonth) return false;
    const due = Number(b.dueAmount || 0);
    const paid = (b.payments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
    return due > paid;
  });
}

/**
 * Evaluates whether a customer with dues matches an active reminder stage for a reference date.
 * Implements catch-up stages (Issue #284): if a stage passed and was not sent yet, matches the
 * latest passed stage with a clear label (e.g. "Stage +7 (2 days late)").
 *
 * @param {Object} customer
 * @param {number} balance
 * @param {string} [todayStr] - Reference date in YYYY-MM-DD (PKT)
 * @param {Array<Object>} [stages] - Configured reminder stages
 * @param {Object} [options={}] - Optional overrides ({ storage, history, requireExact })
 * @returns {{ matched: boolean, stage: Object|null, dueDateString: string, daysRelative: number, daysLate: number, isCatchUp: boolean, alreadyReminded: boolean, template: string }|null}
 */
export function getMatchingReminderStage(customer, balance, todayStr = getTodayDateString(), stages = null, options = {}) {
  if (!customer || balance <= 0) return null;

  const storage = options.storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  const activeStages = Array.isArray(stages)
    ? stages.filter(s => s.enabled !== false)
    : getReminderStagesSettings(storage).filter(s => s.enabled !== false);

  if (activeStages.length === 0) return null;

  const history = options.history || (storage ? getReminderHistory(storage) : null);
  const requireExact = options.requireExact === true;

  const currentMonth = todayStr.slice(0, 7);
  const dueInfo = calculateCustomerDueDate(customer, currentMonth);
  const daysRelative = calendarDaysDifference(todayStr, dueInfo.dueDateString);

  // If requireExact is true, preserve exact matching
  if (requireExact) {
    const exactStage = activeStages.find(s => Number(s.offsetDays) === daysRelative);
    if (exactStage) {
      return {
        matched: true,
        stage: exactStage,
        dueDateString: dueInfo.dueDateString,
        daysRelative,
        daysLate: 0,
        isCatchUp: false,
        alreadyReminded: false,
        template: exactStage.template || 'due'
      };
    }
    return null;
  }

  // Active stages sorted ascending by offsetDays (e.g. -2, 0, 3, 7, 15)
  const sortedStages = [...activeStages].sort((a, b) => Number(a.offsetDays) - Number(b.offsetDays));

  // Current month: stages that have passed as of today (offsetDays <= daysRelative)
  const passedStages = sortedStages.filter(s => Number(s.offsetDays) <= daysRelative);

  if (passedStages.length > 0) {
    // Check candidate stages in descending order (latest passed stage first)
    passedStages.sort((a, b) => Number(b.offsetDays) - Number(a.offsetDays));
    for (const stage of passedStages) {
      const status = getCustomerStageDispatchStatus(customer, stage.id, dueInfo.month, storage, history, todayStr);
      if (status.sentPriorDate) {
        // The latest due stage was already dispatched on a prior date in this cycle.
        // It does not need to be sent again, and earlier passed stages are superseded.
        break;
      }

      const daysLate = Math.max(0, daysRelative - Number(stage.offsetDays));
      const isCatchUp = daysLate > 0;
      const stageLabel = isCatchUp
        ? `${stage.label} (${daysLate} ${daysLate === 1 ? 'day' : 'days'} late)`
        : stage.label;

      return {
        matched: true,
        stage: {
          ...stage,
          label: stageLabel,
          originalLabel: stage.label
        },
        dueDateString: dueInfo.dueDateString,
        daysRelative,
        daysLate,
        isCatchUp,
        alreadyReminded: status.sentToday,
        template: stage.template || (daysRelative > 0 ? 'overdue' : 'due')
      };
    }
  }

  // Previous month boundary catch-up if today is early in month (daysRelative < 0)
  // ONLY if customer has unpaid balance spanning the previous month
  if (daysRelative < 0 && hasUnpaidDuesFromPreviousMonths(customer, currentMonth)) {
    const parts = parseDateParts(todayStr);
    if (parts) {
      let prevYear = parts.year;
      let prevMonthNum = parts.month - 1;
      if (prevMonthNum === 0) {
        prevMonthNum = 12;
        prevYear -= 1;
      }
      const prevMonthStr = `${prevYear}-${String(prevMonthNum).padStart(2, '0')}`;
      const prevDueInfo = calculateCustomerDueDate(customer, prevMonthStr);
      const prevDaysRelative = calendarDaysDifference(todayStr, prevDueInfo.dueDateString);

      if (prevDaysRelative > 0) {
        const prevPassedStages = sortedStages
          .filter(s => Number(s.offsetDays) <= prevDaysRelative)
          .sort((a, b) => Number(b.offsetDays) - Number(a.offsetDays));

        for (const stage of prevPassedStages) {
          const status = getCustomerStageDispatchStatus(customer, stage.id, prevDueInfo.month, storage, history, todayStr);
          if (status.sentPriorDate) {
            break;
          }

          const daysLate = Math.max(0, prevDaysRelative - Number(stage.offsetDays));
          const isCatchUp = daysLate > 0;
          const stageLabel = isCatchUp
            ? `${stage.label} (${daysLate} ${daysLate === 1 ? 'day' : 'days'} late)`
            : stage.label;

          return {
            matched: true,
            stage: {
              ...stage,
              label: stageLabel,
              originalLabel: stage.label
            },
            dueDateString: prevDueInfo.dueDateString,
            daysRelative: prevDaysRelative,
            daysLate,
            isCatchUp,
            alreadyReminded: status.sentToday,
            template: stage.template || 'overdue'
          };
        }
      }
    }
  }

  return null;
}

// ============================================================================
// SISP-38: Defaulter Grace Period Countdown & Suspension Readiness
// ============================================================================
//
// Calendar-day escalation for UNPAID customers (outstanding > 0), counted
// against the fixed monthly billing cycle (bills fall due on the 5th):
//   - days  5-10  -> 'grace'        (🟢 Grace)
//   - days 11-14  -> 'final-notice' (🟠 Final Notice)
//   - days 15+    -> 'lock-due'     (🔴 Lock Due) — only when the customer
//     has NO active Waada promise. An active promise (SISP-3 tier
//     'promised': a calendar-valid promiseDate on or after today) caps the
//     escalation at 'final-notice' and keeps the customer OUT of the
//     MikroTik suspension filter until the promise lapses.
// Before the 5th there is no escalation (null): the cycle has not started.
// Promise truth lives in waada-queue.js (getWaadaTier) — this section only
// reads it, never duplicates it. All functions are pure and take an
// injectable todayStr (YYYY-MM-DD) so tests never depend on the wall clock.

export const ESCALATION_STAGES = Object.freeze({
  GRACE: 'grace',
  FINAL_NOTICE: 'final-notice',
  LOCK_DUE: 'lock-due'
});

export const ESCALATION_GRACE_START_DAY = 5;
export const ESCALATION_FINAL_NOTICE_START_DAY = 11;
export const ESCALATION_LOCK_DUE_START_DAY = 15;

/**
 * Escalation state of one unpaid customer for a reference date.
 * @param {Object} customer - Customer record (promiseDate read via SISP-3).
 * @param {number} outstanding - Total unpaid balance (PKR); must be > 0.
 * @param {string} [todayStr] - Reference date YYYY-MM-DD (injectable).
 * @returns {{ stage: string, dayOfMonth: number, hasActiveWaada: boolean,
 *   promiseDate: string|null }|null} Null when the customer is not an
 *   unpaid defaulter in the escalation window (paid up, or before the 5th).
 */
export function getEscalationStage(customer, outstanding, todayStr = getTodayDateString()) {
  if (!customer || typeof customer !== 'object') return null;
  // Owner rule (2026-10-29): free connections owe nothing, ever — they
  // never enter the grace / final-notice / lock-due escalation.
  if (customer.isFreeConnection) return null;
  if (!(Number(outstanding) > 0)) return null;
  const parts = parseDateParts(todayStr);
  if (!parts) return null;
  const dayOfMonth = parts.day;
  if (dayOfMonth < ESCALATION_GRACE_START_DAY) return null;

  const promiseDate = typeof customer.promiseDate === 'string' && customer.promiseDate.trim()
    ? customer.promiseDate.trim()
    : null;
  // SISP-3 is the source of truth: tier 'promised' == valid promiseDate
  // on or after today (the customer is snoozed until the promise lapses).
  const hasActiveWaada = getWaadaTier(customer, outstanding, todayStr) === WAADA_TIERS.PROMISED;

  let stage;
  if (dayOfMonth >= ESCALATION_LOCK_DUE_START_DAY) {
    stage = hasActiveWaada ? ESCALATION_STAGES.FINAL_NOTICE : ESCALATION_STAGES.LOCK_DUE;
  } else if (dayOfMonth >= ESCALATION_FINAL_NOTICE_START_DAY) {
    stage = ESCALATION_STAGES.FINAL_NOTICE;
  } else {
    stage = ESCALATION_STAGES.GRACE;
  }
  return { stage, dayOfMonth, hasActiveWaada, promiseDate };
}

/** Badge label for an escalation stage, or null for an unknown stage. */
export function escalationBadgeLabel(stage) {
  if (stage === ESCALATION_STAGES.GRACE) return '🟢 Grace';
  if (stage === ESCALATION_STAGES.FINAL_NOTICE) return '🟠 Final Notice';
  if (stage === ESCALATION_STAGES.LOCK_DUE) return '🔴 Lock Due';
  return null;
}

/** CSS modifier class for an escalation stage badge. */
export function escalationBadgeClass(stage) {
  if (stage === ESCALATION_STAGES.GRACE) return 'escalation-grace';
  if (stage === ESCALATION_STAGES.FINAL_NOTICE) return 'escalation-final';
  if (stage === ESCALATION_STAGES.LOCK_DUE) return 'escalation-lock';
  return '';
}

/**
 * True when the customer belongs in the SISP-38 "Lock Due (15th+)"
 * suspension filter for the reference date: unpaid, on/after the 15th,
 * and no active Waada promise.
 */
export function isLockDueCustomer(customer, outstanding, todayStr = getTodayDateString()) {
  const escalation = getEscalationStage(customer, outstanding, todayStr);
  return Boolean(escalation) && escalation.stage === ESCALATION_STAGES.LOCK_DUE;
}

/**
 * Filters queue entries ([{ customer, outstanding }]) down to the Lock Due
 * suspension set for the reference date. Input order is preserved.
 */
export function filterLockDueEntries(entries, todayStr = getTodayDateString()) {
  if (!Array.isArray(entries)) return [];
  return entries.filter(entry =>
    entry && isLockDueCustomer(entry.customer, entry.outstanding, todayStr));
}

/**
 * Retrieves the full reminder dispatch audit history from storage.
 * @param {Storage|object} [storage]
 * @returns {Array<Object>}
 */
export function getReminderHistory(storage = null) {
  const targetStorage = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!targetStorage || typeof targetStorage.getItem !== 'function') return [];
  try {
    const raw = targetStorage.getItem(REMINDER_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Checks if a customer has already been reminded on dateStr for the given stageId.
 *
 * @param {string} customerId
 * @param {string} stageId
 * @param {string} dateStr
 * @param {Storage|object} [storage]
 * @returns {boolean}
 */
export function isCustomerRemindedToday(customerId, stageId, dateStr = getTodayDateString(), storage = null) {
  if (!customerId) return false;
  const targetStorage = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  const history = getReminderHistory(targetStorage);
  return history.some(r =>
    String(r.customerId) === String(customerId) &&
    r.date === dateStr &&
    (!stageId || r.stageId === stageId)
  );
}

/**
 * Records an immutable reminder dispatch event into storage.
 *
 * @param {Object} params
 * @param {Object} params.customer
 * @param {Object} [params.stage]
 * @param {string} [params.templateType]
 * @param {string} [params.method='whatsapp'] - 'whatsapp' | 'copied' | 'printed'
 * @param {number} [params.dueAmount=0]
 * @param {string} [params.month]
 * @param {string} [params.dateStr]
 * @param {string} [params.customNote]
 * @param {Storage|object} [storage]
 * @returns {Object} Created audit record
 */
export function recordReminderDispatched({
  customer,
  stage = null,
  templateType = 'due',
  method = 'whatsapp',
  dueAmount = 0,
  month = '',
  dateStr = '',
  customNote = ''
} = {}, storage = null) {
  if (!customer || !customer.id) {
    throw new Error('Customer required for recording reminder dispatch');
  }

  const targetStorage = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  const today = dateStr || getTodayDateString();
  const nowIso = new Date().toISOString();
  const stageId = stage?.id || (templateType === 'disconnection' ? 'overdue_15' : templateType === 'overdue' ? 'overdue_3' : 'on_due');
  const stageLabel = stage?.label || (templateType === 'disconnection' ? 'Disconnection Notice' : templateType === 'overdue' ? 'Overdue Notice' : 'Due Reminder');

  const record = {
    id: `rem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    customerId: String(customer.id),
    customerNumber: customer.customerNumber != null ? Number(customer.customerNumber) : null,
    customerName: String(customer.name || 'Subscriber').trim(),
    phone: String(customer.phone || '').trim(),
    area: String(customer.area || customer.mohalla || '').trim(),
    date: today,
    month: month || today.slice(0, 7),
    stageId,
    stageLabel,
    templateType: templateType || stage?.template || 'due',
    method: String(method || 'whatsapp'),
    dueAmount: Math.max(0, Number(dueAmount || 0)),
    customNote: String(customNote || '').trim(),
    dispatchedAt: nowIso
  };

  const history = getReminderHistory(targetStorage);
  history.unshift(record);

  if (targetStorage && typeof targetStorage.setItem === 'function') {
    try {
      targetStorage.setItem(REMINDER_HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, 1000)));
    } catch {}
  }

  // Also maintain customer.reminders array if mutable customer object provided
  if (customer && typeof customer === 'object') {
    if (!Array.isArray(customer.reminders)) {
      customer.reminders = [];
    }
    customer.reminders.unshift({
      date: today,
      stageId,
      stageLabel,
      method,
      amount: record.dueAmount,
      timestamp: nowIso
    });
  }

  return record;
}

/**
 * Returns reminder dispatch history for a specific customer.
 * @param {string} customerId
 * @param {Storage|object} [storage]
 * @returns {Array<Object>}
 */
export function getCustomerReminderHistory(customerId, storage = null) {
  if (!customerId) return [];
  const targetStorage = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  const history = getReminderHistory(targetStorage);
  return history
    .filter(r => String(r.customerId) === String(customerId))
    .sort((a, b) => String(b.dispatchedAt || b.date).localeCompare(String(a.dispatchedAt || a.date)));
}

/**
 * Calculates current outstanding balance in PKR for a customer from state.
 * @param {Object} customer
 * @param {Object} state
 * @param {string} monthStr
 * @returns {number}
 */
export function getCustomerOutstandingDues(customer, state, monthStr) {
  if (!customer) return 0;
  try {
    const allocations = calculatePaymentAllocations(state);
    const summary = allocations?.forMonth?.(customer.id, monthStr);
    if (summary && summary.balanceDueCents !== null && summary.balanceDueCents !== undefined) {
      return Math.max(0, summary.balanceDueCents / 100);
    }
  } catch {}

  // Fallback to active bills inspection
  const bills = Array.isArray(customer.bills) ? customer.bills : [];
  let totalDue = 0;
  for (const b of bills) {
    const due = Number(b.dueAmount || 0);
    const paid = (b.payments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
    if (due > paid) totalDue += (due - paid);
  }
  return totalDue;
}

/**
 * Generates the "Reminders Today" queue for operators.
 * Evaluates active customers against configured reminder stages for reference date.
 *
 * @param {Object} state - The ISP billing application state.
 * @param {Object} [options={}]
 * @param {string} [options.todayString] - YYYY-MM-DD
 * @param {Storage|object} [options.storage]
 * @param {Array<Object>} [options.stages]
 * @returns {{ date: string, queue: Array<Object>, totalCount: number, pendingCount: number, completedCount: number, totalDuesPkr: number }}
 */
export function getRemindersTodayQueue(state, options = {}) {
  const storage = options.storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  const todayStr = options.todayString || getTodayDateString();
  const stages = options.stages || getReminderStagesSettings(storage);
  const monthStr = todayStr.slice(0, 7);

  const customers = Array.isArray(state?.customers) ? state.customers : [];
  // SISP-71: Template Studio templates are read once per queue build, so a
  // studio edit applies to the very next draft the queue generates.
  const waTemplates = getWaTemplates(storage);
  const queue = [];
  let totalDuesPkr = 0;
  let completedCount = 0;

  const history = options.history || (storage ? getReminderHistory(storage) : null);
  let overdueCustomersCount = 0;

  for (const c of customers) {
    if (c.archived) continue;

    const balance = getCustomerOutstandingDues(c, state, monthStr);
    if (balance <= 0) continue;

    overdueCustomersCount++;

    // SISP-3 3-tier snooze: customers with a future Waada promise are kept
    // OUT of the daily collection list (they live in the Promised tab), while
    // broken promises pin to the very top of the queue below.
    const waadaTier = getWaadaTier(c, balance, todayStr);
    if (waadaTier === WAADA_TIERS.PROMISED) continue;

    const match = getMatchingReminderStage(c, balance, todayStr, stages, { storage, history });
    if (!match || !match.matched) continue;

    const alreadyReminded = Boolean(match.alreadyReminded) || isCustomerRemindedToday(c.id, match.stage.id, todayStr, storage);
    if (alreadyReminded) {
      completedCount++;
    }

    const dueDay = calculateCustomerDueDay(c);
    const dueDateLabel = `${dueDay}th of this month (${formatDisplayDate(match.dueDateString)})`;

    let reminderMessage = buildPaymentReminderMessage({
      customer: c,
      templateType: match.template,
      billingData: {
        month: monthStr,
        billAmount: balance,
        balance,
        dueDate: dueDateLabel
      }
    });

    // SISP-71 bridge: a Template Studio template the operator customized
    // for this customer's Waada tier replaces the built-in stage wording —
    // broken promises follow the Broken Waada Alert at any stage, plain
    // due-stage reminders follow the Polite Reminder. Untouched templates
    // (renderCustomWaTemplate returns null) keep the built-in text, and
    // the wa.me draft URL below is built from whichever text won, so a
    // studio edit updates the draft URL immediately.
    const waTemplateId = waadaTemplateIdForTier(waadaTier);
    if (waTemplateId && (waadaTier === WAADA_TIERS.BROKEN || match.template === 'due')) {
      const customMessage = renderCustomWaTemplate(waTemplates, waTemplateId, c, { totalDue: balance }, 'roman');
      if (customMessage) reminderMessage = customMessage;
    }

    // SISP-118: reminder drafts target the customer's WhatsApp number
    // when one is recorded (the seam falls back to the primary phone).
    const wa = formatWhatsAppUrl(whatsappPhoneFor(c), reminderMessage);

    totalDuesPkr += balance;

    queue.push({
      customer: c,
      customerId: c.id,
      customerNumber: c.customerNumber != null ? Number(c.customerNumber) : null,
      customerName: c.name || 'Subscriber',
      phone: c.phone || '',
      normalizedPhone: wa.formattedPhone || c.phone || '',
      validPhone: wa.validPhone,
      area: c.area || c.mohalla || '',
      balance,
      dueDateString: match.dueDateString,
      dueDay,
      stage: match.stage,
      stageId: match.stage.id,
      stageLabel: match.stage.label,
      daysRelative: match.daysRelative,
      daysLate: match.daysLate || 0,
      isCatchUp: Boolean(match.isCatchUp),
      templateType: match.template,
      alreadyReminded,
      messageText: reminderMessage,
      whatsappUrl: wa.url,
      waadaTier,
      promiseDate: typeof c.promiseDate === 'string' ? c.promiseDate : null,
      promiseAmount: c.promiseAmount ?? null,
      promiseNote: c.promiseNote ?? ''
    });
  }

  // Sort queue: SISP-3 broken Waada promises pin to the very top, then
  // unreminded first, then highest balance first (previous order preserved
  // within each tier).
  const waadaTierOrder = { [WAADA_TIERS.BROKEN]: 0, [WAADA_TIERS.ACTIVE]: 1 };
  queue.sort((a, b) => {
    const tierDiff = (waadaTierOrder[a.waadaTier] ?? 1) - (waadaTierOrder[b.waadaTier] ?? 1);
    if (tierDiff !== 0) return tierDiff;
    if (a.alreadyReminded !== b.alreadyReminded) {
      return a.alreadyReminded ? 1 : -1;
    }
    return b.balance - a.balance;
  });

  const pendingCount = queue.length - completedCount;

  return {
    date: todayStr,
    queue,
    totalCount: queue.length,
    pendingCount,
    completedCount,
    totalDuesPkr,
    overdueCustomersCount
  };
}

/**
 * SISP-25 campaign queue: unpaid customers for a 1-tap Send & Next run.
 * Filters by Zone and/or Waada tier; broken Waada promises sort first, then
 * highest balance first (same order as the Reminders Today queue). Unlike
 * that queue, stage rules do not apply here — every unpaid, non-archived
 * customer in the filter is queued, so the operator picks the audience.
 *
 * @param {Object} state - The ISP billing application state.
 * @param {Object} [options={}]
 * @param {string} [options.zone='all'] - Zone name, or 'all'.
 * @param {string} [options.waadaTier='all'] - 'broken' | 'active' | 'promised' | 'all'.
 * @param {string} [options.todayString] - YYYY-MM-DD
 * @returns {{ date: string, zone: string, waadaTier: string, items: Array<Object>, totalCount: number, totalDuesPkr: number }}
 */
export function buildCampaignQueue(state, options = {}) {
  const todayStr = options.todayString || getTodayDateString();
  const monthStr = todayStr.slice(0, 7);
  const zoneFilter = String(options.zone ?? 'all').trim().toLowerCase();
  const tierFilter = String(options.waadaTier ?? 'all').trim().toLowerCase();
  const customers = Array.isArray(state?.customers) ? state.customers : [];
  const items = [];
  let totalDuesPkr = 0;

  for (const c of customers) {
    if (c.archived) continue;
    const balance = getCustomerOutstandingDues(c, state, monthStr);
    if (!(balance > 0)) continue;
    const zone = String(c.zone ?? '').trim();
    if (zoneFilter !== 'all' && zone.toLowerCase() !== zoneFilter) continue;
    const waadaTier = getWaadaTier(c, balance, todayStr);
    if (tierFilter !== 'all' && waadaTier !== tierFilter) continue;
    totalDuesPkr += balance;
    items.push({
      customer: c,
      customerId: c.id,
      customerName: c.name || 'Subscriber',
      phone: c.phone || '',
      zone,
      balance,
      waadaTier,
      promiseDate: typeof c.promiseDate === 'string' ? c.promiseDate : null,
      lastRemindedAt: typeof c.lastRemindedAt === 'string' ? c.lastRemindedAt : null
    });
  }

  const tierOrder = { broken: 0, active: 1, promised: 2 };
  items.sort((a, b) => ((tierOrder[a.waadaTier] ?? 1) - (tierOrder[b.waadaTier] ?? 1)) || (b.balance - a.balance));

  return { date: todayStr, zone: options.zone ?? 'all', waadaTier: options.waadaTier ?? 'all', items, totalCount: items.length, totalDuesPkr };
}

/**
 * SISP-25: stamps one customer's lastRemindedAt (YYYY-MM-DD) after a
 * campaign send. Pure: returns a new state, the input state is untouched,
 * and an unknown customer id returns the input state unchanged.
 */
export function markCustomerLastReminded(state, customerId, dateStr = getTodayDateString()) {
  if (!state || !customerId) return state;
  const customers = Array.isArray(state.customers) ? state.customers : [];
  if (!customers.some(c => String(c.id) === String(customerId))) return state;
  return {
    ...state,
    customers: customers.map(c => String(c.id) === String(customerId) ? { ...c, lastRemindedAt: dateStr } : c)
  };
}

/**
 * Updates the navigation badge for the Reminders Today Queue on More menu.
 *
 * @param {Object} state - Application state
 * @param {Object} [options={}]
 * @returns {number} Pending reminders count
 */
export function updateRemindersQueueNavBadge(state, options = {}) {
  if (typeof document === 'undefined') return 0;
  const badge = document.querySelector('#mobileMoreRemindersQueueBadge');
  if (!badge) return 0;
  try {
    const queueData = getRemindersTodayQueue(state, options);
    const count = queueData?.pendingCount || 0;
    if (count > 0) {
      badge.textContent = String(count);
      badge.hidden = false;
      badge.setAttribute('aria-label', `${count} reminders pending`);
    } else {
      badge.hidden = true;
    }
    return count;
  } catch {
    badge.hidden = true;
    return 0;
  }
}


// ============================================================================
// PROMISE-TO-PAY ("WADA") SUITE
// ============================================================================

/**
 * Retrieves all collection promises from storage.
 * @param {Storage|object} [storage]
 * @returns {Array<Object>}
 */
export function getCollectionPromises(storage = null) {
  const targetStorage = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!targetStorage || typeof targetStorage.getItem !== 'function') return [];
  try {
    const raw = targetStorage.getItem(COLLECTION_PROMISES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.sort((a, b) => String(a.promisedDate || '').localeCompare(String(b.promisedDate || '')));
  } catch {
    return [];
  }
}

/**
 * Saves or updates a collection promise in storage.
 *
 * @param {Object} promiseData
 * @param {Storage|object} [storage]
 * @returns {Object|null}
 */
export function recordCustomerPromise(promiseData, storage = null) {
  if (!promiseData || !promiseData.customerId || !promiseData.promisedDate) {
    return null;
  }
  const targetStorage = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!targetStorage || typeof targetStorage.setItem !== 'function') return null;

  try {
    const promises = getCollectionPromises(targetStorage);
    const id = promiseData.id || `prom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const nowIso = new Date().toISOString();

    const record = {
      id,
      customerId: String(promiseData.customerId),
      customerNumber: promiseData.customerNumber != null ? Number(promiseData.customerNumber) : null,
      customerName: String(promiseData.customerName || promiseData.name || 'Customer').trim(),
      phone: String(promiseData.phone || '').trim(),
      area: String(promiseData.area || promiseData.mohalla || '').trim(),
      promisedDate: String(promiseData.promisedDate),
      promisedAmount: Math.max(0, Number(promiseData.promisedAmount || promiseData.amount || 0)),
      note: String(promiseData.note || 'Promise-to-pay commitment').trim(),
      status: promiseData.status || 'pending', // 'pending' | 'fulfilled' | 'cancelled'
      createdAt: promiseData.createdAt || nowIso,
      updatedAt: nowIso,
      fulfilledAt: promiseData.fulfilledAt || null,
      fulfilledPaymentId: promiseData.fulfilledPaymentId || null
    };

    const existingIndex = promises.findIndex(p => p.id === id);
    if (existingIndex >= 0) {
      promises[existingIndex] = record;
    } else {
      promises.push(record);
    }

    targetStorage.setItem(COLLECTION_PROMISES_STORAGE_KEY, JSON.stringify(promises));
    return record;
  } catch {
    return null;
  }
}

/**
 * Marks a collection promise as fulfilled.
 *
 * @param {string} promiseId
 * @param {string} [paymentId]
 * @param {Storage|object} [storage]
 * @returns {Object|null}
 */
export function markPromiseFulfilled(promiseId, paymentId = null, storage = null) {
  if (!promiseId) return null;
  const targetStorage = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!targetStorage || typeof targetStorage.getItem !== 'function') return null;
  try {
    const promises = getCollectionPromises(targetStorage);
    const target = promises.find(p => p.id === promiseId);
    if (!target) return null;

    target.status = 'fulfilled';
    target.fulfilledAt = new Date().toISOString();
    target.updatedAt = target.fulfilledAt;
    target.fulfilledPaymentId = paymentId || null;

    targetStorage.setItem(COLLECTION_PROMISES_STORAGE_KEY, JSON.stringify(promises));
    return target;
  } catch {
    return null;
  }
}

/**
 * Cancels or dismisses a collection promise.
 *
 * @param {string} promiseId
 * @param {string} [reason]
 * @param {Storage|object} [storage]
 * @returns {Object|null}
 */
export function cancelPromise(promiseId, reason = '', storage = null) {
  if (!promiseId) return null;
  const targetStorage = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!targetStorage || typeof targetStorage.getItem !== 'function') return null;
  try {
    const promises = getCollectionPromises(targetStorage);
    const target = promises.find(p => p.id === promiseId);
    if (!target) return null;

    target.status = 'cancelled';
    target.cancelledReason = String(reason || '');
    target.updatedAt = new Date().toISOString();

    targetStorage.setItem(COLLECTION_PROMISES_STORAGE_KEY, JSON.stringify(promises));
    return target;
  } catch {
    return null;
  }
}

/**
 * Reschedules a collection promise to a new date.
 *
 * @param {string} promiseId
 * @param {string} newDateStr
 * @param {Storage|object} [storage]
 * @returns {Object|null}
 */
export function reschedulePromise(promiseId, newDateStr, storage = null) {
  if (!promiseId || !newDateStr) return null;
  const targetStorage = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!targetStorage || typeof targetStorage.getItem !== 'function') return null;
  try {
    const promises = getCollectionPromises(targetStorage);
    const target = promises.find(p => p.id === promiseId);
    if (!target) return null;

    target.previousPromisedDate = target.promisedDate;
    target.promisedDate = newDateStr;
    target.status = 'pending';
    target.updatedAt = new Date().toISOString();

    targetStorage.setItem(COLLECTION_PROMISES_STORAGE_KEY, JSON.stringify(promises));
    return target;
  } catch {
    return null;
  }
}

/**
 * Generates an executive Promise-to-Pay (Wada) follow-up list categorized for reference date.
 * Automatically synchronizes with state payments to detect fulfilled commitments.
 *
 * @param {Object} state - The ISP billing application state.
 * @param {Object} [options={}]
 * @param {string} [options.todayString]
 * @param {Storage|object} [options.storage]
 * @returns {Object} Categorized promises
 */
export function getPromiseToPayFollowupList(state, options = {}) {
  const storage = options.storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  const todayStr = options.todayString || getTodayDateString();
  const rawPromises = getCollectionPromises(storage);

  const customers = Array.isArray(state?.customers) ? state.customers : [];
  const customerMap = new Map(customers.map(c => [c.id, c]));

  const todayList = [];
  const brokenList = [];
  const upcomingList = [];
  const fulfilledList = [];
  const cancelledList = [];

  for (const p of rawPromises) {
    const cust = customerMap.get(p.customerId);
    const currentBalance = cust ? getCustomerOutstandingDues(cust, state, todayStr.slice(0, 7)) : 0;

    // Check if customer paid in full -> auto-fulfill
    let isFulfilled = p.status === 'fulfilled';
    if (!isFulfilled && p.status === 'pending' && cust && currentBalance === 0) {
      isFulfilled = true;
      markPromiseFulfilled(p.id, null, storage);
      p.status = 'fulfilled';
    }

    const diffDays = calendarDaysDifference(todayStr, p.promisedDate);
    const isToday = p.promisedDate === todayStr;
    const isBroken = p.status === 'pending' && diffDays > 0; // promised date was before today and not fulfilled
    const isUpcoming = p.status === 'pending' && diffDays < 0;

    const item = {
      ...p,
      customerName: cust?.name || p.customerName || 'Subscriber',
      customerNumber: cust?.customerNumber ?? p.customerNumber,
      // SISP-118: the follow-up list's send target prefers the live
      // customer's WhatsApp number; the promise's own recorded phone
      // stays as the fallback when the customer has none usable.
      phone: (cust ? whatsappPhoneFor(cust) : '') || p.phone || '',
      area: cust?.area || cust?.mohalla || p.area || '',
      currentBalance,
      diffDays,
      isToday,
      isBroken,
      isUpcoming,
      isFulfilled,
      formattedPromisedDate: formatDisplayDate(p.promisedDate),
      relativeText: isToday
        ? 'Due Today'
        : isBroken
          ? `${diffDays} ${diffDays === 1 ? 'day' : 'days'} overdue (Broken Wada)`
          : `Due in ${Math.abs(diffDays)} ${Math.abs(diffDays) === 1 ? 'day' : 'days'}`
    };

    if (p.status === 'cancelled') {
      cancelledList.push(item);
    } else if (isFulfilled) {
      fulfilledList.push(item);
    } else if (isToday) {
      todayList.push(item);
    } else if (isBroken) {
      brokenList.push(item);
    } else if (isUpcoming) {
      upcomingList.push(item);
    }
  }

  // Sort lists
  todayList.sort((a, b) => b.promisedAmount - a.promisedAmount);
  brokenList.sort((a, b) => b.diffDays - a.diffDays);
  upcomingList.sort((a, b) => a.promisedDate.localeCompare(b.promisedDate));
  fulfilledList.sort((a, b) => String(b.fulfilledAt || '').localeCompare(String(a.fulfilledAt || '')));

  const totalPromisedAmount = [...todayList, ...brokenList, ...upcomingList]
    .reduce((sum, p) => sum + (p.promisedAmount || 0), 0);

  return {
    today: todayList,
    broken: brokenList,
    upcoming: upcomingList,
    fulfilled: fulfilledList,
    cancelled: cancelledList,
    all: rawPromises,
    summary: {
      todayCount: todayList.length,
      brokenCount: brokenList.length,
      upcomingCount: upcomingList.length,
      fulfilledCount: fulfilledList.length,
      totalPendingCount: todayList.length + brokenList.length + upcomingList.length,
      totalPromisedAmount
    }
  };
}

/**
 * Builds a polite, professional bilingual WhatsApp follow-up message for a promise-to-pay.
 *
 * SISP-71: for a BROKEN promise, a Broken Waada Alert template the
 * operator customized in the Template Studio (sisp_wa_templates_v1) is
 * used instead of the built-in wording; pass `templates` to override the
 * stored list (tests), otherwise the stored templates are read. An
 * untouched template keeps the built-in bilingual text below.
 *
 * @param {Object} promise
 * @param {Object} [customer]
 * @param {Array<Object>} [templates]
 * @returns {string}
 */
export function formatPromiseFollowupWhatsApp(promise, customer = null, templates = null) {
  const name = customer?.name || promise?.customerName || 'Valued Subscriber';
  const custNum = customer?.customerNumber ?? promise?.customerNumber ? `#${customer?.customerNumber ?? promise?.customerNumber}` : 'Account';
  const area = customer?.area || customer?.mohalla || promise?.area || 'Shahdara';
  const amount = Number(promise?.promisedAmount || 0).toLocaleString();
  const dateStr = formatDisplayDate(promise?.promisedDate);
  const isBroken = (typeof promise?.isBroken === 'boolean')
    ? promise.isBroken
    : (promise?.promisedDate && calendarDaysDifference(getTodayDateString(), promise.promisedDate) > 0);

  if (isBroken) {
    // SISP-71 bridge: customized Broken Waada Alert wins; {totalDue} is
    // the promised amount and {waadaDate} the promised date.
    const bridged = renderCustomWaTemplate(
      Array.isArray(templates) ? templates : getWaTemplates(),
      'brokenWaada',
      customer ?? { name: promise?.customerName, customerNumber: promise?.customerNumber, area: promise?.area },
      {
        totalDue: Number(promise?.promisedAmount) > 0 ? Number(promise.promisedAmount) : null,
        waadaDate: promise?.promisedDate || ''
      },
      'roman'
    );
    if (bridged) return bridged;
    return (
      `*Shahdara ISP - Wada / Promise-to-Pay Reminder*\n\n` +
      `Assalam-o-Alaikum ${name},\n` +
      `Your scheduled bill payment commitment of *PKR ${amount}* for ${custNum} (${area}) was due on *${dateStr}*.\n\n` +
      `Aap ke waday ke mutabiq payment abhi tak received nahi hui. Baraye meharbani aaj hi cash collector ko payment ada karein ya online transfer (JazzCash / EasyPaisa / Raast) karein taa-ke connection uninterrupted chal sake.\n\n` +
      `Shukriya,\nShahdara ISP Support`
    );
  }

  return (
    `*Shahdara ISP - Scheduled Payment Commitment*\n\n` +
    `Assalam-o-Alaikum ${name},\n` +
    `Friendly reminder for account ${custNum} (${area}): payment of *PKR ${amount}* is scheduled for today (*${dateStr}*).\n\n` +
    `Aap ke waday ke mutabiq baraye meharbani payment cash collector ko dastyab rakhein ya online transfer karein.\n\n` +
    `Shukriya,\nShahdara ISP Support`
  );
}
