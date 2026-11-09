import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  HOUSEHOLD_LINK_STORE_KEY,
  HOUSEHOLD_LINK_RELATIONSHIP_MAX_LENGTH,
  isStrictHouseholdLinkDate,
  normalizeHouseholdLink,
  normalizeHouseholdLinkList,
  recordHouseholdLink,
  removeHouseholdLink,
  householdLinksForCustomer,
  householdLinkOtherId,
  householdLinkCandidates,
  householdLinkRows,
  householdLinkRowText,
  householdLinkSummaryText,
  householdLinkOptionsHtml,
  householdLinkSectionHtml,
} from '../household-link.js';

const dir = dirname(fileURLToPath(import.meta.url));
const moduleSrc = readFileSync(join(dir, '..', 'household-link.js'), 'utf8');
const appSrc = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const stylesSrc = readFileSync(join(dir, '..', 'styles.css'), 'utf8');

// Generic fixtures only — clearly made-up names, never a real customer.
function customer(overrides = {}) {
  return {
    id: 'CUST-1',
    name: 'Customer One',
    mohalla: 'Mohalla A',
    ...overrides,
  };
}

function link(overrides = {}) {
  return {
    id: 'HHL-1',
    customerA: 'CUST-1',
    customerB: 'CUST-2',
    relationship: 'father and son',
    dateNoted: '2026-11-06',
    ...overrides,
  };
}

function customers() {
  return [
    customer(),
    customer({ id: 'CUST-2', name: 'Customer Two', mohalla: 'Mohalla B' }),
    customer({ id: 'CUST-3', name: 'Customer Three', mohalla: 'Mohalla A' }),
    customer({ id: 'CUST-4', name: 'Customer Four', mohalla: 'Mohalla B', archived: true }),
  ];
}

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

// --- strict dates ---

test('date: real calendar dates pass, impossible ones fail', () => {
  assert.equal(isStrictHouseholdLinkDate('2026-11-06'), true);
  assert.equal(isStrictHouseholdLinkDate('2024-02-29'), true, 'leap day passes in a leap year');
  assert.equal(isStrictHouseholdLinkDate('2023-02-28'), true);
  assert.equal(isStrictHouseholdLinkDate('2023-02-29'), false, 'no leap day in a non-leap year');
  assert.equal(isStrictHouseholdLinkDate('2026-02-30'), false);
  assert.equal(isStrictHouseholdLinkDate('2026-04-31'), false, 'April has 30 days');
  assert.equal(isStrictHouseholdLinkDate('2026-13-01'), false);
  assert.equal(isStrictHouseholdLinkDate('2026-00-10'), false);
  assert.equal(isStrictHouseholdLinkDate('2026-11-00'), false);
  assert.equal(isStrictHouseholdLinkDate('2026/11/06'), false);
  assert.equal(isStrictHouseholdLinkDate('Nov 6 2026'), false);
  assert.equal(isStrictHouseholdLinkDate(''), false);
  assert.equal(isStrictHouseholdLinkDate(null), false);
  assert.equal(isStrictHouseholdLinkDate(20261106), false);
});

// --- normalizeHouseholdLink ---

test('normalize: a valid link normalizes with trimmed fields', () => {
  const out = normalizeHouseholdLink(link({ relationship: '  house and shop  ' }));
  assert.deepEqual(out, { id: 'HHL-1', customerA: 'CUST-1', customerB: 'CUST-2', relationship: 'house and shop', dateNoted: '2026-11-06' });
});

test('normalize: a link without an id is refused', () => {
  assert.equal(normalizeHouseholdLink(link({ id: '  ' })), null);
  assert.equal(normalizeHouseholdLink(link({ id: undefined })), null);
});

test('normalize: a link without both customers is refused', () => {
  assert.equal(normalizeHouseholdLink(link({ customerA: '' })), null);
  assert.equal(normalizeHouseholdLink(link({ customerB: '   ' })), null);
});

