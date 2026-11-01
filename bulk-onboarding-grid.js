/**
 * SISP-172: Private Local Roster Import & Bulk Setup Incomplete Customers grid.
 *
 * Two onboarding tools that sit on the app's REAL seams (nothing here
 * invents a parallel customer store or writer):
 *
 *  1. "📥 Import Private Roster (JSON/CSV)" — the owner picks a roster
 *     file from HIS OWN device; the file is parsed in the browser and
 *     fed into default-customers.js's idempotent planner
 *     (planDefaultCustomerAdditions: per canonical-mohalla + normalized
 *     name group counting), and the planned shortfall is created through
 *     core addCustomer — exactly the load-time default-roster path, but
 *     with a private file supplied at runtime instead of a shipped list.
 *     PRIVACY: no roster data is bundled with the app or written into
 *     this repo (PR #478); the file never leaves the device, only the
 *     resulting customer records land in the app's normal local state.
 *     Optional phone / package columns in the file are honoured through
 *     the same seams the other importers use (addCustomer options.phone;
 *     customer-plan.js applyCustomerPlan for the package). Malformed
 *     rows are reported as skipped with a reason — never a crash, never
 *     a silent partial import: the result always carries added /
 *     alreadyPresent / skipped / failed counts.
 *
 *  2. "⚡ Bulk Setup Incomplete Customers" — a grid of the customers the
 *     imports above leave behind: no mobile number and/or no package.
 *     Filterable by canonical Mohalla; each row carries an inline
 *     package picker (the real BILL_PACKAGES catalogue) and a mobile
 *     input, and one Save writes everything through the real profile
 *     seam (core updateCustomerProfile for the phone, customer-plan.js
 *     applyCustomerPlan for package + fee + this month's bill — the
 *     same path as the Add Customer form and the SISP-53 import).
 *
 * Field mapping (the spec's `!packageId || !phone` in this app's real
 * record shape): the customer record stores NO packageId — a package is
 * "set" when packageSpeed is non-blank OR monthlySellingAmount > 0 (the
 * plan applied from a catalogue packageId sets both). "phone" is the
 * record's `phone` string.
 *
 * FREE handling: a roster row flagged free (or isFreeConnection) lands
 * as isFreeConnection: true through addCustomer and stays free — the
 * import never applies a priced plan to a free entry, and the grid
 * never assigns a billable package to a free connection (its package
 * cell is disabled; only the mobile can be completed). Free customers
 * count as package-complete by definition, so they appear in the grid
 * only while their mobile is missing.
 *
 * Pure logic first (parse / import / incomplete / bulk save — unit
 * tested directly, no DOM); the dialog glue at the bottom follows the
 * bulk-customer-import.js pattern: state comes from
 * window.quickCollectModalController and saving goes through
 * commitState.
 */
import { addCustomer, updateCustomerProfile } from './core.js';
import { planDefaultCustomerAdditions, rosterGroupKey } from './default-customers.js';
import { canonicalMohalla } from './phase3.js';
import { BILL_PACKAGES, billPackageById, billPackageByLabel } from './package-catalog.js';
import { applyCustomerPlan } from './customer-plan.js';
import { matchPackage, splitDelimited } from './customer-import-core.js';
import { normalizePhonePlus92, phoneNationalKey } from './bulk-customer-import.js';
import { validateCustomerName, validatePakistanPhone } from './form-validation.js';
import { t } from './nav-language.js';

const tidy = s => String(s ?? '').replace(/\s+/g, ' ').trim();

const truthyFree = value => {
  if (value === true || value === 1) return true;
  if (typeof value === 'string') return ['true', 'yes', 'y', '1', 'free'].includes(value.trim().toLocaleLowerCase());
  return false;
};

const toFee = value => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replace(/,/g, '').replace(/(rs\.?|pkr|₨|\/-)/gi, '').trim());
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Package resolution shared by both parsers: an explicit catalogue id,
 *  a catalogue label, or free package text + fee (matchPackage, the same
 *  matcher both earlier importers use). Returns {entry} or {skip}. */
