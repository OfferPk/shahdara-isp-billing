/**
 * Polish #23 — Due list: batch new-customer tag (first month free).
 *
 * ONE button at the top of the Quick Collect picker ("🔖 Tag new
 * customers") opens this batch sheet, modelled on bulk-collect.js:
 * a search picker over the exact Pending-tab population, tap-to-select
 * rows (join-this-month customers badge first, never pre-selected), a
 * review list with a total waived figure, and one Apply that tags every
 * selected customer's earliest unpaid month all-or-nothing (a failure
 * names the customer and nothing is applied). A second view lists the
 * customers tagged for the current month, with a remove button per row.
 *
 * The sheet never touches a payment, a receipt number, an allocation,
 * or any other month's bill. It stamps waivers only, through the core
 * apply/remove pair, and saves once via the Quick Collect controller's
 * commitState — the same save the app itself uses.
 *
 * Isolated module: builds its own dialog, opens from the Quick Collect
 * picker, hash-free (no route of its own), and never replaces existing
 * handlers. It is imported by app.js (the app.js-only seam), and
 * self-initialises on import exactly like bulk-collect.js does on load.
 */
import {
  applyTagBatch,
  untagTaggedMonth,
  tagPickerRows,
  taggedCustomersForMonth,
  monthLabel,
  FIRST_MONTH_WAIVER_REASON_DEFAULT,
} from './new-customer-tag.js';
import { monthsForHistory } from './core.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const pkr = n => `PKR ${Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`;

function buildDialogs(doc) {
  const wrap = doc.createElement('div');
  wrap.innerHTML = `
  <dialog id="nctTagModal" class="modal nct-tag-modal" aria-labelledby="nctTagTitle">
    <section class="nct-tag-card">
      <div class="modal-heading">
        <div>
          <p class="eyebrow">DUE LIST · BATCH</p>
          <h2 id="nctTagTitle">🔖 Tag new customers</h2>
        </div>
        <button id="nctTagCloseBtn" class="close-button" type="button" aria-label="Close tag sheet">↩</button>
      </div>
      <p class="nct-tag-intro">Tagging zeroes the customer's earliest unpaid month — the first month is already included in the new-connection payment. The bill itself stays saved, so untagging brings it back in full.</p>

      <div class="nct-view-toggle" role="group" aria-label="Tag sheet view">
        <button id="nctTagViewTagBtn" class="secondary-button nct-view-btn is-active" type="button" aria-pressed="true">Tag</button>
        <button id="nctTagViewTaggedBtn" class="secondary-button nct-view-btn" type="button" aria-pressed="false">Tagged <span id="nctTagTaggedCount" class="nct-count">0</span></button>
      </div>

      <div id="nctTagTagView">
        <div class="nct-search">
          <label class="nct-search-label" for="nctTagSearchInput">Find customer</label>
          <div class="nct-search-box">
            <span class="nct-search-icon" aria-hidden="true">🔍</span>
            <input id="nctTagSearchInput" type="search" class="nct-search-input" enterkeyhint="next" autocomplete="off" spellcheck="false"
                   placeholder="Name, mobile, area or #" aria-describedby="nctTagHint" aria-controls="nctTagPickList">
          </div>
          <p id="nctTagHint" class="nct-hint">Tap a row to select it · join-this-month customers sort first · nobody is pre-selected.</p>
        </div>

        <div id="nctTagPickList" class="nct-pick-list" role="list" aria-label="Customers with unpaid bills" aria-live="polite"></div>

        <div class="nct-review">
          <div class="nct-review-head">
            <h3>To tag <span id="nctTagCount" class="nct-count">0 customers</span></h3>
          </div>
          <ol id="nctTagReviewList" class="nct-review-list" aria-label="Customers to tag"></ol>
        </div>

        <div class="nct-footer">
          <div class="nct-total-line"><span>Total waived</span><strong id="nctTagTotal">PKR 0</strong></div>
          <button id="nctTagApplyBtn" class="primary-button" type="button" disabled>Apply tag</button>
        </div>
      </div>

      <div id="nctTagTaggedView" hidden>
        <div id="nctTagTaggedList" class="nct-pick-list" role="list" aria-label="Customers tagged this month" aria-live="polite"></div>
      </div>

      <p id="nctTagStatus" class="nct-status" role="status" aria-live="polite" hidden></p>
    </section>
  </dialog>`;
  while (wrap.firstElementChild) doc.body.appendChild(wrap.firstElementChild);
}

