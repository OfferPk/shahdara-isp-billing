import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseEasypaisaEmail,
  parseEasypaisaEmails,
  normalizeEasypaisaPhone,
  parseEasypaisaAmount,
  parsePakistanDateTime,
  TEMPLATES
} from '../easypaisa-parser.js';

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

const SAMPLE_MISSING_FEE_EMAIL = `Transaction Successful
Hi AQIB EJAZ,
Money Transfer of Rs. 3500.0 on 14-Oct-2026 to Easypaisa was successful
Transaction Type\tMoney Transfer to Easypaisa
Transaction ID\t57255283699
Date & Time\t14-Oct-2026 10:15:00
Sender Name\tAQIB EJAZ
Sender Number\t03055669955
Receiver Name\tTARIQ MEHMOOD
Receiver Number\t03001122334
Transfer amount\tRs. 3500.0
Total\tRs. 3500.0`;

const SAMPLE_COLON_SEPARATED_EMAIL = `Transaction Successful
Transaction Type: Money Transfer to Easypaisa
Transaction ID: 57255283700
Date & Time: 15-Oct-2026 16:45:12
Sender Name: USMAN ALI
Sender Number: 03019876543
Receiver Name: SHAHID AFRIDI
Receiver Number: 03055669955
Transfer amount: Rs. 12,500.00
Fee: Rs. 25.00
Total: Rs. 12,525.00`;

test('issue #305: parses standard Easypaisa sent email sample and resolves Sent direction', () => {
  const result = parseEasypaisaEmail(SAMPLE_SENT_EMAIL, { ownerNumber: '03055669955' });

  assert.equal(result.status, 'Parsed');
  assert.equal(result.parsed, true);
  assert.equal(result.txnId, '57255283608');
  assert.equal(result.type, 'Money Transfer to Easypaisa');
  assert.equal(result.datetime, '13-Oct-2026 14:20:38');
  assert.equal(result.datetimeIso, '2026-10-13T14:20:38+05:00');
  assert.equal(result.date, '2026-10-13');
  assert.equal(result.senderName, 'AQIB EJAZ');
  assert.equal(result.senderNumber, '03055669955');
  assert.equal(result.receiverName, 'NASIR MAHMOOD');
  assert.equal(result.receiverNumber, '03335001667');
  assert.equal(result.amount, 5000);
  assert.equal(result.fee, 0);
  assert.equal(result.total, 5000);
  assert.equal(result.direction, 'Sent');
});

test('issue #305: resolves Received direction when receiver matches owner number', () => {
  const result = parseEasypaisaEmail(SAMPLE_SENT_EMAIL, { ownerNumber: '03335001667' });

  assert.equal(result.status, 'Parsed');
  assert.equal(result.parsed, true);
  assert.equal(result.txnId, '57255283608');
  assert.equal(result.direction, 'Received');
  assert.equal(result.amount, 5000);
});

test('issue #305: parses missing-fee variant and defaults fee to 0', () => {
  const result = parseEasypaisaEmail(SAMPLE_MISSING_FEE_EMAIL, { ownerNumber: '03055669955' });

  assert.equal(result.status, 'Parsed');
  assert.equal(result.parsed, true);
  assert.equal(result.txnId, '57255283699');
  assert.equal(result.amount, 3500);
  assert.equal(result.fee, 0);
  assert.equal(result.total, 3500);
  assert.equal(result.date, '2026-10-14');
  assert.equal(result.receiverNumber, '03001122334');
});

test('issue #305: handles colon-separated key-values and commas in amount', () => {
  const result = parseEasypaisaEmail(SAMPLE_COLON_SEPARATED_EMAIL, { ownerNumber: '03055669955' });

  assert.equal(result.status, 'Parsed');
  assert.equal(result.parsed, true);
  assert.equal(result.txnId, '57255283700');
  assert.equal(result.amount, 12500);
  assert.equal(result.fee, 25);
  assert.equal(result.total, 12525);
  assert.equal(result.direction, 'Received'); // owner is receiver 03055669955
  assert.equal(result.senderName, 'USMAN ALI');
});

