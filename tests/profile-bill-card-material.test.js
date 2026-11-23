// Profile monthly bill card — Material Design 3 / fintech receipt redesign
// (user decision 2026-11-22). Ported from the prep repro
// (repro-profile-bill-card.mjs): 15 tests, C1–C9 + S1–S5 + B2.
// NOT a pinning file — 0 parity literals.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const appSrc = readFileSync(join(root, 'app.js'), 'utf8');
const stylesSrc = readFileSync(join(root, 'styles.css'), 'utf8');
const { TRANSLATIONS } = await import(pathToFileURL(join(root, 'nav-language.js')).href);

const en = TRANSLATIONS.en || {};
const ur = TRANSLATIONS.ur || {};

// The summary template (renderHistory's summaryMarkup assignment).
function summaryTemplate() {
  const start = appSrc.indexOf('const summaryMarkup = !bill ?');
  if (start === -1) return '';
  return appSrc.slice(start, appSrc.indexOf('`;', start));
}

// The hero strip block: the first element whose class contains "hero"
// inside the summary template (or '' when the card has no hero yet).
function heroBlock() {
  const tpl = summaryTemplate();
  const m = tpl.match(/<[^>]*class="[^"]*hero[^"]*"[^>]*>([\s\S]{0,1200})/);
  return m ? m[0] : '';
}

// The ledger block: the first element whose class contains "ledger"
// inside the summary template (or '' when the card has no ledger yet).
function ledgerBlock() {
  const tpl = summaryTemplate();
  const m = tpl.match(/<[^>]*class="[^"]*ledger[^"]*"[^>]*>([\s\S]{0,1200})/);
  return m ? m[0] : '';
}

// CSS rule bodies for rules whose selector text contains any needle.
function cssBodies(needles) {
  const out = [];
  const re = /([^{}]+)\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(stylesSrc)) !== null) {
    if (needles.some((n) => m[1].includes(n))) out.push(m[2]);
  }
  return out.join(' ');
}

// --- C tests: the fixed state (FAIL on base) ---

test('C1: hero strip replaces the Status / due-date / Balance-due bubbles', () => {
  const tpl = summaryTemplate();
  // The three hero-absorbed figures must no longer render as stat pills.
  for (const key of ['prof_hist_status', 'prof_hist_due_date', 'prof_hist_balance_due']) {
    assert.ok(!new RegExp(`month-summary-stat[^<]*t\\('${key}'\\)`).test(tpl),
      `summary still renders ${key} as a month-summary-stat bubble`);
  }
  const hero = heroBlock();
  assert.ok(hero.length > 0, 'no hero strip element in the month summary');
  assert.ok(hero.includes('balanceDue'), 'hero must show the balance-due figure');
  assert.ok(hero.includes('humanDate(bill.dueDate)'), 'hero must show the due date');
  assert.ok(hero.includes('status.label'), 'hero must carry the compact status chip');
  // 'Due {date}' prefix: a new i18n key or a literal next to the date.
  const dueKey = Object.values(en).some((v) => typeof v === 'string' && /Due \{date\}/.test(v));
  assert.ok(dueKey || hero.includes('Due'), 'hero must label the date as Due');
});

test('C2: ledger rows replace the Bill-amount / receipts / carry-in bubbles', () => {
  const tpl = summaryTemplate();
  for (const key of ['prof_hist_receipts', 'prof_hist_carry_in', 'prof_hist_bill_amount']) {
    assert.ok(!new RegExp(`month-summary-stat[^<]*t\\('${key}'\\)`).test(tpl),
      `summary still renders ${key} as a month-summary-stat bubble`);
  }
  const ledger = ledgerBlock();
  assert.ok(ledger.length > 0, 'no ledger element in the month summary');
  assert.equal(en.prof_hist_bill_amount, 'Bill Amount', 'bill-amount label must be the concise mobile label');
  assert.equal(en.prof_hist_receipts, 'Paid (Cash)', 'receipts label must be the concise mobile label');
  assert.equal(en.prof_hist_carry_in, 'Carry-in Credit', 'carry-in label must be the concise mobile label');
  assert.ok(ledger.includes('prof_hist_bill_amount') || ledger.includes('Bill Amount'), 'ledger must carry the bill-amount row');
  assert.ok(ledger.includes('prof_hist_receipts') || ledger.includes('Paid (Cash)'), 'ledger must carry the paid row');
  assert.ok(ledger.includes('prof_hist_carry_in') || ledger.includes('Carry-in Credit'), 'ledger must carry the carry-in row');
});

