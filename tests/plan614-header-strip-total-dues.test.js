// Plan 614 — The header strip's "Dues" says which months it covers.
//
// The strip's dues figure is the ALL-MONTHS total (every bill with a
// balance, plus manual baqaya), but its label read the bare "Dues" —
// the same word the current-bill summary beside it uses for the current
// month's net due. The operator could not tell which figure was which
// without reading the code. The label now says "Total dues" (UR
// "کل بقایا") and the zero fallback is aligned the same way ("No total
// dues" / "کوئی کل بقایا نہیں"). No figure change, no new key: the
// three phs_* keys keep their names and only their values move, so the
// key count does not move either. The same three values move in
// DEFAULT_PHS_LABELS (profile-header-strip.js), which is what the
// no-labels calls render.
//
// This file asserts NO key-count total (values move, the count stays).
// It must contain NEITHER the current nor the previous count's bare
// digits, and no split-literal form of them either — the plan591 G5a
// sweep and the pnl count are the enforcement.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { TRANSLATIONS } from '../nav-language.js';
import {
  buildProfileHeaderStrip,
  profileHeaderStripHtml,
  profileHeaderStripText,
} from '../profile-header-strip.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const appJs = readFileSync(join(root, 'app.js'), 'utf8');

function baseStrip(overrides = {}) {
  return {
    customerId: 'CUST-1',
    customerName: 'Test Customer',
    outstanding: 3000,
    packageLabel: '5 Mbps — 200 GB',
    packagePrice: 2000,
    lastPayment: { date: '2026-10-19', amount: 2000 },
    nextDueDate: '2026-11-05',
    ...overrides,
  };
}

const strip = buildProfileHeaderStrip(baseStrip());
const zero = buildProfileHeaderStrip(baseStrip({ outstanding: 0 }));
const html = profileHeaderStripHtml(strip);
const zeroHtml = profileHeaderStripHtml(zero);
const text = profileHeaderStripText(strip);
const urLabels = {
  dues: TRANSLATIONS.ur.phs_dues,
  noAmountDue: TRANSLATIONS.ur.phs_no_amount_due,
  noAmountDueText: TRANSLATIONS.ur.phs_no_amount_due_text,
};
const urHtml = profileHeaderStripHtml(strip, undefined, urLabels);
const urZeroHtml = profileHeaderStripHtml(zero, undefined, urLabels);

test('C1: the strip label names the scope — "Total dues", not the bare "Dues"', () => {
  assert.ok(html.includes('>Total dues<'), 'the html label is the scoped "Total dues"');
  assert.ok(!html.includes('>Dues<'), 'the bare "Dues" label is gone');
  assert.equal(TRANSLATIONS.en.phs_dues, 'Total dues', 'the EN key carries the scoped label');
});

test('C2: the zero-dues fallback is aligned the same way', () => {
  assert.ok(zeroHtml.includes('No total dues'), 'the html zero fallback is scoped');
  assert.ok(!zeroHtml.includes('No amount due'), 'the bare "No amount due" fallback is gone');
  assert.equal(TRANSLATIONS.en.phs_no_amount_due, 'No total dues', 'the EN fallback key is scoped');
  assert.equal(TRANSLATIONS.en.phs_no_amount_due_text, 'No total dues.', 'the EN text fallback key is scoped');
});

test('C3: the text sentence carries the scoped label too', () => {
  assert.match(text, /Total dues PKR 3000\./, 'the text sentence uses the scoped label');
});

test('S1: the figure itself does not move (all-months total, verbatim)', () => {
  assert.equal(strip.dues, 3000, 'the dues figure is unchanged');
  assert.equal(strip.duesCents, 300000, 'the dues cents are unchanged');
  assert.equal(zero.dues, 0, 'zero stays zero');
});

test('S2: the current-bill summary keeps its own "Net due balance" label', () => {
  assert.equal(TRANSLATIONS.en.prof_current_net_due, 'Net due balance', 'current-month net due label untouched');
  assert.equal(TRANSLATIONS.ur.prof_current_net_due, 'خالص واجب بقایا', 'UR current-month label untouched');
  assert.ok(appJs.includes("t('prof_current_net_due')"), 'the summary still renders its own key');
});

test('B1: the scoped label reads in Urdu mode', () => {
  assert.ok(urHtml.includes('>کل بقایا<'), 'the UR strip shows the scoped label');
  assert.ok(!urHtml.includes('>بقایا<'), 'the bare UR "بقایا" label is gone');
  assert.ok(urZeroHtml.includes('کوئی کل بقایا نہیں'), 'the UR zero fallback is scoped');
  assert.equal(TRANSLATIONS.ur.phs_dues, 'کل بقایا', 'the UR key carries the scoped label');
  assert.match(TRANSLATIONS.ur.phs_dues, /[\u0600-\u06FF]/, 'the UR label carries Urdu script');
});
