import { formatPKR } from './core.js';

/**
 * Core IP Multi-Protocol BGP (MP-BGP) EVPN / VXLAN Network Virtualization Overlay
 * & Anycast Distributed Gateway Matrix (RFC 7432 / RFC 8365 / RFC 9135)
 *
 * Models carrier leaf-spine underlay and VXLAN overlay virtualization across Shahdara ISP:
 * - EVPN Route Types:
 *   - Type 2 (MAC/IP Advertisement) with dynamic ARP suppression
 *   - Type 3 (Inclusive Multicast Ethernet Tag - IMET for BUM flooding)
 *   - Type 5 (IP Prefix Route for inter-VRF tenant routing)
 * - Distributed Anycast Gateway (IRB - Integrated Routing and Bridging) with L3 VNI
 * - Encapsulation overhead & underlay MTU validation (Inner Frame + 50B VXLAN/UDP/IP)
 * - Ingress Head-End Replication (HER) vs Underlay PIM Multicast
 * - Correlates overlay health with Shahdara subscriber revenue and SLA commitments
 */

export const EVPN_CONSTANTS = {
  DEFAULT_OVERLAY_ID: 'evpn-vni-10010',
  DEFAULT_IRB_MODE: 'SYMMETRIC_IRB',
  DEFAULT_REPLICATION: 'HER',
  DEFAULT_ARP_SUPPRESSION: true,
  DEFAULT_TRAFFIC_SURGE_PCT: 0,
  DEFAULT_UNDERLAY_MTU: 9100,

  STANDARD_PAYLOAD_MTU: 1500,
  ENCAPSULATION_OVERHEAD_BYTES: 50, // 14B Eth + 20B IPv4 + 8B UDP (4789) + 8B VXLAN
  MIN_REQUIRED_UNDERLAY_MTU: 1550, // 1500 + 50
  RECOMMENDED_JUMBO_MTU: 9216,

  ARP_SUPPRESSION_EFFICIENCY_PCT: 88, // 88% of ARP broadcasts answered locally by VTEP cache

  IRB_MODES: {
    SYMMETRIC_IRB: 'Symmetric IRB (Distributed Anycast Gateway with L3 VNI - RFC 9135)',
    ASYMMETRIC_IRB: 'Asymmetric IRB (Bridging-Routing-Bridging Hairpinning)'
  },

  REPLICATION_MODES: {
    HER: 'Ingress Head-End Replication (Unicast Overlay P2MP)',
    PIM_SM: 'Underlay Multicast Core Tree (ASM/SSM)'
  },

  ROUTE_TYPES: {
    TYPE_1: 'Type 1: Ethernet Auto-Discovery (A-D)',
    TYPE_2: 'Type 2: MAC/IP Host Advertisement',
    TYPE_3: 'Type 3: Inclusive Multicast (IMET BUM)',
    TYPE_4: 'Type 4: Ethernet Segment (Multi-Homing)',
    TYPE_5: 'Type 5: IP Prefix Route (Inter-VRF)'
  },

  STATUS: {
    OPTIMAL: 'Optimal',
    WARNING: 'Warning',
    CRITICAL: 'Critical'
  }
};

export const SHAHDARA_EVPN_VNIS = [
  {
    id: 'evpn-vni-10010',
    name: 'VNI 10010: Shahdara Town Residential Broadband (PPPoE / IPoE Subnets)',
    vni: 10010,
    l3Vni: 50010,
    vrf: 'VRF-RESIDENTIAL-BROADBAND',
    primaryArea: 'Shahdara Town',
    aliasAreas: ['Shahdara Town', 'Old Town', 'Main Bazaar', 'Station Road'],
    subnet: '10.140.10.0/24',
    anycastVirtualIp: '10.140.10.1',
    anycastVirtualMac: '00:00:5e:00:01:01',
    totalMacsLearned: 480,
    activeHosts: 412,
    arpRequestsSec: 640,
    bumTrafficMbps: 18.5,
    unicastThroughputGbps: 8.4,
    vtepLeaves: ['LEAF-01-BARADARI', 'LEAF-02-TOWN', 'LEAF-03-GTROAD', 'LEAF-04-VANDALA'],
    baseLatencyMs: 0.85,
    underlayMtu: 9100
  },
  {
    id: 'evpn-vni-10020',
    name: 'VNI 10020: Kot Abdul Malik Enterprise DIA & Corporate Leased Lines',
    vni: 10020,
    l3Vni: 50020,
    vrf: 'VRF-CORP-DIA',
    primaryArea: 'Kot Abdul Malik',
    aliasAreas: ['Kot Abdul Malik', 'Industrial Estate', 'Millat Colony'],
    subnet: '10.140.20.0/24',
    anycastVirtualIp: '10.140.20.1',
    anycastVirtualMac: '00:00:5e:00:01:02',
    totalMacsLearned: 195,
    activeHosts: 178,
    arpRequestsSec: 210,
    bumTrafficMbps: 6.2,
    unicastThroughputGbps: 14.8,
    vtepLeaves: ['LEAF-01-BARADARI', 'LEAF-02-TOWN', 'LEAF-04-VANDALA'],
    baseLatencyMs: 0.65,
    underlayMtu: 9100
  },
  {
    id: 'evpn-vni-10030',
    name: 'VNI 10030: Vandala Road High-Density GPON Backhaul & OLT Aggregation',
    vni: 10030,
    l3Vni: 50030,
    vrf: 'VRF-OLT-BACKHAUL',
    primaryArea: 'Vandala Road',
    aliasAreas: ['Vandala Road', 'Wandala Road', 'Zia Town'],
    subnet: '10.140.30.0/24',
    anycastVirtualIp: '10.140.30.1',
    anycastVirtualMac: '00:00:5e:00:01:03',
    totalMacsLearned: 620,
    activeHosts: 540,
    arpRequestsSec: 890,
    bumTrafficMbps: 26.4,
    unicastThroughputGbps: 18.2,
    vtepLeaves: ['LEAF-01-BARADARI', 'LEAF-03-GTROAD', 'LEAF-04-VANDALA'],
    baseLatencyMs: 0.92,
    underlayMtu: 9100
  },
  {
    id: 'evpn-vni-10040',
    name: 'VNI 10040: Ravi Siphon Metro Core Transit Interconnect & BGP Upstream',
    vni: 10040,
    l3Vni: 50040,
    vrf: 'VRF-METRO-TRANSIT',
    primaryArea: 'Ravi Siphon',
    aliasAreas: ['Ravi Siphon', 'Siphon Road', 'Shahdara Town'],
    subnet: '10.140.40.0/24',
    anycastVirtualIp: '10.140.40.1',
    anycastVirtualMac: '00:00:5e:00:01:04',
    totalMacsLearned: 110,
    activeHosts: 95,
    arpRequestsSec: 120,
    bumTrafficMbps: 4.1,
    unicastThroughputGbps: 32.5,
    vtepLeaves: ['LEAF-01-BARADARI', 'LEAF-02-TOWN', 'LEAF-03-GTROAD', 'LEAF-04-VANDALA'],
    baseLatencyMs: 0.52,
    underlayMtu: 9100
  },
  {
    id: 'evpn-vni-10050',
    name: 'VNI 10050: Baradari Heritage Zone & Smart City IoT Sensor Grid',
    vni: 10050,
    l3Vni: 50050,
    vrf: 'VRF-IOT-SENSORS',
    primaryArea: 'Baradari Road',
    aliasAreas: ['Baradari Road', 'Baradari', 'Tariq Road'],
    subnet: '10.140.50.0/24',
    anycastVirtualIp: '10.140.50.1',
    anycastVirtualMac: '00:00:5e:00:01:05',
    totalMacsLearned: 340,
    activeHosts: 290,
    arpRequestsSec: 450,
    bumTrafficMbps: 11.8,
    unicastThroughputGbps: 4.2,
    vtepLeaves: ['LEAF-01-BARADARI', 'LEAF-02-TOWN'],
    baseLatencyMs: 0.78,
    underlayMtu: 9100
  }
];

