// SISP-178 — Public-repo privacy guard & zero-PII ratchet (PR #478 follow-up).
//
// PR #478 (privacy cleanup) emptied the shipped customer roster in this
// PUBLIC repository: the owner's real subscriber names/numbers must never
// be committed here again. This test is the ratchet that locks that in:
//
//   1. The two shipped seed bindings stay EMPTY when imported:
//        core.js              -> INITIAL_NAMES          (starter customers)
//        default-customers.js -> DEFAULT_CUSTOMER_ROSTER (shipped roster)
//      and a fresh initial state therefore starts with zero customers.
//   2. Source-level seed scan of those same two modules: no roster
//      `entry(...)` seed calls and no non-empty INITIAL_NAMES literal —
//      catches a re-seed even if it is shaped differently than the pins.
//   3. A PII-pattern scan over the EXACT source set the production build
//      ships (collectRuntimeFiles from build.mjs — the same enumeration
//      the bundler walks), flagging Pakistani mobile numbers and CNIC
//      numbers that are not demonstrably pattern-fake.
//
// Scan set & exclusions (the call): ONLY the build's runtime source files
// (239 files on this base: .js/.html/.css/.webmanifest) are scanned.
// tests/ (synthetic fixtures), docs/, android/, scripts/ and tooling are
// NOT shipped to users and are excluded — they are exactly the file set
// build.mjs never walks. Comments ARE scanned (a comment in the public
// repo is just as public as code).
//
// Pattern-fake rule: a matched number is treated as an obvious placeholder
// — not PII — when its digits contain a run of 5+ ascending digits
// (1234567, 4567890), a run of 5+ descending digits (7654321, 9876543),
// or 6+ identical digits in a row (0000000). Every pristine-main hit
// passes by this rule EXCEPT the two disclosed exemptions below.
//
// DISCLOSED EXEMPTIONS (not silent — see the phase report): exactly two
// non-pattern numbers exist on pristine main, both in ONE doc comment in
// easypaisa-parser.js illustrating the Easypaisa statement-CSV format
// (the sibling SMS example in the same file uses the fictional sender
// "JOHN DOE"). No name, address or customer record is attached to them
// and they are not part of any roster. They are exempted BY VALUE + FILE
// below so the ratchet passes on main; the parent/owner may still choose
// to scrub the doc example in a follow-up. Any OTHER non-pattern number,
// in any shipped file, fails this test.
//
// Canary fixtures below are invented for this test ("Canary Test Person"
// and digit strings checked to be non-pattern): they prove the ratchet
// actually bites. Test files are outside the shipped scan set, so the
// canaries never trip the guard themselves.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { collectRuntimeFiles } from '../build.mjs';
import { INITIAL_NAMES, createInitialState } from '../core.js';
import { DEFAULT_CUSTOMER_ROSTER, planDefaultCustomerAdditions } from '../default-customers.js';

const ROOT = new URL('..', import.meta.url).pathname;
const readSource = (rel) => readFileSync(path.join(ROOT, rel), 'utf8');

// ---------------------------------------------------------------------------
// PII pattern machinery (also exercised against canaries below)
// ---------------------------------------------------------------------------

const PHONE_PATTERN = /\+?\(?03\d{2}\)?[-\s]?\d{7}\b|\+92[-\s]?3\d{2}[-\s]?\d{7}\b/g;
const CNIC_PATTERN = /\b\d{5}-\d{7}-\d\b/g;

/** True when a digit string is a demonstrably fake placeholder pattern:
 *  6+ identical digits in a row, or an ascending/descending run of 5+. */
export function isPatternFakeNumber(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (/(.)\1{5,}/.test(digits)) return true;
  for (let i = 0; i < digits.length; i++) {
    let asc = 1;
    let desc = 1;
    for (let j = i + 1; j < digits.length; j++) {
      if (Number(digits[j]) === Number(digits[j - 1]) + 1) asc++; else break;
    }
    for (let j = i + 1; j < digits.length; j++) {
      if (Number(digits[j]) === Number(digits[j - 1]) - 1) desc++; else break;
    }
    if (asc >= 5 || desc >= 5) return true;
  }
  return false;
}

