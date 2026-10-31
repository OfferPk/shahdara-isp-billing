// SISP-92: Customer & Splitter Box GPS Pin + "Nearest Unpaid Customer"
// Haversine Sort in Field Mode. Pure-function + core round-trip tests on
// synthetic data only.
// Spec test criterion (verbatim): "Given biker GPS (33.7660, 73.1350)
// and three customers with stored coordinates, Haversine distance sorts
// the closest customer first accurately."
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SPLITTER_BOX_GPS_STORAGE_KEY,
  captureCurrentPosition,
  clearSplitterBoxPin,
  formatGpsCoords,
  formatGpsDistance,
  getSplitterBoxPin,
  googleMapsUrl,
  hasGpsPin,
  haversineMeters,
  loadSplitterBoxPins,
  normalizeGpsPin,
  sanitizeSplitterBoxGps,
  saveSplitterBoxPins,
  setSplitterBoxPin,
  sortEntriesByNearest
} from '../gps-pin-helper.js';
import { addCustomer, createInitialState, createJsonBackup, persistState, previewJsonBackupMerge, readState, updateCustomerProfile } from '../core.js';
import { gpsPinPresentation } from '../profile-ui.js';
import { renderSplitterBoxGpsRow } from '../splitter-map.js';
import { TRANSLATIONS, t } from '../nav-language.js';

const fakeStorage = (initial = {}) => {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { data.set(key, String(value)); },
    removeItem: (key) => { data.delete(key); },
    _data: data
  };
};

// ---------------------------------------------------------------------------
// Haversine + pin normalization
// ---------------------------------------------------------------------------

test('haversine: same point is 0 m, one latitude degree is ~111,195 m', () => {
  const origin = { lat: 33.766, lng: 73.135 };
  assert.equal(haversineMeters(origin, origin), 0);
  const oneDegree = haversineMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
  assert.ok(Math.abs(oneDegree - 111194.93) < 1, `got ${oneDegree}`);
});

test('haversine: a missing or invalid pin yields null, never zero', () => {
  const origin = { lat: 33.766, lng: 73.135 };
  assert.equal(haversineMeters(origin, {}), null);
  assert.equal(haversineMeters(origin, { gpsLat: 33.7 }), null);
  assert.equal(haversineMeters(null, origin), null);
  assert.equal(haversineMeters(origin, { gpsLat: 999, gpsLng: 73.1 }), null);
});

test('normalizeGpsPin: pairs only — strings accepted, halves and junk rejected', () => {
  assert.deepEqual(normalizeGpsPin({ gpsLat: 33.766, gpsLng: 73.135 }), { lat: 33.766, lng: 73.135 });
  assert.deepEqual(normalizeGpsPin({ gpsLat: '33.7660004', gpsLng: '73.135' }), { lat: 33.766, lng: 73.135 });
  assert.deepEqual(normalizeGpsPin({ lat: -90, lng: 180 }), { lat: -90, lng: 180 });
  assert.equal(normalizeGpsPin({ gpsLat: 33.766 }), null);
  assert.equal(normalizeGpsPin({ gpsLng: 73.135 }), null);
  assert.equal(normalizeGpsPin({ gpsLat: '', gpsLng: '' }), null);
  assert.equal(normalizeGpsPin({ gpsLat: 'north', gpsLng: 73.135 }), null);
  assert.equal(normalizeGpsPin({ gpsLat: 90.0001, gpsLng: 0 }), null);
  assert.equal(normalizeGpsPin({ gpsLat: 0, gpsLng: -180.5 }), null);
  assert.equal(normalizeGpsPin(null), null);
  assert.equal(normalizeGpsPin(undefined), null);
  assert.equal(hasGpsPin({ gpsLat: 1, gpsLng: 2 }), true);
  assert.equal(hasGpsPin({}), false);
});