// Module-level interactive simulation state
let selectedVniId = EVPN_CONSTANTS.DEFAULT_OVERLAY_ID;
let selectedIrbMode = EVPN_CONSTANTS.DEFAULT_IRB_MODE;
let selectedReplication = EVPN_CONSTANTS.DEFAULT_REPLICATION;
let arpSuppressionEnabled = EVPN_CONSTANTS.DEFAULT_ARP_SUPPRESSION;
let injectedTrafficSurgePct = EVPN_CONSTANTS.DEFAULT_TRAFFIC_SURGE_PCT;
let underlayMtuSetting = EVPN_CONSTANTS.DEFAULT_UNDERLAY_MTU;

export function getEvpnSelectedVni() {
  return selectedVniId;
}

export function setEvpnSelectedVni(id) {
  if (SHAHDARA_EVPN_VNIS.some(v => v.id === id)) {
    selectedVniId = id;
  }
}

export function getEvpnSelectedIrbMode() {
  return selectedIrbMode;
}

export function setEvpnSelectedIrbMode(mode) {
  if (Object.keys(EVPN_CONSTANTS.IRB_MODES).includes(mode)) {
    selectedIrbMode = mode;
  }
}

export function getEvpnSelectedReplication() {
  return selectedReplication;
}

export function setEvpnSelectedReplication(rep) {
  if (Object.keys(EVPN_CONSTANTS.REPLICATION_MODES).includes(rep)) {
    selectedReplication = rep;
  }
}

export function getEvpnArpSuppression() {
  return arpSuppressionEnabled;
}

export function setEvpnArpSuppression(enabled) {
  arpSuppressionEnabled = Boolean(enabled);
}

export function getEvpnTrafficSurgePct() {
  return injectedTrafficSurgePct;
}

export function setEvpnTrafficSurgePct(pct) {
  const p = Number(pct);
  if (!isNaN(p) && p >= 0 && p <= 200) {
    injectedTrafficSurgePct = p;
  }
}

export function getEvpnUnderlayMtu() {
  return underlayMtuSetting;
}

export function setEvpnUnderlayMtu(mtu) {
  const m = Number(mtu);
  if (!isNaN(m) && m >= 1400 && m <= 9216) {
    underlayMtuSetting = m;
  }
}

export function resetEvpnSimState() {
  selectedVniId = EVPN_CONSTANTS.DEFAULT_OVERLAY_ID;
  selectedIrbMode = EVPN_CONSTANTS.DEFAULT_IRB_MODE;
  selectedReplication = EVPN_CONSTANTS.DEFAULT_REPLICATION;
  arpSuppressionEnabled = EVPN_CONSTANTS.DEFAULT_ARP_SUPPRESSION;
  injectedTrafficSurgePct = EVPN_CONSTANTS.DEFAULT_TRAFFIC_SURGE_PCT;
  underlayMtuSetting = EVPN_CONSTANTS.DEFAULT_UNDERLAY_MTU;
}

/**
 * Calculates core EVPN/VXLAN dynamics and forwarding parameters
 */