test('normalize: a customer cannot be linked to itself, even in different case', () => {
  assert.equal(normalizeHouseholdLink(link({ customerB: 'CUST-1' })), null);
  assert.equal(normalizeHouseholdLink(link({ customerB: 'cust-1' })), null);
});

test('normalize: a link without a relationship in plain words is refused', () => {
  assert.equal(normalizeHouseholdLink(link({ relationship: '' })), null);
  assert.equal(normalizeHouseholdLink(link({ relationship: '   ' })), null);
});

test('normalize: a link without a real noted date is refused', () => {
  assert.equal(normalizeHouseholdLink(link({ dateNoted: '' })), null);
  assert.equal(normalizeHouseholdLink(link({ dateNoted: '2023-02-29' })), null);
  assert.equal(normalizeHouseholdLink(link({ dateNoted: 'tomorrow' })), null);
});

test('normalize: an overlong relationship is capped, not dropped', () => {
  const long = 'x'.repeat(HOUSEHOLD_LINK_RELATIONSHIP_MAX_LENGTH + 25);
  const out = normalizeHouseholdLink(link({ relationship: long }));
  assert.equal(out.relationship.length, HOUSEHOLD_LINK_RELATIONSHIP_MAX_LENGTH);
});

test('normalize: non-object input is refused', () => {
  assert.equal(normalizeHouseholdLink(null), null);
  assert.equal(normalizeHouseholdLink('HHL-1'), null);
});

// --- normalizeHouseholdLinkList ---

test('list: a non-array normalizes to an empty list', () => {
  assert.deepEqual(normalizeHouseholdLinkList(null), []);
  assert.deepEqual(normalizeHouseholdLinkList('nope'), []);
});

test('list: the first link wins when two share an id', () => {
  const out = normalizeHouseholdLinkList([link(), link({ relationship: 'house and shop' })]);
  assert.equal(out.length, 1);
  assert.equal(out[0].relationship, 'father and son');
});

test('list: the first link wins when the same pair is recorded in either direction', () => {
  const out = normalizeHouseholdLinkList([
    link(),
    link({ id: 'HHL-2', customerA: 'CUST-2', customerB: 'CUST-1', relationship: 'son and father' }),
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 'HHL-1');
});

test('list: invalid entries are dropped and the rest stay in order', () => {
  const out = normalizeHouseholdLinkList([link({ dateNoted: 'bad' }), link({ id: 'HHL-2' }), link({ id: 'HHL-3', customerA: 'CUST-1', customerB: 'CUST-3' })]);
  assert.deepEqual(out.map((entry) => entry.id), ['HHL-2', 'HHL-3']);
});

// --- recordHouseholdLink ---

test('record: a valid link is appended', () => {
  const out = recordHouseholdLink([], link());
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 'HHL-1');
});

test('record: the same pair in either direction is refused', () => {
  const before = [link()];
  assert.equal(recordHouseholdLink(before, link({ id: 'HHL-2', customerA: 'CUST-2', customerB: 'CUST-1' })).length, 1);
  assert.equal(recordHouseholdLink(before, link({ id: 'HHL-2' })).length, 1);
});

test('record: a self-link and a dateless link are refused', () => {
  assert.equal(recordHouseholdLink([], link({ customerB: 'CUST-1' })).length, 0);
  assert.equal(recordHouseholdLink([], link({ dateNoted: '' })).length, 0);
});

test('record: the input list is never mutated', () => {
  const before = deepFreeze([link()]);
  const out = recordHouseholdLink(before, link({ id: 'HHL-2', customerA: 'CUST-1', customerB: 'CUST-3' }));
  assert.equal(out.length, 2);
  assert.equal(before.length, 1);
});

// --- removeHouseholdLink ---

test('remove: only the named link is removed', () => {
  const list = [link(), link({ id: 'HHL-2', customerA: 'CUST-1', customerB: 'CUST-3' })];
  const out = removeHouseholdLink(list, 'HHL-1');
  assert.deepEqual(out.map((entry) => entry.id), ['HHL-2']);
});