test('formatGpsDistance: meters under 1 km, km above, unknown renders a dash', () => {
  assert.equal(formatGpsDistance(0), '0 m');
  assert.equal(formatGpsDistance(240.4), '240 m');
  assert.equal(formatGpsDistance(999.6), '1.0 km');
  assert.equal(formatGpsDistance(1111.95), '1.1 km');
  assert.equal(formatGpsDistance(null), '—');
  assert.equal(formatGpsDistance(undefined), '—');
  assert.equal(formatGpsDistance(-5), '—');
});

test('googleMapsUrl + formatGpsCoords: real pins only', () => {
  assert.equal(
    googleMapsUrl({ gpsLat: 33.766, gpsLng: 73.135 }),
    'https://www.google.com/maps?q=33.766,73.135'
  );
  assert.equal(googleMapsUrl({}), null);
  assert.equal(formatGpsCoords({ gpsLat: 33.766, gpsLng: 73.135 }), '33.766, 73.135');
  assert.equal(formatGpsCoords({}), '');
});

// ---------------------------------------------------------------------------
// SPEC PIN: biker at (33.7660, 73.1350), three pinned customers + one without
// ---------------------------------------------------------------------------

const BIKER = { lat: 33.7660, lng: 73.1350 };
const PINNED = [
  // ~1,112 m north (0.01 deg latitude)
  { id: 'c-north', name: 'Synthetic North', gpsLat: 33.7760, gpsLng: 73.1350 },
  // ~924 m east (0.01 deg longitude at this latitude)
  { id: 'c-east', name: 'Synthetic East', gpsLat: 33.7660, gpsLng: 73.1450 },
  // ~100 m north (0.0009 deg latitude)
  { id: 'c-near', name: 'Synthetic Near', gpsLat: 33.7669, gpsLng: 73.1350 },
  // no pin at all
  { id: 'c-nopin', name: 'Synthetic NoPin' }
];

test('spec criterion: biker (33.7660, 73.1350) — Haversine sorts closest first accurately', () => {
  const distances = PINNED.slice(0, 3).map(c => ({ id: c.id, d: haversineMeters(BIKER, c) }));
  const byId = Object.fromEntries(distances.map(({ id, d }) => [id, d]));
  assert.ok(Math.abs(byId['c-near'] - 100.08) < 2, `near distance ${byId['c-near']}`);
  assert.ok(Math.abs(byId['c-east'] - 924.38) < 5, `east distance ${byId['c-east']}`);
  assert.ok(Math.abs(byId['c-north'] - 1111.95) < 5, `north distance ${byId['c-north']}`);
  assert.ok(byId['c-near'] < byId['c-east'] && byId['c-east'] < byId['c-north']);
});

test('spec criterion via Field Mode sort: entries come back nearest-first, unpinned last with null distance', () => {
  const entries = PINNED.map(c => ({ id: c.id, name: c.name, totalDues: 1000 }));
  const sorted = sortEntriesByNearest(entries, PINNED, BIKER);
  assert.deepEqual(sorted.map(e => e.id), ['c-near', 'c-east', 'c-north', 'c-nopin']);
  assert.ok(Math.abs(sorted[0].distanceMeters - 100.08) < 2);
  assert.ok(Math.abs(sorted[1].distanceMeters - 924.38) < 5);
  assert.ok(Math.abs(sorted[2].distanceMeters - 1111.95) < 5);
  assert.equal(sorted[3].distanceMeters, null);
  // The input order is not mutated.
  assert.deepEqual(entries.map(e => e.id), ['c-north', 'c-east', 'c-near', 'c-nopin']);
  // A Map keyed by id works too, and an invalid origin keeps normal order.
  const byMap = sortEntriesByNearest(entries, new Map(PINNED.map(c => [c.id, c])), BIKER);
  assert.deepEqual(byMap.map(e => e.id), ['c-near', 'c-east', 'c-north', 'c-nopin']);
  const noOrigin = sortEntriesByNearest(entries, PINNED, null);
  assert.deepEqual(noOrigin.map(e => e.id), entries.map(e => e.id));
  assert.ok(noOrigin.every(e => e.distanceMeters === null));
});

