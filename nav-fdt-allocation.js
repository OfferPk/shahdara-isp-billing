/**
 * Shahdara ISP - Field Technician Fiber Access Terminal (FAT / FDT) Port Allocation Matrix
 * Part of mobile navigation and field crew tools (agent2 - shahdara-mobile-nav).
 *
 * Implements outdoor pole-mounted Fiber Distribution Terminal (FDT) & Fiber Access Terminal (FAT)
 * port cross-connect tracking, subscriber drop cable allocation, port capacity utilization,
 * optical power health audit (ITU-T G.984 Class B+), span distance strain evaluation,
 * pure client-side SVG enclosure visualizer, persistent device storage, and WhatsApp lineman dispatch reports.
 */

export const FDT_ALLOCATIONS_STORAGE_KEY = 'shahdara_fdt_allocations_v1';

export const PORT_STATUSES = {
  ACTIVE: { id: 'ACTIVE', label: 'Active Connected', color: '#10b981', badgeClass: 'badge-active' },
  RESERVED: { id: 'RESERVED', label: 'Reserved / In-Progress', color: '#f59e0b', badgeClass: 'badge-reserved' },
  FAULTY: { id: 'FAULTY', label: 'Faulty / High-Loss', color: '#ef4444', badgeClass: 'badge-faulty' },
  SPARE: { id: 'SPARE', label: 'Spare Available', color: '#94a3b8', badgeClass: 'badge-spare' }
};

export const FDT_CONNECTOR_POLISH_TYPES = {
  SC_APC: { id: 'SC_APC', label: 'SC/APC (Green - 8° Angled, >60dB RL)', color: '#16a34a', returnLossDb: 60 },
  SC_UPC: { id: 'SC_UPC', label: 'SC/UPC (Blue - Flat Physical, >50dB RL)', color: '#2563eb', returnLossDb: 50 }
};
export const CONNECTOR_POLISH_TYPES = FDT_CONNECTOR_POLISH_TYPES;

export const OPTICAL_POWER_STANDARDS = {
  OPTIMAL: { id: 'OPTIMAL', label: 'Optimal Optical Level (-14.0 to -24.0 dBm)', color: '#10b981', pass: true },
  ACCEPTABLE: { id: 'ACCEPTABLE', label: 'Acceptable Margin (-8.0 to -13.9 or -24.1 to -27.0 dBm)', color: '#3b82f6', pass: true },
  MARGINAL: { id: 'MARGINAL', label: 'Marginal Flapping Risk (-27.1 to -28.5 dBm)', color: '#f59e0b', pass: false },
  CRITICAL_LOW: { id: 'CRITICAL_LOW', label: 'Critical Optical Loss (< -28.5 dBm)', color: '#ef4444', pass: false },
  OVERLOAD: { id: 'OVERLOAD', label: 'Optical Receiver Overload (> -8.0 dBm)', color: '#dc2626', pass: false },
  NO_LIGHT: { id: 'NO_LIGHT', label: 'No Optical Light Detected (0 dBm / Unlit)', color: '#64748b', pass: false }
};

export const DROP_SPAN_LIMITS = {
  EXCELLENT: { maxMeters: 150, label: 'Optimal Drop Span (≤ 150m)', color: '#10b981', note: 'Low tensile sag; minimal microbending risk' },
  STANDARD: { maxMeters: 250, label: 'Standard Pole Span (151 - 250m)', color: '#3b82f6', note: 'Standard drop clamp anchoring required' },
  LONG_SPAN: { maxMeters: 9999, label: 'Extended Span Warning (> 250m)', color: '#f59e0b', note: 'High catenary pull tension; recommend intermediate hook or repeater pole' }
};

