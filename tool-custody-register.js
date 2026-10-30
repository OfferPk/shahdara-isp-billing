/**
 * tool-custody-register.js — SISP-82: Lineman Splicing Machine, OTDR &
 * Field Tool Custody Register ("لائن مین اوزار، او ٹی ڈی آر اور سپلائسنگ
 * مشین ریکارڈ").
 *
 * The ISP owns a small set of expensive reusable field tools — a fusion
 * splicer, its cleaver, an OTDR, an OPM power meter, a VFL red laser and
 * ladders. Before SISP-82 nobody recorded WHO had which tool, in what
 * condition, or how worn it was: a splicer's electrode counter only gets
 * noticed when splices start failing in the field.
 *
 * This register tracks each tool as one record:
 *   { toolId (TOOL-101+), type, name, serial, assignedToLineman,
 *     condition, spliceCount, bladeCleavesCount, history, createdAt,
 *     updatedAt }
 * - `type` is one of the fixed TOOL_TYPES catalogue below (the add form's
 *   choices). The catalogue is a FORM aid only — the register itself
 *   starts EMPTY and never seeds a custody record: a tool exists here
 *   only when the operator adds the real one.
 * - `assignedToLineman` is the lineman currently holding the tool (''
 *   means it is in the store). Assign/return are explicit actions; a
 *   tool that is out cannot be assigned again until it is returned, so
 *   custody can never silently jump between two linemen.
 * - Counters: the fusion splicer carries `spliceCount` (its electrode
 *   counter), the cleaver carries `bladeCleavesCount`. Field usage is
 *   logged with logToolUsage, which only accepts the counter that
 *   belongs to the tool's type.
 * - MAINTENANCE: a splicer whose spliceCount reaches
 *   SPLICE_MAINTENANCE_THRESHOLD (1,000) is flagged by
 *   toolNeedsMaintenance and the UI shows the electrode maintenance
 *   warning badge until the count is reset by a service (edit form).
 * - `history` is an append-only audit trail (added / assigned /
 *   returned / usage / condition), following the SISP-19 hardware
 *   custody precedent of never rewriting custody history: every action
 *   appends an entry with the lineman, date and detail, and no action
 *   ever deletes a past entry.
 *
 * Storage: records live in localStorage under FIELD_TOOLS_KEY
 * (sisp_field_tools_v1), a flat array. Backup: records travel in the
 * JSON backup `settings.fieldTools` section (see core.js), under the
 * same safe-merge rule as the suspense register: adopted only when this
 * device has none stored yet.
 *
 * The pure helpers import nothing and stay testable without the app;
 * the modal controller at the bottom needs a DOM and is
 * inspection-verified (no DOM harness in node:test), like the other
 * modal controllers.
 */

import { t } from './nav-language.js';

export const FIELD_TOOLS_KEY = 'sisp_field_tools_v1';

/** Electrode maintenance line for a fusion splicer (spec: >= 1,000). */
export const SPLICE_MAINTENANCE_THRESHOLD = 1000;

/**
 * The reusable field-tool catalogue (add-form choices). `counter` names
 * the wear counter a type carries: the splicer's electrode counter
 * (spliceCount) and the cleaver's blade counter (bladeCleavesCount).
 * Types without a counter track custody + condition only.
 */
export const TOOL_TYPES = Object.freeze([
  { value: 'fusion-splicer', labelKey: 'toolcust_type_fusion_splicer', label: 'Fusion Splicer', counter: 'spliceCount' },
  { value: 'cleaver', labelKey: 'toolcust_type_cleaver', label: 'Cleaver', counter: 'bladeCleavesCount' },
  { value: 'otdr', labelKey: 'toolcust_type_otdr', label: 'OTDR', counter: null },
  { value: 'opm', labelKey: 'toolcust_type_opm', label: 'OPM Power Meter', counter: null },
  { value: 'vfl', labelKey: 'toolcust_type_vfl', label: 'VFL Red Laser', counter: null },
  { value: 'ladder', labelKey: 'toolcust_type_ladder', label: 'Ladder', counter: null }
]);

