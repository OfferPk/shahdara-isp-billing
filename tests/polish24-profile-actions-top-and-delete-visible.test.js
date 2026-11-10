// Polish #24 — Profile: Delete visible at the top, Edit + New customer
// beside it, placement reordered, and the delete rule changed (the
// polish #10 clean-account gate is REMOVED by the user's 2026-11-09
// decision: deleting a customer deletes the profile AND its entire
// history, regardless of dues or payments).
//
// The purge module is imported lazily inside the purge tests (dynamic
// import) so that the pre-fix run shows the source-assertion split
// (pins pass, behaviour fails) instead of the whole file failing to
// load when the module does not exist yet.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {
  createInitialState,
  addCustomer,
  saveBillMonth,
  addPayment,
  addManualBaqayaEntry,
  addIncident,
  deleteCustomer,
} from '../core.js';

const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const lang = readFileSync(new URL('../nav-language.js', import.meta.url), 'utf8');
const uiFeedbackCss = readFileSync(new URL('../ui-feedback.css', import.meta.url), 'utf8');

const REF = new Date('2026-11-09T12:00:00');

async function purgeModule() {
  return import('../customer-history-purge.js');
}

// One row per registry entry for the given customer, shaped to the
// entry's match kind. `other` rows belong to a second customer and
// must survive the purge untouched.
function rowFor(entry, customerId, extra = {}) {
  switch (entry.match) {
    case 'customerId': return { id: `row-${entry.key}-${customerId}`, customerId, note: 'test row' };
    case 'customer': return { id: `row-${entry.key}-${customerId}`, customer: customerId, promisedDate: '2026-11-07', note: 'test row' };
    case 'either': return { id: `row-${entry.key}-${customerId}`, customerA: customerId, customerB: 'cust-other', relationship: 'household' };
    case 'nestedCustomer': return { id: `row-${entry.key}-${customerId}`, customer: { id: customerId, name: 'Test Customer' } };
    case 'complaintRef': return { id: `row-${entry.key}-${customerId}`, complaintRef: extra.complaintRef ?? 'inc-001', note: 'test row' };
    case 'ticketId': return { id: `row-${entry.key}-${customerId}`, ticketId: extra.complaintRef ?? 'inc-001', rating: 'good' };
    case 'caseId': return { id: `row-${entry.key}-${customerId}`, caseId: extra.caseId ?? 'case-001', finding: 'test row' };
    case 'caseRef': return { id: `row-${entry.key}-${customerId}`, caseRef: extra.caseId ?? 'case-001', reference: 'test row' };
    case 'routeNotes': return null; // handled as a day object, not a row
    case 'routeOutcomes': return null;
    case 'routeProgress': return null;
    default: throw new Error(`unknown match kind ${entry.match}`);
  }
}

function storesFor(stores, customerId, otherId) {
  const out = {};
  for (const entry of stores) {
    if (entry.match === 'routeNotes') {
      out[entry.key] = { date: '2026-11-09', notes: { [customerId]: 'Shop closed', [otherId]: 'Call later' } };
    } else if (entry.match === 'routeOutcomes') {
      out[entry.key] = { date: '2026-11-09', outcomes: { [customerId]: { outcome: 'not_home' }, [otherId]: { outcome: 'paid' } } };
    } else if (entry.match === 'routeProgress') {
      out[entry.key] = { date: '2026-11-09', collectedIds: [otherId, customerId] };
    } else if (entry.key === 'shahdara_dispute_cases_v1') {
      // The dispute case ids are what the caseId/caseRef stores match
      // on, so the case rows carry the case ids themselves.
      out[entry.key] = [
        { id: 'case-001', customerId, billId: 'bill-001', status: 'open' },
        { id: 'case-002', customerId: otherId, billId: 'bill-002', status: 'open' },
      ];
    } else {
      out[entry.key] = [
        rowFor(entry, customerId, { complaintRef: 'inc-001', caseId: 'case-001' }),
        rowFor(entry, otherId, { complaintRef: 'inc-002', caseId: 'case-002' }),
      ];
    }
  }
  return out;
}