function resolveEntryPackage({ packageIdRaw = '', packageText = '', feeRaw = '' } = {}) {
  const fee = toFee(feeRaw);
  const idText = tidy(packageIdRaw);
  const text = tidy(packageText);
  if (idText) {
    const plan = billPackageById(idText);
    if (!plan) return { skip: `Unknown package: ${idText}` };
    return { entry: { packageId: plan.id, packageLabel: plan.label, fee: fee ?? plan.price } };
  }
  if (!text && fee === null) return { entry: null };
  const byLabel = text ? billPackageByLabel(text) : null;
  if (byLabel) return { entry: { packageId: byLabel.id, packageLabel: byLabel.label, fee: fee ?? byLabel.price } };
  const matched = matchPackage({ raw: text, fee });
  return { entry: { packageId: matched.packageId, packageLabel: matched.packageLabel, fee: matched.fee } };
}

/**
 * Normalize one raw roster row (from JSON or CSV) into an import entry
 * { name, mohalla, free, phone, package } — or a skip with the reason.
 * Phone, when present, must be a real Pakistani mobile (the SISP-53
 * wizard treats a bad phone as a never-import row too); it is stored in
 * the canonical +92 form that wizard established.
 */
function normalizeRosterRow(raw, ref) {
  const nameCheck = validateCustomerName(typeof raw?.name === 'string' ? raw.name : (raw?.name ?? ''));
  if (!nameCheck.valid) return { skip: { ref, reason: nameCheck.message } };
  let phone = '';
  const phoneRaw = tidy(raw.phone);
  if (phoneRaw) {
    phone = normalizePhonePlus92(phoneRaw);
    if (!phone && !validatePakistanPhone(phoneRaw).valid) {
      return { skip: { ref, reason: `Invalid phone number: ${phoneRaw}` } };
    }
  }
  const pkg = resolveEntryPackage(raw);
  if (pkg.skip) return { skip: { ref, reason: pkg.skip } };
  return {
    entry: {
      name: nameCheck.cleanName,
      mohalla: tidy(raw.mohalla),
      free: truthyFree(raw.free),
      phone,
      package: pkg.entry
    }
  };
}

const pickField = (obj, keys) => {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null && obj[key] !== '') return obj[key];
  }
  return '';
};

/**
 * Parse a private roster JSON document: either a bare array of entries
 * or an object carrying the list under `roster` / `customers` /
 * `entries`. Entry keys are forgiving (name/customerName/naam,
 * mohalla/area, phone/mobile, package/packageId, fee/amount,
 * free/isFreeConnection). Never throws: an unreadable document returns
 * an `error` code and zero entries, so the caller imports nothing.
 * @returns {{ entries: Array, skipped: Array<{ref, reason}>, error: string|null }}
 */
export function parsePrivateRosterJson(text) {
  let data;
  try {
    data = JSON.parse(String(text ?? ''));
  } catch {
    return { entries: [], skipped: [], error: 'invalid-json' };
  }
  const list = Array.isArray(data) ? data
    : Array.isArray(data?.roster) ? data.roster
    : Array.isArray(data?.customers) ? data.customers
    : Array.isArray(data?.entries) ? data.entries
    : null;
  if (!list) return { entries: [], skipped: [], error: 'no-list' };
  const entries = [];
  const skipped = [];
  list.forEach((item, i) => {
    const ref = i + 1;
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      skipped.push({ ref, reason: 'Row is not an object.' });
      return;
    }
    const result = normalizeRosterRow({
      name: pickField(item, ['name', 'customerName', 'naam', 'customer']),
      mohalla: pickField(item, ['mohalla', 'area', 'zone', 'location']),
      phone: pickField(item, ['phone', 'mobile', 'cell', 'contact']),
      packageText: pickField(item, ['package', 'pkg', 'plan', 'speed']),
      packageIdRaw: pickField(item, ['packageId', 'package_id']),
      feeRaw: pickField(item, ['fee', 'amount', 'price', 'monthlyFee']),
      free: pickField(item, ['free', 'isFreeConnection', 'freeConnection'])
    }, ref);
    if (result.skip) skipped.push(result.skip);
    else entries.push(result.entry);
  });
  return { entries, skipped, error: null };
}

const CSV_HEADER_KEYS = {
  name: new Set(['name', 'customername', 'naam', 'customer']),
  mohalla: new Set(['mohalla', 'area', 'zone', 'location']),
  phone: new Set(['phone', 'mobile', 'cell', 'contact', 'number', 'whatsapp', 'phoneno', 'mobileno', 'phonenumber', 'mobilenumber']),
  package: new Set(['package', 'pkg', 'speed', 'plan', 'mbps', 'packagespeed', 'internet', 'connection']),
  fee: new Set(['fee', 'monthlyfee', 'amount', 'price', 'rs', 'pkr', 'bill', 'rate', 'monthly', 'charges']),
  free: new Set(['free', 'isfreeconnection', 'freeconnection', 'isfree'])
};
const csvHeaderKeyOf = cell => {
  const key = String(cell ?? '').trim().toLocaleLowerCase().replace(/[^a-z0-9]/g, '');
  for (const [field, keys] of Object.entries(CSV_HEADER_KEYS)) if (keys.has(key)) return field;
  return null;
};

