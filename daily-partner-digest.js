/**
 * daily-partner-digest.js — SISP-75 [P2]: 1-Click Daily Partner
 * WhatsApp Digest ("آج کا مکمل خلاصہ برائے ناصر و عاقب").
 *
 * The partners (Nasir + Aqib) get one deterministic Roman Urdu summary
 * of today, built for pasting into WhatsApp:
 *
 *   📊 Shahdara Fiber Net — Rozana Partner Digest (29 Oct 2026)
 *   💵 Aaj ki direct cash collection: PKR 5,000
 *   🏪 Waseem Abbasi Shop: unsettled cash PKR 2,000
 *   🧾 Aaj ka roznamcha kharcha (petty cash): PKR 800
 *   🗄️ Drawer closing balance: PKR 14,200
 *   ⚠️ Baqi defaulters: 1 (kul PKR 6,000)
 *   🛠️ Aaj ki complaints: 2 lagi, 1 hal hui
 *
 * Every figure comes from an EXISTING module's own derivation — this
 * module invents no second source of truth:
 *   - Direct cash  = roznamcha.js collectDirectCashPayments (method
 *     exactly 'Cash', dated today, voided excluded by that collector).
 *   - Shop cash    = shop-settlement.js collectShopPayments grouped
 *     per shop (voided receipts already dropped there); shops that
 *     only appear in SISP-1 settlement records are listed too, with
 *     their unsettled total. Shop names are NEVER hardcoded — they
 *     come from the actual payment methods / settlement records.
 *   - Roznamcha    = roznamcha.js buildRoznamchaDay for today: petty
 *     cash out (outTotal) and the closing drawer balance (the frozen
 *     closingBalance on a closed day, the live expectedClosing on an
 *     open day).
 *   - Defaulters   = core.js calculatePaymentAllocations balances over
 *     all bills, summed per customer (voided payments are excluded by
 *     the engine itself). Archived customers and FREE connections are
 *     skipped — the same owner rule the Top Defaulters list applies.
 *   - Complaints   = the SISP-15 register records passed in: logged =
 *     reportedAt dated today, resolved = status 'Resolved' with
 *     resolvedAt dated today.
 *
 * The builder is PURE: buildDailyPartnerDigest(state, date, sources)
 * reads only its arguments (the side ledgers — shop settlements,
 * roznamcha days, complaint register — travel in `sources` exactly the
 * way app.js already loads them for the other dashboard cards), does
 * no I/O, never reads the clock when `date` is a 'YYYY-MM-DD' string,
 * and returns the same string for the same inputs, so tests pin the
 * full text. It writes nothing and adds no storage keys.
 *
 * The digest TEXT is Roman Urdu by spec — it is generated message
 * content (like the SISP-1 shop receipt text), not UI chrome; the
 * dashboard card's labels go through nav-language t() as usual.
 *
 * Tests use synthetic data only.
 */

