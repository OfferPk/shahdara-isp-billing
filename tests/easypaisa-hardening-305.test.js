// Issue #305 hardening (lane:muse follow-up): the Payments Inbox CSV
// importer must never silently misread the system's own Google Sheet
// layout, must flag phone-shaped or absurd "amounts" for review instead
// of recording them as money, must not use a date as a transaction id,
// and must not ship a real person's mobile number as a default setting.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseEasypaisaCsv } from '../easypaisa-parser.js';
import { DEFAULT_SETTINGS } from '../payments-inbox.js';

// Exact column order written by integrations/gmail-easypaisa/Code.gs.
const SHEET_HEADERS = 'Transaction ID,Date & Time,Date,Type,Direction,Amount (PKR),Fee (PKR),Total (PKR),Sender Name,Sender Number,Receiver Name,Receiver Number,Status,Notes / Reason,Processed At';
const SHEET_ROW = '57255283608,13-Oct-2026 14:20:38,2026-10-13,Money Transfer to Easypaisa,Sent,5000,0,5000,AQIB EJAZ,03055669955,NASIR MAHMOOD,03335001667,Parsed,,2026-10-13T09:30:00.000Z';

test('305 hardening: Apps Script sheet CSV (with headers) parses by name', () => {
  const [row] = parseEasypaisaCsv(`${SHEET_HEADERS}\n${SHEET_ROW}`, { ownerNumber: '03055669955' });
  assert.equal(row.txnId, '57255283608');
  assert.equal(row.amount, 5000);
  assert.equal(row.fee, 0);
  assert.equal(row.total, 5000);
  assert.equal(row.direction, 'Sent');
  assert.equal(row.senderName, 'AQIB EJAZ');
  assert.equal(row.senderNumber, '03055669955');
  assert.equal(row.receiverNumber, '03335001667');
  assert.equal(row.status, 'Parsed');
});

test('305 hardening: headerless sheet-layout rows are detected, not misread positionally', () => {
  const [row] = parseEasypaisaCsv(SHEET_ROW, { ownerNumber: '03055669955' });
  assert.equal(row.txnId, '57255283608');
  assert.equal(row.amount, 5000);
  assert.equal(row.total, 5000);
  assert.equal(row.senderName, 'AQIB EJAZ');
  assert.equal(row.senderNumber, '03055669955');
  assert.equal(row.receiverName, 'NASIR MAHMOOD');
  assert.equal(row.direction, 'Sent');
  assert.equal(row.status, 'Parsed');
});

test('305 hardening: a phone number in the amount column is Needs review, never Parsed money', () => {
  const csv = `Transaction ID,Date & Time,Type,Sender Name,Sender Number,Receiver Name,Receiver Number,Amount (PKR),Fee (PKR),Total (PKR),Direction,Status
57255283609,13-Oct-2026 15:00:00,Money Transfer,AQIB EJAZ,03055669955,NASIR MAHMOOD,03335001667,03055669955,0,5000,Sent,Parsed`;
  const [row] = parseEasypaisaCsv(csv, { ownerNumber: '03055669955' });
  assert.equal(row.status, 'Needs review');
  assert.equal(row.parsed, false);
});

test('305 hardening: an absurd total (billions) is Needs review', () => {
  const csv = `Transaction ID,Date & Time,Type,Sender Name,Sender Number,Receiver Name,Receiver Number,Amount (PKR),Fee (PKR),Total (PKR),Direction,Status
57255283610,13-Oct-2026 15:00:00,Money Transfer,AQIB EJAZ,03055669955,NASIR MAHMOOD,03335001667,5000,0,3055669955,Sent,Parsed`;
  const [row] = parseEasypaisaCsv(csv, { ownerNumber: '03055669955' });
  assert.equal(row.status, 'Needs review');
  assert.equal(row.parsed, false);
});

test('305 hardening: a date in the first column is never used as the transaction id', () => {
  const csv = '13-Oct-2026 14:20:38,Money Transfer,AQIB EJAZ,03055669955,NASIR MAHMOOD,03335001667,5000';
  const [row] = parseEasypaisaCsv(csv, {});
  assert.notEqual(row.txnId, '13-Oct-2026 14:20:38');
  assert.equal(row.status, 'Needs review');
  assert.equal(row.parsed, false);
});

test('305 hardening: no real mobile number ships as a default', () => {
  assert.ok(!/^03\d{9}$/.test(DEFAULT_SETTINGS.ownerNumber), 'app default ownerNumber must be empty or a placeholder');
  const code = readFileSync(new URL('../integrations/gmail-easypaisa/Code.gs', import.meta.url), 'utf8');
  const configured = code.match(/OWNER_NUMBER:\s*'([^']*)'/);
  assert.ok(configured, 'Code.gs keeps an OWNER_NUMBER config entry');
  assert.ok(!/^03\d{9}$/.test(configured[1]), 'Code.gs default OWNER_NUMBER must be a placeholder the user replaces');
});
