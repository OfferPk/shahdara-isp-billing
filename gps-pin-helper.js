/**
 * gps-pin-helper.js — SISP-92: Customer & Splitter Box GPS Pin +
 * "Nearest Unpaid Customer" Haversine Sort in Field Mode.
 *
 * Problem: the lineman on a bike in Shahdara/Barrian works from memory —
 * which house is where, which splitter box hangs on which pole, and in
 * what order to ride the collection round. This module gives every
 * customer and every splitter box an optional GPS pin, and lets Field
 * Mode sort the collection list nearest-first from the rider's live
 * position.
 *
 * Storage (no invented data, no migration):
 * - CUSTOMER pins live ON the customer record as the optional pair
 *   gpsLat / gpsLng (validated as a pair in core.js addCustomer /
 *   updateCustomerProfile, sanitized on load in readState — the SISP-24
 *   optical-fields pattern). A record without them has NO pin: absent
 *   is null, never a guessed coordinate.
 * - SPLITTER BOX pins: a box in this app is a splitterBoxId string
 *   shared by its customers (splitter-map.js derives the whole port map
 *   from customer records and owns no store), so a box has no record of
 *   its own to hang a pin on — and parking the box pin on one arbitrary
 *   customer would corrupt that customer's own pin and vanish with his
 *   record. Box pins therefore live in ONE tiny versioned localStorage
 *   map keyed by the existing box ids (the dashboard-collection-target
 *   module-store pattern). It stores pins only — no port, customer or
 *   money data — so the port map still derives from customers alone.
 *
 * Fail-safe rule: geolocation denial, an unsupported device, a corrupt
 * stored pin or a customer without coordinates NEVER dead-ends a flow.
 * Capture resolves a result object instead of throwing, and customers
 * without a pin sort last with no distance label — a distance is only
 * ever printed when it was really computed from two stored/live points.
 *
 * All helpers are pure or storage-injectable and unit-tested; the DOM
 * consumers are field-mode.js (sort + labels), splitter-map.js (box pin
 * row) and app.js (profile capture), wired by the host.
 */

/** Mean Earth radius used by the Haversine formula, in meters. */
export const GPS_EARTH_RADIUS_METERS = 6371000;

/** localStorage key for the splitter-box pin map ({ [boxId]: {lat, lng} }). */
export const SPLITTER_BOX_GPS_STORAGE_KEY = 'sisp_splitter_box_gps_v1';

function roundCoord(value) {
  return Math.round(Number(value) * 1e6) / 1e6;
}

function validCoord(value, min, max) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) return null;
  return roundCoord(number);
}

/**
 * The GPS pin of any record carrying gpsLat / gpsLng (a customer, a box
 * pin entry, or a bare { lat, lng } / { gpsLat, gpsLng } point). A pin
 * is a PAIR: both coordinates must be finite in-range numbers (numeric
 * strings accepted, matching how form values arrive). Anything missing,
 * half-recorded or out of range returns null — no pin, never a guess.
 */
export function normalizeGpsPin(source) {
  if (!source || typeof source !== 'object') return null;
  const lat = validCoord(source.gpsLat ?? source.lat, -90, 90);
  const lng = validCoord(source.gpsLng ?? source.lng, -180, 180);
  if (lat === null || lng === null) return null;
  return { lat, lng };
}

/** True when the record carries a usable GPS pin. */
export function hasGpsPin(source) {
  return normalizeGpsPin(source) !== null;
}

/**
 * Great-circle distance in meters between two pins (Haversine formula).
 * Returns null when either point has no valid pin — callers must treat
 * null as "unknown", never as zero.
 */
