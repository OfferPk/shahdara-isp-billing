// SISP-65: 1-Tap Offline Voice Readout ([🔊 Speak Due]) in Field
// Collection Mode. Pure-function tests on synthetic data only. Spec
// test criteria (verbatim pin): "Clicking [🔊 Speak Due] formats the
// exact spoken string for the customer's net due amount and never
// throws when speechSynthesis is unavailable." The click half is
// asserted here at the seam (speakCustomerDue -> the injected synth
// receives the formatter's exact string; with no synth at all it
// returns spoken:false and does not throw — the headless case).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { TRANSLATIONS } from '../nav-language.js';
import {
  fieldModeCustomerStatus,
  formatSpeakDueText,
  speakDueTextForCustomer,
  speakTextAloud,
  speakCustomerDue
} from '../field-mode.js';
import { speakDueButtonMarkup } from '../profile-ui.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(root, f), 'utf8');

const bill = (month, overrides) => ({
  id: `bill-${month}`, month, dueAmount: 3000, dueDate: `${month}-05`,
  status: 'pending', payments: [], ...overrides
});
const customer = (id, number, name, overrides) => ({
  id, customerNumber: number, name, archived: false, bills: [], ...overrides
});
const stateWith = (customers) => ({ customers });

// Two priced unpaid months of 3,000 -> net due 6,000 (engine figures).
const dueState = () => stateWith([
  customer('c1', 11, 'SPEAK ALI', { bills: [bill('2026-09'), bill('2026-10')] })
]);

test('SISP-65 formatter (PIN): exact spoken string for the net due, en + ur', () => {
  assert.equal(formatSpeakDueText('SPEAK ALI', 6000, 'en'), 'SPEAK ALI. Total due is Rupees 6,000.');
  assert.equal(formatSpeakDueText('SPEAK ALI', 6000, 'ur'), 'SPEAK ALI. Kul baqaya 6,000 rupay hai.');
  assert.equal(formatSpeakDueText('SPEAK BILAL', 2500, 'en'), 'SPEAK BILAL. Total due is Rupees 2,500.');
  // Fractional dues keep their paisa digits, grouped like formatPKR.
  assert.equal(formatSpeakDueText('SPEAK ALI', 1234.5, 'en'), 'SPEAK ALI. Total due is Rupees 1,234.50.');
});

test('SISP-65 formatter: zero / invalid due speaks the fully-paid line, never "Rupees 0"', () => {
  assert.equal(formatSpeakDueText('SPEAK ALI', 0, 'en'), 'SPEAK ALI. No dues. The bill is fully paid.');
  assert.equal(formatSpeakDueText('SPEAK ALI', 0, 'ur'), 'SPEAK ALI. Koi baqaya nahi hai. Bill mukammal ada ho chuka hai.');
  assert.equal(formatSpeakDueText('SPEAK ALI', -50, 'en'), 'SPEAK ALI. No dues. The bill is fully paid.');
  assert.equal(formatSpeakDueText('SPEAK ALI', NaN, 'en'), 'SPEAK ALI. No dues. The bill is fully paid.');
});

test('SISP-65 engine source: the spoken due IS fieldModeCustomerStatus totalDues (no second computation)', () => {
  const state = dueState();
  const status = fieldModeCustomerStatus(state, 'c1');
  assert.equal(status.totalDues, 6000);
  assert.equal(speakDueTextForCustomer(state, 'c1'), formatSpeakDueText('SPEAK ALI', status.totalDues, 'en'));
  assert.equal(speakDueTextForCustomer(state, 'c1'), 'SPEAK ALI. Total due is Rupees 6,000.');
  // A partial payment lowers the spoken figure through the same engine.
  const partial = stateWith([
    customer('c2', 12, 'SPEAK BILAL', {
      bills: [bill('2026-10', { payments: [{ id: 'p1', date: '2026-10-05', amount: 1000, method: 'Cash' }] })]
    })
  ]);
  assert.equal(fieldModeCustomerStatus(partial, 'c2').totalDues, 2000);
  assert.equal(speakDueTextForCustomer(partial, 'c2'), 'SPEAK BILAL. Total due is Rupees 2,000.');
  // Fully settled -> the paid line; unknown id -> empty string.
  const settled = stateWith([
    customer('c3', 13, 'SPEAK DINA', {
      bills: [bill('2026-10', { payments: [{ id: 'p2', date: '2026-10-05', amount: 3000, method: 'Cash' }] })]
    })
  ]);
  assert.equal(speakDueTextForCustomer(settled, 'c3'), 'SPEAK DINA. No dues. The bill is fully paid.');
  assert.equal(speakDueTextForCustomer(state, 'missing-id'), '');
});

