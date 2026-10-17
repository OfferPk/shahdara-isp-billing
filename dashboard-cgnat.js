import { formatPKR } from './core.js';

/**
 * Carrier-Grade NAT (CGNAT / NAT444 - RFC 6598 / RFC 6888 / RFC 7422) Matrix
 * Port-Block Allocation (PBA), Pool Exhaustion & Session Concurrency Telemetry
 * Area: agent1 (shahdara-dashboard) - KPIs, Charts, SVG Topology & Translation Telemetry
 */

export const CGNAT_CONSTANTS = {
  DEFAULT_POOL_ID: 'shahdara-town-residential-cgnat',
  USABLE_PORTS_PER_IP: 64512, // Ports 1024 to 65535 (first 1024 system ports reserved)
  START_PORT: 1024,
  END_PORT: 65535,

  DEFAULT_PORT_BLOCK_SIZE: 1024,
  DEFAULT_SESSION_LOAD: 380, // Average concurrent TCP/UDP sessions per active subscriber
  DEFAULT_PEAK_MULTIPLIER: 1.0,

  ALLOCATION_MODES: {
    DETERMINISTIC_PBA: 'Deterministic PBA (RFC 7422 - Zero Syslog Storage)',
    DYNAMIC_PBA: 'Dynamic PBA with On-Demand Extension (RFC 6888)'
  },

  STATUS: {
    OPTIMAL: 'Optimal Scaling',
    CONGESTED: 'High Pool Saturation',
    ELEVATED_DROPS: 'Port Exhaustion Drops',
    CRITICAL: 'Critical Pool Depletion'
  }
};

export const SHAHDARA_CGNAT_POOLS = [
  {
    id: 'shahdara-town-residential-cgnat',
    name: 'Shahdara Town Central Residential CGNAT Cluster',
    poolCode: 'CGNAT-PL-01',
    primaryArea: 'Shahdara Town',
    secondaryAreas: ['Baradari', 'Begum Kot'],
    publicPrefix: '182.180.44.0/23',
    publicIpCount: 510,
    sharedPrefix: '100.64.0.0/17', // RFC 6598
    activeSubscribers: 28500,
    defaultBlockSize: 1024,
    allocationMode: CGNAT_CONSTANTS.ALLOCATION_MODES.DETERMINISTIC_PBA,
    monthlyRevenuePkr: 3850000,
    routerNode: 'BNG-01-ShahdaraCore'
  },
  {
    id: 'begum-kot-commercial-cgnat',
    name: 'Begum Kot & Industrial Estate Enterprise Dual-Stack CGNAT',
    poolCode: 'CGNAT-PL-02',
    primaryArea: 'Begum Kot',
    secondaryAreas: ['Shahdara Town', 'Vandala Road'],
    publicPrefix: '175.107.12.0/24',
    publicIpCount: 254,
    sharedPrefix: '100.65.0.0/18',
    activeSubscribers: 8400,
    defaultBlockSize: 1024,
    allocationMode: CGNAT_CONSTANTS.ALLOCATION_MODES.DYNAMIC_PBA,
    monthlyRevenuePkr: 2400000,
    routerNode: 'BNG-02-BegumKotEdge'
  },
  {
    id: 'baradari-ftth-cgnat',
    name: 'Baradari High-Density FTTH Subscriber NAT Core',
    poolCode: 'CGNAT-PL-03',
    primaryArea: 'Baradari',
    secondaryAreas: ['Shahdara Town'],
    publicPrefix: '182.180.46.0/24',
    publicIpCount: 254,
    sharedPrefix: '100.66.0.0/18',
    activeSubscribers: 14200,
    defaultBlockSize: 512,
    allocationMode: CGNAT_CONSTANTS.ALLOCATION_MODES.DETERMINISTIC_PBA,
    monthlyRevenuePkr: 1950000,
    routerNode: 'BNG-03-BaradariHub'
  },
  {
    id: 'vandala-road-cgnat',
    name: 'Vandala Road Feeder & Rural Sub-Pool CGNAT',
    poolCode: 'CGNAT-PL-04',
    primaryArea: 'Vandala Road',
    secondaryAreas: ['Begum Kot'],
    publicPrefix: '119.160.88.0/25',
    publicIpCount: 126,
    sharedPrefix: '100.67.0.0/19',
    activeSubscribers: 6100,
    defaultBlockSize: 1024,
    allocationMode: CGNAT_CONSTANTS.ALLOCATION_MODES.DYNAMIC_PBA,
    monthlyRevenuePkr: 1150000,
    routerNode: 'BNG-04-VandalaNode'
  },
  {
    id: 'ravi-siphon-outskirts-cgnat',
    name: 'Ravi Siphon Wireless & Fiber Hybrid CGNAT Engine',
    poolCode: 'CGNAT-PL-05',
    primaryArea: 'Ravi Siphon',
    secondaryAreas: ['Baradari'],
    publicPrefix: '119.160.89.0/25',
    publicIpCount: 126,
    sharedPrefix: '100.68.0.0/19',
    activeSubscribers: 4800,
    defaultBlockSize: 512,
    allocationMode: CGNAT_CONSTANTS.ALLOCATION_MODES.DETERMINISTIC_PBA,
    monthlyRevenuePkr: 880000,
    routerNode: 'BNG-05-RaviSiphon'
  }
];

/**
 * Calculates total subscriber port blocks capacity for a given public pool
 * @param {number} publicIpCount - Number of available public IPs
 * @param {number} portBlockSize - Ports allocated per subscriber
 * @returns {number} Total simultaneous subscriber blocks supported
 */
