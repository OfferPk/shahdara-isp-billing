/*
 * Dashboard labels in Urdu script — one operator-switched option for
 * the billing dashboard: its section headings and field labels read
 * in Urdu script while every figure stays exactly where it was.
 *
 * The dashboard already carries a full Urdu dictionary, and the
 * app-wide language switch already reads the whole app in Urdu —
 * but that switch also flips every other screen, the layout
 * direction, and the currency word. The missing piece is a
 * dashboard-only choice, kept on this device: only the dashboard
 * labels change, the rest of the app stays as it is, and amounts
 * stay in PKR digits as they are — the option never touches a
 * bill, a payment, or a customer record, and it never re-prices
 * anything. It follows the print-time receipt script option's
 * shape: labels change, values never do.
 *
 * How it works: the choice is stored per device under one short
 * key. Applying it walks the billing dashboard only, in two
 * passes. First, every element the page marks with a dashboard
 * dictionary key reads in the target language. Second, a leaf
 * whose whole text is exactly one dictionary label reads in the
 * target language too — that covers the plain labels the
 * renderers write, such as "No package" or "Target reached". A
 * figure line never matches whole, so no amount, count, date, or
 * name is ever rewritten, and an English string claimed by two
 * keys with different Urdu forms is left alone rather than
 * guessed. The way back follows the same rule in reverse: a leaf
 * whose Urdu form two English labels share keeps its Urdu form
 * on restore rather than turning into the wrong English label —
 * keyed labels always restore exactly, since their key is known. Switched labels are marked with their script so the
 * Nastaliq face applies while the rest of the page stays in
 * English, and the Urdu font file is loaded on demand.
 *
 * Scope call, pinned here: switching the option off restores the
 * labels the app itself reads — English while the app is in
 * English. When the whole app is already in Urdu, the dashboard
 * already reads Urdu script and the option changes nothing, so it
 * never fights the app-wide live translation.
 *
 * Pure apart from the page and the store the caller passes in:
 * no clock, no record store of its own, no mutation of any
 * record. The caller owns the page, the store, and the toggle.
 */

import { TRANSLATIONS, ensureUrduFont, getAppLanguage, t } from './nav-language.js';

/** The two scripts a dashboard label can read in. */
export const DASHBOARD_LABEL_SCRIPTS = ['roman', 'urdu'];

/** Where the operator's choice lives on this device. */
export const DASHBOARD_LABELS_STORAGE_KEY = 'shahdara_dash_lbl_v1';

/** The dashboard section whose labels switch. */
export const DASHBOARD_SECTION_ID = 'billingDashboard';

/** The toggle button — its own text is stateful, never rewritten. */
export const DASHBOARD_LABELS_TOGGLE_ID = 'dulLabelsToggle';

/**
 * The stored script choice, or null when unset/corrupt. Unset
 * means "read as the app reads" — Roman while the app is in
 * English, Urdu script while the app is in Urdu.
 */
export function sanitizeDashboardLabelScript(value) {
  const cleaned = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return cleaned === 'urdu' || cleaned === 'roman' ? cleaned : null;
}

/** Human label for a script choice, for panel text. */
export function dashboardLabelScriptLabel(script) {
  return sanitizeDashboardLabelScript(script) === 'urdu' ? 'Urdu script' : 'Roman Urdu';
}

/**
 * Reads the operator's stored dashboard script choice.
 *
 * @param {Object|null} storage - The record store, or null
 * @returns {'urdu'|'roman'|null} The stored choice, or null
 */
export function getDashboardLabelScript(storage) {
  if (!storage) return null;
  try {
    return sanitizeDashboardLabelScript(storage.getItem(DASHBOARD_LABELS_STORAGE_KEY));
  } catch {
    return null;
  }
}

/**
 * Stores the operator's dashboard script choice. An unset or
 * unknown value clears the stored choice.
 *
 * @param {Object|null} storage - The record store, or null
 * @param {string|null} script - 'urdu', 'roman', or anything else to clear
 * @returns {'urdu'|'roman'|null} The choice now stored
 */