export const DEFAULT_SHAHDARA_FAT_ENCLOSURES = [
  {
    id: 'FAT-BAR-01',
    name: 'Baradari Chowk Pole #18 (FAT-BAR-01)',
    area: 'Baradari Road',
    totalPorts: 16,
    splitterType: '1:16 PLC Cassette',
    feederCable: '24-Core ADSS Feeder Trunk',
    feederCore: 'Core 03 (Green)',
    poleNumber: 'POLE-BAR-018',
    gpsCoords: '31.6214, 74.2829',
    ports: [
      { portNumber: 1, status: 'ACTIVE', customerName: 'Sample Customer One', subscriberId: 'CUST-1042', address: 'House 42, St 3, Baradari', dropLengthMeters: 85, rxPowerDbm: -18.6, connectorPolish: 'SC_APC', notes: 'Stable link' },
      { portNumber: 2, status: 'ACTIVE', customerName: 'Tariq Mehmood', subscriberId: 'CUST-1055', address: 'Shop 12, Baradari Bazaar', dropLengthMeters: 120, rxPowerDbm: -19.2, connectorPolish: 'SC_APC', notes: 'Giga fiber plan' },
      { portNumber: 3, status: 'ACTIVE', customerName: 'Usman Ghani', subscriberId: 'CUST-1088', address: 'House 19, Gulshan St', dropLengthMeters: 65, rxPowerDbm: -18.2, connectorPolish: 'SC_APC', notes: 'Standard home' },
      { portNumber: 4, status: 'ACTIVE', customerName: 'Haji Rafique', subscriberId: 'CUST-1102', address: 'Al-Rehman Sweet, Main Rd', dropLengthMeters: 140, rxPowerDbm: -19.8, connectorPolish: 'SC_APC', notes: 'Commercial shop' },
      { portNumber: 5, status: 'ACTIVE', customerName: 'Asad Ullah', subscriberId: 'CUST-1115', address: 'House 8B, Gali 2', dropLengthMeters: 95, rxPowerDbm: -18.9, connectorPolish: 'SC_APC', notes: 'Good light' },
      { portNumber: 6, status: 'ACTIVE', customerName: 'Bilal Siddique', subscriberId: 'CUST-1123', address: 'House 55, Baradari', dropLengthMeters: 110, rxPowerDbm: -19.1, connectorPolish: 'SC_APC', notes: 'Online' },
      { portNumber: 7, status: 'RESERVED', customerName: 'Farhan Ali (Pending Onboarding)', subscriberId: 'CUST-NEW-91', address: 'House 90, Baradari', dropLengthMeters: 160, rxPowerDbm: -20.1, connectorPolish: 'SC_APC', notes: 'Scheduled for tomorrow' },
      { portNumber: 8, status: 'FAULTY', customerName: 'Connector Ferrule Defect', subscriberId: '', address: 'N/A', dropLengthMeters: 0, rxPowerDbm: -32.5, connectorPolish: 'SC_APC', notes: 'Needs adapter replacement' },
      { portNumber: 9, status: 'SPARE', customerName: '', subscriberId: '', address: '', dropLengthMeters: 0, rxPowerDbm: 0, connectorPolish: 'SC_APC', notes: 'Available for subscriber' },
      { portNumber: 10, status: 'SPARE', customerName: '', subscriberId: '', address: '', dropLengthMeters: 0, rxPowerDbm: 0, connectorPolish: 'SC_APC', notes: 'Available for subscriber' },
      { portNumber: 11, status: 'SPARE', customerName: '', subscriberId: '', address: '', dropLengthMeters: 0, rxPowerDbm: 0, connectorPolish: 'SC_APC', notes: 'Available for subscriber' },
      { portNumber: 12, status: 'SPARE', customerName: '', subscriberId: '', address: '', dropLengthMeters: 0, rxPowerDbm: 0, connectorPolish: 'SC_APC', notes: 'Available for subscriber' },
      { portNumber: 13, status: 'SPARE', customerName: '', subscriberId: '', address: '', dropLengthMeters: 0, rxPowerDbm: 0, connectorPolish: 'SC_APC', notes: 'Available for subscriber' },
      { portNumber: 14, status: 'SPARE', customerName: '', subscriberId: '', address: '', dropLengthMeters: 0, rxPowerDbm: 0, connectorPolish: 'SC_APC', notes: 'Available for subscriber' },
      { portNumber: 15, status: 'SPARE', customerName: '', subscriberId: '', address: '', dropLengthMeters: 0, rxPowerDbm: 0, connectorPolish: 'SC_APC', notes: 'Available for subscriber' },
      { portNumber: 16, status: 'SPARE', customerName: '', subscriberId: '', address: '', dropLengthMeters: 0, rxPowerDbm: 0, connectorPolish: 'SC_APC', notes: 'Available for subscriber' }
    ]
  },
  {
    id: 'FAT-VAN-04',
    name: 'Vandala Road Post Office Pole #09 (FAT-VAN-04)',
    area: 'Vandala Road',
    totalPorts: 8,
    splitterType: '1:8 PLC Cassette',
    feederCable: '12-Core Figure-8 Feeder Trunk',
    feederCore: 'Core 07 (Red)',
    poleNumber: 'POLE-VAN-009',
    gpsCoords: '31.6241, 74.2798',
    ports: [
      { portNumber: 1, status: 'ACTIVE', customerName: 'Zahid Hussain', subscriberId: 'CUST-1031', address: 'House 14, Near Post Office', dropLengthMeters: 70, rxPowerDbm: -17.4, connectorPolish: 'SC_APC', notes: 'Excellent power' },
      { portNumber: 2, status: 'ACTIVE', customerName: 'Noman Bashir', subscriberId: 'CUST-1049', address: 'St 2, Vandala Rd', dropLengthMeters: 130, rxPowerDbm: -18.2, connectorPolish: 'SC_APC', notes: 'Stable link' },
      { portNumber: 3, status: 'ACTIVE', customerName: 'Rashid Minhas', subscriberId: 'CUST-1064', address: 'House 28, Vandala', dropLengthMeters: 180, rxPowerDbm: -19.0, connectorPolish: 'SC_APC', notes: 'Fiber drop clamp secure' },
      { portNumber: 4, status: 'ACTIVE', customerName: 'Khurram Shehzad', subscriberId: 'CUST-1077', address: 'Shop 4, Vandala Chowk', dropLengthMeters: 45, rxPowerDbm: -17.1, connectorPolish: 'SC_APC', notes: 'Commercial line' },
      { portNumber: 5, status: 'ACTIVE', customerName: 'Saeed Anwar', subscriberId: 'CUST-1090', address: 'House 71, Back St', dropLengthMeters: 220, rxPowerDbm: -19.5, connectorPolish: 'SC_APC', notes: 'Long span' },
      { portNumber: 6, status: 'RESERVED', customerName: 'Shahid Mehmood (New Connection)', subscriberId: 'CUST-NEW-95', address: 'House 82, Vandala', dropLengthMeters: 115, rxPowerDbm: -18.0, connectorPolish: 'SC_APC', notes: 'Cable pulling done' },
      { portNumber: 7, status: 'SPARE', customerName: '', subscriberId: '', address: '', dropLengthMeters: 0, rxPowerDbm: 0, connectorPolish: 'SC_APC', notes: 'Spare drop port' },
      { portNumber: 8, status: 'SPARE', customerName: '', subscriberId: '', address: '', dropLengthMeters: 0, rxPowerDbm: 0, connectorPolish: 'SC_APC', notes: 'Spare drop port' }
    ]
  },
  {
    id: 'FAT-JIA-02',
    name: 'Jia Musa Main Market Pole #14 (FAT-JIA-02)',
    area: 'Jia Musa',
    totalPorts: 16,
    splitterType: '1:16 PLC Cassette',
    feederCable: '48-Core ADSS Feeder Trunk',
    feederCore: 'Core 02 (Orange)',
    poleNumber: 'POLE-JIA-014',
    gpsCoords: '31.6288, 74.2905',
    ports: [
      { portNumber: 1, status: 'ACTIVE', customerName: 'Imran Akram', subscriberId: 'CUST-1011', address: 'Shop 1, Jia Musa Market', dropLengthMeters: 40, rxPowerDbm: -18.1, connectorPolish: 'SC_APC', notes: 'Clean signal' },
      { portNumber: 2, status: 'ACTIVE', customerName: 'Faisal Jameel', subscriberId: 'CUST-1018', address: 'Shop 5, Main Bazar', dropLengthMeters: 60, rxPowerDbm: -18.4, connectorPolish: 'SC_APC', notes: 'Shop Wi-Fi' },
      { portNumber: 3, status: 'ACTIVE', customerName: 'Malik Sohail', subscriberId: 'CUST-1025', address: 'House 12, Jia Musa', dropLengthMeters: 110, rxPowerDbm: -19.0, connectorPolish: 'SC_APC', notes: 'Residential' },
      { portNumber: 4, status: 'ACTIVE', customerName: 'Qasim Ali', subscriberId: 'CUST-1039', address: 'House 34, Gali 1', dropLengthMeters: 135, rxPowerDbm: -19.4, connectorPolish: 'SC_APC', notes: 'Good' },
      { portNumber: 5, status: 'ACTIVE', customerName: 'Rana Waqas', subscriberId: 'CUST-1050', address: 'House 50, Jia Musa', dropLengthMeters: 90, rxPowerDbm: -18.8, connectorPolish: 'SC_APC', notes: 'Active' },
      { portNumber: 6, status: 'ACTIVE', customerName: 'Zubair Butt', subscriberId: 'CUST-1061', address: 'House 66, Gali 4', dropLengthMeters: 145, rxPowerDbm: -19.6, connectorPolish: 'SC_APC', notes: 'Active' },
      { portNumber: 7, status: 'ACTIVE', customerName: 'Hamid Raza', subscriberId: 'CUST-1072', address: 'House 80, St 5', dropLengthMeters: 170, rxPowerDbm: -20.0, connectorPolish: 'SC_APC', notes: 'Active' },
      { portNumber: 8, status: 'ACTIVE', customerName: 'Arshad Mehmood', subscriberId: 'CUST-1081', address: 'House 95, Main Rd', dropLengthMeters: 80, rxPowerDbm: -18.7, connectorPolish: 'SC_APC', notes: 'Active' },
      { portNumber: 9, status: 'ACTIVE', customerName: 'Waseem Akram', subscriberId: 'CUST-1094', address: 'House 102, Jia Musa', dropLengthMeters: 125, rxPowerDbm: -19.3, connectorPolish: 'SC_APC', notes: 'Active' },
      { portNumber: 10, status: 'ACTIVE', customerName: 'Naveed Akhtar', subscriberId: 'CUST-1108', address: 'Shop 18, Market', dropLengthMeters: 75, rxPowerDbm: -18.5, connectorPolish: 'SC_APC', notes: 'Active' },
      { portNumber: 11, status: 'ACTIVE', customerName: 'Muneeb Ur Rehman', subscriberId: 'CUST-1119', address: 'House 114, Gali 7', dropLengthMeters: 195, rxPowerDbm: -20.2, connectorPolish: 'SC_APC', notes: 'Active' },
      { portNumber: 12, status: 'ACTIVE', customerName: 'Shabbir Hussain', subscriberId: 'CUST-1130', address: 'House 125, Jia Musa', dropLengthMeters: 155, rxPowerDbm: -19.7, connectorPolish: 'SC_APC', notes: 'Active' },
      { portNumber: 13, status: 'ACTIVE', customerName: 'Iftikhar Ahmad', subscriberId: 'CUST-1141', address: 'House 139, St 8', dropLengthMeters: 210, rxPowerDbm: -20.4, connectorPolish: 'SC_APC', notes: 'Active' },
      { portNumber: 14, status: 'RESERVED', customerName: 'Sample Customer (Survey Approved)', subscriberId: 'CUST-NEW-98', address: 'House 150, Jia Musa', dropLengthMeters: 165, rxPowerDbm: -19.9, connectorPolish: 'SC_APC', notes: 'Awaiting ONT' },
      { portNumber: 15, status: 'FAULTY', customerName: 'Port Adapter Sleeve Broken', subscriberId: '', address: 'N/A', dropLengthMeters: 0, rxPowerDbm: -31.0, connectorPolish: 'SC_APC', notes: 'Dust cover off' },
      { portNumber: 16, status: 'SPARE', customerName: '', subscriberId: '', address: '', dropLengthMeters: 0, rxPowerDbm: 0, connectorPolish: 'SC_APC', notes: 'Last spare port' }
    ]
  },
  {
    id: 'FAT-BEG-07',
    name: 'Begum Kot Flyover East Pole #05 (FAT-BEG-07)',
    area: 'Begum Kot',
    totalPorts: 8,
    splitterType: '1:8 PLC Cassette',
    feederCable: '24-Core Aerial Feeder Trunk',
    feederCore: 'Core 11 (Rose)',
    poleNumber: 'POLE-BEG-005',
    gpsCoords: '31.6312, 74.2745',
    ports: [
      { portNumber: 1, status: 'ACTIVE', customerName: 'Kashif Mehmood', subscriberId: 'CUST-1033', address: 'House 5, Begum Kot', dropLengthMeters: 55, rxPowerDbm: -17.2, connectorPolish: 'SC_APC', notes: 'Prime signal' },
      { portNumber: 2, status: 'ACTIVE', customerName: 'Junaid Khan', subscriberId: 'CUST-1048', address: 'House 18, Flyover Rd', dropLengthMeters: 110, rxPowerDbm: -18.0, connectorPolish: 'SC_APC', notes: 'Good' },
      { portNumber: 3, status: 'ACTIVE', customerName: 'Tanveer Ahmad', subscriberId: 'CUST-1060', address: 'Shop 7, Service Rd', dropLengthMeters: 85, rxPowerDbm: -17.6, connectorPolish: 'SC_APC', notes: 'Good' },
      { portNumber: 4, status: 'ACTIVE', customerName: 'Sample Customer', subscriberId: 'CUST-1075', address: 'House 40, Begum Kot', dropLengthMeters: 160, rxPowerDbm: -18.8, connectorPolish: 'SC_APC', notes: 'Good' },
      { portNumber: 5, status: 'ACTIVE', customerName: 'Sikandar Hayat', subscriberId: 'CUST-1089', address: 'House 52, Gali 3', dropLengthMeters: 140, rxPowerDbm: -18.4, connectorPolish: 'SC_APC', notes: 'Good' },
      { portNumber: 6, status: 'ACTIVE', customerName: 'Amjad Farooq', subscriberId: 'CUST-1103', address: 'House 67, Begum Kot', dropLengthMeters: 195, rxPowerDbm: -19.2, connectorPolish: 'SC_APC', notes: 'Drop cable secured' },
      { portNumber: 7, status: 'SPARE', customerName: '', subscriberId: '', address: '', dropLengthMeters: 0, rxPowerDbm: 0, connectorPolish: 'SC_APC', notes: 'Available for install' },
      { portNumber: 8, status: 'SPARE', customerName: '', subscriberId: '', address: '', dropLengthMeters: 0, rxPowerDbm: 0, connectorPolish: 'SC_APC', notes: 'Available for install' }
    ]
  },
  {
    id: 'FAT-RAV-03',
    name: 'Ravi Siphon Road Tower Node Pole #21 (FAT-RAV-03)',
    area: 'Ravi Siphon',
    totalPorts: 16,
    splitterType: '1:16 PLC Cassette',
    feederCable: '24-Core ADSS Feeder Trunk',
    feederCore: 'Core 05 (Slate)',
    poleNumber: 'POLE-RAV-021',
    gpsCoords: '31.6420, 74.3015',
    ports: [
      { portNumber: 1, status: 'ACTIVE', customerName: 'Chaudhry Akram', subscriberId: 'CUST-1014', address: 'Farm 1, Ravi Siphon Rd', dropLengthMeters: 190, rxPowerDbm: -19.8, connectorPolish: 'SC_APC', notes: 'Long drop' },
      { portNumber: 2, status: 'ACTIVE', customerName: 'Liaquat Ali', subscriberId: 'CUST-1029', address: 'Tower Node Office', dropLengthMeters: 25, rxPowerDbm: -17.5, connectorPolish: 'SC_APC', notes: 'Base office' },
      { portNumber: 3, status: 'ACTIVE', customerName: 'Mehmood Ul Hassan', subscriberId: 'CUST-1044', address: 'House 9, Siphon Rd', dropLengthMeters: 145, rxPowerDbm: -19.3, connectorPolish: 'SC_APC', notes: 'Stable' },
      { portNumber: 4, status: 'ACTIVE', customerName: 'Adnan Sami', subscriberId: 'CUST-1058', address: 'Shop 3, Siphon Mor', dropLengthMeters: 80, rxPowerDbm: -18.2, connectorPolish: 'SC_APC', notes: 'Good' },
      { portNumber: 5, status: 'ACTIVE', customerName: 'Sohail Abbas', subscriberId: 'CUST-1070', address: 'House 22, Ravi Siphon', dropLengthMeters: 130, rxPowerDbm: -19.0, connectorPolish: 'SC_APC', notes: 'Good' },
      { portNumber: 6, status: 'ACTIVE', customerName: 'Ijaz Ahmad', subscriberId: 'CUST-1083', address: 'House 35, Riverside', dropLengthMeters: 215, rxPowerDbm: -20.2, connectorPolish: 'SC_APC', notes: 'Catenary clamps checked' },
      { portNumber: 7, status: 'ACTIVE', customerName: 'Waleed Khalid', subscriberId: 'CUST-1097', address: 'House 48, Siphon', dropLengthMeters: 165, rxPowerDbm: -19.5, connectorPolish: 'SC_APC', notes: 'Good' },
      { portNumber: 8, status: 'ACTIVE', customerName: 'Majid Khan', subscriberId: 'CUST-1111', address: 'House 61, Ravi Rd', dropLengthMeters: 110, rxPowerDbm: -18.7, connectorPolish: 'SC_APC', notes: 'Good' },
      { portNumber: 9, status: 'RESERVED', customerName: 'Zahid Mehmood (New Connection)', subscriberId: 'CUST-NEW-99', address: 'House 70, Siphon Rd', dropLengthMeters: 150, rxPowerDbm: -19.4, connectorPolish: 'SC_APC', notes: 'Deposit paid' },
      { portNumber: 10, status: 'RESERVED', customerName: 'Farrukh Shah (New Connection)', subscriberId: 'CUST-NEW-100', address: 'House 78, Siphon Rd', dropLengthMeters: 175, rxPowerDbm: -19.8, connectorPolish: 'SC_APC', notes: 'ONT allocated' },
      { portNumber: 11, status: 'FAULTY', customerName: 'Dirty Ferrule / Scratched Endface', subscriberId: '', address: 'N/A', dropLengthMeters: 0, rxPowerDbm: -30.5, connectorPolish: 'SC_APC', notes: 'Requires alcohol swab clean' },
      { portNumber: 12, status: 'SPARE', customerName: '', subscriberId: '', address: '', dropLengthMeters: 0, rxPowerDbm: 0, connectorPolish: 'SC_APC', notes: 'Spare drop port' },
      { portNumber: 13, status: 'SPARE', customerName: '', subscriberId: '', address: '', dropLengthMeters: 0, rxPowerDbm: 0, connectorPolish: 'SC_APC', notes: 'Spare drop port' },
      { portNumber: 14, status: 'SPARE', customerName: '', subscriberId: '', address: '', dropLengthMeters: 0, rxPowerDbm: 0, connectorPolish: 'SC_APC', notes: 'Spare drop port' },
      { portNumber: 15, status: 'SPARE', customerName: '', subscriberId: '', address: '', dropLengthMeters: 0, rxPowerDbm: 0, connectorPolish: 'SC_APC', notes: 'Spare drop port' },
      { portNumber: 16, status: 'SPARE', customerName: '', subscriberId: '', address: '', dropLengthMeters: 0, rxPowerDbm: 0, connectorPolish: 'SC_APC', notes: 'Spare drop port' }
    ]
  }
];

