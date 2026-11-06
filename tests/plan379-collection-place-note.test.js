// Plan 379 — Transaction collected-by and collection place note.
// One collection note on the transaction (collected by, place: shop or
// field, mohalla where collected), recorded with the payment. The note
// records the collection only and changes no bill, payment total,
// handover, or settlement record by itself. A transaction without one
// shows the customer only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  COLLECTION_PLACE_SHOP,
  COLLECTION_PLACE_FIELD,
  COLLECTION_NOTE_COLLECTED_BY_MAX_LENGTH,
  COLLECTION_NOTE_MOHALLA_MAX_LENGTH,
  isCollectionPlace,
  normalizeCollectionPlace,
  normalizeCollectionNote,
  collectionNoteOf,
  collectionNoteLineText,
  collectionNoteMarkup,
} from '../collection-place-note.js';
import { validatePayment, addPayment, correctPayment, listTransactions } from '../core.js';

const dir = dirname(fileURLToPath(import.meta.url));
const moduleSrc = readFileSync(join(dir, '..', 'collection-place-note.js'), 'utf8');
const coreSrc = readFileSync(join(dir, '..', 'core.js'), 'utf8');
const appSrc = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const quickCollectSrc = readFileSync(join(dir, '..', 'nav-quick-collect.js'), 'utf8');
const indexSrc = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const langSrc = readFileSync(join(dir, '..', 'nav-language.js'), 'utf8');
const stylesSrc = readFileSync(join(dir, '..', 'styles.css'), 'utf8');
const testSrc = readFileSync(fileURLToPath(import.meta.url), 'utf8');

const REF = new Date('2026-10-15T10:00:00Z');

// Generic fixtures only — clearly made-up names, never a real person.
const COLLECTOR_ONE = 'Collector One';
const COLLECTOR_TWO = 'Collector Two';

function bill(month, dueAmount, payments = []) {
  const paid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  return {
    id: `B-${month}`,
    month,
    dueAmount,
    status: paid >= dueAmount ? 'paid' : paid > 0 ? 'partial' : 'pending',
    payments,
  };
}

function paymentWithNote(date, amount, note = {}) {
  return {
    id: `P-${date}`,
    date,
    amount,
    method: 'Cash',
    collectedBy: note.collectedBy ?? COLLECTOR_ONE,
    collectionPlace: note.place ?? 'field',
    collectionMohalla: note.mohalla ?? 'Mohalla A',
  };
}

function customerWithBills(bills, overrides = {}) {
  return {
    id: 'CUST-1',
    customerNumber: 1,
    name: 'Customer One',
    mohalla: 'Mohalla A',
    archived: false,
    monthlySellingAmount: 2500,
    bills,
    ...overrides,
  };
}

function stateWith(customer) {
  return { version: 1, nextCustomerNumber: 2, customers: [customer] };
}

function recordedPayment(state, month = '2026-09') {
  const customer = state.customers.find(c => c.id === 'CUST-1');
  const found = (customer.bills ?? []).find(b => b.month === month);
  return (found.payments ?? [])[0];
}

// ---------------------------------------------------------------------------
// Normalizing the note
// ---------------------------------------------------------------------------

test('normalize: a plain note keeps collector, place, and mohalla', () => {
  assert.deepEqual(
    normalizeCollectionNote({ collectedBy: COLLECTOR_ONE, place: 'field', mohalla: 'Mohalla A' }),
    { collectedBy: COLLECTOR_ONE, place: 'field', mohalla: 'Mohalla A' },
  );
  assert.deepEqual(
    normalizeCollectionNote({ collectedBy: COLLECTOR_TWO, place: 'shop', mohalla: 'Mohalla B' }),
    { collectedBy: COLLECTOR_TWO, place: 'shop', mohalla: 'Mohalla B' },
  );
});

test('normalize: place folds case and surrounding spaces to shop or field', () => {
  assert.equal(normalizeCollectionPlace('SHOP'), 'shop');
  assert.equal(normalizeCollectionPlace(' Field '), 'field');
  assert.equal(normalizeCollectionPlace('Shop'), 'shop');
  assert.equal(isCollectionPlace('FIELD'), true);
  assert.equal(isCollectionPlace('shop'), true);
  assert.equal(isCollectionPlace(''), false);
  assert.equal(isCollectionPlace(null), false);
});

