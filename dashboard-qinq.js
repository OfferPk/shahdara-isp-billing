import { formatPKR } from './core.js';

/**
 * Metro Ethernet IEEE 802.1ad VLAN Q-in-Q Double-Tagging,
 * Carrier Ethernet Trunk Link Aggregation Control Protocol (IEEE 802.3ad / 802.1ax LACP)
 * & Trunk Port Saturation Matrix
 *
 * Models Metro Ethernet Provider Bridging (QinQ / VLAN Stacking) with outer Service Tag
 * (S-Tag, TPID 0x88A8) and inner Customer Tag (C-Tag, TPID 0x8100) multiplexed across
 * Shahdara ISP optical fiber distribution rings and central aggregation hubs.
 * Simulates multi-port LACP trunk bundling (e.g., 4x10G, 2x10G SFP+ links), frame load-balancing
 * hash distributions (L2, L3, L4), physical member link failures, failover traffic convergence,
 * and trunk bandwidth saturation thresholds (Warning >= 75%, Critical >= 90%).
 */

export const QINQ_CONSTANTS = {
  TPID_STAG: '0x88A8',
  TPID_CTAG: '0x8100',
  WARNING_SATURATION_PCT: 75.0,
  CRITICAL_SATURATION_PCT: 90.0,
  HASH_ALGORITHMS: {
    L2: 'L2 (Src/Dst MAC)',
    L3: 'L3 (Src/Dst IP)',
    L3_L4: 'L3+L4 (IP + Port)'
  },
  MEMBER_SPEED_GBPS: 10.0
};

export const SHAHDARA_QINQ_TRUNKS = [
  {
    id: 'lacp-trunk-core-agg',
    name: 'Trunk-LAG-01 (4x10G LACP) - Shahdara Central Core Aggregation',
    stagVlan: 100,
    serviceType: 'FTTH Residential PPPoE & IPoE Carrier Transport',
    primaryArea: 'Shahdara Town',
    aliasAreas: ['Shahdara Town', 'Old Town', 'Railway Road'],
    totalMembers: 4,
    memberSpeedGbps: 10,
    switchPlatform: 'Juniper MX204 / Huawei NE40E Universal Core Router',
    transceiverType: '10GBASE-LR SFP+ (1310nm 10km)',
    baseTrafficLoadGbps: 24.5,
    defaultHashAlgorithm: 'L3+L4 (IP + Port)',
    customerVlans: [
      { ctag: 101, name: 'GPON-OLT-01 PPPoE Bridge', protocol: 'PPPoE', subscribersEst: 420 },
      { ctag: 102, name: 'GPON-OLT-02 IPoE Static IP', protocol: 'IPoE', subscribersEst: 180 },
      { ctag: 103, name: 'IPTV Multicast IGMP Trunk', protocol: 'Multicast', subscribersEst: 290 },
      { ctag: 104, name: 'SIP VoIP Voice Gateway', protocol: 'SIP/RTP', subscribersEst: 110 }
    ]
  },
  {
    id: 'lacp-trunk-baradari-ind',
    name: 'Trunk-LAG-02 (2x10G LACP) - Baradari Industrial Fiber Ring',
    stagVlan: 200,
    serviceType: 'Dedicated DIA & Enterprise Corporate Leased Lines',
    primaryArea: 'Baradari Road',
    aliasAreas: ['Baradari Road', 'Bara Dari', 'Tariq Road'],
    totalMembers: 2,
    memberSpeedGbps: 10,
    switchPlatform: 'Cisco ASR 920 Metro Aggregation Router',
    transceiverType: '10GBASE-LR SFP+ (1310nm 10km)',
    baseTrafficLoadGbps: 12.8,
    defaultHashAlgorithm: 'L3 (Src/Dst IP)',
    customerVlans: [
      { ctag: 201, name: 'Mill Corridor Dedicated DIA', protocol: 'BGP/DIA', subscribersEst: 45 },
      { ctag: 202, name: 'Commercial Plaza Fiber Feeder', protocol: 'IPoE', subscribersEst: 160 },
      { ctag: 203, name: 'Public Hotspot Carrier WiFi', protocol: 'DHCP', subscribersEst: 210 }
    ]
  },
  {
    id: 'lacp-trunk-vandala-west',
    name: 'Trunk-LAG-03 (2x10G LACP) - Vandala West Feeder Trunk',
    stagVlan: 300,
    serviceType: 'GPON OLT Backhaul & IPTV Multicast Transport',
    primaryArea: 'Vandala Road',
    aliasAreas: ['Vandala Road', 'Wandala Road', 'Zia Town'],
    totalMembers: 2,
    memberSpeedGbps: 10,
    switchPlatform: 'Huawei S6730-H Metro Aggregator Switch',
    transceiverType: '10GBASE-ER SFP+ (1550nm 40km)',
    baseTrafficLoadGbps: 14.2,
    defaultHashAlgorithm: 'L3+L4 (IP + Port)',
    customerVlans: [
      { ctag: 301, name: 'Vandala OLT-01 PPPoE', protocol: 'PPPoE', subscribersEst: 380 },
      { ctag: 302, name: 'Zia Town OLT-02 Access', protocol: 'PPPoE', subscribersEst: 270 },
      { ctag: 303, name: 'HD Broadcast Stream Trunk', protocol: 'Multicast', subscribersEst: 310 }
    ]
  },
  {
    id: 'lacp-trunk-jiamusa-metro',
    name: 'Trunk-LAG-04 (2x10G LACP) - Jia Musa Aggregation Link',
    stagVlan: 400,
    serviceType: 'High-Density Broadband & Residential FTTH',
    primaryArea: 'Jia Musa',
    aliasAreas: ['Jia Musa', 'Farrukhabad'],
    totalMembers: 2,
    memberSpeedGbps: 10,
    switchPlatform: 'ZTE ZXR10 5960 Metro Switch',
    transceiverType: '10GBASE-LR SFP+ (1310nm 10km)',
    baseTrafficLoadGbps: 13.5,
    defaultHashAlgorithm: 'L3+L4 (IP + Port)',
    customerVlans: [
      { ctag: 401, name: 'Jia Musa Main OLT PPPoE', protocol: 'PPPoE', subscribersEst: 340 },
      { ctag: 402, name: 'Farrukhabad Ring Extension', protocol: 'IPoE', subscribersEst: 220 }
    ]
  },
  {
    id: 'lacp-trunk-saeed-dist',
    name: 'Trunk-LAG-05 (2x10G LACP) - Saeed Park Distribution Feeder',
    stagVlan: 500,
    serviceType: 'Access Ring Feeder & FTTH Distribution',
    primaryArea: 'Saeed Park',
    aliasAreas: ['Saeed Park'],
    totalMembers: 2,
    memberSpeedGbps: 10,
    switchPlatform: 'FiberHome CiTRANS 660A Metro Unit',
    transceiverType: '10GBASE-LR SFP+ (1310nm 10km)',
    baseTrafficLoadGbps: 11.0,
    defaultHashAlgorithm: 'L2 (Src/Dst MAC)',
    customerVlans: [
      { ctag: 501, name: 'Saeed Park Residential FTTH', protocol: 'PPPoE', subscribersEst: 290 },
      { ctag: 502, name: 'Commercial Market Feeders', protocol: 'IPoE', subscribersEst: 85 }
    ]
  },
  {
    id: 'lacp-trunk-begumkot-outer',
    name: 'Trunk-LAG-06 (2x10G LACP) - Begum Kot Outer Perimeter Trunk',
    stagVlan: 600,
    serviceType: 'Edge Ring Transit & Sheikhupura Road Feeder',
    primaryArea: 'Begum Kot',
    aliasAreas: ['Begum Kot', 'Sheikhupura Road', 'Kot Begum'],
    totalMembers: 2,
    memberSpeedGbps: 10,
    switchPlatform: 'Nokia 7210 SAS-Mxp Service Router',
    transceiverType: '10GBASE-ER SFP+ (1550nm 40km)',
    baseTrafficLoadGbps: 13.8,
    defaultHashAlgorithm: 'L3+L4 (IP + Port)',
    customerVlans: [
      { ctag: 601, name: 'Sheikhupura Road OLT Trunk', protocol: 'PPPoE', subscribersEst: 360 },
      { ctag: 602, name: 'Outer Industrial Hub Leased', protocol: 'BGP/DIA', subscribersEst: 40 }
    ]
  }
];

