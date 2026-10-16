import { formatPKR } from './core.js';

/**
 * Edge DNS Authoritative Cache Resolver Recursive Response Latency & DNSSEC Validation Failure Matrix
 * Models Shahdara ISP POP recursive/authoritative DNS caches (Unbound, BIND9, PowerDNS, Knot Resolver),
 * cache hit ratio (L1 memory vs forwarder vs root iterative lookup), upstream recursive forwarding (Cloudflare,
 * Google Public DNS, Quad9, Nayatel, PTCL), RFC 4033/4034/4035 DNSSEC cryptographic chain validation (DS/DNSKEY/RRSIG),
 * clock drift inception/expiration invalidation, SERVFAIL rate, and subscriber QoE / revenue at risk.
 */

export const SHAHDARA_DNS_RESOLVERS = [
  {
    id: 'dns-shd-01',
    name: 'Shahdara Town Core Anycast Resolver (Unbound Clustered)',
    ip: '10.42.1.2',
    software: 'NLnet Labs Unbound 1.19 / Linux eBPF',
    primaryArea: 'Shahdara Town',
    aliasAreas: ['Shahdara Town', 'Old Town', 'Railway Road'],
    memoryCacheMb: 4096,
    defaultForwarder: 'cf-1111',
    baseCacheHitRatioPct: 88.5,
    qpsCapacity: 45000,
    currentQps: 18450,
    baseClockDriftMs: 4,
    dnssecValidationEnabled: true,
    authoritativeLocalZones: 34,
    upstreamFailoverSecs: 0.8
  },
  {
    id: 'dns-bar-02',
    name: 'Baradari Road POP Recursive Resolver (PowerDNS Recursor)',
    ip: '10.42.2.2',
    software: 'PowerDNS Recursor 5.0 / jemalloc',
    primaryArea: 'Baradari Road',
    aliasAreas: ['Baradari Road', 'Bara Dari', 'Tariq Road'],
    memoryCacheMb: 2048,
    defaultForwarder: 'goog-8888',
    baseCacheHitRatioPct: 84.2,
    qpsCapacity: 25000,
    currentQps: 9820,
    baseClockDriftMs: 12,
    dnssecValidationEnabled: true,
    authoritativeLocalZones: 18,
    upstreamFailoverSecs: 1.2
  },
  {
    id: 'dns-van-03',
    name: 'Vandala Road POP Edge Resolver (Knot Resolver)',
    ip: '10.42.3.2',
    software: 'CZ.NIC Knot Resolver 5.7 / LuaJIT',
    primaryArea: 'Vandala Road',
    aliasAreas: ['Vandala Road', 'Wandala Road', 'Zia Town'],
    memoryCacheMb: 2048,
    defaultForwarder: 'quad9-9999',
    baseCacheHitRatioPct: 86.0,
    qpsCapacity: 25000,
    currentQps: 8740,
    baseClockDriftMs: -6,
    dnssecValidationEnabled: true,
    authoritativeLocalZones: 14,
    upstreamFailoverSecs: 1.0
  },
  {
    id: 'dns-jia-04',
    name: 'Jia Musa Distribution Node Cache (Unbound Edge)',
    ip: '10.42.4.2',
    software: 'NLnet Labs Unbound 1.19 / libevent',
    primaryArea: 'Jia Musa',
    aliasAreas: ['Jia Musa', 'Farrukhabad'],
    memoryCacheMb: 1024,
    defaultForwarder: 'nya-dns',
    baseCacheHitRatioPct: 81.5,
    qpsCapacity: 15000,
    currentQps: 5410,
    baseClockDriftMs: 18,
    dnssecValidationEnabled: true,
    authoritativeLocalZones: 8,
    upstreamFailoverSecs: 1.5
  },
  {
    id: 'dns-sae-05',
    name: 'Saeed Park Micro-POP DNS Gateway (CoreDNS Node)',
    ip: '10.42.5.2',
    software: 'CoreDNS 1.11 / Go Runtime',
    primaryArea: 'Saeed Park',
    aliasAreas: ['Saeed Park', 'Rehman Park'],
    memoryCacheMb: 1024,
    defaultForwarder: 'ptcl-dns',
    baseCacheHitRatioPct: 83.0,
    qpsCapacity: 15000,
    currentQps: 4920,
    baseClockDriftMs: 8,
    dnssecValidationEnabled: true,
    authoritativeLocalZones: 6,
    upstreamFailoverSecs: 1.6
  },
  {
    id: 'dns-bgk-06',
    name: 'Begum Kot Outlying Gateway Cache (Unbound Compact)',
    ip: '10.42.6.2',
    software: 'NLnet Labs Unbound 1.18 / Alpine Linux',
    primaryArea: 'Begum Kot',
    aliasAreas: ['Begum Kot', 'Kot Abdul Malik Road'],
    memoryCacheMb: 1024,
    defaultForwarder: 'cf-1111',
    baseCacheHitRatioPct: 79.4,
    qpsCapacity: 12000,
    currentQps: 3890,
    baseClockDriftMs: 25,
    dnssecValidationEnabled: true,
    authoritativeLocalZones: 5,
    upstreamFailoverSecs: 2.0
  }
];

export const UPSTREAM_FORWARDERS = [
  {
    id: 'cf-1111',
    name: 'Cloudflare Anycast (1.1.1.1 / 1.0.0.1)',
    primaryIp: '1.1.1.1',
    secondaryIp: '1.0.0.1',
    rttMs: 11.8,
    dnssecSupport: 'RFC 4035 Strict & DoT/DoH',
    location: 'Lahore PKIX IXP Node',
    reliabilityPct: 99.98
  },
  {
    id: 'goog-8888',
    name: 'Google Public DNS (8.8.8.8 / 8.8.4.4)',
    primaryIp: '8.8.8.8',
    secondaryIp: '8.8.4.4',
    rttMs: 15.4,
    dnssecSupport: 'EDNS0 Client Subnet + DNSSEC Strict',
    location: 'Karachi POP Anycast',
    reliabilityPct: 99.95
  },
  {
    id: 'quad9-9999',
    name: 'Quad9 Cyber Threat Blocking (9.9.9.9)',
    primaryIp: '9.9.9.9',
    secondaryIp: '149.112.112.112',
    rttMs: 17.2,
    dnssecSupport: 'RFC 4035 Strict + Threat Shield',
    location: 'Zurich / Regional Mirror',
    reliabilityPct: 99.92
  },
  {
    id: 'nya-dns',
    name: 'Nayatel Metro IX Resolver (110.37.110.1)',
    primaryIp: '110.37.110.1',
    secondaryIp: '110.37.110.2',
    rttMs: 4.6,
    dnssecSupport: 'Direct Upstream Peering / Permissive',
    location: 'Lahore Data Center',
    reliabilityPct: 99.99
  },
  {
    id: 'ptcl-dns',
    name: 'PTCL National Core DNS (182.176.39.2)',
    primaryIp: '182.176.39.2',
    secondaryIp: '182.176.39.3',
    rttMs: 7.9,
    dnssecSupport: 'Standard Resolver / DNSSEC Permissive',
    location: 'Lahore Central Exchange',
    reliabilityPct: 99.89
  }
];

