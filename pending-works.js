/**
 * pending-works.js — "Pending Works": the owner's list of pending notes and
 * commitments with reminders (user-ordered, 2026-10-28).
 *
 * Owner's words: notes like "Nasir said he will buy a splicing machine
 * once customers reach 100" — right now the count is ~95, 5 short — so
 * when it hits 100 the app must remind: tell Nasir to bring the machine
 * now. Or "after 100 customers, install one more OLT on the Shahdara
 * Khurd pull side" — the app reminds, and once the owner has read it he
 * can mark it DONE or keep it PENDING.
 *
 * The two examples above illustrate the feature only — they are NOT
 * seeded data. The list starts empty; the owner adds notes himself.
 * Tests use synthetic data only.
 *
 * One record per pending work item: free-text note (required), optional
 * source (who said it, e.g. "Nasir"), optional customerThreshold (when
 * the NON-ARCHIVED customer count reaches it, the item becomes DUE), and
 * a Pending / Done status. There is deliberately NO due-date field, NO
 * assignee field, and NO priority field.
 *
 * Rules, stated exactly:
 * - Customer count = NON-ARCHIVED customers only. Archived customers
 *   never count (the modal says so in a small note).
 * - Progress per threshold item: "current/threshold — N more to go"
 *   (e.g. 95/100 — 5 more to go).
 * - DUE = threshold set AND current count >= threshold. Due items are
 *   highlighted and the dashboard card shows the due count.
 * - Plain notes (no threshold) are NEVER auto-due; they stay pending
 *   until the owner marks them done.
 * - Marking done/pending never deletes anything; done items stay visible
 *   dimmed in a Done section and can be toggled back to Pending.
 *
 * Storage: items live in localStorage under PENDING_WORKS_KEY
 * (sisp_pending_works_v1), a flat array. Backup: items travel in the
 * JSON backup `settings.pendingWorks` section (see core.js), under the
 * same safe-merge rule as the SISP-15 complaint register: adopted only
 * when this device has none stored yet.
 *
 * This module imports nothing: the customer list is passed in by callers,
 * so the pure helpers stay testable without the app.
 */

export const PENDING_WORKS_KEY = 'sisp_pending_works_v1';

const ID_RE = /^PW-(\d+)$/;

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Threshold from form input: ''/blank -> null; positive whole number or throw. */
export function parseThreshold(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || Math.floor(n) !== n) {
    throw new Error('Customer threshold must be a positive whole number, or left blank for a plain note.');
  }
  return n;
}

/** Drops malformed rows; keeps clean items in stored order. */
export function sanitizePendingWorks(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const note = cleanText(entry.note);
    if (!note) continue;
    let threshold = null;
    if (entry.threshold !== null && entry.threshold !== undefined && entry.threshold !== '') {
      const n = Number(entry.threshold);
      if (Number.isFinite(n) && n > 0) threshold = Math.floor(n);
    }
    out.push({
      id: cleanText(entry.id),
      note,
      source: cleanText(entry.source),
      threshold,
      status: entry.status === 'done' ? 'done' : 'pending',
      createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : ''
    });
  }
  return out;
}

/** Reads pending-work records; [] on missing/corrupt storage. */
export function loadPendingWorks(storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return [];
    const raw = store.getItem(PENDING_WORKS_KEY);
    if (!raw) return [];
    return sanitizePendingWorks(JSON.parse(raw));
  } catch {
    return [];
  }
}

/** Persists pending-work records; never throws. */
export function savePendingWorks(items, storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return false;
    store.setItem(PENDING_WORKS_KEY, JSON.stringify(sanitizePendingWorks(items)));
    return true;
  } catch {
    return false;
  }
}

