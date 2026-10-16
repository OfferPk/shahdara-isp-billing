import { formatPKR } from './core.js';

/**
 * BGP Flowspec (RFC 5575 / RFC 8955) DDoS Mitigation & Dynamic Edge Rate-Limiting Matrix
 *
 * Dissemination of Flow Specification Rules (BGP Flowspec IPv4 AFI 1 / SAFI 133).
 * Models automated and operator-driven DDoS mitigation at carrier edge border routers
 * (Nayatel, PTCL, Transworld, StormFiber, Wateen) across Shahdara ISP transit points.
 *
 * Provides wire-speed hardware TCAM filtering, rate-limiting, and scrubbing redirection
 * against UDP 53 DNS amplification, NTP 123 monlist reflection, TCP SYN volumetric floods,
 * fragmented UDP storms, and ICMP sweeps, correlating edge transit health with Shahdara
 * subscriber revenue and local sector connectivity.
 */

export const FLOWSPEC_CONSTANTS = {
  AFI_SAFI: 'IPv4 Flowspec (AFI 1, SAFI 133)',
  DEFAULT_GATEWAY_ID: 'gw-01',
  DEFAULT_RULE_ID: 'fs-rule-01',
  DEFAULT_ATTACK_VECTOR: 'DNS_AMP',
  DEFAULT_ATTACK_VOLUME_GBPS: 45,
  MIN_ATTACK_VOLUME_GBPS: 0,
  MAX_ATTACK_VOLUME_GBPS: 150,
  DEFAULT_SCRUB_CAPACITY_GBPS: 60,
  MIN_SCRUB_CAPACITY_GBPS: 10,
  MAX_SCRUB_CAPACITY_GBPS: 100,

  RULE_ACTIONS: {
    DROP: 'Drop / Discard (0 bps)',
    RATE_LIMIT_10M: 'Rate-Limit (10 Mbps Ingress Policer)',
    RATE_LIMIT_50M: 'Rate-Limit (50 Mbps Ingress Policer)',
    SCRUB_REDIRECT: 'Redirect to Scrubbing Center VRF',
    DSCP_REMARK: 'DSCP Scavenger Remarking (CS1)'
  },

  ATTACK_VECTORS: {
    DNS_AMP: 'DNS Port 53 UDP Amplification Reflection',
    NTP_MONLIST: 'NTP Port 123 Monlist Amplification',
    SYN_FLOOD: 'TCP SYN Volumetric Flood (Port 80/443)',
    UDP_FRAG: 'Fragmented High-PPS UDP Volumetric Storm',
    ICMP_SWEEP: 'ICMP Echo Ping Flood & Subnet Sweep',
    BASELINE_CLEAN: 'Clean Carrier Transit Baseline (No Attack)'
  },

  STATUS: {
    OPTIMAL: 'Optimal',
    MITIGATING: 'Mitigating',
    CRITICAL: 'Critical'
  }
};

export const SHAHDARA_FLOWSPEC_GATEWAYS = [
  {
    id: 'gw-01',
    name: 'Nayatel 100G Border Gateway (AS23945)',
    role: 'Primary Upstream IP Transit',
    primaryArea: 'Shahdara Town',
    aliasAreas: ['Shahdara Town', 'Old Town', 'Railway Road'],
    capacityGbps: 100,
    routerModel: 'Cisco ASR 9904 (IOS-XR 7.8)',
    defaultAttackGbps: 45,
    defaultVector: 'DNS_AMP',
    scrubbingCapacityGbps: 60,
    tcamCapacityRules: 8000,
    baseLatencyMs: 4.2
  },
  {
    id: 'gw-02',
    name: 'PTCL Metro 40G Aggregation (AS17557)',
    role: 'Metro Distribution Gateway',
    primaryArea: 'Baradari Road',
    aliasAreas: ['Baradari Road', 'Bara Dari', 'Tariq Road'],
    capacityGbps: 40,
    routerModel: 'Juniper MX480 (Junos 22.4R2)',
    defaultAttackGbps: 20,
    defaultVector: 'SYN_FLOOD',
    scrubbingCapacityGbps: 30,
    tcamCapacityRules: 4000,
    baseLatencyMs: 6.8
  },
  {
    id: 'gw-03',
    name: 'Transworld 40G Commercial Gateway (AS38264)',
    role: 'Corporate & Low-Latency Core',
    primaryArea: 'Vandala Road',
    aliasAreas: ['Vandala Road', 'Wandala Road', 'Zia Town'],
    capacityGbps: 40,
    routerModel: 'Huawei NE40E-X8A (VRP 8.21)',
    defaultAttackGbps: 15,
    defaultVector: 'NTP_MONLIST',
    scrubbingCapacityGbps: 30,
    tcamCapacityRules: 4000,
    baseLatencyMs: 5.1
  },
  {
    id: 'gw-04',
    name: 'StormFiber 20G Redundant Border (AS133829)',
    role: 'Failover Transit Gateway',
    primaryArea: 'Jia Musa',
    aliasAreas: ['Jia Musa', 'Farrukhabad'],
    capacityGbps: 20,
    routerModel: 'Arista 7280R3 (EOS 4.29)',
    defaultAttackGbps: 8,
    defaultVector: 'UDP_FRAG',
    scrubbingCapacityGbps: 15,
    tcamCapacityRules: 2000,
    baseLatencyMs: 7.4
  },
  {
    id: 'gw-05',
    name: 'Wateen Telecom 10G Transit (AS24499)',
    role: 'Perimeter Access Uplink',
    primaryArea: 'Begum Kot',
    aliasAreas: ['Begum Kot', 'Kot Abdul Malik'],
    capacityGbps: 10,
    routerModel: 'Nokia 7750 SR-1s (SR OS 22.10)',
    defaultAttackGbps: 4,
    defaultVector: 'ICMP_SWEEP',
    scrubbingCapacityGbps: 10,
    tcamCapacityRules: 1000,
    baseLatencyMs: 9.3
  }
];

