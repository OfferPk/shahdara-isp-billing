// Sharafat 43: the ageing "As of" date is a UTC date labelled PKT —
// `ref.toISOString().slice(0, 10)` lags a day behind in 00:00–04:59 PKT,
// so a small-hours export was dated yesterday while its text said PKT.
// The fix formats the date in Asia/Karachi via the module's own
// `formatDateYmd` at all four sites (breakdown, CSV, briefing, filename).
// Every fixture here is synthetic; no real customer names or phone numbers.
//
// Parent decisions (2026-11-15 ~02:00 PKT): (D1) (a) fix the filename site
// too; (D2) (a) fix `referenceDateStr` too; (D3) (a) keep the "As of … PKT"
// literals unchanged; (D4) (a) new dedicated test file.
//
// The doc's bug window is BACKWARDS (proven by execution): PKT = UTC+5, so
// the UTC date lags only in 00:00–04:59 PKT; at 05:00 PKT UTC catches up,
// and an evening export always carried the correct date. The tests below
// pin the TRUE window, not the doc's "after ~05:00 PKT" wording.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInitialState } from '../core.js';
import {
  formatDateYmd,
  calculateDuesAgingBreakdown,
  generateDuesAgingCsv,
  generateDuesAgingBriefing,
} from '../dashboard-dues-aging.js';

// 2026-11-12 02:00 PKT — the acceptance instant (inside the 00:00–04:59
// window, where the UTC slice is the previous day).
const ACCEPTANCE_REF = new Date('2026-11-11T21:00:00Z');
// An empty roster still produces the full breakdown shape, so the date
// surfaces can be read without any customer fixture.
const breakdownAt = (ref) => calculateDuesAgingBreakdown(createInitialState([]), ref);

test('Sharafat 43: acceptance instant dates every surface 2026-11-12, never 2026-11-11', () => {
  const ref = ACCEPTANCE_REF;
  const data = breakdownAt(ref);
  assert.equal(data.referenceDateStr, '2026-11-12');
  const csv = generateDuesAgingCsv(data, ref);
  assert.match(csv, /As of 2026-11-12 PKT/);
  assert.doesNotMatch(csv, /As of 2026-11-11 PKT/);
  const briefing = generateDuesAgingBriefing(data, ref);
  assert.match(briefing, /As of: 2026-11-12 PKT/);
  assert.doesNotMatch(briefing, /As of: 2026-11-11 PKT/);
  // The export filename is built inside the modal's click handler, so it
  // is pinned by source assertion (Sharafat 40's render-pin pattern):
  // the handler must date the file with the same PKT formatter.
  const source = readFileSync(new URL('../dashboard-dues-aging.js', import.meta.url), 'utf8');
  assert.match(source, /const dateStr = formatDateYmd\(options\.referenceDate \|\| new Date\(\)\);/);
  assert.match(source, /`shahdara-dues-aging-\$\{dateStr\}\.csv`/);
  assert.equal(formatDateYmd(ref), '2026-11-12');
  assert.doesNotMatch(data.referenceDateStr, /2026-11-11/);
});

test('Sharafat 43: midnight PKT boundary — 00:00 is the new day, 23:59 the old one', () => {
  // 2026-11-12 00:00 PKT = 2026-11-11T19:00:00Z — UTC is still 2026-11-11.
  const midnight = new Date('2026-11-11T19:00:00Z');
  assert.equal(breakdownAt(midnight).referenceDateStr, '2026-11-12');
  assert.match(generateDuesAgingCsv(breakdownAt(midnight), midnight), /As of 2026-11-12 PKT/);
  assert.match(generateDuesAgingBriefing(breakdownAt(midnight), midnight), /As of: 2026-11-12 PKT/);
  // 2026-11-11 23:59 PKT = 2026-11-11T18:59:00Z — both clocks agree on 11th.
  const beforeMidnight = new Date('2026-11-11T18:59:00Z');
  assert.equal(breakdownAt(beforeMidnight).referenceDateStr, '2026-11-11');
  assert.match(generateDuesAgingCsv(breakdownAt(beforeMidnight), beforeMidnight), /As of 2026-11-11 PKT/);
});

test('Sharafat 43: daylight control — outside 00:00–04:59 PKT nothing changes', () => {
  // The existing ageing suite's ref: 2026-10-17 12:00 PKT = 07:00 UTC.
  // UTC and PKT agree on the date here, so the fix is a no-op.
  const ref = new Date('2026-10-17T12:00:00+05:00');
  const data = breakdownAt(ref);
  assert.equal(data.referenceDateStr, '2026-10-17');
  assert.match(generateDuesAgingCsv(data, ref), /As of 2026-10-17 PKT/);
  assert.match(generateDuesAgingBriefing(data, ref), /As of: 2026-10-17 PKT/);
  assert.equal(formatDateYmd(ref), '2026-10-17');
  // Evening control: 22:00 PKT = 17:00 UTC — the doc claimed an evening
  // export was dated yesterday; both clocks agree on the date here too.
  const evening = new Date('2026-11-12T17:00:00Z');
  assert.equal(breakdownAt(evening).referenceDateStr, '2026-11-12');
});

test('Sharafat 43: formatDateYmd never throws on a missing or invalid date', () => {
  assert.equal(formatDateYmd(null), '');
  assert.equal(formatDateYmd(undefined), '');
  assert.equal(formatDateYmd(new Date('not-a-date')), '');
});
