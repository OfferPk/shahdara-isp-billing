import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { TRANSLATIONS, t } from '../nav-language.js';
import { packageChangePreviewStoredText } from '../package-change-preview.js';
import { speedBoostProfileSectionHtml } from '../profile-ui.js';

const dir = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(dir, '..', name), 'utf8');
const app = read('app.js');
const styles = read('styles.css');

// Profile Polish D (user spec 2026-11-12, items (16)–(17) of the
// 22-part profile spec):
// (16) Service & Package in PILL style, UNIQUE colour; all fields the
// SAME style/size, FULL words visible (nothing clipped); 'ISP provider'
// (no slash); NO underscores anywhere; tapping a field fills customer
// info (opens the edit form at that field, already filled with the
// customer's saved info); group the service fields (Service status,
// vacation hold, do not suspend, package speed, usual pay, connection,
// cancellation, speed boosts, boost speed, add-on fee); 'Add boost'
// NORMAL size.
// (17) Package change preview texts (the long explainer, 'No package
// change preview kept yet', 'Proposed package') as PILLS/compact.
// No figure changes anywhere: the same labels (minus the slash), the
// same values, the same wiring — only what shows, in what shape, and
// what a tap does.
//
// Scope notes, stated plainly:
// - The lifecycle fragment (Expiry, Cancellation date) stays its own
//   fragment — polish28-phase-a pins expiry/cancellation there, and
//   plan506 slices the fragments literal on the 'lifecycle:' marker —
//   so the grouping is one shared pill style across the two adjacent
//   fragments in the Service section, not a merge.
// - 'Connection' in the user's list is the connection date, shown in
//   the Service tenure pill (Polish C) and in full in Connection &
//   Installation; it is not duplicated into the service group.
// - The unique service colour is the teal ID-pill slot-6 palette
//   (#e7f2ec / #0e5b4d / #9acbad): no other profile section uses it
//   for its fields. No new hex anywhere.
// - Usual pay day is DERIVED from payment history — no edit control
//   exists for it, so it carries no tap target (never an invented
//   link, the profile-error-jump rule). The other eight service rows
//   each map to a real edit-form control id.

// ------------------------------------------------------------ labels

const SERVICE_LABEL_KEYS = [
  'prof_field_isp',
  'prof_field_service_status',
  'prof_field_hold',
  'prof_field_shield',
  'prof_field_seasonal',
  'prof_field_package',
  'prof_field_payday',
  'prof_field_expiry',
  'prof_field_cancel_date',
];

test('Polish D (16): service labels — ISP provider and Package speed with no slash, Do not suspend without hyphens', () => {
  assert.equal(t('prof_field_isp', 'en'), 'ISP provider');
  assert.equal(t('prof_field_isp', 'ur'), 'آئی ایس پی فراہم کنندہ');
  assert.equal(t('prof_field_package', 'en'), 'Package speed');
  assert.equal(t('prof_field_package', 'ur'), 'پیکیج رفتار');
  assert.equal(t('prof_field_shield', 'en'), 'Do not suspend');
  // The other service labels are unchanged.
  assert.equal(t('prof_field_service_status', 'en'), 'Service status');
  assert.equal(t('prof_field_hold', 'en'), 'Vacation hold');
  assert.equal(t('prof_field_payday', 'en'), 'Usual pay day');
  assert.equal(t('prof_field_cancel_date', 'en'), 'Cancellation date');
});

test('Polish D (16): NO underscores anywhere in the service labels, and no slash in the renamed ones', () => {
  for (const key of SERVICE_LABEL_KEYS) {
    for (const lang of ['en', 'ur']) {
      const value = TRANSLATIONS[lang][key];
      assert.ok(typeof value === 'string' && value.length > 0, `${key} must resolve in ${lang}`);
      assert.ok(!value.includes('_'), `${key} (${lang}) must not contain an underscore: ${value}`);
    }
  }
  for (const key of ['prof_field_isp', 'prof_field_package']) {
    for (const lang of ['en', 'ur']) {
      assert.ok(!TRANSLATIONS[lang][key].includes('/'), `${key} (${lang}) must not contain a slash`);
    }
  }
});

// ------------------------------------------------------------ pill grouping

function groupsLiteral() {
  const start = app.indexOf('const profileInfoGroupFragments = {');
  assert.notEqual(start, -1, 'fragments object must exist');
  return app.slice(start, app.indexOf('\n', start));
}