test('normalize: an unknown place is dropped, never stored raw', () => {
  assert.deepEqual(
    normalizeCollectionNote({ collectedBy: COLLECTOR_ONE, place: 'office', mohalla: 'Mohalla A' }),
    { collectedBy: COLLECTOR_ONE, mohalla: 'Mohalla A' },
  );
  assert.deepEqual(
    normalizeCollectionNote({ collectedBy: COLLECTOR_ONE, place: 'doorstep', mohalla: '' }),
    { collectedBy: COLLECTOR_ONE },
  );
  assert.equal(normalizeCollectionPlace('counter'), '');
  assert.equal(normalizeCollectionPlace('home'), '');
});

test('normalize: line breaks fold to spaces, blanks are dropped', () => {
  assert.deepEqual(
    normalizeCollectionNote({ collectedBy: 'Collector\nOne', place: 'field', mohalla: 'Mohalla\r\nA' }),
    { collectedBy: 'Collector One', place: 'field', mohalla: 'Mohalla A' },
  );
  assert.deepEqual(
    normalizeCollectionNote({ collectedBy: '   ', place: '  ', mohalla: '' }),
    null,
  );
});

test('normalize: nothing at all is not a note', () => {
  assert.equal(normalizeCollectionNote({}), null);
  assert.equal(normalizeCollectionNote({ collectedBy: '', place: '', mohalla: '' }), null);
  assert.equal(normalizeCollectionNote(null), null);
  assert.equal(normalizeCollectionNote(undefined), null);
  assert.equal(normalizeCollectionNote('field'), null);
  assert.equal(normalizeCollectionNote(42), null);
});

test('normalize: collector caps at 100 chars, mohalla caps at 60', () => {
  assert.equal(COLLECTION_NOTE_COLLECTED_BY_MAX_LENGTH, 100);
  assert.equal(COLLECTION_NOTE_MOHALLA_MAX_LENGTH, 60);
  const note = normalizeCollectionNote({
    collectedBy: 'C'.repeat(140),
    place: 'shop',
    mohalla: 'M'.repeat(90),
  });
  assert.equal(note.collectedBy.length, 100);
  assert.equal(note.mohalla.length, 60);
  assert.equal(note.place, 'shop');
});

test('normalize: the input is never mutated', () => {
  const raw = { collectedBy: COLLECTOR_ONE, place: 'FIELD', mohalla: 'Mohalla A' };
  normalizeCollectionNote(raw);
  assert.deepEqual(raw, { collectedBy: COLLECTOR_ONE, place: 'FIELD', mohalla: 'Mohalla A' });
});

// ---------------------------------------------------------------------------
// Reading the note off a payment record
// ---------------------------------------------------------------------------

test('collectionNoteOf: reads the three fields the validator keeps', () => {
  assert.deepEqual(
    collectionNoteOf(paymentWithNote('2026-10-06', 1500)),
    { collectedBy: COLLECTOR_ONE, place: 'field', mohalla: 'Mohalla A' },
  );
});

test('collectionNoteOf: a payment without a note reads as null', () => {
  assert.equal(collectionNoteOf({ id: 'P-1', date: '2026-10-06', amount: 1500, method: 'Cash' }), null);
  assert.equal(collectionNoteOf({ id: 'P-1', date: '2026-10-06', amount: 1500, method: 'Cash', collectedBy: ' ', collectionPlace: 'office', collectionMohalla: '' }), null);
  assert.equal(collectionNoteOf(null), null);
  assert.equal(collectionNoteOf(undefined), null);
});

// ---------------------------------------------------------------------------
// The note in plain words
// ---------------------------------------------------------------------------

test('line text: collector, place, and mohalla joined in plain words', () => {
  assert.equal(
    collectionNoteLineText({ collectedBy: COLLECTOR_ONE, place: 'field', mohalla: 'Mohalla A' }),
    'Collected by Collector One · Field · Mohalla A',
  );
  assert.equal(
    collectionNoteLineText({ collectedBy: COLLECTOR_TWO, place: 'shop', mohalla: 'Mohalla B' }),
    'Collected by Collector Two · Shop · Mohalla B',
  );
});