export const SHAHDARA_FLOWSPEC_RULES = [
  {
    id: 'fs-rule-01',
    name: 'FS-RULE-01: Discard UDP 53 DNS Amplification',
    matchSpec: 'proto udp, src-port 53, packet-len > 512, dst 182.180.0.0/22',
    action: 'DROP',
    actionLabel: 'Drop / Discard (0 bps)',
    targetVector: 'DNS_AMP',
    rateLimitBps: 0,
    tcamEntries: 4,
    priority: 100
  },
  {
    id: 'fs-rule-02',
    name: 'FS-RULE-02: Rate-limit NTP 123 Monlist to 10Mbps',
    matchSpec: 'proto udp, src-port 123, packet-len > 440, dst 182.180.0.0/22',
    action: 'RATE_LIMIT_10M',
    actionLabel: 'Rate-Limit (10 Mbps Ingress Policer)',
    targetVector: 'NTP_MONLIST',
    rateLimitBps: 10000000,
    tcamEntries: 4,
    priority: 90
  },
  {
    id: 'fs-rule-03',
    name: 'FS-RULE-03: Redirect TCP SYN Flood to Scrubbing Center',
    matchSpec: 'proto tcp, flags SYN & !ACK, dst-port 80|443, dst 182.180.4.0/24',
    action: 'SCRUB_REDIRECT',
    actionLabel: 'Redirect to Scrubbing Center VRF',
    targetVector: 'SYN_FLOOD',
    rateLimitBps: null,
    tcamEntries: 8,
    priority: 120
  },
  {
    id: 'fs-rule-04',
    name: 'FS-RULE-04: Discard Fragmented High-PPS UDP Storm',
    matchSpec: 'proto udp, flags +is-fragment, packet-len > 1200, dst 182.180.8.0/24',
    action: 'DROP',
    actionLabel: 'Drop / Discard (0 bps)',
    targetVector: 'UDP_FRAG',
    rateLimitBps: 0,
    tcamEntries: 6,
    priority: 110
  },
  {
    id: 'fs-rule-05',
    name: 'FS-RULE-05: Rate-limit ICMP Echo Sweeps to 50Mbps',
    matchSpec: 'proto icmp, icmp-type echo-request, dst 182.180.0.0/20',
    action: 'RATE_LIMIT_50M',
    actionLabel: 'Rate-Limit (50 Mbps Ingress Policer)',
    targetVector: 'ICMP_SWEEP',
    rateLimitBps: 50000000,
    tcamEntries: 2,
    priority: 80
  },
  {
    id: 'fs-rule-06',
    name: 'FS-RULE-06: DSCP Scavenger Remarking (Low Priority)',
    matchSpec: 'proto any, packet-len > 1400, dst 182.180.12.0/24',
    action: 'DSCP_REMARK',
    actionLabel: 'DSCP Scavenger Remarking (CS1)',
    targetVector: 'BASELINE_CLEAN',
    rateLimitBps: null,
    tcamEntries: 2,
    priority: 50
  }
];

// Interactive state variables
let currentSelectedGatewayId = FLOWSPEC_CONSTANTS.DEFAULT_GATEWAY_ID;
let currentSelectedRuleId = FLOWSPEC_CONSTANTS.DEFAULT_RULE_ID;
let currentAttackVector = FLOWSPEC_CONSTANTS.DEFAULT_ATTACK_VECTOR;
let currentAttackVolumeGbps = FLOWSPEC_CONSTANTS.DEFAULT_ATTACK_VOLUME_GBPS;
let currentScrubCapacityGbps = FLOWSPEC_CONSTANTS.DEFAULT_SCRUB_CAPACITY_GBPS;

export function getFlowspecSelectedGateway() {
  return currentSelectedGatewayId;
}

export function setFlowspecSelectedGateway(id) {
  if (SHAHDARA_FLOWSPEC_GATEWAYS.some(g => g.id === id)) {
    currentSelectedGatewayId = id;
    const gw = SHAHDARA_FLOWSPEC_GATEWAYS.find(g => g.id === id);
    if (gw) {
      currentAttackVolumeGbps = gw.defaultAttackGbps;
      currentAttackVector = gw.defaultVector;
      currentScrubCapacityGbps = gw.scrubbingCapacityGbps;
      const matchedRule = SHAHDARA_FLOWSPEC_RULES.find(r => r.targetVector === gw.defaultVector);
      if (matchedRule) {
        currentSelectedRuleId = matchedRule.id;
      }
    }
  }
}

export function getFlowspecSelectedRule() {
  return currentSelectedRuleId;
}

export function setFlowspecSelectedRule(ruleId) {
  if (SHAHDARA_FLOWSPEC_RULES.some(r => r.id === ruleId)) {
    currentSelectedRuleId = ruleId;
  }
}

export function getFlowspecAttackVector() {
  return currentAttackVector;
}

export function setFlowspecAttackVector(vector) {
  if (FLOWSPEC_CONSTANTS.ATTACK_VECTORS[vector]) {
    currentAttackVector = vector;
    const rule = SHAHDARA_FLOWSPEC_RULES.find(r => r.targetVector === vector);
    if (rule) {
      currentSelectedRuleId = rule.id;
    }
  }
}

export function getFlowspecAttackVolumeGbps() {
  return currentAttackVolumeGbps;
}

export function setFlowspecAttackVolumeGbps(vol) {
  const num = Number(vol);
  if (!Number.isNaN(num)) {
    currentAttackVolumeGbps = Math.max(
      FLOWSPEC_CONSTANTS.MIN_ATTACK_VOLUME_GBPS,
      Math.min(FLOWSPEC_CONSTANTS.MAX_ATTACK_VOLUME_GBPS, num)
    );
  }
}

export function getFlowspecScrubCapacityGbps() {
  return currentScrubCapacityGbps;
}

export function setFlowspecScrubCapacityGbps(cap) {
  const num = Number(cap);
  if (!Number.isNaN(num)) {
    currentScrubCapacityGbps = Math.max(
      FLOWSPEC_CONSTANTS.MIN_SCRUB_CAPACITY_GBPS,
      Math.min(FLOWSPEC_CONSTANTS.MAX_SCRUB_CAPACITY_GBPS, num)
    );
  }
}

export function resetFlowspecSimState() {
  currentSelectedGatewayId = FLOWSPEC_CONSTANTS.DEFAULT_GATEWAY_ID;
  currentSelectedRuleId = FLOWSPEC_CONSTANTS.DEFAULT_RULE_ID;
  currentAttackVector = FLOWSPEC_CONSTANTS.DEFAULT_ATTACK_VECTOR;
  currentAttackVolumeGbps = FLOWSPEC_CONSTANTS.DEFAULT_ATTACK_VOLUME_GBPS;
  currentScrubCapacityGbps = FLOWSPEC_CONSTANTS.DEFAULT_SCRUB_CAPACITY_GBPS;
}