export function calculateEvpnDynamics(vniData, irbMode, replicationMode, arpSuppression, trafficSurgePct, customUnderlayMtu) {
  const vni = vniData || SHAHDARA_EVPN_VNIS[0];
  const irb = irbMode || EVPN_CONSTANTS.DEFAULT_IRB_MODE;
  const rep = replicationMode || EVPN_CONSTANTS.DEFAULT_REPLICATION;
  const suppression = arpSuppression !== undefined ? Boolean(arpSuppression) : EVPN_CONSTANTS.DEFAULT_ARP_SUPPRESSION;
  const surge = Number(trafficSurgePct || 0);
  const mtu = Number(customUnderlayMtu || EVPN_CONSTANTS.DEFAULT_UNDERLAY_MTU);

  const surgeMultiplier = 1 + (surge / 100);
  const vtepCount = vni.vtepLeaves.length;
  const peerVtepCount = Math.max(1, vtepCount - 1);

  // 1. MTU & Encapsulation Headroom
  const requiredMtu = EVPN_CONSTANTS.STANDARD_PAYLOAD_MTU + EVPN_CONSTANTS.ENCAPSULATION_OVERHEAD_BYTES; // 1550B
  const mtuHeadroom = mtu - requiredMtu;
  let mtuStatus = EVPN_CONSTANTS.STATUS.OPTIMAL;
  let fragmentationRisk = false;

  if (mtu < requiredMtu) {
    mtuStatus = EVPN_CONSTANTS.STATUS.CRITICAL;
    fragmentationRisk = true;
  } else if (mtu < 1600) {
    mtuStatus = EVPN_CONSTANTS.STATUS.WARNING;
  }

  // 2. BUM (Broadcast, Unknown Unicast, Multicast) & ARP Suppression
  // Without ARP suppression, 100% of ARP requests are flooded to all peer VTEPs.
  // With suppression, ~88% are served locally from Leaf EVPN Type 2 host cache.
  const suppressionRate = suppression ? (EVPN_CONSTANTS.ARP_SUPPRESSION_EFFICIENCY_PCT / 100) : 0;
  const effectiveArpFloodedRate = 1 - suppressionRate;
  const totalArpRequestsSec = Math.round(vni.arpRequestsSec * surgeMultiplier);
  const floodedArpRequestsSec = Math.round(totalArpRequestsSec * effectiveArpFloodedRate);
  const locallySuppressedArpSec = totalArpRequestsSec - floodedArpRequestsSec;

  // BUM Flooding bandwidth (Mbps)
  const baseBumMbps = vni.bumTrafficMbps * surgeMultiplier;
  const effectiveBumMbps = suppression
    ? Number((baseBumMbps * (1 - (suppressionRate * 0.75))).toFixed(2))
    : Number(baseBumMbps.toFixed(2));

  // Ingress Replication (HER) packet replication multiplication
  const replicationMultiplier = (rep === 'HER') ? peerVtepCount : 1.0;
  const totalReplicatedBumThroughputMbps = Number((effectiveBumMbps * (rep === 'HER' ? peerVtepCount : 1.0)).toFixed(2));
  const savedFloodingBandwidthMbps = Number((baseBumMbps * (suppressionRate * 0.75) * replicationMultiplier).toFixed(2));

  // 3. Forwarding Latency & Distributed Anycast Gateway vs Tromboning
  // Symmetric IRB routes locally on leaf directly to destination leaf across L3 VNI.
  // Asymmetric IRB or centralized gateway requires packet hair-pinning through core router.
  let effectiveLatencyMs = vni.baseLatencyMs;
  let hairpinPenaltyMs = 0;

  if (irb === 'ASYMMETRIC_IRB') {
    // Trombone hairpinning adds round-trip transit to centralized spine router + extra lookup
    hairpinPenaltyMs = 2.4 + (vni.baseLatencyMs * 1.8);
    effectiveLatencyMs += hairpinPenaltyMs;
  }

  // Latency impact from surge & fragmentation
  if (surge > 50) {
    effectiveLatencyMs += (surge - 50) * 0.008;
  }
  if (fragmentationRisk) {
    effectiveLatencyMs += 4.5; // CPU software fragmentation reassembly penalty
  }
  effectiveLatencyMs = Number(effectiveLatencyMs.toFixed(2));

  const latencySavedMs = Number(hairpinPenaltyMs.toFixed(2));

  // 4. EVPN Control Plane BGP NLRIs
  const type2MacIpCount = Math.round(vni.totalMacsLearned * 1.05);
  const type3ImetCount = vtepCount;
  const type5PrefixCount = 8; // standard tenant subnets in VRF
  const totalEvpnNlriCount = type2MacIpCount + type3ImetCount + type5PrefixCount;

  // 5. ECMP Entropy Hash Space
  const entropyHashPortsAvailable = 16384; // UDP source ports (49152 - 65535)
  const ecmpLoadBalancingEfficiencyPct = 99.4;

  // Overall Health Status
  let overallStatus = EVPN_CONSTANTS.STATUS.OPTIMAL;
  if (fragmentationRisk || effectiveLatencyMs > 5.0) {
    overallStatus = EVPN_CONSTANTS.STATUS.CRITICAL;
  } else if (mtuStatus === EVPN_CONSTANTS.STATUS.WARNING || irb === 'ASYMMETRIC_IRB' || surge > 80) {
    overallStatus = EVPN_CONSTANTS.STATUS.WARNING;
  }

  return {
    vniId: vni.id,
    vniNumber: vni.vni,
    l3VniNumber: vni.l3Vni,
    vrfName: vni.vrf,
    primaryArea: vni.primaryArea,
    aliasAreas: vni.aliasAreas,
    subnet: vni.subnet,
    anycastVirtualIp: vni.anycastVirtualIp,
    anycastVirtualMac: vni.anycastVirtualMac,
    vtepCount,
    peerVtepCount,
    vtepLeaves: vni.vtepLeaves,
    irbMode: irb,
    replicationMode: rep,
    arpSuppression: suppression,
    trafficSurgePct: surge,
    underlayMtu: mtu,
    requiredMtu,
    mtuHeadroom,
    mtuStatus,
    fragmentationRisk,
    totalArpRequestsSec,
    floodedArpRequestsSec,
    locallySuppressedArpSec,
    suppressionEfficiencyPct: suppression ? EVPN_CONSTANTS.ARP_SUPPRESSION_EFFICIENCY_PCT : 0,
    effectiveBumMbps,
    totalReplicatedBumThroughputMbps,
    savedFloodingBandwidthMbps,
    effectiveLatencyMs,
    latencySavedMs,
    type2MacIpCount,
    type3ImetCount,
    type5PrefixCount,
    totalEvpnNlriCount,
    entropyHashPortsAvailable,
    ecmpLoadBalancingEfficiencyPct,
    overallStatus
  };
}

