import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DASHBOARD_LABEL_SCRIPTS,
  DASHBOARD_LABELS_STORAGE_KEY,
  DASHBOARD_LABELS_TOGGLE_ID,
  DASHBOARD_SECTION_ID,
  applyDashboardLabels,
  applyStoredDashboardLabels,
  dashboardLabelsToggleText,
  dashboardLabelScriptLabel,
  dashboardUrduLabelMap,
  getDashboardLabelScript,
  resolveDashboardLabelLanguage,
  sanitizeDashboardLabelScript,
  setDashboardLabelScript
} from '../dashboard-urdu-labels.js';
import { TRANSLATIONS } from '../nav-language.js';

// A small in-memory stand-in for the record store: the module
// takes storage in, so the tests never touch the real one.
function fakeStorage(entries = {}) {
  const map = new Map(Object.entries(entries));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
    dump: () => Object.fromEntries(map)
  };
}

// A small stand-in for a page element: text, attributes, and
// children only — enough for the two label passes.
function fakeEl({ id = null, tag = 'p', text = '', attrs = {}, children = [] } = {}) {
  const attributes = new Map(Object.entries(attrs));
  return {
    id,
    tag,
    textContent: text,
    children,
    dataset: {},
    getAttribute: (name) => (attributes.has(name) ? attributes.get(name) : null),
    setAttribute: (name, value) => { attributes.set(name, String(value)); },
    removeAttribute: (name) => { attributes.delete(name); },
    hasAttribute: (name) => attributes.has(name),
    attrs: attributes
  };
}

// A small stand-in for the page: only the billing dashboard and
// the Urdu font link the module can ask for, plus the head the
// font loader appends to.
function fakeDoc(elements = []) {
  const dashboard = {
    querySelectorAll: (selector) => {
      if (selector === '[data-i18n]') return elements.filter((el) => el.getAttribute('data-i18n') !== null);
      if (selector === '*') return elements.slice();
      return [];
    }
  };
  const appended = [];
  const doc = {
    head: { appendChild: (node) => { appended.push(node); } },
    createElement: (tag) => fakeEl({ tag }),
    getElementById: (id) => {
      if (id === DASHBOARD_SECTION_ID) return dashboard;
      if (id === 'urduFontLink') return appended.find((node) => node.id === 'urduFontLink') ?? null;
      return null;
    },
    dashboard,
    appended,
    elements
  };
  return doc;
}

// The dashboard as the app renders it in English: keyed headings
// and field labels, plain labels the renderers wrote, and figure
// lines that must never move.
function englishDashboard() {
  const elements = [
    fakeEl({ tag: 'h3', text: 'Today at a glance', attrs: { 'data-i18n': 'dash_todaycard_title' } }),
    fakeEl({ tag: 'span', text: 'Payments today', attrs: { 'data-i18n': 'dash_todaycard_payments_label' } }),
    fakeEl({ tag: 'p', text: 'All money shown in PKR · no conversion.', attrs: { 'data-i18n': 'dash_units' } }),
    fakeEl({ tag: 'button', text: '+ Add payment', attrs: { 'data-i18n': 'dash_add_payment' } }),
    fakeEl({ tag: 'p', text: 'No package' }),
    fakeEl({ tag: 'p', text: 'Target reached' }),
    fakeEl({ tag: 'p', text: 'No dues' }),
    fakeEl({ tag: 'p', text: 'Collected PKR 3,800 · Due PKR 5,400' }),
    fakeEl({ tag: 'p', text: '5 payments today' }),
    fakeEl({ tag: 'strong', text: 'PKR 8,750.50' }),
    fakeEl({ tag: 'p', text: 'Still due' }),
    fakeEl({ tag: 'p', text: 'No package', children: [fakeEl({ tag: 'span', text: '!' })] }),
    fakeEl({ tag: 'button', id: DASHBOARD_LABELS_TOGGLE_ID, text: 'اردو لیبل' }),
    fakeEl({ tag: 'p', text: 'Home', attrs: { 'data-i18n': 'nav_home' } }),
    fakeEl({ tag: 'p', text: 'Something', attrs: { 'data-i18n': 'dash_no_such_key' } })
  ];
  return { doc: fakeDoc(elements), elements };
}

