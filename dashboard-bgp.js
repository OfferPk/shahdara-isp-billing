import { formatPKR } from './core.js';

/**
 * Core IP Backbone BGP Peering Prefix Routing Convergence & Route Leak Flap Damping Estimator
 * Models upstream Tier-1/Tier-2 autonomous systems (Nayatel, PTCL, StormFiber, Transworld, Cybernet, PKIX Lahore IX),
 * RFC 2439 route flap damping exponential penalty decay, suppress/reuse thresholds, RPKI ROA origin validation,
 * TCAM FIB route capacity, and subscriber revenue at risk from upstream route suppression.
 */

export const SHAHDARA_BGP_PEERS = [
  {
    id: 'bgp-nya-01',
    name: 'Nayatel Tier-1 IP Transit (AS133929)',
    peerAsn: 133929,
    localAsn: 204555,
    primaryArea: 'Shahdara Town',
    aliasAreas: ['Shahdara Town', 'Old Town', 'Railway Road'],
    sessionState: 'Established',
    uptimeHours: 342,
    prefixReceived: 924500,
    prefixAdvertised: 4,
    baseFlapCount: 2,
    lastFlapMinsAgo: 75,
    rttMs: 4.2,
    jitterMs: 0.6,
    rpkiValidPct: 98.4,
    linkBandwidthGbps: 10,
    tcamUsagePct: 68,
    cpuLoadPct: 32
  },
  {
    id: 'bgp-ptcl-02',
    name: 'PTCL National Core IP Transit (AS17557)',
    peerAsn: 17557,
    localAsn: 204555,
    primaryArea: 'Baradari Road',
    aliasAreas: ['Baradari Road', 'Bara Dari', 'Tariq Road'],
    sessionState: 'Established',
    uptimeHours: 118,
    prefixReceived: 945200,
    prefixAdvertised: 4,
    baseFlapCount: 7,
    lastFlapMinsAgo: 18,
    rttMs: 6.8,
    jitterMs: 1.4,
    rpkiValidPct: 94.2,
    linkBandwidthGbps: 10,
    tcamUsagePct: 74,
    cpuLoadPct: 45
  },
  {
    id: 'bgp-tw-03',
    name: 'Transworld Subsea IP Transit (AS24499)',
    peerAsn: 24499,
    localAsn: 204555,
    primaryArea: 'Vandala Road',
    aliasAreas: ['Vandala Road', 'Wandala Road', 'Zia Town'],
    sessionState: 'Established',
    uptimeHours: 560,
    prefixReceived: 918000,
    prefixAdvertised: 4,
    baseFlapCount: 1,
    lastFlapMinsAgo: 140,
    rttMs: 5.1,
    jitterMs: 0.8,
    rpkiValidPct: 99.1,
    linkBandwidthGbps: 10,
    tcamUsagePct: 65,
    cpuLoadPct: 28
  },
  {
    id: 'bgp-sf-04',
    name: 'StormFiber Metro Carrier Peering (AS38264)',
    peerAsn: 38264,
    localAsn: 204555,
    primaryArea: 'Jia Musa',
    aliasAreas: ['Jia Musa', 'Farrukhabad'],
    sessionState: 'Established',
    uptimeHours: 84,
    prefixReceived: 14200,
    prefixAdvertised: 4,
    baseFlapCount: 12,
    lastFlapMinsAgo: 9,
    rttMs: 3.5,
    jitterMs: 1.9,
    rpkiValidPct: 96.5,
    linkBandwidthGbps: 5,
    tcamUsagePct: 42,
    cpuLoadPct: 38
  },
  {
    id: 'bgp-cyb-05',
    name: 'Cybernet Enterprise Backbone (AS9541)',
    peerAsn: 9541,
    localAsn: 204555,
    primaryArea: 'Saeed Park',
    aliasAreas: ['Saeed Park', 'Rehman Park'],
    sessionState: 'Established',
    uptimeHours: 290,
    prefixReceived: 932000,
    prefixAdvertised: 4,
    baseFlapCount: 3,
    lastFlapMinsAgo: 45,
    rttMs: 4.8,
    jitterMs: 0.9,
    rpkiValidPct: 97.8,
    linkBandwidthGbps: 10,
    tcamUsagePct: 69,
    cpuLoadPct: 34
  },
  {
    id: 'bgp-pkix-06',
    name: 'PKIX Lahore Internet Exchange (AS132165)',
    peerAsn: 132165,
    localAsn: 204555,
    primaryArea: 'All Areas',
    aliasAreas: ['Shahdara Town', 'Baradari Road', 'Vandala Road', 'Jia Musa', 'Saeed Park'],
    sessionState: 'Established',
    uptimeHours: 720,
    prefixReceived: 3100,
    prefixAdvertised: 4,
    baseFlapCount: 0,
    lastFlapMinsAgo: 999,
    rttMs: 1.8,
    jitterMs: 0.3,
    rpkiValidPct: 99.8,
    linkBandwidthGbps: 20,
    tcamUsagePct: 28,
    cpuLoadPct: 18
  }
];