test('Polish D (16): the Service and lifecycle groups share one service pill class, in the Service section', () => {
  const groups = groupsLiteral();
  const serviceAt = groups.indexOf("service: profileInfoGroupMarkup(t('prof_group_service')");
  assert.notEqual(serviceAt, -1, 'service fragment must exist');
  const lifecycleAt = groups.indexOf("lifecycle: profileInfoGroupMarkup(t('prof_group_connection')");
  assert.notEqual(lifecycleAt, -1, 'lifecycle fragment must exist');
  assert.ok(groups.indexOf("'profile-info-group--service'", serviceAt) !== -1, 'service fragment takes the service pill class');
  assert.ok(groups.indexOf("'profile-info-group--service'", lifecycleAt) !== -1, 'lifecycle fragment takes the same service pill class');
  // Both fragments still render in the Service section body, adjacent.
  assert.ok(app.includes('${profileInfoGroupFragments.service}${profileInfoGroupFragments.lifecycle}'), 'service + lifecycle stay adjacent in the Service section body');
  // The lifecycle rows stay in the lifecycle fragment (polish28-phase-a).
  const lifecycle = groups.slice(lifecycleAt, groups.indexOf('install:', lifecycleAt));
  assert.ok(lifecycle.includes('customer.expiryDate ? humanDate(customer.expiryDate) : PROFILE_EMPTY_DASH'), 'expiry stays in the lifecycle fragment');
  assert.ok(lifecycle.includes('customer.cancellationDate ? humanDate(customer.cancellationDate) : PROFILE_EMPTY_DASH'), 'cancellation stays in the lifecycle fragment');
});

test('Polish D (16): the service pill is one teal pill, same size for every field, full words wrap', () => {
  const rule = styles.match(/\.profile-info-group--service \.profile-readonly-field\{[^}]*\}/);
  assert.ok(rule, 'the service pill rule must exist');
  assert.ok(rule[0].includes('border-radius:999px'), 'a real pill');
  assert.ok(rule[0].includes('background:#e7f2ec'), 'the service teal background');
  assert.ok(rule[0].includes('border:1px solid #9acbad'), 'the service teal border');
  assert.ok(rule[0].includes('padding:8px 12px'), 'one padding for every field');
  const dtRule = styles.match(/\.profile-info-group--service \.profile-readonly-field dt\{[^}]*\}/);
  const ddRule = styles.match(/\.profile-info-group--service \.profile-readonly-field dd\{[^}]*\}/);
  assert.ok(dtRule && dtRule[0].includes('color:#0e5b4d'), 'label in the service teal');
  assert.ok(ddRule && ddRule[0].includes('color:#0e5b4d'), 'value in the service teal');
  // Same sizes as the plain readonly field (dt 10px, dd 12px) — the
  // pill rule sets no font-size of its own, so nothing shrinks.
  assert.ok(!rule[0].includes('font-size'), 'the pill sets no font-size — fields keep the base sizes');
  assert.ok(styles.includes('.profile-readonly-field dt{margin:0 0 4px;color:#5b7067;font-size:10px;font-weight:700}'), 'base label size still 10px');
  assert.ok(styles.includes('.profile-readonly-field dd{margin:0;color:#1d382d;font-size:12px;line-height:1.4;overflow-wrap:anywhere;white-space:pre-wrap}'), 'base value still 12px with wrapping (full words, nothing clipped)');
});

// ------------------------------------------------------------ tap to edit

function groupMarkupFunctions() {
  // Plan 506's extraction: the two functions are pure except for the
  // escapeHtml + PROFILE_EMPTY_DASH sandbox, so they run headless.
  const start = app.indexOf('function profileReadonlyField(');
  assert.notEqual(start, -1, 'profileReadonlyField must exist');
  const markupStart = app.indexOf('function profileInfoGroupMarkup(');
  assert.notEqual(markupStart, -1, 'profileInfoGroupMarkup must exist');
  const end = app.indexOf('\n}\n', markupStart);
  assert.notEqual(end, -1, 'profileInfoGroupMarkup must end cleanly');
  const src = app.slice(start, end + 3);
  const escapeHtml = (value) => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return runInNewContext(`${src}\nprofileInfoGroupMarkup;`, { escapeHtml, PROFILE_EMPTY_DASH: '—' });
}