test('sanitize: only urdu and roman survive, everything else is unset', () => {
  assert.equal(sanitizeDashboardLabelScript('urdu'), 'urdu');
  assert.equal(sanitizeDashboardLabelScript('URDU '), 'urdu');
  assert.equal(sanitizeDashboardLabelScript('roman'), 'roman');
  assert.equal(sanitizeDashboardLabelScript('Roman'), 'roman');
  assert.equal(sanitizeDashboardLabelScript(''), null);
  assert.equal(sanitizeDashboardLabelScript(null), null);
  assert.equal(sanitizeDashboardLabelScript(undefined), null);
  assert.equal(sanitizeDashboardLabelScript(42), null);
  assert.equal(sanitizeDashboardLabelScript('farsi'), null);
  assert.deepEqual(DASHBOARD_LABEL_SCRIPTS, ['roman', 'urdu']);
});

test('label: the script choice reads in plain words', () => {
  assert.equal(dashboardLabelScriptLabel('urdu'), 'Urdu script');
  assert.equal(dashboardLabelScriptLabel('roman'), 'Roman Urdu');
  assert.equal(dashboardLabelScriptLabel(null), 'Roman Urdu');
  assert.equal(dashboardLabelScriptLabel('nonsense'), 'Roman Urdu');
});

test('store: the choice round-trips per device, and clears cleanly', () => {
  const storage = fakeStorage();
  assert.equal(getDashboardLabelScript(storage), null);
  assert.equal(setDashboardLabelScript(storage, 'urdu'), 'urdu');
  assert.equal(getDashboardLabelScript(storage), 'urdu');
  assert.equal(storage.dump()[DASHBOARD_LABELS_STORAGE_KEY], 'urdu');
  assert.equal(setDashboardLabelScript(storage, 'roman'), 'roman');
  assert.equal(getDashboardLabelScript(storage), 'roman');
  assert.equal(setDashboardLabelScript(storage, 'nonsense'), null);
  assert.equal(getDashboardLabelScript(storage), null);
  assert.equal(DASHBOARD_LABELS_STORAGE_KEY in storage.dump(), false);
  assert.equal(setDashboardLabelScript(storage, null), null);
  assert.equal(getDashboardLabelScript(null), null);
  assert.equal(setDashboardLabelScript(null, 'urdu'), 'urdu');
});

test('toggle text: the button names the script to switch to', () => {
  assert.equal(dashboardLabelsToggleText(null), 'اردو لیبل');
  assert.equal(dashboardLabelsToggleText('roman'), 'اردو لیبل');
  assert.equal(dashboardLabelsToggleText('urdu'), 'English labels');
});

test('resolve: urdu always means Urdu script, anything else follows the app', () => {
  assert.equal(resolveDashboardLabelLanguage('urdu', 'en'), 'ur');
  assert.equal(resolveDashboardLabelLanguage('urdu', 'ur'), 'ur');
  assert.equal(resolveDashboardLabelLanguage('roman', 'en'), 'en');
  assert.equal(resolveDashboardLabelLanguage(null, 'en'), 'en');
  assert.equal(resolveDashboardLabelLanguage('roman', 'ur'), 'ur');
  assert.equal(resolveDashboardLabelLanguage(null, 'ur'), 'ur');
  assert.equal(resolveDashboardLabelLanguage('nonsense', 'en'), 'en');
});

test('map: built from the dictionary, param values and ambiguous strings stay out', () => {
  const map = dashboardUrduLabelMap();
  assert.ok(map.size > 100, 'the dashboard dictionary is wide');
  assert.equal(map.get('Today at a glance'), 'آج ایک نظر میں');
  assert.equal(map.get('No package'), 'کوئی پیکج نہیں');
  assert.equal(map.get('Target reached'), 'ہدف حاصل کر لیا گیا');
  assert.equal(map.get('No dues'), 'کوئی واجب رقم نہیں');
  // A rendered figure line never equals a dictionary value.
  assert.equal(map.get('Collected PKR 3,800 · Due PKR 5,400'), undefined);
  assert.equal(map.get('5 payments today'), undefined);
  // A value carrying a placeholder never equals rendered text.
  for (const key of map.keys()) assert.equal(key.includes('{'), false, `${key} carries a placeholder`);
  // 'Still due' is claimed by two keys, but both agree on the
  // same Urdu form, so it switches like any other label.
  assert.equal(map.get('Still due'), 'بقایا');
  // Every Urdu form in the map carries Urdu script.
  for (const [english, urdu] of map) {
    assert.ok(/[\u0600-\u06FF]/.test(urdu), `${english} -> ${urdu} carries no Urdu script`);
    assert.notEqual(urdu, english);
  }
  // The map is built from the dictionary, never a second copy.
  assert.equal(map.get('Today at a glance'), TRANSLATIONS.ur.dash_todaycard_title);
});

