import { formatPKR } from './core.js';

/**
 * Carrier BGP Route Origin Validation (ROV / RFC 6811 / RFC 8210) &
 * Route Flap Damping (RFC 2439) Telemetry Matrix
 *
 * Models Resource Public Key Infrastructure (RPKI) cryptographic validation of BGP routes,
 * RPKI-to-Router (RTR) cache synchronization from Regional Internet Registries (APNIC, RIPE, ARIN),
 * prefix hijack mitigation (mismatched Origin AS & unauthorized de-aggregation exceeding MaxLength),
 * and BGP Route Flap Damping exponential half-life penalty decay across Shahdara ISP transit borders.
 *
 * Correlates core BGP routing stability and prefix security with Shahdara subscriber sector
 * connectivity and monthly billed revenue exposure.
 */

export const RPKI_CONSTANTS = {
  DEFAULT_GATEWAY_ID: 'rpki-gw-nayatel',
  DEFAULT_PREFIX_ID: 'prefix-shahdara-agg',
  DEFAULT_HIJACK_MODE: 'NORMAL',
  DEFAULT_ROV_POLICY: 'DROP_INVALID',
  DEFAULT_FLAPS_PER_MIN: 0,
  DEFAULT_ELAPSED_MINUTES: 0,

  // RFC 2439 Route Flap Damping parameters
  PENALTY_PER_FLAP: 1000,
  SUPPRESS_THRESHOLD: 2000,
  REUSE_THRESHOLD: 750,
  HALF_LIFE_MINUTES: 15,
  MAX_SUPPRESS_MINUTES: 60,

  HIJACK_MODES: {
    NORMAL: {
      id: 'NORMAL',
      label: 'Legitimate Carrier Announcement (Valid Origin ASN & Length)'
    },
    ORIGIN_MISMATCH: {
      id: 'ORIGIN_MISMATCH',
      label: 'BGP Prefix Hijack (Rogue Attacker ASN 65530 Announcement)'
    },
    MAX_LENGTH_EXCEEDED: {
      id: 'MAX_LENGTH_EXCEEDED',
      label: 'Unauthorized Subnet De-aggregation (Prefix Length > ROA MaxLength)'
    },
    UNCOVERED_PREFIX: {
      id: 'UNCOVERED_PREFIX',
      label: 'Unsigned Legacy Route (No ROA in RPKI Cache - Not Found)'
    }
  },

  ROV_POLICIES: {
    DROP_INVALID: {
      id: 'DROP_INVALID',
      label: 'Strict RFC 6811 Drop (Drop Invalid from Ingress BGP RIB)',
      action: 'DROP'
    },
    PREFERENCE_DEMOTE: {
      id: 'PREFERENCE_DEMOTE',
      label: 'BGP Local-Preference Demote (Lower LocPref from 100 to 50)',
      action: 'DEMOTE'
    },
    AUDIT_LOG_ONLY: {
      id: 'AUDIT_LOG_ONLY',
      label: 'Permissive Audit-Only (Install into FIB and Log Warning)',
      action: 'PERMIT'
    }
  },

  ROV_STATUS: {
    VALID: 'VALID',
    INVALID_ASN: 'INVALID (ASN Mismatch)',
    INVALID_LENGTH: 'INVALID (Max-Length Exceeded)',
    NOT_FOUND: 'NOT_FOUND (Unknown)'
  },

  DAMPING_STATUS: {
    UNSUPPRESSED: 'UNSUPPRESSED',
    DAMPED: 'DAMPED (Suppressed)',
    REUSE_PENDING: 'REUSE_PENDING'
  },

  OVERALL_STATUS: {
    OPTIMAL: 'Optimal',
    WARNING: 'Warning',
    CRITICAL: 'Critical'
  }
};

export const SHAHDARA_RPKI_GATEWAYS = [
  {
    id: 'rpki-gw-nayatel',
    name: 'Nayatel 100G Border Gateway (AS23945)',
    role: 'Primary Upstream IP Transit',
    primaryArea: 'Shahdara Town',
    aliasAreas: ['Shahdara Town', 'Old Town', 'Railway Road'],
    capacityGbps: 100,
    routerModel: 'Cisco ASR 9904 (IOS-XR 7.8)',
    validatorType: 'Routinator 3000 (Local Docker Cluster)',
    validatorHost: '192.168.10.25:3323',
    rtrProtocolVersion: 'RTRv2 (RFC 8210bis)',
    totalRoasInCache: 432500,
    rtrRefreshSeconds: 600,
    rtrLatencyMs: 0.85,
    defaultPrefix: 'prefix-shahdara-agg'
  },
  {
    id: 'rpki-gw-ptcl',
    name: 'PTCL Metro 40G Aggregation (AS17557)',
    role: 'Metro Distribution Gateway',
    primaryArea: 'Baradari Road',
    aliasAreas: ['Baradari Road', 'Bara Dari', 'Tariq Road'],
    capacityGbps: 40,
    routerModel: 'Juniper MX480 (Junos 22.4R2)',
    validatorType: 'Fort Validator (Hardware Appliance)',
    validatorHost: '10.200.4.12:3323',
    rtrProtocolVersion: 'RTRv1 (RFC 8210)',
    totalRoasInCache: 428100,
    rtrRefreshSeconds: 900,
    rtrLatencyMs: 1.42,
    defaultPrefix: 'prefix-ptcl-metro'
  },
  {
    id: 'rpki-gw-transworld',
    name: 'Transworld 40G Commercial Gateway (AS38264)',
    role: 'Subsea & Low-Latency Core',
    primaryArea: 'Vandala Road',
    aliasAreas: ['Vandala Road', 'Wandala Road', 'Zia Town'],
    capacityGbps: 40,
    routerModel: 'Huawei NE40E-X8A (VRP 8.21)',
    validatorType: 'rpki-client (OpenBSD Engine)',
    validatorHost: '172.16.8.5:3323',
    rtrProtocolVersion: 'RTRv2 (RFC 8210bis)',
    totalRoasInCache: 435800,
    rtrRefreshSeconds: 300,
    rtrLatencyMs: 0.62,
    defaultPrefix: 'prefix-tw-subsea'
  },
  {
    id: 'rpki-gw-stormfiber',
    name: 'StormFiber 20G Redundant Border (AS133829)',
    role: 'Failover Transit Gateway',
    primaryArea: 'Jia Musa',
    aliasAreas: ['Jia Musa', 'Farrukhabad'],
    capacityGbps: 20,
    routerModel: 'Nokia 7750 SR-1s (SR-OS 23.3)',
    validatorType: 'OctoRPKI Cluster (Cloudflare Engine)',
    validatorHost: '10.50.12.80:8282',
    rtrProtocolVersion: 'RTRv1 (RFC 8210)',
    totalRoasInCache: 419200,
    rtrRefreshSeconds: 1200,
    rtrLatencyMs: 2.15,
    defaultPrefix: 'prefix-cloud-edge'
  },
  {
    id: 'rpki-gw-wateen',
    name: 'Wateen 20G Enterprise Core (AS36107)',
    role: 'Corporate Backhaul Transit',
    primaryArea: 'Begum Kot',
    aliasAreas: ['Begum Kot', 'Kot Abdul Malik', 'Saeed Park'],
    capacityGbps: 20,
    routerModel: 'Arista 7280R3 (EOS 4.29)',
    validatorType: 'StayRTR Caching Proxy',
    validatorHost: '10.80.3.14:8282',
    rtrProtocolVersion: 'RTRv2 (RFC 8210bis)',
    totalRoasInCache: 424900,
    rtrRefreshSeconds: 600,
    rtrLatencyMs: 1.10,
    defaultPrefix: 'prefix-nayatel-fiber'
  }
];

