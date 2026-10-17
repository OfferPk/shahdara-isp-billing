import { formatPKR } from './core.js';

/**
 * Carrier Segment Routing over IPv6 (SRv6 / RFC 8986 / RFC 8754) Network Programming Matrix
 * Segment Routing Header (SRH), End.DT4/DT6 Tenant VRF, Micro-SID (uSID) Compression & Path MTU Matrix
 * Area: agent1 (shahdara-dashboard) - KPIs, Charts, SID Graphs & SLA Telemetry
 */

export const SRV6_CONSTANTS = {
  DEFAULT_POLICY_ID: 'shahdara-core-srv6-l3vpn',
  DEFAULT_PAYLOAD_BYTES: 1420,
  DEFAULT_INTERFACE_MTU: 1500,
  DEFAULT_USID_MODE: false,

  HEADER_SIZES: {
    IPV6_BASE_BYTES: 40,
    SRH_BASE_BYTES: 8,
    CLASSIC_SID_BYTES: 16, // 128-bit SID
    USID_BLOCK_BYTES: 16   // 128-bit Carrier Carrier holding up to 6 micro-SIDs
  },

  BEHAVIORS: {
    END: 'End (Endpoint - Decrement SL, Update IPv6 DA)',
    END_X: 'End.X (Endpoint with Cross-Connect to L3 Adjacency)',
    END_T: 'End.T (Endpoint with Specific Route Table Lookup)',
    END_DT4: 'End.DT4 (Endpoint Decapsulation & IPv4 VRF Lookup)',
    END_DT6: 'End.DT6 (Endpoint Decapsulation & IPv6 VRF Lookup)',
    END_DT46: 'End.DT46 (Endpoint Decapsulation & Dual-Stack VRF Lookup)',
    END_DX2: 'End.DX2 (Endpoint Decapsulation & Layer-2 VPWS Cross-Connect)',
    END_B6_ENCAPS: 'End.B6.Encaps (Binding SID to SRv6 Policy Encap)'
  },

  STATUS: {
    OPTIMAL: 'Optimal (No Fragmentation, Within MTU Budget)',
    ELEVATED_MTU: 'Elevated MTU Overhead (Approaching MTU Threshold)',
    FRAGMENTATION_RISK: 'Fragmentation Risk (Payload + SRv6 Exceeds Link MTU)',
    POLICY_DEVIATION: 'Policy Deviation (SL Mismatch or Invalid Hop)'
  }
};

