/**
 * Shahdara ISP - Real-time Field Technician GPS Geo-tagging Breadcrumb Trail & Geofencing Suite
 * Part of mobile navigation and field crew tools (agent2).
 *
 * Provides outdoor plant (OSP) technician tracking, Haversine distance calculations,
 * field node geofence perimeter detection, path telemetry metrics, responsive SVG route rendering,
 * and WhatsApp dispatch location sharing.
 */

export const GPS_BREADCRUMBS_STORAGE_KEY = 'shahdara_technician_gps_breadcrumbs_v1';

/**
 * Shahdara Outside Plant (OSP) Reference Nodes & Hubs
 */
export const SHAHDARA_FIELD_NODES = [
  {
    id: 'node-central-odf',
    name: 'Shahdara Central ODF (Chowk)',
    code: 'SHAH-ODF-01',
    lat: 31.6215,
    lng: 74.2820,
    type: 'odf',
    radiusMeters: 75,
    description: 'Main Optical Distribution Frame at Chowk Shahdara'
  },
  {
    id: 'node-baradari-splice',
    name: 'Kamran Baradari Feeder Closure',
    code: 'BAR-FDR-03',
    lat: 31.6148,
    lng: 74.2965,
    type: 'splice',
    radiusMeters: 60,
    description: 'Underground 48-core enclosure adjacent to Baradari gardens'
  },
  {
    id: 'node-wandala-fat',
    name: 'Wandala Road FAT-08 Hub',
    code: 'WAN-FAT-08',
    lat: 31.6292,
    lng: 74.2745,
    type: 'fat',
    radiusMeters: 50,
    description: 'Aerial Fiber Access Terminal serving Wandala Rd residential cluster'
  },
  {
    id: 'node-kot-mohibbu-pole',
    name: 'Kot Mohibbu Aerial Pole 14',
    code: 'KOT-POL-14',
    lat: 31.6360,
    lng: 74.2690,
    type: 'pole',
    radiusMeters: 50,
    description: 'Dead-end tensioning pole along railway crossing feeder'
  },
  {
    id: 'node-jia-musa-olt',
    name: 'Jia Musa Secondary OLT Shelter',
    code: 'JIA-OLT-02',
    lat: 31.6080,
    lng: 74.3050,
    type: 'olt',
    radiusMeters: 80,
    description: 'Sub-central office mini-OLT rack shelter'
  },
  {
    id: 'node-begum-kot-term',
    name: 'Begum Kot Optical Terminal',
    code: 'BEG-TERM-04',
    lat: 31.6420,
    lng: 74.2580,
    type: 'terminal',
    radiusMeters: 65,
    description: 'Commercial market drop aggregation terminal'
  }
];

/**
 * Calculates great-circle distance between two geographic coordinates using Haversine formula.
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} Distance in meters rounded to 1 decimal place
 */
export function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  if (
    typeof lat1 !== 'number' || isNaN(lat1) ||
    typeof lon1 !== 'number' || isNaN(lon1) ||
    typeof lat2 !== 'number' || isNaN(lat2) ||
    typeof lon2 !== 'number' || isNaN(lon2)
  ) {
    return 0;
  }

  const R = 6371000; // Mean Earth radius in meters
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Computes navigation forward azimuth / bearing in degrees (0° - 359.9°) from origin to target.
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} Bearing in degrees (0 to 359)
 */
export function calculateBearingDegrees(lat1, lon1, lat2, lon2) {
  if (
    typeof lat1 !== 'number' || isNaN(lat1) ||
    typeof lon1 !== 'number' || isNaN(lon1) ||
    typeof lat2 !== 'number' || isNaN(lat2) ||
    typeof lon2 !== 'number' || isNaN(lon2)
  ) {
    return 0;
  }

  const toRad = Math.PI / 180;
  const toDeg = 180 / Math.PI;
  const φ1 = lat1 * toRad;
  const φ2 = lat2 * toRad;
  const Δλ = (lon2 - lon1) * toRad;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);

  const bearing = (θ * toDeg + 360) % 360;
  return Math.round(bearing * 10) / 10;
}

