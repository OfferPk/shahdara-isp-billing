import { formatPKR } from './core.js';

/**
 * Multi-Chassis Link Aggregation Group (MC-LAG / ICCP - RFC 7275 / IEEE 802.1AX)
 * Dual-Homed Core Switch Redundancy & Active-Active Trunk Synchronization Matrix
 *
 * Models carrier-grade Multi-Chassis LAG (M-LAG / vPC / EVPN-MH) deployed across Shahdara ISP
 * core gateway and metro distribution switches.
 *
 * Eliminates Spanning Tree Protocol (STP) blocked uplinks to achieve active-active dual-homing,
 * sub-50ms local link failover, Inter-Chassis Link (ICL) peer bypass, split-brain isolation,
 * ICCP MAC/ARP synchronization, and correlates cluster health with Shahdara subscriber revenue exposure.
 */

export const MCLAG_CONSTANTS = {
  ICCP_PORT: 8888,
  LACP_VERSION: 2,
  ICCP_INTERVALS_MS: [50, 100, 500, 1000, 3000],
  DEFAULT_ICCP_INTERVAL_MS: 100,
  DEFAULT_TRAFFIC_LOAD_GBPS: 120,
  MIN_TRAFFIC_LOAD_GBPS: 5,
  MAX_TRAFFIC_LOAD_GBPS: 350,
  FAILURE_SCENARIOS: {
    NORMAL: 'Dual-Active Active/Active Forwarding (Zero Packet Loss)',
    MEMBER_LINK_FAIL: 'Switch A Member Link Severed (Sub-30ms ICL Bypass Forwarding)',
    ICL_BREAK: 'ICL Peer Link Broken (Split-Brain Prevention / Standby Isolated)',
    NODE_A_FAIL: 'Total Switch A Chassis Outage (100% Traffic Transferred to Switch B)'
  },
  CHASSIS_ROLES: {
    NODE_A: 'Switch A (Primary Core Master)',
    NODE_B: 'Switch B (Secondary Core Peer)',
    CLUSTER: 'Virtual Dual-Active Cluster Plane'
  },
  STATUS: {
    OPTIMAL: 'Optimal',
    WARNING: 'Warning',
    CRITICAL: 'Critical'
  }
};

export const SHAHDARA_MCLAG_TRUNKS = [
  {
    id: 'mclag-trunk-01',
    name: 'MC-LAG 01 Central Core Transit (4x100GbE)',
    role: 'Core Gateway Dual-Homing',
    primaryArea: 'Shahdara Town',
    aliasAreas: ['Shahdara Town', 'Old Town', 'Railway Road'],
    bandwidthGbps: 400,
    switchA: 'Core-SW-01A (Cisco Nexus 9300 vPC)',
    switchB: 'Core-SW-01B (Cisco Nexus 9300 vPC)',
    memberLinksCount: 4,
    iclBandwidthGbps: 200,
    defaultTrafficGbps: 120,
    syncMacCount: 6840
  },
  {
    id: 'mclag-trunk-02',
    name: 'MC-LAG 02 Baradari Metro Aggregation (4x40GbE)',
    role: 'Metro Distribution Ring',
    primaryArea: 'Baradari Road',
    aliasAreas: ['Baradari Road', 'Bara Dari', 'Tariq Road'],
    bandwidthGbps: 160,
    switchA: 'Dist-SW-02A (Juniper QFX5120 MC-LAG)',
    switchB: 'Dist-SW-02B (Juniper QFX5120 MC-LAG)',
    memberLinksCount: 4,
    iclBandwidthGbps: 80,
    defaultTrafficGbps: 55,
    syncMacCount: 3420
  },
  {
    id: 'mclag-trunk-03',
    name: 'MC-LAG 03 Vandala Road OLT Cluster (4x10GbE)',
    role: 'OLT Aggregation Uplink',
    primaryArea: 'Vandala Road',
    aliasAreas: ['Vandala Road', 'Wandala Road', 'Zia Town'],
    bandwidthGbps: 40,
    switchA: 'Agg-SW-03A (Huawei CloudEngine M-LAG)',
    switchB: 'Agg-SW-03B (Huawei CloudEngine M-LAG)',
    memberLinksCount: 4,
    iclBandwidthGbps: 20,
    defaultTrafficGbps: 18,
    syncMacCount: 2150
  },
  {
    id: 'mclag-trunk-04',
    name: 'MC-LAG 04 Jia Musa Sub-POP Ring (2x10GbE)',
    role: 'POP Access Dual-Homing',
    primaryArea: 'Jia Musa',
    aliasAreas: ['Jia Musa', 'Farrukhabad'],
    bandwidthGbps: 20,
    switchA: 'Dist-SW-04A (Arista 7050 MLAG)',
    switchB: 'Dist-SW-04B (Arista 7050 MLAG)',
    memberLinksCount: 2,
    iclBandwidthGbps: 10,
    defaultTrafficGbps: 9,
    syncMacCount: 1480
  },
  {
    id: 'mclag-trunk-05',
    name: 'MC-LAG 05 Begum Kot Perimeter Trunk (2x10GbE)',
    role: 'Perimeter Ring Feeder',
    primaryArea: 'Begum Kot',
    aliasAreas: ['Begum Kot', 'Sheikhupura Road', 'Kot Begum'],
    bandwidthGbps: 20,
    switchA: 'Dist-SW-05A (Arista 7050 MLAG)',
    switchB: 'Dist-SW-05B (Arista 7050 MLAG)',
    memberLinksCount: 2,
    iclBandwidthGbps: 10,
    defaultTrafficGbps: 8,
    syncMacCount: 1120
  }
];

// In-memory simulation state
let currentSelectedTrunkId = 'mclag-trunk-01';
let currentSelectedRole = 'CLUSTER';
let currentFailureScenario = 'NORMAL';
let currentTrafficLoadGbps = 120;
let currentIccpIntervalMs = 100;

