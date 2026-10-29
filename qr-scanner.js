// qr-scanner.js — SISP-48: In-App QR Khata Card Camera Scanner.
//
// SISP-14 shipped the printable QR Khata card: every customer's QR encodes
// ONLY a deep link back into this app (?customer=[id]&action=pay — no
// financial data, ever). This module is the missing other half: an in-app
// camera scanner for the shop counter and SISP-5 Field Mode, so pointing
// the phone at a customer's card lands straight on that customer's Quick
// Collect modal.
//
// Layers, deliberately separated:
//  - PURE validation + routing (parseScannedKhataPayload /
//    routeScannedKhata): a scanned payload is UNTRUSTED input. It is
//    accepted only when it is exactly this app's own deep-link format —
//    the canonical app base URL (or this install's own resolved base),
//    a `customer` parameter, and an optional `action=pay`. Foreign hosts,
//    extra/duplicate parameters, other actions, and malformed strings are
//    all rejected, and rejection NEVER carries a navigation target: the
//    payload resolves only against the local ledger via SISP-14's
//    resolveDeepLinkCustomer, and an unknown id is a safe toast, never a
//    redirect. The SISP-14 payload format itself is unchanged.
//  - PURE session lifecycle (createQrScannerSession): start/stop of the
//    camera + decode loop as an idempotent state machine with every
//    platform touch injected, so the lifecycle is unit-testable without
//    a camera.
//  - THIN browser glue (setupQrScannerModal): getUserMedia +
//    BarcodeDetector when the platform offers them. Graceful degradation
//    is a requirement, not an afterthought: no BarcodeDetector still
//    leaves the photo-scan (image input) path where the platform can
//    decode images, and every device keeps the paste-the-link manual
//    path plus a clear camera-denied message. The camera stream is
//    stopped on every exit path (result, close, cancel, error).

import { KHATA_APP_URL, resolveDeepLinkCustomer, resolveQrBaseUrl } from './qr-card.js';
import { t } from './nav-language.js';

// ---------------------------------------------------------------- constants

/** Longest scanned text we will even look at (real Khata links are < 120
 *  chars; this only bounds hostile input). */
export const QR_SCAN_MAX_PAYLOAD_LENGTH = 512;
/** Longest customer reference we accept from a scan. */
export const QR_SCAN_MAX_CUSTOMER_ID_LENGTH = 64;

// ---------------------------------------------------------------- validation

function normalizeBase(base) {
  const text = String(base || '').trim();
  if (!text) return null;
  try {
    const url = new URL(text);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    let path = url.pathname || '/';
    if (!path.endsWith('/')) path = `${path}/`;
    return `${url.origin}${path}`;
  } catch {
    return null;
  }
}

/** The base URLs a genuine Khata QR for THIS install may point at: the
 *  canonical live URL plus the base this very page was served from (the
 *  same pair SISP-14 can print). Anything else is foreign. */
export function qrScannerAllowedBases(href) {
  const bases = new Set();
  const canonical = normalizeBase(KHATA_APP_URL);
  if (canonical) bases.add(canonical);
  const own = normalizeBase(resolveQrBaseUrl(href || ''));
  if (own) bases.add(own);
  return [...bases];
}

/** Strictly parse an untrusted scanned payload.
 *  Returns { ok: true, customerId, action: 'pay' | 'profile' } or
 *  { ok: false, reason } with reason one of:
 *    'empty' | 'too-long' | 'malformed' | 'foreign' |
 *    'unexpected-params' | 'duplicate-param' | 'bad-action' |
 *    'missing-customer'
 *  Never throws, and a rejection never carries a navigation target. */
