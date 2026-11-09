import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  STANDING_INSTRUCTION_STORE_KEY,
  STANDING_INSTRUCTION_METHOD_MAX_LENGTH,
  STANDING_INSTRUCTION_BY_MAX_LENGTH,
  STANDING_INSTRUCTION_AMOUNT_MAX_CENTS,
  isStrictStandingInstructionDate,
  normalizeStandingInstruction,
  normalizeStandingInstructionList,
  recordStandingInstruction,
  removeStandingInstruction,
  standingInstructionForCustomer,
  hasStandingInstruction,
  standingInstructionDayLabel,
  formatStandingInstructionAmount,
  standingInstructionLineText,
  standingInstructionLineHtml,
  standingInstructionSectionHtml,
} from '../standing-instruction-note.js';

const dir = dirname(fileURLToPath(import.meta.url));
const moduleSrc = readFileSync(join(dir, '..', 'standing-instruction-note.js'), 'utf8');
const testSrc = readFileSync(join(dir, 'plan390-standing-instruction.test.js'), 'utf8');
const appSrc = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const stylesSrc = readFileSync(join(dir, '..', 'styles.css'), 'utf8');
const indexSrc = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const qcSrc = readFileSync(join(dir, '..', 'nav-quick-collect.js'), 'utf8');
const langSrc = readFileSync(join(dir, '..', 'nav-language.js'), 'utf8');

// Generic fixtures only — clearly made-up names, never a real customer.
function note(overrides = {}) {
  return {
    id: 'SIN-1',
    customerId: 'CUST-1',
    amountCents: 300000,
    dayOfMonth: 5,
    method: 'Easypaisa',
    recordedBy: 'Operator One',
    recordedDate: '2026-11-07',
    ...overrides,
  };
}

test('Plan 390: store key is short and names the note store', () => {
  assert.equal(STANDING_INSTRUCTION_STORE_KEY, 'shahdara_sin_notes_v1');
  assert.equal(STANDING_INSTRUCTION_METHOD_MAX_LENGTH, 60);
  assert.equal(STANDING_INSTRUCTION_BY_MAX_LENGTH, 60);
  assert.equal(STANDING_INSTRUCTION_AMOUNT_MAX_CENTS, 100000000);
});

test('Plan 390: strict dates are leap-aware and reject impossible dates', () => {
  assert.equal(isStrictStandingInstructionDate('2024-02-29'), true);
  assert.equal(isStrictStandingInstructionDate('2025-02-29'), false);
  assert.equal(isStrictStandingInstructionDate('2026-02-30'), false);
  assert.equal(isStrictStandingInstructionDate('2026-04-31'), false);
  assert.equal(isStrictStandingInstructionDate('2026-11-07'), true);
  assert.equal(isStrictStandingInstructionDate('2026-13-01'), false);
  assert.equal(isStrictStandingInstructionDate('2026-1-5'), false);
  assert.equal(isStrictStandingInstructionDate(''), false);
  assert.equal(isStrictStandingInstructionDate(null), false);
  assert.equal(isStrictStandingInstructionDate(20261107), false);
});

test('Plan 390: normalize keeps a complete note and drops the caps', () => {
  const clean = normalizeStandingInstruction(note({ method: 'E'.repeat(80), recordedBy: 'O'.repeat(80) }));
  assert.equal(clean.amountCents, 300000);
  assert.equal(clean.dayOfMonth, 5);
  assert.equal(clean.method.length, 60);
  assert.equal(clean.recordedBy.length, 60);
  assert.equal(clean.recordedDate, '2026-11-07');
});

test('Plan 390: normalize refuses a note without id or customer', () => {
  assert.equal(normalizeStandingInstruction(note({ id: '  ' })), null);
  assert.equal(normalizeStandingInstruction(note({ customerId: '' })), null);
  assert.equal(normalizeStandingInstruction(null), null);
  assert.equal(normalizeStandingInstruction('not an object'), null);
});