/**
 * Calculates flowspec mitigation dynamics, hardware policer performance, and attack suppression.
 */
export function calculateFlowspecMitigation(gateway, rule, vector, attackVolumeGbps, scrubCapacityGbps) {
  const safeAttackVol = Math.max(0, attackVolumeGbps);
  const linkCap = gateway ? gateway.capacityGbps : 100;
  const isCleanBaseline = vector === 'BASELINE_CLEAN' || safeAttackVol === 0;

  let droppedBandwidthGbps = 0;
  let scrubbedBandwidthGbps = 0;
  let passedAttackBandwidthGbps = 0;
  let falsePositiveDropPercent = 0.05;
  let tcamUsedEntries = rule ? rule.tcamEntries * 8 : 32;
  let responseLatencyMs = (gateway ? gateway.baseLatencyMs : 5) + (safeAttackVol > linkCap * 0.5 ? 4.5 : 1.2);

  if (isCleanBaseline) {
    droppedBandwidthGbps = 0;
    scrubbedBandwidthGbps = 0;
    passedAttackBandwidthGbps = 0;
    falsePositiveDropPercent = 0;
  } else if (!rule) {
    // No active rule -> 100% of attack passes through to edge link
    passedAttackBandwidthGbps = safeAttackVol;
  } else {
    const isMatchingRule = rule.targetVector === vector;
    const matchMultiplier = isMatchingRule ? 1.0 : 0.35; // generic match vs specific match

    switch (rule.action) {
      case 'DROP': {
        droppedBandwidthGbps = Math.min(safeAttackVol, safeAttackVol * matchMultiplier * 0.995);
        passedAttackBandwidthGbps = Math.max(0, safeAttackVol - droppedBandwidthGbps);
        falsePositiveDropPercent = isMatchingRule ? 0.08 : 0.45;
        break;
      }
      case 'RATE_LIMIT_10M': {
        const rateLimitGbps = 0.01;
        droppedBandwidthGbps = Math.max(0, (safeAttackVol - rateLimitGbps) * matchMultiplier);
        passedAttackBandwidthGbps = safeAttackVol - droppedBandwidthGbps;
        falsePositiveDropPercent = isMatchingRule ? 0.12 : 0.60;
        break;
      }
      case 'RATE_LIMIT_50M': {
        const rateLimitGbps = 0.05;
        droppedBandwidthGbps = Math.max(0, (safeAttackVol - rateLimitGbps) * matchMultiplier);
        passedAttackBandwidthGbps = safeAttackVol - droppedBandwidthGbps;
        falsePositiveDropPercent = isMatchingRule ? 0.15 : 0.55;
        break;
      }
      case 'SCRUB_REDIRECT': {
        const availableScrub = Math.max(1, scrubCapacityGbps);
        const redirected = safeAttackVol * matchMultiplier;
        scrubbedBandwidthGbps = Math.min(redirected, availableScrub);
        droppedBandwidthGbps = scrubbedBandwidthGbps * 0.98; // 98% clean scrub
        const unscrubbedOverflow = Math.max(0, redirected - availableScrub);
        passedAttackBandwidthGbps = Math.max(0, (safeAttackVol - scrubbedBandwidthGbps) + unscrubbedOverflow * 0.5);
        falsePositiveDropPercent = isMatchingRule ? 0.02 : 0.20; // scrubbing center has lower false positive
        responseLatencyMs += 12.5; // redirection adds slight latency
        break;
      }
      case 'DSCP_REMARK': {
        // Remarking doesn't drop immediately, deprioritizes in downstream queues
        droppedBandwidthGbps = safeAttackVol * matchMultiplier * 0.40;
        passedAttackBandwidthGbps = safeAttackVol - droppedBandwidthGbps;
        falsePositiveDropPercent = 0.01;
        break;
      }
      default: {
        droppedBandwidthGbps = safeAttackVol * 0.5;
        passedAttackBandwidthGbps = safeAttackVol - droppedBandwidthGbps;
      }
    }
  }

  // Normal clean legitimate customer traffic passing through gateway
  const baselineCleanTrafficGbps = Math.min(linkCap * 0.4, linkCap - 10);
  const totalOfferedTrafficGbps = baselineCleanTrafficGbps + passedAttackBandwidthGbps;
  const linkSaturationPercent = Math.min(100, Math.round((totalOfferedTrafficGbps / linkCap) * 100));

  const tcamCapacity = gateway ? gateway.tcamCapacityRules : 4000;
  const tcamUtilizationPercent = Math.min(100, Math.round((tcamUsedEntries / tcamCapacity) * 1000) / 10);

  const edgeCpuLoadPercent = Math.min(
    100,
    Math.round(15 + (safeAttackVol / linkCap) * 35 + (droppedBandwidthGbps > 0 ? 12 : 0) + (linkSaturationPercent > 85 ? 30 : 5))
  );

  const mitigationEffectivenessPercent = isCleanBaseline
    ? 100
    : safeAttackVol > 0
    ? Math.round(((droppedBandwidthGbps + scrubbedBandwidthGbps) / safeAttackVol) * 100)
    : 100;

  let status = FLOWSPEC_CONSTANTS.STATUS.OPTIMAL;
  if (linkSaturationPercent >= 90 || passedAttackBandwidthGbps >= 15 || edgeCpuLoadPercent >= 85) {
    status = FLOWSPEC_CONSTANTS.STATUS.CRITICAL;
  } else if (safeAttackVol > 0 && (passedAttackBandwidthGbps > 2 || linkSaturationPercent >= 75)) {
    status = FLOWSPEC_CONSTANTS.STATUS.MITIGATING;
  }

  return {
    safeAttackVol,
    droppedBandwidthGbps: Math.round(droppedBandwidthGbps * 100) / 100,
    scrubbedBandwidthGbps: Math.round(scrubbedBandwidthGbps * 100) / 100,
    passedAttackBandwidthGbps: Math.round(passedAttackBandwidthGbps * 100) / 100,
    baselineCleanTrafficGbps: Math.round(baselineCleanTrafficGbps * 100) / 100,
    totalOfferedTrafficGbps: Math.round(totalOfferedTrafficGbps * 100) / 100,
    linkSaturationPercent,
    falsePositiveDropPercent: Math.round(falsePositiveDropPercent * 100) / 100,
    tcamUsedEntries,
    tcamCapacity,
    tcamUtilizationPercent,
    edgeCpuLoadPercent,
    responseLatencyMs: Math.round(responseLatencyMs * 10) / 10,
    mitigationEffectivenessPercent: Math.min(100, Math.max(0, mitigationEffectivenessPercent)),
    status
  };
}