test('line text: each part shows only when given', () => {
  assert.equal(collectionNoteLineText({ collectedBy: COLLECTOR_ONE }), 'Collected by Collector One');
  assert.equal(collectionNoteLineText({ place: 'shop' }), 'Shop');
  assert.equal(collectionNoteLineText({ mohalla: 'Mohalla A' }), 'Mohalla A');
  assert.equal(collectionNoteLineText({ collectedBy: COLLECTOR_ONE, place: 'shop' }), 'Collected by Collector One · Shop');
  assert.equal(collectionNoteLineText({ place: 'field', mohalla: 'Mohalla A' }), 'Field · Mohalla A');
});

test('line text: no note, no words', () => {
  assert.equal(collectionNoteLineText(null), '');
  assert.equal(collectionNoteLineText({}), '');
  assert.equal(collectionNoteLineText({ collectedBy: '', place: 'office', mohalla: '' }), '');
});

test('line text: caller-supplied labels are used', () => {
  assert.equal(
    collectionNoteLineText(
      { collectedBy: COLLECTOR_ONE, place: 'shop', mohalla: 'Mohalla A' },
      { collectedBy: 'By {name}', shop: 'At the shop', field: 'At the door' },
    ),
    'By Collector One · At the shop · Mohalla A',
  );
  assert.equal(
    collectionNoteLineText({ place: 'field' }, { collectedBy: 'By {name}', shop: 'At the shop', field: 'At the door' }),
    'At the door',
  );
});

test('markup: a note reads as a dot suffix; no note reads as nothing', () => {
  assert.equal(
    collectionNoteMarkup(paymentWithNote('2026-10-06', 1500)),
    ' · Collected by Collector One · Field · Mohalla A',
  );
  assert.equal(
    collectionNoteMarkup({ id: 'P-1', date: '2026-10-06', amount: 1500, method: 'Cash' }),
    '',
  );
  assert.equal(collectionNoteMarkup(null), '');
});

test('markup: collector name and mohalla are always escaped', () => {
  const markup = collectionNoteMarkup({
    id: 'P-1',
    date: '2026-10-06',
    amount: 1500,
    method: 'Cash',
    collectedBy: '<b>Collector</b>',
    collectionPlace: 'shop',
    collectionMohalla: 'Mohalla & Sons',
  });
  assert.ok(!markup.includes('<b>'), 'markup must be escaped');
  assert.ok(markup.includes('&lt;b&gt;Collector&lt;/b&gt;'), 'escaped collector name');
  assert.ok(markup.includes('Mohalla &amp; Sons'), 'escaped mohalla');
  assert.ok(markup.includes('Shop'), 'place still shown');
});

test('exports: the two place constants are shop and field', () => {
  assert.equal(COLLECTION_PLACE_SHOP, 'shop');
  assert.equal(COLLECTION_PLACE_FIELD, 'field');
});

// ---------------------------------------------------------------------------
// The payment record carries the note (core.js)
// ---------------------------------------------------------------------------

test('validatePayment: keeps the three note fields when given', () => {
  const kept = validatePayment({
    id: 'P-1',
    date: '2026-10-06',
    amount: 1500,
    method: 'Cash',
    collectedBy: COLLECTOR_ONE,
    collectionPlace: 'FIELD',
    collectionMohalla: 'Mohalla A',
  });
  assert.equal(kept.collectedBy, COLLECTOR_ONE);
  assert.equal(kept.collectionPlace, 'field');
  assert.equal(kept.collectionMohalla, 'Mohalla A');
  assert.equal(kept.amount, 1500);
});

test('validatePayment: a payment without a note carries no note fields', () => {
  const kept = validatePayment({ id: 'P-1', date: '2026-10-06', amount: 1500, method: 'Cash' });
  assert.equal('collectedBy' in kept, false);
  assert.equal('collectionPlace' in kept, false);
  assert.equal('collectionMohalla' in kept, false);
  assert.equal(kept.amount, 1500);
});

test('validatePayment: an unknown place is dropped; over-long fields are refused', () => {
  const dropped = validatePayment({
    id: 'P-1',
    date: '2026-10-06',
    amount: 1500,
    method: 'Cash',
    collectedBy: COLLECTOR_ONE,
    collectionPlace: 'office',
    collectionMohalla: 'Mohalla A',
  });
  assert.equal('collectionPlace' in dropped, false);
  assert.equal(dropped.collectedBy, COLLECTOR_ONE);
  assert.throws(() => validatePayment({
    id: 'P-1', date: '2026-10-06', amount: 1500, method: 'Cash',
    collectedBy: 'C'.repeat(101),
  }), /100 characters or fewer/);
  assert.throws(() => validatePayment({
    id: 'P-1', date: '2026-10-06', amount: 1500, method: 'Cash',
    collectionMohalla: 'M'.repeat(61),
  }), /60 characters or fewer/);
});

