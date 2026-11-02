/**
 * backup-preaction-prompt.test.js — SISP-199: 1-Tap Off-Device Backup Share
 * (SISP-52) Pre-Action Safety Banner in the Billing Cycle & Bulk Import modals.
 *
 * Spec rule, pinned end to end: whenever Backup Health is Due or Critical,
 * BOTH modals show a non-blocking [📤 Share Off-Device Backup First] banner;
 * when Safe, neither does. The banner reuses the ONE shipped derivation
 * (assessBackupHealth via backupPreActionPrompt — no second health
 * computation) and the ONE shipped share flow (shareBackupOffDevice via
 * app.js's handleShareBackupAction — no second export path). A cancelled
 * share records nothing, so the banner persists; a successful off-device
 * share flips health to Safe, so the banner clears on the next render. The
 * billing-cycle run and the import stay enabled throughout.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BACKUP_HEALTH_KEY, assessBackupHealth, backupPreActionPrompt,
  countAllPayments, countPaymentsAfterDate, recordBackupHealthExport,
  shareBackupOffDevice
} from '../backup-health.js';
import { createInitialState, createJsonBackup } from '../core.js';
import { TRANSLATIONS, t } from '../nav-language.js';

const NOW = new Date('2026-10-29T12:00:00.000Z');
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const ago = ms => new Date(NOW.getTime() - ms).toISOString();

function fakeStorage() {
  const map = new Map();
  return {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: key => { map.delete(key); },
    _map: map
  };
}

function syntheticState() {
  const state = createInitialState();
  state.customers = [
    { id: 'c1', bills: [{ month: '2026-10', payments: [{ date: '2026-10-20' }, { date: '2026-10-27' }] }] },
    { id: 'c2', bills: [{ month: '2026-10', payments: [{ date: '2026-10-28' }] }] }
  ];
  return state;
}

// Mirrors app.js's deriveBackupHealth + renderBackupPreActionBanners exactly:
// the SISP-10 record in storage and the payments-since-export math feed the
// one prompt derivation. (app.js's own use of this seam is source-pinned
// below; this helper exists so the lifecycle can be exercised headlessly.)
function promptFromStorage(storage, state, now = NOW) {
  const raw = storage.getItem(BACKUP_HEALTH_KEY);
  const record = raw ? JSON.parse(raw) : { lastExportAt: null, paymentCountAtExport: null };
  let paymentsSinceExport = null;
  if (Number.isSafeInteger(record.paymentCountAtExport)) {
    paymentsSinceExport = Math.max(0, countAllPayments(state) - record.paymentCountAtExport);
  } else if (record.lastExportAt) {
    paymentsSinceExport = countPaymentsAfterDate(state, record.lastExportAt.slice(0, 10));
  }
  return backupPreActionPrompt({ lastExportAt: record.lastExportAt, paymentsSinceExport, now });
}

test('SISP-199: Safe health suppresses the banner (prompt is null)', () => {
  assert.equal(backupPreActionPrompt({ lastExportAt: ago(1 * HOUR), paymentsSinceExport: 0, now: NOW }), null);
  assert.equal(backupPreActionPrompt({ lastExportAt: ago(23 * HOUR), paymentsSinceExport: 9, now: NOW }), null);
});

test('SISP-199: Due health shows the banner (1–3 days old export)', () => {
  const due = backupPreActionPrompt({ lastExportAt: ago(2 * DAY), paymentsSinceExport: 0, now: NOW });
  assert.equal(due.status, 'due');
  assert.equal(due.never, false);
  // Boundaries ride the shipped thresholds: exactly 24h and exactly 3 days are Due.
  assert.equal(backupPreActionPrompt({ lastExportAt: ago(1 * DAY), paymentsSinceExport: 0, now: NOW }).status, 'due');
  assert.equal(backupPreActionPrompt({ lastExportAt: ago(3 * DAY), paymentsSinceExport: 0, now: NOW }).status, 'due');
});

test('SISP-199: Critical health shows the banner (old export OR 10+ unprotected payments)', () => {
  const byAge = backupPreActionPrompt({ lastExportAt: ago(4 * DAY), paymentsSinceExport: 0, now: NOW });
  assert.equal(byAge.status, 'critical');
  assert.equal(byAge.never, false);
  const byPayments = backupPreActionPrompt({ lastExportAt: ago(1 * HOUR), paymentsSinceExport: 10, now: NOW });
  assert.equal(byPayments.status, 'critical');
  assert.equal(byPayments.never, false);
});

test('SISP-199: never-exported is Critical and flagged `never` (its own warning wording)', () => {
  const never = backupPreActionPrompt({ lastExportAt: null, paymentsSinceExport: null, now: NOW });
  assert.equal(never.status, 'critical');
  assert.equal(never.never, true);
  const invalid = backupPreActionPrompt({ lastExportAt: 'not-a-date', paymentsSinceExport: null, now: NOW });
  assert.equal(invalid.status, 'critical');
  assert.equal(invalid.never, true);
  // No-arg call must not throw — it is the never-exported case.
  assert.equal(backupPreActionPrompt().never, true);
});

test('SISP-199: the prompt is assessBackupHealth and nothing else (no second health computation)', () => {
  const cases = [
    { lastExportAt: ago(30 * 60 * 1000), paymentsSinceExport: 0 },
    { lastExportAt: ago(1 * DAY), paymentsSinceExport: 3 },
    { lastExportAt: ago(2 * DAY), paymentsSinceExport: null },
    { lastExportAt: ago(3 * DAY), paymentsSinceExport: 12 },
    { lastExportAt: ago(9 * DAY), paymentsSinceExport: 0 },
    { lastExportAt: null, paymentsSinceExport: null },
    { lastExportAt: 'garbage', paymentsSinceExport: 0 }
  ];
  for (const input of cases) {
    const health = assessBackupHealth({ ...input, now: NOW });
    const prompt = backupPreActionPrompt({ ...input, now: NOW });
    if (health.status === 'safe') {
      assert.equal(prompt, null, `safe must suppress: ${JSON.stringify(input)}`);
    } else {
      assert.equal(prompt.status, health.status, `status must mirror assess: ${JSON.stringify(input)}`);
      assert.equal(prompt.label, health.label);
      assert.equal(prompt.emoji, health.emoji);
    }
  }
});

test('SISP-199: lifecycle — never-exported shows the banner; a CANCELLED share leaves it standing', async () => {
  const state = syntheticState();
  const storage = fakeStorage();
  assert.equal(promptFromStorage(storage, state)?.never, true, 'fresh device: banner up (never exported)');
  const result = await shareBackupOffDevice({
    backupText: createJsonBackup(state, NOW), filename: 'b.json', state, storage,
    shareFile: async () => ({ method: 'cancelled' }), now: NOW
  });
  assert.equal(result.healthRecord, null, 'cancelled share records nothing (shipped SISP-52 rule)');
  assert.ok(promptFromStorage(storage, state), 'banner persists after a cancelled share');
});

test('SISP-199: lifecycle — a successful share (and the download fallback) flips health Safe and the banner clears', async () => {
  for (const method of ['share', 'download']) {
    const state = syntheticState();
    const storage = fakeStorage();
    assert.ok(promptFromStorage(storage, state), `precondition: banner up before ${method}`);
    const result = await shareBackupOffDevice({
      backupText: createJsonBackup(state, NOW), filename: 'b.json', state, storage,
      shareFile: async () => ({ method }), now: NOW
    });
    assert.ok(result.healthRecord, `${method} must record the export`);
    assert.equal(promptFromStorage(storage, state), null, `banner gone on re-render after ${method}`);
  }
});

test('SISP-199: status is re-derived at open — a backup taken elsewhere between opens is honoured', () => {
  const state = syntheticState();
  const storage = fakeStorage();
  // Export 2 days ago → Due at this "open".
  recordBackupHealthExport(storage, state, new Date(NOW.getTime() - 2 * DAY));
  assert.equal(promptFromStorage(storage, state)?.status, 'due');
  // The owner shares a backup from another surface; at the NEXT open the
  // banner must already be gone — no status cached from the previous open.
  recordBackupHealthExport(storage, state, NOW);
  assert.equal(promptFromStorage(storage, state), null);
});

test('SISP-199: wiring — both modals carry the banner slot before their action controls, starting hidden (Safe default)', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const cycleModalAt = html.indexOf('id="billingCycleModal"');
  const cycleBannerAt = html.indexOf('id="billingCycleBackupBanner"');
  const cycleConfirmAt = html.indexOf('id="billingCycleConfirmBtn"');
  assert.ok(cycleModalAt !== -1 && cycleBannerAt > cycleModalAt && cycleBannerAt < cycleConfirmAt,
    'billing-cycle banner must sit inside the cycle modal, above the confirm button');
  const importModalAt = html.indexOf('id="bulkImportModal"');
  const importBannerAt = html.indexOf('id="bulkImportBackupBanner"');
  const importBtnAt = html.indexOf('id="bciImportBtn"');
  assert.ok(importModalAt !== -1 && importBannerAt > importModalAt && importBannerAt < importBtnAt,
    'bulk-import banner must sit inside the import modal, above the import button');
  for (const bannerId of ['billingCycleBackupBanner', 'bulkImportBackupBanner']) {
    assert.match(html, new RegExp(`id="${bannerId}" class="backup-preaction-banner" role="alert" hidden`),
      `${bannerId} starts hidden — app.js unhides it only when health is Due/Critical`);
  }
  for (const btnId of ['billingCycleBackupShareBtn', 'bulkImportBackupShareBtn']) {
    assert.match(html, new RegExp(`id="${btnId}"[^>]*>📤 <span data-i18n="bkup_preaction_share_btn">Share Off-Device Backup First</span>`),
      `${btnId} carries the spec's 1-tap share label`);
  }
});

test('SISP-199: wiring — app.js renders both banners from the shared derivation and the real share flow', () => {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(app, /backupPreActionPrompt[,\s}]/, 'app.js imports backupPreActionPrompt from backup-health.js');
  // One implementation, two mounts.
  assert.match(app, /BACKUP_PREACTION_BANNERS = \[/);
  assert.match(app, /'#billingCycleBackupBanner'/);
  assert.match(app, /'#bulkImportBackupBanner'/);
  // Badge and banners share the ONE derivation (definition + exactly two call sites).
  assert.equal(app.split('deriveBackupHealth();').length - 1, 2, 'badge + banner must both call deriveBackupHealth()');
  // The banners refresh on the same updateDataSafetyUi pass as the badge.
  assert.match(app, /renderBackupHealthBadge\(\);\n  renderBackupPreActionBanners\(\);/);
  // Both banner buttons run the REAL SISP-52 share flow (handleShareBackupAction).
  assert.match(app, /\$\('#billingCycleBackupShareBtn'\)\?\.addEventListener\('click', handleShareBackupAction\)/);
  assert.match(app, /\$\('#bulkImportBackupShareBtn'\)\?\.addEventListener\('click', handleShareBackupAction\)/);
  // Fresh derivation at every modal open — no cached status.
  assert.match(app, /\$\('#openBillingCycleModalBtn'\)\?\.addEventListener\('click', \(\) => renderBackupPreActionBanners\(\)\)/);
  assert.match(app, /\$\('#bulkImportOpenBtn'\)\?\.addEventListener\('click', \(\) => renderBackupPreActionBanners\(\)\)/);
});

test('SISP-199: NON-BLOCKING — the banner render never touches the cycle/import controls', () => {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const start = app.indexOf('function renderBackupPreActionBanners()');
  assert.ok(start !== -1);
  const body = app.slice(start, app.indexOf('\n}', start));
  assert.doesNotMatch(body, /disabled|billingCycleConfirmBtn|bciImportBtn|bciNextBtn|showModal|preventDefault/,
    'banner render must not disable, hide, delay or gate the underlying actions');
  assert.match(body, /backupPreActionPrompt\(/, 'banner visibility derives from the prompt model only');
});

test('SISP-199: i18n — every banner string resolves in en + ur (no raw keys ever render)', () => {
  const keys = ['bkup_preaction_share_btn', 'bkup_preaction_due', 'bkup_preaction_critical', 'bkup_preaction_never'];
  for (const key of keys) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `${key} missing in en`);
    assert.ok(TRANSLATIONS.en[key].length > 0);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `${key} missing in ur`);
    assert.ok(TRANSLATIONS.ur[key].length > 0);
    assert.notEqual(t(key, 'en'), key, `t('${key}','en') must resolve, not echo the key`);
    assert.notEqual(t(key, 'ur'), key, `t('${key}','ur') must resolve, not echo the key`);
  }
  assert.equal(t('bkup_preaction_share_btn', 'en'), 'Share Off-Device Backup First');
  // Mechanical audit: every bkup_preaction_* key app.js references exists in both dicts.
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const used = new Set([...app.matchAll(/'(bkup_preaction_[a-z_]+)'/g)].map(m => m[1]));
  assert.deepEqual([...used].sort(), ['bkup_preaction_critical', 'bkup_preaction_due', 'bkup_preaction_never']);
  for (const key of used) {
    assert.ok(TRANSLATIONS.en[key] && TRANSLATIONS.ur[key], `${key} used by app.js must exist in en + ur`);
  }
});
