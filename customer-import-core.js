/**
 * Bulk Add Customers — pure logic (parser, package matching, row status, save, undo).
 * UI lives in customer-import.js. No DOM here, so it is unit-tested directly.
 *
 * Accepts forgiving lines such as
 *   ALI, 15MBPS, 3000RS        SAIM, 5MBPS, 1500        TOUSEEF 5MBPS, 1000
 * Separators: comma, tab, semicolon, pipe or plain spaces. Speed: 5mbps, 15 MB, 10 Mb/s.
 * Amount: 3000, 3000rs, Rs 3,000, PKR 1500, 1500/-. Optional phone (03xx…, +92…) and area.
 * A CSV/TSV header row (name, package/speed, fee/amount, phone, area…) is detected and used.
 */
import { addCustomer } from './core.js';
import { BILL_PACKAGES, billPackageByLabel } from './package-catalog.js';
import { applyCustomerPlan } from './customer-plan.js';
import { validateCustomerName, validatePakistanPhone } from './form-validation.js';

const PHONE_RE = /(?:\+?92[\s-]?|0092[\s-]?|0)?3\d{2}[\s-]?\d{7}(?!\d)/;
const SPEED_RE = /(\d+(?:\.\d+)?)\s*(?:mbps|mb\/s|mbs|mb|mbit)(?![a-z])/i;
const DATA_RE = /(\d+(?:\.\d+)?)\s*(gb|tb)(?![a-z])/i;
const UNLIMITED_RE = /\bunlimited\b/i;
const MARKED_AMOUNT_RE = [
  /(?:\brs\.?|\bpkr|₨)\s*:?\s*(\d[\d,]*(?:\.\d+)?)/i,
  /(\d[\d,]*(?:\.\d+)?)\s*(?:\/-|rs\b\.?|rs(?=[^a-z]|$)|pkr\b|rupees?\b)/i
];
const BARE_AMOUNT_RE = /(?<![\w.])(\d{1,3}(?:,\d{3})+|\d{2,7})(?:\.\d+)?(?![\w])/g;

const HEADER_KEYS = {
  name: /^(customer\s*)?(name|naam|customer)$/,
  package: /^(package|pkg|speed|plan|internet|connection|mbps)$/,
  fee: /^(monthly\s*)?(fee|amount|price|rs|pkr|bill|rate|charges?|monthly)(\s*\(?(rs|pkr)\)?)?$/,
  phone: /^(phone|mobile|cell|contact|number|whatsapp|phone\s*(no|number)|mobile\s*(no|number))$/,
  area: /^(area|mohalla|address|location|zone|block|street)$/
};

