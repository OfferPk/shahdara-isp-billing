import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, addCustomer, addPayment } from '../core.js';
import {
  parseCustomerList, parseFreeLine, matchPackage, computeStatuses, summarizeRows, importCustomers, undoImport, splitDelimited, normPhone
} from '../customer-import-core.js';
import { readPdfText } from '../customer-import.js';
import { getPendingCollectionCustomers } from '../nav-quick-collect.js';

const pick = r => ({ name: r.name, packageLabel: r.packageLabel, packageId: r.packageId, fee: r.fee, phone: r.phone, area: r.area });
const month = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 7);

test("John's 3 examples parse exactly", () => {
  const { rows, header } = parseCustomerList('ALI, 15MBPS, 3000RS\nSAIM, 5MBPS, 1500\nTOUSEEF 5MBPS, 1000');
  assert.equal(header, false);
  assert.deepEqual(rows.map(pick), [
    { name: 'ALI', packageLabel: '15Mbps Unlimited', packageId: '15mbps-unlimited', fee: 3000, phone: '', area: '' },
    { name: 'SAIM', packageLabel: '5Mbps / 150GB', packageId: '5mbps-150gb', fee: 1500, phone: '', area: '' },
    { name: 'TOUSEEF', packageLabel: '5 Mbps', packageId: null, fee: 1000, phone: '', area: '' } // no 5 Mbps package at 1000: speed text kept
  ]);
});

test('separators, speed and amount formats, phone and area', () => {
  assert.deepEqual(pick({ ...parseFreeLine('BILAL\t03001234567\t10 MB\tRs 3,000\tJia Musa'), packageLabel: undefined, packageId: undefined }),
    { name: 'BILAL', packageLabel: undefined, packageId: undefined, fee: 3000, phone: '03001234567', area: 'Jia Musa' });
  const p = parseFreeLine('Kamran Ali 15 Mb PKR 2800 +92 321 5550001');
  assert.equal(p.name, 'Kamran Ali');
  assert.equal(p.speed, 15);
  assert.equal(p.fee, 2800);
  assert.equal(p.phone, '03215550001');
  assert.equal(parseFreeLine('NADEEM; 5mbps; 1500/-; Begum Kot').fee, 1500);
  assert.equal(parseFreeLine('NADEEM | 5 mbps | 1,500 rs | Begum Kot').area, 'Begum Kot');
  assert.equal(parseFreeLine('ASIF').fee, null);
  assert.equal(normPhone('0092-300-1234567'), '03001234567');
});

test('package matching: price picks the package, a single speed match keeps the typed fee, otherwise speed text', () => {
  assert.equal(matchPackage({ speed: 5, fee: 2500 }).packageId, '5mbps-500gb');
  assert.equal(matchPackage({ speed: 5, dataGb: 200 }).packageId, '5mbps-200gb');
  assert.deepEqual(matchPackage({ speed: 15, fee: 2800 }), { packageId: '15mbps-unlimited', packageLabel: '15Mbps Unlimited', fee: 2800, feeFromPackage: false });
  assert.deepEqual(matchPackage({ speed: 15 }), { packageId: '15mbps-unlimited', packageLabel: '15Mbps Unlimited', fee: 3000, feeFromPackage: true });
  assert.deepEqual(matchPackage({ speed: 20, fee: 4000 }), { packageId: null, packageLabel: '20 Mbps', fee: 4000, feeFromPackage: false });
  assert.equal(matchPackage({ speed: 5 }).fee, null, 'several 5 Mbps packages: no guessed fee');
});

test('CSV header row is auto-detected, quoted cells and column order respected', () => {
  const csv = 'Phone,Customer Name,Monthly Fee,Package,Area\n0300-1112223,"Raza, Ali","3,000",15Mbps Unlimited,Shahdara\n,Usman,1500,5mbps,\n';
  const { rows, header } = parseCustomerList(csv);
  assert.equal(header, true);
  assert.deepEqual(rows.map(pick), [
    { name: 'Raza, Ali', packageLabel: '15Mbps Unlimited', packageId: '15mbps-unlimited', fee: 3000, phone: '03001112223', area: 'Shahdara' },
    { name: 'Usman', packageLabel: '5Mbps / 150GB', packageId: '5mbps-150gb', fee: 1500, phone: '', area: '' }
  ]);
  assert.deepEqual(splitDelimited('a,"b ""c"", d",e', ','), ['a', 'b "c", d', 'e']);
});