/**
 * Parse a private roster CSV/TSV document. A header row maps the
 * columns when it names at least two known columns including the name
 * column; otherwise rows are positional in the SISP-53 name-first
 * layout (Name, Phone, Package, Fee, Area). Blank lines are ignored;
 * every other malformed row is reported in `skipped` with its original
 * line number — parsing never throws.
 */
export function parsePrivateRosterCsv(text) {
  const numbered = String(text ?? '').split(/\r\n|\n|\r/)
    .map((line, idx) => ({ text: line, no: idx + 1 }))
    .filter(entry => entry.text.trim());
  if (!numbered.length) return { entries: [], skipped: [], error: null };
  const delimiter = numbered.some(entry => entry.text.includes('\t')) ? '\t'
    : (numbered[0].text.includes(';') ? ';' : ',');
  const split = line => splitDelimited(line, delimiter).map(tidy);
  const firstCells = split(numbered[0].text);
  const mapped = firstCells.map(csvHeaderKeyOf);
  const header = mapped.filter(Boolean).length >= 2 && mapped.includes('name');
  let mapping = null;
  let body = numbered;
  if (header) {
    mapping = {};
    mapped.forEach((field, idx) => { if (field && mapping[field] === undefined) mapping[field] = idx; });
    body = numbered.slice(1);
  }
  const entries = [];
  const skipped = [];
  for (const entry of body) {
    const cells = split(entry.text);
    if (!cells.some(c => c)) continue;
    let raw;
    if (mapping) {
      const get = field => (mapping[field] === undefined ? '' : cells[mapping[field]] ?? '');
      raw = {
        name: get('name'), mohalla: get('mohalla'), phone: get('phone'),
        packageText: get('package'), feeRaw: get('fee'), free: get('free')
      };
    } else {
      const [name = '', phone = '', packageText = '', feeRaw = '', mohalla = ''] = cells;
      raw = { name, mohalla, phone, packageText, feeRaw, free: '' };
    }
    const result = normalizeRosterRow(raw, entry.no);
    if (result.skip) skipped.push(result.skip);
    else entries.push(result.entry);
  }
  return { entries, skipped, error: null };
}

/** Dispatch on the file name when known, else sniff the first character. */
export function parsePrivateRoster(text, fileName = '') {
  const name = String(fileName ?? '').toLocaleLowerCase();
  if (name.endsWith('.json')) return parsePrivateRosterJson(text);
  if (name.endsWith('.csv') || name.endsWith('.tsv') || name.endsWith('.txt')) return parsePrivateRosterCsv(text);
  const first = String(text ?? '').trimStart().charAt(0);
  return (first === '{' || first === '[') ? parsePrivateRosterJson(text) : parsePrivateRosterCsv(text);
}

/**
 * Feed parsed roster entries through the default-customers planner and
 * create the planned shortfall through core addCustomer. Idempotent by
 * construction: a second run of the same entries plans zero additions
 * (the planner counts ACTIVE existing customers per canonical mohalla +
 * normalized name group), so nothing duplicates. Per-row resilience
 * mirrors the SISP-53 follow-up: one row throwing is reported in
 * `failed`, the rest still import. FREE entries never get a priced
 * plan applied (and bill generation skips free connections regardless).
 * @returns {{ nextState, added: number, addedIds: string[], alreadyPresent: number, failed: Array }}
 */
