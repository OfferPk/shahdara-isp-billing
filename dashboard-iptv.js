import { formatPKR } from './core.js';

/**
 * Downstream IPTV Multicast IGMP Snooping Group Membership & Channel Change Zapping Latency Matrix
 * Models downstream GPON OLT multicast distribution, IGMPv2/IGMPv3 snooping leave/join latency,
 * video I-frame GOP keyframe alignment delay, Fast Channel Change (FCC) unicast burst acceleration,
 * multicast stream bandwidth utilization, and subscriber experience exposure across Shahdara sectors.
 */

export const SHAHDARA_IPTV_CHANNELS = [
  {
    id: 'iptv-geo-01',
    name: 'Geo News HD (1080p50)',
    multicastIp: '239.255.10.1',
    sourceIp: '10.200.1.10',
    resolution: '1080p50',
    codec: 'H.264 / AVC',
    bitrateMbps: 4.8,
    primaryArea: 'Shahdara Town',
    aliasAreas: ['Shahdara Town', 'Old Town', 'Railway Road'],
    baseViewers: 142,
    baseGopSec: 1.5,
    baseJoinMs: 110,
    baseBufferMs: 140,
    packetLossPct: 0.02
  },
  {
    id: 'iptv-ary-02',
    name: 'ARY Digital HD (1080p50)',
    multicastIp: '239.255.10.2',
    sourceIp: '10.200.1.11',
    resolution: '1080p50',
    codec: 'H.264 / AVC',
    bitrateMbps: 5.2,
    primaryArea: 'Baradari Road',
    aliasAreas: ['Baradari Road', 'Bara Dari', 'Tariq Road'],
    baseViewers: 168,
    baseGopSec: 1.5,
    baseJoinMs: 130,
    baseBufferMs: 150,
    packetLossPct: 0.04
  },
  {
    id: 'iptv-ptv-03',
    name: 'PTV Sports HD (1080p60)',
    multicastIp: '239.255.20.1',
    sourceIp: '10.200.2.20',
    resolution: '1080p60',
    codec: 'H.265 / HEVC',
    bitrateMbps: 6.5,
    primaryArea: 'Vandala Road',
    aliasAreas: ['Vandala Road', 'Wandala Road', 'Zia Town'],
    baseViewers: 220,
    baseGopSec: 1.0,
    baseJoinMs: 95,
    baseBufferMs: 120,
    packetLossPct: 0.01
  },
  {
    id: 'iptv-asports-04',
    name: 'A-Sports 4K Ultra HD (2160p60)',
    multicastIp: '239.255.20.2',
    sourceIp: '10.200.2.21',
    resolution: '2160p60',
    codec: 'H.265 / HEVC',
    bitrateMbps: 14.5,
    primaryArea: 'Jia Musa',
    aliasAreas: ['Jia Musa', 'Farrukhabad'],
    baseViewers: 85,
    baseGopSec: 1.0,
    baseJoinMs: 160,
    baseBufferMs: 220,
    packetLossPct: 0.08
  },
  {
    id: 'iptv-hum-05',
    name: 'Hum TV Prime HD (1080p50)',
    multicastIp: '239.255.10.3',
    sourceIp: '10.200.1.12',
    resolution: '1080p50',
    codec: 'H.264 / AVC',
    bitrateMbps: 4.6,
    primaryArea: 'Saeed Park',
    aliasAreas: ['Saeed Park', 'Rehman Park'],
    baseViewers: 115,
    baseGopSec: 2.0,
    baseJoinMs: 125,
    baseBufferMs: 145,
    packetLossPct: 0.03
  },
  {
    id: 'iptv-dunya-06',
    name: 'Dunya News HD (1080p50)',
    multicastIp: '239.255.10.4',
    sourceIp: '10.200.1.13',
    resolution: '1080p50',
    codec: 'H.264 / AVC',
    bitrateMbps: 4.5,
    primaryArea: 'All Areas',
    aliasAreas: ['Shahdara Town', 'Baradari Road', 'Vandala Road', 'Jia Musa', 'Saeed Park'],
    baseViewers: 95,
    baseGopSec: 1.5,
    baseJoinMs: 105,
    baseBufferMs: 130,
    packetLossPct: 0.02
  }
];

