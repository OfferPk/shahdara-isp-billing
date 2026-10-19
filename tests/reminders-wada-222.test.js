import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_REMINDER_STAGES,
  getTodayDateString,
  parseDateParts,
  calendarDaysDifference,
  formatDisplayDate,
  getReminderStagesSettings,
  saveReminderStagesSettings,
  resetReminderStagesSettings,
  calculateCustomerDueDay,
  calculateCustomerDueDate,
  getMatchingReminderStage,
  getReminderHistory,
  isCustomerRemindedToday,
  recordReminderDispatched,
  getCustomerReminderHistory,
  getCustomerOutstandingDues,
  getRemindersTodayQueue,
  getCollectionPromises,
  recordCustomerPromise,
  markPromiseFulfilled,
  cancelPromise,
  reschedulePromise,
  getPromiseToPayFollowupList,
  formatPromiseFollowupWhatsApp,
  REMINDER_STAGES_SETTINGS_KEY,
  REMINDER_HISTORY_STORAGE_KEY,
  COLLECTION_PROMISES_STORAGE_KEY
} from '../reminder-queue.js';
import { STORAGE_KEYS_CATALOG } from '../qa-backup-csv-import.js';

function createMockStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
    get length() {
      return store.size;
    },
    key(index) {
      return Array.from(store.keys())[index] || null;
    }
  };
}

test('Issue #222: Storage keys catalog tracks reminder stages, history, and promises', () => {
  const keys = STORAGE_KEYS_CATALOG.map(item => item.key);
  assert.ok(keys.includes(REMINDER_STAGES_SETTINGS_KEY), 'reminder stages key cataloged');
  assert.ok(keys.includes(REMINDER_HISTORY_STORAGE_KEY), 'reminder history key cataloged');
  assert.ok(keys.includes(COLLECTION_PROMISES_STORAGE_KEY), 'collection promises key cataloged');
});

test('Issue #222: Date and calendar day difference calculations are month and year safe', () => {
  const today = getTodayDateString(new Date('2026-10-19T06:00:00Z'));
  assert.match(today, /^\d{4}-\d{2}-\d{2}$/);

  assert.equal(calendarDaysDifference('2026-10-05', '2026-10-05'), 0);
  assert.equal(calendarDaysDifference('2026-10-08', '2026-10-05'), 3);
  assert.equal(calendarDaysDifference('2026-10-03', '2026-10-05'), -2);

  // Month boundary (Oct 31 to Nov 03 = +3)
  assert.equal(calendarDaysDifference('2026-11-03', '2026-10-31'), 3);
  // Year boundary (Dec 31, 2026 to Jan 02, 2027 = +2)
  assert.equal(calendarDaysDifference('2027-01-02', '2026-12-31'), 2);

  assert.equal(formatDisplayDate('2026-10-05'), '5 Oct 2026');
  assert.equal(formatDisplayDate('2026-01-01'), '1 Jan 2026');
});

test('Issue #222: Reminder stages settings load defaults, persist updates, and reset', () => {
  const storage = createMockStorage();

  const defaults = getReminderStagesSettings(storage);
  assert.equal(defaults.length, 5);
  assert.equal(defaults[0].offsetDays, -2);
  assert.equal(defaults[1].offsetDays, 0);
  assert.equal(defaults[2].offsetDays, 3);
  assert.equal(defaults[3].offsetDays, 7);
  assert.equal(defaults[4].offsetDays, 15);

  const custom = [
    { id: 'custom_1', label: 'Custom 1', offsetDays: 1, template: 'due', enabled: true },
    { id: 'custom_2', label: 'Custom 2', offsetDays: 5, template: 'overdue', enabled: false }
  ];
  saveReminderStagesSettings(custom, storage);
  const loaded = getReminderStagesSettings(storage);
  assert.equal(loaded.length, 2);
  assert.equal(loaded[0].label, 'Custom 1');
  assert.equal(loaded[1].enabled, false);

  resetReminderStagesSettings(storage);
  const resetLoaded = getReminderStagesSettings(storage);
  assert.equal(resetLoaded.length, 5);
  assert.equal(resetLoaded[0].id, 'pre_due');
});