export function calculatePortBlockCapacity(publicIpCount, portBlockSize) {
  const ips = Math.max(1, Number(publicIpCount) || 1);
  const size = Math.max(64, Number(portBlockSize) || CGNAT_CONSTANTS.DEFAULT_PORT_BLOCK_SIZE);
  const blocksPerIp = Math.floor(CGNAT_CONSTANTS.USABLE_PORTS_PER_IP / size);
  return ips * blocksPerIp;
}

/**
 * Calculates session concurrency, port exhaustion drops, and pool health
 * @param {Object} pool - CGNAT pool configuration
 * @param {Object} overrides - Interactive simulation parameters
 * @returns {Object} Calculated pool dynamics and SLA metrics
 */
export function calculateCgnatDynamics(pool, overrides = {}) {
  const p = pool || SHAHDARA_CGNAT_POOLS[0];

  const blockSize = overrides.blockSize !== undefined
    ? Number(overrides.blockSize)
    : (p.defaultBlockSize || CGNAT_CONSTANTS.DEFAULT_PORT_BLOCK_SIZE);

  const subscriberCount = overrides.subscriberCount !== undefined
    ? Number(overrides.subscriberCount)
    : p.activeSubscribers;

  const sessionLoad = overrides.sessionLoad !== undefined
    ? Number(overrides.sessionLoad)
    : CGNAT_CONSTANTS.DEFAULT_SESSION_LOAD;

  const peakMultiplier = overrides.peakMultiplier !== undefined
    ? Number(overrides.peakMultiplier)
    : CGNAT_CONSTANTS.DEFAULT_PEAK_MULTIPLIER;

  const effectiveSessionsPerSub = Math.round(sessionLoad * peakMultiplier);
  const blocksPerIp = Math.floor(CGNAT_CONSTANTS.USABLE_PORTS_PER_IP / blockSize);
  const totalCapacityBlocks = p.publicIpCount * blocksPerIp;

  // Over-subscription Ratio (Subscribers per Public IP)
  const oversubRatio = Math.round((subscriberCount / Math.max(1, p.publicIpCount)) * 10) / 10;
  const maxOversubRatio = blocksPerIp; // Theoretical saturation point

  // Pool Block Utilization Percentage
  const poolUtilizationPct = Math.min(150, Math.round((subscriberCount / Math.max(1, totalCapacityBlocks)) * 1000) / 10);

  // Session Dropping Probability due to Port Block Overflow
  // If subscriber's concurrent sessions exceed their assigned block size
  let dropRatePct = 0;
  let portOverflowSessions = 0;

  if (effectiveSessionsPerSub > blockSize) {
    portOverflowSessions = effectiveSessionsPerSub - blockSize;
    dropRatePct = Math.round((portOverflowSessions / effectiveSessionsPerSub) * 1000) / 10;
  } else if (poolUtilizationPct > 100) {
    // Subscriber cannot be allocated any port block at all
    const unallocatedSubscribers = subscriberCount - totalCapacityBlocks;
    const unallocatedPct = (unallocatedSubscribers / subscriberCount) * 100;
    dropRatePct = Math.round(unallocatedPct * 10) / 10;
  }

  // Syslog Generation Rate & Storage Savings
  // Dynamic PBA generates ~4 logs per new connection; Deterministic only logs block assignments
  const isDeterministic = p.allocationMode.includes('Deterministic');
  const dailySyslogVolumeGb = isDeterministic
    ? 0.05 // Tiny log footprint: only block assignment events
    : Math.round((subscriberCount * effectiveSessionsPerSub * 0.00000085 * 24) * 10) / 10;

  const syslogStorageSavingsPct = isDeterministic ? 99.8 : 0;

  // Determine SLA and Health Status
  let status = CGNAT_CONSTANTS.STATUS.OPTIMAL;
  let statusColor = '#10b981';
  let penaltyRebatePct = 0;

  if (dropRatePct >= 5.0 || poolUtilizationPct >= 110) {
    status = CGNAT_CONSTANTS.STATUS.CRITICAL;
    statusColor = '#ef4444';
    penaltyRebatePct = 25;
  } else if (dropRatePct > 0.0 || poolUtilizationPct >= 95) {
    status = CGNAT_CONSTANTS.STATUS.ELEVATED_DROPS;
    statusColor = '#f59e0b';
    penaltyRebatePct = 10;
  } else if (poolUtilizationPct >= 80) {
    status = CGNAT_CONSTANTS.STATUS.CONGESTED;
    statusColor = '#38bdf8';
    penaltyRebatePct = 0;
  }

  const penaltyPkr = Math.round((p.monthlyRevenuePkr * penaltyRebatePct) / 100);
  const revenueAtRiskPkr = Math.round((p.monthlyRevenuePkr * Math.min(100, dropRatePct * 2)) / 100);

  return {
    poolId: p.id,
    poolName: p.name,
    poolCode: p.poolCode,
    primaryArea: p.primaryArea,
    secondaryAreas: p.secondaryAreas || [],
    publicPrefix: p.publicPrefix,
    publicIpCount: p.publicIpCount,
    sharedPrefix: p.sharedPrefix,
    allocationMode: p.allocationMode,
    monthlyRevenuePkr: p.monthlyRevenuePkr,
    routerNode: p.routerNode,

    // Parameters
    blockSize,
    subscriberCount,
    sessionLoad,
    peakMultiplier,
    effectiveSessionsPerSub,

    // Capacity & Utilization
    blocksPerIp,
    totalCapacityBlocks,
    oversubRatio,
    maxOversubRatio,
    poolUtilizationPct,

    // Performance & Drops
    portOverflowSessions,
    dropRatePct,
    isDeterministic,
    dailySyslogVolumeGb,
    syslogStorageSavingsPct,

    // Health & SLA
    status,
    statusColor,
    penaltyRebatePct,
    penaltyPkr,
    revenueAtRiskPkr
  };
}

