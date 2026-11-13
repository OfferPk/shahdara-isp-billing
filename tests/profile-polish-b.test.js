import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { profileCompletionBar } from '../profile-completion.js';
import { profileQuickActionsRowHtml } from '../profile-quick-actions.js';
import { buildProfileHeaderStrip, profileHeaderStripHtml } from '../profile-header-strip.js';
import { missingFieldsChecklistHtml } from '../missing-fields-checklist.js';

const dir = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(dir, '..', name), 'utf8');
const index = read('index.html');
const app = read('app.js');
const styles = read('styles.css');
const ui = read('profile-ui.js');

// Profile Polish B (user spec 2026-11-12, items (10)–(14) of the
// 22-part profile spec):
// (10) action buttons in ONE group: Edit, Clear dues, Delete, Record
//      payment / Mark paid, Archive; Wada ALSO up in the top group
//      next to Delete (the existing Wada in Customer Communication
//      stays put). Archive sat in More Actions > Payments from
//      Profile Polish B (10) until the user report of 2026-11-13
//      ("Record payment WALLA button lamba hai tu Shahid woh archive
//      button kahi gum ho gaya hai") proved that seat unreachable two
//      taps deep — the Profile Archive Button Visibility item
//      deliberately reverses that seat: Archive joins Row 1 beside
//      Record payment, and the Payments category keeps Advance +
//      back-dated only (see its PR body).
// (11) Customer information card buttons (QR Khata Card, Print card,
//      Speak Due, Welcome Slip) in ONE group, EACH UNIQUE colour;
// (12) "7/68 fields filled" as a PILL + a small COLOURFUL progress
//      bar; "Missing fields (61)" pill shows plain "61" + RED/YELLOW
//      bar (numbers are the user's screenshot examples — the code
//      reads the live counts);
// (13) Info-tab buttons (Record payment, New fault note, Message
//      draft, Balance view) in ONE merged group, EACH UNIQUE colour;
// (14) Info-tab summary rows (Dues, Package, Last payment, Next due)
//      as PILLS.
// No figure changes anywhere: the same labels, the same values, the
// same wiring — only what shows, in what order, and in what shape.

// ------------------------------------------------------------ (10)