test('Polish #24: header row order is Edit → Delete → + New customer → Archive, all visible above the tabs with no disclosure open', () => {
  const groupAt = index.indexOf('class="profile-action-group"');
  assert.ok(groupAt >= 0, 'action group exists');
  const editAt = index.indexOf('id="editProfileButton"', groupAt);
  const deleteAt = index.indexOf('id="deleteCustomerButton"', groupAt);
  const newAt = index.indexOf('id="profileNewCustomerButton"', groupAt);
  const archiveAt = index.indexOf('id="archiveCustomerButton"', groupAt);
  const detailsAt = index.indexOf('id="profileMoreActionsDetails"', groupAt);
  assert.ok(editAt > groupAt && deleteAt > editAt, 'Edit comes first, Delete second');
  assert.ok(newAt > deleteAt && archiveAt > newAt, '+ New customer third, Archive fourth');
  assert.ok(detailsAt > archiveAt, 'the More actions disclosure still follows the four primary actions');
  // None of the four sits inside a <details>: they are direct children
  // of the action group, visible on every tab without opening anything.
  // The slice ends at the <details tag itself, which opens before its
  // id attribute appears in the markup.
  const detailsTagAt = index.lastIndexOf('<details', detailsAt);
  const groupSlice = index.slice(groupAt, detailsTagAt);
  assert.ok(!groupSlice.includes('<details'), 'no disclosure wraps the four primary actions');
});

test('Polish #24: exactly one Delete button, in the header — the danger zone is gone', () => {
  const matches = index.match(/id="deleteCustomerButton"/g) || [];
  assert.strictEqual(matches.length, 1, 'one Delete control, not two');
  assert.ok(!index.includes('profile-danger-zone'), 'the danger-zone block is gone from index.html');
  assert.ok(!index.includes('profileDangerZoneTitle'), 'the danger-zone title is gone');
  assert.ok(!index.includes('prof_danger_title'), 'the dead prof_danger_title key is gone from the page');
  assert.ok(!index.includes('prof_danger_help'), 'the dead prof_danger_help key is gone from the page');
  assert.ok(!lang.includes('prof_danger_title'), 'prof_danger_title removed from both dictionaries');
  assert.ok(!lang.includes('prof_danger_help'), 'prof_danger_help removed from both dictionaries');
  assert.ok(!app.includes("'.profile-danger-zone'"), 'the Info mount group no longer claims the danger zone');
  assert.ok(!uiFeedbackCss.includes('.profile-danger-zone'), 'the dead danger-zone CSS rules are gone too');
});

test('Polish #24: Record payment stays first inside More actions; no delete on list cards', () => {
  const gridAt = index.indexOf('class="profile-more-actions-grid"');
  const qaAt = index.indexOf('id="customerTechnicalToolsDetails"');
  const recordAt = index.indexOf('id="currentBillPaymentShortcut"', gridAt);
  assert.ok(recordAt > gridAt && recordAt < qaAt, 'Record payment is inside the More actions grid');
  const gridSlice = index.slice(gridAt, qaAt);
  assert.ok(gridSlice.indexOf('id="currentBillPaymentShortcut"') < gridSlice.indexOf('id="advancePaymentButton"'), 'Record payment is still first in the grid');
  // A customer list card is one big tap-to-open button plus card
  // controls — a destructive action on a list row is the wrong place.
  const cardStart = app.indexOf('function customerCardMarkup(');
  assert.ok(cardStart > 0, 'list card builder exists');
  const cardBody = app.slice(cardStart, app.indexOf('\n}\n', cardStart));
  assert.ok(!cardBody.includes('deleteCustomerButton'), 'no delete control on a list card');
  assert.ok(!cardBody.includes('prof_action_delete'), 'no delete label on a list card');
});