/**
 * Calculates complete BGP Flowspec metrics, correlating with subscriber ledger and revenue.
 */
export function calculateFlowspecMetrics(state, options = {}) {
  const selectedGwId = options.gatewayId || currentSelectedGatewayId;
  const selectedRuleId = options.ruleId || currentSelectedRuleId;
  const selectedVector = options.vector || currentAttackVector;
  const attackVol = options.attackVolumeGbps !== undefined ? options.attackVolumeGbps : currentAttackVolumeGbps;
  const scrubCap = options.scrubCapacityGbps !== undefined ? options.scrubCapacityGbps : currentScrubCapacityGbps;

  const gateway = SHAHDARA_FLOWSPEC_GATEWAYS.find(g => g.id === selectedGwId) || SHAHDARA_FLOWSPEC_GATEWAYS[0];
  const rule = SHAHDARA_FLOWSPEC_RULES.find(r => r.id === selectedRuleId) || SHAHDARA_FLOWSPEC_RULES[0];

  const dynamics = calculateFlowspecMitigation(gateway, rule, selectedVector, attackVol, scrubCap);

  // Correlate with subscriber ledger in this gateway's sector
  const customers = Array.isArray(state?.customers) ? state.customers : [];
  const aliasAreas = gateway.aliasAreas || [gateway.primaryArea];

  const linkedCustomers = customers.filter(c => {
    if (c.archived) return false;
    const custArea = String(c.area || '').trim().toLowerCase();
    return aliasAreas.some(a => custArea === a.toLowerCase() || custArea.includes(a.toLowerCase()));
  });

  const totalSubscribers = linkedCustomers.length;
  const activeSubscribers = linkedCustomers.filter(c => String(c.serviceStatus || '').toLowerCase() === 'active').length;
  const offlineSubscribers = totalSubscribers - activeSubscribers;

  // Monthly revenue and total outstanding dues for linked sector
  let sectorMonthlyRevenue = 0;
  let sectorTotalDues = 0;

  linkedCustomers.forEach(cust => {
    const bills = Array.isArray(cust.bills) ? cust.bills : [];
    bills.forEach(bill => {
      const due = Number(bill.dueAmount) || 0;
      const payments = Array.isArray(bill.payments) ? bill.payments : [];
      const paid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) || (Number(bill.paidAmount) || 0);
      sectorMonthlyRevenue += due;
      sectorTotalDues += Math.max(0, due - paid);
    });
  });

  // Revenue at risk if edge link is saturated or collapsed by DDoS attack
  const riskFraction = dynamics.status === FLOWSPEC_CONSTANTS.STATUS.CRITICAL
    ? 0.90
    : dynamics.status === FLOWSPEC_CONSTANTS.STATUS.MITIGATING
    ? 0.25
    : 0.0;
  const revenueAtRisk = Math.round(sectorMonthlyRevenue * riskFraction);

  return {
    gateway,
    rule,
    vector: selectedVector,
    vectorLabel: FLOWSPEC_CONSTANTS.ATTACK_VECTORS[selectedVector] || selectedVector,
    attackVolumeGbps: dynamics.safeAttackVol,
    scrubCapacityGbps: scrubCap,
    dynamics,
    subscriberCorrelation: {
      totalSubscribers,
      activeSubscribers,
      offlineSubscribers,
      sectorMonthlyRevenue,
      sectorTotalDues,
      revenueAtRisk
    },
    gatewaysList: SHAHDARA_FLOWSPEC_GATEWAYS,
    rulesList: SHAHDARA_FLOWSPEC_RULES
  };
}

/**
 * Generates pure offline SVG architectural diagram of BGP Flowspec distribution and mitigation.
 */
