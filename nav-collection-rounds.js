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
export const PAKISTAN_TIME_ZONE = 'Asia/Karachi';

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
    const isOffline = c.status === 'offline';
    const isSuspended = c.status === 'suspended';

    let urgencyScore = totalDue;
    if (isOffline) urgencyScore += 2500;
    if (isSuspended) urgencyScore += 1500;
    if (overdueBillsCount > 1) urgencyScore += overdueBillsCount * 500;

    const rawPhone = (c.phone || '').trim();
    const cleanPhone = rawPhone.replace(/[^\d+]/g, '');
    let whatsappPhone = cleanPhone;
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

    const encodedAddr = encodeURIComponent(`${c.address || ''} ${sector} Shahdara Lahore`.trim());
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
      fieldNote: notesMap[c.id] || '',
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
    if (filterTab === 'pending' && stop.isCollected) {
      return false;
    }
    if (filterTab === 'collected' && !stop.isCollected) {
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

  filteredStops = filteredStops.map((stop, index) => ({
    ...stop,
    stopNumber: index + 1
  }));

  const totalStops = filteredStops.length;
  let totalDue = 0;
  let collectedStops = 0;
  let collectedAmount = 0;

  for (const s of filteredStops) {
    totalDue += s.totalDue;
    if (s.isCollected) {
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
      const statusIcon = stop.isCollected ? '✅ [COLLECTED]' : stop.isOffline ? '🔴 [OFFLINE]' : '⚪ [PENDING]';
      lines.push(`${stop.stopNumber}. ${statusIcon} ${stop.name} (@${stop.username})`);
      lines.push(`   💰 Due: Rs. ${Number(stop.totalDue || 0).toLocaleString()} | 📞 ${stop.phone || 'No phone'}`);
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
          card.className = `route-card${stop.isCollected ? ' is-collected' : ''}`;
          card.setAttribute('data-customer-id', stop.id);

          const statusBadge = stop.isOffline
            ? '<span class="role-badge role-warn">Offline</span>'
            : stop.isSuspended
            ? '<span class="role-badge role-danger">Suspended</span>'
            : '<span class="role-badge role-primary">Active</span>';

          const whatsappAction = stop.whatsappReminderUrl || stop.whatsappUrl
            ? `<a href="${escapeHtml(stop.whatsappReminderUrl || stop.whatsappUrl)}" target="_blank" rel="noopener noreferrer" class="action-btn-sm" aria-label="WhatsApp reminder for ${escapeHtml(stop.name)}">💬 WhatsApp</a>`
            : `<button type="button" class="action-btn-sm" data-copy-reminder="${escapeHtml(stop.id)}" aria-label="Copy reminder text for ${escapeHtml(stop.name)}">📋 Reminder</button>`;

          card.innerHTML = `
            <div class="route-card-left">
              <div class="route-card-header">
                <span class="route-card-stop-num">#${stop.stopNumber}</span>
                <span class="route-card-name">${escapeHtml(stop.name)}</span>
                <span class="route-card-username">@${escapeHtml(stop.username)}</span>
                ${statusBadge}
                ${stop.isCollected ? '<span class="role-badge role-primary" style="background: #047857; color: white;">✓ Collected</span>' : ''}
              </div>
              <div class="route-card-meta">
                <span class="route-card-addr">📍 ${escapeHtml(stop.address)} [${escapeHtml(stop.sector)}]</span>
                <span class="route-card-due">💰 Due: <strong>Rs. ${Number(stop.totalDue).toLocaleString()}</strong></span>
              </div>
              <div class="route-card-contact-row">
                ${stop.phoneUrl ? `<a href="${stop.phoneUrl}" class="action-btn-sm" aria-label="Call ${escapeHtml(stop.name)}">📞 Call</a>` : ''}
                ${whatsappAction}
                <a href="${stop.mapsQueryUrl}" target="_blank" rel="noopener noreferrer" class="action-btn-sm" aria-label="Navigate to ${escapeHtml(stop.name)}">🗺️ Map</a>
              </div>
            </div>
            <div class="route-card-right">
              <label class="route-stop-toggle-label">
                <input type="checkbox" class="route-stop-checkbox" data-stop-toggle="${escapeHtml(stop.id)}" ${stop.isCollected ? 'checked' : ''}>
                <span>Collected</span>
              </label>
              <button type="button" class="action-btn-sm primary-sm" data-stop-collect="${escapeHtml(stop.id)}">Receive Cash</button>
              <button type="button" class="action-btn-sm" data-stop-quick-profile="${escapeHtml(stop.id)}">ℹ️ Profile</button>
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
