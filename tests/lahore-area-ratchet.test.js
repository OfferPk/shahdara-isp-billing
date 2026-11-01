import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// FU-LAHORE-SWEEP ratchet: the owner's Shahdara is the village near
// ISLAMABAD (Margalla side), NOT the Shahdara in Lahore. No shipped
// source module may carry 'Shahdara, Lahore' / 'Shahdara Lahore' as the
// business's own area/address default on printed documents, receipts,
// map queries or report letterheads. Occurrences of Lahore as a
// genuinely different place (PKIX Lahore IX, PTCL Lahore Metro pool,
// Lahore Ring interconnect destinations, CNIC province reference data,
// weather-scenario names, customer-address test fixtures) do not match
// these two patterns and stay untouched.
//
// This ratchet covers EVERY shipped module with no exemptions:
// FU-SISP155-HEADER has landed, so lineman-payout-slip.js also defaults
// to 'Shahdara, Islamabad' now.
const WRONG_AREA_PATTERNS = ['Shahdara, Lahore', 'Shahdara Lahore'];

function shippedSourceFiles() {
  const names = [];
  for (const name of fs.readdirSync(root)) {
    if (name.endsWith('.js') || name === 'index.html') names.push(name);
  }
  return names;
}

test('no shipped source module defaults the business area to Lahore', () => {
  const offenders = [];
  for (const name of shippedSourceFiles()) {
    const lines = fs.readFileSync(path.join(root, name), 'utf8').split('\n');
    lines.forEach((line, idx) => {
      for (const pattern of WRONG_AREA_PATTERNS) {
        if (line.includes(pattern)) offenders.push(`${name}:${idx + 1} (${pattern})`);
      }
    });
  }
  assert.deepEqual(offenders, []);
});

test('receipt builders default the printed area to Shahdara, Islamabad', () => {
  const receiptSource = fs.readFileSync(path.join(root, 'receipt.js'), 'utf8');
  const receiptDefaults = receiptSource.split("areaName = 'Shahdara, Islamabad'").length - 1;
  assert.ok(receiptDefaults >= 3, `expected >=3 corrected receipt areaName defaults, found ${receiptDefaults}`);
  const splitTenderSource = fs.readFileSync(path.join(root, 'split-tender-collect.js'), 'utf8');
  assert.ok(splitTenderSource.includes("areaName = 'Shahdara, Islamabad'"));
});
