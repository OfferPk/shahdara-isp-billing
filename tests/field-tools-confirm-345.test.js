import test from 'node:test';
import assert from 'node:assert/strict';

function createMockElement(id) {
  const listeners = {};
  const children = {};
  return {
    id,
    listeners,
    children,
    value: '',
    textContent: '',
    innerHTML: '',
    checked: false,
    selectedIndex: 0,
    options: [{ text: 'Default' }],
    addEventListener(evt, fn) {
      if (!listeners[evt]) listeners[evt] = [];
      listeners[evt].push(fn);
    },
    click() {
      for (const fn of (listeners['click'] || [])) {
        fn({ preventDefault() {} });
      }
    },
    showModal() {},
    close() {},
    setAttribute() {},
    removeAttribute() {},
    querySelector(sel) {
      const clean = sel.replace(/^[#.]/, '');
      return children[clean] || (global.document ? global.document.getElementById(clean) : null);
    },
    querySelectorAll() { return []; },
    classList: { add() {}, remove() {}, toggle() {} },
    appendChild() {},
    removeChild() {},
    style: {}
  };
}

function setupMockDom() {
  const elements = {};
  const getEl = id => {
    if (!elements[id]) elements[id] = createMockElement(id);
    return elements[id];
  };

  const doc = {
    getElementById: getEl,
    querySelector: sel => {
      const clean = sel.replace(/^[#.]/, '');
      return getEl(clean);
    },
    querySelectorAll: () => [],
    createElement: id => createMockElement(id),
    body: createMockElement('body')
  };

  global.window = {
    document: doc,
    addEventListener() {},
    open() {},
    appConfirm: null,
    toast: null
  };
  global.document = doc;
  return { elements, getEl };
}

test('nav-fiber-identifier clearHistory uses window.appConfirm', async () => {
  const { getEl } = setupMockDom();

  const storage = {
    _data: {
      shahdara_fiber_identifier_audits_v1: JSON.stringify([{ id: 'FIA-001', wavelength: '1550 nm' }])
    },
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; }
  };

  const { setupMobileFiberIdentifierModal, loadFiberIdentifierAuditLog } = await import('../nav-fiber-identifier.js');

  let confirmOptions = null;
  let confirmResult = false;
  window.appConfirm = async (opts) => {
    confirmOptions = opts;
    return confirmResult;
  };

  let toastMessage = null;
  setupMobileFiberIdentifierModal({}, { storage, onToast: (msg) => { toastMessage = msg; } });

  const btn = getEl('identClearHistoryBtn');

  // Case 1: user cancels
  confirmResult = false;
  btn.click();
  await new Promise(r => setTimeout(r, 20));

  assert.equal(confirmOptions?.tone, 'danger');
  assert.equal(confirmOptions?.title, 'Clear fiber identifier audit logs?');
  assert.equal(loadFiberIdentifierAuditLog(storage).length, 1, 'Audits should not be cleared on cancel');

  // Case 2: user confirms
  confirmResult = 'confirm';
  btn.click();
  await new Promise(r => setTimeout(r, 20));

  assert.equal(loadFiberIdentifierAuditLog(storage).length, 0, 'Audits should be cleared on confirm');
  assert.equal(toastMessage, 'Fiber identifier audit logs cleared');
});

test('nav-gps-tracking clear trail uses window.appConfirm', async () => {
  const { getEl } = setupMockDom();

  const storage = {
    _data: {
      shahdara_technician_gps_breadcrumbs_v1: JSON.stringify([{ id: 'GPS-001', lat: 31.62, lng: 74.28 }])
    },
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; }
  };

  const { setupMobileGpsBreadcrumbsModal, getGpsBreadcrumbsStore } = await import('../nav-gps-tracking.js');

  let confirmOptions = null;
  let confirmResult = false;
  window.appConfirm = async (opts) => {
    confirmOptions = opts;
    return confirmResult;
  };

  let toastMessage = null;
  window.toast = (msg) => { toastMessage = msg; };

  setupMobileGpsBreadcrumbsModal({ storage });

  const btn = getEl('btnGpsClearTrail');

  // Case 1: user cancels
  confirmResult = false;
  btn.click();
  await new Promise(r => setTimeout(r, 20));

  assert.equal(confirmOptions?.tone, 'danger');
  assert.equal(confirmOptions?.title, 'Clear GPS breadcrumb trail?');
  assert.equal(getGpsBreadcrumbsStore(storage).length, 1, 'Breadcrumbs should not be cleared on cancel');

  // Case 2: user confirms
  confirmResult = 'confirm';
  btn.click();
  await new Promise(r => setTimeout(r, 20));

  assert.equal(getGpsBreadcrumbsStore(storage).length, 0, 'Breadcrumbs should be cleared on confirm');
  assert.equal(toastMessage, 'GPS breadcrumb trail cleared');
});

test('nav-mpo-polarity clear history uses window.appConfirm', async () => {
  const { getEl } = setupMockDom();

  const storage = {
    _data: {
      shahdara_mpo_polarity_audits_v1: JSON.stringify([{ id: 'MPO-001', method: 'Method A' }])
    },
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; }
  };

  const { setupMobileMpoModal, loadMpoPolarityAuditLog } = await import('../nav-mpo-polarity.js');

  let confirmOptions = null;
  let confirmResult = false;
  window.appConfirm = async (opts) => {
    confirmOptions = opts;
    return confirmResult;
  };

  let toastMessage = null;
  setupMobileMpoModal({}, { storage, onToast: (msg) => { toastMessage = msg; } });

  const btn = getEl('mpoClearHistoryBtn');

  // Case 1: user cancels
  confirmResult = false;
  btn.click();
  await new Promise(r => setTimeout(r, 20));

  assert.equal(confirmOptions?.tone, 'danger');
  assert.equal(confirmOptions?.title, 'Clear MPO polarity audit logs?');
  assert.equal(loadMpoPolarityAuditLog(storage).length, 1, 'Audits should not be cleared on cancel');

  // Case 2: user confirms
  confirmResult = 'confirm';
  btn.click();
  await new Promise(r => setTimeout(r, 20));

  assert.equal(loadMpoPolarityAuditLog(storage).length, 0, 'Audits should be cleared on confirm');
  assert.equal(toastMessage, 'MPO polarity audit logs cleared');
});

test('nav-olts-cert clear history uses window.appConfirm', async () => {
  const { getEl } = setupMockDom();

  const storage = {
    _data: {
      shahdara_olts_cert_audits_v1: JSON.stringify([{ id: 'OLTS-001', tier: 'Tier-1' }])
    },
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; }
  };

  const { setupMobileOltsModal, loadOltsAuditLog } = await import('../nav-olts-cert.js');

  let confirmOptions = null;
  let confirmResult = false;
  window.appConfirm = async (opts) => {
    confirmOptions = opts;
    return confirmResult;
  };

  let toastMessage = null;
  setupMobileOltsModal({}, { storage, onToast: (msg) => { toastMessage = msg; } });

  const btn = getEl('oltsClearHistoryBtn');

  // Case 1: user cancels
  confirmResult = false;
  btn.click();
  await new Promise(r => setTimeout(r, 20));

  assert.equal(confirmOptions?.tone, 'danger');
  assert.equal(confirmOptions?.title, 'Clear OLTS certification audits?');
  assert.equal(loadOltsAuditLog(storage).length, 1, 'Audits should not be cleared on cancel');

  // Case 2: user confirms
  confirmResult = 'confirm';
  btn.click();
  await new Promise(r => setTimeout(r, 20));

  assert.equal(loadOltsAuditLog(storage).length, 0, 'Audits should be cleared on confirm');
  assert.equal(toastMessage, 'OLTS audit logs cleared');
});

