import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CONTACT_PREFERENCE_LANGUAGES,
  CONTACT_PREFERENCE_NO_REASON,
  normalizeContactPreference,
  normalizeContactPreferences,
  findContactPreference,
  upsertContactPreference,
  removeContactPreference,
  resolveContactRecipient,
  applyContactPreferenceToDraft,
  applyContactPreferencesToDrafts,
  applyContactPreferencesToAudience,
  contactPreferencesSummaryText,
  contactPreferenceHtml,
  contactPreferenceCsv,
} from '../contact-preferences.js';

const prefs = [
  { customerId: 'c1', customerName: 'Ahmed', whatsappNumber: '03001112222', language: 'urdu', doNotMessage: false },
  { customerId: 'c2', customerName: 'Bilal', language: 'roman', doNotMessage: true, doNotMessageReason: 'Customer asked for no messages' },
  { customerId: 'c3', customerName: 'Chaudhry', doNotMessage: true },
];

const customers = [
  { id: 'c1', name: 'Ahmed', phone: '03009998888', whatsappPhone: '03007776666' },
  { id: 'c2', name: 'Bilal', phone: '03005554444' },
  { id: 'c3', name: 'Chaudhry', phone: '03003332222' },
  { id: 'c4', name: 'Danish', phone: '03001110000' },
];

test('normalise: unknown language becomes unset, never a guessed language', () => {
  const pref = normalizeContactPreference({ customerId: 'x', language: 'english' });
  assert.equal(pref.language, null);
  assert.equal(normalizeContactPreference({ customerId: 'x', language: 'URDU' }).language, null);
});

test('normalise: missing customer id is invalid, reason without the flag is cleared', () => {
  assert.equal(normalizeContactPreference({ language: 'urdu' }), null);
  assert.equal(normalizeContactPreference(null), null);
  const pref = normalizeContactPreference({ customerId: 'x', doNotMessage: false, doNotMessageReason: 'old reason' });
  assert.equal(pref.doNotMessage, false);
  assert.equal(pref.doNotMessageReason, '');
});

test('normalise: opt-out accepts boolean true and the string "true", not "false"', () => {
  assert.equal(normalizeContactPreference({ customerId: 'x', doNotMessage: true }).doNotMessage, true);
  assert.equal(normalizeContactPreference({ customerId: 'x', doNotMessage: 'true' }).doNotMessage, true);
  assert.equal(normalizeContactPreference({ customerId: 'x', doNotMessage: 'false' }).doNotMessage, false);
});

test('normalise list: duplicates collapse, last edit wins', () => {
  const list = normalizeContactPreferences([
    { customerId: 'c1', language: 'roman' },
    { customerId: 'c1', language: 'urdu', whatsappNumber: '03001112222' },
    { language: 'urdu' },
  ]);
  assert.equal(list.length, 1);
  assert.equal(list[0].language, 'urdu');
  assert.equal(list[0].whatsappNumber, '03001112222');
});

test('find: returns the normalised preference, null when absent', () => {
  assert.equal(findContactPreference(prefs, 'c1').language, 'urdu');
  assert.equal(findContactPreference(prefs, 'c9'), null);
  assert.equal(findContactPreference(prefs, '  '), null);
});

test('upsert: replaces one customer and leaves the rest untouched; invalid row changes nothing', () => {
  const updated = upsertContactPreference(prefs, { customerId: 'c1', language: 'roman' });
  assert.equal(updated.length, 3);
  assert.equal(updated.find((p) => p.customerId === 'c1').language, 'roman');
  assert.equal(updated.find((p) => p.customerId === 'c2').language, 'roman');
  const added = upsertContactPreference(prefs, { customerId: 'c4', language: 'urdu' });
  assert.equal(added.length, 4);
  assert.equal(upsertContactPreference(prefs, { language: 'urdu' }).length, 3);
  assert.equal(prefs.length, 3, 'input list is not mutated');
});

test('remove: drops only the named customer', () => {
  const remaining = removeContactPreference(prefs, 'c2');
  assert.equal(remaining.length, 2);
  assert.equal(remaining.some((p) => p.customerId === 'c2'), false);
});

test('resolve: preferred number wins; otherwise WhatsApp number, then billing phone', () => {
  assert.equal(resolveContactRecipient({ customer: customers[0], preference: prefs[0] }).whatsappNumber, '03001112222');
  const noPref = resolveContactRecipient({ customer: customers[0], preference: null });
  assert.equal(noPref.whatsappNumber, '03007776666');
  assert.equal(resolveContactRecipient({ customer: customers[1], preference: null }).whatsappNumber, '03005554444');
  assert.equal(resolveContactRecipient({ customer: { id: 'c9' }, preference: null }).whatsappNumber, '');
});

test('resolve: unset language stays null so the caller keeps its default', () => {
  assert.equal(resolveContactRecipient({ customer: customers[3], preference: null }).language, null);
  assert.equal(resolveContactRecipient({ customer: customers[0], preference: prefs[0] }).language, 'urdu');
});

test('single draft: opted-out customer gets no draft target', () => {
  assert.equal(applyContactPreferenceToDraft(customers[1], prefs), null);
  const ok = applyContactPreferenceToDraft(customers[0], prefs);
  assert.equal(ok.variant, 'urdu');
  assert.equal(ok.whatsappNumber, '03001112222');
  assert.equal(ok.doNotMessage, false);
});