test('addPayment: the note is recorded with the payment', () => {
  const state = stateWith(customerWithBills([bill('2026-09', 3000)]));
  const next = addPayment(state, 'CUST-1', '2026-09', {
    date: '2026-10-06',
    amount: 1500,
    method: 'Cash',
    collectedBy: COLLECTOR_ONE,
    collectionPlace: 'field',
    collectionMohalla: 'Mohalla A',
  }, REF);
  const recorded = recordedPayment(next);
  assert.equal(recorded.collectedBy, COLLECTOR_ONE);
  assert.equal(recorded.collectionPlace, 'field');
  assert.equal(recorded.collectionMohalla, 'Mohalla A');
  assert.equal(recorded.amount, 1500);
});

test('addPayment: a payment without a note records no note fields', () => {
  const state = stateWith(customerWithBills([bill('2026-09', 3000)]));
  const next = addPayment(state, 'CUST-1', '2026-09', {
    date: '2026-10-06',
    amount: 1500,
    method: 'Cash',
  }, REF);
  const recorded = recordedPayment(next);
  assert.equal('collectedBy' in recorded, false);
  assert.equal('collectionPlace' in recorded, false);
  assert.equal('collectionMohalla' in recorded, false);
});

test('correctPayment: a correction that says nothing about the note keeps it', () => {
  let state = stateWith(customerWithBills([bill('2026-09', 3000)]));
  state = addPayment(state, 'CUST-1', '2026-09', {
    date: '2026-10-06',
    amount: 1500,
    method: 'Cash',
    collectedBy: COLLECTOR_ONE,
    collectionPlace: 'field',
    collectionMohalla: 'Mohalla A',
  }, REF);
  const id = recordedPayment(state).id;
  const next = correctPayment(state, 'CUST-1', '2026-09', id, {
    date: '2026-10-07',
    amount: 1500,
    method: 'Cash',
  }, REF);
  const corrected = recordedPayment(next);
  assert.equal(corrected.collectedBy, COLLECTOR_ONE);
  assert.equal(corrected.collectionPlace, 'field');
  assert.equal(corrected.collectionMohalla, 'Mohalla A');
  assert.equal(corrected.date, '2026-10-07');
});

test('correctPayment: a correction that supplies the note replaces it', () => {
  let state = stateWith(customerWithBills([bill('2026-09', 3000)]));
  state = addPayment(state, 'CUST-1', '2026-09', {
    date: '2026-10-06',
    amount: 1500,
    method: 'Cash',
    collectedBy: COLLECTOR_ONE,
    collectionPlace: 'field',
    collectionMohalla: 'Mohalla A',
  }, REF);
  const id = recordedPayment(state).id;
  const next = correctPayment(state, 'CUST-1', '2026-09', id, {
    date: '2026-10-06',
    amount: 1500,
    method: 'Cash',
    collectedBy: COLLECTOR_TWO,
    collectionPlace: 'shop',
    collectionMohalla: 'Mohalla B',
  }, REF);
  const corrected = recordedPayment(next);
  assert.equal(corrected.collectedBy, COLLECTOR_TWO);
  assert.equal(corrected.collectionPlace, 'shop');
  assert.equal(corrected.collectionMohalla, 'Mohalla B');
});

test('correctPayment: a correction that clears the note clears it', () => {
  let state = stateWith(customerWithBills([bill('2026-09', 3000)]));
  state = addPayment(state, 'CUST-1', '2026-09', {
    date: '2026-10-06',
    amount: 1500,
    method: 'Cash',
    collectedBy: COLLECTOR_ONE,
    collectionPlace: 'field',
    collectionMohalla: 'Mohalla A',
  }, REF);
  const id = recordedPayment(state).id;
  const next = correctPayment(state, 'CUST-1', '2026-09', id, {
    date: '2026-10-06',
    amount: 1500,
    method: 'Cash',
    collectedBy: '',
    collectionPlace: '',
    collectionMohalla: '',
  }, REF);
  const corrected = recordedPayment(next);
  assert.equal('collectedBy' in corrected, false);
  assert.equal('collectionPlace' in corrected, false);
  assert.equal('collectionMohalla' in corrected, false);
});