export function setDashboardLabelScript(storage, script) {
  const cleaned = sanitizeDashboardLabelScript(script);
  if (!storage) return cleaned;
  try {
    if (cleaned === null) storage.removeItem(DASHBOARD_LABELS_STORAGE_KEY);
    else storage.setItem(DASHBOARD_LABELS_STORAGE_KEY, cleaned);
  } catch {
    /* the choice stays unset when the store refuses it */
  }
  return cleaned;
}

/**
 * The toggle button shows the script the operator can switch to,
 * mirroring the app-wide language toggle: 'اردو لیبل' while the
 * dashboard reads Roman, 'English labels' while it reads Urdu
 * script.
 */
export function dashboardLabelsToggleText(script) {
  return sanitizeDashboardLabelScript(script) === 'urdu' ? 'English labels' : 'اردو لیبل';
}

/**
 * The language the dashboard labels read in. 'urdu' always means
 * Urdu script; anything else follows the app's own language.
 *
 * @param {string|null} script - The stored choice
 * @param {string} [appLanguage='en'] - The app's own language
 * @returns {'en'|'ur'}
 */
export function resolveDashboardLabelLanguage(script, appLanguage = 'en') {
  if (sanitizeDashboardLabelScript(script) === 'urdu') return 'ur';
  return appLanguage === 'ur' ? 'ur' : 'en';
}

/**
 * English dashboard label text mapped to its Urdu-script form,
 * built from the translation dictionary at call time, so the
 * dictionary stays the only place a label lives. Only
 * param-free dashboard labels join: a rendered figure line never
 * equals a dictionary value, and a value carrying a placeholder
 * never equals rendered text, so both stay out. An English string
 * claimed by two keys with different Urdu forms is ambiguous and
 * stays out too — it keeps its English form rather than guessing.
 * (No dashboard label is ambiguous today: the one English string
 * two keys share, 'Still due', agrees on the same Urdu form in
 * both, so it switches like any other label.)
 *
 * @returns {Map<string, string>} English label -> Urdu-script label
 */
export function dashboardUrduLabelMap() {
  const en = TRANSLATIONS?.en ?? {};
  const ur = TRANSLATIONS?.ur ?? {};
  const byEnglish = new Map();
  const ambiguous = new Set();
  for (const key of Object.keys(en)) {
    if (!key.startsWith('dash_')) continue;
    const english = en[key];
    const urdu = ur[key];
    if (typeof english !== 'string' || english === '') continue;
    if (english.includes('{')) continue;
    if (typeof urdu !== 'string' || urdu === '' || urdu === english) continue;
    if (byEnglish.has(english)) {
      if (byEnglish.get(english) !== urdu) ambiguous.add(english);
      continue;
    }
    byEnglish.set(english, urdu);
  }
  for (const text of ambiguous) byEnglish.delete(text);
  return byEnglish;
}

/** Whether the dictionary holds this dashboard key in either language. */
function hasDashboardLabel(key, lang) {
  const table = TRANSLATIONS?.[lang] ?? {};
  const fallback = TRANSLATIONS?.en ?? {};
  return Object.prototype.hasOwnProperty.call(table, key)
    || Object.prototype.hasOwnProperty.call(fallback, key);
}

/** Mark a switched label with its script, or clear the marker. */
function setLabelScript(el, lang) {
  try {
    if (typeof el.setAttribute !== 'function') return;
    if (lang === 'ur') el.setAttribute('lang', 'ur');
    else if (typeof el.removeAttribute === 'function') el.removeAttribute('lang');
  } catch {
    /* a marker is cosmetic; the label still switched */
  }
}

/**
 * Rewrite the billing dashboard's labels in the chosen script.
 * Section headings, subtitles, empty states, and field labels
 * switch; every figure stays byte-identical, and no record is
 * read or changed. Returns how many label elements changed.
 *
 * @param {Object|null} doc - The host page, or null
 * @param {string|null} script - The stored choice ('urdu'/'roman'/null)
 * @param {string} [appLanguage='en'] - The app's own language
 * @returns {number} Label elements rewritten
 */