export const IPTV_CONSTANTS = {
  FAST_LEAVE_LATENCY_MS: 45,
  QUERY_TIMEOUT_LEAVE_LATENCY_MS: 950,
  FCC_ACCELERATION_FACTOR: 0.38,
  OPTIMAL_ZAP_THRESHOLD_MS: 600,
  DEGRADED_ZAP_THRESHOLD_MS: 1200
};

// Simulation State
let selectedIptvChannelId = null;
let simFastLeaveEnabled = true;
let simGopSizeSec = null;
let simFccAssist = false;

export function getIptvSelectedChannel() {
  return selectedIptvChannelId || SHAHDARA_IPTV_CHANNELS[0].id;
}

export function setIptvSelectedChannel(id) {
  selectedIptvChannelId = id;
}

export function getIptvFastLeaveEnabled() {
  return simFastLeaveEnabled;
}

export function setIptvFastLeaveEnabled(enabled) {
  simFastLeaveEnabled = !!enabled;
}

export function getIptvGopSizeSec() {
  return simGopSizeSec;
}

export function setIptvGopSizeSec(sec) {
  simGopSizeSec = typeof sec === 'number' && !isNaN(sec) ? Math.max(0.5, Math.min(3.0, sec)) : null;
}

export function getIptvFccAssist() {
  return simFccAssist;
}

export function setIptvFccAssist(enabled) {
  simFccAssist = !!enabled;
}

export function resetIptvSimState() {
  selectedIptvChannelId = null;
  simFastLeaveEnabled = true;
  simGopSizeSec = null;
  simFccAssist = false;
}

/**
 * Calculates zapping time breakdown for an IPTV channel.
 */
export function calculateZappingLatency(channel, options = {}) {
  const fastLeave = options.fastLeaveEnabled !== undefined ? options.fastLeaveEnabled : simFastLeaveEnabled;
  const gopSec = options.gopSec !== undefined && options.gopSec !== null ? options.gopSec : channel.baseGopSec;
  const fccAssist = options.fccAssist !== undefined ? options.fccAssist : simFccAssist;

  const tLeave = fastLeave ? IPTV_CONSTANTS.FAST_LEAVE_LATENCY_MS : IPTV_CONSTANTS.QUERY_TIMEOUT_LEAVE_LATENCY_MS;
  const tJoin = channel.baseJoinMs || 110;
  const tGop = Math.round((gopSec * 1000) / 2);
  const tBuffer = channel.baseBufferMs || 140;

  const rawZapMs = tLeave + tJoin + tGop + tBuffer;
  const totalZapMs = fccAssist ? Math.round(rawZapMs * IPTV_CONSTANTS.FCC_ACCELERATION_FACTOR) : rawZapMs;

  return {
    tLeave,
    tJoin,
    tGop,
    tBuffer,
    rawZapMs,
    totalZapMs,
    fastLeave,
    gopSec,
    fccAssist
  };
}

/**
 * Calculates complete IPTV multicast distribution metrics, subscriber exposure, and bandwidth rollups.
 */