test('apply: switching on rewrites keyed headings and field labels to Urdu script', () => {
  const { doc, elements } = englishDashboard();
  const changed = applyDashboardLabels(doc, 'urdu', 'en');
  assert.ok(changed > 0, 'labels changed');
  assert.equal(elements[0].textContent, 'آج ایک نظر میں');
  assert.equal(elements[1].textContent, TRANSLATIONS.ur.dash_todaycard_payments_label);
  assert.equal(elements[2].textContent, 'تمام رقوم PKR میں دکھائی جاتی ہیں · کوئی تبدیلی نہیں۔');
  assert.equal(elements[3].textContent, '+ ادائیگی شامل کریں');
  // The switched labels are marked with their script.
  assert.equal(elements[0].getAttribute('lang'), 'ur');
  assert.equal(elements[1].getAttribute('lang'), 'ur');
  // The Urdu font file is loaded on demand.
  assert.equal(doc.appended.length, 1);
  assert.equal(doc.appended[0].id, 'urduFontLink');
  assert.equal(doc.appended[0].href, './urdu-font.css');
});

test('apply: plain labels the renderers wrote switch too, figure lines never move', () => {
  const { doc, elements } = englishDashboard();
  applyDashboardLabels(doc, 'urdu', 'en');
  assert.equal(elements[4].textContent, 'کوئی پیکج نہیں');
  assert.equal(elements[5].textContent, 'ہدف حاصل کر لیا گیا');
  assert.equal(elements[6].textContent, 'کوئی واجب رقم نہیں');
  // Figures are byte-identical before and after.
  assert.equal(elements[7].textContent, 'Collected PKR 3,800 · Due PKR 5,400');
  assert.equal(elements[8].textContent, '5 payments today');
  assert.equal(elements[9].textContent, 'PKR 8,750.50');
  // The string two keys share switches too — both agree on the
  // same Urdu form.
  assert.equal(elements[10].textContent, 'بقایا');
  // An element wrapping a child keeps its English form so nothing
  // inside it is lost.
  assert.equal(elements[11].textContent, 'No package');
  // The toggle button is never rewritten — its text names the
  // script to switch to.
  assert.equal(elements[12].textContent, 'اردو لیبل');
  // A key from another screen, and a key the dictionary never
  // held, are left alone.
  assert.equal(elements[13].textContent, 'Home');
  assert.equal(elements[14].textContent, 'Something');
});

test('apply: a leaf whose Urdu form two English labels share stays Urdu on restore', () => {
  const doc = fakeDoc([fakeEl({ tag: 'p', text: 'Unpaid' })]);
  applyDashboardLabels(doc, 'urdu', 'en');
  assert.equal(doc.elements[0].textContent, 'بقایا');
  // 'بقایا' is also the Urdu form of 'Still due', so the way back
  // cannot know which English label it was — it stays Urdu rather
  // than guessing wrong. Keyed labels restore exactly; only a
  // bare leaf with a shared Urdu form keeps its Urdu form.
  applyDashboardLabels(doc, 'roman', 'en');
  assert.equal(doc.elements[0].textContent, 'بقایا');
});

test('apply: switching back restores the exact English labels', () => {
  const { doc, elements } = englishDashboard();
  applyDashboardLabels(doc, 'urdu', 'en');
  assert.equal(elements[0].textContent, 'آج ایک نظر میں');
  const changed = applyDashboardLabels(doc, 'roman', 'en');
  assert.ok(changed > 0, 'labels changed back');
  assert.equal(elements[0].textContent, 'Today at a glance');
  assert.equal(elements[1].textContent, 'Payments today');
  assert.equal(elements[2].textContent, 'All money shown in PKR · no conversion.');
  assert.equal(elements[3].textContent, '+ Add payment');
  assert.equal(elements[4].textContent, 'No package');
  assert.equal(elements[5].textContent, 'Target reached');
  assert.equal(elements[6].textContent, 'No dues');
  // 'Still due' shares its Urdu form with 'Unpaid', so the bare
  // leaf keeps its Urdu form on the way back (see the test above);
  // keyed labels restore exactly.
  assert.equal(elements[10].textContent, 'بقایا');
  // The script marker comes off again.
  assert.equal(elements[0].getAttribute('lang'), null);
  // Figures are still byte-identical after the round trip.
  assert.equal(elements[7].textContent, 'Collected PKR 3,800 · Due PKR 5,400');
  assert.equal(elements[9].textContent, 'PKR 8,750.50');
  // Switching back while the labels are already English changes nothing.
  assert.equal(applyDashboardLabels(doc, 'roman', 'en'), 0);
});