// ---------------------------------------------------------------------------
// Core: customer record storage (pair-validated, load-sanitized)
// ---------------------------------------------------------------------------

test('core: addCustomer stores a GPS pair, defaults to nulls, rejects a lone coordinate', () => {
  let state = createInitialState([]);
  state = addCustomer(state, 'GPS TEST ONE', new Date('2026-10-01'), { gpsLat: 33.766, gpsLng: 73.135 });
  const pinned = state.customers.find(c => c.name === 'GPS TEST ONE');
  assert.equal(pinned.gpsLat, 33.766);
  assert.equal(pinned.gpsLng, 73.135);

  state = addCustomer(state, 'GPS TEST TWO', new Date('2026-10-01'));
  const unpinned = state.customers.find(c => c.name === 'GPS TEST TWO');
  assert.equal(unpinned.gpsLat, null);
  assert.equal(unpinned.gpsLng, null);

  assert.throws(
    () => addCustomer(state, 'GPS TEST BAD', new Date('2026-10-01'), { gpsLat: 33.766 }),
    /both latitude and longitude/
  );
  assert.throws(
    () => addCustomer(state, 'GPS TEST BAD', new Date('2026-10-01'), { gpsLat: 123, gpsLng: 73.135 }),
    /latitude must be between/
  );
});

test('core: updateCustomerProfile sets, preserves and clears the pin', () => {
  let state = createInitialState([]);
  state = addCustomer(state, 'GPS TEST THREE', new Date('2026-10-01'));
  const id = state.customers[0].id;

  state = updateCustomerProfile(state, id, { gpsLat: '33.7669', gpsLng: '73.135' });
  assert.equal(state.customers[0].gpsLat, 33.7669);
  assert.equal(state.customers[0].gpsLng, 73.135);

  // An unrelated profile save (no gps keys passed) keeps the pin.
  state = updateCustomerProfile(state, id, { phone: '0300-0000000' });
  assert.equal(state.customers[0].gpsLat, 33.7669);
  assert.equal(state.customers[0].gpsLng, 73.135);

  // Both empty clears the pin; a lone coordinate is refused.
  state = updateCustomerProfile(state, id, { gpsLat: '', gpsLng: '' });
  assert.equal(state.customers[0].gpsLat, null);
  assert.equal(state.customers[0].gpsLng, null);
  assert.throws(() => updateCustomerProfile(state, id, { gpsLat: 33.7 }), /both latitude and longitude/);
});

test('core: pin survives a persist/read round-trip; corrupt or legacy data loads as no pin', () => {
  let state = createInitialState([]);
  state = addCustomer(state, 'GPS TEST FOUR', new Date('2026-10-01'), { gpsLat: 33.766, gpsLng: 73.135 });
  const storage = fakeStorage();
  persistState(state, storage);
  const restored = readState(storage);
  assert.equal(restored.customers[0].gpsLat, 33.766);
  assert.equal(restored.customers[0].gpsLng, 73.135);

  // Legacy record: no gps fields at all.
  const legacy = JSON.parse(storage.getItem('shahdara-isp-billing-v1'));
  delete legacy.customers[0].gpsLat;
  delete legacy.customers[0].gpsLng;
  storage.setItem('shahdara-isp-billing-v1', JSON.stringify(legacy));
  const legacyLoaded = readState(storage);
  assert.equal(legacyLoaded.customers[0].gpsLat, null);
  assert.equal(legacyLoaded.customers[0].gpsLng, null);

  // Corrupt record: out-of-range latitude and a half pin both heal to null.
  const corrupt = JSON.parse(storage.getItem('shahdara-isp-billing-v1'));
  corrupt.customers[0].gpsLat = 999;
  corrupt.customers[0].gpsLng = 73.135;
  storage.setItem('shahdara-isp-billing-v1', JSON.stringify(corrupt));
  const healed = readState(storage);
  assert.equal(healed.customers[0].gpsLat, null);
  assert.equal(healed.customers[0].gpsLng, null);
});