test('remove: an unknown id removes nothing', () => {
  const list = [link()];
  assert.equal(removeHouseholdLink(list, 'HHL-9').length, 1);
  assert.equal(removeHouseholdLink(list, '').length, 1);
});

test('remove: the id match is case-insensitive', () => {
  assert.equal(removeHouseholdLink([link()], 'hhl-1').length, 0);
});

// --- links for one customer ---

test('for customer: links on either side are returned, in recorded order, and strangers get none', () => {
  const list = [
    link(),
    link({ id: 'HHL-2', customerA: 'CUST-3', customerB: 'CUST-1' }),
    link({ id: 'HHL-3', customerA: 'CUST-2', customerB: 'CUST-3' }),
  ];
  assert.deepEqual(householdLinksForCustomer(list, 'CUST-1').map((entry) => entry.id), ['HHL-1', 'HHL-2']);
  assert.deepEqual(householdLinksForCustomer(list, 'CUST-2').map((entry) => entry.id), ['HHL-1', 'HHL-3']);
  assert.deepEqual(householdLinksForCustomer(list, 'CUST-9'), []);
});

test('for customer: the customer match is case-insensitive', () => {
  assert.equal(householdLinksForCustomer([link()], 'cust-1').length, 1);
});

test('other id: the other side of the link is returned, and a stranger gets an empty string', () => {
  assert.equal(householdLinkOtherId(link(), 'CUST-1'), 'CUST-2');
  assert.equal(householdLinkOtherId(link(), 'CUST-2'), 'CUST-1');
  assert.equal(householdLinkOtherId(link(), 'CUST-9'), '');
  assert.equal(householdLinkOtherId(null, 'CUST-1'), '');
});

// --- candidates ---

test('candidates: everyone except this customer, archived skipped, name order then id', () => {
  const out = householdLinkCandidates(customers(), 'CUST-1');
  assert.deepEqual(out.map((entry) => entry.id), ['CUST-3', 'CUST-2']);
  assert.equal(out[0].name, 'Customer Three');
  assert.equal(out[0].mohalla, 'Mohalla A');
});

test('candidates: mohalla falls back to area, then to Unassigned', () => {
  const list = [
    customer({ id: 'CUST-2', name: 'Customer Two', mohalla: '', area: 'Mohalla B' }),
    customer({ id: 'CUST-3', name: 'Customer Three', mohalla: '', area: '' }),
  ];
  const out = householdLinkCandidates(list, 'CUST-1');
  assert.equal(out[0].id, 'CUST-3', 'name order: Customer Three first');
  assert.equal(out[0].mohalla, 'Unassigned');
  assert.equal(out[1].id, 'CUST-2');
  assert.equal(out[1].mohalla, 'Mohalla B');
});

test('candidates: a non-array gives an empty list', () => {
  assert.deepEqual(householdLinkCandidates(null, 'CUST-1'), []);
});

// --- rows, row text, summary ---

test('rows: each link resolves the other member live from the customer records', () => {
  const rows = householdLinkRows([link()], 'CUST-1', customers());
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    id: 'HHL-1',
    otherId: 'CUST-2',
    otherName: 'Customer Two',
    otherMohalla: 'Mohalla B',
    otherFound: true,
    relationship: 'father and son',
    dateNoted: '2026-11-06',
  });
});

test('rows: a link whose other record is gone still shows the relationship and date', () => {
  const rows = householdLinkRows([link({ customerB: 'CUST-9' })], 'CUST-1', customers());
  assert.equal(rows[0].otherFound, false);
  assert.equal(rows[0].otherName, '');
  assert.equal(householdLinkRowText(rows[0]), 'Customer record not found — father and son — noted 2026-11-06');
});

test('row text: plain words with name, relationship and noted date', () => {
  const rows = householdLinkRows([link()], 'CUST-2', customers());
  assert.equal(householdLinkRowText(rows[0]), 'Customer One — father and son — noted 2026-11-06');
  assert.equal(householdLinkRowText(null), '');
});