/**
 * Calculates comprehensive EVPN overlay metrics including subscriber cross-correlation
 */
export function calculateEvpnMetrics(state, options = {}) {
  const vniId = options.vniId || getEvpnSelectedVni();
  const irbMode = options.irbMode || getEvpnSelectedIrbMode();
  const replication = options.replication || getEvpnSelectedReplication();
  const arpSuppression = options.arpSuppression !== undefined ? options.arpSuppression : getEvpnArpSuppression();
  const trafficSurgePct = options.trafficSurgePct !== undefined ? options.trafficSurgePct : getEvpnTrafficSurgePct();
  const underlayMtu = options.underlayMtu !== undefined ? options.underlayMtu : getEvpnUnderlayMtu();

  const vni = SHAHDARA_EVPN_VNIS.find(v => v.id === vniId) || SHAHDARA_EVPN_VNIS[0];
  const dynamics = calculateEvpnDynamics(vni, irbMode, replication, arpSuppression, trafficSurgePct, underlayMtu);

  // Cross-reference with Shahdara ISP subscribers
  const customers = (state && Array.isArray(state.customers)) ? state.customers : [];
  const bills = (state && Array.isArray(state.bills)) ? state.bills : [];

  let matchedSubscribers = 0;
  let activeSubscribers = 0;
  let offlineSubscribers = 0;
  let totalMonthlyRevenueAtRisk = 0;

  customers.forEach(cust => {
    const custArea = String(cust.area || '').trim().toLowerCase();
    const isMatched = vni.aliasAreas.some(area => custArea.includes(area.toLowerCase()) || area.toLowerCase().includes(custArea));
    if (isMatched) {
      matchedSubscribers++;
      const isOffline = cust.status === 'Offline';
      if (isOffline) {
        offlineSubscribers++;
      } else {
        activeSubscribers++;
      }

      // Approximate monthly package rate from customer's latest bills or package price
      const custBills = bills.filter(b => b.customerId === cust.id);
      if (custBills.length > 0) {
        const latestBill = custBills[custBills.length - 1];
        totalMonthlyRevenueAtRisk += Number(latestBill.amount || 0);
      } else {
        totalMonthlyRevenueAtRisk += Number(cust.packagePrice || 1500);
      }
    }
  });

  return {
    vni,
    dynamics,
    subscribers: {
      matchedSubscribers,
      activeSubscribers,
      offlineSubscribers,
      totalMonthlyRevenueAtRisk
    }
  };
}

/**
 * Pure Vector SVG Visualizer for EVPN/VXLAN Leaf-Spine Overlay Topology
 */