// ---------------------------------------------------------------------------
// Splitter-box pin store
// ---------------------------------------------------------------------------

test('box pins: set/get/clear round-trip in the versioned store, pins only', () => {
  const storage = fakeStorage();
  assert.equal(getSplitterBoxPin('DB-01', storage), null);
  assert.deepEqual(setSplitterBoxPin('DB-01', { lat: 33.766, lng: 73.135 }, storage), { lat: 33.766, lng: 73.135 });
  assert.deepEqual(getSplitterBoxPin('DB-01', storage), { lat: 33.766, lng: 73.135 });
  assert.deepEqual(loadSplitterBoxPins(storage), { 'DB-01': { lat: 33.766, lng: 73.135 } });
  const raw = JSON.parse(storage._data.get(SPLITTER_BOX_GPS_STORAGE_KEY));
  assert.deepEqual(Object.keys(raw), ['DB-01']);
  assert.equal(clearSplitterBoxPin('DB-01', storage), true);
  assert.equal(getSplitterBoxPin('DB-01', storage), null);
  assert.equal(clearSplitterBoxPin('DB-01', storage), false);
});

test('box pins: invalid pins and corrupt storage never throw and never fabricate', () => {
  const storage = fakeStorage();
  assert.equal(setSplitterBoxPin('DB-01', { lat: 999, lng: 0 }, storage), null);
  assert.equal(setSplitterBoxPin('', { lat: 1, lng: 2 }, storage), null);
  assert.equal(storage._data.has(SPLITTER_BOX_GPS_STORAGE_KEY), false);
  const corrupt = fakeStorage({ [SPLITTER_BOX_GPS_STORAGE_KEY]: '{not json' });
  assert.deepEqual(loadSplitterBoxPins(corrupt), {});
  assert.equal(getSplitterBoxPin('DB-01', corrupt), null);
  const junk = fakeStorage({
    [SPLITTER_BOX_GPS_STORAGE_KEY]: JSON.stringify({ 'DB-02': { lat: 'x', lng: 1 }, 'DB-03': { gpsLat: 10, gpsLng: 20 } })
  });
  assert.deepEqual(loadSplitterBoxPins(junk), { 'DB-03': { lat: 10, lng: 20 } });
});

// ---------------------------------------------------------------------------
// Capture: fail-safe in every direction
// ---------------------------------------------------------------------------

test('captureCurrentPosition: success resolves a rounded fix', async () => {
  const geo = {
    getCurrentPosition: (success) => success({ coords: { latitude: 33.76600041, longitude: 73.135 } })
  };
  assert.deepEqual(await captureCurrentPosition(geo), { ok: true, lat: 33.766, lng: 73.135 });
});

test('captureCurrentPosition: denial, timeout and missing API resolve ok:false — never reject', async () => {
  const denied = { getCurrentPosition: (_s, error) => error({ code: 1 }) };
  assert.deepEqual(await captureCurrentPosition(denied), { ok: false, reason: 'denied' });
  const timeout = { getCurrentPosition: (_s, error) => error({ code: 3 }) };
  assert.deepEqual(await captureCurrentPosition(timeout), { ok: false, reason: 'timeout' });
  const unavailable = { getCurrentPosition: (_s, error) => error({ code: 2 }) };
  assert.deepEqual(await captureCurrentPosition(unavailable), { ok: false, reason: 'unavailable' });
  assert.deepEqual(await captureCurrentPosition(null), { ok: false, reason: 'unsupported' });
  assert.deepEqual(await captureCurrentPosition({}), { ok: false, reason: 'unsupported' });
  const throwing = { getCurrentPosition: () => { throw new Error('boom'); } };
  assert.deepEqual(await captureCurrentPosition(throwing), { ok: false, reason: 'unavailable' });
});

