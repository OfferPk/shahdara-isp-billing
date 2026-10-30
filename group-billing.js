/**
 * group-billing.js — SISP-35: Multi-Connection Family / Landlord Group
 * Billing & Combined Receipt.
 *
 * One landlord / family often holds several connections (several houses,
 * shops, or flats), each with its own customer record, its own bills and
 * its own history. A billing group LINKS those connections under one
 * group title — it never merges them. Each member keeps their own
 * customer record, bills, receipts and history; the group is only a
 * link used to collect the whole group's current-month due in one tap
 * and to print one combined receipt.
 *
 * One record per group: billingGroupId (GRP-101+), groupTitle (required),
 * memberIds (customer ids, in display order, deduped), createdAt.
 * There is deliberately NO group-level discount, NO shared balance and
 * NO merged ledger: the group total is always the SUM of the members'
 * own current-month balances, recomputed live.
 *
 * Rules, stated exactly:
 * - Group total = sum of NON-ARCHIVED members' current-month balances.
 *   Archived members are listed but skipped (their due is shown, flagged
 *   "archived — skipped", and never enters the total).
 * - A member with zero due contributes zero and never breaks the total:
 *   they appear in the breakdown as "already paid" (priced bill settled)
 *   or "no bill" (no priced bill for the month), with Rs. 0.
 * - "Collect Group Full" records one full payment per payable member
 *   through the app's existing quick-collection path (executeQuickCollection
 *   -> core addPayment), so each member's own ledger, receipts and
 *   allocations update exactly as if collected singly. All-or-nothing:
 *   if any member's payment fails, nothing is saved (the immutable
 *   nextState chain is discarded and the error names the member).
 * - SISP-88 "Collect Group Partial": when the cash handed over is LESS
 *   than the group total, collectGroupPartial runs a deterministic
 *   WATERFALL in the group's STORED member order (memberIds exactly as
 *   saved in the group record): each payable member is settled through
 *   the same quick-collection path for min(their due, cash left) until
 *   the cash runs out — earlier members are paid in full first, a later
 *   member may be left part-paid ('partial') or untouched ('unpaid').
 *   Cash above the group total is never handed to the executor; the
 *   excess is reported back as unallocatedCents. The combined receipt
 *   then shows every member's exact paid + remaining lines, and members
 *   still owing get a 1-tap Waada Tareekh chip (the SISP-3 waada path).
 *   Partial collection stamps NOTHING group-level on any payment, so
 *   voiding a member payment later behaves exactly as SISP-34 always
 *   does, with no group side effects.
 * - The combined receipt shows the group total AND the per-member
 *   breakdown, in Urdu + English, as a WhatsApp draft text and as a
 *   plain-text thermal/print receipt. It never invents amounts: every
 *   line comes from a member's own bill/allocation.
 *
 * Storage: groups live in localStorage under GROUP_BILLING_KEY
 * (sisp_billing_groups_v1), a flat array. Backup: groups travel in the
 * JSON backup `settings.billingGroups` section (see core.js), under the
 * same safe-merge rule as the Pending Works list: adopted only when
 * this device has none stored yet.
 *
 * This module imports nothing: customers, allocations and the payment
 * executor are passed in by callers, so the pure helpers stay testable
 * without the app. The modal controller at the bottom needs a DOM and
 * is inspection-verified (no DOM harness in node:test), like the other
 * modal controllers.
 */

export const GROUP_BILLING_KEY = 'sisp_billing_groups_v1';

const ID_RE = /^GRP-(\d+)$/;

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

/** Whole rupees grouped, e.g. 6500 -> "6,500"; paise shown only when nonzero. */
export function formatGroupPKR(cents) {
  const value = Number(cents) || 0;
  const rupees = value / 100;
  return `Rs. ${rupees.toLocaleString('en-PK', {
    minimumFractionDigits: value % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  })}`;
}

