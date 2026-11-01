/**
 * Shahdara ISP Billing - Field Collection Rounds & Door-to-Door Dues Recovery Suite
 *
 * Implements:
 * 1. Per Area / Mohalla collection route lists prioritizing customers with outstanding dues.
 * 2. Real-time route progress counter: completed vs pending stops, collected vs target dues.
 * 3. 1-Tap 2-tap Quick Collect integration for instant field payment recording and automated stop checkoff.
 * 4. 1-Tap Mobile Quick Profile access for instant balance, billing history, and package details.
 * 5. Direct telephone calling (tel:), Google Maps door-to-door directions, and personalized WhatsApp reminder drafts.
 * 6. One-click clipboard copy reminder fallback when customer phone is missing or unrecorded.
 * 7. Daily dispatch manifest export and 80mm thermal/A4 printable field technician route slip.
 * 8. Persistent date-indexed progress tracking in localStorage under 'shahdara_field_route_progress'.
 */

export const FIELD_ROUTE_PROGRESS_KEY = 'shahdara_field_route_progress';
export const FIELD_ROUTE_NOTES_KEY = 'shahdara_field_route_notes';
export const FIELD_ROUTE_OUTCOMES_KEY = 'shahdara_field_route_outcomes';
export const FIELD_ROUTE_ORDER_KEY = 'shahdara_field_route_order';
export const COLLECTION_PROMISES_STORAGE_KEY = 'shahdara_collection_promises_v1';
export const PAKISTAN_TIME_ZONE = 'Asia/Karachi';

export const FIELD_ROUTE_OUTCOMES = Object.freeze({
  PENDING: 'pending',
  PAID: 'paid',
  PARTIAL: 'partial',
  PROMISED: 'promised',
  NOT_HOME: 'not_home',
  REFUSED: 'refused'
});

/**
 * Returns today's date formatted as YYYY-MM-DD in Pakistan Standard Time (Asia/Karachi).
 * @param {Date} [date]
 * @returns {string} YYYY-MM-DD
 */
export function getTodayDateString(date = new Date()) {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: PAKISTAN_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const parts = Object.fromEntries(
      formatter.formatToParts(date).filter(p => p.type !== 'literal').map(p => [p.type, p.value])
    );
    return `${parts.year}-${parts.month}-${parts.day}`;
  } catch {
    const d = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

function createSafeElement(tag) {
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    return document.createElement(tag);
  }
  return {
    tagName: String(tag).toUpperCase(),
    className: '',
    innerHTML: '',
    textContent: '',
    style: {},
    setAttribute() {},
    getAttribute() { return null; },
    appendChild() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {},
    classList: {
      add() {},
      remove() {},
      contains() { return false; },
      toggle() {}
    }
  };
}

/**
 * Retrieves the field route progress record from storage for the specified date.
 * @param {Storage|object} [storage]
 * @param {string} [dateStr]
 * @returns {{ date: string, collectedIds: string[] }}
 */
export function getFieldRouteProgress(storage, dateStr) {
  const targetDate = dateStr || getTodayDateString();
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store || typeof store.getItem !== 'function') {
    return { date: targetDate, collectedIds: [] };
  }
  try {
    const raw = store.getItem(FIELD_ROUTE_PROGRESS_KEY);
    if (!raw) return { date: targetDate, collectedIds: [] };
    const parsed = JSON.parse(raw);
    if (parsed && parsed.date === targetDate && Array.isArray(parsed.collectedIds)) {
      return { date: targetDate, collectedIds: parsed.collectedIds };
    }
    return { date: targetDate, collectedIds: [] };
  } catch {
    return { date: targetDate, collectedIds: [] };
  }
}

/**
 * Marks a customer stop as collected or pending in storage for the specified date.
 * @param {string} customerId
 * @param {boolean} [collected=true]
 * @param {Storage|object} [storage]
 * @param {string} [dateStr]
 * @returns {{ date: string, collectedIds: string[] }}
 */
export function markRouteStopCollected(customerId, collected = true, storage, dateStr) {
  const targetDate = dateStr || getTodayDateString();
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  const progress = getFieldRouteProgress(store, targetDate);
  const set = new Set(progress.collectedIds || []);
  if (collected) {
    set.add(customerId);
  } else {
    set.delete(customerId);
  }
  const updated = {
    date: targetDate,
    collectedIds: Array.from(set)
  };
  if (store && typeof store.setItem === 'function') {
    try {
      store.setItem(FIELD_ROUTE_PROGRESS_KEY, JSON.stringify(updated));
    } catch {}
  }
  return updated;
}

/**
 * Resets the field route progress for the specified date.
 * @param {Storage|object} [storage]
 * @param {string} [dateStr]
 * @returns {{ date: string, collectedIds: string[] }}
 */
export function clearFieldRouteProgress(storage, dateStr) {
  const targetDate = dateStr || getTodayDateString();
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  const empty = { date: targetDate, collectedIds: [] };
  if (store && typeof store.setItem === 'function') {
    try {
      store.setItem(FIELD_ROUTE_PROGRESS_KEY, JSON.stringify(empty));
    } catch {}
  }
  return empty;
}

/**
 * Retrieves the field route notes from storage for the specified date.
 * @param {Storage|object} [storage]
 * @param {string} [dateStr]
 * @returns {Record<string, string>} Mapping of customerId to note text
 */