test('Issue #222: Customer due date resolution handles default (5th) and custom dates (1..28)', () => {
  assert.equal(calculateCustomerDueDay({}), 5);
  assert.equal(calculateCustomerDueDay({ customDueDate: 12 }), 12);
  assert.equal(calculateCustomerDueDay({ customDueDate: 30 }), 5); // clamped to 5
  assert.equal(calculateCustomerDueDay({ dueDay: 20 }), 20);

  const info = calculateCustomerDueDate({ customDueDate: 10 }, '2026-10');
  assert.equal(info.dueDateString, '2026-10-10');
  assert.equal(info.dueDay, 10);
});

test('Issue #222: Matching reminder stages detect pre-due (-2), on-due (0), and overdue (+3, +7, +15)', () => {
  const customer = { id: 'c1', name: 'Ali Khan', customDueDate: 5 };

  // 2 days before (Oct 3rd)
  const matchPre = getMatchingReminderStage(customer, 1500, '2026-10-03');
  assert.ok(matchPre && matchPre.matched);
  assert.equal(matchPre.stage.id, 'pre_due');
  assert.equal(matchPre.template, 'due');

  // On due date (Oct 5th)
  const matchOn = getMatchingReminderStage(customer, 1500, '2026-10-05');
  assert.ok(matchOn && matchOn.matched);
  assert.equal(matchOn.stage.id, 'on_due');

  // Overdue +3 days (Oct 8th)
  const matchOver3 = getMatchingReminderStage(customer, 1500, '2026-10-08');
  assert.ok(matchOver3 && matchOver3.matched);
  assert.equal(matchOver3.stage.id, 'overdue_3');
  assert.equal(matchOver3.template, 'overdue');

  // Overdue +7 days (Oct 12th)
  const matchOver7 = getMatchingReminderStage(customer, 1500, '2026-10-12');
  assert.ok(matchOver7 && matchOver7.matched);
  assert.equal(matchOver7.stage.id, 'overdue_7');

  // Overdue +15 days (Oct 20th)
  const matchOver15 = getMatchingReminderStage(customer, 1500, '2026-10-20');
  assert.ok(matchOver15 && matchOver15.matched);
  assert.equal(matchOver15.stage.id, 'overdue_15');
  assert.equal(matchOver15.template, 'disconnection');

  // Non-matching day (Oct 6th)
  const matchNone = getMatchingReminderStage(customer, 1500, '2026-10-06');
  assert.equal(matchNone, null);

  // Customer with zero balance -> no reminder
  const matchZero = getMatchingReminderStage(customer, 0, '2026-10-05');
  assert.equal(matchZero, null);
});

test('Issue #222: Reminder dispatch audit records events and retrieves customer history', () => {
  const storage = createMockStorage();
  const customer = {
    id: 'c101',
    customerNumber: 101,
    name: 'Tariq Mehmood',
    phone: '03001234567',
    area: 'Block B'
  };

  assert.equal(isCustomerRemindedToday('c101', 'on_due', '2026-10-05', storage), false);

  const rec = recordReminderDispatched({
    customer,
    templateType: 'due',
    method: 'whatsapp',
    dueAmount: 2200,
    month: '2026-10',
    dateStr: '2026-10-05'
  }, storage);

  assert.ok(rec.id);
  assert.equal(rec.customerId, 'c101');
  assert.equal(rec.date, '2026-10-05');
  assert.equal(rec.method, 'whatsapp');
  assert.equal(rec.dueAmount, 2200);

  assert.equal(isCustomerRemindedToday('c101', 'on_due', '2026-10-05', storage), true);
  assert.equal(isCustomerRemindedToday('c101', 'on_due', '2026-10-06', storage), false);

  const history = getCustomerReminderHistory('c101', storage);
  assert.equal(history.length, 1);
  assert.equal(history[0].id, rec.id);
});