// RFC 2439 Flap Damping Standard Constants
export const BGP_CONSTANTS = {
  PENALTY_PER_FLAP: 1000,
  DEFAULT_HALF_LIFE_MINS: 15,
  DEFAULT_SUPPRESS_THRESHOLD: 2000,
  DEFAULT_REUSE_THRESHOLD: 750,
  MAX_SUPPRESS_TIME_MINS: 60,
  TOTAL_FIB_TCAM_CAPACITY_PREFIXES: 1500000
};

// Simulation state
let selectedBgpPeerId = null;
let simFlapCount = null;
let simSuppressThreshold = null;

export function getBgpSelectedPeer() {
  return selectedBgpPeerId || SHAHDARA_BGP_PEERS[0].id;
}

export function setBgpSelectedPeer(id) {
  selectedBgpPeerId = id;
}

export function getBgpFlapCount() {
  return simFlapCount;
}

export function setBgpFlapCount(count) {
  simFlapCount = typeof count === 'number' && !isNaN(count) ? Math.max(0, Math.min(30, count)) : null;
}

export function getBgpSuppressThreshold() {
  return simSuppressThreshold !== null ? simSuppressThreshold : BGP_CONSTANTS.DEFAULT_SUPPRESS_THRESHOLD;
}

export function setBgpSuppressThreshold(val) {
  simSuppressThreshold = typeof val === 'number' && !isNaN(val) ? Math.max(1000, Math.min(5000, val)) : null;
}

export function resetBgpSimState() {
  selectedBgpPeerId = null;
  simFlapCount = null;
  simSuppressThreshold = null;
}

/**
 * Calculates RFC 2439 exponential penalty decay for route flap damping.
 * P(t) = P0 * 2^(-t / T_half)
 */
export function calculateBgpFlapPenalty(flaps, minutesSinceLastFlap = 0, halfLifeMins = BGP_CONSTANTS.DEFAULT_HALF_LIFE_MINS) {
  const safeFlaps = Math.max(0, Number(flaps) || 0);
  const safeMins = Math.max(0, Number(minutesSinceLastFlap) || 0);
  const safeHalfLife = Math.max(1, Number(halfLifeMins) || BGP_CONSTANTS.DEFAULT_HALF_LIFE_MINS);

  const initialPenalty = safeFlaps * BGP_CONSTANTS.PENALTY_PER_FLAP;
  const decayFactor = Math.pow(2, -safeMins / safeHalfLife);
  const currentPenalty = Math.round(initialPenalty * decayFactor);

  return {
    initialPenalty,
    currentPenalty,
    decayFactor: Number(decayFactor.toFixed(4)),
    halfLifeMins: safeHalfLife
  };
}

/**
 * Calculates route convergence time based on prefix count, CPU load, and TCAM FIB usage.
 */
export function calculateRouteConvergenceTime(prefixCount, cpuLoadPct = 30, tcamUsagePct = 60) {
  const safePrefixes = Math.max(0, Number(prefixCount) || 0);
  const safeCpu = Math.max(5, Math.min(100, Number(cpuLoadPct) || 30));
  const safeTcam = Math.max(10, Math.min(100, Number(tcamUsagePct) || 60));

  // Base: ~0.00035ms per prefix calculation with CPU and TCAM contention multipliers
  const baseMs = safePrefixes * 0.00035;
  const cpuMultiplier = 1 + (safeCpu / 80);
  const tcamMultiplier = 1 + (safeTcam / 120);

  const convergenceTimeMs = Math.round(baseMs * cpuMultiplier * tcamMultiplier);
  return Math.max(12, convergenceTimeMs);
}

/**
 * Calculates metrics across all Shahdara BGP peers and evaluates subscriber revenue at risk.
 */