// Disclosed exemptions: { file, value } pairs that are known documentation
// examples, NOT subscriber PII (justification in the header comment).
const KNOWN_DOC_EXAMPLES = [
  { file: 'easypaisa-parser.js', value: '03055669955' },
  { file: 'easypaisa-parser.js', value: '03335001667' }
];
const isKnownDocExample = (file, value) =>
  KNOWN_DOC_EXAMPLES.some((entry) => entry.file === file && entry.value === value);

/** Scan one source text for non-fake, non-exempt phone/CNIC matches.
 *  Returns [{ kind, value, line }] — an empty array means clean. */
export function findPiiMatches(source, file = '<inline>') {
  const findings = [];
  for (const [kind, pattern] of [['phone', PHONE_PATTERN], ['cnic', CNIC_PATTERN]]) {
    for (const match of String(source ?? '').matchAll(pattern)) {
      const value = match[0];
      if (isPatternFakeNumber(value)) continue;
      if (isKnownDocExample(file, value)) continue;
      findings.push({ kind, value, line: String(source).slice(0, match.index).split('\n').length });
    }
  }
  return findings;
}

/** Seed-literal scan for the roster module: `entry('Name', 'AREA')` calls
 *  are how a shipped roster entry would be written (see the module's own
 *  docs). The bare helper DEFINITION `const entry = (name, mohalla...)`
 *  has no string argument, so it never matches. */