/**
 * Calculates port capacity summary metrics for a given FAT enclosure.
 * @param {Object} enclosure - FAT enclosure object with .ports array and .totalPorts.
 * @returns {Object} Capacity breakdown and utilization percentages.
 */
export function calculateFatCapacitySummary(enclosure) {
  if (!enclosure || !Array.isArray(enclosure.ports)) {
    return {
      totalPorts: 0,
      activePorts: 0,
      reservedPorts: 0,
      faultyPorts: 0,
      sparePorts: 0,
      utilizationPercent: 0,
      saturationStatus: 'NORMAL',
      saturationLabel: 'Unknown Enclosure'
    };
  }

  const totalPorts = enclosure.totalPorts || enclosure.ports.length;
  let activePorts = 0;
  let reservedPorts = 0;
  let faultyPorts = 0;
  let sparePorts = 0;

  for (const port of enclosure.ports) {
    const status = (port.status || 'SPARE').toUpperCase();
    if (status === 'ACTIVE') activePorts++;
    else if (status === 'RESERVED') reservedPorts++;
    else if (status === 'FAULTY') faultyPorts++;
    else sparePorts++;
  }

  const occupiedPorts = activePorts + reservedPorts;
  const utilizationPercent = totalPorts > 0 ? Math.round(((occupiedPorts) / totalPorts) * 1000) / 10 : 0;

  let saturationStatus = 'NORMAL';
  let saturationLabel = 'Normal Capacity';
  if (utilizationPercent >= 90) {
    saturationStatus = 'CRITICAL_FULL';
    saturationLabel = 'Nearly Saturated (Splitter Expansion Required)';
  } else if (utilizationPercent >= 70) {
    saturationStatus = 'HIGH';
    saturationLabel = 'High Utilization (Limited Spare Capacity)';
  }

  return {
    totalPorts,
    activePorts,
    reservedPorts,
    faultyPorts,
    sparePorts,
    occupiedPorts,
    utilizationPercent,
    saturationStatus,
    saturationLabel
  };
}