export const SHAHDARA_SRV6_POLICIES = [
  {
    id: 'shahdara-core-srv6-l3vpn',
    name: 'Shahdara Core L3VPN (Baradari Central DC to Begum Kot Metro Ring)',
    type: 'L3VPN / End.DT4',
    primaryArea: 'Baradari',
    targetArea: 'Begum Kot',
    ingressPe: 'PE-01-Baradari-Core',
    transitNodes: ['P-01-TownHall-Transit', 'P-02-JiaMusa-Agg'],
    egressPe: 'PE-02-BegumKot-Edge',
    segmentList: [
      { sid: '2001:db8:1001:1::1', behavior: 'End', node: 'P-01-TownHall-Transit', desc: 'Core transit hop via Town Hall' },
      { sid: '2001:db8:1001:2::1', behavior: 'End.X', node: 'P-02-JiaMusa-Agg', desc: 'Cross-connect to 10G link TenGigE0/1/0' },
      { sid: '2001:db8:1001:3:100::4', behavior: 'End.DT4', node: 'PE-02-BegumKot-Edge', desc: 'Decap and lookup in VRF-Enterprise-Corp' }
    ],
    interfaceMtu: 1500,
    baselinePayload: 1420,
    activeSegmentsLeft: 2,
    bandwidthGbps: 10,
    monthlyRevenuePkr: 2450000,
    subscribersCount: 420
  },
  {
    id: 'jia-musa-dual-stack-broadband',
    name: 'Jia Musa High-Capacity Dual-Stack Broadband SRv6 Ingress',
    type: 'Broadband Dual-Stack / End.DT46',
    primaryArea: 'Jia Musa',
    targetArea: 'Ravi Siphon',
    ingressPe: 'PE-03-JiaMusa-BNG',
    transitNodes: ['P-03-RaviLink-Transit'],
    egressPe: 'PE-04-RaviSiphon-Edge',
    segmentList: [
      { sid: '2001:db8:1002:1::1', behavior: 'End', node: 'P-03-RaviLink-Transit', desc: 'Core transit over Ravi Siphon span' },
      { sid: '2001:db8:1002:2:200::46', behavior: 'End.DT46', node: 'PE-04-RaviSiphon-Edge', desc: 'Decap and lookup in dual-stack VRF-Broadband' }
    ],
    interfaceMtu: 1500,
    baselinePayload: 1420,
    activeSegmentsLeft: 1,
    bandwidthGbps: 40,
    monthlyRevenuePkr: 1890000,
    subscribersCount: 860
  },
  {
    id: 'nayatel-transit-te-strict',
    name: 'Nayatel Upstream IP Transit Strict Low-Latency TE Path',
    type: 'Traffic Engineering / End.X',
    primaryArea: 'Begum Kot',
    targetArea: 'Shahdara Town',
    ingressPe: 'PE-02-BegumKot-Edge',
    transitNodes: ['P-01-TownHall-Transit', 'P-04-SiphonBypass'],
    egressPe: 'PE-05-Nayatel-BorderGW',
    segmentList: [
      { sid: '2001:db8:1003:1::1', behavior: 'End.X', node: 'P-01-TownHall-Transit', desc: 'Low-latency optical path (<1.2ms latency SLA)' },
      { sid: '2001:db8:1003:2::1', behavior: 'End.X', node: 'P-04-SiphonBypass', desc: 'Bypass zero-jitter metro ring link' },
      { sid: '2001:db8:1003:3:300::1', behavior: 'End.T', node: 'PE-05-Nayatel-BorderGW', desc: 'Lookup in Global BGP Routing Information Base' }
    ],
    interfaceMtu: 1500,
    baselinePayload: 1380,
    activeSegmentsLeft: 2,
    bandwidthGbps: 20,
    monthlyRevenuePkr: 3100000,
    subscribersCount: 510
  },
  {
    id: 'medical-plaza-teleradiology-dx2',
    name: 'Shahdara Medical Plaza 10G Tele-Radiology VPWS over SRv6',
    type: 'L2VPN VPWS / End.DX2',
    primaryArea: 'Baradari',
    targetArea: 'Vandala Road',
    ingressPe: 'PE-01-Baradari-Core',
    transitNodes: ['P-02-JiaMusa-Agg'],
    egressPe: 'PE-06-VandalaClinic-Edge',
    segmentList: [
      { sid: '2001:db8:1004:1::1', behavior: 'End', node: 'P-02-JiaMusa-Agg', desc: 'Intermediate P-node transit' },
      { sid: '2001:db8:1004:2:400::2', behavior: 'End.DX2', node: 'PE-06-VandalaClinic-Edge', desc: 'L2 decap to GigabitEthernet0/0/3 PACS imaging port' }
    ],
    interfaceMtu: 1500,
    baselinePayload: 1400,
    activeSegmentsLeft: 1,
    bandwidthGbps: 10,
    monthlyRevenuePkr: 1650000,
    subscribersCount: 290
  },
  {
    id: 'vandala-wholesale-backhaul-jumbo',
    name: 'Vandala Road Wholesale Carrier Backhaul 9000-MTU Jumbo SRv6',
    type: 'Carrier Wholesale / End.DT4',
    primaryArea: 'Vandala Road',
    targetArea: 'Baradari',
    ingressPe: 'PE-06-VandalaClinic-Edge',
    transitNodes: ['P-01-TownHall-Transit', 'P-02-JiaMusa-Agg'],
    egressPe: 'PE-01-Baradari-Core',
    segmentList: [
      { sid: '2001:db8:1005:1::1', behavior: 'End', node: 'P-01-TownHall-Transit', desc: 'Transit node via Town Hall core' },
      { sid: '2001:db8:1005:2::1', behavior: 'End.X', node: 'P-02-JiaMusa-Agg', desc: 'Cross-connect to high-speed trunk' },
      { sid: '2001:db8:1005:3:500::4', behavior: 'End.DT4', node: 'PE-01-Baradari-Core', desc: 'Decap and lookup in VRF-Wholesale-Agg' }
    ],
    interfaceMtu: 9000,
    baselinePayload: 8800,
    activeSegmentsLeft: 2,
    bandwidthGbps: 40,
    monthlyRevenuePkr: 4200000,
    subscribersCount: 640
  }
];

// In-memory simulation state
let selectedPolicyId = SRV6_CONSTANTS.DEFAULT_POLICY_ID;
let simulationPayloadBytes = SRV6_CONSTANTS.DEFAULT_PAYLOAD_BYTES;
let simulationInterfaceMtu = SRV6_CONSTANTS.DEFAULT_INTERFACE_MTU;
let simulationMicroSidMode = SRV6_CONSTANTS.DEFAULT_USID_MODE;
let simulationSegmentsLeft = 2;

export function getSrv6SelectedPolicyId() {
  return selectedPolicyId;
}

export function setSrv6SelectedPolicyId(id) {
  if (SHAHDARA_SRV6_POLICIES.some(p => p.id === id)) {
    selectedPolicyId = id;
    const policy = SHAHDARA_SRV6_POLICIES.find(p => p.id === id);
    simulationPayloadBytes = policy.baselinePayload;
    simulationInterfaceMtu = policy.interfaceMtu;
    simulationSegmentsLeft = policy.activeSegmentsLeft;
  }
}

export function getSrv6PayloadBytes() {
  return simulationPayloadBytes;
}

export function setSrv6PayloadBytes(bytes) {
  simulationPayloadBytes = Math.max(64, Math.min(9000, Number(bytes) || 1420));
}

export function getSrv6InterfaceMtu() {
  return simulationInterfaceMtu;
}

export function setSrv6InterfaceMtu(mtu) {
  simulationInterfaceMtu = Math.max(1280, Math.min(9600, Number(mtu) || 1500));
}

export function getSrv6MicroSidMode() {
  return simulationMicroSidMode;
}

export function setSrv6MicroSidMode(enabled) {
  simulationMicroSidMode = Boolean(enabled);
}