test('Plan 390: normalize refuses a bad amount', () => {
  assert.equal(normalizeStandingInstruction(note({ amountCents: 0 })), null);
  assert.equal(normalizeStandingInstruction(note({ amountCents: -500 })), null);
  assert.equal(normalizeStandingInstruction(note({ amountCents: 1500.5 })), null);
  assert.equal(normalizeStandingInstruction(note({ amountCents: null })), null);
  assert.equal(normalizeStandingInstruction(note({ amountCents: true })), null);
  assert.equal(normalizeStandingInstruction(note({ amountCents: STANDING_INSTRUCTION_AMOUNT_MAX_CENTS + 1 })), null);
  assert.equal(normalizeStandingInstruction(note({ amountCents: '300000' })).amountCents, 300000);
});

test('Plan 390: normalize refuses a bad day of the month', () => {
  assert.equal(normalizeStandingInstruction(note({ dayOfMonth: 0 })), null);
  assert.equal(normalizeStandingInstruction(note({ dayOfMonth: 32 })), null);
  assert.equal(normalizeStandingInstruction(note({ dayOfMonth: 5.5 })), null);
  assert.equal(normalizeStandingInstruction(note({ dayOfMonth: null })), null);
  assert.equal(normalizeStandingInstruction(note({ dayOfMonth: '5' })).dayOfMonth, 5);
  assert.equal(normalizeStandingInstruction(note({ dayOfMonth: 31 })).dayOfMonth, 31);
});

test('Plan 390: normalize keeps a note with no method, and refuses a bad recorded date', () => {
  const clean = normalizeStandingInstruction(note({ method: '   ' }));
  assert.equal(clean.method, '');
  assert.equal(normalizeStandingInstruction(note({ recordedDate: '2026-02-30' })), null);
  assert.equal(normalizeStandingInstruction(note({ recordedDate: '' })).recordedDate, '');
});

test('Plan 390: normalize never mutates its input', () => {
  const raw = note({ method: 'E'.repeat(80) });
  const before = JSON.stringify(raw);
  normalizeStandingInstruction(raw);
  assert.equal(JSON.stringify(raw), before);
});

test('Plan 390: list normalize drops invalid notes and keeps one per customer', () => {
  const list = normalizeStandingInstructionList([
    note(),
    note({ id: 'SIN-1', customerId: 'cust-1' }),
    note({ id: 'SIN-2', customerId: 'CUST-2', amountCents: 150000, dayOfMonth: 10 }),
    note({ id: 'SIN-3', amountCents: 0 }),
    null,
  ]);
  assert.equal(list.length, 2);
  assert.equal(list[0].customerId, 'CUST-1');
  assert.equal(list[1].customerId, 'CUST-2');
  assert.deepEqual(normalizeStandingInstructionList(null), []);
  assert.deepEqual(normalizeStandingInstructionList('nope'), []);
});

test('Plan 390: record appends a new note and replaces in place for the same customer', () => {
  const first = recordStandingInstruction([], note());
  assert.equal(first.length, 1);
  const replaced = recordStandingInstruction(first, note({ id: 'SIN-9', amountCents: 200000, dayOfMonth: 7, method: 'Cash' }));
  assert.equal(replaced.length, 1);
  assert.equal(replaced[0].id, 'SIN-9');
  assert.equal(replaced[0].amountCents, 200000);
  assert.equal(replaced[0].dayOfMonth, 7);
  const untouched = recordStandingInstruction(first, note({ amountCents: 0 }));
  assert.deepEqual(untouched, first);
});

test('Plan 390: record never mutates the list it was given', () => {
  const before = [note()];
  const snapshot = JSON.stringify(before);
  recordStandingInstruction(before, note({ id: 'SIN-2', customerId: 'CUST-2' }));
  removeStandingInstruction(before, 'CUST-1');
  assert.equal(JSON.stringify(before), snapshot);
});