export function haversineMeters(a, b) {
  const pinA = normalizeGpsPin(a);
  const pinB = normalizeGpsPin(b);
  if (!pinA || !pinB) return null;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(pinB.lat - pinA.lat);
  const dLng = toRad(pinB.lng - pinA.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat
    + Math.cos(toRad(pinA.lat)) * Math.cos(toRad(pinB.lat)) * sinLng * sinLng;
  return 2 * GPS_EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Short human distance label: '240 m' under a kilometre, '1.2 km' above.
 * null / non-finite / negative input renders '—' (unknown), so a missing
 * pin can never masquerade as "0 m away". Digits stay Latin by design.
 */
export function formatGpsDistance(meters) {
  if (meters === null || meters === undefined || meters === '') return '—';
  const value = Number(meters);
  if (!Number.isFinite(value) || value < 0) return '—';
  const rounded = Math.round(value);
  if (rounded < 1000) return `${rounded} m`;
  return `${(value / 1000).toFixed(1)} km`;
}

/** 'lat, lng' display label for a pin, or '' when there is no pin. */
export function formatGpsCoords(source) {
  const pin = normalizeGpsPin(source);
  return pin ? `${pin.lat}, ${pin.lng}` : '';
}

/**
 * Google Maps link for a pin (opens the dropped-pin view). Returns null
 * when there is no valid pin, so callers render no link at all instead
 * of a broken one.
 */
export function googleMapsUrl(source) {
  const pin = normalizeGpsPin(source);
  if (!pin) return null;
  return `https://www.google.com/maps?q=${pin.lat},${pin.lng}`;
}

/**
 * SISP-92 Field Mode sort: orders pending-collection entries by their
 * customer's Haversine distance from `origin` (the rider's live
 * position), closest first. Each returned entry is a copy annotated
 * with `distanceMeters` (a real number, or null when the customer has
 * no pin or the origin is invalid). Entries with no distance keep their
 * original relative order at the END of the list — they are never
 * dropped and never given an invented distance. `customers` may be the
 * live customers array or a Map keyed by customer id. With no valid
 * origin the entries come back in their original order, all null.
 */
export function sortEntriesByNearest(entries, customers, origin) {
  const list = Array.isArray(entries) ? entries : [];
  const originPin = normalizeGpsPin(origin);
  const byId = customers instanceof Map
    ? customers
    : new Map((Array.isArray(customers) ? customers : []).map(c => [c.id, c]));
  const annotated = list.map((entry, index) => {
    const customer = byId.get(entry?.id) ?? entry;
    const distanceMeters = originPin ? haversineMeters(originPin, customer) : null;
    return { entry: { ...entry, distanceMeters }, distanceMeters, index };
  });
  annotated.sort((a, b) => {
    if (a.distanceMeters === null && b.distanceMeters === null) return a.index - b.index;
    if (a.distanceMeters === null) return 1;
    if (b.distanceMeters === null) return -1;
    return a.distanceMeters - b.distanceMeters || a.index - b.index;
  });
  return annotated.map(item => item.entry);
}

// ============================================================================
// Splitter-box pin store (module-owned localStorage map, pins only)
// ============================================================================

function defaultStorage() {
  return typeof localStorage !== 'undefined' ? localStorage : null;
}

/**
 * Normalizes a raw value into the box-pin map ({ [boxId]: {lat, lng} }).
 * Corrupt entries are dropped, never thrown on: a pin survives only as a
 * valid coordinate pair under a non-blank box id. This is the single
 * normalization path — load/save below and core.js's backup plumbing
 * (settings.splitterBoxGps) all sanitize through here, so a pin means
 * the same thing in storage and in a backup file.
 */
export function sanitizeSplitterBoxGps(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const pins = {};
  for (const [boxId, entry] of Object.entries(value)) {
    const pin = normalizeGpsPin(entry);
    if (boxId.trim() && pin) pins[boxId.trim()] = pin;
  }
  return pins;
}

/** The whole box-pin map. Corrupt / missing storage reads as {}. */
export function loadSplitterBoxPins(storage = defaultStorage()) {
  if (!storage) return {};
  try {
    const parsed = JSON.parse(storage.getItem(SPLITTER_BOX_GPS_STORAGE_KEY) ?? 'null');
    return sanitizeSplitterBoxGps(parsed);
  } catch {
    return {};
  }
}

/** Persists the whole box-pin map (sanitized); never throws. */
export function saveSplitterBoxPins(pins, storage = defaultStorage()) {
  if (!storage) return false;
  try {
    storage.setItem(SPLITTER_BOX_GPS_STORAGE_KEY, JSON.stringify(sanitizeSplitterBoxGps(pins)));
    return true;
  } catch {
    return false;
  }
}

/** One box's pin, or null when the box has none. */
export function getSplitterBoxPin(boxId, storage = defaultStorage()) {
  const cleanBoxId = String(boxId ?? '').trim();
  if (!cleanBoxId) return null;
  return loadSplitterBoxPins(storage)[cleanBoxId] ?? null;
}

/**
 * Stores one box's pin. Returns the normalized pin actually stored, or
 * null when the box id or the coordinates are invalid (nothing written).
 */
export function setSplitterBoxPin(boxId, pin, storage = defaultStorage()) {
  const cleanBoxId = String(boxId ?? '').trim();
  const normalized = normalizeGpsPin(pin);
  if (!cleanBoxId || !normalized || !storage) return null;
  const pins = loadSplitterBoxPins(storage);
  pins[cleanBoxId] = normalized;
  try {
    storage.setItem(SPLITTER_BOX_GPS_STORAGE_KEY, JSON.stringify(pins));
  } catch {
    return null;
  }
  return normalized;
}

/** Removes one box's pin. Returns true when a pin was actually removed. */
export function clearSplitterBoxPin(boxId, storage = defaultStorage()) {
  const cleanBoxId = String(boxId ?? '').trim();
  if (!cleanBoxId || !storage) return false;
  const pins = loadSplitterBoxPins(storage);
  if (!Object.hasOwn(pins, cleanBoxId)) return false;
  delete pins[cleanBoxId];
  try {
    storage.setItem(SPLITTER_BOX_GPS_STORAGE_KEY, JSON.stringify(pins));
  } catch {
    return false;
  }
  return true;
}

// ============================================================================
// Live position capture (fail-safe: resolves, never rejects)
// ============================================================================

/**
 * One live GPS fix. ALWAYS resolves:
 *   { ok: true, lat, lng }                        — a real fix, or
 *   { ok: false, reason }                          — reason is one of
 *   'unsupported' (no geolocation API), 'denied' (permission refused),
 *   'unavailable' (position could not be determined), 'timeout'.
 * Callers fall back to the normal flow on any failure — capturing a pin
 * or sorting by nearest must never become a dead end. `geolocation` is
 * injectable for tests; the default is navigator.geolocation.
 */
export function captureCurrentPosition(geolocation, options = {}) {
  const geo = geolocation
    ?? (typeof navigator !== 'undefined' ? navigator.geolocation : null);
  if (!geo || typeof geo.getCurrentPosition !== 'function') {
    return Promise.resolve({ ok: false, reason: 'unsupported' });
  }
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };
    try {
      geo.getCurrentPosition(
        (position) => {
          const pin = normalizeGpsPin({
            lat: position?.coords?.latitude,
            lng: position?.coords?.longitude
          });
          finish(pin
            ? { ok: true, lat: pin.lat, lng: pin.lng }
            : { ok: false, reason: 'unavailable' });
        },
        (error) => {
          const reason = error?.code === 1
            ? 'denied'
            : error?.code === 3
              ? 'timeout'
              : 'unavailable';
          finish({ ok: false, reason });
        },
        {
          enableHighAccuracy: true,
          timeout: Number.isFinite(options.timeout) ? options.timeout : 15000,
          maximumAge: Number.isFinite(options.maximumAge) ? options.maximumAge : 60000
        }
      );
    } catch {
      finish({ ok: false, reason: 'unavailable' });
    }
  });
}