// Interactive simulation state
let currentSelectedTrunkId = 'lacp-trunk-core-agg';
let currentTrafficSurgeGbps = 0.0;
let currentFailedMembersCount = 0;
let currentHashAlgorithm = QINQ_CONSTANTS.HASH_ALGORITHMS.L3_L4;

export function getQinqSelectedTrunk() {
  return currentSelectedTrunkId;
}

export function setQinqSelectedTrunk(id) {
  if (SHAHDARA_QINQ_TRUNKS.some(t => t.id === id)) {
    currentSelectedTrunkId = id;
  }
}

export function getQinqTrafficSurgeGbps() {
  return currentTrafficSurgeGbps;
}

export function setQinqTrafficSurgeGbps(val) {
  if (typeof val === 'number' && !Number.isNaN(val)) {
    currentTrafficSurgeGbps = Math.max(0.0, Math.min(25.0, val));
  }
}

export function getQinqFailedMembersCount() {
  return currentFailedMembersCount;
}

export function setQinqFailedMembersCount(val) {
  if (typeof val === 'number' && !Number.isNaN(val)) {
    currentFailedMembersCount = Math.max(0, Math.min(3, Math.round(val)));
  }
}

export function getQinqHashAlgorithm() {
  return currentHashAlgorithm;
}

export function setQinqHashAlgorithm(alg) {
  if (Object.values(QINQ_CONSTANTS.HASH_ALGORITHMS).includes(alg)) {
    currentHashAlgorithm = alg;
  }
}

export function resetQinqSimState() {
  currentSelectedTrunkId = 'lacp-trunk-core-agg';
  currentTrafficSurgeGbps = 0.0;
  currentFailedMembersCount = 0;
  currentHashAlgorithm = QINQ_CONSTANTS.HASH_ALGORITHMS.L3_L4;
}

/**
 * Calculates physical LACP member states and bandwidth saturation for a trunk
 */