export function calculateBgpPeeringMetrics(state = {}, options = {}) {
  const selectedId = getBgpSelectedPeer();
  const suppressThreshold = getBgpSuppressThreshold();
  const reuseThreshold = BGP_CONSTANTS.DEFAULT_REUSE_THRESHOLD;

  const customers = Array.isArray(state?.customers) ? state.customers : [];
  const bills = Array.isArray(state?.bills) ? state.bills : [];

  // Group subscriber counts and outstanding dues by normalized area
  const areaRevenueMap = {};
  const areaCustMap = {};

  customers.forEach(cust => {
    if (cust.isArchived) return;
    const area = (cust.area || 'Unknown').trim();
    areaCustMap[area] = (areaCustMap[area] || 0) + 1;
  });

  bills.forEach(bill => {
    const cust = customers.find(c => c.id === bill.customerId);
    if (!cust || cust.isArchived) return;
    const area = (cust.area || 'Unknown').trim();
    const balance = Math.max(0, Number(bill.balance) || 0);
    areaRevenueMap[area] = (areaRevenueMap[area] || 0) + balance;
  });

  let totalPeers = SHAHDARA_BGP_PEERS.length;
  let establishedPeers = 0;
  let totalPrefixesReceived = 0;
  let suppressedPeersCount = 0;
  let totalSuppressedPrefixes = 0;
  let weightedRpkiValid = 0;
  let totalLinkCapacityGbps = 0;

  const evaluatedPeers = SHAHDARA_BGP_PEERS.map(peer => {
    const isSelected = peer.id === selectedId;
    const flapCount = (isSelected && simFlapCount !== null) ? simFlapCount : peer.baseFlapCount;
    const minsAgo = (isSelected && simFlapCount !== null) ? 0 : peer.lastFlapMinsAgo;
    
    // Evaluate flap penalty
    const penaltyData = calculateBgpFlapPenalty(flapCount, minsAgo, BGP_CONSTANTS.DEFAULT_HALF_LIFE_MINS);
    const penalty = penaltyData.currentPenalty;
    const isSuppressed = penalty >= suppressThreshold;
    const isDamped = penalty >= reuseThreshold;

    // Time until reuse if suppressed
    let minsUntilReuse = 0;
    if (isSuppressed && penalty > reuseThreshold) {
      minsUntilReuse = Math.round(BGP_CONSTANTS.DEFAULT_HALF_LIFE_MINS * Math.log2(penalty / reuseThreshold));
      minsUntilReuse = Math.min(minsUntilReuse, BGP_CONSTANTS.MAX_SUPPRESS_TIME_MINS);
    }

    const convergenceMs = calculateRouteConvergenceTime(peer.prefixReceived, peer.cpuLoadPct, peer.tcamUsagePct);

    // Calculate linked subscribers and dues at risk
    let linkedSubscribers = 0;
    let linkedDues = 0;

    const matchedAreas = peer.aliasAreas || [peer.primaryArea];
    matchedAreas.forEach(areaKey => {
      Object.keys(areaCustMap).forEach(custArea => {
        if (custArea.toLowerCase().includes(areaKey.toLowerCase()) || areaKey.toLowerCase().includes(custArea.toLowerCase())) {
          linkedSubscribers += (areaCustMap[custArea] || 0);
          linkedDues += (areaRevenueMap[custArea] || 0);
        }
      });
    });

    if (peer.sessionState === 'Established') {
      establishedPeers++;
    }
    totalPrefixesReceived += peer.prefixReceived;
    totalLinkCapacityGbps += peer.linkBandwidthGbps;
    weightedRpkiValid += peer.rpkiValidPct * peer.prefixReceived;

    if (isSuppressed) {
      suppressedPeersCount++;
      totalSuppressedPrefixes += peer.prefixReceived;
    }

    // Health tier
    let healthTier = 'Optimal';
    let statusClass = 'badge-success';
    if (isSuppressed) {
      healthTier = 'Suppressed';
      statusClass = 'badge-danger';
    } else if (isDamped || flapCount >= 6) {
      healthTier = 'Flapping';
      statusClass = 'badge-warning';
    } else if (peer.rpkiValidPct < 95) {
      healthTier = 'RPKI Warning';
      statusClass = 'badge-warning';
    }

    return {
      ...peer,
      isSelected,
      effectiveFlapCount: flapCount,
      penalty,
      isSuppressed,
      isDamped,
      minsUntilReuse,
      convergenceMs,
      linkedSubscribers,
      linkedDues,
      healthTier,
      statusClass
    };
  });

  const selectedPeerData = evaluatedPeers.find(p => p.id === selectedId) || evaluatedPeers[0];
  const overallRpkiValidPct = totalPrefixesReceived > 0 
    ? Number((weightedRpkiValid / totalPrefixesReceived).toFixed(1)) 
    : 97.5;

  const totalDuesAtRisk = evaluatedPeers
    .filter(p => p.isSuppressed)
    .reduce((acc, p) => acc + p.linkedDues, 0);

  const totalSubscribersAtRisk = evaluatedPeers
    .filter(p => p.isSuppressed)
    .reduce((acc, p) => acc + p.linkedSubscribers, 0);

  return {
    peers: evaluatedPeers,
    selectedPeer: selectedPeerData,
    totalPeers,
    establishedPeers,
    totalPrefixesReceived,
    suppressedPeersCount,
    totalSuppressedPrefixes,
    totalLinkCapacityGbps,
    overallRpkiValidPct,
    totalDuesAtRisk,
    totalSubscribersAtRisk,
    suppressThreshold,
    reuseThreshold
  };
}

/**
 * Generates pure offline theme-aware SVG visualization.
 * Supports compact mode for dashboard card and detailed mode for modal dialog.
 */