export const normName = s => String(s ?? '').normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export function normPhone(s) {
  const d = String(s ?? '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('0092')) return `0${d.slice(4)}`;
  if (d.startsWith('92') && d.length === 12) return `0${d.slice(2)}`;
  if (d.length === 10 && d.startsWith('3')) return `0${d}`;
  return d;
}
const toAmount = s => {
  const n = Number(String(s ?? '').replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const tidy = s => String(s ?? '').replace(/^[\s,;:|\-–—.]+|[\s,;:|\-–—]+$/g, '').replace(/\s+/g, ' ').trim();

/** Split one delimited line, honouring "quoted, cells". */
export function splitDelimited(line, delim) {
  const out = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && !cell.trim()) quoted = true;
    else if (ch === delim) { out.push(cell.trim()); cell = ''; }
    else cell += ch;
  }
  out.push(cell.trim());
  return out;
}

/** Package for a speed/data/fee combination, or a custom label (speed text) when nothing matches. */
export function matchPackage({ speed = null, dataGb = null, unlimited = false, fee = null, raw = '' } = {}) {
  const byLabel = raw ? billPackageByLabel(raw) : null;
  if (byLabel) return { packageId: byLabel.id, packageLabel: byLabel.label, fee: fee ?? byLabel.price, feeFromPackage: fee == null };
  if (speed == null) return { packageId: null, packageLabel: tidy(raw), fee, feeFromPackage: false };
  let candidates = BILL_PACKAGES.filter(p => p.speedMbps === speed);
  if (dataGb != null) candidates = candidates.filter(p => p.dataLimit === `${dataGb} GB`);
  else if (unlimited) candidates = candidates.filter(p => !p.dataLimit);
  const byPrice = fee != null ? candidates.find(p => p.price === fee) : null;
  const plan = byPrice || (candidates.length === 1 ? candidates[0] : null);
  if (plan) return { packageId: plan.id, packageLabel: plan.label, fee: fee ?? plan.price, feeFromPackage: fee == null };
  const label = `${speed} Mbps${dataGb != null ? ` / ${dataGb}GB` : unlimited ? ' Unlimited' : ''}`;
  return { packageId: null, packageLabel: label, fee, feeFromPackage: false };
}

/** Pull phone, speed, data, amount out of free text; what is left is name (+ area). */
export function parseFreeLine(line) {
  let rest = ` ${line} `;
  const take = re => { const m = rest.match(re); if (m) rest = rest.replace(m[0], ' , '); return m; };
  const phoneM = take(PHONE_RE);
  const speedM = take(SPEED_RE);
  const dataM = take(DATA_RE);
  const unlimited = UNLIMITED_RE.test(rest);
  if (unlimited) rest = rest.replace(UNLIMITED_RE, ' , ');
  let fee = null;
  for (const re of MARKED_AMOUNT_RE) { const m = take(re); if (m) { fee = toAmount(m[1]); break; } }
  if (fee == null) {
    const bare = [...rest.matchAll(BARE_AMOUNT_RE)].filter(m => toAmount(m[1]) >= 100);
    const m = bare.at(-1);
    if (m) { fee = toAmount(m[1]); rest = rest.slice(0, m.index) + ' , ' + rest.slice(m.index + m[0].length); }
  }
  rest = rest.replace(/\b(rs\.?|pkr|rupees?)\b/gi, ' ');
  const parts = rest.split(/[,\t;|]+/).map(tidy).filter(Boolean);
  return {
    name: parts[0] ?? '',
    area: parts.slice(1).join(', '),
    phone: phoneM ? normPhone(phoneM[0]) : '',
    speed: speedM ? Number(speedM[1]) : null,
    dataGb: dataM ? Number(dataM[1]) * (dataM[2].toLowerCase() === 'tb' ? 1000 : 1) : null,
    unlimited,
    fee
  };
}

function detectHeader(lines) {
  const first = lines[0] ?? '';
  const delim = first.includes('\t') ? '\t' : first.includes(',') ? ',' : first.includes(';') ? ';' : null;
  if (!delim) return null;
  const cells = splitDelimited(first, delim).map(c => c.toLowerCase().replace(/[^a-z0-9() ]+/g, ' ').replace(/\s+/g, ' ').trim());
  if (cells.some(c => /\d{3,}/.test(c))) return null;
  const map = {};
  cells.forEach((c, i) => {
    for (const [key, re] of Object.entries(HEADER_KEYS)) if (map[key] === undefined && re.test(c)) { map[key] = i; break; }
  });
  return Object.keys(map).length >= 2 && map.name !== undefined ? { delim, map } : null;
}

/**
 * Parse pasted/uploaded text into editable rows.
 * @returns {{ rows: Array<Object>, header: boolean }}
 */
export function parseCustomerList(text) {
  const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n').map(l => l.replace(/\u00a0/g, ' ')).filter(l => l.trim());
  const header = detectHeader(lines);
  const body = header ? lines.slice(1) : lines;
  const rows = [];
  body.forEach((line, i) => {
    const lineNo = i + 1 + (header ? 1 : 0);
    let p;
    if (header) {
      const cells = splitDelimited(line, header.delim);
      const cell = key => (header.map[key] !== undefined ? cells[header.map[key]] ?? '' : '');
      const pkg = cell('package');
      const s = pkg.match(SPEED_RE) || pkg.match(/^\s*(\d+(?:\.\d+)?)\s*$/);
      const d = pkg.match(DATA_RE);
      const feeCell = cell('fee');
      const feeParsed = feeCell ? parseFreeLine(feeCell).fee ?? toAmount(feeCell.replace(/[^\d.,]/g, '')) : null;
      p = {
        name: tidy(cell('name')), area: tidy(cell('area')), phone: normPhone(cell('phone')) || '',
        speed: s ? Number(s[1]) : null, dataGb: d ? Number(d[1]) : null, unlimited: UNLIMITED_RE.test(pkg),
        fee: feeParsed, rawPackage: pkg
      };
      if (!p.name && !p.fee && !pkg) return;
    } else {
      p = parseFreeLine(line);
    }
    const pkg = matchPackage({ speed: p.speed, dataGb: p.dataGb, unlimited: p.unlimited, fee: p.fee, raw: p.rawPackage ?? '' });
    rows.push({
      key: `r${lineNo}`, line: lineNo, raw: line.trim(),
      name: p.name,
      phone: p.phone, area: p.area,
      packageId: pkg.packageId, packageLabel: pkg.packageLabel, fee: pkg.fee, feeFromPackage: pkg.feeFromPackage,
      include: null
    });
  });
  return { rows, header: Boolean(header) };
}

/** Re-derive package id/fee after the user edits a row's package text. */
export function updateRowPackage(row, label) {
  const plan = billPackageByLabel(label);
  return { ...row, packageLabel: tidy(label), packageId: plan ? plan.id : null, fee: row.fee ?? (plan ? plan.price : null) };
}

export const ROW_STATUS = {
  ok: { label: 'OK', tone: 'ok' },
  'missing-fee': { label: 'Missing fee', tone: 'warn' },
  duplicate: { label: 'Duplicate', tone: 'warn' },
  'dup-file': { label: 'Duplicate in file', tone: 'warn' },
  error: { label: 'Fix', tone: 'error' }
};

/**
 * Status per row. Duplicate = same name as an existing customer and the same phone (or no phone
 * to tell them apart); "Duplicate in file" = repeated earlier in the list. Rows with a status other
 * than OK are skipped unless the user ticks them (error rows can never be added).
 */
export function computeStatuses(rows, customers = []) {
  const existing = customers.filter(c => !c.archived).map(c => ({ c, n: normName(c.name), p: normPhone(c.phone) }));
  const seen = [];
  return rows.map(row => {
    const n = normName(row.name);
    const p = normPhone(row.phone);
    const nameCheck = validateCustomerName(row.name ?? '');
    let status = 'ok';
    let detail = '';
    if (!nameCheck.valid) { status = 'error'; detail = nameCheck.message; }
    else if (row.phone && !validatePakistanPhone(row.phone).valid && !validatePakistanPhone(row.phone).tip) { status = 'error'; detail = 'Phone number looks wrong.'; }
    else {
      const match = existing.find(e => e.n === n && (!p || !e.p || e.p === p));
      const twin = seen.find(s => s.n === n && (!p || !s.p || s.p === p));
      if (match) { status = 'duplicate'; detail = `Matches #${match.c.customerNumber} ${match.c.name}${match.p ? ` · ${match.p}` : ''}`; }
      else if (twin) { status = 'dup-file'; detail = `Same as line ${twin.line}`; }
      else if (!(Number(row.fee) > 0)) { status = 'missing-fee'; detail = 'No monthly fee — add one, or tick to add without a bill.'; }
    }
    if (status !== 'error') seen.push({ n, p, line: row.line });
    const included = status === 'error' ? false : row.include ?? status === 'ok';
    return { ...row, status, detail, included };
  });
}

export function summarizeRows(rows) {
  const ready = rows.filter(r => r.included).length;
  return { total: rows.length, ready, skipped: rows.length - ready, attention: rows.filter(r => r.status !== 'ok').length };
}

/**
 * Add the included rows through core addCustomer, then give each one its package/fee and this
 * month's bill through customer-plan.js (same as the Add Customer form).
 * @returns {{ nextState, addedIds: string[], added: number, skipped: number, billed: number }}
 */
export function importCustomers(state, statusRows, { referenceDate = new Date(), connectionDate = null } = {}) {
  let next = state;
  const addedIds = [];
  let billed = 0;
  for (const row of statusRows) {
    if (!row.included) continue;
    next = addCustomer(next, row.name, referenceDate, { phone: row.phone || '', mohalla: row.area || '', allowDuplicateName: true });
    const id = next.customers.at(-1).id;
    addedIds.push(id);
    const fee = Number(row.fee);
    if (fee > 0) {
      const plan = { packageLabel: row.packageLabel || '', fee, connectionDate };
      const res = applyCustomerPlan(next, id, plan, referenceDate);
      next = res.nextState;
      if (res.billed) billed += 1;
    }
  }
  return { nextState: next, addedIds, added: addedIds.length, skipped: statusRows.length - addedIds.length, billed };
}

/** Undo a batch: remove the added customers that have no payments yet. */
export function undoImport(state, addedIds) {
  const ids = new Set(addedIds);
  const hasPayments = c => (c.bills ?? []).some(b => (b.payments ?? []).length);
  const removed = state.customers.filter(c => ids.has(c.id) && !hasPayments(c));
  const kept = state.customers.filter(c => ids.has(c.id) && hasPayments(c));
  const removedIds = new Set(removed.map(c => c.id));
  const customers = state.customers.filter(c => !removedIds.has(c.id));
  let nextCustomerNumber = state.nextCustomerNumber;
  if (removed.length) {
    const minRemoved = Math.min(...removed.map(c => c.customerNumber));
    if (!customers.some(c => c.customerNumber >= minRemoved)) nextCustomerNumber = minRemoved;
  }
  return { nextState: { ...state, customers, nextCustomerNumber }, removed: removed.length, kept: kept.length };
}