export const SHAHDARA_RPKI_PREFIXES = [
  {
    id: 'prefix-shahdara-agg',
    prefix: '182.180.0.0/19',
    description: 'Shahdara Metro ISP Core Aggregate & Broadband Subnets',
    authoritativeAsn: 133829,
    authoritativeAsnName: 'Cybernet / StormFiber Pakistan',
    maxPrefixLength: 22,
    trustAnchor: 'APNIC (Asia Pacific Network Information Centre)',
    roaCreatedDate: '2022-04-15',
    roaExpiresDate: '2027-04-15',
    announcedSubnetsCount: 8,
    activeIpv4Addresses: 8192
  },
  {
    id: 'prefix-ptcl-metro',
    prefix: '116.71.0.0/16',
    description: 'PTCL Lahore Metro Broadband Distribution Pool',
    authoritativeAsn: 17557,
    authoritativeAsnName: 'Pakistan Telecommunication Company Ltd (PTCL)',
    maxPrefixLength: 19,
    trustAnchor: 'APNIC',
    roaCreatedDate: '2021-08-10',
    roaExpiresDate: '2026-08-10',
    announcedSubnetsCount: 16,
    activeIpv4Addresses: 65536
  },
  {
    id: 'prefix-nayatel-fiber',
    prefix: '175.107.0.0/18',
    description: 'Nayatel Fiber Transit & High-Speed FTTH Blocks',
    authoritativeAsn: 23945,
    authoritativeAsnName: 'Nayatel Pvt Ltd Islamabad/Lahore',
    maxPrefixLength: 20,
    trustAnchor: 'APNIC',
    roaCreatedDate: '2023-01-20',
    roaExpiresDate: '2028-01-20',
    announcedSubnetsCount: 4,
    activeIpv4Addresses: 16384
  },
  {
    id: 'prefix-tw-subsea',
    prefix: '202.163.64.0/20',
    description: 'Transworld Subsea International Transit Exchange',
    authoritativeAsn: 38264,
    authoritativeAsnName: 'Transworld Associates Pvt Ltd',
    maxPrefixLength: 24,
    trustAnchor: 'APNIC',
    roaCreatedDate: '2022-11-05',
    roaExpiresDate: '2027-11-05',
    announcedSubnetsCount: 16,
    activeIpv4Addresses: 4096
  },
  {
    id: 'prefix-cloud-edge',
    prefix: '103.255.4.0/22',
    description: 'Lahore Internet Exchange (LHR-IX) Cloud Edge Peering',
    authoritativeAsn: 133829,
    authoritativeAsnName: 'Shahdara Local ISP IXP Peer',
    maxPrefixLength: 22,
    trustAnchor: 'APNIC',
    roaCreatedDate: '2023-06-18',
    roaExpiresDate: '2028-06-18',
    announcedSubnetsCount: 1,
    activeIpv4Addresses: 1024
  }
];

const STORAGE_KEY = 'shahdara_rpki_rov_sim_state_v1';

// In-memory simulation fallback for headless / node testing
let inMemorySimState = {
  gatewayId: RPKI_CONSTANTS.DEFAULT_GATEWAY_ID,
  prefixId: RPKI_CONSTANTS.DEFAULT_PREFIX_ID,
  hijackMode: RPKI_CONSTANTS.DEFAULT_HIJACK_MODE,
  rovPolicy: RPKI_CONSTANTS.DEFAULT_ROV_POLICY,
  flapsPerMinute: RPKI_CONSTANTS.DEFAULT_FLAPS_PER_MIN,
  elapsedFlapMinutes: RPKI_CONSTANTS.DEFAULT_ELAPSED_MINUTES
};

function loadStoredState() {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const data = window.localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        return {
          gatewayId: parsed.gatewayId || inMemorySimState.gatewayId,
          prefixId: parsed.prefixId || inMemorySimState.prefixId,
          hijackMode: parsed.hijackMode || inMemorySimState.hijackMode,
          rovPolicy: parsed.rovPolicy || inMemorySimState.rovPolicy,
          flapsPerMinute: Number(parsed.flapsPerMinute) || inMemorySimState.flapsPerMinute,
          elapsedFlapMinutes: Number(parsed.elapsedFlapMinutes) || inMemorySimState.elapsedFlapMinutes
        };
      }
    } catch (e) {
      // Ignore parse errors and fallback
    }
  }
  return inMemorySimState;
}

function persistSimState(state) {
  inMemorySimState = { ...inMemorySimState, ...state };
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(inMemorySimState));
    } catch (e) {
      // Ignore quota errors
    }
  }
}

export function getRpkiSelectedGatewayId() {
  return loadStoredState().gatewayId;
}

export function setRpkiSelectedGatewayId(id) {
  if (SHAHDARA_RPKI_GATEWAYS.some(g => g.id === id)) {
    persistSimState({ gatewayId: id });
  }
}

export function getRpkiSelectedPrefixId() {
  return loadStoredState().prefixId;
}

export function setRpkiSelectedPrefixId(id) {
  if (SHAHDARA_RPKI_PREFIXES.some(p => p.id === id)) {
    persistSimState({ prefixId: id });
  }
}

export function getRpkiHijackSimulationMode() {
  return loadStoredState().hijackMode;
}

export function setRpkiHijackSimulationMode(mode) {
  if (RPKI_CONSTANTS.HIJACK_MODES[mode]) {
    persistSimState({ hijackMode: mode });
  }
}

export function getRpkiRovPolicyMode() {
  return loadStoredState().rovPolicy;
}

export function setRpkiRovPolicyMode(policy) {
  if (RPKI_CONSTANTS.ROV_POLICIES[policy]) {
    persistSimState({ rovPolicy: policy });
  }
}

export function getRpkiFlapsPerMinute() {
  return loadStoredState().flapsPerMinute;
}

