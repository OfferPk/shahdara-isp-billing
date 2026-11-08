import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { contactActionTargets, contactShortcutActions } from '../profile-ui.js';
import { TRANSLATIONS } from '../nav-language.js';

const dir = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(dir, '..', name), 'utf8');

// Plan 511 — Contact shortcuts in one order, with WhatsApp explained when
// missing: the shortcuts render Call → WhatsApp → SMS → Call Alternate
// (→ WhatsApp Alternate); the alternate number gets its own WhatsApp
// action when it parses as international; when WhatsApp is unavailable
// for the primary number, the WhatsApp action renders disabled with the
// phone-hint text beside it instead of silently disappearing. No new
// contact data; the helper only reuses contactActionTargets results.
//
// Boundaries, stated plainly: the disabled WhatsApp shows only when a
// primary-side number is recorded but cannot do WhatsApp — when no
// primary-side number is recorded at all there is no WhatsApp slot and
// the hint alone explains. The alternate WhatsApp follows its own Call
// Alternate button, so each number's actions stay adjacent; the plan's
// named order (Call → WhatsApp → SMS → Call Alternate) is the prefix
// order. The no-WhatsApp hint condition is unchanged.

const SMS_URL = 'sms:+923001234567?&body=Test';

function kinds(actions) {
  return actions.map(action => action.kind);
}

test('Plan 511: full order is Call → WhatsApp → SMS → Call Alternate → WhatsApp Alternate', () => {
  const phoneTargets = contactActionTargets('+923001234567');
  const alternateTargets = contactActionTargets('+923331234567');
  const actions = contactShortcutActions({ phoneTargets, alternateTargets, smsUrl: SMS_URL });
  assert.deepEqual(kinds(actions), ['call', 'whatsapp', 'sms', 'call-alternate', 'whatsapp-alternate']);
  assert.equal(actions[0].href, 'tel:+923001234567');
  assert.equal(actions[1].href, 'https://wa.me/923001234567');
  assert.equal(actions[2].href, SMS_URL);
  assert.equal(actions[3].href, 'tel:+923331234567');
  assert.equal(actions[4].href, 'https://wa.me/923331234567');
  assert.ok(actions.every(action => !action.disabled), 'no disabled action when every number qualifies');
});

test('Plan 511: a local-format primary number gets Call plus a disabled WhatsApp, never a link', () => {
  const phoneTargets = contactActionTargets('03001234567');
  assert.deepEqual(phoneTargets, { tel: 'tel:03001234567', whatsapp: null });
  const actions = contactShortcutActions({ phoneTargets, alternateTargets: null, smsUrl: null });
  assert.deepEqual(kinds(actions), ['call', 'whatsapp']);
  assert.equal(actions[0].href, 'tel:03001234567');
  assert.equal(actions[1].disabled, true);
  assert.equal(actions[1].href, undefined, 'a disabled WhatsApp carries no href to follow');
});

test('Plan 511: primary international, no SMS, no alternate — just Call and WhatsApp', () => {
  const actions = contactShortcutActions({
    phoneTargets: contactActionTargets('+923001234567'),
    alternateTargets: null,
    smsUrl: null
  });
  assert.deepEqual(kinds(actions), ['call', 'whatsapp']);
});

test('Plan 511: local primary with an international alternate — disabled primary WhatsApp, live alternate WhatsApp', () => {
  const actions = contactShortcutActions({
    phoneTargets: contactActionTargets('03001234567'),
    alternateTargets: contactActionTargets('+923331234567'),
    smsUrl: null
  });
  assert.deepEqual(kinds(actions), ['call', 'whatsapp', 'call-alternate', 'whatsapp-alternate']);
  assert.equal(actions[1].disabled, true);
  assert.equal(actions[3].href, 'https://wa.me/923331234567');
});

test('Plan 511: international primary with a local alternate — alternate gets Call only', () => {
  const actions = contactShortcutActions({
    phoneTargets: contactActionTargets('+923001234567'),
    alternateTargets: contactActionTargets('03331234567'),
    smsUrl: null
  });
  assert.deepEqual(kinds(actions), ['call', 'whatsapp', 'call-alternate']);
});