/**
 * Aggregates CGNAT fleet metrics across all Shahdara subscriber pools
 * @param {Array} pools - List of pools
 * @param {Object} state - Application state
 * @returns {Object} Fleet metrics
 */
export function calculateCgnatMetrics(pools = SHAHDARA_CGNAT_POOLS, state = {}) {
  const poolList = Array.isArray(pools) && pools.length > 0 ? pools : SHAHDARA_CGNAT_POOLS;

  let totalPublicIps = 0;
  let totalSubscribers = 0;
  let totalRevenuePkr = 0;
  let totalCapacityBlocks = 0;
  let totalPenaltiesPkr = 0;
  let optimalCount = 0;
  let warningCount = 0;
  let criticalCount = 0;

  const evaluatedPools = poolList.map(p => {
    const d = calculateCgnatDynamics(p);
    totalPublicIps += d.publicIpCount;
    totalSubscribers += d.subscriberCount;
    totalRevenuePkr += d.monthlyRevenuePkr;
    totalCapacityBlocks += d.totalCapacityBlocks;
    totalPenaltiesPkr += d.penaltyPkr;

    if (d.status === CGNAT_CONSTANTS.STATUS.CRITICAL) criticalCount++;
    else if (d.status === CGNAT_CONSTANTS.STATUS.ELEVATED_DROPS || d.status === CGNAT_CONSTANTS.STATUS.CONGESTED) warningCount++;
    else optimalCount++;

    return d;
  });

  const fleetUtilizationPct = totalCapacityBlocks > 0
    ? Math.round((totalSubscribers / totalCapacityBlocks) * 1000) / 10
    : 0;

  const overallOversubRatio = totalPublicIps > 0
    ? Math.round((totalSubscribers / totalPublicIps) * 10) / 10
    : 0;

  return {
    totalPools: poolList.length,
    totalPublicIps,
    totalSubscribers,
    totalCapacityBlocks,
    fleetUtilizationPct,
    overallOversubRatio,
    totalRevenuePkr,
    totalPenaltiesPkr,
    optimalCount,
    warningCount,
    criticalCount,
    evaluatedPools
  };
}

/**
 * Renders pure vector SVG diagram of CGNAT translation mapping and port-block distribution
 * @param {Object} dynamics - Pool dynamics from calculateCgnatDynamics
 * @param {Object} options - Rendering options (isCompact: boolean)
 * @returns {string} SVG markup string
 */
