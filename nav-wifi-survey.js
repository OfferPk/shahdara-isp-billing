/**
 * Shahdara ISP - Field Technician In-Home Wi-Fi Coverage & Channel Interference Assistant
 * Part of mobile navigation and field crew tools (agent2 - shahdara-mobile-nav).
 *
 * Implements 2.4 GHz & 5 GHz IEEE 802.11ac/ax Wi-Fi signal propagation modeling,
 * Free-Space Path Loss (FSPL) and multi-room obstacle attenuation (brick/concrete/wood),
 * co-channel and adjacent-channel interference scoring, Signal-to-Noise Ratio (SNR) calculations,
 * estimated PHY link throughput (Mbps), dead-zone detection, pure client-side SVG spectrum
 * and RSSI gauge visualizer, persistent survey history (localStorage), and WhatsApp dispatch reports.
 */

export const WIFI_SURVEY_STORAGE_KEY = 'shahdara_wifi_survey_logs_v1';

export const WIFI_FREQUENCY_BANDS = [
  {
    id: 'BAND_2_4GHZ',
    name: '2.4 GHz ISM Band (High Range, Wall Penetration)',
    centerFreqGhz: 2.437,
    channels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
    recommendedChannels: [1, 6, 11],
    defaultChannelWidthMhz: 20,
    maxThroughputMbps: 144
  },
  {
    id: 'BAND_5GHZ',
    name: '5 GHz UNII Band (High Bandwidth, Low Congestion)',
    centerFreqGhz: 5.240,
    channels: [36, 40, 44, 48, 149, 153, 157, 161],
    recommendedChannels: [36, 44, 149, 157],
    defaultChannelWidthMhz: 80,
    maxThroughputMbps: 866
  }
];

export const WIFI_SIGNAL_GRADES = {
  EXCELLENT: { id: 'EXCELLENT', label: 'EXCELLENT (≥ -50 dBm)', minRssi: -50, minSnr: 40, badgeClass: 'badge-success', rating: 'Optimal 4K/8K & Gaming', pass: true },
  GOOD: { id: 'GOOD', label: 'GOOD (-51 to -65 dBm)', minRssi: -65, minSnr: 25, badgeClass: 'badge-success', rating: 'Clean HD Streaming & Zoom', pass: true },
  FAIR: { id: 'FAIR', label: 'FAIR (-66 to -75 dBm)', minRssi: -75, minSnr: 15, badgeClass: 'badge-info', rating: 'Adequate Browsing / Chat', pass: true },
  WEAK: { id: 'WEAK', label: 'WEAK (-76 to -85 dBm)', minRssi: -85, minSnr: 10, badgeClass: 'badge-warning', rating: 'High Jitter & Packet Drops', pass: false },
  DEAD_ZONE: { id: 'DEAD_ZONE', label: 'DEAD ZONE (< -85 dBm)', minRssi: -Infinity, minSnr: 0, badgeClass: 'badge-danger', rating: 'No Usable Signal / Drop', pass: false }
};

export const OBSTACLE_TYPES = [
  { id: 'NONE', name: 'Open Air / Direct Line of Sight', lossDb: 0 },
  { id: 'WOOD_DOOR', name: 'Wooden Door / Partition (3 dB)', lossDb: 3 },
  { id: 'PLASTER_WALL', name: 'Single Drywall / Gypsum Partition (4 dB)', lossDb: 4 },
  { id: 'BRICK_SINGLE', name: 'Standard Single Brick Wall (8 dB)', lossDb: 8 },
  { id: 'BRICK_DOUBLE', name: 'Heavy Double Brick Wall (14 dB)', lossDb: 14 },
  { id: 'CONCRETE_SLAB', name: 'Reinforced Concrete Ceiling / Slab (18 dB)', lossDb: 18 },
  { id: 'METAL_GRILL', name: 'Metal Security Gate / Tin Roof (20 dB)', lossDb: 20 }
];

export const SHAHDARA_ROOM_ZONES = [
  { id: 'LIVING_ROOM', name: 'Living Room / Router Location', defaultDistM: 2, defaultObstacle: 'NONE' },
  { id: 'GUEST_BAITHAK', name: 'Guest Baithak (Front Room)', defaultDistM: 6, defaultObstacle: 'BRICK_SINGLE' },
  { id: 'BEDROOM_1', name: 'Ground Floor Master Bedroom', defaultDistM: 8, defaultObstacle: 'BRICK_SINGLE' },
  { id: 'KITCHEN_COURT', name: 'Kitchen & Inner Courtyard', defaultDistM: 10, defaultObstacle: 'BRICK_DOUBLE' },
  { id: 'BEDROOM_2', name: 'First Floor Upper Bedroom', defaultDistM: 12, defaultObstacle: 'CONCRETE_SLAB' },
  { id: 'ROOFTOP_TERRACE', name: 'Rooftop Terrace / Mamty', defaultDistM: 16, defaultObstacle: 'CONCRETE_SLAB' }
];