test('SISP-65 speaker (PIN): never throws when speechSynthesis is unavailable', () => {
  // Headless Node: no global speechSynthesis at all.
  assert.equal(typeof globalThis.speechSynthesis, 'undefined');
  assert.doesNotThrow(() => speakTextAloud('SPEAK ALI. Total due is Rupees 6,000.'));
  assert.equal(speakTextAloud('SPEAK ALI. Total due is Rupees 6,000.'), false);
  // Broken / partial synth shapes are also a safe no-op.
  assert.equal(speakTextAloud('x', {}), false);
  assert.equal(speakTextAloud('x', { speak: 'not-a-function' }), false);
  assert.equal(speakTextAloud('x', { speak() { throw new Error('boom'); } }), false);
  assert.equal(speakTextAloud('   ', { speak() { throw new Error('must not be called'); } }), false);
  // The full click seam in the headless case: exact text, spoken:false.
  let result;
  assert.doesNotThrow(() => { result = speakCustomerDue(dueState(), 'c1'); });
  assert.deepEqual(result, { text: 'SPEAK ALI. Total due is Rupees 6,000.', spoken: false });
  assert.deepEqual(speakCustomerDue(dueState(), 'missing-id'), { text: '', spoken: false });
});

test('SISP-65 speaker: an available synth receives the exact formatted string, once', () => {
  const calls = [];
  let cancels = 0;
  const synth = {
    cancel() { cancels += 1; },
    speak(utterance) { calls.push(utterance); }
  };
  const result = speakCustomerDue(dueState(), 'c1', { synth });
  assert.equal(result.spoken, true);
  assert.equal(result.text, 'SPEAK ALI. Total due is Rupees 6,000.');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].text, 'SPEAK ALI. Total due is Rupees 6,000.');
  assert.equal(cancels, 1, 'a fresh utterance cancels any in-flight speech first');
  assert.equal(speakTextAloud('hello', synth), true);
  assert.equal(calls[1].text, 'hello');
});

test('SISP-65 profile markup: the Speak Due button carries the house data hook + i18n label', () => {
  const markup = speakDueButtonMarkup(42);
  assert.ok(markup.includes('data-speak-due'), 'profile button carries data-speak-due');
  assert.ok(markup.includes('speak-due-button'), 'profile button carries its class');
  assert.ok(markup.includes('#42'), 'aria-label names the customer number');
  assert.ok(markup.includes(TRANSLATIONS.en.speak_due_btn), 'label comes from the en dictionary');
});

test('SISP-65 wiring: button on both field sheets + profile heading, handler bound in app.js', () => {
  const fieldMode = read('field-mode.js');
  assert.ok(fieldMode.includes('data-field-action="speakDue"'), 'field sheets render the Speak Due button');
  assert.ok(fieldMode.includes("action === 'speakDue'"), 'panel click handler routes speakDue');
  assert.ok(fieldMode.includes('speakCustomerDue(state, selectedId)'), 'sheet speaks via the shared seam');
  const app = read('app.js');
  assert.ok(app.includes('speakDueButtonMarkup(customer.customerNumber)'), 'profile heading renders the button');
  assert.ok(app.includes("querySelector('[data-speak-due]')"), 'app.js binds the profile Speak Due click');
  assert.ok(app.includes('speakCustomerDue(state, customer.id)'), 'profile click speaks via the shared seam');
});

// ---------- i18n audit ----------

test('SISP-65 i18n: every speak-due string exists in both dictionaries with its placeholders', () => {
  for (const key of ['speak_due_btn', 'speak_due_aria', 'speak_due_text', 'speak_due_paid_text']) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.ok(TRANSLATIONS.en[key].length > 0, `en empty ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key].length > 0, `ur empty ${key}`);
  }
  for (const lang of ['en', 'ur']) {
    assert.ok(TRANSLATIONS[lang].speak_due_text.includes('{name}'), `${lang} speak_due_text keeps {name}`);
    assert.ok(TRANSLATIONS[lang].speak_due_text.includes('{amount}'), `${lang} speak_due_text keeps {amount}`);
    assert.ok(TRANSLATIONS[lang].speak_due_paid_text.includes('{name}'), `${lang} speak_due_paid_text keeps {name}`);
    assert.ok(TRANSLATIONS[lang].speak_due_aria.includes('{number}'), `${lang} speak_due_aria keeps {number}`);
  }
});

test('SISP-65 i18n mechanical audit: every t() key the new code calls resolves in both dictionaries', () => {
  const sources = [read('field-mode.js'), read('profile-ui.js'), read('app.js')].join('\n');
  const used = new Set([...sources.matchAll(/t\('(speak_due_[a-z_]+)'/g)].map(m => m[1]));
  assert.deepEqual([...used].sort(), ['speak_due_aria', 'speak_due_btn', 'speak_due_paid_text', 'speak_due_text']);
  for (const key of used) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
  }
});
