// SISP-198: Daily Cash Closing note denomination counter (5000 / 1000 /
// 500 / 100 / 50). Pure-core pins (multiplication sum, discrepancy =
// Counted − Expected, junk handling), an end-to-end close through the
// real buildRoznamchaDay / closeRoznamchaDay path, a mock-DOM run of the
// real setupRoznamchaModal wiring (counted-box fill, last-edit-wins,
// closed-day shape unchanged, session-only counts), plus markup, CSS
// and i18n audits. Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  PKR_COUNT_DENOMINATIONS,
  sanitizePkrNoteCount,
  countPkrNotesTotal,
  noteCountDiscrepancy
} from '../pkr-notes.js';
import {
  ROZNAMCHA_KEY,
  addRoznamchaOutflow,
  buildRoznamchaDay,
  closeRoznamchaDay,
  loadRoznamchaDays,
  saveRoznamchaDays,
  setupRoznamchaModal
} from '../roznamcha.js';
import { TRANSLATIONS, t } from '../nav-language.js';

const DAY = '2026-10-28';
// The exact key set a closed day has stored since SISP-11 — the counter
// must not add a single key to it.
const CLOSED_DAY_KEYS = [
  'cashIn', 'cashPayments', 'closed', 'closedAt', 'closingBalance',
  'countedCash', 'date', 'discrepancy', 'expectedClosing', 'handovers',
  'openingBalance', 'outflows', 'shopIn'
];

function stateWithCash6000() {
  return {
    customers: [
      { name: 'A', customerNumber: 'C-A', bills: [{ month: '2026-10', payments: [{ date: DAY, method: 'Cash', amount: 4000 }] }] },
      { name: 'B', customerNumber: 'C-B', bills: [{ month: '2026-10', payments: [{ date: DAY, method: 'Cash', amount: 2000 }] }] }
    ]
  };
}

function daysWithPetrol500() {
  return addRoznamchaOutflow([], DAY, { category: 'Petrol / Bike Fuel', amount: 500, lineman: 'Test', note: '' });
}

function fakeStorage() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); }
  };
}

test('denominations are exactly the spec five, in order', () => {
  assert.deepEqual([...PKR_COUNT_DENOMINATIONS], [5000, 1000, 500, 100, 50]);
});

test('multiplication sum: 2x5000 + 3x1000 + 1x500 + 4x100 + 2x50 = 14,000', () => {
  assert.equal(countPkrNotesTotal({ 5000: 2, 1000: 3, 500: 1, 100: 4, 50: 2 }), 14000);
  assert.equal(countPkrNotesTotal({}), 0);
  assert.equal(countPkrNotesTotal({ 5000: 1 }), 5000);
});

test('junk counts are clamped at the seam — total is never fractional or negative', () => {
  assert.equal(sanitizePkrNoteCount('abc'), 0);
  assert.equal(sanitizePkrNoteCount(-3), 0);
  assert.equal(sanitizePkrNoteCount(2.9), 2);
  assert.equal(sanitizePkrNoteCount('4'), 4);
  assert.equal(sanitizePkrNoteCount(null), 0);
  assert.equal(sanitizePkrNoteCount(undefined), 0);
  assert.equal(sanitizePkrNoteCount(NaN), 0);
  assert.equal(sanitizePkrNoteCount(Infinity), 0);
  // 5000 x -2 -> 0, 1000 x 'abc' -> 0, 500 x 2.5 -> 2 notes = 1000, 100 x 1 = 100.
  const total = countPkrNotesTotal({ 5000: -2, 1000: 'abc', 500: 2.5, 100: 1 });
  assert.equal(total, 1100);
  assert.ok(Number.isInteger(total) && total >= 0);
  assert.equal(countPkrNotesTotal(null), 0);
  assert.equal(countPkrNotesTotal('junk'), 0);
  // Smaller notes are NOT part of the counter — Rs 20 / 10 keys count nothing.
  assert.equal(countPkrNotesTotal({ 20: 5, 10: 5 }), 0);
});

