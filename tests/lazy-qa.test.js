// FIRST-LOAD SPLIT (2026-10-28): QA-certification modals load lazily.
// The loader is tested with fake importers (the real dynamic import is only
// exercised through the build: QA code must NOT appear in the static
// first-load graph — see the build verification in the phase report).
// Pattern mirrors tests/lazy-telecom.test.js (SISP-9).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  loadQaSetups,
  isQaSetupsLoaded,
  resetQaLoaderForTests
} from '../lazy-qa.js';
import * as qaSetups from '../qa-setups.js';
import * as formValidation from '../form-validation.js';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');

const QA_SETUP_NAMES = [
  'setupAdssSagTensionModal', 'setupArmoredCableCrushModal', 'setupBendLossCertModal',
  'setupBidirectionalOtdrModal', 'setupBillingCorrectnessModal', 'setupCableJettingModal',
  'setupConduitPullingModal', 'setupDdmiCertModal', 'setupDispersionCertModal',
  'setupFastConnectorQaModal', 'setupFerruleGeometryModal', 'setupFiberCleaveQualityModal',
  'setupFoscSealModal', 'setupFusionArcQaModal', 'setupLateFeeModal', 'setupOrlCertModal',
  'setupOtdrDeadzoneModal', 'setupOtdrGhostArtifactModal', 'setupRibbonSpliceQaModal',
  'setupSpectralAttenuationModal', 'setupSpliceMfdOffsetModal', 'setupSpliceSleeveCureModal',
  'setupSplitterQaModal', 'setupStripForceQaModal', 'setupThermalCyclingModal',
  'setupTubeSlittingAccessModal'
];

test('loadQaSetups imports once and shares the promise', async () => {
  resetQaLoaderForTests();
  let imports = 0;
  const importer = () => { imports += 1; return Promise.resolve({ marker: true }); };
  const [a, b] = await Promise.all([loadQaSetups(importer), loadQaSetups(importer)]);
  assert.equal(imports, 1);
  assert.equal(a, b);
  assert.equal(isQaSetupsLoaded(), true);
  await loadQaSetups(importer);
  assert.equal(imports, 1, 'cached module is reused, not re-imported');
});

test('a failed load clears the cache so the next call retries', async () => {
  resetQaLoaderForTests();
  let attempts = 0;
  const importer = () => {
    attempts += 1;
    return attempts === 1 ? Promise.reject(new Error('chunk missing')) : Promise.resolve({ ok: true });
  };
  await assert.rejects(() => loadQaSetups(importer), /chunk missing/);
  assert.equal(isQaSetupsLoaded(), false);
  const mod = await loadQaSetups(importer);
  assert.equal(mod.ok, true);
  assert.equal(attempts, 2);
});

test('qa-setups.js exports all 26 QA setup functions (moved, not copied)', () => {
  for (const name of QA_SETUP_NAMES) {
    assert.equal(typeof qaSetups[name], 'function', `${name} must be exported by qa-setups.js`);
    assert.equal(formValidation[name], undefined, `${name} must no longer come from form-validation.js`);
  }
});

test('the QA chunk is lazy-only: no static import reaches qa-setups.js', () => {
  const app = read('app.js');
  const formValidationSrc = read('form-validation.js');
  const lazyQa = read('lazy-qa.js');
  assert.equal(formValidationSrc.includes("from './qa-"), false,
    'form-validation.js must not reference any qa-* module');
  assert.equal(app.includes("from './qa-setups.js'"), false,
    'app.js must not statically import qa-setups.js');
  const staticQaImports = [...app.matchAll(/from\s*'\.\/qa-[^']+'/g)].map(m => m[0]);
  assert.deepEqual(staticQaImports, [
    "from './qa-tools-state.js?v=1.11.0'",
    "from './qa-backup-csv-import.js?v=1.11.0'",
    "from './qa-discounts-late-fee.js'",
    "from './qa-data-integrity.js'"
  ], 'the only static qa-* imports allowed in app.js are the pre-existing direct ' +
    'ones (backup CSV import, data integrity) plus qa-discounts-late-fee.js ' +
    '(getLateFeeConfig/isBillOverdue, used synchronously by renderHistory) and ' +
    'qa-tools-state.js (profile redesign: pure Recent/Favorites/search state ' +
    'for the QA tools bar, no modal code) — none of the 26 QA-cert modal ' +
    'modules may be static');
  assert.ok(lazyQa.includes("import('./qa-setups.js')"),
    'lazy-qa.js must reach qa-setups.js through a dynamic import literal');
  const formImport = app.match(/import\s*\{[^}]*\}\s*from\s*'\.\/form-validation\.js[^']*'/s)[0];
  for (const name of QA_SETUP_NAMES) {
    assert.equal(formImport.includes(name), false, `app.js must not import ${name} statically`);
  }
});