/**
 * Evaluates optical power reading against ITU-T G.984 Class B+ standard.
 * @param {number} rxDbm - Measured optical power at port adapter.
 * @returns {Object} Optical standard status and quality classification.
 */
export function evaluatePortOpticalHealth(rxDbm) {
  const val = Number(rxDbm);
  if (isNaN(val) || val === 0) {
    return OPTICAL_POWER_STANDARDS.NO_LIGHT;
  }
  if (val > -8.0) {
    return OPTICAL_POWER_STANDARDS.OVERLOAD;
  }
  if (val >= -24.0 && val <= -14.0) {
    return OPTICAL_POWER_STANDARDS.OPTIMAL;
  }
  if ((val >= -13.9 && val <= -8.0) || (val < -24.0 && val >= -27.0)) {
    return OPTICAL_POWER_STANDARDS.ACCEPTABLE;
  }
  if (val < -27.0 && val >= -28.5) {
    return OPTICAL_POWER_STANDARDS.MARGINAL;
  }
  return OPTICAL_POWER_STANDARDS.CRITICAL_LOW;
}

/**
 * Evaluates drop cable distance against standard outdoor FTTH limits.
 * @param {number} meters - Drop cable length in meters.
 * @returns {Object} Span rating, color and notes.
 */
export function evaluateDropCableSpan(meters) {
  const m = Number(meters) || 0;
  if (m <= DROP_SPAN_LIMITS.EXCELLENT.maxMeters) {
    return DROP_SPAN_LIMITS.EXCELLENT;
  }
  if (m <= DROP_SPAN_LIMITS.STANDARD.maxMeters) {
    return DROP_SPAN_LIMITS.STANDARD;
  }
  return DROP_SPAN_LIMITS.LONG_SPAN;
}

