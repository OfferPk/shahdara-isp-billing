// Recently viewed customers (Plan 354): one on-device list of the
// profiles the operator just opened, latest first, with name, mohalla,
// and dues — so the operator returns to the customer just seen with
// one tap instead of searching again during a busy round.
//
// The list itself already exists: the fast search sheet keeps an
// on-device recents cache, deduplicated, newest first, capped at
// twelve, and cleared by the operator. This module is the missing
// piece, not a second list: it shares that same store key, adds
// recording on every profile opening (the sheet only records picks
// made inside the sheet), and carries the mohalla and the dues on
// each entry, which the cache never stored. The stored shape of the
// cache is still accepted, so entries written by the sheet keep
// working: a missing mohalla falls back to the live customer record,
// and a missing dues figure reads as not recorded.
//
// The list records viewing only. It never changes any customer, bill,
// or payment record, and it never sends anything. Inputs are never
// mutated, and the module never reads storage, the clock, the network,
// or the page.

export const RECENTLY_VIEWED_STORE_KEY = 'shahdara_recent_customers_v1';
export const RECENTLY_VIEWED_MAX = 12;

function cleanRecentlyViewedText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function foldRecentlyViewedMohalla(entry) {
  if (!entry || typeof entry !== 'object') return 'Unassigned';
  const mohalla = cleanRecentlyViewedText(entry.mohalla);
  if (mohalla) return mohalla;
  const area = cleanRecentlyViewedText(entry.area);
  if (area) return area;
  return 'Unassigned';
}

function foldRecentlyViewedDuesCents(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return Math.round(value);
}

function formatRecentlyViewedPkr(duesCents) {
  return Number(duesCents / 100).toLocaleString('en-PK');
}

function escapeRecentlyViewedHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function csvRecentlyViewedCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function normalizeRecentlyViewed(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanRecentlyViewedText(raw.id);
  if (!id) return null;
  return {
    id,
    name: cleanRecentlyViewedText(raw.name),
    mohalla: foldRecentlyViewedMohalla(raw),
    duesCents: foldRecentlyViewedDuesCents(raw.duesCents),
    viewedAt: typeof raw.viewedAt === 'string' ? raw.viewedAt : '',
  };
}

export function normalizeRecentlyViewedList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const entry = normalizeRecentlyViewed(raw);
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    out.push(entry);
    if (out.length >= RECENTLY_VIEWED_MAX) break;
  }
  return out;
}

export function recentlyViewedEntry(customer, duesCents, viewedAt) {
  if (!customer || typeof customer !== 'object') return null;
  return normalizeRecentlyViewed({
    id: customer.id,
    name: customer.name,
    mohalla: customer.mohalla,
    area: customer.area,
    duesCents,
    viewedAt,
  });
}

export function recordRecentlyViewed(list, entry) {
  const normalized = normalizeRecentlyViewedList(list);
  const fresh = normalizeRecentlyViewed(entry);
  if (!fresh) return normalized;
  return normalizeRecentlyViewedList([fresh, ...normalized]);
}

export function recentlyViewedRows(list, customers, duesById) {
  const normalized = normalizeRecentlyViewedList(list);
  if (!Array.isArray(customers)) return [];
  const live = new Map();
  for (const customer of customers) {
    if (customer && typeof customer === 'object' && customer.id && !customer.archived) {
      live.set(String(customer.id), customer);
    }
  }
  const dues = duesById && typeof duesById === 'object' ? duesById : {};
  const rows = [];
  for (const entry of normalized) {
    const current = live.get(entry.id);
    if (!current) continue;
    const liveDues = foldRecentlyViewedDuesCents(dues[entry.id]);
    rows.push({
      id: entry.id,
      name: cleanRecentlyViewedText(current.name) || entry.name,
      mohalla: foldRecentlyViewedMohalla(current),
      duesCents: liveDues !== null ? liveDues : entry.duesCents,
      viewedAt: entry.viewedAt,
    });
  }
  return rows;
}

export function recentlyViewedDuesText(row) {
  if (!row || typeof row !== 'object') return 'Dues not recorded';
  if (row.duesCents === null || row.duesCents === undefined) return 'Dues not recorded';
  if (row.duesCents > 0) return `PKR ${formatRecentlyViewedPkr(row.duesCents)} due`;
  return 'No amount due';
}

export function recentlyViewedRowText(row) {
  if (!row || typeof row !== 'object') return '';
  const name = cleanRecentlyViewedText(row.name) || 'Unnamed customer';
  const mohalla = cleanRecentlyViewedText(row.mohalla) || 'Unassigned';
  return `${name} — ${mohalla} — ${recentlyViewedDuesText(row)}`;
}

export function recentlyViewedSummaryText(rows) {
  const list = Array.isArray(rows) ? rows : [];
  if (list.length === 0) return 'No recently viewed customers yet.';
  if (list.length === 1) return '1 recently viewed customer.';
  return `${list.length} recently viewed customers.`;
}

export function recentlyViewedHtml(rows) {
  const list = Array.isArray(rows) ? rows : [];
  if (list.length === 0) return '<p>No recently viewed customers yet.</p>';
  const items = list.map(row => `<li><button type="button" class="rvc-row" data-rvc-customer-id="${escapeRecentlyViewedHtml(row.id)}"><span class="rvc-name">${escapeRecentlyViewedHtml(row.name)}</span><span class="rvc-mohalla">${escapeRecentlyViewedHtml(row.mohalla)}</span><span class="rvc-dues">${escapeRecentlyViewedHtml(recentlyViewedDuesText(row))}</span></button></li>`).join('');
  return `<ul class="rvc-list">${items}</ul>`;
}

export function recentlyViewedCsv(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const lines = ['id,name,mohalla,dues_pkr'];
  for (const row of list) {
    const dues = row.duesCents === null || row.duesCents === undefined ? '' : String(row.duesCents / 100);
    lines.push([row.id, row.name, row.mohalla, dues].map(csvRecentlyViewedCell).join(','));
  }
  return lines.join('\n');
}

export function recentlyViewedFilename() {
  return 'recently-viewed-customers.csv';
}