export function importPrivateRoster(state, entries, { referenceDate = new Date() } = {}) {
  const list = Array.isArray(entries) ? entries : [];
  if (!state || !Array.isArray(state.customers)) {
    return { nextState: state, added: 0, addedIds: [], alreadyPresent: 0, failed: list.map(entry => ({ name: entry?.name ?? '', error: 'No customer state.' })) };
  }
  const additions = planDefaultCustomerAdditions(state.customers, list);
  // The planner emits the shortfall per group in roster order; select
  // exactly that many source entries per group, in order, so optional
  // phone/package data rides with the right record.
  const wanted = new Map();
  for (const addition of additions) {
    const key = rosterGroupKey(addition.name, addition.mohalla);
    wanted.set(key, (wanted.get(key) ?? 0) + 1);
  }
  const taken = new Map();
  const selected = [];
  for (const entry of list) {
    const key = rosterGroupKey(entry.name, entry.mohalla);
    const count = taken.get(key) ?? 0;
    if (count < (wanted.get(key) ?? 0)) {
      taken.set(key, count + 1);
      selected.push(entry);
    }
  }
  let next = state;
  const addedIds = [];
  const failed = [];
  for (const entry of selected) {
    try {
      next = addCustomer(next, entry.name, referenceDate, {
        phone: entry.phone || '',
        mohalla: entry.mohalla || '',
        allowDuplicateName: true,
        isFreeConnection: entry.free === true
      });
      const id = next.customers.at(-1).id;
      addedIds.push(id);
      if (entry.package && entry.free !== true) {
        const res = applyCustomerPlan(next, id, {
          packageLabel: entry.package.packageLabel || '',
          fee: entry.package.fee ?? null,
          connectionDate: null
        }, referenceDate);
        next = res.nextState;
      }
    } catch (err) {
      failed.push({ name: entry.name, error: err.message });
    }
  }
  return {
    nextState: next,
    added: addedIds.length,
    addedIds,
    alreadyPresent: list.length - selected.length,
    failed
  };
}

/** A package counts as set when the record carries a package/speed
 *  label or a positive monthly amount (the record stores no packageId;
 *  applying a catalogue package sets both — see the header note). */
export function customerHasPackage(customer) {
  return Boolean(tidy(customer?.packageSpeed)) || Number(customer?.monthlySellingAmount) > 0;
}

export function customerHasPhone(customer) {
  return Boolean(tidy(customer?.phone));
}

/**
 * Incomplete = an active (non-archived) customer still missing setup:
 * no mobile, or (for billable connections) no package. FREE connections
 * are package-complete by definition — they appear only while their
 * mobile is missing.
 */
export function isIncompleteCustomer(customer) {
  if (!customer || customer.archived === true) return false;
  if (!customerHasPhone(customer)) return true;
  if (customer.isFreeConnection === true) return false;
  return !customerHasPackage(customer);
}

/**
 * The grid rows: incomplete customers, optionally restricted to one
 * canonical Mohalla (key from phase3 canonicalMohalla, so "MOHALLA
 * BANI", "Bani" and "BANII" are one filter), in customer-number order.
 */
export function incompleteCustomers(customers, { mohalla = 'all' } = {}) {
  const list = (Array.isArray(customers) ? customers : []).filter(isIncompleteCustomer);
  const filtered = mohalla === 'all'
    ? list
    : list.filter(customer => (canonicalMohalla(customer.mohalla)?.key ?? '') === mohalla);
  return filtered.sort((a, b) => (a.customerNumber ?? 0) - (b.customerNumber ?? 0));
}