test('listTransactions: the note rides the transaction row', () => {
  let state = stateWith(customerWithBills([bill('2026-09', 3000)]));
  state = addPayment(state, 'CUST-1', '2026-09', {
    date: '2026-10-06',
    amount: 1500,
    method: 'Cash',
    collectedBy: COLLECTOR_ONE,
    collectionPlace: 'field',
    collectionMohalla: 'Mohalla A',
  }, REF);
  const rows = listTransactions(state, {}, REF);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].collectedBy, COLLECTOR_ONE);
  assert.equal(rows[0].collectionPlace, 'field');
  assert.equal(rows[0].collectionMohalla, 'Mohalla A');
});

test('listTransactions: a row without a note carries empty note fields', () => {
  let state = stateWith(customerWithBills([bill('2026-09', 3000)]));
  state = addPayment(state, 'CUST-1', '2026-09', {
    date: '2026-10-06',
    amount: 1500,
    method: 'Cash',
  }, REF);
  const rows = listTransactions(state, {}, REF);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].collectedBy, '');
  assert.equal(rows[0].collectionPlace, '');
  assert.equal(rows[0].collectionMohalla, '');
});

// ---------------------------------------------------------------------------
// Wiring — the transaction entry form records the note
// ---------------------------------------------------------------------------

test('wiring: Quick Collect records the note with the payment', async () => {
  const { executeQuickCollection } = await import('../nav-quick-collect.js');
  const state = stateWith(customerWithBills([bill('2026-09', 3000)]));
  const { nextState } = executeQuickCollection(state, {
    customerId: 'CUST-1',
    month: '2026-09',
    amount: 1500,
    date: '2026-10-06',
    method: 'Cash',
    collectedBy: COLLECTOR_ONE,
    collectionPlace: 'field',
    collectionMohalla: 'Mohalla A',
  });
  const recorded = recordedPayment(nextState);
  assert.equal(recorded.collectedBy, COLLECTOR_ONE);
  assert.equal(recorded.collectionPlace, 'field');
  assert.equal(recorded.collectionMohalla, 'Mohalla A');
  assert.equal(recorded.amount, 1500);
});

test('wiring: Quick Collect without a note records no note fields', async () => {
  const { executeQuickCollection } = await import('../nav-quick-collect.js');
  const state = stateWith(customerWithBills([bill('2026-09', 3000)]));
  const { nextState } = executeQuickCollection(state, {
    customerId: 'CUST-1',
    month: '2026-09',
    amount: 1500,
    date: '2026-10-06',
    method: 'Cash',
  });
  const recorded = recordedPayment(nextState);
  assert.equal('collectedBy' in recorded, false);
  assert.equal('collectionPlace' in recorded, false);
  assert.equal('collectionMohalla' in recorded, false);
});

test('wiring: the entry form carries the three fields and passes them on', () => {
  assert.ok(indexSrc.includes('id="quickCollectCollectedByInput"'), 'quick collect collector input');
  assert.ok(indexSrc.includes('id="quickCollectCollectionPlaceSelect"'), 'quick collect place select');
  assert.ok(indexSrc.includes('id="quickCollectCollectionMohallaInput"'), 'quick collect mohalla input');
  assert.ok(quickCollectSrc.includes('quickCollectCollectedByInput'), 'quick collect reads the collector input');
  assert.ok(quickCollectSrc.includes('quickCollectCollectionPlaceSelect'), 'quick collect reads the place select');
  assert.ok(quickCollectSrc.includes('quickCollectCollectionMohallaInput'), 'quick collect reads the mohalla input');
  assert.ok(quickCollectSrc.includes('collectedBy:'), 'quick collect passes the collector on');
  assert.ok(quickCollectSrc.includes('collectionPlace:'), 'quick collect passes the place on');
  assert.ok(quickCollectSrc.includes('collectionMohalla:'), 'quick collect passes the mohalla on');
  assert.ok(quickCollectSrc.includes("from './collection-place-note.js'"), 'quick collect imports the module');
  assert.ok(appSrc.includes("from './collection-place-note.js'"), 'app imports the module');
  assert.ok(appSrc.includes('collectionNoteMarkup('), 'app shows the note on the transaction');
  assert.ok(appSrc.includes('profilePaymentCollectionMarkup('), 'profile history shows the note');
  assert.ok(appSrc.includes("name=\"collectedBy\""), 'profile payment form carries the collector field');
  assert.ok(appSrc.includes("name=\"collectionPlace\""), 'profile payment form carries the place field');
  assert.ok(appSrc.includes("name=\"collectionMohalla\""), 'profile payment form carries the mohalla field');
  assert.ok(appSrc.includes('data.get(\'collectedBy\')'), 'profile payment submit reads the collector');
  assert.ok(appSrc.includes('data.get(\'collectionPlace\')'), 'profile payment submit reads the place');
  assert.ok(appSrc.includes('data.get(\'collectionMohalla\')'), 'profile payment submit reads the mohalla');
  assert.ok(appSrc.includes('collectionPlaceNoteFieldsMarkup'), 'edit form carries the note fields');
});