import { calculatePaymentAllocations, formatPKR } from './core.js';
import { collectShopPayments } from './shop-settlement.js';
import { buildRoznamchaDay, collectDirectCashPayments, pakistanToday } from './roznamcha.js';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function moneyValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Normalize the `date` argument to a 'YYYY-MM-DD' PKT day key. A Date
 * is converted in Pakistan time (roznamcha's pakistanToday); anything
 * unusable falls back to today so the dashboard button never breaks.
 */
export function partnerDigestDateKey(date) {
  if (typeof date === 'string' && DAY_RE.test(date)) return date;
  if (date instanceof Date && !Number.isNaN(date.getTime())) return pakistanToday(date);
  return pakistanToday(new Date());
}

/** '2026-10-29' -> '29 Oct 2026' (fixed English month names, no locale drift). */
export function formatDigestDate(dateKey) {
  if (typeof dateKey !== 'string' || !DAY_RE.test(dateKey)) return '';
  const [year, month, day] = dateKey.split('-').map(Number);
  const name = MONTH_NAMES[month - 1];
  if (!name) return '';
  return `${day} ${name} ${year}`;
}

/**
 * The digest figures, before text formatting. Pure — see header.
 *
 * @param {object} state - the app ledger state ({ customers: [...] }).
 * @param {string|Date} date - the digest day ('YYYY-MM-DD' preferred).
 * @param {object} [sources] - side ledgers as loaded by app.js:
 *   { settlements = [], roznamchaDays = [], complaints = [] }.
 */
export function summarizePartnerDigest(state, date, sources = {}) {
  const dateKey = partnerDigestDateKey(date);
  const safeState = state && typeof state === 'object' ? state : {};
  const settlements = Array.isArray(sources?.settlements) ? sources.settlements : [];
  const roznamchaDays = Array.isArray(sources?.roznamchaDays) ? sources.roznamchaDays : [];
  const complaints = Array.isArray(sources?.complaints) ? sources.complaints : [];

  // 1. Today's direct cash (drawer cash: method exactly 'Cash').
  const cashPayments = collectDirectCashPayments(safeState, dateKey);
  const directCash = round2(cashPayments.reduce((sum, p) => sum + moneyValue(p.amount), 0));

  // 2. Per-shop unsettled cash, from the actual shop records. A shop
  // known only from a settlement record still gets its line (PKR 0
  // unsettled once everything was handed over).
  const byShop = new Map();
  const ensureShop = (shop) => {
    if (!byShop.has(shop)) byShop.set(shop, { shop, unsettled: 0, unsettledReceiptCount: 0 });
    return byShop.get(shop);
  };
  for (const payment of collectShopPayments(safeState)) {
    const row = ensureShop(payment.shop);
    row.unsettled = round2(row.unsettled + moneyValue(payment.remaining));
    if (payment.remaining > 0) row.unsettledReceiptCount += 1;
  }
  for (const record of settlements) {
    if (record && typeof record === 'object' && typeof record.shop === 'string' && record.shop) {
      ensureShop(record.shop);
    }
  }
  const shops = [...byShop.values()].sort((a, b) =>
    (b.unsettled - a.unsettled) || a.shop.localeCompare(b.shop));

  // 3. Roznamcha: today's petty-cash out and the closing drawer
  // balance, from the module's own day view (a closed day reports its
  // frozen counted closing; an open day its live expected closing).
  const day = buildRoznamchaDay(safeState, roznamchaDays, dateKey, settlements);
  const pettyCashOut = round2(moneyValue(day.outTotal));
  const drawerBalance = round2(moneyValue(day.closed ? day.closingBalance : day.expectedClosing));

  // 4. Remaining unpaid defaulters: allocation-engine balances summed
  // per customer. Archived and FREE connections never owe (owner rule,
  // same as dashboard-top-defaulters.js).
  const customers = Array.isArray(safeState.customers) ? safeState.customers : [];
  const allocations = calculatePaymentAllocations({ customers });
  let defaultersCount = 0;
  let defaultersTotalCents = 0;
  for (const customer of customers) {
    if (!customer || typeof customer !== 'object') continue;
    if (customer.archived) continue;
    if (customer.isFreeConnection) continue;
    let dueCents = 0;
    for (const bill of (Array.isArray(customer.bills) ? customer.bills : [])) {
      if (!bill || typeof bill !== 'object' || typeof bill.month !== 'string') continue;
      const summary = allocations.forMonth(customer.id, bill.month);
      if (summary && Number.isFinite(summary.balanceDueCents)) dueCents += summary.balanceDueCents;
    }
    if (dueCents > 0) {
      defaultersCount += 1;
      defaultersTotalCents += dueCents;
    }
  }

  // 5. Today's complaints: logged vs resolved in the SISP-15 register.
  let complaintsLogged = 0;
  let complaintsResolved = 0;
  for (const complaint of complaints) {
    if (!complaint || typeof complaint !== 'object') continue;
    if (String(complaint.reportedAt || '').slice(0, 10) === dateKey) {
      complaintsLogged += 1;
    }
    if (complaint.status === 'Resolved' && String(complaint.resolvedAt || '').slice(0, 10) === dateKey) {
      complaintsResolved += 1;
    }
  }

  return {
    date: dateKey,
    directCash,
    directCashCount: cashPayments.length,
    shops,
    pettyCashOut,
    drawerBalance,
    drawerClosed: day.closed === true,
    defaultersCount,
    defaultersTotal: round2(defaultersTotalCents / 100),
    complaintsLogged,
    complaintsResolved
  };
}

/**
 * The full digest text (Roman Urdu, ~10 lines), deterministic for the
 * same inputs. See the module header for the exact format.
 */
export function buildDailyPartnerDigest(state, date, sources = {}) {
  const s = summarizePartnerDigest(state, date, sources);
  const lines = [];
  lines.push(`📊 Shahdara Fiber Net — Rozana Partner Digest (${formatDigestDate(s.date)})`);
  lines.push(`💵 Aaj ki direct cash collection: ${formatPKR(s.directCash)}`);
  if (s.shops.length === 0) {
    lines.push('🏪 Shops par koi unsettled cash nahi');
  } else {
    for (const shop of s.shops) {
      lines.push(`🏪 ${shop.shop}: unsettled cash ${formatPKR(shop.unsettled)}`);
    }
  }
  lines.push(`🧾 Aaj ka roznamcha kharcha (petty cash): ${formatPKR(s.pettyCashOut)}`);
  lines.push(`🗄️ Drawer closing balance: ${formatPKR(s.drawerBalance)}`);
  lines.push(`⚠️ Baqi defaulters: ${s.defaultersCount} (kul ${formatPKR(s.defaultersTotal)})`);
  lines.push(`🛠️ Aaj ki complaints: ${s.complaintsLogged} lagi, ${s.complaintsResolved} hal hui`);
  return lines.join('\n');
}

/** WhatsApp share URL for the digest text (same wa.me pattern as SISP-1). */
export function dailyPartnerDigestWhatsAppUrl(text) {
  return `https://wa.me/?text=${encodeURIComponent(String(text || ''))}`;
}