export const TOOL_CONDITIONS = Object.freeze([
  { value: 'good', labelKey: 'toolcust_cond_good' },
  { value: 'fair', labelKey: 'toolcust_cond_fair' },
  { value: 'needs-maintenance', labelKey: 'toolcust_cond_needs_maintenance' },
  { value: 'damaged', labelKey: 'toolcust_cond_damaged' }
]);

const TOOL_ID_RE = /^TOOL-(\d+)$/;
const HISTORY_ACTIONS = Object.freeze(['added', 'assigned', 'returned', 'usage', 'condition']);

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

function isValidDateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Non-negative whole counter; non-finite / negative input counts as 0. */
function cleanCounter(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function toolTypeOf(value) {
  return TOOL_TYPES.find((entry) => entry.value === value) || null;
}

export function isValidToolCondition(value) {
  return TOOL_CONDITIONS.some((entry) => entry.value === value);
}

function sanitizeHistory(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    if (!HISTORY_ACTIONS.includes(entry.action)) continue;
    out.push({
      action: entry.action,
      lineman: cleanText(entry.lineman).slice(0, 100),
      date: isValidDateKey(entry.date) ? entry.date : '',
      detail: cleanText(entry.detail).slice(0, 200),
      at: typeof entry.at === 'string' ? entry.at : ''
    });
  }
  return out;
}

/** Next record id: one above the highest TOOL-N already stored (starts at 101). */
export function nextToolId(tools) {
  let max = 100;
  for (const tool of Array.isArray(tools) ? tools : []) {
    const match = TOOL_ID_RE.exec(String(tool?.toolId || ''));
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `TOOL-${max + 1}`;
}

/** Drops malformed rows (unknown type); keeps clean records in stored order. */
export function sanitizeFieldTools(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const tool of value) {
    if (!tool || typeof tool !== 'object') continue;
    const type = toolTypeOf(tool.type);
    if (!type) continue;
    out.push({
      toolId: TOOL_ID_RE.test(String(tool.toolId || '')) ? String(tool.toolId) : '',
      type: type.value,
      name: cleanText(tool.name).slice(0, 100) || type.label,
      serial: cleanText(tool.serial).slice(0, 64),
      assignedToLineman: cleanText(tool.assignedToLineman).slice(0, 100),
      condition: isValidToolCondition(tool.condition) ? tool.condition : 'good',
      spliceCount: cleanCounter(tool.spliceCount),
      bladeCleavesCount: cleanCounter(tool.bladeCleavesCount),
      history: sanitizeHistory(tool.history),
      createdAt: typeof tool.createdAt === 'string' ? tool.createdAt : '',
      updatedAt: typeof tool.updatedAt === 'string' ? tool.updatedAt : ''
    });
  }
  // Fill in ids for rows that arrived without one, in stored order.
  let next = 101;
  const used = new Set(out.map((tool) => tool.toolId).filter(Boolean));
  for (const tool of out) {
    if (!tool.toolId) {
      while (used.has(`TOOL-${next}`)) next++;
      tool.toolId = `TOOL-${next}`;
      used.add(tool.toolId);
      next++;
    }
  }
  return out;
}

/** Validates the add-tool form payload; throws with a plain message. */
export function buildToolFields(input) {
  const type = toolTypeOf(cleanText(input?.type));
  if (!type) {
    throw new Error(`Tool type is required — choose one of: ${TOOL_TYPES.map((entry) => entry.label).join(', ')}.`);
  }
  const condition = cleanText(input?.condition);
  if (condition && !isValidToolCondition(condition)) throw new Error('Pick a valid condition for this tool.');
  return {
    type: type.value,
    name: cleanText(input?.name).slice(0, 100) || type.label,
    serial: cleanText(input?.serial).slice(0, 64),
    assignedToLineman: cleanText(input?.assignedToLineman).slice(0, 100),
    condition: condition || 'good',
    spliceCount: type.counter === 'spliceCount' ? cleanCounter(input?.spliceCount) : 0,
    bladeCleavesCount: type.counter === 'bladeCleavesCount' ? cleanCounter(input?.bladeCleavesCount) : 0
  };
}