export const DNS_CONSTANTS = {
  CACHE_HIT_LATENCY_MS: 1.6,
  LOCAL_AUTH_LATENCY_MS: 3.2,
  ITERATIVE_ROOT_LATENCY_MS: 72.0,
  ROOT_ANCHOR_VALIDITY_DAYS: 365,
  CLOCK_DRIFT_TOLERANCE_MS: 300000, // 5 minutes RFC 4034
  MAX_BENCHMARK_LATENCY_MS: 60.0,
  OPTIMAL_HIT_RATIO_MIN: 80.0,
  POOR_HIT_RATIO_MAX: 65.0,
  DEFAULT_SELECTED_RESOLVER: 'dns-shd-01'
};

// Simulation State
let simSelectedResolverId = DNS_CONSTANTS.DEFAULT_SELECTED_RESOLVER;
let simCacheHitRatioPct = null; // null = use resolver default
let simForwarderId = null; // null = use resolver default
let simDnssecMode = 'strict'; // 'strict', 'permissive', 'disabled'
let simClockDriftMs = null; // null = use resolver default

export function getDnsSelectedResolver() {
  return simSelectedResolverId;
}

export function setDnsSelectedResolver(resolverId) {
  const found = SHAHDARA_DNS_RESOLVERS.find(r => r.id === resolverId);
  if (found) {
    simSelectedResolverId = resolverId;
  }
  return simSelectedResolverId;
}

export function getDnsCacheHitRatio() {
  return simCacheHitRatioPct;
}

export function setDnsCacheHitRatio(ratio) {
  if (ratio === null) {
    simCacheHitRatioPct = null;
  } else {
    simCacheHitRatioPct = Math.max(40, Math.min(99, Number(ratio) || 85));
  }
  return simCacheHitRatioPct;
}

export function getDnsUpstreamForwarder() {
  return simForwarderId;
}

export function setDnsUpstreamForwarder(fwdId) {
  if (fwdId === null) {
    simForwarderId = null;
  } else {
    const found = UPSTREAM_FORWARDERS.find(f => f.id === fwdId);
    if (found) {
      simForwarderId = fwdId;
    }
  }
  return simForwarderId;
}

export function getDnssecMode() {
  return simDnssecMode;
}

export function setDnssecMode(mode) {
  if (['strict', 'permissive', 'disabled'].includes(mode)) {
    simDnssecMode = mode;
  }
  return simDnssecMode;
}

export function getDnsClockDriftMs() {
  return simClockDriftMs;
}

export function setDnsClockDriftMs(driftMs) {
  if (driftMs === null) {
    simClockDriftMs = null;
  } else {
    simClockDriftMs = Math.max(-600000, Math.min(600000, Number(driftMs) || 0));
  }
  return simClockDriftMs;
}

export function resetDnsSimState() {
  simSelectedResolverId = DNS_CONSTANTS.DEFAULT_SELECTED_RESOLVER;
  simCacheHitRatioPct = null;
  simForwarderId = null;
  simDnssecMode = 'strict';
  simClockDriftMs = null;
}

/**
 * Calculates weighted recursive response latency based on cache hit ratio and upstream RTT.
 */
export function calculateDnsLatency(cacheHitRatioPct, forwarderRttMs, options = {}) {
  const hitRatio = Math.max(0, Math.min(100, Number(cacheHitRatioPct) || 85)) / 100;
  const authRatio = 0.04; // 4% local authoritative ISP zones
  const forwardRatio = Math.max(0, (1 - hitRatio - authRatio) * 0.92); // 92% of cache misses hit forwarder
  const iterativeRatio = Math.max(0, 1 - hitRatio - authRatio - forwardRatio); // 8% of misses require root/TLD iterative lookup

  const cacheLat = options.cacheLatencyMs || DNS_CONSTANTS.CACHE_HIT_LATENCY_MS;
  const authLat = options.authLatencyMs || DNS_CONSTANTS.LOCAL_AUTH_LATENCY_MS;
  const fwdLat = (Number(forwarderRttMs) || 12.0) + 1.8; // Forwarder RTT plus recursor overhead
  const iterLat = options.iterativeLatencyMs || DNS_CONSTANTS.ITERATIVE_ROOT_LATENCY_MS;

  const weightedLatencyMs = (hitRatio * cacheLat) + (authRatio * authLat) + (forwardRatio * fwdLat) + (iterativeRatio * iterLat);

  return {
    weightedLatencyMs: Math.round(weightedLatencyMs * 10) / 10,
    hitRatioPct: Math.round(hitRatio * 1000) / 10,
    authRatioPct: Math.round(authRatio * 1000) / 10,
    forwardRatioPct: Math.round(forwardRatio * 1000) / 10,
    iterativeRatioPct: Math.round(iterativeRatio * 1000) / 10,
    cacheLatMs: cacheLat,
    authLatMs: authLat,
    fwdLatMs: Math.round(fwdLat * 10) / 10,
    iterLatMs: iterLat
  };
}

/**
 * Evaluates DNSSEC cryptographic chain validation success vs SERVFAIL rates.
 * RFC 4034 RRSIG inception/expiration validity window check against server clock drift.
 */