test('Polish D (16): a field without a tap target renders exactly as before — no attribute, no class', () => {
  const markup = groupMarkupFunctions();
  const html = markup('Service', [['ISP provider', 'Nayatel'], ['Package speed', '5 Mbps']]);
  assert.ok(html.startsWith('<section class="profile-info-group"><h4>Service</h4>'), 'section and heading unchanged without a class');
  assert.ok(!html.includes('data-profile-field-edit'), 'no tap attribute without a target');
  assert.ok(!html.includes('profile-readonly-field--tap'), 'no tap class without a target');
  assert.ok(html.includes('<dt>ISP provider</dt>'), 'labels unchanged');
});

test('Polish D (16): a field with a tap target renders the edit link, keyboard-focusable, value still escaped', () => {
  const markup = groupMarkupFunctions();
  const html = markup('Service', [['ISP provider', 'Nayatel', false, '', 'ispProviderInput']], '', 'profile-info-group--service');
  assert.ok(html.startsWith('<section class="profile-info-group profile-info-group--service"><h4>Service</h4>'), 'the class lands on the section');
  assert.ok(html.includes('data-profile-field-edit="ispProviderInput"'), 'the tap target is the edit-form control id');
  assert.ok(html.includes('tabindex="0" role="button"'), 'keyboard-focusable with a button role');
  assert.ok(html.includes('profile-readonly-field--tap'), 'the tap class marks it tappable');
  const escaped = markup('Service', [['ISP provider', 'A & B <C>', false, '', 'ispProviderInput']]);
  assert.ok(escaped.includes('A &amp; B &lt;C&gt;'), 'the value is still escaped with a tap target');
  const empty = markup('Service', [['ISP provider', '—', false, '', 'ispProviderInput']]);
  assert.ok(empty.includes('<span class="profile-empty-value">—</span>'), 'the empty dash still renders as the empty-value span');
});

test('Polish D (16): every editable service row maps to a real edit-form control; Usual pay day has none', () => {
  const groups = groupsLiteral();
  const targets = {
    isp: "'ispProviderInput'",
    status: "'serviceStatusInput'",
    hold: "'pauseBillingCheckbox'",
    shield: "'doNotSuspendUntilInput'",
    seasonal: "'seasonalRateInput'",
    package: "'packageSpeedInput'",
    expiry: "'expiryDateInput'",
    cancellation: "'cancellationDateInput'",
  };
  for (const [field, id] of Object.entries(targets)) {
    assert.ok(groups.includes(id), `${field} must tap to ${id}`);
  }
  // Usual pay day is derived from payment history — no edit control
  // exists, so the row carries no fifth element at all.
  assert.ok(groups.includes("[t('prof_field_payday'), paydaySummary.label]"), 'the payday row has no tap target');
  assert.ok(!groups.includes('paydaySummary.label, false'), 'no invented tap target for payday');
});

test('Polish D (16): tapping a service field opens the edit form at that field (checklist pattern)', () => {
  assert.ok(app.includes("querySelectorAll('[data-profile-field-edit]')"), 'the tap wiring queries the tap targets');
  assert.ok(app.includes("jumpToProfileErrorTarget({ kind: 'field', id: field.dataset.profileFieldEdit })"), 'the tap jumps to the field, like the missing-fields checklist');
  assert.ok(app.includes("if (event.key === 'Enter' || event.key === ' ')"), 'keyboard users get the same jump via Enter/Space');
});

// ------------------------------------------------------------ boost rows + Add boost

test('Polish D (16): speed-boost log rows are service pills in the same teal, after the SISP-106 no-hex block', () => {
  const focusAt = styles.indexOf('.boost-add-form input:focus');
  assert.notEqual(focusAt, -1, 'the SISP-106 block must still end at input:focus');
  const rule = styles.match(/\.profile-boost-section \.profile-boost-list li\{[^}]*\}/);
  assert.ok(rule, 'the boost pill rule must exist');
  assert.ok(styles.indexOf(rule[0]) > focusAt, 'the boost pill rule sits after the SISP-106 block, so its hex cannot trip the no-hex test');
  assert.ok(rule[0].includes('border-radius:999px'), 'a real pill');
  assert.ok(rule[0].includes('background:#e7f2ec') && rule[0].includes('border:1px solid #9acbad'), 'the same service teal');
  const spanRule = styles.match(/\.profile-boost-section \.profile-boost-list li span\{[^}]*\}/);
  assert.ok(spanRule && spanRule[0].includes('color:#0e5b4d'), 'boost text in the service teal');
});