function centsOf(amount) {
  const n = Number(amount);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** Next group id: one above the highest GRP-N already stored (starts at 101). */
export function nextGroupId(groups) {
  let max = 100;
  for (const group of Array.isArray(groups) ? groups : []) {
    const match = ID_RE.exec(String(group?.billingGroupId || ''));
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `GRP-${max + 1}`;
}

/** Drops malformed rows; keeps clean groups in stored order. */
export function sanitizeBillingGroups(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const title = cleanText(entry.groupTitle).slice(0, 100);
    if (!title) continue;
    const seen = new Set();
    const memberIds = [];
    for (const id of Array.isArray(entry.memberIds) ? entry.memberIds : []) {
      const clean = cleanText(id);
      if (clean && !seen.has(clean)) {
        seen.add(clean);
        memberIds.push(clean);
      }
    }
    if (memberIds.length === 0) continue;
    out.push({
      billingGroupId: ID_RE.test(String(entry.billingGroupId || '')) ? String(entry.billingGroupId) : '',
      groupTitle: title,
      memberIds,
      createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : ''
    });
  }
  // Fill in ids for rows that arrived without one, in stored order.
  let next = 101;
  const used = new Set(out.map((g) => g.billingGroupId).filter(Boolean));
  for (const group of out) {
    if (!group.billingGroupId) {
      while (used.has(`GRP-${next}`)) next++;
      group.billingGroupId = `GRP-${next}`;
      used.add(group.billingGroupId);
      next++;
    }
  }
  return out;
}

/** Validates a create/edit form payload; throws with a plain message. */
export function buildGroupFields(input) {
  const title = cleanText(input?.groupTitle);
  if (!title) throw new Error('Group title is required (e.g. a family or landlord name).');
  const seen = new Set();
  const memberIds = [];
  for (const id of Array.isArray(input?.memberIds) ? input.memberIds : []) {
    const clean = cleanText(id);
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      memberIds.push(clean);
    }
  }
  if (memberIds.length === 0) throw new Error('Pick at least one connection for the group.');
  return { groupTitle: title.slice(0, 100), memberIds };
}

export function addBillingGroup(groups, input) {
  const fields = buildGroupFields(input);
  const clean = sanitizeBillingGroups(groups);
  return [...clean, {
    billingGroupId: nextGroupId(clean),
    ...fields,
    createdAt: new Date().toISOString()
  }];
}

export function updateBillingGroup(groups, billingGroupId, input) {
  const fields = buildGroupFields(input);
  const clean = sanitizeBillingGroups(groups);
  let found = false;
  const updated = clean.map((group) => {
    if (String(group.billingGroupId) !== String(billingGroupId)) return group;
    found = true;
    return { ...group, ...fields };
  });
  if (!found) throw new Error('Group not found.');
  return updated;
}

export function deleteBillingGroup(groups, billingGroupId) {
  return sanitizeBillingGroups(groups).filter((group) => String(group.billingGroupId) !== String(billingGroupId));
}

/** Members in group order; unknown ids are skipped (never invented). */
export function groupMembers(group, customers) {
  const byId = new Map((Array.isArray(customers) ? customers : []).map((c) => [String(c?.id), c]));
  const out = [];
  for (const id of group?.memberIds ?? []) {
    const customer = byId.get(String(id));
    if (customer) out.push(customer);
  }
  return out;
}

/**
 * One member's current-month balance.
 * With allocations (the app passes calculatePaymentAllocations(state)),
 * the allocation engine is authoritative (credits/arrears included).
 * Without allocations (tests, offline helpers), the bill record is used:
 * priced dueAmount minus recorded payments, clamped at zero.
 * Returns { dueCents, status } where status is 'due' | 'paid' | 'no-bill'.
 */
export function memberDueCents(customer, month, allocations) {
  if (allocations && typeof allocations.forMonth === 'function') {
    const summary = allocations.forMonth(customer?.id, month);
    if (!summary || summary.balanceDueCents === null || summary.balanceDueCents === undefined) {
      return { dueCents: 0, status: 'no-bill' };
    }
    const due = Math.max(0, Number(summary.balanceDueCents) || 0);
    return { dueCents: due, status: due > 0 ? 'due' : 'paid' };
  }
  const bill = (customer?.bills ?? []).find((b) => b?.month === month);
  if (!bill) return { dueCents: 0, status: 'no-bill' };
  const dueAmount = Number(bill.dueAmount);
  if (!Number.isFinite(dueAmount) || dueAmount <= 0) return { dueCents: 0, status: 'no-bill' };
  const paid = (bill.payments ?? []).reduce((sum, p) => sum + centsOf(p?.amount), 0);
  const due = Math.max(0, centsOf(dueAmount) - paid);
  return { dueCents: due, status: due > 0 ? 'due' : 'paid' };
}

