/**
 * Bulk Add Customers (UI). Opens from "⇪ Bulk add" next to + Add Customer, from a link inside the
 * Add Customer dialog, or the #/customers/import route (deep link / reload / Back).
 *
 * 1. Paste a list, or upload .txt / .csv / .pdf (PDF text is read on this device with pdf.js,
 *    loaded only when a PDF is chosen; offline it explains how to paste instead).
 * 2. Preview: every row is editable (name, package, fee, phone, area) with a status — OK /
 *    Missing fee / Duplicate (existing customer, same name + phone) / Duplicate in file / Fix.
 *    Only ticked rows are added; OK rows are ticked by default. Rows can be removed.
 * 3. "Add N customers" saves through core addCustomer + customer-plan.js billing, so each one
 *    gets this month's bill and is pending in Quick / Bulk Collect. A summary shows added /
 *    skipped with Undo for the whole batch (customers with no payments yet are removed).
 * Pure logic: customer-import-core.js.
 */
import { BILL_PACKAGES } from './package-catalog.js';
import { getPakistanLocalDate } from './nav-quick-collect.js';
import {
  parseCustomerList, computeStatuses, summarizeRows, importCustomers, undoImport, updateRowPackage, ROW_STATUS
} from './customer-import-core.js';

export const IMPORT_HASH = `#/customers/import`; // backticks: build.mjs scans for import + quote
export const PDFJS_VERSION = '4.10.38';
const PDFJS_BASE = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build`;
const SAMPLE = 'ALI, 15MBPS, 3000RS\nSAIM, 5MBPS, 1500\nTOUSEEF 5MBPS, 1000';

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const pkr = n => `PKR ${Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`;

/** Extract text from a PDF with pdf.js (lazy, from the CDN). Throws a friendly error offline. */
export async function readPdfText(file, { importer = url => import(/* @vite-ignore */ url) } = {}) {
  let pdfjs;
  try {
    pdfjs = await importer(`${PDFJS_BASE}/pdf.min.mjs`);
    pdfjs.GlobalWorkerOptions.workerSrc = `${PDFJS_BASE}/pdf.worker.min.mjs`;
  } catch {
    throw new Error('Could not load the PDF reader — it needs internet the first time. Open the PDF, copy the customer list and paste it in the box instead (or save it as .csv / .txt).');
  }
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const lines = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const content = await (await doc.getPage(n)).getTextContent();
    // Group text items into lines by their y position (PDF tables come out item by item).
    const rows = new Map();
    for (const item of content.items) {
      if (!item.str?.trim()) continue;
      const y = Math.round(item.transform[5]);
      const key = [...rows.keys()].find(k => Math.abs(k - y) <= 2) ?? y;
      if (!rows.has(key)) rows.set(key, []);
      rows.get(key).push({ x: item.transform[4], s: item.str });
    }
    [...rows.entries()].sort((a, b) => b[0] - a[0])
      .forEach(([, items]) => lines.push(items.sort((a, b) => a.x - b.x).map(i => i.s.trim()).join(', ')));
  }
  return lines.join('\n');
}

export function setupCustomerImport({ win = window, doc = document, getController = () => win.quickCollectModalController } = {}) {
  if (doc.getElementById('customerImportModal')) return win.customerImport;
  const wrap = doc.createElement('div');
  wrap.innerHTML = `
  <dialog id="customerImportModal" class="modal customer-import-modal" aria-labelledby="customerImportTitle">
    <section class="ci-card">
      <div class="modal-heading">
        <div><p class="eyebrow">CUSTOMERS · BULK ADD</p><h2 id="customerImportTitle">Bulk add customers</h2></div>
        <button id="closeCustomerImportBtn" class="close-button" type="button" aria-label="Close bulk add">×</button>
      </div>

      <div id="ciStepInput" class="ci-step">
        <p class="ci-note">Paste one customer per line — name, speed and monthly fee; phone and area are optional. Example: <code>ALI, 15MBPS, 3000RS</code></p>
        <label class="field-label" for="ciText">Customer list</label>
        <textarea id="ciText" class="ci-text" rows="8" spellcheck="false" placeholder="${esc(SAMPLE)}"></textarea>
        <div class="ci-input-actions">
          <label class="secondary-button ci-file-btn" for="ciFile"><span aria-hidden="true">📄</span> Upload .txt / .csv / .pdf</label>
          <input id="ciFile" class="ci-file" type="file" accept=".txt,.csv,.tsv,.pdf,text/plain,text/csv,application/pdf">
          <button id="ciSampleBtn" class="text-button ci-sample-btn" type="button">Use example</button>
        </div>
        <p id="ciInputStatus" class="ci-status" role="status" aria-live="polite" hidden></p>
        <button id="ciPreviewBtn" class="primary-button ci-primary" type="button">Preview customers</button>
      </div>

      <div id="ciStepPreview" class="ci-step" hidden>
        <div class="ci-preview-head">
          <p id="ciCounts" class="ci-counts" aria-live="polite"></p>
          <button id="ciBackBtn" class="text-button" type="button">← Edit list</button>
        </div>
        <p class="ci-note">Check each row. Ticked rows are added; untick to skip. Duplicates and rows without a fee are unticked — fix them or tick to add anyway.</p>
        <datalist id="ciPackageOptions">${BILL_PACKAGES.map(p => `<option value="${esc(p.label)}"></option>`).join('')}</datalist>
        <ol id="ciRows" class="ci-rows" aria-label="Customers to add"></ol>
        <div class="ci-footer">
          <p id="ciFooterNote" class="ci-footer-note"></p>
          <button id="ciAddBtn" class="primary-button ci-primary" type="button">Add customers</button>
        </div>
      </div>

      <div id="ciStepDone" class="ci-step ci-done" hidden>
        <div class="ci-done-icon" aria-hidden="true">✅</div>
        <h3 id="ciDoneTitle" class="ci-done-title"></h3>
        <p id="ciDoneDetail" class="ci-done-detail"></p>
        <ul id="ciDoneList" class="ci-done-list"></ul>
        <p id="ciDoneStatus" class="ci-status" role="status" aria-live="polite" hidden></p>
        <div class="ci-done-actions">
          <button id="ciOpenCollectBtn" class="primary-button" type="button">Open Quick Collect</button>
          <button id="ciUndoBtn" class="secondary-button ci-undo-btn" type="button">↶ Undo this import</button>
          <button id="ciDoneBtn" class="secondary-button" type="button">Done</button>
        </div>
      </div>
    </section>
  </dialog>`;
  doc.body.appendChild(wrap.firstElementChild);

  const $ = id => doc.getElementById(id);
  const modal = $('customerImportModal');
  const steps = { input: $('ciStepInput'), preview: $('ciStepPreview'), done: $('ciStepDone') };
  const textArea = $('ciText');
  const rowsEl = $('ciRows');
  let rows = [];
  let lastImport = null; // { addedIds, added, skipped }
  let routeMode = null;

  const state = () => getController()?.getState?.();
  const show = name => { for (const [k, el] of Object.entries(steps)) el.hidden = k !== name; };
  const say = (el, msg, kind = 'info') => { el.textContent = msg || ''; el.dataset.kind = kind; el.hidden = !msg; };
  const refreshApp = () => {
    // The app re-renders its customer list, transactions and report on this input event.
    const search = $('globalCustomerSearch');
    if (search) search.dispatchEvent(new win.Event('input', { bubbles: true }));
  };

  function statusRows() { return computeStatuses(rows, state()?.customers ?? []); }

  function renderRows() {
    const list = statusRows();
    const sum = summarizeRows(list);
    $('ciCounts').innerHTML = `<strong>${sum.total}</strong> row${sum.total === 1 ? '' : 's'} · <strong>${sum.ready}</strong> to add${sum.attention ? ` · <span class="ci-attn">${sum.attention} need a look</span>` : ''}`;
    rowsEl.innerHTML = list.map(r => {
      const st = ROW_STATUS[r.status];
      return `<li class="ci-row is-${st.tone}${r.included ? ' is-included' : ''}" data-ci-row="${esc(r.key)}">
        <div class="ci-row-top">
          <label class="ci-include"><input type="checkbox" data-ci-include ${r.included ? 'checked' : ''} ${r.status === 'error' ? 'disabled' : ''} aria-label="Add ${esc(r.name || `line ${r.line}`)}"><span class="ci-line">Line ${r.line}</span></label>
          <span class="ci-chip ci-chip-${st.tone}" data-ci-status="${esc(r.status)}">${esc(st.label)}</span>
          <button type="button" class="ci-remove" data-ci-remove aria-label="Remove line ${r.line}">✕</button>
        </div>
        <div class="ci-fields">
          <label class="ci-f ci-f-name"><span>Name</span><input data-ci-field="name" value="${esc(r.name)}" maxlength="100" autocomplete="off"></label>
          <label class="ci-f ci-f-pkg"><span>Package</span><input data-ci-field="packageLabel" value="${esc(r.packageLabel)}" list="ciPackageOptions" maxlength="80" autocomplete="off" placeholder="e.g. 5 Mbps"></label>
          <label class="ci-f ci-f-fee"><span>Fee (PKR)</span><input data-ci-field="fee" value="${r.fee ?? ''}" type="number" min="1" step="1" inputmode="numeric" placeholder="Fee"></label>
          <label class="ci-f ci-f-phone"><span>Phone</span><input data-ci-field="phone" value="${esc(r.phone)}" type="tel" maxlength="40" autocomplete="off" placeholder="Optional"></label>
          <label class="ci-f ci-f-area"><span>Area</span><input data-ci-field="area" value="${esc(r.area)}" maxlength="100" autocomplete="off" placeholder="Optional"></label>
        </div>
        ${r.detail ? `<p class="ci-detail">${esc(r.detail)}</p>` : ''}
      </li>`;
    }).join('') || '<li class="ci-empty">No rows left. Go back and paste a list.</li>';
    $('ciAddBtn').textContent = sum.ready ? `Add ${sum.ready} customer${sum.ready === 1 ? '' : 's'}` : 'Add customers';
    $('ciAddBtn').disabled = !sum.ready;
    const billedNow = list.filter(r => r.included && Number(r.fee) > 0);
    const total = billedNow.reduce((t, r) => t + Number(r.fee), 0);
    $('ciFooterNote').textContent = sum.ready
      ? `${billedNow.length} get this month's bill (${pkr(total)}) and show as pending in Quick Collect.${sum.skipped ? ` ${sum.skipped} skipped.` : ''}`
      : 'Tick at least one row to add.';
  }

  // Edits re-check statuses on change (not every keystroke, so focus is kept while typing).
  rowsEl.addEventListener('change', e => {
    const li = e.target.closest('[data-ci-row]');
    if (!li) return;
    const i = rows.findIndex(r => r.key === li.dataset.ciRow);
    if (i < 0) return;
    if (e.target.matches('[data-ci-include]')) rows[i] = { ...rows[i], include: e.target.checked };
    const field = e.target.dataset.ciField;
    if (field === 'packageLabel') rows[i] = updateRowPackage(rows[i], e.target.value);
    else if (field === 'fee') rows[i] = { ...rows[i], fee: e.target.value === '' ? null : Number(e.target.value) };
    else if (field) rows[i] = { ...rows[i], [field]: e.target.value.trim() };
    if (field) rows[i] = { ...rows[i], include: null }; // re-evaluate the default after a fix
    const focusKey = li.dataset.ciRow;
    const focusField = field;
    renderRows();
    if (focusField) rowsEl.querySelector(`[data-ci-row="${focusKey}"] [data-ci-field="${focusField}"]`)?.focus({ preventScroll: true });
  });
  rowsEl.addEventListener('click', e => {
    const btn = e.target.closest('[data-ci-remove]');
    if (!btn) return;
    const key = btn.closest('[data-ci-row]').dataset.ciRow;
    rows = rows.filter(r => r.key !== key);
    renderRows();
  });

  function preview() {
    const { rows: parsed } = parseCustomerList(textArea.value);
    if (!parsed.length) { say($('ciInputStatus'), 'Paste at least one line, e.g. "ALI, 15MBPS, 3000RS".', 'error'); textArea.focus(); return; }
    rows = parsed;
    say($('ciInputStatus'), '');
    show('preview');
    renderRows();
    rowsEl.querySelector('input')?.focus({ preventScroll: true });
  }

  async function readFile(file) {
    if (!file) return;
    const status = $('ciInputStatus');
    const isPdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf';
    try {
      say(status, isPdf ? `Reading ${file.name}… (loading the PDF reader)` : `Reading ${file.name}…`);
      const text = isPdf ? await readPdfText(file) : await file.text();
      textArea.value = text.trim();
      const n = parseCustomerList(textArea.value).rows.length;
      say(status, `✓ ${file.name}: ${n} customer line${n === 1 ? '' : 's'} found. Check the text, then tap Preview.`, n ? 'success' : 'error');
      if (n) preview();
    } catch (err) {
      say(status, err.message, 'error');
    } finally {
      $('ciFile').value = '';
    }
  }

  function addAll() {
    const ctl = getController();
    const st = state();
    if (!ctl || !st) return;
    const list = statusRows();
    try {
      const res = importCustomers(st, list, { connectionDate: getPakistanLocalDate() });
      ctl.commitState(res.nextState);
      refreshApp();
      lastImport = res;
      $('ciDoneTitle').textContent = `Added ${res.added} customer${res.added === 1 ? '' : 's'}`;
      $('ciDoneDetail').textContent = `${res.billed} got this month's bill and are pending in Quick Collect / Bulk Collect.${res.skipped ? ` Skipped ${res.skipped}.` : ''}`;
      const added = res.nextState.customers.filter(c => res.addedIds.includes(c.id));
      $('ciDoneList').innerHTML = added.slice(0, 8).map(c => `<li><strong>#${c.customerNumber} ${esc(c.name)}</strong> <span>${esc(c.packageSpeed || 'No package')} · ${c.monthlySellingAmount ? esc(pkr(c.monthlySellingAmount)) : 'no fee'}</span></li>`).join('')
        + (added.length > 8 ? `<li class="ci-more">+ ${added.length - 8} more</li>` : '');
      say($('ciDoneStatus'), '');
      $('ciUndoBtn').disabled = !res.added;
      show('done');
      $('ciOpenCollectBtn').focus({ preventScroll: true });
    } catch (err) {
      say($('ciInputStatus'), err.message, 'error');
      $('ciFooterNote').textContent = `Nothing was saved: ${err.message}`;
    }
  }

  function undo() {
    const ctl = getController();
    const st = state();
    if (!lastImport || !ctl || !st) return;
    const res = undoImport(st, lastImport.addedIds);
    ctl.commitState(res.nextState);
    refreshApp();
    lastImport = null;
    $('ciUndoBtn').disabled = true;
    say($('ciDoneStatus'), `↶ Undone: removed ${res.removed} customer${res.removed === 1 ? '' : 's'}${res.kept ? ` (${res.kept} kept because a payment was already recorded)` : ''}.`, 'info');
    $('ciDoneTitle').textContent = 'Import undone';
  }

  function reset() {
    rows = [];
    lastImport = null;
    textArea.value = '';
    say($('ciInputStatus'), '');
    show('input');
  }

  // History: nav-accessibility's dialog controller already pushes one entry when a dialog is
  // opened by a tap (so phone Back closes it). We relabel that entry as #/customers/import
  // instead of pushing a second one; otherwise Back/close would need two steps.
  function open() {
    if (!modal.open) reset();
    try { if (!modal.open) modal.showModal(); } catch { modal.setAttribute('open', ''); }
    if (win.location.hash !== IMPORT_HASH) {
      const st = win.history.state;
      if (st && st.modalDialogId === modal.id) { routeMode = 'controller'; win.history.replaceState(st, '', IMPORT_HASH); }
      else { routeMode = 'self'; win.history.pushState({ ...(st || {}), customerImport: true }, '', IMPORT_HASH); }
    } else if (!routeMode) routeMode = 'deeplink';
    win.setTimeout(() => textArea.focus({ preventScroll: true }), 50);
  }
  function close() { if (modal.open) modal.close(); else modal.removeAttribute('open'); }

  modal.addEventListener('close', () => {
    const mode = routeMode;
    routeMode = null;
    if (win.location.hash !== IMPORT_HASH) return; // closed by Back: history already moved
    if (mode === 'self') win.history.back();
    else if (mode === 'controller') {
      // The controller steps back itself (deferred) when this is still its entry.
      win.setTimeout(() => { if (win.location.hash === IMPORT_HASH && !modal.open) win.history.replaceState(win.history.state, '', '#/customers'); }, 120);
    } else win.history.replaceState(win.history.state, '', '#/customers');
  });
  const onRoute = () => {
    if (win.location.hash === IMPORT_HASH) { if (!modal.open) open(); }
    else if (modal.open) { routeMode = null; close(); }
  };
  win.addEventListener('hashchange', onRoute);
  win.addEventListener('popstate', onRoute);

  $('closeCustomerImportBtn').addEventListener('click', close);
  $('ciDoneBtn').addEventListener('click', close);
  $('ciPreviewBtn').addEventListener('click', preview);
  $('ciBackBtn').addEventListener('click', () => show('input'));
  $('ciSampleBtn').addEventListener('click', () => { textArea.value = SAMPLE; textArea.focus(); });
  $('ciFile').addEventListener('change', e => readFile(e.target.files?.[0]));
  $('ciAddBtn').addEventListener('click', addAll);
  $('ciUndoBtn').addEventListener('click', undo);
  $('ciOpenCollectBtn').addEventListener('click', () => {
    close();
    win.setTimeout(() => getController()?.open?.(), 250); // after the close's history.back() lands
  });
  textArea.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); preview(); } });

  // Entry points: next to "+ Add Customer", and inside the Add Customer dialog.
  const addBtn = $('addCustomerButton');
  if (addBtn && !$('bulkAddCustomersBtn')) {
    const b = doc.createElement('button');
    b.id = 'bulkAddCustomersBtn';
    b.type = 'button';
    b.className = 'ci-open-btn';
    b.title = 'Add many customers from a list, CSV or PDF';
    b.innerHTML = '<span aria-hidden="true">⇪</span> Bulk add';
    b.addEventListener('click', open);
    addBtn.insertAdjacentElement('afterend', b);
  }
  const addFields = $('newCustomerFields');
  if (addFields && !$('openBulkAddFromForm')) {
    const p = doc.createElement('p');
    p.className = 'ci-form-link';
    p.innerHTML = 'Adding many? <button id="openBulkAddFromForm" class="text-button" type="button">Bulk add from a list / CSV / PDF</button>';
    addFields.insertBefore(p, addFields.firstElementChild);
    p.querySelector('button').addEventListener('click', () => {
      const dlg = $('addCustomerDialog');
      if (!dlg?.open) { open(); return; }
      // The Add Customer dialog steps history back when it closes; open only after that
      // popstate has landed, or it would pop our #/customers/import entry straight away.
      let done = false;
      const go = () => { if (done) return; done = true; win.removeEventListener('popstate', onPop); win.setTimeout(open, 0); };
      const onPop = () => go();
      win.addEventListener('popstate', onPop);
      dlg.close();
      win.setTimeout(go, 400);
    });
  }

  const api = { open, close, isOpen: () => modal.open, get rows() { return rows; } };
  win.customerImport = api;
  if (win.location.hash === IMPORT_HASH) win.setTimeout(onRoute, 0);
  return api;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined' && document.body) {
  setupCustomerImport();
}