test('Plan 511: no numbers at all — no shortcuts', () => {
  assert.deepEqual(contactShortcutActions({ phoneTargets: null, alternateTargets: null, smsUrl: null }), []);
  assert.deepEqual(contactShortcutActions({ phoneTargets: null, alternateTargets: null, smsUrl: undefined }), []);
});

test('Plan 511: primary missing but the dedicated WhatsApp number is international — WhatsApp link, no Call, nothing disabled', () => {
  const actions = contactShortcutActions({
    phoneTargets: { tel: null, whatsapp: 'https://wa.me/923001234567' },
    alternateTargets: null,
    smsUrl: null
  });
  assert.deepEqual(kinds(actions), ['whatsapp']);
  assert.equal(actions[0].href, 'https://wa.me/923001234567');
});

test('Plan 511: primary missing and the dedicated WhatsApp number is local — disabled WhatsApp only', () => {
  const actions = contactShortcutActions({
    phoneTargets: { tel: null, whatsapp: null },
    alternateTargets: null,
    smsUrl: null
  });
  assert.deepEqual(kinds(actions), ['whatsapp']);
  assert.equal(actions[0].disabled, true);
});

test('Plan 511: SMS sits in its own slot — after WhatsApp, before Call Alternate — and only when given', () => {
  const withSms = contactShortcutActions({
    phoneTargets: contactActionTargets('+923001234567'),
    alternateTargets: contactActionTargets('+923331234567'),
    smsUrl: SMS_URL
  });
  assert.equal(withSms.findIndex(action => action.kind === 'sms'), 2, 'SMS is third, not wedged after Call');
  const withoutSms = contactShortcutActions({
    phoneTargets: contactActionTargets('+923001234567'),
    alternateTargets: contactActionTargets('+923331234567'),
    smsUrl: null
  });
  assert.deepEqual(kinds(withoutSms), ['call', 'whatsapp', 'call-alternate', 'whatsapp-alternate']);
});

test('Plan 511: contactActionTargets still separates tel from WhatsApp for local numbers', () => {
  assert.deepEqual(contactActionTargets('0300-1234567'), { tel: 'tel:03001234567', whatsapp: null });
  assert.equal(contactActionTargets('+92 (300) 123-4567').whatsapp, 'https://wa.me/923001234567');
  assert.equal(contactActionTargets(''), null);
});

test('Plan 511: the alternate-WhatsApp label exists in both dictionaries', () => {
  assert.equal(TRANSLATIONS.en.prof_view_whatsapp_alternate, 'WhatsApp Alternate');
  assert.equal(TRANSLATIONS.ur.prof_view_whatsapp_alternate, 'متبادل نمبر پر واٹس ایپ کریں');
  assert.match(TRANSLATIONS.ur.prof_view_whatsapp_alternate, /[\u0600-\u06FF]/, 'Urdu value carries Urdu script');
});

test('Plan 511: the profile render builds the shortcuts from the shared helper, in order', () => {
  const app = read('app.js');
  assert.match(app, /import \{[^}]*contactShortcutActions[^}]*\} from '\.\/profile-ui\.js\?v=1\.11\.0';/, 'helper is imported');
  assert.ok(app.includes('contactShortcutActions({ phoneTargets, alternateTargets,'), 'render calls the helper with both targets');
  assert.ok(app.includes('smsUrl: smsContact?.valid ? smsContact.url : null'), 'SMS still comes from the prefers-SMS draft');
  assert.ok(!app.includes('smsAction'), 'the old wedged SMS fragment is gone');
  assert.ok(!app.includes('${smsAction}${alternateTargets'), 'SMS no longer sits between Call and Call Alternate');
  assert.ok(app.includes('<button type="button" class="secondary-button" disabled>${shortcutLabels[action.kind]}</button>'), 'disabled WhatsApp is a real disabled button');
  assert.ok(app.includes(`'whatsapp' || action.kind === 'whatsapp-alternate' ? ' target="_blank" rel="noopener noreferrer"'`), 'both WhatsApp actions open in a new tab');
  assert.ok(app.includes("t('prof_view_whatsapp_alternate')"), 'the new label is resolved with a literal t() call, visible to the key audit');
  assert.ok(app.includes("const phoneHint = phoneTargets?.whatsapp ? '' : `<p class=\"profile-contact-note\">${t('prof_view_phone_hint')}</p>`;"), 'the no-WhatsApp hint still travels beside the shortcuts');
});