/**
 * The group's live due breakdown. totalCents sums NON-ARCHIVED members
 * only; archived members are listed with their due flagged 'archived'
 * and never enter the total. Zero-due members contribute zero.
 */
export function buildGroupDue(group, customers, month, allocations) {
  const members = groupMembers(group, customers).map((customer) => {
    const { dueCents, status } = memberDueCents(customer, month, allocations);
    return {
      customerId: customer.id,
      customerNumber: customer.customerNumber,
      name: customer.name,
      archived: customer.archived === true,
      dueCents,
      status: customer.archived === true ? 'archived' : status
    };
  });
  const totalCents = members.reduce((sum, m) => sum + (m.archived ? 0 : m.dueCents), 0);
  return {
    billingGroupId: group?.billingGroupId ?? '',
    groupTitle: group?.groupTitle ?? '',
    month,
    members,
    totalCents,
    payableCount: members.filter((m) => !m.archived && m.dueCents > 0).length
  };
}

/**
 * Collects the group's whole current-month total in one action.
 * `execute` is the app's quick-collection function
 * (state, {customerId, month, amount, date, method, paidBy}) -> {nextState}.
 * All-or-nothing: a failure names the member and nothing is saved,
 * because the immutable nextState chain is discarded on throw.
 * Zero-due, no-bill and archived members are reported as skipped, never
 * as failures, and never break the total.
 */
export function collectGroupFull(state, group, { date, method, paidBy, month, allocations, execute } = {}) {
  if (!group) throw new Error('Group is required.');
  if (!month) throw new Error('Billing month is required.');
  if (typeof execute !== 'function') throw new Error('A payment executor is required.');
  const due = buildGroupDue(group, state?.customers ?? [], month, allocations);
  const outcomes = [];
  let next = state;
  let totalCents = 0;
  let paidCount = 0;
  for (const member of due.members) {
    if (member.archived) {
      outcomes.push({ ...member, amountCents: 0, outcome: 'skipped-archived' });
      continue;
    }
    if (member.status === 'no-bill') {
      outcomes.push({ ...member, amountCents: 0, outcome: 'skipped-no-bill' });
      continue;
    }
    if (member.dueCents <= 0) {
      outcomes.push({ ...member, amountCents: 0, outcome: 'skipped-paid' });
      continue;
    }
    try {
      const result = execute(next, {
        customerId: member.customerId,
        month,
        amount: member.dueCents / 100,
        date,
        method,
        paidBy
      });
      next = result.nextState;
      totalCents += member.dueCents;
      paidCount++;
      outcomes.push({ ...member, amountCents: member.dueCents, outcome: 'paid' });
    } catch (error) {
      throw new Error(`${member.name}: ${error.message} — nothing was saved.`);
    }
  }
  return {
    nextState: next,
    groupTitle: due.groupTitle,
    billingGroupId: due.billingGroupId,
    month,
    outcomes,
    totalCents,
    paidCount,
    collected: paidCount > 0
  };
}

/**
 * SISP-88: collects LESS than the group total — a deterministic waterfall
 * in the group's STORED member order. Each payable member is settled
 * through the same `execute` quick-collection path for
 * min(member due, cash left) until the cash runs out. Members reached
 * with cash left but less than their due end 'partial'; members never
 * reached end 'unpaid' with their full due as remainingCents. Skips
 * mirror collectGroupFull (archived / no-bill / already-paid consume no
 * cash). Cash above the group total is never executed against anyone —
 * it comes back as unallocatedCents. All-or-nothing on a member failure,
 * exactly like collectGroupFull. `amountReceived` is in PKR.
 */
