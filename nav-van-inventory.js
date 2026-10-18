import { formatPKR } from './core.js';
import { triggerHaptic } from './nav.js';

/**
 * Technician Vehicle Inventory Quick-Transfer Dialog & Mobile Stock Transfer Drawer
 * Manages mobile rolling stock carried on technician vans and response bikes
 * (ONUs, drop cable coils, patch cords, splitters, fast connectors), supporting
 * warehouse-to-van checkouts and road-side inter-technician stock transfers.
 */

export const VEHICLE_STORAGE_KEY = 'shahdara_tech_vehicle_inventory_v1';

export const SHAHDARA_VEHICLE_FLEET = [
  {
    id: 'warehouse',
    name: 'Central Shahdara Base Depot',
    code: 'WH-MAIN',
    type: 'depot',
    technician: 'Bilal Ahmad (Depot Master)',
    primarySector: 'Railway Station Yard',
    licensePlate: 'WH-01-LHR',
    icon: 'depot'
  },
  {
    id: 'van-01',
    name: 'Van 1 - Tariq Fiber Splicing Unit',
    code: 'VAN-01',
    type: 'van',
    technician: 'Tariq Mehmood & Asif',
    primarySector: 'Vandala Road & Zia Town',
    licensePlate: 'LEB-24-4112',
    icon: 'van'
  },
  {
    id: 'van-02',
    name: 'Van 2 - Riverfront & Baradari Dispatch',
    code: 'VAN-02',
    type: 'van',
    technician: 'Khurram Shehzad',
    primarySector: 'Baradari Road & Ravi Pier',
    licensePlate: 'LEA-23-8871',
    icon: 'van'
  },
  {
    id: 'bike-saad',
    name: 'Bike 3 - Saad Quick Response Unit',
    code: 'BIKE-03',
    type: 'bike',
    technician: 'Saad Khan',
    primarySector: 'Shahdara Town & Old Town',
    licensePlate: 'LEM-22-6019',
    icon: 'bike'
  },
  {
    id: 'van-04',
    name: 'Van 4 - Farhan Installation Truck',
    code: 'VAN-04',
    type: 'van',
    technician: 'Farhan Ali & Imran',
    primarySector: 'Saeed Park & Jia Musa',
    licensePlate: 'LEC-24-1904',
    icon: 'van'
  }
];

export const SHAHDARA_STANDARD_HARDWARE = [
  {
    id: 'onu-gpon',
    name: 'Huawei EchoLife HG8310M GPON ONU',
    sku: 'ONT-GPON-01',
    category: 'CPE Hardware',
    unit: 'pcs',
    minSafeStock: 4,
    defaultVanQty: 6,
    unitValuePkr: 2800
  },
  {
    id: 'onu-xpon-wifi',
    name: 'ZTE F670L Dual-Band XPON ONU',
    sku: 'ONT-XPON-02',
    category: 'CPE Hardware',
    unit: 'pcs',
    minSafeStock: 2,
    defaultVanQty: 3,
    unitValuePkr: 5200
  },
  {
    id: 'drop-cable-roll',
    name: '1-Core FTTH Drop Cable Bow-Type (1000m Reel)',
    sku: 'CAB-DROP-1C',
    category: 'Optical Cable',
    unit: 'meters',
    minSafeStock: 300,
    defaultVanQty: 500,
    unitValuePkr: 18
  },
  {
    id: 'patch-cord-sc-apc-3m',
    name: 'SC/APC to SC/APC Simplex Patch Cord 3m',
    sku: 'COR-SC-3M',
    category: 'Optical Patching',
    unit: 'pcs',
    minSafeStock: 10,
    defaultVanQty: 18,
    unitValuePkr: 220
  },
  {
    id: 'fast-connector-sc-apc',
    name: 'SC/APC Pre-Embedded Fast Assembly Connector',
    sku: 'CON-FAST-APC',
    category: 'Consumables',
    unit: 'pcs',
    minSafeStock: 25,
    defaultVanQty: 40,
    unitValuePkr: 85
  },
  {
    id: 'splitter-plc-1-8',
    name: 'Mini Steel Tube 1:8 PLC Optical Splitter',
    sku: 'SPL-1-8-ST',
    category: 'Passive OSP',
    unit: 'pcs',
    minSafeStock: 3,
    defaultVanQty: 5,
    unitValuePkr: 650
  },
  {
    id: 'splice-protection-sleeves',
    name: 'Heat Shrink Fusion Splice Sleeves 60mm',
    sku: 'SLV-HS-60',
    category: 'Consumables',
    unit: 'pcs',
    minSafeStock: 50,
    defaultVanQty: 80,
    unitValuePkr: 8
  }
];