test('Plan 390: remove takes out only that customer’s note', () => {
  const list = [
    note(),
    note({ id: 'SIN-2', customerId: 'CUST-2', amountCents: 150000, dayOfMonth: 10 }),
  ];
  const kept = removeStandingInstruction(list, 'cust-1');
  assert.equal(kept.length, 1);
  assert.equal(kept[0].customerId, 'CUST-2');
  assert.deepEqual(removeStandingInstruction(list, 'CUST-9'), list);
  assert.deepEqual(removeStandingInstruction(list, ''), list);
});

test('Plan 390: forCustomer matches case-insensitively and returns null otherwise', () => {
  const list = [note()];
  assert.equal(standingInstructionForCustomer(list, 'cust-1').id, 'SIN-1');
  assert.equal(standingInstructionForCustomer(list, 'CUST-2'), null);
  assert.equal(standingInstructionForCustomer(list, ''), null);
  assert.equal(standingInstructionForCustomer(list, null), null);
  assert.equal(hasStandingInstruction(list, 'CUST-1'), true);
  assert.equal(hasStandingInstruction(list, 'CUST-2'), false);
});

test('Plan 390: day labels use plain ordinals', () => {
  assert.equal(standingInstructionDayLabel(1), '1st');
  assert.equal(standingInstructionDayLabel(2), '2nd');
  assert.equal(standingInstructionDayLabel(3), '3rd');
  assert.equal(standingInstructionDayLabel(4), '4th');
  assert.equal(standingInstructionDayLabel(11), '11th');
  assert.equal(standingInstructionDayLabel(12), '12th');
  assert.equal(standingInstructionDayLabel(13), '13th');
  assert.equal(standingInstructionDayLabel(21), '21st');
  assert.equal(standingInstructionDayLabel(22), '22nd');
  assert.equal(standingInstructionDayLabel(23), '23rd');
  assert.equal(standingInstructionDayLabel(31), '31st');
  assert.equal(standingInstructionDayLabel(0), '');
  assert.equal(standingInstructionDayLabel(32), '');
  assert.equal(standingInstructionDayLabel(null), '');
});

test('Plan 390: amount formats in PKR with min-0 decimals', () => {
  assert.equal(formatStandingInstructionAmount(300000), 'PKR 3,000');
  assert.equal(formatStandingInstructionAmount(100), 'PKR 1');
  assert.equal(formatStandingInstructionAmount(150050), 'PKR 1,500.5');
  assert.equal(formatStandingInstructionAmount(0), '');
  assert.equal(formatStandingInstructionAmount(null), '');
});

test('Plan 390: line text reads as one plain sentence', () => {
  assert.equal(
    standingInstructionLineText(note()),
    'Usually pays PKR 3,000 on the 5th by Easypaisa',
  );
  assert.equal(
    standingInstructionLineText(note({ method: '' })),
    'Usually pays PKR 3,000 on the 5th',
  );
  assert.equal(standingInstructionLineText(null), '');
  assert.equal(standingInstructionLineText(note({ amountCents: 0 })), '');
  assert.equal(
    standingInstructionLineText(note(), { usually: 'Pays', onThe: 'on', by: 'via' }),
    'Pays PKR 3,000 on 5th via Easypaisa',
  );
});

test('Plan 390: line html is escaped and empty when there is no note', () => {
  const html = standingInstructionLineHtml(note({ method: 'Easypaisa <script>' }));
  assert.ok(html.includes('sin-line'));
  assert.ok(html.includes('Easypaisa &lt;script&gt;'));
  assert.ok(!html.includes('<script>'));
  assert.equal(standingInstructionLineHtml(null), '');
  assert.equal(standingInstructionLineHtml(note({ amountCents: 0 })), '');
});

test('Plan 390: section html carries the note and the edit form', () => {
  const html = standingInstructionSectionHtml({ id: 'CUST-1' }, [note()]);
  assert.ok(html.includes('profile-standing-instruction'));
  assert.ok(html.includes('Usually pays PKR 3,000 on the 5th by Easypaisa'));
  assert.ok(html.includes('id="sinForm"'));
  assert.ok(html.includes('id="sinAmount"'));
  assert.ok(html.includes('id="sinDay"'));
  assert.ok(html.includes('id="sinMethod"'));
  assert.ok(html.includes('id="sinBy"'));
  assert.ok(html.includes('id="sinDate"'));
  assert.ok(html.includes('id="sinSaveBtn"'));
  assert.ok(html.includes('id="sinRemoveBtn"'));
  assert.ok(html.includes('value="3000"'));
  assert.ok(html.includes('value="5"'));
});