test('nav-tube-shaving clear history uses window.appConfirm', async () => {
  const { getEl } = setupMockDom();

  const storageData = {
    shahdara_nav_tube_shaving_history: JSON.stringify([{ id: 'SHV-001', bladeDepthMm: 0.25 }])
  };

  window.localStorage = {
    getItem(k) { return storageData[k] || null; },
    setItem(k, v) { storageData[k] = String(v); },
    removeItem(k) { delete storageData[k]; }
  };
  global.localStorage = window.localStorage;

  const { setupMobileTubeShavingModal, getTubeShavingHistory } = await import('../nav-tube-shaving.js');

  let confirmOptions = null;
  let confirmResult = false;
  window.appConfirm = async (opts) => {
    confirmOptions = opts;
    return confirmResult;
  };

  let toastMessage = null;
  window.toast = (msg) => { toastMessage = msg; };

  setupMobileTubeShavingModal();

  const btn = getEl('shaveClearHistoryBtn');

  // Case 1: user cancels
  confirmResult = false;
  btn.click();
  await new Promise(r => setTimeout(r, 20));

  assert.equal(confirmOptions?.tone, 'danger');
  assert.equal(confirmOptions?.title, 'Clear buffer tube shaving calibration logs?');
  assert.equal(getTubeShavingHistory().length, 1, 'Logs should not be cleared on cancel');

  // Case 2: user confirms
  confirmResult = 'confirm';
  btn.click();
  await new Promise(r => setTimeout(r, 20));

  assert.equal(getTubeShavingHistory().length, 0, 'Logs should be cleared on confirm');
  assert.equal(toastMessage, 'Tube shaving calibration logs cleared');
});