test('draft list: preferred language picks the variant, unset keeps Roman default', () => {
  const seen = [];
  const result = applyContactPreferencesToDrafts({
    items: customers,
    preferences: prefs,
    buildDraft: (item, variant) => { seen.push([item.id, variant]); return `draft-${variant}`; },
  });
  assert.equal(result.counts.total, 4);
  assert.equal(result.counts.drafted, 2);
  assert.equal(result.counts.skipped, 2);
  assert.deepEqual(seen, [['c1', 'urdu'], ['c4', 'roman']]);
  assert.equal(result.drafts.find((d) => d.customerId === 'c1').draftText, 'draft-urdu');
  assert.equal(result.drafts.find((d) => d.customerId === 'c4').draftText, 'draft-roman');
});

test('draft list: skipped rows always carry a reason, even when none was recorded', () => {
  const result = applyContactPreferencesToDrafts({
    items: customers,
    preferences: prefs,
    buildDraft: () => 'draft',
  });
  assert.equal(result.skipped.length, 2);
  assert.equal(result.skipped.find((s) => s.customerId === 'c2').reason, 'Customer asked for no messages');
  assert.equal(result.skipped.find((s) => s.customerId === 'c3').reason, CONTACT_PREFERENCE_NO_REASON);
  assert.equal(result.skipped.find((s) => s.customerId === 'c2').customerName, 'Bilal');
});

test('draft list: undraftable items are counted, never silently dropped', () => {
  const result = applyContactPreferencesToDrafts({
    items: [{ id: 'c4', name: 'Danish', phone: '03001110000' }],
    preferences: [],
    buildDraft: () => null,
  });
  assert.equal(result.counts.excludedUndraftable, 1);
  assert.equal(result.drafts.length, 0);
});

test('draft list: inputs are never mutated', () => {
  const items = [{ id: 'c1', name: 'Ahmed', phone: '03009998888' }];
  const snapshot = JSON.stringify(items);
  applyContactPreferencesToDrafts({ items, preferences: prefs, buildDraft: () => 'draft' });
  assert.equal(JSON.stringify(items), snapshot);
});

test('audience: opted-out customers are excluded and listed as skipped with reasons', () => {
  const result = applyContactPreferencesToAudience({ customers, preferences: prefs });
  assert.equal(result.audience.length, 2);
  assert.equal(result.audience.some((a) => a.customerId === 'c2'), false);
  assert.equal(result.skipped.length, 2);
  assert.equal(result.skipped.find((s) => s.customerId === 'c3').reason, CONTACT_PREFERENCE_NO_REASON);
  assert.equal(result.audience.find((a) => a.customerId === 'c1').whatsappNumber, '03001112222');
});

test('summary: counts preferences, numbers, languages and opt-outs', () => {
  assert.equal(contactPreferencesSummaryText([]), 'No contact preferences saved yet.');
  assert.equal(
    contactPreferencesSummaryText(prefs),
    '3 contact preferences saved (1 with a preferred number, 2 with a preferred language, 2 do-not-message).',
  );
});

test('html: escapes names and numbers, labels languages, shows opt-out reasons', () => {
  const html = contactPreferenceHtml([
    { customerId: 'c1', customerName: '<Ahmed & Co>', whatsappNumber: '03001112222', language: 'urdu', doNotMessage: true, doNotMessageReason: '<no calls>' },
    { customerId: 'c2', customerName: 'Bilal' },
  ]);
  assert.ok(!html.includes('<Ahmed'));
  assert.ok(html.includes('&lt;Ahmed &amp; Co&gt;'));
  assert.ok(html.includes('Urdu script'));
  assert.ok(html.includes('Do not message'));
  assert.ok(html.includes('&lt;no calls&gt;'));
  assert.ok(html.includes('Uses number on file'));
  assert.ok(html.includes('No preference'));
  assert.equal(contactPreferenceHtml([]), '<p class="empty-state">No contact preferences saved yet.</p>');
});

test('csv: one row per preference, quoted when a reason holds a comma', () => {
  const csv = contactPreferenceCsv([
    { customerId: 'c2', customerName: 'Bilal', language: 'roman', doNotMessage: true, doNotMessageReason: 'no messages, please' },
  ]);
  const lines = csv.split('\n');
  assert.equal(lines.length, 2);
  assert.ok(lines[1].includes('"no messages, please"'));
  assert.ok(lines[1].includes('yes'));
});

test('changing a preference never touches a payment, Waada or balance object', () => {
  const payment = { id: 'p1', amount: 1000, balance: 500 };
  const before = JSON.stringify(payment);
  upsertContactPreference(prefs, { customerId: 'c1', language: 'roman', whatsappNumber: '03000000000' });
  applyContactPreferencesToDrafts({ items: customers, preferences: prefs, buildDraft: () => 'draft' });
  assert.equal(JSON.stringify(payment), before);
  assert.equal(CONTACT_PREFERENCE_LANGUAGES.ROMAN, 'roman');
  assert.equal(CONTACT_PREFERENCE_LANGUAGES.URDU, 'urdu');
});