export function getMclagSelectedTrunk() {
  return currentSelectedTrunkId;
}

export function setMclagSelectedTrunk(id) {
  const match = SHAHDARA_MCLAG_TRUNKS.find(t => t.id === id);
  if (match) {
    currentSelectedTrunkId = match.id;
    currentTrafficLoadGbps = match.defaultTrafficGbps;
  }
  return currentSelectedTrunkId;
}

export function getMclagSelectedRole() {
  return currentSelectedRole;
}

export function setMclagSelectedRole(role) {
  if (MCLAG_CONSTANTS.CHASSIS_ROLES[role]) {
    currentSelectedRole = role;
  }
  return currentSelectedRole;
}

export function getMclagFailureScenario() {
  return currentFailureScenario;
}

export function setMclagFailureScenario(scenario) {
  if (MCLAG_CONSTANTS.FAILURE_SCENARIOS[scenario]) {
    currentFailureScenario = scenario;
  }
  return currentFailureScenario;
}

export function getMclagTrafficLoadGbps() {
  return currentTrafficLoadGbps;
}

export function setMclagTrafficLoadGbps(gbps) {
  const num = Number(gbps);
  if (!Number.isNaN(num)) {
    currentTrafficLoadGbps = Math.max(
      MCLAG_CONSTANTS.MIN_TRAFFIC_LOAD_GBPS,
      Math.min(MCLAG_CONSTANTS.MAX_TRAFFIC_LOAD_GBPS, num)
    );
  }
  return currentTrafficLoadGbps;
}

export function getMclagIccpIntervalMs() {
  return currentIccpIntervalMs;
}

export function setMclagIccpIntervalMs(ms) {
  const num = Number(ms);
  if (MCLAG_CONSTANTS.ICCP_INTERVALS_MS.includes(num)) {
    currentIccpIntervalMs = num;
  }
  return currentIccpIntervalMs;
}

export function resetMclagSimState() {
  currentSelectedTrunkId = 'mclag-trunk-01';
  currentSelectedRole = 'CLUSTER';
  currentFailureScenario = 'NORMAL';
  currentTrafficLoadGbps = 120;
  currentIccpIntervalMs = 100;
}

/**
 * Calculates physical link member statuses, traffic forwarding distribution,
 * failover switching latency, and packet loss rate.
 */
export function calculateTrunkForwardingDynamics(trunk, {
  scenario = 'NORMAL',
  trafficLoadGbps = 120,
  iccpIntervalMs = 100
} = {}) {
  const t = trunk || SHAHDARA_MCLAG_TRUNKS[0];
  const halfCount = t.memberLinksCount / 2;
  const load = Math.min(trafficLoadGbps, t.bandwidthGbps * 1.5);

  const memberLinks = [];
  let switchALinksUp = halfCount;
  let switchBLinksUp = halfCount;
  let iclLinkUp = true;
  let failoverTimeMs = 0;
  let packetLossPercent = 0.0;
  let switchATrafficGbps = load / 2;
  let switchBTrafficGbps = load / 2;
  let iclBypassTrafficGbps = 0;
  let operationalState = 'ACTIVE-ACTIVE';
  let statusLevel = MCLAG_CONSTANTS.STATUS.OPTIMAL;

  if (scenario === 'MEMBER_LINK_FAIL') {
    // 1 member link on Switch A is severed
    switchALinksUp = Math.max(0, halfCount - 1);
    operationalState = 'DEGRADED ACTIVE-ACTIVE';
    statusLevel = MCLAG_CONSTANTS.STATUS.WARNING;
    failoverTimeMs = 18; // Local LACP link failover
    packetLossPercent = 0.02; // Transient sub-second frame drop

    // Traffic intended for failed link on A bypasses over ICL to B
    const orphanedTraffic = switchALinksUp === 0 ? load / 2 : (load / 2) / halfCount;
    iclBypassTrafficGbps = Number(orphanedTraffic.toFixed(1));
    switchATrafficGbps = Number((load / 2 - orphanedTraffic).toFixed(1));
    switchBTrafficGbps = Number((load / 2 + orphanedTraffic).toFixed(1));
  } else if (scenario === 'ICL_BREAK') {
    // ICL Peer link severed -> Split-brain prevention
    iclLinkUp = false;
    operationalState = 'SPLIT-BRAIN ISOLATION';
    statusLevel = MCLAG_CONSTANTS.STATUS.CRITICAL;
    failoverTimeMs = iccpIntervalMs * 2; // Keepalive timeout
    packetLossPercent = 0.85;

    // Switch A continues forwarding; Switch B shuts down its downstream MC-LAG ports to prevent loops
    switchBLinksUp = 0;
    switchATrafficGbps = load;
    switchBTrafficGbps = 0;
    iclBypassTrafficGbps = 0;
  } else if (scenario === 'NODE_A_FAIL') {
    // Total failure of chassis A
    switchALinksUp = 0;
    operationalState = 'FAILOVER TO CHASSIS B';
    statusLevel = MCLAG_CONSTANTS.STATUS.CRITICAL;
    failoverTimeMs = 38; // Chassis heartbeat timeout & LACP state machine transition
    packetLossPercent = 0.12;

    switchATrafficGbps = 0;
    switchBTrafficGbps = load;
    iclBypassTrafficGbps = 0;
  }

  // Populate individual member links
  for (let i = 1; i <= halfCount; i++) {
    const isUpA = i <= switchALinksUp;
    memberLinks.push({
      id: `link-a-${i}`,
      portName: `Te1/0/${i}`,
      chassis: 'Switch A',
      chassisName: t.switchA,
      speedGbps: t.bandwidthGbps / t.memberLinksCount,
      lacpState: isUpA ? 'Collecting / Distributing (Sync)' : 'Down / Detached',
      trafficGbps: isUpA ? Number((switchATrafficGbps / switchALinksUp).toFixed(1)) : 0.0,
      hashRatioPercent: isUpA ? Number((100 / (switchALinksUp + switchBLinksUp)).toFixed(1)) : 0.0,
      isUp: isUpA
    });
  }

  for (let j = 1; j <= halfCount; j++) {
    const isUpB = j <= switchBLinksUp;
    memberLinks.push({
      id: `link-b-${j}`,
      portName: `Te2/0/${j}`,
      chassis: 'Switch B',
      chassisName: t.switchB,
      speedGbps: t.bandwidthGbps / t.memberLinksCount,
      lacpState: isUpB ? 'Collecting / Distributing (Sync)' : (scenario === 'ICL_BREAK' ? 'Standby Isolated (Split-Brain Prevention)' : 'Down / Detached'),
      trafficGbps: isUpB ? Number((switchBTrafficGbps / switchBLinksUp).toFixed(1)) : 0.0,
      hashRatioPercent: isUpB ? Number((100 / (switchALinksUp + switchBLinksUp)).toFixed(1)) : 0.0,
      isUp: isUpB
    });
  }

  const activeLinksCount = switchALinksUp + switchBLinksUp;
  const activeBandwidthGbps = activeLinksCount * (t.bandwidthGbps / t.memberLinksCount);
  const utilizationPercent = activeBandwidthGbps > 0 ? Number(((load / activeBandwidthGbps) * 100).toFixed(1)) : 100.0;
  const iclUtilizationPercent = t.iclBandwidthGbps > 0 ? Number(((iclBypassTrafficGbps / t.iclBandwidthGbps) * 100).toFixed(1)) : 0.0;

  return {
    trunk: t,
    scenario,
    operationalState,
    statusLevel,
    switchALinksUp,
    switchBLinksUp,
    activeLinksCount,
    totalLinksCount: t.memberLinksCount,
    iclLinkUp,
    activeBandwidthGbps,
    totalBandwidthGbps: t.bandwidthGbps,
    trafficLoadGbps: load,
    switchATrafficGbps,
    switchBTrafficGbps,
    iclBypassTrafficGbps,
    utilizationPercent,
    iclUtilizationPercent,
    failoverTimeMs,
    packetLossPercent,
    memberLinks
  };
}

