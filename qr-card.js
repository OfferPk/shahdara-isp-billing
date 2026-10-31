// qr-card.js — SISP-14: Printable Customer QR Khata Card & Deep-Link Shop Counter Lookup.
//
// Dependency-free, offline QR encoder (byte mode, EC level M, QR versions 1–6)
// plus the Khata card model and the ?customer=[id]&action=pay deep-link helpers.
//
// The QR payload is ONLY an identifier + app route — no customer financial data
// is ever encoded in the QR itself. The printed card shows the package rate as
// visible text (per spec), but the QR only carries the deep link.
//
// QR scope note: versions 1–6 cover payloads up to 106 bytes, which fits the
// canonical deep link for any realistic customer id. Longer payloads throw a
// clear error instead of producing a broken code; the UI falls back to showing
// the card + copyable link without a QR in that case.

import { PAYMENT_METHODS } from './core.js';
import { resolveShopCollector } from './shop-settlement.js';

export const KHATA_APP_URL = 'https://offerpk.github.io/shahdara-isp-billing/';
// SISP-86: the printed shop line is DERIVED from the same single source the
// SISP-1 settlement ledger uses — PAYMENT_METHODS resolved through
// shop-settlement's resolveShopCollector — never a second hardcoded list
// that can drift from the settlement module (Waseem Abbasi Shop · Hassan
// Balla Shop today — OWNER-CASH-SHOP unified the old Hassan/Balla split
// into that one shop, so it appears exactly once; any future
// "Cash at X shop" method follows automatically).
export const KHATA_PAYMENT_SHOPS = Object.freeze([...new Set(
  PAYMENT_METHODS.map((method) => resolveShopCollector(method)).filter(Boolean)
)]);
export const KHATA_ISP_NAME = 'Shahdara ISP';
export const QR_EC_LEVEL = 'M';
export const QR_MAX_VERSION = 6;

// ---------------------------------------------------------------- deep link

/** Canonical base URL for QR deep links: the live Pages URL, or the current
 *  app URL when the page itself was served over http(s) from a non-local host.
 *  Localhost/file pages fall back to the canonical URL so a scanned QR still
 *  opens the real app on the operator's phone. */
export function resolveQrBaseUrl(href) {
  try {
    const url = new URL(href || '');
    if ((url.protocol === 'http:' || url.protocol === 'https:') &&
        url.hostname !== 'localhost' && url.hostname !== '127.0.0.1' && url.hostname !== '[::1]') {
      let path = url.pathname || '/';
      if (!path.endsWith('/')) {
        const last = path.split('/').pop();
        path = last && last.includes('.') ? path.slice(0, path.length - last.length) : `${path}/`;
      }
      return `${url.origin}${path}`;
    }
  } catch { /* fall through to the canonical URL */ }
  return KHATA_APP_URL;
}

/** Build the shop-counter deep link for one customer. action 'pay' opens the
 *  payment modal on load; any other action opens the customer profile. */
export function buildKhataDeepLink(customerId, { baseUrl = KHATA_APP_URL, action = 'pay' } = {}) {
  const id = String(customerId ?? '').trim();
  if (!id) return null;
  const base = String(baseUrl || KHATA_APP_URL).endsWith('/')
    ? String(baseUrl || KHATA_APP_URL)
    : `${baseUrl}/`;
  const params = `customer=${encodeURIComponent(id)}` +
    (action === 'pay' ? '&action=pay' : '');
  return `${base}?${params}`;
}

/** Parse a query string ('?customer=x&action=pay' or 'customer=x'). Returns
 *  { customerId, action } with action normalized to 'pay' | 'profile', or null
 *  when no usable customer parameter is present. Never throws. */