export function findRosterSeedCalls(source) {
  return [...String(source ?? '').matchAll(/\bentry\(\s*['"`]/g)]
    .map((match) => ({ line: String(source).slice(0, match.index).split('\n').length }));
}

/** Seed-literal scan for core.js: the INITIAL_NAMES array literal must be
 *  empty. Returns the literal's inner text, or null when not found. */
export function initialNamesLiteralInner(source) {
  const match = String(source ?? '').match(/INITIAL_NAMES\s*=\s*Object\.freeze\(\s*\[([\s\S]*?)\]\s*\)/);
  return match ? match[1] : null;
}

// ---------------------------------------------------------------------------
// 1. Imported bindings stay empty
// ---------------------------------------------------------------------------

test('privacy ratchet: core INITIAL_NAMES (starter customers) ships EMPTY', () => {
  assert.deepEqual(INITIAL_NAMES, []);
  assert.equal(INITIAL_NAMES.length, 0);
});

test('privacy ratchet: a fresh initial state starts with zero customers', () => {
  const state = createInitialState();
  assert.deepEqual(state.customers, []);
  assert.equal(state.nextCustomerNumber, 1);
});

test('privacy ratchet: DEFAULT_CUSTOMER_ROSTER ships EMPTY and plans zero additions', () => {
  assert.deepEqual(DEFAULT_CUSTOMER_ROSTER, []);
  assert.equal(DEFAULT_CUSTOMER_ROSTER.length, 0);
  assert.deepEqual(planDefaultCustomerAdditions([], DEFAULT_CUSTOMER_ROSTER), []);
});

// ---------------------------------------------------------------------------
// 2. Source-level seed scans of the two roster modules
// ---------------------------------------------------------------------------

test('privacy ratchet: default-customers.js source has no roster seed calls', () => {
  assert.deepEqual(findRosterSeedCalls(readSource('default-customers.js')), []);
});

test('privacy ratchet: core.js source keeps the INITIAL_NAMES literal empty', () => {
  const inner = initialNamesLiteralInner(readSource('core.js'));
  assert.notEqual(inner, null, 'INITIAL_NAMES literal not found — update the ratchet if it moved');
  assert.equal(inner.trim(), '');
});

// ---------------------------------------------------------------------------
// 3. Shipped-source PII pattern scan
// ---------------------------------------------------------------------------

test('privacy ratchet: no non-fake phone/CNIC numbers anywhere in the shipped source set', async () => {
  const { files, missing } = await collectRuntimeFiles(ROOT);
  assert.deepEqual(missing, []);
  const TEXT_EXTS = new Set(['js', 'html', 'css', 'webmanifest']);
  const scanned = files.filter((file) => TEXT_EXTS.has(file.split('.').pop()));
  assert.ok(scanned.includes('core.js') && scanned.includes('default-customers.js'),
    'scan set must include both roster modules');
  const violations = [];
  for (const file of scanned) {
    for (const finding of findPiiMatches(readSource(file), file)) {
      violations.push(`${file}:${finding.line} ${finding.kind} ${finding.value}`);
    }
  }
  assert.deepEqual(violations, [],
    `non-placeholder phone/CNIC numbers in shipped source (real subscriber PII must never be committed):\n${violations.join('\n')}`);
});

test('privacy ratchet: the disclosed doc-example exemptions are exactly the two easypaisa values', async () => {
  // If a future change removes or alters the doc example, shrink this list —
  // the ratchet must never carry stale exemptions silently.
  const source = readSource('easypaisa-parser.js');
  for (const { value } of KNOWN_DOC_EXAMPLES) {
    assert.ok(source.includes(value), `exempted example ${value} no longer present — remove its exemption`);
  }
  assert.equal(KNOWN_DOC_EXAMPLES.length, 2);
});

// ---------------------------------------------------------------------------
// 4. Canaries — the ratchet must bite on synthetic re-seeds
// ---------------------------------------------------------------------------

const CANARY_NAME = 'Canary Test Person';
const CANARY_PHONE = '0324-8157309'; // invented digits; verified non-pattern below
const CANARY_CNIC = '35202-4815162-3'; // invented digits; verified non-pattern below

test('canary fixtures are synthetic and non-pattern (so the teeth tests are honest)', () => {
  assert.equal(isPatternFakeNumber(CANARY_PHONE), false);
  assert.equal(isPatternFakeNumber(CANARY_CNIC), false);
  assert.equal(isPatternFakeNumber('0300-1234567'), true);
  assert.equal(isPatternFakeNumber('0300-0000000'), true);
});

test('canary: a realistic phone number injected into a shipped-source string is caught', () => {
  const poisoned = `const demo = { phone: '${CANARY_PHONE}' };\n`;
  const findings = findPiiMatches(poisoned, 'core.js');
  assert.equal(findings.length, 1);
  assert.equal(findings[0].kind, 'phone');
  assert.equal(findings[0].value, CANARY_PHONE);
});

test('canary: a realistic CNIC injected into a shipped-source string is caught', () => {
  const findings = findPiiMatches(`cnic: '${CANARY_CNIC}'`, 'app.js');
  assert.equal(findings.length, 1);
  assert.equal(findings[0].kind, 'cnic');
});

test('canary: a seeded roster entry injected into a copy of default-customers.js is caught', () => {
  const original = readSource('default-customers.js');
  const poisoned = original.replace(
    'export const DEFAULT_CUSTOMER_ROSTER = Object.freeze([]);',
    `export const DEFAULT_CUSTOMER_ROSTER = Object.freeze([entry('${CANARY_NAME}', 'BARRIAN')]);`
  );
  assert.notEqual(poisoned, original, 'canary injection point not found — update the canary if the roster line moved');
  assert.equal(findRosterSeedCalls(poisoned).length, 1);
  assert.deepEqual(findRosterSeedCalls(original), []);
});

test('canary: a seeded name injected into a copy of the core.js INITIAL_NAMES literal is caught', () => {
  const original = readSource('core.js');
  const poisoned = original.replace(
    'export const INITIAL_NAMES = Object.freeze([]);',
    `export const INITIAL_NAMES = Object.freeze(['${CANARY_NAME}']);`
  );
  assert.notEqual(poisoned, original, 'canary injection point not found — update the canary if the literal moved');
  assert.equal(initialNamesLiteralInner(poisoned).trim(), `'${CANARY_NAME}'`);
  assert.equal(initialNamesLiteralInner(original).trim(), '');
});