// ---------------------------------------------------------------------------
// Presentation: profile helper + splitter box row markup
// ---------------------------------------------------------------------------

test('gpsPinPresentation: pin renders coords + maps link; no pin renders neither', () => {
  const withPin = gpsPinPresentation({ gpsLat: 33.766, gpsLng: 73.135 });
  assert.equal(withPin.hasPin, true);
  assert.equal(withPin.coordsLabel, '33.766, 73.135');
  assert.equal(withPin.mapsUrl, 'https://www.google.com/maps?q=33.766,73.135');
  const without = gpsPinPresentation({ name: 'No Pin' });
  assert.equal(without.hasPin, false);
  assert.equal(without.coordsLabel, '');
  assert.equal(without.mapsUrl, null);
});

test('renderSplitterBoxGpsRow: no pin = capture only; pin = coords + maps + remove', () => {
  const noPin = renderSplitterBoxGpsRow('DB-01', null);
  assert.match(noPin, /data-splitter-gps="capture"/);
  assert.doesNotMatch(noPin, /google\.com\/maps/);
  assert.doesNotMatch(noPin, /data-splitter-gps="clear"/);
  const pinned = renderSplitterBoxGpsRow('DB-01', { lat: 33.766, lng: 73.135 });
  assert.match(pinned, /33\.766, 73\.135/);
  assert.match(pinned, /google\.com\/maps\?q=33\.766,73\.135/);
  assert.match(pinned, /data-splitter-gps="clear"/);
  assert.equal(renderSplitterBoxGpsRow('', { lat: 1, lng: 2 }), '');
});

// ---------------------------------------------------------------------------
// i18n audit: every gpspin_* key used in source exists in BOTH dictionaries
// and translates (t() must never fall back to the raw key)
// ---------------------------------------------------------------------------

test('i18n audit: all gpspin_* keys exist in en + ur and none renders as its raw key', () => {
  const sources = ['gps-pin-helper.js', 'field-mode.js', 'splitter-map.js', 'app.js', 'profile-ui.js'];
  const used = new Set();
  for (const file of sources) {
    const text = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    for (const match of text.matchAll(/gpspin_[a-z_]+/g)) used.add(match[0]);
  }
  assert.ok(used.size >= 10, `expected the feature key set, found ${used.size}`);
  for (const key of used) {
    assert.ok(Object.hasOwn(TRANSLATIONS.en, key), `${key} missing from en`);
    assert.ok(Object.hasOwn(TRANSLATIONS.ur, key), `${key} missing from ur`);
    assert.notEqual(t(key, 'en'), key, `${key} renders raw in en`);
    assert.notEqual(t(key, 'ur'), key, `${key} renders raw in ur`);
  }
  // Parameterised label interpolates the (Latin-digit) distance.
  assert.equal(t('gpspin_distance_away', 'en', { distance: '240 m' }), '240 m away');
});

// ---------------------------------------------------------------------------
// Wiring pins: the sort toggle + modal row exist in index.html, the profile
// section is rendered by app.js, and new CSS stays token-only (dark mode)
// ---------------------------------------------------------------------------

test('sanitizeSplitterBoxGps: pairs only — junk dropped, ids trimmed, values normalized', () => {
  assert.deepEqual(sanitizeSplitterBoxGps({
    ' DB-01 ': { lat: 33.7660004, lng: 73.135 },
    'DB-02': { gpsLat: '33.771', gpsLng: '73.141' },
    'DB-03': { lat: 999, lng: 0 },
    'DB-04': { lat: 33.7 },
    '': { lat: 1, lng: 2 },
    'DB-05': 'junk',
    'DB-06': null
  }), {
    'DB-01': { lat: 33.766, lng: 73.135 },
    'DB-02': { lat: 33.771, lng: 73.141 }
  });
  assert.deepEqual(sanitizeSplitterBoxGps(null), {});
  assert.deepEqual(sanitizeSplitterBoxGps(undefined), {});
  assert.deepEqual(sanitizeSplitterBoxGps([{ lat: 1, lng: 2 }]), {});
  assert.deepEqual(sanitizeSplitterBoxGps('junk'), {});
});