/**
 * Calculates comprehensive MC-LAG metrics including Shahdara ISP subscriber
 * and revenue correlation.
 */
export function calculateMclagMetrics(state, options = {}) {
  const selectedTrunkId = options.selectedTrunkId || currentSelectedTrunkId;
  const trunk = SHAHDARA_MCLAG_TRUNKS.find(t => t.id === selectedTrunkId) || SHAHDARA_MCLAG_TRUNKS[0];
  const role = options.role || currentSelectedRole;
  const scenario = options.scenario || currentFailureScenario;
  const trafficLoadGbps = options.trafficLoadGbps !== undefined ? Number(options.trafficLoadGbps) : currentTrafficLoadGbps;
  const iccpIntervalMs = options.iccpIntervalMs !== undefined ? Number(options.iccpIntervalMs) : currentIccpIntervalMs;

  const dynamics = calculateTrunkForwardingDynamics(trunk, {
    scenario,
    trafficLoadGbps,
    iccpIntervalMs
  });

  // Calculate customer impact in the serving area
  const customers = Array.isArray(state?.customers) ? state.customers : [];
  const areaMatches = (c) => {
    if (c.archived) return false;
    const cArea = (c.area || '').trim().toLowerCase();
    if (cArea === trunk.primaryArea.trim().toLowerCase()) return true;
    return trunk.aliasAreas.some(alias => alias.trim().toLowerCase() === cArea);
  };

  let totalAreaSubscribers = 0;
  let activeSubscribers = 0;
  let monthlyBilledRevenue = 0;
  let delinquentSubscribers = 0;

  for (const c of customers) {
    if (areaMatches(c)) {
      totalAreaSubscribers++;
      const isOnline = (c.status || '').trim().toLowerCase() !== 'offline';
      if (isOnline) {
        activeSubscribers++;
      }
      let billVal = 0;
      if (Array.isArray(c.bills) && c.bills.length > 0) {
        const lastBill = c.bills[c.bills.length - 1];
        billVal = Number(lastBill.dueAmount || lastBill.totalAmount || c.packagePrice || 0);
      } else {
        billVal = Number(c.packagePrice || 0);
      }
      monthlyBilledRevenue += billVal;

      if ((c.status || '').trim().toLowerCase() === 'delinquent' || Number(c.balance || 0) > 0) {
        delinquentSubscribers++;
      }
    }
  }

  // MC-LAG provides high resilience:
  // - Normal: 0 revenue at risk
  // - Member link fail: 0 (sub-30ms bypass, 0 outage)
  // - ICL break (Split-brain isolation): 25% throughput constraint on peak hours
  // - Total Node A fail: 10% risk if capacity congested, otherwise resilient
  let revenueRiskMultiplier = 0.0;
  let affectedSubscribers = 0;

  if (scenario === 'ICL_BREAK') {
    revenueRiskMultiplier = 0.25;
    affectedSubscribers = Math.round(activeSubscribers * 0.25);
  } else if (scenario === 'NODE_A_FAIL') {
    if (dynamics.utilizationPercent > 90) {
      revenueRiskMultiplier = 0.30;
      affectedSubscribers = Math.round(activeSubscribers * 0.30);
    } else {
      revenueRiskMultiplier = 0.05;
      affectedSubscribers = Math.round(activeSubscribers * 0.05);
    }
  }

  const monthlyRevenueAtRiskPkr = Math.round(monthlyBilledRevenue * revenueRiskMultiplier);
  const revenueProtectionRate = monthlyBilledRevenue > 0
    ? Number((((monthlyBilledRevenue - monthlyRevenueAtRiskPkr) / monthlyBilledRevenue) * 100).toFixed(1))
    : 100.0;

  const trunksSummary = SHAHDARA_MCLAG_TRUNKS.map(t => {
    const isSelected = t.id === trunk.id;
    const tScenario = isSelected ? scenario : 'NORMAL';
    const dyn = calculateTrunkForwardingDynamics(t, {
      scenario: tScenario,
      trafficLoadGbps: t.defaultTrafficGbps,
      iccpIntervalMs: 100
    });
    return {
      id: t.id,
      name: t.name,
      primaryArea: t.primaryArea,
      bandwidthGbps: t.bandwidthGbps,
      operationalState: dyn.operationalState,
      statusLevel: dyn.statusLevel,
      activeLinksCount: dyn.activeLinksCount,
      totalLinksCount: dyn.totalLinksCount,
      utilizationPercent: dyn.utilizationPercent,
      isSelected
    };
  });

  return {
    selectedTrunk: trunk,
    selectedRole: role,
    selectedScenario: scenario,
    trafficLoadGbps: dynamics.trafficLoadGbps,
    iccpIntervalMs,
    dynamics,
    totalAreaSubscribers,
    activeSubscribers,
    affectedSubscribers,
    monthlyBilledRevenue,
    monthlyRevenueAtRiskPkr,
    revenueProtectionRate,
    delinquentSubscribers,
    trunksSummary
  };
}