function historyEntry(action, { lineman = '', date = '', detail = '' } = {}) {
  return {
    action,
    lineman: cleanText(lineman).slice(0, 100),
    date: isValidDateKey(date) ? date : '',
    detail: cleanText(detail).slice(0, 200),
    at: new Date().toISOString()
  };
}

function findTool(clean, toolId) {
  const tool = clean.find((entry) => String(entry.toolId) === String(toolId));
  if (!tool) throw new Error('Tool not found in the register.');
  return tool;
}

function replaceTool(clean, updated) {
  return clean.map((entry) => (String(entry.toolId) === String(updated.toolId) ? updated : entry));
}

/** Adds one tool to the register (append-only; ids from TOOL-101). */
export function addFieldTool(tools, input, { date } = {}) {
  const fields = buildToolFields(input);
  const clean = sanitizeFieldTools(tools);
  const now = new Date().toISOString();
  const tool = {
    toolId: nextToolId(clean),
    ...fields,
    history: [historyEntry('added', {
      lineman: fields.assignedToLineman,
      date,
      detail: fields.assignedToLineman ? `Added and assigned to ${fields.assignedToLineman}` : 'Added to store'
    })],
    createdAt: now,
    updatedAt: now
  };
  return [...clean, tool];
}

/**
 * Hands a stored tool to a lineman. Refused while the tool is already
 * out (it must be returned first) so custody never jumps holders
 * without a return entry in the audit trail.
 */
export function assignFieldTool(tools, toolId, { lineman, date } = {}) {
  const clean = sanitizeFieldTools(tools);
  const tool = findTool(clean, toolId);
  const holder = cleanText(lineman).slice(0, 100);
  if (!holder) throw new Error('Lineman name is required to assign a tool.');
  if (tool.assignedToLineman) {
    throw new Error(`${tool.name} is already with ${tool.assignedToLineman} — return it to the store before assigning it again.`);
  }
  const updated = {
    ...tool,
    assignedToLineman: holder,
    history: [...tool.history, historyEntry('assigned', { lineman: holder, date })],
    updatedAt: new Date().toISOString()
  };
  return replaceTool(clean, updated);
}

/** Returns a tool to the store; an optional condition update rides along. */
export function returnFieldTool(tools, toolId, { date, condition } = {}) {
  const clean = sanitizeFieldTools(tools);
  const tool = findTool(clean, toolId);
  if (!tool.assignedToLineman) throw new Error(`${tool.name} is already in the store.`);
  const nextCondition = cleanText(condition);
  if (nextCondition && !isValidToolCondition(nextCondition)) throw new Error('Pick a valid condition for this tool.');
  const history = [...tool.history, historyEntry('returned', { lineman: tool.assignedToLineman, date })];
  if (nextCondition && nextCondition !== tool.condition) {
    history.push(historyEntry('condition', { lineman: tool.assignedToLineman, date, detail: `Condition: ${tool.condition} → ${nextCondition}` }));
  }
  const updated = {
    ...tool,
    assignedToLineman: '',
    condition: nextCondition || tool.condition,
    history,
    updatedAt: new Date().toISOString()
  };
  return replaceTool(clean, updated);
}

/**
 * Logs field usage against the counter that belongs to the tool's type:
 * splices for a fusion splicer, cleaves for a cleaver. Logging the
 * wrong counter (or any usage on a counter-less type) is refused, so a
 * counter can never be inflated by a mismatched entry. PIN scenario:
 * a splicer at 950 logged with +60 reaches 1,010 and crosses the
 * maintenance threshold.
 */