export function calculateDnssecValidation(dnssecMode, clockDriftMs, options = {}) {
  const mode = dnssecMode || 'strict';
  const drift = Number(clockDriftMs) || 0;
  const absDrift = Math.abs(drift);

  let bogusRatePct = 0.4; // Base 0.4% internet-wide DNSSEC misconfiguration
  let clockInvalidPct = 0;

  // Clock drift exceeding 120 seconds starts violating RRSIG inception/expiration margins
  if (absDrift > 120000) {
    clockInvalidPct = Math.min(95, ((absDrift - 120000) / 180000) * 100);
    bogusRatePct += clockInvalidPct * 0.85;
  }

  bogusRatePct = Math.min(100, Math.round(bogusRatePct * 10) / 10);
  const secureRatePct = Math.max(0, Math.round((100 - bogusRatePct) * 10) / 10);

  let servfailRatePct = 0;
  let status = 'OPTIMAL';
  let statusBadge = 'badge-success';

  if (mode === 'strict') {
    servfailRatePct = bogusRatePct; // Strict mode drops bogus answers with SERVFAIL
    if (servfailRatePct > 5.0) {
      status = 'CRITICAL BOGUS FAILURES';
      statusBadge = 'badge-danger';
    } else if (servfailRatePct > 1.5) {
      status = 'ELEVATED SERVFAIL';
      statusBadge = 'badge-warning';
    } else {
      status = 'SECURE & OPTIMAL';
      statusBadge = 'badge-success';
    }
  } else if (mode === 'permissive') {
    servfailRatePct = 0.05; // Fallback without AD bit
    status = 'PERMISSIVE (LOG ONLY)';
    statusBadge = 'badge-warning';
  } else {
    // Disabled
    servfailRatePct = 0.01;
    status = 'DNSSEC DISABLED';
    statusBadge = 'badge-danger';
  }

  return {
    mode,
    clockDriftMs: drift,
    absDriftSec: Math.round(absDrift / 1000),
    secureRatePct,
    bogusRatePct,
    servfailRatePct: Math.round(servfailRatePct * 100) / 100,
    status,
    statusBadge,
    clockInSync: absDrift < 60000,
    ntpStatus: absDrift < 5000 ? 'Locked (±5ms)' : absDrift < 60000 ? 'Synchronized' : 'Desynchronized / Clock Skew'
  };

}

/**
 * Calculates comprehensive DNS metrics across Shahdara customer base and edge resolvers.
 */
export function calculateDnsMetrics(state, options = {}) {
  const customers = Array.isArray(state?.customers) ? state.customers : [];
  const selectedId = options.selectedResolverId || simSelectedResolverId;
  const activeForwarderId = options.forwarderId || simForwarderId;
  const activeDnssecMode = options.dnssecMode || simDnssecMode;

  const resolvers = SHAHDARA_DNS_RESOLVERS.map(res => {
    const isSelected = res.id === selectedId;
    const fwdId = (isSelected && activeForwarderId) ? activeForwarderId : res.defaultForwarder;
    const forwarder = UPSTREAM_FORWARDERS.find(f => f.id === fwdId) || UPSTREAM_FORWARDERS[0];

    const cacheHitRatio = (isSelected && simCacheHitRatioPct !== null) ? simCacheHitRatioPct : res.baseCacheHitRatioPct;
    const clockDrift = (isSelected && simClockDriftMs !== null) ? simClockDriftMs : res.baseClockDriftMs;
    const mode = (isSelected && activeDnssecMode) ? activeDnssecMode : 'strict';

    const latMetrics = calculateDnsLatency(cacheHitRatio, forwarder.rttMs, options);
    const dnssecMetrics = calculateDnssecValidation(mode, clockDrift, options);

    // Linked subscribers matching resolver primary & alias areas
    const areaSet = new Set([res.primaryArea, ...(res.aliasAreas || [])].map(a => a.toLowerCase().trim()));
    let linkedSubscribers = 0;
    let activeSubscribers = 0;
    let monthlyRevenue = 0;
    let duesAtRisk = 0;

    for (const c of customers) {
      if (c.archived) continue;
      const cArea = (c.area || '').toLowerCase().trim();
      const match = areaSet.has(cArea) || Array.from(areaSet).some(a => cArea.includes(a) || a.includes(cArea));
      if (match) {
        linkedSubscribers++;
        const isActive = c.status === 'Active' || !c.status;
        if (isActive) activeSubscribers++;

        const bills = Array.isArray(c.bills) ? c.bills : [];
        for (const b of bills) {
          const amt = Number(b.dueAmount) || Number(b.amount) || 0;
          duesAtRisk += amt;
        }

        const pkgPrice = Number(c.packagePrice) || Number(c.monthlyFee) || 1500;
        monthlyRevenue += pkgPrice;
      }
    }

    // Health tier
    let healthTier = 'OPTIMAL';
    let healthClass = 'badge-success';
    if (dnssecMetrics.servfailRatePct > 5.0 || latMetrics.weightedLatencyMs > 50.0) {
      healthTier = 'CRITICAL';
      healthClass = 'badge-danger';
    } else if (dnssecMetrics.servfailRatePct > 1.5 || latMetrics.weightedLatencyMs > 25.0) {
      healthTier = 'DEGRADED';
      healthClass = 'badge-warning';
    }

    // Estimated support ticket surge per hour (due to DNS resolution failures)
    const failureMultiplier = (dnssecMetrics.servfailRatePct / 100) * 12.0 + (Math.max(0, latMetrics.weightedLatencyMs - 20) / 20) * 4.0;
    const estimatedHourlyTickets = Math.round((activeSubscribers / 100) * failureMultiplier);

    return {
      ...res,
      forwarder,
      cacheHitRatioPct: latMetrics.hitRatioPct,
      effectiveLatencyMs: latMetrics.weightedLatencyMs,
      latBreakdown: latMetrics,
      dnssec: dnssecMetrics,
      healthTier,
      healthClass,
      linkedSubscribers,
      activeSubscribers,
      monthlyRevenue,
      duesAtRisk,
      estimatedHourlyTickets,
      isSelected
    };
  });

  const selectedResolver = resolvers.find(r => r.id === selectedId) || resolvers[0];

  const totalQps = resolvers.reduce((sum, r) => sum + r.currentQps, 0);
  const totalSubscribersCovered = resolvers.reduce((sum, r) => sum + r.linkedSubscribers, 0);
  const networkAvgLatencyMs = Math.round((resolvers.reduce((sum, r) => sum + r.effectiveLatencyMs, 0) / resolvers.length) * 10) / 10;
  const networkAvgCacheHitPct = Math.round((resolvers.reduce((sum, r) => sum + r.cacheHitRatioPct, 0) / resolvers.length) * 10) / 10;
  const totalDuesAtRisk = resolvers.reduce((sum, r) => sum + (r.healthTier !== 'OPTIMAL' ? r.duesAtRisk : 0), 0);

  return {
    resolvers,
    selectedResolver,
    totalQps,
    totalSubscribersCovered,
    networkAvgLatencyMs,
    networkAvgCacheHitPct,
    totalDuesAtRisk,
    forwarders: UPSTREAM_FORWARDERS
  };
}

