import { formatPKR } from './core.js';
import { triggerHaptic } from './nav.js';

/**
 * Field Diagnostic Optical Signal Loss Map Overlay & Fiber Node Heatmap
 * Visualizes Outside-Plant (OSP) PON distribution nodes, optical splitters (FDH/FAT),
 * fiber link attenuation, received optical power (dBm), and customer service health
 * on an interactive mobile topological map for Shahdara ISP field technicians.
 */

export const OPTICAL_STORAGE_KEY = 'shahdara_optical_measurements_v1';

export const SHAHDARA_OPTICAL_NODES = [
  {
    id: 'fdh-wandala-01',
    name: 'FDH-01 Wandala Chowk Optical Hub',
    code: 'FDH-WND-01',
    area: 'Vandala Road',
    aliasAreas: ['Vandala Road', 'Wandala Road', 'Zia Town'],
    x: 180,
    y: 120,
    feederKm: 2.8,
    splitterType: '1:16 Primary Splitter',
    capacityPorts: 16,
    oltTxDbm: 4.5,
    baselineRxDbm: -21.4,
    baselineLossDb: 25.9,
    defaultStatus: 'optimal',
    poleLocation: 'Pole #W-14 near Wandala Central Chowk'
  },
  {
    id: 'fdh-saeed-02',
    name: 'FDH-02 Saeed Park Tube-Well Node',
    code: 'FDH-SPD-02',
    area: 'Saeed Park',
    aliasAreas: ['Saeed Park', 'Tariq Road'],
    x: 440,
    y: 80,
    feederKm: 4.6,
    splitterType: '1:8 Splitter + 1:4 Cascaded',
    capacityPorts: 24,
    oltTxDbm: 5.0,
    baselineRxDbm: -25.2,
    baselineLossDb: 30.2,
    defaultStatus: 'warning',
    poleLocation: 'Tube-well Junction Silo Tower'
  },
  {
    id: 'fat-jiamusa-03',
    name: 'FAT-03 Main Bazaar Pole Cluster',
    code: 'FAT-JM-03',
    area: 'Jia Musa',
    aliasAreas: ['Jia Musa', 'Ghazi Park'],
    x: 140,
    y: 240,
    feederKm: 1.4,
    splitterType: '1:8 Micro-FAT Box',
    capacityPorts: 8,
    oltTxDbm: 4.2,
    baselineRxDbm: -19.5,
    baselineLossDb: 23.7,
    defaultStatus: 'optimal',
    poleLocation: 'Bazaar Main Gate Pole #JM-08'
  },
  {
    id: 'fdh-station-04',
    name: 'FDH-04 Station Chowk OLT Feeder',
    code: 'FDH-STN-04',
    area: 'Shahdara Town',
    aliasAreas: ['Shahdara Town', 'Shahdara Chowk', 'Station'],
    x: 300,
    y: 180,
    feederKm: 3.1,
    splitterType: '1:16 High-Density Closure',
    capacityPorts: 32,
    oltTxDbm: 4.8,
    baselineRxDbm: -22.3,
    baselineLossDb: 27.1,
    defaultStatus: 'optimal',
    poleLocation: 'Railway Flyover Substation Pillar'
  },
  {
    id: 'fat-baradari-05',
    name: 'FAT-05 Ravi Riverfront Bridge Span',
    code: 'FAT-BR-05',
    area: 'Baradari Road',
    aliasAreas: ['Baradari Road', 'Ravi Riverfront'],
    x: 510,
    y: 250,
    feederKm: 5.8,
    splitterType: '1:8 Aerial Splice Closure',
    capacityPorts: 8,
    oltTxDbm: 4.0,
    baselineRxDbm: -27.8,
    baselineLossDb: 31.8,
    defaultStatus: 'critical',
    poleLocation: 'Old Ravi Toll Plaza Riverfront Mast'
  },
  {
    id: 'fat-begumkot-06',
    name: 'FAT-06 Begum Kot Industrial Node',
    code: 'FAT-BK-06',
    area: 'Begum Kot',
    aliasAreas: ['Begum Kot', 'Sheikhupura Road'],
    x: 260,
    y: 60,
    feederKm: 3.9,
    splitterType: '1:8 High-Shielded FAT',
    capacityPorts: 12,
    oltTxDbm: 4.5,
    baselineRxDbm: -24.1,
    baselineLossDb: 28.6,
    defaultStatus: 'warning',
    poleLocation: 'Sheikhupura Road Crossing Pole #BK-22'
  }
];