test('Polish #24: + New customer opens the add-customer dialog through the same draft-aware opener as the list "+"', () => {
  assert.ok(app.includes('function openAddCustomerDialog()'), 'one shared opener, not two inline openers');
  const openStart = app.indexOf('function openAddCustomerDialog()');
  const openBody = app.slice(openStart, app.indexOf('\n}\n', openStart));
  assert.ok(openBody.includes('customerDraftController?.getDraft()'), 'draft-restore branch is in the shared opener');
  assert.ok(openBody.includes("$('#addCustomerDialog').showModal()"), 'the shared opener shows the dialog');
  assert.ok(openBody.includes("$('#newCustomerName').focus()"), 'the shared opener focuses the name field');
  assert.ok(app.includes("$('#addCustomerButton').addEventListener('click', openAddCustomerDialog)"), 'the list "+" calls the shared opener');
  assert.ok(app.includes("$('#profileNewCustomerButton').addEventListener('click', openAddCustomerDialog)"), 'the profile "+ New customer" calls the same opener');
  assert.ok(lang.includes("prof_action_new_customer: '+ New customer'"), 'English label exists');
  assert.match(lang, /prof_action_new_customer:\s*'\+[^']*[\u0600-\u06FF]/, 'Urdu label carries Urdu script');
});

test('Polish #24: Edit in the header opens the full edit form, and editCustomerProfile still works through the moved button', () => {
  // The button left #customerProfileView, so the render-time query
  // would return null — the wiring lives once in the static block
  // beside the Delete wiring instead.
  assert.ok(!app.includes("$('#customerProfileView').querySelector('#editProfileButton')"), 'no render-time Edit wiring remains');
  const wireAt = app.indexOf("$('#editProfileButton').addEventListener('click'");
  assert.ok(wireAt > 0, 'Edit is wired once in the static block');
  const wireBody = app.slice(wireAt, app.indexOf('\n});', wireAt));
  assert.ok(wireBody.includes('profileEditMode = true'), 'Edit enters edit mode');
  assert.ok(wireBody.includes("$('#customerProfileView').hidden = true"), 'Edit hides the view');
  assert.ok(wireBody.includes("$('#customerProfileForm').hidden = false"), 'Edit shows the form');
  assert.ok(wireBody.includes("$('#mohallaInput').focus()"), 'Edit still focuses the Area field first');
  assert.ok(app.includes("const editBtn = $('#editProfileButton')"), 'editCustomerProfile still finds the moved button globally');
  assert.ok(index.includes('id="editProfileButton"'), 'the Edit button is static HTML now');
  assert.ok(index.includes('id="editProfileButton" class="primary-button profile-action-btn profile-edit-button"'), 'the moved Edit keeps its primary token class and its Edit-specific treatment class');
  assert.ok(!app.includes('id="editProfileButton"'), 'the view heading no longer renders its own Edit button');
});