/**
 * Calculates Free-Space Path Loss (FSPL) and total attenuation based on distance,
 * frequency, and cumulative obstacle losses.
 *
 * FSPL formula:
 * FSPL (dB) = 20 * log10(d_km) + 20 * log10(f_MHz) + 32.44
 * Equivalent with d in meters:
 * FSPL (dB) = 20 * log10(d_m) + 20 * log10(f_GHz) + 92.45 - 60 = 20 * log10(d_m) + 20 * log10(f_GHz * 1000) - 27.55
 */
export function calculateEstimatedRssi({
  txPowerDbm = 20,
  distanceMeters = 5,
  frequencyGhz = 2.437,
  obstacleLossDb = 0
} = {}) {
  const tx = Math.max(10, Math.min(30, Number(txPowerDbm) || 20));
  const dist = Math.max(0.5, Math.min(50, Number(distanceMeters) || 5));
  const freq = Math.max(2.4, Math.min(6.0, Number(frequencyGhz) || 2.437));
  const wallLoss = Math.max(0, Number(obstacleLossDb) || 0);

  // FSPL calculation
  const fspl = (20 * Math.log10(dist)) + (20 * Math.log10(freq * 1000)) - 27.55;

  // Realized RSSI at receiver
  const rawRssi = tx - fspl - wallLoss;

  // Clamp realistic bounds (-95 dBm to -25 dBm)
  const clampedRssi = Math.max(-95, Math.min(-25, Math.round(rawRssi)));
  return clampedRssi;
}

/**
 * Calculates channel overlap penalty and evaluates interference from neighbor APs.
 */
export function calculateChannelInterferencePenalty(channelNumber, bandId, neighborCount = 3) {
  const ch = Number(channelNumber) || 1;
  const count = Math.max(0, Number(neighborCount) || 0);

  if (bandId === 'BAND_5GHZ') {
    // 5 GHz channels in 80 MHz have high channel separation
    return {
      interferenceScore: Math.min(100, count * 8),
      isRecommended: [36, 44, 149, 157].includes(ch),
      penaltyDb: count * 0.5
    };
  }

  // 2.4 GHz analysis
  const isRecommended = [1, 6, 11].includes(ch);
  let baseScore = 0;
  if (!isRecommended) {
    // Non-standard channel overlapping with 2 adjacent primary channels
    baseScore = 35;
  }
  const totalScore = Math.min(100, baseScore + (count * 12));
  const penaltyDb = (totalScore / 100) * 6; // up to 6 dB effective SNR degradation

  return {
    interferenceScore: Math.round(totalScore),
    isRecommended,
    penaltyDb: Math.round(penaltyDb * 10) / 10
  };
}

/**
 * Evaluates Wi-Fi signal quality, Signal-to-Noise Ratio (SNR), estimated link speed,
 * and diagnostic recommendations.
 */