test('Polish B (10): top action group holds Edit, Clear dues, Delete, Wada, Record payment, Archive — in that order, ahead of More actions', () => {
  const groupAt = index.indexOf('class="profile-action-group"');
  assert.ok(groupAt >= 0, 'action group exists');
  const detailsAt = index.indexOf('id="profileMoreActionsDetails"', groupAt);
  // Profile Archive Button Visibility (user report 2026-11-13):
  // Archive joins Row 1 beside Record payment — the Polish B (10)
  // seat (Archive down in More Actions > Payments) hid it two taps
  // deep, so this order test now pins the sixth Row 1 button.
  const order = ['editProfileButton', 'clearDuesButton', 'deleteCustomerButton', 'topWadaButton', 'currentBillPaymentShortcut', 'archiveCustomerButton'];
  let previousAt = groupAt;
  for (const id of order) {
    const at = index.indexOf(`id="${id}"`, groupAt);
    assert.ok(at > previousAt, `${id} follows the previous action`);
    assert.ok(at < detailsAt, `${id} sits ahead of the More actions disclosure`);
    previousAt = at;
  }
  for (const id of order) {
    assert.strictEqual((index.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1, `exactly one ${id}`);
  }
});

test('Polish B (10): Archive is up in the header action group beside Record payment, NOT in the Payments section', () => {
  // Deliberate reversal of the original Polish B (10) seat (see the
  // header comment above): the user could not find Archive two taps
  // deep in More Actions > Payments, so it now sits in Row 1.
  const groupAt = index.indexOf('class="profile-action-group"');
  const detailsAt = index.indexOf('id="profileMoreActionsDetails"', groupAt);
  const archiveAt = index.indexOf('id="archiveCustomerButton"', groupAt);
  const recordAt = index.indexOf('id="currentBillPaymentShortcut"', groupAt);
  assert.ok(archiveAt > recordAt && archiveAt < detailsAt, 'Archive sits in the header action group, right after Record payment');
  const gridAt = index.indexOf('class="profile-more-actions-grid"');
  const qaAt = index.indexOf('id="customerTechnicalToolsDetails"');
  const gridSlice = index.slice(gridAt, qaAt);
  assert.ok(!gridSlice.includes('id="archiveCustomerButton"'), 'Archive is nowhere in the More actions grid');
  const paymentsAt = index.indexOf('data-i18n="prof_ma_cat_payments"');
  const paymentsEnd = index.indexOf('</details>', paymentsAt);
  const payments = index.slice(paymentsAt, paymentsEnd);
  assert.ok(!payments.includes('id="archiveCustomerButton"'), 'Archive is not in the Payments category any more');
  assert.ok(payments.includes('id="advancePaymentButton"'), 'Payments keeps Advance');
  assert.ok(payments.includes('id="backdatedPaymentButton"'), 'Payments keeps the back-dated entry');
});

test('Polish B (10): the Communication Wada stays put; both Wada buttons open the same dialog', () => {
  const commAt = index.indexOf('data-i18n="prof_ma_cat_communication"');
  const commEnd = index.indexOf('</details>', commAt);
  assert.ok(index.indexOf('id="openCustomerPromiseBtn"', commAt) < commEnd, 'the original Wada stays in Customer Communication');
  assert.ok(app.includes('function openCustomerPromiseDialog()'), 'one shared Wada opener exists');
  assert.ok(app.includes("openCustomerPromiseBtn.addEventListener('click', openCustomerPromiseDialog)"), 'the Communication Wada calls the shared opener');
  assert.ok(app.includes("topWadaButton.addEventListener('click', openCustomerPromiseDialog)"), 'the top-group Wada calls the same opener');
  assert.ok(app.includes('openPaymentReminderModal(cust)'), 'the shared opener still opens the reminder modal');
});

test('Polish B (10): Record payment and Archive keep their wiring — the buttons moved, the handlers did not', () => {
  assert.ok(app.includes("$('#currentBillPaymentShortcut').addEventListener('click'"), 'Record payment wiring still attaches once at startup');
  assert.ok(app.includes("$('#archiveCustomerButton').addEventListener('click'"), 'Archive wiring still attaches once at startup');
  assert.ok(app.includes("$('#archiveCustomerButton').hidden = customer.archived"), 'Archive still hides on an archived profile');
});

// ------------------------------------------------------------ (11)

test('Polish B (11): the four Customer information card buttons each carry their own colour class', () => {
  assert.ok(app.includes('id="profileQrCardButton" class="secondary-button profile-info-btn-qr"'), 'QR Khata Card carries its colour class');
  assert.ok(app.includes('id="profilePrintCardButton" class="secondary-button profile-info-btn-print"'), 'Print card carries its colour class');
  assert.ok(ui.includes('class="secondary-button speak-due-button profile-info-btn-speak"'), 'Speak Due carries its colour class');
  assert.ok(ui.includes('id="profileWelcomeSlipButton" class="secondary-button profile-info-btn-welcome"'), 'Welcome Slip carries its colour class');
  for (const cls of ['.profile-info-btn-qr', '.profile-info-btn-print', '.profile-info-btn-speak', '.profile-info-btn-welcome']) {
    assert.ok(styles.includes(cls), `styles must define ${cls}`);
  }
});

test('Polish B (11): the four info-card colours are all different', () => {
  const backgrounds = [];
  for (const cls of ['profile-info-btn-qr', 'profile-info-btn-print', 'profile-info-btn-speak', 'profile-info-btn-welcome']) {
    const match = styles.match(new RegExp(`\\.${cls}\\{[^}]*background:\\s*(#[0-9a-fA-F]{3,6})`));
    assert.ok(match, `${cls} sets a background colour`);
    backgrounds.push(match[1].toLowerCase());
  }
  assert.strictEqual(new Set(backgrounds).size, 4, 'each info-card button has its own background colour');
});

// ------------------------------------------------------------ (12)

test('Polish B (12): completion bar tone follows the health bands — 70%+ green, 40–69% yellow, below 40% red', () => {
  assert.deepEqual(profileCompletionBar(48, 68), { percent: 71, tone: 'green' });
  assert.deepEqual(profileCompletionBar(7, 10), { percent: 70, tone: 'green' });
  assert.deepEqual(profileCompletionBar(28, 68), { percent: 41, tone: 'yellow' });
  assert.deepEqual(profileCompletionBar(4, 10), { percent: 40, tone: 'yellow' });
  assert.deepEqual(profileCompletionBar(7, 68), { percent: 10, tone: 'red' });
  assert.deepEqual(profileCompletionBar(0, 68), { percent: 0, tone: 'red' });
  assert.deepEqual(profileCompletionBar(68, 68), { percent: 100, tone: 'green' });
  assert.deepEqual(profileCompletionBar(70, 68), { percent: 100, tone: 'green' }, 'an over-filled count clamps to 100%');
  assert.deepEqual(profileCompletionBar(NaN, 68), { percent: 0, tone: 'red' });
  assert.deepEqual(profileCompletionBar(7, 0), { percent: 0, tone: 'red' });
  assert.deepEqual(profileCompletionBar(undefined, undefined), { percent: 0, tone: 'red' });
});

test('Polish B (12): the counter renders as a pill with a progress bar, wired to the live counts', () => {
  assert.ok(app.includes("const completion = countProfileCompletion(customer);"), 'the counter is computed once from the live record');
  assert.ok(app.includes('profileCompletionBar(completion.filled, completion.total)'), 'the bar reads the same live counts');
  assert.ok(app.includes('class="profile-completion-pill"'), 'the counter text sits in a pill');
  assert.ok(app.includes('class="profile-completion-bar" role="progressbar"'), 'the bar is a progressbar');
  assert.ok(app.includes('profile-completion-fill-${completionBar.tone}'), 'the fill takes the band tone');
  assert.ok(app.includes('style="width:${completionBar.percent}%"'), 'the fill width is the live percent');
  for (const cls of ['.profile-completion-pill', '.profile-completion-bar', '.profile-completion-fill-green', '.profile-completion-fill-yellow', '.profile-completion-fill-red']) {
    assert.ok(styles.includes(cls), `styles must define ${cls}`);
  }
});

test('Polish B (12): the missing-fields pill shows the plain count and a red/yellow bar of the missing share', () => {
  const labels = { a: 'Field A', b: 'Field B' };
  const texts = { heading: 'Missing fields', allFilled: 'All fields filled', total: 68 };
  const mostlyMissing = missingFieldsChecklistHtml(
    Array.from({ length: 61 }, (_, i) => ({ controlId: `c${i}`, fieldKey: `f${i}` })),
    {}, texts,
  );
  assert.ok(mostlyMissing.includes('<span class="mfc-count-pill">61</span>'), 'the pill shows the plain count 61');
  assert.ok(!mostlyMissing.includes('Missing fields (61)'), 'no parens around the count any more');
  assert.ok(mostlyMissing.includes('mfc-bar-fill-red'), '61 of 68 missing is a red bar');
  assert.ok(mostlyMissing.includes('width:90%'), 'the bar width is the missing share');
  const mostlyFilled = missingFieldsChecklistHtml(
    [{ controlId: 'a', fieldKey: 'fa' }],
    labels, texts,
  );
  assert.ok(mostlyFilled.includes('<span class="mfc-count-pill">1</span>'), 'the pill shows the plain count 1');
  assert.ok(mostlyFilled.includes('mfc-bar-fill-yellow'), '1 of 68 missing is a yellow bar');
  assert.ok(mostlyFilled.includes('width:1%'), 'the bar width is the missing share');
  const noTotal = missingFieldsChecklistHtml([{ controlId: 'a', fieldKey: 'fa' }], labels, { heading: 'Missing fields', allFilled: 'All fields filled' });
  assert.ok(noTotal.includes('<span class="mfc-count-pill">1</span>'), 'the pill still shows without a total');
  assert.ok(!noTotal.includes('mfc-bar'), 'no bar without a total');
  const allFilled = missingFieldsChecklistHtml([], {}, texts);
  assert.ok(allFilled.includes('All fields filled'), 'a complete profile shows the all-filled line');
  assert.ok(!allFilled.includes('mfc-count-pill'), 'no count pill when nothing is missing');
  for (const cls of ['.mfc-count-pill', '.mfc-bar', '.mfc-bar-fill-red', '.mfc-bar-fill-yellow']) {
    assert.ok(styles.includes(cls), `styles must define ${cls}`);
  }
});

// ------------------------------------------------------------ (13)

test('Polish B (13): the four Info-tab buttons each carry their own colour class, in the same order', () => {
  const html = profileQuickActionsRowHtml('CUST-1', {});
  assert.ok(html.includes('class="secondary-button pqa-btn pqa-btn-payment"'), 'Record payment carries its colour class');
  assert.ok(html.includes('class="secondary-button pqa-btn pqa-btn-fault"'), 'New fault note carries its colour class');
  assert.ok(html.includes('class="secondary-button pqa-btn pqa-btn-message"'), 'Message draft carries its colour class');
  assert.ok(html.includes('class="secondary-button pqa-btn pqa-btn-balance"'), 'Balance view carries its colour class');
  const paymentAt = html.indexOf('pqa-btn-payment');
  const faultAt = html.indexOf('pqa-btn-fault');
  const messageAt = html.indexOf('pqa-btn-message');
  const balanceAt = html.indexOf('pqa-btn-balance');
  assert.ok(paymentAt < faultAt && faultAt < messageAt && messageAt < balanceAt, 'the button order is unchanged');
  assert.ok(html.includes('role="group"'), 'the four buttons still share one merged group');
});

test('Polish B (13): the four quick-action colours are all different', () => {
  const backgrounds = [];
  for (const cls of ['pqa-btn-payment', 'pqa-btn-fault', 'pqa-btn-message', 'pqa-btn-balance']) {
    const match = styles.match(new RegExp(`\\.${cls}\\{[^}]*background:\\s*(#[0-9a-fA-F]{3,6})`));
    assert.ok(match, `${cls} sets a background colour`);
    backgrounds.push(match[1].toLowerCase());
  }
  assert.strictEqual(new Set(backgrounds).size, 4, 'each quick action has its own background colour');
});

// ------------------------------------------------------------ (14)

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

test('Polish B (14): the four at-a-glance figures render as pills, in the same order, with the same figures', () => {
  const html = profileHeaderStripHtml(buildProfileHeaderStrip(baseStrip()));
  assert.ok(html.includes('class="phs-stat phs-pill phs-pill-dues"'), 'Dues is a pill');
  assert.ok(html.includes('class="phs-stat phs-pill phs-pill-package"'), 'Package is a pill');
  assert.ok(html.includes('class="phs-stat phs-pill phs-pill-last-payment"'), 'Last payment is a pill');
  assert.ok(html.includes('class="phs-stat phs-pill phs-pill-next-due"'), 'Next due is a pill');
  const duesAt = html.indexOf('phs-pill-dues');
  const packageAt = html.indexOf('phs-pill-package');
  const lastAt = html.indexOf('phs-pill-last-payment');
  const nextAt = html.indexOf('phs-pill-next-due');
  assert.ok(duesAt < packageAt && packageAt < lastAt && lastAt < nextAt, 'the figure order is unchanged');
  assert.ok(html.includes('PKR 3000'), 'the dues figure is unchanged');
  assert.ok(html.includes('2026-10-19'), 'the last payment date is unchanged');
  assert.ok(html.includes('2026-11-05'), 'the next due date is unchanged');
  for (const cls of ['.phs-pill', '.phs-pill-dues', '.phs-pill-package', '.phs-pill-last-payment', '.phs-pill-next-due']) {
    assert.ok(styles.includes(cls), `styles must define ${cls}`);
  }
});

test('Polish B (14): the four strip pills have all different colours', () => {
  const backgrounds = [];
  for (const cls of ['phs-pill-dues', 'phs-pill-package', 'phs-pill-last-payment', 'phs-pill-next-due']) {
    const match = styles.match(new RegExp(`\\.${cls}\\{[^}]*background:\\s*(#[0-9a-fA-F]{3,6})`));
    assert.ok(match, `${cls} sets a background colour`);
    backgrounds.push(match[1].toLowerCase());
  }
  assert.strictEqual(new Set(backgrounds).size, 4, 'each strip figure has its own background colour');
});

// ------------------------------------------------------------ ratchet

test('Polish B ratchet: styles.css still 614 distinct hex (no new hard-coded colour)', () => {
  const stripped = styles.replace(/\/\*[\s\S]*?\*\//g, '');
  const distinct = new Set(stripped.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || []);
  assert.equal(distinct.size, 614, 'styles.css must stay at 614 distinct hex (no new hard-coded colour)');
});

test('Polish B: no real customer names or phone numbers in this test', () => {
  const testSrc = read('tests/profile-polish-b.test.js');
  const phoneShape = /(?:\+92|03)\d[\d\s-]{8,}\d/;
  assert.ok(!phoneShape.test(testSrc), 'test must not contain a realistic phone number');
});
