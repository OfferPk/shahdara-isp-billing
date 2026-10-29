/**
 * SISP-53: Bulk Customer CSV / Excel Paste Import Wizard & Duplicate Guard.
 *
 * Distinct from the older Bulk Add (customer-import.js, PR #291), which parses
 * free-form lines ("ALI, 15MBPS, 3000RS"). This wizard is for structured rows
 * pasted straight out of Excel / Google Sheets: a header row maps the columns
 * (Connection ID, Name, Phone, Package, Fee, Area, Address), so the register's
 * own Connection IDs survive the import instead of being re-numbered.
 *
 * Three things the older importer does NOT do, and this one does:
 *  1. +92 phone normalization: 03XX, +92, 0092 and 92 forms all collapse to
 *     one canonical +923XXXXXXXXX value, which is what gets stored and what
 *     duplicate detection compares (so 03001234567 and +923001234567 are the
 *     same phone, not two customers).
 *  2. Duplicate Connection ID / phone guard: a row whose Connection ID or
 *     phone already belongs to a live customer — or to an earlier pasted row
 *     — is flagged and can NEVER be imported from this wizard (its checkbox
 *     is disabled). Nothing is guessed: a flagged row is skipped, never merged.
 *  3. Urdu names: every imported customer gets nameUrdu from urdu-names.js
 *     (PR #402 transliterator), so the bilingual headers (SISP-26) and Urdu
 *     screens show the Urdu script name without anyone typing it.
 *
 * Pure logic (parse / normalize / status / import) has no DOM and is unit
 * tested directly. The dialog glue at the bottom follows the customer-import
 * pattern: state comes from window.quickCollectModalController, saving goes
 * through commitState, and the app re-renders on a global-search input event.
 */
import { addCustomer } from './core.js';
import { applyCustomerPlan } from './customer-plan.js';
import { matchPackage, splitDelimited, undoImport } from './customer-import-core.js';
import { transliterateRomanToUrdu } from './urdu-names.js';
import { validateCustomerName } from './form-validation.js';
import { t } from './nav-language.js';

export const BULK_IMPORT_SAMPLE =
  'Connection ID\tName\tPhone\tPackage\tFee\tArea\n' +
  '101\tALI KHAN\t03001234567\t15Mbps Unlimited\t3000\tBARRIAN\n' +
  '102\tSAIM RAZA\t+923214567890\t5Mbps / 150GB\t1500\tPALALIYAA';

const tidy = s => String(s ?? '').replace(/\s+/g, ' ').trim();
const toFee = s => {
  const n = Number(String(s ?? '').replace(/,/g, '').replace(/(rs\.?|pkr|₨|\/-)/gi, '').trim());
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Normalize any Pakistani mobile form to +923XXXXXXXXX, or '' when not one. */
export function normalizePhonePlus92(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return '';
  const digits = text.replace(/\D/g, '');
  let national = '';
  if (text.startsWith('+')) {
    if (digits.startsWith('92') && digits.length === 12) national = digits.slice(2);
  } else if (digits.startsWith('0092') && digits.length === 14) national = digits.slice(4);
  else if (digits.startsWith('92') && digits.length === 12) national = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('03')) national = digits.slice(1);
  else if (digits.length === 10 && digits.startsWith('3')) national = digits;
  if (national.length === 10 && national.startsWith('3')) return `+92${national}`;
  return '';
}

/** Comparison key for a stored or pasted phone: the 10 national digits, or ''. */
export function phoneNationalKey(value) {
  const plus = normalizePhonePlus92(value);
  return plus ? plus.slice(3) : '';
}