test('summary: plain-words counts, including none', () => {
  assert.equal(householdLinkSummaryText([]), 'No household link yet.');
  assert.equal(householdLinkSummaryText([{}]), '1 household link.');
  assert.equal(householdLinkSummaryText([{}, {}]), '2 household links.');
  assert.equal(householdLinkSummaryText(null), 'No household link yet.');
});

test('rows and section: the customer records are never mutated', () => {
  const frozen = deepFreeze(customers());
  const rows = householdLinkRows([link()], 'CUST-1', frozen);
  assert.equal(rows.length, 1);
  const html = householdLinkSectionHtml(customer(), [link()], frozen);
  assert.ok(html.includes('Customer Two'));
});

// --- section html ---

test('section: the other member, relationship and date are shown, with a form for the next link', () => {
  const html = householdLinkSectionHtml(customer(), [link()], customers());
  assert.ok(html.includes('Household link'), 'section heading is shown');
  assert.ok(html.includes('Customer Two'), 'other member name is shown');
  assert.ok(html.includes('father and son'), 'relationship is shown');
  assert.ok(html.includes('2026-11-06'), 'noted date is shown');
  assert.ok(html.includes('data-household-link-remove="HHL-1"'), 'remove button carries the link id');
  assert.ok(html.includes('data-household-link-open="CUST-2"'), 'other member opens with one tap');
  assert.ok(html.includes('id="hhlForm"'), 'add form is present');
  assert.ok(html.includes('id="hhlOther"'), 'other-customer select is present');
  assert.ok(html.includes('id="hhlRelationship"'), 'relationship input is present');
  assert.ok(html.includes('id="hhlDate"'), 'noted-date input is present');
  assert.ok(html.includes('1 household link.'), 'summary is shown');
});

test('section: with no links the empty line shows, and with no other customers the form is replaced', () => {
  const noLinks = householdLinkSectionHtml(customer(), [], customers());
  assert.ok(noLinks.includes('No household link yet.'));
  assert.ok(noLinks.includes('id="hhlForm"'), 'form is still offered when others exist');
  const alone = householdLinkSectionHtml(customer(), [], [customer()]);
  assert.ok(alone.includes('No other customer to link yet.'));
  assert.ok(!alone.includes('id="hhlForm"'), 'no form when there is nobody to link');
});

test('section: markup in names and relationships is escaped', () => {
  const dangerous = [link({ relationship: '<b>bold</b>' })];
  const html = householdLinkSectionHtml(customer(), dangerous, customers());
  assert.ok(html.includes('&lt;b&gt;bold&lt;/b&gt;'), 'relationship markup is escaped');
  assert.ok(!html.includes('<b>bold</b>'), 'raw markup never reaches the page');
  const trickyCustomers = [customer(), customer({ id: 'CUST-2', name: '<script>bad</script>', mohalla: 'Mohalla B' })];
  const options = householdLinkOptionsHtml(householdLinkCandidates(trickyCustomers, 'CUST-1'));
  assert.ok(options.includes('&lt;script&gt;bad&lt;/script&gt;'), 'candidate markup is escaped');
  assert.ok(!options.includes('<script>bad</script>'), 'raw markup never reaches the options');
});

test('section: a non-object customer gives an empty string', () => {
  assert.equal(householdLinkSectionHtml(null, [], customers()), '');
});

// --- store key, purity, fence, wiring ---

test('store: the household link store key is short and versioned', () => {
  assert.equal(HOUSEHOLD_LINK_STORE_KEY, 'shahdara_hhl_links_v1');
});