export function calculateIptvMulticastMetrics(state = {}, options = {}) {
  const selectedId = getIptvSelectedChannel();
  const fastLeave = simFastLeaveEnabled;
  const fccAssist = simFccAssist;

  const customers = Array.isArray(state?.customers) ? state.customers : [];
  const bills = Array.isArray(state?.bills) ? state.bills : [];

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

  let totalChannels = SHAHDARA_IPTV_CHANNELS.length;
  let totalActiveViewers = 0;
  let totalMulticastBandwidthMbps = 0;
  let degradedChannelsCount = 0;

  const evaluatedChannels = SHAHDARA_IPTV_CHANNELS.map(ch => {
    const isSelected = ch.id === selectedId;
    const gopSec = (isSelected && simGopSizeSec !== null) ? simGopSizeSec : ch.baseGopSec;

    const zap = calculateZappingLatency(ch, {
      fastLeaveEnabled: fastLeave,
      gopSec,
      fccAssist
    });

    totalActiveViewers += ch.baseViewers;
    totalMulticastBandwidthMbps += ch.bitrateMbps;

    let linkedSubscribers = 0;
    let linkedDues = 0;

    const matchedAreas = ch.aliasAreas || [ch.primaryArea];
    matchedAreas.forEach(areaKey => {
      Object.keys(areaCustMap).forEach(custArea => {
        if (custArea.toLowerCase().includes(areaKey.toLowerCase()) || areaKey.toLowerCase().includes(custArea.toLowerCase())) {
          linkedSubscribers += (areaCustMap[custArea] || 0);
          linkedDues += (areaRevenueMap[custArea] || 0);
        }
      });
    });

    const isDegraded = zap.totalZapMs > IPTV_CONSTANTS.DEGRADED_ZAP_THRESHOLD_MS;
    const isOptimal = zap.totalZapMs <= IPTV_CONSTANTS.OPTIMAL_ZAP_THRESHOLD_MS;

    if (isDegraded) {
      degradedChannelsCount++;
    }

    let qualityTier = 'Optimal';
    let statusClass = 'badge-success';
    if (isDegraded) {
      qualityTier = 'Slow Zapping';
      statusClass = 'badge-danger';
    } else if (!isOptimal) {
      qualityTier = 'Acceptable';
      statusClass = 'badge-warning';
    }

    return {
      ...ch,
      isSelected,
      zap,
      linkedSubscribers,
      linkedDues,
      isDegraded,
      isOptimal,
      qualityTier,
      statusClass
    };
  });

  const selectedChannelData = evaluatedChannels.find(c => c.id === selectedId) || evaluatedChannels[0];
  const avgZappingTimeMs = Math.round(
    evaluatedChannels.reduce((acc, c) => acc + c.zap.totalZapMs, 0) / evaluatedChannels.length
  );

  const totalDuesAtRisk = evaluatedChannels
    .filter(c => c.isDegraded)
    .reduce((acc, c) => acc + c.linkedDues, 0);

  const totalSubscribersAtRisk = evaluatedChannels
    .filter(c => c.isDegraded)
    .reduce((acc, c) => acc + c.linkedSubscribers, 0);

  return {
    channels: evaluatedChannels,
    selectedChannel: selectedChannelData,
    totalChannels,
    totalActiveViewers,
    totalMulticastBandwidthMbps: Number(totalMulticastBandwidthMbps.toFixed(1)),
    avgZappingTimeMs,
    degradedChannelsCount,
    totalDuesAtRisk,
    totalSubscribersAtRisk,
    fastLeaveEnabled: fastLeave,
    fccAssist
  };
}

/**
 * Generates pure offline responsive SVG visualization for IPTV multicast zapping.
 */
