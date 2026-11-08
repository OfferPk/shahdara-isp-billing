import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TRANSLATIONS, t } from '../nav-language.js';
import { formatPKR } from '../core.js';

const appSrc = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const navSrc = readFileSync(new URL('../nav-language.js', import.meta.url), 'utf8');

test('Plan 505: the Waada current-promise amount renders through the shared PKR formatter', () => {
  assert.ok(
    appSrc.includes('formatAmount(customer.promiseAmount)'),
    'the Waada line must render the promised amount with formatAmount (== formatPKR)'
  );
  assert.ok(
    !appSrc.includes('PKR ${Number(customer.promiseAmount).toLocaleString()}'),
    'the hand-rolled "PKR ${Number(...).toLocaleString()}" Waada amount must be gone'
  );
});

test('Plan 505: the ticket billed row renders through the shared PKR formatter', () => {
  assert.ok(
    appSrc.includes("{ amount: formatAmount(t.billedAmount) }"),
    'the billed ticket row must pass formatAmount(t.billedAmount) to prof_ticket_billed'
  );
  assert.ok(
    !appSrc.includes("{ amount: t.billedAmount }"),
    'the billed ticket row must no longer interpolate the raw billedAmount'
  );
});

test('Plan 505: the pending ticket line still uses the shared formatter (precedent)', () => {
  assert.ok(
    appSrc.includes('formatAmount(ticketPending)'),
    'the pending ticket charges line already renders through formatAmount and must stay that way'
  );
});

test('Plan 505: a promised amount of PKR 1,000 reads "PKR 1,000" exactly like dues and bills', () => {
  assert.equal(formatPKR(1000), 'PKR 1,000');
  assert.equal(formatPKR('1000'), 'PKR 1,000');
  // Min-0 decimals, same as every other money figure on the profile.
  assert.equal(formatPKR(1500.5), 'PKR 1,500.50');
  assert.equal(formatPKR(0), 'PKR 0');
});

test('Plan 505: the shared formatter carries the "Not set" path the hand-rolled line lacked', () => {
  assert.equal(formatPKR(null), 'Not set');
  assert.equal(formatPKR(undefined), 'Not set');
  assert.equal(formatPKR(''), 'Not set');
  // A truthy but non-numeric promise read "PKR NaN" before; now it reads "Not set".
  assert.equal(formatPKR('abc'), 'Not set');
});

test('Plan 505: prof_ticket_billed carries no literal PKR — the amount param carries it', () => {
  assert.equal(TRANSLATIONS.en.prof_ticket_billed, ' · Billed {amount}');
  assert.equal(TRANSLATIONS.ur.prof_ticket_billed, ' · بل شدہ {amount}');
  assert.ok(!TRANSLATIONS.en.prof_ticket_billed.includes('PKR'));
  assert.ok(!TRANSLATIONS.ur.prof_ticket_billed.includes('PKR'));
  // Urdu script, not a params-only or Latin value (Plan 472 rule).
  assert.match(TRANSLATIONS.ur.prof_ticket_billed, /[\u0600-\u06FF]/);
  assert.equal(
    (navSrc.match(/prof_ticket_billed:/g) || []).length,
    2,
    'exactly one definition per language dictionary'
  );
});

test('Plan 505: a billed ticket charge reads "PKR 1,000" in both languages, no bare number', () => {
  assert.equal(
    t('prof_ticket_billed', 'en', { amount: formatPKR(1000) }),
    ' · Billed PKR 1,000'
  );
  assert.equal(
    t('prof_ticket_billed', 'ur', { amount: formatPKR(1000) }),
    ' · بل شدہ PKR 1,000'
  );
  assert.equal(
    t('prof_ticket_billed', 'en', { amount: formatPKR(2500.5) }),
    ' · Billed PKR 2,500.50'
  );
  // No doubled PKR prefix, no bare number anywhere in the composed line.
  assert.ok(!t('prof_ticket_billed', 'en', { amount: formatPKR(1000) }).includes('PKR PKR'));
  assert.ok(!/Billed \d/.test(t('prof_ticket_billed', 'en', { amount: formatPKR(1000) })));
});

test('Plan 505: amounts stay PKR only (Rs)', () => {
  for (const amount of [1000, 1500, 1600, 2000, 2500, 3000]) {
    const rendered = formatPKR(amount);
    assert.match(rendered, /^PKR /, `PKR ${amount} must read in PKR only, got ${rendered}`);
    assert.ok(!/[€$£]/.test(rendered), 'no other currency symbol');
  }
});
