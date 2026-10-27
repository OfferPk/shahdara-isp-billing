// Profile UI polish: compact dark-mode profile sections, Urdu customer names
// (display only), PKR note chips on Collect, and themed modal containers
// (Part D). Pure-module tests + core round-trips + static presence guards.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  transliterateRomanToUrdu,
  displayCustomerName,
  currentAppLanguage
} from '../urdu-names.js';
import {
  PKR_DENOMINATIONS,
  breakdownPkrNotes,
  pkrNoteChipsMarkup
} from '../pkr-notes.js';
import {
  createInitialState,
  addCustomer,
  updateCustomerProfile,
  createJsonBackup,
  previewJsonBackupMerge
} from '../core.js';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');

// --- Part B: transliteration (verbatim user examples) ---

test('transliteration: RAJA FAISAL -> راجہ فیصل (verbatim)', () => {
  assert.equal(transliterateRomanToUrdu('RAJA FAISAL'), 'راجہ فیصل');
});

test('transliteration: common names and area words', () => {
  assert.equal(transliterateRomanToUrdu('RAJA ALI'), 'راجہ علی');
  assert.equal(transliterateRomanToUrdu('MUHAMMAD AHMED'), 'محمد احمد');
  assert.equal(transliterateRomanToUrdu('KHAN'), 'خان');
  assert.equal(transliterateRomanToUrdu('BANGISH HOUSE'), 'بنگش ہاؤس');
  assert.equal(transliterateRomanToUrdu('HUSSAIN'), 'حسین');
});

test('display name: manual nameUrdu override wins over auto-transliteration', () => {
  const customer = { name: 'RAJA FAISAL', nameUrdu: 'راجہ فیصل صاحب' };
  assert.equal(displayCustomerName(customer, 'ur'), 'راجہ فیصل صاحب');
  assert.equal(displayCustomerName({ name: 'RAJA FAISAL' }, 'ur'), 'راجہ فیصل');
});

test('display name: English stays Roman; empty/digits fall back to Roman', () => {
  assert.equal(displayCustomerName({ name: 'RAJA FAISAL' }, 'en'), 'RAJA FAISAL');
  assert.equal(displayCustomerName({ name: '12345' }, 'ur'), '12345');
  assert.equal(displayCustomerName({ name: '' }, 'ur'), '');
  assert.equal(displayCustomerName({ name: 'RAJA FAISAL', nameUrdu: '   ' }, 'ur'), 'راجہ فیصل');
});

test('currentAppLanguage: no window (node) is English; controller shapes work', () => {
  assert.equal(currentAppLanguage(undefined), 'en');
  assert.equal(currentAppLanguage({ languageController: { getLanguage: () => 'ur' } }), 'ur');
  assert.equal(currentAppLanguage({ languageController: { getCurrentLanguage: () => 'ur' } }), 'ur');
  assert.equal(currentAppLanguage({ document: { documentElement: { lang: 'ur' } } }), 'ur');
});

// --- Part C: PKR note breakdown (verbatim user examples) ---

test('note breakdown: 3000 -> 1000x3; 6000 -> one 5000 + one 1000 (verbatim)', () => {
  assert.deepEqual(breakdownPkrNotes(3000), { notes: [{ denomination: 1000, count: 3 }], remainder: 0 });
  assert.deepEqual(breakdownPkrNotes(6000), { notes: [{ denomination: 5000, count: 1 }, { denomination: 1000, count: 1 }], remainder: 0 });
});

test('note breakdown: mixed, zero, remainder, and odd amounts', () => {
  assert.deepEqual(breakdownPkrNotes(3500).notes, [{ denomination: 1000, count: 3 }, { denomination: 500, count: 1 }]);
  assert.deepEqual(breakdownPkrNotes(0), { notes: [], remainder: 0 });
  assert.deepEqual(breakdownPkrNotes(-50), { notes: [], remainder: 0 });
  assert.deepEqual(breakdownPkrNotes(7), { notes: [], remainder: 7 });
  assert.deepEqual(breakdownPkrNotes(999), {
    notes: [
      { denomination: 500, count: 1 }, { denomination: 100, count: 4 },
      { denomination: 50, count: 1 }, { denomination: 20, count: 2 }
    ],
    remainder: 9
  });
  assert.deepEqual(breakdownPkrNotes(5680).notes, [
    { denomination: 5000, count: 1 }, { denomination: 500, count: 1 },
    { denomination: 100, count: 1 }, { denomination: 50, count: 1 },
    { denomination: 20, count: 1 }, { denomination: 10, count: 1 }
  ]);
  assert.deepEqual(PKR_DENOMINATIONS, [5000, 1000, 500, 100, 50, 20, 10]);
});

test('note chips markup: denominations + counts, remainder, empty for zero', () => {
  const chips = pkrNoteChipsMarkup(3000);
  assert.match(chips, /₨1000 ×3/);
  assert.match(chips, /pkr-note-chip/);
  assert.match(pkrNoteChipsMarkup(999), /\+ PKR 9/);
  assert.equal(pkrNoteChipsMarkup(0), '');
});

// --- Part B: core round-trip for nameUrdu ---