test('statuses: OK / Missing fee / Duplicate (name+phone) / Duplicate in file / Fix', () => {
  let s = { version: 1, nextCustomerNumber: 1, customers: [] };
  s = addCustomer(s, 'Test Customer 35', new Date(), { phone: '03001234567' });
  const { rows } = parseCustomerList([
    'ALI, 15MBPS, 3000RS', 'ASIF 5mbps', 'Test Customer 35 03001234567 5mbps 1500', 'Test Customer 35 03009999999 5mbps 1500',
    'SAIM, 5MBPS, 1500', 'saim 5mbps 1500', 'X 5mbps 1500'
  ].join('\n'));
  const st = computeStatuses(rows, s.customers);
  assert.deepEqual(st.map(r => r.status), ['ok', 'missing-fee', 'duplicate', 'ok', 'ok', 'dup-file', 'error']);
  assert.deepEqual(st.map(r => r.included), [true, false, false, true, true, false, false]);
  assert.match(st[2].detail, /Matches #1 Test Customer 35/);
  assert.deepEqual(summarizeRows(st), { total: 7, ready: 3, skipped: 4, attention: 4 });
  // The user can tick a duplicate / missing-fee row; error rows stay out.
  const forced = computeStatuses(rows.map((r, i) => ({ ...r, include: [1, 2, 6].includes(i) ? true : null })), s.customers);
  assert.deepEqual(forced.map(r => r.included), [true, true, true, true, true, false, false]);
});

test('import adds through core addCustomer + customer-plan billing: 3 pending in Quick Collect; undo removes the batch', () => {
  const s = createInitialState();
  const before = s.customers.length;
  const rows = computeStatuses(parseCustomerList('ALI, 15MBPS, 3000RS\nSAIM, 5MBPS, 1500\nTOUSEEF 5MBPS, 1000').rows, s.customers);
  const res = importCustomers(s, rows, { connectionDate: '2026-10-19' });
  assert.equal(res.added, 3);
  assert.equal(res.billed, 3);
  assert.equal(res.nextState.customers.length, before + 3);
  const pending = getPendingCollectionCustomers(res.nextState, '', 'all-dues');
  assert.deepEqual(pending.map(r => [r.name, r.totalDues]), [['ALI', 3000], ['SAIM', 1500], ['TOUSEEF', 1000]]);
  const touseef = res.nextState.customers.find(c => c.name === 'TOUSEEF');
  assert.equal(touseef.packageSpeed, '5 Mbps');
  assert.equal(touseef.connectionDate, '2026-10-19');
  assert.equal(touseef.bills[0].month, month);

  // Undo: all three removed (no payments yet), numbering restored.
  const undone = undoImport(res.nextState, res.addedIds);
  assert.equal(undone.removed, 3);
  assert.equal(undone.nextState.customers.length, before);
  assert.equal(undone.nextState.nextCustomerNumber, s.nextCustomerNumber);
  // A customer that already paid is kept.
  const ali = res.nextState.customers.find(c => c.name === 'ALI');
  const paid = addPayment(res.nextState, ali.id, month, { date: '2026-10-19', amount: 3000, method: 'Cash' });
  const partial = undoImport(paid, res.addedIds);
  assert.equal(partial.removed, 2);
  assert.equal(partial.kept, 1);
});

test('PDF: text is grouped into lines; offline gives a paste fallback message', async () => {
  const fakeFile = { arrayBuffer: async () => new ArrayBuffer(4) };
  const item = (str, x, y) => ({ str, transform: [1, 0, 0, 1, x, y] });
  const fakePdfjs = {
    GlobalWorkerOptions: {},
    getDocument: () => ({ promise: Promise.resolve({ numPages: 1, getPage: async () => ({ getTextContent: async () => ({ items: [
      item('SAIM', 10, 700), item('3000RS', 200, 700), item('15MBPS', 100, 700.5), item('TOUSEEF', 10, 680), item('5MBPS', 100, 680), item('1000', 200, 680)
    ] }) }) }) })
  };
  const text = await readPdfText(fakeFile, { importer: async () => fakePdfjs });
  assert.equal(text, 'SAIM, 15MBPS, 3000RS\nTOUSEEF, 5MBPS, 1000');
  assert.equal(parseCustomerList(text).rows.length, 2);
  await assert.rejects(readPdfText(fakeFile, { importer: async () => { throw new Error('offline'); } }), /needs internet the first time.*paste/);
});