export function logToolUsage(tools, toolId, { splices = 0, cleaves = 0, date } = {}) {
  const clean = sanitizeFieldTools(tools);
  const tool = findTool(clean, toolId);
  const type = toolTypeOf(tool.type);
  const spliceDelta = Number(splices);
  const cleaveDelta = Number(cleaves);
  if (type.counter === 'spliceCount') {
    if (cleaveDelta) throw new Error('Cleaves belong to a cleaver — log them on the cleaver record.');
    if (!Number.isInteger(spliceDelta) || spliceDelta <= 0) throw new Error('Enter the number of new splices (a whole number above zero).');
    const updated = {
      ...tool,
      spliceCount: tool.spliceCount + spliceDelta,
      history: [...tool.history, historyEntry('usage', {
        lineman: tool.assignedToLineman,
        date,
        detail: `+${spliceDelta} splices (total ${tool.spliceCount + spliceDelta})`
      })],
      updatedAt: new Date().toISOString()
    };
    return replaceTool(clean, updated);
  }
  if (type.counter === 'bladeCleavesCount') {
    if (spliceDelta) throw new Error('Splices belong to a fusion splicer — log them on the splicer record.');
    if (!Number.isInteger(cleaveDelta) || cleaveDelta <= 0) throw new Error('Enter the number of new cleaves (a whole number above zero).');
    const updated = {
      ...tool,
      bladeCleavesCount: tool.bladeCleavesCount + cleaveDelta,
      history: [...tool.history, historyEntry('usage', {
        lineman: tool.assignedToLineman,
        date,
        detail: `+${cleaveDelta} cleaves (total ${tool.bladeCleavesCount + cleaveDelta})`
      })],
      updatedAt: new Date().toISOString()
    };
    return replaceTool(clean, updated);
  }
  throw new Error(`${type.label} has no usage counter to log against.`);
}

/**
 * The maintenance rule: only a fusion splicer wears out by count — at
 * SPLICE_MAINTENANCE_THRESHOLD (1,000) splices its electrodes need
 * maintenance. Exactly 1,000 counts (spec: >= 1,000).
 */
export function toolNeedsMaintenance(tool) {
  if (!tool || typeof tool !== 'object') return false;
  const type = toolTypeOf(tool.type);
  if (!type || type.counter !== 'spliceCount') return false;
  return cleanCounter(tool.spliceCount) >= SPLICE_MAINTENANCE_THRESHOLD;
}

/** Tools currently flagged for electrode maintenance. */
export function toolsNeedingMaintenance(tools) {
  return sanitizeFieldTools(tools).filter((tool) => toolNeedsMaintenance(tool));
}

/** Register totals for the dashboard card + modal header. */
export function fieldToolsSummary(tools) {
  const clean = sanitizeFieldTools(tools);
  return {
    totalCount: clean.length,
    assignedCount: clean.filter((tool) => tool.assignedToLineman).length,
    inStoreCount: clean.filter((tool) => !tool.assignedToLineman).length,
    maintenanceCount: clean.filter((tool) => toolNeedsMaintenance(tool)).length
  };
}