export function getSrv6SegmentsLeft() {
  return simulationSegmentsLeft;
}

export function setSrv6SegmentsLeft(sl) {
  simulationSegmentsLeft = Math.max(0, Math.min(10, Number(sl) || 0));
}

export function resetSrv6SimState() {
  selectedPolicyId = SRV6_CONSTANTS.DEFAULT_POLICY_ID;
  const policy = SHAHDARA_SRV6_POLICIES.find(p => p.id === selectedPolicyId);
  simulationPayloadBytes = policy.baselinePayload;
  simulationInterfaceMtu = policy.interfaceMtu;
  simulationMicroSidMode = SRV6_CONSTANTS.DEFAULT_USID_MODE;
  simulationSegmentsLeft = policy.activeSegmentsLeft;
}

/**
 * Calculate SRv6 header overhead in bytes.
 * Classic: 40 (IPv6) + 8 (SRH Base) + (N * 16) SID list.
 * uSID: 40 (IPv6) + 8 (SRH Base) + 16 (1 carrier carrier block for up to 6 micro-SIDs).
 */
export function calculateSrv6HeaderOverhead(segmentsCount = 3, useMicroSid = false) {
  const count = Math.max(1, Number(segmentsCount) || 1);
  const ipv6Base = SRV6_CONSTANTS.HEADER_SIZES.IPV6_BASE_BYTES;
  const srhBase = SRV6_CONSTANTS.HEADER_SIZES.SRH_BASE_BYTES;

  if (useMicroSid) {
    // Up to 6 micro-SIDs fit into single 128-bit block
    const carrierBlocks = Math.ceil(count / 6);
    const sidListBytes = carrierBlocks * SRV6_CONSTANTS.HEADER_SIZES.USID_BLOCK_BYTES;
    const totalOverhead = ipv6Base + srhBase + sidListBytes;
    return {
      ipv6Base,
      srhBase,
      sidListBytes,
      totalOverhead,
      mode: 'uSID (Micro-Segment Routing)'
    };
  }

  const sidListBytes = count * SRV6_CONSTANTS.HEADER_SIZES.CLASSIC_SID_BYTES;
  const totalOverhead = ipv6Base + srhBase + sidListBytes;
  return {
    ipv6Base,
    srhBase,
    sidListBytes,
    totalOverhead,
    mode: 'Classic SRv6 (128-bit SIDs)'
  };
}

/**
 * Calculate effective Path MTU (PMTU).
 */
export function calculateEffectivePathMtu(interfaceMtu = 1500, totalOverhead = 96) {
  return Math.max(0, interfaceMtu - totalOverhead);
}

/**
 * Calculate full SRv6 telemetry and forwarding dynamics.
 */
export function calculateSrv6Dynamics(policy, options = {}) {
  const pol = policy || SHAHDARA_SRV6_POLICIES.find(p => p.id === selectedPolicyId) || SHAHDARA_SRV6_POLICIES[0];
  const payloadBytes = options.payloadBytes !== undefined ? Number(options.payloadBytes) : simulationPayloadBytes;
  const interfaceMtu = options.interfaceMtu !== undefined ? Number(options.interfaceMtu) : simulationInterfaceMtu;
  const useMicroSid = options.useMicroSid !== undefined ? Boolean(options.useMicroSid) : simulationMicroSidMode;
  const segmentsCount = pol.segmentList ? pol.segmentList.length : 3;
  const segmentsLeft = options.segmentsLeft !== undefined ? Number(options.segmentsLeft) : simulationSegmentsLeft;

  const overhead = calculateSrv6HeaderOverhead(segmentsCount, useMicroSid);
  const classicOverhead = calculateSrv6HeaderOverhead(segmentsCount, false);
  const effectivePmtu = calculateEffectivePathMtu(interfaceMtu, overhead.totalOverhead);

  const totalPacketBytes = payloadBytes + overhead.totalOverhead;
  const headroomBytes = interfaceMtu - totalPacketBytes;
  const overheadPercentage = Number(((overhead.totalOverhead / interfaceMtu) * 100).toFixed(2));

  // Compression savings when uSID is enabled
  const compressionSavingsBytes = Math.max(0, classicOverhead.totalOverhead - overhead.totalOverhead);
  const compressionSavingsPercent = classicOverhead.totalOverhead > 0
    ? Number(((compressionSavingsBytes / classicOverhead.totalOverhead) * 100).toFixed(1))
    : 0;

  // Active SID based on Segments Left (SL)
  // Segment list in SRH is reverse-ordered (Last entry at 0, First next hop at segmentsCount - 1)
  // Active SID index = segmentsLeft
  const clampedSl = Math.min(segmentsLeft, segmentsCount - 1);
  const activeSegment = pol.segmentList && pol.segmentList[clampedSl] ? pol.segmentList[clampedSl] : null;

  // Estimated per-hop packet processing latency
  // Base optical transit ~0.05ms + 0.15 microseconds per SRv6 segment lookup
  const baseLatencyMs = pol.type.includes('Traffic Engineering') ? 0.8 : 1.5;
  const processingLatencyUs = Number(((segmentsCount * 0.15) + (useMicroSid ? 0.05 : 0)).toFixed(2));
  const estimatedLatencyMs = Number((baseLatencyMs + (processingLatencyUs / 1000)).toFixed(3));

  // Forwarding status determination
  let status = SRV6_CONSTANTS.STATUS.OPTIMAL;
  let statusClass = 'optimal';

  if (totalPacketBytes > interfaceMtu) {
    status = SRV6_CONSTANTS.STATUS.FRAGMENTATION_RISK;
    statusClass = 'critical';
  } else if (headroomBytes < 50) {
    status = SRV6_CONSTANTS.STATUS.ELEVATED_MTU;
    statusClass = 'degraded';
  } else if (segmentsLeft > segmentsCount) {
    status = SRV6_CONSTANTS.STATUS.POLICY_DEVIATION;
    statusClass = 'degraded';
  }

  return {
    policy: pol,
    payloadBytes,
    interfaceMtu,
    useMicroSid,
    segmentsCount,
    segmentsLeft,
    overhead,
    classicOverhead,
    effectivePmtu,
    totalPacketBytes,
    headroomBytes,
    overheadPercentage,
    compressionSavingsBytes,
    compressionSavingsPercent,
    activeSegment,
    processingLatencyUs,
    estimatedLatencyMs,
    status,
    statusClass
  };
}