export function setRpkiFlapsPerMinute(flaps) {
  const num = Math.max(0, Math.min(12, Number(flaps) || 0));
  persistSimState({ flapsPerMinute: num });
}

export function getRpkiElapsedFlapMinutes() {
  return loadStoredState().elapsedFlapMinutes;
}

export function setRpkiElapsedFlapMinutes(minutes) {
  const num = Math.max(0, Math.min(60, Number(minutes) || 0));
  persistSimState({ elapsedFlapMinutes: num });
}

export function resetRpkiSimState() {
  const resetObj = {
    gatewayId: RPKI_CONSTANTS.DEFAULT_GATEWAY_ID,
    prefixId: RPKI_CONSTANTS.DEFAULT_PREFIX_ID,
    hijackMode: RPKI_CONSTANTS.DEFAULT_HIJACK_MODE,
    rovPolicy: RPKI_CONSTANTS.DEFAULT_ROV_POLICY,
    flapsPerMinute: RPKI_CONSTANTS.DEFAULT_FLAPS_PER_MIN,
    elapsedFlapMinutes: RPKI_CONSTANTS.DEFAULT_ELAPSED_MINUTES
  };
  persistSimState(resetObj);
  return resetObj;
}

/**
 * Calculates RFC 2439 Route Flap Damping penalty decay, suppression status and reuse time.
 * P(t) = P_0 * 2^(-t / t_half)
 */
export function calculateRouteFlapDamping(flapsPerMinute = 0, elapsedMinutes = 0) {
  const flaps = Math.max(0, Number(flapsPerMinute) || 0);
  const elapsed = Math.max(0, Number(elapsedMinutes) || 0);

  const initialPenalty = flaps * RPKI_CONSTANTS.PENALTY_PER_FLAP;
  // Exponential half-life decay: factor = 2^(-elapsed / half_life)
  const decayFactor = Math.pow(2, -elapsed / RPKI_CONSTANTS.HALF_LIFE_MINUTES);
  const currentPenalty = Math.round(initialPenalty * decayFactor);

  const isDamped = currentPenalty >= RPKI_CONSTANTS.SUPPRESS_THRESHOLD;
  const isReusePending = !isDamped && currentPenalty > RPKI_CONSTANTS.REUSE_THRESHOLD && initialPenalty >= RPKI_CONSTANTS.SUPPRESS_THRESHOLD;

  let dampingStatus = RPKI_CONSTANTS.DAMPING_STATUS.UNSUPPRESSED;
  if (isDamped) {
    dampingStatus = RPKI_CONSTANTS.DAMPING_STATUS.DAMPED;
  } else if (isReusePending) {
    dampingStatus = RPKI_CONSTANTS.DAMPING_STATUS.REUSE_PENDING;
  }

  // Time in minutes required for penalty to decay from current to reuse threshold (750)
  let minutesToReuse = 0;
  if (currentPenalty > RPKI_CONSTANTS.REUSE_THRESHOLD) {
    // 750 = P * 2^(-t / 15) => t = 15 * log2(P / 750)
    minutesToReuse = Math.max(0, Math.round(RPKI_CONSTANTS.HALF_LIFE_MINUTES * Math.log2(currentPenalty / RPKI_CONSTANTS.REUSE_THRESHOLD) * 10) / 10);
  }

  // Flap curve points across 0 to 60 minutes for SVG graph
  const curvePoints = [];
  for (let m = 0; m <= 60; m += 5) {
    const p = Math.round(initialPenalty * Math.pow(2, -m / RPKI_CONSTANTS.HALF_LIFE_MINUTES));
    curvePoints.push({ minute: m, penalty: p });
  }

  return {
    flapsPerMinute: flaps,
    elapsedMinutes: elapsed,
    initialPenalty,
    currentPenalty,
    suppressThreshold: RPKI_CONSTANTS.SUPPRESS_THRESHOLD,
    reuseThreshold: RPKI_CONSTANTS.REUSE_THRESHOLD,
    halfLifeMinutes: RPKI_CONSTANTS.HALF_LIFE_MINUTES,
    dampingStatus,
    isDamped,
    isReusePending,
    minutesToReuse,
    curvePoints
  };
}

/**
 * Calculates RFC 6811 BGP Prefix Origin Validation (ROV) state and forwarding disposition.
 */
export function calculateRovValidationState(prefixObj, hijackMode = 'NORMAL', rovPolicy = 'DROP_INVALID') {
  if (!prefixObj) return null;

  let announcedAsn = prefixObj.authoritativeAsn;
  let announcedPrefix = prefixObj.prefix;
  let announcedLength = parseInt(prefixObj.prefix.split('/')[1], 10);
  let rovState = RPKI_CONSTANTS.ROV_STATUS.VALID;
  let explanation = 'BGP route announcement strictly conforms to cryptographically verified ROA in RPKI cache.';

  if (hijackMode === 'ORIGIN_MISMATCH') {
    announcedAsn = 65530; // Rogue AS
    rovState = RPKI_CONSTANTS.ROV_STATUS.INVALID_ASN;
    explanation = `ROV INVALID: Origin AS ${announcedAsn} does NOT match authoritative ROA ASN ${prefixObj.authoritativeAsn}. Probable prefix hijack or upstream route leak!`;
  } else if (hijackMode === 'MAX_LENGTH_EXCEEDED') {
    // De-aggregated /24 when MaxLength is /22 or /20
    const baseIp = prefixObj.prefix.split('/')[0];
    announcedLength = 24;
    announcedPrefix = `${baseIp}/24`;
    rovState = RPKI_CONSTANTS.ROV_STATUS.INVALID_LENGTH;
    explanation = `ROV INVALID: Announced prefix length /${announcedLength} exceeds ROA MaxLength /${prefixObj.maxPrefixLength}. Unauthorized de-aggregation detected!`;
  } else if (hijackMode === 'UNCOVERED_PREFIX') {
    rovState = RPKI_CONSTANTS.ROV_STATUS.NOT_FOUND;
    explanation = 'ROV NOT_FOUND: No cryptographically signed ROA found in RPKI cache for this prefix. Unsigned legacy announcement.';
  }

  // Forwarding decision based on ROV state and router policy
  let fibForwardingAction = 'INSTALLED'; // 'INSTALLED', 'DROPPED', 'DEMOTED'
  let localPreference = 100;
  let forwardExplanation = '';

  const isInvalid = rovState.startsWith('INVALID');

  if (isInvalid) {
    if (rovPolicy === 'DROP_INVALID') {
      fibForwardingAction = 'DROPPED';
      localPreference = 0;
      forwardExplanation = 'BGP route rejected by RFC 6811 ingress filter. Prefix not installed in Forwarding Information Base (FIB).';
    } else if (rovPolicy === 'PREFERENCE_DEMOTE') {
      fibForwardingAction = 'DEMOTED';
      localPreference = 50;
      forwardExplanation = 'BGP route installed with lowered Local-Preference (50 vs 100), serving as lowest-priority fallback.';
    } else {
      fibForwardingAction = 'INSTALLED';
      localPreference = 100;
      forwardExplanation = 'Permissive audit-only policy. Route installed into FIB without suppression, incurring hijack exposure.';
    }
  } else if (rovState === RPKI_CONSTANTS.ROV_STATUS.NOT_FOUND) {
    fibForwardingAction = 'INSTALLED';
    localPreference = 100;
    forwardExplanation = 'Uncovered prefix installed into FIB under RFC 6811 Not-Found acceptance rule.';
  } else {
    fibForwardingAction = 'INSTALLED';
    localPreference = 100;
    forwardExplanation = 'Valid route fully installed into hardware FIB with standard Local-Preference 100.';
  }

  return {
    announcedPrefix,
    announcedLength,
    announcedAsn,
    authoritativeAsn: prefixObj.authoritativeAsn,
    maxPrefixLength: prefixObj.maxPrefixLength,
    rovState,
    isInvalid,
    isValid: rovState === RPKI_CONSTANTS.ROV_STATUS.VALID,
    isNotFound: rovState === RPKI_CONSTANTS.ROV_STATUS.NOT_FOUND,
    rovPolicy,
    fibForwardingAction,
    localPreference,
    explanation,
    forwardExplanation
  };
}

