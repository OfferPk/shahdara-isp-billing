/**
 * thermal-printer.js — #226 Bluetooth thermal receipt printing.
 *
 * Two layers:
 *  1. A pure ESC/POS byte builder for the standard payment receipt on a
 *     58mm roll (32 chars/line at Font A). No DOM, no Bluetooth — fully
 *     unit-testable. Text is encoded as UTF-8; amounts, dates and ids are
 *     Latin/digits by design. Urdu script cannot be rendered by cheap
 *     ESC/POS printers without rasterisation, so the printed footer uses
 *     the short Latin note and the full Urdu note stays on the
 *     screen/PDF receipt.
 *  2. A small Web Bluetooth wrapper (GATT write characteristic) with the
 *     device remembered in storage. Everything is feature-detected:
 *     when navigator.bluetooth is missing the UI hides every Bluetooth
 *     affordance and the @media print fallback remains the way to print.
 */

import { buildReceiptFooterLines } from './receipt-footer-studio.js';

export const THERMAL_WIDTH_CHARS = 32;
export const PRINTER_STORAGE_KEY = 'shahdara_bt_printer';

// Common BLE UART / printer services seen on cheap 58mm printers
// (POS-5805/5810 class, Goojprt, MTP-II clones, HM-10 based bridges).
export const PRINTER_SERVICE_UUIDS = [
  '000018f0-0000-1000-8000-00805f9b34fb', // generic printer service
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC transparent UART
  '0000ff00-0000-1000-8000-00805f9b34fb', // common clone UART service
  '0000ffe0-0000-1000-8000-00805f9b34fb', // HM-10 serial
  '0000ae30-0000-1000-8000-00805f9b34fb'  // some thermal printers
];

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

function textBytes(str) {
  return new TextEncoder().encode(str);
}

