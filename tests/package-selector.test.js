import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BILL_PACKAGES, billPackageById, billPackageByLabel, classifyPackagePrice,
  createBillPackageSnapshot, validateBillPackageSnapshot
} from '../package-catalog.js';
import {
  addPayment, createInitialState, createJsonBackup, previewJsonBackupMerge,
  readState, saveBillMonth
} from '../core.js';
import { buildPaymentReceipt } from '../receipt.js';

const referenceDate = new Date('2026-10-07T12:00:00+05:00');
const syntheticPayment = (date, amount) => ({ date, amount:String(amount), method:'Cash' });
const customerId = 'seed-001';

test('package selector exposes exactly the six requested labels and nominal monthly prices', () => {
  assert.deepEqual(BILL_PACKAGES.map(({ label, price }) => [label, price]), [
    ['3Mbps / 100GB', 100],
    ['3Mbps / 300GB', 1600],
    ['5Mbps / 150GB', 1500],
    ['5Mbps / 500GB', 2500],
    ['5Mbps / 200GB', 2000],
    ['15Mbps Unlimited', 3000]
  ]);
  assert.equal(billPackageById('15mbps-unlimited').price, 3000);
  assert.equal(billPackageByLabel(' 5Mbps / 200GB ').id, '5mbps-200gb');
});

test('classification threshold makes 2,999 Limited and exactly 3,000 Unlimited', () => {
  assert.equal(classifyPackagePrice(2999), 'Limited');
  assert.equal(classifyPackagePrice(3000), 'Unlimited');
  assert.equal(classifyPackagePrice(3500), 'Unlimited');
  assert.equal(classifyPackagePrice(null), '');
});

test('package snapshot has canonical display label, nominal amount, speed, classification and cap', () => {
  assert.deepEqual(createBillPackageSnapshot('3mbps-300gb'), {
    packageId:'3mbps-300gb', label:'3Mbps / 300GB', nominalPrice:1600,
    speedMbps:3, packageType:'Limited', dataLimit:'300 GB'
  });
  assert.deepEqual(createBillPackageSnapshot('15mbps-unlimited'), {
    packageId:'15mbps-unlimited', label:'15Mbps Unlimited', nominalPrice:3000,
    speedMbps:15, packageType:'Unlimited', dataLimit:''
  });
  assert.equal(validateBillPackageSnapshot(createBillPackageSnapshot('5mbps-500gb')).dataLimit, '500 GB');
  assert.equal(validateBillPackageSnapshot({ packageId:'5mbps-500gb', nominalPrice:75 }), null);
});

test('selecting a package snapshots its nominal charge on that bill, never the partial payment or Paid status', () => {
  let state = createInitialState(['Synthetic Package Customer']);
  state = saveBillMonth(state, customerId, {
    month:'2026-10', dueAmount:'75', status:'pending', packageId:'15mbps-unlimited'
  }, referenceDate);
  state = addPayment(state, customerId, '2026-10', syntheticPayment('2026-10-07', 75), referenceDate);
  const customer = state.customers[0];
  const bill = customer.bills.find(row => row.month === '2026-10');
  assert.equal(bill.dueAmount, 3000, 'selecting the preset fixes the nominal bill amount');
  assert.deepEqual(bill.packageSnapshot, createBillPackageSnapshot('15mbps-unlimited'));
  assert.equal(bill.payments[0].amount, 75, 'payment remains separately recorded');
  assert.equal(bill.status, 'pending', 'paid status is not autofilled');
  assert.equal(Object.hasOwn(customer, 'packageSnapshot'), false, 'the snapshot is attached to the bill, not the profile');
  assert.equal(customer.monthlySellingAmount, null, 'preset selection does not alter the profile recurring rate');

  const receipt = buildPaymentReceipt(customer, bill, bill.payments[0]);
  assert.equal(receipt.package, '15Mbps Unlimited');
  assert.equal(receipt.speedMbps, '15');
  assert.equal(receipt.nominalPrice, 3000);
  assert.equal(receipt.packageType, 'Unlimited');
  assert.equal(receipt.dataLimit, '');
  assert.equal(receipt.paidAmount, 75);
  assert.equal(receipt.status, 'PARTIAL');
  assert.equal(receipt.balanceDueCents, 292500);
});

test('a Limited package receipt uses its bill snapshot and shows only its saved cap', () => {
  let state = createInitialState(['Synthetic Limited Customer']);
  state = saveBillMonth(state, customerId, {
    month:'2026-10', dueAmount:null, status:'pending', packageId:'3mbps-100gb'
  }, referenceDate);
  state = addPayment(state, customerId, '2026-10', syntheticPayment('2026-10-07', 100), referenceDate);
  const customer = state.customers[0];
  const bill = customer.bills[0];
  const receipt = buildPaymentReceipt(customer, bill, bill.payments[0]);
  assert.equal(bill.dueAmount, 100);
  assert.equal(receipt.package, '3Mbps / 100GB');
  assert.equal(receipt.nominalPrice, 100);
  assert.equal(receipt.packageType, 'Limited');
  assert.equal(receipt.dataLimit, '100 GB');
  assert.equal(receipt.paidAmount, 100);
  assert.equal(receipt.status, 'PAID');
});