test('nameUrdu: stored on add, updated + preserved on profile edit, backup round-trip', () => {
  let state = createInitialState();
  state = addCustomer(state, 'ZZ POLISH TEST', new Date(), { nameUrdu: 'راجہ فیصل' });
  const customer = state.customers.at(-1);
  assert.equal(customer.nameUrdu, 'راجہ فیصل');

  const edited = updateCustomerProfile(state, customer.id, { nameUrdu: 'راجہ فیصل صاحب' });
  assert.equal(edited.customers.find(c => c.id === customer.id).nameUrdu, 'راجہ فیصل صاحب');
  const untouched = updateCustomerProfile(state, customer.id, { mohalla: 'MOHALLA CHAMYAA' });
  assert.equal(untouched.customers.find(c => c.id === customer.id).nameUrdu, 'راجہ فیصل');

  // Safe merge fills an EMPTY local nameUrdu from the backup (it never
  // overwrites a saved local value — same semantics as the promise fields).
  let emptyState = createInitialState();
  emptyState = addCustomer(emptyState, 'ZZ POLISH TEST', new Date(), {});
  const emptyCustomer = emptyState.customers.at(-1);
  assert.equal(emptyCustomer.nameUrdu, '');
  const backupState = updateCustomerProfile(emptyState, emptyCustomer.id, { nameUrdu: 'راجہ فیصل صاحب' });
  const backupText = createJsonBackup(backupState, new Date());

  // Full restore keeps the field (whole-state deep copy).
  assert.equal(JSON.parse(backupText).state.customers.find(c => c.id === emptyCustomer.id).nameUrdu, 'راجہ فیصل صاحب');

  const merged = previewJsonBackupMerge(emptyState, backupText);
  assert.equal(merged.state.customers.find(c => c.id === emptyCustomer.id).nameUrdu, 'راجہ فیصل صاحب');
});

// --- Static presence guards: layout hooks, dark-mode classes, modal theme ---

test('layout hooks: grouped profile, Urdu inputs, subtitle id all exist', () => {
  const html = read('index.html');
  const app = read('app.js');
  assert.ok(html.includes('id="detailNameSub"'), 'detailNameSub exists');
  assert.ok(html.includes('id="nameUrduInput"'), 'profile Urdu name input exists');
  assert.ok(html.includes('id="newCustomerNameUrdu"'), 'add-form Urdu name input exists');
  assert.ok(app.includes('profileInfoGroupMarkup'), 'grouped profile renderer exists');
  assert.ok(app.includes('profile-readonly-field-wide'), 'wide-field variant exists');
  const css = read('styles.css');
  assert.ok(css.includes('.profile-info-group'), 'group CSS exists');
  assert.ok(css.includes('.profile-readonly-field-wide'), 'wide-field CSS exists');
  assert.ok(css.includes('.detail-name-sub'), 'subtitle CSS exists');
});

test('dark-mode check (standing rule): new surfaces carry dark rules via tokens', () => {
  const css = read('styles.css');
  const routerCss = read('screen-router.css');
  // Profile cards + CLV + package history use theme tokens, not hardcoded white.
  assert.ok(css.includes('.profile-readonly-field{min-width:0;padding:9px 10px;border:1px solid #e3ebe7;border-radius:9px;background:var(--surface)}'), 'profile card tokenized');
  assert.ok(css.includes('.customer-lifetime-grid>div{min-width:0;padding:10px;border:1px solid #e3ece7;border-radius:9px;background:var(--surface)}'), 'CLV inner cards tokenized');
  assert.ok(css.includes('background:var(--surface-soft);border:1px solid #edf1ef;border-radius:12px'), 'package history tokenized');
  assert.ok(css.includes('[data-theme="dark"] .profile-readonly-field dd'), 'profile dd dark rule exists');
  assert.ok(css.includes('[data-theme="dark"] .detail-name-sub'), 'subtitle dark rule exists');
  assert.ok(routerCss.includes('.pkr-note-chip{display:inline-flex'), 'note chip CSS exists');
  assert.ok(routerCss.includes('background:var(--mint);border:1px solid var(--line);color:var(--green-dark)'), 'note chips use adapting tokens (no new hex, dark-mode correct)');
  assert.ok(routerCss.includes('.pkr-note-chips'), 'note chips CSS exists');
});

test('Part D guard: shared dialog rule themes the container (no hardcoded white)', () => {
  const css = read('styles.css');
  const marker = css.indexOf('STANDARDIZED RESPONSIVE DIALOGS');
  assert.ok(marker > 0, 'standardized dialog block exists');
  const slice = css.slice(marker, marker + 800);
  assert.match(slice, /background:\s*var\(--modal-surface\)/, 'dialog container uses the modal-surface token');
  assert.doesNotMatch(slice, /background:\s*#fff\b/, 'dialog container has no hardcoded white background');
  assert.doesNotMatch(slice, /background:\s*#ffffff\b/, 'dialog container has no hardcoded #ffffff background');
  const html = read('index.html');
  assert.ok(html.includes('id="shopSettlementModal" class="billing-modal shop-settlement-modal"'), 'shop modal is a billing-modal dialog');
  assert.ok(html.includes('id="complaintRegisterModal" class="billing-modal complaint-register-modal"'), 'complaint modal is a billing-modal dialog');
});