/** One picker row: checkbox + identity + target month + waived figure. */
export function tagRowHtml(row) {
  const badge = row.isNewThisMonth
    ? '<span class="nct-badge nct-badge-new">New this month</span>'
    : '';
  const note = row.canTag
    ? ''
    : `<span class="nct-row-note">${esc(row.cannotTagReason)}</span>`;
  return `<label class="nct-row${row.canTag ? '' : ' is-untaggable'}" role="listitem">
        <input type="checkbox" class="nct-select" data-nct-select="${esc(row.customerId)}"${row.selected ? ' checked' : ''}${row.canTag ? '' : ' disabled'}>
        <span class="nct-row-info">
          <span class="nct-row-name"><span class="nct-row-num">#${esc(row.customerNumber)}</span> ${esc(row.name)}</span>
          <span class="nct-row-meta">${esc(row.area)}${row.phone ? ' · ' + esc(row.phone) : ''}</span>
          <span class="nct-row-badges">${badge}${note}</span>
        </span>
        <span class="nct-row-amount"><span class="nct-row-month">${esc(row.monthLabel ?? row.targetMonth)}</span><strong>${row.canTag ? `${esc(pkr(row.waivedAmount))} → PKR 0` : esc(pkr(0))}</strong></span>
      </label>`;
}

/** One review line: name + month + waived figure + Remove. */
export function tagReviewItemHtml(detail) {
  return `
      <li class="nct-review-item" data-entry-id="${esc(detail.customerId)}">
        <div class="nct-review-main"><strong class="nct-review-name">${esc(detail.name)}</strong>
          <span class="nct-review-meta">#${esc(detail.customerNumber)} · ${esc(detail.monthLabel ?? detail.month)} · waived ${esc(pkr(detail.waivedAmount))}</span></div>
        <button type="button" class="nct-remove-btn" data-nct-remove="${esc(detail.customerId)}" aria-label="Remove ${esc(detail.name)} from this batch">Remove</button>
      </li>`;
}

/** One Tagged-view row: name + month + waived figure + Remove tag. */
export function taggedRowHtml(row) {
  return `<div class="nct-row" role="listitem" data-nct-tagged-row="${esc(row.customerId)}">
        <div class="nct-row-info">
          <span class="nct-row-name"><span class="nct-row-num">#${esc(row.customerNumber)}</span> ${esc(row.name)}</span>
          <span class="nct-row-meta">${esc(row.area)}${row.phone ? ' · ' + esc(row.phone) : ''}</span>
          <span class="nct-row-badges"><span class="nct-badge">🔖 First month free — ${esc(row.monthLabel ?? row.month)}</span></span>
        </div>
        <div class="nct-row-entry">
          <strong class="nct-row-amount">${esc(pkr(row.waivedAmount))} waived</strong>
          <button type="button" class="secondary-button nct-untag-btn" data-nct-untag="${esc(row.customerId)}" data-nct-untag-month="${esc(row.month)}" aria-label="Remove tag for ${esc(row.name)}">Remove tag</button>
        </div>
      </div>`;
}