export function calculateTrunkLacpMetrics(trunk, overrides = {}) {
  const isSelected = trunk.id === (overrides.selectedTrunkId || currentSelectedTrunkId);
  const trafficSurge = isSelected ? (overrides.trafficSurgeGbps ?? currentTrafficSurgeGbps) : 0.0;
  const failedCount = isSelected ? Math.min(trunk.totalMembers - 1, (overrides.failedMembersCount ?? currentFailedMembersCount)) : 0;
  const hashAlgorithm = isSelected ? (overrides.hashAlgorithm ?? currentHashAlgorithm) : trunk.defaultHashAlgorithm;

  const totalMembers = trunk.totalMembers;
  const activeMembers = Math.max(1, totalMembers - failedCount);
  const nominalCapacityGbps = totalMembers * trunk.memberSpeedGbps;
  const operationalCapacityGbps = activeMembers * trunk.memberSpeedGbps;

  const effectiveTrafficGbps = Number((trunk.baseTrafficLoadGbps + trafficSurge).toFixed(2));
  const saturationPct = Number(((effectiveTrafficGbps / operationalCapacityGbps) * 100).toFixed(1));

  // Determine health status
  let healthStatus = 'OPTIMAL';
  let badgeClass = 'badge-success';
  let packetLossEstPct = 0.0;

  if (saturationPct >= 100.0) {
    healthStatus = 'SATURATED / DROPPING';
    badgeClass = 'badge-danger';
    packetLossEstPct = Number((((effectiveTrafficGbps - operationalCapacityGbps) / effectiveTrafficGbps) * 100).toFixed(2));
  } else if (saturationPct >= QINQ_CONSTANTS.CRITICAL_SATURATION_PCT) {
    healthStatus = 'CRITICAL LOAD';
    badgeClass = 'badge-danger';
    packetLossEstPct = 0.50; // Buffer tail drops during burst spikes
  } else if (saturationPct >= QINQ_CONSTANTS.WARNING_SATURATION_PCT) {
    healthStatus = 'HIGH UTILIZATION';
    badgeClass = 'badge-warning';
    packetLossEstPct = 0.0;
  }

  // Member link distributions
  const memberLinks = [];
  const trafficPerLink = effectiveTrafficGbps / activeMembers;
  for (let i = 1; i <= totalMembers; i++) {
    const isFailed = i > activeMembers;
    memberLinks.push({
      portNumber: i,
      portName: `xe-0/0/${i - 1}`,
      speedGbps: trunk.memberSpeedGbps,
      isActive: !isFailed,
      statusText: isFailed ? 'DOWN (LACP Inactive)' : 'FORWARDING (LACP Active)',
      trafficLoadGbps: isFailed ? 0.0 : Number(trafficPerLink.toFixed(2)),
      utilizationPct: isFailed ? 0.0 : Number(((trafficPerLink / trunk.memberSpeedGbps) * 100).toFixed(1))
    });
  }

  return {
    ...trunk,
    totalMembers,
    activeMembers,
    failedCount,
    nominalCapacityGbps,
    operationalCapacityGbps,
    effectiveTrafficGbps,
    saturationPct,
    healthStatus,
    badgeClass,
    packetLossEstPct,
    hashAlgorithm,
    memberLinks,
    isSelected
  };
}

/**
 * Calculates aggregate Metro Ethernet QinQ & LACP metrics combined with Shahdara ledger state
 */
export function calculateQinqMetrics(state, options = {}) {
  const selectedId = options.selectedTrunkId || currentSelectedTrunkId;
  const customers = (state && Array.isArray(state.customers)) ? state.customers : [];
  const bills = (state && Array.isArray(state.bills)) ? state.bills : [];
  const payments = (state && Array.isArray(state.payments)) ? state.payments : [];

  const allTrunks = SHAHDARA_QINQ_TRUNKS.map(trunk => {
    const trunkData = calculateTrunkLacpMetrics(trunk, {
      selectedTrunkId: selectedId,
      trafficSurgeGbps: options.trafficSurgeGbps,
      failedMembersCount: options.failedMembersCount,
      hashAlgorithm: options.hashAlgorithm
    });

    // Match customers mapped to primary & alias areas
    const matchingCustomers = customers.filter(c => {
      const custArea = (c.area || '').trim().toLowerCase();
      return trunk.aliasAreas.some(alias => custArea === alias.toLowerCase());
    });

    const activeCustomers = matchingCustomers.filter(c => !c.archived && c.status !== 'Inactive');
    const offlineCustomers = matchingCustomers.filter(c => !c.archived && c.status === 'Offline');

    let totalBilledRevenue = 0;
    let totalOutstandingDues = 0;

    matchingCustomers.forEach(cust => {
      const custBills = Array.isArray(cust.bills) && cust.bills.length > 0 ? cust.bills : bills.filter(b => b.customerId === cust.id);
      const custPayments = payments.filter(p => p.customerId === cust.id);
      const billedSum = custBills.reduce((sum, b) => sum + (Number(b.dueAmount) || Number(b.amount) || 0), 0);
      const paidSum = custPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const balance = Math.max(0, billedSum - paidSum);

      const pkgPrice = Number(cust.packagePrice) || Number(cust.monthlyFee) || Number(cust.monthlySellingAmount) || 0;
      totalBilledRevenue += pkgPrice;
      totalOutstandingDues += balance;
    });

    const isAtRisk = trunkData.saturationPct >= QINQ_CONSTANTS.WARNING_SATURATION_PCT || trunkData.failedCount > 0;
    const revenueAtRisk = isAtRisk ? totalBilledRevenue : 0;
    const duesAtRisk = isAtRisk ? totalOutstandingDues : 0;

    return {
      ...trunkData,
      matchingCount: matchingCustomers.length,
      activeCount: activeCustomers.length,
      offlineCount: offlineCustomers.length,
      totalBilledRevenue,
      totalOutstandingDues,
      revenueAtRisk,
      duesAtRisk
    };
  });

  const selectedTrunk = allTrunks.find(t => t.id === selectedId) || allTrunks[0];

  const totalTrunks = allTrunks.length;
  const totalCarrierCapacityGbps = allTrunks.reduce((sum, t) => sum + t.operationalCapacityGbps, 0);
  const totalLiveTrafficGbps = Number(allTrunks.reduce((sum, t) => sum + t.effectiveTrafficGbps, 0).toFixed(1));
  const avgSaturationPct = Number(((totalLiveTrafficGbps / totalCarrierCapacityGbps) * 100).toFixed(1));

  const optimalCount = allTrunks.filter(t => t.saturationPct < QINQ_CONSTANTS.WARNING_SATURATION_PCT && t.failedCount === 0).length;
  const warningCount = allTrunks.filter(t => t.saturationPct >= QINQ_CONSTANTS.WARNING_SATURATION_PCT && t.saturationPct < QINQ_CONSTANTS.CRITICAL_SATURATION_PCT).length;
  const criticalCount = allTrunks.filter(t => t.saturationPct >= QINQ_CONSTANTS.CRITICAL_SATURATION_PCT).length;

  const totalRevenueAtRisk = allTrunks.reduce((sum, t) => sum + t.revenueAtRisk, 0);
  const totalDuesAtRisk = allTrunks.reduce((sum, t) => sum + t.duesAtRisk, 0);
  const totalSubscribersMonitored = allTrunks.reduce((sum, t) => sum + t.activeCount, 0);

  let overallHealth = 'OPTIMAL';
  if (criticalCount > 0) {
    overallHealth = 'CRITICAL';
  } else if (warningCount > 0) {
    overallHealth = 'WARNING';
  }

  return {
    totalTrunks,
    totalCarrierCapacityGbps,
    totalLiveTrafficGbps,
    avgSaturationPct,
    optimalCount,
    warningCount,
    criticalCount,
    totalRevenueAtRisk,
    totalDuesAtRisk,
    totalSubscribersMonitored,
    overallHealth,
    selectedTrunk,
    allTrunks
  };
}