test('purity: the module is pure and import-free — no storage, clock, network, or neighbour names', () => {
  for (const forbidden of ['document.', 'localStorage', 'new Date(', 'Date.now(', 'fetch(', 'window.', 'import ', 'OLT']) {
    assert.equal(moduleSrc.includes(forbidden), false, `module must not contain ${forbidden}`);
  }
  // The neighbouring modules were checked by filename first and are
  // neither read nor rewritten here, so this module never names them —
  // each name is built from fragments so the literal filename appears
  // nowhere in this file either.
  const ownSrc = readFileSync(fileURLToPath(import.meta.url), 'utf8');
  const neighbours = [
    'fuzzy-' + 'alias-' + 'search',
    'recently-' + 'viewed-' + 'customers',
    'mohalla-' + 'name-' + 'filter',
    'customer-' + 'record-' + 'merge-' + 'note',
    'group-' + 'billing',
    'billing-' + 'link',
    'warranty-' + 'claim-' + 'link',
    'known-' + 'as-' + 'name',
  ];
  for (const name of neighbours) {
    assert.equal(moduleSrc.includes(`${name}.js`), false, `module must not name ${name}.js`);
    assert.equal(ownSrc.includes(`${name}.js`), false, `test must not name ${name}.js`);
  }
});

test('wiring: the app imports the module, loads and saves the links, and shows the section on the profile', () => {
  assert.ok(appSrc.includes("from './household-link.js'"), 'app imports the household link module');
  assert.ok(appSrc.includes('function loadHouseholdLinks()'), 'app loads the household links');
  assert.ok(appSrc.includes('function saveHouseholdLinks(list)'), 'app saves the household links');
  assert.ok(appSrc.includes('HOUSEHOLD_LINK_STORE_KEY'), 'app uses the module store key');
  assert.ok(appSrc.includes('householdLinkSectionHtml(customer, loadHouseholdLinks(), state.customers'), 'app builds the section from the stored links');
  assert.ok(appSrc.includes('${householdLinkSectionMarkup}'), 'profile template carries the household link section');
  // Polish #28 Phase A — the household link lives in the Customer
  // section body, after the freshness group and before the contact
  // fragment; the strip sits above every section in the assembly.
  // The preserved intent is the link renders in Customer, right after
  // the group that used to follow the strip.
  const customerBodyAt = appSrc.indexOf('const profileSectionCustomerBody = ');
  const customerBody = appSrc.slice(customerBodyAt, appSrc.indexOf('\n', customerBodyAt));
  const groupAt = customerBody.indexOf('class="profile-freshness-group"');
  const householdAt = customerBody.indexOf('${householdLinkSectionMarkup}');
  const contactAt = customerBody.indexOf('${profileInfoGroupFragments.contact}');
  assert.ok(groupAt > 0 && householdAt > groupAt && contactAt > householdAt, 'household link section sits after the freshness group and before the contact fragment, inside Customer');
  const stripAnchor = appSrc.indexOf('${profileHeaderStripSectionHtml}');
  const customerShellAt = appSrc.indexOf('${profileSectionCustomerHtml}', stripAnchor);
  assert.ok(stripAnchor > 0 && customerShellAt > stripAnchor, 'Customer section sits after the header strip');
});

test('wiring: the profile binds the add form, the remove buttons, and the one-tap open', () => {
  assert.ok(appSrc.includes("householdLinkSectionEl.querySelector('#hhlForm')"), 'add form is bound');
  assert.ok(appSrc.includes("recordHouseholdLink(before, {"), 'submit records through the module');
  assert.ok(appSrc.includes('data-household-link-remove'), 'remove buttons are bound');
  assert.ok(appSrc.includes('removeHouseholdLink(loadHouseholdLinks()'), 'remove goes through the module');
  assert.ok(appSrc.includes('data-household-link-open'), 'open buttons are bound');
  assert.ok(appSrc.includes('selectCustomer(btn.getAttribute(\'data-household-link-open\'))'), 'opening the other member selects that profile');
});

test('wiring: the stylesheet styles the household link section', () => {
  for (const cls of ['.profile-household-link', '.hhl-list', '.hhl-form', '.hhl-remove', '.hhl-open']) {
    assert.ok(stylesSrc.includes(cls), `stylesheet has ${cls}`);
  }
});