export function renderCgnatDiagramSvg(dynamics, options = {}) {
  const d = dynamics || calculateCgnatDynamics(SHAHDARA_CGNAT_POOLS[0]);
  const isCompact = Boolean(options.isCompact);

  if (isCompact) {
    // Compact card SVG: Port Block Meter + Session Gauge
    const width = 360;
    const height = 150;

    const utilPct = Math.min(100, d.poolUtilizationPct);
    const barWidth = Math.round((utilPct / 100) * 260);
    const meterColor = d.statusColor || '#10b981';

    // Session overflow representation
    const sessionPct = Math.min(100, Math.round((d.effectiveSessionsPerSub / d.blockSize) * 100));
    const sessionBarWidth = Math.round((sessionPct / 100) * 260);
    const sessionBarColor = d.dropRatePct > 0 ? '#ef4444' : '#38bdf8';

    return `<svg class="cgnat-svg cgnat-compact-svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Carrier CGNAT Port Block Allocation Summary">
      <rect width="${width}" height="${height}" rx="8" fill="var(--bg-card, #1e293b)" stroke="var(--border, #334155)"/>

      <!-- Header row -->
      <text x="20" y="24" fill="#38bdf8" font-size="10.5" font-weight="700">CARRIER CGNAT444 (RFC 6598)</text>
      <text x="340" y="24" fill="${meterColor}" font-size="9.5" font-weight="700" text-anchor="end">${d.status}</text>

      <!-- Bar 1: Public Pool Block Saturation -->
      <text x="20" y="45" fill="var(--text-muted, #94a3b8)" font-size="8.5">POOL BLOCK SATURATION: <tspan fill="#e2e8f0" font-weight="700">${d.poolUtilizationPct}%</tspan> (${d.subscriberCount} / ${d.totalCapacityBlocks})</text>
      <rect x="20" y="52" width="260" height="12" rx="3" fill="var(--bg-surface, #0f172a)" stroke="var(--border, #334155)"/>
      <rect x="20" y="52" width="${barWidth}" height="12" rx="3" fill="${meterColor}"/>
      <text x="290" y="62" fill="var(--text-muted, #94a3b8)" font-size="8.5" font-weight="600">${d.oversubRatio}:1 Ratio</text>

      <!-- Bar 2: Subscriber Concurrent Session Load vs Port Block Size -->
      <text x="20" y="80" fill="var(--text-muted, #94a3b8)" font-size="8.5">SUBSCRIBER PORT BLOCK LOAD: <tspan fill="${sessionBarColor}" font-weight="700">${d.effectiveSessionsPerSub} / ${d.blockSize} Ports</tspan></text>
      <rect x="20" y="87" width="260" height="12" rx="3" fill="var(--bg-surface, #0f172a)" stroke="var(--border, #334155)"/>
      <rect x="20" y="87" width="${sessionBarWidth}" height="12" rx="3" fill="${sessionBarColor}"/>
      <text x="290" y="97" fill="${d.dropRatePct > 0 ? '#ef4444' : '#10b981'}" font-size="8.5" font-weight="700">${d.dropRatePct > 0 ? d.dropRatePct + '% Drop' : 'Zero Drop'}</text>

      <!-- Bottom telemetry metrics row -->
      <rect x="15" y="112" width="105" height="26" rx="4" fill="var(--bg-surface, #0f172a)" stroke="var(--border, #334155)"/>
      <text x="67" y="123" fill="var(--text-muted, #94a3b8)" font-size="7.5" text-anchor="middle">BLOCK SIZE</text>
      <text x="67" y="133" fill="#38bdf8" font-size="9" font-weight="700" text-anchor="middle">${d.blockSize} Ports/Sub</text>

      <rect x="128" y="112" width="105" height="26" rx="4" fill="var(--bg-surface, #0f172a)" stroke="var(--border, #334155)"/>
      <text x="180" y="123" fill="var(--text-muted, #94a3b8)" font-size="7.5" text-anchor="middle">PUBLIC IPS</text>
      <text x="180" y="133" fill="#a78bfa" font-size="9" font-weight="700" text-anchor="middle">${d.publicIpCount} (${d.blocksPerIp} blks/IP)</text>

      <rect x="240" y="112" width="105" height="26" rx="4" fill="var(--bg-surface, #0f172a)" stroke="var(--border, #334155)"/>
      <text x="292" y="123" fill="var(--text-muted, #94a3b8)" font-size="7.5" text-anchor="middle">SYSLOG OPTIMIZATION</text>
      <text x="292" y="133" fill="#10b981" font-size="9" font-weight="700" text-anchor="middle">${d.isDeterministic ? '99.8% Saved' : 'Dynamic Logs'}</text>
    </svg>`;
  }

  // Expanded detailed SVG diagram for Modal
  const width = 800;
  const height = 430;

  // Visualization of Port Allocation Grid across 64,512 ports
  // Draw 16 block segments
  const gridStartX = 60;
  const gridStartY = 275;
  const gridWidth = 680;
  const gridHeight = 45;
  const segmentCount = 16;
  const segmentW = gridWidth / segmentCount;

  const activeSegments = Math.min(segmentCount, Math.round((d.effectiveSessionsPerSub / d.blockSize) * segmentCount));

  return `<svg class="cgnat-svg cgnat-expanded-svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Carrier CGNAT Network Architecture and Translation Spectrum">
    <defs>
      <linearGradient id="cgnatFlowGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.8"/>
        <stop offset="50%" stop-color="#a78bfa" stop-opacity="0.9"/>
        <stop offset="100%" stop-color="#10b981" stop-opacity="0.8"/>
      </linearGradient>
    </defs>

    <rect width="${width}" height="${height}" rx="10" fill="var(--bg-card, #1e293b)" stroke="var(--border, #334155)"/>

    <!-- PANEL 1: THREE-TIER TRANSLATION TOPOLOGY -->
    <rect x="25" y="20" width="750" height="185" rx="6" fill="var(--bg-surface, #0f172a)" stroke="var(--border, #334155)"/>
    <text x="40" y="42" fill="#38bdf8" font-size="12" font-weight="700">PANEL 1: RFC 6598 CARRIER ARCHITECTURE &amp; DETERMINISTIC PBA</text>
    <text x="755" y="42" fill="var(--text-muted, #94a3b8)" font-size="10" text-anchor="end">BNG Node: ${d.routerNode} | ${d.publicPrefix}</text>

    <!-- Node 1: Private Subscriber Domain -->
    <rect x="50" y="65" width="180" height="90" rx="6" fill="#1e293b" stroke="#38bdf8" stroke-width="1.5"/>
    <text x="140" y="85" fill="#38bdf8" font-size="10.5" font-weight="700" text-anchor="middle">SUBSCRIBER SUBNET</text>
    <text x="140" y="102" fill="#e2e8f0" font-size="11" font-weight="600" text-anchor="middle">${d.sharedPrefix}</text>
    <text x="140" y="118" fill="var(--text-muted, #94a3b8)" font-size="9" text-anchor="middle">Active: ${d.subscriberCount} FTTH CPEs</text>
    <text x="140" y="132" fill="#f59e0b" font-size="8.5" text-anchor="middle">Avg Load: ${d.effectiveSessionsPerSub} Sessions</text>

    <!-- Arrow 1 to CGNAT -->
    <path d="M 230 110 L 305 110" stroke="url(#cgnatFlowGrad)" stroke-width="3" fill="none" marker-end="url(#arrow)"/>
    <circle cx="268" cy="110" r="4" fill="#a78bfa"/>

    <!-- Node 2: Central CGNAT Translation Engine -->
    <rect x="310" y="55" width="200" height="110" rx="6" fill="#1e293b" stroke="#a78bfa" stroke-width="2"/>
    <text x="410" y="78" fill="#a78bfa" font-size="11" font-weight="700" text-anchor="middle">CGNAT444 TRANSLATOR</text>
    <text x="410" y="95" fill="#e2e8f0" font-size="9.5" text-anchor="middle">Deterministic Algo (RFC 7422)</text>
    <rect x="325" y="105" width="170" height="24" rx="4" fill="#0f172a" stroke="var(--border, #334155)"/>
    <text x="410" y="121" fill="#38bdf8" font-size="9" font-weight="600" text-anchor="middle">${d.blockSize} Ports / Sub (Block Ratio: ${d.oversubRatio}:1)</text>
    <text x="410" y="150" fill="${d.statusColor}" font-size="9" font-weight="700" text-anchor="middle">Status: ${d.status}</text>

    <!-- Arrow 2 to Public Pool -->
    <path d="M 510 110 L 585 110" stroke="url(#cgnatFlowGrad)" stroke-width="3" fill="none"/>
    <circle cx="548" cy="110" r="4" fill="#10b981"/>

    <!-- Node 3: Public IPv4 Pool & Transit Internet -->
    <rect x="590" y="65" width="170" height="90" rx="6" fill="#1e293b" stroke="#10b981" stroke-width="1.5"/>
    <text x="675" y="85" fill="#10b981" font-size="10.5" font-weight="700" text-anchor="middle">PUBLIC IP POOL</text>
    <text x="675" y="102" fill="#e2e8f0" font-size="11" font-weight="600" text-anchor="middle">${d.publicPrefix}</text>
    <text x="675" y="118" fill="var(--text-muted, #94a3b8)" font-size="9" text-anchor="middle">Capacity: ${d.totalCapacityBlocks} Blocks</text>
    <text x="675" y="132" fill="${d.poolUtilizationPct > 90 ? '#f59e0b' : '#10b981'}" font-size="8.5" font-weight="700" text-anchor="middle">Utilization: ${d.poolUtilizationPct}%</text>

    <!-- PANEL 2: PORT BLOCK ALLOCATION & SESSION SPECTRUM (1024 - 65535) -->
    <rect x="25" y="220" width="750" height="195" rx="6" fill="var(--bg-surface, #0f172a)" stroke="var(--border, #334155)"/>
    <text x="40" y="242" fill="#a78bfa" font-size="12" font-weight="700">PANEL 2: PER-SUBSCRIBER PORT BLOCK SPECTRUM (Ports 1024 to 65535)</text>
    <text x="755" y="242" fill="${d.dropRatePct > 0 ? '#ef4444' : '#10b981'}" font-size="10" font-weight="700" text-anchor="end">Session Drop Rate: ${d.dropRatePct}%</text>

    <!-- Port Allocation Bar -->
    <rect x="${gridStartX}" y="${gridStartY}" width="${gridWidth}" height="${gridHeight}" rx="4" fill="#1e293b" stroke="var(--border, #475569)"/>

    ${Array.from({ length: segmentCount }).map((_, i) => {
      const segX = gridStartX + i * segmentW;
      const isFilled = i < activeSegments;
      const isOverflow = i >= (segmentCount * (d.blockSize / (d.effectiveSessionsPerSub || 1)));
      const fillCol = isOverflow && d.dropRatePct > 0 ? '#ef4444' : isFilled ? '#38bdf8' : 'none';

      return `
        <rect x="${segX + 1}" y="${gridStartY + 2}" width="${segmentW - 2}" height="${gridHeight - 4}" rx="2" fill="${fillCol}" opacity="${isFilled ? '0.85' : '0.1'}"/>
        <line x1="${segX}" y1="${gridStartY}" x2="${segX}" y2="${gridStartY + gridHeight}" stroke="var(--border, #334155)" stroke-dasharray="2,2"/>
      `;
    }).join('')}

    <!-- Labels below port bar -->
    <text x="${gridStartX}" y="${gridStartY + gridHeight + 16}" fill="var(--text-muted, #94a3b8)" font-size="8.5">Port 1024</text>
    <text x="${gridStartX + (gridWidth / 2)}" y="${gridStartY + gridHeight + 16}" fill="var(--text-muted, #94a3b8)" font-size="8.5" text-anchor="middle">Port 32768 (Mid-Range Dynamic)</text>
    <text x="${gridStartX + gridWidth}" y="${gridStartY + gridHeight + 16}" fill="var(--text-muted, #94a3b8)" font-size="8.5" text-anchor="end">Port 65535</text>

    <!-- Translation Telemetry callouts -->
    <rect x="60" y="360" width="210" height="42" rx="4" fill="#1e293b" stroke="var(--border, #334155)"/>
    <text x="70" y="376" fill="var(--text-muted, #94a3b8)" font-size="8.5">PORT-BLOCK PER SUBSCRIBER:</text>
    <text x="70" y="392" fill="#38bdf8" font-size="11" font-weight="700">${d.blockSize} Ports (${d.blocksPerIp} Subscribers/IP)</text>

    <rect x="290" y="360" width="220" height="42" rx="4" fill="#1e293b" stroke="var(--border, #334155)"/>
    <text x="300" y="376" fill="var(--text-muted, #94a3b8)" font-size="8.5">CONCURRENT SESSION LOAD:</text>
    <text x="300" y="392" fill="${d.effectiveSessionsPerSub > d.blockSize ? '#ef4444' : '#10b981'}" font-size="11" font-weight="700">${d.effectiveSessionsPerSub} Pkts (${d.portOverflowSessions > 0 ? '+' + d.portOverflowSessions + ' Overflow' : 'Within Quota'})</text>

    <rect x="530" y="360" width="210" height="42" rx="4" fill="#1e293b" stroke="var(--border, #334155)"/>
    <text x="540" y="376" fill="var(--text-muted, #94a3b8)" font-size="8.5">SYSLOG REDUCTION EFFICIENCY:</text>
    <text x="540" y="392" fill="#10b981" font-size="11" font-weight="700">${d.isDeterministic ? '99.8% Log Savings' : d.dailySyslogVolumeGb + ' GB/Day Logs'}</text>
  </svg>`;
}