export function renderBgpRoutingConvergenceSvg(metrics, options = {}) {
  const compact = !!options.compact;
  const p = metrics.selectedPeer;
  const peers = metrics.peers || [];

  if (compact) {
    const width = 480;
    const height = 180;
    
    // Status color
    const statusColor = p.isSuppressed ? '#dc2626' : p.isDamped ? '#ea580c' : '#16a34a';

    // RPKI segments
    const validWidth = Math.round((metrics.overallRpkiValidPct / 100) * 220);
    const invalidWidth = 220 - validWidth;

    return `
      <svg viewBox="0 0 ${width} ${height}" class="splicer-svg bgp-svg" role="img" aria-label="BGP Peering and Flap Damping Overview" xmlns="http://www.w3.org/2000/svg">
        <style>
          .bgp-text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
          .bgp-title { font-size: 13px; font-weight: 700; fill: var(--text-color, #1e293b); }
          .bgp-sub { font-size: 10px; fill: var(--text-muted, #64748b); }
          .bgp-val { font-size: 14px; font-weight: 700; fill: var(--text-color, #1e293b); }
          .bgp-bar-bg { fill: rgba(148, 163, 184, 0.2); rx: 4px; }
          .bgp-grid-line { stroke: rgba(148, 163, 184, 0.25); stroke-dasharray: 3,3; stroke-width: 1; }
        </style>

        <!-- Background Panel -->
        <rect x="0" y="0" width="${width}" height="${height}" rx="8" fill="var(--surface, #ffffff)" stroke="rgba(148, 163, 184, 0.25)" stroke-width="1" />

        <!-- Header / Selected Peer Summary -->
        <circle cx="20" cy="22" r="6" fill="${statusColor}" />
        <text x="32" y="26" class="bgp-text bgp-title">${p.name.length > 34 ? p.name.slice(0, 32) + '...' : p.name}</text>
        <text x="${width - 16}" y="26" text-anchor="end" class="bgp-text" font-size="11px" font-weight="700" fill="${statusColor}">${p.healthTier.toUpperCase()}</text>

        <!-- KPI Columns -->
        <g transform="translate(16, 42)">
          <!-- Established Peers -->
          <text x="0" y="10" class="bgp-text bgp-sub">ESTABLISHED PEERS</text>
          <text x="0" y="28" class="bgp-text bgp-val">${metrics.establishedPeers} / ${metrics.totalPeers}</text>
          <text x="0" y="42" class="bgp-text bgp-sub">${(metrics.totalLinkCapacityGbps)} Gbps Transit</text>

          <!-- Flap Penalty -->
          <text x="120" y="10" class="bgp-text bgp-sub">FLAP PENALTY</text>
          <text x="120" y="28" class="bgp-text bgp-val" fill="${statusColor}">${p.penalty} pts</text>
          <text x="120" y="42" class="bgp-text bgp-sub">Thresh: ${metrics.suppressThreshold}</text>

          <!-- Convergence Latency -->
          <text x="240" y="10" class="bgp-text bgp-sub">CONVERGENCE</text>
          <text x="240" y="28" class="bgp-text bgp-val">${p.convergenceMs} ms</text>
          <text x="240" y="42" class="bgp-text bgp-sub">RTT: ${p.rttMs}ms</text>

          <!-- RPKI ROA Valid -->
          <text x="350" y="10" class="bgp-text bgp-sub">RPKI ROA VALID</text>
          <text x="350" y="28" class="bgp-text bgp-val" fill="#16a34a">${metrics.overallRpkiValidPct}%</text>
          <text x="350" y="42" class="bgp-text bgp-sub">${metrics.totalPrefixesReceived.toLocaleString()} pfx</text>
        </g>

        <!-- Mini Flap Decay Curve & Gauge -->
        <g transform="translate(16, 105)">
          <text x="0" y="12" class="bgp-text bgp-sub">FLAP DAMPING EXPONENTIAL DECAY (HALF-LIFE 15m)</text>
          
          <!-- Threshold reference line -->
          <line x1="0" y1="45" x2="210" y2="45" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="2,2" />
          <text x="214" y="48" class="bgp-text" font-size="8px" fill="#ef4444">SUPPRESS (${metrics.suppressThreshold})</text>

          <!-- Decay line representation -->
          <path d="M 0,${Math.max(18, 55 - (p.penalty / 60))} Q 70,${Math.max(22, 55 - (p.penalty / 120))} 200,52" fill="none" stroke="${statusColor}" stroke-width="2.5" />
          <circle cx="0" cy="${Math.max(18, 55 - (p.penalty / 60))}" r="4" fill="${statusColor}" />

          <!-- RPKI Distribution Bar -->
          <g transform="translate(260, 10)">
            <text x="0" y="2" class="bgp-text bgp-sub">ROUTING SECURITY &amp; RPKI ROA</text>
            <rect x="0" y="10" width="180" height="12" class="bgp-bar-bg" />
            <rect x="0" y="10" width="${Math.round((metrics.overallRpkiValidPct / 100) * 180)}" height="12" rx="3" fill="#16a34a" />
            <rect x="${Math.round((metrics.overallRpkiValidPct / 100) * 180)}" y="10" width="${180 - Math.round((metrics.overallRpkiValidPct / 100) * 180)}" height="12" rx="3" fill="#f59e0b" />
            <text x="0" y="34" class="bgp-text bgp-sub">✓ Valid: ${metrics.overallRpkiValidPct}%</text>
            <text x="180" y="34" text-anchor="end" class="bgp-text bgp-sub">Unknown/Leak: ${(100 - metrics.overallRpkiValidPct).toFixed(1)}%</text>
          </g>
        </g>
      </svg>
    `;
  }

  // Detailed Modal SVG (width 740, height 330)
  const width = 740;
  const height = 330;
  const statusColor = p.isSuppressed ? '#dc2626' : p.isDamped ? '#ea580c' : '#16a34a';

  // TCAM Bar
  const tcamBarWidth = Math.round((p.tcamUsagePct / 100) * 200);

  // Calculate curve points for 45 minutes decay
  // Penalty at t=0, t=15, t=30, t=45
  const p0 = p.penalty;
  const p15 = Math.round(p0 * 0.5);
  const p30 = Math.round(p0 * 0.25);
  const p45 = Math.round(p0 * 0.125);

  const scaleY = (val) => Math.max(25, Math.min(170, 170 - (val / 5000) * 140));

  const y0 = scaleY(p0);
  const y15 = scaleY(p15);
  const y30 = scaleY(p30);
  const y45 = scaleY(p45);

  const ySuppress = scaleY(metrics.suppressThreshold);
  const yReuse = scaleY(metrics.reuseThreshold);

  return `
    <svg viewBox="0 0 ${width} ${height}" class="splicer-svg bgp-svg-detailed" role="img" aria-label="BGP Peering Topology and Flap Damping Simulation" xmlns="http://www.w3.org/2000/svg">
      <style>
        .bgp-text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        .bgp-title { font-size: 14px; font-weight: 700; fill: var(--text-color, #1e293b); }
        .bgp-sub { font-size: 11px; fill: var(--text-muted, #64748b); }
        .bgp-val { font-size: 15px; font-weight: 700; fill: var(--text-color, #1e293b); }
        .bgp-axis { stroke: rgba(148, 163, 184, 0.4); stroke-width: 1; }
        .bgp-grid { stroke: rgba(148, 163, 184, 0.18); stroke-dasharray: 4,4; stroke-width: 1; }
      </style>

      <!-- Outer Frame -->
      <rect x="0" y="0" width="${width}" height="${height}" rx="10" fill="var(--surface, #ffffff)" stroke="rgba(148, 163, 184, 0.3)" stroke-width="1" />

      <!-- Left Panel: Flap Damping Decay Curve -->
      <g transform="translate(24, 20)">
        <text x="0" y="14" class="bgp-text bgp-title">RFC 2439 Route Flap Penalty Decay Simulation</text>
        <text x="0" y="28" class="bgp-text bgp-sub">Peer: ${p.name} | ASN: ${p.peerAsn} | Flaps: ${p.effectiveFlapCount}</text>

        <!-- Plot Box -->
        <rect x="40" y="40" width="310" height="150" fill="rgba(148, 163, 184, 0.05)" rx="4" />
        
        <!-- Y Grid & Labels -->
        <line x1="40" y1="50" x2="350" y2="50" class="bgp-grid" />
        <text x="34" y="54" text-anchor="end" class="bgp-text" font-size="9px" fill="#64748b">4500</text>

        <line x1="40" y1="95" x2="350" y2="95" class="bgp-grid" />
        <text x="34" y="99" text-anchor="end" class="bgp-text" font-size="9px" fill="#64748b">3000</text>

        <line x1="40" y1="140" x2="350" y2="140" class="bgp-grid" />
        <text x="34" y="144" text-anchor="end" class="bgp-text" font-size="9px" fill="#64748b">1500</text>

        <!-- Suppress threshold line -->
        <line x1="40" y1="${ySuppress}" x2="350" y2="${ySuppress}" stroke="#ef4444" stroke-width="1.8" stroke-dasharray="4,3" />
        <text x="355" y="${ySuppress + 4}" class="bgp-text" font-size="9px" font-weight="700" fill="#ef4444">SUPPRESS (${metrics.suppressThreshold})</text>

        <!-- Reuse threshold line -->
        <line x1="40" y1="${yReuse}" x2="350" y2="${yReuse}" stroke="#16a34a" stroke-width="1.8" stroke-dasharray="4,3" />
        <text x="355" y="${yReuse + 4}" class="bgp-text" font-size="9px" font-weight="700" fill="#16a34a">REUSE (${metrics.reuseThreshold})</text>

        <!-- Curve -->
        <path d="M 50,${y0} C 120,${(y0 + y15) / 2} 160,${y15} 210,${y15} C 260,${y15} 280,${y30} 340,${y45}" fill="none" stroke="${statusColor}" stroke-width="3" />
        <circle cx="50" cy="${y0}" r="5" fill="${statusColor}" />
        <circle cx="210" cy="${y15}" r="4" fill="${statusColor}" opacity="0.8" />
        <circle cx="340" cy="${y45}" r="4" fill="${statusColor}" opacity="0.6" />

        <!-- X Axis labels -->
        <text x="50" y="204" text-anchor="middle" class="bgp-text" font-size="9px" fill="#64748b">Now (0m)</text>
        <text x="210" y="204" text-anchor="middle" class="bgp-text" font-size="9px" fill="#64748b">15m (T½)</text>
        <text x="340" y="204" text-anchor="middle" class="bgp-text" font-size="9px" fill="#64748b">45m (3T½)</text>

        <!-- Decay status callout -->
        <rect x="40" y="216" width="310" height="40" rx="6" fill="rgba(148, 163, 184, 0.12)" />
        <text x="52" y="232" class="bgp-text" font-size="11px" font-weight="700" fill="var(--text-color, #1e293b)">Current Penalty: ${p.penalty} pts (${p.healthTier})</text>
        <text x="52" y="247" class="bgp-text bgp-sub">${p.isSuppressed ? `Route suppressed for next ~${p.minsUntilReuse} minutes` : `Route actively accepted in FIB`}</text>
      </g>

      <!-- Right Panel: BGP Architecture & TCAM / FIB Health -->
      <g transform="translate(430, 20)">
        <text x="0" y="14" class="bgp-text bgp-title">Hardware FIB &amp; Peering Capacity</text>
        <text x="0" y="28" class="bgp-text bgp-sub">Border Router: MikroTik CCR2216 / TCAM 1.5M Pfx</text>

        <!-- TCAM Occupancy Bar -->
        <g transform="translate(0, 44)">
          <text x="0" y="12" class="bgp-text bgp-sub">TCAM FIB ROUTE TABLE OCCUPANCY</text>
          <text x="280" y="12" text-anchor="end" class="bgp-text bgp-val">${p.tcamUsagePct}%</text>
          <rect x="0" y="20" width="280" height="14" rx="4" fill="rgba(148, 163, 184, 0.2)" />
          <rect x="0" y="20" width="${Math.round((p.tcamUsagePct / 100) * 280)}" height="14" rx="4" fill="${p.tcamUsagePct > 85 ? '#ef4444' : p.tcamUsagePct > 70 ? '#f59e0b' : '#3b82f6'}" />
          <text x="0" y="46" class="bgp-text bgp-sub">${p.prefixReceived.toLocaleString()} IPv4/IPv6 prefixes loaded</text>
          <text x="280" y="46" text-anchor="end" class="bgp-text bgp-sub">CPU: ${p.cpuLoadPct}%</text>
        </g>

        <!-- Peering Route Security -->
        <g transform="translate(0, 114)">
          <text x="0" y="12" class="bgp-text bgp-sub">RPKI ROA CRYPTOGRAPHIC ORIGIN VALIDATION</text>
          <text x="280" y="12" text-anchor="end" class="bgp-text bgp-val" fill="#16a34a">${p.rpkiValidPct}% Valid</text>
          <rect x="0" y="20" width="280" height="14" rx="4" fill="rgba(148, 163, 184, 0.2)" />
          <rect x="0" y="20" width="${Math.round((p.rpkiValidPct / 100) * 280)}" height="14" rx="4" fill="#16a34a" />
          <rect x="${Math.round((p.rpkiValidPct / 100) * 280)}" y="20" width="${280 - Math.round((p.rpkiValidPct / 100) * 280)}" height="14" rx="4" fill="#f59e0b" />
          <text x="0" y="46" class="bgp-text bgp-sub">ROA Valid: ${Math.round((p.prefixReceived * p.rpkiValidPct) / 100).toLocaleString()}</text>
          <text x="280" y="46" text-anchor="end" class="bgp-text bgp-sub">Unverified/Unknown: ${Math.round((p.prefixReceived * (100 - p.rpkiValidPct)) / 100).toLocaleString()}</text>
        </g>

        <!-- Convergence & Latency Card -->
        <g transform="translate(0, 184)">
          <rect x="0" y="0" width="280" height="72" rx="6" fill="rgba(148, 163, 184, 0.12)" />
          <text x="14" y="20" class="bgp-text bgp-sub">CONVERGENCE SPEED</text>
          <text x="14" y="40" class="bgp-text bgp-val">${p.convergenceMs} ms</text>
          <text x="14" y="56" class="bgp-text bgp-sub">Best-path recalculated</text>

          <text x="160" y="20" class="bgp-text bgp-sub">LINK LATENCY</text>
          <text x="160" y="40" class="bgp-text bgp-val">${p.rttMs} ms</text>
          <text x="160" y="56" class="bgp-text bgp-sub">Jitter: ±${p.jitterMs}ms</text>
        </g>
      </g>
    </svg>
  `;
}

