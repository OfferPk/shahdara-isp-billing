/*
 * Dashboard keeps the operator's place on refresh — the scroll
 * position and the open collapsible section on the billing
 * dashboard are remembered on this device across a reload, so
 * the owner lands back where they were instead of scrolling
 * down again every single time. The place is only the
 * operator's own view state: a scroll offset and the id of the
 * open collapsible section, if one is open. It never changes a
 * bill, a payment, or a customer record, and it never invents
 * a figure. Clearing the saved place returns the dashboard to
 * the top. The caller passes the page, the viewport, and the
 * record store in, so this module reads no store, clock, or
 * page itself.
 */

export const DASHBOARD_PLACE_KEY = 'shahdara_dashboard_place_v1';

function isUsablePlace(place) {
  if (!place || typeof place !== 'object') return false;
  if (typeof place.scrollY !== 'number' || !Number.isFinite(place.scrollY)) return false;
  if (place.openSectionId !== null && place.openSectionId !== undefined && typeof place.openSectionId !== 'string') return false;
  if (typeof place.openSectionId === 'string' && place.openSectionId.length === 0) return false;
  return true;
}

function normalizePlace(place) {
  return {
    scrollY: Math.max(0, Math.floor(place.scrollY)),
    openSectionId: typeof place.openSectionId === 'string' && place.openSectionId.length > 0 ? place.openSectionId : null
  };
}

/**
 * Reads the operator's current place on the billing dashboard:
 * how far the page is scrolled, and which collapsible section
 * on the dashboard is open, if any.
 *
 * @param {Object} doc - The host page for the view
 * @param {Object} viewport - The page viewport the operator scrolls
 * @returns {Object} { scrollY, openSectionId } — the scroll offset
 *   in pixels, never below zero, and the id of the first open
 *   collapsible section on the dashboard, or null
 */
export function collectDashboardPlace(doc, viewport) {
  const scrollY = Math.max(0, Math.floor(Number(viewport?.scrollY) || 0));
  let openSectionId = null;
  const dashboard = doc?.getElementById ? doc.getElementById('billingDashboard') : null;
  const openSections = dashboard?.querySelectorAll ? dashboard.querySelectorAll('details[open]') : [];
  for (const section of openSections) {
    if (section && typeof section.id === 'string' && section.id.length > 0) {
      openSectionId = section.id;
      break;
    }
  }
  return { scrollY, openSectionId };
}

/**
 * Saves the operator's place on this device, under the
 * dashboard place key.
 *
 * @param {Object|null} storage - The record store, or null when
 *   storage is unavailable
 * @param {Object} place - The place to save, as read by
 *   collectDashboardPlace
 * @returns {boolean} True when the place was saved
 */
export function saveDashboardPlace(storage, place) {
  if (!storage || !isUsablePlace(place)) return false;
  try {
    storage.setItem(DASHBOARD_PLACE_KEY, JSON.stringify(normalizePlace(place)));
    return true;
  } catch {
    return false;
  }
}

/**
 * Reads the saved place back, or null when nothing usable was
 * saved — a missing key, unreadable text, or a wrong shape all
 * read as no saved place, never as a guessed position.
 *
 * @param {Object|null} storage - The record store, or null when
 *   storage is unavailable
 * @returns {Object|null} { scrollY, openSectionId }, or null
 */
export function loadDashboardPlace(storage) {
  if (!storage) return null;
  let raw = null;
  try {
    raw = storage.getItem(DASHBOARD_PLACE_KEY);
  } catch {
    return null;
  }
  if (typeof raw !== 'string' || raw.length === 0) return null;
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isUsablePlace(parsed)) return null;
  return normalizePlace(parsed);
}

/**
 * Clears the saved place, so the next return to the dashboard
 * starts at the top.
 *
 * @param {Object|null} storage - The record store, or null when
 *   storage is unavailable
 * @returns {boolean} True when the saved place was cleared
 */
export function clearDashboardPlace(storage) {
  if (!storage) return false;
  try {
    storage.removeItem(DASHBOARD_PLACE_KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns the dashboard to the saved place: the saved scroll
 * position, with the saved collapsible section opened again.
 * With no saved place the dashboard returns to the top and
 * opens nothing, which is also what follows a clear.
 *
 * @param {Object} doc - The host page for the view
 * @param {Object} viewport - The page viewport the operator scrolls
 * @param {Object|null} storage - The record store, or null when
 *   storage is unavailable
 * @returns {Object|null} The restored place, or null when there
 *   was nothing saved to restore
 */
export function restoreDashboardPlace(doc, viewport, storage) {
  const place = loadDashboardPlace(storage);
  if (place && place.openSectionId) {
    const section = doc?.getElementById ? doc.getElementById(place.openSectionId) : null;
    if (section) section.open = true;
  }
  if (viewport && typeof viewport.scrollTo === 'function') {
    viewport.scrollTo(0, place ? place.scrollY : 0);
  }
  return place;
}

/**
 * Keeps the place up to date while the operator works: the
 * scroll position is saved as the page scrolls, and once more
 * when the page is left or hidden, so a reload always finds
 * the latest place. Returns a function that stops the
 * keeping, for teardown.
 *
 * @param {Object} viewport - The page viewport the operator scrolls
 * @param {Object} doc - The host page for the view
 * @param {Object|null} storage - The record store, or null when
 *   storage is unavailable
 * @returns {Function} Stops the keeping when called
 */
export function bindDashboardPlaceKeeping(viewport, doc, storage) {
  const noop = () => {};
  if (!viewport || typeof viewport.addEventListener !== 'function') return noop;
  let ticking = false;
  const saveNow = () => {
    saveDashboardPlace(storage, collectDashboardPlace(doc, viewport));
  };
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    const frame = typeof viewport.requestAnimationFrame === 'function'
      ? viewport.requestAnimationFrame.bind(viewport)
      : (fn) => { fn(); };
    frame(() => {
      ticking = false;
      saveNow();
    });
  };
  viewport.addEventListener('scroll', onScroll, { passive: true });
  viewport.addEventListener('beforeunload', saveNow);
  const onVisibility = () => {
    if (doc && doc.hidden) saveNow();
  };
  if (doc && typeof doc.addEventListener === 'function') {
    doc.addEventListener('visibilitychange', onVisibility);
  }
  return () => {
    if (typeof viewport.removeEventListener === 'function') {
      viewport.removeEventListener('scroll', onScroll);
      viewport.removeEventListener('beforeunload', saveNow);
    }
    if (doc && typeof doc.removeEventListener === 'function') {
      doc.removeEventListener('visibilitychange', onVisibility);
    }
  };
}
