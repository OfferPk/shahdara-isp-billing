import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const appsScript = require('../integrations/gmail-easypaisa/Code.gs');

const SAMPLE_SENT_EMAIL = `Transaction Successful
Hi AQIB EJAZ,
Money Transfer of Rs. 5000.0 on 13-Oct-2026 to Easypaisa was successful
Transaction Type\tMoney Transfer to Easypaisa
Transaction ID\t57255283608
Date & Time\t13-Oct-2026 14:20:38
Sender Name\tAQIB EJAZ
Sender Number\t03055669955
Receiver Name\tNASIR MAHMOOD
Receiver Number\t03335001667
Transfer amount\tRs. 5000.0
Fee\tRs. 0.00
Total\tRs. 5000.0`;

const SAMPLE_RECEIVED_EMAIL = `Transaction Successful
Hi AQIB EJAZ,
Money Transfer of Rs. 3500.0 on 13-Oct-2026 from Easypaisa was successful
Transaction Type\tMoney Transfer from Easypaisa
Transaction ID\t57255283610
Date & Time\t13-Oct-2026 15:45:12
Sender Name\tHAMZA RIAZ
Sender Number\t03123456789
Receiver Name\tAQIB EJAZ
Receiver Number\t03055669955
Transfer amount\tRs. 3500.0
Fee\tRs. 0.00
Total\tRs. 3500.0`;

const SAMPLE_SMS = `You have received Rs. 2000.00 from JOHN DOE (03001234567) in your Easypaisa Account. Trx ID: 57255283609 on 13-Oct-2026 15:30:00`;

test('issue #305 (Apps Script): exports CONFIG and HEADERS matching requirements', () => {
  assert.ok(appsScript.CONFIG, 'CONFIG must be defined');
  assert.equal(appsScript.CONFIG.LABEL_NAME, 'crm-processed');
  assert.ok(Array.isArray(appsScript.HEADERS), 'HEADERS must be an array');
  assert.equal(appsScript.HEADERS[0], 'Transaction ID');
  assert.equal(appsScript.HEADERS[4], 'Direction');
  assert.equal(appsScript.HEADERS[5], 'Amount (PKR)');
});

test('issue #305 (Apps Script): parses standard sent email sample and resolves Sent direction', () => {
  const result = appsScript.parseEasypaisaEmailText(SAMPLE_SENT_EMAIL, {
    ownerNumber: '03055669955'
  });

  assert.equal(result.status, 'Parsed');
  assert.equal(result.txnId, '57255283608');
  assert.equal(result.amount, 5000);
  assert.equal(result.fee, 0);
  assert.equal(result.total, 5000);
  assert.equal(result.senderNumber, '03055669955');
  assert.equal(result.receiverNumber, '03335001667');
  assert.equal(result.senderName, 'AQIB EJAZ');
  assert.equal(result.receiverName, 'NASIR MAHMOOD');
  assert.equal(result.direction, 'Sent');
  assert.equal(result.date, '2026-10-13');
});

test('issue #305 (Apps Script): parses received email and resolves Received direction based on ownerNumber', () => {
  const result = appsScript.parseEasypaisaEmailText(SAMPLE_RECEIVED_EMAIL, {
    ownerNumber: '03055669955'
  });

  assert.equal(result.status, 'Parsed');
  assert.equal(result.txnId, '57255283610');
  assert.equal(result.amount, 3500);
  assert.equal(result.direction, 'Received');
  assert.equal(result.senderName, 'HAMZA RIAZ');
  assert.equal(result.senderNumber, '03123456789');
  assert.equal(result.receiverNumber, '03055669955');
});

test('issue #305 (Apps Script): parses SMS notification template', () => {
  const result = appsScript.parseEasypaisaEmailText(SAMPLE_SMS, {
    ownerNumber: '03055669955'
  });

  assert.equal(result.status, 'Parsed');
  assert.equal(result.txnId, '57255283609');
  assert.equal(result.amount, 2000);
  assert.equal(result.direction, 'Received');
  assert.equal(result.senderName, 'JOHN DOE');
  assert.equal(result.senderNumber, '03001234567');
  assert.equal(result.date, '2026-10-13');
});

test('issue #305 (Apps Script): flags invalid or garbage emails as Needs review without throwing', () => {
  const garbageResult = appsScript.parseEasypaisaEmailText('Hello world, this is a random email with no transactions', {
    subject: 'Spam Subject'
  });
  assert.equal(garbageResult.status, 'Needs review');
  assert.equal(garbageResult.amount, null);
  assert.match(garbageResult.notes, /Spam Subject/);

  const emptyResult = appsScript.parseEasypaisaEmailText('');
  assert.equal(emptyResult.status, 'Needs review');
});

test('issue #305 (Apps Script): buildRowFromTxn generates valid spreadsheet row matching HEADERS length', () => {
  const parsed = appsScript.parseEasypaisaEmailText(SAMPLE_SENT_EMAIL, {
    ownerNumber: '03055669955'
  });
  const row = appsScript.buildRowFromTxn(parsed);

  assert.ok(Array.isArray(row));
  assert.equal(row.length, appsScript.HEADERS.length, 'Row length must match HEADERS length');
  assert.equal(row[0], '57255283608'); // Col A: Transaction ID
  assert.equal(row[2], '2026-10-13');   // Col C: Date
  assert.equal(row[4], 'Sent');         // Col E: Direction
  assert.equal(row[5], 5000);           // Col F: Amount
  assert.equal(row[6], 0);              // Col G: Fee
  assert.equal(row[7], 5000);           // Col H: Total
  assert.equal(row[8], 'AQIB EJAZ');     // Col I: Sender Name
  assert.equal(row[9], '03055669955');   // Col J: Sender Number
  assert.equal(row[10], 'NASIR MAHMOOD'); // Col K: Receiver Name
  assert.equal(row[11], '03335001667'); // Col L: Receiver Number
  assert.equal(row[12], 'Parsed');      // Col M: Status
});