export function applyDashboardLabels(doc, script, appLanguage = 'en') {
  if (!doc || typeof doc.getElementById !== 'function') return 0;
  const dashboard = doc.getElementById(DASHBOARD_SECTION_ID);
  if (!dashboard || typeof dashboard.querySelectorAll !== 'function') return 0;
  const target = resolveDashboardLabelLanguage(script, appLanguage);
  if (target === 'ur') {
    try {
      ensureUrduFont(doc);
    } catch {
      /* the labels still switch; the face falls back */
    }
  }
  const toUrdu = dashboardUrduLabelMap();
  // The way back is built the same way, with the same rule: an
  // Urdu form two English labels share (four such forms exist
  // today, 'بقایا' among them) is left alone on restore rather
  // than guessed — the leaf keeps its Urdu form instead of
  // turning into the wrong English label.
  const toRoman = new Map();
  const romanAmbiguous = new Set();
  for (const [english, urdu] of toUrdu) {
    if (toRoman.has(urdu)) {
      if (toRoman.get(urdu) !== english) romanAmbiguous.add(urdu);
      continue;
    }
    toRoman.set(urdu, english);
  }
  for (const urdu of romanAmbiguous) toRoman.delete(urdu);
  let changed = 0;

  // Pass 1 — keyed labels: every element the page marks with a
  // dashboard dictionary key reads in the target language. The
  // section headings, subtitles, empty states, and field labels
  // live here. Elements wrapping child elements are left alone so
  // nothing inside them is lost.
  let keyed = [];
  try {
    keyed = dashboard.querySelectorAll('[data-i18n]') ?? [];
  } catch {
    keyed = [];
  }
  for (const el of keyed) {
    if (!el || typeof el.getAttribute !== 'function') continue;
    const key = el.getAttribute('data-i18n');
    if (typeof key !== 'string' || !key.startsWith('dash_')) continue;
    if (!hasDashboardLabel(key, target)) continue;
    if (el.children && el.children.length > 0) continue;
    const text = t(key, target);
    if (typeof el.textContent === 'string' && el.textContent !== text) {
      el.textContent = text;
      changed += 1;
    }
    setLabelScript(el, target);
  }

  // Pass 2 — plain labels the renderers wrote: a leaf whose whole
  // text is exactly one dictionary label reads in the target
  // language. A figure line never matches whole, so no amount,
  // count, date, or name is ever rewritten. The toggle button is
  // never rewritten — its text names the script to switch to. A
  // leaf whose Urdu form two English labels share stays Urdu on
  // the way back rather than guessing wrong.
  let leaves = [];
  try {
    leaves = dashboard.querySelectorAll('*') ?? [];
  } catch {
    leaves = [];
  }
  for (const el of leaves) {
    if (!el || el.id === DASHBOARD_LABELS_TOGGLE_ID) continue;
    if (el.children && el.children.length > 0) continue;
    const current = typeof el.textContent === 'string' ? el.textContent : '';
    if (current === '') continue;
    if (target === 'ur') {
      const urdu = toUrdu.get(current);
      if (urdu !== undefined && urdu !== current) {
        el.textContent = urdu;
        changed += 1;
        setLabelScript(el, target);
      }
    } else {
      const english = toRoman.get(current);
      if (english !== undefined && english !== current) {
        el.textContent = english;
        changed += 1;
        setLabelScript(el, target);
      }
    }
  }
  return changed;
}

/**
 * Apply the operator's stored dashboard script choice, reading
 * both the choice and the app's own language from the store the
 * caller passes in.
 *
 * @param {Object|null} doc - The host page, or null
 * @param {Object|null} storage - The record store, or null
 * @returns {number} Label elements rewritten
 */
export function applyStoredDashboardLabels(doc, storage) {
  const script = getDashboardLabelScript(storage);
  const appLanguage = getAppLanguage(storage);
  return applyDashboardLabels(doc, script, appLanguage);
}