test('issue #305: flags garbage email as Needs review without throwing', () => {
  const garbage = 'Hello John,\nHere is the weekly internet network digest. No transactions here.\nThanks!';
  const result = parseEasypaisaEmail(garbage, { ownerNumber: '03055669955' });

  assert.equal(result.status, 'Needs review');
  assert.equal(result.parsed, false);
  assert.equal(result.txnId, '');
  assert.equal(result.amount, null);
  assert.match(result.reason, /Unrecognized transaction format/i);
});

test('issue #305: flags empty and whitespace-only text as Needs review', () => {
  const empty = parseEasypaisaEmail('');
  assert.equal(empty.status, 'Needs review');
  assert.equal(empty.parsed, false);

  const whitespace = parseEasypaisaEmail('   \n\t  ');
  assert.equal(whitespace.status, 'Needs review');
  assert.equal(whitespace.parsed, false);
});

test('issue #305: parses SMS received notification template', () => {
  const sms = 'You have received Rs. 2000.00 from JOHN DOE (03001234567) in your Easypaisa Account. Trx ID: 57255283609 on 13-Oct-2026 15:30:00';
  const result = parseEasypaisaEmail(sms, { ownerNumber: '03055669955' });

  assert.equal(result.status, 'Parsed');
  assert.equal(result.parsed, true);
  assert.equal(result.txnId, '57255283609');
  assert.equal(result.amount, 2000);
  assert.equal(result.fee, 0);
  assert.equal(result.total, 2000);
  assert.equal(result.senderName, 'JOHN DOE');
  assert.equal(result.senderNumber, '03001234567');
  assert.equal(result.direction, 'Received');
  assert.equal(result.date, '2026-10-13');
});

test('phone normalization: handles standard, formatted, +92 country code, and Urdu digits', () => {
  assert.equal(normalizeEasypaisaPhone('03055669955'), '03055669955');
  assert.equal(normalizeEasypaisaPhone('+92 305 5669955'), '03055669955');
  assert.equal(normalizeEasypaisaPhone('923055669955'), '03055669955');
  assert.equal(normalizeEasypaisaPhone('0305-566-9955'), '03055669955');
  assert.equal(normalizeEasypaisaPhone('3055669955'), '03055669955');
  assert.equal(normalizeEasypaisaPhone('+۹۲ ۳۰۵ ۵۶۶۹۹۵۵'), '03055669955');
  assert.equal(normalizeEasypaisaPhone(''), '');
  assert.equal(normalizeEasypaisaPhone(null), '');
});

test('amount parsing: handles currency prefixes, commas, and plain numbers', () => {
  assert.equal(parseEasypaisaAmount('Rs. 5000.0'), 5000);
  assert.equal(parseEasypaisaAmount('Rs 0.00'), 0);
  assert.equal(parseEasypaisaAmount('PKR 15,250.75'), 15250.75);
  assert.equal(parseEasypaisaAmount(5000), 5000);
  assert.equal(parseEasypaisaAmount(''), null);
  assert.equal(parseEasypaisaAmount(null), null);
  assert.equal(parseEasypaisaAmount('not an amount'), null);
});

test('date parsing: converts word month and ISO to PKT dates and ISO string', () => {
  const dt1 = parsePakistanDateTime('13-Oct-2026 14:20:38');
  assert.equal(dt1.date, '2026-10-13');
  assert.equal(dt1.time, '14:20:38');
  assert.equal(dt1.datetimeIso, '2026-10-13T14:20:38+05:00');

  const dt2 = parsePakistanDateTime('2026-10-13 14:20:38');
  assert.equal(dt2.date, '2026-10-13');
  assert.equal(dt2.datetimeIso, '2026-10-13T14:20:38+05:00');
});

test('batch parsing: parses multiple emails in an array or combined text', () => {
  const batch = parseEasypaisaEmails([SAMPLE_SENT_EMAIL, SAMPLE_MISSING_FEE_EMAIL], { ownerNumber: '03055669955' });
  assert.equal(batch.length, 2);
  assert.equal(batch[0].txnId, '57255283608');
  assert.equal(batch[1].txnId, '57255283699');
});

test('table-driven templates: exposes extensible TEMPLATES array', () => {
  assert.ok(Array.isArray(TEMPLATES));
  assert.ok(TEMPLATES.length >= 3);
  assert.ok(TEMPLATES.every(t => typeof t.name === 'string' && typeof t.matches === 'function' && typeof t.extract === 'function'));
});