test('discrepancy = Counted - Expected: SHORT negative, EXTRA positive, tally zero', () => {
  assert.equal(noteCountDiscrepancy(5000, 5500), -500);
  assert.equal(noteCountDiscrepancy(6000, 5500), 500);
  assert.equal(noteCountDiscrepancy(5500, 5500), 0);
  assert.equal(noteCountDiscrepancy(0, 5500), -5500);
});

test('end-to-end: note totals close the day against the real buildRoznamchaDay expected figure', () => {
  const state = stateWithCash6000();
  const days = daysWithPetrol500();
  const view = buildRoznamchaDay(state, days, DAY, []);
  assert.equal(view.expectedClosing, 5500);

  const short = closeRoznamchaDay(days, view, countPkrNotesTotal({ 5000: 1 }))
    .find((d) => d.date === DAY);
  assert.equal(short.countedCash, 5000);
  assert.equal(short.discrepancy, -500);

  const tally = closeRoznamchaDay(days, view, countPkrNotesTotal({ 5000: 1, 500: 1 }))
    .find((d) => d.date === DAY);
  assert.equal(tally.countedCash, 5500);
  assert.equal(tally.discrepancy, 0);

  const extra = closeRoznamchaDay(days, view, countPkrNotesTotal({ 5000: 1, 1000: 1 }))
    .find((d) => d.date === DAY);
  assert.equal(extra.countedCash, 6000);
  assert.equal(extra.discrepancy, 500);
});

test('closed-day record shape is unchanged and carries no note data', () => {
  const state = stateWithCash6000();
  const days = daysWithPetrol500();
  const view = buildRoznamchaDay(state, days, DAY, []);
  const storage = fakeStorage();
  saveRoznamchaDays(closeRoznamchaDay(days, view, countPkrNotesTotal({ 5000: 1, 500: 1 })), storage);
  const raw = storage.getItem(ROZNAMCHA_KEY);
  assert.ok(!/noteCount|denomination/i.test(raw), 'no note/denomination keys persisted');
  const [stored] = loadRoznamchaDays(storage);
  assert.deepEqual(Object.keys(stored).sort(), CLOSED_DAY_KEYS);
  assert.equal(stored.countedCash, 5500);
  assert.equal(stored.discrepancy, 0);
});

// --- Mock-DOM wiring run of the real modal controller -----------------

class FakeEl {
  constructor(id) {
    this.id = id;
    this.value = '';
    this.textContent = '';
    this.innerHTML = '';
    this.hidden = false;
    this.open = false;
    this.attributes = new Map();
    this.listeners = new Map();
  }

  setAttribute(name, value) { this.attributes.set(name, String(value)); }

  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }

  async dispatch(type) {
    for (const handler of this.listeners.get(type) || []) await handler({ preventDefault() {} });
  }

  querySelectorAll() { return []; }

  showModal() { this.open = true; }

  close() { this.open = false; }
}

const STATIC_IDS = [
  'roznamchaDate', 'roznamchaSummaryLine', 'roznamchaInflows', 'roznamchaOutflows',
  'roznamchaExpectedLine', 'roznamchaCloseBlock', 'roznamchaReopenBlock',
  'roznamchaOutflowForm', 'roznamchaOutCategory', 'roznamchaOutAmount',
  'roznamchaOutLineman', 'roznamchaOutNote', 'roznamchaAddOutflowBtn',
  'roznamchaCountedCash', 'roznamchaCloseDayBtn', 'roznamchaReopenBtn',
  'roznamchaCopySummaryBtn', 'roznamchaCloseBtn', 'roznamchaNoteCounter',
  'roznamchaNoteToggle', 'roznamchaNoteBody', 'roznamchaNoteHelp',
  'roznamchaNoteTotalLine', 'roznamchaNoteFarqLine', 'openRoznamchaModalBtn'
];