function wrapText(text, width) {
  const words = String(text ?? '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    if (word.length > width) {
      if (line) { lines.push(line); line = ''; }
      for (let i = 0; i < word.length; i += width) lines.push(word.slice(i, i + width));
      continue;
    }
    if (!line) line = word;
    else if (line.length + 1 + word.length <= width) line += ' ' + word;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function center(text, width) {
  const t = String(text ?? '').slice(0, width);
  const pad = Math.max(0, Math.floor((width - t.length) / 2));
  return ' '.repeat(pad) + t;
}

function rowLine(label, value, width) {
  const l = String(label ?? '');
  const v = String(value ?? '');
  if (l.length + 1 + v.length <= width) return l + ' '.repeat(width - l.length - v.length) + v;
  const keep = Math.max(0, width - v.length - 1);
  return l.slice(0, keep) + ' ' + v;
}

/**
 * Builds the plain-text layout AND the ESC/POS byte stream for a receipt.
 * @param {Object} fields - all optional display strings:
 *   businessName, businessPhone, receiptNumber, customerName,
 *   customerNumber, monthLabel, packageLabel, dateTimeLabel, amount,
 *   method, reference, discount, balanceDue, statusLabel, footerNote,
 *   footerLines (SISP-96 owner footer lines, optional)
 * @param {Object} [options]
 * @param {number} [options.widthChars=32]
 * @returns {{ bytes: Uint8Array, text: string, lines: string[] }}
 */
export function buildEscPosReceipt(fields = {}, { widthChars = THERMAL_WIDTH_CHARS } = {}) {
  const width = Math.max(16, Math.floor(widthChars) || THERMAL_WIDTH_CHARS);
  const lines = [];
  const push = (s) => lines.push(s);
  const divider = '-'.repeat(width);

  if (fields.businessName) for (const l of wrapText(fields.businessName, width)) push(center(l, width));
  if (fields.businessPhone) push(center(fields.businessPhone, width));
  push(divider);
  push(center('PAYMENT RECEIPT', width));
  if (fields.receiptNumber) push(rowLine('Receipt', fields.receiptNumber, width));
  if (fields.dateTimeLabel) push(rowLine('Date', fields.dateTimeLabel, width));
  push(divider);
  if (fields.customerName) for (const l of wrapText(`Customer: ${fields.customerName}`, width)) push(l);
  if (fields.customerNumber) push(rowLine('Customer #', fields.customerNumber, width));
  if (fields.monthLabel) push(rowLine('Month', fields.monthLabel, width));
  if (fields.packageLabel) for (const l of wrapText(`Package: ${fields.packageLabel}`, width)) push(l);
  push(divider);
  if (fields.method) push(rowLine('Method', fields.method, width));
  if (fields.reference) push(rowLine('Ref', fields.reference, width));
  // SISP-43: billed ticket charges settled by this receipt, one row per
  // ticket ({ label, value } pairs, pre-formatted by the caller).
  if (Array.isArray(fields.ticketCharges)) {
    for (const line of fields.ticketCharges) {
      if (line && line.label) push(rowLine(line.label, line.value ?? '', width));
    }
  }
  if (fields.discount) push(rowLine('Discount', fields.discount, width));
  if (fields.concession) push(rowLine('Outage concession', fields.concession, width));
  if (fields.referralCredit) push(rowLine('Referral credit', fields.referralCredit, width));
  if (fields.arrearsPackage || fields.arrearsPrevious || fields.arrearsTotal) {
    push(rowLine('Monthly pkg', fields.arrearsPackage, width));
    if (fields.arrearsKist) push(rowLine('Kist', fields.arrearsKist, width));
    push(rowLine('Prev arrears', fields.arrearsPrevious, width));
    push(rowLine('Total due', fields.arrearsTotal, width));
    push(rowLine('Paid applied', fields.arrearsPaid, width));
    push(rowLine('Balance left', fields.arrearsBalance, width));
  }
  if (fields.amount) push(rowLine('AMOUNT PAID', fields.amount, width));
  if (fields.balanceDue) push(rowLine('Balance due', fields.balanceDue, width));
  if (fields.statusLabel) push(rowLine('Status', fields.statusLabel, width));
  push(divider);
  const footer = fields.footerNote || 'Thank you! Please keep this receipt.';
  for (const l of wrapText(footer, width)) push(center(l, width));
  // SISP-96: owner-configured footer lines (ONE builder in
  // receipt-footer-studio.js) under the standard note. Absent or empty
  // on unconfigured setups, so the slip stays byte-identical to before.
  if (Array.isArray(fields.footerLines)) {
    for (const footerLine of fields.footerLines) {
      for (const l of wrapText(footerLine, width)) push(center(l, width));
    }
  }
  push('');
  push('');

  // Byte stream: init, centered bold double-size business name, then the
  // plain layout, feed + partial cut. Alignment/bold are applied around
  // the header lines only; the body is one left-aligned block so printers
  // with tiny buffers still render identical line breaks to `text`.
  const chunks = [];
  const raw = (...bytes) => chunks.push(new Uint8Array(bytes));
  const txt = (s) => chunks.push(textBytes(s));
  raw(ESC, 0x40); // initialise
  raw(ESC, 0x74, 0x00); // code page PC437 (Latin/digits safe)
  raw(ESC, 0x61, 0x01); // center
  raw(ESC, 0x45, 0x01); // bold on
  raw(GS, 0x21, 0x11); // double width+height
  txt((fields.businessName || 'RECEIPT') + '\n');
  raw(GS, 0x21, 0x00); // normal size
  raw(ESC, 0x45, 0x00); // bold off
  raw(ESC, 0x61, 0x00); // left align
  // Body: every layout line after the business-name header lines.
  const headerLines = fields.businessName ? wrapText(fields.businessName, width).length : 0;
  const body = lines.slice(headerLines).join('\n');
  txt(body + '\n');
  raw(ESC, 0x64, 0x03); // feed 3 lines
  raw(GS, 0x56, 0x42, 0x00); // partial cut

  const total = chunks.reduce((n, c) => n + c.length, 0);
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) { bytes.set(c, offset); offset += c.length; }
  return { bytes, text: lines.join('\n'), lines };
}