export function renderFlowspecDiagramSvg(metrics, options = {}) {
  if (!metrics || !metrics.gateway) {
    return `<div class="otdr-empty-chart" style="padding: 24px; text-align: center; color: var(--text-muted, #64748b);">No BGP Flowspec metrics available.</div>`;
  }

  const { gateway, rule, vector, dynamics, attackVolumeGbps } = metrics;
  const isCompact = Boolean(options.compact);
  const width = isCompact ? 540 : 860;
  const height = isCompact ? 280 : 380;

  const isCritical = dynamics.status === FLOWSPEC_CONSTANTS.STATUS.CRITICAL;
  const isMitigating = dynamics.status === FLOWSPEC_CONSTANTS.STATUS.MITIGATING;

  const statusColor = isCritical ? '#ef4444' : isMitigating ? '#f59e0b' : '#10b981';
  const statusGlow = isCritical ? 'rgba(239, 68, 68, 0.25)' : isMitigating ? 'rgba(245, 158, 11, 0.25)' : 'rgba(16, 185, 129, 0.25)';

  // Visual layout coordinates
  const cloudX = isCompact ? 60 : 100;
  const cloudY = isCompact ? 60 : 80;

  const controllerX = isCompact ? 270 : 430;
  const controllerY = isCompact ? 50 : 70;

  const routerX = isCompact ? 270 : 430;
  const routerY = isCompact ? 170 : 210;

  const sinkX = isCompact ? 100 : 180;
  const sinkY = isCompact ? 230 : 310;

  const coreX = isCompact ? 470 : 740;
  const coreY = isCompact ? 170 : 210;

  // Bar sizes
  const tcamBarW = isCompact ? 120 : 180;
  const tcamFillW = Math.max(4, Math.round((dynamics.tcamUtilizationPercent / 100) * tcamBarW));

  const cpuBarW = isCompact ? 120 : 180;
  const cpuFillW = Math.max(4, Math.round((dynamics.edgeCpuLoadPercent / 100) * cpuBarW));

  const linkSatBarW = isCompact ? 120 : 180;
  const linkSatFillW = Math.max(4, Math.round((dynamics.linkSaturationPercent / 100) * linkSatBarW));

  return `
<svg class="flowspec-svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="BGP Flowspec DDoS Mitigation Architecture Diagram">
  <defs>
    <linearGradient id="fsBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#1e293b" />
    </linearGradient>
    <linearGradient id="attackStreamGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#ef4444" stop-opacity="0.9" />
      <stop offset="100%" stop-color="#f97316" stop-opacity="0.9" />
    </linearGradient>
    <linearGradient id="cleanStreamGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#10b981" stop-opacity="0.9" />
      <stop offset="100%" stop-color="#06b6d4" stop-opacity="0.9" />
    </linearGradient>
    <linearGradient id="dropStreamGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.8" />
      <stop offset="100%" stop-color="#64748b" stop-opacity="0.3" />
    </linearGradient>
    <filter id="fsGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="4" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Background Canvas -->
  <rect x="0" y="0" width="${width}" height="${height}" rx="10" fill="url(#fsBgGrad)" stroke="#334155" stroke-width="1.2" />

  <!-- Grid overlay -->
  <g stroke="#334155" stroke-width="0.5" stroke-dasharray="3,3" opacity="0.4">
    <line x1="0" y1="${height * 0.25}" x2="${width}" y2="${height * 0.25}" />
    <line x1="0" y1="${height * 0.5}" x2="${width}" y2="${height * 0.5}" />
    <line x1="0" y1="${height * 0.75}" x2="${width}" y2="${height * 0.75}" />
    <line x1="${width * 0.33}" y1="0" x2="${width * 0.33}" y2="${height}" />
    <line x1="${width * 0.66}" y1="0" x2="${width * 0.66}" y2="${height}" />
  </g>

  <!-- Title / Legend Bar -->
  <text x="18" y="24" fill="#f8fafc" font-size="${isCompact ? 11 : 13}" font-weight="700" letter-spacing="0.5">BGP FLOWSPEC RFC 5575 / 8955 EDGE MITIGATION ENGINE</text>
  <text x="${width - 18}" y="24" text-anchor="end" fill="${statusColor}" font-size="${isCompact ? 10 : 12}" font-weight="700">STATUS: ${dynamics.status.toUpperCase()}</text>

  <!-- 1. Upstream Transit / Attack Source Node -->
  <g class="fs-node fs-node-upstream" transform="translate(${cloudX}, ${cloudY})">
    <circle cx="0" cy="0" r="${isCompact ? 28 : 38}" fill="#1e293b" stroke="${attackVolumeGbps > 0 ? '#ef4444' : '#64748b'}" stroke-width="2" filter="url(#fsGlow)" />
    <text x="0" y="-8" text-anchor="middle" fill="#f1f5f9" font-size="${isCompact ? 9 : 11}" font-weight="700">UPSTREAM</text>
    <text x="0" y="6" text-anchor="middle" fill="#94a3b8" font-size="${isCompact ? 8 : 9}">${gateway.id.toUpperCase()}</text>
    <text x="0" y="20" text-anchor="middle" fill="#ef4444" font-size="${isCompact ? 8 : 10}" font-weight="700">${attackVolumeGbps} Gbps</text>
  </g>

  <!-- 2. BGP Route Reflector / Flowspec Controller Node -->
  <g class="fs-node fs-node-controller" transform="translate(${controllerX}, ${controllerY})">
    <rect x="${isCompact ? -70 : -95}" y="${isCompact ? -22 : -28}" width="${isCompact ? 140 : 190}" height="${isCompact ? 44 : 56}" rx="8" fill="#1e293b" stroke="#3b82f6" stroke-width="1.8" />
    <text x="0" y="-6" text-anchor="middle" fill="#60a5fa" font-size="${isCompact ? 9 : 11}" font-weight="700">FLOWSPEC CONTROLLER</text>
    <text x="0" y="10" text-anchor="middle" fill="#cbd5e1" font-size="${isCompact ? 8 : 9.5}">BGP NLRI AFI 1 / SAFI 133</text>
    <text x="0" y="${isCompact ? 22 : 25}" text-anchor="middle" fill="#10b981" font-size="${isCompact ? 7.5 : 8.5}">Rules Active: ${rule ? rule.id.toUpperCase() : 'NONE'}</text>
  </g>

  <!-- 3. Edge Border Router & Wire-speed Hardware TCAM -->
  <g class="fs-node fs-node-router" transform="translate(${routerX}, ${routerY})">
    <rect x="${isCompact ? -95 : -130}" y="${isCompact ? -32 : -42}" width="${isCompact ? 190 : 260}" height="${isCompact ? 64 : 84}" rx="10" fill="#0f172a" stroke="${statusColor}" stroke-width="2.2" />
    <text x="0" y="${isCompact ? -14 : -18}" text-anchor="middle" fill="#f8fafc" font-size="${isCompact ? 10 : 12.5}" font-weight="700">${gateway.name.split(' (')[0]}</text>
    <text x="0" y="${isCompact ? 0 : 2}" text-anchor="middle" fill="#94a3b8" font-size="${isCompact ? 8 : 10}">${gateway.routerModel}</text>
    <text x="0" y="${isCompact ? 16 : 22}" text-anchor="middle" fill="#38bdf8" font-size="${isCompact ? 8 : 9.5}">TCAM Wire-Speed Policer · ${rule ? rule.action : 'BYPASS'}</text>
  </g>

  <!-- 4. Scrubbing Center / Discard Sink -->
  <g class="fs-node fs-node-sink" transform="translate(${sinkX}, ${sinkY})">
    <rect x="${isCompact ? -50 : -65}" y="${isCompact ? -18 : -24}" width="${isCompact ? 100 : 130}" height="${isCompact ? 36 : 48}" rx="6" fill="#1e293b" stroke="#f59e0b" stroke-dasharray="3,3" stroke-width="1.5" />
    <text x="0" y="-2" text-anchor="middle" fill="#fbbf24" font-size="${isCompact ? 8.5 : 10.5}" font-weight="700">NULL0 / SCRUB</text>
    <text x="0" y="${isCompact ? 12 : 15}" text-anchor="middle" fill="#f8fafc" font-size="${isCompact ? 8 : 9.5}">-${dynamics.droppedBandwidthGbps} Gbps Dropped</text>
  </g>

  <!-- 5. Shahdara Core & Subscriber Metro Rings -->
  <g class="fs-node fs-node-core" transform="translate(${coreX}, ${coreY})">
    <circle cx="0" cy="0" r="${isCompact ? 28 : 38}" fill="#1e293b" stroke="#10b981" stroke-width="2" filter="url(#fsGlow)" />
    <text x="0" y="-8" text-anchor="middle" fill="#f1f5f9" font-size="${isCompact ? 9 : 11}" font-weight="700">SHAHDARA</text>
    <text x="0" y="6" text-anchor="middle" fill="#94a3b8" font-size="${isCompact ? 8 : 9}">CLEAN CORE</text>
    <text x="0" y="20" text-anchor="middle" fill="#10b981" font-size="${isCompact ? 8 : 10}" font-weight="700">${dynamics.baselineCleanTrafficGbps} Gbps</text>
  </g>

  <!-- CONNECTIONS & TRAFFIC STREAMS -->
  <!-- Controller to Router: BGP NLRI Update -->
  <path d="M ${controllerX} ${controllerY + (isCompact ? 22 : 28)} L ${routerX} ${routerY - (isCompact ? 32 : 42)}" stroke="#3b82f6" stroke-width="1.8" stroke-dasharray="4,4" fill="none" />
  <text x="${controllerX + 8}" y="${(controllerY + routerY) / 2}" fill="#60a5fa" font-size="8.5">BGP Dissemination (&lt;${dynamics.responseLatencyMs}ms)</text>

  <!-- Upstream to Router: Ingress Attack + Normal Traffic -->
  <path d="M ${cloudX + (isCompact ? 28 : 38)} ${cloudY} Q ${(cloudX + routerX) / 2} ${cloudY} ${routerX - (isCompact ? 95 : 130)} ${routerY}" stroke="url(#attackStreamGrad)" stroke-width="${Math.min(8, Math.max(2, attackVolumeGbps * 0.08))}" fill="none" opacity="0.85" />

  <!-- Router to Null0 Sink: Dropped Traffic -->
  <path d="M ${routerX - (isCompact ? 50 : 70)} ${routerY + (isCompact ? 32 : 42)} Q ${routerX - (isCompact ? 70 : 90)} ${sinkY} ${sinkX + (isCompact ? 50 : 65)} ${sinkY}" stroke="url(#dropStreamGrad)" stroke-width="${Math.min(7, Math.max(2, dynamics.droppedBandwidthGbps * 0.08))}" fill="none" stroke-dasharray="3,3" />

  <!-- Router to Core: Clean Forwarded Payload -->
  <path d="M ${routerX + (isCompact ? 95 : 130)} ${routerY} L ${coreX - (isCompact ? 28 : 38)} ${coreY}" stroke="url(#cleanStreamGrad)" stroke-width="4" fill="none" />

  <!-- METRIC GAUGES & BARS (BOTTOM SECTION) -->
  <g class="fs-bottom-gauges" transform="translate(24, ${height - (isCompact ? 50 : 60)})">
    <!-- TCAM Utilization -->
    <text x="0" y="0" fill="#94a3b8" font-size="${isCompact ? 8 : 9.5}">TCAM Entries: <tspan fill="#f8fafc" font-weight="700">${dynamics.tcamUsedEntries} / ${dynamics.tcamCapacity} (${dynamics.tcamUtilizationPercent}%)</tspan></text>
    <rect x="0" y="6" width="${tcamBarW}" height="6" rx="3" fill="#334155" />
    <rect x="0" y="6" width="${tcamFillW}" height="6" rx="3" fill="${dynamics.tcamUtilizationPercent > 75 ? '#ef4444' : '#38bdf8'}" />

    <!-- Edge CPU Load -->
    <text x="${isCompact ? 160 : 250}" y="0" fill="#94a3b8" font-size="${isCompact ? 8 : 9.5}">Edge CPU: <tspan fill="#f8fafc" font-weight="700">${dynamics.edgeCpuLoadPercent}%</tspan></text>
    <rect x="${isCompact ? 160 : 250}" y="6" width="${cpuBarW}" height="6" rx="3" fill="#334155" />
    <rect x="${isCompact ? 160 : 250}" y="6" width="${cpuFillW}" height="6" rx="3" fill="${dynamics.edgeCpuLoadPercent > 80 ? '#ef4444' : dynamics.edgeCpuLoadPercent > 50 ? '#f59e0b' : '#10b981'}" />

    <!-- Link Saturation -->
    <text x="${isCompact ? 320 : 500}" y="0" fill="#94a3b8" font-size="${isCompact ? 8 : 9.5}">Link Saturation: <tspan fill="#f8fafc" font-weight="700">${dynamics.linkSaturationPercent}% (${gateway.capacityGbps}G)</tspan></text>
    <rect x="${isCompact ? 320 : 500}" y="6" width="${linkSatBarW}" height="6" rx="3" fill="#334155" />
    <rect x="${isCompact ? 320 : 500}" y="6" width="${linkSatFillW}" height="6" rx="3" fill="${dynamics.linkSaturationPercent >= 90 ? '#ef4444' : dynamics.linkSaturationPercent >= 75 ? '#f59e0b' : '#10b981'}" />

    <!-- Mitigation Efficiency Indicator -->
    <text x="${width - 48}" y="10" text-anchor="end" fill="#94a3b8" font-size="${isCompact ? 8.5 : 10}">Mitigation Efficiency: <tspan fill="${statusColor}" font-weight="700">${dynamics.mitigationEffectivenessPercent}%</tspan></text>
  </g>
</svg>
  `.trim();
}