test('Issue #222: getRemindersTodayQueue builds sorted list of customers matching stages', () => {
  const storage = createMockStorage();
  const state = {
    customers: [
      {
        id: 'c1',
        customerNumber: 1,
        name: 'Customer 1 (Due Today)',
        phone: '03001111111',
        customDueDate: 5,
        bills: [{ dueAmount: 1500, payments: [] }]
      },
      {
        id: 'c2',
        customerNumber: 2,
        name: 'Customer 2 (Due Today Higher)',
        phone: '03002222222',
        customDueDate: 5,
        bills: [{ dueAmount: 3500, payments: [] }]
      },
      {
        id: 'c3',
        customerNumber: 3,
        name: 'Customer 3 (Not Due Today)',
        phone: '03003333333',
        customDueDate: 10,
        bills: [{ dueAmount: 1500, payments: [] }]
      },
      {
        id: 'c4',
        customerNumber: 4,
        name: 'Customer 4 (Zero Balance)',
        phone: '03004444444',
        customDueDate: 5,
        bills: [{ dueAmount: 1500, payments: [{ amount: 1500 }] }]
      }
    ]
  };

  const queueResult = getRemindersTodayQueue(state, {
    todayString: '2026-10-05',
    storage
  });

  assert.equal(queueResult.date, '2026-10-05');
  assert.equal(queueResult.totalCount, 2);
  assert.equal(queueResult.pendingCount, 2);
  assert.equal(queueResult.completedCount, 0);

  // Highest balance comes first
  assert.equal(queueResult.queue[0].customerId, 'c2');
  assert.equal(queueResult.queue[0].balance, 3500);
  assert.equal(queueResult.queue[1].customerId, 'c1');
  assert.equal(queueResult.queue[1].balance, 1500);
  assert.ok(queueResult.queue[0].whatsappUrl.includes('wa.me/923002222222'));

  // Mark c2 as reminded today
  recordReminderDispatched({
    customer: state.customers[1],
    templateType: 'due',
    dateStr: '2026-10-05'
  }, storage);

  const updatedQueue = getRemindersTodayQueue(state, {
    todayString: '2026-10-05',
    storage
  });
  assert.equal(updatedQueue.completedCount, 1);
  assert.equal(updatedQueue.pendingCount, 1);
  // Unreminded c1 comes first now
  assert.equal(updatedQueue.queue[0].customerId, 'c1');
  assert.equal(updatedQueue.queue[1].customerId, 'c2');
});

test('Issue #222: Promise-to-Pay (Wada) lifecycle: record, reschedule, fulfill, and cancel', () => {
  const storage = createMockStorage();

  const promise = recordCustomerPromise({
    customerId: 'c500',
    customerNumber: 500,
    customerName: 'Zubair Ahmed',
    phone: '03215555555',
    area: 'Saeed Park',
    promisedDate: '2026-10-19',
    promisedAmount: 2000,
    note: 'Will pay cash on Monday evening'
  }, storage);

  assert.ok(promise.id);
  assert.equal(promise.status, 'pending');
  assert.equal(promise.promisedDate, '2026-10-19');

  const allPromises = getCollectionPromises(storage);
  assert.equal(allPromises.length, 1);

  // Reschedule
  reschedulePromise(promise.id, '2026-10-22', storage);
  let updated = getCollectionPromises(storage).find(p => p.id === promise.id);
  assert.equal(updated.promisedDate, '2026-10-22');
  assert.equal(updated.previousPromisedDate, '2026-10-19');

  // Mark fulfilled
  markPromiseFulfilled(promise.id, 'pay-999', storage);
  updated = getCollectionPromises(storage).find(p => p.id === promise.id);
  assert.equal(updated.status, 'fulfilled');
  assert.equal(updated.fulfilledPaymentId, 'pay-999');

  // Cancel another promise
  const p2 = recordCustomerPromise({
    customerId: 'c501',
    promisedDate: '2026-10-20',
    promisedAmount: 1200
  }, storage);
  cancelPromise(p2.id, 'Customer shifted to another city', storage);
  const p2Updated = getCollectionPromises(storage).find(p => p.id === p2.id);
  assert.equal(p2Updated.status, 'cancelled');
});