/**
 * Computes consolidated RPKI & Route Flap Damping dynamics.
 */
export function calculateRpkiDynamics(gateway, prefix, hijackMode, rovPolicy, flapsPerMin, elapsedMin) {
  const damping = calculateRouteFlapDamping(flapsPerMin, elapsedMin);
  const rov = calculateRovValidationState(prefix, hijackMode, rovPolicy);

  // Overall system health status
  let overallStatus = RPKI_CONSTANTS.OVERALL_STATUS.OPTIMAL;
  if (damping.isDamped || (rov.isInvalid && rov.fibForwardingAction === 'INSTALLED')) {
    overallStatus = RPKI_CONSTANTS.OVERALL_STATUS.CRITICAL;
  } else if (damping.isReusePending || rov.isInvalid || rov.isNotFound) {
    overallStatus = RPKI_CONSTANTS.OVERALL_STATUS.WARNING;
  }

  // Final datapath reachability
  let isTrafficForwarded = true;
  let datapathReason = 'Traffic passing normally over verified BGP path.';

  if (damping.isDamped) {
    isTrafficForwarded = false;
    datapathReason = 'Route is DAMPED under RFC 2439 penalty suppression. All egress packets dropped.';
  } else if (rov.fibForwardingAction === 'DROPPED') {
    isTrafficForwarded = false;
    datapathReason = 'Route dropped due to strict ROV INVALID discard policy. Path isolated.';
  } else if (rov.fibForwardingAction === 'DEMOTED') {
    isTrafficForwarded = true;
    datapathReason = 'Traffic forwarded via demoted low-preference path (LocPref 50).';
  } else if (rov.isInvalid && rov.fibForwardingAction === 'INSTALLED') {
    isTrafficForwarded = true;
    datapathReason = 'Traffic forwarded directly into HIJACKED path! High risk of traffic interception/blackholing.';
  }

  return {
    damping,
    rov,
    overallStatus,
    isTrafficForwarded,
    datapathReason,
    rtrCacheHealth: {
      totalRoas: gateway.totalRoasInCache,
      validatorHost: gateway.validatorHost,
      validatorType: gateway.validatorType,
      rtrLatencyMs: gateway.rtrLatencyMs,
      rtrProtocolVersion: gateway.rtrProtocolVersion
    }
  };
}

/**
 * Calculates complete RPKI ROV and Route Flap Damping metrics correlated with subscriber ledger.
 */
export function calculateRpkiMetrics(state = {}, options = {}) {
  const current = loadStoredState();
  const gatewayId = options.gatewayId || current.gatewayId;
  const prefixId = options.prefixId || current.prefixId;
  const hijackMode = options.hijackMode || current.hijackMode;
  const rovPolicy = options.rovPolicy || current.rovPolicy;
  const flapsPerMin = options.flapsPerMinute !== undefined ? options.flapsPerMinute : current.flapsPerMinute;
  const elapsedMin = options.elapsedFlapMinutes !== undefined ? options.elapsedFlapMinutes : current.elapsedFlapMinutes;

  const gateway = SHAHDARA_RPKI_GATEWAYS.find(g => g.id === gatewayId) || SHAHDARA_RPKI_GATEWAYS[0];
  const prefix = SHAHDARA_RPKI_PREFIXES.find(p => p.id === prefixId) || SHAHDARA_RPKI_PREFIXES[0];

  const dynamics = calculateRpkiDynamics(gateway, prefix, hijackMode, rovPolicy, flapsPerMin, elapsedMin);

  // Correlate with subscribers in this border gateway's primary/alias sectors
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

  // Risk fraction calculation based on BGP routing exposure
  let riskFraction = 0.0;
  if (dynamics.overallStatus === RPKI_CONSTANTS.OVERALL_STATUS.CRITICAL) {
    riskFraction = dynamics.damping.isDamped ? 0.85 : 0.70;
  } else if (dynamics.overallStatus === RPKI_CONSTANTS.OVERALL_STATUS.WARNING) {
    riskFraction = dynamics.rov.fibForwardingAction === 'DEMOTED' ? 0.20 : 0.15;
  }

  const revenueAtRisk = Math.round(sectorMonthlyRevenue * riskFraction);

  return {
    gateway,
    prefix,
    hijackMode,
    rovPolicy,
    flapsPerMinute: flapsPerMin,
    elapsedFlapMinutes: elapsedMin,
    dynamics,
    subscriberCorrelation: {
      totalSubscribers,
      activeSubscribers,
      offlineSubscribers,
      sectorMonthlyRevenue,
      sectorTotalDues,
      revenueAtRisk,
      riskFraction
    },
    gatewaysList: SHAHDARA_RPKI_GATEWAYS,
    prefixesList: SHAHDARA_RPKI_PREFIXES
  };
}

/**
 * Pure offline vector SVG visualizer for RPKI ROV and Route Flap Damping.
 */