test('saveSplitterBoxPins: persists the sanitized map under the store key', () => {
  const storage = fakeStorage();
  assert.equal(saveSplitterBoxPins({ 'DB-01': { lat: 33.766, lng: 73.135 }, 'DB-02': { lat: 999, lng: 0 } }, storage), true);
  assert.deepEqual(JSON.parse(storage.getItem(SPLITTER_BOX_GPS_STORAGE_KEY)), { 'DB-01': { lat: 33.766, lng: 73.135 } });
  assert.deepEqual(loadSplitterBoxPins(storage), { 'DB-01': { lat: 33.766, lng: 73.135 } });
  assert.equal(saveSplitterBoxPins({ 'DB-01': { lat: 1, lng: 2 } }, null), false);
});

// ---------------------------------------------------------------------------
// Backup travel (FU-SISP92-BACKUP): the box-pin store rides settings.splitterBoxGps
// under the sibling safe-merge rule — adopt only when this device has none,
// conflict when both sides differ, and a backup without the section must
// never wipe local pins (legacy backups stay safe).
// ---------------------------------------------------------------------------

const BACKUP_PINS = { 'DB-01': { lat: 33.766, lng: 73.135 }, 'DB-02': { lat: 33.771, lng: 73.141 } };
const BACKUP_DATE = new Date('2026-10-31T12:00:00+05:00');

test('BACKUP ROUND TRIP: box pins export, survive a wipe, and restore back', () => {
  // Device A: pins recorded in the store, exported via the backup path.
  const deviceA = fakeStorage();
  setSplitterBoxPin('DB-01', { lat: 33.766, lng: 73.135 }, deviceA);
  setSplitterBoxPin('DB-02', { lat: 33.771, lng: 73.141 }, deviceA);
  const backupText = createJsonBackup(createInitialState(), BACKUP_DATE, { splitterBoxGps: loadSplitterBoxPins(deviceA) });
  const parsed = JSON.parse(backupText);
  assert.deepEqual(parsed.settings.splitterBoxGps, BACKUP_PINS);

  // Device B: wiped / new phone — empty store adopts the backup's pins.
  const deviceB = fakeStorage();
  const preview = previewJsonBackupMerge(createInitialState(), backupText, {
    currentSplitterBoxGps: loadSplitterBoxPins(deviceB),
    currentSplitterBoxGpsStored: deviceB.getItem(SPLITTER_BOX_GPS_STORAGE_KEY) !== null
  });
  assert.deepEqual(preview.splitterBoxGps, BACKUP_PINS);
  assert.equal(preview.counts.splitterBoxGpsRestored, 1);

  // Apply (mirrors the app.js restore-apply step): pins are back.
  if (preview.splitterBoxGps) saveSplitterBoxPins(preview.splitterBoxGps, deviceB);
  assert.deepEqual(loadSplitterBoxPins(deviceB), BACKUP_PINS);
  assert.deepEqual(getSplitterBoxPin('DB-02', deviceB), { lat: 33.771, lng: 73.141 });
});