test('ensureQaModals runs all 26 QA setups and is triggered on profile open + first interaction', () => {
  const app = read('app.js');
  assert.ok(app.includes('function ensureQaModals()'), 'ensureQaModals must exist');
  for (const name of QA_SETUP_NAMES) {
    assert.ok(app.includes(`qa.${name}(`), `ensureQaModals must call qa.${name}`);
  }
  assert.ok(app.includes('ensureQaModals().catch(() => {});'),
    'renderDetail must start the QA load on first profile open');
  assert.ok(app.includes("document.addEventListener('pointerdown', startQaLoad"),
    'first pointerdown must start the QA load');
  assert.ok(app.includes("document.addEventListener('keydown', startQaLoad"),
    'first keydown must start the QA load');
  assert.ok(app.includes('window.billingCorrectnessModalController = billingCorrectnessModalController;'),
    'the billing-correctness window exposure must move into ensureQaModals');
  assert.ok(app.includes('window.lateFeeModalController = lateFeeModalController;'),
    'the late-fee window exposure must move into ensureQaModals');
});

test('Home renders without QA: the boot block no longer calls any QA setup', () => {
  const app = read('app.js');
  const ensureStart = app.indexOf('function ensureQaModals()');
  const bootStart = app.indexOf("if (typeof document !== 'undefined') {", ensureStart);
  const boot = app.slice(bootStart);
  for (const name of QA_SETUP_NAMES) {
    // The only QA references allowed after the boot block starts are the
    // ensure-then-open upgrades (billingCorrectness) — never a setup call.
    assert.equal(boot.includes(`= ${name}(`), false, `boot must not call ${name}`);
    assert.equal(boot.includes(`= qa.${name}(`), false, `boot must not call qa.${name}`);
  }
});

// Live fix 2026-11-12 (QA toast on every app open): a stale cached app.js
// fetched the renamed QA chunk, 404'd, and ensureQaModals() toasted from
// its own .catch — so a background preload failure toasted even though the
// user never asked for a QA modal. REPRO: a failing load on the preload
// path must show NO toast. The loader itself never toasts (a failing
// importer just rejects), and the app.js preload path must not toast
// either: ensureQaModals's own .catch carries no toast, and both preload
// call sites swallow the rejection silently. Fails at base (the .catch
// toasted), passes with the fix.
test('REPRO — background preload: a failing QA chunk load shows NO toast (live fix 2026-11-12)', async () => {
  resetQaLoaderForTests();
  await assert.rejects(
    () => loadQaSetups(() => Promise.reject(new Error('chunk missing'))),
    /chunk missing/
  );
  assert.equal(isQaSetupsLoaded(), false);
  const app = read('app.js');
  const ensureStart = app.indexOf('function ensureQaModals()');
  const ensureEnd = app.indexOf('return qaModalsPromise;', ensureStart);
  assert.ok(ensureStart !== -1 && ensureEnd !== -1, 'ensureQaModals must exist');
  const ensureBody = app.slice(ensureStart, ensureEnd);
  const catchAt = ensureBody.lastIndexOf('}).catch((err) => {');
  assert.ok(catchAt !== -1, 'ensureQaModals must have its failure .catch');
  const catchBlock = ensureBody.slice(catchAt);
  assert.equal(catchBlock.includes('toast('), false,
    'ensureQaModals failure .catch must never toast: a background preload failure is silent');
  assert.ok(catchBlock.includes('qaModalsPromise = null;'),
    'a failed load still clears the cache so the next call retries');
  assert.ok(catchBlock.includes('throw err;'),
    'a failed load still rejects so the caller can decide');
  assert.ok(app.includes("const startQaLoad = () => { ensureQaModals().catch(() => {}); };"),
    'first-interaction preload swallows the failure silently');
  const renderDetail = app.slice(app.indexOf('function renderDetail()'));
  const guardAt = renderDetail.indexOf('if (!customer) return;');
  const preloadAt = renderDetail.indexOf('ensureQaModals().catch(() => {});');
  assert.ok(guardAt !== -1 && preloadAt !== -1 && guardAt < preloadAt,
    'renderDetail starts the QA load only once a profile is actually open');
});

// POSITIVE: the same failing load DOES toast when the user actually tries
// to open a QA modal — the two user-triggered modal-open sites own the
// error toast on their own .catch. Fails at base (both sites swallowed
// the failure silently), passes with the fix.
test('POSITIVE — modal open: a failing QA chunk load DOES show the error toast (live fix 2026-11-12)', () => {
  const app = read('app.js');
  assert.ok(app.includes("const QA_LOAD_FAILED_MESSAGE = 'QA certificates could not be loaded — try opening the profile again.';"),
    'the error message text is unchanged, shared by both modal-open sites');
  const openToast = 'ensureQaModals().then(() => { billingCorrectnessModalController?.open(); }).catch(() => { toast(QA_LOAD_FAILED_MESSAGE); });';
  assert.equal(app.split(openToast).length - 1, 2,
    'both modal-open sites (desktop + mobile-more) must toast on a failed load');
});