/** Adapts a receipt.js buildPaymentReceipt() result to builder fields. */
export function escPosFieldsFromPaymentReceipt(receipt, { businessName = 'Shahdara ISP', businessPhone = '', receiptFooter = null } = {}) {
  if (!receipt) return {};
  const money = (v) => (v === null || v === undefined || v === '' ? '' : `PKR ${Number(v).toLocaleString('en-PK')}`);
  const balance = receipt.balanceDueCents === null || receipt.balanceDueCents === undefined
    ? ''
    : money(receipt.balanceDueCents / 100);
  return {
    businessName,
    businessPhone,
    receiptNumber: receipt.receiptNumber || receipt.permanentReceiptNumber || '',
    customerName: receipt.customerName || '',
    customerNumber: receipt.customerId || '',
    monthLabel: receipt.packageDate ? receipt.packageDate.slice(0, 7) : '',
    packageLabel: receipt.package || '',
    dateTimeLabel: receipt.paymentDate || '',
    amount: money(receipt.paidAmount),
    method: receipt.paymentMethod || '',
    reference: receipt.transactionId || '',
    discount: receipt.discount ? money(receipt.discount) : '',
    // SISP-30: concession line + net arrears balance (the SISP-2 breakdown
    // stays gross, so subtract here for display; balanceDue above already
    // comes from the net balanceDueCents computed by buildPaymentReceipt).
    concession: receipt.concessionAmount ? money(receipt.concessionAmount) : '',
    // SISP-40: hamsaya referral credit line, printed next to the concession.
    referralCredit: receipt.referralCreditAmount ? money(receipt.referralCreditAmount) : '',
    // SISP-43: billed ticket charges settled by this payment (short
    // label — the 32-char slip cannot fit the full receipt wording).
    // Owner feature (2026-10-29): manual baqaya settled by this payment
    // rides the same row list with its own short label.
    ticketCharges: [
      ...(Array.isArray(receipt.ticketCharges) ? receipt.ticketCharges : [])
        .map(line => ({ label: `Murammat (${line.ticketId})`, value: money(line.amount) })),
      ...(Array.isArray(receipt.manualBaqayaSettlements) ? receipt.manualBaqayaSettlements : [])
        .map(line => ({ label: `Baqaya (${line.entryId})`, value: money(line.amount) }))
    ],
    balanceDue: balance,
    statusLabel: receipt.status || '',
    // SISP-2: itemized arrears breakdown (passed through from the receipt
    // object built by buildPaymentReceipt); rendered below by buildEscPosReceipt.
    arrearsPackage: receipt.arrearsBreakdown ? money(receipt.arrearsBreakdown.packageAmount) : '',
    // SISP-4: kist on this bill month (blank when none, like the other rows).
    arrearsKist: receipt.arrearsBreakdown && receipt.arrearsBreakdown.kistAmount > 0 ? money(receipt.arrearsBreakdown.kistAmount) : '',
    arrearsPrevious: receipt.arrearsBreakdown ? money(receipt.arrearsBreakdown.previousArrears) : '',
    arrearsTotal: receipt.arrearsBreakdown ? money(receipt.arrearsBreakdown.totalDue) : '',
    arrearsPaid: receipt.arrearsBreakdown ? money(receipt.arrearsBreakdown.paidAmount) : '',
    arrearsBalance: receipt.arrearsBreakdown ? money(Math.max(0, receipt.arrearsBreakdown.balanceDue - (receipt.concessionAmount || 0) - (receipt.referralCreditAmount || 0) - (receipt.depositOffsetAmount || 0))) : '',
    footerNote: 'Thank you! Please keep this receipt.',
    // SISP-96: owner-configured footer lines ([] when unconfigured).
    footerLines: buildReceiptFooterLines(receiptFooter)
  };
}