/**
 * Pure offline SVG generator for MC-LAG dual-chassis architecture & traffic flow diagram.
 */
export function renderMclagDiagramSvg(metrics, { compact = false } = {}) {
  const m = metrics || calculateMclagMetrics({});
  const dyn = m.dynamics;
  const width = compact ? 560 : 780;
  const height = compact ? 220 : 340;

  const statusColor = dyn.statusLevel === 'Critical' ? '#ef4444' : dyn.statusLevel === 'Warning' ? '#f59e0b' : '#10b981';
  const iclColor = dyn.iclLinkUp ? '#0284c7' : '#ef4444';
  const iclText = dyn.iclLinkUp ? `ICL Peer Trunk (Up: ${dyn.iclBypassTrafficGbps} Gbps)` : 'ICL PEER LINK SEVERED (DOWN)';

  const switchAColor = dyn.switchALinksUp > 0 ? '#10b981' : '#ef4444';
  const switchBColor = dyn.switchBLinksUp > 0 ? '#10b981' : (m.selectedScenario === 'ICL_BREAK' ? '#f59e0b' : '#ef4444');

  if (compact) {
    return `
      <svg class="mclag-svg mclag-compact-svg" viewBox="0 0 560 220" width="100%" style="height: auto; max-width: 100%; display: block;" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="MC-LAG Dual-Chassis Summary Diagram">
        <!-- Chassis A -->
        <rect x="40" y="30" width="180" height="65" rx="6" fill="currentColor" fill-opacity="0.05" stroke="${switchAColor}" stroke-width="2" />
        <text x="50" y="52" font-size="11" font-weight="700" fill="currentColor">CHASSIS A (Master)</text>
        <text x="50" y="70" font-size="10" fill="currentColor" opacity="0.75">${dyn.switchALinksUp}/${dyn.totalLinksCount / 2} Links | ${dyn.switchATrafficGbps} Gbps</text>
        <text x="50" y="85" font-size="9" fill="${switchAColor}" font-weight="600">${dyn.switchALinksUp > 0 ? 'ACTIVE FORWARDING' : 'CHASSIS DOWN'}</text>

        <!-- Chassis B -->
        <rect x="340" y="30" width="180" height="65" rx="6" fill="currentColor" fill-opacity="0.05" stroke="${switchBColor}" stroke-width="2" />
        <text x="350" y="52" font-size="11" font-weight="700" fill="currentColor">CHASSIS B (Peer)</text>
        <text x="350" y="70" font-size="10" fill="currentColor" opacity="0.75">${dyn.switchBLinksUp}/${dyn.totalLinksCount / 2} Links | ${dyn.switchBTrafficGbps} Gbps</text>
        <text x="350" y="85" font-size="9" fill="${switchBColor}" font-weight="600">${dyn.switchBLinksUp > 0 ? 'ACTIVE FORWARDING' : (m.selectedScenario === 'ICL_BREAK' ? 'STANDBY ISOLATED' : 'DOWN')}</text>

        <!-- ICL Peer Link -->
        <line x1="220" y1="62" x2="340" y2="62" stroke="${iclColor}" stroke-width="3" stroke-dasharray="${dyn.iclLinkUp ? 'none' : '4,4'}" />
        <text x="280" y="55" font-size="9" font-weight="600" fill="${iclColor}" text-anchor="middle">ICL (ICCP Sync)</text>

        <!-- Downstream Aggregator / OLT -->
        <rect x="180" y="145" width="200" height="50" rx="6" fill="currentColor" fill-opacity="0.08" stroke="currentColor" stroke-opacity="0.3" />
        <text x="280" y="168" font-size="11" font-weight="700" fill="currentColor" text-anchor="middle">DOWNSTREAM ACCESS OLT / POP</text>
        <text x="280" y="184" font-size="10" fill="currentColor" opacity="0.75" text-anchor="middle">Total Load: ${dyn.trafficLoadGbps} Gbps (Prot: ${m.revenueProtectionRate}%)</text>

        <!-- Dual homed links -->
        <line x1="130" y1="95" x2="230" y2="145" stroke="${switchAColor}" stroke-width="2" stroke-dasharray="${dyn.switchALinksUp > 0 ? 'none' : '3,3'}" />
        <line x1="430" y1="95" x2="330" y2="145" stroke="${switchBColor}" stroke-width="2" stroke-dasharray="${dyn.switchBLinksUp > 0 ? 'none' : '3,3'}" />

        <!-- Top right status badge -->
        <rect x="420" y="8" width="130" height="18" rx="4" fill="${statusColor}" fill-opacity="0.18" stroke="${statusColor}" />
        <text x="485" y="21" font-size="9" font-weight="700" fill="${statusColor}" text-anchor="middle">${dyn.operationalState}</text>
      </svg>
    `.trim();
  }

  return `
    <svg class="mclag-svg mclag-modal-svg" viewBox="0 0 780 340" width="100%" style="height: auto; max-width: 100%; display: block;" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="MC-LAG Dual-Chassis Architecture & Forwarding Topology Diagram">
      <defs>
        <linearGradient id="mclagChassisGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0284c7" stop-opacity="0.15"/>
          <stop offset="100%" stop-color="#0284c7" stop-opacity="0.02"/>
        </linearGradient>
      </defs>

      <!-- Outer Boundary / Virtual Chassis -->
      <rect x="20" y="15" width="740" height="155" rx="10" fill="none" stroke="currentColor" stroke-opacity="0.18" stroke-dasharray="6,4" />
      <text x="35" y="35" font-size="11" font-weight="700" fill="currentColor" opacity="0.6">VIRTUAL CHASSIS DOMAIN · RFC 7275 ICCP &amp; IEEE 802.1AX</text>

      <!-- Status Badge -->
      <g transform="translate(580, 22)">
        <rect x="0" y="0" width="165" height="22" rx="4" fill="${statusColor}" fill-opacity="0.18" stroke="${statusColor}" />
        <text x="82" y="15" font-size="10" font-weight="700" fill="${statusColor}" text-anchor="middle">${dyn.operationalState}</text>
      </g>

      <!-- Chassis A (Left) -->
      <g transform="translate(50, 48)">
        <rect x="0" y="0" width="240" height="105" rx="8" fill="url(#mclagChassisGrad)" stroke="${switchAColor}" stroke-width="2" />
        <text x="14" y="24" font-size="13" font-weight="800" fill="currentColor">${m.selectedTrunk.switchA.split('(')[0]}</text>
        <text x="14" y="42" font-size="10" fill="currentColor" opacity="0.75">Role: Primary Master Node A</text>
        <text x="14" y="60" font-size="10" fill="currentColor" opacity="0.75">Active Uplinks: ${dyn.switchALinksUp} of ${dyn.totalLinksCount / 2} Members</text>
        <text x="14" y="78" font-size="11" font-weight="700" fill="${switchAColor}">Throughput: ${dyn.switchATrafficGbps} Gbps</text>
        <rect x="14" y="86" width="140" height="12" rx="3" fill="currentColor" fill-opacity="0.08" />
        <rect x="14" y="86" width="${Math.min(140, Math.round(140 * (dyn.switchATrafficGbps / (m.selectedTrunk.bandwidthGbps / 2))))}" height="12" rx="3" fill="${switchAColor}" />
      </g>

      <!-- Chassis B (Right) -->
      <g transform="translate(490, 48)">
        <rect x="0" y="0" width="240" height="105" rx="8" fill="url(#mclagChassisGrad)" stroke="${switchBColor}" stroke-width="2" />
        <text x="14" y="24" font-size="13" font-weight="800" fill="currentColor">${m.selectedTrunk.switchB.split('(')[0]}</text>
        <text x="14" y="42" font-size="10" fill="currentColor" opacity="0.75">Role: Secondary Peer Node B</text>
        <text x="14" y="60" font-size="10" fill="currentColor" opacity="0.75">Active Uplinks: ${dyn.switchBLinksUp} of ${dyn.totalLinksCount / 2} Members</text>
        <text x="14" y="78" font-size="11" font-weight="700" fill="${switchBColor}">Throughput: ${dyn.switchBTrafficGbps} Gbps</text>
        <rect x="14" y="86" width="140" height="12" rx="3" fill="currentColor" fill-opacity="0.08" />
        <rect x="14" y="86" width="${Math.min(140, Math.round(140 * (dyn.switchBTrafficGbps / (m.selectedTrunk.bandwidthGbps / 2))))}" height="12" rx="3" fill="${switchBColor}" />
      </g>

      <!-- ICL Inter-Chassis Link (Center Trunk) -->
      <line x1="290" y1="100" x2="490" y2="100" stroke="${iclColor}" stroke-width="4" stroke-dasharray="${dyn.iclLinkUp ? 'none' : '6,6'}" />
      <g transform="translate(330, 75)">
        <rect x="0" y="0" width="120" height="42" rx="6" fill="currentColor" fill-opacity="0.08" stroke="${iclColor}" stroke-opacity="0.4" />
        <text x="60" y="16" font-size="9" font-weight="700" fill="${iclColor}" text-anchor="middle">ICL PEER TRUNK</text>
        <text x="60" y="28" font-size="8" fill="currentColor" opacity="0.8" text-anchor="middle">TCP Port 8888 (ICCP)</text>
        <text x="60" y="38" font-size="8" font-weight="600" fill="${iclColor}" text-anchor="middle">Bypass: ${dyn.iclBypassTrafficGbps} Gbps</text>
      </g>

      <!-- Downstream Distribution & Customer Aggregation -->
      <g transform="translate(240, 230)">
        <rect x="0" y="0" width="300" height="85" rx="8" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-opacity="0.25" />
        <text x="150" y="26" font-size="13" font-weight="800" fill="currentColor" text-anchor="middle">DOWNSTREAM DUAL-HOMED AGGREGATION</text>
        <text x="150" y="44" font-size="10" fill="currentColor" opacity="0.8" text-anchor="middle">Serving Area: ${m.selectedTrunk.primaryArea} (${m.activeSubscribers} Active Subscribers)</text>
        <text x="150" y="62" font-size="11" font-weight="700" fill="#0284c7" text-anchor="middle">Total Ingress Load: ${dyn.trafficLoadGbps} Gbps | Capacity: ${dyn.activeBandwidthGbps} Gbps</text>
        <text x="150" y="78" font-size="9" fill="currentColor" opacity="0.75" text-anchor="middle">Failover Latency: ${dyn.failoverTimeMs} ms | Packet Loss: ${dyn.packetLossPercent}%</text>
      </g>

      <!-- Multi-Chassis LAG Uplinks -->
      <!-- Left Leg (Switch A -> Downstream) -->
      <path d="M 170 153 L 260 230" fill="none" stroke="${switchAColor}" stroke-width="3" stroke-dasharray="${dyn.switchALinksUp > 0 ? 'none' : '4,4'}" />
      <circle cx="215" cy="191" r="10" fill="${switchAColor}" fill-opacity="0.2" stroke="${switchAColor}" />
      <text x="215" y="195" font-size="9" font-weight="700" fill="${switchAColor}" text-anchor="middle">LAG-A</text>

      <!-- Right Leg (Switch B -> Downstream) -->
      <path d="M 610 153 L 520 230" fill="none" stroke="${switchBColor}" stroke-width="3" stroke-dasharray="${dyn.switchBLinksUp > 0 ? 'none' : '4,4'}" />
      <circle cx="565" cy="191" r="10" fill="${switchBColor}" fill-opacity="0.2" stroke="${switchBColor}" />
      <text x="565" y="195" font-size="9" font-weight="700" fill="${switchBColor}" text-anchor="middle">LAG-B</text>

      <!-- Revenue Protection Pill Bottom Right -->
      <g transform="translate(560, 275)">
        <rect x="0" y="0" width="190" height="40" rx="6" fill="#10b981" fill-opacity="0.12" stroke="#10b981" stroke-opacity="0.4" />
        <text x="12" y="18" font-size="9" font-weight="700" fill="#10b981">REVENUE PROTECTION</text>
        <text x="12" y="32" font-size="11" font-weight="800" fill="currentColor">${m.revenueProtectionRate}% (${formatPKR(m.monthlyBilledRevenue - m.monthlyRevenueAtRiskPkr)})</text>
      </g>
    </svg>
  `.trim();
}

