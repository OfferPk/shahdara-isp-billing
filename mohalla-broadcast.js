// Plan 14 (Plan 1-100) — Mohalla broadcast announcements (drafts, not auto-send).
//
// A maintenance window, a price change, or a planned outage is too often
// announced by word of mouth, so some mohallas hear it and others do not.
// This module prepares ONE draft announcement addressed to exactly the
// mohallas the operator selected — one, several, or all — from editable
// bilingual templates, plus a sent log that records, per mohalla, when
// the operator sent it through the existing WhatsApp route.
//
// What this module NEVER does, stated plainly:
//   - it never sends anything by itself, in bulk or otherwise. The
//     operator taps Send for a mohalla, the existing WhatsApp route
//     opens with the draft prefilled (wa.me/?text=…, the app's own
//     no-single-recipient fallback), the operator picks the recipients
//     in WhatsApp, and only then is the send logged;
//   - it never changes a customer, billing, or payment record. The
//     sent log lives apart from every ledger record by construction —
//     appending to it touches none of them;
//   - it never invents an addressee. A draft addresses exactly the
//     mohallas resolved from the operator's selection on the same
//     fixture: "MOHALLA BANI", "Bani" and "BANII" are one mohalla
//     (the Plan T canonical rule, mirrored here so this module stays
//     import-free), duplicates collapse to one entry, blank entries
//     are skipped and counted, and a customer with no mohalla is
//     never silently assigned to a named mohalla.
//
// Addressing rule (mirrors phase3.js canonicalMohalla):
//   - the leading generic "Mohalla"/"Mohalaa" word is not part of a
//     mohalla's identity and is stripped before comparing;
//   - comparison is case-insensitive after NFKC normalisation;
//   - known spellings collapse: bani -> BANII, kishti -> KISHTII,
//     chamyaa -> CHAMYAAA, and every name in DEFAULT_MOHALLAS
//     resolves to its stored spelling;
//   - an unknown name keeps its own key and readable label, so it is
//     addressed as written, never dropped.
//
// The module is import-free by design (like pre-due-reminders.js,
// escalation-ladder.js and payment-confirmation.js): the caller
// supplies every customer, every selection, and every timestamp, and
// the module never reads storage, the clock, or the network. Every
// timestamp in the sent log is caller-supplied, so a logged send
// always carries a real send time.

const DEFAULT_MOHALLAS = Object.freeze([
  'CHARYAA', 'GANGALL', 'KISHTII', 'BARRIAN', 'THALII', 'CHAMYAAA',
  'PALALIYAA', 'MALLA', 'NAKAR', 'BANII', 'SODAA', 'PULL SIDE',
  'JABBIYAA', 'MOHALLA CHUDRIYAA', 'MOHALLA end side farm house',
]);

const MOHALLA_ALIASES = Object.freeze({
  bani: 'BANII',
  kishti: 'KISHTII',
  chamyaa: 'CHAMYAAA',
});

export const BROADCAST_TEMPLATE_KINDS = Object.freeze({
  MAINTENANCE: 'maintenance',
  OUTAGE: 'outage',
  PRICE_CHANGE: 'price_change',
  GENERAL: 'general',
});

export const BROADCAST_DRAFT_VARIANTS = Object.freeze({
  ROMAN: 'roman',
  URDU: 'urdu',
});

export const BROADCAST_ALL_MOHALLAS = 'all';