export function renderRpkiDiagramSvg(metrics, options = {}) {
  if (!metrics || !metrics.gateway || !metrics.dynamics) {
    return `<div class="otdr-empty-chart" style="padding: 24px; text-align: center; color: var(--text-muted, #64748b);">No RPKI metrics available.</div>`;
  }

  const isCompact = Boolean(options.compact);
  const isDark = Boolean(options.isDark !== undefined ? options.isDark : true);

  const width = isCompact ? 560 : 860;
  const height = isCompact ? 280 : 380;

  const { gateway, prefix, dynamics } = metrics;
  const { rov, damping, overallStatus } = dynamics;

  const bgGradStart = isDark ? '#0f172a' : '#f8fafc';
  const bgGradEnd = isDark ? '#1e293b' : '#e2e8f0';
  const strokeGrid = isDark ? '#334155' : '#cbd5e1';
  const textColor = isDark ? '#f8fafc' : '#0f172a';
  const textMuted = isDark ? '#94a3b8' : '#64748b';

  const statusColor = overallStatus === RPKI_CONSTANTS.OVERALL_STATUS.CRITICAL
    ? '#ef4444'
    : overallStatus === RPKI_CONSTANTS.OVERALL_STATUS.WARNING
    ? '#f59e0b'
    : '#10b981';

  // Flap penalty graph coordinates
  const graphX = isCompact ? 300 : 470;
  const graphY = isCompact ? 50 : 60;
  const graphW = isCompact ? 230 : 350;
  const graphH = isCompact ? 160 : 230;

  const maxPenalty = 6000;
  const suppressY = graphY + graphH - (RPKI_CONSTANTS.SUPPRESS_THRESHOLD / maxPenalty) * graphH;
  const reuseY = graphY + graphH - (RPKI_CONSTANTS.REUSE_THRESHOLD / maxPenalty) * graphH;

  // Build decay curve path
  const curvePoints = damping.curvePoints || [];
  let pathD = '';
  curvePoints.forEach((pt, idx) => {
    const px = graphX + (pt.minute / 60) * graphW;
    const clampedP = Math.min(maxPenalty, Math.max(0, pt.penalty));
    const py = graphY + graphH - (clampedP / maxPenalty) * graphH;
    if (idx === 0) {
      pathD += `M ${px} ${py}`;
    } else {
      pathD += ` L ${px} ${py}`;
    }
  });

  // Current penalty point
  const curPx = graphX + (Math.min(60, damping.elapsedMinutes) / 60) * graphW;
  const curClampedP = Math.min(maxPenalty, Math.max(0, damping.currentPenalty));
  const curPy = graphY + graphH - (curClampedP / maxPenalty) * graphH;

  // ROV Flow Panel coordinates
  const flowLeftX = isCompact ? 20 : 30;
  const boxW = isCompact ? 120 : 180;
  const boxH = isCompact ? 52 : 64;

  const trustY = isCompact ? 50 : 60;
  const rtrY = isCompact ? 120 : 150;
  const borderY = isCompact ? 190 : 240;

  return `
<svg class="rpki-svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="BGP Route Origin Validation and Flap Damping Diagram">
  <defs>
    <linearGradient id="rpkiBgGrad_${isDark ? 'd' : 'l'}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bgGradStart}" />
      <stop offset="100%" stop-color="${bgGradEnd}" />
    </linearGradient>
    <linearGradient id="curveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#ef4444" />
      <stop offset="50%" stop-color="#f59e0b" />
      <stop offset="100%" stop-color="#10b981" />
    </linearGradient>
    <filter id="rpkiGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Background -->
  <rect x="0" y="0" width="${width}" height="${height}" rx="10" fill="url(#rpkiBgGrad_${isDark ? 'd' : 'l'})" stroke="${strokeGrid}" stroke-width="1.2" />

  <!-- Left: RPKI Architecture & ROV Flow -->
  <g id="rpkiFlowNodes">
    <!-- Trust Anchor Node -->
    <rect x="${flowLeftX}" y="${trustY}" width="${boxW}" height="${boxH}" rx="6" fill="${isDark ? '#1e293b' : '#ffffff'}" stroke="#3b82f6" stroke-width="1.5" />
    <text x="${flowLeftX + 10}" y="${trustY + 18}" font-size="${isCompact ? 10 : 12}" font-weight="700" fill="#3b82f6">Trust Anchor (TAL)</text>
    <text x="${flowLeftX + 10}" y="${trustY + 34}" font-size="${isCompact ? 9 : 10}" fill="${textColor}">${prefix.trustAnchor.split(' ')[0]}</text>
    <text x="${flowLeftX + 10}" y="${trustY + 48}" font-size="${isCompact ? 8 : 9}" fill="${textMuted}">Cryptographic ROA Store</text>

    <!-- Downward Arrow 1 -->
    <line x1="${flowLeftX + boxW / 2}" y1="${trustY + boxH}" x2="${flowLeftX + boxW / 2}" y2="${rtrY}" stroke="#3b82f6" stroke-width="2" stroke-dasharray="3,3" />
    <polygon points="${flowLeftX + boxW / 2 - 4},${rtrY - 2} ${flowLeftX + boxW / 2 + 4},${rtrY - 2} ${flowLeftX + boxW / 2},${rtrY + 4}" fill="#3b82f6" />

    <!-- RTR Validator Cache Node -->
    <rect x="${flowLeftX}" y="${rtrY}" width="${boxW}" height="${boxH}" rx="6" fill="${isDark ? '#1e293b' : '#ffffff'}" stroke="#06b6d4" stroke-width="1.5" />
    <text x="${flowLeftX + 10}" y="${rtrY + 18}" font-size="${isCompact ? 10 : 12}" font-weight="700" fill="#06b6d4">RTR Cache Engine</text>
    <text x="${flowLeftX + 10}" y="${rtrY + 34}" font-size="${isCompact ? 9 : 10}" fill="${textColor}">${gateway.validatorType.split(' ')[0]} · RFC 8210</text>
    <text x="${flowLeftX + 10}" y="${rtrY + 48}" font-size="${isCompact ? 8 : 9}" fill="${textMuted}">${gateway.totalRoasInCache.toLocaleString()} Valid ROAs</text>

    <!-- Downward Arrow 2 -->
    <line x1="${flowLeftX + boxW / 2}" y1="${rtrY + boxH}" x2="${flowLeftX + boxW / 2}" y2="${borderY}" stroke="#06b6d4" stroke-width="2" stroke-dasharray="3,3" />
    <polygon points="${flowLeftX + boxW / 2 - 4},${borderY - 2} ${flowLeftX + boxW / 2 + 4},${borderY - 2} ${flowLeftX + boxW / 2},${borderY + 4}" fill="#06b6d4" />

    <!-- Border BGP Router Node -->
    <rect x="${flowLeftX}" y="${borderY}" width="${boxW}" height="${boxH}" rx="6" fill="${isDark ? '#1e293b' : '#ffffff'}" stroke="${statusColor}" stroke-width="1.8" />
    <text x="${flowLeftX + 10}" y="${borderY + 18}" font-size="${isCompact ? 10 : 12}" font-weight="700" fill="${statusColor}">Border BGP FIB</text>
    <text x="${flowLeftX + 10}" y="${borderY + 34}" font-size="${isCompact ? 9 : 10}" font-weight="600" fill="${textColor}">${rov.fibForwardingAction} (LocPref ${rov.localPreference})</text>
    <text x="${flowLeftX + 10}" y="${borderY + 48}" font-size="${isCompact ? 8 : 9}" fill="${textMuted}">${gateway.routerModel.split(' ')[0]} ${gateway.routerModel.split(' ')[1]}</text>
  </g>

  <!-- Right: Route Flap Damping Graph Panel -->
  <g id="flapDampingGraph">
    <text x="${graphX}" y="${graphY - 14}" font-size="${isCompact ? 11 : 13}" font-weight="700" fill="${textColor}">RFC 2439 Route Flap Damping Penalty Decay</text>
    <text x="${graphX + graphW}" y="${graphY - 14}" text-anchor="end" font-size="${isCompact ? 9 : 10}" fill="${textMuted}">Half-life: 15m · Suppress: 2000 · Reuse: 750</text>

    <!-- Graph Canvas Box -->
    <rect x="${graphX}" y="${graphY}" width="${graphW}" height="${graphH}" rx="4" fill="${isDark ? 'rgba(15, 23, 42, 0.6)' : 'rgba(255, 255, 255, 0.8)'}" stroke="${strokeGrid}" stroke-width="1" />

    <!-- Threshold Guide Lines -->
    <!-- Suppress line (2000 points) -->
    <line x1="${graphX}" y1="${suppressY}" x2="${graphX + graphW}" y2="${suppressY}" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="4,4" />
    <text x="${graphX + 6}" y="${suppressY - 4}" font-size="9" font-weight="600" fill="#ef4444">SUPPRESS THRESHOLD (2000)</text>

    <!-- Reuse line (750 points) -->
    <line x1="${graphX}" y1="${reuseY}" x2="${graphX + graphW}" y2="${reuseY}" stroke="#10b981" stroke-width="1.5" stroke-dasharray="4,4" />
    <text x="${graphX + 6}" y="${reuseY - 4}" font-size="9" font-weight="600" fill="#10b981">REUSE THRESHOLD (750)</text>

    <!-- Decay curve -->
    ${pathD ? `<path d="${pathD}" fill="none" stroke="url(#curveGrad)" stroke-width="2.5" />` : ''}

    <!-- Current marker point -->
    <circle cx="${curPx}" cy="${curPy}" r="6" fill="${damping.isDamped ? '#ef4444' : damping.isReusePending ? '#f59e0b' : '#10b981'}" stroke="#ffffff" stroke-width="2" filter="url(#rpkiGlow)" />
    <text x="${Math.min(graphX + graphW - 70, Math.max(graphX + 20, curPx))}" y="${Math.max(graphY + 16, curPy - 10)}" font-size="10" font-weight="700" fill="${textColor}" text-anchor="middle">
      ${damping.currentPenalty} pts (${damping.elapsedMinutes}m)
    </text>

    <!-- X-axis minute labels -->
    <text x="${graphX}" y="${graphY + graphH + 14}" font-size="8" fill="${textMuted}">0m</text>
    <text x="${graphX + graphW * 0.25}" y="${graphY + graphH + 14}" font-size="8" fill="${textMuted}">15m</text>
    <text x="${graphX + graphW * 0.5}" y="${graphY + graphH + 14}" font-size="8" fill="${textMuted}">30m</text>
    <text x="${graphX + graphW * 0.75}" y="${graphY + graphH + 14}" font-size="8" fill="${textMuted}">45m</text>
    <text x="${graphX + graphW}" y="${graphY + graphH + 14}" text-anchor="end" font-size="8" fill="${textMuted}">60m</text>
  </g>

  <!-- Bottom KPI Strip -->
  <g id="bottomKpiStrip" transform="translate(0, ${height - (isCompact ? 35 : 45)})">
    <rect x="${flowLeftX}" y="0" width="${width - flowLeftX * 2}" height="${isCompact ? 26 : 34}" rx="6" fill="${isDark ? '#1e293b' : '#ffffff'}" stroke="${strokeGrid}" stroke-width="1" />
    <text x="${flowLeftX + 12}" y="${isCompact ? 16 : 21}" font-size="${isCompact ? 9 : 11}" font-weight="600" fill="${textColor}">
      ROV: <tspan fill="${rov.isInvalid ? '#ef4444' : rov.isNotFound ? '#f59e0b' : '#10b981'}">${rov.rovState}</tspan> · Prefix: ${rov.announcedPrefix} (Origin AS${rov.announcedAsn})
    </text>
    <text x="${width - flowLeftX - 12}" y="${isCompact ? 16 : 21}" text-anchor="end" font-size="${isCompact ? 9 : 11}" font-weight="600" fill="${textColor}">
      Flap Status: <tspan fill="${damping.isDamped ? '#ef4444' : damping.isReusePending ? '#f59e0b' : '#10b981'}">${damping.dampingStatus}</tspan> (${damping.flapsPerMinute} flaps/m)
    </text>
  </g>
</svg>
  `.trim();
}