/**
 * Calculate aggregate SRv6 network metrics across all Shahdara policies.
 */
export function calculateSrv6Metrics(state = {}, options = {}) {
  const policies = SHAHDARA_SRV6_POLICIES;
  const currentDynamics = calculateSrv6Dynamics(null, options);

  let totalBandwidthGbps = 0;
  let totalRevenuePkr = 0;
  let totalSubscribers = 0;
  let totalSegments = 0;

  policies.forEach(p => {
    totalBandwidthGbps += (p.bandwidthGbps || 0);
    totalRevenuePkr += (p.monthlyRevenuePkr || 0);
    totalSubscribers += (p.subscribersCount || 0);
    totalSegments += (p.segmentList ? p.segmentList.length : 0);
  });

  const avgOverheadBytes = Math.round(
    policies.reduce((acc, p) => acc + calculateSrv6HeaderOverhead(p.segmentList.length, false).totalOverhead, 0) / policies.length
  );

  return {
    totalPolicies: policies.length,
    totalBandwidthGbps,
    totalRevenuePkr,
    totalSubscribers,
    totalSegments,
    avgOverheadBytes,
    currentDynamics
  };
}

/**
 * Pure-vector SVG visualizer for SRv6 Packet Header Stack and Hop-by-Hop Node Segment Journey.
 */