export function parseScannedKhataPayload(text, { allowedBases } = {}) {
  const raw = typeof text === 'string' ? text.trim() : '';
  if (!raw) return { ok: false, reason: 'empty' };
  if (raw.length > QR_SCAN_MAX_PAYLOAD_LENGTH) return { ok: false, reason: 'too-long' };

  let query = null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    // Absolute URL (or a hostile scheme like javascript:): only this
    // app's own http(s) bases are acceptable, with no fragment and no
    // embedded credentials.
    let url;
    try {
      url = new URL(raw);
    } catch {
      return { ok: false, reason: 'malformed' };
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { ok: false, reason: 'foreign' };
    }
    const bases = (Array.isArray(allowedBases) && allowedBases.length
      ? allowedBases
      : [KHATA_APP_URL])
      .map(normalizeBase)
      .filter(Boolean);
    if (!bases.includes(`${url.origin}${url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`}`)) {
      return { ok: false, reason: 'foreign' };
    }
    if (url.username || url.password || url.hash) {
      return { ok: false, reason: 'malformed' };
    }
    query = url.search.replace(/^\?/, '');
  } else if (raw.startsWith('?') || /(^|&)customer=/.test(raw)) {
    // Bare query form ('?customer=12&action=pay' or 'customer=12&action=pay').
    if (raw.includes('#')) return { ok: false, reason: 'malformed' };
    query = raw.replace(/^\?/, '');
  } else {
    return { ok: false, reason: 'malformed' };
  }

  if (!query) return { ok: false, reason: 'missing-customer' };
  const seen = new Map();
  for (const part of query.split('&')) {
    if (!part) return { ok: false, reason: 'malformed' };
    const eq = part.indexOf('=');
    if (eq <= 0) return { ok: false, reason: 'malformed' };
    let key;
    let value;
    try {
      key = decodeURIComponent(part.slice(0, eq));
      value = decodeURIComponent(part.slice(eq + 1));
    } catch {
      return { ok: false, reason: 'malformed' };
    }
    if (key !== 'customer' && key !== 'action') {
      return { ok: false, reason: 'unexpected-params' };
    }
    if (seen.has(key)) return { ok: false, reason: 'duplicate-param' };
    seen.set(key, value);
  }

  const customerId = String(seen.get('customer') || '').trim();
  if (!customerId) return { ok: false, reason: 'missing-customer' };
  if (customerId.length > QR_SCAN_MAX_CUSTOMER_ID_LENGTH) {
    return { ok: false, reason: 'malformed' };
  }
  const actionRaw = seen.get('action');
  if (actionRaw !== undefined && actionRaw !== 'pay') {
    return { ok: false, reason: 'bad-action' };
  }
  return { ok: true, customerId, action: actionRaw === 'pay' ? 'pay' : 'profile' };
}

/** Route an untrusted scanned payload against the local ledger.
 *    { status: 'found', customer, action }   — the ONLY routable result
 *    { status: 'not-found', customerId, action }
 *    { status: 'invalid', reason }
 *  'invalid' and 'not-found' results intentionally contain no customer
 *  record and no navigation target. */
export function routeScannedKhata(customers, text, options = {}) {
  const parsed = parseScannedKhataPayload(text, options);
  if (!parsed.ok) return { status: 'invalid', reason: parsed.reason };
  const customer = resolveDeepLinkCustomer(customers, parsed.customerId);
  if (!customer) {
    return { status: 'not-found', customerId: parsed.customerId, action: parsed.action };
  }
  return { status: 'found', customer, action: parsed.action };
}

// ---------------------------------------------------------------- session

/** Idempotent camera-scan session lifecycle with every platform touch
 *  injected (acquire/release/detect/frame scheduling), so the rules are
 *  unit-testable without a camera:
 *   - start() while starting/scanning is a no-op (one acquire, ever);
 *   - stop() cancels the pending frame and releases the stream exactly
 *     once; stop() while idle is a no-op;
 *   - stop() during a pending acquire releases the stream the moment it
 *     arrives and never starts the decode loop;
 *   - a decoded payload is delivered exactly once, after the session
 *     has fully stopped;
 *   - a per-frame decode error never kills the loop. */
export function createQrScannerSession({
  acquire,
  release,
  detect,
  scheduleFrame,
  cancelFrame,
  onPayload,
  onError
} = {}) {
  const schedule = typeof scheduleFrame === 'function'
    ? scheduleFrame
    : (cb) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(cb) : setTimeout(cb, 120));
  const cancel = typeof cancelFrame === 'function'
    ? cancelFrame
    : (id) => (typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame(id) : clearTimeout(id));

  let state = 'idle'; // 'idle' | 'starting' | 'scanning'
  let handle = null;
  let frameId = null;
  let stopRequested = false;

  function releaseHandle() {
    if (handle === null || handle === undefined) return;
    const current = handle;
    handle = null;
    try {
      if (typeof release === 'function') release(current);
    } catch { /* releasing must never throw into stop() */ }
  }

  async function tick() {
    frameId = null;
    if (state !== 'scanning') return;
    let text = null;
    try {
      text = typeof detect === 'function' ? await detect(handle) : null;
    } catch {
      text = null; // a single unreadable frame is normal; keep scanning
    }
    if (state !== 'scanning') return; // stopped while detecting
    if (text) {
      const payload = String(text);
      stop();
      if (typeof onPayload === 'function') onPayload(payload);
      return;
    }
    frameId = schedule(tick);
  }

  async function start() {
    if (state !== 'idle') return false;
    if (typeof acquire !== 'function') return false;
    state = 'starting';
    stopRequested = false;
    let acquired;
    try {
      acquired = await acquire();
    } catch (err) {
      state = 'idle';
      if (!stopRequested && typeof onError === 'function') onError(err);
      return false;
    }
    if (stopRequested || state !== 'starting') {
      // stop() raced the acquire: hand the stream straight back.
      handle = acquired;
      releaseHandle();
      state = 'idle';
      return false;
    }
    handle = acquired;
    state = 'scanning';
    frameId = schedule(tick);
    return true;
  }

  function stop() {
    if (state === 'idle') return false;
    if (state === 'starting') {
      stopRequested = true;
      return true;
    }
    state = 'idle';
    if (frameId !== null && frameId !== undefined) {
      try { cancel(frameId); } catch { /* ignore */ }
      frameId = null;
    }
    releaseHandle();
    return true;
  }

  return {
    start,
    stop,
    isActive: () => state !== 'idle',
    getState: () => state
  };
}

// ---------------------------------------------------------------- support

/** Capability probe (injectable env for tests): which scan paths this
 *  device/browser offers. The manual paste path always exists, so the
 *  scanner can never dead-end. */
export function qrScannerSupport(env) {
  const source = env && typeof env === 'object' ? env : {};
  const nav = source.navigator && typeof source.navigator === 'object' ? source.navigator : {};
  return {
    barcodeDetector: typeof source.BarcodeDetector === 'function',
    getUserMedia: !!(nav.mediaDevices && typeof nav.mediaDevices.getUserMedia === 'function'),
    manual: true
  };
}

// ---------------------------------------------------------------- glue

/** DOM controller for the QR scanner dialog. Returns null outside a
 *  browser / when the dialog markup is absent (mirrors the suspense
 *  modal's fallback). All strings go through t() so the modal follows
 *  the app language; static labels also carry data-i18n in index.html. */
export function setupQrScannerModal(getState, { onToast, onOpenCustomer } = {}) {
  const dialog = typeof document !== 'undefined' ? document.getElementById('qrScannerModal') : null;
  if (!dialog) return null;
  const $ = (id) => dialog.querySelector(`#${id}`);
  const video = $('qrScannerVideo');
  const statusEl = $('qrScannerStatus');
  const startBtn = $('qrScannerStartBtn');
  const imageInput = $('qrScannerImageInput');
  const manualForm = $('qrScannerManualForm');
  const manualInput = $('qrScannerManualInput');

  const toast = (msg) => {
    if (typeof onToast === 'function') onToast(msg);
  };
  const setStatus = (msg) => {
    if (statusEl) statusEl.textContent = msg || '';
  };
  const getCustomers = () => {
    try {
      const state = typeof getState === 'function' ? getState() : null;
      return Array.isArray(state?.customers) ? state.customers : [];
    } catch {
      return [];
    }
  };
  const allowedBases = () => qrScannerAllowedBases(
    typeof window !== 'undefined' && window.location ? window.location.href : ''
  );

  let detector = null;
  let session = null;

  function ensureDetector() {
    if (detector) return detector;
    if (typeof window !== 'undefined' && typeof window.BarcodeDetector === 'function') {
      try {
        detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      } catch {
        detector = null;
      }
    }
    return detector;
  }

  /** Route one decoded/pasted payload. Found → close + hand the customer
   *  to the host (Quick Collect for action=pay, profile otherwise).
   *  Anything else → a safe toast + inline status, and NOWHERE else. */
  function handlePayload(text) {
    const result = routeScannedKhata(getCustomers(), text, { allowedBases: allowedBases() });
    if (result.status === 'found') {
      close();
      if (typeof onOpenCustomer === 'function') onOpenCustomer(result.customer, result.action);
      return result;
    }
    if (result.status === 'not-found') {
      toast(t('qrscan_not_found'));
      setStatus(t('qrscan_not_found'));
      return result;
    }
    toast(t('qrscan_invalid'));
    setStatus(t('qrscan_invalid'));
    return result;
  }

  async function acquireCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: false
    });
    if (video) {
      video.srcObject = stream;
      try { await video.play(); } catch { /* autoplay policies: stream still decodable */ }
    }
    return stream;
  }

  function releaseCamera(stream) {
    try {
      (stream?.getTracks?.() || []).forEach((track) => {
        try { track.stop(); } catch { /* already stopped */ }
      });
    } catch { /* ignore */ }
    if (video) {
      try { video.pause(); } catch { /* ignore */ }
      video.srcObject = null;
    }
  }

  async function detectFrame() {
    const det = ensureDetector();
    if (!det || !video) return null;
    const codes = await det.detect(video);
    const first = Array.isArray(codes) ? codes[0] : null;
    return first?.rawValue ? String(first.rawValue) : null;
  }

  function ensureSession() {
    if (session) return session;
    session = createQrScannerSession({
      acquire: acquireCamera,
      release: releaseCamera,
      detect: detectFrame,
      onPayload: (text) => { handlePayload(text); },
      onError: (err) => {
        const denied = err && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
        setStatus(t(denied ? 'qrscan_camera_denied' : 'qrscan_camera_failed'));
        toast(t(denied ? 'qrscan_camera_denied' : 'qrscan_camera_failed'));
      }
    });
    return session;
  }

  async function startCamera() {
    const support = qrScannerSupport(typeof window !== 'undefined' ? window : {});
    if (!support.getUserMedia) {
      setStatus(t('qrscan_no_camera'));
      toast(t('qrscan_no_camera'));
      return false;
    }
    if (!ensureDetector()) {
      // Camera exists but this browser cannot decode QR codes natively:
      // do not open a camera that can never succeed — point at the
      // fallbacks instead.
      setStatus(t('qrscan_no_detector'));
      toast(t('qrscan_no_detector'));
      return false;
    }
    setStatus(t('qrscan_scanning'));
    return ensureSession().start();
  }

  async function scanImageFile(file) {
    if (!file) return;
    const det = ensureDetector();
    if (!det || typeof createImageBitmap !== 'function') {
      toast(t('qrscan_no_detector'));
      setStatus(t('qrscan_no_detector'));
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const codes = await det.detect(bitmap);
      const first = Array.isArray(codes) ? codes[0] : null;
      if (first?.rawValue) {
        handlePayload(String(first.rawValue));
      } else {
        toast(t('qrscan_image_failed'));
        setStatus(t('qrscan_image_failed'));
      }
    } catch {
      toast(t('qrscan_image_failed'));
      setStatus(t('qrscan_image_failed'));
    }
  }

  function open() {
    if (!dialog.open) dialog.showModal();
    setStatus(t('qrscan_hint'));
    void startCamera();
  }

  function close() {
    if (session) session.stop();
    if (dialog.open) dialog.close();
  }

  if (startBtn) startBtn.addEventListener('click', () => { void startCamera(); });
  if (imageInput) {
    imageInput.addEventListener('change', () => {
      const file = imageInput.files?.[0];
      imageInput.value = '';
      void scanImageFile(file);
    });
  }
  if (manualForm) {
    manualForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const text = manualInput?.value || '';
      if (!String(text).trim()) return;
      handlePayload(text);
      if (manualInput) manualInput.value = '';
    });
  }
  const closeBtn = $('qrScannerCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', close);
  // Esc / backdrop dismissal fires 'close' too: the camera must stop on
  // EVERY exit path, never linger.
  dialog.addEventListener('close', () => {
    if (session) session.stop();
  });

  return { open, close, handlePayload, startCamera };
}