/**
 * Pure SVG Offline Metro Ethernet QinQ & LACP Visualization Generator
 */
export function renderQinqTrunkSvg(metrics, options = {}) {
  const isCompact = !!options.compact;
  const trunk = metrics.selectedTrunk;
  if (!trunk) {
    return `<svg class="${isCompact ? 'qinq-compact-svg' : 'qinq-expanded-svg'}" viewBox="0 0 600 210"><text x="300" y="105" text-anchor="middle" fill="currentColor">No Metro Ethernet Trunk Data</text></svg>`;
  }

  if (isCompact) {
    // Compact widget for dashboard card tile (width: 600, height: 210)
    const satBarWidth = Math.max(0, Math.min(100, trunk.saturationPct));
    const statusColor = trunk.saturationPct >= 90.0 ? '#ef4444' : trunk.saturationPct >= 75.0 ? '#f59e0b' : '#10b981';

    return `<svg class="qinq-compact-svg" viewBox="0 0 600 210" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Metro Ethernet QinQ and LACP Trunk Summary">
      <defs>
        <linearGradient id="qinqSatGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#0284c7" />
          <stop offset="75%" stop-color="#f59e0b" />
          <stop offset="100%" stop-color="#ef4444" />
        </linearGradient>
      </defs>

      <!-- Background container -->
      <rect x="0" y="0" width="600" height="210" rx="10" fill="var(--surface-alt, #f8fafc)" stroke="var(--border-color, #e2e8f0)" stroke-width="1.5" />

      <!-- Top Title Bar -->
      <g transform="translate(18, 28)">
        <text x="0" y="0" font-size="13" font-weight="700" fill="var(--text-color, #0f172a)">${trunk.name}</text>
        <text x="0" y="18" font-size="11" fill="var(--text-muted, #64748b)">S-Tag VLAN: ${trunk.stagVlan} (0x88A8) · ${trunk.switchPlatform} · ${trunk.hashAlgorithm}</text>
        
        <!-- Status Pill -->
        <rect x="440" y="-14" width="142" height="22" rx="11" fill="${statusColor}" fill-opacity="0.15" stroke="${statusColor}" stroke-width="1.2" />
        <text x="511" y="1" font-size="10" font-weight="700" fill="${statusColor}" text-anchor="middle">${trunk.healthStatus}</text>
      </g>

      <!-- KPI Metrics Row -->
      <g transform="translate(18, 80)">
        <!-- Trunk Capacity Box -->
        <rect x="0" y="0" width="130" height="52" rx="6" fill="var(--card-bg, #ffffff)" stroke="var(--border-color, #e2e8f0)" />
        <text x="12" y="18" font-size="10" font-weight="600" fill="var(--text-muted, #64748b)">ACTIVE CAPACITY</text>
        <text x="12" y="38" font-size="15" font-weight="700" fill="#0284c7">${trunk.operationalCapacityGbps} Gbps</text>

        <!-- Current Load Box -->
        <rect x="142" y="0" width="130" height="52" rx="6" fill="var(--card-bg, #ffffff)" stroke="var(--border-color, #e2e8f0)" />
        <text x="154" y="18" font-size="10" font-weight="600" fill="var(--text-muted, #64748b)">LIVE TRAFFIC</text>
        <text x="154" y="38" font-size="15" font-weight="700" fill="var(--text-color, #0f172a)">${trunk.effectiveTrafficGbps} Gbps</text>

        <!-- Saturation Box -->
        <rect x="284" y="0" width="130" height="52" rx="6" fill="var(--card-bg, #ffffff)" stroke="var(--border-color, #e2e8f0)" />
        <text x="296" y="18" font-size="10" font-weight="600" fill="var(--text-muted, #64748b)">PORT SATURATION</text>
        <text x="296" y="38" font-size="15" font-weight="700" fill="${statusColor}">${trunk.saturationPct}%</text>

        <!-- Member Links Status Box -->
        <rect x="426" y="0" width="138" height="52" rx="6" fill="var(--card-bg, #ffffff)" stroke="var(--border-color, #e2e8f0)" />
        <text x="438" y="18" font-size="10" font-weight="600" fill="var(--text-muted, #64748b)">LACP MEMBERS</text>
        <text x="438" y="38" font-size="15" font-weight="700" fill="${trunk.failedCount > 0 ? '#ef4444' : '#10b981'}">${trunk.activeMembers}/${trunk.totalMembers} Up</text>
      </g>

      <!-- Bandwidth Saturation Progress Bar -->
      <g transform="translate(18, 150)">
        <text x="0" y="12" font-size="11" font-weight="600" fill="var(--text-muted, #64748b)">Trunk Bandwidth Saturation (${trunk.effectiveTrafficGbps} / ${trunk.operationalCapacityGbps} Gbps)</text>
        <rect x="0" y="20" width="564" height="12" rx="6" fill="var(--border-color, #e2e8f0)" />
        <rect x="0" y="20" width="${(564 * satBarWidth) / 100}" height="12" rx="6" fill="url(#qinqSatGrad)" />
        
        <!-- Threshold ticks -->
        <line x1="${(564 * 75.0) / 100.0}" y1="18" x2="${(564 * 75.0) / 100.0}" y2="34" stroke="#f59e0b" stroke-width="2" />
        <text x="${(564 * 75.0) / 100.0}" y="46" font-size="9" fill="#f59e0b" text-anchor="middle">75% (Warn)</text>

        <line x1="${(564 * 90.0) / 100.0}" y1="18" x2="${(564 * 90.0) / 100.0}" y2="34" stroke="#ef4444" stroke-width="2" />
        <text x="${(564 * 90.0) / 100.0}" y="46" font-size="9" fill="#ef4444" text-anchor="middle">90% (Crit)</text>
      </g>
    </svg>`;
  }

  // Expanded detailed SVG diagram for modal dialog (width: 900, height: 440)
  const statusColor = trunk.saturationPct >= 90.0 ? '#ef4444' : trunk.saturationPct >= 75.0 ? '#f59e0b' : '#10b981';
  const satBarWidth = Math.max(0, Math.min(100, trunk.saturationPct));

  return `<svg class="qinq-expanded-svg" viewBox="0 0 900 440" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Metro Ethernet IEEE 802.1ad QinQ and LACP Architectural Schematic">
    <defs>
      <linearGradient id="qinqModalSatGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#0284c7" />
        <stop offset="75%" stop-color="#f59e0b" />
        <stop offset="100%" stop-color="#ef4444" />
      </linearGradient>
    </defs>

    <!-- Canvas Card -->
    <rect x="0" y="0" width="900" height="440" rx="12" fill="var(--surface, #ffffff)" stroke="var(--border-color, #e2e8f0)" stroke-width="1.5" />

    <!-- SECTION 1: IEEE 802.1ad QinQ Double-Tag Ethernet Frame Header Structure (Top) -->
    <g transform="translate(24, 20)">
      <text x="0" y="14" font-size="12" font-weight="700" fill="var(--text-color, #0f172a)">IEEE 802.1ad PROVIDER BRIDGING (Q-IN-Q) FRAME STRUCTURE</text>
      <text x="852" y="14" font-size="11" fill="var(--text-muted, #64748b)" text-anchor="end">Trunk Service: ${trunk.serviceType}</text>
      
      <!-- Frame Diagram Blocks -->
      <g transform="translate(0, 26)">
        <!-- Preamble / MAC -->
        <rect x="0" y="0" width="100" height="42" rx="4" fill="#f1f5f9" stroke="#cbd5e1" />
        <text x="50" y="18" font-size="10" font-weight="700" fill="#475569" text-anchor="middle">MAC HEADERS</text>
        <text x="50" y="32" font-size="9" fill="#64748b" text-anchor="middle">Dst/Src (12B)</text>

        <!-- S-TAG (Outer Service Tag 0x88A8) -->
        <rect x="110" y="0" width="180" height="42" rx="4" fill="#0284c7" fill-opacity="0.15" stroke="#0284c7" stroke-width="1.8" />
        <text x="200" y="18" font-size="11" font-weight="700" fill="#0369a1" text-anchor="middle">OUTER S-TAG (802.1ad)</text>
        <text x="200" y="32" font-size="9" fill="#0284c7" text-anchor="middle">TPID 0x88A8 · S-VLAN ${trunk.stagVlan} · PCP 5 · DEI 0</text>

        <!-- C-TAG (Inner Customer Tag 0x8100) -->
        <rect x="300" y="0" width="180" height="42" rx="4" fill="#10b981" fill-opacity="0.15" stroke="#10b981" stroke-width="1.8" />
        <text x="390" y="18" font-size="11" font-weight="700" fill="#047857" text-anchor="middle">INNER C-TAG (802.1Q)</text>
        <text x="390" y="32" font-size="9" fill="#059669" text-anchor="middle">TPID 0x8100 · C-VLAN Multi-MUX · PCP 0</text>

        <!-- EtherType -->
        <rect x="490" y="0" width="90" height="42" rx="4" fill="#f1f5f9" stroke="#cbd5e1" />
        <text x="535" y="18" font-size="10" font-weight="700" fill="#475569" text-anchor="middle">ETHERTYPE</text>
        <text x="535" y="32" font-size="9" fill="#64748b" text-anchor="middle">0x0800 (IPv4)</text>

        <!-- Payload & FCS -->
        <rect x="590" y="0" width="262" height="42" rx="4" fill="#f8fafc" stroke="#cbd5e1" />
        <text x="721" y="18" font-size="10" font-weight="700" fill="#475569" text-anchor="middle">SUBSCRIBER PAYLOAD &amp; FCS</text>
        <text x="721" y="32" font-size="9" fill="#64748b" text-anchor="middle">PPPoE / IPoE Data · MTU 1522B (Jumbo Clean)</text>
      </g>
    </g>

    <!-- SECTION 2: LACP Trunk Bundle Member Interfaces & Load Sharing (Middle) -->
    <g transform="translate(24, 106)">
      <text x="0" y="12" font-size="12" font-weight="700" fill="var(--text-color, #0f172a)">IEEE 802.3ad LACP BUNDLE MEMBER INTERFACES &amp; LOAD SHARE</text>
      <text x="852" y="12" font-size="11" font-weight="600" fill="#0284c7" text-anchor="end">Hash Algorithm: ${trunk.hashAlgorithm}</text>

      <!-- Schematic Border Box -->
      <rect x="0" y="22" width="852" height="150" rx="8" fill="var(--surface-alt, #f8fafc)" stroke="var(--border-color, #e2e8f0)" />

      <!-- Member link cards -->
      <g transform="translate(15, 36)">
        ${trunk.memberLinks.map((link, idx) => {
          const cardX = idx * (822 / trunk.totalMembers);
          const cardW = (822 / trunk.totalMembers) - 10;
          const memberColor = link.isActive ? '#10b981' : '#ef4444';
          return `
            <g transform="translate(${cardX}, 0)">
              <rect x="0" y="0" width="${cardW}" height="120" rx="6" fill="var(--card-bg, #ffffff)" stroke="${link.isActive ? 'var(--border-color, #cbd5e1)' : '#fca5a5'}" stroke-width="${link.isActive ? 1.2 : 2}" />
              
              <!-- Port Header -->
              <rect x="0" y="0" width="${cardW}" height="28" rx="6" fill="${memberColor}" fill-opacity="0.1" />
              <text x="12" y="18" font-size="11" font-weight="700" fill="${memberColor}">${link.portName}</text>
              <text x="${cardW - 12}" y="18" font-size="10" font-weight="600" fill="${memberColor}" text-anchor="end">${link.speedGbps}G SFP+</text>

              <!-- Status line -->
              <text x="12" y="44" font-size="10" font-weight="600" fill="var(--text-color, #0f172a)">${link.statusText}</text>
              <text x="12" y="58" font-size="9" fill="var(--text-muted, #64748b)">Transceiver: ${trunk.transceiverType.split(' ')[0]}</text>

              <!-- Utilization Gauge -->
              <text x="12" y="82" font-size="9" font-weight="600" fill="var(--text-muted, #64748b)">Load: ${link.trafficLoadGbps} Gbps (${link.utilizationPct}%)</text>
              <rect x="12" y="88" width="${cardW - 24}" height="8" rx="4" fill="var(--border-color, #e2e8f0)" />
              <rect x="12" y="88" width="${Math.max(0, Math.min(cardW - 24, ((cardW - 24) * link.utilizationPct) / 100))}" height="8" rx="4" fill="${memberColor}" />
            </g>
          `;
        }).join('')}
      </g>
    </g>

    <!-- SECTION 3: Aggregated Bandwidth Saturation & Customer VLAN Breakdown (Bottom) -->
    <g transform="translate(24, 305)">
      <rect x="0" y="0" width="852" height="115" rx="8" fill="var(--surface-alt, #f8fafc)" stroke="var(--border-color, #e2e8f0)" />
      
      <!-- Column 1: Capacity & Saturation Waterfall -->
      <g transform="translate(18, 18)">
        <text x="0" y="0" font-size="11" font-weight="700" fill="var(--text-color, #0f172a)">TRUNK BANDWIDTH CAPACITY &amp; SATURATION</text>
        <text x="0" y="20" font-size="10" fill="var(--text-muted, #64748b)">Nominal Trunk Capacity: <tspan font-weight="700" fill="var(--text-color, #0f172a)">${trunk.nominalCapacityGbps} Gbps</tspan> (${trunk.totalMembers}x 10G)</text>
        <text x="0" y="38" font-size="10" fill="var(--text-muted, #64748b)">Operational Capacity: <tspan font-weight="700" fill="#0284c7">${trunk.operationalCapacityGbps} Gbps</tspan> (${trunk.activeMembers} links active)</text>
        <text x="0" y="56" font-size="10" fill="var(--text-muted, #64748b)">Current Traffic Load: <tspan font-weight="700" fill="${statusColor}">${trunk.effectiveTrafficGbps} Gbps</tspan></text>
        <text x="0" y="74" font-size="10" fill="var(--text-muted, #64748b)">Port Saturation: <tspan font-weight="700" fill="${statusColor}">${trunk.saturationPct}%</tspan> (Loss: ${trunk.packetLossEstPct}%)</text>
      </g>

      <!-- Column 2: Saturation Bar & Health Class -->
      <g transform="translate(320, 18)">
        <text x="0" y="0" font-size="11" font-weight="700" fill="var(--text-color, #0f172a)">CARRIER SATURATION GAUGE</text>
        
        <rect x="0" y="16" width="240" height="14" rx="7" fill="var(--border-color, #cbd5e1)" />
        <rect x="0" y="16" width="${(240 * satBarWidth) / 100}" height="14" rx="7" fill="url(#qinqModalSatGrad)" />

        <text x="0" y="46" font-size="10" fill="var(--text-muted, #64748b)">Health Status: <tspan font-weight="700" fill="${statusColor}">${trunk.healthStatus}</tspan></text>
        <text x="0" y="64" font-size="10" fill="var(--text-muted, #64748b)">Warning Threshold: <tspan font-weight="700" fill="#f59e0b">75.0%</tspan> · Critical: <tspan font-weight="700" fill="#ef4444">90.0%</tspan></text>
        <text x="0" y="82" font-size="10" fill="var(--text-muted, #64748b)">Failover Status: <tspan font-weight="700" fill="${trunk.failedCount > 0 ? '#ef4444' : '#10b981'}">${trunk.failedCount === 0 ? 'Full Redundancy' : `${trunk.failedCount} Link Failover Active`}</tspan></text>
      </g>

      <!-- Column 3: Customer VLAN Multiplexing & Revenue Exposure -->
      <g transform="translate(600, 18)">
        <text x="0" y="0" font-size="11" font-weight="700" fill="var(--text-color, #0f172a)">CUSTOMER VLANS &amp; REVENUE</text>
        <text x="0" y="20" font-size="10" fill="var(--text-muted, #64748b)">Multiplexed C-VLANs: <tspan font-weight="700" fill="#0284c7">${trunk.customerVlans.length} VLANs</tspan></text>
        <text x="0" y="38" font-size="10" fill="var(--text-muted, #64748b)">Linked Subscribers: <tspan font-weight="700" fill="var(--text-color, #0f172a)">${trunk.matchingCount} (${trunk.activeCount} active)</tspan></text>
        <text x="0" y="56" font-size="10" fill="var(--text-muted, #64748b)">Monthly Billed Revenue: <tspan font-weight="700" fill="var(--text-color, #0f172a)">${formatPKR(trunk.totalBilledRevenue)}</tspan></text>
        <text x="0" y="74" font-size="10" fill="var(--text-muted, #64748b)">Revenue Exposure: <tspan font-weight="700" fill="${trunk.revenueAtRisk > 0 ? '#ef4444' : '#10b981'}">${formatPKR(trunk.revenueAtRisk)} / mo</tspan></text>
      </g>
    </g>
  </svg>`;
}

