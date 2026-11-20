// Hisaab provider summary — the pending-bill summary line shows the
// amount without clicking. Short month in EN ("Nov '26") + no trailing
// status; UR keeps the full month name (measured to fit once the status
// is dropped). No jsdom in the repo, so DOM assertions are runtime
// tests over the real pure modules + source-scan pins over the real
// app.js — the established pattern. Generic fixtures only; no seed
// figures, no customer names, no phone numbers anywhere in this file.
//
// Fit, measured with the app's real fonts at 12px bold (the summary
// size) against 232px available at 360px (card inner 304px minus the
// 72px FAB reserve): EN "Nayatel: Nov '26 bill PKR 60,575" is 211px
// (the old full line was 329px); UR "نومبر 2026 بل PKR 60,575" is
// 216px (219px for the longest month, the old line 275px). The
// on-phone 360px check is still owed after deploy.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TRANSLATIONS, t } from '../nav-language.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');

// The summary-line shape, exactly as the render builds it: the pending
// template with the short month, trailing status split off, satellite +
// provider + chevron. The helper itself lives in app.js (the bundle is
// never imported in node), so the month values below are the helper's
// outputs, pinned by the source-scan test.
function summaryLine(name, month, amount, lang) {
  const pendingFull = t('hisaab_provider_pending', lang, { month, amount });
  return `📡 ${name}: ${pendingFull.split(' — ')[0]} ▾`;
}

test('hisaab summary short month (1): EN pending line shows the short month and the full amount, no trailing status', () => {
  assert.equal(
    summaryLine('Nayatel', "Nov '26", 'PKR 42,750', 'en'),
    "📡 Nayatel: Nov '26 bill PKR 42,750 ▾",
  );
  // Generic, not provider/month/amount-specific: any provider, any
  // month, any amount composes the same way.
  assert.equal(
    summaryLine('Transworld', "Sep '26", 'PKR 1,234,567', 'en'),
    "📡 Transworld: Sep '26 bill PKR 1,234,567 ▾",
  );
  // The new line is shorter than the old full-template line, so the
  // amount survives the ellipsis instead of being cut.
  const oldLine = `📡 Nayatel: ${t('hisaab_provider_pending', 'en', { month: 'November 2026', amount: 'PKR 42,750' })} ▾`;
  assert.ok(summaryLine('Nayatel', "Nov '26", 'PKR 42,750', 'en').length < oldLine.length, 'short line beats the old line');
  assert.ok(oldLine.includes(' — abhi baqi'), 'the old line carried the trailing status');
});

test('hisaab summary short month (2): UR keeps the full month name, drops only the trailing status', () => {
  assert.equal(
    summaryLine('Nayatel', 'نومبر 2026', 'PKR 42,750', 'ur'),
    '📡 Nayatel: نومبر 2026 بل PKR 42,750 ▾',
  );
  assert.equal(
    summaryLine('Transworld', 'اکتوبر 2026', 'PKR 1,234,567', 'ur'),
    '📡 Transworld: اکتوبر 2026 بل PKR 1,234,567 ▾',
  );
});

test('hisaab summary short month (3): the template still carries the suffix in both dicts — the full lines keep it', () => {
  assert.ok(TRANSLATIONS.en.hisaab_provider_pending.endsWith(' — abhi baqi'), 'EN template keeps the suffix');
  assert.ok(TRANSLATIONS.ur.hisaab_provider_pending.endsWith(' — ابھی باقی'), 'UR template keeps the suffix');
  assert.equal(
    t('hisaab_provider_pending', 'en', { month: "Nov '26", amount: 'PKR 42,750' }),
    "Nov '26 bill PKR 42,750 — abhi baqi",
  );
});

test('hisaab summary short month (4): the render wires the summary branch to the short helper; the full lines stay long-form', () => {
  // The summary branch (providerSummaryEl) uses the short helper and
  // strips the trailing status; it no longer calls displayMonthName
  // on the pending bill.
  const summaryAt = appJs.indexOf("$('#hisaabProviderSummary')");
  assert.ok(summaryAt >= 0, 'render writes the provider summary');
  const summaryBlock = appJs.slice(summaryAt, summaryAt + 2200);
  assert.ok(summaryBlock.includes('shortHisaabPendingMonth(firstSummary.pendingBill.month)'), 'summary uses the short month');
  assert.ok(summaryBlock.includes("split(' — ')[0]"), 'summary strips the trailing status');
  assert.ok(!summaryBlock.includes('displayMonthName(firstSummary.pendingBill.month)'), 'summary no longer uses the long month');
  // The full provider lines inside the <details> still use the long
  // month + the full template with its suffix.
  assert.ok(appJs.includes('displayMonthName(summary.pendingBill.month)'), 'full lines keep the long month');
  assert.ok(appJs.includes("t('hisaab_provider_pending', null, { month: displayMonthName(summary.pendingBill.month)"), 'full lines keep the full template');
  // The helper itself: 12 short names, "'YY" year, UR early-returns
  // the full month name, malformed keys fall back to displayMonthName.
  assert.ok(appJs.includes("const HISAAB_SHORT_MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];"), 'helper carries the 12 short names');
  assert.ok(appJs.includes("if (currentAppLanguage() === 'ur') return displayMonthName(month);"), 'UR keeps the full month name');
  assert.ok(appJs.includes("return `${HISAAB_SHORT_MONTH_NAMES[monthIndex]} '${parts[1].slice(2)}`;"), 'helper formats the short month');
  assert.ok(appJs.includes('if (!parts) return displayMonthName(month);'), 'malformed keys fall back');
});