test('modal wiring: counter fills the counted box, last edit wins, close stores only the total', async () => {
  const storage = fakeStorage();
  saveRoznamchaDays(daysWithPetrol500(), storage);
  const state = stateWithCash6000();

  const registry = new Map();
  for (const id of STATIC_IDS) registry.set(id, new FakeEl(id));
  for (const d of PKR_COUNT_DENOMINATIONS) {
    registry.set(`roznamchaNoteCount${d}`, new FakeEl(`roznamchaNoteCount${d}`));
    registry.set(`roznamchaNoteLabel${d}`, new FakeEl(`roznamchaNoteLabel${d}`));
  }
  const dialog = new FakeEl('roznamchaModal');
  dialog.querySelector = (sel) => (typeof sel === 'string' && sel.startsWith('#')
    ? registry.get(sel.slice(1)) || null
    : null);
  registry.get('roznamchaNoteBody').hidden = true; // matches the shipped markup

  const prevDocument = globalThis.document;
  const prevStorage = globalThis.localStorage;
  globalThis.document = {
    getElementById: (id) => (id === 'roznamchaModal' ? dialog : registry.get(id) || null)
  };
  globalThis.localStorage = storage;
  try {
    const controller = setupRoznamchaModal(() => state, { onToast: () => {}, onChanged: () => {} });
    assert.ok(controller, 'controller created');
    const el = (id) => registry.get(id);
    const counted = el('roznamchaCountedCash');

    controller.open({ date: DAY });
    // Collapsed by default; zero counts -> counted 0, farq = -Expected shown honestly.
    assert.equal(el('roznamchaCloseBlock').hidden, false);
    assert.equal(el('roznamchaNoteBody').hidden, true);
    assert.match(el('roznamchaNoteTotalLine').textContent, /PKR 0/);
    assert.match(el('roznamchaNoteFarqLine').textContent, /SHORT/);
    assert.match(el('roznamchaNoteFarqLine').textContent, /5,500/);

    // Expand; counts type in, filling the counted box.
    await el('roznamchaNoteToggle').dispatch('click');
    assert.equal(el('roznamchaNoteBody').hidden, false);
    assert.equal(el('roznamchaNoteToggle').getAttribute('aria-expanded'), 'true');
    el('roznamchaNoteCount5000').value = '1';
    await el('roznamchaNoteCount5000').dispatch('input');
    assert.equal(counted.value, '5000');
    assert.match(el('roznamchaNoteTotalLine').textContent, /5,000/);
    assert.match(el('roznamchaNoteFarqLine').textContent, /SHORT/);
    el('roznamchaNoteCount500').value = '1';
    await el('roznamchaNoteCount500').dispatch('input');
    assert.equal(counted.value, '5500');
    assert.match(el('roznamchaNoteFarqLine').textContent, /barabar/);

    // Counts survive collapse/expand and re-renders.
    await el('roznamchaNoteToggle').dispatch('click');
    assert.equal(el('roznamchaNoteBody').hidden, true);
    await el('roznamchaNoteToggle').dispatch('click');
    assert.equal(el('roznamchaNoteCount5000').value, '1');
    controller.refresh();
    assert.equal(counted.value, '5500');

    // Manual typing wins (last edit wins) and survives a re-render.
    counted.value = '5600';
    await counted.dispatch('input');
    controller.refresh();
    assert.equal(counted.value, '5600');
    assert.match(el('roznamchaNoteFarqLine').textContent, /EXTRA/);

    // Editing a count again makes the notes total win again.
    el('roznamchaNoteCount1000').value = '1';
    await el('roznamchaNoteCount1000').dispatch('input');
    assert.equal(counted.value, '6500');
    el('roznamchaNoteCount1000').value = '';
    await el('roznamchaNoteCount1000').dispatch('input');
    assert.equal(counted.value, '5500');

    // Close the day: the stored record is exactly the pre-SISP-198 shape.
    await el('roznamchaCloseDayBtn').dispatch('click');
    const raw = storage.getItem(ROZNAMCHA_KEY);
    assert.ok(!/noteCount|denomination/i.test(raw), 'counts are session-only');
    const [stored] = loadRoznamchaDays(storage);
    assert.deepEqual(Object.keys(stored).sort(), CLOSED_DAY_KEYS);
    assert.equal(stored.countedCash, 5500);
    assert.equal(stored.discrepancy, 0);

    // Closed view: the close block (and with it the counter) is hidden,
    // and the strip was reset.
    assert.equal(el('roznamchaCloseBlock').hidden, true);
    assert.equal(el('roznamchaNoteCount5000').value, '');
    assert.equal(el('roznamchaNoteBody').hidden, true);
  } finally {
    if (prevDocument === undefined) delete globalThis.document; else globalThis.document = prevDocument;
    if (prevStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = prevStorage;
  }
});

// --- Markup / CSS / i18n audits ---------------------------------------

test('markup: strip sits inside the close block, after the counted box, collapsed', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const modalStart = html.indexOf('id="roznamchaModal"');
  assert.ok(modalStart >= 0);
  const modal = html.slice(modalStart, modalStart + 20000);
  const countedAt = modal.indexOf('id="roznamchaCountedCash"');
  const stripAt = modal.indexOf('id="roznamchaNoteCounter"');
  const closeBtnAt = modal.indexOf('id="roznamchaCloseDayBtn"');
  const closeBlockAt = modal.indexOf('id="roznamchaCloseBlock"');
  assert.ok(closeBlockAt >= 0 && countedAt > closeBlockAt, 'counted box inside close block');
  assert.ok(stripAt > countedAt, 'strip after the counted box');
  assert.ok(closeBtnAt > stripAt, 'strip before the close button');
  assert.match(modal, /id="roznamchaNoteBody" class="roznamcha-note-body" hidden/);
  assert.match(modal, /id="roznamchaNoteToggle"[^>]*aria-expanded="false"/);
  for (const d of [5000, 1000, 500, 100, 50]) {
    assert.ok(modal.includes(`id="roznamchaNoteCount${d}"`), `count input for ${d}`);
    assert.ok(modal.includes(`data-note-denomination="${d}"`), `denomination marker for ${d}`);
  }
  assert.ok(!modal.includes('data-note-denomination="20"'), 'no Rs 20 row');
  assert.ok(!modal.includes('data-note-denomination="10"'), 'no Rs 10 row');
});

