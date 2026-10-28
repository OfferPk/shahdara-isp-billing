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
    "from './qa-backup-csv-import.js?v=1.10.0'",
    "from './qa-discounts-late-fee.js'",
    "from './qa-data-integrity.js'"
  ], 'the only static qa-* imports allowed in app.js are the pre-existing direct ' +
    'ones (backup CSV import, data integrity) plus qa-discounts-late-fee.js ' +
    '(getLateFeeConfig/isBillOverdue, used synchronously by renderHistory) — ' +
    'none of the 26 QA-cert modal modules may be static');
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
