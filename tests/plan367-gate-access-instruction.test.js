import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GATE_ACCESS_INSTRUCTION_STORE_KEY,
  GATE_ACCESS_INSTRUCTION_TEXT_MAX_LENGTH,
  GATE_ACCESS_INSTRUCTION_BY_MAX_LENGTH,
  isStrictGateAccessInstructionDate,
  normalizeGateAccessInstruction,
  normalizeGateAccessInstructionList,
  loadGateAccessInstructionList,
  recordGateAccessInstruction,
  removeGateAccessInstruction,
  gateAccessInstructionForCustomer,
  hasGateAccessInstruction,
  gateAccessInstructionSummaryText,
  gateAccessInstructionText,
  gateAccessInstructionLineHtml,
  gateAccessInstructionSectionHtml,
} from '../gate-access-instruction.js';

const dir = dirname(fileURLToPath(import.meta.url));
const moduleSrc = readFileSync(join(dir, '..', 'gate-access-instruction.js'), 'utf8');
const testSrc = readFileSync(join(dir, 'plan367-gate-access-instruction.test.js'), 'utf8');
const appSrc = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const stylesSrc = readFileSync(join(dir, '..', 'styles.css'), 'utf8');
const langSrc = readFileSync(join(dir, '..', 'nav-language.js'), 'utf8');
const roundsSrc = readFileSync(join(dir, '..', 'nav-collection-rounds.js'), 'utf8');

// Generic fixtures only — clearly made-up names, never a real customer.
function note(overrides = {}) {
  return {
    id: 'GAI-1',
    customerId: 'CUST-1',
    instruction: 'Call first',
    notedBy: 'Saad',
    notedDate: '2026-11-06',
    ...overrides,
  };
}

function customer(overrides = {}) {
  return { id: 'CUST-1', name: 'Customer One', ...overrides };
}

test('Plan 367: store key is short and names the note store', () => {
  assert.equal(GATE_ACCESS_INSTRUCTION_STORE_KEY, 'shahdara_gai_notes_v1');
  assert.ok(GATE_ACCESS_INSTRUCTION_TEXT_MAX_LENGTH <= 300);
  assert.equal(GATE_ACCESS_INSTRUCTION_BY_MAX_LENGTH, 60);
});

test('Plan 367: strict dates are leap-aware and reject impossible dates', () => {
  assert.equal(isStrictGateAccessInstructionDate('2024-02-29'), true);
  assert.equal(isStrictGateAccessInstructionDate('2023-02-29'), false);
  assert.equal(isStrictGateAccessInstructionDate('2026-04-31'), false);
  assert.equal(isStrictGateAccessInstructionDate('2026-13-01'), false);
  assert.equal(isStrictGateAccessInstructionDate('2026-11-6'), false);
  assert.equal(isStrictGateAccessInstructionDate(''), false);
  assert.equal(isStrictGateAccessInstructionDate(null), false);
});

test('Plan 367: normalize keeps a valid instruction and trims its fields', () => {
  const clean = normalizeGateAccessInstruction(note({ instruction: '  Call first  ', notedBy: '  Saad ' }));
  assert.deepEqual(clean, note());
});

test('Plan 367: normalize refuses an instruction with no id, no customer, or no instruction', () => {
  assert.equal(normalizeGateAccessInstruction(note({ id: '' })), null);
  assert.equal(normalizeGateAccessInstruction(note({ customerId: '' })), null);
  assert.equal(normalizeGateAccessInstruction(note({ instruction: '   ' })), null);
  assert.equal(normalizeGateAccessInstruction(note({ notedDate: '2023-02-29' })), null);
  assert.equal(normalizeGateAccessInstruction(null), null);
});

test('Plan 367: normalize caps a long instruction and a long noted-by', () => {
  const clean = normalizeGateAccessInstruction(note({ instruction: 'x'.repeat(500), notedBy: 'y'.repeat(100) }));
  assert.equal(clean.instruction.length, GATE_ACCESS_INSTRUCTION_TEXT_MAX_LENGTH);
  assert.equal(clean.notedBy.length, 60);
});

test('Plan 367: normalize list drops invalid entries and keeps the first per customer and id', () => {
  const list = normalizeGateAccessInstructionList([
    note(),
    note({ id: 'GAI-1', instruction: 'Ask at the shop' }),
    note({ id: 'GAI-2', customerId: 'CUST-1', instruction: 'Ring twice' }),
    note({ id: 'GAI-3', customerId: 'CUST-2', instruction: 'Call first' }),
    note({ id: '', customerId: 'CUST-3', instruction: 'Call first' }),
    null,
  ]);
  assert.deepEqual(list, [note(), note({ id: 'GAI-3', customerId: 'CUST-2', instruction: 'Call first' })]);
});