export function renderEvpnDiagramSvg(data, options = {}) {
  const compact = Boolean(options.compact);
  const { vni, dynamics, subscribers } = data;

  if (compact) {
    const width = 340;
    const height = 180;
    const statusColor = dynamics.overallStatus === EVPN_CONSTANTS.STATUS.OPTIMAL ? '#10b981'
      : (dynamics.overallStatus === EVPN_CONSTANTS.STATUS.WARNING ? '#f59e0b' : '#ef4444');

    return `
      <svg viewBox="0 0 ${width} ${height}" class="evpn-svg-compact" preserveAspectRatio="xMidYMid meet" role="img" aria-label="EVPN VXLAN Matrix Overview">
        <defs>
          <linearGradient id="evpnCompactBg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#0f172a" />
            <stop offset="100%" stop-color="#1e293b" />
          </linearGradient>
          <linearGradient id="evpnTunnelGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.2" />
            <stop offset="50%" stop-color="#06b6d4" stop-opacity="0.8" />
            <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.2" />
          </linearGradient>
        </defs>

        <rect width="${width}" height="${height}" rx="8" fill="url(#evpnCompactBg)" stroke="#334155" stroke-width="1"/>

        <!-- Header badge -->
        <g transform="translate(14, 20)">
          <rect x="0" y="0" width="85" height="18" rx="4" fill="#1e293b" stroke="#3b82f6" stroke-width="1"/>
          <text x="42.5" y="12" fill="#38bdf8" font-size="9" font-family="monospace" font-weight="bold" text-anchor="middle">VNI ${dynamics.vniNumber}</text>
          <text x="95" y="13" fill="#e2e8f0" font-size="11" font-weight="bold">${vni.primaryArea}</text>
        </g>

        <!-- Status Pill -->
        <g transform="translate(${width - 80}, 16)">
          <rect x="0" y="0" width="66" height="20" rx="10" fill="${statusColor}" fill-opacity="0.2" stroke="${statusColor}" stroke-width="1"/>
          <circle cx="10" cy="10" r="3.5" fill="${statusColor}"/>
          <text x="38" y="14" fill="${statusColor}" font-size="10" font-weight="bold" text-anchor="middle">${dynamics.overallStatus}</text>
        </g>

        <!-- Spine Nodes -->
        <g transform="translate(60, 52)">
          <rect x="0" y="0" width="80" height="22" rx="4" fill="#334155" stroke="#94a3b8" stroke-width="1"/>
          <text x="40" y="15" fill="#f8fafc" font-size="9" font-family="monospace" text-anchor="middle">SPINE-01-RR</text>
        </g>
        <g transform="translate(200, 52)">
          <rect x="0" y="0" width="80" height="22" rx="4" fill="#334155" stroke="#94a3b8" stroke-width="1"/>
          <text x="40" y="15" fill="#f8fafc" font-size="9" font-family="monospace" text-anchor="middle">SPINE-02-RR</text>
        </g>

        <!-- ECMP Underlay Link Mesh -->
        <path d="M 100 74 L 60 115 M 100 74 L 140 115 M 100 74 L 200 115 M 100 74 L 280 115" stroke="#475569" stroke-width="1" stroke-dasharray="2,2"/>
        <path d="M 240 74 L 60 115 M 240 74 L 140 115 M 240 74 L 200 115 M 240 74 L 280 115" stroke="#475569" stroke-width="1" stroke-dasharray="2,2"/>

        <!-- VXLAN Overlay Cylinder Band -->
        <rect x="30" y="90" width="280" height="14" rx="7" fill="url(#evpnTunnelGrad)" stroke="#06b6d4" stroke-width="1"/>
        <text x="170" y="100" fill="#cffafe" font-size="8.5" font-family="monospace" font-weight="bold" text-anchor="middle">
          OVERLAY L2/L3 VNI ${dynamics.vniNumber} • ANYCAST GW ${dynamics.anycastVirtualIp}
        </text>

        <!-- 4 Leaf VTEP Nodes -->
        ${[
          { label: 'LEAF-1', x: 35 },
          { label: 'LEAF-2', x: 115 },
          { label: 'LEAF-3', x: 175 },
          { label: 'LEAF-4', x: 255 }
        ].map(node => `
          <g transform="translate(${node.x}, 115)">
            <rect x="0" y="0" width="50" height="22" rx="3" fill="#1e293b" stroke="#38bdf8" stroke-width="1"/>
            <text x="25" y="14" fill="#38bdf8" font-size="8.5" font-family="monospace" font-weight="bold" text-anchor="middle">${node.label}</text>
          </g>
        `).join('')}

        <!-- Bottom Metric Tickers -->
        <g transform="translate(14, 158)">
          <text x="0" y="0" fill="#94a3b8" font-size="9">Latency:</text>
          <text x="42" y="0" fill="#38bdf8" font-size="9.5" font-family="monospace" font-weight="bold">${dynamics.effectiveLatencyMs}ms</text>

          <text x="100" y="0" fill="#94a3b8" font-size="9">ARP Sup:</text>
          <text x="148" y="0" fill="#10b981" font-size="9.5" font-family="monospace" font-weight="bold">${dynamics.suppressionEfficiencyPct}%</text>

          <text x="195" y="0" fill="#94a3b8" font-size="9">MTU Headroom:</text>
          <text x="270" y="0" fill="${dynamics.mtuStatus === 'Optimal' ? '#10b981' : '#f59e0b'}" font-size="9.5" font-family="monospace" font-weight="bold">${dynamics.mtuHeadroom}B</text>
        </g>
      </svg>
    `;
  }

  // Expanded Detailed Modal Diagram
  const width = 760;
  const height = 360;
  const statusColor = dynamics.overallStatus === EVPN_CONSTANTS.STATUS.OPTIMAL ? '#10b981'
    : (dynamics.overallStatus === EVPN_CONSTANTS.STATUS.WARNING ? '#f59e0b' : '#ef4444');

  return `
    <svg viewBox="0 0 ${width} ${height}" class="evpn-svg-expanded" preserveAspectRatio="xMidYMid meet" role="img" aria-label="EVPN VXLAN Anycast Gateway Architecture">
      <defs>
        <linearGradient id="evpnExpBg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0b1329" />
          <stop offset="100%" stop-color="#111c38" />
        </linearGradient>
        <linearGradient id="spineGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#1e293b" />
          <stop offset="100%" stop-color="#334155" />
        </linearGradient>
        <linearGradient id="leafGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0f172a" />
          <stop offset="100%" stop-color="#1e3a5f" />
        </linearGradient>
        <linearGradient id="tunnelGradExp" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#0284c7" stop-opacity="0.3" />
          <stop offset="50%" stop-color="#06b6d4" stop-opacity="0.85" />
          <stop offset="100%" stop-color="#0284c7" stop-opacity="0.3" />
        </linearGradient>
        <filter id="evpnGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      <rect width="${width}" height="${height}" rx="10" fill="url(#evpnExpBg)" stroke="#1e293b" stroke-width="1.5"/>

      <!-- Title / Fabric Header Bar -->
      <g transform="translate(20, 24)">
        <text x="0" y="0" fill="#f8fafc" font-size="14" font-weight="bold">Shahdara Metro Core MP-BGP EVPN / VXLAN Fabric (RFC 7432 / 8365 / 9135)</text>
        <text x="0" y="16" fill="#94a3b8" font-size="10.5">Dual Spine Route-Reflector Underlay • 4-Leaf VTEP Distributed Anycast Gateway • VRF: ${dynamics.vrfName}</text>
      </g>

      <!-- Fabric Health Badge -->
      <g transform="translate(${width - 150}, 16)">
        <rect x="0" y="0" width="130" height="26" rx="6" fill="#1e293b" stroke="${statusColor}" stroke-width="1"/>
        <circle cx="16" cy="13" r="4.5" fill="${statusColor}" filter="url(#evpnGlow)"/>
        <text x="70" y="17" fill="#f8fafc" font-size="11" font-weight="bold" text-anchor="middle">${dynamics.overallStatus.toUpperCase()}</text>
      </g>

      <!-- Spine Layer (Route Reflectors & Underlay ECMP) -->
      <g id="spineLayer" transform="translate(130, 56)">
        <!-- Spine 1 -->
        <g transform="translate(0, 0)">
          <rect x="0" y="0" width="200" height="50" rx="6" fill="url(#spineGrad)" stroke="#38bdf8" stroke-width="1.5"/>
          <text x="100" y="20" fill="#f8fafc" font-size="11" font-weight="bold" font-family="monospace" text-anchor="middle">SPINE-01-CORE (RR-1)</text>
          <text x="100" y="36" fill="#7dd3fc" font-size="9" font-family="monospace" text-anchor="middle">Loopback0: 10.255.2.1 • BGP AS 65000</text>
        </g>
        <!-- Spine 2 -->
        <g transform="translate(300, 0)">
          <rect x="0" y="0" width="200" height="50" rx="6" fill="url(#spineGrad)" stroke="#38bdf8" stroke-width="1.5"/>
          <text x="100" y="20" fill="#f8fafc" font-size="11" font-weight="bold" font-family="monospace" text-anchor="middle">SPINE-02-CORE (RR-2)</text>
          <text x="100" y="36" fill="#7dd3fc" font-size="9" font-family="monospace" text-anchor="middle">Loopback0: 10.255.2.2 • BGP AS 65000</text>
        </g>
      </g>

      <!-- Underlay ECMP Mesh Wires -->
      <g id="underlayMesh" stroke="#334155" stroke-width="1.5" stroke-dasharray="3,3">
        <!-- Spine 1 down to 4 Leaves -->
        <line x1="230" y1="106" x2="80" y2="210"/>
        <line x1="230" y1="106" x2="260" y2="210"/>
        <line x1="230" y1="106" x2="480" y2="210"/>
        <line x1="230" y1="106" x2="660" y2="210"/>
        <!-- Spine 2 down to 4 Leaves -->
        <line x1="530" y1="106" x2="80" y2="210"/>
        <line x1="530" y1="106" x2="260" y2="210"/>
        <line x1="530" y1="106" x2="480" y2="210"/>
        <line x1="530" y1="106" x2="660" y2="210"/>
      </g>

      <!-- ECMP Entropy Hash Badge Center -->
      <g transform="translate(310, 138)">
        <rect x="0" y="0" width="140" height="24" rx="4" fill="#0f172a" stroke="#64748b" stroke-width="1"/>
        <text x="70" y="16" fill="#94a3b8" font-size="9.5" font-family="monospace" text-anchor="middle">
          ECMP Entropy: ${dynamics.entropyHashPortsAvailable} ports
        </text>
      </g>

      <!-- VXLAN Overlay Tunnel Pipeline Banner -->
      <g id="overlayTunnelBand" transform="translate(30, 172)">
        <rect x="0" y="0" width="700" height="26" rx="13" fill="url(#tunnelGradExp)" stroke="#06b6d4" stroke-width="1.5" filter="url(#evpnGlow)"/>
        <text x="350" y="17" fill="#ecfeff" font-size="10.5" font-family="monospace" font-weight="bold" text-anchor="middle">
          VXLAN OVERLAY: L2 VNI ${dynamics.vniNumber} • L3 VNI ${dynamics.l3VniNumber} • ${dynamics.irbMode.includes('Symmetric') ? 'SYMMETRIC IRB' : 'ASYMMETRIC IRB'}
        </text>
      </g>

      <!-- Leaf VTEP Layer (Distributed Anycast Gateway) -->
      <g id="leafLayer" transform="translate(20, 210)">
        ${[
          { id: 'LEAF-01', name: 'Baradari DC', ip: '10.255.1.1', x: 0 },
          { id: 'LEAF-02', name: 'Shahdara Town', ip: '10.255.1.2', x: 185 },
          { id: 'LEAF-03', name: 'GT Road Aggr', ip: '10.255.1.3', x: 370 },
          { id: 'LEAF-04', name: 'Vandala Edge', ip: '10.255.1.4', x: 555 }
        ].map(leaf => `
          <g transform="translate(${leaf.x}, 0)">
            <rect x="0" y="0" width="165" height="74" rx="6" fill="url(#leafGrad)" stroke="#0284c7" stroke-width="1.5"/>
            <text x="12" y="18" fill="#f8fafc" font-size="10" font-weight="bold" font-family="monospace">${leaf.id} (${leaf.name})</text>
            <text x="12" y="32" fill="#7dd3fc" font-size="8.5" font-family="monospace">VTEP: ${leaf.ip}</text>

            <rect x="8" y="38" width="149" height="28" rx="4" fill="#0f172a" stroke="#0369a1" stroke-width="1"/>
            <text x="12" y="50" fill="#a5f3fc" font-size="8" font-family="monospace">Anycast IP: ${dynamics.anycastVirtualIp}</text>
            <text x="12" y="61" fill="#67e8f9" font-size="8" font-family="monospace">VMAC: ${dynamics.anycastVirtualMac}</text>
          </g>
        `).join('')}
      </g>

      <!-- Bottom Status & Telemetry Bar -->
      <g transform="translate(20, 305)">
        <rect x="0" y="0" width="${width - 40}" height="42" rx="6" fill="#0f172a" stroke="#1e293b" stroke-width="1"/>

        <g transform="translate(16, 17)">
          <text x="0" y="0" fill="#94a3b8" font-size="9.5">Underlay MTU:</text>
          <text x="80" y="0" fill="${dynamics.mtuStatus === 'Optimal' ? '#34d399' : '#f87171'}" font-size="10" font-family="monospace" font-weight="bold">${dynamics.underlayMtu}B (${dynamics.mtuHeadroom}B Headroom)</text>

          <text x="230" y="0" fill="#94a3b8" font-size="9.5">Forwarding Latency:</text>
          <text x="340" y="0" fill="#38bdf8" font-size="10" font-family="monospace" font-weight="bold">${dynamics.effectiveLatencyMs}ms</text>

          <text x="410" y="0" fill="#94a3b8" font-size="9.5">ARP Suppression:</text>
          <text x="505" y="0" fill="#10b981" font-size="10" font-family="monospace" font-weight="bold">${dynamics.suppressionEfficiencyPct}% local hit</text>

          <text x="590" y="0" fill="#94a3b8" font-size="9.5">BGP NLRIs:</text>
          <text x="655" y="0" fill="#c084fc" font-size="10" font-family="monospace" font-weight="bold">${dynamics.totalEvpnNlriCount}</text>
        </g>

        <g transform="translate(16, 33)">
          <text x="0" y="0" fill="#64748b" font-size="8.5">Replication: ${dynamics.replicationMode} • Replicated BUM Rate: ${dynamics.totalReplicatedBumThroughputMbps} Mbps • Inter-VRF L3 VNI: ${dynamics.l3VniNumber}</text>
          <text x="${width - 70}" y="0" fill="#64748b" font-size="8.5" text-anchor="end">Subscribers: ${subscribers.matchedSubscribers} (${formatPKR(subscribers.totalMonthlyRevenueAtRisk)}/mo)</text>
        </g>
      </g>
    </svg>
  `;
}