/**
 * Pure client-side SVG rendering for Edge DNS Resolvers and DNSSEC Diagnostics.
 */
export function renderDnsDiagnosticsSvg(metrics, options = {}) {
  const compact = !!options.compact;
  const res = metrics.selectedResolver || metrics.resolvers[0];
  const lat = res.latBreakdown;
  const dnssec = res.dnssec;

  if (compact) {
    // Compact widget for dashboard overview card
    const hitAngle = (res.cacheHitRatioPct / 100) * 180;
    const rad = (180 - hitAngle) * (Math.PI / 180);
    const nx = 100 - 65 * Math.cos(rad);
    const ny = 95 - 65 * Math.sin(rad);

    return `
      <svg class="dns-compact-svg" viewBox="0 0 340 180" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Edge DNS Resolution and Cache Performance Gauge">
        <defs>
          <linearGradient id="dnsGaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#ef4444" />
            <stop offset="40%" stop-color="#f59e0b" />
            <stop offset="80%" stop-color="#10b981" />
            <stop offset="100%" stop-color="#06b6d4" />
          </linearGradient>
        </defs>

        <!-- Semicircular Gauge Track -->
        <path d="M 30,95 A 70,70 0 0,1 170,95" fill="none" stroke="rgba(148, 163, 184, 0.25)" stroke-width="12" stroke-linecap="round" />
        <path d="M 30,95 A 70,70 0 0,1 170,95" fill="none" stroke="url(#dnsGaugeGrad)" stroke-width="10" stroke-linecap="round" stroke-dasharray="220" stroke-dashoffset="${220 - (220 * (res.cacheHitRatioPct / 100))}" />

        <!-- Gauge Needle -->
        <circle cx="100" cy="95" r="5" fill="#3b82f6" />
        <line x1="100" y1="95" x2="${nx}" y2="${ny}" stroke="#3b82f6" stroke-width="3" stroke-linecap="round" />

        <!-- Gauge Metrics Text -->
        <text x="100" y="80" text-anchor="middle" font-size="16px" font-weight="800" fill="var(--text-color, #0f172a)">${res.cacheHitRatioPct}%</text>
        <text x="100" y="112" text-anchor="middle" font-size="9px" font-weight="600" fill="#64748b">CACHE HIT RATIO</text>

        <!-- Right Side Stat Summary -->
        <g transform="translate(190, 24)">
          <text x="0" y="12" font-size="9px" font-weight="700" fill="#64748b">RECURSIVE LATENCY</text>
          <text x="0" y="30" font-size="18px" font-weight="800" fill="${res.effectiveLatencyMs > 35 ? '#ef4444' : res.effectiveLatencyMs > 20 ? '#f59e0b' : '#10b981'}">${res.effectiveLatencyMs} ms</text>
          <text x="0" y="44" font-size="9px" fill="#64748b">Fwd: ${res.forwarder.name.split(' ')[0]}</text>

          <text x="0" y="68" font-size="9px" font-weight="700" fill="#64748b">DNSSEC INTEGRITY</text>
          <text x="0" y="86" font-size="14px" font-weight="700" fill="${dnssec.servfailRatePct > 1 ? '#ef4444' : '#10b981'}">${dnssec.secureRatePct}% Valid</text>
          <text x="0" y="100" font-size="9px" fill="#64748b">SERVFAIL: ${dnssec.servfailRatePct}%</text>

          <rect x="0" y="112" width="130" height="20" rx="4" fill="${res.healthTier === 'OPTIMAL' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'}" />
          <text x="65" y="126" text-anchor="middle" font-size="9px" font-weight="700" fill="${res.healthTier === 'OPTIMAL' ? '#10b981' : '#ef4444'}">${res.healthTier} (${res.primaryArea})</text>
        </g>

        <!-- Bottom Latency Distribution Stacked Bar -->
        <g transform="translate(20, 140)">
          <text x="0" y="-4" font-size="8.5px" font-weight="600" fill="#64748b">QUERY LATENCY PROFILE (RAM CACHE VS FORWARDED RECURSION)</text>
          <rect x="0" y="2" width="300" height="12" rx="3" fill="rgba(148, 163, 184, 0.15)" />
          <!-- Cache Slice -->
          <rect x="0" y="2" width="${Math.round(lat.hitRatioPct * 3)}" height="12" rx="3" fill="#10b981" />
          <!-- Authoritative Slice -->
          <rect x="${Math.round(lat.hitRatioPct * 3)}" y="2" width="${Math.round(lat.authRatioPct * 3)}" height="12" fill="#06b6d4" />
          <!-- Forwarder Slice -->
          <rect x="${Math.round((lat.hitRatioPct + lat.authRatioPct) * 3)}" y="2" width="${Math.round(lat.forwardRatioPct * 3)}" height="12" fill="#3b82f6" />
          <!-- Iterative Slice -->
          <rect x="${Math.round((lat.hitRatioPct + lat.authRatioPct + lat.forwardRatioPct) * 3)}" y="2" width="${Math.max(0, 300 - Math.round((lat.hitRatioPct + lat.authRatioPct + lat.forwardRatioPct) * 3))}" height="12" rx="3" fill="#ef4444" />

          <text x="0" y="24" font-size="8px" fill="#64748b">RAM Cache ${lat.cacheLatMs}ms</text>
          <text x="140" y="24" text-anchor="middle" font-size="8px" fill="#64748b">Upstream ${lat.fwdLatMs}ms</text>
          <text x="300" y="24" text-anchor="end" font-size="8px" fill="#64748b">Iterative ${lat.iterLatMs}ms</text>
        </g>
      </svg>
    `;
  }

  // Expanded Diagnostic View (Modal Dialog)
  const fwd = res.forwarder;
  const statusColor = res.healthTier === 'OPTIMAL' ? '#10b981' : res.healthTier === 'DEGRADED' ? '#f59e0b' : '#ef4444';

  return `
    <svg class="dns-expanded-svg" viewBox="0 0 760 380" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Edge DNS Performance and DNSSEC Verification Diagnostics">
      <defs>
        <pattern id="dnsGrid" width="20" height="20" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="20" y2="0" stroke="rgba(148, 163, 184, 0.12)" stroke-width="0.75" />
          <line x1="0" y1="0" x2="0" y2="20" stroke="rgba(148, 163, 184, 0.12)" stroke-width="0.75" />
        </pattern>
        <linearGradient id="dnsPfxGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.3" />
          <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.0" />
        </linearGradient>
      </defs>

      <!-- Background -->
      <rect width="760" height="380" rx="10" fill="var(--card-bg, #ffffff)" />
      <rect width="760" height="380" rx="10" fill="url(#dnsGrid)" />

      <!-- Left Panel: Latency Distribution & Hit Ratio Dynamics -->
      <g transform="translate(24, 20)">
        <text x="0" y="16" font-size="13px" font-weight="700" fill="var(--text-color, #0f172a)">Recursive Query Latency &amp; Memory Tier Analysis</text>
        <text x="0" y="32" font-size="10px" fill="#64748b">Node: ${res.name} | Cache: ${res.memoryCacheMb} MB (${res.software})</text>

        <!-- Dynamic Latency Chart -->
        <g transform="translate(0, 48)">
          <!-- Grid & Axes -->
          <line x1="45" y1="140" x2="330" y2="140" stroke="#94a3b8" stroke-width="1" />
          <line x1="45" y1="20" x2="45" y2="140" stroke="#94a3b8" stroke-width="1" />

          <!-- Y ticks -->
          <text x="40" y="24" text-anchor="end" font-size="8.5px" fill="#64748b">60ms</text>
          <line x1="42" y1="20" x2="330" y2="20" stroke="rgba(148, 163, 184, 0.2)" stroke-dasharray="3,3" />

          <text x="40" y="64" text-anchor="end" font-size="8.5px" fill="#64748b">40ms</text>
          <line x1="42" y1="60" x2="330" y2="60" stroke="rgba(148, 163, 184, 0.2)" stroke-dasharray="3,3" />

          <text x="40" y="104" text-anchor="end" font-size="8.5px" fill="#64748b">20ms</text>
          <line x1="42" y1="100" x2="330" y2="100" stroke="rgba(148, 163, 184, 0.2)" stroke-dasharray="3,3" />

          <text x="40" y="144" text-anchor="end" font-size="8.5px" fill="#64748b">0ms</text>

          <!-- Bars for Latency breakdown -->
          <!-- Cache Hit -->
          <g transform="translate(65, 0)">
            <rect x="0" y="${140 - (lat.cacheLatMs / 60) * 120}" width="42" height="${(lat.cacheLatMs / 60) * 120}" rx="3" fill="#10b981" />
            <text x="21" y="${132 - (lat.cacheLatMs / 60) * 120}" text-anchor="middle" font-size="9px" font-weight="700" fill="#10b981">${lat.cacheLatMs}ms</text>
            <text x="21" y="154" text-anchor="middle" font-size="8.5px" fill="#64748b">L1 RAM</text>
            <text x="21" y="166" text-anchor="middle" font-size="7.5px" fill="#94a3b8">${lat.hitRatioPct}%</text>
          </g>

          <!-- Local Auth -->
          <g transform="translate(130, 0)">
            <rect x="0" y="${140 - (lat.authLatMs / 60) * 120}" width="42" height="${(lat.authLatMs / 60) * 120}" rx="3" fill="#06b6d4" />
            <text x="21" y="${132 - (lat.authLatMs / 60) * 120}" text-anchor="middle" font-size="9px" font-weight="700" fill="#06b6d4">${lat.authLatMs}ms</text>
            <text x="21" y="154" text-anchor="middle" font-size="8.5px" fill="#64748b">Local ISP</text>
            <text x="21" y="166" text-anchor="middle" font-size="7.5px" fill="#94a3b8">${lat.authRatioPct}%</text>
          </g>

          <!-- Upstream Forwarder -->
          <g transform="translate(195, 0)">
            <rect x="0" y="${Math.max(20, 140 - (lat.fwdLatMs / 60) * 120)}" width="42" height="${Math.min(120, (lat.fwdLatMs / 60) * 120)}" rx="3" fill="#3b82f6" />
            <text x="21" y="${Math.max(16, 132 - (lat.fwdLatMs / 60) * 120)}" text-anchor="middle" font-size="9px" font-weight="700" fill="#3b82f6">${lat.fwdLatMs}ms</text>
            <text x="21" y="154" text-anchor="middle" font-size="8.5px" fill="#64748b">Upstream</text>
            <text x="21" y="166" text-anchor="middle" font-size="7.5px" fill="#94a3b8">${lat.forwardRatioPct}%</text>
          </g>

          <!-- Root Iterative -->
          <g transform="translate(260, 0)">
            <rect x="0" y="20" width="42" height="120" rx="3" fill="#ef4444" />
            <text x="21" y="16" text-anchor="middle" font-size="9px" font-weight="700" fill="#ef4444">${lat.iterLatMs}ms</text>
            <text x="21" y="154" text-anchor="middle" font-size="8.5px" fill="#64748b">Iterative</text>
            <text x="21" y="166" text-anchor="middle" font-size="7.5px" fill="#94a3b8">${lat.iterativeRatioPct}%</text>
          </g>
        </g>

        <!-- Effective Weighted Latency Callout -->
        <g transform="translate(0, 240)">
          <rect x="0" y="0" width="340" height="88" rx="6" fill="rgba(148, 163, 184, 0.1)" stroke="rgba(148, 163, 184, 0.2)" />
          <text x="14" y="20" font-size="10px" font-weight="700" fill="#64748b">WEIGHTED SUBSCRIBER RESPONSE LATENCY</text>
          <text x="14" y="44" font-size="22px" font-weight="800" fill="${statusColor}">${res.effectiveLatencyMs} ms</text>
          <text x="140" y="44" font-size="11px" font-weight="600" fill="var(--text-color, #0f172a)">Target: &lt; 20ms</text>

          <text x="14" y="66" font-size="9.5px" fill="#64748b">Upstream: ${fwd.name}</text>
          <text x="14" y="78" font-size="9px" fill="#94a3b8">Location: ${fwd.location} (RTT: ${fwd.rttMs}ms)</text>

          <rect x="230" y="16" width="96" height="24" rx="4" fill="${statusColor}" />
          <text x="278" y="32" text-anchor="middle" font-size="9px" font-weight="700" fill="#ffffff">${res.healthTier}</text>
        </g>
      </g>

      <!-- Right Panel: DNSSEC Cryptographic Pipeline & Validation Chain -->
      <g transform="translate(390, 20)">
        <text x="0" y="16" font-size="13px" font-weight="700" fill="var(--text-color, #0f172a)">DNSSEC Cryptographic Chain &amp; Trust Anchor Pipeline</text>
        <text x="0" y="32" font-size="10px" fill="#64748b">RFC 4033/4034/4035 Validation | Trust Anchor: Root KSK 2017 (KeyTag 20326)</text>

        <!-- Pipeline Flow Chart -->
        <g transform="translate(0, 48)">
          <!-- Node 1: Root Anchor -->
          <rect x="0" y="0" width="90" height="52" rx="5" fill="#f1f5f9" stroke="#94a3b8" />
          <text x="45" y="18" text-anchor="middle" font-size="9px" font-weight="700" fill="#1e293b">ROOT (.)</text>
          <text x="45" y="32" text-anchor="middle" font-size="8px" fill="#16a34a">✓ KSK 20326</text>
          <text x="45" y="44" text-anchor="middle" font-size="7.5px" fill="#64748b">ZSK Rolled</text>

          <!-- Arrow 1 -->
          <line x1="90" y1="26" x2="114" y2="26" stroke="#64748b" stroke-width="1.5" />
          <polygon points="114,23 120,26 114,29" fill="#64748b" />

          <!-- Node 2: TLD DS RRset -->
          <rect x="120" y="0" width="95" height="52" rx="5" fill="#f1f5f9" stroke="#94a3b8" />
          <text x="167" y="18" text-anchor="middle" font-size="9px" font-weight="700" fill="#1e293b">TLD (.pk / .com)</text>
          <text x="167" y="32" text-anchor="middle" font-size="8px" fill="#16a34a">✓ DS Digest</text>
          <text x="167" y="44" text-anchor="middle" font-size="7.5px" fill="#64748b">SHA-256 Valid</text>

          <!-- Arrow 2 -->
          <line x1="215" y1="26" x2="239" y2="26" stroke="#64748b" stroke-width="1.5" />
          <polygon points="239,23 245,26 239,29" fill="#64748b" />

          <!-- Node 3: Zone DNSKEY & RRSIG -->
          <rect x="245" y="0" width="105" height="52" rx="5" fill="#f1f5f9" stroke="${dnssec.statusBadge === 'badge-danger' ? '#ef4444' : '#94a3b8'}" />
          <text x="297" y="18" text-anchor="middle" font-size="9px" font-weight="700" fill="#1e293b">ZONE DNSKEY</text>
          <text x="297" y="32" text-anchor="middle" font-size="8px" fill="${dnssec.statusBadge === 'badge-danger' ? '#ef4444' : '#16a34a'}">RRSIG ECDSA/RSA</text>
          <text x="297" y="44" text-anchor="middle" font-size="7.5px" fill="#64748b">${dnssec.clockInSync ? 'Time Window OK' : 'Time Skew Alert'}</text>
        </g>

        <!-- DNSSEC Status Cards -->
        <g transform="translate(0, 116)">
          <!-- Card 1: Validation Mode -->
          <rect x="0" y="0" width="165" height="64" rx="5" fill="rgba(148, 163, 184, 0.1)" />
          <text x="12" y="18" font-size="8.5px" font-weight="700" fill="#64748b">VALIDATION MODE</text>
          <text x="12" y="36" font-size="12px" font-weight="800" fill="var(--text-color, #0f172a)">${dnssec.mode.toUpperCase()}</text>
          <text x="12" y="52" font-size="8px" fill="#64748b">Secure: ${dnssec.secureRatePct}% | Bogus: ${dnssec.bogusRatePct}%</text>

          <!-- Card 2: Server Clock / NTP Drift -->
          <rect x="180" y="0" width="170" height="64" rx="5" fill="rgba(148, 163, 184, 0.1)" />
          <text x="192" y="18" font-size="8.5px" font-weight="700" fill="#64748b">NTP TIME SYNC DRIFT</text>
          <text x="192" y="36" font-size="12px" font-weight="800" fill="${dnssec.clockInSync ? '#10b981' : '#ef4444'}">${dnssec.clockDriftMs >= 0 ? '+' : ''}${dnssec.clockDriftMs} ms</text>
          <text x="192" y="52" font-size="8px" fill="#64748b">${dnssec.ntpStatus}</text>
        </g>

        <!-- SERVFAIL Gate & Business Risk -->
        <g transform="translate(0, 196)">
          <rect x="0" y="0" width="350" height="132" rx="6" fill="rgba(148, 163, 184, 0.1)" stroke="rgba(148, 163, 184, 0.2)" />
          <text x="16" y="22" font-size="10px" font-weight="700" fill="#64748b">SUBSCRIBER QoE &amp; REVENUE EXPOSURE</text>

          <text x="16" y="46" font-size="18px" font-weight="800" fill="${dnssec.servfailRatePct > 1.5 ? '#ef4444' : '#10b981'}">${dnssec.servfailRatePct}% SERVFAIL</text>
          <text x="150" y="46" font-size="11px" font-weight="600" fill="var(--text-color, #0f172a)">Surge: ~${res.estimatedHourlyTickets} tickets/hr</text>

          <line x1="16" y1="62" x2="334" y2="62" stroke="rgba(148, 163, 184, 0.2)" />

          <text x="16" y="80" font-size="9px" fill="#64748b">Linked Subscribers: ${res.linkedSubscribers} (${res.activeSubscribers} Active)</text>
          <text x="16" y="96" font-size="9px" fill="#64748b">Monthly Portfolio Revenue: ${formatPKR(res.monthlyRevenue)}</text>
          <text x="16" y="112" font-size="9.5px" font-weight="700" fill="${res.healthTier !== 'OPTIMAL' ? '#ef4444' : '#10b981'}">Total Dues At Risk: ${formatPKR(res.duesAtRisk)}</text>
        </g>
      </g>
    </svg>
  `;
}

