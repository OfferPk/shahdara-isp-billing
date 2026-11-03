// Plan 40 (Plan 1-100) — Preferred payment channel with matching
// payment instructions.
//
// Payment drafts used to tell every customer to pay the same way,
// so a cash customer got wallet details they will not use and a
// wallet customer got told to wait for the collector. This module
// writes one choice down per customer — cash via the collector, or
// Easypaisa/wallet — and turns that choice into the instruction
// line that belongs at the end of that customer's own drafts
// (Plans 11, 12, 13 and 39: pre-due reminder, escalation ladder,
// payment confirmation, monthly statement).
//
// Scope fence, stated plainly:
//   - It is import-free: the caller supplies every customer and
//     every channel record, and the module never reads storage,
//     the clock, or the network, and never mutates an input.
//   - It stores NO wallet credential and NO wallet number. The
//     wallet instruction names the route and asks for a reference
//     note; it never carries an account number, because no such
//     number is recorded anywhere in this plan.
//   - Changing a channel never touches a payment, a Waada promise,
//     a balance, a bill, or any matching/reconciliation rule
//     (Plan V keeps wallet reconciliation). The record lives in
//     its own store apart from every money record.
//   - A customer with no recorded channel gets the neutral
//     default instructions (both routes named), never a guessed
//     channel.
//   - Mohalla broadcasts (Plan 14) are NOT tailored here, on
//     purpose: one announcement text goes to a whole mohalla with
//     mixed channels, and the operator picks recipients by hand
//     (the same reason Plan 15 never splits a broadcast draft by
//     language). Tailoring applies to per-customer drafts only,
//     where one customer means one channel.

export const PAYMENT_CHANNELS = Object.freeze({
  CASH: 'cash',
  WALLET: 'wallet',
});

export const PAYMENT_CHANNEL_VARIANTS = Object.freeze({
  ROMAN: 'roman',
  URDU: 'urdu',
});