/**
 * Generates plain-text CGNAT translation engineering audit report
 * @param {Object} dynamics - Current pool dynamics
 * @param {Object} metrics - Fleet metrics
 * @returns {string} Formatted audit report text
 */
export function generateCgnatReport(dynamics, metrics) {
  const d = dynamics || calculateCgnatDynamics(SHAHDARA_CGNAT_POOLS[0]);
  const m = metrics || calculateCgnatMetrics();

  const timestamp = new Date().toISOString();

  return `================================================================================
SHAHDARA ISP CARRIER-GRADE NAT (CGNAT444) OPERATIONS REPORT
Standard Compliance: RFC 6598 / RFC 6888 / RFC 7422 (Deterministic PBA)
Generated At: ${timestamp}
================================================================================

1. TRANSLATION POOL SPECIFICATIONS:
--------------------------------------------------------------------------------
Pool Identifier:         ${d.poolCode} (${d.poolId})
Pool Description:        ${d.poolName}
Primary Operational Area:${d.primaryArea}
Secondary Coverage:      ${d.secondaryAreas.join(', ')}
Serving BNG Core Node:   ${d.routerNode}
RFC 6598 Shared Prefix:  ${d.sharedPrefix} (100.64.0.0/10 Allocation)
Public IPv4 Pool Prefix: ${d.publicPrefix}
Total Public IP Count:   ${d.publicIpCount} Public Addresses
Active Subscribers:      ${d.subscriberCount} FTTH Terminals
Monthly Revenue:         ${formatPKR(d.monthlyRevenuePkr)}

2. PORT-BLOCK ALLOCATION (PBA) PARAMETERS:
--------------------------------------------------------------------------------
Allocation Mechanism:    ${d.allocationMode}
Assigned Port-Block Size:${d.blockSize} Ports per Subscriber
Usable Port Range:       Ports ${CGNAT_CONSTANTS.START_PORT} to ${CGNAT_CONSTANTS.END_PORT} (${CGNAT_CONSTANTS.USABLE_PORTS_PER_IP} Total Ports/IP)
Subscribers per IP:      ${d.blocksPerIp} Subscribers (Theoretical Max Ratio)
Total Capacity Blocks:   ${d.totalCapacityBlocks} Concurrent Blocks
Current Oversub Ratio:   ${d.oversubRatio}:1 Subscribers per Public IPv4
Pool Block Saturation:   ${d.poolUtilizationPct}% of Total Available Blocks

3. CONCURRENCY & TRAFFIC PEAK DYNAMICS:
--------------------------------------------------------------------------------
Baseline Session Load:   ${d.sessionLoad} Concurrent Sessions / CPE
Peak Surge Multiplier:   ${d.peakMultiplier}x Peak Multiplier
Effective Session Load:  ${d.effectiveSessionsPerSub} Active Sessions / CPE
Port Block Headroom:     ${d.blockSize - d.effectiveSessionsPerSub} Ports Remaining
Port Overflow Sessions:  ${d.portOverflowSessions} Dropped Sessions / CPE
Port Exhaustion Drop:    ${d.dropRatePct}%
Daily Syslog Volume:     ${d.isDeterministic ? '< 50 MB / Day (Zero-Log Algorithm)' : d.dailySyslogVolumeGb + ' GB / Day'}
Syslog Storage Savings:  ${d.syslogStorageSavingsPct}%

4. HEALTH, REVENUE RISK & SLA COMMITMENTS:
--------------------------------------------------------------------------------
Operational Status:      ${d.status}
SLA Penalty / Rebate:    ${d.penaltyRebatePct}% (${formatPKR(d.penaltyPkr)})
Revenue At Risk:         ${formatPKR(d.revenueAtRiskPkr)}

5. NETWORK-WIDE CGNAT FLEET SUMMARY:
--------------------------------------------------------------------------------
Total CGNAT Pools:       ${m.totalPools}
Total Public IPv4 Fleet: ${m.totalPublicIps} Addresses
Total NAT Subscribers:   ${m.totalSubscribers} Subscribers
Total Capacity Blocks:   ${m.totalCapacityBlocks} Blocks
Fleet Block Saturation:  ${m.fleetUtilizationPct}%
Overall Oversub Ratio:   ${m.overallOversubRatio}:1
Total Monthly Revenue:   ${formatPKR(m.totalRevenuePkr)}
Total Monthly Penalties: ${formatPKR(m.totalPenaltiesPkr)}
Optimal Pools:           ${m.optimalCount}
Warning Pools:           ${m.warningCount}
Critical Exhaustion:     ${m.criticalCount}
================================================================================
END OF CARRIER CGNAT AUDIT REPORT`;
}