export function renderIptvMulticastSvg(metrics, options = {}) {
  const compact = !!options.compact;
  const ch = metrics.selectedChannel;
  const zap = ch.zap;

  if (compact) {
    const width = 480;
    const height = 180;
    const statusColor = ch.isDegraded ? '#dc2626' : ch.isOptimal ? '#16a34a' : '#ea580c';

    // Latency bar (max 2000ms scale, 220px width)
    const zapBarWidth = Math.max(10, Math.min(220, Math.round((zap.totalZapMs / 2000) * 220)));

    return `
      <svg viewBox="0 0 ${width} ${height}" class="splicer-svg iptv-svg" role="img" aria-label="IPTV Multicast and Zapping Overview" xmlns="http://www.w3.org/2000/svg">
        <style>
          .iptv-text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
          .iptv-title { font-size: 13px; font-weight: 700; fill: var(--text-color, #1e293b); }
          .iptv-sub { font-size: 10px; fill: var(--text-muted, #64748b); }
          .iptv-val { font-size: 14px; font-weight: 700; fill: var(--text-color, #1e293b); }
          .iptv-bar-bg { fill: rgba(148, 163, 184, 0.2); rx: 4px; }
        </style>

        <rect x="0" y="0" width="${width}" height="${height}" rx="8" fill="var(--surface, #ffffff)" stroke="rgba(148, 163, 184, 0.25)" stroke-width="1" />

        <!-- Header -->
        <circle cx="20" cy="22" r="6" fill="${statusColor}" />
        <text x="32" y="26" class="iptv-text iptv-title">${ch.name}</text>
        <text x="${width - 16}" y="26" text-anchor="end" class="iptv-text" font-size="11px" font-weight="700" fill="${statusColor}">${ch.qualityTier.toUpperCase()}</text>

        <!-- KPI Columns -->
        <g transform="translate(16, 42)">
          <text x="0" y="10" class="iptv-text iptv-sub">AVG ZAPPING TIME</text>
          <text x="0" y="28" class="iptv-text iptv-val" fill="${statusColor}">${zap.totalZapMs} ms</text>
          <text x="0" y="42" class="iptv-text iptv-sub">${zap.fccAssist ? 'FCC Boosted' : 'Standard IGMP'}</text>

          <text x="120" y="10" class="iptv-text iptv-sub">CONCURRENT VIEWERS</text>
          <text x="120" y="28" class="iptv-text iptv-val">${ch.baseViewers} STBs</text>
          <text x="120" y="42" class="iptv-text iptv-sub">Network: ${metrics.totalActiveViewers} live</text>

          <text x="240" y="10" class="iptv-text iptv-sub">STREAM BITRATE</text>
          <text x="240" y="28" class="iptv-text iptv-val">${ch.bitrateMbps} Mbps</text>
          <text x="240" y="42" class="iptv-text iptv-sub">${ch.codec}</text>

          <text x="350" y="10" class="iptv-text iptv-sub">MULTICAST AGG</text>
          <text x="350" y="28" class="iptv-text iptv-val" fill="#3b82f6">${metrics.totalMulticastBandwidthMbps} Mbps</text>
          <text x="350" y="42" class="iptv-text iptv-sub">${metrics.totalChannels} IGMP Groups</text>
        </g>

        <!-- Zapping Time Progress Bar -->
        <g transform="translate(16, 110)">
          <text x="0" y="10" class="iptv-text iptv-sub">CHANNEL CHANGE ZAPPING LATENCY PIPELINE</text>
          <text x="${width - 32}" y="10" text-anchor="end" class="iptv-text iptv-sub">Target &lt; 600ms</text>
          
          <rect x="0" y="18" width="${width - 32}" height="14" class="iptv-bar-bg" />
          <rect x="0" y="18" width="${zapBarWidth}" height="14" rx="3" fill="${statusColor}" />

          <text x="0" y="48" class="iptv-text iptv-sub">Leave: ${zap.tLeave}ms | Join: ${zap.tJoin}ms | Keyframe GOP: ${zap.tGop}ms | Decode: ${zap.tBuffer}ms</text>
        </g>
      </svg>
    `;
  }

  // Detailed Modal SVG (width 740, height 330)
  const width = 740;
  const height = 330;
  const statusColor = ch.isDegraded ? '#dc2626' : ch.isOptimal ? '#16a34a' : '#ea580c';

  // Compute breakdown bar widths in detailed mode (total width 320)
  const totalScale = zap.rawZapMs > 0 ? zap.rawZapMs : 1000;
  const wLeave = Math.max(12, Math.round((zap.tLeave / totalScale) * 320));
  const wJoin = Math.max(12, Math.round((zap.tJoin / totalScale) * 320));
  const wGop = Math.max(12, Math.round((zap.tGop / totalScale) * 320));
  const wBuffer = Math.max(12, 320 - (wLeave + wJoin + wGop));

  return `
    <svg viewBox="0 0 ${width} ${height}" class="splicer-svg iptv-svg-detailed" role="img" aria-label="IPTV Multicast Zapping Breakdown and Channel Distribution" xmlns="http://www.w3.org/2000/svg">
      <style>
        .iptv-text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        .iptv-title { font-size: 14px; font-weight: 700; fill: var(--text-color, #1e293b); }
        .iptv-sub { font-size: 11px; fill: var(--text-muted, #64748b); }
        .iptv-val { font-size: 15px; font-weight: 700; fill: var(--text-color, #1e293b); }
        .iptv-grid { stroke: rgba(148, 163, 184, 0.18); stroke-dasharray: 4,4; stroke-width: 1; }
      </style>

      <rect x="0" y="0" width="${width}" height="${height}" rx="10" fill="var(--surface, #ffffff)" stroke="rgba(148, 163, 184, 0.3)" stroke-width="1" />

      <!-- Left Panel: Timing Pipeline -->
      <g transform="translate(24, 20)">
        <text x="0" y="14" class="iptv-text iptv-title">Channel Change Latency Sequence Breakdown</text>
        <text x="0" y="28" class="iptv-text iptv-sub">Stream: ${ch.name} (${ch.multicastIp}) | GOP: ${zap.gopSec}s</text>

        <!-- Timing Stages Stacked Bar -->
        <g transform="translate(0, 44)">
          <text x="0" y="12" class="iptv-text iptv-sub">STB ZAPPING SEQUENCE (TOTAL: ${zap.totalZapMs} ms)</text>
          
          <g transform="translate(0, 20)">
            <!-- Stage 1: IGMP Leave -->
            <rect x="0" y="0" width="${wLeave}" height="24" rx="3" fill="#ef4444" />
            <text x="${wLeave / 2}" y="16" text-anchor="middle" class="iptv-text" font-size="10px" font-weight="700" fill="#ffffff">Leave</text>

            <!-- Stage 2: IGMP Join -->
            <rect x="${wLeave}" y="0" width="${wJoin}" height="24" rx="3" fill="#f59e0b" />
            <text x="${wLeave + (wJoin / 2)}" y="16" text-anchor="middle" class="iptv-text" font-size="10px" font-weight="700" fill="#ffffff">Join</text>

            <!-- Stage 3: GOP I-Frame -->
            <rect x="${wLeave + wJoin}" y="0" width="${wGop}" height="24" rx="3" fill="#3b82f6" />
            <text x="${wLeave + wJoin + (wGop / 2)}" y="16" text-anchor="middle" class="iptv-text" font-size="10px" font-weight="700" fill="#ffffff">I-Frame</text>

            <!-- Stage 4: Buffer & Decode -->
            <rect x="${wLeave + wJoin + wGop}" y="0" width="${wBuffer}" height="24" rx="3" fill="#10b981" />
            <text x="${wLeave + wJoin + wGop + (wBuffer / 2)}" y="16" text-anchor="middle" class="iptv-text" font-size="10px" font-weight="700" fill="#ffffff">Buffer</text>
          </g>

          <!-- Stage Timing Legend -->
          <g transform="translate(0, 60)">
            <text x="0" y="14" class="iptv-text" font-size="10px" fill="#ef4444">■ IGMP Leave: ${zap.tLeave}ms</text>
            <text x="110" y="14" class="iptv-text" font-size="10px" fill="#f59e0b">■ IGMP Join: ${zap.tJoin}ms</text>
            <text x="210" y="14" class="iptv-text" font-size="10px" fill="#3b82f6">■ I-Frame Wait: ${zap.tGop}ms</text>
            <text x="0" y="30" class="iptv-text" font-size="10px" fill="#10b981">■ STB Decode Buffer: ${zap.tBuffer}ms</text>
            <text x="160" y="30" class="iptv-text" font-size="10px" font-weight="700" fill="${statusColor}">■ Net Latency: ${zap.totalZapMs}ms</text>
          </g>
        </g>

        <!-- FCC Acceleration Callout -->
        <g transform="translate(0, 160)">
          <rect x="0" y="0" width="340" height="74" rx="6" fill="rgba(148, 163, 184, 0.12)" />
          <text x="14" y="20" class="iptv-text" font-size="11px" font-weight="700" fill="var(--text-color, #1e293b)">Fast Channel Change (FCC) Burst Assist</text>
          <text x="14" y="38" class="iptv-text iptv-sub">Status: ${zap.fccAssist ? 'ACTIVE (62% zapping reduction)' : 'DISABLED (Standard Multicast Pacing)'}</text>
          <text x="14" y="56" class="iptv-text iptv-sub">${zap.fccAssist ? 'Unicast RTP keyframe burst delivered by core media server' : 'STB waits for cyclic multicast keyframe boundary'}</text>
        </g>
      </g>

      <!-- Right Panel: Multicast Distribution & PON Bandwidth -->
      <g transform="translate(420, 20)">
        <text x="0" y="14" class="iptv-text iptv-title">OLT Multicast Bandwidth Distribution</text>
        <text x="0" y="28" class="iptv-text iptv-sub">IGMPv2/v3 Snooping Active on Shahdara Core OLT</text>

        <!-- Bandwidth & Viewers Stack -->
        <g transform="translate(0, 44)">
          <text x="0" y="12" class="iptv-text iptv-sub">CONCURRENT MULTICAST CONSUMPTION</text>
          <text x="280" y="12" text-anchor="end" class="iptv-text iptv-val">${ch.bitrateMbps} Mbps</text>
          <rect x="0" y="20" width="280" height="14" rx="4" fill="rgba(148, 163, 184, 0.2)" />
          <rect x="0" y="20" width="${Math.round((ch.bitrateMbps / 20) * 280)}" height="14" rx="4" fill="#3b82f6" />
          <text x="0" y="46" class="iptv-text iptv-sub">Resolution: ${ch.resolution} | Codec: ${ch.codec}</text>
          <text x="280" y="46" text-anchor="end" class="iptv-text iptv-sub">Loss: ${ch.packetLossPct}%</text>
        </g>

        <!-- Area Viewers & Revenue Impact -->
        <g transform="translate(0, 114)">
          <rect x="0" y="0" width="280" height="66" rx="6" fill="rgba(148, 163, 184, 0.12)" />
          <text x="14" y="20" class="iptv-text iptv-sub">SECTOR SUBSCRIBERS</text>
          <text x="14" y="40" class="iptv-text iptv-val">${ch.linkedSubscribers} Subs</text>
          <text x="14" y="54" class="iptv-text iptv-sub">Area: ${ch.primaryArea}</text>

          <text x="150" y="20" class="iptv-text iptv-sub">SUBSCRIBER REVENUE</text>
          <text x="150" y="40" class="iptv-text iptv-val">${formatPKR(ch.linkedDues)}</text>
          <text x="150" y="54" class="iptv-text iptv-sub">${ch.baseViewers} Active Viewers</text>
        </g>

        <!-- Status Summary Badge -->
        <g transform="translate(0, 195)">
          <rect x="0" y="0" width="280" height="38" rx="6" fill="${ch.isDegraded ? 'rgba(239, 68, 68, 0.15)' : 'rgba(22, 163, 74, 0.15)'}" />
          <circle cx="18" cy="19" r="6" fill="${statusColor}" />
          <text x="32" y="23" class="iptv-text" font-size="12px" font-weight="700" fill="${statusColor}">Quality Status: ${ch.qualityTier}</text>
        </g>
      </g>
    </svg>
  `;
}