test('switching the package in a later month leaves prior bill snapshots and receipts unchanged', () => {
  let state = createInitialState(['Synthetic Changing Plan Customer']);
  state = saveBillMonth(state, customerId, {
    month:'2026-10', dueAmount:null, status:'pending', packageId:'3mbps-100gb'
  }, referenceDate);
  state = addPayment(state, customerId, '2026-10', syntheticPayment('2026-10-07', 50), referenceDate);
  const octoberSnapshot = structuredClone(state.customers[0].bills.find(row => row.month === '2026-10').packageSnapshot);

  const novemberDate = new Date('2026-11-07T12:00:00+05:00');
  state = saveBillMonth(state, customerId, {
    month:'2026-11', dueAmount:null, status:'pending', packageId:'5mbps-150gb'
  }, novemberDate);
  state = addPayment(state, customerId, '2026-11', syntheticPayment('2026-11-07', 200), novemberDate);

  const customer = state.customers[0];
  const october = customer.bills.find(row => row.month === '2026-10');
  const november = customer.bills.find(row => row.month === '2026-11');
  assert.deepEqual(october.packageSnapshot, octoberSnapshot);
  assert.deepEqual(october.packageSnapshot, createBillPackageSnapshot('3mbps-100gb'));
  assert.deepEqual(november.packageSnapshot, createBillPackageSnapshot('5mbps-150gb'));
  assert.equal(october.dueAmount, 100);
  assert.equal(november.dueAmount, 1500);
  const octoberReceipt = buildPaymentReceipt(customer, october, october.payments[0]);
  const novemberReceipt = buildPaymentReceipt(customer, november, november.payments[0]);
  assert.equal(octoberReceipt.package, '3Mbps / 100GB');
  assert.equal(octoberReceipt.nominalPrice, 100);
  assert.equal(octoberReceipt.dataLimit, '100 GB');
  assert.equal(octoberReceipt.paidAmount, 50);
  assert.equal(octoberReceipt.status, 'PARTIAL');
  assert.equal(novemberReceipt.package, '5Mbps / 150GB');
  assert.equal(novemberReceipt.nominalPrice, 1500);
  assert.equal(novemberReceipt.dataLimit, '150 GB');
  assert.equal(novemberReceipt.paidAmount, 200);
  assert.equal(novemberReceipt.status, 'PARTIAL');
});

test('older bills without a package snapshot are not migrated, inferred, or backfilled', () => {
  const legacyBill = { id:'legacy-2026-09', month:'2026-09', dueAmount:2500, status:'pending', payments:[] };
  const storage = { getItem:() => JSON.stringify({ version:1, customers:[{ id:customerId, customerNumber:1, name:'Synthetic Legacy Customer', packageSpeed:'Legacy 10 Mbps / 300GB', packageDataLimit:'120 GB', bills:[legacyBill] }] }) };
  const restored = readState(storage);
  const bill = restored.customers[0].bills[0];
  assert.equal(Object.hasOwn(bill, 'packageSnapshot'), false);
  assert.equal(bill.dueAmount, 2500);
  const receipt = buildPaymentReceipt(restored.customers[0], bill, { id:'legacy-payment', date:'2026-09-10', amount:100, method:'Cash' });
  assert.equal(receipt.package, 'Legacy 10 Mbps / 300GB', 'legacy package label uses prior profile/history behavior');
  assert.equal(receipt.packageType, 'Limited');
  assert.equal(receipt.dataLimit, '120 GB', 'legacy cap comes only from an explicit saved field, not inferred from its label');
});

test('package snapshots survive backup round-trip while legacy bills remain snapshot-free', () => {
  let state = createInitialState(['Synthetic Backup Package Customer']);
  state = saveBillMonth(state, customerId, { month:'2026-09', dueAmount:'1200', status:'pending' }, referenceDate);
  state = saveBillMonth(state, customerId, { month:'2026-10', dueAmount:null, status:'pending', packageId:'5mbps-200gb' }, referenceDate);
  const backup = createJsonBackup(state, referenceDate);
  const preview = previewJsonBackupMerge(createInitialState([]), backup);
  const customer = preview.state.customers[0];
  const september = customer.bills.find(row => row.month === '2026-09');
  const october = customer.bills.find(row => row.month === '2026-10');
  assert.equal(Object.hasOwn(september, 'packageSnapshot'), false);
  assert.deepEqual(october.packageSnapshot, createBillPackageSnapshot('5mbps-200gb'));
  assert.equal(october.dueAmount, 2000);
  assert.throws(() => previewJsonBackupMerge(createInitialState([]), backup.replace('"nominalPrice": 2000', '"nominalPrice": 75')), /invalid package snapshot/);
});