export function getOpticalMeasurements(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return {};
  try {
    const raw = storage.getItem(OPTICAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveOpticalMeasurements(measurements, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return;
  try {
    storage.setItem(OPTICAL_STORAGE_KEY, JSON.stringify(measurements));
  } catch {}
}

export function recordOpticalMeasurement(nodeId, readingDbm, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  const current = getOpticalMeasurements(storage);
  const num = Number(readingDbm);
  if (!isNaN(num)) {
    current[nodeId] = {
      rxDbm: Number(num.toFixed(1)),
      measuredAt: new Date().toISOString()
    };
    saveOpticalMeasurements(current, storage);
  }
  return current;
}

export function clearOpticalMeasurements(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return;
  try {
    storage.removeItem(OPTICAL_STORAGE_KEY);
  } catch {}
}

function escapeXml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
}

/**
 * Calculates optical loss metrics, signal quality classifications,
 * subscriber counts, and revenue at risk for each node in the network.
 */
export function calculateOpticalSignalMapMetrics(state, options = {}) {
  const storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  const customMeasurements = getOpticalMeasurements(storage);
  const customers = Array.isArray(state?.customers) ? state.customers : [];

  const filter = options.filter || 'all'; // 'all', 'critical', 'warning', 'optimal'
  const searchQuery = String(options.search || '').toLowerCase().trim();

  let totalNodes = SHAHDARA_OPTICAL_NODES.length;
  let optimalNodesCount = 0;
  let warningNodesCount = 0;
  let criticalNodesCount = 0;
  let totalLossSum = 0;
  let totalRxSum = 0;

  const nodes = SHAHDARA_OPTICAL_NODES.map(baseNode => {
    // Check if custom field measurement exists
    const recorded = customMeasurements[baseNode.id];
    const rxDbm = recorded ? recorded.rxDbm : baseNode.baselineRxDbm;
    const lossDb = Number((baseNode.oltTxDbm - rxDbm).toFixed(1));

    // Signal status tier:
    // Optimal: Rx >= -23 dBm (Loss <= 27 dB)
    // Warning: Rx between -23.1 and -26.9 dBm (Loss 27.1 - 31 dB)
    // Critical: Rx <= -27 dBm (Loss > 31 dB or red LOS light)
    let statusTier = 'optimal';
    let statusLabel = 'OPTIMAL SIGNAL';
    let statusBadgeClass = 'badge-success';

    if (rxDbm <= -27.0) {
      statusTier = 'critical';
      statusLabel = 'CRITICAL (HIGH LOSS / LOS)';
      statusBadgeClass = 'badge-danger';
      criticalNodesCount++;
    } else if (rxDbm <= -23.0) {
      statusTier = 'warning';
      statusLabel = 'MARGINAL (ELEVATED LOSS)';
      statusBadgeClass = 'badge-warning';
      warningNodesCount++;
    } else {
      optimalNodesCount++;
    }

    totalLossSum += lossDb;
    totalRxSum += rxDbm;

    // Associate ledger customers by area matching
    const areaSet = new Set(baseNode.aliasAreas.map(a => a.toLowerCase().trim()));
    const connectedCustomers = [];
    let activeSubscribers = 0;
    let offlineSubscribers = 0;
    let monthlyRevenuePkr = 0;

    for (const c of customers) {
      if (c.archived) continue;
      const cArea = String(c.area ?? '').toLowerCase().trim();
      if (areaSet.has(cArea)) {
        connectedCustomers.push({
          id: c.id,
          name: c.name,
          phone: c.phone,
          serviceStatus: c.serviceStatus || 'active',
          monthlyRate: Number(c.monthlyRate ?? c.packageRate ?? 0) || 0,
          area: c.area
        });
        if (c.serviceStatus === 'offline') offlineSubscribers++;
        else activeSubscribers++;
        monthlyRevenuePkr += (Number(c.monthlyRate ?? c.packageRate ?? 0) || 0);
      }
    }

    return {
      ...baseNode,
      measuredRxDbm: rxDbm,
      measuredLossDb: lossDb,
      isCustomReading: Boolean(recorded),
      lastMeasuredAt: recorded?.measuredAt || null,
      statusTier,
      statusLabel,
      statusBadgeClass,
      activeSubscribers,
      offlineSubscribers,
      totalConnectedCustomers: connectedCustomers.length,
      monthlyRevenuePkr,
      connectedCustomers
    };
  });

  const averageLossDb = totalNodes > 0 ? Number((totalLossSum / totalNodes).toFixed(1)) : 0;
  const averageRxDbm = totalNodes > 0 ? Number((totalRxSum / totalNodes).toFixed(1)) : 0;

  // Filtered nodes
  let filteredNodes = nodes;
  if (filter === 'critical') {
    filteredNodes = filteredNodes.filter(n => n.statusTier === 'critical');
  } else if (filter === 'warning') {
    filteredNodes = filteredNodes.filter(n => n.statusTier === 'warning');
  } else if (filter === 'optimal') {
    filteredNodes = filteredNodes.filter(n => n.statusTier === 'optimal');
  }

  if (searchQuery) {
    filteredNodes = filteredNodes.filter(n =>
      n.name.toLowerCase().includes(searchQuery) ||
      n.code.toLowerCase().includes(searchQuery) ||
      n.area.toLowerCase().includes(searchQuery) ||
      n.splitterType.toLowerCase().includes(searchQuery) ||
      n.poleLocation.toLowerCase().includes(searchQuery)
    );
  }

  const criticalSubscribersCount = nodes
    .filter(n => n.statusTier === 'critical')
    .reduce((acc, n) => acc + n.activeSubscribers, 0);

  const revenueAtRiskPkr = nodes
    .filter(n => n.statusTier === 'critical' || n.statusTier === 'warning')
    .reduce((acc, n) => acc + (n.statusTier === 'critical' ? n.monthlyRevenuePkr : Math.round(n.monthlyRevenuePkr * 0.4)), 0);

  return {
    totalNodes,
    optimalNodesCount,
    warningNodesCount,
    criticalNodesCount,
    averageLossDb,
    averageRxDbm,
    criticalSubscribersCount,
    revenueAtRiskPkr,
    filter,
    searchQuery,
    nodes,
    filteredNodes
  };
}

/**
 * Pure SVG topological rendering of Shahdara outside plant fiber nodes,
 * central OLT transmitter, feeder trunk attenuation lines, and pulsing status rings.
 */
export function renderOpticalSignalMapSvg(metrics, selectedNodeId = null) {
  if (!metrics || !Array.isArray(metrics.nodes)) {
    return `<div class="work-order-empty-state"><p>No optical topology data available.</p></div>`;
  }

  const width = 660;
  const height = 320;
  const oltX = 300;
  const oltY = 180;

  // Feeder lines from OLT (300, 180) to each node
  let linesSvg = '';
  for (const n of metrics.nodes) {
    let strokeColor = '#10b981'; // Green
    if (n.statusTier === 'critical') strokeColor = '#ef4444'; // Red
    else if (n.statusTier === 'warning') strokeColor = '#f59e0b'; // Amber

    const isSelected = n.id === selectedNodeId;
    const strokeWidth = isSelected ? 3.5 : 2.0;

    linesSvg += `
      <line x1="${oltX}" y1="${oltY}" x2="${n.x}" y2="${n.y}"
            stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-dasharray="${n.statusTier === 'critical' ? '4,3' : 'none'}" opacity="0.85" />
    `;
  }

  // Node markers
  let nodesSvg = '';
  for (const n of metrics.nodes) {
    let circleColor = '#10b981';
    let haloColor = 'rgba(16, 185, 129, 0.25)';
    if (n.statusTier === 'critical') {
      circleColor = '#ef4444';
      haloColor = 'rgba(239, 68, 68, 0.35)';
    } else if (n.statusTier === 'warning') {
      circleColor = '#f59e0b';
      haloColor = 'rgba(245, 158, 11, 0.3)';
    }

    const isSelected = n.id === selectedNodeId;
    const radius = isSelected ? 12 : 9;

    nodesSvg += `
      <g class="map-node-group" data-node-id="${escapeXml(n.id)}" style="cursor: pointer;">
        <!-- Pulsing Halo -->
        <circle cx="${n.x}" cy="${n.y}" r="${radius + 7}" fill="${haloColor}" />
        <!-- Main Node Circle -->
        <circle cx="${n.x}" cy="${n.y}" r="${radius}" fill="${circleColor}" stroke="#ffffff" stroke-width="${isSelected ? 3 : 1.8}" />
        <!-- Center Dot -->
        <circle cx="${n.x}" cy="${n.y}" r="3" fill="#ffffff" />

        <!-- Node Label Tag -->
        <g transform="translate(${n.x}, ${n.y + (n.y > 180 ? 18 : -14)})">
          <rect x="-48" y="-10" width="96" height="18" fill="#0f172a" rx="4" opacity="0.92" stroke="${isSelected ? '#38bdf8' : '#334155'}" stroke-width="1" />
          <text x="0" y="3" fill="#ffffff" font-size="9.5" font-weight="700" text-anchor="middle">${escapeXml(n.code)}: ${n.measuredRxDbm}dBm</text>
        </g>
      </g>
    `;
  }

  return `
    <svg viewBox="0 0 ${width} ${height}" class="optical-map-svg" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Shahdara Optical Signal Loss Topology Map">
      <defs>
        <linearGradient id="mapBgGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0f172a" />
          <stop offset="100%" stop-color="#1e293b" />
        </linearGradient>
        <pattern id="gridDots" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" fill="#334155" opacity="0.5" />
        </pattern>
      </defs>

      <!-- Map Canvas Background -->
      <rect x="0" y="0" width="${width}" height="${height}" fill="url(#mapBgGrad)" rx="8" />
      <rect x="0" y="0" width="${width}" height="${height}" fill="url(#gridDots)" rx="8" />

      <!-- River Ravi Schematic Corridor (Curved ribbon) -->
      <path d="M 460 320 C 470 230, 520 180, 590 120 C 630 80, 650 30, 660 0" fill="none" stroke="#0284c7" stroke-width="26" opacity="0.25" stroke-linecap="round" />
      <text x="545" y="160" fill="#38bdf8" font-size="9" font-weight="700" opacity="0.6" transform="rotate(-40, 545, 160)">RIVER RAVI</text>

      <!-- Feeder Fiber Optical Trunks -->
      <g class="fiber-trunks">
        ${linesSvg}
      </g>

      <!-- Central OLT Station Hub (Center 300, 180) -->
      <g class="central-olt" transform="translate(${oltX}, ${oltY})">
        <circle cx="0" cy="0" r="16" fill="#3b82f6" stroke="#ffffff" stroke-width="2" />
        <rect x="-6" y="-6" width="12" height="12" fill="#ffffff" rx="2" />
        <text x="0" y="24" fill="#60a5fa" font-size="10" font-weight="800" text-anchor="middle">CENTRAL OLT</text>
        <text x="0" y="34" fill="#94a3b8" font-size="8.5" font-weight="600" text-anchor="middle">+4.8 dBm Tx</text>
      </g>

      <!-- Optical Distribution Nodes (FDH/FAT) -->
      <g class="distribution-nodes">
        ${nodesSvg}
      </g>

      <!-- Map Legend (Bottom Left) -->
      <g class="map-legend" transform="translate(16, ${height - 52})">
        <rect x="0" y="0" width="230" height="38" fill="#0f172a" opacity="0.9" rx="6" stroke="#334155" stroke-width="1" />
        <circle cx="14" cy="12" r="5" fill="#10b981" />
        <text x="24" y="15" fill="#e2e8f0" font-size="9" font-weight="600">Optimal (&gt;-23dBm)</text>
        <circle cx="120" cy="12" r="5" fill="#f59e0b" />
        <text x="130" y="15" fill="#e2e8f0" font-size="9" font-weight="600">Warning (-24 to -27)</text>
        <circle cx="14" cy="27" r="5" fill="#ef4444" />
        <text x="24" y="30" fill="#e2e8f0" font-size="9" font-weight="600">Critical (&lt;-27dBm)</text>
        <circle cx="120" cy="27" r="5" fill="#3b82f6" />
        <text x="130" y="30" fill="#e2e8f0" font-size="9" font-weight="600">Central OLT Station</text>
      </g>
    </svg>
  `;
}

/**
 * Formats a field diagnostic optical dispatch briefing report for WhatsApp lineworkers.
 */
export function generateOpticalSignalMapReport(metrics, options = {}) {
  if (!metrics || !Array.isArray(metrics.nodes)) {
    return 'No optical signal map data available.';
  }

  const dateStr = new Date().toISOString().slice(0, 19).replace('T', ' ');

  let out = `# SHAHDARA ISP OSP FIELD BRIEFING: OPTICAL SIGNAL LOSS MAP & SPLITTER HEALTH\n`;
  out += `Generated: ${dateStr} PKT | Fiber Outside-Plant Maintenance Division\n\n`;

  out += `## 1. OPTICAL NETWORK SUMMARY\n`;
  out += `- Total Monitored PON Nodes: ${metrics.totalNodes}\n`;
  out += `- Optimal Signal (>= -23 dBm): ${metrics.optimalNodesCount} nodes\n`;
  out += `- Marginal Warning (-24 to -27 dBm): ${metrics.warningNodesCount} nodes\n`;
  out += `- Critical High Loss / LOS (< -27 dBm): ${metrics.criticalNodesCount} nodes\n`;
  out += `- Average Optical Path Loss: ${metrics.averageLossDb} dB | Avg Customer Rx: ${metrics.averageRxDbm} dBm\n`;
  out += `- At-Risk Subscribers (Degraded/Offline): ${metrics.criticalSubscribersCount} subscribers\n`;
  out += `- Estimated Monthly Revenue at Risk: ${formatPKR(metrics.revenueAtRiskPkr)}\n\n`;

  out += `## 2. DISTRIBUTION NODES ATTENUATION REGISTER\n`;
  out += `| Node Code | Node Name | Area | Feeder | Splitter | Rx Power | Path Loss | Status |\n`;
  out += `|---|---|---|---|---|---|---|---|\n`;
  for (const n of metrics.nodes) {
    const stat = n.statusTier === 'critical' ? '🔴 CRITICAL' : n.statusTier === 'warning' ? '🟡 WARNING' : '🟢 OPTIMAL';
    out += `| ${n.code} | ${n.name} | ${n.area} | ${n.feederKm}km | ${n.splitterType} | ${n.measuredRxDbm} dBm | ${n.measuredLossDb} dB | ${stat} |\n`;
  }

  out += `\n## 3. PRIORITY FIELD DISPATCH ACTIONS\n`;
  const criticalList = metrics.nodes.filter(n => n.statusTier === 'critical');
  if (criticalList.length > 0) {
    for (const cn of criticalList) {
      out += `- [URGENT DISPATCH] Node ${cn.code} (${cn.name}) in ${cn.area}:\n`;
      out += `  Location: ${cn.poleLocation}\n`;
      out += `  Current Rx: ${cn.measuredRxDbm} dBm (Severe Attenuation Loss: ${cn.measuredLossDb} dB)\n`;
      out += `  Action: Inspect SC/APC connector cleanliness with fiber scope, re-splice dirty drop splices, check aerial river span for cable bend radius pinch.\n`;
    }
  } else {
    out += `All Shahdara optical nodes are operating within allowable GPON optical budgets. Routine maintenance of FDH dust seals advised.\n`;
  }

  return out;
}

/**
 * Sets up and manages the Optical Signal Loss Map Modal Dialog and its multi-surface triggers.
 */
export function setupOpticalSignalMapModal({
  getState,
  storage = (typeof localStorage !== 'undefined' ? localStorage : null),
  onNavigateCustomer,
  onToast,
  clipboard
} = {}) {
  if (typeof document === 'undefined') return { recalculate: () => {}, open: () => {}, close: () => {} };

  const modal = document.getElementById('opticalSignalMapModal');
  const closeBtn = document.getElementById('opticalSignalMapCloseBtn');
  const mapSvgContainer = document.getElementById('opticalSignalMapSvgContainer');
  const copyReportBtn = document.getElementById('opticalSignalMapCopyReportBtn');
  const searchInput = document.getElementById('opticalSignalMapSearchInput');
  const filterBtns = document.querySelectorAll('[data-optical-filter]');

  const kpiTotalNodes = document.getElementById('opticalKpiTotalNodes');
  const kpiAvgLoss = document.getElementById('opticalKpiAvgLoss');
  const kpiCriticalNodes = document.getElementById('opticalKpiCriticalNodes');
  const kpiRevenueRisk = document.getElementById('opticalKpiRevenueRisk');

  const inspectorPanel = document.getElementById('opticalNodeInspectorPanel');
  const inspectorTitle = document.getElementById('opticalInspectorTitle');
  const inspectorSpecs = document.getElementById('opticalInspectorSpecs');
  const inspectorRx = document.getElementById('opticalInspectorRx');
  const inspectorLoss = document.getElementById('opticalInspectorLoss');
  const inspectorStatusBadge = document.getElementById('opticalInspectorStatusBadge');
  const inspectorCustomersList = document.getElementById('opticalInspectorCustomersList');

  const simReadingInput = document.getElementById('opticalSimReadingInput');
  const simReadingBtn = document.getElementById('opticalSimReadingBtn');
  const resetReadingsBtn = document.getElementById('opticalResetReadingsBtn');

  // Trigger buttons across desktop and mobile surfaces
  const openBtns = document.querySelectorAll('[data-open-optical-map], [data-mobile-more="optical-map"], [data-sheet-action="optical-map"], [data-speed-action="optical-map"]');

  let currentState = typeof getState === 'function' ? getState() : { customers: [] };
  let currentFilter = 'all';
  let searchQuery = '';
  let selectedNodeId = 'fdh-wandala-01';

  function updateUi() {
    const state = typeof getState === 'function' ? getState() : currentState;
    const metrics = calculateOpticalSignalMapMetrics(state, {
      storage,
      filter: currentFilter,
      search: searchQuery
    });

    if (kpiTotalNodes) kpiTotalNodes.textContent = String(metrics.totalNodes);
    if (kpiAvgLoss) kpiAvgLoss.textContent = `${metrics.averageLossDb} dB`;
    if (kpiCriticalNodes) kpiCriticalNodes.textContent = String(metrics.criticalNodesCount);
    if (kpiRevenueRisk) kpiRevenueRisk.textContent = formatPKR(metrics.revenueAtRiskPkr);

    // Update navigation badge counter on drawer and menu
    const badges = document.querySelectorAll('[data-nav-badge="optical-map"]');
    badges.forEach(b => {
      b.textContent = String(metrics.criticalNodesCount);
      b.hidden = metrics.criticalNodesCount === 0;
      if (b.classList?.toggle) {
        b.classList.toggle('badge-alert', metrics.criticalNodesCount > 0);
      }
    });

    // Render interactive SVG map
    if (mapSvgContainer) {
      mapSvgContainer.innerHTML = renderOpticalSignalMapSvg(metrics, selectedNodeId);

      // Wire node tap/click handlers in SVG
      mapSvgContainer.querySelectorAll('[data-node-id]').forEach(nodeEl => {
        nodeEl.addEventListener('click', () => {
          const nid = nodeEl.getAttribute('data-node-id');
          if (nid) {
            selectedNodeId = nid;
            triggerHaptic('selection');
            updateUi();
          }
        });
      });
    }

    // Update Inspector details for selected node
    const selectedNode = metrics.nodes.find(n => n.id === selectedNodeId) || metrics.nodes[0];
    if (selectedNode && inspectorPanel) {
      if (inspectorTitle) inspectorTitle.textContent = `${selectedNode.code} · ${selectedNode.name}`;
      if (inspectorSpecs) {
        inspectorSpecs.textContent = `${selectedNode.splitterType} (${selectedNode.capacityPorts} ports) · Feeder: ${selectedNode.feederKm}km · Location: ${selectedNode.poleLocation}`;
      }
      if (inspectorRx) inspectorRx.textContent = `${selectedNode.measuredRxDbm} dBm`;
      if (inspectorLoss) inspectorLoss.textContent = `${selectedNode.measuredLossDb} dB`;
      if (inspectorStatusBadge) {
        inspectorStatusBadge.textContent = selectedNode.statusLabel;
        inspectorStatusBadge.className = `sim-delta-badge ${selectedNode.statusBadgeClass}`;
      }

      if (simReadingInput) {
        simReadingInput.value = String(selectedNode.measuredRxDbm);
      }

      // Render connected customers roster
      if (inspectorCustomersList) {
        if (!selectedNode.connectedCustomers || selectedNode.connectedCustomers.length === 0) {
          inspectorCustomersList.innerHTML = `<li class="optical-customer-empty muted">No active subscribers linked to this optical zone.</li>`;
        } else {
          inspectorCustomersList.innerHTML = selectedNode.connectedCustomers.map(c => `
            <li class="optical-customer-row">
              <div class="optical-customer-info">
                <span class="optical-customer-name">${escapeXml(c.name)}</span>
                <span class="optical-customer-sub">${escapeXml(c.area)} · ${c.phone ? escapeXml(c.phone) : 'No phone'} · ${formatPKR(c.monthlyRate)}/mo</span>
              </div>
              <div class="optical-customer-actions">
                <span class="status-pill status-pill-${c.serviceStatus === 'offline' ? 'offline' : 'active'}">${escapeXml(c.serviceStatus.toUpperCase())}</span>
                <button type="button" class="action-btn-sm" data-nav-cust-id="${escapeXml(c.id)}" title="View Customer Profile">Profile</button>
              </div>
            </li>
          `).join('');

          // Wire profile navigation buttons
          inspectorCustomersList.querySelectorAll('[data-nav-cust-id]').forEach(btn => {
            btn.addEventListener('click', () => {
              const custId = btn.getAttribute('data-nav-cust-id');
              if (typeof onNavigateCustomer === 'function' && custId) {
                if (typeof modal?.close === 'function') modal.close();
                else if (modal) modal.removeAttribute('open');
                onNavigateCustomer(custId);
              }
            });
          });
        }
      }
    }

    return metrics;
  }

  // Wire filter pill buttons
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      currentFilter = btn.getAttribute('data-optical-filter') || 'all';
      triggerHaptic('selection');
      updateUi();
    });
  });

  // Wire search input
  if (searchInput && !searchInput.dataset?.wiredOptical) {
    if (searchInput.dataset) searchInput.dataset.wiredOptical = 'true';
    searchInput.addEventListener('input', () => {
      searchQuery = searchInput.value || '';
      updateUi();
    });
  }

  // Wire simulate power meter reading button
  if (simReadingBtn && !simReadingBtn.dataset?.wiredOptical) {
    if (simReadingBtn.dataset) simReadingBtn.dataset.wiredOptical = 'true';
    simReadingBtn.addEventListener('click', () => {
      const val = Number(simReadingInput?.value);
      if (!isNaN(val)) {
        recordOpticalMeasurement(selectedNodeId, val, storage);
        triggerHaptic('success');
        updateUi();
        if (typeof onToast === 'function') onToast(`Recorded power meter reading: ${val.toFixed(1)} dBm`);
      }
    });
  }

  // Wire reset readings button
  if (resetReadingsBtn && !resetReadingsBtn.dataset?.wiredOptical) {
    resetReadingsBtn.dataset.wiredOptical = 'true';
    resetReadingsBtn.addEventListener('click', () => {
      clearOpticalMeasurements(storage);
      triggerHaptic('medium');
      updateUi();
      if (typeof onToast === 'function') onToast('Reset all optical measurements to baseline.');
    });
  }

  // Wire copy report button
  if (copyReportBtn && !copyReportBtn.dataset?.wiredOptical) {
    if (copyReportBtn.dataset) copyReportBtn.dataset.wiredOptical = 'true';
    copyReportBtn.addEventListener('click', async () => {
      const state = typeof getState === 'function' ? getState() : currentState;
      const metrics = calculateOpticalSignalMapMetrics(state, { storage });
      const text = generateOpticalSignalMapReport(metrics);
      const clip = clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
      if (clip && typeof clip.writeText === 'function') {
        try {
          await clip.writeText(text);
          if (typeof onToast === 'function') onToast('Optical dispatch briefing copied to clipboard!');
        } catch {
          if (typeof onToast === 'function') onToast('Failed to copy briefing.');
        }
      } else if (typeof onToast === 'function') {
        onToast('Clipboard API not available.');
      }
    });
  }

  // Wire open buttons
  openBtns.forEach(btn => {
    if (!btn.dataset?.wiredOpticalOpen) {
      if (btn.dataset) btn.dataset.wiredOpticalOpen = 'true';
      btn.addEventListener('click', () => {
        updateUi();
        triggerHaptic('medium');
        if (typeof modal?.showModal === 'function') modal.showModal();
        else if (modal) modal.setAttribute('open', '');
      });
    }
  });

  // Wire close button
  if (closeBtn && !closeBtn.dataset?.wiredOptical) {
    if (closeBtn.dataset) closeBtn.dataset.wiredOptical = 'true';
    closeBtn.addEventListener('click', () => {
      if (typeof modal?.close === 'function') modal.close();
      else if (modal) modal.removeAttribute('open');
    });
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        if (typeof modal?.close === 'function') modal.close();
        else modal.removeAttribute('open');
      }
    });
  }

  return {
    recalculate: updateUi,
    open: () => {
      updateUi();
      if (typeof modal?.showModal === 'function') modal.showModal();
      else if (modal) modal.setAttribute('open', '');
    },
    close: () => {
      if (typeof modal?.close === 'function') modal.close();
      else if (modal) modal.removeAttribute('open');
    },
    setState: (newState) => {
      currentState = newState;
      updateUi();
    }
  };
}