test('Plan 390: section html shows the none text when there is no note', () => {
  const html = standingInstructionSectionHtml({ id: 'CUST-1' }, []);
  assert.ok(html.includes('No standing instruction for this customer.'));
  assert.ok(!html.includes('sinRemoveBtn'));
  assert.equal(standingInstructionSectionHtml(null, [note()]), '');
  assert.equal(standingInstructionSectionHtml('nope', [note()]), '');
});

test('Plan 390: section html escapes user-entered text', () => {
  const html = standingInstructionSectionHtml({ id: 'CUST-1' }, [note({ method: 'Cash <b>only</b>' })]);
  assert.ok(html.includes('Cash &lt;b&gt;only&lt;/b&gt;'));
  assert.ok(!html.includes('<b>only</b>'));
});

test('Plan 390: acceptance — the note appears on the profile and on the entry screen, and nothing when absent', () => {
  const list = [note()];
  const profileHtml = standingInstructionSectionHtml({ id: 'CUST-1' }, list);
  assert.ok(profileHtml.includes('Usually pays PKR 3,000 on the 5th by Easypaisa'));
  const entryHtml = standingInstructionLineHtml(standingInstructionForCustomer(list, 'CUST-1'));
  assert.ok(entryHtml.includes('Usually pays PKR 3,000 on the 5th by Easypaisa'));
  assert.equal(standingInstructionSectionHtml({ id: 'CUST-2' }, list).includes('Usually pays'), false);
  assert.equal(standingInstructionLineHtml(standingInstructionForCustomer(list, 'CUST-2')), '');
});

test('Plan 390: acceptance — recording a note changes no other customer’s note', () => {
  const list = [
    note(),
    note({ id: 'SIN-2', customerId: 'CUST-2', amountCents: 150000, dayOfMonth: 10, method: 'Cash' }),
  ];
  const next = recordStandingInstruction(list, note({ id: 'SIN-3', customerId: 'CUST-3', amountCents: 200000, dayOfMonth: 7 }));
  assert.equal(next.length, 3);
  assert.deepEqual(next[1], list[1]);
  const removed = removeStandingInstruction(next, 'CUST-3');
  assert.deepEqual(removed, list);
});

test('Plan 390: app.js wires the module, store, profile section and bindings', () => {
  assert.ok(appSrc.includes("from './standing-instruction-note.js'"));
  assert.ok(appSrc.includes('loadStandingInstructionNotes'));
  assert.ok(appSrc.includes('saveStandingInstructionNotes'));
  assert.ok(appSrc.includes('standingInstructionSectionMarkup'));
  // Order, not adjacency: the standing instruction sits between the
  // handling note and the spoken language note, so the handling note
  // is still right after the wada banner and still before the strip.
  // Polish #28 Phase A — handling, standing instruction and spoken
  // language all open the Customer section in the same order; the
  // strip sits above every section in the assembly.
  const customerBodyAt = appSrc.indexOf('const profileSectionCustomerBody = ');
  const customerBody = appSrc.slice(customerBodyAt, appSrc.indexOf('\n', customerBodyAt));
  const handlingAt = customerBody.indexOf('${handlingNoteSectionMarkup}');
  const standingAt = customerBody.indexOf('${standingInstructionSectionMarkup}');
  const spokenAt = customerBody.indexOf('${spokenLanguageNoteSectionMarkup}');
  assert.ok(handlingAt !== -1 && standingAt !== -1 && spokenAt !== -1);
  assert.ok(
    handlingAt < standingAt && standingAt < spokenAt,
    'standing instruction section sits after the handling note and before the spoken language note, inside Customer',
  );
  const stripAt = appSrc.indexOf('${profileHeaderStripSectionHtml}');
  const customerShellAt = appSrc.indexOf('${profileSectionCustomerHtml}', stripAt);
  assert.ok(stripAt !== -1 && customerShellAt > stripAt, 'Customer section sits after the header strip');
  assert.ok(appSrc.includes('sinForm'));
  assert.ok(appSrc.includes('sinRemoveBtn'));
  assert.ok(appSrc.includes('loadStandingInstructionNotes: () => loadStandingInstructionNotes()'));
});