export function renderSrv6DiagramSvg(dynamics, options = {}) {
  const d = dynamics || calculateSrv6Dynamics();
  const pol = d.policy;
  const isDark = Boolean(options.isDark);

  const bg = isDark ? '#0f172a' : '#ffffff';
  const textMain = isDark ? '#f8fafc' : '#0f172a';
  const textMuted = isDark ? '#94a3b8' : '#64748b';
  const borderCol = isDark ? '#334155' : '#e2e8f0';

  // Layer colors
  const colIpv6 = '#3b82f6'; // Blue
  const colSrh = '#8b5cf6';  // Purple
  const colSid = '#10b981';  // Emerald
  const colPayload = '#f59e0b'; // Amber
  const colActive = '#ef4444'; // Red for active SID

  const width = 800;
  const height = 400;

  // Header stack dimensions
  const stackY = 60;
  const stackH = 46;
  const totalW = 720;
  const startX = 40;

  const ipv6W = Math.round((d.overhead.ipv6Base / d.totalPacketBytes) * totalW * 3.5);
  const srhW = Math.round((d.overhead.srhBase / d.totalPacketBytes) * totalW * 2.5);
  const sidListW = Math.round((d.overhead.sidListBytes / d.totalPacketBytes) * totalW * 3.0);
  const payloadW = Math.max(160, totalW - (ipv6W + srhW + sidListW));

  // Node chain layout
  const nodeY = 220;
  const nodes = [
    { name: pol.ingressPe, role: 'Ingress PE (T.Encaps)', sid: 'Encapsulation' },
    ...(pol.segmentList || []).map(s => ({ name: s.node, role: s.behavior, sid: s.sid })),
    { name: pol.egressPe, role: 'Egress PE (' + pol.type.split('/')[1]?.trim() + ')', sid: 'Decapsulation' }
  ];

  const nodeCount = nodes.length;
  const nodeSpacing = (width - 120) / Math.max(1, nodeCount - 1);

  let nodesMarkup = '';
  nodes.forEach((n, idx) => {
    const nx = 60 + (idx * nodeSpacing);
    const isEgress = idx === nodeCount - 1;
    const isIngress = idx === 0;
    const isCurrentActive = (d.activeSegment && n.node === d.activeSegment.node);

    const nodeFill = isCurrentActive ? colActive : (isIngress ? colIpv6 : (isEgress ? colSid : '#6366f1'));

    nodesMarkup += `
      <g class="srv6-node" transform="translate(${nx}, ${nodeY})">
        <!-- Connecting Line -->
        ${idx < nodeCount - 1 ? `<line x1="0" y1="0" x2="${nodeSpacing}" y2="0" stroke="${borderCol}" stroke-width="3" stroke-dasharray="4,4"/>` : ''}
        <!-- Node Circle -->
        <circle cx="0" cy="0" r="${isCurrentActive ? 22 : 18}" fill="${nodeFill}" stroke="${textMain}" stroke-width="2.5" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.15))"/>
        <!-- Node Icon / Label -->
        <text x="0" y="5" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#ffffff" text-anchor="middle">N${idx + 1}</text>
        <!-- Node Details -->
        <text x="0" y="32" font-family="system-ui, sans-serif" font-size="10.5" font-weight="700" fill="${textMain}" text-anchor="middle">${n.name.split('-')[0] + '-' + (n.name.split('-')[1] || '')}</text>
        <text x="0" y="46" font-family="system-ui, sans-serif" font-size="9" fill="${textMuted}" text-anchor="middle">${n.role}</text>
        ${isCurrentActive ? `<polygon points="0,-28 -7,-38 7,-38" fill="${colActive}"/><text x="0" y="-42" font-family="system-ui, sans-serif" font-size="9.5" font-weight="700" fill="${colActive}" text-anchor="middle">ACTIVE SL: ${d.segmentsLeft}</text>` : ''}
      </g>
    `;
  });

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" class="srv6-svg" style="background:${bg}; border-radius:12px; width:100%; height:auto;">
      <defs>
        <linearGradient id="srv6HeaderGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.8"/>
          <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0.8"/>
        </linearGradient>
      </defs>

      <!-- Title & Status Ribbon -->
      <text x="40" y="34" font-family="system-ui, sans-serif" font-size="14" font-weight="800" fill="${textMain}">${pol.name}</text>
      <rect x="${width - 240}" y="18" width="200" height="24" rx="12" fill="${d.statusClass === 'optimal' ? '#10b98120' : (d.statusClass === 'critical' ? '#ef444420' : '#f59e0b20')}"/>
      <circle cx="${width - 226}" cy="30" r="5" fill="${d.statusClass === 'optimal' ? '#10b981' : (d.statusClass === 'critical' ? '#ef4444' : '#f59e0b')}"/>
      <text x="${width - 214}" y="34" font-family="system-ui, sans-serif" font-size="10" font-weight="700" fill="${d.statusClass === 'optimal' ? '#10b981' : (d.statusClass === 'critical' ? '#ef4444' : '#f59e0b')}">${d.status.split('(')[0].trim()}</text>

      <!-- Packet Header Layout (RFC 8754 Encapsulation) -->
      <g transform="translate(${startX}, ${stackY})">
        <!-- Outer IPv6 Header -->
        <rect x="0" y="0" width="${ipv6W}" height="${stackH}" rx="6" fill="${colIpv6}" opacity="0.9"/>
        <text x="${ipv6W / 2}" y="20" font-family="system-ui, sans-serif" font-size="10.5" font-weight="700" fill="#ffffff" text-anchor="middle">IPv6 Outer</text>
        <text x="${ipv6W / 2}" y="34" font-family="system-ui, sans-serif" font-size="9" fill="#ffffff" opacity="0.85" text-anchor="middle">${d.overhead.ipv6Base} B</text>

        <!-- SRH Base Header -->
        <rect x="${ipv6W + 4}" y="0" width="${srhW}" height="${stackH}" rx="6" fill="${colSrh}" opacity="0.9"/>
        <text x="${ipv6W + 4 + (srhW / 2)}" y="20" font-family="system-ui, sans-serif" font-size="10" font-weight="700" fill="#ffffff" text-anchor="middle">SRH Base</text>
        <text x="${ipv6W + 4 + (srhW / 2)}" y="34" font-family="system-ui, sans-serif" font-size="9" fill="#ffffff" opacity="0.85" text-anchor="middle">${d.overhead.srhBase} B</text>

        <!-- Segment List (SID List) -->
        <rect x="${ipv6W + srhW + 8}" y="0" width="${sidListW}" height="${stackH}" rx="6" fill="${colSid}" opacity="0.9"/>
        <text x="${ipv6W + srhW + 8 + (sidListW / 2)}" y="20" font-family="system-ui, sans-serif" font-size="10" font-weight="700" fill="#ffffff" text-anchor="middle">SID List [0..${d.segmentsCount - 1}]</text>
        <text x="${ipv6W + srhW + 8 + (sidListW / 2)}" y="34" font-family="system-ui, sans-serif" font-size="9" fill="#ffffff" opacity="0.85" text-anchor="middle">${d.overhead.sidListBytes} B (${d.useMicroSid ? 'uSID' : 'Classic'})</text>

        <!-- Inner Payload -->
        <rect x="${ipv6W + srhW + sidListW + 12}" y="0" width="${payloadW}" height="${stackH}" rx="6" fill="${colPayload}" opacity="0.9"/>
        <text x="${ipv6W + srhW + sidListW + 12 + (payloadW / 2)}" y="20" font-family="system-ui, sans-serif" font-size="10" font-weight="700" fill="#ffffff" text-anchor="middle">L3 / L2 Customer Payload</text>
        <text x="${ipv6W + srhW + sidListW + 12 + (payloadW / 2)}" y="34" font-family="system-ui, sans-serif" font-size="9" fill="#ffffff" opacity="0.85" text-anchor="middle">${d.payloadBytes} B</text>
      </g>

      <!-- Total Size vs MTU Label -->
      <g transform="translate(40, 130)">
        <text x="0" y="0" font-family="system-ui, sans-serif" font-size="11" fill="${textMuted}">Wire Packet: <tspan font-weight="700" fill="${textMain}">${d.totalPacketBytes} B</tspan> | Interface MTU: <tspan font-weight="700" fill="${textMain}">${d.interfaceMtu} B</tspan> | Headroom: <tspan font-weight="700" fill="${d.headroomBytes >= 0 ? '#10b981' : '#ef4444'}">${d.headroomBytes} B</tspan></text>
        <text x="${width - 80}" y="0" font-family="system-ui, sans-serif" font-size="11" fill="${textMuted}" text-anchor="end">SRv6 Overhead: <tspan font-weight="700" fill="${colSrh}">${d.overhead.totalOverhead} B (${d.overheadPercentage}%)</tspan></text>
      </g>

      <!-- Section Divider -->
      <line x1="40" y1="150" x2="${width - 40}" y2="150" stroke="${borderCol}" stroke-width="1"/>

      <!-- Node Chain Segment Routing Journey -->
      ${nodesMarkup}

      <!-- Bottom Telemetry HUD Ribbon -->
      <g transform="translate(40, 320)">
        <rect x="0" y="0" width="${width - 80}" height="64" rx="8" fill="${isDark ? '#1e293b' : '#f8fafc'}" stroke="${borderCol}" stroke-width="1"/>

        <!-- Cell 1: Active SID -->
        <text x="20" y="24" font-family="system-ui, sans-serif" font-size="9.5" fill="${textMuted}">ACTIVE SID POINTER</text>
        <text x="20" y="44" font-family="monospace" font-size="11" font-weight="700" fill="${colActive}">${d.activeSegment ? d.activeSegment.sid : 'Decapsulated'}</text>

        <!-- Cell 2: Behavior -->
        <text x="260" y="24" font-family="system-ui, sans-serif" font-size="9.5" fill="${textMuted}">NETWORK BEHAVIOR</text>
        <text x="260" y="44" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="${colSid}">${d.activeSegment ? d.activeSegment.behavior : 'Egress Termination'}</text>

        <!-- Cell 3: Effective PMTU -->
        <text x="460" y="24" font-family="system-ui, sans-serif" font-size="9.5" fill="${textMuted}">EFFECTIVE PMTU</text>
        <text x="460" y="44" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="${textMain}">${d.effectivePmtu} Bytes</text>

        <!-- Cell 4: Micro-SID Savings -->
        <text x="600" y="24" font-family="system-ui, sans-serif" font-size="9.5" fill="${textMuted}">uSID SAVINGS</text>
        <text x="600" y="44" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="${d.useMicroSid ? '#10b981' : textMuted}">${d.useMicroSid ? '+' + d.compressionSavingsPercent + '% (' + d.compressionSavingsBytes + 'B)' : 'Disabled'}</text>
      </g>
    </svg>
  `;
}

/**
 * Generate formatted ASCII audit report for SRv6 policy telemetry.
 */
export function generateSrv6Report(dynamics, options = {}) {
  const d = dynamics || calculateSrv6Dynamics();
  const pol = d.policy;

  const lines = [
    '================================================================================',
    '       SHAHDARA METRO CARRIER NETWORK - SRv6 RFC 8986/8754 AUDIT REPORT        ',
    '================================================================================',
    `Date & Time        : ${new Date().toISOString()}`,
    `Policy Identifier  : ${pol.id}`,
    `Policy Name        : ${pol.name}`,
    `Service Type       : ${pol.type}`,
    `Carrier Path       : ${pol.primaryArea} -> ${pol.targetArea}`,
    `Ingress / Egress   : ${pol.ingressPe} -> ${pol.egressPe}`,
    `Monthly Recurring  : ${formatPKR(pol.monthlyRevenuePkr)}`,
    '--------------------------------------------------------------------------------',
    'PACKET ENCAPSULATION & MTU HEADROOM TELEMETRY:',
    `  Payload Size           : ${d.payloadBytes} Bytes`,
    `  IPv6 Outer Base Header : ${d.overhead.ipv6Base} Bytes`,
    `  SRH Base Header        : ${d.overhead.srhBase} Bytes`,
    `  Segment List Overhead  : ${d.overhead.sidListBytes} Bytes (${d.segmentsCount} SIDs, ${d.overhead.mode})`,
    `  Total SRv6 Overhead    : ${d.overhead.totalOverhead} Bytes (${d.overheadPercentage}% of interface MTU)`,
    `  Total On-the-Wire Pkt  : ${d.totalPacketBytes} Bytes`,
    `  Interface MTU          : ${d.interfaceMtu} Bytes`,
    `  Headroom Available     : ${d.headroomBytes} Bytes`,
    `  Effective Path MTU     : ${d.effectivePmtu} Bytes`,
    `  Micro-SID Compression  : ${d.useMicroSid ? 'Active (Saved ' + d.compressionSavingsBytes + ' Bytes / ' + d.compressionSavingsPercent + '%)' : 'Disabled (Classic 128-bit SIDs)'}`,
    `  Forwarding Health      : ${d.status}`,
    '--------------------------------------------------------------------------------',
    'PROGRAMMED SEGMENT LIST (SRH ORDER):',
    ...(pol.segmentList || []).map((s, idx) => {
      const isCurrent = (d.activeSegment && s.sid === d.activeSegment.sid);
      return `  [SID ${idx}] ${s.sid} | ${s.behavior.padEnd(12)} | Node: ${s.node} ${isCurrent ? '<-- [ACTIVE]' : ''}\n         Desc: ${s.desc}`;
    }),
    '--------------------------------------------------------------------------------',
    `Processing Latency : ~${d.processingLatencyUs} us (Total path estimate: ~${d.estimatedLatencyMs} ms)`,
    'Compliant with IETF RFC 8754 (IPv6 SRH) and RFC 8986 (SRv6 Network Programming).',
    '================================================================================'
  ];

  return lines.join('\n');
}

/**
 * Export SRv6 telemetry snapshot to JSON string.
 */
export function exportSrv6Json(dynamics) {
  const d = dynamics || calculateSrv6Dynamics();
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    standard: 'IETF RFC 8986 / RFC 8754',
    policy: d.policy,
    overhead: d.overhead,
    telemetry: {
      payloadBytes: d.payloadBytes,
      interfaceMtu: d.interfaceMtu,
      totalPacketBytes: d.totalPacketBytes,
      headroomBytes: d.headroomBytes,
      effectivePmtu: d.effectivePmtu,
      overheadPercentage: d.overheadPercentage,
      useMicroSid: d.useMicroSid,
      compressionSavingsBytes: d.compressionSavingsBytes,
      compressionSavingsPercent: d.compressionSavingsPercent,
      activeSegment: d.activeSegment,
      estimatedLatencyMs: d.estimatedLatencyMs,
      status: d.status
    }
  }, null, 2);
}

/**
 * Export SRv6 telemetry snapshot to CSV string.
 */
export function exportSrv6Csv(dynamics) {
  const d = dynamics || calculateSrv6Dynamics();
  const pol = d.policy;

  const headers = [
    'PolicyId',
    'PolicyName',
    'ServiceType',
    'PrimaryArea',
    'TargetArea',
    'IngressPe',
    'EgressPe',
    'PayloadBytes',
    'InterfaceMtu',
    'TotalPacketBytes',
    'TotalOverheadBytes',
    'EffectivePmtu',
    'HeadroomBytes',
    'MicroSidEnabled',
    'SavingsPercent',
    'Status',
    'MonthlyRevenuePkr'
  ];

  const row = [
    `"${pol.id}"`,
    `"${pol.name}"`,
    `"${pol.type}"`,
    `"${pol.primaryArea}"`,
    `"${pol.targetArea}"`,
    `"${pol.ingressPe}"`,
    `"${pol.egressPe}"`,
    d.payloadBytes,
    d.interfaceMtu,
    d.totalPacketBytes,
    d.overhead.totalOverhead,
    d.effectivePmtu,
    d.headroomBytes,
    d.useMicroSid ? 'true' : 'false',
    d.compressionSavingsPercent,
    `"${d.status}"`,
    pol.monthlyRevenuePkr
  ];

  return headers.join(',') + '\n' + row.join(',');
}

/**
 * Modal and dashboard card UI controller for SRv6 Network Programming Matrix.
 */
export function setupSrv6Modal(state = {}, options = {}) {
  const doc = options.document || (typeof document !== 'undefined' ? document : null);
  if (!doc) return null;

  const modal = doc.getElementById('dashboardSrv6Modal');
  const openBtn = doc.getElementById('dashboardOpenSrv6ModalBtn');
  const closeBtn = doc.getElementById('dashboardSrv6ModalCloseBtn');

  const cardChart = doc.getElementById('dashboardSrv6Chart');
  const modalDiagram = doc.getElementById('srv6ModalDiagramContainer');

  const policySelect = doc.getElementById('srv6PolicySelect');
  const payloadSlider = doc.getElementById('srv6PayloadSlider');
  const payloadLabel = doc.getElementById('srv6PayloadLabel');
  const mtuSlider = doc.getElementById('srv6MtuSlider');
  const mtuLabel = doc.getElementById('srv6MtuLabel');
  const uSidToggle = doc.getElementById('srv6MicroSidToggle');
  const resetBtn = doc.getElementById('srv6ResetBtn');

  // Stats in modal
  const statStatus = doc.getElementById('srv6StatStatus');
  const statOverhead = doc.getElementById('srv6StatOverhead');
  const statPmtu = doc.getElementById('srv6StatPmtu');
  const statHeadroom = doc.getElementById('srv6StatHeadroom');
  const statSavings = doc.getElementById('srv6StatSavings');
  const statLatency = doc.getElementById('srv6StatLatency');

  // Action buttons
  const filterAreaBtn = doc.getElementById('srv6FilterAreaBtn');
  const exportJsonBtn = doc.getElementById('srv6ExportJsonBtn');
  const exportCsvBtn = doc.getElementById('srv6ExportCsvBtn');
  const copyReportBtn = doc.getElementById('srv6CopyReportBtn');

  function renderView() {
    const isDark = doc.documentElement && doc.documentElement.getAttribute('data-theme') === 'dark';
    const dyn = calculateSrv6Dynamics();

    // Render SVG into card
    if (cardChart) {
      cardChart.innerHTML = renderSrv6DiagramSvg(dyn, { isDark });
    }

    // Render SVG into modal
    if (modalDiagram) {
      modalDiagram.innerHTML = renderSrv6DiagramSvg(dyn, { isDark });
    }

    // Update modal stat HUD
    if (statStatus) {
      statStatus.textContent = dyn.status.split('(')[0].trim();
      statStatus.className = 'srv6-stat-val ' + dyn.statusClass;
    }
    if (statOverhead) {
      statOverhead.textContent = `${dyn.overhead.totalOverhead} B (${dyn.overheadPercentage}%)`;
    }
    if (statPmtu) {
      statPmtu.textContent = `${dyn.effectivePmtu} B`;
    }
    if (statHeadroom) {
      statHeadroom.textContent = `${dyn.headroomBytes} B`;
      statHeadroom.style.color = dyn.headroomBytes >= 0 ? 'var(--color-success, #10b981)' : 'var(--color-danger, #ef4444)';
    }
    if (statSavings) {
      statSavings.textContent = dyn.useMicroSid ? `+${dyn.compressionSavingsPercent}% (${dyn.compressionSavingsBytes}B)` : 'Disabled';
    }
    if (statLatency) {
      statLatency.textContent = `~${dyn.estimatedLatencyMs} ms`;
    }

    // Labels
    if (payloadLabel && payloadSlider) {
      payloadLabel.textContent = `${payloadSlider.value} Bytes`;
    }
    if (mtuLabel && mtuSlider) {
      mtuLabel.textContent = `${mtuSlider.value} Bytes`;
    }
  }

  // Event handlers
  if (policySelect) {
    policySelect.addEventListener('change', () => {
      setSrv6SelectedPolicyId(policySelect.value);
      if (payloadSlider) payloadSlider.value = getSrv6PayloadBytes();
      if (mtuSlider) mtuSlider.value = getSrv6InterfaceMtu();
      renderView();
    });
  }

  if (payloadSlider) {
    payloadSlider.addEventListener('input', () => {
      setSrv6PayloadBytes(payloadSlider.value);
      renderView();
    });
  }

  if (mtuSlider) {
    mtuSlider.addEventListener('input', () => {
      setSrv6InterfaceMtu(mtuSlider.value);
      renderView();
    });
  }

  if (uSidToggle) {
    uSidToggle.addEventListener('change', () => {
      setSrv6MicroSidMode(uSidToggle.checked);
      renderView();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      resetSrv6SimState();
      if (policySelect) policySelect.value = getSrv6SelectedPolicyId();
      if (payloadSlider) payloadSlider.value = getSrv6PayloadBytes();
      if (mtuSlider) mtuSlider.value = getSrv6InterfaceMtu();
      if (uSidToggle) uSidToggle.checked = getSrv6MicroSidMode();
      renderView();
      if (typeof options.onToast === 'function') {
        options.onToast('SRv6 policy parameters reset to baseline');
      }
    });
  }

  if (filterAreaBtn) {
    filterAreaBtn.addEventListener('click', () => {
      const dyn = calculateSrv6Dynamics();
      if (typeof options.onFilterArea === 'function') {
        options.onFilterArea(dyn.policy.primaryArea);
      }
      if (modal && typeof modal.close === 'function') {
        modal.close();
      }
    });
  }

  if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', () => {
      const jsonStr = exportSrv6Json();
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(jsonStr);
      }
      if (typeof options.onToast === 'function') {
        options.onToast('SRv6 JSON telemetry copied to clipboard');
      }
    });
  }

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      const csvStr = exportSrv6Csv();
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(csvStr);
      }
      if (typeof options.onToast === 'function') {
        options.onToast('SRv6 CSV telemetry copied to clipboard');
      }
    });
  }

  if (copyReportBtn) {
    copyReportBtn.addEventListener('click', () => {
      const report = generateSrv6Report();
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(report);
      }
      if (typeof options.onToast === 'function') {
        options.onToast('SRv6 RFC 8986 audit report copied to clipboard');
      }
    });
  }

  if (openBtn && modal) {
    openBtn.addEventListener('click', () => {
      if (policySelect) policySelect.value = getSrv6SelectedPolicyId();
      if (payloadSlider) payloadSlider.value = getSrv6PayloadBytes();
      if (mtuSlider) mtuSlider.value = getSrv6InterfaceMtu();
      if (uSidToggle) uSidToggle.checked = getSrv6MicroSidMode();
      renderView();
      if (typeof modal.showModal === 'function') {
        modal.showModal();
      } else {
        modal.setAttribute('open', '');
      }
    });
  }

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => {
      if (typeof modal.close === 'function') {
        modal.close();
      } else {
        modal.removeAttribute('open');
      }
    });
  }

  // Initial draw
  renderView();

  return {
    open: () => {
      if (modal) {
        if (typeof modal.showModal === 'function') modal.showModal();
        else modal.setAttribute('open', '');
        renderView();
      }
    },
    close: () => {
      if (modal) {
        if (typeof modal.close === 'function') modal.close();
        else modal.removeAttribute('open');
      }
    },
    render: renderView
  };
}