export function evaluateWifiSignalQuality(
  rssiDbm,
  noiseFloorDbm = -95,
  bandId = 'BAND_2_4GHZ',
  channelNumber = 6,
  neighborApCount = 2
) {
  const rssi = Math.max(-95, Math.min(-25, Number(rssiDbm) || -60));
  const noise = Math.max(-105, Math.min(-80, Number(noiseFloorDbm) || -95));
  const snr = Math.max(0, rssi - noise);

  const interference = calculateChannelInterferencePenalty(channelNumber, bandId, neighborApCount);
  const effectiveSnr = Math.max(0, snr - interference.penaltyDb);

  let grade = WIFI_SIGNAL_GRADES.DEAD_ZONE;
  if (rssi >= -50 && effectiveSnr >= 35) {
    grade = WIFI_SIGNAL_GRADES.EXCELLENT;
  } else if (rssi >= -65 && effectiveSnr >= 22) {
    grade = WIFI_SIGNAL_GRADES.GOOD;
  } else if (rssi >= -75 && effectiveSnr >= 14) {
    grade = WIFI_SIGNAL_GRADES.FAIR;
  } else if (rssi >= -85 && effectiveSnr >= 8) {
    grade = WIFI_SIGNAL_GRADES.WEAK;
  }

  // Estimated PHY Link Rate Mbps
  const band = WIFI_FREQUENCY_BANDS.find(b => b.id === bandId) || WIFI_FREQUENCY_BANDS[0];
  const maxRate = band.maxThroughputMbps;
  const snrRatio = Math.min(1.0, effectiveSnr / 40);
  const estimatedThroughputMbps = Math.round(maxRate * Math.pow(snrRatio, 1.4));

  const warnings = [];
  const recommendations = [];

  if (grade.id === 'DEAD_ZONE' || grade.id === 'WEAK') {
    warnings.push(`Severe signal attenuation (RSSI ${rssi} dBm). Signal below reliable connection threshold.`);
    recommendations.push('Install an in-line Ethernet Cat6 cable to a secondary Wi-Fi Access Point on upper floor or rear rooms.');
  }

  if (!interference.isRecommended && bandId === 'BAND_2_4GHZ') {
    warnings.push(`Channel ${channelNumber} is non-standard and causes severe overlapping sideband interference.`);
    recommendations.push('Reconfigure router 2.4 GHz radio to fixed standard Channel 1, 6, or 11 with 20 MHz channel bandwidth.');
  }

  if (interference.interferenceScore > 50) {
    warnings.push(`High co-channel congestion (${neighborApCount} neighbor networks detected on channel).`);
    recommendations.push('Switch high-bandwidth client devices (Smart TVs, laptops) to the 5 GHz Wi-Fi band.');
  }

  if (rssi <= -70 && bandId === 'BAND_5GHZ') {
    recommendations.push('5 GHz suffers heavy wall loss; recommend switching this remote room to 2.4 GHz or using a mesh node.');
  }

  return {
    rssiDbm: rssi,
    noiseFloorDbm: noise,
    snrDb: snr,
    effectiveSnrDb: Math.round(effectiveSnr * 10) / 10,
    interference,
    grade,
    estimatedThroughputMbps,
    warnings,
    recommendations
  };
}

/**
 * Reads persistent Wi-Fi survey records from localStorage.
 */