test('Plan 367: load reads the list from a storage-like object and tolerates bad storage', () => {
  const storage = { getItem: key => (key === GATE_ACCESS_INSTRUCTION_STORE_KEY ? JSON.stringify([note()]) : null) };
  assert.deepEqual(loadGateAccessInstructionList(storage), [note()]);
  assert.deepEqual(loadGateAccessInstructionList({ getItem: () => '{bad json' }), []);
  assert.deepEqual(loadGateAccessInstructionList(null), []);
});

test('Plan 367: record adds an instruction and replaces in place for the same customer', () => {
  assert.deepEqual(recordGateAccessInstruction([], note()), [note()]);
  const replaced = recordGateAccessInstruction([note()], note({ instruction: 'Ask at the neighbour’s shop' }));
  assert.equal(replaced.length, 1);
  assert.equal(replaced[0].instruction, 'Ask at the neighbour’s shop');
  assert.equal(replaced[0].id, 'GAI-1');
});

test('Plan 367: record matches the customer case-insensitively and leaves the input alone', () => {
  const before = [note()];
  const next = recordGateAccessInstruction(before, note({ customerId: 'cust-1', instruction: 'Ring twice' }));
  assert.equal(next.length, 1);
  assert.equal(next[0].instruction, 'Ring twice');
  assert.deepEqual(before, [note()]);
  assert.deepEqual(recordGateAccessInstruction([note()], note({ instruction: '' })), [note()]);
});

test('Plan 367: remove drops only that customer, case-insensitively', () => {
  const list = [note(), note({ id: 'GAI-2', customerId: 'CUST-2', instruction: 'Call first' })];
  assert.deepEqual(removeGateAccessInstruction(list, 'cust-1'), [note({ id: 'GAI-2', customerId: 'CUST-2', instruction: 'Call first' })]);
  assert.deepEqual(removeGateAccessInstruction(list, ''), list);
});

test('Plan 367: lookup is case-insensitive and missing reads as no instruction', () => {
  assert.equal(gateAccessInstructionForCustomer([note()], 'cust-1').id, 'GAI-1');
  assert.equal(gateAccessInstructionForCustomer([note()], 'CUST-9'), null);
  assert.equal(gateAccessInstructionForCustomer([note()], ''), null);
  assert.equal(hasGateAccessInstruction([note()], 'CUST-1'), true);
  assert.equal(hasGateAccessInstruction([], 'CUST-1'), false);
});

test('Plan 367: summary text counts the instructions in plain words', () => {
  assert.equal(gateAccessInstructionSummaryText([]), 'No gate access instruction noted.');
  assert.equal(gateAccessInstructionSummaryText([note()]), '1 customer has a gate access instruction noted.');
  assert.equal(
    gateAccessInstructionSummaryText([note(), note({ id: 'GAI-2', customerId: 'CUST-2', instruction: 'Call first' })]),
    '2 customers have a gate access instruction noted.',
  );
});

test('Plan 367: section shows the noted instruction with its byline and an edit form', () => {
  const html = gateAccessInstructionSectionHtml(customer(), [note()], {});
  assert.ok(html.includes('Call first'));
  assert.ok(html.includes('Saad, 2026-11-06'));
  assert.ok(html.includes('profile-gate-access-instruction'));
  assert.ok(html.includes('id="gaiForm"'));
  assert.ok(html.includes('id="gaiInstruction"'));
  assert.ok(html.includes('id="gaiRemoveBtn"'));
});

test('Plan 367: section escapes the instruction text and honours caller labels', () => {
  const html = gateAccessInstructionSectionHtml(customer(), [note({ instruction: '<b>bold</b> & "quoted"' })], {
    heading: 'Gate access',
    placeholder: 'How to reach the door',
    notedBy: 'Noted by',
    date: 'Date',
    save: 'Save',
    remove: 'Remove',
    none: 'None noted.',
  });
  assert.ok(!html.includes('<b>bold</b>'));
  assert.ok(html.includes('&lt;b&gt;bold&lt;/b&gt;'));
  assert.ok(html.includes('Gate access'));
  assert.ok(html.includes('How to reach the door'));
});

test('Plan 367: a profile without an instruction shows the none line and the add form, never an instruction', () => {
  const html = gateAccessInstructionSectionHtml(customer(), [], {});
  assert.ok(html.includes('No gate access instruction noted for this customer.'));
  assert.ok(html.includes('id="gaiForm"'));
  assert.ok(!html.includes('id="gaiRemoveBtn"'));
  assert.equal(gateAccessInstructionSectionHtml(null, [note()], ''), '');
});

test('Plan 367: route line shows the instruction beside the customer, empty when there is none', () => {
  const line = gateAccessInstructionLineHtml(note());
  assert.ok(line.includes('gai-route-line'));
  assert.ok(line.includes('Access:'));
  assert.ok(line.includes('Call first'));
  assert.equal(gateAccessInstructionLineHtml(null), '');
  assert.equal(gateAccessInstructionLineHtml({ ...note(), instruction: '' }), '');
  const escaped = gateAccessInstructionLineHtml({ ...note(), instruction: '<b>bold</b>' });
  assert.ok(!escaped.includes('<b>bold</b>'));
  assert.ok(escaped.includes('&lt;b&gt;bold&lt;/b&gt;'));
  assert.equal(gateAccessInstructionText(note()), 'Call first');
  assert.equal(gateAccessInstructionText(null), '');
});