// Every template carries a {{mohallas}} placeholder, replaced with the
// addressed mohallas when the draft is built. A template without the
// placeholder still gets a mohalla line appended, so addressing is
// never lost to an edited template.
export const DEFAULT_BROADCAST_TEMPLATES = Object.freeze({
  maintenance: Object.freeze({
    roman: 'Assalam-o-Alaikum, Shahdara Fiber Net ki taraf se ittila: maintenance ka kaam {{mohallas}} mein hoga, is doran service mein khalal aa sakta hai.',
    urdu: 'السلام علیکم، شاہدرہ فائبر نیٹ کی طرف سے اطلاع: مینٹیننس کا کام {{mohallas}} میں ہوگا، اس دوران سروس میں خلل آ سکتا ہے۔',
  }),
  outage: Object.freeze({
    roman: 'Assalam-o-Alaikum, Shahdara Fiber Net ki taraf se ittila: planned outage {{mohallas}} mein hogi, is doran internet band reh sakta hai.',
    urdu: 'السلام علیکم، شاہدرہ فائبر نیٹ کی طرف سے اطلاع: پلانڈ آؤٹیج {{mohallas}} میں ہوگی، اس دوران انٹرنیٹ بند رہ سکتا ہے۔',
  }),
  price_change: Object.freeze({
    roman: 'Assalam-o-Alaikum, Shahdara Fiber Net ki taraf se ittila: package price mein tabdeeli {{mohallas}} ke customers par laagu hogi.',
    urdu: 'السلام علیکم، شاہدرہ فائبر نیٹ کی طرف سے اطلاع: پیکیج قیمت میں تبدیلی {{mohallas}} کے صارفین پر لاگو ہوگی۔',
  }),
  general: Object.freeze({
    roman: 'Assalam-o-Alaikum, Shahdara Fiber Net ki taraf se ittila {{mohallas}} ke customers ke liye hai.',
    urdu: 'السلام علیکم، شاہدرہ فائبر نیٹ کی طرف سے اطلاع {{mohallas}} کے صارفین کے لیے ہے۔',
  }),
});