/** Canonical Mohalla groups present among incomplete customers. */
export function incompleteMohallaGroups(customers) {
  const groups = new Map();
  for (const customer of (Array.isArray(customers) ? customers : []).filter(isIncompleteCustomer)) {
    const canonical = canonicalMohalla(customer.mohalla);
    const key = canonical?.key ?? '';
    const label = canonical?.label ?? tidy(customer.mohalla) ?? '';
    const group = groups.get(key) ?? { key, label, count: 0 };
    group.count += 1;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Apply one grid Save. Each edit is { customerId, packageId, phone }:
 *  - phone: applied through core updateCustomerProfile when it names a
 *    different number (compared by national digits, so format-only
 *    differences are not fake changes); stored in +92 canonical form.
 *    An empty phone field means "not touched" — the grid completes
 *    records, it does not blank them.
 *  - packageId: a BILL_PACKAGES id, applied through customer-plan.js
 *    applyCustomerPlan (updateCustomerProfile + package history + this
 *    month's bill — the Add Customer / SISP-53 path). For a FREE
 *    connection the package is NEVER applied (flag stays
 *    isFreeConnection: true, no fee is set, no bill is generated); the
 *    refusal is reported per row as freePackageSkipped, not silent.
 * Per-edit try/catch: a failed edit is reported with its reason and the
 * rest still save.
 * @returns {{ nextState, updated: Array, unchanged: Array, failed: Array }}
 */
export function applyBulkSetup(state, edits, { referenceDate = new Date() } = {}) {
  let next = state;
  const updated = [];
  const unchanged = [];
  const failed = [];
  for (const edit of (Array.isArray(edits) ? edits : [])) {
    const customerId = edit?.customerId;
    try {
      const customer = next.customers.find(c => c.id === customerId);
      if (!customer) throw new Error('Customer not found.');
      if (customer.archived === true) throw new Error('Customer is archived.');
      const applied = [];
      let freePackageSkipped = false;

      const phoneText = tidy(edit.phone);
      if (phoneText) {
        // Validate BEFORE the no-change shortcut: a value that is not a
        // Pakistani mobile at all (never normalizes to +92 form) is a
        // failed edit, never a silent no-op — the SISP-53 rule.
        const normalized = normalizePhonePlus92(phoneText);
        if (!normalized) throw new Error(`Invalid phone number: ${phoneText}`);
        if (phoneNationalKey(normalized) !== phoneNationalKey(customer.phone)) {
          next = updateCustomerProfile(next, customerId, { phone: normalized }, referenceDate);
          applied.push('phone');
        }
      }

      const packageId = tidy(edit.packageId);
      if (packageId) {
        const plan = billPackageById(packageId);
        if (!plan) throw new Error(`Unknown package: ${packageId}`);
        if (customer.isFreeConnection === true) {
          freePackageSkipped = true;
        } else {
          const current = next.customers.find(c => c.id === customerId);
          if (current.packageSpeed !== plan.label || Number(current.monthlySellingAmount) !== plan.price) {
            const res = applyCustomerPlan(next, customerId, {
              packageLabel: plan.label,
              fee: plan.price,
              connectionDate: current.connectionDate || null
            }, referenceDate);
            next = res.nextState;
            applied.push('package');
          }
        }
      }

      const record = { customerId, applied, freePackageSkipped };
      if (applied.length || freePackageSkipped) updated.push(record);
      else unchanged.push(record);
    } catch (err) {
      failed.push({ customerId, error: err.message });
    }
  }
  return { nextState: next, updated, unchanged, failed };
}

/* ------------------------------------------------------------------ */
/* Dialog glue (browser only). Mirrors bulk-customer-import.js wiring. */
/* ------------------------------------------------------------------ */

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

export function setupBulkOnboarding({ win = window, doc = document, getController = () => win.quickCollectModalController } = {}) {
  const $ = id => doc.getElementById(id);
  const modal = $('bulkSetupModal');
  const fileInput = $('rosterImportFile');
  if (!modal || !fileInput || modal.dataset.bogWired) return win.bulkOnboarding || null;
  modal.dataset.bogWired = '1';
  const mohallaSelect = $('bulkSetupMohalla');
  const rowsEl = $('bulkSetupRows');
  const statusEl = $('bulkSetupStatus');
  const countEl = $('bulkSetupCount');

  const state = () => getController()?.getState?.();
  const say = (msg, kind = 'info') => {
    if (!statusEl) return;
    statusEl.textContent = msg || '';
    statusEl.dataset.kind = kind;
    statusEl.hidden = !msg;
  };
  const refreshApp = () => {
    const search = $('globalCustomerSearch');
    if (search) search.dispatchEvent(new win.Event('input', { bubbles: true }));
  };
  const toast = (msg, kind) => {
    if (typeof win.toast === 'function') win.toast(msg, kind === 'error' ? { type: 'error' } : {});
  };

  function renderGrid() {
    const customers = state()?.customers ?? [];
    if (mohallaSelect) {
      const current = mohallaSelect.value || 'all';
      mohallaSelect.innerHTML = `<option value="all">${esc(t('bog_mohalla_all'))}</option>` +
        incompleteMohallaGroups(customers).map(group =>
          `<option value="${esc(group.key)}">${esc(group.label)} (${group.count})</option>`).join('');
      mohallaSelect.value = [...mohallaSelect.options].some(option => option.value === current) ? current : 'all';
    }
    const rows = incompleteCustomers(customers, { mohalla: mohallaSelect?.value || 'all' });
    if (countEl) countEl.textContent = t('bog_count', null, { count: rows.length });
    if (!rowsEl) return;
    if (!rows.length) {
      rowsEl.innerHTML = `<li class="bog-empty">${esc(t('bog_empty'))}</li>`;
      return;
    }
    rowsEl.innerHTML = rows.map(customer => {
      const free = customer.isFreeConnection === true;
      const selected = BILL_PACKAGES.find(plan => plan.label === customer.packageSpeed)?.id ?? '';
      return `<li class="bog-row" data-bog-row="${esc(customer.id)}">
        <div class="bog-row-top">
          <strong>${esc(t('bog_customer_ref', null, { num: customer.customerNumber, name: customer.name }))}</strong>
          ${free ? `<span class="bog-chip bog-chip-free">${esc(t('bog_free_badge'))}</span>` : ''}
          <span class="bog-mohalla">${esc(customer.mohalla || '')}</span>
        </div>
        <div class="bog-fields">
          <label class="bog-f"><span>${esc(t('bog_package_label'))}</span>
            <select data-bog-package ${free ? 'disabled' : ''} aria-label="${esc(t('bog_package_label'))}">
              <option value="">${esc(t('bog_no_package'))}</option>
              ${BILL_PACKAGES.map(plan => `<option value="${esc(plan.id)}" ${plan.id === selected ? 'selected' : ''}>${esc(plan.label)} · PKR ${plan.price.toLocaleString('en-PK')}</option>`).join('')}
            </select>
            ${free ? `<span class="bog-note">${esc(t('bog_free_package_note'))}</span>` : ''}
          </label>
          <label class="bog-f"><span>${esc(t('bog_phone_label'))}</span>
            <input data-bog-phone type="tel" inputmode="tel" value="${esc(customer.phone || '')}" placeholder="03XX-XXXXXXX">
          </label>
        </div>
      </li>`;
    }).join('');
  }

  function open() {
    say('');
    renderGrid();
    modal.showModal?.();
  }
  function close() { modal.close?.(); }

  function save() {
    const ctl = getController();
    const st = state();
    if (!ctl || !st || !rowsEl) return;
    const edits = [...rowsEl.querySelectorAll('[data-bog-row]')].map(rowEl => ({
      customerId: rowEl.dataset.bogRow,
      packageId: rowEl.querySelector('[data-bog-package]')?.value ?? '',
      phone: rowEl.querySelector('[data-bog-phone]')?.value ?? ''
    }));
    const res = applyBulkSetup(st, edits);
    ctl.commitState(res.nextState);
    refreshApp();
    renderGrid();
    const freeSkipped = res.updated.filter(record => record.freePackageSkipped).length;
    let msg = t('bog_save_result', null, { updated: res.updated.length, unchanged: res.unchanged.length, failed: res.failed.length });
    if (freeSkipped) msg += ` ${t('bog_free_skipped', null, { count: freeSkipped })}`;
    if (res.failed.length) {
      const names = new Map((res.nextState.customers ?? []).map(c => [c.id, c.name]));
      msg += ` ${res.failed.map(f => `${names.get(f.customerId) ?? f.customerId}: ${f.error}`).join(' · ')}`;
    }
    say(msg, res.failed.length ? 'error' : 'info');
  }

  async function importFile(file) {
    const ctl = getController();
    const st = state();
    if (!ctl || !st || !file) return;
    let text;
    try {
      text = typeof file.text === 'function' ? await file.text() : await new Promise((resolve, reject) => {
        const reader = new win.FileReader();
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
      });
    } catch {
      toast(t('bog_import_error', null, { reason: file.name || '' }), 'error');
      return;
    }
    const parsed = parsePrivateRoster(text, file.name);
    if (parsed.error) {
      toast(t('bog_import_error', null, { reason: t(parsed.error === 'invalid-json' ? 'bog_reason_invalid_json' : 'bog_reason_no_list') }), 'error');
      return;
    }
    const res = importPrivateRoster(st, parsed.entries);
    if (res.added) ctl.commitState(res.nextState);
    refreshApp();
    toast(t('bog_import_done', null, {
      added: res.added,
      present: res.alreadyPresent,
      skipped: parsed.skipped.length,
      failed: res.failed.length
    }), res.failed.length ? 'error' : 'info');
  }

  $('rosterImportOpenBtn')?.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (file) importFile(file);
  });
  $('bulkSetupOpenBtn')?.addEventListener('click', open);
  $('bulkSetupCloseBtn')?.addEventListener('click', close);
  $('bulkSetupDoneBtn')?.addEventListener('click', close);
  $('bulkSetupSaveBtn')?.addEventListener('click', save);
  mohallaSelect?.addEventListener('change', renderGrid);

  const api = { open, close, parsePrivateRoster, importPrivateRoster, incompleteCustomers, applyBulkSetup };
  win.bulkOnboarding = api;
  return api;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined' && document.body) {
  setupBulkOnboarding();
}