test('Polish #24: the delete popup asks the exact question with Delete/Cancel and warns of permanent full-history deletion', () => {
  const start = app.indexOf("$('#deleteCustomerButton').addEventListener");
  assert.ok(start > 0, 'delete button handler exists');
  const body = app.slice(start, app.indexOf('\n});', start));
  assert.doesNotMatch(body, /window\.confirm\(/, 'delete must not use window.confirm');
  assert.ok(body.includes("title:`Are you sure you want to delete ${customer.name}'s profile?`"), 'title stays byte-identical with the customer name');
  assert.ok(body.includes("subject:`#${customer.customerNumber}`"), 'subject still carries the customer number');
  assert.ok(body.includes("confirmLabel:'Delete'"), 'confirm button says Delete');
  assert.ok(body.includes("cancelLabel:'Cancel'"), 'cancel button says Cancel');
  assert.ok(!body.includes("confirmLabel:'Yes'"), 'no Yes label remains on the delete popup');
  assert.ok(!body.includes("cancelLabel:'No'"), 'no No label remains on the delete popup');
  assert.ok(body.includes("tone:'danger'"), 'the popup stays danger tone (red Delete button, 🗑 icon, Cancel focused)');
  // The message must warn that the profile AND all its history go.
  assert.match(body, /message:'[^']*permanently[^']*history[^']*'/, 'the message warns the deletion is permanent and takes the history');
  assert.ok(body.includes('bills') && body.includes('payments'), 'the message names bills and payments');
  assert.ok(body.includes("choice !== 'confirm'"), 'Cancel / Esc / ✕ resolves without deleting');
  assert.ok(body.includes('snapshotBeforeDestructiveAction()'), 'the safety snapshot still runs before deleting');
  assert.match(body, /title:`#\$\{customer\.customerNumber\} \$\{customer\.name\} deleted`[^\n]*actionLabel:'Undo'/, 'delete keeps the 5-second Undo window');
});

test('Polish #24: the polish #10 clean-account gate is REMOVED — no refusal before the popup, dues or not', () => {
  // User decision 2026-11-09 (voice note, transcribed): deleting a
  // customer deletes the profile AND its entire history, no matter
  // what payments they made. The gate module stays on disk (the API
  // helper cannot delete files) but nothing calls it any more.
  const start = app.indexOf("$('#deleteCustomerButton').addEventListener");
  const body = app.slice(start, app.indexOf('\n});', start));
  assert.ok(!body.includes('customerDeleteCleanCheck('), 'the handler no longer runs the clean check');
  assert.ok(!body.includes('customerDeleteRefusalText('), 'the handler no longer shows the refusal toast');
  assert.ok(!app.includes("from './customer-delete-clean-check.js"), 'the gate module is no longer imported');
  assert.ok(!body.includes('.archived'), 'Delete stays available on an archived profile (the handler never distinguished archived from active)');
});

test('Polish #24: deleteCustomer removes the customer record AND everything riding it — bills, payments, baqaya, complaints', () => {
  // Enumeration of what rides the record (from addCustomer): the
  // record carries bills (with their payments), manualBaqaya,
  // incidents (complaint tickets), installmentPlans, subContributors,
  // packageHistory, relocationLog, serviceStatusHistory,
  // disconnectHistory, monthlyPriceSchedule, depositOffsets and
  // pauseSkippedMonths. Deleting the record deletes all of it.
  let state = createInitialState();
  state = addCustomer(state, 'Test Customer', REF, { phone: '03012345678' });
  state = addCustomer(state, 'Second Customer', REF, { phone: '03012345679' });
  const doomed = state.customers[0];
  const survivor = state.customers[1];
  const fresh = state.customers[0];
  for (const field of ['bills', 'manualBaqaya', 'incidents', 'installmentPlans', 'subContributors', 'packageHistory', 'relocationLog', 'serviceStatusHistory', 'disconnectHistory', 'monthlyPriceSchedule', 'depositOffsets', 'pauseSkippedMonths']) {
    assert.ok(field in fresh, `a fresh record carries ${field}`);
  }
  state = saveBillMonth(state, doomed.id, { month: '2026-11', dueAmount: 3000, status: 'pending' }, REF);
  state = addPayment(state, doomed.id, '2026-11', { amount: 1600, date: '2026-11-05', method: 'Cash' }, REF);
  state = addManualBaqayaEntry(state, doomed.id, { amount: 500, date: '2026-11-01' }, REF);
  state = addIncident(state, doomed.id, { reportedAt: '2026-11-02T08:00', offlineAt: '2026-11-02T07:30', note: 'Test complaint' }, REF);
  const before = state.customers.find(c => c.id === doomed.id);
  assert.strictEqual(before.bills.length, 1, 'the doomed record has a bill');
  assert.strictEqual(before.bills[0].payments.length, 1, 'the bill has a payment');
  assert.strictEqual(before.manualBaqaya.length, 1, 'the doomed record has a baqaya entry');
  assert.strictEqual(before.incidents.length, 1, 'the doomed record has a complaint ticket');
  const after = deleteCustomer(state, doomed.id);
  assert.strictEqual(after.customers.some(c => c.id === doomed.id), false, 'the customer record is gone');
  assert.strictEqual(after.customers.length, 1, 'only the doomed record is gone');
  assert.strictEqual(after.customers[0].id, survivor.id, 'the second customer survives untouched');
  assert.strictEqual(after.customers[0].bills.length, 0, 'the survivor keeps its own (empty) history');
  // Nothing keyed to the doomed id survives anywhere in the ledger.
  assert.ok(!JSON.stringify(after.customers).includes(doomed.id), 'no trace of the deleted customer remains in the ledger');
});

test('Polish #24: the purge removes every registry store row keyed to the deleted customer and nothing else', async () => {
  const { CUSTOMER_HISTORY_STORES, purgeCustomerHistoryStores, restoreCustomerHistoryStores } = await purgeModule();
  assert.ok(Array.isArray(CUSTOMER_HISTORY_STORES) && CUSTOMER_HISTORY_STORES.length > 0, 'the registry is non-empty');
  const keys = CUSTOMER_HISTORY_STORES.map(entry => entry.key);
  assert.strictEqual(new Set(keys).size, keys.length, 'no store key appears twice in the registry');
  const stores = storesFor(CUSTOMER_HISTORY_STORES, 'cust-001', 'cust-002');
  const original = JSON.parse(JSON.stringify(stores));
  const { stores: purged, removed } = purgeCustomerHistoryStores(stores, { customerId: 'cust-001', complaintRefs: ['inc-001'] });
  // The input is never mutated.
  assert.deepEqual(stores, original, 'purge never mutates its input');
  for (const entry of CUSTOMER_HISTORY_STORES) {
    const kept = purged[entry.key];
    if (entry.match === 'routeNotes') {
      assert.deepEqual(kept.notes, { 'cust-002': 'Call later' }, `${entry.key}: only the deleted customer's note is gone`);
      assert.deepEqual(removed[entry.key], { 'cust-001': 'Shop closed' }, `${entry.key}: the removed bundle holds the deleted note`);
    } else if (entry.match === 'routeOutcomes') {
      assert.deepEqual(kept.outcomes, { 'cust-002': { outcome: 'paid' } }, `${entry.key}: only the deleted customer's outcome is gone`);
      assert.deepEqual(removed[entry.key], { 'cust-001': { outcome: 'not_home' } }, `${entry.key}: the removed bundle holds the deleted outcome`);
    } else if (entry.match === 'routeProgress') {
      assert.deepEqual(kept.collectedIds, ['cust-002'], `${entry.key}: the deleted customer leaves the collected list`);
      assert.deepEqual(removed[entry.key], { index: 1, customerId: 'cust-001' }, `${entry.key}: the removed bundle holds the deleted id with its position`);
    } else {
      assert.strictEqual(Array.isArray(kept), true, `${entry.key}: the store stays an array`);
      assert.strictEqual(kept.length, 1, `${entry.key}: exactly one row survives`);
      assert.ok(JSON.stringify(kept).includes('cust-002'), `${entry.key}: the second customer's row survives`);
      assert.ok(!JSON.stringify(kept).includes('cust-001'), `${entry.key}: no row keyed to the deleted customer survives`);
      assert.ok(!JSON.stringify(kept).includes('inc-001'), `${entry.key}: no row keyed to the deleted customer's complaint survives`);
      assert.ok(!JSON.stringify(kept).includes('case-001'), `${entry.key}: no row keyed to the deleted customer's dispute case survives`);
      assert.strictEqual((removed[entry.key] ?? []).length, 1, `${entry.key}: the removed bundle holds exactly the deleted row`);
      assert.strictEqual(removed[entry.key][0].index, 0, `${entry.key}: the removed row remembers its position for an exact restore`);
      assert.ok(JSON.stringify(removed[entry.key][0].row).includes('cust-001'), `${entry.key}: the removed bundle holds the deleted row itself`);
    }
  }
  // Restore puts everything back, exactly.
  const restored = restoreCustomerHistoryStores(purged, removed);
  assert.deepEqual(restored, original, 'restore returns the stores to their pre-delete shape');
});

test('Polish #24: a store whose value does not match its expected shape is left untouched', async () => {
  const { CUSTOMER_HISTORY_STORES, purgeCustomerHistoryStores } = await purgeModule();
  const first = CUSTOMER_HISTORY_STORES.find(entry => entry.match === 'customerId');
  const stores = { [first.key]: 'not-an-array', 'shahdara_wada_records_v1': { not: 'a list' } };
  const { stores: purged, removed } = purgeCustomerHistoryStores(stores, { customerId: 'cust-001', complaintRefs: [] });
  assert.deepEqual(purged, stores, 'a misshapen store is left exactly as it was');
  assert.deepEqual(removed, {}, 'nothing is reported removed from a misshapen store');
  const empty = purgeCustomerHistoryStores({}, { customerId: '', complaintRefs: [] });
  assert.deepEqual(empty, { stores: {}, removed: {} }, 'an empty customer id purges nothing');
});

test('Polish #24: the storage wrapper purges and restores through localStorage-shaped storage', async () => {
  const { CUSTOMER_HISTORY_STORES, purgeCustomerHistoryFromStorage, restoreCustomerHistoryToStorage } = await purgeModule();
  const backing = new Map();
  const storage = {
    getItem: key => (backing.has(key) ? backing.get(key) : null),
    setItem: (key, value) => { backing.set(key, value); },
  };
  const stores = storesFor(CUSTOMER_HISTORY_STORES, 'cust-001', 'cust-002');
  for (const [key, value] of Object.entries(stores)) storage.setItem(key, JSON.stringify(value));
  const { removed } = purgeCustomerHistoryFromStorage(storage, { customerId: 'cust-001', complaintRefs: ['inc-001'] });
  for (const entry of CUSTOMER_HISTORY_STORES) {
    const kept = JSON.parse(storage.getItem(entry.key));
    assert.ok(!JSON.stringify(kept).includes('cust-001'), `${entry.key}: no deleted-customer row survives in storage`);
    assert.ok(JSON.stringify(kept).includes('cust-002'), `${entry.key}: the second customer's row survives in storage`);
  }
  assert.ok(Object.keys(removed).length > 0, 'the removed bundle is non-empty');
  restoreCustomerHistoryToStorage(storage, removed);
  for (const [key, value] of Object.entries(stores)) {
    assert.deepEqual(JSON.parse(storage.getItem(key)), value, `${key}: restore puts the stored value back exactly`);
  }
  // Unreadable storage never throws and never deletes.
  const broken = { getItem: () => { throw new Error('no storage'); }, setItem: () => { throw new Error('no storage'); } };
  assert.doesNotThrow(() => purgeCustomerHistoryFromStorage(broken, { customerId: 'cust-001', complaintRefs: [] }), 'a broken storage object never throws');
});

test('Polish #24: the undo restores the customer WITH full history (record at its old position plus the purged store rows)', () => {
  const start = app.indexOf("$('#deleteCustomerButton').addEventListener");
  const body = app.slice(start, app.indexOf('\n});', start));
  assert.ok(body.includes('purgeCustomerHistoryFromStorage('), 'the handler purges the separate stores before deleting');
  assert.ok(body.includes('restoreCustomerHistoryToStorage('), 'the Undo restores the purged store rows');
  assert.ok(body.includes('customers.splice(Math.min(index, customers.length), 0, removed)'), 'the Undo restores the record at its old position');
  assert.ok(body.includes('selectCustomer(removed.id)'), 'the Undo re-opens the restored profile');
});

test('Polish #24: no new hex, no new store key, no new element-id prefix', async () => {
  const { CUSTOMER_HISTORY_STORES } = await purgeModule();
  const module = readFileSync(new URL('../customer-history-purge.js', import.meta.url), 'utf8');
  assert.doesNotMatch(module, /#[0-9a-fA-F]{3,6}\b/, 'the new module carries no hex colour');
  // Every registry key already exists somewhere else in the repo —
  // the purge reads and writes existing stores, it creates none.
  const root = new URL('../', import.meta.url);
  const contents = [];
  for (const name of readdirSync(root)) {
    if (!/\.(js|html|css)$/.test(name)) continue;
    if (name === 'customer-history-purge.js') continue;
    contents.push(readFileSync(new URL(name, root), 'utf8'));
  }
  const haystack = contents.join('\n');
  for (const entry of CUSTOMER_HISTORY_STORES) {
    assert.ok(haystack.includes(entry.key), `${entry.key}: the registry key already exists in the codebase`);
  }
  // One new id, in the existing `profile` family — no new prefix.
  assert.ok(index.includes('id="profileNewCustomerButton"'), 'the one new id is profileNewCustomerButton');
  assert.ok(!/id="(nct|p24|del)[A-Z]/.test(index), 'no new element-id prefix is consumed');
});