test('LEGACY BACKUP: a backup without settings.splitterBoxGps never wipes local pins', () => {
  const device = fakeStorage();
  setSplitterBoxPin('DB-01', { lat: 33.766, lng: 73.135 }, device);
  setSplitterBoxPin('DB-02', { lat: 33.771, lng: 73.141 }, device);

  // An older backup (predates the wiring) carries no splitterBoxGps section.
  const legacyText = createJsonBackup(createInitialState(), BACKUP_DATE, {});
  assert.equal(JSON.parse(legacyText).settings?.splitterBoxGps, undefined);

  const preview = previewJsonBackupMerge(createInitialState(), legacyText, {
    currentSplitterBoxGps: loadSplitterBoxPins(device),
    currentSplitterBoxGpsStored: true
  });
  assert.equal(preview.splitterBoxGps, null);
  assert.equal(preview.counts.splitterBoxGpsRestored, 0);
  assert.equal(preview.conflicts.filter((c) => c.field.startsWith('Splitter box GPS')).length, 0);

  // Apply step writes only a non-null preview section — nothing is written,
  // so the local pins survive the legacy restore byte-for-byte.
  if (preview.splitterBoxGps) saveSplitterBoxPins(preview.splitterBoxGps, device);
  assert.deepEqual(loadSplitterBoxPins(device), BACKUP_PINS);
});

test('SAFE-MERGE: differing pins keep local + conflict; identical pins are a no-op', () => {
  const backupText = createJsonBackup(createInitialState(), BACKUP_DATE, { splitterBoxGps: BACKUP_PINS });

  const clash = previewJsonBackupMerge(createInitialState(), backupText, {
    currentSplitterBoxGps: { 'DB-09': { lat: 33.7, lng: 73.1 } },
    currentSplitterBoxGpsStored: true
  });
  assert.equal(clash.splitterBoxGps, null);
  assert.ok(clash.conflicts.some((c) => c.field === 'Splitter box GPS pins differ from this device'));

  const identical = previewJsonBackupMerge(createInitialState(), backupText, {
    currentSplitterBoxGps: BACKUP_PINS,
    currentSplitterBoxGpsStored: true
  });
  assert.equal(identical.splitterBoxGps, null);
  assert.equal(identical.conflicts.filter((c) => c.field.startsWith('Splitter box GPS')).length, 0);

  // Junk-only pins sanitize to nothing: the section is simply absent.
  const junk = JSON.parse(createJsonBackup(createInitialState(), BACKUP_DATE, { splitterBoxGps: { 'DB-99': { lat: 999, lng: 0 } } }));
  assert.equal(junk.settings?.splitterBoxGps, undefined);
});

test('wiring: backup plumbing carries the splitter-box GPS store (app.js + core.js)', () => {
  const appJs = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(appJs.includes('splitterBoxGps: loadSplitterBoxPins()'));
  assert.ok(appJs.includes('currentSplitterBoxGps: loadSplitterBoxPins()'));
  assert.ok(appJs.includes('currentSplitterBoxGpsStored'));
  assert.ok(appJs.includes('saveSplitterBoxPins(pendingBackupPreview.splitterBoxGps)'));

  const coreJs = readFileSync(new URL('../core.js', import.meta.url), 'utf8');
  assert.ok(coreJs.includes("import { sanitizeSplitterBoxGps } from './gps-pin-helper.js'"));
  assert.ok(coreJs.includes('settings.splitterBoxGps'));
  assert.ok(coreJs.includes('splitterBoxGpsRestored'));
});

test('wiring: index.html carries the Field Mode toggle and the splitter GPS row; CSS is token-only', () => {
  const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(index, /id="fieldModeNearestBtn"/);
  assert.match(index, /id="fieldModeNearestStatus"/);
  assert.match(index, /id="splitterMapGpsRow"/);
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(app, /gpsPinPresentation/);
  assert.match(app, /profileCaptureGpsBtn/);
  const css = readFileSync(new URL('../components.css', import.meta.url), 'utf8');
  const newRules = css.match(/\.(field-mode-sort-row|field-mode-nearest-status|splitter-map-gps-[a-z]+|profile-gps-actions) \{[^}]*\}/g) ?? [];
  assert.ok(newRules.length >= 5, `expected the SISP-92 CSS rules, found ${newRules.length}`);
  for (const rule of newRules) {
    assert.doesNotMatch(rule, /#[0-9a-fA-F]{3,8}\b/, `hardcoded colour in: ${rule}`);
  }
});