test('apply: off follows the app language — Urdu app, Urdu dashboard labels', () => {
  const { doc, elements } = englishDashboard();
  applyDashboardLabels(doc, null, 'ur');
  assert.equal(elements[0].textContent, 'آج ایک نظر میں');
  assert.equal(elements[4].textContent, 'کوئی پیکج نہیں');
  // And 'roman' while the app is Urdu still reads Urdu, so the
  // option never fights the app-wide Urdu mode.
  const { doc: doc2, elements: elements2 } = englishDashboard();
  applyDashboardLabels(doc2, 'roman', 'ur');
  assert.equal(elements2[0].textContent, 'آج ایک نظر میں');
});

test('apply: no dashboard, or no page at all, changes nothing', () => {
  assert.equal(applyDashboardLabels(null, 'urdu', 'en'), 0);
  assert.equal(applyDashboardLabels({}, 'urdu', 'en'), 0);
  const doc = fakeDoc([]);
  doc.getElementById = () => null;
  assert.equal(applyDashboardLabels(doc, 'urdu', 'en'), 0);
});

test('apply stored: the stored choice and the app language are read from the store', () => {
  const { doc, elements } = englishDashboard();
  const storage = fakeStorage({ [DASHBOARD_LABELS_STORAGE_KEY]: 'urdu', shahdara_language_v1: 'en' });
  assert.ok(applyStoredDashboardLabels(doc, storage) > 0);
  assert.equal(elements[0].textContent, 'آج ایک نظر میں');
  const { doc: doc2, elements: elements2 } = englishDashboard();
  const empty = fakeStorage();
  // Nothing stored and the app in English: the labels stay English,
  // so nothing changes.
  assert.equal(applyStoredDashboardLabels(doc2, empty), 0);
  assert.equal(elements2[0].textContent, 'Today at a glance');
  assert.equal(applyStoredDashboardLabels(null, fakeStorage()), 0);
});

test('wiring: the toggle sits beside Add payment, the render applies the stored choice', () => {
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(page.includes(`id="${DASHBOARD_LABELS_TOGGLE_ID}"`), 'toggle button exists');
  assert.ok(page.indexOf(`id="${DASHBOARD_LABELS_TOGGLE_ID}"`) > page.indexOf('id="dplBackToTop"'), 'toggle sits beside Back to top');
  assert.ok(page.includes('اردو لیبل'), 'toggle reads Urdu labels while the dashboard reads Roman');
  assert.equal(page.includes(`data-i18n="dash_urdulabels`), false, 'the toggle carries no dictionary key — its text is stateful');

  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("from './dashboard-urdu-labels.js?v=1.11.0'"), 'dashboard imports the labels module at the pinned version');
  assert.ok(app.includes('applyStoredDashboardLabels(document, storageAvailable ? localStorage : null)'), 'each dashboard render applies the stored choice');
  assert.ok(app.includes(`$('#${DASHBOARD_LABELS_TOGGLE_ID}')`), 'toggle button is looked up');
  assert.ok(app.includes("dulToggle.addEventListener('click'"), 'toggle button is wired');
  assert.ok(app.includes('setDashboardLabelScript(storageAvailable ? localStorage : null'), 'toggle stores the new choice');
  assert.ok(app.includes('dashboardLabelsToggleText('), 'toggle button text follows the stored choice');

  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.ok(css.includes('#billingDashboard [lang="ur"]'), 'switched labels read in the Nastaliq face');
  assert.ok(css.includes("'Noto Nastaliq Urdu'"), 'the Nastaliq face is named');
});

test('the new module names no fenced module file in its header and reads no storage, clock, or page', () => {
  const module = readFileSync(new URL('../dashboard-urdu-labels.js', import.meta.url), 'utf8');
  const header = module.slice(0, module.indexOf('*/'));
  assert.equal(header.includes('.js'), false, 'header names no module file');
  assert.equal(module.includes('full-history-list.js'), false);
  assert.equal(module.includes('localStorage'), false);
  assert.equal(module.includes('document'), false);
  assert.equal(/\bwindow\s*[.([]/.test(module), false, 'module touches the window global');
  // Plan 248: the clock check is `new Date(` / `Date.now(` — a bare
  // `Date(` also matches a pure function call, not a clock read.
  assert.equal(module.includes('new Date('), false);
  assert.equal(module.includes('Date.now'), false);
  // The header is a /* */ block, never // line comments.
  assert.ok(module.startsWith('/*'), 'header is a block comment');
  // PKR only — no other currency symbol or code in the module source
  // (a dollar followed by a digit would be money; `${` template
  // placeholders are not).
  assert.equal(/\$\d|€|£|USD|EUR|GBP/.test(module), false);
});