const HEADER_KEYS = {
  connectionId: new Set(['connectionid', 'connid', 'customernumber', 'customerno', 'id', '#', 'sr', 'srno', 'customer#']),
  name: new Set(['name', 'customername', 'naam', 'customer']),
  phone: new Set(['phone', 'mobile', 'cell', 'contact', 'number', 'whatsapp', 'phoneno', 'mobileno', 'phonenumber']),
  package: new Set(['package', 'pkg', 'speed', 'plan', 'mbps', 'packagespeed']),
  fee: new Set(['fee', 'monthlyfee', 'amount', 'price', 'rs', 'pkr', 'bill', 'rate', 'monthly', 'charges']),
  area: new Set(['area', 'mohalla', 'zone', 'location']),
  address: new Set(['address', 'homeaddress', 'houseaddress'])
};
const headerKeyOf = cell => {
  const key = String(cell ?? '').trim().toLocaleLowerCase().replace(/[^a-z0-9#]/g, '');
  for (const [field, keys] of Object.entries(HEADER_KEYS)) if (keys.has(key)) return field;
  return null;
};

function detectDelimiter(lines) {
  if (lines.some(l => l.includes('\t'))) return '\t';
  const first = lines[0] ?? '';
  if (first.includes(';')) return ';';
  return ',';
}

function parsePackageCell(cell) {
  const raw = tidy(cell);
  const speedM = raw.match(/(\d+(?:\.\d+)?)\s*(?:mbps|mb\/s|mbs|mb|mbit)/i);
  const dataM = raw.match(/(\d+(?:\.\d+)?)\s*(gb|tb)/i);
  return {
    speed: speedM ? Number(speedM[1]) : null,
    dataGb: dataM ? (dataM[2].toLowerCase() === 'tb' ? Number(dataM[1]) * 1024 : Number(dataM[1])) : null,
    unlimited: /\bunlimited\b/i.test(raw),
    raw
  };
}

function rowFromCells(cells, lineNo, mapping) {
  const get = field => {
    if (mapping) {
      const idx = mapping[field];
      return idx === undefined ? '' : tidy(cells[idx] ?? '');
    }
    return '';
  };
  let connectionRaw = ''; let name = ''; let phoneRaw = ''; let packageCell = ''; let feeRaw = ''; let area = ''; let address = '';
  if (mapping) {
    connectionRaw = get('connectionId'); name = get('name'); phoneRaw = get('phone');
    packageCell = get('package'); feeRaw = get('fee'); area = get('area'); address = get('address');
  } else if (cells.length >= 4 && /^\d+$/.test(tidy(cells[0]))) {
    // Headerless register paste, Connection ID first: ID, Name, Phone, Package, Fee, Area, Address.
    [connectionRaw, name, phoneRaw, packageCell, feeRaw, area, address] = cells.map(tidy);
  } else {
    // Headerless, name first: Name, Phone, Package, Fee, Area, Address.
    [name, phoneRaw, packageCell, feeRaw, area, address] = cells.map(tidy);
  }
  const connectionId = /^\d+$/.test(connectionRaw) ? Number(connectionRaw) : null;
  const fee = toFee(feeRaw);
  const pkg = parsePackageCell(packageCell);
  const matched = matchPackage({ speed: pkg.speed, dataGb: pkg.dataGb, unlimited: pkg.unlimited, fee, raw: pkg.raw });
  const phone = normalizePhonePlus92(phoneRaw);
  return {
    key: `b${lineNo}`, line: lineNo,
    raw: cells.join(' | '),
    connectionId, name, phone, phoneRaw: tidy(phoneRaw),
    packageId: matched.packageId, packageLabel: matched.packageLabel,
    fee: matched.fee, feeFromPackage: matched.feeFromPackage,
    area, address, urduName: transliterateRomanToUrdu(name),
    include: null
  };
}

/**
 * Parse pasted CSV/TSV text into structured rows. A header row is used when
 * it maps at least two known columns including a name/phone/connection
 * column; otherwise rows are positional (see rowFromCells).
 */
export function parseBulkImportText(text) {
  const lines = String(text ?? '').split(/\r\n|\n|\r/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return { rows: [], header: false, delimiter: ',' };
  const delimiter = detectDelimiter(lines);
  const split = line => splitDelimited(line, delimiter).map(tidy);
  const firstCells = split(lines[0]);
  const mapped = firstCells.map(headerKeyOf);
  const knownCount = mapped.filter(Boolean).length;
  const hasIdentity = mapped.some(k => k === 'name' || k === 'phone' || k === 'connectionId');
  const header = knownCount >= 2 && hasIdentity;
  let mapping = null;
  let body = lines;
  if (header) {
    mapping = {};
    mapped.forEach((field, idx) => { if (field && mapping[field] === undefined) mapping[field] = idx; });
    body = lines.slice(1);
  }
  const rows = [];
  body.forEach((line, i) => {
    const cells = split(line);
    if (!cells.some(c => c)) return;
    const row = rowFromCells(cells, i + (header ? 2 : 1), mapping);
    if (row.name || row.phone || row.connectionId !== null) rows.push(row);
  });
  return { rows, header, delimiter };
}

export const BULK_ROW_STATUS = {
  ok: { label: 'OK', tone: 'ok' },
  'missing-fee': { label: 'Missing fee', tone: 'warn' },
  'duplicate-connection': { label: 'Duplicate ID', tone: 'warn' },
  'duplicate-phone': { label: 'Duplicate phone', tone: 'warn' },
  error: { label: 'Fix', tone: 'error' }
};

/**
 * Status per row. Duplicate-connection and duplicate-phone rows are never
 * importable (included === false, checkbox disabled in the dialog): the
 * guard flags them, it does not merge them. Missing-fee rows can be ticked
 * to add without a bill, mirroring the older Bulk Add behaviour.
 */
export function computeBulkStatuses(rows, customers = []) {
  const existing = customers.filter(c => !c.archived).map(c => ({
    c, num: c.customerNumber, phoneKey: phoneNationalKey(c.phone)
  }));
  const seenIds = new Map();
  const seenPhones = new Map();
  return rows.map(row => {
    const nameCheck = validateCustomerName(row.name ?? '');
    let status = 'ok';
    let detail = '';
    if (!nameCheck.valid) {
      status = 'error'; detail = nameCheck.message;
    } else if (row.phoneRaw && !row.phone) {
      status = 'error'; detail = 'Phone number looks wrong — use a Pakistani mobile (03XX… or +92…).';
    } else if (row.connectionId !== null) {
      const clash = existing.find(e => e.num === row.connectionId);
      const twin = seenIds.get(row.connectionId);
      if (clash) { status = 'duplicate-connection'; detail = `Connection ID #${row.connectionId} already belongs to ${clash.c.name}.`; }
      else if (twin) { status = 'duplicate-connection'; detail = `Same Connection ID as line ${twin}.`; }
    }
    if (status === 'ok' && row.phone) {
      const key = phoneNationalKey(row.phone);
      const clash = key ? existing.find(e => e.phoneKey && e.phoneKey === key) : null;
      const twin = key ? seenPhones.get(key) : null;
      if (clash) { status = 'duplicate-phone'; detail = `Phone ${row.phone} already belongs to #${clash.c.customerNumber} ${clash.c.name}.`; }
      else if (twin) { status = 'duplicate-phone'; detail = `Same phone as line ${twin}.`; }
    }
    if (status === 'ok' && !(Number(row.fee) > 0)) {
      status = 'missing-fee'; detail = 'No monthly fee — tick to add without a bill.';
    }
    if (status !== 'error') {
      if (row.connectionId !== null && !seenIds.has(row.connectionId)) seenIds.set(row.connectionId, row.line);
      const key = phoneNationalKey(row.phone);
      if (key && !seenPhones.has(key)) seenPhones.set(key, row.line);
    }
    const included = (status === 'error' || status.startsWith('duplicate'))
      ? false
      : (row.include ?? status === 'ok');
    return { ...row, status, detail, included };
  });
}

export function summarizeBulkRows(rows) {
  return {
    total: rows.length,
    ready: rows.filter(r => r.included).length,
    skipped: rows.filter(r => !r.included).length,
    attention: rows.filter(r => r.status !== 'ok').length,
    duplicates: rows.filter(r => r.status.startsWith('duplicate')).length
  };
}

/**
 * Add the included rows through core addCustomer — with the register's own
 * Connection ID when it is free (core requestedCustomerNumber) and the
 * transliterated Urdu name — then give each one its package/fee and this
 * month's bill through customer-plan.js, exactly like the Add Customer form.
 */
export function importBulkCustomers(state, statusRows, { referenceDate = new Date(), connectionDate = null } = {}) {
  let next = state;
  const addedIds = [];
  let billed = 0;
  for (const row of statusRows) {
    if (!row.included) continue;
    next = addCustomer(next, row.name, referenceDate, {
      phone: row.phone || '',
      mohalla: row.area || '',
      address: row.address || '',
      nameUrdu: row.urduName || '',
      requestedCustomerNumber: row.connectionId,
      allowDuplicateName: true
    });
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

export { undoImport as undoBulkImport };

/* ------------------------------------------------------------------ */
/* Dialog glue (browser only). Mirrors customer-import.js wiring.       */
/* ------------------------------------------------------------------ */

const esc = value => String(value ?? '').replace(/[&<>\"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const pkr = n => `PKR ${Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`;

export function setupBulkCustomerImport({ win = window, doc = document, getController = () => win.quickCollectModalController } = {}) {
  const $ = id => doc.getElementById(id);
  const modal = $('bulkImportModal');
  if (!modal || modal.dataset.bciWired) return win.bulkCustomerImport || null;
  modal.dataset.bciWired = '1';
  const openBtn = $('bulkImportOpenBtn');
  const steps = { input: $('bciStepInput'), preview: $('bciStepPreview'), done: $('bciStepDone') };
  const textArea = $('bciText');
  const rowsEl = $('bciRows');
  let rows = [];
  let lastImport = null;

  const state = () => getController()?.getState?.();
  const show = name => { for (const [k, el] of Object.entries(steps)) if (el) el.hidden = k !== name; };
  const say = (el, msg, kind = 'info') => { if (!el) return; el.textContent = msg || ''; el.dataset.kind = kind; el.hidden = !msg; };
  const refreshApp = () => {
    const search = $('globalCustomerSearch');
    if (search) search.dispatchEvent(new win.Event('input', { bubbles: true }));
  };
  const statusRows = () => computeBulkStatuses(rows, state()?.customers ?? []);
  const getPakistanLocalDate = () => {
    const d = new Date(Date.now() + 5 * 3600 * 1000);
    return d.toISOString().slice(0, 10);
  };

  function renderRows() {
    const list = statusRows();
    const sum = summarizeBulkRows(list);
    if ($('bciCounts')) $('bciCounts').innerHTML = `<strong>${sum.total}</strong> row${sum.total === 1 ? '' : 's'} · <strong>${sum.ready}</strong> to add${sum.attention ? ` · <span class="bci-attn">${sum.attention} need a look</span>` : ''}`;
    if (!rowsEl) return;
    rowsEl.innerHTML = list.map(r => {
      const st = BULK_ROW_STATUS[r.status];
      const locked = r.status === 'error' || r.status.startsWith('duplicate');
      return `<li class="bci-row is-${st.tone}${r.included ? ' is-included' : ''}" data-bci-row="${esc(r.key)}">
        <div class="bci-row-top">
          <label class="bci-include"><input type="checkbox" data-bci-include ${r.included ? 'checked' : ''} ${locked ? 'disabled' : ''} aria-label="Import ${esc(r.name || `line ${r.line}`)}"><span class="bci-line">Line ${r.line}</span></label>
          <span class="bci-chip bci-chip-${st.tone}">${esc(st.label)}</span>
        </div>
        <div class="bci-fields">
          <span><strong>${esc(r.name)}</strong>${r.urduName ? ` <span class="bci-urdu">${esc(r.urduName)}</span>` : ''}</span>
          <span>${r.connectionId !== null ? `#${r.connectionId} · ` : ''}${esc(r.packageLabel || 'No package')} · ${r.fee ? esc(pkr(r.fee)) : 'no fee'}${r.phone ? ` · ${esc(r.phone)}` : ''}${r.area ? ` · ${esc(r.area)}` : ''}</span>
          ${r.detail ? `<span class="bci-detail">${esc(r.detail)}</span>` : ''}
        </div>
      </li>`;
    }).join('');
  }

  function open() {
    rows = []; lastImport = null;
    if (textArea) textArea.value = '';
    say($('bciInputStatus'), '');
    show('input');
    modal.showModal?.();
    textArea?.focus();
  }
  function close() { modal.close?.(); }

  function preview() {
    const { rows: parsed } = parseBulkImportText(textArea.value);
    if (!parsed.length) { say($('bciInputStatus'), t('bci_empty'), 'error'); textArea.focus(); return; }
    rows = parsed;
    say($('bciInputStatus'), '');
    show('preview');
    renderRows();
  }

  function syncFromPreview() {
    const list = statusRows();
    rowsEl.querySelectorAll('[data-bci-row]').forEach(el => {
      const row = rows.find(r => r.key === el.dataset.bciRow);
      const box = el.querySelector('[data-bci-include]');
      if (row && box && !box.disabled) row.include = box.checked;
    });
    return list;
  }

  function addAll() {
    const ctl = getController();
    const st = state();
    if (!ctl || !st) return;
    syncFromPreview();
    try {
      const list = statusRows();
      const res = importBulkCustomers(st, list, { connectionDate: getPakistanLocalDate() });
      ctl.commitState(res.nextState);
      refreshApp();
      lastImport = res;
      if ($('bciDoneTitle')) $('bciDoneTitle').textContent = t('bci_done_title', null, { count: res.added });
      if ($('bciDoneDetail')) $('bciDoneDetail').textContent = t('bci_done_detail', null, { billed: res.billed, skipped: res.skipped });
      const added = res.nextState.customers.filter(c => res.addedIds.includes(c.id));
      if ($('bciDoneList')) $('bciDoneList').innerHTML = added.slice(0, 8).map(c =>
        `<li><strong>#${c.customerNumber} ${esc(c.name)}</strong>${c.nameUrdu ? ` <span class="bci-urdu">${esc(c.nameUrdu)}</span>` : ''} <span>${esc(c.packageSpeed || 'No package')} · ${c.monthlySellingAmount ? esc(pkr(c.monthlySellingAmount)) : 'no fee'}</span></li>`).join('')
        + (added.length > 8 ? `<li>+ ${added.length - 8} more</li>` : '');
      if ($('bciUndoBtn')) $('bciUndoBtn').disabled = !res.added;
      say($('bciDoneStatus'), '');
      show('done');
    } catch (err) {
      say($('bciInputStatus'), err.message, 'error');
      show('input');
    }
  }

  function undo() {
    const ctl = getController();
    const st = state();
    if (!lastImport || !ctl || !st) return;
    const res = undoBulkImport(st, lastImport.addedIds);
    ctl.commitState(res.nextState);
    refreshApp();
    lastImport = null;
    if ($('bciUndoBtn')) $('bciUndoBtn').disabled = true;
    say($('bciDoneStatus'), t('bci_undone', null, { count: res.removed }), 'info');
  }

  openBtn?.addEventListener('click', open);
  $('bciCloseBtn')?.addEventListener('click', close);
  $('bciSampleBtn')?.addEventListener('click', () => { if (textArea) textArea.value = BULK_IMPORT_SAMPLE; });
  $('bciPreviewBtn')?.addEventListener('click', preview);
  $('bciBackBtn')?.addEventListener('click', () => show('input'));
  $('bciImportBtn')?.addEventListener('click', addAll);
  $('bciUndoBtn')?.addEventListener('click', undo);
  $('bciDoneBtn')?.addEventListener('click', close);
  rowsEl?.addEventListener('change', e => {
    if (!e.target.closest('[data-bci-include]')) return;
    const el = e.target.closest('[data-bci-row]');
    const row = rows.find(r => r.key === el.dataset.bciRow);
    if (row) row.include = e.target.checked;
    renderRows();
  });
  modal.addEventListener('close', () => { rows = []; });

  const api = { open, close, parseBulkImportText, computeBulkStatuses, importBulkCustomers };
  win.bulkCustomerImport = api;
  return api;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined' && document.body) {
  setupBulkCustomerImport();
}