test('C3: late-fee button is a full-width 48px tonal button with no blue capsule', () => {
  // The button lives in the applyFeeBtnMarkup variable (app.js:6887), not
  // inline in the summary template — so the wrapper/survival checks read
  // app.js, not the template slice. (Port fix: the prep repro asserted
  // these two on the template, where neither string can ever appear.)
  assert.ok(!appSrc.includes('<span class="month-summary-wide"><button type="button" class="apply-late-fee-btn"'),
    'apply-late-fee button is still wrapped in the blue month-summary-wide capsule');
  assert.ok(appSrc.includes('class="apply-late-fee-btn" data-apply-late-fee'),
    'apply-late-fee button must survive the redesign');
  const btn = cssBodies(['.apply-late-fee-btn']);
  assert.ok(/width:\s*100%/.test(btn), 'late-fee button must be full-width');
  assert.ok(/min-height:\s*48px/.test(btn), 'late-fee button must be 48dp tall');
  assert.ok(/border-radius:\s*12px/.test(btn), 'late-fee button must be rounded-xl, not 4px');
  assert.ok(/background:\s*(#f59e0b|var\(--qc-amber-strong-border\))/.test(btn), 'late-fee button keeps the amber-500 fill');
});

test('C4: snapshot note is a 1-line footnote, not the 3-line blue info box', () => {
  // The rendered text is short either way the implementer shapes it:
  // a new footnote key, or the existing key's value shortened.
  const shortEn = (en.prof_hist_snapshot_footnote && /Auto-generated snapshot/.test(en.prof_hist_snapshot_footnote))
    || /Auto-generated snapshot · \{amount\}/.test(en.prof_hist_snapshot_note || '');
  assert.ok(shortEn, 'no short snapshot-footnote text in English (new key or shortened value)');
  const note = appSrc.slice(appSrc.indexOf('const generatedNote ='), appSrc.indexOf('const generatedNote =') + 400);
  assert.ok(note.includes('bill.priceSnapshot'), 'footnote must still show the snapshot amount');
  const bodies = cssBodies(['.month-card .bill-snapshot-note', '.bill-snapshot-note']);
  assert.ok(!/background:\s*#e5efff/.test(bodies), 'snapshot note must lose the blue info-box background');
  assert.ok(/font-size:\s*12px/.test(bodies), 'footnote must be 12px (text-xs)');
});

test('C5: Update bill details is a full-width outlined button at the bottom of the card', () => {
  const forms = appSrc.slice(appSrc.indexOf('const formsMarkup ='), appSrc.indexOf('const formsMarkup =') + 600);
  assert.ok(forms.includes("t('prof_hist_bill_update')"), 'bill form must keep its Update-bill-details label');
  // The heading element (h4 restyled, or a real button) must carry the
  // button treatment: a rule for the bill-form heading / update control
  // that is full-width, 44px, outlined.
  const bodies = cssBodies(['.bill-form h4', 'bill-update-btn', 'bill-update-button', '.month-card .bill-form h4']);
  assert.ok(/width:\s*100%/.test(bodies), 'update control must be full-width');
  assert.ok(/min-height:\s*44px/.test(bodies), 'update control must be 44px tall');
  assert.ok(/border:\s*1px solid/.test(bodies), 'update control must be outlined');
});

test('C6: hero strip CSS is a tinted amber header (tokens only, no new hex)', () => {
  const bodies = cssBodies(['month-hero', 'bill-hero']);
  assert.ok(bodies.length > 0, 'no hero strip rule in styles.css');
  assert.ok(/background:\s*var\(--qc-amber-soft-bg\)/.test(bodies), 'hero must use the amber-50 token');
  assert.ok(/border:\s*1px solid var\(--ds-warning-border\)/.test(bodies), 'hero border must use the amber-200 token');
  assert.ok(/border-radius:\s*16px/.test(bodies), 'hero must be rounded-2xl');
  assert.ok(/justify-content:\s*space-between/.test(bodies), 'hero must space the balance left and the due+chip right');
});

test('C7: ledger CSS is a clean key-value list with tabular-nums semibold figures', () => {
  const bodies = cssBodies(['month-ledger', 'bill-ledger']);
  assert.ok(bodies.length > 0, 'no ledger rule in styles.css');
  assert.ok(/font-variant-numeric:\s*tabular-nums/.test(bodies), 'ledger figures must use tabular-nums');
  assert.ok(/font-weight:\s*600/.test(bodies), 'ledger figures must be semibold');
});

test('C8: no oval-bubble stat remains for the six redesigned figures', () => {
  const tpl = summaryTemplate();
  const bubbleKeys = ['prof_hist_status', 'prof_hist_due_date', 'prof_hist_receipts',
    'prof_hist_carry_in', 'prof_hist_bill_amount', 'prof_hist_balance_due'];
  const remaining = bubbleKeys.filter((k) => new RegExp(`month-summary-stat[^<]*t\\('${k}'\\)`).test(tpl));
  assert.deepEqual(remaining, [], `these figures still render as oval bubbles: ${remaining.join(', ')}`);
});

// --- S tests: stability (PASS on base AND with the fix) ---

test('S1: late-fee handler still binds data-apply-late-fee and applies via the engine', () => {
  assert.ok(appSrc.includes("querySelectorAll('[data-apply-late-fee]')"), 'late-fee binding lost');
  assert.ok(appSrc.includes('applyLateFeeToBill(state, custId, month'), 'late-fee engine call lost');
});

test('S2: bill form keeps its fields and submit', () => {
  assert.ok(appSrc.includes('name="dueAmount"'), 'bill amount input lost');
  assert.ok(appSrc.includes('name="dueDate"'), 'due-date input lost');
  assert.ok(appSrc.includes('data-kind="bill"'), 'bill form data-kind lost');
  assert.ok(appSrc.includes("t('prof_hist_bill_save')"), 'bill save label lost');
});

test('S3: payment list still renders under the summary', () => {
  assert.ok(appSrc.includes('<ul class="payment-list"'), 'payment list lost');
  assert.ok(appSrc.includes('class="payment-row'), 'payment rows lost');
});

test('S4: month-card header chip still uses statusPresentation', () => {
  assert.ok(appSrc.includes('statusPresentation(customer, bill, allocations)'), 'status presentation call lost');
  assert.ok(appSrc.includes('<span class="month-status ${status.className}">${status.label}</span>'), 'header status chip lost');
});

test('S5: EN/UR parity holds for every prof_hist key', () => {
  for (const key of Object.keys(en)) {
    if (!key.startsWith('prof_hist_')) continue;
    assert.ok(key in ur, `prof_hist key ${key} missing in Urdu`);
  }
  for (const key of Object.keys(ur)) {
    if (!key.startsWith('prof_hist_')) continue;
    assert.ok(key in en, `prof_hist key ${key} missing in English`);
  }
});

// --- B tests: behaviour ---

test('C9: hero balance figure is the allocation engine figure, not a new number', () => {
  const hero = heroBlock();
  assert.ok(hero.length > 0, 'no hero block to check');
  assert.ok(hero.includes('balanceDue'), 'hero must read the existing balanceDue variable');
  assert.ok(!hero.includes('totalOutstandingFigures'), 'hero must not switch to a different dues helper');
});

test('B2: concession round50 toggle still resolves through its wrapper', () => {
  // The handler reads the toggle via button.closest('.month-summary-wide');
  // whatever wrapper the concession row keeps, the handler must query it.
  const handler = appSrc.slice(appSrc.indexOf("querySelectorAll('[data-apply-concession]')"));
  const closest = handler.match(/button\.closest\('([^']+)'\)/);
  assert.ok(closest, 'concession handler lost its closest() lookup');
  const wrapClass = closest[1].replace(/^\./, '');
  assert.ok(appSrc.includes(`class="${wrapClass}"`) || appSrc.includes(`class="month-summary-wide"`),
    `concession row no longer carries the wrapper class the handler queries (${wrapClass})`);
  assert.ok(appSrc.includes('data-round50-toggle'), 'round50 toggle lost');
});