function escapeXml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
}

/**
 * Loads the technician vehicle inventory store from local storage.
 */
export function getVehicleInventoryStore(storage = null) {
  const storeApi = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!storeApi) {
    return { transfers: [], vehicleStockOverrides: {} };
  }

  try {
    const raw = storeApi.getItem(VEHICLE_STORAGE_KEY);
    if (!raw) return { transfers: [], vehicleStockOverrides: {} };
    const parsed = JSON.parse(raw);
    return {
      transfers: Array.isArray(parsed?.transfers) ? parsed.transfers : [],
      vehicleStockOverrides: (parsed?.vehicleStockOverrides && typeof parsed.vehicleStockOverrides === 'object')
        ? parsed.vehicleStockOverrides
        : {}
    };
  } catch {
    return { transfers: [], vehicleStockOverrides: {} };
  }
}

/**
 * Persists vehicle inventory data into local storage.
 */
export function saveVehicleInventoryStore(store, storage = null) {
  const storeApi = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!storeApi) return false;

  try {
    storeApi.setItem(VEHICLE_STORAGE_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

/**
 * Records a vehicle-to-vehicle or warehouse-to-vehicle stock transfer.
 */
export function recordVehicleTransfer(transferInput, storage = null) {
  const store = getVehicleInventoryStore(storage);
  const now = new Date();
  const id = `txf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  const transfer = {
    id,
    timestamp: transferInput.timestamp || now.toISOString(),
    sourceVehicleId: transferInput.sourceVehicleId || 'warehouse',
    destVehicleId: transferInput.destVehicleId || 'van-01',
    itemId: transferInput.itemId || 'onu-gpon',
    quantity: Math.max(1, Number(transferInput.quantity) || 1),
    transferNote: String(transferInput.transferNote || '').trim(),
    authorizedBy: String(transferInput.authorizedBy || 'Duty Dispatcher').trim()
  };

  store.transfers.unshift(transfer);
  // Cap history at 100 entries
  if (store.transfers.length > 100) store.transfers = store.transfers.slice(0, 100);

  // Update in-memory overrides
  const overrides = store.vehicleStockOverrides;
  const sKey = `${transfer.sourceVehicleId}_${transfer.itemId}`;
  const dKey = `${transfer.destVehicleId}_${transfer.itemId}`;

  if (transfer.sourceVehicleId !== 'warehouse') {
    const curSrc = Number(overrides[sKey] ?? getBaseQuantity(transfer.sourceVehicleId, transfer.itemId));
    overrides[sKey] = Math.max(0, curSrc - transfer.quantity);
  }

  const curDest = Number(overrides[dKey] ?? getBaseQuantity(transfer.destVehicleId, transfer.itemId));
  overrides[dKey] = curDest + transfer.quantity;

  saveVehicleInventoryStore(store, storage);
  return transfer;
}

function getBaseQuantity(vehicleId, itemId) {
  if (vehicleId === 'warehouse') return 1000;
  const item = SHAHDARA_STANDARD_HARDWARE.find(h => h.id === itemId);
  if (!item) return 10;
  if (vehicleId === 'bike-saad') {
    return Math.max(1, Math.round(item.defaultVanQty * 0.4));
  }
  return item.defaultVanQty;
}

/**
 * Calculates current on-vehicle inventory levels, valuation, and low-stock warnings.
 */
export function calculateVehicleStock(state, vehicleId = 'van-01', storage = null) {
  const store = getVehicleInventoryStore(storage);
  const vehicle = SHAHDARA_VEHICLE_FLEET.find(v => v.id === vehicleId) || SHAHDARA_VEHICLE_FLEET[1];

  let totalItemsCount = 0;
  let totalValuePkr = 0;
  let lowStockCount = 0;
  let depletedCount = 0;

  const stockRows = SHAHDARA_STANDARD_HARDWARE.map(hardware => {
    const overrideKey = `${vehicle.id}_${hardware.id}`;
    let onHand = store.vehicleStockOverrides[overrideKey];
    if (onHand === undefined || onHand === null) {
      onHand = getBaseQuantity(vehicle.id, hardware.id);
    }
    onHand = Number(onHand) || 0;

    const minSafe = vehicle.id === 'bike-saad'
      ? Math.max(1, Math.round(hardware.minSafeStock * 0.5))
      : hardware.minSafeStock;

    let itemStatus = 'optimal';
    if (onHand === 0) {
      itemStatus = 'depleted';
      depletedCount++;
    } else if (onHand < minSafe) {
      itemStatus = 'low-stock';
      lowStockCount++;
    }

    const itemValue = onHand * hardware.unitValuePkr;
    totalItemsCount += onHand;
    totalValuePkr += itemValue;

    return {
      hardware,
      onHand,
      minSafe,
      itemStatus,
      itemValue,
      fillRatio: minSafe > 0 ? Math.min(2.0, Math.round((onHand / minSafe) * 100) / 100) : 1
    };
  });

  let vehicleStatus = 'optimal';
  let badgeClass = 'badge-success';
  let statusLabel = 'Well Stocked';

  if (depletedCount > 0) {
    vehicleStatus = 'depleted';
    badgeClass = 'badge-danger';
    statusLabel = 'Critical Stock Depleted';
  } else if (lowStockCount > 0) {
    vehicleStatus = 'low-stock';
    badgeClass = 'badge-warning';
    statusLabel = 'Restock Recommended';
  }

  // Filter transfers involving this vehicle
  const recentVehicleTransfers = store.transfers
    .filter(t => t.sourceVehicleId === vehicle.id || t.destVehicleId === vehicle.id)
    .slice(0, 10);

  return {
    vehicle,
    stockRows,
    totalItemsCount,
    totalValuePkr,
    lowStockCount,
    depletedCount,
    vehicleStatus,
    badgeClass,
    statusLabel,
    recentTransfers: recentVehicleTransfers,
    allTransfersCount: store.transfers.length
  };
}

/**
 * Generates an accessible, theme-aware pure SVG diagram depicting technician van cargo bay rack shelves.
 */
export function renderVehicleInventorySvg(summary) {
  if (!summary || !summary.vehicle) {
    return `<div class="chart-empty-state">No vehicle inventory summary available.</div>`;
  }

  const { vehicle, stockRows, vehicleStatus } = summary;
  const width = 560;
  const height = 300;

  const statusColor = vehicleStatus === 'depleted'
    ? '#ef4444'
    : (vehicleStatus === 'low-stock' ? '#f59e0b' : '#10b981');

  // Draw 6 shelf slots inside vehicle cargo rack
  let shelvesSvg = '';
  const rowsToDraw = stockRows.slice(0, 6);

  rowsToDraw.forEach((row, i) => {
    const col = i % 2;
    const shelfIndex = Math.floor(i / 2);
    const x = 30 + (col * 250);
    const y = 60 + (shelfIndex * 68);

    const barW = Math.min(130, Math.round(Math.min(1.5, row.fillRatio) * 85));
    const itemColor = row.itemStatus === 'depleted'
      ? '#ef4444'
      : (row.itemStatus === 'low-stock' ? '#f59e0b' : '#10b981');

    shelvesSvg += `
      <g class="van-shelf-bin" transform="translate(${x}, ${y})">
        <!-- Shelf Compartment Box -->
        <rect x="0" y="0" width="235" height="58" rx="6" fill="var(--bg-card, #ffffff)" stroke="var(--line, #e2e8f0)" stroke-width="1.2" />
        
        <!-- Bin Title & SKU -->
        <text x="10" y="18" font-family="'Manrope', system-ui, sans-serif" font-size="11" font-weight="700" fill="var(--ink, #0f172a)">
          ${escapeXml(row.hardware.name.length > 25 ? row.hardware.name.slice(0, 24) + '…' : row.hardware.name)}
        </text>
        <text x="10" y="32" font-family="'DM Sans', system-ui, sans-serif" font-size="9" fill="var(--muted, #64748b)">
          Min Safe: ${row.minSafe} ${row.hardware.unit} | Value: ${formatPKR(row.itemValue)}
        </text>

        <!-- Stock level bar gauge -->
        <rect x="10" y="38" width="130" height="10" rx="3" fill="var(--bg-subtle, #f1f5f9)" />
        <rect x="10" y="38" width="${barW}" height="10" rx="3" fill="${itemColor}" />

        <!-- Quantity Pill -->
        <rect x="155" y="24" width="70" height="24" rx="4" fill="${row.itemStatus === 'depleted' ? '#fee2e2' : (row.itemStatus === 'low-stock' ? '#fef3c7' : 'var(--bg-subtle, #f1f5f9)')}" />
        <text x="190" y="40" font-family="monospace" font-size="12" font-weight="800" text-anchor="middle" fill="${itemColor}">
          ${row.onHand} <tspan font-size="9" font-weight="500">${row.hardware.unit}</tspan>
        </text>
      </g>
    `;
  });

  return `
    <svg class="chart-svg van-inventory-svg" viewBox="0 0 ${width} ${height}" width="100%" style="height: auto; max-width: 100%; display: block;" role="img"
      aria-label="Technician Vehicle Cargo Bay Inventory Rack Visualizer">
      <defs>
        <linearGradient id="vanRoofGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#334155" />
          <stop offset="100%" stop-color="#1e293b" />
        </linearGradient>
      </defs>

      <!-- Vehicle Hull Outline -->
      <rect x="10" y="10" width="540" height="280" rx="12" fill="var(--bg-subtle, #f8fafc)" stroke="var(--line-strong, #cbd5e1)" stroke-width="1.5" />

      <!-- Vehicle Header Strip -->
      <path d="M 10 22 C 10 15, 15 10, 22 10 L 538 10 C 545 10, 550 15, 550 22 L 550 44 L 10 44 Z" fill="url(#vanRoofGrad)" />
      <text x="25" y="32" font-family="'Manrope', system-ui, sans-serif" font-size="12" font-weight="800" fill="#ffffff">
        ${escapeXml(vehicle.name)} [${escapeXml(vehicle.code)}]
      </text>
      <text x="400" y="32" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="600" fill="#94a3b8">
        Plate: ${escapeXml(vehicle.licensePlate)} | ${escapeXml(vehicle.primarySector)}
      </text>

      <!-- Shelves Grid -->
      ${shelvesSvg}

      <!-- Bottom Chassis Toolbar -->
      <rect x="25" y="266" width="510" height="18" rx="3" fill="var(--bg-card, #ffffff)" stroke="var(--line, #e2e8f0)" />
      <text x="35" y="279" font-family="'DM Sans', system-ui, sans-serif" font-size="10" fill="var(--muted, #64748b)">
        Custodians: <tspan font-weight="700" fill="var(--ink, #0f172a)">${escapeXml(vehicle.technician)}</tspan>
      </text>
      <text x="350" y="279" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="700" fill="${statusColor}">
        ${summary.statusLabel} (${summary.lowStockCount} Low / ${summary.depletedCount} Depleted)
      </text>
    </svg>
  `;
}

/**
 * Generates an official technician stock transfer authorization slip formatted for WhatsApp.
 */
export function generateVehicleTransferReceipt(transfer) {
  if (!transfer) return 'No transfer record available.';

  const sVehicle = SHAHDARA_VEHICLE_FLEET.find(v => v.id === transfer.sourceVehicleId) || { name: transfer.sourceVehicleId, technician: 'Unknown' };
  const dVehicle = SHAHDARA_VEHICLE_FLEET.find(v => v.id === transfer.destVehicleId) || { name: transfer.destVehicleId, technician: 'Unknown' };
  const hardware = SHAHDARA_STANDARD_HARDWARE.find(h => h.id === transfer.itemId) || { name: transfer.itemId, unit: 'units', unitValuePkr: 0 };
  const estValuePkr = hardware.unitValuePkr * transfer.quantity;

  const dateStr = transfer.timestamp ? transfer.timestamp.replace('T', ' ').slice(0, 19) : new Date().toISOString().replace('T', ' ').slice(0, 19);

  return [
    `================================================================`,
    `SHAHDARA ISP FIELD STOCK TRANSFER RECEIPT & CUSTODY SLIP`,
    `Transfer Ref: [${transfer.id}] | Logged: ${dateStr} PKT`,
    `================================================================`,
    `ORIGIN / SOURCE VEHICLE:`,
    `  - Unit       : ${sVehicle.name} (${sVehicle.code || 'DEPOT'})`,
    `  - Custodian  : ${sVehicle.technician}`,
    ``,
    `DESTINATION VEHICLE:`,
    `  - Unit       : ${dVehicle.name} (${dVehicle.code || 'FIELD'})`,
    `  - Custodian  : ${dVehicle.technician}`,
    ``,
    `TRANSFERRED MATERIAL:`,
    `  - Item Name  : ${hardware.name}`,
    `  - SKU / Part : ${hardware.sku || 'N/A'} (${hardware.category})`,
    `  - Quantity   : ${transfer.quantity} ${hardware.unit}`,
    `  - Book Value : ${formatPKR(estValuePkr)}`,
    ``,
    `TRANSFER PURPOSE & DISPATCH NOTES:`,
    `  - Reason/Note: ${transfer.transferNote || 'Road-side emergency restock during active work order.'}`,
    `  - Approved By: ${transfer.authorizedBy || 'Duty Dispatcher'}`,
    `================================================================`,
    `* Digital Chain of Custody Confirmed across Shahdara Mobile Network *`
  ].join('\n');
}

/**
 * Sets up and wires the Technician Vehicle Quick-Transfer Modal dialog.
 */
export function setupVehicleTransferModal(options = {}) {
  const {
    getState = () => ({}),
    storage = null,
    onToast = null,
    clipboard = null
  } = options;

  if (typeof document === 'undefined') return { open: () => {}, close: () => {} };

  const modal = document.getElementById('vehicleTransferModal');
  const openTriggers = document.querySelectorAll('[data-open-van-transfer], [data-sheet-action="van-transfer"], [data-speed-action="van-transfer"], [data-mobile-more="van-transfer"]');
  const closeBtn = document.getElementById('vehicleTransferModalClose');
  const currentVehicleSelect = document.getElementById('vanCurrentVehicleSelect');
  const sourceSelect = document.getElementById('transferSourceSelect');
  const destSelect = document.getElementById('transferDestSelect');
  const itemSelect = document.getElementById('transferItemSelect');
  const qtyInput = document.getElementById('transferQtyInput');
  const noteInput = document.getElementById('transferNoteInput');
  const submitBtn = document.getElementById('vehicleTransferSubmitBtn');
  const copySlipBtn = document.getElementById('vehicleTransferCopySlipBtn');
  const chartWrap = document.getElementById('vanInventoryChartWrap');
  const tableBody = document.getElementById('vanInventoryTableBody');
  const transfersLogList = document.getElementById('vanRecentTransfersList');

  // Quick qty buttons
  const qtyPlus1 = document.getElementById('transferQtyPlus1');
  const qtyPlus5 = document.getElementById('transferQtyPlus5');
  const qtyPlus10 = document.getElementById('transferQtyPlus10');

  // KPI elements
  const kpiVehicleName = document.getElementById('vanKpiVehicleName');
  const kpiTotalItems = document.getElementById('vanKpiTotalItems');
  const kpiInventoryValue = document.getElementById('vanKpiInventoryValue');
  const kpiStatusBadge = document.getElementById('vanKpiStatusBadge');

  let activeVehicleId = 'van-01';
  let lastRecordedTransfer = null;

  function refreshView() {
    const state = typeof getState === 'function' ? getState() : {};
    const summary = calculateVehicleStock(state, activeVehicleId, storage);

    if (kpiVehicleName) {
      kpiVehicleName.textContent = `${summary.vehicle.name} (${summary.vehicle.technician})`;
    }
    if (kpiTotalItems) {
      kpiTotalItems.textContent = `${summary.totalItemsCount} units`;
    }
    if (kpiInventoryValue) {
      kpiInventoryValue.textContent = formatPKR(summary.totalValuePkr);
    }
    if (kpiStatusBadge) {
      kpiStatusBadge.textContent = summary.statusLabel;
      kpiStatusBadge.className = `sim-delta-badge ${summary.badgeClass}`;
    }

    if (chartWrap) {
      chartWrap.innerHTML = renderVehicleInventorySvg(summary);
    }

    // Populate stock table
    if (tableBody) {
      tableBody.innerHTML = summary.stockRows.map(row => {
        const h = row.hardware;
        const color = row.itemStatus === 'depleted' ? '#ef4444' : (row.itemStatus === 'low-stock' ? '#f59e0b' : '#10b981');
        return `
          <tr>
            <td>
              <strong>${escapeXml(h.name)}</strong>
              <div style="font-size:10px; color:var(--muted, #64748b);">${escapeXml(h.category)} [${h.sku}]</div>
            </td>
            <td><strong>${row.onHand}</strong> ${h.unit}</td>
            <td>${row.minSafe} ${h.unit}</td>
            <td>${formatPKR(row.itemValue)}</td>
            <td>
              <span class="sim-delta-badge" style="background:${color}22; color:${color}; font-size:10px; padding:2px 6px;">
                ${row.itemStatus.toUpperCase()}
              </span>
            </td>
          </tr>
        `;
      }).join('');
    }

    // Populate recent transfers
    if (transfersLogList) {
      if (summary.recentTransfers.length === 0) {
        transfersLogList.innerHTML = `<li class="transfer-log-empty" style="color:var(--muted, #64748b); font-size:12px; padding:8px 0;">No stock transfers recorded yet.</li>`;
      } else {
        transfersLogList.innerHTML = summary.recentTransfers.map(t => {
          const s = SHAHDARA_VEHICLE_FLEET.find(v => v.id === t.sourceVehicleId)?.code || t.sourceVehicleId;
          const d = SHAHDARA_VEHICLE_FLEET.find(v => v.id === t.destVehicleId)?.code || t.destVehicleId;
          const h = SHAHDARA_STANDARD_HARDWARE.find(i => i.id === t.itemId)?.name || t.itemId;
          const time = t.timestamp ? t.timestamp.slice(11, 16) : '';
          return `
            <li class="transfer-log-item" style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid var(--line, #e2e8f0); font-size:11px;">
              <div>
                <strong>${t.quantity}x ${escapeXml(h)}</strong>
                <span style="color:var(--muted, #64748b);"> (${escapeXml(s)} &rarr; ${escapeXml(d)})</span>
              </div>
              <span style="font-family:monospace; color:var(--muted, #64748b);">${time}</span>
            </li>
          `;
        }).join('');
      }
    }

    // Update navigation badge counters
    document.querySelectorAll('[data-nav-badge="van-transfer"]').forEach(b => {
      if (summary.depletedCount > 0) {
        b.textContent = `${summary.depletedCount}!`;
        b.className = 'bottom-nav-badge badge-danger';
        b.removeAttribute('hidden');
      } else if (summary.lowStockCount > 0) {
        b.textContent = `${summary.lowStockCount}`;
        b.className = 'bottom-nav-badge badge-warning';
        b.removeAttribute('hidden');
      } else {
        b.setAttribute('hidden', '');
      }
    });
  }

  // Populate vehicle dropdowns
  function populateSelects() {
    if (currentVehicleSelect && currentVehicleSelect.children.length === 0) {
      SHAHDARA_VEHICLE_FLEET.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.id;
        opt.textContent = `${v.name} [${v.code}]`;
        if (v.id === activeVehicleId) opt.selected = true;
        currentVehicleSelect.appendChild(opt);
      });
    }

    if (sourceSelect && sourceSelect.children.length === 0) {
      SHAHDARA_VEHICLE_FLEET.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.id;
        opt.textContent = `${v.name} (${v.technician})`;
        if (v.id === 'warehouse') opt.selected = true;
        sourceSelect.appendChild(opt);
      });
    }

    if (destSelect && destSelect.children.length === 0) {
      SHAHDARA_VEHICLE_FLEET.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.id;
        opt.textContent = `${v.name} (${v.technician})`;
        if (v.id === 'van-01') opt.selected = true;
        destSelect.appendChild(opt);
      });
    }

    if (itemSelect && itemSelect.children.length === 0) {
      SHAHDARA_STANDARD_HARDWARE.forEach(h => {
        const opt = document.createElement('option');
        opt.value = h.id;
        opt.textContent = `${h.name} (${h.category})`;
        itemSelect.appendChild(opt);
      });
    }
  }

  populateSelects();

  function openModal() {
    triggerHaptic('light');
    populateSelects();
    refreshView();
    if (typeof modal?.showModal === 'function') {
      try { modal.showModal(); } catch { modal.setAttribute('open', ''); }
    } else if (modal) {
      modal.setAttribute('open', '');
    }
  }

  function closeModal() {
    triggerHaptic('light');
    if (typeof modal?.close === 'function') {
      try { modal.close(); } catch { modal.removeAttribute('open'); }
    } else if (modal) {
      modal.removeAttribute('open');
    }
  }

  // Wire trigger clicks
  openTriggers.forEach(btn => {
    if (!btn.dataset.vanWired) {
      btn.dataset.vanWired = 'true';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openModal();
      });
    }
  });

  if (closeBtn && !closeBtn.dataset.vanWired) {
    closeBtn.dataset.vanWired = 'true';
    closeBtn.addEventListener('click', closeModal);
  }

  if (modal && !modal.dataset.vanWired) {
    modal.dataset.vanWired = 'true';
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  if (currentVehicleSelect && !currentVehicleSelect.dataset.vanWired) {
    currentVehicleSelect.dataset.vanWired = 'true';
    currentVehicleSelect.addEventListener('change', () => {
      activeVehicleId = currentVehicleSelect.value;
      if (destSelect) destSelect.value = activeVehicleId;
      refreshView();
    });
  }

  // Quick Qty helpers
  if (qtyPlus1 && !qtyPlus1.dataset.vanWired) {
    qtyPlus1.dataset.vanWired = 'true';
    qtyPlus1.addEventListener('click', () => {
      if (qtyInput) qtyInput.value = (Number(qtyInput.value) || 0) + 1;
    });
  }
  if (qtyPlus5 && !qtyPlus5.dataset.vanWired) {
    qtyPlus5.dataset.vanWired = 'true';
    qtyPlus5.addEventListener('click', () => {
      if (qtyInput) qtyInput.value = (Number(qtyInput.value) || 0) + 5;
    });
  }
  if (qtyPlus10 && !qtyPlus10.dataset.vanWired) {
    qtyPlus10.dataset.vanWired = 'true';
    qtyPlus10.addEventListener('click', () => {
      if (qtyInput) qtyInput.value = (Number(qtyInput.value) || 0) + 10;
    });
  }

  // Transfer Submit
  if (submitBtn && !submitBtn.dataset.vanWired) {
    submitBtn.dataset.vanWired = 'true';
    submitBtn.addEventListener('click', () => {
      const srcId = sourceSelect?.value || 'warehouse';
      const dstId = destSelect?.value || 'van-01';
      const itmId = itemSelect?.value || 'onu-gpon';
      const qty = Math.max(1, Number(qtyInput?.value) || 1);
      const note = noteInput?.value || '';

      if (srcId === dstId) {
        if (typeof onToast === 'function') onToast('Source and destination vehicles must be different.');
        return;
      }

      triggerHaptic('medium');
      const transfer = recordVehicleTransfer({
        sourceVehicleId: srcId,
        destVehicleId: dstId,
        itemId: itmId,
        quantity: qty,
        transferNote: note,
        authorizedBy: 'Technician Field Terminal'
      }, storage);

      lastRecordedTransfer = transfer;

      if (typeof onToast === 'function') {
        const itemObj = SHAHDARA_STANDARD_HARDWARE.find(h => h.id === itmId);
        onToast(`Transferred ${qty}x ${itemObj?.name || 'hardware'} successfully!`);
      }

      if (qtyInput) qtyInput.value = '1';
      if (noteInput) noteInput.value = '';
      refreshView();
    });
  }

  // Copy Slip
  if (copySlipBtn && !copySlipBtn.dataset.vanWired) {
    copySlipBtn.dataset.vanWired = 'true';
    copySlipBtn.addEventListener('click', async () => {
      const store = getVehicleInventoryStore(storage);
      const targetTransfer = lastRecordedTransfer || store.transfers[0];
      if (!targetTransfer) {
        if (typeof onToast === 'function') onToast('No transfer record to copy.');
        return;
      }

      const text = generateVehicleTransferReceipt(targetTransfer);
      const clip = clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
      if (clip && typeof clip.writeText === 'function') {
        try {
          await clip.writeText(text);
          triggerHaptic('success');
          if (typeof onToast === 'function') onToast('Transfer custody receipt copied to clipboard!');
        } catch {
          if (typeof onToast === 'function') onToast('Failed to copy transfer slip.');
        }
      } else if (typeof onToast === 'function') {
        onToast('Clipboard API not available.');
      }
    });
  }

  // Initial update
  refreshView();

  return {
    open: openModal,
    close: closeModal,
    refresh: refreshView,
    getActiveVehicle: () => activeVehicleId,
    setActiveVehicle: (vid) => {
      activeVehicleId = vid;
      if (currentVehicleSelect) currentVehicleSelect.value = vid;
      refreshView();
    }
  };
}