test('Polish D (16): Add boost is NORMAL size — it no longer stretches the full form width', () => {
  const rule = styles.match(/\.boost-add-form #profileBoostAddBtn\{[^}]*\}/);
  assert.ok(rule, 'the Add boost size rule must exist');
  assert.ok(rule[0].includes('justify-self:start'), 'the button sizes to its content');
  const html = speedBoostProfileSectionHtml({}, { todayStr: '2026-11-13', formatAmountFn: (n) => `PKR ${n}` });
  assert.ok(html.includes('id="profileBoostAddBtn"'), 'the Add boost button is still rendered');
  assert.ok(html.includes('class="profile-boost-section"'), 'the boost section is still rendered');
});

// ------------------------------------------------------------ preview texts

test('Polish D (17): the package-change preview explainer is an info note, wording unchanged', () => {
  assert.ok(app.includes('<p class="pcp-explainer">Before agreeing a faster or cheaper package,'), 'the explainer carries its info-note class');
  assert.ok(app.includes('This preview applies nothing; the change itself is still made through the profile Edit form, and a ready preview shown here is kept as a note on that change.</p>'), 'the explainer wording is unchanged');
  const rule = styles.match(/\.pcp-explainer\{[^}]*\}/);
  assert.ok(rule && rule[0].includes('background:#e5efff'), 'the explainer takes the info blue');
  assert.ok(rule && rule[0].includes('border-radius:12px'), 'the long explainer is an info note, not a one-line pill');
});

test('Polish D (17): the kept-preview line is a real pill — "No package change preview kept yet" when none is kept', () => {
  assert.equal(packageChangePreviewStoredText(null), 'No package change preview kept yet', 'the empty-state wording is unchanged');
  assert.ok(app.includes('<p id="packageChangePreviewKept" class="pcp-kept-pill">'), 'the kept-preview line carries its pill class');
  const rule = styles.match(/\.pcp-kept-pill\{[^}]*\}/);
  assert.ok(rule && rule[0].includes('border-radius:999px'), 'a real pill');
  assert.ok(rule && rule[0].includes('background:#e5efff') && rule[0].includes('color:#174b87') && rule[0].includes('border:1px solid #adc9f1'), 'the info-blue palette');
  assert.ok(rule && rule[0].includes('overflow-wrap:anywhere'), 'the kept line wraps instead of clipping');
});

test('Polish D (17): "Proposed package" is a compact pill chip on the preview form label', () => {
  assert.ok(app.includes('<span class="pcp-field-pill">Proposed package</span> <select id="packageChangePreviewPackage">'), 'the label words sit in a pill chip, the select follows it');
  const rule = styles.match(/\.pcp-field-pill\{[^}]*\}/);
  assert.ok(rule && rule[0].includes('border-radius:999px'), 'a real pill chip');
  assert.ok(rule && rule[0].includes('background:#e5efff') && rule[0].includes('color:#174b87') && rule[0].includes('border:1px solid #adc9f1'), 'the info-blue palette');
  // The form controls themselves are untouched here — item (19) in
  // Polish E gives them the one consistent button style.
  assert.ok(app.includes('id="packageChangePreviewDate"'), 'the Effective date control is unchanged');
  assert.ok(app.includes('id="packageChangePreviewMonth"'), 'the Next bill month control is unchanged');
});

// ------------------------------------------------------------ ratchet

test('Polish D ratchet: styles.css still 614 distinct hex (no new hard-coded colour)', () => {
  const stripped = styles.replace(/\/\*[\s\S]*?\*\//g, '');
  const distinct = new Set(stripped.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || []);
  assert.equal(distinct.size, 614, 'styles.css must stay at 614 distinct hex (no new hard-coded colour)');
});

test('Polish D: no real customer names or phone numbers in this test', () => {
  const testSrc = read('tests/profile-polish-d.test.js');
  const phoneShape = /(?:\+92|03)\d[\d\s-]{8,}\d/;
  assert.ok(!phoneShape.test(testSrc), 'test must not contain a realistic phone number');
});