export function collectGroupPartial(state, group, { amountReceived, date, method, paidBy, month, allocations, execute } = {}) {
  if (!group) throw new Error('Group is required.');
  if (!month) throw new Error('Billing month is required.');
  if (typeof execute !== 'function') throw new Error('A payment executor is required.');
  const receivedCents = centsOf(amountReceived);
  if (!(receivedCents > 0)) throw new Error('Enter the cash received (more than Rs. 0) for a partial group collection.');
  const due = buildGroupDue(group, state?.customers ?? [], month, allocations);
  const outcomes = [];
  let next = state;
  let cashLeft = receivedCents;
  let allocatedCents = 0;
  let paidCount = 0;
  let partialCount = 0;
  for (const member of due.members) {
    if (member.archived) {
      outcomes.push({ ...member, amountCents: 0, remainingCents: member.dueCents, outcome: 'skipped-archived' });
      continue;
    }
    if (member.status === 'no-bill') {
      outcomes.push({ ...member, amountCents: 0, remainingCents: 0, outcome: 'skipped-no-bill' });
      continue;
    }
    if (member.dueCents <= 0) {
      outcomes.push({ ...member, amountCents: 0, remainingCents: 0, outcome: 'skipped-paid' });
      continue;
    }
    const allocate = Math.min(member.dueCents, cashLeft);
    if (allocate <= 0) {
      outcomes.push({ ...member, amountCents: 0, remainingCents: member.dueCents, outcome: 'unpaid' });
      continue;
    }
    try {
      const result = execute(next, {
        customerId: member.customerId,
        month,
        amount: allocate / 100,
        date,
        method,
        paidBy
      });
      next = result.nextState;
    } catch (error) {
      throw new Error(`${member.name}: ${error.message} — nothing was saved.`);
    }
    cashLeft -= allocate;
    allocatedCents += allocate;
    const remainingCents = member.dueCents - allocate;
    if (remainingCents > 0) partialCount++;
    else paidCount++;
    outcomes.push({ ...member, amountCents: allocate, remainingCents, outcome: remainingCents > 0 ? 'partial' : 'paid' });
  }
  const remainingCents = outcomes.reduce(
    (sum, o) => sum + (o.outcome === 'partial' || o.outcome === 'unpaid' ? o.remainingCents : 0), 0);
  return {
    nextState: next,
    groupTitle: due.groupTitle,
    billingGroupId: due.billingGroupId,
    month,
    outcomes,
    totalCents: allocatedCents,
    receivedCents,
    unallocatedCents: cashLeft,
    remainingCents,
    paidCount,
    partialCount,
    collected: allocatedCents > 0
  };
}

/**
 * SISP-88: members who still owe after a group collection — the ones the
 * modal offers a 1-tap Waada Tareekh chip for, in waterfall order.
 */
export function groupWaadaTargets(outcomes) {
  return (outcomes ?? [])
    .filter((o) => (o.outcome === 'partial' || o.outcome === 'unpaid') && o.remainingCents > 0)
    .map((o) => ({
      customerId: o.customerId,
      customerNumber: o.customerNumber,
      name: o.name,
      remainingCents: o.remainingCents
    }));
}

/**
 * ONE combined receipt: group total + per-member breakdown, Urdu + English.
 * Returns { text, whatsappText } — text is the plain thermal/print receipt,
 * whatsappText is the draft for wa.me (no number is guessed; the app opens
 * wa.me/?text= so the owner picks the recipient).
 * SISP-88: when any outcome is 'partial' or 'unpaid' the receipt switches
 * to detailed lines — every member shows exact paid + remaining — plus
 * cash-received and still-due totals. Full collections keep the exact
 * SISP-35 format.
 */