/**
 * Formats executive plain text briefing for clipboard export.
 */
export function generateIptvMulticastReport(metrics, options = {}) {
  const ch = metrics.selectedChannel;
  const zap = ch.zap;
  const timestamp = options.referenceDate ? new Date(options.referenceDate).toISOString() : new Date().toISOString();

  const lines = [
    '=========================================================================',
    '   SHAHDARA DOWNSTREAM IPTV MULTICAST & ZAPPING AUDIT BRIEFING           ',
    '=========================================================================',
    `Generated: ${timestamp}`,
    `Total Multicast Channels: ${metrics.totalChannels} IGMP Streams`,
    `Aggregated Multicast Bandwidth: ${metrics.totalMulticastBandwidthMbps} Mbps`,
    `Total Active Set-Top Box Viewers: ${metrics.totalActiveViewers} STBs`,
    `Network-Wide Average Zapping Time: ${metrics.avgZappingTimeMs} ms`,
    `Fast Leave Enabled: ${metrics.fastLeaveEnabled ? 'YES (Immediate Port Pruning)' : 'NO (Query Timeout Delay)'}`,
    `Fast Channel Change (FCC) Assist: ${metrics.fccAssist ? 'ENABLED (Unicast Burst Active)' : 'DISABLED'}`,
    `Degraded Channels (> 1200ms): ${metrics.degradedChannelsCount}`,
    `Total Subscriber Dues At Risk: ${formatPKR(metrics.totalDuesAtRisk)} (${metrics.totalSubscribersAtRisk} subscribers)`,
    '',
    '-------------------------------------------------------------------------',
    `SELECTED MULTICAST CHANNEL: ${ch.name}`,
    '-------------------------------------------------------------------------',
    `Multicast Group IP: ${ch.multicastIp} | Source IP: ${ch.sourceIp}`,
    `Primary Area: ${ch.primaryArea} (${ch.aliasAreas.join(', ')})`,
    `Video Specs: ${ch.resolution} | Codec: ${ch.codec} | Bitrate: ${ch.bitrateMbps} Mbps`,
    `Active Viewers: ${ch.baseViewers} STBs | Packet Loss: ${ch.packetLossPct}%`,
    '',
    'ZAPPING LATENCY PIPELINE BREAKDOWN:',
    `- IGMP Group Leave Delay: ${zap.tLeave} ms (${zap.fastLeave ? 'Fast Leave' : 'Query Timeout'})`,
    `- IGMP Group Join Delay: ${zap.tJoin} ms (OLT Processing & Snooping)`,
    `- I-Frame Keyframe GOP Wait: ${zap.tGop} ms (GOP Size: ${zap.gopSec}s)`,
    `- STB Video Buffer & Decode: ${zap.tBuffer} ms`,
    `- Total Channel Change Zapping Time: ${zap.totalZapMs} ms (${ch.qualityTier.toUpperCase()})`,
    `Linked Area Revenue Exposure: ${formatPKR(ch.linkedDues)} across ${ch.linkedSubscribers} subscribers`,
    '',
    '-------------------------------------------------------------------------',
    'ALL SHAHDARA IPTV MULTICAST CHANNELS REGISTER:',
    '-------------------------------------------------------------------------'
  ];

  metrics.channels.forEach(c => {
    lines.push(
      `[${c.qualityTier.toUpperCase()}] ${c.name} (${c.multicastIp}) | ${c.bitrateMbps} Mbps | Zap: ${c.zap.totalZapMs} ms | Viewers: ${c.baseViewers} STBs`
    );
  });

  lines.push('');
  lines.push('OPERATIONAL MITIGATION ACTIONS:');
  if (metrics.degradedChannelsCount > 0 || !metrics.fastLeaveEnabled) {
    lines.push('1. [RECOMMENDED] Enable IGMP Fast-Leave across all OLT PON interfaces to drop 900ms leave timeout.');
    lines.push('2. Tune video encoder GOP size from 2.0s down to 1.0s or 0.5s for rapid keyframe acquisition.');
    lines.push('3. Deploy Fast Channel Change (FCC) unicast burst server to accelerate initial stream playback.');
  } else {
    lines.push('1. All multicast video streams operating within optimal ITU-T G.9961 zapping boundaries.');
    lines.push('2. IGMP snooping tables synchronized; zero multicast bandwidth leakage to non-member ONT ports.');
    lines.push('3. Downstream GPON bandwidth headroom sufficient for peak concurrent evening broadcast hours.');
  }

  lines.push('=========================================================================');
  return lines.join('\n');
}