/**
 * Generates clipboard/WhatsApp carrier engineering briefing report
 */
export function generateEvpnReport(data) {
  const { vni, dynamics, subscribers } = data;
  return `=== SHAHDARA ISP CARRIER MP-BGP EVPN / VXLAN OVERLAY BRIEFING ===
Fabric Status: ${dynamics.overallStatus.toUpperCase()}
Timestamp: ${new Date().toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })} PKT

[OVERLAY VNI & TENANT VRF]
- Target Overlay: ${vni.name}
- L2 VNI: ${dynamics.vniNumber} | L3 VNI: ${dynamics.l3VniNumber} (Tenant VRF: ${dynamics.vrfName})
- Primary Sector: ${dynamics.primaryArea} (${vni.aliasAreas.join(', ')})
- Tenant Subnet: ${dynamics.subnet}
- Distributed Anycast Gateway IP: ${dynamics.anycastVirtualIp} (VMAC: ${dynamics.anycastVirtualMac})
- Participating Leaf VTEPs (${dynamics.vtepCount}): ${dynamics.vtepLeaves.join(', ')}

[FORWARDING PLANE & LATENCY PERFORMANCE]
- IRB Architecture: ${dynamics.irbMode}
- Forwarding Latency: ${dynamics.effectiveLatencyMs} ms (${dynamics.latencySavedMs > 0 ? `Saved ${dynamics.latencySavedMs} ms vs trombone routing` : 'Direct distributed routing'})
- Underlay MTU: ${dynamics.underlayMtu} Bytes (Required: ${dynamics.requiredMtu} Bytes, Headroom: ${dynamics.mtuHeadroom} Bytes)
- MTU Compliance: ${dynamics.mtuStatus.toUpperCase()} ${dynamics.fragmentationRisk ? '(! CRITICAL FRAGMENTATION RISK !)' : ''}
- ECMP Hashing Entropy Ports: ${dynamics.entropyHashPortsAvailable} (Uniformity: ${dynamics.ecmpLoadBalancingEfficiencyPct}%)

[BUM TRAFFIC & ARP SUPPRESSION]
- Ingress Replication Mode: ${dynamics.replicationMode}
- ARP Suppression Status: ${dynamics.arpSuppression ? 'ENABLED (RFC 7432 Host ARP Cache)' : 'DISABLED (Overlay Flooding)'}
- ARP Suppression Efficiency: ${dynamics.suppressionEfficiencyPct}% (${dynamics.locallySuppressedArpSec} req/sec answered locally)
- Flooded ARP Across Core: ${dynamics.floodedArpRequestsSec} req/sec
- Total Replicated BUM Load: ${dynamics.totalReplicatedBumThroughputMbps} Mbps
- Overlay Bandwidth Saved by Suppression: ${dynamics.savedFloodingBandwidthMbps} Mbps

[CONTROL PLANE BGP EVPN METRICS]
- Route Type 2 (MAC/IP Advertisement): ${dynamics.type2MacIpCount} NLRIs
- Route Type 3 (Inclusive Multicast IMET): ${dynamics.type3ImetCount} NLRIs
- Route Type 5 (IP Prefix Routes): ${dynamics.type5PrefixCount} NLRIs
- Total Active BGP EVPN NLRIs: ${dynamics.totalEvpnNlriCount}

[SUBSCRIBER REVENUE AT RISK]
- Matching Subscribers: ${subscribers.matchedSubscribers} (Active: ${subscribers.activeSubscribers}, Offline: ${subscribers.offlineSubscribers})
- Total Monthly Revenue Dependent on Overlay: ${formatPKR(subscribers.totalMonthlyRevenueAtRisk)}

Engineering Recommendation: ${dynamics.overallStatus === 'Optimal' ? 'All Leaf VTEPs and Anycast Gateways healthy. Encapsulation headroom exceeds carrier SLA.' : (dynamics.fragmentationRisk ? 'Immediate action: Increase underlay switch interface MTU to 9216 to avoid packet fragmentation!' : 'Monitor BUM flooding rates during evening rush hours.')}`;
}