export function setupNewCustomerTagSheet({ win = window, doc = document, getController = () => win.quickCollectModalController, toast } = {}) {
  if (doc.getElementById('nctTagModal')) return win.newCustomerTag;
  buildDialogs(doc);
  const $ = id => doc.getElementById(id);
  const modal = $('nctTagModal');
  const searchInput = $('nctTagSearchInput');
  const pickList = $('nctTagPickList');
  const reviewList = $('nctTagReviewList');
  const taggedList = $('nctTagTaggedList');
  const applyBtn = $('nctTagApplyBtn');
  const statusEl = $('nctTagStatus');
  const tagView = $('nctTagTagView');
  const taggedView = $('nctTagTaggedView');
  const viewTagBtn = $('nctTagViewTagBtn');
  const viewTaggedBtn = $('nctTagViewTaggedBtn');

  let view = 'tag';
  const selected = new Set();
  const selectedDetails = new Map();

  // The page toast sits under the top-layer dialog, so messages are shown inside the dialog.
  const say = (msg, kind = 'info') => {
    statusEl.textContent = msg;
    statusEl.dataset.kind = kind;
    statusEl.hidden = !msg;
    if (typeof toast === 'function' && msg) toast(msg);
  };
  const state = () => getController()?.getState?.();
  const currentMonth = () => monthsForHistory(new Date())[0];

  function renderPicker() {
    const st = state();
    if (!st) { pickList.innerHTML = ''; return; }
    const rows = tagPickerRows(st, searchInput.value);
    if (!rows.length) {
      pickList.innerHTML = String(searchInput.value).trim()
        ? `<div class="qc-empty-state" role="status"><span class="qc-empty-icon" aria-hidden="true">🔍</span><h4>No customer matches “${esc(searchInput.value.trim())}”</h4><p>Search by name, mobile number, area or customer #.</p></div>`
        : `<div class="qc-empty-state qc-all-collected" role="status"><span class="qc-empty-icon" aria-hidden="true">✅</span><h4>Sab ka bill wusool ho gaya</h4><p>No customers with unpaid bills to tag.</p></div>`;
      return;
    }
    pickList.innerHTML = `<p class="nct-list-caption">${rows.length} customer${rows.length === 1 ? '' : 's'} with unpaid bills · earliest unpaid month is tagged</p>`
      + rows.map(row => tagRowHtml({ ...row, selected: selected.has(row.customerId) })).join('');
  }

  function renderReview() {
    const details = [...selectedDetails.values()];
    const total = details.reduce((sum, d) => sum + Number(d.waivedAmount || 0), 0);
    $('nctTagTotal').textContent = pkr(total);
    $('nctTagCount').textContent = `${details.length} customer${details.length === 1 ? '' : 's'}`;
    reviewList.innerHTML = details.length
      ? details.map(tagReviewItemHtml).join('')
      : '<li class="nct-review-empty">Nothing selected yet — tap a row above to tag that customer.</li>';
    applyBtn.disabled = details.length === 0;
    applyBtn.textContent = details.length
      ? `Apply tag — ${details.length} customer${details.length === 1 ? '' : 's'} · ${pkr(total)} waived`
      : 'Apply tag';
  }

  function renderTagged() {
    const st = state();
    const month = currentMonth();
    const rows = st ? taggedCustomersForMonth(st, month) : [];
    $('nctTagTaggedCount').textContent = String(rows.length);
    if (!rows.length) {
      taggedList.innerHTML = `<div class="qc-empty-state" role="status"><span class="qc-empty-icon" aria-hidden="true">🔖</span><h4>No customers tagged for ${esc(monthLabel(month) ?? month)}</h4><p>Tag a customer from the Tag view and they show up here.</p></div>`;
      return;
    }
    taggedList.innerHTML = `<p class="nct-list-caption">${rows.length} tagged for ${esc(monthLabel(month) ?? month)} · removing a tag brings the bill back in full</p>`
      + rows.map(taggedRowHtml).join('');
  }

  function setView(next) {
    view = next === 'tagged' ? 'tagged' : 'tag';
    const tagged = view === 'tagged';
    tagView.hidden = tagged;
    taggedView.hidden = !tagged;
    viewTagBtn.classList.toggle('is-active', !tagged);
    viewTaggedBtn.classList.toggle('is-active', tagged);
    viewTagBtn.setAttribute('aria-pressed', String(!tagged));
    viewTaggedBtn.setAttribute('aria-pressed', String(tagged));
    if (tagged) renderTagged();
  }

  const renderAll = () => { renderPicker(); renderReview(); renderTagged(); };

  function confirmRemove(label) {
    if (typeof win.appConfirm === 'function') {
      return win.appConfirm({
        tone: 'warning',
        title: 'Remove first-month tag?',
        message: `Remove the 🔖 tag for ${label}? The original bill returns in full and the customer reappears in the due list.`,
        confirmLabel: 'Remove tag',
      });
    }
    return Promise.resolve(typeof win.confirm === 'function' ? win.confirm(`Remove the first-month tag for ${label}?`) : false);
  }

  searchInput.addEventListener('input', renderPicker);
  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Escape' && searchInput.value) { e.preventDefault(); searchInput.value = ''; renderPicker(); }
  });
  pickList.addEventListener('change', e => {
    const box = e.target.closest('[data-nct-select]');
    if (!box) return;
    const id = box.getAttribute('data-nct-select');
    const st = state();
    const row = st ? tagPickerRows(st, searchInput.value).find(r => r.customerId === id) : null;
    if (box.checked) {
      if (!row || !row.canTag) { box.checked = false; return; }
      selected.add(id);
      selectedDetails.set(id, {
        customerId: id, customerNumber: row.customerNumber, name: row.name,
        month: row.targetMonth, monthLabel: row.monthLabel, waivedAmount: row.waivedAmount,
      });
    } else {
      selected.delete(id);
      selectedDetails.delete(id);
    }
    renderReview();
  });
  reviewList.addEventListener('click', e => {
    const btn = e.target.closest('[data-nct-remove]');
    if (!btn) return;
    const id = btn.getAttribute('data-nct-remove');
    selected.delete(id);
    selectedDetails.delete(id);
    renderPicker();
    renderReview();
  });
  viewTagBtn.addEventListener('click', () => setView('tag'));
  viewTaggedBtn.addEventListener('click', () => setView('tagged'));
  taggedList.addEventListener('click', async e => {
    const btn = e.target.closest('[data-nct-untag]');
    if (!btn) return;
    const id = btn.getAttribute('data-nct-untag');
    const month = btn.getAttribute('data-nct-untag-month');
    const controller = getController();
    const st = state();
    if (!controller?.commitState || !st) { say('Tagging is not ready yet — reload the app.', 'error'); return; }
    const row = taggedCustomersForMonth(st, month).find(r => r.customerId === id);
    const label = row ? `${row.name} · ${row.monthLabel ?? row.month}` : id;
    if (!(await confirmRemove(label))) return;
    try {
      const next = untagTaggedMonth(st, id, month, { reason: 'Tag removed by owner' }, new Date());
      controller.commitState(next);
      say(`✓ Tag removed — ${label}: the bill is due again.`, 'success');
      renderAll();
      controller.refresh?.();
    } catch (err) {
      say(err.message, 'error');
    }
  });

  applyBtn.addEventListener('click', () => {
    const controller = getController();
    const st = state();
    if (!controller?.commitState || !st) { say('Tagging is not ready yet — reload the app.', 'error'); return; }
    if (!selected.size) return;
    try {
      const { nextState, applied } = applyTagBatch(st, [...selected], { reason: FIRST_MONTH_WAIVER_REASON_DEFAULT }, new Date());
      controller.commitState(nextState);
      const total = applied.reduce((sum, a) => sum + Number(a.waivedAmount || 0), 0);
      const months = [...new Set(applied.map(a => monthLabel(a.month) ?? a.month))].join(', ');
      const done = `✓ ${applied.length} customer${applied.length === 1 ? '' : 's'} tagged — ${months} bill PKR 0 (${pkr(total)} waived)`;
      selected.clear();
      selectedDetails.clear();
      searchInput.value = '';
      say(done, 'success');
      if (typeof toast === 'function') toast(done);
      setView('tagged');
      renderAll();
      controller.refresh?.();
    } catch (err) {
      say(err.message, 'error');
      if (typeof toast === 'function') toast(err.message);
    }
  });

  function open() {
    say('');
    setView('tag');
    searchInput.value = '';
    renderAll();
    try { if (!modal.open) modal.showModal(); } catch { modal.setAttribute('open', ''); }
    win.setTimeout(() => searchInput.focus({ preventScroll: true }), 50);
  }

  function close() {
    if (modal.open) modal.close(); else modal.removeAttribute('open');
  }
  modal.addEventListener('close', () => { getController()?.refresh?.(); });
  $('nctTagCloseBtn').addEventListener('click', close);

  // Entry point inside Quick Collect's picker step — the same first-child
  // insert as Bulk Collect's button. This module is imported by app.js,
  // so it runs before bulk-collect.js: the Bulk Collect button ends up
  // directly above this one, both at the top of the picker.
  const pick = doc.getElementById('quickCollectStepPick');
  if (pick && !doc.getElementById('nctTagNewCustomersBtn')) {
    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.id = 'nctTagNewCustomersBtn';
    btn.className = 'nct-open-btn';
    btn.innerHTML = '<span aria-hidden="true">🔖</span> Tag new customers <small>first month free</small>';
    btn.addEventListener('click', open);
    pick.insertBefore(btn, pick.firstElementChild);
  }

  const api = { open, close, isOpen: () => modal.open, refresh: () => { if (modal.open) renderAll(); } };
  win.newCustomerTag = api;
  return api;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined' && document.body) {
  setupNewCustomerTagSheet();
}