export function loadFieldTools(storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return [];
    const raw = store.getItem(FIELD_TOOLS_KEY);
    if (!raw) return [];
    return sanitizeFieldTools(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveFieldTools(tools, storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return false;
    store.setItem(FIELD_TOOLS_KEY, JSON.stringify(sanitizeFieldTools(tools)));
    return true;
  } catch {
    return false;
  }
}

function pakistanToday() {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date());
    const get = (type) => parts.find((p) => p.type === type)?.value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/**
 * Dashboard + modal controller, following the Suspense Register
 * pattern: open() / refresh(), open button wired by id, close button,
 * add-tool form, register list with per-tool assign / return / log
 * usage actions and the maintenance badge. onEntriesChanged lets the
 * app re-render the dashboard card after every change.
 */
export function setupToolCustodyModal({ onEntriesChanged, onToast, onConfirm } = {}) {
  const dialog = typeof document !== 'undefined' ? document.getElementById('toolCustodyModal') : null;
  if (!dialog) return null;
  const $ = (id) => dialog.querySelector(`#${id}`);
  const notifyChanged = () => { if (typeof onEntriesChanged === 'function') onEntriesChanged(); };
  const toast = (msg) => { if (typeof onToast === 'function') onToast(msg); };

  function typeLabel(tool) {
    const type = toolTypeOf(tool.type);
    return type ? t(type.labelKey) : tool.type;
  }

  function conditionLabel(value) {
    const found = TOOL_CONDITIONS.find((entry) => entry.value === value);
    return found ? t(found.labelKey) : value;
  }

  function historyLabel(entry) {
    const parts = [entry.date || entry.at.slice(0, 10), entry.action];
    if (entry.lineman) parts.push(entry.lineman);
    if (entry.detail) parts.push(entry.detail);
    return parts.filter(Boolean).join(' · ');
  }

  function render() {
    const tools = loadFieldTools();
    const summary = fieldToolsSummary(tools);
    const listEl = $('toolCustodyList');
    if (listEl) {
      listEl.innerHTML = tools.length === 0
        ? `<p class="tool-custody-empty">${escapeHtml(t('toolcust_empty'))}</p>`
        : [...tools].reverse().map((tool) => {
          const type = toolTypeOf(tool.type);
          const maintenance = toolNeedsMaintenance(tool);
          const counterLine = type?.counter === 'spliceCount'
            ? `<span>${escapeHtml(t('toolcust_splices'))}: <strong>${tool.spliceCount.toLocaleString('en-PK')}</strong></span>`
            : type?.counter === 'bladeCleavesCount'
              ? `<span>${escapeHtml(t('toolcust_cleaves'))}: <strong>${tool.bladeCleavesCount.toLocaleString('en-PK')}</strong></span>`
              : '';
          const statusLine = tool.assignedToLineman
            ? `<strong>${escapeHtml(t('toolcust_assigned_badge', null, { name: tool.assignedToLineman }))}</strong>`
            : `<span>${escapeHtml(t('toolcust_in_store'))}</span>`;
          const badge = maintenance
            ? `<p class="tool-custody-badge">⚠️ ${escapeHtml(t('toolcust_maintenance_badge'))}</p>`
            : '';
          const usageRow = type?.counter
            ? `<div class="tool-custody-actions">
                <label for="toolUsage-${escapeHtml(tool.toolId)}">${escapeHtml(t(type.counter === 'spliceCount' ? 'toolcust_log_splices_label' : 'toolcust_log_cleaves_label'))}</label>
                <input id="toolUsage-${escapeHtml(tool.toolId)}" class="form-input" type="number" min="1" step="1" data-tool-usage-input="${escapeHtml(tool.toolId)}" aria-label="${escapeHtml(t(type.counter === 'spliceCount' ? 'toolcust_log_splices_label' : 'toolcust_log_cleaves_label'))}">
                <button type="button" class="secondary-button" data-tool-log="${escapeHtml(tool.toolId)}">${escapeHtml(t('toolcust_log_btn'))}</button>
              </div>`
            : '';
          const custodyRow = tool.assignedToLineman
            ? `<div class="tool-custody-actions">
                <button type="button" class="primary-button" data-tool-return="${escapeHtml(tool.toolId)}">${escapeHtml(t('toolcust_return_btn'))}</button>
              </div>`
            : `<div class="tool-custody-actions">
                <label for="toolAssign-${escapeHtml(tool.toolId)}">${escapeHtml(t('toolcust_assigned_to'))}</label>
                <input id="toolAssign-${escapeHtml(tool.toolId)}" class="form-input" type="text" maxlength="100" data-tool-assign-input="${escapeHtml(tool.toolId)}" aria-label="${escapeHtml(t('toolcust_assigned_to'))}">
                <button type="button" class="primary-button" data-tool-assign="${escapeHtml(tool.toolId)}">${escapeHtml(t('toolcust_assign_btn'))}</button>
              </div>`;
          const history = tool.history.length
            ? `<div class="tool-custody-history"><h4>${escapeHtml(t('toolcust_history'))}</h4><ul>${[...tool.history].reverse().slice(0, 5).map((entry) => `<li>${escapeHtml(historyLabel(entry))}</li>`).join('')}</ul></div>`
            : '';
          return `
          <article class="tool-custody-card${maintenance ? ' tool-custody-card-due' : ''}">
            <p><span>${escapeHtml(tool.toolId)} · ${escapeHtml(typeLabel(tool))}</span><strong>${escapeHtml(tool.name)}</strong></p>
            <p><span>${escapeHtml(tool.serial ? `${t('toolcust_serial')}: ${tool.serial}` : '')}</span><span>${escapeHtml(t('toolcust_condition'))}: ${escapeHtml(conditionLabel(tool.condition))}</span></p>
            <p>${statusLine}${counterLine}</p>
            ${badge}
            ${custodyRow}
            ${usageRow}
            ${history}
          </article>`;
        }).join('');
    }
    const countNote = $('toolCustodyCountNote');
    if (countNote) {
      countNote.textContent = summary.totalCount === 0
        ? t('toolcust_empty')
        : t('toolcust_count_note', null, { total: summary.totalCount, out: summary.assignedCount, due: summary.maintenanceCount });
    }
  }

  const form = $('toolCustodyForm');
  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      try {
        const updated = addFieldTool(loadFieldTools(), {
          type: $('toolCustodyType')?.value,
          name: $('toolCustodyName')?.value,
          serial: $('toolCustodySerial')?.value,
          condition: $('toolCustodyCondition')?.value,
          assignedToLineman: $('toolCustodyLineman')?.value,
          spliceCount: $('toolCustodySplices')?.value,
          bladeCleavesCount: $('toolCustodyCleaves')?.value
        }, { date: pakistanToday() });
        saveFieldTools(updated);
        form.reset();
        render();
        notifyChanged();
        toast(t('toolcust_toast_added'));
      } catch (error) {
        toast(error.message || 'Could not add this tool.');
      }
    });
  }

  const listEl = $('toolCustodyList');
  if (listEl) {
    listEl.addEventListener('click', async (event) => {
      const assignBtn = event.target.closest('[data-tool-assign]');
      const returnBtn = event.target.closest('[data-tool-return]');
      const logBtn = event.target.closest('[data-tool-log]');
      try {
        if (assignBtn) {
          const toolId = assignBtn.dataset.toolAssign;
          const input = dialog.querySelector(`[data-tool-assign-input="${toolId}"]`);
          const updated = assignFieldTool(loadFieldTools(), toolId, { lineman: input?.value || '', date: pakistanToday() });
          saveFieldTools(updated);
          render();
          notifyChanged();
          toast(t('toolcust_toast_assigned'));
          return;
        }
        if (returnBtn) {
          const toolId = returnBtn.dataset.toolReturn;
          const tool = loadFieldTools().find((entry) => String(entry.toolId) === String(toolId));
          if (!tool) return;
          if (typeof onConfirm === 'function') {
            const confirmed = await onConfirm({
              tone: 'default',
              title: t('toolcust_return_confirm_title'),
              subject: `${tool.name} (${tool.toolId})`,
              message: t('toolcust_return_confirm_msg'),
              confirmLabel: t('toolcust_return_btn')
            });
            if (confirmed !== 'confirm') return;
          }
          saveFieldTools(returnFieldTool(loadFieldTools(), toolId, { date: pakistanToday() }));
          render();
          notifyChanged();
          toast(t('toolcust_toast_returned'));
          return;
        }
        if (logBtn) {
          const toolId = logBtn.dataset.toolLog;
          const input = dialog.querySelector(`[data-tool-usage-input="${toolId}"]`);
          const tool = loadFieldTools().find((entry) => String(entry.toolId) === String(toolId));
          if (!tool) return;
          const type = toolTypeOf(tool.type);
          const amount = Number(input?.value);
          const updated = logToolUsage(loadFieldTools(), toolId, type?.counter === 'spliceCount'
            ? { splices: amount, date: pakistanToday() }
            : { cleaves: amount, date: pakistanToday() });
          saveFieldTools(updated);
          render();
          notifyChanged();
          toast(t('toolcust_toast_logged'));
        }
      } catch (error) {
        toast(error.message || 'Could not complete this tool action.');
      }
    });
  }

  const closeBtn = $('toolCustodyCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', () => dialog.close());
  const openBtn = typeof document !== 'undefined' ? document.getElementById('openToolCustodyModalBtn') : null;
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