/**
 * Generates formal Outside Plant BGP RPKI Route Origin Validation & Flap Damping Audit Report text.
 */
export function generateRpkiReport(metrics) {
  if (!metrics || !metrics.gateway) return 'No RPKI audit metrics available.';

  const { gateway, prefix, dynamics, subscriberCorrelation } = metrics;
  const { rov, damping, overallStatus } = dynamics;

  return `
================================================================================
SHAHDARA ISP BGP RPKI ROUTE ORIGIN VALIDATION & ROUTE FLAP DAMPING AUDIT REPORT
Standards: RFC 6480, RFC 6811, RFC 8210 (RTR), RFC 2439 (Route Flap Damping)
Timestamp: ${new Date().toISOString()}
================================================================================

[ BGP BORDER ROUTER & RPKI-TO-ROUTER (RTR) SESSION ]
--------------------------------------------------------------------------------
Gateway Router: ${gateway.name}
Role & Model: ${gateway.role} · ${gateway.routerModel}
Primary Sector: ${gateway.primaryArea} (Aliases: ${(gateway.aliasAreas || []).join(', ')})
Carrier Link Bandwidth: ${gateway.capacityGbps} Gbps
RTR Validator Cache: ${gateway.validatorType} (${gateway.validatorHost})
RTR Protocol Version: ${gateway.rtrProtocolVersion}
RTR Session Latency: ${gateway.rtrLatencyMs} ms
Total Valid ROAs in Cache: ${gateway.totalRoasInCache.toLocaleString()}
RTR Cache Refresh Interval: ${gateway.rtrRefreshSeconds} seconds

[ BGP PREFIX ORIGIN VALIDATION (ROV / RFC 6811) TELEMETRY ]
--------------------------------------------------------------------------------
Monitored Route Block: ${prefix.prefix} - ${prefix.description}
Announced Prefix: ${rov.announcedPrefix}
Announced Origin ASN: AS${rov.announcedAsn}
Authoritative ROA ASN: AS${rov.authoritativeAsn} (${prefix.authoritativeAsnName})
Configured ROA MaxLength: /${rov.maxPrefixLength} (Announced: /${rov.announcedLength})
ROA Trust Anchor: ${prefix.trustAnchor}
ROV Cryptographic Status: ${rov.rovState}
Ingress ROV Policy: ${RPKI_CONSTANTS.ROV_POLICIES[metrics.rovPolicy]?.label || metrics.rovPolicy}
Hardware FIB Disposition: ${rov.fibForwardingAction} (Local-Preference: ${rov.localPreference})
Technical Evaluation: ${rov.explanation}

[ BGP ROUTE FLAP DAMPING (RFC 2439) TELEMETRY ]
--------------------------------------------------------------------------------
Flap Rate: ${damping.flapsPerMinute} flaps / minute
Accumulated Penalty: ${damping.currentPenalty} points (Initial: ${damping.initialPenalty})
Suppress Threshold: ${damping.suppressThreshold} points
Reuse Threshold: ${damping.reuseThreshold} points
Exponential Half-Life: ${damping.halfLifeMinutes} minutes
Elapsed Decay Time: ${damping.elapsedMinutes} minutes
Route Flap State: ${damping.dampingStatus}
Minutes to Reuse: ${damping.minutesToReuse > 0 ? damping.minutesToReuse + ' min' : '0 min (Unsuppressed)'}
Forwarding Datapath Status: ${dynamics.isTrafficForwarded ? 'FORWARDING' : 'SUPPRESSED / DROPPED'}
Forwarding Path Detail: ${dynamics.datapathReason}

[ SUBSCRIBER REVENUE & SECTOR SLA EXPOSURE ]
--------------------------------------------------------------------------------
Sector Subscribers: ${subscriberCorrelation.totalSubscribers} (${subscriberCorrelation.activeSubscribers} Active, ${subscriberCorrelation.offlineSubscribers} Offline)
Sector Monthly Billed Revenue: ${formatPKR(subscriberCorrelation.sectorMonthlyRevenue)}
Outstanding Dues: ${formatPKR(subscriberCorrelation.sectorTotalDues)}
Estimated Revenue At Risk: ${formatPKR(subscriberCorrelation.revenueAtRisk)} (${Math.round(subscriberCorrelation.riskFraction * 100)}% Exposure)

[ NOC INCIDENT REMEDIATION RECOMMENDATION ]
--------------------------------------------------------------------------------
${
  overallStatus === RPKI_CONSTANTS.OVERALL_STATUS.CRITICAL
    ? 'CRITICAL ALERT: BGP route flap suppression or unmitigated hijack detected! If route is flapping, verify peering interface physical layer or BFD session stability. If ROV is INVALID, verify whether upstream provider announced a leaked or hijacked ASN. Enforce strict RFC 6811 drop policy to prevent traffic diversion.'
    : overallStatus === RPKI_CONSTANTS.OVERALL_STATUS.WARNING
    ? 'WARNING NOTICE: Route is operating under demoted Local-Preference or decaying flap penalty. Continue monitoring RTR cache synchronization and peer stability until penalty decays below reuse threshold (750).'
    : 'OPTIMAL OPERATION: BGP route is cryptographically valid under RFC 6811 and route flap damping penalty is nominal. Normal ISP traffic forwarding active.'
}
================================================================================
`.trim();
}

