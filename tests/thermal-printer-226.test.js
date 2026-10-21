// #226: ESC/POS byte builder + Web Bluetooth wrapper (mocked GATT).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEscPosReceipt,
  escPosFieldsFromPaymentReceipt,
  createThermalPrinter,
  isWebBluetoothAvailable,
  THERMAL_WIDTH_CHARS
} from '../thermal-printer.js';

const FIELDS = {
  businessName: 'Shahdara ISP',
  businessPhone: '0300-1234567',
  receiptNumber: 'RCPT-42-202610-01',
  customerName: 'Muhammad Nazeer Ahmad Khan',
  customerNumber: '42',
  monthLabel: '2026-10',
  packageLabel: '25 Mbps Turbo Broadband',
  dateTimeLabel: '2026-10-21',
  amount: 'PKR 1,500',
  method: 'JazzCash',
  reference: 'JC-998877',
  balanceDue: 'PKR 0',
  statusLabel: 'PAID'
};

test('#226 builder: every layout line fits the 58mm width', () => {
  const { lines, text } = buildEscPosReceipt(FIELDS);
  assert.equal(THERMAL_WIDTH_CHARS, 32);
  for (const line of lines) assert.ok(line.length <= 32, `line too wide (${line.length}): ${line}`);
  assert.equal(text, lines.join('\n'));
});

test('#226 builder: totals are right-aligned and key fields present', () => {
  const { lines } = buildEscPosReceipt(FIELDS);
  const amountLine = lines.find(l => l.startsWith('AMOUNT PAID'));
  assert.ok(amountLine.endsWith('PKR 1,500'));
  assert.equal(amountLine.length, 32);
  assert.ok(lines.join(' ').includes('Muhammad Nazeer') && lines.join(' ').includes('Ahmad Khan'), 'long names wrap, never truncate away');
  assert.ok(lines.some(l => l.startsWith('Balance due') && l.endsWith('PKR 0')));
  assert.ok(lines.some(l => l.includes('RCPT-42-202610-01')));
});

test('#226 builder: byte stream has init, double-size header and a cut', () => {
  const { bytes } = buildEscPosReceipt(FIELDS);
  assert.ok(bytes instanceof Uint8Array);
  assert.equal(bytes[0], 0x1b);
  assert.equal(bytes[1], 0x40); // ESC @
  const asArray = [...bytes];
  const gsIdx = asArray.findIndex((b, i) => b === 0x1d && asArray[i + 1] === 0x21 && asArray[i + 2] === 0x11);
  assert.ok(gsIdx > 0, 'GS ! double-size command present');
  const tail = asArray.slice(-4);
  assert.deepEqual(tail, [0x1d, 0x56, 0x42, 0x00]); // GS V 66 0 = partial cut
  const decoded = new TextDecoder().decode(bytes);
  assert.ok(decoded.includes('AMOUNT PAID'));
  assert.ok(decoded.includes('PAYMENT RECEIPT'));
});

test('#226 builder: narrow width honoured and empty fields skipped', () => {
  const { lines } = buildEscPosReceipt({ businessName: 'X', amount: 'PKR 5' }, { widthChars: 20 });
  for (const line of lines) assert.ok(line.length <= 20, `line too wide: ${line}`);
  assert.ok(!lines.some(l => l.startsWith('Method')));
});

test('#226 adapter: payment receipt maps to printable fields', () => {
  const fields = escPosFieldsFromPaymentReceipt({
    customerName: 'Ali', customerId: '7', receiptNumber: 'R-1', paymentDate: '2026-10-03',
    paidAmount: 1200, paymentMethod: 'Cash', balanceDueCents: 30000, status: 'PARTIAL',
    package: '15 Mbps', packageDate: '2026-10-01', transactionId: '', discount: 0
  }, { businessName: 'Shahdara ISP', businessPhone: '0300-1' });
  assert.equal(fields.amount, 'PKR 1,200');
  assert.equal(fields.balanceDue, 'PKR 300');
  assert.equal(fields.monthLabel, '2026-10');
  const { lines } = buildEscPosReceipt(fields);
  assert.ok(lines.some(l => l.includes('PARTIAL')));
});

test('#226 bluetooth: feature detection', () => {
  assert.equal(isWebBluetoothAvailable(null), false);
  assert.equal(isWebBluetoothAvailable({}), false);
  assert.equal(isWebBluetoothAvailable({ bluetooth: { requestDevice: () => {} } }), true);
});

function fakePrinterDevice(writes) {
  const characteristic = {
    properties: { write: true, writeWithoutResponse: true },
    writeValueWithoutResponse: async (chunk) => { writes.push(chunk.length); },
    writeValue: async (chunk) => { writes.push(chunk.length); }
  };
  const service = { getCharacteristics: async () => [characteristic] };
  const device = {
    id: 'dev-1', name: 'POS-58',
    gatt: {
      connected: false,
      connect: async () => { device.gatt.connected = true; return { getPrimaryServices: async () => [service], getPrimaryService: async () => service }; },
      disconnect: () => { device.gatt.connected = false; }
    }
  };
  return device;
}

test('#226 bluetooth: connect remembers the device and print chunks bytes', async () => {
  const writes = [];
  const device = fakePrinterDevice(writes);
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
  const printer = createThermalPrinter({
    bluetooth: { requestDevice: async () => device },
    storage,
    chunkSize: 50
  });
  assert.equal(printer.isAvailable(), true);
  const info = await printer.connect();
  assert.equal(info.name, 'POS-58');
  assert.deepEqual(printer.remembered(), { id: 'dev-1', name: 'POS-58' });
  await printer.print(new Uint8Array(230));
  assert.deepEqual(writes, [50, 50, 50, 50, 30]);
  await printer.printReceipt(FIELDS);
  assert.ok(writes.length > 5, 'receipt bytes were written in chunks');
  await printer.disconnect();
  assert.equal(printer.isConnected(), false);
});

test('#226 bluetooth: print before connect throws a clear error', async () => {
  const printer = createThermalPrinter({ bluetooth: { requestDevice: async () => { throw new Error('cancelled'); } }, storage: null });
  await assert.rejects(() => printer.print(new Uint8Array(4)), /not connected/);
});