export function getFieldRouteNotes(storage, dateStr) {
  const targetDate = dateStr || getTodayDateString();
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store || typeof store.getItem !== 'function') {
    return {};
  }
  try {
    const raw = store.getItem(FIELD_ROUTE_NOTES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && parsed.date === targetDate && typeof parsed.notes === 'object' && parsed.notes !== null) {
      return parsed.notes;
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * Saves a quick field note (e.g. "Promise 20th", "Shop closed") for a stop.
 * @param {string} customerId
 * @param {string} note
 * @param {Storage|object} [storage]
 * @param {string} [dateStr]
 * @returns {Record<string, string>} Updated notes mapping
 */
export function saveFieldRouteNote(customerId, note, storage, dateStr) {
  const targetDate = dateStr || getTodayDateString();
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  const currentNotes = getFieldRouteNotes(store, targetDate);
  const trimmed = (note || '').trim();
  if (trimmed) {
    currentNotes[customerId] = trimmed;
  } else {
    delete currentNotes[customerId];
  }
  const payload = {
    date: targetDate,
    notes: currentNotes
  };
  if (store && typeof store.setItem === 'function') {
    try {
      store.setItem(FIELD_ROUTE_NOTES_KEY, JSON.stringify(payload));
    } catch {}
  }
  return currentNotes;
}

/**
 * Retrieves recorded field route visit outcomes for the specified date.
 * @param {Storage|object} [storage]
 * @param {string} [dateStr]
 * @returns {Record<string, { outcome: string, promiseDate?: string|null, promiseAmount?: number|null, note?: string, timestamp?: string }>}
 */
export function getFieldRouteOutcomes(storage, dateStr) {
  const targetDate = dateStr || getTodayDateString();
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store || typeof store.getItem !== 'function') {
    return {};
  }
  try {
    const raw = store.getItem(FIELD_ROUTE_OUTCOMES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && parsed.date === targetDate && typeof parsed.outcomes === 'object' && parsed.outcomes !== null) {
      return parsed.outcomes;
    }
    if (parsed && typeof parsed === 'object' && parsed[targetDate] && typeof parsed[targetDate] === 'object') {
      return parsed[targetDate];
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * Saves a structured visit outcome (paid, partial, promised, not_home, refused) for a customer stop.
 * Automatically synchronizes with stop collection status and collection promises.
 *
 * @param {string} customerId
 * @param {string|object} outcomeData - 'paid'|'partial'|'promised'|'not_home'|'refused' or object
 * @param {Storage|object} [storage]
 * @param {string} [dateStr]
 * @param {object} [options]
 * @returns {object} Updated customer outcome record
 */
export function saveFieldRouteOutcome(customerId, outcomeData, storage, dateStr, options = {}) {
  const targetDate = dateStr || getTodayDateString();
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  const currentOutcomes = getFieldRouteOutcomes(store, targetDate);

  let rawOutcome = typeof outcomeData === 'string' ? outcomeData : (outcomeData?.outcome || 'pending');
  rawOutcome = String(rawOutcome).trim().toLowerCase();

  const validOutcomes = ['pending', 'paid', 'partial', 'promised', 'not_home', 'refused'];
  const outcome = validOutcomes.includes(rawOutcome) ? rawOutcome : 'pending';

  const noteVal = typeof outcomeData === 'object'
    ? String(outcomeData?.note || outcomeData?.visitNote || '').trim()
    : '';

  const nowIso = new Date().toISOString();
  const record = {
    outcome,
    promiseDate: typeof outcomeData === 'object' && outcomeData?.promiseDate ? String(outcomeData.promiseDate) : null,
    promiseAmount: typeof outcomeData === 'object' && outcomeData?.promiseAmount ? Math.max(0, Number(outcomeData.promiseAmount)) : null,
    note: noteVal,
    visitNote: noteVal,
    amount: typeof outcomeData === 'object' && outcomeData?.amount ? Number(outcomeData.amount) : null,
    timestamp: nowIso
  };

  if (outcome === 'pending') {
    delete currentOutcomes[customerId];
  } else {
    currentOutcomes[customerId] = record;
  }

  const payload = {
    date: targetDate,
    outcomes: currentOutcomes
  };

  if (store && typeof store.setItem === 'function') {
    try {
      store.setItem(FIELD_ROUTE_OUTCOMES_KEY, JSON.stringify(payload));
    } catch {}
  }

  // Synchronize with markRouteStopCollected
  if (outcome === 'paid' || outcome === 'partial') {
    markRouteStopCollected(customerId, true, store, targetDate);
  } else {
    markRouteStopCollected(customerId, false, store, targetDate);
  }

  // If promised, also synchronize with collection promises storage
  if (outcome === 'promised' && record.promiseDate && store && typeof store.getItem === 'function') {
    try {
      const rawPromises = store.getItem(COLLECTION_PROMISES_STORAGE_KEY);
      const promisesList = rawPromises ? JSON.parse(rawPromises) : [];
      const custObj = options.customer || {};
      const promiseId = `prom-${customerId}-${targetDate}`;

      const promiseEntry = {
        id: promiseId,
        customerId: String(customerId),
        customerNumber: custObj.customerNumber != null ? Number(custObj.customerNumber) : null,
        customerName: String(custObj.name || options.name || 'Subscriber').trim(),
        phone: String(custObj.phone || options.phone || '').trim(),
        area: String(custObj.area || custObj.sector || options.area || '').trim(),
        promisedDate: record.promiseDate,
        promisedAmount: record.promiseAmount || Math.max(0, Number(custObj.totalDue || 0)),
        note: record.note || 'Promise recorded on route visit',
        status: 'pending',
        createdAt: nowIso,
        updatedAt: nowIso,
        fulfilledAt: null,
        fulfilledPaymentId: null
      };

      const existingIdx = Array.isArray(promisesList)
        ? promisesList.findIndex(p => p.id === promiseId || (p.customerId === customerId && p.status === 'pending'))
        : -1;
      if (existingIdx >= 0) {
        promisesList[existingIdx] = { ...promisesList[existingIdx], ...promiseEntry };
      } else if (Array.isArray(promisesList)) {
        promisesList.push(promiseEntry);
      }
      store.setItem(COLLECTION_PROMISES_STORAGE_KEY, JSON.stringify(promisesList));
    } catch {}
  }

  return currentOutcomes[customerId] || { outcome: 'pending' };
}

/**
 * Retrieves the custom ordered stop customer IDs for a sector.
 * @param {string} [sector='All']
 * @param {Storage|object} [storage]
 * @returns {Array<string>}
 */
export function getFieldRouteCustomOrder(sector = 'All', storage) {
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store || typeof store.getItem !== 'function') return [];
  try {
    const raw = store.getItem(FIELD_ROUTE_ORDER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      const key = sector || 'All';
      return Array.isArray(parsed[key]) ? parsed[key] : [];
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Saves the custom ordered stop customer IDs for a sector.
 * @param {string} [sector='All']
 * @param {Array<string>} orderedIds
 * @param {Storage|object} [storage]
 * @returns {Array<string>}
 */
export function saveFieldRouteCustomOrder(sector = 'All', orderedIds = [], storage) {
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store || typeof store.setItem !== 'function') return orderedIds;
  try {
    let currentMap = {};
    const raw = store.getItem(FIELD_ROUTE_ORDER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') currentMap = parsed;
    }
    currentMap[sector || 'All'] = Array.isArray(orderedIds) ? orderedIds : [];
    store.setItem(FIELD_ROUTE_ORDER_KEY, JSON.stringify(currentMap));
    return currentMap[sector || 'All'];
  } catch {
    return orderedIds;
  }
}

/**
 * Moves a customer stop up or down in the route order for a sector.
 * @param {string} customerId
 * @param {'up'|'down'} direction
 * @param {string} [sector='All']
 * @param {Array<string>} [fallbackOrder=[]]
 * @param {Storage|object} [storage]
 * @returns {Array<string>}
 */
export function moveRouteStop(customerId, direction, sector = 'All', fallbackOrder = [], storage) {
  const currentOrder = getFieldRouteCustomOrder(sector, storage);
  let orderList = currentOrder.length > 0 ? [...currentOrder] : [...fallbackOrder];

  if (!orderList.includes(customerId)) {
    orderList.push(customerId);
  }

  const idx = orderList.indexOf(customerId);
  if (idx < 0) return orderList;

  if (direction === 'up' && idx > 0) {
    const temp = orderList[idx - 1];
    orderList[idx - 1] = orderList[idx];
    orderList[idx] = temp;
  } else if (direction === 'down' && idx < orderList.length - 1) {
    const temp = orderList[idx + 1];
    orderList[idx + 1] = orderList[idx];
    orderList[idx] = temp;
  }

  saveFieldRouteCustomOrder(sector, orderList, storage);
  return orderList;
}

/**
 * Calculates field collection routes, prioritizing accounts with outstanding dues,
 * grouping by area/mohalla, and evaluating real-time progress.
 *
 * @param {object} state - App state with customers, bills, etc.
 * @param {object} [options]
 * @param {string} [options.sector='All'] - Sector filter ('All' or specific area/mohalla)
 * @param {string} [options.area='All'] - Optional direct area filter
 * @param {string} [options.mohalla] - Optional direct mohalla filter
 * @param {string} [options.sortBy='priority'] - 'priority' | 'due-high' | 'area' | 'name' | 'offline-first'
 * @param {string} [options.query=''] - Text search query
 * @param {string} [options.filterTab='all'] - 'all' | 'pending' | 'collected'
 * @param {string} [options.dateStr] - Target date string
 * @param {Storage|object} [options.storage] - Storage engine
 * @param {boolean} [options.includeZeroBalance=false] - Whether to include settled accounts
 * @returns {object} Comprehensive route data
 */
export function calculateFieldCollectionRoutes(state, options = {}) {
  const customers = Array.isArray(state?.customers) ? state.customers : [];
  const selectedSector = options.sector || 'All';
  const selectedArea = options.area || 'All';
  const selectedMohalla = options.mohalla || '';
  const sortBy = options.sortBy || 'priority';
  const filterQuery = (options.query || '').trim().toLowerCase();
  const filterTab = options.filterTab || 'all'; // 'all', 'pending', 'collected'
  const dateStr = options.dateStr || getTodayDateString();
  const storage = options.storage;
  const progress = getFieldRouteProgress(storage, dateStr);
  const collectedSet = new Set(progress.collectedIds || []);
  const notesMap = getFieldRouteNotes(storage, dateStr);
  const outcomesMap = getFieldRouteOutcomes(storage, dateStr);
  const customOrder = getFieldRouteCustomOrder(selectedSector, storage);
  const customOrderMap = new Map();
  if (Array.isArray(customOrder)) {
    customOrder.forEach((id, idx) => customOrderMap.set(id, idx));
  }

  const allSectors = new Set();
  const allAreas = new Set();
  const candidateStops = [];

  for (const c of customers) {
    if (c.archived) continue;

    let totalDue = 0;
    let overdueBillsCount = 0;
    let unpaidMonthsCount = 0;
    let earliestUnpaidMonth = null;

    if (Array.isArray(c.bills)) {
      for (const b of c.bills) {
        const amt = Number(b.dueAmount) || 0;
        if (amt > 0 && b.status !== 'paid') {
          totalDue += amt;
          overdueBillsCount++;
          unpaidMonthsCount++;
          if (!earliestUnpaidMonth || (b.month && b.month < earliestUnpaidMonth)) {
            earliestUnpaidMonth = b.month;
          }
        }
      }
    } else if (c.balance != null || c.totalDue != null) {
      totalDue = Math.max(0, Number(c.balance || c.totalDue || 0));
      if (totalDue > 0) overdueBillsCount = 1;
    }

    const areaName = (c.area || 'Unassigned').trim();
    const mohallaName = (c.mohalla || '').trim();
    const sector = (c.area ? (c.mohalla ? `${c.area} - ${c.mohalla}` : c.area) : (c.mohalla || 'Unassigned')).trim();

    if (sector) allSectors.add(sector);
    if (areaName) allAreas.add(areaName);

    if (!options.includeZeroBalance && totalDue <= 0) {
      continue;
    }

    const isCollected = collectedSet.has(c.id);
    const outcomeData = outcomesMap[c.id];
    const outcome = outcomeData?.outcome || (isCollected ? 'paid' : 'pending');
    const promiseDate = outcomeData?.promiseDate || null;
    const promiseAmount = outcomeData?.promiseAmount != null ? outcomeData.promiseAmount : null;
    const visitNote = outcomeData?.note || notesMap[c.id] || '';
    const visitTimestamp = outcomeData?.timestamp || null;

    const isOffline = c.status === 'offline';
    const isSuspended = c.status === 'suspended';

    let urgencyScore = totalDue;
    if (isOffline) urgencyScore += 2500;
    if (isSuspended) urgencyScore += 1500;
    if (overdueBillsCount > 1) urgencyScore += overdueBillsCount * 500;

    const rawPhone = (c.phone || '').trim();
    const cleanPhone = rawPhone.replace(/[^\d+]/g, '');
    // SISP-118: WhatsApp drafts prefer the customer's dedicated WhatsApp
    // number when it carries a plausible number of digits; otherwise the
    // primary phone drives the link exactly as before. (This module is
    // import-free by design, so the preference is applied at the source
    // instead of through core's whatsappPhoneFor seam.)
    const waCandidate = String(c.whatsappPhone ?? '').trim().replace(/[^\d+]/g, '');
    let whatsappPhone = waCandidate.replace(/\D/g, '').length >= 10 ? waCandidate : cleanPhone;
    if (whatsappPhone.startsWith('03')) {
      whatsappPhone = '92' + whatsappPhone.slice(1);
    } else if (whatsappPhone.startsWith('3') && whatsappPhone.length === 10) {
      whatsappPhone = '92' + whatsappPhone;
    }

    // Compose polite bilingual payment reminder draft for field technician WhatsApp dispatch
    const reminderLines = [
      `*SHAHDARA ISP - FIELD COLLECTION REMINDER*`,
      `Assalam-o-Alaikum ${c.name || 'Valued Subscriber'},`,
      `Account: #${c.customerNumber || c.id}`,
      `Area: ${areaName}${mohallaName ? ` (${mohallaName})` : ''}`,
      `Outstanding Due: *PKR ${Number(totalDue).toLocaleString()}*`,
      earliestUnpaidMonth ? `Billing Month(s): from ${earliestUnpaidMonth}` : '',
      `Our field representative is in your area today for bill collection.`,
      `Please pay in cash to the collector or via JazzCash/Easypaisa to avoid interruption.`,
      `Thank you!\nShahdara ISP & Fiber Network`
    ].filter(Boolean);

    const whatsappReminderText = reminderLines.join('\n');
    const whatsappReminderUrl = whatsappPhone
      ? `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(whatsappReminderText)}`
      : null;
    const whatsappUrl = whatsappPhone ? `https://wa.me/${whatsappPhone}` : null;
    const phoneUrl = cleanPhone ? `tel:${cleanPhone}` : null;
    // SISP-118: a recorded alternate number gets its own Call target.
    const cleanAlternatePhone = String(c.alternatePhone ?? '').replace(/[^\d+]/g, '');
    const alternatePhoneUrl = cleanAlternatePhone ? `tel:${cleanAlternatePhone}` : null;

    const encodedAddr = encodeURIComponent(`${c.address || ''} ${sector} Shahdara Islamabad`.trim());
    const mapsQueryUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddr}`;

    candidateStops.push({
      id: c.id,
      customerNumber: c.customerNumber || null,
      name: c.name || 'Unnamed Subscriber',
      username: c.username || c.id,
      phone: rawPhone,
      cleanPhone,
      whatsappPhone,
      whatsappUrl,
      whatsappReminderUrl,
      whatsappReminderText,
      phoneUrl,
      alternatePhoneUrl,
      mapsQueryUrl,
      address: c.address || 'Address on file',
      area: areaName,
      mohalla: mohallaName,
      sector,
      plan: c.plan || c.package || 'Standard',
      status: c.status || 'active',
      isOffline,
      isSuspended,
      totalDue,
      overdueBillsCount,
      unpaidMonthsCount,
      earliestUnpaidMonth,
      isCollected,
      outcome,
      promiseDate,
      promiseAmount,
      visitNote,
      visitTimestamp,
      fieldNote: visitNote || notesMap[c.id] || '',
      urgencyScore
    });
  }

  let filteredStops = candidateStops.filter(stop => {
    if (selectedSector !== 'All' && stop.sector !== selectedSector && stop.area !== selectedSector) {
      return false;
    }
    if (selectedArea !== 'All' && stop.area !== selectedArea) {
      return false;
    }
    if (selectedMohalla && stop.mohalla !== selectedMohalla) {
      return false;
    }
    if (filterTab === 'pending' && (stop.isCollected || stop.outcome === 'paid' || stop.outcome === 'partial')) {
      return false;
    }
    if (filterTab === 'collected' && !stop.isCollected && stop.outcome !== 'paid' && stop.outcome !== 'partial') {
      return false;
    }
    if (filterTab === 'paid' && stop.outcome !== 'paid') {
      return false;
    }
    if (filterTab === 'partial' && stop.outcome !== 'partial') {
      return false;
    }
    if (filterTab === 'promised' && stop.outcome !== 'promised') {
      return false;
    }
    if (filterTab === 'not_home' && stop.outcome !== 'not_home') {
      return false;
    }
    if (filterTab === 'refused' && stop.outcome !== 'refused') {
      return false;
    }
    if (filterQuery) {
      const matchName = stop.name.toLowerCase().includes(filterQuery);
      const matchUser = stop.username.toLowerCase().includes(filterQuery);
      const matchPhone = stop.phone.toLowerCase().includes(filterQuery);
      const matchAddr = stop.address.toLowerCase().includes(filterQuery);
      const matchSector = stop.sector.toLowerCase().includes(filterQuery);
      const matchArea = stop.area.toLowerCase().includes(filterQuery);
      const matchMohalla = stop.mohalla.toLowerCase().includes(filterQuery);
      const matchId = String(stop.customerNumber || '').includes(filterQuery) || stop.id.toLowerCase().includes(filterQuery);
      if (!matchName && !matchUser && !matchPhone && !matchAddr && !matchSector && !matchArea && !matchMohalla && !matchId) {
        return false;
      }
    }
    return true;
  });

  filteredStops.sort((a, b) => {
    if (sortBy === 'manual' || (sortBy === 'custom' && customOrderMap.size > 0)) {
      const idxA = customOrderMap.has(a.id) ? customOrderMap.get(a.id) : 999999;
      const idxB = customOrderMap.has(b.id) ? customOrderMap.get(b.id) : 999999;
      if (idxA !== idxB) return idxA - idxB;
      return b.urgencyScore - a.urgencyScore;
    }
    if (sortBy === 'priority') {
      if (a.isCollected !== b.isCollected) {
        return a.isCollected ? 1 : -1;
      }
      return b.urgencyScore - a.urgencyScore;
    }
    if (sortBy === 'due-high') {
      if (a.isCollected !== b.isCollected) {
        return a.isCollected ? 1 : -1;
      }
      return b.totalDue - a.totalDue;
    }
    if (sortBy === 'name') {
      return a.name.localeCompare(b.name);
    }
    if (sortBy === 'area' || sortBy === 'sector') {
      const cmp = a.sector.localeCompare(b.sector);
      return cmp !== 0 ? cmp : b.totalDue - a.totalDue;
    }
    if (sortBy === 'offline-first') {
      if (a.isOffline !== b.isOffline) {
        return a.isOffline ? -1 : 1;
      }
      return b.totalDue - a.totalDue;
    }
    return 0;
  });

  filteredStops = filteredStops.map((stop, index, arr) => ({
    ...stop,
    stopNumber: index + 1,
    canMoveUp: index > 0,
    canMoveDown: index < arr.length - 1
  }));

  const totalStops = filteredStops.length;
  let totalDue = 0;
  let collectedStops = 0;
  let collectedAmount = 0;

  for (const s of filteredStops) {
    totalDue += s.totalDue;
    if (s.isCollected || s.outcome === 'paid' || s.outcome === 'partial') {
      collectedStops++;
      collectedAmount += s.totalDue;
    }
  }

  const pendingStops = totalStops - collectedStops;
  const pendingAmount = totalDue - collectedAmount;
  const completionRate = totalStops > 0 ? Math.round((collectedStops / totalStops) * 100) : 0;

  const roundStatus = completionRate === 100 && totalStops > 0
    ? 'COMPLETED'
    : collectedStops > 0
    ? 'IN_PROGRESS'
    : 'NOT_STARTED';

  // Calculate outcome breakdowns across sector stops
  const outcomesCount = {
    all: 0,
    pending: 0,
    paid: 0,
    partial: 0,
    promised: 0,
    not_home: 0,
    refused: 0
  };

  for (const s of candidateStops) {
    if (selectedSector !== 'All' && s.sector !== selectedSector && s.area !== selectedSector) {
      continue;
    }
    outcomesCount.all++;
    if (s.outcome === 'paid') outcomesCount.paid++;
    else if (s.outcome === 'partial') outcomesCount.partial++;
    else if (s.outcome === 'promised') outcomesCount.promised++;
    else if (s.outcome === 'not_home') outcomesCount.not_home++;
    else if (s.outcome === 'refused') outcomesCount.refused++;
    else outcomesCount.pending++;
  }

  // Area & Sector breakdowns for filtering & analytics
  const sectorMap = new Map();
  const areaMap = new Map();

  for (const s of candidateStops) {
    // Sector map
    if (!sectorMap.has(s.sector)) {
      sectorMap.set(s.sector, { sector: s.sector, totalStops: 0, totalDue: 0, collectedStops: 0, collectedAmount: 0 });
    }
    const sec = sectorMap.get(s.sector);
    sec.totalStops++;
    sec.totalDue += s.totalDue;
    if (s.isCollected) {
      sec.collectedStops++;
      sec.collectedAmount += s.totalDue;
    }

    // Area map
    if (!areaMap.has(s.area)) {
      areaMap.set(s.area, { area: s.area, totalStops: 0, totalDue: 0, collectedStops: 0, collectedAmount: 0 });
    }
    const ar = areaMap.get(s.area);
    ar.totalStops++;
    ar.totalDue += s.totalDue;
    if (s.isCollected) {
      ar.collectedStops++;
      ar.collectedAmount += s.totalDue;
    }
  }

  const sectors = Array.from(sectorMap.values()).sort((a, b) => b.totalDue - a.totalDue);
  const areas = Array.from(areaMap.values()).sort((a, b) => b.totalDue - a.totalDue);

  return {
    date: dateStr,
    selectedSector,
    selectedArea,
    sortBy,
    filterQuery,
    filterTab,
    outcomesCount,

    totalStops,
    totalDue,
    collectedStops,
    collectedAmount,
    pendingStops,
    pendingAmount,
    completionRate,
    roundStatus,
    stops: filteredStops,
    allSectors: ['All', ...Array.from(allSectors).sort()],
    allAreas: ['All', ...Array.from(allAreas).sort()],
    sectors,
    areas
  };
}

/**
 * Generates formatted text manifest for clipboard copy and WhatsApp dispatch to field technician.
 * @param {object} routeData
 * @param {object} [options]
 * @returns {string} Plain text manifest
 */
export function generateFieldRouteManifestText(routeData, options = {}) {
  const date = routeData?.date || getTodayDateString();
  const sector = routeData?.selectedSector || 'All';
  const totalDue = Number(routeData?.totalDue || 0);
  const collectedAmount = Number(routeData?.collectedAmount || 0);
  const pendingAmount = Number(routeData?.pendingAmount || 0);
  const totalStops = Number(routeData?.totalStops || 0);
  const collectedStops = Number(routeData?.collectedStops || 0);
  const pendingStops = Number(routeData?.pendingStops || 0);
  const completionRate = Number(routeData?.completionRate || 0);

  const lines = [
    `*SHAHDARA FIBER NET - FIELD COLLECTION DISPATCH*`,
    `📅 Date: ${date} | 📍 Sector: ${sector}`,
    `🎯 Target Dues: Rs. ${totalDue.toLocaleString()} (${totalStops} stops)`,
    `✅ Recovered: Rs. ${collectedAmount.toLocaleString()} (${collectedStops}/${totalStops} stops - ${completionRate}%)`,
    `⏳ Pending: Rs. ${pendingAmount.toLocaleString()} (${pendingStops} stops remaining)`,
    `----------------------------------------`
  ];

  if (!routeData?.stops || routeData.stops.length === 0) {
    lines.push(`No pending collection stops for this route.`);
  } else {
    routeData.stops.forEach((stop) => {
      let statusIcon = '⚪ [PENDING]';
      if (stop.outcome === 'paid') statusIcon = '✅ [PAID]';
      else if (stop.outcome === 'partial') statusIcon = '½ [PARTIAL]';
      else if (stop.outcome === 'promised') statusIcon = `🤝 [PROMISED${stop.promiseDate ? ` ${stop.promiseDate}` : ''}]`;
      else if (stop.outcome === 'not_home') statusIcon = '🚪 [NOT HOME]';
      else if (stop.outcome === 'refused') statusIcon = '✕ [REFUSED]';
      else if (stop.isCollected) statusIcon = '✅ [COLLECTED]';
      else if (stop.isOffline) statusIcon = '🔴 [OFFLINE]';

      lines.push(`${stop.stopNumber}. ${statusIcon} ${stop.name} (@${stop.username})`);
      lines.push(`   💰 Due: Rs. ${Number(stop.totalDue || 0).toLocaleString()} | 📞 ${stop.phone || 'No phone'}`);
      if (stop.visitNote) {
        lines.push(`   📝 Visit Note: ${stop.visitNote}`);
      }
      lines.push(`   🏠 ${stop.address} [${stop.sector}]`);
    });
  }

  lines.push(`----------------------------------------`);
  lines.push(`Dispatch Generated by Shahdara Mobile Dispatcher`);
  return lines.join('\n');
}

/**
 * Generates an 80mm POS or A4 printable collection checklist slip HTML.
 * @param {object} routeData
 * @returns {string} HTML string
 */
export function generateFieldRouteSlipHtml(routeData) {
  const date = routeData?.date || getTodayDateString();
  const sector = routeData?.selectedSector || 'All';
  const totalDue = Number(routeData?.totalDue || 0);
  const collectedAmount = Number(routeData?.collectedAmount || 0);
  const pendingAmount = Number(routeData?.pendingAmount || 0);
  const totalStops = Number(routeData?.totalStops || 0);
  const stops = routeData?.stops || [];

  const rows = stops.map(s => `
    <tr style="border-bottom: 1px solid #cbd5e1;">
      <td style="padding: 6px 4px; text-align: center; font-size: 11px;">[ ] #${s.stopNumber}</td>
      <td style="padding: 6px 4px;">
        <strong style="font-size: 12px;">${escapeHtml(s.name)}</strong>
        <div style="font-size: 10px; color: #64748b;">${escapeHtml(s.address)} · ${escapeHtml(s.phone || 'No phone')}</div>
      </td>
      <td style="padding: 6px 4px; text-align: right; font-weight: bold; font-size: 12px;">
        Rs. ${Number(s.totalDue).toLocaleString()}
      </td>
    </tr>
  `).join('');

  return `
    <div class="field-route-print-slip" style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 16px; color: #0f172a;">
      <div style="text-align: center; border-bottom: 2px dashed #94a3b8; padding-bottom: 8px; margin-bottom: 12px;">
        <h2 style="margin: 0; font-size: 16px; font-weight: 800;">SHAHDARA FIBER NET</h2>
        <div style="font-size: 12px; font-weight: 600; color: #475569;">Door-to-Door Field Collection Manifest</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Date: ${escapeHtml(date)} | Area: ${escapeHtml(sector)}</div>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 12px; background: #f1f5f9; padding: 8px; border-radius: 6px;">
        <div><strong>Stops:</strong> ${totalStops}</div>
        <div><strong>Target:</strong> Rs. ${totalDue.toLocaleString()}</div>
        <div><strong>Pending:</strong> Rs. ${pendingAmount.toLocaleString()}</div>
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
        <thead>
          <tr style="border-bottom: 2px solid #0f172a; text-align: left;">
            <th style="padding: 4px; width: 45px; text-align: center;">Done</th>
            <th style="padding: 4px;">Customer &amp; Address</th>
            <th style="padding: 4px; text-align: right;">Due</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="3" style="text-align: center; padding: 12px;">No stops recorded</td></tr>'}
        </tbody>
      </table>
      <div style="border-top: 2px dashed #94a3b8; margin-top: 16px; padding-top: 8px; font-size: 10px; text-align: center; color: #64748b;">
        Collected by: _______________________ · Signature: _______________________
      </div>
    </div>
  `;
}

/**
 * Escapes HTML characters.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sets up and manages the Technician Field Collection Route Sheet modal dialog.
 *
 * @param {object} options
 * @param {object} [options.state]
 * @param {function} [options.getState]
 * @param {function} [options.onNavigateCustomer]
 * @param {function} [options.onCollectPayment]
 * @param {function} [options.onQuickProfile]
 * @param {function} [options.onToast]
 * @param {object} [options.clipboard]
 * @param {Storage|object} [options.storage]
 * @returns {object} Controller API
 */
export function setupFieldRouteSheet({
  state,
  getState,
  onNavigateCustomer,
  onCollectPayment,
  onQuickProfile,
  onToast,
  clipboard,
  storage
} = {}) {
  if (typeof document === 'undefined') {
    return {
      open: () => {},
      close: () => {},
      recalculate: () => ({ totalStops: 0 }),
      getRouteData: () => ({ stops: [] })
    };
  }

  const modal = document.getElementById('fieldRouteModal');
  const closeBtn = document.getElementById('fieldRouteCloseBtn');
  const sectorFilter = document.getElementById('routeSectorFilter');
  const sortFilter = document.getElementById('routeSortFilter');
  const searchInput = document.getElementById('routeSearchInput');
  const stopsList = document.getElementById('fieldRouteStopsList');
  const emptyState = document.getElementById('routeEmptyState');
  const targetVal = document.getElementById('routeMetricTarget');
  const collectedVal = document.getElementById('routeMetricCollected');
  const pendingVal = document.getElementById('routeMetricPending');
  const stopsVal = document.getElementById('routeMetricStops');
  const progressText = document.getElementById('routeProgressText');
  const progressBarFill = document.getElementById('routeProgressBarFill');
  const resetBtn = document.getElementById('resetRouteProgressBtn');
  const copyBtn = document.getElementById('copyRouteManifestBtn');
  const shareWhatsappBtn = document.getElementById('shareRouteWhatsappBtn');
  const printSlipBtn = document.getElementById('printRouteSlipBtn');

  const openBtns = document.querySelectorAll('[data-open-field-route]');

  let currentState = state || (typeof getState === 'function' ? getState() : null);
  let lastRouteData = null;
  let currentFilterTab = 'all'; // 'all', 'pending', 'collected'

  function getCurrentState() {
    if (typeof getState === 'function') {
      const s = getState();
      if (s) currentState = s;
    }
    return currentState || {};
  }

  function triggerHaptic(type = 'light') {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      if (type === 'light') navigator.vibrate(10);
      else if (type === 'medium') navigator.vibrate(25);
      else if (type === 'selection') navigator.vibrate(15);
    }
  }

  function updateUi() {
    const s = getCurrentState();
    const sector = sectorFilter ? sectorFilter.value : 'All';
    const sortBy = sortFilter ? sortFilter.value : 'priority';
    const query = searchInput ? searchInput.value : '';

    const routeData = calculateFieldCollectionRoutes(s, {
      sector,
      sortBy,
      query,
      filterTab: currentFilterTab,
      storage
    });
    lastRouteData = routeData;

    // Populate sector dropdown if not already populated
    if (sectorFilter && sectorFilter.options && sectorFilter.options.length <= 1 && routeData.allSectors.length > 1) {
      const prevVal = sectorFilter.value;
      sectorFilter.innerHTML = '';
      routeData.allSectors.forEach(sec => {
        const opt = createSafeElement('option');
        opt.value = sec;
        opt.textContent = sec === 'All' ? 'All Sectors' : sec;
        if (sec === prevVal) opt.selected = true;
        sectorFilter.appendChild(opt);
      });
    }

    if (targetVal) targetVal.textContent = `Rs. ${routeData.totalDue.toLocaleString()}`;
    if (collectedVal) collectedVal.textContent = `Rs. ${routeData.collectedAmount.toLocaleString()}`;
    if (pendingVal) pendingVal.textContent = `Rs. ${routeData.pendingAmount.toLocaleString()}`;
    if (stopsVal) stopsVal.textContent = `${routeData.pendingStops} / ${routeData.totalStops}`;

    if (progressText) {
      progressText.textContent = `${routeData.completionRate}% Route Completed (${routeData.collectedStops}/${routeData.totalStops} stops)`;
    }
    if (progressBarFill) {
      progressBarFill.style.width = `${routeData.completionRate}%`;
    }

    if (stopsList) {
      stopsList.innerHTML = '';
      if (!routeData.stops || routeData.stops.length === 0) {
        if (emptyState) emptyState.hidden = false;
      } else {
        if (emptyState) emptyState.hidden = true;
        routeData.stops.forEach(stop => {
          const card = createSafeElement('div');
          const isStopCollected = stop.isCollected || stop.outcome === 'paid' || stop.outcome === 'partial';
          card.className = `route-card${isStopCollected ? ' is-collected' : ''}`;
          card.setAttribute('data-customer-id', stop.id);

          const statusBadge = stop.isOffline
            ? '<span class="role-badge role-warn">Offline</span>'
            : stop.isSuspended
            ? '<span class="role-badge role-danger">Suspended</span>'
            : '<span class="role-badge role-primary">Active</span>';

          const outcome = stop.outcome || (isStopCollected ? 'paid' : 'pending');
          const outcomeBadge = outcome === 'paid'
            ? '<span class="role-badge role-primary" style="background: #047857; color: white;">✓ Paid</span>'
            : outcome === 'partial'
            ? '<span class="role-badge" style="background: #0284c7; color: white;">½ Partial</span>'
            : outcome === 'promised'
            ? '<span class="role-badge" style="background: #b45309; color: white;">🤝 Promised</span>'
            : outcome === 'not_home'
            ? '<span class="role-badge" style="background: #64748b; color: white;">🚪 Not Home</span>'
            : outcome === 'refused'
            ? '<span class="role-badge" style="background: #dc2626; color: white;">✕ Refused</span>'
            : '';

          const whatsappAction = stop.whatsappReminderUrl || stop.whatsappUrl
            ? `<a href="${escapeHtml(stop.whatsappReminderUrl || stop.whatsappUrl)}" target="_blank" rel="noopener noreferrer" class="action-btn-sm" aria-label="WhatsApp reminder for ${escapeHtml(stop.name)}">💬 WhatsApp</a>`
            : `<button type="button" class="action-btn-sm" data-copy-reminder="${escapeHtml(stop.id)}" aria-label="Copy reminder text for ${escapeHtml(stop.name)}">📋 Reminder</button>`;

          const promiseDetails = (outcome === 'promised' && stop.promiseDate)
            ? `<div class="route-stop-promise-info" style="margin-top: 4px; font-size: 11px; color: #b45309; font-weight: 600;">
                 📅 Promised Date: ${escapeHtml(stop.promiseDate)}${stop.promiseAmount ? ` · Rs. ${Number(stop.promiseAmount).toLocaleString()}` : ''}
               </div>`
            : '';

          const visitNoteInfo = (stop.visitNote)
            ? `<div class="route-stop-note-info" style="margin-top: 2px; font-size: 11px; color: #475569; font-style: italic;">
                 📝 Note: ${escapeHtml(stop.visitNote)}
               </div>`
            : '';

          card.innerHTML = `
            <div class="route-card-left">
              <div class="route-card-header">
                <span class="route-card-stop-num">#${stop.stopNumber}</span>
                <span class="route-card-name">${escapeHtml(stop.name)}</span>
                <span class="route-card-username">@${escapeHtml(stop.username)}</span>
                ${statusBadge}
                ${outcomeBadge}
              </div>
              <div class="route-card-meta">
                <span class="route-card-addr">📍 ${escapeHtml(stop.address)} [${escapeHtml(stop.sector)}]</span>
                <span class="route-card-due">💰 Due: <strong>Rs. ${Number(stop.totalDue).toLocaleString()}</strong></span>
              </div>
              ${promiseDetails}
              ${visitNoteInfo}
              <div class="route-card-contact-row">
                ${stop.phoneUrl ? `<a href="${stop.phoneUrl}" class="action-btn-sm" aria-label="Call ${escapeHtml(stop.name)}">📞 Call</a>` : ''}
                ${stop.alternatePhoneUrl ? `<a href="${stop.alternatePhoneUrl}" class="action-btn-sm" aria-label="Call alternate number for ${escapeHtml(stop.name)}">📞 Alt Call</a>` : ''}
                ${whatsappAction}
                <a href="${stop.mapsQueryUrl}" target="_blank" rel="noopener noreferrer" class="action-btn-sm" aria-label="Navigate to ${escapeHtml(stop.name)}">🗺️ Map</a>
              </div>
            </div>
            <div class="route-card-right">
              <div class="route-outcome-actions" style="display: flex; gap: 3px; flex-wrap: wrap; margin-bottom: 6px;">
                <button type="button" class="action-btn-xs outcome-btn ${outcome === 'paid' ? 'is-active' : ''}" data-set-outcome="paid" data-customer-id="${escapeHtml(stop.id)}" title="Customer Paid in Full">Paid</button>
                <button type="button" class="action-btn-xs outcome-btn ${outcome === 'partial' ? 'is-active' : ''}" data-set-outcome="partial" data-customer-id="${escapeHtml(stop.id)}" title="Partial Payment">Partial</button>
                <button type="button" class="action-btn-xs outcome-btn ${outcome === 'promised' ? 'is-active' : ''}" data-set-outcome="promised" data-customer-id="${escapeHtml(stop.id)}" title="Customer Promised (Wada)">Promised</button>
                <button type="button" class="action-btn-xs outcome-btn ${outcome === 'not_home' ? 'is-active' : ''}" data-set-outcome="not_home" data-customer-id="${escapeHtml(stop.id)}" title="Customer Not at Home">Not Home</button>
                <button type="button" class="action-btn-xs outcome-btn ${outcome === 'refused' ? 'is-active' : ''}" data-set-outcome="refused" data-customer-id="${escapeHtml(stop.id)}" title="Customer Refused / Dispute">Refused</button>
              </div>
              <div class="route-action-buttons-row" style="display: flex; gap: 4px; align-items: center; justify-content: flex-end; flex-wrap: wrap;">
                <button type="button" class="action-btn-xs route-reorder-btn" data-move-stop="up" data-customer-id="${escapeHtml(stop.id)}" ${!stop.canMoveUp ? 'disabled' : ''} title="Move Stop Up">▲</button>
                <button type="button" class="action-btn-xs route-reorder-btn" data-move-stop="down" data-customer-id="${escapeHtml(stop.id)}" ${!stop.canMoveDown ? 'disabled' : ''} title="Move Stop Down">▼</button>
                <label class="route-stop-toggle-label" style="display: inline-flex; align-items: center; gap: 3px; font-size: 11px;">
                  <input type="checkbox" class="route-stop-checkbox" data-stop-toggle="${escapeHtml(stop.id)}" ${isStopCollected ? 'checked' : ''}>
                  <span>Done</span>
                </label>
                <button type="button" class="action-btn-sm primary-sm" data-stop-collect="${escapeHtml(stop.id)}">Receive Cash</button>
                <button type="button" class="action-btn-sm" data-stop-quick-profile="${escapeHtml(stop.id)}">ℹ️ Profile</button>
                <button type="button" class="action-btn-sm" data-stop-note-btn="${escapeHtml(stop.id)}">📝 Note</button>
              </div>
            </div>
          `;


          stopsList.appendChild(card);
        });
      }
    }

    return routeData;
  }

  if (sectorFilter && !sectorFilter.dataset?.wiredRoute) {
    if (sectorFilter.dataset) sectorFilter.dataset.wiredRoute = 'true';
    sectorFilter.addEventListener('change', () => {
      triggerHaptic('selection');
      updateUi();
    });
  }

  if (sortFilter && !sortFilter.dataset?.wiredRoute) {
    if (sortFilter.dataset) sortFilter.dataset.wiredRoute = 'true';
    sortFilter.addEventListener('change', () => {
      triggerHaptic('selection');
      updateUi();
    });
  }

  if (searchInput && !searchInput.dataset?.wiredRoute) {
    if (searchInput.dataset) searchInput.dataset.wiredRoute = 'true';
    searchInput.addEventListener('input', () => {
      updateUi();
    });
  }

  if (stopsList && !stopsList.dataset?.wiredRoute) {
    if (stopsList.dataset) stopsList.dataset.wiredRoute = 'true';
    stopsList.addEventListener('click', (e) => {
      // 1. Toggle collected checkbox
      const toggle = e.target.closest('[data-stop-toggle]');
      if (toggle) {
        const custId = toggle.getAttribute('data-stop-toggle');
        const isChecked = toggle.checked;
        triggerHaptic('light');
        markRouteStopCollected(custId, isChecked, storage);
        updateUi();
        if (typeof onToast === 'function') {
          onToast(isChecked ? 'Stop marked as collected' : 'Stop reverted to pending');
        }
        return;
      }

      // 2. 1-Tap Receive Cash -> Quick Collect
      const collectBtn = e.target.closest('[data-stop-collect]');
      if (collectBtn) {
        const custId = collectBtn.getAttribute('data-stop-collect');
        triggerHaptic('medium');
        if (typeof onCollectPayment === 'function') {
          onCollectPayment(custId);
        }
        return;
      }

      // 3. 1-Tap Quick Profile Sheet
      const quickProfileBtn = e.target.closest('[data-stop-quick-profile]');
      if (quickProfileBtn) {
        const custId = quickProfileBtn.getAttribute('data-stop-quick-profile');
        triggerHaptic('selection');
        if (typeof onQuickProfile === 'function') {
          onQuickProfile(custId);
        } else if (typeof onNavigateCustomer === 'function') {
          if (typeof modal?.close === 'function') modal.close();
          onNavigateCustomer(custId);
        }
        return;
      }

      // 4. Fallback Full Profile
      const profileBtn = e.target.closest('[data-stop-profile]');
      if (profileBtn) {
        const custId = profileBtn.getAttribute('data-stop-profile');
        triggerHaptic('selection');
        if (typeof modal?.close === 'function') modal.close();
        else if (modal) modal.removeAttribute('open');
        if (typeof onNavigateCustomer === 'function') {
          onNavigateCustomer(custId);
        }
        return;
      }

      // 5. Copy Reminder draft text
      const copyReminderBtn = e.target.closest('[data-copy-reminder]');
      if (copyReminderBtn) {
        const custId = copyReminderBtn.getAttribute('data-copy-reminder');
        const stop = lastRouteData?.stops?.find(s => s.id === custId);
        if (stop?.whatsappReminderText) {
          triggerHaptic('light');
          if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(stop.whatsappReminderText).then(() => {
              if (typeof onToast === 'function') onToast(`Reminder copied for ${stop.name}`);
            }).catch(() => {});
          } else if (typeof onToast === 'function') {
            onToast(`Reminder copied for ${stop.name}`);
          }
        }
        return;
      }

      // 6. Set visit outcome (Paid, Partial, Promised, Not Home, Refused)
      const outcomeBtn = e.target.closest('[data-set-outcome]');
      if (outcomeBtn) {
        const outcome = outcomeBtn.getAttribute('data-set-outcome');
        const custId = outcomeBtn.getAttribute('data-customer-id');
        const stop = lastRouteData?.stops?.find(s => s.id === custId);
        if (outcome === 'promised') {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          const defDate = getTodayDateString(tomorrow);
          const promiseDateInput = (typeof window !== 'undefined' && typeof window.prompt === 'function')
            ? window.prompt(`Enter promise date (YYYY-MM-DD) for ${stop?.name || 'Customer'}:`, defDate)
            : defDate;
          if (promiseDateInput && promiseDateInput.trim()) {
            const noteInput = (typeof window !== 'undefined' && typeof window.prompt === 'function')
              ? (window.prompt('Promise note / remarks (optional):', 'Will pay on visit') || '')
              : '';
            saveFieldRouteOutcome(custId, {
              outcome: 'promised',
              promiseDate: promiseDateInput.trim(),
              promiseAmount: stop?.totalDue,
              note: noteInput
            }, storage, undefined, { customer: stop });
            if (typeof onToast === 'function') onToast(`Recorded promise for ${stop?.name || 'Customer'}`);
          }
        } else {
          saveFieldRouteOutcome(custId, outcome, storage, undefined, { customer: stop });
          if (typeof onToast === 'function') {
            const labels = {
              paid: 'Stop marked as Paid (Full)',
              partial: 'Stop marked as Partial Payment',
              not_home: 'Stop marked as Not at Home',
              refused: 'Stop marked as Refused / Disputed'
            };
            onToast(labels[outcome] || `Outcome updated to ${outcome}`);
          }
        }
        triggerHaptic('light');
        updateUi();
        return;
      }

      // 7. Reorder stop (Up / Down)
      const moveBtn = e.target.closest('[data-move-stop]');
      if (moveBtn) {
        const dir = moveBtn.getAttribute('data-move-stop');
        const custId = moveBtn.getAttribute('data-customer-id');
        const sec = sectorFilter ? sectorFilter.value : 'All';
        const fallbackIds = (lastRouteData?.stops || []).map(s => s.id);
        moveRouteStop(custId, dir, sec, fallbackIds, storage);
        if (sortFilter) sortFilter.value = 'manual';
        triggerHaptic('selection');
        updateUi();
        return;
      }

      // 8. Add / Edit Stop Note
      const noteBtn = e.target.closest('[data-stop-note-btn]');
      if (noteBtn) {
        const custId = noteBtn.getAttribute('data-stop-note-btn');
        const stop = lastRouteData?.stops?.find(s => s.id === custId);
        const existingNote = stop?.visitNote || stop?.fieldNote || '';
        const newNote = (typeof window !== 'undefined' && typeof window.prompt === 'function')
          ? window.prompt(`Field note for ${stop?.name || 'Customer'}:`, existingNote)
          : null;
        if (newNote !== null) {
          saveFieldRouteNote(custId, newNote, storage);
          if (stop?.outcome && stop.outcome !== 'pending') {
            saveFieldRouteOutcome(custId, { ...stop, outcome: stop.outcome, note: newNote }, storage, undefined, { customer: stop });
          }
          triggerHaptic('light');
          updateUi();
          if (typeof onToast === 'function') onToast(`Note saved for ${stop?.name || 'Customer'}`);
        }
        return;
      }
    });
  }

  // Filter tabs click wiring
  const routeTabs = modal && typeof modal.querySelectorAll === 'function'
    ? modal.querySelectorAll('[data-route-tab]')
    : [];
  routeTabs.forEach(tabBtn => {
    if (!tabBtn.dataset?.wiredRouteTab) {
      tabBtn.dataset.wiredRouteTab = 'true';
      tabBtn.addEventListener('click', () => {
        const tab = tabBtn.getAttribute('data-route-tab') || 'all';
        currentFilterTab = tab;
        routeTabs.forEach(t => {
          const isSelected = t === tabBtn;
          t.classList.toggle('is-active', isSelected);
          t.setAttribute('aria-selected', isSelected ? 'true' : 'false');
        });
        triggerHaptic('selection');
        updateUi();
      });
    }
  });

  // Open Daily Closing Cash Handover from Field Route Sheet
  const handoverFromRouteBtn = document.getElementById('openHandoverFromRouteBtn');
  if (handoverFromRouteBtn && !handoverFromRouteBtn.dataset?.wiredRoute) {
    handoverFromRouteBtn.dataset.wiredRoute = 'true';
    handoverFromRouteBtn.addEventListener('click', () => {
      close();
      const dcModal = document.getElementById('dailyClosingModal');
      if (dcModal && typeof dcModal.showModal === 'function') {
        dcModal.showModal();
        const sec = document.getElementById('dailyClosingHandoverSection');
        if (sec && typeof sec.scrollIntoView === 'function') {
          setTimeout(() => sec.scrollIntoView({ behavior: 'smooth' }), 100);
        }
      }
    });
  }

  if (resetBtn && !resetBtn.dataset?.wiredRoute) {
    if (resetBtn.dataset) resetBtn.dataset.wiredRoute = 'true';
    resetBtn.addEventListener('click', () => {
      clearFieldRouteProgress(storage);
      triggerHaptic('medium');
      updateUi();
      if (typeof onToast === 'function') onToast("Today's route collection progress reset.");
    });
  }

  if (copyBtn && !copyBtn.dataset?.wiredRoute) {
    if (copyBtn.dataset) copyBtn.dataset.wiredRoute = 'true';
    copyBtn.addEventListener('click', () => {
      const manifest = generateFieldRouteManifestText(lastRouteData);
      triggerHaptic('medium');
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(manifest).then(() => {
          if (typeof onToast === 'function') onToast('Field collection manifest copied to clipboard.');
        }).catch(() => {});
      } else if (typeof onToast === 'function') {
        onToast('Field collection manifest copied to clipboard.');
      }
    });
  }

  if (shareWhatsappBtn && !shareWhatsappBtn.dataset?.wiredRoute) {
    if (shareWhatsappBtn.dataset) shareWhatsappBtn.dataset.wiredRoute = 'true';
    shareWhatsappBtn.addEventListener('click', () => {
      const manifest = generateFieldRouteManifestText(lastRouteData);
      triggerHaptic('medium');
      const waUrl = `https://wa.me/?text=${encodeURIComponent(manifest)}`;
      if (typeof window !== 'undefined') {
        window.open(waUrl, '_blank');
      }
    });
  }

  if (printSlipBtn && !printSlipBtn.dataset?.wiredRoute) {
    if (printSlipBtn.dataset) printSlipBtn.dataset.wiredRoute = 'true';
    printSlipBtn.addEventListener('click', () => {
      triggerHaptic('medium');
      const slipHtml = generateFieldRouteSlipHtml(lastRouteData);
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`<!DOCTYPE html><html><head><title>Field Route Manifest</title></head><body>${slipHtml}</body></html>`);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 250);
      }
    });
  }

  function open(preferredSector) {
    if (preferredSector && sectorFilter) {
      sectorFilter.value = preferredSector;
    }
    updateUi();
    if (typeof modal?.showModal === 'function') {
      modal.showModal();
    } else if (modal) {
      modal.setAttribute('open', '');
    }
    triggerHaptic('selection');
  }

  function close() {
    if (typeof modal?.close === 'function') {
      modal.close();
    } else if (modal) {
      modal.removeAttribute('open');
    }
  }

  if (closeBtn && !closeBtn.dataset?.wiredRoute) {
    if (closeBtn.dataset) closeBtn.dataset.wiredRoute = 'true';
    closeBtn.addEventListener('click', () => close());
  }

  if (modal && !modal.dataset?.wiredBackdrop) {
    if (modal.dataset) modal.dataset.wiredBackdrop = 'true';
    modal.addEventListener('click', (e) => {
      if (e.target === modal) close();
    });
  }

  openBtns.forEach((btn) => {
    if (!btn.dataset?.wiredRouteOpen) {
      if (btn.dataset) btn.dataset.wiredRouteOpen = 'true';
      btn.addEventListener('click', () => {
        const targetSector = btn.getAttribute('data-field-sector') || null;
        open(targetSector);
      });
    }
  });

  return {
    open,
    close,
    recalculate: () => updateUi(),
    getRouteData: () => lastRouteData || updateUi(),
    setFilterTab: (tab) => {
      currentFilterTab = tab;
      return updateUi();
    }
  };
}