function normalizedText(value) {
  return String(value ?? '').normalize('NFKC').replace(/\s+/gu, ' ').trim();
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function comparisonKey(value) {
  return normalizedText(value).toLowerCase().normalize('NFKC');
}

function stripMohallaPrefix(value) {
  const stripped = normalizedText(value).replace(/^(?:mohalla|mohalaa)\s+/iu, '');
  return stripped || normalizedText(value);
}

function readableLabel(value) {
  const readableWord = (word) => {
    const letters = word.match(/\p{L}/gu) ?? [];
    if (letters.length >= 2 && letters.length <= 3 && letters.every((letter) => letter === letter.toLocaleUpperCase('en-US'))) return word;
    const chars = Array.from(word);
    if (!chars.length) return word;
    return chars[0].toLocaleUpperCase('en-US') + chars.slice(1).join('').toLocaleLowerCase('en-US');
  };
  return normalizedText(value).split(' ').map((word) => word.split(/([-–—/])/u).map((part) => /^[-–—/]$/u.test(part) ? part : readableWord(part)).join('')).join(' ');
}

// Mirrors phase3.js canonicalMohalla without importing the app graph.
// Returns { key, label, stored } or null when blank.
export function canonicalBroadcastMohalla(value) {
  const raw = normalizedText(value);
  if (!raw) return null;
  const stripped = stripMohallaPrefix(raw);
  const key = comparisonKey(stripped);
  const canonical = DEFAULT_MOHALLAS.find((name) => comparisonKey(stripMohallaPrefix(name)) === key) ?? MOHALLA_ALIASES[key];
  if (canonical) return { key: comparisonKey(stripMohallaPrefix(canonical)), label: readableLabel(canonical), stored: canonical };
  return { key, label: readableLabel(stripped), stored: raw };
}

// Resolve an operator selection to exactly the addressed mohallas.
//   selection: array of raw mohalla strings, or ['all'] / 'all'.
//   allMohallas: caller-supplied universe for 'all' (defaults to the
//     standard list); unknown entries in it are resolved the same way.
// Duplicates collapse by canonical key (first spelling wins), blanks
// are skipped and counted, never addressed. Input is never mutated.
export function resolveBroadcastMohallas(selection, { allMohallas } = {}) {
  const counts = { selected: 0, resolved: 0, skippedBlank: 0, collapsedDuplicates: 0 };
  const seen = new Map();
  const push = (raw) => {
    const canon = canonicalBroadcastMohalla(raw);
    if (!canon) { counts.skippedBlank += 1; return; }
    if (seen.has(canon.key)) { counts.collapsedDuplicates += 1; return; }
    seen.set(canon.key, canon);
  };
  if (typeof selection === 'string') {
    if (comparisonKey(selection) === BROADCAST_ALL_MOHALLAS) {
      const universe = Array.isArray(allMohallas) && allMohallas.length > 0 ? allMohallas : [...DEFAULT_MOHALLAS];
      for (const raw of universe) push(raw);
    } else {
      counts.selected = 1;
      push(selection);
    }
  } else if (Array.isArray(selection)) {
    counts.selected = selection.length;
    if (selection.some((entry) => comparisonKey(entry) === BROADCAST_ALL_MOHALLAS)) {
      const universe = Array.isArray(allMohallas) && allMohallas.length > 0 ? allMohallas : [...DEFAULT_MOHALLAS];
      for (const raw of universe) push(raw);
    } else {
      for (const raw of selection) push(raw);
    }
  }
  const mohallas = [...seen.values()];
  counts.resolved = mohallas.length;
  return { mohallas, counts };
}

// The mohalla options a panel offers: every canonical mohalla found
// among the caller's customers, in first-seen order, followed by any
// standard mohalla with no customer yet — so an empty roster still
// offers the standard list, and a new mohalla is never hidden.
export function buildBroadcastMohallaOptions({ customers } = {}) {
  const seen = new Map();
  for (const customer of Array.isArray(customers) ? customers : []) {
    if (!customer || typeof customer !== 'object') continue;
    const canon = canonicalBroadcastMohalla(customer.mohalla ?? customer.area ?? '');
    if (canon && !seen.has(canon.key)) seen.set(canon.key, canon);
  }
  for (const raw of DEFAULT_MOHALLAS) {
    const canon = canonicalBroadcastMohalla(raw);
    if (canon && !seen.has(canon.key)) seen.set(canon.key, canon);
  }
  return [...seen.values()];
}

// Count, per addressed mohalla, how many of the caller's customers
// live there — canonical key match only. A customer with no mohalla
// is counted as unaddressed, never assigned to a named mohalla.
// Archived customers are counted separately, never silently dropped
// from the counts object.
export function buildBroadcastAudience({ customers, mohallas } = {}) {
  const addressed = new Map((Array.isArray(mohallas) ? mohallas : []).map((m) => [m.key, { ...m, customerCount: 0, archivedCount: 0 }]));
  let unaddressed = 0;
  let totalCustomers = 0;
  for (const customer of Array.isArray(customers) ? customers : []) {
    if (!customer || typeof customer !== 'object') continue;
    totalCustomers += 1;
    const canon = canonicalBroadcastMohalla(customer.mohalla ?? customer.area ?? '');
    const row = canon ? addressed.get(canon.key) : undefined;
    if (!row) { unaddressed += 1; continue; }
    if (customer.archived === true) row.archivedCount += 1;
    else row.customerCount += 1;
  }
  return {
    mohallas: [...addressed.values()],
    totalCustomers,
    addressedCustomers: [...addressed.values()].reduce((sum, row) => sum + row.customerCount, 0),
    unaddressedCustomers: unaddressed,
  };
}

// Editable templates: caller-supplied text wins per kind/variant, but
// a blank or non-string edit falls back to the default, so a draft
// can never come out empty from an edited template. Unknown kinds
// are ignored; the returned object is a fresh copy, never the input.
export function normalizeBroadcastTemplates(custom = {}) {
  const out = {};
  for (const kind of Object.keys(DEFAULT_BROADCAST_TEMPLATES)) {
    const customKind = custom && typeof custom === 'object' && !Array.isArray(custom) ? custom[kind] : undefined;
    out[kind] = {
      roman: text(customKind?.roman) || DEFAULT_BROADCAST_TEMPLATES[kind].roman,
      urdu: text(customKind?.urdu) || DEFAULT_BROADCAST_TEMPLATES[kind].urdu,
    };
  }
  return out;
}

function normalizeBroadcastKind(kind) {
  const key = comparisonKey(kind);
  return Object.values(BROADCAST_TEMPLATE_KINDS).includes(key) ? key : BROADCAST_TEMPLATE_KINDS.GENERAL;
}

function normalizeBroadcastVariant(variant) {
  return variant === BROADCAST_DRAFT_VARIANTS.URDU ? BROADCAST_DRAFT_VARIANTS.URDU : BROADCAST_DRAFT_VARIANTS.ROMAN;
}

function formatMohallaList(mohallas, variant) {
  const labels = mohallas.map((m) => m.label);
  if (labels.length === 0) return '';
  if (labels.length === 1) return labels[0];
  if (variant === BROADCAST_DRAFT_VARIANTS.URDU) return `${labels.slice(0, -1).join('، ')} اور ${labels[labels.length - 1]}`;
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

// One draft for one announcement, or null when nothing is addressed:
// no selection, only blanks, or an empty universe for 'all'. The
// draft text is the (possibly edited) template with {{mohallas}}
// replaced by the addressed mohallas; when the template has no
// placeholder, the mohalla line is appended so addressing is never
// lost. A caller-supplied detail is appended verbatim as its own
// sentence — never invented when absent. The input selection and
// templates are never mutated.
export function buildBroadcastDraft({ kind, variant, templates, detail, selection, allMohallas, customers } = {}) {
  const resolved = resolveBroadcastMohallas(selection, { allMohallas });
  if (resolved.mohallas.length === 0) return null;
  const resolvedKind = normalizeBroadcastKind(kind);
  const resolvedVariant = normalizeBroadcastVariant(variant);
  const merged = normalizeBroadcastTemplates(templates);
  const template = merged[resolvedKind][resolvedVariant];
  const mohallaText = formatMohallaList(resolved.mohallas, resolvedVariant);
  let draftText = template.includes('{{mohallas}}')
    ? template.replace(/\{\{mohallas\}\}/g, mohallaText)
    : `${template} (${mohallaText}).`;
  const detailText = text(detail);
  if (detailText) draftText = `${draftText} ${detailText}`;
  const footer = resolvedVariant === BROADCAST_DRAFT_VARIANTS.URDU
    ? 'شکریہ — شاہدرہ فائبر نیٹ۔'
    : 'Shukriya — Shahdara Fiber Net.';
  if (!draftText.includes('Shahdara Fiber Net') && !draftText.includes('شاہدرہ فائبر نیٹ')) draftText = `${draftText} ${footer}`;
  const audience = buildBroadcastAudience({ customers, mohallas: resolved.mohallas });
  return {
    kind: resolvedKind,
    variant: resolvedVariant,
    mohallas: resolved.mohallas,
    mohallaLabels: resolved.mohallas.map((m) => m.label),
    mohallaKeys: resolved.mohallas.map((m) => m.key),
    text: draftText,
    detail: detailText,
    counts: resolved.counts,
    audience,
  };
}

// The WhatsApp route for a broadcast: a mohalla has no single phone
// number, so the draft opens with no recipient (wa.me/?text=…, the
// app's own no-recipient fallback) and the operator picks the
// recipients in WhatsApp. The URL is built here so app.js never
// embeds a wa.me literal in a window.open call.
export function broadcastWhatsAppUrl(draftText) {
  const textValue = text(draftText);
  return textValue
    ? `https://wa.me/?text=${encodeURIComponent(textValue)}`
    : 'https://wa.me/';
}

// Sent log: a plain array of one entry PER MOHALLA covered —
// { mohallaKey, mohallaLabel, sentAt, channel, kind }. It lives apart
// from customer, billing, and payment records by construction.
// Returns a NEW array; an entry set without mohallas or without a
// send time is not recorded. Duplicates in one call collapse by key.
export function logBroadcastSent(log, { mohallas, sentAt, channel, kind } = {}) {
  const list = Array.isArray(log) ? [...log] : [];
  const time = text(sentAt);
  const resolved = resolveBroadcastMohallas(mohallas);
  if (!time || resolved.mohallas.length === 0) return list;
  const resolvedKind = kind ? normalizeBroadcastKind(kind) : null;
  for (const mohalla of resolved.mohallas) {
    list.push({
      mohallaKey: mohalla.key,
      mohallaLabel: mohalla.label,
      sentAt: time,
      channel: text(channel) || 'whatsapp',
      ...(resolvedKind ? { kind: resolvedKind } : {}),
    });
  }
  return list;
}

// Latest send time for one mohalla (canonical key match), or null.
export function broadcastSentAt(log, mohalla) {
  const canon = canonicalBroadcastMohalla(mohalla);
  if (!canon || !Array.isArray(log)) return null;
  let found = null;
  for (const entry of log) {
    if (text(entry?.mohallaKey) === canon.key && text(entry?.sentAt)) found = entry.sentAt;
  }
  return found;
}

// Coverage over exactly the addressed mohallas: which were covered,
// when each was last covered, and how many remain uncovered.
export function broadcastCoverage(log, mohallas) {
  const rows = (Array.isArray(mohallas) ? mohallas : []).map((m) => {
    const canon = canonicalBroadcastMohalla(m?.key ?? m?.label ?? m);
    return {
      key: canon?.key ?? '',
      label: canon?.label ?? '',
      sentAt: canon ? broadcastSentAt(log, canon.key) : null,
    };
  });
  const covered = rows.filter((row) => row.sentAt).length;
  return { rows, covered, uncovered: rows.length - covered, total: rows.length };
}

export function broadcastSummaryText(draft) {
  if (!draft || !Array.isArray(draft.mohallas)) return 'Broadcast draft unavailable.';
  if (draft.mohallas.length === 0) return 'No mohalla selected — no draft prepared.';
  const audience = draft.audience?.addressedCustomers;
  const audienceNote = typeof audience === 'number' ? `, ${audience} customer${audience === 1 ? '' : 's'} addressed` : '';
  return `Broadcast draft ready for ${draft.mohallas.length} mohalla${draft.mohallas.length === 1 ? '' : 's'} (${draft.mohallaLabels.join(', ')})${audienceNote}. Nothing sent yet.`;
}

export function broadcastFilename(today) {
  const day = typeof today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(today) ? today : 'unknown-date';
  return `mohalla-broadcasts-${day}.csv`;
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

function formatSentAt(sentAt) {
  const value = text(sentAt);
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return `${value.slice(0, 10)} ${value.slice(11, 16)} UTC`;
  return value;
}

export function broadcastHtml(draft, sentLog = []) {
  if (!draft || !Array.isArray(draft.mohallas)) return '<p class="empty-state">Broadcast draft unavailable.</p>';
  if (draft.mohallas.length === 0) return '<p class="empty-state">No mohalla selected — pick at least one mohalla to prepare a draft.</p>';
  const coverage = broadcastCoverage(sentLog, draft.mohallas);
  const rows = coverage.rows.map((row) => {
    const audienceRow = draft.audience?.mohallas?.find((m) => m.key === row.key);
    const countNote = audienceRow ? ` (${audienceRow.customerCount} customer${audienceRow.customerCount === 1 ? '' : 's'})` : '';
    return `<tr><td><strong>${escapeHtml(row.label)}</strong>${countNote}</td><td>${row.sentAt ? `<small>Sent ${escapeHtml(formatSentAt(row.sentAt))}</small>` : '<small>Not sent</small>'}<br><button class="secondary-button btn-sm mohalla-broadcast-send-btn" type="button" data-mohalla-key="${escapeHtml(row.key)}">📲 Send via WhatsApp</button></td></tr>`;
  }).join('');
  return `<p><small>${escapeHtml(draft.text)}</small></p><table class="mohalla-broadcast-table"><thead><tr><th>Mohalla addressed</th><th>Send</th></tr></thead><tbody>${rows}</tbody></table>`;
}

export function broadcastCsv(draft, sentLog = []) {
  const lines = ['Mohalla, Customers addressed, Sent at, Channel, Kind'];
  const coverage = broadcastCoverage(sentLog, draft?.mohallas ?? []);
  for (const row of coverage.rows) {
    const audienceRow = draft?.audience?.mohallas?.find((m) => m.key === row.key);
    const sentEntry = Array.isArray(sentLog)
      ? [...sentLog].reverse().find((e) => text(e?.mohallaKey) === row.key)
      : undefined;
    lines.push([
      csvCell(row.label),
      audienceRow ? audienceRow.customerCount : '',
      csvCell(sentEntry?.sentAt ?? ''),
      csvCell(sentEntry?.channel ?? ''),
      csvCell(draft?.kind ?? ''),
    ].join(','));
  }
  return lines.join('\n');
}