test('Plan 390: transaction entry screen renders the note line for the selected customer', () => {
  assert.ok(qcSrc.includes('standingInstructionLineHtml'));
  assert.ok(qcSrc.includes('standingInstructionForCustomer'));
  assert.ok(qcSrc.includes('quickCollectStandingInstructionLine'));
  assert.ok(qcSrc.includes('renderStandingInstructionLine'));
  assert.ok(indexSrc.includes('id="quickCollectStandingInstructionLine"'));
});

test('Plan 390: standing-instruction labels exist in both language tables', () => {
  for (const key of [
    'prof_sin_heading',
    'prof_sin_amount',
    'prof_sin_day',
    'prof_sin_method',
    'prof_sin_noted_by',
    'prof_sin_date',
    'prof_sin_remove',
    'prof_sin_none',
  ]) {
    const hits = langSrc.split(key).length - 1;
    assert.ok(hits >= 2, `${key} appears ${hits} times`);
  }
});

test('Plan 390: styles reuse existing colours only — no new hex in standing-instruction rules', () => {
  assert.ok(stylesSrc.includes('.profile-standing-instruction'));
  assert.ok(stylesSrc.includes('.sin-line'));
  const rules = stylesSrc.match(/\.sin-[^{]+\{[^}]*\}|\.profile-standing-instruction[^{]*\{[^}]*\}/g) || [];
  assert.ok(rules.length >= 2, `expected standing-instruction rules, found ${rules.length}`);
  const baseline = stylesSrc.replace(/\.sin-[^{]+\{[^}]*\}|\.profile-standing-instruction[^{]*\{[^}]*\}/g, '');
  const baselineHexes = new Set((baseline.match(/#[0-9a-fA-F]{3,8}/g) || []).map(h => h.toLowerCase()));
  for (const rule of rules) {
    const hexes = rule.match(/#[0-9a-fA-F]{3,8}/g) || [];
    for (const hex of hexes) {
      assert.ok(baselineHexes.has(hex.toLowerCase()), `new hex colour ${hex} in rule ${rule.slice(0, 60)}`);
    }
  }
  assert.ok(stylesSrc.includes('.sin-line{') || stylesSrc.includes('.sin-line {'));
  assert.match(stylesSrc, /\.sin-line\{[^}]*var\(--amber-bg\)/);
});

test('Plan 390: module is pure — no clock, storage, page, or network access', () => {
  assert.ok(!moduleSrc.includes('new Date('), 'module must not read the clock');
  assert.ok(!moduleSrc.includes('Date.now('), 'module must not read the clock');
  assert.ok(!moduleSrc.includes('localStorage'), 'module must not touch storage');
  assert.ok(!moduleSrc.includes('document.'), 'module must not touch the page');
  assert.ok(!moduleSrc.includes('window.'), 'module must not touch the page');
  assert.ok(!moduleSrc.includes('fetch('), 'module must not touch the network');
});

test('Plan 390: module and test never name the fenced arrears module', () => {
  const fenced = 'repay' + 'ment-plan' + '.js';
  assert.ok(!moduleSrc.includes(fenced), 'module must not name the fenced filename');
  assert.ok(!testSrc.includes(fenced), 'test must not name the fenced filename');
});

test('Plan 390: fixtures are generic — no real customer name in the module or test', () => {
  const names = ['Kiran ' + 'Bilal', 'Haider ' + 'Ali', 'Shu' + 'naid'];
  for (const name of names) {
    assert.ok(!moduleSrc.includes(name), `module must not name ${name}`);
    assert.ok(!testSrc.includes(name), `test must not name ${name}`);
  }
});