/**
 * Generates formatted text report for Shahdara ISP NOC and Security Team.
 */
export function generateFlowspecReport(metrics) {
  if (!metrics || !metrics.gateway) return 'No BGP Flowspec data recorded.';

  const { gateway, rule, vector, dynamics, attackVolumeGbps, subscriberCorrelation } = metrics;

  return `
================================================================================
SHAHDARA ISP · BGP FLOWSPEC (RFC 5575 / 8955) NOC SECURITY AUDIT BRIEFING
================================================================================
Generated: ${new Date().toISOString()} PKT
Border Gateway: ${gateway.name}
Router Hardware: ${gateway.routerModel}
Core Link Bandwidth: ${gateway.capacityGbps} Gbps
Primary Sector: ${gateway.primaryArea} (Aliases: ${(gateway.aliasAreas || []).join(', ')})
BGP NLRI Session: ${FLOWSPEC_CONSTANTS.AFI_SAFI}

[ INCIDENT THREAT & ATTACK VECTOR ]
--------------------------------------------------------------------------------
Attack Classification: ${metrics.vectorLabel}
Offered Attack Ingress: ${attackVolumeGbps} Gbps
Active Flowspec Rule: ${rule ? rule.name : 'NO RULE (Unmitigated)'}
Match Specification: ${rule ? rule.matchSpec : 'N/A'}
Action Policy: ${rule ? rule.actionLabel : 'Permit All (Unpoliced)'}

[ MITIGATION & HARDWARE POLICING TELEMETRY ]
--------------------------------------------------------------------------------
Mitigation Status: ${dynamics.status.toUpperCase()}
Attack Traffic Filtered/Dropped: ${dynamics.droppedBandwidthGbps} Gbps
Scrubbing Center Volume: ${dynamics.scrubbedBandwidthGbps} Gbps
Residual Leaked Attack Traffic: ${dynamics.passedAttackBandwidthGbps} Gbps
Clean Forwarded Bandwidth: ${dynamics.baselineCleanTrafficGbps} Gbps
Mitigation Effectiveness: ${dynamics.mitigationEffectivenessPercent}%
False-Positive Collateral Drop: ${dynamics.falsePositiveDropPercent}%
BGP Rule Dissemination Latency: ${dynamics.responseLatencyMs} ms
Edge Router TCAM Utilization: ${dynamics.tcamUsedEntries} / ${dynamics.tcamCapacity} entries (${dynamics.tcamUtilizationPercent}%)
Edge Router CPU Load: ${dynamics.edgeCpuLoadPercent}%
Border Link Saturation: ${dynamics.linkSaturationPercent}% of ${gateway.capacityGbps} Gbps

[ SUBSCRIBER LEDGER & REVENUE EXPOSURE ]
--------------------------------------------------------------------------------
Linked Sector Subscribers: ${subscriberCorrelation.totalSubscribers} (${subscriberCorrelation.activeSubscribers} Active, ${subscriberCorrelation.offlineSubscribers} Offline)
Sector Monthly Billed Revenue: ${formatPKR(subscriberCorrelation.sectorMonthlyRevenue)}
Sector Outstanding Dues: ${formatPKR(subscriberCorrelation.sectorTotalDues)}
Estimated Revenue At Risk: ${formatPKR(subscriberCorrelation.revenueAtRisk)}

[ RECOMMENDED NOC ACTIONS ]
--------------------------------------------------------------------------------
${
  dynamics.status === FLOWSPEC_CONSTANTS.STATUS.CRITICAL
    ? 'CRITICAL ALERT: Transit link saturation or edge CPU exceeded carrier SLA threshold! Immediately signal upstream transit providers (Nayatel/PTCL) to trigger BGP blackholing (RFC 7999 RTBH / AS65535:666) or scale scrubbing center VRF redirection capacity.'
    : dynamics.status === FLOWSPEC_CONSTANTS.STATUS.MITIGATING
    ? 'ACTIVE MITIGATION: BGP Flowspec rule is actively suppressing volumetric DDoS attack. Continue monitoring edge TCAM table capacity and verify that false-positive collateral drop remains < 0.2%.'
    : 'NORMAL CARRIER OPERATION: Edge border gateway is operating under baseline clean parameters. All Flowspec filtering rules primed in standby.'
}
================================================================================
`.trim();
}