/**
 * Generates engineering audit and failover diagnostic briefing report.
 */
export function generateMclagReport(metrics) {
  const m = metrics || calculateMclagMetrics({});
  const dyn = m.dynamics;
  const lines = [];

  lines.push('================================================================');
  lines.push('SHAHDARA ISP · MC-LAG DUAL-CHASSIS REDUNDANCY AUDIT BRIEFING');
  lines.push('RFC 7275 ICCP / IEEE 802.1AX ACTIVE-ACTIVE CLUSTER TELEMETRY');
  lines.push('================================================================');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Monitored Trunk: ${m.selectedTrunk.name}`);
  lines.push(`Primary Chassis A: ${m.selectedTrunk.switchA}`);
  lines.push(`Secondary Chassis B: ${m.selectedTrunk.switchB}`);
  lines.push(`Serving Feeder Area: ${m.selectedTrunk.primaryArea}`);
  lines.push(`Nominal Capacity: ${m.selectedTrunk.bandwidthGbps} Gbps (${m.selectedTrunk.memberLinksCount} Member Links)`);
  lines.push(`ICL Peer Capacity: ${m.selectedTrunk.iclBandwidthGbps} Gbps`);
  lines.push(`ICCP Heartbeat Interval: ${m.iccpIntervalMs} ms`);
  lines.push('');
  lines.push('----------------------------------------------------------------');
  lines.push('FORWARDING DYNAMICS & FAILOVER STATUS');
  lines.push('----------------------------------------------------------------');
  lines.push(`Operational State: ${dyn.operationalState}`);
  lines.push(`Simulation Condition: ${m.selectedScenario}`);
  lines.push(`Cluster Health Severity: ${dyn.statusLevel.toUpperCase()}`);
  lines.push(`Active Forwarding Links: ${dyn.activeLinksCount} of ${dyn.totalLinksCount}`);
  lines.push(`Chassis A Active Links: ${dyn.switchALinksUp} (${dyn.switchATrafficGbps} Gbps)`);
  lines.push(`Chassis B Active Links: ${dyn.switchBLinksUp} (${dyn.switchBTrafficGbps} Gbps)`);
  lines.push(`ICL Inter-Chassis Bypass: ${dyn.iclBypassTrafficGbps} Gbps (Link: ${dyn.iclLinkUp ? 'UP' : 'SEVERED'})`);
  lines.push(`Ingress Traffic Load: ${dyn.trafficLoadGbps} Gbps`);
  lines.push(`Trunk Utilization: ${dyn.utilizationPercent}%`);
  lines.push(`Failover Switching Latency: ${dyn.failoverTimeMs} ms`);
  lines.push(`Estimated Frame Drop: ${dyn.packetLossPercent}%`);
  lines.push(`Synchronized MAC Table Entries: ${m.selectedTrunk.syncMacCount}`);
  lines.push('');
  lines.push('----------------------------------------------------------------');
  lines.push('MEMBER INTERFACE STATUS & LACP STATE MACHINE');
  lines.push('----------------------------------------------------------------');
  lines.push('Port      | Chassis   | Speed  | LACP Partner State             | Traffic | Status');
  lines.push('----------------------------------------------------------------');
  for (const l of dyn.memberLinks) {
    const port = l.portName.padEnd(9);
    const ch = l.chassis.padEnd(9);
    const sp = `${l.speedGbps}G`.padEnd(6);
    const lacp = l.lacpState.padEnd(32);
    const tr = `${l.trafficGbps}G`.padEnd(7);
    const st = l.isUp ? 'UP' : 'DOWN';
    lines.push(`${port} | ${ch} | ${sp} | ${lacp} | ${tr} | ${st}`);
  }
  lines.push('');
  lines.push('----------------------------------------------------------------');
  lines.push('SHAHDARA SUBSCRIBER REVENUE AT RISK');
  lines.push('----------------------------------------------------------------');
  lines.push(`Serving Feeder Area: ${m.selectedTrunk.primaryArea}`);
  lines.push(`Total Area Subscribers: ${m.totalAreaSubscribers}`);
  lines.push(`Active Online Subscribers: ${m.activeSubscribers}`);
  lines.push(`Affected Subscribers: ${m.affectedSubscribers}`);
  lines.push(`Monthly Area Revenue: ${formatPKR(m.monthlyBilledRevenue)}`);
  lines.push(`Monthly Revenue at Risk: ${formatPKR(m.monthlyRevenueAtRiskPkr)}`);
  lines.push(`Revenue Protection Rate: ${m.revenueProtectionRate}%`);
  lines.push('================================================================');
  lines.push('NETWORK OPERATION RECOMMENDATION:');
  if (m.selectedScenario === 'ICL_BREAK') {
    lines.push('[CRITICAL] Inspect ICL physical fiber patch between Switch A and Switch B.');
    lines.push('Split-brain isolation active: ensure standby node keepalive connection stays live.');
  } else if (m.selectedScenario === 'MEMBER_LINK_FAIL') {
    lines.push('[WARNING] Clean or replace transceiver on severed Switch A link.');
    lines.push('Traffic is successfully bypassing via ICL with zero subscriber service disruption.');
  } else if (m.selectedScenario === 'NODE_A_FAIL') {
    lines.push('[HIGH PRIORITY] Check power supply / supervisor engine on Switch A.');
    lines.push('Switch B is handling 100% aggregation load without cluster collapse.');
  } else {
    lines.push('MC-LAG dual-chassis cluster operating in optimal active-active dual-homed mode.');
    lines.push('Both Switch A and Switch B forwarding traffic symmetrically.');
  }
  lines.push('================================================================');

  return lines.join('\n');
}

/**
 * Wires DOM event listeners, modal controls, and table updates.
 */
export function setupMclagModal(state, {
  referenceDate = new Date(),
  onFilterArea,
  onFilterCustomer,
  onToast,
  clipboard
} = {}) {
  const modal = document.getElementById('dashboardMclagModal');
  const openBtn = document.getElementById('dashboardOpenMclagModalBtn');
  const closeBtn = document.getElementById('dashboardMclagModalCloseBtn');

  const trunkSelect = document.getElementById('mclagTrunkSelect');
  const scenarioSelect = document.getElementById('mclagScenarioSelect');
  const roleSelect = document.getElementById('mclagRoleSelect');
  const loadSlider = document.getElementById('mclagLoadSlider');
  const loadValPill = document.getElementById('mclagLoadVal');
  const iccpSelect = document.getElementById('mclagIccpSelect');
  const resetBtn = document.getElementById('mclagResetBtn');

  const kpiTrunkName = document.getElementById('mclagKpiTrunkName');
  const kpiState = document.getElementById('mclagKpiState');
  const kpiFailover = document.getElementById('mclagKpiFailover');
  const statusBadge = document.getElementById('mclagStatusBadge');
  const kpiRevenueRisk = document.getElementById('mclagKpiRevenueRisk');

  const modalChartWrap = document.getElementById('mclagModalChartWrap');
  const tableBody = document.getElementById('mclagLinksTableBody');
  const filterAreaBtn = document.getElementById('mclagFilterAreaBtn');
  const copyReportBtn = document.getElementById('dashboardCopyMclagReportBtn');

  function populateSelectOptions() {
    if (trunkSelect && trunkSelect.options.length === 0) {
      trunkSelect.innerHTML = SHAHDARA_MCLAG_TRUNKS.map(t =>
        `<option value="${t.id}" ${t.id === currentSelectedTrunkId ? 'selected' : ''}>${t.name}</option>`
      ).join('');
    }
    if (scenarioSelect && scenarioSelect.options.length === 0) {
      scenarioSelect.innerHTML = Object.entries(MCLAG_CONSTANTS.FAILURE_SCENARIOS).map(([k, v]) =>
        `<option value="${k}" ${k === currentFailureScenario ? 'selected' : ''}>${v}</option>`
      ).join('');
    }
    if (roleSelect && roleSelect.options.length === 0) {
      roleSelect.innerHTML = Object.entries(MCLAG_CONSTANTS.CHASSIS_ROLES).map(([k, v]) =>
        `<option value="${k}" ${k === currentSelectedRole ? 'selected' : ''}>${v}</option>`
      ).join('');
    }
    if (iccpSelect && iccpSelect.options.length === 0) {
      iccpSelect.innerHTML = MCLAG_CONSTANTS.ICCP_INTERVALS_MS.map(ms =>
        `<option value="${ms}" ${ms === currentIccpIntervalMs ? 'selected' : ''}>${ms} ms ${ms === 50 ? '(BFD Fast Detect)' : ms === 100 ? '(Recommended Carrier Default)' : ''}</option>`
      ).join('');
    }
  }

  function refreshModalView() {
    const metrics = calculateMclagMetrics(state, {
      selectedTrunkId: currentSelectedTrunkId,
      role: currentSelectedRole,
      scenario: currentFailureScenario,
      trafficLoadGbps: currentTrafficLoadGbps,
      iccpIntervalMs: currentIccpIntervalMs
    });
    const dyn = metrics.dynamics;

    if (kpiTrunkName) {
      kpiTrunkName.textContent = metrics.selectedTrunk.name.split('(')[0];
    }
    if (kpiState) {
      kpiState.textContent = dyn.operationalState;
      kpiState.style.color = dyn.statusLevel === 'Critical' ? '#ef4444' : dyn.statusLevel === 'Warning' ? '#f59e0b' : '#10b981';
    }
    if (kpiFailover) {
      kpiFailover.textContent = `${dyn.failoverTimeMs} ms`;
    }
    if (statusBadge) {
      statusBadge.textContent = dyn.statusLevel.toUpperCase();
      statusBadge.className = `sim-delta-badge badge-${dyn.statusLevel === 'Critical' ? 'danger' : dyn.statusLevel === 'Warning' ? 'warning' : 'success'}`;
    }
    if (kpiRevenueRisk) {
      kpiRevenueRisk.textContent = `${formatPKR(metrics.monthlyRevenueAtRiskPkr)} at risk (${metrics.affectedSubscribers} subs)`;
    }

    if (modalChartWrap) {
      modalChartWrap.innerHTML = renderMclagDiagramSvg(metrics, { compact: false });
    }

    if (tableBody) {
      tableBody.innerHTML = dyn.memberLinks.map(l => {
        const severityClass = l.isUp ? 'badge-success' : 'badge-danger';
        return `
          <tr>
            <td><strong>${l.portName}</strong></td>
            <td>${l.chassis}</td>
            <td>${l.speedGbps} Gbps</td>
            <td><small>${l.lacpState}</small></td>
            <td><strong>${l.trafficGbps} Gbps</strong> (${l.hashRatioPercent}%)</td>
            <td><span class="sim-delta-badge ${severityClass}">${l.isUp ? 'ACTIVE' : 'DOWN'}</span></td>
          </tr>
        `;
      }).join('');
    }

    // Card chart
    const cardChartEl = document.getElementById('dashboardMclagChart');
    if (cardChartEl) {
      cardChartEl.innerHTML = renderMclagDiagramSvg(metrics, { compact: true });
    }
  }

  populateSelectOptions();

  if (trunkSelect) {
    trunkSelect.addEventListener('change', (e) => {
      setMclagSelectedTrunk(e.target.value);
      if (loadSlider) {
        loadSlider.value = String(currentTrafficLoadGbps);
      }
      if (loadValPill) {
        loadValPill.textContent = `${currentTrafficLoadGbps} Gbps`;
      }
      refreshModalView();
    });
  }

  if (scenarioSelect) {
    scenarioSelect.addEventListener('change', (e) => {
      setMclagFailureScenario(e.target.value);
      refreshModalView();
    });
  }

  if (roleSelect) {
    roleSelect.addEventListener('change', (e) => {
      setMclagSelectedRole(e.target.value);
      refreshModalView();
    });
  }

  if (loadSlider) {
    loadSlider.addEventListener('input', (e) => {
      setMclagTrafficLoadGbps(e.target.value);
      if (loadValPill) {
        loadValPill.textContent = `${currentTrafficLoadGbps} Gbps`;
      }
      refreshModalView();
    });
  }

  if (iccpSelect) {
    iccpSelect.addEventListener('change', (e) => {
      setMclagIccpIntervalMs(e.target.value);
      refreshModalView();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      resetMclagSimState();
      if (trunkSelect) trunkSelect.value = currentSelectedTrunkId;
      if (scenarioSelect) scenarioSelect.value = currentFailureScenario;
      if (roleSelect) roleSelect.value = currentSelectedRole;
      if (loadSlider) loadSlider.value = String(currentTrafficLoadGbps);
      if (loadValPill) loadValPill.textContent = `${currentTrafficLoadGbps} Gbps`;
      if (iccpSelect) iccpSelect.value = String(currentIccpIntervalMs);
      refreshModalView();
      if (typeof onToast === 'function') onToast('MC-LAG simulation reset to dual-active baseline.');
    });
  }

  if (filterAreaBtn) {
    filterAreaBtn.addEventListener('click', () => {
      const metrics = calculateMclagMetrics(state, { selectedTrunkId: currentSelectedTrunkId });
      if (metrics.selectedTrunk && typeof onFilterArea === 'function') {
        if (modal) {
          if (modal.close) modal.close();
          else modal.removeAttribute('open');
        }
        onFilterArea(metrics.selectedTrunk.primaryArea);
      }
    });
  }

  if (copyReportBtn) {
    copyReportBtn.addEventListener('click', async () => {
      const metrics = calculateMclagMetrics(state, {
        selectedTrunkId: currentSelectedTrunkId,
        role: currentSelectedRole,
        scenario: currentFailureScenario,
        trafficLoadGbps: currentTrafficLoadGbps,
        iccpIntervalMs: currentIccpIntervalMs
      });
      const report = generateMclagReport(metrics);
      let copied = false;
      const clip = clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
      if (clip && typeof clip.writeText === 'function') {
        try {
          await clip.writeText(report);
          copied = true;
        } catch {
          copied = false;
        }
      }
      if (typeof onToast === 'function') {
        onToast(copied ? 'MC-LAG engineering briefing copied to clipboard!' : 'Report generated.');
      }
    });
  }

  if (openBtn && modal) {
    openBtn.addEventListener('click', () => {
      refreshModalView();
      if (modal.showModal) modal.showModal();
      else modal.setAttribute('open', '');
    });
  }

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => {
      if (modal.close) modal.close();
      else modal.removeAttribute('open');
    });
  }

  // Initial render if card chart is present
  const cardChartEl = document.getElementById('dashboardMclagChart');
  if (cardChartEl) {
    const metrics = calculateMclagMetrics(state, { referenceDate });
    cardChartEl.innerHTML = renderMclagDiagramSvg(metrics, { compact: true });
  }
}