test('Issue #222: getPromiseToPayFollowupList categorizes today, broken, and upcoming promises', () => {
  const storage = createMockStorage();
  const state = {
    customers: [
      { id: 'c1', name: 'Cust 1', phone: '03001111111', bills: [{ dueAmount: 1000, payments: [] }] },
      { id: 'c2', name: 'Cust 2', phone: '03002222222', bills: [{ dueAmount: 1500, payments: [] }] },
      { id: 'c3', name: 'Cust 3', phone: '03003333333', bills: [{ dueAmount: 2000, payments: [] }] },
      { id: 'c4', name: 'Cust 4 (Paid in Full)', phone: '03004444444', bills: [{ dueAmount: 1800, payments: [{ amount: 1800 }] }] }
    ]
  };

  // Due Today: Oct 19
  recordCustomerPromise({ customerId: 'c1', promisedDate: '2026-10-19', promisedAmount: 1000 }, storage);
  // Broken (Late/Overdue): Oct 15 (4 days overdue relative to Oct 19)
  recordCustomerPromise({ customerId: 'c2', promisedDate: '2026-10-15', promisedAmount: 1500 }, storage);
  // Upcoming: Oct 25
  recordCustomerPromise({ customerId: 'c3', promisedDate: '2026-10-25', promisedAmount: 2000 }, storage);
  // Auto-fulfill when customer balance is 0
  recordCustomerPromise({ customerId: 'c4', promisedDate: '2026-10-18', promisedAmount: 1800 }, storage);

  const followup = getPromiseToPayFollowupList(state, {
    todayString: '2026-10-19',
    storage
  });

  assert.equal(followup.summary.todayCount, 1);
  assert.equal(followup.summary.brokenCount, 1);
  assert.equal(followup.summary.upcomingCount, 1);
  assert.equal(followup.summary.fulfilledCount, 1);

  assert.equal(followup.today[0].customerId, 'c1');
  assert.equal(followup.today[0].isToday, true);

  assert.equal(followup.broken[0].customerId, 'c2');
  assert.equal(followup.broken[0].isBroken, true);
  assert.equal(followup.broken[0].diffDays, 4);

  assert.equal(followup.upcoming[0].customerId, 'c3');
  assert.equal(followup.upcoming[0].isUpcoming, true);

  assert.equal(followup.fulfilled[0].customerId, 'c4');
  assert.equal(followup.fulfilled[0].isFulfilled, true);
});

test('Issue #222: formatPromiseFollowupWhatsApp generates bilingual messages for today and broken promises', () => {
  const todayMsg = formatPromiseFollowupWhatsApp({
    customerName: 'Kamran Akmal',
    customerNumber: 42,
    area: 'Millat Town',
    promisedAmount: 1800,
    promisedDate: '2026-10-19',
    isBroken: false
  });
  assert.ok(todayMsg.includes('Shahdara ISP - Scheduled Payment Commitment'));
  assert.ok(todayMsg.includes('Kamran Akmal'));
  assert.ok(todayMsg.includes('PKR 1,800'));
  assert.ok(todayMsg.includes('today'));

  const brokenMsg = formatPromiseFollowupWhatsApp({
    customerName: 'Kamran Akmal',
    customerNumber: 42,
    area: 'Millat Town',
    promisedAmount: 1800,
    promisedDate: '2026-10-15',
    isBroken: true
  });
  assert.ok(brokenMsg.includes('Shahdara ISP - Wada / Promise-to-Pay Reminder'));
  assert.ok(brokenMsg.includes('Aap ke waday ke mutabiq'));
  assert.ok(brokenMsg.includes('PKR 1,800'));
});