/**
 * Initializes and wires the IPTV modal dialog.
 */
export function setupIptvMulticastModal(state = {}, options = {}) {
  const modal = document.getElementById('dashboardIptvModal');
  const openBtn = document.getElementById('dashboardOpenIptvModalBtn');
  const closeBtn = document.getElementById('dashboardIptvModalCloseBtn');
  const channelSelect = document.getElementById('iptvChannelSelect');
  const fastLeaveCheckbox = document.getElementById('iptvFastLeaveCheckbox');
  const gopSlider = document.getElementById('iptvGopSlider');
  const gopVal = document.getElementById('iptvGopVal');
  const fccCheckbox = document.getElementById('iptvFccCheckbox');
  const resetBtn = document.getElementById('iptvResetSimBtn');
  const chartWrap = document.getElementById('iptvModalChartWrap');
  const filterAreaBtn = document.getElementById('iptvFilterAreaBtn');
  const copyReportBtn = document.getElementById('dashboardCopyIptvReportBtn');
  const tableBody = document.getElementById('iptvChannelsTableBody');

  // KPI elements
  const kpiChannelName = document.getElementById('iptvKpiChannelName');
  const kpiZappingTime = document.getElementById('iptvKpiZappingTime');
  const kpiViewers = document.getElementById('iptvKpiViewers');
  const kpiStatusBadge = document.getElementById('iptvStatusBadge');
  const kpiRevenueRisk = document.getElementById('iptvKpiRevenueRisk');

  if (!modal) return;

  function refreshModal() {
    const metrics = calculateIptvMulticastMetrics(state, options);
    const ch = metrics.selectedChannel;
    const zap = ch.zap;

    if (kpiChannelName) {
      kpiChannelName.textContent = `${ch.name.split(' ')[0]} (${ch.resolution})`;
    }
    if (kpiZappingTime) {
      kpiZappingTime.textContent = `${zap.totalZapMs} ms (${ch.qualityTier})`;
    }
    if (kpiViewers) {
      kpiViewers.textContent = `${ch.baseViewers} STBs (${ch.bitrateMbps}M)`;
    }
    if (kpiStatusBadge) {
      kpiStatusBadge.textContent = ch.qualityTier.toUpperCase();
      kpiStatusBadge.className = `sim-delta-badge ${ch.statusClass}`;
    }
    if (kpiRevenueRisk) {
      kpiRevenueRisk.textContent = `${formatPKR(ch.linkedDues)} at risk (${ch.linkedSubscribers} subs)`;
    }

    if (gopVal) {
      gopVal.textContent = `${zap.gopSec.toFixed(1)}s`;
    }

    if (chartWrap) {
      chartWrap.innerHTML = renderIptvMulticastSvg(metrics, { compact: false });
    }

    if (tableBody) {
      tableBody.innerHTML = metrics.channels.map(c => `
        <tr class="${c.isSelected ? 'selected-row' : ''}">
          <td><strong>${c.name}</strong><br><small>${c.multicastIp}</small></td>
          <td>${c.primaryArea}</td>
          <td>${c.bitrateMbps} Mbps</td>
          <td>${c.zap.totalZapMs} ms</td>
          <td>${c.baseViewers} STBs</td>
          <td><span class="sim-delta-badge ${c.statusClass}">${c.qualityTier}</span></td>
        </tr>
      `).join('');
    }
  }

  // Populate channel dropdown once
  if (channelSelect && channelSelect.options.length === 0) {
    SHAHDARA_IPTV_CHANNELS.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.name} [${c.multicastIp}]`;
      channelSelect.appendChild(opt);
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
      if (channelSelect) {
        channelSelect.value = getIptvSelectedChannel();
      }
      if (fastLeaveCheckbox) {
        fastLeaveCheckbox.checked = getIptvFastLeaveEnabled();
      }
      if (gopSlider) {
        gopSlider.value = getIptvGopSizeSec() !== null ? getIptvGopSizeSec() : SHAHDARA_IPTV_CHANNELS.find(c => c.id === getIptvSelectedChannel())?.baseGopSec || 1.5;
      }
      if (fccCheckbox) {
        fccCheckbox.checked = getIptvFccAssist();
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

  // Channel select change
  if (channelSelect) {
    channelSelect.onchange = () => {
      setIptvSelectedChannel(channelSelect.value);
      if (gopSlider) {
        const c = SHAHDARA_IPTV_CHANNELS.find(ch => ch.id === channelSelect.value);
        gopSlider.value = c ? c.baseGopSec : 1.5;
        setIptvGopSizeSec(Number(gopSlider.value));
      }
      refreshModal();
    };
  }

  // Fast leave checkbox toggle
  if (fastLeaveCheckbox) {
    fastLeaveCheckbox.onchange = () => {
      setIptvFastLeaveEnabled(fastLeaveCheckbox.checked);
      refreshModal();
    };
  }

  // GOP size slider input
  if (gopSlider) {
    gopSlider.oninput = () => {
      setIptvGopSizeSec(Number(gopSlider.value));
      refreshModal();
    };
  }

  // FCC assist toggle
  if (fccCheckbox) {
    fccCheckbox.onchange = () => {
      setIptvFccAssist(fccCheckbox.checked);
      refreshModal();
    };
  }

  // Reset button
  if (resetBtn) {
    resetBtn.onclick = () => {
      resetIptvSimState();
      if (channelSelect) {
        channelSelect.value = getIptvSelectedChannel();
      }
      if (fastLeaveCheckbox) {
        fastLeaveCheckbox.checked = true;
      }
      if (gopSlider) {
        gopSlider.value = SHAHDARA_IPTV_CHANNELS[0].baseGopSec;
      }
      if (fccCheckbox) {
        fccCheckbox.checked = false;
      }
      refreshModal();
    };
  }

  // Filter area linked subscribers
  if (filterAreaBtn) {
    filterAreaBtn.onclick = () => {
      const metrics = calculateIptvMulticastMetrics(state, options);
      const targetArea = metrics.selectedChannel.primaryArea;
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
      const metrics = calculateIptvMulticastMetrics(state, options);
      const report = generateIptvMulticastReport(metrics, options);
      const clip = options.clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
      if (clip && typeof clip.writeText === 'function') {
        try {
          await clip.writeText(report);
          if (typeof options.onToast === 'function') {
            options.onToast('IPTV multicast and zapping briefing copied to clipboard!');
          }
        } catch (err) {
          console.error('Failed to copy IPTV report', err);
        }
      }
    };
  }
}