/**
 * Generates plain text executive briefing audit report
 */
export function generateQinqReport(metrics, options = {}) {
  const trunk = metrics.selectedTrunk;
  const refDate = options.referenceDate ? new Date(options.referenceDate).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' }) : new Date().toLocaleString('en-PK', { timeZone: 'Asia/Karachi' });

  return `======================================================================
SHAHDARA METRO ETHERNET Q-IN-Q & LACP TRUNK AUDIT BRIEFING
Generated: ${refDate} PKT
IEEE 802.1ad Provider Bridging & IEEE 802.3ad Carrier Trunk Registry
======================================================================

1. NETWORK METRO FLEET SUMMARY
----------------------------------------------------------------------
Total Monitored Carrier Trunks: ${metrics.totalTrunks} trunk groups
Total Metro Carrier Capacity  : ${metrics.totalCarrierCapacityGbps} Gbps
Total Live Metro Traffic Load : ${metrics.totalLiveTrafficGbps} Gbps
Average Port Saturation       : ${metrics.avgSaturationPct}%
Fleet Health Status           : ${metrics.overallHealth}
  - Optimal Trunks (< 75% load)  : ${metrics.optimalCount}
  - Warning Trunks (75% - 90%)   : ${metrics.warningCount}
  - Critical Trunks (>= 90%)     : ${metrics.criticalCount}
Total Active Subscribers      : ${metrics.totalSubscribersMonitored}
Total Revenue At Risk         : ${formatPKR(metrics.totalRevenueAtRisk)} / month
Total Outstanding Dues At Risk: ${formatPKR(metrics.totalDuesAtRisk)}

2. AUDITED TRUNK LAG DETAILS
----------------------------------------------------------------------
Trunk Group Name    : ${trunk.name}
Outer S-Tag VLAN    : ${trunk.stagVlan} (EtherType 0x88A8)
Service Transport   : ${trunk.serviceType}
Switch Router Model : ${trunk.switchPlatform}
Primary Area Served : ${trunk.primaryArea}
Hash Load Balancing : ${trunk.hashAlgorithm}
Transceiver Standard: ${trunk.transceiverType}

3. LACP AGGREGATION & SATURATION PERFORMANCE
----------------------------------------------------------------------
Total Member Links  : ${trunk.totalMembers} physical interfaces
Active Member Links : ${trunk.activeMembers} interfaces (${trunk.failedCount} link failures)
Nominal Capacity    : ${trunk.nominalCapacityGbps} Gbps
Operational Capacity: ${trunk.operationalCapacityGbps} Gbps
Current Traffic Load: ${trunk.effectiveTrafficGbps} Gbps
Trunk Port Saturation: ${trunk.saturationPct}%
Estimated Frame Loss: ${trunk.packetLossEstPct}%
Trunk Health Tier   : ${trunk.healthStatus}

MEMBER INTERFACES:
${trunk.memberLinks.map(l => `  - Port ${l.portNumber} (${l.portName}): ${l.statusText} | Load: ${l.trafficLoadGbps} Gbps (${l.utilizationPct}%)`).join('\n')}

4. MULTIPLEXED CUSTOMER VLANS (802.1Q C-TAGS)
----------------------------------------------------------------------
${trunk.customerVlans.map(v => `  - C-VLAN ${v.ctag}: ${v.name} (${v.protocol}) ~ ${v.subscribersEst} subscribers`).join('\n')}

5. SUBSCRIBER EXPOSURE & FINANCIALS
----------------------------------------------------------------------
Linked Area Profiles: ${trunk.matchingCount} (${trunk.activeCount} active, ${trunk.offlineCount} offline)
Total Monthly Billing Volume: ${formatPKR(trunk.totalBilledRevenue)}
Total Outstanding Dues      : ${formatPKR(trunk.totalOutstandingDues)}
Immediate Revenue Exposure  : ${formatPKR(trunk.revenueAtRisk)}

======================================================================
OPERATIONAL DIRECTIVES:
${trunk.saturationPct < 75.0 && trunk.failedCount === 0 ? '✓ Trunk operating within headroom tolerances. LACP load distribution optimal.' : trunk.saturationPct < 90.0 && trunk.failedCount === 0 ? '⚠ Trunk utilization approaching 75% threshold. Plan 10G link expansion.' : '🚨 CRITICAL SATURATION / MEMBER FAILURE. Dispatch optical link team & expand LAG capacity.'}
======================================================================`;
}