/**
 * Initializes and wires the BGP Flowspec interactive modal dialog and card.
 */
export function setupFlowspecModal(state, options = {}) {
  const modal = document.getElementById('dashboardFlowspecModal');
  const openBtn = document.getElementById('dashboardOpenFlowspecModalBtn');
  const closeBtn = document.getElementById('dashboardFlowspecModalCloseBtn');

  const gwSelect = document.getElementById('flowspecGwSelect');
  const vectorSelect = document.getElementById('flowspecVectorSelect');
  const ruleSelect = document.getElementById('flowspecRuleSelect');
  const attackSlider = document.getElementById('flowspecAttackSlider');
  const attackValPill = document.getElementById('flowspecAttackVal');
  const scrubSlider = document.getElementById('flowspecScrubSlider');
  const scrubValPill = document.getElementById('flowspecScrubVal');
  const resetBtn = document.getElementById('flowspecResetBtn');

  // KPI elements
  const kpiGatewayName = document.getElementById('flowspecKpiGatewayName');
  const kpiMitigationState = document.getElementById('flowspecKpiMitigationState');
  const kpiEffectiveness = document.getElementById('flowspecKpiEffectiveness');
  const kpiStatusBadge = document.getElementById('flowspecStatusBadge');
  const kpiRevenueRisk = document.getElementById('flowspecKpiRevenueRisk');

  // Modal chart wrap & Table
  const chartWrap = document.getElementById('flowspecModalChartWrap');
  const rulesTableBody = document.getElementById('flowspecRulesTableBody');

  // Action buttons
  const filterAreaBtn = document.getElementById('flowspecFilterAreaBtn');
  const copyReportBtn = document.getElementById('dashboardCopyFlowspecReportBtn');

  // Dashboard card chart
  const cardChart = document.getElementById('dashboardFlowspecChart');

  function renderView() {
    const metrics = calculateFlowspecMetrics(state);

    // Update card chart if present
    if (cardChart) {
      cardChart.innerHTML = renderFlowspecDiagramSvg(metrics, { compact: true });
    }

    if (!modal) return;

    // Update KPI badges
    if (kpiGatewayName) {
      kpiGatewayName.textContent = metrics.gateway.name.split(' (')[0];
    }
    if (kpiMitigationState) {
      kpiMitigationState.textContent = metrics.dynamics.status.toUpperCase();
      kpiMitigationState.style.color =
        metrics.dynamics.status === FLOWSPEC_CONSTANTS.STATUS.CRITICAL
          ? '#ef4444'
          : metrics.dynamics.status === FLOWSPEC_CONSTANTS.STATUS.MITIGATING
          ? '#f59e0b'
          : '#10b981';
    }
    if (kpiEffectiveness) {
      kpiEffectiveness.textContent = `${metrics.dynamics.mitigationEffectivenessPercent}% (${metrics.dynamics.droppedBandwidthGbps}G drop)`;
    }
    if (kpiStatusBadge) {
      kpiStatusBadge.textContent = metrics.dynamics.status.toUpperCase();
      kpiStatusBadge.className = `sim-delta-badge badge-${
        metrics.dynamics.status === FLOWSPEC_CONSTANTS.STATUS.CRITICAL
          ? 'danger'
          : metrics.dynamics.status === FLOWSPEC_CONSTANTS.STATUS.MITIGATING
          ? 'warning'
          : 'success'
      }`;
    }
    if (kpiRevenueRisk) {
      kpiRevenueRisk.textContent = `${formatPKR(metrics.subscriberCorrelation.revenueAtRisk)} at risk`;
    }

    // Update diagram inside modal
    if (chartWrap) {
      chartWrap.innerHTML = renderFlowspecDiagramSvg(metrics, { compact: false });
    }

    // Update rules register table
    if (rulesTableBody) {
      rulesTableBody.innerHTML = metrics.rulesList
        .map(r => {
          const isSelected = r.id === metrics.rule.id;
          return `
            <tr class="${isSelected ? 'active-row' : ''}">
              <td><strong>${r.id.toUpperCase()}</strong></td>
              <td>${r.name.split(': ')[1] || r.name}</td>
              <td><code>${r.matchSpec}</code></td>
              <td><span class="fs-action-pill fs-action-${r.action.toLowerCase()}">${r.actionLabel}</span></td>
              <td>${r.tcamEntries} TCAM</td>
              <td>${isSelected ? '<span class="status-pill status-active">Active Disseminated</span>' : '<span class="status-pill">Standby</span>'}</td>
            </tr>
          `;
        })
        .join('');
    }
  }

  // Populate Select Dropdowns
  if (gwSelect) {
    gwSelect.innerHTML = SHAHDARA_FLOWSPEC_GATEWAYS.map(
      g => `<option value="${g.id}" ${g.id === currentSelectedGatewayId ? 'selected' : ''}>${g.name}</option>`
    ).join('');
    gwSelect.onchange = e => {
      setFlowspecSelectedGateway(e.target.value);
      if (attackSlider) attackSlider.value = currentAttackVolumeGbps;
      if (attackValPill) attackValPill.textContent = `${currentAttackVolumeGbps} Gbps`;
      if (scrubSlider) scrubSlider.value = currentScrubCapacityGbps;
      if (scrubValPill) scrubValPill.textContent = `${currentScrubCapacityGbps} Gbps`;
      if (vectorSelect) vectorSelect.value = currentAttackVector;
      if (ruleSelect) ruleSelect.value = currentSelectedRuleId;
      renderView();
    };
  }

  if (vectorSelect) {
    vectorSelect.innerHTML = Object.entries(FLOWSPEC_CONSTANTS.ATTACK_VECTORS).map(
      ([key, label]) => `<option value="${key}" ${key === currentAttackVector ? 'selected' : ''}>${label}</option>`
    ).join('');
    vectorSelect.onchange = e => {
      setFlowspecAttackVector(e.target.value);
      if (ruleSelect) ruleSelect.value = currentSelectedRuleId;
      renderView();
    };
  }

  if (ruleSelect) {
    ruleSelect.innerHTML = SHAHDARA_FLOWSPEC_RULES.map(
      r => `<option value="${r.id}" ${r.id === currentSelectedRuleId ? 'selected' : ''}>${r.name}</option>`
    ).join('');
    ruleSelect.onchange = e => {
      setFlowspecSelectedRule(e.target.value);
      renderView();
    };
  }

  if (attackSlider) {
    attackSlider.value = currentAttackVolumeGbps;
    attackSlider.oninput = e => {
      setFlowspecAttackVolumeGbps(e.target.value);
      if (attackValPill) attackValPill.textContent = `${currentAttackVolumeGbps} Gbps`;
      renderView();
    };
  }

  if (scrubSlider) {
    scrubSlider.value = currentScrubCapacityGbps;
    scrubSlider.oninput = e => {
      setFlowspecScrubCapacityGbps(e.target.value);
      if (scrubValPill) scrubValPill.textContent = `${currentScrubCapacityGbps} Gbps`;
      renderView();
    };
  }

  if (resetBtn) {
    resetBtn.onclick = () => {
      resetFlowspecSimState();
      if (gwSelect) gwSelect.value = currentSelectedGatewayId;
      if (vectorSelect) vectorSelect.value = currentAttackVector;
      if (ruleSelect) ruleSelect.value = currentSelectedRuleId;
      if (attackSlider) attackSlider.value = currentAttackVolumeGbps;
      if (attackValPill) attackValPill.textContent = `${currentAttackVolumeGbps} Gbps`;
      if (scrubSlider) scrubSlider.value = currentScrubCapacityGbps;
      if (scrubValPill) scrubValPill.textContent = `${currentScrubCapacityGbps} Gbps`;
      renderView();
      if (typeof options.onToast === 'function') {
        options.onToast('BGP Flowspec simulation reset to baseline parameters.');
      }
    };
  }

  if (openBtn && modal) {
    openBtn.onclick = () => {
      renderView();
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

  if (filterAreaBtn) {
    filterAreaBtn.onclick = () => {
      const metrics = calculateFlowspecMetrics(state);
      if (typeof options.onFilterArea === 'function') {
        options.onFilterArea(metrics.gateway.primaryArea);
      }
      if (modal && typeof modal.close === 'function') {
        modal.close();
      }
    };
  }

  if (copyReportBtn) {
    copyReportBtn.onclick = async () => {
      const metrics = calculateFlowspecMetrics(state);
      const text = generateFlowspecReport(metrics);
      try {
        if (options.clipboard && typeof options.clipboard.writeText === 'function') {
          await options.clipboard.writeText(text);
        } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(text);
        }
        if (typeof options.onToast === 'function') {
          options.onToast('BGP Flowspec NOC briefing copied to clipboard!');
        }
      } catch (err) {
        if (typeof options.onToast === 'function') {
          options.onToast('Failed to copy BGP Flowspec report.');
        }
      }
    };
  }

  // Initial render
  renderView();
}