/**
 * Generates an executive NOC diagnostic briefing for clipboard export.
 */
export function generateDnsDiagnosticReport(metrics, options = {}) {
  const res = metrics.selectedResolver;
  const fwd = res.forwarder;
  const lat = res.latBreakdown;
  const dnssec = res.dnssec;
  const timestamp = options.referenceDate ? new Date(options.referenceDate).toISOString() : new Date().toISOString();

  const lines = [
    '=========================================================================',
    '     SHAHDARA EDGE DNS RESOLVERS & DNSSEC VALIDATION AUDIT BRIEFING      ',
    '=========================================================================',
    `Generated: ${timestamp}`,
    `Total Active Resolvers: ${metrics.resolvers.length} Edge POP Nodes`,
    `Aggregated Query Load: ${metrics.totalQps.toLocaleString()} QPS`,
    `Network Average Response Latency: ${metrics.networkAvgLatencyMs} ms`,
    `Network Average Cache Hit Ratio: ${metrics.networkAvgCacheHitPct}%`,
    `Total Subscribers Monitored: ${metrics.totalSubscribersCovered} accounts`,
    `Total Outstanding Dues At Risk: ${formatPKR(metrics.totalDuesAtRisk)}`,
    '',
    '-------------------------------------------------------------------------',
    `SELECTED RESOLVER NODE: ${res.name}`,
    '-------------------------------------------------------------------------',
    `Node ID: ${res.id} | IP: ${res.ip} | Memory Cache: ${res.memoryCacheMb} MB`,
    `Software Platform: ${res.software}`,
    `Coverage Area: ${res.primaryArea} (${(res.aliasAreas || []).join(', ')})`,
    `Capacity: ${res.currentQps.toLocaleString()} / ${res.qpsCapacity.toLocaleString()} QPS`,
    `Primary Upstream Forwarder: ${fwd.name} (${fwd.primaryIp})`,
    `Upstream Forwarder RTT: ${fwd.rttMs} ms (${fwd.location})`,
    '',
    '-------------------------------------------------------------------------',
    'RECURSIVE QUERY RESPONSE LATENCY BREAKDOWN',
    '-------------------------------------------------------------------------',
    `Weighted Average Response Latency: ${res.effectiveLatencyMs} ms`,
    `- L1 RAM Memory Cache: ${lat.hitRatioPct}% hits @ ${lat.cacheLatMs} ms`,
    `- Local ISP Authoritative Zones: ${lat.authRatioPct}% queries @ ${lat.authLatMs} ms`,
    `- Forwarded Upstream Recursion: ${lat.forwardRatioPct}% queries @ ${lat.fwdLatMs} ms`,
    `- Root / TLD Iterative Resolution: ${lat.iterativeRatioPct}% queries @ ${lat.iterLatMs} ms`,
    '',
    '-------------------------------------------------------------------------',
    'DNSSEC CRYPTOGRAPHIC VALIDATION & INTEGRITY',
    '-------------------------------------------------------------------------',
    `Validation Mode: ${dnssec.mode.toUpperCase()}`,
    `Trust Anchor: Root KSK 2017 (KeyTag 20326)`,
    `Cryptographic Validation Rate: ${dnssec.secureRatePct}% Secure / ${dnssec.bogusRatePct}% Bogus`,
    `Client SERVFAIL Rate: ${dnssec.servfailRatePct}%`,
    `Server NTP Clock Drift: ${dnssec.clockDriftMs >= 0 ? '+' : ''}${dnssec.clockDriftMs} ms (${dnssec.ntpStatus})`,
    `Health Status: ${res.healthTier} (${dnssec.status})`,
    '',
    '-------------------------------------------------------------------------',
    'SUBSCRIBER QoE & BUSINESS IMPACT',
    '-------------------------------------------------------------------------',
    `Linked Area Accounts: ${res.linkedSubscribers} total (${res.activeSubscribers} active)`,
    `Monthly Area Revenue: ${formatPKR(res.monthlyRevenue)}`,
    `Outstanding Area Dues: ${formatPKR(res.duesAtRisk)}`,
    `Estimated Inbound Support Surge: ~${res.estimatedHourlyTickets} tickets/hour`,
    '========================================================================='
  ];

  return lines.join('\n');
}