/**
 * Retrieves the FAT enclosures store from device localStorage or default seeds.
 * @param {Storage} [storage=localStorage]
 * @returns {Array} Array of FAT enclosure records.
 */
export function getFatAllocationsStore(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) {
    return JSON.parse(JSON.stringify(DEFAULT_SHAHDARA_FAT_ENCLOSURES));
  }
  try {
    const raw = storage.getItem(FDT_ALLOCATIONS_STORAGE_KEY);
    if (!raw) {
      const seeded = JSON.parse(JSON.stringify(DEFAULT_SHAHDARA_FAT_ENCLOSURES));
      storage.setItem(FDT_ALLOCATIONS_STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return JSON.parse(JSON.stringify(DEFAULT_SHAHDARA_FAT_ENCLOSURES));
    }
    return parsed;
  } catch (err) {
    return JSON.parse(JSON.stringify(DEFAULT_SHAHDARA_FAT_ENCLOSURES));
  }
}

/**
 * Saves FAT enclosures array to device localStorage.
 * @param {Array} enclosures - Array of FAT enclosure records.
 * @param {Storage} [storage=localStorage]
 * @returns {boolean} Success status.
 */
export function saveFatAllocationsStore(enclosures, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage || !Array.isArray(enclosures)) return false;
  try {
    storage.setItem(FDT_ALLOCATIONS_STORAGE_KEY, JSON.stringify(enclosures));
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Updates a specific port allocation inside an enclosure.
 * @param {string} enclosureId - ID of FAT (e.g. 'FAT-BAR-01')
 * @param {number} portNumber - 1-based port index
 * @param {Object} allocationData - Updated fields (customerName, subscriberId, status, rxPowerDbm, dropLengthMeters, etc.)
 * @param {Storage} [storage=localStorage]
 * @returns {Object|null} The updated enclosure, or null if not found.
 */
export function updatePortAllocation(enclosureId, portNumber, allocationData, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  const enclosures = getFatAllocationsStore(storage);
  const enc = enclosures.find(e => e.id === enclosureId);
  if (!enc) return null;

  const port = enc.ports.find(p => p.portNumber === Number(portNumber));
  if (!port) return null;

  if (allocationData.status !== undefined) port.status = allocationData.status;
  if (allocationData.customerName !== undefined) port.customerName = String(allocationData.customerName).trim();
  if (allocationData.subscriberId !== undefined) port.subscriberId = String(allocationData.subscriberId).trim();
  if (allocationData.address !== undefined) port.address = String(allocationData.address).trim();
  if (allocationData.dropLengthMeters !== undefined) port.dropLengthMeters = Number(allocationData.dropLengthMeters) || 0;
  if (allocationData.rxPowerDbm !== undefined) port.rxPowerDbm = Number(allocationData.rxPowerDbm) || 0;
  if (allocationData.connectorPolish !== undefined) port.connectorPolish = allocationData.connectorPolish;
  if (allocationData.notes !== undefined) port.notes = String(allocationData.notes).trim();
  port.updatedAt = new Date().toISOString();

  saveFatAllocationsStore(enclosures, storage);
  return enc;
}

/**
 * Resets a port back to SPARE status, clearing customer information.
 * @param {string} enclosureId - ID of FAT
 * @param {number} portNumber - Port number
 * @param {Storage} [storage=localStorage]
 * @returns {Object|null}
 */
export function resetPortToSpare(enclosureId, portNumber, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  return updatePortAllocation(enclosureId, portNumber, {
    status: 'SPARE',
    customerName: '',
    subscriberId: '',
    address: '',
    dropLengthMeters: 0,
    rxPowerDbm: 0,
    notes: 'Reset to spare capacity'
  }, storage);
}

/**
 * Resets the entire store back to default seed enclosures.
 * @param {Storage} [storage=localStorage]
 * @returns {Array} Reset enclosures.
 */
export function resetFatStoreToDefault(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  const seeded = JSON.parse(JSON.stringify(DEFAULT_SHAHDARA_FAT_ENCLOSURES));
  if (storage) {
    try {
      storage.setItem(FDT_ALLOCATIONS_STORAGE_KEY, JSON.stringify(seeded));
    } catch (err) {}
  }
  return seeded;
}

/**
 * Generates an outdoor IP65 FAT enclosure vector diagram SVG.
 * Shows feeder fiber entry, PLC splitter cassette, individual SC/APC port adapters with status LEDs,
 * and live capacity utilization bar.
 *
 * @param {Object} enclosure - Enclosure data.
 * @param {number} [selectedPortNumber=1] - Currently highlighted port number.
 * @returns {string} Safe SVG markup string.
 */
export function renderMobileFdtMatrixSvg(enclosure, selectedPortNumber = 1) {
  if (!enclosure) return '<svg viewBox="0 0 720 380" class="fdt-svg-empty"><text x="360" y="190" text-anchor="middle" fill="#94a3b8">No Enclosure Selected</text></svg>';

  const capacity = calculateFatCapacitySummary(enclosure);
  const ports = enclosure.ports || [];
  const total = enclosure.totalPorts || ports.length;
  const is16Port = total >= 16;

  const cols = is16Port ? 8 : 4;
  const rows = Math.ceil(total / cols);

  // Layout bounds inside enclosure chamber
  const startX = 65;
  const startY = 160;
  const portW = 68;
  const portH = 68;
  const gapX = 10;
  const gapY = 14;

  let portsSvg = '';
  for (let i = 0; i < ports.length; i++) {
    const p = ports[i];
    const colIdx = i % cols;
    const rowIdx = Math.floor(i / cols);
    const px = startX + colIdx * (portW + gapX);
    const py = startY + rowIdx * (portH + gapY);

    const isSelected = p.portNumber === Number(selectedPortNumber);
    const statusMeta = PORT_STATUSES[p.status] || PORT_STATUSES.SPARE;
    const isApc = (p.connectorPolish || 'SC_APC') === 'SC_APC';
    const adapterColor = isApc ? '#15803d' : '#1d4ed8'; // Green SC/APC vs Blue SC/UPC

    const portBorder = isSelected ? '#38bdf8' : (p.status === 'FAULTY' ? '#ef4444' : '#475569');
    const portStrokeWidth = isSelected ? '2.5' : '1.5';
    const ledColor = statusMeta.color;

    const optHealth = p.status === 'ACTIVE' && p.rxPowerDbm ? evaluatePortOpticalHealth(p.rxPowerDbm) : null;
    const optLabel = p.status === 'ACTIVE' && p.rxPowerDbm ? `${p.rxPowerDbm} dBm` : (p.status === 'SPARE' ? 'SPARE' : p.status);

    const displayName = p.customerName ? (p.customerName.length > 8 ? p.customerName.slice(0, 7) + '…' : p.customerName) : '';

    portsSvg += `
      <!-- Port ${p.portNumber} -->
      <g class="fdt-port-node ${isSelected ? 'is-selected' : ''}" data-port="${p.portNumber}" cursor="pointer">
        <!-- Port Adapter Housing -->
        <rect x="${px}" y="${py}" width="${portW}" height="${portH}" rx="6" fill="#1e293b" stroke="${portBorder}" stroke-width="${portStrokeWidth}" />
        
        <!-- SC Optical Adapter Jack (Centered) -->
        <rect x="${px + 14}" y="${py + 10}" width="40" height="24" rx="3" fill="${adapterColor}" stroke="#0f172a" stroke-width="1" />
        <rect x="${px + 24}" y="${py + 14}" width="20" height="16" rx="2" fill="#0f172a" />
        <!-- Alignment Ceramic Sleeve (Gold/Bronze Core) -->
        <circle cx="${px + 34}" cy="${py + 22}" r="4" fill="#fbbf24" />
        <circle cx="${px + 34}" cy="${py + 22}" r="1.5" fill="#0f172a" />

        <!-- Port Number Label -->
        <rect x="${px + 4}" y="${py + 4}" width="18" height="14" rx="3" fill="#0f172a" opacity="0.8" />
        <text x="${px + 13}" y="${py + 14}" fill="#f8fafc" font-size="9" font-weight="700" text-anchor="middle" font-family="monospace">P${p.portNumber}</text>

        <!-- Status LED Indicator -->
        <circle cx="${px + 58}" cy="${py + 11}" r="4" fill="${ledColor}" />
        <circle cx="${px + 58}" cy="${py + 11}" r="6" fill="none" stroke="${ledColor}" stroke-width="1" opacity="0.6" />

        <!-- Port Subtext: Customer Name / Status -->
        <text x="${px + 34}" y="${py + 46}" fill="#cbd5e1" font-size="8.5" font-weight="600" text-anchor="middle" font-family="system-ui, sans-serif">${displayName || statusMeta.label.split(' ')[0]}</text>
        
        <!-- Optical Power / Detail -->
        <text x="${px + 34}" y="${py + 58}" fill="${optHealth ? optHealth.color : '#94a3b8'}" font-size="8" font-family="monospace" text-anchor="middle">${optLabel}</text>
      </g>
    `;
  }

  // Capacity Gauge Fill
  const barW = 200;
  const fillW = Math.max(4, Math.min(barW, Math.round((capacity.utilizationPercent / 100) * barW)));
  const barColor = capacity.saturationStatus === 'CRITICAL_FULL' ? '#ef4444' : (capacity.saturationStatus === 'HIGH' ? '#f59e0b' : '#10b981');

  return `
    <svg viewBox="0 0 720 380" class="fdt-enclosure-svg" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="FAT Optical Enclosure Matrix">
      <defs>
        <linearGradient id="fatCasingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0f172a" />
          <stop offset="100%" stop-color="#1e293b" />
        </linearGradient>
        <linearGradient id="splitterGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#334155" />
          <stop offset="100%" stop-color="#475569" />
        </linearGradient>
        <filter id="fatGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      <!-- Outdoor Enclosure Outer IP65 Waterproof Shell -->
      <rect x="20" y="15" width="680" height="345" rx="16" fill="url(#fatCasingGrad)" stroke="#334155" stroke-width="3" />
      
      <!-- Weatherproof Rubber Gasket Inset -->
      <rect x="28" y="23" width="664" height="329" rx="12" fill="none" stroke="#475569" stroke-dasharray="8 4" stroke-width="1.5" />
      
      <!-- Top Cable Glands & Splice Tray Header -->
      <g class="fdt-enclosure-header">
        <!-- Inbound Feeder Fiber Gland (Left) -->
        <rect x="45" y="32" width="130" height="32" rx="6" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5" />
        <circle cx="58" cy="48" r="6" fill="#3b82f6" />
        <text x="70" y="52" fill="#93c5fd" font-size="10" font-weight="700" font-family="system-ui, sans-serif">INBOUND FEEDER</text>
        <text x="45" y="76" fill="#64748b" font-size="8.5" font-family="monospace">${enclosure.feederCore || 'Feeder Core'}</text>

        <!-- Internal PLC Splitter Module Cassette (Center) -->
        <rect x="210" y="32" width="230" height="34" rx="6" fill="url(#splitterGrad)" stroke="#64748b" stroke-width="1.5" />
        <text x="325" y="47" fill="#f8fafc" font-size="11" font-weight="700" text-anchor="middle" font-family="system-ui, sans-serif">${enclosure.splitterType || 'PLC Optical Splitter'}</text>
        <text x="325" y="60" fill="#cbd5e1" font-size="9" text-anchor="middle" font-family="monospace">1 Inbound Core ➔ ${total} Port Outputs</text>

        <!-- Enclosure Details & Capacity Gauge (Right) -->
        <rect x="475" y="30" width="210" height="78" rx="8" fill="#0f172a" stroke="#334155" stroke-width="1" />
        <text x="485" y="46" fill="#f8fafc" font-size="10.5" font-weight="700" font-family="system-ui, sans-serif">${enclosure.id}</text>
        <text x="485" y="58" fill="#94a3b8" font-size="8.5" font-family="system-ui, sans-serif">${enclosure.poleNumber || 'Pole'} • ${enclosure.area || 'Shahdara'}</text>
        
        <!-- Utilization Bar -->
        <rect x="485" y="68" width="${barW}" height="10" rx="5" fill="#334155" />
        <rect x="485" y="68" width="${fillW}" height="10" rx="5" fill="${barColor}" />
        <text x="485" y="94" fill="#cbd5e1" font-size="9" font-family="monospace">${capacity.occupiedPorts}/${total} Ports (${capacity.utilizationPercent}%)</text>
        <circle cx="670" cy="91" r="5" fill="${barColor}" />
      </g>

      <!-- Interior Fiber Routing Fiber Guide Tray -->
      <path d="M 110,64 C 110,110 325,85 325,120" fill="none" stroke="#3b82f6" stroke-width="2" stroke-dasharray="4 2" opacity="0.7" />
      <path d="M 325,66 C 325,110 100,120 100,150" fill="none" stroke="#10b981" stroke-width="1.5" opacity="0.5" />
      <path d="M 325,66 C 325,110 360,120 360,150" fill="none" stroke="#10b981" stroke-width="1.5" opacity="0.5" />
      <path d="M 325,66 C 325,110 610,120 610,150" fill="none" stroke="#10b981" stroke-width="1.5" opacity="0.5" />

      <!-- Adapter Ports Grid -->
      <g class="fdt-ports-chamber">
        ${portsSvg}
      </g>

      <!-- Bottom Outbound Drop Cable Entry Glands & Legend -->
      <g class="fdt-enclosure-footer">
        <line x1="45" y1="335" x2="675" y2="335" stroke="#334155" stroke-width="1" />
        <circle cx="55" cy="348" r="4" fill="#10b981" />
        <text x="65" y="352" fill="#94a3b8" font-size="9" font-family="system-ui, sans-serif">Active (${capacity.activePorts})</text>

        <circle cx="155" cy="348" r="4" fill="#f59e0b" />
        <text x="165" y="352" fill="#94a3b8" font-size="9" font-family="system-ui, sans-serif">Reserved (${capacity.reservedPorts})</text>

        <circle cx="270" cy="348" r="4" fill="#ef4444" />
        <text x="280" y="352" fill="#94a3b8" font-size="9" font-family="system-ui, sans-serif">Faulty (${capacity.faultyPorts})</text>

        <circle cx="375" cy="348" r="4" fill="#94a3b8" />
        <text x="385" y="352" fill="#94a3b8" font-size="9" font-family="system-ui, sans-serif">Spare (${capacity.sparePorts})</text>

        <rect x="480" y="343" width="10" height="10" rx="2" fill="#15803d" />
        <text x="495" y="352" fill="#94a3b8" font-size="9" font-family="system-ui, sans-serif">SC/APC Green</text>

        <rect x="585" y="343" width="10" height="10" rx="2" fill="#2563eb" />
        <text x="600" y="352" fill="#94a3b8" font-size="9" font-family="system-ui, sans-serif">SC/UPC Blue</text>
      </g>
    </svg>
  `;
}

/**
 * Generates formatted WhatsApp field lineman dispatch report for FAT port allocation.
 * @param {Object} enclosure - Enclosure object.
 * @param {number} portNumber - Port number.
 * @param {Object} [meta={}] - Optional metadata (linemanName, orderTicket).
 * @returns {string} Text dispatch report.
 */
export function generateFdtAllocationWhatsAppReport(enclosure, portNumber, meta = {}) {
  if (!enclosure) return '';
  const port = (enclosure.ports || []).find(p => p.portNumber === Number(portNumber)) || {};
  const capacity = calculateFatCapacitySummary(enclosure);
  const opticalHealth = evaluatePortOpticalHealth(port.rxPowerDbm);
  const spanRating = evaluateDropCableSpan(port.dropLengthMeters);

  const lines = [
    `*⚡ SHAHDARA FIBER NET - FAT PORT DISPATCH REPORT*`,
    `----------------------------------------`,
    `*FAT Enclosure:* ${enclosure.id} (${enclosure.name || ''})`,
    `*Area & Pole:* ${enclosure.area || ''} • Pole ${enclosure.poleNumber || 'N/A'}`,
    `*GPS Location:* ${enclosure.gpsCoords || 'Shahdara, Lahore'}`,
    `*Feeder Core:* ${enclosure.feederCore || 'Feeder Trunk'} (${enclosure.splitterType || '1:16 PLC'})`,
    `----------------------------------------`,
    `*PORT ALLOCATION DETAILS:*`,
    `*Port Number:* Port #${port.portNumber || portNumber} [${port.connectorPolish || 'SC_APC'}]`,
    `*Current Status:* ${port.status || 'SPARE'}`,
    `*Subscriber Name:* ${port.customerName || 'None (Spare Port)'}`,
    `*Subscriber ID:* ${port.subscriberId || 'N/A'}`,
    `*Address:* ${port.address || 'N/A'}`,
    `*Drop Cable Length:* ${port.dropLengthMeters || 0} meters (${spanRating.label})`,
    `*Measured Optical RX:* ${port.rxPowerDbm || 0} dBm (${opticalHealth.label})`,
    `*Notes / Condition:* ${port.notes || 'Normal'}`,
    `----------------------------------------`,
    `*ENCLOSURE CAPACITY STATUS:*`,
    `*Total Ports:* ${capacity.totalPorts} | *Active:* ${capacity.activePorts} | *Reserved:* ${capacity.reservedPorts}`,
    `*Spare Ports Available:* ${capacity.sparePorts} | *Faulty:* ${capacity.faultyPorts}`,
    `*Utilization Rate:* ${capacity.utilizationPercent}% (${capacity.saturationLabel})`,
    `----------------------------------------`,
    `*Lineman Field Action:*`,
    port.status === 'FAULTY'
      ? `🚨 INSPECT CONNECTOR FERRULE WITH FIBER CLEANING PEN & CASSETTE CLEANER.`
      : (port.status === 'RESERVED'
        ? `🔧 PROCEED WITH DROP CABLE TERMINATION & ONU PROVISIONING.`
        : (port.status === 'SPARE'
          ? `✅ PORT READY FOR NEW CUSTOMER ONBOARDING.`
          : `📶 SUBSCRIBER ACTIVE. VERIFY DROP TENSION CLAMPS.`)),
    `_Generated by Shahdara Mobile Tech Assistant • ${new Date().toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })}_`
  ];

  return lines.join('\n');
}

/**
 * Sets up the mobile FAT port allocation modal dialog, controls, and event listeners.
 * @param {Object} options
 * @param {Storage} [options.storage] - LocalStorage instance
 * @param {Function} [options.onToast] - Toast notification callback
 * @returns {Object} Controller with updateView, selectPort, and getEnclosures methods.
 */
export function setupMobileFdtAllocationModal({ storage = (typeof localStorage !== 'undefined' ? localStorage : null), onToast } = {}) {
  if (typeof document === 'undefined') return { updateView: () => {}, selectPort: () => {} };

  const modal = document.getElementById('mobileFdtAllocationModal');
  const closeBtn = document.getElementById('mobileFdtAllocationCloseBtn');
  const enclosureSelect = document.getElementById('fdtEnclosureSelect');
  const svgContainer = document.getElementById('fdtEnclosureSvgContainer');
  const metricsBar = document.getElementById('fdtMetricsBar');
  
  // Port Edit Form Fields
  const formSection = document.getElementById('fdtPortEditForm');
  const portNumSpan = document.getElementById('fdtEditPortNumber');
  const portStatusSelect = document.getElementById('fdtEditStatus');
  const custNameInput = document.getElementById('fdtEditCustomerName');
  const custIdInput = document.getElementById('fdtEditSubscriberId');
  const custAddressInput = document.getElementById('fdtEditAddress');
  const dropLengthInput = document.getElementById('fdtEditDropLength');
  const rxPowerInput = document.getElementById('fdtEditRxPower');
  const polishSelect = document.getElementById('fdtEditPolish');
  const notesInput = document.getElementById('fdtEditNotes');

  // Action Buttons
  const savePortBtn = document.getElementById('fdtSavePortBtn');
  const resetSpareBtn = document.getElementById('fdtResetSpareBtn');
  const whatsappBtn = document.getElementById('fdtWhatsappReportBtn');
  const resetStoreBtn = document.getElementById('fdtResetDefaultStoreBtn');

  // Multi-surface trigger buttons
  const triggers = document.querySelectorAll('[data-open-fdt-allocation]');

  let activeEnclosureId = 'FAT-BAR-01';
  let activePortNumber = 1;

  function getEnclosures() {
    return getFatAllocationsStore(storage);
  }

  function getActiveEnclosure() {
    const list = getEnclosures();
    return list.find(e => e.id === activeEnclosureId) || list[0] || null;
  }

  function populateEnclosureSelect() {
    if (!enclosureSelect) return;
    const list = getEnclosures();
    enclosureSelect.innerHTML = '';
    list.forEach(enc => {
      const opt = document.createElement('option');
      opt.value = enc.id;
      opt.textContent = `${enc.id} - ${enc.area} (${enc.totalPorts} Ports)`;
      if (enc.id === activeEnclosureId) opt.selected = true;
      enclosureSelect.appendChild(opt);
    });
  }

  function renderMetrics(enclosure) {
    if (!metricsBar || !enclosure) return;
    const cap = calculateFatCapacitySummary(enclosure);
    metricsBar.innerHTML = `
      <div class="fdt-metric-pill"><span class="label">Total Ports:</span> <strong>${cap.totalPorts}</strong></div>
      <div class="fdt-metric-pill pill-active"><span class="label">Active:</span> <strong>${cap.activePorts}</strong></div>
      <div class="fdt-metric-pill pill-reserved"><span class="label">Reserved:</span> <strong>${cap.reservedPorts}</strong></div>
      <div class="fdt-metric-pill pill-faulty"><span class="label">Faulty:</span> <strong>${cap.faultyPorts}</strong></div>
      <div class="fdt-metric-pill pill-spare"><span class="label">Spare:</span> <strong>${cap.sparePorts}</strong></div>
      <div class="fdt-metric-pill pill-util"><span class="label">Utilization:</span> <strong>${cap.utilizationPercent}%</strong></div>
    `;
  }

  function renderForm(port) {
    if (!formSection) return;
    if (!port) {
      if (portNumSpan) portNumSpan.textContent = '-';
      return;
    }
    if (portNumSpan) portNumSpan.textContent = `Port #${port.portNumber}`;
    if (portStatusSelect) portStatusSelect.value = port.status || 'SPARE';
    if (custNameInput) custNameInput.value = port.customerName || '';
    if (custIdInput) custIdInput.value = port.subscriberId || '';
    if (custAddressInput) custAddressInput.value = port.address || '';
    if (dropLengthInput) dropLengthInput.value = port.dropLengthMeters || 0;
    if (rxPowerInput) rxPowerInput.value = port.rxPowerDbm || 0;
    if (polishSelect) polishSelect.value = port.connectorPolish || 'SC_APC';
    if (notesInput) notesInput.value = port.notes || '';
  }

  function renderSvg() {
    if (!svgContainer) return;
    const enc = getActiveEnclosure();
    if (!enc) return;
    svgContainer.innerHTML = renderMobileFdtMatrixSvg(enc, activePortNumber);

    // Attach click listeners to port SVG nodes
    const portNodes = svgContainer.querySelectorAll('.fdt-port-node');
    portNodes.forEach(node => {
      node.addEventListener('click', () => {
        const pNum = Number(node.getAttribute('data-port'));
        if (pNum) {
          selectPort(pNum);
        }
      });
    });
  }

  function selectPort(portNumber) {
    activePortNumber = Number(portNumber);
    const enc = getActiveEnclosure();
    if (!enc) return;
    const port = (enc.ports || []).find(p => p.portNumber === activePortNumber);
    renderSvg();
    renderForm(port);
  }

  function updateView() {
    populateEnclosureSelect();
    const enc = getActiveEnclosure();
    if (!enc) return;
    renderMetrics(enc);
    renderSvg();
    const port = (enc.ports || []).find(p => p.portNumber === activePortNumber);
    renderForm(port);
  }

  // Event Listeners
  if (enclosureSelect) {
    enclosureSelect.addEventListener('change', (e) => {
      activeEnclosureId = e.target.value;
      activePortNumber = 1;
      updateView();
      if (typeof onToast === 'function') onToast(`FAT Enclosure switched to ${activeEnclosureId}`);
    });
  }

  if (savePortBtn) {
    savePortBtn.addEventListener('click', () => {
      const enc = getActiveEnclosure();
      if (!enc) return;
      const updated = updatePortAllocation(enc.id, activePortNumber, {
        status: portStatusSelect ? portStatusSelect.value : 'ACTIVE',
        customerName: custNameInput ? custNameInput.value : '',
        subscriberId: custIdInput ? custIdInput.value : '',
        address: custAddressInput ? custAddressInput.value : '',
        dropLengthMeters: dropLengthInput ? Number(dropLengthInput.value) : 0,
        rxPowerDbm: rxPowerInput ? Number(rxPowerInput.value) : 0,
        connectorPolish: polishSelect ? polishSelect.value : 'SC_APC',
        notes: notesInput ? notesInput.value : ''
      }, storage);

      if (updated) {
        updateView();
        if (typeof onToast === 'function') onToast(`Port #${activePortNumber} allocation saved on ${enc.id}.`);
      }
    });
  }

  if (resetSpareBtn) {
    resetSpareBtn.addEventListener('click', () => {
      const enc = getActiveEnclosure();
      if (!enc) return;
      resetPortToSpare(enc.id, activePortNumber, storage);
      updateView();
      if (typeof onToast === 'function') onToast(`Port #${activePortNumber} reset to SPARE on ${enc.id}.`);
    });
  }

  if (whatsappBtn) {
    whatsappBtn.addEventListener('click', () => {
      const enc = getActiveEnclosure();
      if (!enc) return;
      const text = generateFdtAllocationWhatsAppReport(enc, activePortNumber);
      const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
      if (typeof window !== 'undefined') {
        window.open(url, '_blank');
      }
      if (typeof onToast === 'function') onToast('WhatsApp FAT dispatch opened.');
    });
  }

  if (resetStoreBtn) {
    resetStoreBtn.addEventListener('click', () => {
      resetFatStoreToDefault(storage);
      updateView();
      if (typeof onToast === 'function') onToast('All FAT enclosures reset to default Shahdara layout.');
    });
  }

  // Multi-surface modal open triggers
  triggers.forEach(btn => {
    btn.addEventListener('click', () => {
      updateView();
      if (modal) {
        if (typeof modal.showModal === 'function') modal.showModal();
        else modal.setAttribute('open', '');
      }
    });
  });

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => {
      if (typeof modal.close === 'function') modal.close();
      else modal.removeAttribute('open');
    });
  }

  // Initial render
  updateView();

  return {
    updateView,
    selectPort,
    getEnclosures,
    getActiveEnclosure
  };
}