/**
 * Formats plain text executive NOC briefing for clipboard export.
 */
export function generateBgpRoutingReport(metrics, options = {}) {
  const p = metrics.selectedPeer;
  const timestamp = options.referenceDate ? new Date(options.referenceDate).toISOString() : new Date().toISOString();

  const lines = [
    '=========================================================================',
    '  SHAHDARA CORE IP BACKBONE BGP PEERING & FLAP DAMPING AUDIT BRIEFING   ',
    '=========================================================================',
    `Generated: ${timestamp}`,
    `Local Border ASN: AS204555 (Shahdara Telecom Gateway)`,
    `Total Peering Sessions: ${metrics.totalPeers} (${metrics.establishedPeers} Established)`,
    `Aggregated Transit Capacity: ${metrics.totalLinkCapacityGbps} Gbps`,
    `Total Prefixes Received: ${metrics.totalPrefixesReceived.toLocaleString()} IPv4/IPv6`,
    `Network-Wide RPKI ROA Validity: ${metrics.overallRpkiValidPct}%`,
    `Suppressed Peering Sessions: ${metrics.suppressedPeersCount} (${metrics.totalSuppressedPrefixes.toLocaleString()} pfx damped)`,
    `Total Subscriber Dues At Risk: ${formatPKR(metrics.totalDuesAtRisk)} (${metrics.totalSubscribersAtRisk} subscribers affected)`,
    '',
    '-------------------------------------------------------------------------',
    `SELECTED CARRIER SESSION: ${p.name}`,
    '-------------------------------------------------------------------------',
    `Peer ASN: AS${p.peerAsn} | Session State: ${p.sessionState} (Uptime: ${p.uptimeHours} hrs)`,
    `Primary Coverage Sector: ${p.primaryArea} (${p.aliasAreas.join(', ')})`,
    `Link Bandwidth: ${p.linkBandwidthGbps} Gbps | RTT: ${p.rttMs} ms | Jitter: ±${p.jitterMs} ms`,
    `Received Prefixes: ${p.prefixReceived.toLocaleString()} | Advertised: ${p.prefixAdvertised}`,
    `TCAM FIB Utilization: ${p.tcamUsagePct}% | Border CPU Load: ${p.cpuLoadPct}%`,
    `RPKI ROA Validity: ${p.rpkiValidPct}%`,
    '',
    'FLAP DAMPING METRICS (RFC 2439):',
    `Flap Count: ${p.effectiveFlapCount} flaps (Last flap: ${p.lastFlapMinsAgo} min ago)`,
    `Accumulated Penalty: ${p.penalty} points`,
    `Suppress Threshold: ${metrics.suppressThreshold} points | Reuse Threshold: ${metrics.reuseThreshold} points`,
    `Operational Status: ${p.healthTier.toUpperCase()}`,
    p.isSuppressed 
      ? `WARNING: Session is SUPPRESSED. Expected damping release in ~${p.minsUntilReuse} minutes.` 
      : 'Session is ACCEPTED and active in hardware forwarding FIB table.',
    `Estimated Route Convergence Time: ${p.convergenceMs} ms`,
    `Linked Area Revenue Exposure: ${formatPKR(p.linkedDues)} across ${p.linkedSubscribers} active subscribers`,
    '',
    '-------------------------------------------------------------------------',
    'ALL SHAHDARA BGP PEERS & CARRIERS REGISTER:',
    '-------------------------------------------------------------------------'
  ];

  metrics.peers.forEach(peer => {
    lines.push(
      `[${peer.sessionState.toUpperCase()}] AS${peer.peerAsn} - ${peer.name} | Flaps: ${peer.effectiveFlapCount} | Penalty: ${peer.penalty} pts | RPKI: ${peer.rpkiValidPct}% | Status: ${peer.healthTier}`
    );
  });

  lines.push('');
  lines.push('OPERATIONAL MITIGATION ACTIONS:');
  if (metrics.suppressedPeersCount > 0) {
    lines.push('1. [URGENT] Reroute default transit traffic via alternate established upstream carriers.');
    lines.push('2. Engage upstream carrier NOC to investigate fiber route flapping and optical link stability.');
    lines.push('3. Review local route-map local-preference to prevent traffic blackholing.');
  } else {
    lines.push('1. All upstream transit and local IX sessions operating within normal convergence parameters.');
    lines.push('2. RPKI cryptographic filtering active; drop invalid ROA prefixes to protect against route leaks.');
    lines.push('3. TCAM memory headroom sufficient for full global routing table expansion.');
  }

  lines.push('=========================================================================');
  return lines.join('\n');
}