const CASH_ALIASES = new Set(['cash', 'collector', 'cash_via_collector', 'cash-via-collector', 'cashcollector']);
const WALLET_ALIASES = new Set(['wallet', 'easypaisa', 'easypaisa_wallet', 'easypaisa-wallet', 'mobile_wallet', 'mobile-wallet']);

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function csvCell(value) {
  const str = String(value ?? '');
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

// Normalise one channel value: 'cash', 'wallet', or null for
// "no recorded channel". Unknown values are never coerced into a
// channel the customer did not pick.
export function normalizePaymentChannel(value) {
  const key = text(value).toLowerCase();
  if (CASH_ALIASES.has(key)) return PAYMENT_CHANNELS.CASH;
  if (WALLET_ALIASES.has(key)) return PAYMENT_CHANNELS.WALLET;
  return null;
}

export function normalizePaymentChannelVariant(value) {
  return text(value) === PAYMENT_CHANNEL_VARIANTS.URDU
    ? PAYMENT_CHANNEL_VARIANTS.URDU
    : PAYMENT_CHANNEL_VARIANTS.ROMAN;
}

// One normalised channel record, or null when the row carries no
// customer to attach it to. A record with an unknown channel value
// is null too: an unknown channel is stored as "no channel", never
// as a guessed one.
export function normalizePaymentChannelRecord(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const customerId = text(raw.customerId ?? raw.id);
  if (!customerId) return null;
  const channel = normalizePaymentChannel(raw.channel);
  if (!channel) return null;
  return {
    customerId,
    customerName: text(raw.customerName ?? raw.name),
    channel,
    note: text(raw.note),
  };
}

export function normalizePaymentChannelRecords(list) {
  const byCustomer = new Map();
  for (const raw of Array.isArray(list) ? list : []) {
    const record = normalizePaymentChannelRecord(raw);
    if (record) byCustomer.set(record.customerId, record);
  }
  return [...byCustomer.values()];
}

export function findPaymentChannel(list, customerId) {
  const id = text(customerId);
  if (!id || !Array.isArray(list)) return null;
  for (const raw of list) {
    const record = normalizePaymentChannelRecord(raw);
    if (record && record.customerId === id) return record.channel;
  }
  return null;
}

export function findPaymentChannelRecord(list, customerId) {
  const id = text(customerId);
  if (!id || !Array.isArray(list)) return null;
  for (const raw of list) {
    const record = normalizePaymentChannelRecord(raw);
    if (record && record.customerId === id) return record;
  }
  return null;
}

// Insert or replace one customer's channel. Returns a NEW array;
// an invalid row leaves the list unchanged (as a copy).
export function upsertPaymentChannel(list, raw) {
  const current = normalizePaymentChannelRecords(list);
  const record = normalizePaymentChannelRecord(raw);
  if (!record) return current;
  const index = current.findIndex((r) => r.customerId === record.customerId);
  if (index >= 0) current[index] = record;
  else current.push(record);
  return current;
}

export function removePaymentChannel(list, customerId) {
  const id = text(customerId);
  return normalizePaymentChannelRecords(list).filter((r) => r.customerId !== id);
}

// The instruction line for one channel, in one variant. The wallet
// line names the route and asks for a reference note; it carries
// no account number, because none is recorded.
export function paymentChannelInstructions(channel, variant = PAYMENT_CHANNEL_VARIANTS.ROMAN) {
  const resolved = normalizePaymentChannel(channel);
  const useVariant = normalizePaymentChannelVariant(variant);
  if (useVariant === PAYMENT_CHANNEL_VARIANTS.URDU) {
    if (resolved === PAYMENT_CHANNELS.CASH) {
      return { channel: PAYMENT_CHANNELS.CASH, variant: useVariant, text: 'ادائیگی کا طریقہ: نقد — کلیکٹر سے ادائیگی کریں، وہ رسید دیں گے۔' };
    }
    if (resolved === PAYMENT_CHANNELS.WALLET) {
      return { channel: PAYMENT_CHANNELS.WALLET, variant: useVariant, text: 'ادائیگی کا طریقہ: ایزی پیسہ/والیٹ — ادائیگی کریں اور اپنا نام بطور ریفرنس نوٹ کریں۔' };
    }
    return { channel: null, variant: useVariant, text: 'ادائیگی کا طریقہ: نقد کلیکٹر کے ذریعے یا ایزی پیسہ/والیٹ سے ادائیگی کی جا سکتی ہے۔' };
  }
  if (resolved === PAYMENT_CHANNELS.CASH) {
    return { channel: PAYMENT_CHANNELS.CASH, variant: useVariant, text: 'Payment method: Cash — pay the collector, who will give you a receipt.' };
  }
  if (resolved === PAYMENT_CHANNELS.WALLET) {
    return { channel: PAYMENT_CHANNELS.WALLET, variant: useVariant, text: 'Payment method: Easypaisa/wallet — please pay by wallet and note your name as the payment reference.' };
  }
  return { channel: null, variant: useVariant, text: 'Payment method: you can pay in cash through the collector or by Easypaisa/wallet.' };
}

// Append the matching instruction line to one customer's draft
// text. The original draft text is never rewritten — the line is
// added at the end, and a blank draft becomes just the instruction
// line. A customer with no recorded channel gets the neutral
// default line, never a guessed channel.
export function withPaymentInstructions(draftText, channel, variant = PAYMENT_CHANNEL_VARIANTS.ROMAN) {
  const base = text(draftText);
  const line = paymentChannelInstructions(channel, variant).text;
  if (!base) return line;
  return `${base}\n${line}`;
}

// Tailor one per-customer draft object ({ text, variant }) for
// one customer: look the channel up in the caller's list and
// append its instruction line. Returns a NEW object; the input
// draft is never mutated. A draft without text still gets the
// instruction line, so the operator never sends a draft that
// tells the customer nothing about how to pay.
export function tailorDraftWithPaymentChannel(draft, list, customerId) {
  const channel = findPaymentChannel(list, customerId);
  const variant = normalizePaymentChannelVariant(draft?.variant);
  const base = text(draft?.text);
  return {
    ...(draft && typeof draft === 'object' && !Array.isArray(draft) ? draft : {}),
    variant,
    channel,
    text: withPaymentInstructions(base, channel, variant),
  };
}

export function paymentChannelSummaryText(list) {
  const records = normalizePaymentChannelRecords(list);
  if (records.length === 0) return 'No preferred payment channel recorded yet.';
  const cash = records.filter((r) => r.channel === PAYMENT_CHANNELS.CASH).length;
  const wallet = records.length - cash;
  return `${records.length} customer${records.length === 1 ? '' : 's'} with a recorded channel: ${cash} cash via collector, ${wallet} Easypaisa/wallet.`;
}

export function paymentChannelHtml(record) {
  if (!record) return '<p class="empty-state">No preferred payment channel recorded for this customer.</p>';
  const label = record.channel === PAYMENT_CHANNELS.CASH
    ? 'Cash via collector'
    : 'Easypaisa/wallet';
  return `<p>Preferred payment channel: <strong>${escapeHtml(label)}</strong>${record.note ? ` — ${escapeHtml(record.note)}` : ''}</p>`;
}

export function paymentChannelCsv(list) {
  const lines = ['Customer, Customer name, Preferred channel, Note'];
  for (const record of normalizePaymentChannelRecords(list)) {
    lines.push([
      csvCell(record.customerId),
      csvCell(record.customerName),
      csvCell(record.channel),
      csvCell(record.note),
    ].join(','));
  }
  return lines.join('\n');
}

export function paymentChannelFilename() {
  return 'payment-channels.csv';
}