export function buildGroupReceipt({ groupTitle, month, date, method, outcomes, totalCents, receivedCents, remainingCents }) {
  const detailed = (outcomes ?? []).some((o) => o.outcome === 'partial' || o.outcome === 'unpaid');
  const lines = (outcomes ?? []).map((o) => {
    if (o.outcome === 'paid') return detailed
      ? `• ${o.name} (#${o.customerNumber}): paid ${formatGroupPKR(o.amountCents)} · remaining Rs. 0`
      : `• ${o.name} (#${o.customerNumber}): ${formatGroupPKR(o.amountCents)}`;
    if (o.outcome === 'partial') return `• ${o.name} (#${o.customerNumber}): paid ${formatGroupPKR(o.amountCents)} · remaining ${formatGroupPKR(o.remainingCents)}`;
    if (o.outcome === 'unpaid') return `• ${o.name} (#${o.customerNumber}): paid Rs. 0 · remaining ${formatGroupPKR(o.remainingCents)}`;
    if (o.outcome === 'skipped-paid') return `• ${o.name} (#${o.customerNumber}): Rs. 0 — already paid`;
    if (o.outcome === 'skipped-no-bill') return `• ${o.name} (#${o.customerNumber}): Rs. 0 — no bill`;
    return `• ${o.name} (#${o.customerNumber}): Rs. 0 — archived, skipped`;
  });
  const totalLine = `TOTAL: ${formatGroupPKR(totalCents)}`;
  const text = [
    'SHAHDARA FIBER NET — Group Receipt',
    `Group: ${groupTitle}`,
    `Billing month: ${month}`,
    `Date: ${date || ''} · Method: ${method || ''}`,
    '--------------------------------',
    ...lines,
    '--------------------------------',
    totalLine,
    ...(detailed ? [
      `Cash received: ${formatGroupPKR(receivedCents ?? totalCents)}`,
      `Still due: ${formatGroupPKR(remainingCents ?? 0)}`
    ] : []),
    'Combined receipt: each member ledger also updated separately.'
  ].join('\n');
  const whatsappText = [
    '🧾 Group Receipt / مشترکہ رسید',
    `Group: ${groupTitle}`,
    `Billing month: ${month} · Date: ${date || ''} · Method: ${method || ''}`,
    ...lines,
    `کل رقم / Total: ${formatGroupPKR(totalCents)}`,
    ...(detailed ? [`باقی رقم / Still due: ${formatGroupPKR(remainingCents ?? 0)}`] : []),
    'Shahdara Fiber Net — thank you! / شکریہ!'
  ].join('\n');
  return { text, whatsappText };
}

/** Dashboard summary: group count + live collectible total for the month. */
export function billingGroupsSummary(groups, customers, month, allocations) {
  const clean = sanitizeBillingGroups(groups);
  let totalDueCents = 0;
  let groupsWithDue = 0;
  for (const group of clean) {
    const due = buildGroupDue(group, customers, month, allocations);
    if (due.totalCents > 0) groupsWithDue++;
    totalDueCents += due.totalCents;
  }
  return { groupCount: clean.length, groupsWithDue, totalDueCents };
}

