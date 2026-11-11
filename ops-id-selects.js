/* ops-id-selects.js — Searchable dropdowns for the Operations panels
 * (Reports Tab Part 4B(3)).
 *
 * The ops forms used to take raw typed IDs (customer, collector, ticket,
 * bill, credit and payment ids), so a mistyped id silently recorded a
 * dead link. The fields are now dropdowns populated from saved records:
 * strict <select> where the code looks the value up (credit, payment,
 * visit/entry/series ids, bills), and a <datalist> where the stored
 * value is free text that may legitimately be new (collector names,
 * ticket ids from outside the complaint register).
 *
 * The ops forms store the customer NAME as free text (not the id), so
 * customer options keep the name as the value — the stored record is
 * identical to what typing the name produced; the label only adds the
 * customer number so same-named customers stay distinguishable.
 * Everything here is pure except fillSelectOptions, which only touches
 * the one element it is given. */

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

/** Customer name options, active customers first, archived last. */
export function customerNameOptions(customers) {
  const list = (customers ?? []).filter(customer => customer && typeof customer.name === 'string' && customer.name.trim());
  const label = customer => `#${customer.customerNumber ?? customer.id} ${customer.name.trim()}${customer.mohalla || customer.area ? ` (${customer.mohalla || customer.area})` : ''}`;
  const sorted = [...list].sort((a, b) => (a.archived === true ? 1 : 0) - (b.archived === true ? 1 : 0) || String(a.name).localeCompare(String(b.name)));
  return sorted.map(customer => ({ value: customer.name.trim(), label: label(customer) }));
}

/** Distinct collector names, most frequent first, then alphabetical. */
export function collectorNameOptions(names) {
  const counts = new Map();
  for (const name of names ?? []) {
    const clean = String(name ?? '').trim();
    if (!clean) continue;
    counts.set(clean, (counts.get(clean) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name]) => ({ value: name, label: name }));
}

/** Record-id options: the value is the record id by default, or whatever
 * valueFn returns (the clearance mark box is looked up by payment id,
 * not by the clearance record's own id). */
export function recordIdOptions(records, labelFn, valueFn = (record) => String(record.id)) {
  return (records ?? []).filter(record => record && record.id !== undefined && record.id !== null && String(record.id) !== '').map(record => ({ value: valueFn(record), label: labelFn(record) }));
}

/** Payment options, most recent first, capped so the list stays usable. */
export function paymentIdOptions(payments, limit = 100) {
  const list = (payments ?? []).filter(payment => payment && payment.id);
  const sorted = [...list].sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')) || String(b.id).localeCompare(String(a.id)));
  return sorted.slice(0, limit).map(payment => ({
    value: String(payment.id),
    label: `${payment.id} — ${payment.customerName ?? ''} · Rs. ${Number(payment.amount || 0).toLocaleString('en-PK')} · ${payment.date ?? ''} · ${payment.method ?? ''}`.replace(/ ·  ·/g, ' ·').trim(),
  }));
}

/** Bill options across customers, newest month first. */
export function billIdOptions(customers) {
  const rows = [];
  for (const customer of customers ?? []) {
    for (const bill of customer?.bills ?? []) {
      if (!bill || typeof bill.id !== 'string' || !bill.id) continue;
      rows.push({ customer, bill });
    }
  }
  rows.sort((a, b) => String(b.bill.month ?? '').localeCompare(String(a.bill.month ?? '')) || String(a.customer.name ?? '').localeCompare(String(b.customer.name ?? '')));
  return rows.map(({ customer, bill }) => ({
    value: bill.id,
    label: `${bill.id} — ${customer.name ?? ''} · ${bill.month ?? ''} · Rs. ${Number(bill.dueAmount || 0).toLocaleString('en-PK')}`,
  }));
}

/** All payments across customers, with the customer name attached. */
export function allPaymentsWithCustomer(customers) {
  const rows = [];
  for (const customer of customers ?? []) {
    for (const bill of customer?.bills ?? []) {
      for (const payment of bill?.payments ?? []) {
        if (!payment || !payment.id) continue;
        rows.push({ ...payment, customerName: customer.name ?? '', customerId: customer.id });
      }
    }
  }
  return rows;
}

/** HTML for a select's (or datalist's) options, blank first unless
 * blankLabel is null (datalists: no blank suggestion). */
export function optionsHtml(options, blankLabel = '— Choose —') {
  const blank = blankLabel === null ? '' : `<option value="">${escapeHtml(blankLabel)}</option>`;
  return blank + (options ?? []).map(option => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`).join('');
}

/** Fill a select/datalist's options, keeping the operator's current
 * pick when it is still listed, and never clobbering the element the
 * operator is typing in right now (same guard as the part-payment
 * customer select). */
export function fillSelectOptions(el, options, blankLabel) {
  if (!el) return;
  if (typeof document !== 'undefined' && document.activeElement === el) return;
  const picked = el.value ?? '';
  el.innerHTML = optionsHtml(options, blankLabel);
  if ((options ?? []).some(option => String(option.value) === String(picked))) el.value = picked;
}