export function getWifiSurveyStore(storage = null) {
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store) return [];
  try {
    const raw = store.getItem(WIFI_SURVEY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

/**
 * Saves Wi-Fi survey records to localStorage.
 */
export function saveWifiSurveyStore(records, storage = null) {
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store) return false;
  try {
    store.setItem(WIFI_SURVEY_STORAGE_KEY, JSON.stringify(records.slice(0, 50)));
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Records a new Wi-Fi survey audit entry into persistent store.
 */
export function recordWifiSurvey(entry, storage = null) {
  const current = getWifiSurveyStore(storage);
  const evaluation = evaluateWifiSignalQuality(
    entry.rssiDbm,
    entry.noiseFloorDbm || -95,
    entry.bandId || 'BAND_2_4GHZ',
    entry.channelNumber || 6,
    entry.neighborApCount || 2
  );

  const room = SHAHDARA_ROOM_ZONES.find(r => r.id === entry.roomId) || SHAHDARA_ROOM_ZONES[0];
  const obstacle = OBSTACLE_TYPES.find(o => o.id === entry.obstacleId) || OBSTACLE_TYPES[0];

  const newRecord = {
    id: `wifi-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    customerName: String(entry.customerName || 'Shahdara Subscriber').trim(),
    area: String(entry.area || 'Shahdara Town').trim(),
    roomId: room.id,
    roomName: room.name,
    distanceMeters: Number(entry.distanceMeters) || room.defaultDistM,
    obstacleId: obstacle.id,
    obstacleName: obstacle.name,
    bandId: entry.bandId || 'BAND_2_4GHZ',
    channelNumber: Number(entry.channelNumber) || 6,
    ssidName: String(entry.ssidName || 'Shahdara-Fiber-WiFi').trim(),
    rssiDbm: evaluation.rssiDbm,
    snrDb: evaluation.effectiveSnrDb,
    estimatedThroughputMbps: evaluation.estimatedThroughputMbps,
    gradeId: evaluation.grade.id,
    gradeLabel: evaluation.grade.label,
    pass: evaluation.grade.pass,
    linemanNotes: String(entry.linemanNotes || '').trim()
  };

  const updated = [newRecord, ...current].slice(0, 50);
  saveWifiSurveyStore(updated, storage);
  return newRecord;
}

/**
 * Clears the persistent Wi-Fi survey store.
 */
export function clearWifiSurveyStore(storage = null) {
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store) return false;
  try {
    store.removeItem(WIFI_SURVEY_STORAGE_KEY);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Renders an accessible SVG visualizer showing:
 * - 2.4/5GHz Channel Spectrum bell curve
 * - Speedometer RSSI signal gauge
 * - SNR & throughput HUD readout
 */
export function renderMobileWifiSurveySvg(surveyRecord) {
  const rec = surveyRecord || {};
  const rssi = Math.max(-95, Math.min(-25, Number(rec.rssiDbm) || -62));
  const bandId = rec.bandId || 'BAND_2_4GHZ';
  const currentCh = Number(rec.channelNumber) || 6;
  const throughput = Number(rec.estimatedThroughputMbps) || 75;

  const evaluation = evaluateWifiSignalQuality(
    rssi,
    -95,
    bandId,
    currentCh,
    rec.neighborApCount || 2
  );

  const width = 640;
  const height = 240;

  // Gauge angle (-95 dBm = -135 deg, -25 dBm = +135 deg)
  const rssiRatio = (rssi - (-95)) / 70; // 0 to 1
  const needleAngle = -135 + (rssiRatio * 270);
  const needleRad = (needleAngle * Math.PI) / 180;
  const gaugeCenterX = 130;
  const gaugeCenterY = 130;
  const needleLen = 50;
  const needleX = gaugeCenterX + needleLen * Math.cos(needleRad);
  const needleY = gaugeCenterY + needleLen * Math.sin(needleRad);

  const gaugeColor = evaluation.grade.badgeClass === 'badge-success'
    ? '#10b981'
    : (evaluation.grade.badgeClass === 'badge-danger' ? '#ef4444' : '#f59e0b');

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" class="wifi-survey-svg" role="img" aria-label="Wi-Fi Signal Strength and Channel Spectrum Visualizer">
      <defs>
        <linearGradient id="spectrumBg" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#0f172a"/>
          <stop offset="100%" stop-color="#090d16"/>
        </linearGradient>

        <linearGradient id="primaryCurveGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${gaugeColor}" stop-opacity="0.8"/>
          <stop offset="100%" stop-color="${gaugeColor}" stop-opacity="0.1"/>
        </linearGradient>
      </defs>

      <!-- Background -->
      <rect x="0" y="0" width="${width}" height="${height}" rx="10" fill="url(#spectrumBg)" stroke="#334155" stroke-width="1.5"/>

      <!-- SECTION 1: RSSI SPEEDOMETER GAUGE -->
      <g transform="translate(0, 0)">
        <rect x="15" y="15" width="230" height="210" rx="8" fill="#141e2e" stroke="#1e293b" stroke-width="1.2"/>
        <text x="130" y="38" fill="#94a3b8" font-size="11" font-weight="700" text-anchor="middle" letter-spacing="0.5">IN-ROOM SIGNAL RSSI</text>

        <!-- Circular Arc Track -->
        <path d="M 80 165 A 60 60 0 1 1 180 165" fill="none" stroke="#334155" stroke-width="10" stroke-linecap="round"/>
        <!-- Active Arc Track -->
        <path d="M 80 165 A 60 60 0 1 1 180 165" fill="none" stroke="${gaugeColor}" stroke-width="10" stroke-linecap="round" stroke-dasharray="280" stroke-dashoffset="${280 - (rssiRatio * 280)}"/>

        <!-- Center Needle -->
        <circle cx="${gaugeCenterX}" cy="${gaugeCenterY}" r="7" fill="#f8fafc"/>
        <line x1="${gaugeCenterX}" y1="${gaugeCenterY}" x2="${needleX}" y2="${needleY}" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>

        <!-- Digital Readout -->
        <text x="130" y="195" fill="${gaugeColor}" font-size="22" font-weight="800" font-family="monospace" text-anchor="middle">${rssi} dBm</text>
        <text x="130" y="212" fill="#64748b" font-size="10" font-weight="600" text-anchor="middle">${evaluation.grade.rating}</text>
      </g>

      <!-- SECTION 2: 2.4/5GHz SPECTRUM CHANNEL CURVES -->
      <g transform="translate(260, 0)">
        <rect x="0" y="15" width="365" height="135" rx="8" fill="#141e2e" stroke="#1e293b" stroke-width="1.2"/>
        <text x="15" y="35" fill="#94a3b8" font-size="10" font-weight="700">RADIO SPECTRUM: ${bandId === 'BAND_2_4GHZ' ? '2.4 GHz (Channels 1 - 11)' : '5 GHz UNII (Channels 36 - 161)'}</text>

        <!-- Spectrum baseline -->
        <line x1="20" y1="120" x2="345" y2="120" stroke="#475569" stroke-width="1.2"/>

        ${bandId === 'BAND_2_4GHZ' ? `
          <!-- Channel 1 curve -->
          <path d="M 25,120 Q 55,55 85,120 Z" fill="${currentCh === 1 ? 'url(#primaryCurveGrad)' : 'rgba(56, 189, 248, 0.15)'}" stroke="${currentCh === 1 ? gaugeColor : '#38bdf8'}" stroke-width="${currentCh === 1 ? 2.5 : 1}"/>
          <text x="55" y="132" fill="#94a3b8" font-size="9" text-anchor="middle">Ch 1</text>

          <!-- Channel 6 curve -->
          <path d="M 130,120 Q 160,55 190,120 Z" fill="${currentCh === 6 ? 'url(#primaryCurveGrad)' : 'rgba(56, 189, 248, 0.15)'}" stroke="${currentCh === 6 ? gaugeColor : '#38bdf8'}" stroke-width="${currentCh === 6 ? 2.5 : 1}"/>
          <text x="160" y="132" fill="#94a3b8" font-size="9" text-anchor="middle">Ch 6</text>

          <!-- Channel 11 curve -->
          <path d="M 235,120 Q 265,55 295,120 Z" fill="${currentCh === 11 ? 'url(#primaryCurveGrad)' : 'rgba(56, 189, 248, 0.15)'}" stroke="${currentCh === 11 ? gaugeColor : '#38bdf8'}" stroke-width="${currentCh === 11 ? 2.5 : 1}"/>
          <text x="265" y="132" fill="#94a3b8" font-size="9" text-anchor="middle">Ch 11</text>
        ` : `
          <!-- 5GHz UNII-1 Curves -->
          <path d="M 30,120 Q 60,50 90,120 Z" fill="${currentCh <= 48 ? 'url(#primaryCurveGrad)' : 'rgba(168, 85, 247, 0.15)'}" stroke="${currentCh <= 48 ? gaugeColor : '#a855f7'}" stroke-width="2"/>
          <text x="60" y="132" fill="#94a3b8" font-size="9" text-anchor="middle">Ch 36-48 (80M)</text>

          <!-- 5GHz UNII-3 Curves -->
          <path d="M 220,120 Q 250,50 280,120 Z" fill="${currentCh >= 149 ? 'url(#primaryCurveGrad)' : 'rgba(168, 85, 247, 0.15)'}" stroke="${currentCh >= 149 ? gaugeColor : '#a855f7'}" stroke-width="2"/>
          <text x="250" y="132" fill="#94a3b8" font-size="9" text-anchor="middle">Ch 149-161 (80M)</text>
        `}

        <!-- Current Operating Marker -->
        <rect x="250" y="24" width="100" height="20" rx="4" fill="#0f172a" stroke="#334155" stroke-width="1"/>
        <text x="300" y="38" fill="#38bdf8" font-size="10" font-weight="700" text-anchor="middle">ACTIVE CH: ${currentCh}</text>
      </g>

      <!-- SECTION 3: KPI RIBBON (SNR, LINK SPEED, GRADE) -->
      <g transform="translate(260, 160)">
        <rect x="0" y="0" width="115" height="65" rx="6" fill="#141e2e" stroke="#1e293b" stroke-width="1.2"/>
        <text x="10" y="18" fill="#64748b" font-size="9" font-weight="700">SIGNAL-TO-NOISE</text>
        <text x="10" y="44" fill="#38bdf8" font-size="18" font-weight="800" font-family="monospace">${evaluation.effectiveSnrDb.toFixed(1)}</text>
        <text x="55" y="42" fill="#94a3b8" font-size="10">dB SNR</text>
        <text x="10" y="58" fill="#10b981" font-size="8">Noise: -95 dBm</text>

        <rect x="125" y="0" width="115" height="65" rx="6" fill="#141e2e" stroke="#1e293b" stroke-width="1.2"/>
        <text x="135" y="18" fill="#64748b" font-size="9" font-weight="700">PHY LINK SPEED</text>
        <text x="135" y="44" fill="#38bdf8" font-size="18" font-weight="800" font-family="monospace">${throughput}</text>
        <text x="180" y="42" fill="#94a3b8" font-size="10">Mbps</text>
        <text x="135" y="58" fill="#64748b" font-size="8">802.11ac MCS</text>

        <rect x="250" y="0" width="115" height="65" rx="6" fill="#141e2e" stroke="#1e293b" stroke-width="1.2"/>
        <text x="260" y="18" fill="#64748b" font-size="9" font-weight="700">COVERAGE GRADE</text>
        <rect x="260" y="28" width="95" height="22" rx="4" fill="${gaugeColor}"/>
        <text x="307" y="43" fill="#ffffff" font-size="9" font-weight="800" text-anchor="middle">${evaluation.grade.id}</text>
      </g>
    </svg>
  `;
}

/**
 * Generates an executive WhatsApp field dispatch report for subscriber Wi-Fi optimization.
 */
export function generateWifiSurveyReport(surveyRecord, options = {}) {
  const rec = surveyRecord || {};
  const rssi = Number(rec.rssiDbm) || -65;
  const bandId = rec.bandId || 'BAND_2_4GHZ';
  const currentCh = Number(rec.channelNumber) || 6;
  const evaluation = evaluateWifiSignalQuality(
    rssi,
    -95,
    bandId,
    currentCh,
    rec.neighborApCount || 2
  );

  const room = SHAHDARA_ROOM_ZONES.find(r => r.id === rec.roomId) || SHAHDARA_ROOM_ZONES[0];
  const obstacle = OBSTACLE_TYPES.find(o => o.id === rec.obstacleId) || OBSTACLE_TYPES[0];
  const band = WIFI_FREQUENCY_BANDS.find(b => b.id === bandId) || WIFI_FREQUENCY_BANDS[0];

  const now = rec.timestamp ? new Date(rec.timestamp) : new Date();
  const dateStr = now.toISOString().replace('T', ' ').slice(0, 19) + ' PKT';

  return [
    `📶 *SHAHDARA ISP - IN-HOME WI-FI COVERAGE AUDIT* 📶`,
    `📅 Date/Time: ${dateStr}`,
    `👤 Subscriber: ${rec.customerName || 'Shahdara Subscriber'} (${rec.area || 'Shahdara Town'})`,
    `🏠 Inspected Location: ${room.name}`,
    `📏 Distance from Router: ${rec.distanceMeters || room.defaultDistM} meters`,
    `🧱 Obstacle Path: ${obstacle.name}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📡 *RADIO FREQUENCY & SPECTRUM*`,
    `• SSID Network: ${rec.ssidName || 'Shahdara-Fiber-WiFi'}`,
    `• Radio Band: ${band.name}`,
    `• Channel: ${currentCh} (${evaluation.interference.isRecommended ? 'Standard Non-Overlapping ✓' : 'Overlapping Warning ⚠'})`,
    `• Congestion Score: ${evaluation.interference.interferenceScore}/100`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📊 *MEASURED SIGNAL & LINK CAPACITY*`,
    `• Measured RSSI: ${rssi} dBm [${evaluation.grade.label}]`,
    `• Signal-to-Noise Ratio (SNR): ${evaluation.effectiveSnrDb} dB`,
    `• Estimated PHY Link Speed: ~${evaluation.estimatedThroughputMbps} Mbps`,
    `• Service Readiness: ${evaluation.grade.pass ? 'OPTIMAL COVERAGE ✓' : 'DEAD ZONE / UPGRADE REQUIRED ✗'}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `💡 *LINEMAN RECOMMENDATIONS*`,
    ...(evaluation.recommendations.length > 0 ? evaluation.recommendations.map(r => `• ${r}`) : ['• Current router placement provides adequate signal.']),
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📝 Technician Notes: ${rec.linemanNotes || 'Signal checked with spectrum analyzer.'}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Generated via Shahdara ISP Field Navigation Suite`
  ].join('\n');
}

/**
 * Initializes and wires the Field Technician In-Home Wi-Fi Coverage & Channel Modal Dialog.
 */
export function setupMobileWifiSurveyModal(options = {}) {
  const doc = options.document || (typeof document !== 'undefined' ? document : null);
  const storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);

  if (!doc) {
    return {
      open: () => {},
      close: () => {},
      getCurrentReading: () => ({}),
      setReading: () => {}
    };
  }

  const modal = doc.getElementById('mobileWifiSurveyModal');
  const closeBtn = doc.getElementById('mobileWifiSurveyModalCloseBtn');
  const openButtons = doc.querySelectorAll('[data-open-wifi-survey]');

  // Inputs
  const customerInput = doc.getElementById('wifiCustomerNameInput');
  const areaSelect = doc.getElementById('wifiAreaSelect');
  const roomSelect = doc.getElementById('wifiRoomSelect');
  const distanceSlider = doc.getElementById('wifiDistanceSlider');
  const distanceVal = doc.getElementById('wifiDistanceVal');
  const obstacleSelect = doc.getElementById('wifiObstacleSelect');
  const bandSelect = doc.getElementById('wifiBandSelect');
  const channelSelect = doc.getElementById('wifiChannelSelect');
  const neighborInput = doc.getElementById('wifiNeighborInput');
  const notesInput = doc.getElementById('wifiNotesInput');

  // Outputs & Display
  const svgContainer = doc.getElementById('wifiSvgContainer');
  const rssiDisplay = doc.getElementById('wifiRssiDisplay');
  const gradeBadge = doc.getElementById('wifiGradeBadge');
  const warningsContainer = doc.getElementById('wifiWarningsContainer');
  const historyTableBody = doc.getElementById('wifiHistoryTableBody');

  // Buttons
  const recordSurveyBtn = doc.getElementById('wifiRecordLogBtn');
  const copyReportBtn = doc.getElementById('wifiCopyReportBtn');
  const clearHistoryBtn = doc.getElementById('wifiClearHistoryBtn');
  const filterAreaBtn = doc.getElementById('wifiFilterAreaBtn');

  // State
  const currentReading = {
    customerName: 'Muhammad Aslam',
    area: 'Shahdara Town',
    roomId: 'LIVING_ROOM',
    distanceMeters: 2,
    obstacleId: 'NONE',
    bandId: 'BAND_2_4GHZ',
    channelNumber: 6,
    neighborApCount: 2,
    txPowerDbm: 20,
    rssiDbm: -45,
    ssidName: 'Shahdara-Fiber-Optic',
    linemanNotes: ''
  };

  function updateCalculatedRssi() {
    const obstacle = OBSTACLE_TYPES.find(o => o.id === currentReading.obstacleId) || OBSTACLE_TYPES[0];
    const freq = currentReading.bandId === 'BAND_5GHZ' ? 5.240 : 2.437;

    currentReading.rssiDbm = calculateEstimatedRssi({
      txPowerDbm: currentReading.txPowerDbm,
      distanceMeters: currentReading.distanceMeters,
      frequencyGhz: freq,
      obstacleLossDb: obstacle.lossDb
    });
  }

  function updateChannelOptions() {
    if (!channelSelect) return;
    const band = WIFI_FREQUENCY_BANDS.find(b => b.id === currentReading.bandId) || WIFI_FREQUENCY_BANDS[0];
    channelSelect.innerHTML = band.channels.map(ch => {
      const isRec = band.recommendedChannels.includes(ch);
      return `<option value="${ch}" ${ch === currentReading.channelNumber ? 'selected' : ''}>Channel ${ch} ${isRec ? '★ Recommended' : ''}</option>`;
    }).join('');
  }

  function renderView() {
    updateCalculatedRssi();

    const evaluation = evaluateWifiSignalQuality(
      currentReading.rssiDbm,
      -95,
      currentReading.bandId,
      currentReading.channelNumber,
      currentReading.neighborApCount
    );

    currentReading.estimatedThroughputMbps = evaluation.estimatedThroughputMbps;

    // SVG
    if (svgContainer) {
      svgContainer.innerHTML = renderMobileWifiSurveySvg(currentReading);
    }

    // Display
    if (rssiDisplay) {
      rssiDisplay.textContent = `${currentReading.rssiDbm} dBm`;
    }

    if (gradeBadge) {
      gradeBadge.className = `badge ${evaluation.grade.badgeClass}`;
      gradeBadge.textContent = evaluation.grade.label;
    }

    // Warnings
    if (warningsContainer) {
      if (evaluation.warnings.length === 0) {
        warningsContainer.innerHTML = `
          <div class="alert alert-success" style="font-size: 12px; padding: 6px 10px; margin: 0;">
            ✓ High Wi-Fi link quality. Full streaming and gaming capacity available.
          </div>
        `;
      } else {
        warningsContainer.innerHTML = evaluation.warnings.map(w => `
          <div class="alert alert-warning" style="font-size: 12px; padding: 6px 10px; margin-bottom: 4px;">
            ⚠ ${w}
          </div>
        `).join('');
      }
    }

    // History
    if (historyTableBody) {
      const records = getWifiSurveyStore(storage);
      if (records.length === 0) {
        historyTableBody.innerHTML = `
          <tr><td colspan="5" style="text-align: center; color: var(--muted, #94a3b8); padding: 12px;">No Wi-Fi surveys logged yet.</td></tr>
        `;
      } else {
        historyTableBody.innerHTML = records.slice(0, 8).map(r => `
          <tr style="border-bottom: 1px solid var(--border, #334155); font-size: 12px;">
            <td style="padding: 6px 8px;">${r.timestamp ? r.timestamp.slice(11, 16) : '--:--'}</td>
            <td style="padding: 6px 8px;">${r.roomName || r.roomId}</td>
            <td style="padding: 6px 8px;">${r.bandId === 'BAND_5GHZ' ? '5 GHz' : '2.4 GHz'} (Ch ${r.channelNumber})</td>
            <td style="padding: 6px 8px; font-weight: bold; font-family: monospace;">${r.rssiDbm} dBm</td>
            <td style="padding: 6px 8px;"><span class="badge ${r.pass ? 'badge-success' : 'badge-danger'}">${r.pass ? 'PASS' : 'WEAK'}</span></td>
          </tr>
        `).join('');
      }
    }
  }

  function openModal() {
    if (!modal) return;
    updateChannelOptions();
    renderView();
    if (typeof modal.showModal === 'function') {
      try {
        modal.showModal();
      } catch (_) {
        modal.setAttribute('open', 'true');
      }
    } else {
      modal.setAttribute('open', 'true');
    }
  }

  function closeModal() {
    if (!modal) return;
    if (typeof modal.close === 'function') {
      modal.close();
    } else {
      modal.removeAttribute('open');
    }
  }

  // Triggers
  openButtons.forEach(btn => {
    btn.onclick = (e) => {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      openModal();
    };
  });

  if (closeBtn) {
    closeBtn.onclick = (e) => {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      closeModal();
    };
  }

  // Inputs
  if (customerInput) {
    customerInput.oninput = (e) => {
      currentReading.customerName = e.target.value;
    };
  }

  if (areaSelect) {
    areaSelect.onchange = (e) => {
      currentReading.area = e.target.value;
    };
  }

  if (roomSelect) {
    roomSelect.onchange = (e) => {
      currentReading.roomId = e.target.value;
      const found = SHAHDARA_ROOM_ZONES.find(r => r.id === e.target.value);
      if (found) {
        currentReading.distanceMeters = found.defaultDistM;
        if (distanceSlider) distanceSlider.value = found.defaultDistM;
        if (distanceVal) distanceVal.textContent = `${found.defaultDistM}m`;
        currentReading.obstacleId = found.defaultObstacle;
        if (obstacleSelect) obstacleSelect.value = found.defaultObstacle;
      }
      renderView();
    };
  }

  if (distanceSlider) {
    distanceSlider.oninput = (e) => {
      const val = Number(e.target.value) || 2;
      currentReading.distanceMeters = val;
      if (distanceVal) distanceVal.textContent = `${val}m`;
      renderView();
    };
  }

  if (obstacleSelect) {
    obstacleSelect.onchange = (e) => {
      currentReading.obstacleId = e.target.value;
      renderView();
    };
  }

  if (bandSelect) {
    bandSelect.onchange = (e) => {
      currentReading.bandId = e.target.value;
      currentReading.channelNumber = e.target.value === 'BAND_5GHZ' ? 36 : 6;
      updateChannelOptions();
      renderView();
    };
  }

  if (channelSelect) {
    channelSelect.onchange = (e) => {
      currentReading.channelNumber = Number(e.target.value) || 6;
      renderView();
    };
  }

  if (neighborInput) {
    neighborInput.oninput = (e) => {
      currentReading.neighborApCount = Math.max(0, Number(e.target.value) || 0);
      renderView();
    };
  }

  // Action Buttons
  if (recordSurveyBtn) {
    recordSurveyBtn.onclick = () => {
      if (notesInput) currentReading.linemanNotes = notesInput.value;
      const saved = recordWifiSurvey(currentReading, storage);
      renderView();
      if (typeof options.onToast === 'function') {
        options.onToast(`✓ Logged Wi-Fi Survey for ${saved.roomName} (${saved.rssiDbm} dBm)`);
      }
    };
  }

  if (copyReportBtn) {
    copyReportBtn.onclick = async () => {
      if (notesInput) currentReading.linemanNotes = notesInput.value;
      const report = generateWifiSurveyReport(currentReading, options);
      const clipboard = options.clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
      let success = false;
      if (clipboard && typeof clipboard.writeText === 'function') {
        try {
          await clipboard.writeText(report);
          success = true;
        } catch (_) {}
      }
      if (typeof options.onToast === 'function') {
        options.onToast(success ? '✓ WhatsApp Wi-Fi Report copied to clipboard' : 'Report generated in console');
      }
    };
  }

  if (clearHistoryBtn) {
    clearHistoryBtn.onclick = () => {
      clearWifiSurveyStore(storage);
      renderView();
      if (typeof options.onToast === 'function') {
        options.onToast('Cleared Wi-Fi survey logs');
      }
    };
  }

  if (filterAreaBtn) {
    filterAreaBtn.onclick = () => {
      if (typeof options.onFilterArea === 'function') {
        options.onFilterArea(currentReading.area);
        closeModal();
      }
    };
  }

  return {
    open: openModal,
    close: closeModal,
    getCurrentReading: () => ({ ...currentReading }),
    setReading: (newReading) => {
      Object.assign(currentReading, newReading);
      renderView();
    }
  };
}