/**
 * Exports RPKI simulation data as JSON.
 */
export function exportRpkiJson(metrics) {
  const data = {
    exportedAt: new Date().toISOString(),
    metrics
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `shahdara-rpki-rov-matrix-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Exports RPKI simulation data as CSV.
 */
export function exportRpkiCsv(metrics) {
  const { gateway, prefix, dynamics, subscriberCorrelation } = metrics;
  const { rov, damping } = dynamics;

  const rows = [
    ['Metric', 'Value'],
    ['Gateway Name', gateway.name],
    ['Gateway Role', gateway.role],
    ['Primary Sector', gateway.primaryArea],
    ['RTR Validator Host', gateway.validatorHost],
    ['RTR Protocol', gateway.rtrProtocolVersion],
    ['Cached ROAs', gateway.totalRoasInCache],
    ['RTR Latency ms', gateway.rtrLatencyMs],
    ['Prefix', prefix.prefix],
    ['Announced Prefix', rov.announcedPrefix],
    ['Announced Origin ASN', rov.announcedAsn],
    ['Authoritative ASN', rov.authoritativeAsn],
    ['Authoritative MaxLength', rov.maxPrefixLength],
    ['ROV Validation State', rov.rovState],
    ['ROV Enforcement Policy', metrics.rovPolicy],
    ['FIB Disposition', rov.fibForwardingAction],
    ['Local-Preference', rov.localPreference],
    ['Flaps Per Minute', damping.flapsPerMinute],
    ['Accumulated Penalty', damping.currentPenalty],
    ['Suppress Threshold', damping.suppressThreshold],
    ['Reuse Threshold', damping.reuseThreshold],
    ['Flap State', damping.dampingStatus],
    ['Minutes to Reuse', damping.minutesToReuse],
    ['Traffic Forwarded', dynamics.isTrafficForwarded],
    ['Sector Total Subscribers', subscriberCorrelation.totalSubscribers],
    ['Sector Active Subscribers', subscriberCorrelation.activeSubscribers],
    ['Sector Monthly Revenue PKR', subscriberCorrelation.sectorMonthlyRevenue],
    ['Revenue At Risk PKR', subscriberCorrelation.revenueAtRisk]
  ];

  const csvContent = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `shahdara-rpki-rov-matrix-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Initializes and wires the BGP RPKI ROV and Flap Damping modal dialog and dashboard card.
 */
export function setupRpkiModal(state = {}, options = {}) {
  const modal = document.getElementById('dashboardRpkiModal');
  const openBtn = document.getElementById('dashboardOpenRpkiModalBtn');
  const closeBtn = document.getElementById('dashboardRpkiModalCloseBtn');

  const gwSelect = document.getElementById('rpkiGwSelect');
  const prefixSelect = document.getElementById('rpkiPrefixSelect');
  const hijackSelect = document.getElementById('rpkiHijackSelect');
  const policySelect = document.getElementById('rpkiPolicySelect');
  const flapRange = document.getElementById('rpkiFlapRange');
  const flapValLabel = document.getElementById('rpkiFlapValLabel');
  const elapsedRange = document.getElementById('rpkiElapsedRange');
  const elapsedValLabel = document.getElementById('rpkiElapsedValLabel');
  const resetBtn = document.getElementById('rpkiResetBtn');

  // KPI elements
  const statRovState = document.getElementById('rpkiStatRovState');
  const statFibAction = document.getElementById('rpkiStatFibAction');
  const statPenalty = document.getElementById('rpkiStatPenalty');
  const statFlapStatus = document.getElementById('rpkiStatFlapStatus');
  const statRevenueRisk = document.getElementById('rpkiStatRevenueRisk');

  // Containers
  const svgContainer = document.getElementById('dashboardRpkiModalSvgContainer');
  const cardSvg = document.getElementById('dashboardRpkiChart');

  // Action buttons
  const copyReportBtn = document.getElementById('rpkiCopyReportBtn');
  const exportJsonBtn = document.getElementById('rpkiExportJsonBtn');
  const exportCsvBtn = document.getElementById('rpkiExportCsvBtn');

  function updateUi() {
    const isDark = (typeof document !== 'undefined' && document.documentElement && document.documentElement.getAttribute('data-theme') === 'dark');
    const metrics = calculateRpkiMetrics(state);
    const { dynamics, subscriberCorrelation } = metrics;
    const { rov, damping, overallStatus } = dynamics;

    // Update Card chart
    if (cardSvg) {
      cardSvg.innerHTML = renderRpkiDiagramSvg(metrics, { isDark, compact: true });
    }

    // Update Modal SVG
    if (svgContainer) {
      svgContainer.innerHTML = renderRpkiDiagramSvg(metrics, { isDark, compact: false });
    }

    if (!modal) return;

    // Update KPIs
    if (statRovState) {
      statRovState.textContent = rov.rovState;
      statRovState.className = `optical-evm-stat-val ${rov.isInvalid ? 'critical' : rov.isNotFound ? 'warning' : 'optimal'}`;
    }
    if (statFibAction) {
      statFibAction.textContent = `${rov.fibForwardingAction} (LocPref ${rov.localPreference})`;
      statFibAction.className = `optical-evm-stat-val ${rov.fibForwardingAction === 'DROPPED' ? 'critical' : rov.fibForwardingAction === 'DEMOTED' ? 'warning' : 'optimal'}`;
    }
    if (statPenalty) {
      statPenalty.textContent = `${damping.currentPenalty} pts (${damping.minutesToReuse > 0 ? damping.minutesToReuse + 'm reuse' : 'Ready'})`;
      statPenalty.className = `optical-evm-stat-val ${damping.isDamped ? 'critical' : damping.isReusePending ? 'warning' : 'optimal'}`;
    }
    if (statFlapStatus) {
      statFlapStatus.textContent = damping.dampingStatus;
      statFlapStatus.className = `optical-evm-stat-val ${damping.isDamped ? 'critical' : damping.isReusePending ? 'warning' : 'optimal'}`;
    }
    if (statRevenueRisk) {
      statRevenueRisk.textContent = formatPKR(subscriberCorrelation.revenueAtRisk);
      statRevenueRisk.className = `optical-evm-stat-val ${subscriberCorrelation.revenueAtRisk > 0 ? 'critical' : 'optimal'}`;
    }

    // Update select values to match state
    if (gwSelect && gwSelect.value !== metrics.gateway.id) {
      gwSelect.value = metrics.gateway.id;
    }
    if (prefixSelect && prefixSelect.value !== metrics.prefix.id) {
      prefixSelect.value = metrics.prefix.id;
    }
    if (hijackSelect && hijackSelect.value !== metrics.hijackMode) {
      hijackSelect.value = metrics.hijackMode;
    }
    if (policySelect && policySelect.value !== metrics.rovPolicy) {
      policySelect.value = metrics.rovPolicy;
    }
    if (flapRange) {
      flapRange.value = metrics.flapsPerMinute;
      if (flapValLabel) flapValLabel.textContent = `${metrics.flapsPerMinute} flaps/m`;
    }
    if (elapsedRange) {
      elapsedRange.value = metrics.elapsedFlapMinutes;
      if (elapsedValLabel) elapsedValLabel.textContent = `${metrics.elapsedFlapMinutes} min`;
    }
  }

  // Event handlers
  if (openBtn && modal) {
    openBtn.addEventListener('click', () => {
      updateUi();
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

  if (modal) {
    modal.addEventListener('click', e => {
      if (e.target === modal) {
        if (typeof modal.close === 'function') {
          modal.close();
        } else {
          modal.removeAttribute('open');
        }
      }
    });
  }

  if (gwSelect) {
    gwSelect.addEventListener('change', () => {
      setRpkiSelectedGatewayId(gwSelect.value);
      updateUi();
    });
  }

  if (prefixSelect) {
    prefixSelect.addEventListener('change', () => {
      setRpkiSelectedPrefixId(prefixSelect.value);
      updateUi();
    });
  }

  if (hijackSelect) {
    hijackSelect.addEventListener('change', () => {
      setRpkiHijackSimulationMode(hijackSelect.value);
      updateUi();
    });
  }

  if (policySelect) {
    policySelect.addEventListener('change', () => {
      setRpkiRovPolicyMode(policySelect.value);
      updateUi();
    });
  }

  if (flapRange) {
    flapRange.addEventListener('input', () => {
      setRpkiFlapsPerMinute(flapRange.value);
      if (flapValLabel) flapValLabel.textContent = `${flapRange.value} flaps/m`;
      updateUi();
    });
  }

  if (elapsedRange) {
    elapsedRange.addEventListener('input', () => {
      setRpkiElapsedFlapMinutes(elapsedRange.value);
      if (elapsedValLabel) elapsedValLabel.textContent = `${elapsedRange.value} min`;
      updateUi();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      resetRpkiSimState();
      updateUi();
      if (options.onToast) {
        options.onToast('RPKI ROV & Flap Damping baseline parameters reset.');
      }
    });
  }

  if (copyReportBtn) {
    copyReportBtn.addEventListener('click', () => {
      const metrics = calculateRpkiMetrics(state);
      const report = generateRpkiReport(metrics);
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(report).then(() => {
          if (options.onToast) options.onToast('RPKI ROV audit report copied to clipboard.');
        }).catch(() => {
          prompt('Copy RPKI Audit Report:', report);
        });
      } else {
        prompt('Copy RPKI Audit Report:', report);
      }
    });
  }

  if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', () => {
      const metrics = calculateRpkiMetrics(state);
      exportRpkiJson(metrics);
    });
  }

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      const metrics = calculateRpkiMetrics(state);
      exportRpkiCsv(metrics);
    });
  }

  // Initial draw
  updateUi();
}