test('wiring: the labels exist in both language tables', () => {
  for (const key of [
    'prof_cpl_collected_by_label',
    'prof_cpl_collected_by_ph',
    'prof_cpl_place_label',
    'prof_cpl_place_shop',
    'prof_cpl_place_field',
    'prof_cpl_mohalla_label',
    'prof_cpl_mohalla_ph',
    'prof_cpl_hist_collected_by',
    'prof_cpl_hist_place_shop',
    'prof_cpl_hist_place_field',
  ]) {
    assert.ok(langSrc.includes(`${key}:`), `language key ${key} present`);
  }
  assert.ok(langSrc.includes('prof_cpl_collected_by_label:'), 'collector label key');
  assert.ok(!stylesSrc.includes('collection-place-note'), 'no styles change for this plan');
});

// ---------------------------------------------------------------------------
// Guards — purity, fences, no real names
// ---------------------------------------------------------------------------

test('guard: the module is pure — no store, no DOM, no clock, no network', () => {
  assert.ok(!moduleSrc.includes('shahdara_'), 'no store key');
  assert.ok(!moduleSrc.includes('localStorage'), 'no storage');
  assert.ok(!moduleSrc.includes('document.'), 'no document access');
  assert.ok(!moduleSrc.includes('window.'), 'no window access');
  assert.ok(!moduleSrc.includes('new Date('), 'no clock read');
  assert.ok(!moduleSrc.includes('Date.now('), 'no clock read');
  assert.ok(!moduleSrc.includes('fetch('), 'no network');
  assert.ok(!moduleSrc.includes('import '), 'no imports — pure module');
  assert.ok(!/\bOLT\b/.test(moduleSrc), 'no standalone OLT word');
});

test('guard: the module never names a fenced neighbour module', () => {
  // Neighbour modules are checked by filename only and left untouched:
  // the field handover note, the staff handover note, the collector /
  // partner / shop settlement modules, and the batch collection
  // helpers. This plan records the collection only and must not
  // re-implement any of them. Filenames are built from fragments so
  // this very test never contains them literally either.
  const fenced = [
    'hand' + 'over.js',
    'staff-hand' + 'over.js',
    'absence-hand' + 'over-checklist.js',
    'collector-settle' + 'ments.js',
    'partner-settle' + 'ment.js',
    'shop-settle' + 'ment.js',
    'bulk-coll' + 'ect.js',
    'campaign-plan' + 'ner.js',
  ];
  for (const name of fenced) {
    assert.ok(!moduleSrc.includes(name), `module must not name ${name}`);
    assert.ok(!testSrc.includes(name), `test must not name ${name}`);
  }
});

test('guard: no real person or customer name anywhere in this file', () => {
  // Names are built from fragments so the list itself never contains
  // one literally.
  const forbidden = [
    'Sa' + 'ad',
    'Ki' + 'ran',
    'Hai' + 'der',
    'Shu' + 'naid',
    'Kha' + 'zer',
    'Mo' + 'hsin',
    'Shar' + 'jell',
    'No' + 'mi',
    'Aq' + 'ib',
    'Ej' + 'az',
  ];
  for (const name of forbidden) {
    assert.ok(!testSrc.includes(name), `test must not name ${name}`);
    assert.ok(!moduleSrc.includes(name), `module must not name ${name}`);
  }
});