test('Plan 367: module is pure — no page, storage, clock, network, or import', () => {
  assert.ok(!moduleSrc.includes('document.'));
  assert.ok(!moduleSrc.includes('localStorage'));
  assert.ok(!/new Date\(/.test(moduleSrc));
  assert.ok(!/Date\.now\(/.test(moduleSrc));
  assert.ok(!moduleSrc.includes('fetch('));
  assert.ok(!moduleSrc.includes('window.'));
  assert.ok(!moduleSrc.includes('import '));
  assert.ok(!/\bOLT\b/.test(moduleSrc));
});

test('Plan 367: module and tests never name the fenced neighbours literally', () => {
  const fenced = [
    ['access', 'difficulty'].join('-') + '.js',
    ['safety', 'note'].join('-') + '.js',
  ];
  for (const name of fenced) {
    assert.ok(!moduleSrc.includes(name), `module names fenced file ${name}`);
    assert.ok(!testSrc.includes(name), `tests name fenced file ${name}`);
  }
});

test('Plan 367: wiring — import, load/save, section after the spoken language note, bindings', () => {
  assert.ok(appSrc.includes("from './gate-access-instruction.js'"));
  assert.ok(appSrc.includes('loadGateAccessInstructions'));
  assert.ok(appSrc.includes('saveGateAccessInstructions'));
  assert.ok(appSrc.includes('gateAccessInstructionSectionMarkup'));
  // Order, not adjacency: the Plan 368 emergency contact section now
  // sits between the gate access instruction and the header strip, so
  // the gate access section is still after the spoken language note
  // and still before the strip.
  const spokenAt = appSrc.indexOf('${spokenLanguageNoteSectionMarkup}');
  const gateAt = appSrc.indexOf('${gateAccessInstructionSectionMarkup}');
  const emergencyAt = appSrc.indexOf('${customerEmergencyContactSectionMarkup}');
  const stripAt = appSrc.indexOf('${profileHeaderStripSectionHtml}');
  assert.ok(spokenAt !== -1 && gateAt !== -1 && emergencyAt !== -1 && stripAt !== -1);
  assert.ok(
    spokenAt < gateAt && gateAt < emergencyAt && emergencyAt < stripAt,
    'gate access section sits at the top of the profile, after the spoken language note and before the header strip',
  );
  assert.ok(appSrc.includes('gaiForm'));
  assert.ok(appSrc.includes('gaiRemoveBtn'));
});

test('Plan 367: the instruction also appears beside the customer on the visit list', () => {
  assert.ok(roundsSrc.includes("from './gate-access-instruction.js'"));
  assert.ok(roundsSrc.includes('loadGateAccessInstructionList('));
  assert.ok(roundsSrc.includes('gateAccessInstructionLineHtml('));
  assert.ok(roundsSrc.includes('gateAccessInstructionForCustomer('));
});

test('Plan 367: gate access keys exist in both language tables', () => {
  assert.ok(langSrc.includes('prof_gate_access_heading'));
  assert.ok(langSrc.includes('prof_gate_access_placeholder'));
  assert.ok(langSrc.includes('prof_gate_access_noted_by'));
  assert.ok(langSrc.includes('prof_gate_access_date'));
  assert.ok(langSrc.includes('prof_gate_access_remove'));
  assert.ok(langSrc.includes('prof_gate_access_none'));
});

test('Plan 367: styles reuse existing colours only — no new hex in gate access rules', () => {
  assert.ok(stylesSrc.includes('.profile-gate-access-instruction'));
  assert.ok(stylesSrc.includes('.gai-form'));
  assert.ok(stylesSrc.includes('.gai-route-line'));
  const rules = stylesSrc.match(/\.gai-[^{]+\{[^}]*\}|\.profile-gate-access-instruction[^{]*\{[^}]*\}/g) || [];
  assert.ok(rules.length > 0);
  const baseline = stylesSrc.replace(/\.gai-[^{]+\{[^}]*\}|\.profile-gate-access-instruction[^{]*\{[^}]*\}/g, '');
  const baselineHexes = new Set((baseline.match(/#[0-9a-fA-F]{3,8}/g) || []).map(hex => hex.toLowerCase()));
  for (const rule of rules) {
    const hexes = rule.match(/#[0-9a-fA-F]{3,8}/g) || [];
    for (const hex of hexes) {
      assert.ok(baselineHexes.has(hex.toLowerCase()), `new hex colour ${hex} in rule ${rule.slice(0, 60)}`);
    }
  }
});
