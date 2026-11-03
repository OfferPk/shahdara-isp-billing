/**
 * plan-w-operator-handbook.test.js — Plan W: documentation, help, training.
 *
 * Pins (no ledger data, no product behaviour change):
 *  (a) The six new primary-flow topics exist in the registry with the
 *      help_<topic>_title/_body key scheme and real EN+UR text.
 *  (b) Every primary flow (add, collect, void, correct, Waada, kist
 *      payoff, backup/restore) has a registry topic AND a mount on its
 *      own screen — add on Customers, collect in Quick Collect, void
 *      in the void dialog, correct on Transactions, kist payoff on
 *      the profile kist plan, backup/restore in the backup manager.
 *  (c) The searchable handbook: empty query lists every topic, each
 *      query token must match, unknown queries return nothing, and
 *      the index list escapes titles.
 *  (d) openHandbookIndex shows the index view and openHelpTopic
 *      restores the single-page view; initHelpGuides wires the header
 *      handbook button and the live search box.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  HELP_TOPICS,
  HELP_TOPIC_KEYS,
  HELP_DIALOG_ID,
  HELP_TITLE_ID,
  HELP_BODY_ID,
  HELP_INDEX_ID,
  HELP_SEARCH_ID,
  HELP_INDEX_LIST_ID,
  searchHelpTopics,
  handbookIndexListHtml,
  openHelpTopic,
  openHandbookIndex,
  renderHandbookIndex,
  initHelpGuides,
} from '../help-guide.js';
import { TRANSLATIONS } from '../nav-language.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const appJs = readFileSync(join(root, 'app.js'), 'utf8');

const NEW_TOPICS = ['add_customer', 'collect_payment', 'void_payment', 'correct_payment', 'kist_payoff', 'backup_restore'];
const PRIMARY_FLOWS = [...NEW_TOPICS.slice(0, 4), 'waada', 'kist_payoff', 'backup_restore'];

test('PLAN W (a): new topics exist with the key scheme and real EN+UR text', () => {
  for (const key of NEW_TOPICS) {
    const topic = HELP_TOPICS[key];
    assert.ok(topic, `missing registry topic ${key}`);
    assert.equal(topic.titleKey, `help_${key}_title`);
    assert.equal(topic.bodyKey, `help_${key}_body`);
    for (const lang of ['en', 'ur']) {
      const title = TRANSLATIONS[lang][topic.titleKey];
      const body = TRANSLATIONS[lang][topic.bodyKey];
      assert.equal(typeof title, 'string', `${lang} missing ${topic.titleKey}`);
      assert.equal(typeof body, 'string', `${lang} missing ${topic.bodyKey}`);
      assert.ok(body.trim().length >= 60, `${lang} body too short for ${key}`);
      for (const pattern of [/todo/i, /lorem/i, /placeholder/i, /fixme/i]) {
        assert.ok(!pattern.test(title) && !pattern.test(body), `${lang}.${key} contains placeholder text`);
      }
    }
  }
});

test('PLAN W (a2): new bodies state the shipped behaviour, not a new rule', () => {
  const en = TRANSLATIONS.en;
  assert.match(en.help_void_payment_body, /never deletes a payment/);
  assert.match(en.help_void_payment_body, /owner PIN/);
  assert.match(en.help_correct_payment_body, /correction history/);
  assert.match(en.help_kist_payoff_body, /never closes silently/);
  assert.match(en.help_kist_payoff_body, /waive it with a reason/);
  assert.match(en.help_backup_restore_body, /merges only/);
  assert.match(en.help_backup_restore_body, /without restoring it/);
  assert.match(en.help_collect_payment_body, /real date and the real method/);
  assert.match(en.help_add_customer_body, /never reused/);
});

test('PLAN W (b): every primary flow has a topic and a mount on its own screen', () => {
  for (const key of PRIMARY_FLOWS) assert.ok(HELP_TOPICS[key], `primary flow ${key} has no topic`);
  const between = (needle, from, to) => {
    const start = html.indexOf(from);
    const end = html.indexOf(to, start + 1);
    const at = html.indexOf(needle, start + 1);
    assert.ok(start !== -1 && end !== -1 && at !== -1 && at < end, `${needle} not mounted between ${from} and ${to}`);
  };
  between('data-help="add_customer"', 'id="customersView"', 'id="transactionsView"');
  between('data-help="collect_payment"', 'id="quickCollectModal"', 'id="mobileQuickProfileModal"');
  between('data-help="void_payment"', 'id="voidPaymentDialog"', 'id="paymentMethodReassignDialog"');
  between('data-help="correct_payment"', 'id="transactionsView"', 'id="billingReportsView"');
  between('data-help="backup_restore"', 'backup-manager-heading', 'id="helpGuideDialog"');
  assert.ok(appJs.includes("helpButtonMarkup('kist_payoff')"), 'kist_payoff not mounted on the profile kist plan');
  assert.ok(html.includes('id="handbookButton"'), 'header handbook button missing');
  assert.ok(html.includes(`id="${HELP_INDEX_ID}"`), 'handbook index container missing');
  assert.ok(html.includes(`id="${HELP_SEARCH_ID}"`), 'handbook search box missing');
});

test('PLAN W (c): search lists all on empty query, filters per token, empties on unknown', () => {
  const all = searchHelpTopics('');
  assert.equal(all.length, HELP_TOPIC_KEYS.length, 'empty query must list every topic');
  assert.deepEqual(
    all.map((r) => r.key),
    [...HELP_TOPIC_KEYS],
    'index order must be registry order',
  );
  const voidResults = searchHelpTopics('void payment').map((r) => r.key);
  assert.ok(voidResults.includes('void_payment'), 'void payment search must find void_payment');
  const kistResults = searchHelpTopics('kist early').map((r) => r.key);
  assert.ok(kistResults.includes('kist_payoff'), 'kist early search must find kist_payoff');
  assert.equal(searchHelpTopics('zzzzqqq').length, 0, 'unknown query must return nothing');
  assert.equal(searchHelpTopics('BACKUP').map((r) => r.key).includes('backup_restore'), true, 'search must be case-insensitive');
  const emptyHtml = handbookIndexListHtml([]);
  assert.match(emptyHtml, /No matching help pages/);
  assert.ok(!emptyHtml.includes('data-help='), 'empty list must render no topic buttons');
  const escaped = handbookIndexListHtml([{ key: 'x', title: '<script>alert(1)</script>', body: '' }]);
  assert.ok(!escaped.includes('<script>'), 'index titles must be escaped');
  assert.match(escaped, /&lt;script&gt;/);
});

test('PLAN W (d): handbook index opens, topic open restores the single-page view', () => {
  const els = {
    [HELP_DIALOG_ID]: { open: false, showModal() { this.open = true; }, close() { this.open = false; } },
    [HELP_TITLE_ID]: { textContent: '' },
    [HELP_BODY_ID]: { textContent: '', hidden: false, removeAttribute() { this.hidden = false; } },
    [HELP_INDEX_ID]: { hidden: true, removeAttribute() { this.hidden = false; } },
    [HELP_SEARCH_ID]: { value: 'stale' },
    [HELP_INDEX_LIST_ID]: { innerHTML: '' },
  };
  const fakeDoc = { getElementById: (id) => els[id] || null };
  assert.equal(openHandbookIndex(fakeDoc), true);
  assert.equal(els[HELP_DIALOG_ID].open, true);
  assert.equal(els[HELP_TITLE_ID].textContent, TRANSLATIONS.en.help_handbook_title);
  assert.equal(els[HELP_BODY_ID].hidden, true, 'index view must hide the single-page body');
  assert.equal(els[HELP_INDEX_ID].hidden, false, 'index view must show the index');
  assert.equal(els[HELP_SEARCH_ID].value, '', 'index open must clear a stale search');
  assert.match(els[HELP_INDEX_LIST_ID].innerHTML, /data-help="void_payment"/);
  assert.equal(renderHandbookIndex(fakeDoc, 'backup'), 1, 'backup search must match exactly one topic');
  assert.ok(els[HELP_INDEX_LIST_ID].innerHTML.includes('data-help="backup_restore"'), 'search render must list backup_restore');
  assert.equal(openHelpTopic('void_payment', fakeDoc), true);
  assert.equal(els[HELP_BODY_ID].hidden, false, 'topic open must restore the body view');
  assert.equal(els[HELP_INDEX_ID].hidden, true, 'topic open must hide the index');
  assert.equal(els[HELP_TITLE_ID].textContent, TRANSLATIONS.en.help_void_payment_title);
});

test('PLAN W (d2): initHelpGuides wires the handbook button and live search once', () => {
  const docListeners = {};
  const btnListeners = {};
  const els = {
    handbookButton: { addEventListener: (type, fn) => { btnListeners[type] = fn; } },
    [HELP_INDEX_LIST_ID]: { innerHTML: '' },
  };
  const fakeDoc = {
    getElementById: (id) => els[id] || null,
    addEventListener: (type, fn) => { docListeners[type] = fn; },
  };
  assert.equal(initHelpGuides(fakeDoc), true);
  assert.equal(initHelpGuides(fakeDoc), false, 'second init must be a no-op');
  assert.equal(typeof btnListeners.click, 'function', 'handbook button click not wired');
  assert.equal(typeof docListeners.input, 'function', 'search input listener not wired');
  docListeners.input({ target: { id: HELP_SEARCH_ID, value: 'void' } });
  assert.match(els[HELP_INDEX_LIST_ID].innerHTML, /data-help="void_payment"/);
});