/** Persists groups; never throws. */
export function loadBillingGroups(storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return [];
    const raw = store.getItem(GROUP_BILLING_KEY);
    if (!raw) return [];
    return sanitizeBillingGroups(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveBillingGroups(groups, storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return false;
    store.setItem(GROUP_BILLING_KEY, JSON.stringify(sanitizeBillingGroups(groups)));
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
 * Dashboard + modal controller, following the Pending Works pattern:
 * open() / refresh(), open button wired by id, close button, create/edit
 * form with member checkboxes + search filter, list delegation for
 * collect/edit/delete, receipt panel with Copy / WhatsApp / Print.
 * getState supplies the live customer list; getAllocations supplies the
 * allocation engine; currentMonth supplies the billing month; onCollectGroup
 * is the app's collect implementation (quick-collection + persist) and
 * must return { ...collectResult, receipt } or throw.
 * SISP-88: onCollectGroupPartial(group, { date, method, amountReceived })
 * is the same for a partial (waterfall) collection, chosen automatically
 * when the "Amount received" field holds less than the group total;
 * onGroupWaada(customerId) opens the app's SISP-3 Waada chip dialog for a
 * member who still owes after a partial collection.
 */
export function setupGroupBillingModal(getState, {
  onGroupsChanged, onToast, onConfirm, onCollectGroup, onCollectGroupPartial, onGroupWaada, getAllocations, currentMonth
} = {}) {
  const dialog = typeof document !== 'undefined' ? document.getElementById('groupBillingModal') : null;
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
  const getMonth = () => {
    try {
      return typeof currentMonth === 'function' ? currentMonth() : '';
    } catch {
      return '';
    }
  };
  const getAlloc = (state) => {
    try {
      return typeof getAllocations === 'function' ? getAllocations(state) : undefined;
    } catch {
      return undefined;
    }
  };
  function resetForm() {
    const form = $('groupBillingForm');
    if (form) form.reset();
    const editId = $('groupBillingEditId');
    if (editId) editId.value = '';
    const submitBtn = $('groupBillingSubmitBtn');
    if (submitBtn) submitBtn.textContent = '➕ Group banayein';
    const cancelBtn = $('groupBillingCancelEditBtn');
    if (cancelBtn) cancelBtn.hidden = true;
    renderMemberPicker('');
  }

  function renderMemberPicker(filter) {
    const picker = $('groupBillingMembers');
    if (!picker) return;
    const q = (filter || '').trim().toLowerCase();
    const customers = getCustomers()
      .filter((c) => !c.archived)
      .sort((a, b) => (a.customerNumber ?? 0) - (b.customerNumber ?? 0));
    const rows = customers.filter((c) => {
      if (!q) return true;
      return String(c.name || '').toLowerCase().includes(q)
        || String(c.customerNumber ?? '').includes(q)
        || String(c.phone || '').includes(q);
    });
    picker.innerHTML = rows.length === 0
      ? '<p class="group-billing-empty">No matching connection. Try another name or number.</p>'
      : rows.map((c) => `
        <label class="group-billing-member">
          <input type="checkbox" value="${escapeHtml(String(c.id))}" data-group-member>
          <span><strong>${escapeHtml(c.name)}</strong> (#${escapeHtml(String(c.customerNumber ?? ''))})</span>
        </label>`).join('');
  }

  function checkedMemberIds() {
    return [...dialog.querySelectorAll('[data-group-member]:checked')].map((el) => el.value);
  }

  function showReceipt(receipt) {
    const panel = $('groupBillingReceiptPanel');
    const pre = $('groupBillingReceiptText');
    if (!panel || !pre) return;
    pre.textContent = receipt.text;
    panel.hidden = false;
    const waBtn = $('groupBillingWhatsAppBtn');
    if (waBtn) waBtn.href = `https://wa.me/?text=${encodeURIComponent(receipt.whatsappText)}`;
    panel.scrollIntoView({ block: 'nearest' });
  }

  // SISP-88: 1-tap Waada chips for members who still owe after a partial
  // collection. Cleared (panel hidden) whenever a full collection or a
  // fresh render without a partial result happens.
  function renderWaadaChips(result) {
    const panel = $('groupBillingWaadaPanel');
    const row = $('groupBillingWaadaChips');
    if (!panel || !row) return;
    const targets = groupWaadaTargets(result?.outcomes);
    if (targets.length === 0 || typeof onGroupWaada !== 'function') {
      panel.hidden = true;
      row.innerHTML = '';
      return;
    }
    row.innerHTML = targets.map((m) => `
      <button type="button" class="secondary-button waada-chip-btn" data-group-waada="${escapeHtml(String(m.customerId))}">📅 Waada: ${escapeHtml(m.name)} (#${escapeHtml(String(m.customerNumber ?? ''))}) — ${escapeHtml(formatGroupPKR(m.remainingCents))} baqi</button>`).join('');
    panel.hidden = false;
  }

  function render() {
    const month = getMonth();
    const customers = getCustomers();
    const groups = loadBillingGroups();
    let allocations;
    try {
      const state = typeof getState === 'function' ? getState() : null;
      allocations = getAlloc(state);
    } catch {
      allocations = undefined;
    }
    const listEl = $('groupBillingList');
    if (listEl) {
      listEl.innerHTML = groups.length === 0
        ? '<p class="group-billing-empty">No group yet. Link a family or landlord connections above — each connection keeps its own record, bills and history.</p>'
        : groups.map((group) => {
          const due = buildGroupDue(group, customers, month, allocations);
          const memberLines = due.members.map((m) => {
            const label = m.archived ? `${formatGroupPKR(m.dueCents)} — archived, skipped`
              : m.status === 'no-bill' ? 'Rs. 0 — no bill'
              : m.status === 'paid' ? 'Rs. 0 — already paid'
              : formatGroupPKR(m.dueCents);
            return `<p><span>${escapeHtml(m.name)} (#${escapeHtml(String(m.customerNumber ?? ''))})</span><strong>${escapeHtml(label)}</strong></p>`;
          }).join('');
          return `
          <article class="group-billing-card">
            <p><span>Group</span><strong>${escapeHtml(group.groupTitle)}</strong></p>
            <div class="group-billing-members">${memberLines}</div>
            <p><span>Group total (${escapeHtml(month)})</span><strong>${escapeHtml(formatGroupPKR(due.totalCents))}</strong></p>
            <div class="group-billing-actions">
              <button type="button" class="primary-button" data-group-collect="${escapeHtml(group.billingGroupId)}" ${due.totalCents <= 0 ? 'disabled' : ''}>💰 Collect Group Total (${escapeHtml(formatGroupPKR(due.totalCents))})</button>
              <button type="button" class="secondary-button" data-group-edit="${escapeHtml(group.billingGroupId)}">✏️ Edit</button>
              <button type="button" class="secondary-button text-button danger" data-group-delete="${escapeHtml(group.billingGroupId)}">🗑 Delete</button>
            </div>
          </article>`;
        }).join('');
    }
    const countNote = $('groupBillingCountNote');
    if (countNote) {
      const summary = billingGroupsSummary(groups, customers, month, allocations);
      countNote.textContent = `${summary.groupCount} group(s) · ${summary.groupsWithDue} with dues this month · collectible total ${formatGroupPKR(summary.totalDueCents)}. Groups are links only — members keep their own records.`;
    }
  }

  const filterInput = $('groupBillingMemberFilter');
  if (filterInput) filterInput.addEventListener('input', () => renderMemberPicker(filterInput.value));

  const form = $('groupBillingForm');
  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      try {
        const editId = $('groupBillingEditId')?.value || '';
        const input = {
          groupTitle: $('groupBillingTitle')?.value,
          memberIds: checkedMemberIds()
        };
        const updated = editId
          ? updateBillingGroup(loadBillingGroups(), editId, input)
          : addBillingGroup(loadBillingGroups(), input);
        saveBillingGroups(updated);
        resetForm();
        render();
        if (typeof onGroupsChanged === 'function') onGroupsChanged();
        if (typeof onToast === 'function') onToast(editId ? 'Group updated.' : 'Group created.');
      } catch (error) {
        if (typeof onToast === 'function') onToast(error.message || 'Could not save this group.');
      }
    });
  }
  const cancelEditBtn = $('groupBillingCancelEditBtn');
  if (cancelEditBtn) cancelEditBtn.addEventListener('click', resetForm);

  const copyBtn = $('groupBillingCopyBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const text = $('groupBillingReceiptText')?.textContent || '';
      try {
        await navigator.clipboard.writeText(text);
        if (typeof onToast === 'function') onToast('Receipt copied.');
      } catch {
        if (typeof onToast === 'function') onToast('Copy failed — select the receipt text manually.');
      }
    });
  }
  // SISP-88: Waada chip clicks open the app's SISP-3 Waada dialog for
  // that member (wired through onGroupWaada).
  const waadaPanel = $('groupBillingWaadaPanel');
  if (waadaPanel) {
    waadaPanel.addEventListener('click', (event) => {
      const chip = event.target.closest('[data-group-waada]');
      if (chip && typeof onGroupWaada === 'function') onGroupWaada(chip.dataset.groupWaada);
    });
  }
  const printBtn = $('groupBillingPrintBtn');
  if (printBtn) {
    printBtn.addEventListener('click', () => {
      const text = $('groupBillingReceiptText')?.textContent || '';
      try {
        const win = window.open('', '_blank');
        if (!win) throw new Error('popup blocked');
        win.document.write(`<pre style="font-family: monospace; white-space: pre-wrap;">${escapeHtml(text)}</pre>`);
        win.document.close();
        win.focus();
        win.print();
      } catch {
        if (typeof onToast === 'function') onToast('Print popup blocked — copy the receipt instead.');
      }
    });
  }

  const listEl = $('groupBillingList');
  if (listEl) {
    listEl.addEventListener('click', async (event) => {
      const collectBtn = event.target.closest('[data-group-collect]');
      const editBtn = event.target.closest('[data-group-edit]');
      const deleteBtn = event.target.closest('[data-group-delete]');
      try {
        if (collectBtn) {
          const group = loadBillingGroups().find((g) => String(g.billingGroupId) === String(collectBtn.dataset.groupCollect));
          if (!group) return;
          const dateInput = $('groupBillingCollectDate');
          const methodInput = $('groupBillingCollectMethod');
          const amountInput = $('groupBillingCollectAmount');
          const collectDate = dateInput?.value || pakistanToday();
          const collectMethod = methodInput?.value || 'Cash';
          // SISP-88: an entered amount below the group total takes the
          // partial waterfall path; blank / full-or-more stays on the
          // SISP-35 full path.
          const rawAmount = amountInput?.value;
          const amountReceived = rawAmount === '' || rawAmount === null || rawAmount === undefined ? NaN : Number(rawAmount);
          if (Number.isFinite(amountReceived) && amountReceived > 0) {
            const stateNow = typeof getState === 'function' ? getState() : null;
            const dueNow = buildGroupDue(group, getCustomers(), getMonth(), getAlloc(stateNow));
            if (Math.round(amountReceived * 100) < dueNow.totalCents) {
              if (typeof onCollectGroupPartial !== 'function') {
                if (typeof onToast === 'function') onToast('Partial group collection is not wired yet.');
                return;
              }
              const result = await onCollectGroupPartial(group, {
                date: collectDate,
                method: collectMethod,
                amountReceived
              });
              if (!result?.collected) {
                if (typeof onToast === 'function') onToast('Nothing to collect — this group has no payable dues this month.');
                render();
                return;
              }
              if (amountInput) amountInput.value = '';
              showReceipt(result.receipt);
              renderWaadaChips(result);
              render();
              if (typeof onGroupsChanged === 'function') onGroupsChanged();
              if (typeof onToast === 'function') onToast(`Group partial: ${formatGroupPKR(result.totalCents)} collected · ${formatGroupPKR(result.remainingCents)} still due.`);
              return;
            }
          }
          if (typeof onCollectGroup !== 'function') {
            if (typeof onToast === 'function') onToast('Group collection is not wired yet.');
            return;
          }
          const result = await onCollectGroup(group, {
            date: collectDate,
            method: collectMethod
          });
          if (!result?.collected) {
            if (typeof onToast === 'function') onToast('Nothing to collect — this group has no payable dues this month.');
            render();
            return;
          }
          if (amountInput) amountInput.value = '';
          renderWaadaChips(null);
          showReceipt(result.receipt);
          render();
          if (typeof onGroupsChanged === 'function') onGroupsChanged();
          if (typeof onToast === 'function') onToast(`Group collected: ${formatGroupPKR(result.totalCents)} (${result.paidCount} connection(s)).`);
          return;
        }
        if (editBtn) {
          const group = loadBillingGroups().find((g) => String(g.billingGroupId) === String(editBtn.dataset.groupEdit));
          if (!group) return;
          const titleInput = $('groupBillingTitle');
          const editId = $('groupBillingEditId');
          if (titleInput) titleInput.value = group.groupTitle;
          if (editId) editId.value = group.billingGroupId;
          renderMemberPicker(filterInput?.value || '');
          for (const box of dialog.querySelectorAll('[data-group-member]')) {
            box.checked = group.memberIds.includes(box.value);
          }
          const submitBtn = $('groupBillingSubmitBtn');
          if (submitBtn) submitBtn.textContent = '💾 Save changes';
          if (cancelEditBtn) cancelEditBtn.hidden = false;
          if (titleInput) titleInput.focus();
          return;
        }
        if (deleteBtn) {
          const group = loadBillingGroups().find((g) => String(g.billingGroupId) === String(deleteBtn.dataset.groupDelete));
          if (!group) return;
          if (typeof onConfirm === 'function') {
            const confirmed = await onConfirm({
              tone: 'danger',
              title: 'Delete this group?',
              subject: group.groupTitle,
              message: 'Only the group link is removed. Members keep their own records, bills and history.',
              confirmLabel: 'Delete'
            });
            if (confirmed !== 'confirm') return;
          }
          saveBillingGroups(deleteBillingGroup(loadBillingGroups(), deleteBtn.dataset.groupDelete));
          render();
          if (typeof onGroupsChanged === 'function') onGroupsChanged();
          if (typeof onToast === 'function') onToast('Group deleted.');
        }
      } catch (error) {
        if (typeof onToast === 'function') onToast(error.message || 'Could not complete this group action.');
      }
    });
  }
  const closeBtn = $('groupBillingCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', () => dialog.close());
  const openBtn = typeof document !== 'undefined' ? document.getElementById('openGroupBillingModalBtn') : null;
  if (openBtn) openBtn.addEventListener('click', () => {
    renderMemberPicker('');
    renderWaadaChips(null);
    render();
    dialog.showModal();
  });

  return {
    open() {
      renderMemberPicker('');
      renderWaadaChips(null);
      render();
      dialog.showModal();
    },
    refresh: render
  };
}