function nextWorkId(items) {
  let max = 0;
  for (const item of items) {
    const match = ID_RE.exec(String(item.id || ''));
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `PW-${max + 1}`;
}

/** Non-archived customers only — archived profiles never count. */
export function countActiveCustomers(customers) {
  if (!Array.isArray(customers)) return 0;
  return customers.filter((c) => c && !c.archived).length;
}

/**
 * Progress for one item against the current customer count:
 * { current, threshold, remaining, due }. Plain notes (no threshold)
 * always report due: false, remaining: null.
 */
export function progressFor(item, customerCount) {
  const current = Number.isFinite(Number(customerCount)) ? Math.max(0, Math.floor(Number(customerCount))) : 0;
  const threshold = item && item.threshold !== null && item.threshold !== undefined ? item.threshold : null;
  if (threshold === null) return { current, threshold: null, remaining: null, due: false };
  return {
    current,
    threshold,
    remaining: Math.max(0, threshold - current),
    due: current >= threshold
  };
}

/** DUE = threshold set AND current count >= threshold (pending items only for the badge). */
export function isDue(item, customerCount) {
  if (!item || item.status === 'done') return false;
  return progressFor(item, customerCount).due;
}

/** Progress line: "95/100 — 5 more to go", "100/100 — due now", or '' for plain notes. */
export function progressLabel(item, customerCount) {
  const progress = progressFor(item, customerCount);
  if (progress.threshold === null) return '';
  if (progress.due) return `${progress.current}/${progress.threshold} — due now`;
  return `${progress.current}/${progress.threshold} — ${progress.remaining} more to go`;
}

/**
 * Appends one item. Throws on an empty note or an invalid threshold.
 * Returns the new list (input untouched). The list starts empty — this
 * never seeds example notes.
 */
export function addPendingWork(items, input) {
  const clean = sanitizePendingWorks(items);
  const note = cleanText(input.note);
  if (!note) throw new Error('Write the note — every pending work needs its text.');
  const threshold = parseThreshold(input.threshold);
  const record = {
    id: nextWorkId(clean),
    note,
    source: cleanText(input.source),
    threshold,
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  return [...clean, record];
}

/**
 * Edits one item's note/source/threshold (status, id and createdAt are
 * preserved). Throws on an unknown id, an empty note, or an invalid
 * threshold. Returns the new list (input untouched).
 */
export function updatePendingWork(items, id, input) {
  const clean = sanitizePendingWorks(items);
  const index = clean.findIndex((item) => String(item.id) === String(id));
  if (index === -1) throw new Error('That pending work was not found.');
  const note = cleanText(input.note);
  if (!note) throw new Error('Write the note — every pending work needs its text.');
  const threshold = parseThreshold(input.threshold);
  const updated = {
    ...clean[index],
    note,
    source: cleanText(input.source),
    threshold
  };
  return clean.map((item, i) => (i === index ? updated : item));
}

/**
 * Toggles one item Pending <-> Done. Done items are never deleted by
 * toggling. Throws on an unknown id. Returns the new list.
 */
export function togglePendingWorkStatus(items, id) {
  const clean = sanitizePendingWorks(items);
  const index = clean.findIndex((item) => String(item.id) === String(id));
  if (index === -1) throw new Error('That pending work was not found.');
  return clean.map((item, i) => (i === index
    ? { ...item, status: item.status === 'done' ? 'pending' : 'done' }
    : item));
}

/** Removes one item. Throws on an unknown id. The UI confirms before calling this. */
export function deletePendingWork(items, id) {
  const clean = sanitizePendingWorks(items);
  const index = clean.findIndex((item) => String(item.id) === String(id));
  if (index === -1) throw new Error('That pending work was not found.');
  return clean.filter((_, i) => i !== index);
}

/**
 * List order: DUE items first, then other pending items, then done items
 * (dimmed in the UI). Oldest first within each group — the oldest
 * reminder is the most urgent one.
 */
export function sortedPendingWorks(items, customerCount) {
  const clean = sanitizePendingWorks(items);
  const rank = (item) => {
    if (item.status === 'done') return 2;
    if (isDue(item, customerCount)) return 0;
    return 1;
  };
  return [...clean].sort((a, b) => {
    const rankDiff = rank(a) - rank(b);
    if (rankDiff !== 0) return rankDiff;
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
    return 0;
  });
}

/** Filtered list: 'all' | 'due' | 'pending' | 'done', in sorted order. */
export function filterPendingWorks(items, customerCount, filter = 'all') {
  const sorted = sortedPendingWorks(items, customerCount);
  if (filter === 'due') return sorted.filter((item) => isDue(item, customerCount));
  if (filter === 'pending') return sorted.filter((item) => item.status === 'pending');
  if (filter === 'done') return sorted.filter((item) => item.status === 'done');
  return sorted;
}

/**
 * Dashboard summary: pending count, due count, due items, and the nearest
 * threshold progress (pending threshold item with the fewest customers
 * left to go, or null when there is none).
 */
export function pendingWorksSummary(items, customerCount) {
  const clean = sanitizePendingWorks(items);
  const pending = clean.filter((item) => item.status === 'pending');
  const dueItems = pending.filter((item) => isDue(item, customerCount));
  const withThreshold = pending
    .filter((item) => item.threshold !== null && item.threshold !== undefined)
    .map((item) => ({ item, progress: progressFor(item, customerCount) }))
    .filter(({ progress }) => !progress.due)
    .sort((a, b) => a.progress.remaining - b.progress.remaining);
  const nearest = withThreshold.length ? withThreshold[0] : null;
  return {
    total: clean.length,
    pendingCount: pending.length,
    doneCount: clean.length - pending.length,
    dueCount: dueItems.length,
    dueItems,
    nearestItem: nearest ? nearest.item : null,
    nearestLabel: nearest ? progressLabel(nearest.item, customerCount) : ''
  };
}

/**
 * Dashboard + modal controller, following the Saad-visits pattern:
 * open() / refresh(), open button wired by id, close button, form
 * submits, list delegation for toggle/edit/delete. getState supplies the
 * live customer list; onConfirm supplies the app's confirm dialog
 * (delete never proceeds without it resolving 'confirm').
 */
export function setupPendingWorksModal(getState, { onWorksChanged, onToast, onConfirm } = {}) {
  const dialog = typeof document !== 'undefined' ? document.getElementById('pendingWorksModal') : null;
  if (!dialog) return null;
  const $ = (id) => dialog.querySelector(`#${id}`);
  const getCustomers = () => {
    try {
      const state = typeof getState === 'function' ? getState() : null;
      return Array.isArray(state?.customers) ? state.customers : [];
    } catch {
      return [];
    }
  };
  const getCount = () => countActiveCustomers(getCustomers());

  function resetForm() {
    const form = $('pendingWorksForm');
    if (form) form.reset();
    const editId = $('pendingWorksEditId');
    if (editId) editId.value = '';
    const submitBtn = $('pendingWorksSubmitBtn');
    if (submitBtn) submitBtn.textContent = '➕ Note darj karein';
    const cancelBtn = $('pendingWorksCancelEditBtn');
    if (cancelBtn) cancelBtn.hidden = true;
  }

  function render() {
    const customerCount = getCount();
    const items = loadPendingWorks();
    const summary = pendingWorksSummary(items, customerCount);
    const summaryEl = $('pendingWorksSummary');
    if (summaryEl) {
      summaryEl.innerHTML = `
        <div class="pending-works-summary-cards">
          <p><span>Due now</span><strong>${summary.dueCount}</strong></p>
          <p><span>Pending</span><strong>${summary.pendingCount}</strong></p>
          <p><span>Done</span><strong>${summary.doneCount}</strong></p>
          <p><span>Nearest threshold</span><strong>${summary.nearestLabel ? escapeHtml(summary.nearestLabel) : '—'}</strong></p>
        </div>
        ${summary.dueItems.length
          ? `<p class="pending-works-due-line">⚠️ Due: ${escapeHtml(summary.dueItems.map((item) => item.note).join(' · '))}</p>`
          : ''}`;
    }
    const countNote = $('pendingWorksCountNote');
    if (countNote) countNote.textContent = `Customer count = ${customerCount} non-archived customers (archived profiles never count).`;
    const filter = $('pendingWorksFilter')?.value || 'all';
    const listEl = $('pendingWorksList');
    if (listEl) {
      const rows = filterPendingWorks(items, customerCount, filter);
      listEl.innerHTML = rows.length === 0
        ? '<p class="pending-works-empty">No pending works match this filter. Add the first note above — the list starts empty.</p>'
        : rows.map((item) => {
          const due = isDue(item, customerCount);
          const label = progressLabel(item, customerCount);
          const classes = ['pending-works-card'];
          if (due) classes.push('pending-works-due');
          if (item.status === 'done') classes.push('pending-works-done');
          return `
          <article class="${classes.join(' ')}">
            <p><span>${due ? '⚠️ DUE' : item.status === 'done' ? '✓ Done' : 'Pending'}</span><strong>${escapeHtml(item.note)}</strong></p>
            ${item.source ? `<p><span>Source</span><strong>${escapeHtml(item.source)}</strong></p>` : ''}
            ${label ? `<p><span>Customers</span><strong>${escapeHtml(label)}</strong></p>` : ''}
            ${item.createdAt ? `<p><span>Added</span><strong>${escapeHtml(item.createdAt.slice(0, 10))}</strong></p>` : ''}
            <div class="pending-works-actions">
              <button type="button" class="secondary-button" data-pending-toggle="${escapeHtml(item.id)}">${item.status === 'done' ? '↩ Mark pending' : '✓ Mark done'}</button>
              <button type="button" class="secondary-button" data-pending-edit="${escapeHtml(item.id)}">✏️ Edit</button>
              <button type="button" class="secondary-button text-button danger" data-pending-delete="${escapeHtml(item.id)}">🗑 Delete</button>
            </div>
          </article>`;
        }).join('');
    }
  }

  const filterInput = $('pendingWorksFilter');
  if (filterInput) filterInput.addEventListener('change', render);

  const form = $('pendingWorksForm');
  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      try {
        const editId = $('pendingWorksEditId')?.value || '';
        const input = {
          note: $('pendingWorksNote')?.value,
          source: $('pendingWorksSource')?.value,
          threshold: $('pendingWorksThreshold')?.value
        };
        const updated = editId
          ? updatePendingWork(loadPendingWorks(), editId, input)
          : addPendingWork(loadPendingWorks(), input);
        savePendingWorks(updated);
        resetForm();
        render();
        if (typeof onWorksChanged === 'function') onWorksChanged();
        if (typeof onToast === 'function') onToast(editId ? 'Pending work updated.' : 'Pending work noted.');
      } catch (error) {
        if (typeof onToast === 'function') onToast(error.message || 'Could not save this note.');
      }
    });
  }
  const cancelEditBtn = $('pendingWorksCancelEditBtn');
  if (cancelEditBtn) cancelEditBtn.addEventListener('click', resetForm);

  const listEl = $('pendingWorksList');
  if (listEl) {
    listEl.addEventListener('click', async (event) => {
      const toggleBtn = event.target.closest('[data-pending-toggle]');
      const editBtn = event.target.closest('[data-pending-edit]');
      const deleteBtn = event.target.closest('[data-pending-delete]');
      try {
        if (toggleBtn) {
          savePendingWorks(togglePendingWorkStatus(loadPendingWorks(), toggleBtn.dataset.pendingToggle));
          render();
          if (typeof onWorksChanged === 'function') onWorksChanged();
          if (typeof onToast === 'function') onToast('Status updated.');
          return;
        }
        if (editBtn) {
          const item = loadPendingWorks().find((entry) => String(entry.id) === String(editBtn.dataset.pendingEdit));
          if (!item) return;
          const noteInput = $('pendingWorksNote');
          const sourceInput = $('pendingWorksSource');
          const thresholdInput = $('pendingWorksThreshold');
          const editId = $('pendingWorksEditId');
          if (noteInput) noteInput.value = item.note;
          if (sourceInput) sourceInput.value = item.source || '';
          if (thresholdInput) thresholdInput.value = item.threshold === null || item.threshold === undefined ? '' : String(item.threshold);
          if (editId) editId.value = item.id;
          const submitBtn = $('pendingWorksSubmitBtn');
          if (submitBtn) submitBtn.textContent = '💾 Save changes';
          if (cancelEditBtn) cancelEditBtn.hidden = false;
          if (noteInput) noteInput.focus();
          return;
        }
        if (deleteBtn) {
          const item = loadPendingWorks().find((entry) => String(entry.id) === String(deleteBtn.dataset.pendingDelete));
          if (!item) return;
          if (typeof onConfirm === 'function') {
            const confirmed = await onConfirm({
              tone: 'danger',
              title: 'Delete this pending work?',
              subject: item.note,
              message: 'It will be removed permanently from this device.',
              confirmLabel: 'Delete'
            });
            if (confirmed !== 'confirm') return;
          }
          savePendingWorks(deletePendingWork(loadPendingWorks(), deleteBtn.dataset.pendingDelete));
          render();
          if (typeof onWorksChanged === 'function') onWorksChanged();
          if (typeof onToast === 'function') onToast('Pending work deleted.');
        }
      } catch (error) {
        if (typeof onToast === 'function') onToast(error.message || 'Could not update this note.');
      }
    });
  }
  const closeBtn = $('pendingWorksCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', () => dialog.close());
  const openBtn = typeof document !== 'undefined' ? document.getElementById('openPendingWorksModalBtn') : null;
  if (openBtn) openBtn.addEventListener('click', () => {
    render();
    dialog.showModal();
  });

  return {
    open() {
      render();
      dialog.showModal();
    },
    refresh: render
  };
}