test('css: note counter styles are token-only and the hidden rule survives display:flex', () => {
  const css = readFileSync(new URL('../components.css', import.meta.url), 'utf8');
  const start = css.indexOf('SISP-198');
  assert.ok(start >= 0, 'SISP-198 css block present');
  const block = css.slice(start, start + 1600).replace(/\/\*[\s\S]*?\*\//g, '');
  assert.deepEqual(block.match(/#[0-9a-fA-F]{3,8}\b/g) || [], []);
  assert.match(block, /\.roznamcha-note-body\[hidden\]\s*\{\s*display: none;/);
  assert.ok(block.includes('var(--surface-soft)') && block.includes('var(--line)'));
});

test('i18n: every roz_notes_* key used by roznamcha.js exists in en + ur with matching placeholders', () => {
  const source = readFileSync(new URL('../roznamcha.js', import.meta.url), 'utf8');
  const used = [...new Set([...source.matchAll(/t\('(roz_notes_[a-z_]+)'/g)].map((m) => m[1]))].sort();
  assert.deepEqual(used, [
    'roz_notes_counted', 'roz_notes_denom', 'roz_notes_extra', 'roz_notes_help',
    'roz_notes_short', 'roz_notes_tally', 'roz_notes_toggle'
  ]);
  const placeholders = (s) => [...s.matchAll(/\{([a-z]+)\}/g)].map((m) => m[1]).sort();
  for (const key of used) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `${key} in en`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `${key} in ur`);
    assert.deepEqual(placeholders(TRANSLATIONS.ur[key]), placeholders(TRANSLATIONS.en[key]), `${key} placeholders match`);
    assert.notEqual(t(key, 'en'), key, `${key} resolves in en`);
    assert.notEqual(t(key, 'ur'), key, `${key} resolves in ur`);
  }
  assert.equal(t('roz_notes_counted', 'en', { amount: 'PKR 5,500' }), 'Counted from notes: PKR 5,500');
  assert.match(t('roz_notes_counted', 'ur', { amount: 'PKR 5,500' }), /PKR 5,500/);
  assert.match(t('roz_notes_denom', 'en', { amount: '5,000' }), /5,000/);
});