/**
 * Controller wiring for EVPN/VXLAN Modal Dialog
 */
export function setupEvpnModal(state, options = {}) {
  const modal = document.getElementById('dashboardEvpnModal');
  const openBtn = document.getElementById('dashboardOpenEvpnModalBtn');
  const closeBtn = document.getElementById('dashboardEvpnModalCloseBtn');
  const filterAreaBtn = document.getElementById('evpnFilterAreaBtn');
  const copyReportBtn = document.getElementById('evpnCopyReportBtn');

  // Controls
  const vniSelect = document.getElementById('evpnVniSelect');
  const irbModeSelect = document.getElementById('evpnIrbModeSelect');
  const repSelect = document.getElementById('evpnReplicationSelect');
  const arpCheckbox = document.getElementById('evpnArpSuppressionCheck');
  const surgeSlider = document.getElementById('evpnSurgeSlider');
  const surgeValueLabel = document.getElementById('evpnSurgeValueLabel');
  const mtuSlider = document.getElementById('evpnMtuSlider');
  const mtuValueLabel = document.getElementById('evpnMtuValueLabel');
  const resetBtn = document.getElementById('evpnResetSimBtn');

  // Containers
  const diagramContainer = document.getElementById('evpnModalDiagramContainer');
  const statLatency = document.getElementById('evpnStatLatency');
  const statArp = document.getElementById('evpnStatArp');
  const statMtu = document.getElementById('evpnStatMtu');
  const statNlri = document.getElementById('evpnStatNlri');
  const statBum = document.getElementById('evpnStatBum');
  const statRevenue = document.getElementById('evpnStatRevenue');

  function renderView() {
    const metrics = calculateEvpnMetrics(state);

    if (diagramContainer) {
      diagramContainer.innerHTML = renderEvpnDiagramSvg(metrics, { compact: false });
    }

    if (statLatency) statLatency.textContent = `${metrics.dynamics.effectiveLatencyMs} ms`;
    if (statArp) statArp.textContent = `${metrics.dynamics.suppressionEfficiencyPct}%`;
    if (statMtu) {
      statMtu.textContent = `${metrics.dynamics.underlayMtu}B (${metrics.dynamics.mtuHeadroom}B)`;
      statMtu.className = `stat-value ${metrics.dynamics.mtuStatus === 'Optimal' ? 'text-success' : 'text-danger'}`;
    }
    if (statNlri) statNlri.textContent = metrics.dynamics.totalEvpnNlriCount;
    if (statBum) statBum.textContent = `${metrics.dynamics.totalReplicatedBumThroughputMbps} Mbps`;
    if (statRevenue) statRevenue.textContent = formatPKR(metrics.subscribers.totalMonthlyRevenueAtRisk);

    // Sync control inputs
    if (vniSelect) vniSelect.value = getEvpnSelectedVni();
    if (irbModeSelect) irbModeSelect.value = getEvpnSelectedIrbMode();
    if (repSelect) repSelect.value = getEvpnSelectedReplication();
    if (arpCheckbox) arpCheckbox.checked = getEvpnArpSuppression();
    if (surgeSlider) surgeSlider.value = getEvpnTrafficSurgePct();
    if (surgeValueLabel) surgeValueLabel.textContent = `+${getEvpnTrafficSurgePct()}%`;
    if (mtuSlider) mtuSlider.value = getEvpnUnderlayMtu();
    if (mtuValueLabel) mtuValueLabel.textContent = `${getEvpnUnderlayMtu()} Bytes`;
  }

  if (vniSelect) {
    vniSelect.onchange = e => {
      setEvpnSelectedVni(e.target.value);
      renderView();
    };
  }

  if (irbModeSelect) {
    irbModeSelect.onchange = e => {
      setEvpnSelectedIrbMode(e.target.value);
      renderView();
    };
  }

  if (repSelect) {
    repSelect.onchange = e => {
      setEvpnSelectedReplication(e.target.value);
      renderView();
    };
  }

  if (arpCheckbox) {
    arpCheckbox.onchange = e => {
      setEvpnArpSuppression(e.target.checked);
      renderView();
    };
  }

  if (surgeSlider) {
    surgeSlider.oninput = e => {
      setEvpnTrafficSurgePct(Number(e.target.value));
      renderView();
    };
  }

  if (mtuSlider) {
    mtuSlider.oninput = e => {
      setEvpnUnderlayMtu(Number(e.target.value));
      renderView();
    };
  }

  if (resetBtn) {
    resetBtn.onclick = () => {
      resetEvpnSimState();
      renderView();
    };
  }

  if (openBtn && modal) {
    openBtn.onclick = () => {
      renderView();
      if (typeof modal.showModal === 'function') {
        modal.showModal();
      } else {
        modal.setAttribute('open', 'true');
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

  if (modal) {
    modal.onclick = e => {
      if (e.target === modal) {
        if (typeof modal.close === 'function') modal.close();
        else modal.removeAttribute('open');
      }
    };
  }

  if (filterAreaBtn) {
    filterAreaBtn.onclick = () => {
      const metrics = calculateEvpnMetrics(state);
      if (typeof options.onFilterArea === 'function') {
        options.onFilterArea(metrics.vni.primaryArea);
        if (modal && typeof modal.close === 'function') modal.close();
        else if (modal) modal.removeAttribute('open');
        if (typeof options.onToast === 'function') {
          options.onToast(`Filtering subscribers in ${metrics.vni.primaryArea}`);
        }
      }
    };
  }

  if (copyReportBtn) {
    copyReportBtn.onclick = async () => {
      const metrics = calculateEvpnMetrics(state);
      const text = generateEvpnReport(metrics);
      try {
        const cb = options.clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
        if (cb?.writeText) {
          await cb.writeText(text);
          if (typeof options.onToast === 'function') {
            options.onToast('EVPN/VXLAN briefing copied to clipboard!');
          }
        } else if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
          window.prompt('Copy EVPN briefing:', text);
        }
      } catch (err) {
        if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
          window.prompt('Copy EVPN briefing:', text);
        }
      }
    };
  }

  // Initial draw if container exists
  renderView();
}