/**
 * Initializes and wires the BGP modal dialog.
 */
export function setupBgpRoutingModal(state = {}, options = {}) {
  const modal = document.getElementById('dashboardBgpModal');
  const openBtn = document.getElementById('dashboardOpenBgpModalBtn');
  const closeBtn = document.getElementById('dashboardBgpModalCloseBtn');
  const peerSelect = document.getElementById('bgpPeerSelect');
  const flapSlider = document.getElementById('bgpFlapSlider');
  const flapVal = document.getElementById('bgpFlapVal');
  const threshSlider = document.getElementById('bgpThreshSlider');
  const threshVal = document.getElementById('bgpThreshVal');
  const resetBtn = document.getElementById('bgpResetSimBtn');
  const chartWrap = document.getElementById('bgpModalChartWrap');
  const filterAreaBtn = document.getElementById('bgpFilterAreaBtn');
  const copyReportBtn = document.getElementById('dashboardCopyBgpReportBtn');
  const tableBody = document.getElementById('bgpPeersTableBody');

  // KPI elements
  const kpiPeerName = document.getElementById('bgpKpiPeerName');
  const kpiPenalty = document.getElementById('bgpKpiPenalty');
  const kpiConvergence = document.getElementById('bgpKpiConvergence');
  const kpiStatusBadge = document.getElementById('bgpStatusBadge');
  const kpiRevenueRisk = document.getElementById('bgpKpiRevenueRisk');

  if (!modal) return;

  function refreshModal() {
    const metrics = calculateBgpPeeringMetrics(state, options);
    const p = metrics.selectedPeer;

    // Update KPI badges
    if (kpiPeerName) {
      kpiPeerName.textContent = `AS${p.peerAsn} (${p.name.split(' ')[0]})`;
    }
    if (kpiPenalty) {
      kpiPenalty.textContent = `${p.penalty} pts (${p.effectiveFlapCount} flaps)`;
    }
    if (kpiConvergence) {
      kpiConvergence.textContent = `${p.convergenceMs} ms (RTT ${p.rttMs}ms)`;
    }
    if (kpiStatusBadge) {
      kpiStatusBadge.textContent = p.healthTier.toUpperCase();
      kpiStatusBadge.className = `sim-delta-badge ${p.statusClass}`;
    }
    if (kpiRevenueRisk) {
      kpiRevenueRisk.textContent = `${formatPKR(p.linkedDues)} at risk (${p.linkedSubscribers} subs)`;
    }

    // Update slider pills
    if (flapVal) {
      flapVal.textContent = `${p.effectiveFlapCount} flaps`;
    }
    if (threshVal) {
      threshVal.textContent = `${metrics.suppressThreshold} pts`;
    }

    // Render detailed SVG
    if (chartWrap) {
      chartWrap.innerHTML = renderBgpRoutingConvergenceSvg(metrics, { compact: false });
    }

    // Populate peer table
    if (tableBody) {
      tableBody.innerHTML = metrics.peers.map(peer => `
        <tr class="${peer.isSelected ? 'selected-row' : ''}">
          <td><strong>AS${peer.peerAsn}</strong><br><small>${peer.name}</small></td>
          <td>${peer.primaryArea}</td>
          <td>${peer.effectiveFlapCount} flaps (${peer.penalty} pts)</td>
          <td>${peer.convergenceMs} ms</td>
          <td>${peer.rpkiValidPct}%</td>
          <td><span class="sim-delta-badge ${peer.statusClass}">${peer.healthTier}</span></td>
        </tr>
      `).join('');
    }
  }

  // Populate peer dropdown once
  if (peerSelect && peerSelect.options.length === 0) {
    SHAHDARA_BGP_PEERS.forEach(peer => {
      const opt = document.createElement('option');
      opt.value = peer.id;
      opt.textContent = `${peer.name} [AS${peer.peerAsn}]`;
      peerSelect.appendChild(opt);
    });
  }

  // Open modal handler
  if (openBtn) {
    openBtn.onclick = () => {
      if (typeof modal.showModal === 'function') {
        modal.showModal();
      } else {
        modal.setAttribute('open', '');
      }
      if (peerSelect) {
        peerSelect.value = getBgpSelectedPeer();
      }
      if (flapSlider) {
        flapSlider.value = getBgpFlapCount() !== null ? getBgpFlapCount() : SHAHDARA_BGP_PEERS.find(p => p.id === getBgpSelectedPeer())?.baseFlapCount || 2;
      }
      if (threshSlider) {
        threshSlider.value = getBgpSuppressThreshold();
      }
      refreshModal();
    };
  }

  // Close modal handler
  if (closeBtn) {
    closeBtn.onclick = () => {
      if (typeof modal.close === 'function') {
        modal.close();
      } else {
        modal.removeAttribute('open');
      }
    };
  }

  // Peer select change
  if (peerSelect) {
    peerSelect.onchange = () => {
      setBgpSelectedPeer(peerSelect.value);
      if (flapSlider) {
        const peer = SHAHDARA_BGP_PEERS.find(p => p.id === peerSelect.value);
        flapSlider.value = peer ? peer.baseFlapCount : 2;
        setBgpFlapCount(Number(flapSlider.value));
      }
      refreshModal();
    };
  }

  // Flap count slider input
  if (flapSlider) {
    flapSlider.oninput = () => {
      setBgpFlapCount(Number(flapSlider.value));
      refreshModal();
    };
  }

  // Threshold slider input
  if (threshSlider) {
    threshSlider.oninput = () => {
      setBgpSuppressThreshold(Number(threshSlider.value));
      refreshModal();
    };
  }

  // Reset button
  if (resetBtn) {
    resetBtn.onclick = () => {
      resetBgpSimState();
      if (peerSelect) {
        peerSelect.value = getBgpSelectedPeer();
      }
      if (flapSlider) {
        flapSlider.value = SHAHDARA_BGP_PEERS[0].baseFlapCount;
      }
      if (threshSlider) {
        threshSlider.value = BGP_CONSTANTS.DEFAULT_SUPPRESS_THRESHOLD;
      }
      refreshModal();
    };
  }

  // Filter area linked subscribers
  if (filterAreaBtn) {
    filterAreaBtn.onclick = () => {
      const metrics = calculateBgpPeeringMetrics(state, options);
      const targetArea = metrics.selectedPeer.primaryArea;
      if (typeof options.onFilterArea === 'function') {
        options.onFilterArea(targetArea);
      }
      if (typeof modal.close === 'function') {
        modal.close();
      } else {
        modal.removeAttribute('open');
      }
    };
  }

  // Copy report to clipboard
  if (copyReportBtn) {
    copyReportBtn.onclick = async () => {
      const metrics = calculateBgpPeeringMetrics(state, options);
      const report = generateBgpRoutingReport(metrics, options);
      const clip = options.clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
      if (clip && typeof clip.writeText === 'function') {
        try {
          await clip.writeText(report);
          if (typeof options.onToast === 'function') {
            options.onToast('BGP routing and flap damping briefing copied to clipboard!');
          }
        } catch (err) {
          console.error('Failed to copy BGP report', err);
        }
      }
    };
  }
}