/**
 * Exports current CGNAT telemetry in structured JSON format
 * @param {Object} dynamics - Current pool dynamics
 * @param {Object} metrics - Fleet metrics
 * @returns {string} JSON string
 */
export function exportCgnatJson(dynamics, metrics) {
  const d = dynamics || calculateCgnatDynamics(SHAHDARA_CGNAT_POOLS[0]);
  const m = metrics || calculateCgnatMetrics();

  return JSON.stringify({
    metadata: {
      generator: 'Shahdara ISP Carrier-Grade NAT (CGNAT444) Engine',
      standards: ['RFC 6598', 'RFC 6888', 'RFC 7422', 'RFC 4787'],
      exportedAt: new Date().toISOString()
    },
    currentPool: d,
    fleetSummary: m
  }, null, 2);
}

/**
 * Exports CGNAT pool telemetry as RFC 4180 compliant CSV
 * @param {Object} dynamics - Current pool dynamics
 * @param {Object} metrics - Fleet metrics
 * @returns {string} CSV text
 */
export function exportCgnatCsv(dynamics, metrics) {
  const pools = SHAHDARA_CGNAT_POOLS;

  const headers = [
    'Pool_Code',
    'Pool_Name',
    'Primary_Area',
    'Public_Prefix',
    'Public_IPs',
    'Subscribers',
    'Block_Size',
    'Oversub_Ratio',
    'Saturation_Pct',
    'Sessions_Per_Sub',
    'Drop_Rate_Pct',
    'Allocation_Mode',
    'Monthly_Revenue_PKR',
    'Status',
    'Penalty_PKR'
  ];

  const rows = pools.map(p => {
    const d = calculateCgnatDynamics(p);
    return [
      `"${d.poolCode}"`,
      `"${d.poolName.replace(/"/g, '""')}"`,
      `"${d.primaryArea}"`,
      `"${d.publicPrefix}"`,
      d.publicIpCount,
      d.subscriberCount,
      d.blockSize,
      d.oversubRatio,
      d.poolUtilizationPct,
      d.effectiveSessionsPerSub,
      d.dropRatePct,
      `"${d.allocationMode}"`,
      d.monthlyRevenuePkr,
      `"${d.status}"`,
      d.penaltyPkr
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
}

/**
 * Modal and Dashboard Card Controller for CGNAT Telemetry
 * @param {Object} state - Application state
 * @param {Object} options - Controller options (document, onFilterArea, onToast)
 * @returns {Object} Controller interface
 */
export function setupCgnatModal(state, options = {}) {
  const doc = options.document || (typeof document !== 'undefined' ? document : null);
  if (!doc) return null;

  const modal = doc.getElementById('dashboardCgnatModal');
  const closeBtn = doc.getElementById('dashboardCgnatModalCloseBtn');
  const openBtn = doc.getElementById('dashboardOpenCgnatModalBtn');

  const cardChartContainer = doc.getElementById('dashboardCgnatChart');
  const modalDiagramContainer = doc.getElementById('cgnatModalDiagramContainer');

  // Input Controls
  const poolSelect = doc.getElementById('cgnatPoolSelect');
  const blockSizeSelect = doc.getElementById('cgnatBlockSizeSelect');
  const sessionSlider = doc.getElementById('cgnatSessionSlider');
  const sessionLabel = doc.getElementById('cgnatSessionLabel');
  const peakSlider = doc.getElementById('cgnatPeakSlider');
  const peakLabel = doc.getElementById('cgnatPeakLabel');
  const resetBtn = doc.getElementById('cgnatResetBtn');

  // Stat Labels
  const statStatus = doc.getElementById('cgnatStatStatus');
  const statSaturation = doc.getElementById('cgnatStatSaturation');
  const statOversub = doc.getElementById('cgnatStatOversub');
  const statSessions = doc.getElementById('cgnatStatSessions');
  const statDrops = doc.getElementById('cgnatStatDrops');
  const statPenalty = doc.getElementById('cgnatStatPenalty');

  // Action Buttons
  const filterAreaBtn = doc.getElementById('cgnatFilterAreaBtn');
  const exportJsonBtn = doc.getElementById('cgnatExportJsonBtn');
  const exportCsvBtn = doc.getElementById('cgnatExportCsvBtn');
  const copyReportBtn = doc.getElementById('cgnatCopyReportBtn');

  let currentPoolId = CGNAT_CONSTANTS.DEFAULT_POOL_ID;
  let customBlockSize = null;
  let customSessionLoad = null;
  let customPeak = null;

  function getCurrentPool() {
    return SHAHDARA_CGNAT_POOLS.find(p => p.id === currentPoolId) || SHAHDARA_CGNAT_POOLS[0];
  }

  function getCalculatedDynamics() {
    const p = getCurrentPool();
    return calculateCgnatDynamics(p, {
      blockSize: customBlockSize !== null ? customBlockSize : p.defaultBlockSize,
      sessionLoad: customSessionLoad !== null ? customSessionLoad : CGNAT_CONSTANTS.DEFAULT_SESSION_LOAD,
      peakMultiplier: customPeak !== null ? customPeak : CGNAT_CONSTANTS.DEFAULT_PEAK_MULTIPLIER
    });
  }

  function updateUi() {
    const dynamics = getCalculatedDynamics();
    const allMetrics = calculateCgnatMetrics(SHAHDARA_CGNAT_POOLS, state);

    // Update Card Chart if present
    if (cardChartContainer) {
      cardChartContainer.innerHTML = renderCgnatDiagramSvg(dynamics, { isCompact: true });
    }

    // Update Modal Diagram if present
    if (modalDiagramContainer) {
      modalDiagramContainer.innerHTML = renderCgnatDiagramSvg(dynamics, { isCompact: false });
    }

    // Update KPI Stat Elements
    if (statStatus) {
      statStatus.textContent = dynamics.status;
      statStatus.style.color = dynamics.statusColor;
    }
    if (statSaturation) {
      statSaturation.textContent = `${dynamics.poolUtilizationPct}% (${dynamics.subscriberCount} Subs)`;
      statSaturation.style.color = dynamics.poolUtilizationPct > 90 ? '#f59e0b' : '#10b981';
    }
    if (statOversub) {
      statOversub.textContent = `${dynamics.oversubRatio}:1 Ratio`;
      statOversub.style.color = '#38bdf8';
    }
    if (statSessions) {
      statSessions.textContent = `${dynamics.effectiveSessionsPerSub} / ${dynamics.blockSize}`;
      statSessions.style.color = dynamics.effectiveSessionsPerSub > dynamics.blockSize ? '#ef4444' : '#a78bfa';
    }
    if (statDrops) {
      statDrops.textContent = `${dynamics.dropRatePct}% (${dynamics.portOverflowSessions > 0 ? '+' + dynamics.portOverflowSessions + ' dropped' : 'Zero Drop'})`;
      statDrops.style.color = dynamics.dropRatePct > 0 ? '#ef4444' : '#10b981';
    }
    if (statPenalty) {
      statPenalty.textContent = `${dynamics.penaltyRebatePct}% (${formatPKR(dynamics.penaltyPkr)})`;
      statPenalty.style.color = dynamics.penaltyPkr > 0 ? '#ef4444' : '#10b981';
    }

    // Update Slider Labels
    if (sessionLabel) sessionLabel.textContent = `${dynamics.sessionLoad} sessions/CPE`;
    if (peakLabel) peakLabel.textContent = `${dynamics.peakMultiplier}x Peak (${dynamics.effectiveSessionsPerSub} total)`;
  }

  function syncControls() {
    const p = getCurrentPool();
    if (poolSelect) poolSelect.value = p.id;
    if (blockSizeSelect) blockSizeSelect.value = String(customBlockSize !== null ? customBlockSize : p.defaultBlockSize);
    if (sessionSlider) sessionSlider.value = String(customSessionLoad !== null ? customSessionLoad : CGNAT_CONSTANTS.DEFAULT_SESSION_LOAD);
    if (peakSlider) peakSlider.value = String(customPeak !== null ? customPeak : CGNAT_CONSTANTS.DEFAULT_PEAK_MULTIPLIER);
    updateUi();
  }

  // Event Listeners
  if (poolSelect) {
    poolSelect.addEventListener('change', () => {
      currentPoolId = poolSelect.value;
      customBlockSize = null;
      customSessionLoad = null;
      customPeak = null;
      syncControls();
    });
  }

  if (blockSizeSelect) {
    blockSizeSelect.addEventListener('change', () => {
      customBlockSize = Number(blockSizeSelect.value);
      updateUi();
    });
  }

  if (sessionSlider) {
    sessionSlider.addEventListener('input', () => {
      customSessionLoad = Number(sessionSlider.value);
      updateUi();
    });
  }

  if (peakSlider) {
    peakSlider.addEventListener('input', () => {
      customPeak = Number(peakSlider.value);
      updateUi();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      customBlockSize = null;
      customSessionLoad = null;
      customPeak = null;
      syncControls();
      if (typeof options.onToast === 'function') {
        options.onToast('CGNAT allocation parameters reset to baseline.');
      }
    });
  }

  if (openBtn && modal) {
    openBtn.addEventListener('click', () => {
      syncControls();
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

  if (filterAreaBtn) {
    filterAreaBtn.addEventListener('click', () => {
      const p = getCurrentPool();
      if (modal && typeof modal.close === 'function') modal.close();
      else if (modal) modal.removeAttribute('open');
      if (typeof options.onFilterArea === 'function') {
        options.onFilterArea(p.primaryArea);
      }
    });
  }

  if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', () => {
      const dynamics = getCalculatedDynamics();
      const allMetrics = calculateCgnatMetrics(SHAHDARA_CGNAT_POOLS, state);
      const json = exportCgnatJson(dynamics, allMetrics);
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(json).catch(() => {});
      }
      if (typeof options.onToast === 'function') {
        options.onToast('CGNAT JSON telemetry copied to clipboard.');
      }
    });
  }

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      const dynamics = getCalculatedDynamics();
      const allMetrics = calculateCgnatMetrics(SHAHDARA_CGNAT_POOLS, state);
      const csv = exportCgnatCsv(dynamics, allMetrics);
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(csv).catch(() => {});
      }
      if (typeof options.onToast === 'function') {
        options.onToast('CGNAT CSV telemetry copied to clipboard.');
      }
    });
  }

  if (copyReportBtn) {
    copyReportBtn.addEventListener('click', () => {
      const dynamics = getCalculatedDynamics();
      const allMetrics = calculateCgnatMetrics(SHAHDARA_CGNAT_POOLS, state);
      const report = generateCgnatReport(dynamics, allMetrics);
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(report).catch(() => {});
      }
      if (typeof options.onToast === 'function') {
        options.onToast('CGNAT audit report copied to clipboard.');
      }
    });
  }

  // Initial render
  updateUi();

  return {
    open: () => {
      syncControls();
      if (modal) {
        if (typeof modal.showModal === 'function') modal.showModal();
        else modal.setAttribute('open', '');
      }
    },
    close: () => {
      if (modal) {
        if (typeof modal.close === 'function') modal.close();
        else modal.removeAttribute('open');
      }
    },
    update: updateUi,
    getDynamics: getCalculatedDynamics,
    getMetrics: () => calculateCgnatMetrics(SHAHDARA_CGNAT_POOLS, state)
  };
}