/**
 * Checks whether a given geographic coordinate falls inside a target node's geofence radius.
 * @param {number} techLat
 * @param {number} techLng
 * @param {object} node
 * @param {number} [overrideRadius]
 * @returns {{ isInside: boolean, distanceMeters: number, thresholdMeters: number }}
 */
export function evaluateNodeGeofence(techLat, techLng, node, overrideRadius = null) {
  if (!node || typeof node.lat !== 'number' || typeof node.lng !== 'number') {
    return { isInside: false, distanceMeters: 0, thresholdMeters: 0 };
  }
  const threshold = typeof overrideRadius === 'number' && overrideRadius > 0
    ? overrideRadius
    : (node.radiusMeters || 60);

  const dist = haversineDistanceMeters(techLat, techLng, node.lat, node.lng);
  return {
    isInside: dist <= threshold,
    distanceMeters: dist,
    thresholdMeters: threshold
  };
}

/**
 * Finds the closest Shahdara OSP node to a technician fix.
 * @param {number} lat
 * @param {number} lng
 * @param {Array} [nodesList]
 * @returns {{ node: object|null, distanceMeters: number, isWithinGeofence: boolean, bearingDegrees: number }}
 */
export function findNearestFieldNode(lat, lng, nodesList = SHAHDARA_FIELD_NODES) {
  if (!Array.isArray(nodesList) || nodesList.length === 0) {
    return { node: null, distanceMeters: 0, isWithinGeofence: false, bearingDegrees: 0 };
  }

  let nearest = null;
  let minDistance = Infinity;

  for (const node of nodesList) {
    const dist = haversineDistanceMeters(lat, lng, node.lat, node.lng);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = node;
    }
  }

  if (!nearest) {
    return { node: null, distanceMeters: 0, isWithinGeofence: false, bearingDegrees: 0 };
  }

  const geofence = evaluateNodeGeofence(lat, lng, nearest);
  const bearing = calculateBearingDegrees(lat, lng, nearest.lat, nearest.lng);

  return {
    node: nearest,
    distanceMeters: minDistance,
    isWithinGeofence: geofence.isInside,
    bearingDegrees: bearing
  };
}

/**
 * Resolves local storage safely in Node or Browser contexts.
 */
function resolveStorage(storage) {
  if (storage) return storage;
  if (typeof localStorage !== 'undefined') return localStorage;
  return null;
}

/**
 * Retrieves the breadcrumbs storage record.
 * @param {Storage} [storage]
 * @returns {Array<object>} List of breadcrumb point objects
 */