/**
 * Initializes interactive events and simulation controls for DNS Diagnostics modal dialog.
 */
export function setupDnsDiagnosticsModal(state, options = {}) {
  const modal = document.getElementById('dashboardDnsModal');
  const openBtn = document.getElementById('dashboardOpenDnsModalBtn');
  const closeBtn = document.getElementById('dashboardDnsModalCloseBtn');

  const resolverSelect = document.getElementById('dnsResolverSelect');
  const forwarderSelect = document.getElementById('dnsForwarderSelect');
  const cacheSlider = document.getElementById('dnsCacheSlider');
  const cacheVal = document.getElementById('dnsCacheVal');
  const dnssecSelect = document.getElementById('dnssecModeSelect');
  const driftSlider = document.getElementById('dnsClockDriftSlider');
  const driftVal = document.getElementById('dnsClockDriftVal');
  const resetBtn = document.getElementById('dnsResetSimBtn');

  const kpiNodeName = document.getElementById('dnsKpiNodeName');
  const kpiLatency = document.getElementById('dnsKpiLatency');
  const kpiDnssec = document.getElementById('dnsKpiDnssec');
  const statusBadge = document.getElementById('dnsStatusBadge');
  const kpiRevenueRisk = document.getElementById('dnsKpiRevenueRisk');

  const chartWrap = document.getElementById('dnsModalChartWrap');
  const tableBody = document.getElementById('dnsResolversTableBody');

  const filterAreaBtn = document.getElementById('dnsFilterAreaBtn');
  const copyReportBtn = document.getElementById('dashboardCopyDnsReportBtn');

  function refreshModalView() {
    const metrics = calculateDnsMetrics(state, options);
    const res = metrics.selectedResolver;
    const fwd = res.forwarder;
    const dnssec = res.dnssec;

    if (kpiNodeName) {
      kpiNodeName.textContent = `${res.ip} (${res.primaryArea})`;
    }
    if (kpiLatency) {
      kpiLatency.textContent = `${res.effectiveLatencyMs} ms (${res.cacheHitRatioPct}% Hit)`;
    }
    if (kpiDnssec) {
      kpiDnssec.textContent = `${dnssec.secureRatePct}% Valid (${dnssec.servfailRatePct}% Fail)`;
    }
    if (statusBadge) {
      statusBadge.textContent = res.healthTier;
      statusBadge.className = `sim-delta-badge ${res.healthClass}`;
    }
    if (kpiRevenueRisk) {
      kpiRevenueRisk.textContent = `${formatPKR(res.duesAtRisk)} dues (${res.linkedSubscribers} subs)`;
    }

    if (chartWrap) {
      chartWrap.innerHTML = renderDnsDiagnosticsSvg(metrics, { compact: false });
    }

    if (tableBody) {
      tableBody.innerHTML = metrics.resolvers.map(r => `
        <tr class="${r.isSelected ? 'selected-row' : ''}">
          <td><strong>${r.name}</strong><br><small class="text-muted">${r.ip} · ${r.software}</small></td>
          <td>${r.primaryArea}</td>
          <td>${r.forwarder.name.split(' ')[0]}</td>
          <td>${r.cacheHitRatioPct}%</td>
          <td><strong>${r.effectiveLatencyMs} ms</strong></td>
          <td>${r.dnssec.secureRatePct}%</td>
          <td><span class="sim-delta-badge ${r.healthClass}">${r.healthTier}</span></td>
        </tr>
      `).join('');
    }
  }

  function populateDropdowns() {
    if (resolverSelect) {
      resolverSelect.innerHTML = SHAHDARA_DNS_RESOLVERS.map(r => `
        <option value="${r.id}" ${r.id === simSelectedResolverId ? 'selected' : ''}>
          ${r.name} (${r.ip} - ${r.primaryArea})
        </option>
      `).join('');
    }

    if (forwarderSelect) {
      const currentRes = SHAHDARA_DNS_RESOLVERS.find(r => r.id === simSelectedResolverId) || SHAHDARA_DNS_RESOLVERS[0];
      const activeFwdId = simForwarderId || currentRes.defaultForwarder;
      forwarderSelect.innerHTML = UPSTREAM_FORWARDERS.map(f => `
        <option value="${f.id}" ${f.id === activeFwdId ? 'selected' : ''}>
          ${f.name} - RTT: ${f.rttMs}ms
        </option>
      `).join('');
    }

    if (cacheSlider && cacheVal) {
      const currentRes = SHAHDARA_DNS_RESOLVERS.find(r => r.id === simSelectedResolverId) || SHAHDARA_DNS_RESOLVERS[0];
      const val = simCacheHitRatioPct !== null ? simCacheHitRatioPct : currentRes.baseCacheHitRatioPct;
      cacheSlider.value = val;
      cacheVal.textContent = `${val}%`;
    }

    if (dnssecSelect) {
      dnssecSelect.value = simDnssecMode;
    }

    if (driftSlider && driftVal) {
      const currentRes = SHAHDARA_DNS_RESOLVERS.find(r => r.id === simSelectedResolverId) || SHAHDARA_DNS_RESOLVERS[0];
      const val = simClockDriftMs !== null ? simClockDriftMs : currentRes.baseClockDriftMs;
      driftSlider.value = val;
      driftVal.textContent = `${val >= 0 ? '+' : ''}${val} ms`;
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

  if (resolverSelect) {
    resolverSelect.onchange = (e) => {
      setDnsSelectedResolver(e.target.value);
      populateDropdowns();
      refreshModalView();
    };
  }

  if (forwarderSelect) {
    forwarderSelect.onchange = (e) => {
      setDnsUpstreamForwarder(e.target.value);
      refreshModalView();
    };
  }

  if (cacheSlider) {
    cacheSlider.oninput = (e) => {
      const val = Number(e.target.value);
      setDnsCacheHitRatio(val);
      if (cacheVal) cacheVal.textContent = `${val}%`;
      refreshModalView();
    };
  }

  if (dnssecSelect) {
    dnssecSelect.onchange = (e) => {
      setDnssecMode(e.target.value);
      refreshModalView();
    };
  }

  if (driftSlider) {
    driftSlider.oninput = (e) => {
      const val = Number(e.target.value);
      setDnsClockDriftMs(val);
      if (driftVal) driftVal.textContent = `${val >= 0 ? '+' : ''}${val} ms`;
      refreshModalView();
    };
  }

  if (resetBtn) {
    resetBtn.onclick = () => {
      resetDnsSimState();
      populateDropdowns();
      refreshModalView();
    };
  }

  if (filterAreaBtn) {
    filterAreaBtn.onclick = () => {
      const metrics = calculateDnsMetrics(state, options);
      const res = metrics.selectedResolver;
      if (typeof options.onFilterArea === 'function') {
        options.onFilterArea(res.primaryArea);
        if (modal && typeof modal.close === 'function') {
          modal.close();
        }
      }
    };
  }

  if (copyReportBtn) {
    copyReportBtn.onclick = async () => {
      const metrics = calculateDnsMetrics(state, options);
      const report = generateDnsDiagnosticReport(metrics, options);
      const clipboard = options.clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
      let success = false;
      if (clipboard && typeof clipboard.writeText === 'function') {
        try {
          await clipboard.writeText(report);
          success = true;
        } catch (_) {}
      }
      if (typeof options.onToast === 'function') {
        options.onToast(success ? '✓ DNS Diagnostic Briefing copied to clipboard' : 'Report generated in console');
      }
    };
  }
}