export function parseCustomerDeepLink(search) {
  try {
    const query = String(search || '').trim().replace(/^[?#]/, '');
    if (!query) return null;
    const params = new URLSearchParams(query);
    const customerId = (params.get('customer') || '').trim();
    if (!customerId) return null;
    return { customerId, action: params.get('action') === 'pay' ? 'pay' : 'profile' };
  } catch {
    return null;
  }
}

/** Resolve a deep-link customer reference against the ledger. Accepts the exact
 *  record id, the numeric customerNumber, or the 'cust-<number>' form (the same
 *  resolution the hash router already uses). Returns the customer or null —
 *  never a different customer's record. */
export function resolveDeepLinkCustomer(customers, rawId) {
  const list = Array.isArray(customers) ? customers : [];
  const raw = String(rawId ?? '').trim();
  if (!raw) return null;
  return list.find((c) => c && (
    String(c.id) === raw ||
    String(c.customerNumber) === raw ||
    String(c.id) === `cust-${raw}`
  )) || null;
}

// ---------------------------------------------------------------- card model

/** Printable Khata card model for one customer. monthlyPackageRate is the raw
 *  saved selling amount (null when not set); formatting stays with the caller
 *  (formatAmount) so this module has no UI dependency. */
export function buildKhataCardModel(customer, { baseUrl = KHATA_APP_URL, shops = KHATA_PAYMENT_SHOPS } = {}) {
  if (!customer || typeof customer !== 'object') return null;
  const id = String(customer.id ?? '').trim();
  if (!id) return null;
  const rate = customer.monthlySellingAmount === null || customer.monthlySellingAmount === undefined ||
    customer.monthlySellingAmount === ''
    ? null : Number(customer.monthlySellingAmount);
  return {
    ispName: KHATA_ISP_NAME,
    customerName: String(customer.name ?? '').trim() || 'Unnamed customer',
    customerId: id,
    connectionId: Number.isSafeInteger(customer.customerNumber) ? customer.customerNumber : null,
    connectionLabel: Number.isSafeInteger(customer.customerNumber)
      ? `#${customer.customerNumber}` : id,
    packageSpeed: String(customer.packageSpeed ?? '').trim(),
    monthlyPackageRate: Number.isFinite(rate) ? rate : null,
    areaZone: [String(customer.mohalla ?? '').trim(), String(customer.zone ?? '').trim()]
      .filter(Boolean).join(' · '),
    shops: Array.isArray(shops) ? shops.filter(Boolean) : KHATA_PAYMENT_SHOPS,
    deepLink: buildKhataDeepLink(id, { baseUrl, action: 'pay' })
  };
}

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Standalone printable HTML document for the wallet card. Paper-white by
 *  design (thermal 58mm/80mm friendly: the card is 58mm wide and centered). */
export function buildKhataCardPrintHtml(model, qrDataUrl) {
  const m = model || {};
  const rateLine = m.monthlyPackageRate === null || m.monthlyPackageRate === undefined
    ? 'Package rate: Not set'
    : `Package rate: PKR ${Number(m.monthlyPackageRate).toLocaleString('en-PK')}/month`;
  const speedLine = m.packageSpeed ? ` · ${escapeHtml(m.packageSpeed)}` : '';
  const shopsLine = (m.shops || []).map(escapeHtml).join(' · ') || '—';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>QR Khata Card — ${escapeHtml(m.customerName || '')}</title>
<style>body{font-family:system-ui,sans-serif;color:#111;margin:0;padding:8px}.card{width:58mm;margin:0 auto;border:2px solid #111;border-radius:10px;padding:12px;text-align:center}.card h1{font-size:17px;margin:0 0 2px}.card .sub{font-size:11px;color:#444;margin:0 0 10px}.card h2{font-size:15px;margin:8px 0 2px}.card p{font-size:12px;margin:3px 0}.card img.qr{width:52mm;height:52mm;margin:8px auto;display:block}.card .link{font-size:9px;word-break:break-all;color:#444}.card .foot{font-size:10px;color:#444;margin-top:10px;border-top:1px dashed #999;padding-top:6px}</style></head><body>
<div class="card"><h1>${escapeHtml(m.ispName || KHATA_ISP_NAME)}</h1><p class="sub">Customer Khata Card</p>
<h2>${escapeHtml(m.customerName || '')}</h2>
<p>Connection ID: <strong>${escapeHtml(m.connectionLabel || '')}</strong></p>
<p>${rateLine}${speedLine}</p>
${m.areaZone ? `<p>${escapeHtml(m.areaZone)}</p>` : ''}
${qrDataUrl ? `<img class="qr" src="${escapeHtml(qrDataUrl)}" alt="QR code for shop counter lookup">` : '<p>QR code unavailable for this link.</p>'}
<p>Pay at: ${shopsLine}</p>
<p class="foot">Scan at the shop counter to open this customer's payment screen.</p>
${m.deepLink ? `<p class="link">${escapeHtml(m.deepLink)}</p>` : ''}</div>
</body></html>`;
}

// ---------------------------------------------------------------- QR encoder
// Byte mode, EC level M, versions 1–6. Tables follow the QR specification
// (total codewords, EC codewords per block, block layout, alignment centers,
// remainder bits). Versions stop at 6 so no version-information bits are needed.

const QR_VERSIONS = [
  null,
  { total: 26, ecPerBlock: 10, blocks: [{ count: 1, data: 16 }], alignment: [], remainder: 0 },
  { total: 44, ecPerBlock: 16, blocks: [{ count: 1, data: 28 }], alignment: [6, 18], remainder: 7 },
  { total: 70, ecPerBlock: 26, blocks: [{ count: 1, data: 44 }], alignment: [6, 22], remainder: 7 },
  { total: 100, ecPerBlock: 18, blocks: [{ count: 2, data: 32 }], alignment: [6, 26], remainder: 7 },
  { total: 134, ecPerBlock: 24, blocks: [{ count: 2, data: 43 }], alignment: [6, 30], remainder: 7 },
  { total: 172, ecPerBlock: 16, blocks: [{ count: 4, data: 27 }], alignment: [6, 34], remainder: 7 }
];

function utf8Encode(text) {
  const bytes = [];
  for (let i = 0; i < text.length; i++) {
    let cp = text.charCodeAt(i);
    if (cp >= 0xd800 && cp <= 0xdbff && i + 1 < text.length) {
      const lo = text.charCodeAt(i + 1);
      if (lo >= 0xdc00 && lo <= 0xdfff) {
        cp = 0x10000 + ((cp - 0xd800) << 10) + (lo - 0xdc00);
        i++;
      }
    }
    if (cp < 0x80) bytes.push(cp);
    else if (cp < 0x800) bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    else if (cp < 0x10000) bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    else bytes.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
  }
  return bytes;
}

// Galois field GF(256), primitive polynomial 0x11D, generator 2.
const GF_EXP = new Array(512);
const GF_LOG = new Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
}
const gfMul = (a, b) => (a === 0 || b === 0) ? 0 : GF_EXP[GF_LOG[a] + GF_LOG[b]];

function rsGeneratorPoly(ecLen) {
  let poly = [1];
  for (let i = 0; i < ecLen; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gfMul(poly[j], GF_EXP[i]);
      next[j + 1] ^= poly[j];
    }
    poly = next;
  }
  return poly;
}

function rsComputeRemainder(data, ecLen) {
  const gen = rsGeneratorPoly(ecLen);
  const result = [...data, ...new Array(ecLen).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const coef = result[i];
    if (coef === 0) continue;
    for (let j = 1; j <= ecLen; j++) result[i + j] ^= gfMul(gen[j], coef);
  }
  return result.slice(data.length);
}

function maskBit(mask, x, y) {
  switch (mask) {
    case 0: return (x + y) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0;
    case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5: return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6: return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    case 7: return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
    default: return false;
  }
}

/** Format information bits for an EC level + mask, with BCH + mask XOR.
 *  ecLevelBits: L = 1, M = 0, Q = 3, H = 2 (default M). */
export function qrFormatBits(mask, ecLevelBits = 0) {
  const data = ((ecLevelBits & 3) << 3) | (mask & 7);
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ (((rem >> 9) & 1) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}

function penaltyScore(modules) {
  const size = modules.length;
  let score = 0;
  // Rule 1: runs of 5+ in rows and columns.
  for (let y = 0; y < size; y++) {
    let runColor = modules[y][0];
    let runLength = 1;
    for (let x = 1; x < size; x++) {
      if (modules[y][x] === runColor) runLength++;
      else {
        if (runLength >= 5) score += 3 + (runLength - 5);
        runColor = modules[y][x];
        runLength = 1;
      }
    }
    if (runLength >= 5) score += 3 + (runLength - 5);
  }
  for (let x = 0; x < size; x++) {
    let runColor = modules[0][x];
    let runLength = 1;
    for (let y = 1; y < size; y++) {
      if (modules[y][x] === runColor) runLength++;
      else {
        if (runLength >= 5) score += 3 + (runLength - 5);
        runColor = modules[y][x];
        runLength = 1;
      }
    }
    if (runLength >= 5) score += 3 + (runLength - 5);
  }
  // Rule 2: 2x2 blocks of one colour.
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const c = modules[y][x];
      if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) score += 3;
    }
  }
  // Rule 3: finder-like patterns 10111010000 / 00001011101.
  const finderLike = (line) => {
    let hits = 0;
    for (let i = 0; i + 11 <= line.length; i++) {
      const seg = line.slice(i, i + 11).join('');
      if (seg === '10111010000' || seg === '00001011101') hits++;
    }
    return hits * 40;
  };
  for (let y = 0; y < size; y++) score += finderLike(modules[y]);
  for (let x = 0; x < size; x++) score += finderLike(modules.map((row) => row[x]));
  // Rule 4: dark-module ratio deviation from 50% in 5% steps.
  let dark = 0;
  for (const row of modules) for (const cell of row) dark += cell;
  const percent = (dark * 100) / (size * size);
  const prev = Math.floor(percent / 5) * 5;
  const next = Math.ceil(percent / 5) * 5;
  score += Math.min(Math.abs(prev - 50), Math.abs(next - 50)) / 5 * 10;
  return score;
}

/** Encode text into a QR matrix. Returns { version, size, ecLevel, mask,
 *  modules } with modules as rows of 0/1. Throws on empty text or payloads
 *  longer than version 6-M capacity (106 bytes). */
export function encodeQrMatrix(text) {
  const input = String(text ?? '');
  if (!input) throw new Error('QR payload must not be empty.');
  const bytes = utf8Encode(input);
  const spec = QR_VERSIONS.find((v, idx) => idx >= 1 && v &&
    v.blocks.reduce((sum, b) => sum + b.count * b.data, 0) >= bytes.length + 2);
  if (!spec) {
    throw new Error(`QR payload too long for version ${QR_MAX_VERSION}-M (max 106 bytes).`);
  }
  const version = QR_VERSIONS.indexOf(spec);
  const dataCodewords = spec.blocks.reduce((sum, b) => sum + b.count * b.data, 0);
  // Bit stream: mode 0100 (byte), 8-bit count, data, terminator, byte pad, pad bytes.
  const bits = [];
  const put = (value, length) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >> i) & 1);
  };
  put(0x4, 4);
  put(bytes.length, 8);
  for (const byte of bytes) put(byte, 8);
  const capacityBits = dataCodewords * 8;
  const terminator = Math.min(4, capacityBits - bits.length);
  for (let i = 0; i < terminator; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);
  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    codewords.push(byte);
  }
  const padStart = codewords.length;
  for (let i = padStart; i < dataCodewords; i++) {
    codewords.push((i - padStart) % 2 === 0 ? 0xec : 0x11);
  }
  // Split into blocks, compute EC, interleave data then EC.
  const blocks = [];
  let offset = 0;
  for (const group of spec.blocks) {
    for (let k = 0; k < group.count; k++) {
      const data = codewords.slice(offset, offset + group.data);
      offset += group.data;
      blocks.push({ data, ec: rsComputeRemainder(data, spec.ecPerBlock) });
    }
  }
  const finalCodewords = [];
  const maxData = Math.max(...blocks.map((b) => b.data.length));
  for (let i = 0; i < maxData; i++) for (const b of blocks) if (i < b.data.length) finalCodewords.push(b.data[i]);
  for (let i = 0; i < spec.ecPerBlock; i++) for (const b of blocks) finalCodewords.push(b.ec[i]);
  const finalBits = [];
  for (const byte of finalCodewords) for (let i = 7; i >= 0; i--) finalBits.push((byte >> i) & 1);

  const size = 17 + 4 * version;
  const base = Array.from({ length: size }, () => new Array(size).fill(0));
  const isFunction = Array.from({ length: size }, () => new Array(size).fill(false));
  const setFunction = (x, y, value) => {
    base[y][x] = value ? 1 : 0;
    isFunction[y][x] = true;
  };
  // Finder patterns + separators.
  const drawFinder = (ox, oy) => {
    for (let dy = -1; dy <= 7; dy++) {
      for (let dx = -1; dx <= 7; dx++) {
        const x = ox + dx;
        const y = oy + dy;
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        if (dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6) {
          const border = dx === 0 || dx === 6 || dy === 0 || dy === 6;
          const center = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
          setFunction(x, y, border || center);
        } else {
          setFunction(x, y, 0);
        }
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(size - 7, 0);
  drawFinder(0, size - 7);
  // Timing patterns.
  for (let i = 8; i < size - 8; i++) {
    setFunction(i, 6, i % 2 === 0);
    setFunction(6, i, i % 2 === 0);
  }
  // Alignment patterns.
  const centers = spec.alignment;
  for (const cy of centers) {
    for (const cx of centers) {
      if (isFunction[cy][cx]) continue; // overlaps a finder — skip
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const border = Math.max(Math.abs(dx), Math.abs(dy)) === 2;
          const center = dx === 0 && dy === 0;
          setFunction(cx + dx, cy + dy, border || center);
        }
      }
    }
  }
  // Dark module (column 8, row 4V+9) + format-info reservations.
  setFunction(8, size - 8, 1);
  const formatPositions = [];
  for (let i = 0; i <= 5; i++) formatPositions.push([8, i]);
  formatPositions.push([8, 7], [8, 8], [7, 8]);
  for (let i = 9; i < 15; i++) formatPositions.push([14 - i, 8]);
  for (let i = 0; i < 8; i++) formatPositions.push([size - 1 - i, 8]);
  for (let i = 8; i < 15; i++) formatPositions.push([8, size - 15 + i]);
  for (const [x, y] of formatPositions) setFunction(x, y, 0);

  // Try every mask, keep the lowest-penalty matrix.
  let best = null;
  for (let mask = 0; mask < 8; mask++) {
    const modules = base.map((row) => [...row]);
    let bitIndex = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? size - 1 - vert : vert;
          if (!isFunction[y][x] && bitIndex < finalBits.length) {
            let bit = finalBits[bitIndex++];
            if (maskBit(mask, x, y)) bit ^= 1;
            modules[y][x] = bit;
          }
        }
      }
    }
    // Format information (unmasked, both copies).
    const format = qrFormatBits(mask);
    const getBit = (i) => (format >> i) & 1;
    for (let i = 0; i <= 5; i++) modules[i][8] = getBit(i);
    modules[7][8] = getBit(6);
    modules[8][8] = getBit(7);
    modules[8][7] = getBit(8);
    for (let i = 9; i < 15; i++) modules[8][14 - i] = getBit(i);
    for (let i = 0; i < 8; i++) modules[8][size - 1 - i] = getBit(i);
    for (let i = 8; i < 15; i++) modules[size - 15 + i][8] = getBit(i);
    const score = penaltyScore(modules);
    if (best === null || score < best.score) best = { mask, modules, score };
  }
  return { version, size, ecLevel: QR_EC_LEVEL, mask: best.mask, modules: best.modules };
}

/** Draw a QR matrix onto a canvas (or canvas-like object with getContext).
 *  Returns the canvas. Quiet area = margin modules on every side. */
export function drawQrToCanvas(canvas, matrix, { modulePx = 4, margin = 4, dark = '#000000', light = '#ffffff' } = {}) {
  const size = matrix.size;
  const total = size + margin * 2;
  canvas.width = total * modulePx;
  canvas.height = total * modulePx;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = dark;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (matrix.modules[y][x]) {
        ctx.fillRect((x + margin) * modulePx, (y + margin) * modulePx, modulePx, modulePx);
      }
    }
  }
  return canvas;
}