export function getGpsBreadcrumbsStore(storage = null) {
  const store = resolveStorage(storage);
  if (!store) return [];
  try {
    const raw = store.getItem(GPS_BREADCRUMBS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to parse GPS breadcrumbs store:', err);
    return [];
  }
}

/**
 * Persists the breadcrumbs storage record.
 * @param {Array<object>} breadcrumbs
 * @param {Storage} [storage]
 * @returns {boolean} Success state
 */
export function saveGpsBreadcrumbsStore(breadcrumbs, storage = null) {
  const store = resolveStorage(storage);
  if (!store) return false;
  try {
    const list = Array.isArray(breadcrumbs) ? breadcrumbs.slice(-200) : [];
    store.setItem(GPS_BREADCRUMBS_STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch (err) {
    console.error('Failed to save GPS breadcrumbs store:', err);
    return false;
  }
}

/**
 * Clears breadcrumb trail from storage.
 * @param {Storage} [storage]
 * @returns {boolean}
 */
export function clearGpsBreadcrumbsStore(storage = null) {
  const store = resolveStorage(storage);
  if (!store) return false;
  try {
    store.removeItem(GPS_BREADCRUMBS_STORAGE_KEY);
    return true;
  } catch (err) {
    console.error('Failed to clear GPS breadcrumbs store:', err);
    return false;
  }
}

/**
 * Records a new GPS telemetry breadcrumb point.
 * @param {object} fix - { lat, lng, accuracy, speed, heading, batteryLevel, technicianId, activeOrderId, timestamp }
 * @param {Storage} [storage]
 * @param {object} [options] - { maxAccuracyMeters: 60 }
 * @returns {{ success: boolean, point: object|null, reason?: string }}
 */
export function recordGpsBreadcrumb(fix, storage = null, options = {}) {
  if (!fix || typeof fix.lat !== 'number' || typeof fix.lng !== 'number') {
    return { success: false, point: null, reason: 'Invalid coordinates' };
  }

  const maxAccuracy = options.maxAccuracyMeters || 75;
  const accuracy = typeof fix.accuracy === 'number' ? fix.accuracy : 10;
  if (accuracy > maxAccuracy) {
    return { success: false, point: null, reason: `Fix accuracy ${accuracy}m exceeds threshold ${maxAccuracy}m` };
  }

  const nearest = findNearestFieldNode(fix.lat, fix.lng);

  const breadcrumb = {
    id: `fix-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    lat: Math.round(fix.lat * 1000000) / 1000000,
    lng: Math.round(fix.lng * 1000000) / 1000000,
    accuracy: Math.round(accuracy * 10) / 10,
    speed: typeof fix.speed === 'number' ? Math.round(fix.speed * 10) / 10 : null,
    heading: typeof fix.heading === 'number' ? Math.round(fix.heading) : null,
    batteryLevel: typeof fix.batteryLevel === 'number' ? Math.max(0, Math.min(100, Math.round(fix.batteryLevel))) : null,
    technicianId: fix.technicianId || 'TECH-SHAH-01',
    activeOrderId: fix.activeOrderId || null,
    timestamp: fix.timestamp || new Date().toISOString(),
    nearestNodeId: nearest.node ? nearest.node.id : null,
    nearestNodeDistanceMeters: nearest.distanceMeters,
    isInsideGeofence: nearest.isWithinGeofence
  };

  const current = getGpsBreadcrumbsStore(storage);
  current.push(breadcrumb);
  saveGpsBreadcrumbsStore(current, storage);

  return { success: true, point: breadcrumb };
}

/**
 * Computes telemetry KPIs and summary metrics across recorded breadcrumbs.
 * @param {Array<object>} breadcrumbs
 * @returns {object} Telemetry summary
 */
export function calculateBreadcrumbMetrics(breadcrumbs) {
  if (!Array.isArray(breadcrumbs) || breadcrumbs.length === 0) {
    return {
      totalFixes: 0,
      totalDistanceMeters: 0,
      totalDistanceKm: 0,
      averageSpeedKmh: 0,
      durationMinutes: 0,
      latestFix: null,
      firstFix: null,
      batteryDrainPercent: 0,
      geofenceEncounters: 0
    };
  }

  let totalDistance = 0;
  let speedSum = 0;
  let speedCount = 0;
  let geofenceCount = 0;

  for (let i = 0; i < breadcrumbs.length; i++) {
    const pt = breadcrumbs[i];
    if (pt.isInsideGeofence) {
      geofenceCount++;
    }
    if (typeof pt.speed === 'number' && pt.speed > 0) {
      speedSum += pt.speed;
      speedCount++;
    }

    if (i > 0) {
      const prev = breadcrumbs[i - 1];
      const dist = haversineDistanceMeters(prev.lat, prev.lng, pt.lat, pt.lng);
      totalDistance += dist;
    }
  }

  const firstFix = breadcrumbs[0];
  const latestFix = breadcrumbs[breadcrumbs.length - 1];

  let durationMinutes = 0;
  try {
    const t0 = new Date(firstFix.timestamp).getTime();
    const t1 = new Date(latestFix.timestamp).getTime();
    if (!isNaN(t0) && !isNaN(t1) && t1 >= t0) {
      durationMinutes = Math.round((t1 - t0) / 60000 * 10) / 10;
    }
  } catch {
    durationMinutes = 0;
  }

  let batteryDrain = 0;
  if (
    typeof firstFix.batteryLevel === 'number' &&
    typeof latestFix.batteryLevel === 'number' &&
    firstFix.batteryLevel >= latestFix.batteryLevel
  ) {
    batteryDrain = firstFix.batteryLevel - latestFix.batteryLevel;
  }

  return {
    totalFixes: breadcrumbs.length,
    totalDistanceMeters: Math.round(totalDistance * 10) / 10,
    totalDistanceKm: Math.round(totalDistance / 100) / 10,
    averageSpeedKmh: speedCount > 0 ? Math.round((speedSum / speedCount) * 10) / 10 : 0,
    durationMinutes,
    latestFix,
    firstFix,
    batteryDrainPercent: batteryDrain,
    geofenceEncounters: geofenceCount
  };
}

/**
 * Formats a field technician location share message for WhatsApp / SMS dispatch.
 * @param {object} fix
 * @param {object} [nearestNode]
 * @param {string} [activeOrderId]
 * @returns {string} WhatsApp-ready text with Google Maps hyperlink
 */
export function generateTechnicianLocationShare(fix, nearestNode = null, activeOrderId = null) {
  if (!fix || typeof fix.lat !== 'number' || typeof fix.lng !== 'number') {
    return 'Technician location not available.';
  }

  const techId = fix.technicianId || 'Field Lineman';
  const orderTag = activeOrderId || fix.activeOrderId || 'General Patrol';
  const nodeInfo = nearestNode
    ? `${nearestNode.name} (${Math.round(haversineDistanceMeters(fix.lat, fix.lng, nearestNode.lat, nearestNode.lng))}m)`
    : 'Shahdara Network Zone';

  const timeStr = fix.timestamp
    ? new Date(fix.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : 'Just now';

  const batStr = typeof fix.batteryLevel === 'number' ? `${fix.batteryLevel}%` : 'N/A';
  const accStr = typeof fix.accuracy === 'number' ? `±${fix.accuracy}m` : 'GPS Standard';

  return `📍 *Shahdara ISP Field Dispatch - Live Location*
👤 *Tech:* ${techId}
🏷 *Work Order:* ${orderTag}
🏢 *Nearest Node:* ${nodeInfo}
🎯 *GPS Precision:* ${accStr} | 🔋 *Battery:* ${batStr}
⏰ *Time:* ${timeStr}
🗺 *Google Maps:* https://maps.google.com/?q=${fix.lat},${fix.lng}`;
}

/**
 * Generates an SVG aerial radar / path map of technician breadcrumbs relative to Shahdara OSP nodes.
 * @param {Array<object>} breadcrumbs
 * @param {object} [options]
 * @returns {string} SVG markup string
 */
export function renderMobileGpsBreadcrumbsSvg(breadcrumbs = [], options = {}) {
  const width = options.width || 420;
  const height = options.height || 260;

  // Bounding box calculation covering Shahdara OSP nodes and breadcrumb fixes
  const allPoints = [...SHAHDARA_FIELD_NODES];
  if (Array.isArray(breadcrumbs)) {
    breadcrumbs.forEach(b => {
      if (typeof b.lat === 'number' && typeof b.lng === 'number') {
        allPoints.push({ lat: b.lat, lng: b.lng });
      }
    });
  }

  let minLat = 31.600;
  let maxLat = 31.650;
  let minLng = 74.250;
  let maxLng = 74.315;

  if (allPoints.length > 0) {
    minLat = Math.min(...allPoints.map(p => p.lat)) - 0.004;
    maxLat = Math.max(...allPoints.map(p => p.lat)) + 0.004;
    minLng = Math.min(...allPoints.map(p => p.lng)) - 0.004;
    maxLng = Math.max(...allPoints.map(p => p.lng)) + 0.004;
  }

  const padX = 35;
  const padY = 30;
  const mapW = width - padX * 2;
  const mapH = height - padY * 2;

  const projectX = (lng) => {
    const norm = (lng - minLng) / (maxLng - minLng || 1);
    return Math.round((padX + norm * mapW) * 10) / 10;
  };

  const projectY = (lat) => {
    // Invert latitude so North is top
    const norm = (maxLat - lat) / (maxLat - minLat || 1);
    return Math.round((padY + norm * mapH) * 10) / 10;
  };

  // Build grid lines
  const gridLines = [];
  for (let step = 1; step <= 3; step++) {
    const gy = padY + (mapH / 4) * step;
    const gx = padX + (mapW / 4) * step;
    gridLines.push(`<line x1="${padX}" y1="${gy}" x2="${width - padX}" y2="${gy}" stroke="#1e293b" stroke-dasharray="3,3" stroke-width="1"/>`);
    gridLines.push(`<line x1="${gx}" y1="${padY}" x2="${gx}" y2="${height - padY}" stroke="#1e293b" stroke-dasharray="3,3" stroke-width="1"/>`);
  }

  // Build OSP node markers & geofence rings
  const nodeMarkers = SHAHDARA_FIELD_NODES.map(node => {
    const nx = projectX(node.lng);
    const ny = projectY(node.lat);
    const color = node.type === 'odf' ? '#0ea5e9' : node.type === 'olt' ? '#8b5cf6' : '#f59e0b';
    return `
      <g class="gps-svg-node" data-node-id="${node.id}">
        <!-- Geofence perimeter ring -->
        <circle cx="${nx}" cy="${ny}" r="16" fill="${color}" fill-opacity="0.08" stroke="${color}" stroke-opacity="0.4" stroke-dasharray="2,2" stroke-width="1.2"/>
        <!-- Core Node Icon -->
        <rect x="${nx - 5}" y="${ny - 5}" width="10" height="10" rx="2" fill="${color}" stroke="#ffffff" stroke-width="1.5"/>
        <text x="${nx}" y="${ny + 14}" font-size="8" fill="#cbd5e1" text-anchor="middle" font-family="monospace">${node.code}</text>
      </g>
    `;
  }).join('');

  // Build breadcrumb polyline path & waypoints
  let pathD = '';
  const waypointCircles = [];
  let latestPoint = null;

  if (Array.isArray(breadcrumbs) && breadcrumbs.length > 0) {
    breadcrumbs.forEach((pt, idx) => {
      if (typeof pt.lat !== 'number' || typeof pt.lng !== 'number') return;
      const px = projectX(pt.lng);
      const py = projectY(pt.lat);

      if (idx === 0) {
        pathD += `M ${px} ${py}`;
      } else {
        pathD += ` L ${px} ${py}`;
      }

      const isLast = idx === breadcrumbs.length - 1;
      if (isLast) {
        latestPoint = { px, py, pt };
      } else {
        waypointCircles.push(`<circle cx="${px}" cy="${py}" r="2.5" fill="#38bdf8" opacity="0.6"/>`);
      }
    });
  }

  const pathMarkup = pathD
    ? `<path d="${pathD}" fill="none" stroke="#0284c7" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />`
    : '';

  // Current position pulsing radar & arrow
  let latestMarker = '';
  if (latestPoint) {
    const { px, py, pt } = latestPoint;
    const heading = typeof pt.heading === 'number' ? pt.heading : 0;
    latestMarker = `
      <g class="gps-svg-live-tech" transform="translate(${px}, ${py})">
        <circle cx="0" cy="0" r="14" fill="#10b981" fill-opacity="0.25">
          <animate attributeName="r" values="8;18;8" dur="2s" repeatCount="indefinite" />
          <animate attributeName="fill-opacity" values="0.4;0.05;0.4" dur="2s" repeatCount="indefinite" />
        </circle>
        <circle cx="0" cy="0" r="6" fill="#10b981" stroke="#ffffff" stroke-width="2"/>
        <g transform="rotate(${heading})">
          <polygon points="0,-12 4,-4 -4,-4" fill="#10b981" stroke="#064e3b" stroke-width="0.8"/>
        </g>
        <text x="0" y="-15" font-size="9" font-weight="bold" fill="#34d399" text-anchor="middle">LIVE TECH</text>
      </g>
    `;
  }

  return `
    <svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" class="gps-breadcrumbs-svg" style="background:#0b1120; border-radius:10px; width:100%; height:auto;">
      <defs>
        <radialGradient id="radarGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#0284c7" stop-opacity="0.15"/>
          <stop offset="100%" stop-color="#0b1120" stop-opacity="0"/>
        </radialGradient>
      </defs>

      <!-- Background & grid -->
      <rect x="0" y="0" width="${width}" height="${height}" fill="#0b1120" rx="10"/>
      <rect x="${padX}" y="${padY}" width="${mapW}" height="${mapH}" fill="url(#radarGlow)" stroke="#334155" stroke-width="1"/>
      ${gridLines.join('')}

      <!-- OSP Nodes -->
      ${nodeMarkers}

      <!-- Breadcrumbs Path -->
      ${pathMarkup}
      ${waypointCircles.join('')}

      <!-- Live Technician Marker -->
      ${latestMarker}

      <!-- Header & Scale bar -->
      <text x="${padX}" y="${padY - 10}" fill="#94a3b8" font-size="10" font-weight="bold" font-family="sans-serif">SHAHDARA OSP FIELD RADAR</text>
      <text x="${width - padX}" y="${padY - 10}" fill="#38bdf8" font-size="9" text-anchor="end" font-family="monospace">HAWS-WGS84</text>
      <g transform="translate(${padX}, ${height - padY + 16})">
        <line x1="0" y1="0" x2="60" y2="0" stroke="#64748b" stroke-width="2"/>
        <line x1="0" y1="-3" x2="0" y2="3" stroke="#64748b" stroke-width="1.5"/>
        <line x1="60" y1="-3" x2="60" y2="3" stroke="#64748b" stroke-width="1.5"/>
        <text x="30" y="9" font-size="8" fill="#64748b" text-anchor="middle" font-family="sans-serif">~1.5 km</text>
      </g>
    </svg>
  `;
}

/**
 * Sets up and binds interactive events for the Technician GPS Breadcrumb Mobile Modal.
 * @param {object} options
 */
export function setupMobileGpsBreadcrumbsModal(options = {}) {
  const modal = options.modalElement || document.getElementById('mobileGpsBreadcrumbsModal');
  if (!modal) return;

  const storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);

  const containerSvg = modal.querySelector('#gpsModalSvgContainer');
  const statsFixes = modal.querySelector('#gpsStatFixes');
  const statsDistance = modal.querySelector('#gpsStatDistance');
  const statsSpeed = modal.querySelector('#gpsStatSpeed');
  const statsGeofence = modal.querySelector('#gpsStatGeofence');
  const nearestNodeName = modal.querySelector('#gpsNearestNodeName');
  const nearestNodeDist = modal.querySelector('#gpsNearestNodeDist');

  const btnMockPing = modal.querySelector('#btnGpsMockPing');
  const btnRealFix = modal.querySelector('#btnGpsRealFix');
  const btnShareLocation = modal.querySelector('#btnGpsShareLocation');
  const btnClearTrail = modal.querySelector('#btnGpsClearTrail');
  const closeBtn = modal.querySelector('#closeMobileGpsBreadcrumbsModal');

  function renderModalState() {
    const breadcrumbs = getGpsBreadcrumbsStore(storage);
    const metrics = calculateBreadcrumbMetrics(breadcrumbs);

    if (containerSvg) {
      containerSvg.innerHTML = renderMobileGpsBreadcrumbsSvg(breadcrumbs);
    }
    if (statsFixes) statsFixes.textContent = String(metrics.totalFixes);
    if (statsDistance) statsDistance.textContent = `${metrics.totalDistanceKm} km (${metrics.totalDistanceMeters}m)`;
    if (statsSpeed) statsSpeed.textContent = `${metrics.averageSpeedKmh} km/h`;
    if (statsGeofence) {
      statsGeofence.textContent = metrics.geofenceEncounters > 0 ? `${metrics.geofenceEncounters} check-ins` : 'Outside';
      statsGeofence.className = metrics.geofenceEncounters > 0 ? 'gps-badge-in' : 'gps-badge-out';
    }

    if (metrics.latestFix) {
      const nearest = findNearestFieldNode(metrics.latestFix.lat, metrics.latestFix.lng);
      if (nearestNodeName && nearest.node) {
        nearestNodeName.textContent = nearest.node.name;
      }
      if (nearestNodeDist) {
        nearestNodeDist.textContent = `${nearest.distanceMeters}m (${nearest.isWithinGeofence ? 'Inside Geofence' : 'Transit'})`;
      }
    } else {
      if (nearestNodeName) nearestNodeName.textContent = 'Shahdara Central ODF';
      if (nearestNodeDist) nearestNodeDist.textContent = 'No fixes recorded';
    }
  }

  if (btnMockPing) {
    btnMockPing.addEventListener('click', () => {
      // Create a simulated technician step moving across Shahdara nodes
      const breadcrumbs = getGpsBreadcrumbsStore(storage);
      let nextLat = 31.6215;
      let nextLng = 74.2820;

      if (breadcrumbs.length > 0) {
        const last = breadcrumbs[breadcrumbs.length - 1];
        // Jitter step towards Baradari or Wandala
        const deltaLat = (Math.random() - 0.45) * 0.0025;
        const deltaLng = (Math.random() - 0.4) * 0.003;
        nextLat = last.lat + deltaLat;
        nextLng = last.lng + deltaLng;
      }

      recordGpsBreadcrumb({
        lat: nextLat,
        lng: nextLng,
        accuracy: 12,
        speed: 18.5,
        heading: 145,
        batteryLevel: 82,
        technicianId: 'TECH-ASIF-04',
        activeOrderId: 'WO-FIBER-492'
      }, storage);

      renderModalState();
    });
  }

  if (btnRealFix && typeof navigator !== 'undefined' && navigator.geolocation) {
    btnRealFix.addEventListener('click', () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          recordGpsBreadcrumb({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            speed: pos.coords.speed ? pos.coords.speed * 3.6 : null,
            heading: pos.coords.heading,
            batteryLevel: 90,
            technicianId: 'TECH-FIELD-AUTO'
          }, storage);
          renderModalState();
        },
        (err) => {
          alert('GPS Fix failed: ' + (err.message || 'Position unavailable'));
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  }

  if (btnShareLocation) {
    btnShareLocation.addEventListener('click', () => {
      const breadcrumbs = getGpsBreadcrumbsStore(storage);
      const metrics = calculateBreadcrumbMetrics(breadcrumbs);
      const fix = metrics.latestFix || {
        lat: 31.6215,
        lng: 74.2820,
        technicianId: 'TECH-ASIF-04',
        accuracy: 10,
        batteryLevel: 85
      };
      const nearest = findNearestFieldNode(fix.lat, fix.lng);
      const text = generateTechnicianLocationShare(fix, nearest.node, fix.activeOrderId);

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
          alert('Technician location copied to clipboard! Opening WhatsApp...');
          window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
        }).catch(() => {
          window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
        });
      } else {
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
      }
    });
  }

  if (btnClearTrail) {
    btnClearTrail.addEventListener('click', () => {
      if (confirm('Clear technician GPS breadcrumb trail history?')) {
        clearGpsBreadcrumbsStore(storage);
        renderModalState();
      }
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal.close();
    });
  }

  // Multi-surface trigger bindings
  const triggers = [
    '#navGpsBreadcrumbsBtn',
    '#mobileMoreGpsBreadcrumbsBtn',
    '#actionSheetGpsBreadcrumbsBtn',
    '#speedDialGpsBreadcrumbsBtn'
  ];

  triggers.forEach(selector => {
    const el = document.querySelector(selector);
    if (el) {
      el.addEventListener('click', () => {
        renderModalState();
        modal.showModal();
      });
    }
  });

  // Initial render when modal opens
  modal.addEventListener('show', renderModalState);
}

// CommonJS support for Node tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    GPS_BREADCRUMBS_STORAGE_KEY,
    SHAHDARA_FIELD_NODES,
    haversineDistanceMeters,
    calculateBearingDegrees,
    evaluateNodeGeofence,
    findNearestFieldNode,
    getGpsBreadcrumbsStore,
    saveGpsBreadcrumbsStore,
    clearGpsBreadcrumbsStore,
    recordGpsBreadcrumb,
    calculateBreadcrumbMetrics,
    generateTechnicianLocationShare,
    renderMobileGpsBreadcrumbsSvg,
    setupMobileGpsBreadcrumbsModal
  };
}