export function isWebBluetoothAvailable(nav = (typeof navigator !== 'undefined' ? navigator : null)) {
  return !!(nav && nav.bluetooth && typeof nav.bluetooth.requestDevice === 'function');
}

/**
 * Creates a printer handle. Dependencies are injectable for tests.
 * @param {Object} [deps]
 * @param {Object} [deps.bluetooth] - navigator.bluetooth compatible object
 * @param {Object} [deps.storage] - localStorage compatible object
 * @param {number} [deps.chunkSize=100]
 */
export function createThermalPrinter(deps = {}) {
  const bluetooth = deps.bluetooth ?? (typeof navigator !== 'undefined' ? navigator.bluetooth : null);
  const storage = deps.storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  const chunkSize = Math.max(20, deps.chunkSize || 100);
  let device = null;
  let characteristic = null;

  function remembered() {
    try {
      const raw = storage?.getItem(PRINTER_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function remember(dev) {
    try { storage?.setItem(PRINTER_STORAGE_KEY, JSON.stringify({ id: dev.id || '', name: dev.name || 'Bluetooth printer' })); } catch {}
  }

  function forget() {
    try { storage?.removeItem(PRINTER_STORAGE_KEY); } catch {}
  }

  async function findWriteCharacteristic(server) {
    const services = await server.getPrimaryServices().catch(() => []);
    for (const service of services) {
      const chars = await service.getCharacteristics().catch(() => []);
      for (const ch of chars) {
        if (ch.properties?.write || ch.properties?.writeWithoutResponse) return ch;
      }
    }
    // Fall back to the well-known services one by one.
    for (const uuid of PRINTER_SERVICE_UUIDS) {
      const service = await server.getPrimaryService(uuid).catch(() => null);
      if (!service) continue;
      const chars = await service.getCharacteristics().catch(() => []);
      for (const ch of chars) {
        if (ch.properties?.write || ch.properties?.writeWithoutResponse) return ch;
      }
    }
    return null;
  }

  async function connect() {
    if (!bluetooth) throw new Error('Web Bluetooth is not available in this browser.');
    device = await bluetooth.requestDevice({
      filters: [{ services: [PRINTER_SERVICE_UUIDS[0]] }],
      optionalServices: PRINTER_SERVICE_UUIDS
    }).catch(async () => {
      // Many clone printers advertise no service UUID; accept all and scan.
      return bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: PRINTER_SERVICE_UUIDS });
    });
    const server = await device.gatt.connect();
    characteristic = await findWriteCharacteristic(server);
    if (!characteristic) throw new Error('No writable printer characteristic found on this device.');
    remember(device);
    return { id: device.id || '', name: device.name || 'Bluetooth printer' };
  }

  async function print(bytes) {
    if (!device || !characteristic) throw new Error('Printer is not connected.');
    if (!device.gatt?.connected) {
      const server = await device.gatt.connect();
      characteristic = (await findWriteCharacteristic(server)) || characteristic;
    }
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.slice(i, i + chunkSize);
      if (characteristic.properties?.writeWithoutResponse && characteristic.writeValueWithoutResponse) {
        await characteristic.writeValueWithoutResponse(chunk);
      } else {
        await characteristic.writeValue(chunk);
      }
    }
  }

  async function disconnect() {
    try { if (device?.gatt?.connected) device.gatt.disconnect(); } catch {}
    device = null;
    characteristic = null;
  }

  return {
    isAvailable: () => !!bluetooth,
    isConnected: () => !!(device && characteristic && device.gatt?.connected),
    remembered,
    forget,
    connect,
    disconnect,
    print,
    printReceipt: async (fields, options) => print(buildEscPosReceipt(fields, options).bytes)
  };
}

/** Shared app-wide printer instance. */
export const thermalPrinter = createThermalPrinter();