/**
 * Initializes and wires the interactive Metro Ethernet QinQ & LACP Modal Dialog
 */
export function setupQinqModal(state, options = {}) {
  const modal = document.getElementById('dashboardQinqModal');
  const openBtn = document.getElementById('dashboardOpenQinqModalBtn');
  const closeBtn = document.getElementById('dashboardQinqModalCloseBtn');

  const trunkSelect = document.getElementById('qinqTrunkSelect');
  const surgeSlider = document.getElementById('qinqSurgeSlider');
  const surgeVal = document.getElementById('qinqSurgeVal');
  const failLinkSelect = document.getElementById('qinqFailLinkSelect');
  const hashSelect = document.getElementById('qinqHashSelect');
  const resetBtn = document.getElementById('qinqResetSimBtn');

  // KPI elements
  const kpiTrunkName = document.getElementById('qinqKpiTrunkName');
  const kpiCapacity = document.getElementById('qinqKpiCapacity');
  const kpiSaturation = document.getElementById('qinqKpiSaturation');
  const statusBadge = document.getElementById('qinqStatusBadge');
  const kpiRevenueRisk = document.getElementById('qinqKpiRevenueRisk');

  // Visualization container
  const chartWrap = document.getElementById('qinqModalChartWrap');
  const tableBody = document.getElementById('qinqTrunksTableBody');

  // Action buttons
  const filterAreaBtn = document.getElementById('qinqFilterAreaBtn');
  const copyReportBtn = document.getElementById('dashboardCopyQinqReportBtn');

  function refreshModalView() {
    const metrics = calculateQinqMetrics(state, options);
    const trunk = metrics.selectedTrunk;

    if (kpiTrunkName) kpiTrunkName.textContent = trunk.name;
    if (kpiCapacity) kpiCapacity.textContent = `${trunk.operationalCapacityGbps} Gbps`;
    if (kpiSaturation) kpiSaturation.textContent = `${trunk.saturationPct}% (${trunk.effectiveTrafficGbps}G)`;
    
    if (statusBadge) {
      statusBadge.textContent = trunk.healthStatus;
      statusBadge.className = `sim-delta-badge ${trunk.badgeClass}`;
    }

    if (kpiRevenueRisk) {
      kpiRevenueRisk.textContent = `${formatPKR(trunk.revenueAtRisk)} at risk (${trunk.activeCount} subs)`;
    }

    if (chartWrap) {
      chartWrap.innerHTML = renderQinqTrunkSvg(metrics, { compact: false });
    }

    if (tableBody) {
      tableBody.innerHTML = metrics.allTrunks.map(t => `
        <tr class="${t.id === trunk.id ? 'active-row' : ''}">
          <td style="font-weight: 600;">${t.name}</td>
          <td>${t.stagVlan}</td>
          <td>${t.activeMembers}/${t.totalMembers} links</td>
          <td>${t.operationalCapacityGbps} Gbps</td>
          <td>${t.effectiveTrafficGbps} Gbps</td>
          <td style="font-weight: 700; color: ${t.saturationPct >= 90 ? '#ef4444' : t.saturationPct >= 75 ? '#f59e0b' : '#10b981'};">${t.saturationPct}%</td>
          <td><span class="sim-delta-badge ${t.badgeClass}">${t.healthStatus}</span></td>
          <td>${t.customerVlans.length} C-VLANs</td>
          <td>${formatPKR(t.revenueAtRisk)}</td>
        </tr>
      `).join('');
    }
  }

  function populateDropdowns() {
    if (trunkSelect) {
      trunkSelect.innerHTML = SHAHDARA_QINQ_TRUNKS.map(t => `
        <option value="${t.id}" ${t.id === currentSelectedTrunkId ? 'selected' : ''}>
          ${t.name} (S-VLAN ${t.stagVlan})
        </option>
      `).join('');
    }

    if (failLinkSelect) {
      const selected = SHAHDARA_QINQ_TRUNKS.find(t => t.id === currentSelectedTrunkId) || SHAHDARA_QINQ_TRUNKS[0];
      const maxFails = selected.totalMembers - 1;
      let opts = '<option value="0" ' + (currentFailedMembersCount === 0 ? 'selected' : '') + '>0 Failed Links (Full Capacity)</option>';
      for (let i = 1; i <= maxFails; i++) {
        opts += `<option value="${i}" ${currentFailedMembersCount === i ? 'selected' : ''}>${i} Member Link Down (Failover)</option>`;
      }
      failLinkSelect.innerHTML = opts;
    }

    if (hashSelect) {
      hashSelect.innerHTML = Object.values(QINQ_CONSTANTS.HASH_ALGORITHMS).map(alg => `
        <option value="${alg}" ${alg === currentHashAlgorithm ? 'selected' : ''}>
          ${alg}
        </option>
      `).join('');
    }

    if (surgeSlider) {
      surgeSlider.value = currentTrafficSurgeGbps.toString();
    }
    if (surgeVal) {
      surgeVal.textContent = `+${currentTrafficSurgeGbps.toFixed(1)} Gbps`;
    }
  }

  if (openBtn && modal) {
    openBtn.onclick = () => {
      populateDropdowns();
      refreshModalView();
      if (typeof modal.showModal === 'function') {
        modal.showModal();
      } else {
        modal.setAttribute('open', '');
      }
    };
  }

  if (closeBtn && modal) {
    closeBtn.onclick = () => {
      if (typeof modal.close === 'function') {
        modal.close();
      } else {
        modal.removeAttribute('open');
      }
    };
  }

  if (trunkSelect) {
    trunkSelect.onchange = (e) => {
      setQinqSelectedTrunk(e.target.value);
      currentFailedMembersCount = 0; // reset failures on trunk switch
      populateDropdowns();
      refreshModalView();
    };
  }

  if (surgeSlider) {
    surgeSlider.oninput = (e) => {
      const val = Number(e.target.value);
      setQinqTrafficSurgeGbps(val);
      if (surgeVal) surgeVal.textContent = `+${val.toFixed(1)} Gbps`;
      refreshModalView();
    };
  }

  if (failLinkSelect) {
    failLinkSelect.onchange = (e) => {
      const val = Number(e.target.value);
      setQinqFailedMembersCount(val);
      refreshModalView();
    };
  }

  if (hashSelect) {
    hashSelect.onchange = (e) => {
      setQinqHashAlgorithm(e.target.value);
      refreshModalView();
    };
  }

  if (resetBtn) {
    resetBtn.onclick = () => {
      resetQinqSimState();
      populateDropdowns();
      refreshModalView();
    };
  }

  if (filterAreaBtn) {
    filterAreaBtn.onclick = () => {
      const metrics = calculateQinqMetrics(state, options);
      const trunk = metrics.selectedTrunk;
      if (typeof options.onFilterArea === 'function') {
        options.onFilterArea(trunk.primaryArea);
        if (modal && typeof modal.close === 'function') {
          modal.close();
        }
      }
    };
  }

  if (copyReportBtn) {
    copyReportBtn.onclick = async () => {
      const metrics = calculateQinqMetrics(state, options);
      const report = generateQinqReport(metrics, options);
      const clipboard = options.clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
      let success = false;
      if (clipboard && typeof clipboard.writeText === 'function') {
        try {
          await clipboard.writeText(report);
          success = true;
        } catch (_) {}
      }
      if (typeof options.onToast === 'function') {
        options.onToast(success ? '✓ Metro Ethernet QinQ & LACP Audit Briefing copied to clipboard' : 'Report generated in console');
      }
    };
  }
}
