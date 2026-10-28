/**
 * home-today.js
 * Owner Daily Summary Card & WhatsApp Dispatch (#231 & #278)
 *
 * Implements:
 * - calculateHomeTodaySummary: computes collected today (cash vs digital),
 *   month progress (% collected vs billed), total dues, customers with dues,
 *   new customers connected this month, and top 5 overdue accounts.
 * - generateOwnerDailySummaryWhatsAppText: formatted executive bilingual summary text.
 * - renderHomeTodaySummary: updates the DOM card elements and renders top 5 overdue accounts.
 * - setupHomeTodaySection: binds WhatsApp dispatch button and live event listeners.
 */

import { formatPKR, calculateDashboard } from './core.js';
import { displayCustomerName, currentAppLanguage } from './urdu-names.js';
import { pkrNoteChipsMarkup } from './pkr-notes.js';
import { calculateDailyClosingSummary } from './dashboard-daily-closing.js';
import { t } from './nav-language.js';

export const OWNER_WHATSAPP_PHONE_KEY = 'shahdara_owner_whatsapp_phone';

/**
 * Normalizes phone numbers to international Pakistani WhatsApp format (e.g. 03001234567 -> 923001234567).
 * @param {string} phone
 * @returns {string}
 */
export function normalizeWhatsAppNumber(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('03') && digits.length === 11) {
    return '92' + digits.slice(1);
  }
  if (digits.startsWith('923') && digits.length === 12) {
    return digits;
  }
  if (digits.startsWith('3') && digits.length === 10) {
    return '92' + digits;
  }
  return digits;
}

/**
 * Calculates metrics for Home Today card (#231).
 *
 * @param {Object} state - Application state
 * @param {Date} [referenceDate=new Date()] - Reference date
 * @returns {Object} Comprehensive summary
 */
export function calculateHomeTodaySummary(state = {}, referenceDate = new Date()) {
  const dailySummary = calculateDailyClosingSummary(state, referenceDate);
  const dashboard = calculateDashboard(state, referenceDate);

  const currentMonth = dailySummary.currentMonth || (referenceDate instanceof Date ? referenceDate.toISOString().slice(0, 7) : String(referenceDate).slice(0, 7));

  let monthCollectedCents = 0;
  let monthBilledCents = 0;
  let newConnectionsThisMonth = 0;
  const overdueCustomers = [];

  for (const c of (state.customers ?? [])) {
    if (c.archived) continue;

    // Check new connection in this month (addedOn, connectionDate, or createdAt)
    const connDate = c.addedOn || c.connectionDate || c.createdAt;
    if (connDate && String(connDate).slice(0, 7) === currentMonth) {
      newConnectionsThisMonth++;
    }

    // Check customer's total outstanding balance
    let custTotalDueCents = 0;
    const bills = Array.isArray(c.bills) ? c.bills : [];
    for (const b of bills) {
      const due = Number(b.dueAmount) || 0;
      const payments = Array.isArray(b.payments) ? b.payments : [];
      const paid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const balance = Math.max(0, due - paid);
      custTotalDueCents += Math.round(balance * 100);

      // Current month billed
      if (b.month === currentMonth && b.dueAmount !== null && b.dueAmount !== undefined) {
        monthBilledCents += Math.round(Number(b.dueAmount) * 100);
      }

      // Current month collected (payments dated in current month)
      for (const p of payments) {
        if (typeof p.date === 'string' && p.date.slice(0, 7) === currentMonth) {
          monthCollectedCents += Math.round((Number(p.amount) || 0) * 100);
        }
      }
    }

    if (custTotalDueCents > 0) {
      overdueCustomers.push({
        id: c.id,
        customerNumber: c.customerNumber,
        name: c.name,
        nameUrdu: c.nameUrdu || ' ',
        phone: c.phone || '',
        mohalla: c.mohalla || c.zone || 'Shahdara',
        balanceDue: Math.round(custTotalDueCents / 100)
      });
    }
  }

  // Sort descending by balanceDue
  overdueCustomers.sort((a, b) => b.balanceDue - a.balanceDue);
  const top5Overdue = overdueCustomers.slice(0, 5);

  const monthBilled = Math.round(monthBilledCents / 100);
  const monthCollected = Math.round(monthCollectedCents / 100);
  const targetPct = monthBilled > 0 ? Math.round((monthCollected / monthBilled) * 100) : 0;

  return {
    todayStr: dailySummary.todayStr,
    currentMonth,
    todayCollected: dailySummary.todayCollected,
    todayCount: dailySummary.todayCount,
    cashCollected: dailySummary.cashCollected,
    digitalCollected: dailySummary.digitalCollected,
    monthBilled,
    monthCollected,
    targetPct,
    totalDue: dashboard.totalDue,
    customersWithDuesCount: overdueCustomers.length,
    newCustomersThisMonth: newConnectionsThisMonth,
    top5Overdue
  };
}

/**
 * Generates formatted executive WhatsApp summary for the owner.
 *
 * @param {Object} summary
 * @param {string} [ispName='Shahdara ISP']
 * @returns {string}
 */
export function generateOwnerDailySummaryWhatsAppText(summary, ispName = 'Shahdara ISP') {
  const lines = [
    `*💰 ${ispName} — یومیہ خلاصہ برائے مالک*`,
    `*${ispName.toUpperCase()} — OWNER DAILY SUMMARY*`,
    `📅 تاریخ / Date: *${summary.todayStr} PKT*`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `• آج کی کل وصولی / Collected Today: *${formatPKR(summary.todayCollected)}* (${summary.todayCount} رسیدیں / txs)`,
    `  - نقد کیش / Cash: ${formatPKR(summary.cashCollected)}`,
    `  - ڈیجیٹل و آن لائن / Digital: ${formatPKR(summary.digitalCollected)}`,
    ``,
    `• ماہانہ وصولی / Month Progress: *${summary.targetPct}%* (${formatPKR(summary.monthCollected)} / ${formatPKR(summary.monthBilled)} billed)`,
    `• کل واجب الادا رقم / Total Dues: *${formatPKR(summary.totalDue)}* (${summary.customersWithDuesCount} صارفین کے ذمہ)`,
    `• نئے کنکشنز / New Connections: *${summary.newCustomersThisMonth}*`
  ];

  if (summary.top5Overdue && summary.top5Overdue.length > 0) {
    lines.push(``, `*🚨 ٹاپ 5 بڑے نادہندگان / Top 5 Overdue:*`);
    summary.top5Overdue.forEach((c, idx) => {
      lines.push(`${idx + 1}. #${c.customerNumber} ${c.name} (${c.mohalla}): *${formatPKR(c.balanceDue)}*`);
    });
  }

  lines.push(`━━━━━━━━━━━━━━━━━━━━━━`, `Verified Local Ledger · Shahdara ISP`);
  return lines.join('\n');
}

/**
 * Renders Today summary metrics into the DOM.
 *
 * @param {Document} doc
 * @param {Object} summary
 */
export function renderHomeTodaySummary(doc = document, summary) {
  if (!doc) return;

  const todayDateEl = doc.getElementById('homeTodayDateText');
  if (todayDateEl) {
    todayDateEl.textContent = `${summary.todayStr} · ${t('dash_today_live_suffix')}`;
  }

  const collectedEl = doc.getElementById('homeTodayCollected');
  if (collectedEl) {
    collectedEl.textContent = formatPKR(summary.todayCollected);
  }

  const cashVsDigitalEl = doc.getElementById('homeTodayCashVsDigital');
  if (cashVsDigitalEl) {
    cashVsDigitalEl.textContent = t('dash_today_cash_digital', null, { cash: formatPKR(summary.cashCollected), digital: formatPKR(summary.digitalCollected) });
  }

  const targetPctEl = doc.getElementById('homeTodayTargetPct');
  if (targetPctEl) {
    targetPctEl.textContent = `${summary.targetPct}%`;
  }

  const collectedVsBilledEl = doc.getElementById('homeTodayCollectedVsBilled');
  if (collectedVsBilledEl) {
    collectedVsBilledEl.textContent = t('dash_today_billed', null, { collected: formatPKR(summary.monthCollected), billed: formatPKR(summary.monthBilled) });
  }

  const totalDuesEl = doc.getElementById('homeTodayTotalDues');
  if (totalDuesEl) {
    totalDuesEl.textContent = formatPKR(summary.totalDue);
  }

  const duesCountEl = doc.getElementById('homeTodayDuesCount');
  if (duesCountEl) {
    duesCountEl.textContent = t('dash_today_dues_count', null, { count: summary.customersWithDuesCount });
  }

  const newCustEl = doc.getElementById('homeTodayNewCustomers');
  if (newCustEl) {
    newCustEl.textContent = String(summary.newCustomersThisMonth);
  }

  // Render Top 5 Overdue List
  const overdueListEl = doc.getElementById('homeTopOverdueList');
  if (overdueListEl) {
    if (!summary.top5Overdue || summary.top5Overdue.length === 0) {
      overdueListEl.innerHTML = `<li class="overdue-empty-item">${t('dash_today_no_overdue')}</li>`;
    } else {
      const overdueLang = currentAppLanguage();
      overdueListEl.innerHTML = summary.top5Overdue.map(c => {
        const rawPhone = c.phone || '';
        const waPhone = normalizeWhatsAppNumber(rawPhone);
        const waLink = waPhone
          ? `https://wa.me/${waPhone}?text=${encodeURIComponent(`Salam ${c.name} sahib, Shahdara ISP reminder: aapka balance ${formatPKR(c.balanceDue)} due hai. Shukriya.`)}`
          : null;

        return `
          <li class="home-overdue-item" data-customer-id="${c.id}">
            <div class="overdue-item-info">
              <span class="overdue-item-badge">#${c.customerNumber}</span>
              <div class="overdue-item-text">
                <strong class="overdue-item-name" dir="auto">${displayCustomerName(c, overdueLang)}</strong>
                <span class="overdue-item-sub">${c.mohalla}</span>
              </div>
            </div>
            <div class="overdue-item-right">
              <div class="overdue-amount-col">
                <strong class="overdue-item-amount">${formatPKR(c.balanceDue)}</strong>
                ${pkrNoteChipsMarkup(c.balanceDue)}
              </div>
              <div class="overdue-item-actions">
                ${waLink ? `<a href="${waLink}" target="_blank" rel="noopener noreferrer" class="overdue-wa-link" title="${t('dash_today_wa_title')}" aria-label="${t('dash_today_wa_link_aria', null, { name: c.name })}">💬 WhatsApp</a>` : ''}
                <a href="#quick-collect/${c.id}" class="overdue-collect-link" title="${t('dash_today_collect_title')}" aria-label="${t('dash_today_collect_aria', null, { name: c.name })}">${t('dash_today_collect_text')}</a>
              </div>
            </div>
          </li>
        `;
      }).join('');
    }
  }
}

/**
 * Initializes and wires the Home Today section.
 *
 * @param {Object} options
 */
export function setupHomeTodaySection({ getState, getRefDate = () => new Date(), doc = document, win = window } = {}) {
  const update = () => {
    const state = getState ? getState() : {};
    const refDate = getRefDate();
    const summary = calculateHomeTodaySummary(state, refDate);
    renderHomeTodaySummary(doc, summary);
    return summary;
  };

  // Wire WhatsApp button
  const waBtn = doc.getElementById('sendDailySummaryWhatsAppBtn');
  if (waBtn && !waBtn._wired) {
    waBtn._wired = true;
    waBtn.addEventListener('click', () => {
      const state = getState ? getState() : {};
      const refDate = getRefDate();
      const summary = calculateHomeTodaySummary(state, refDate);
      const text = generateOwnerDailySummaryWhatsAppText(summary);

      // Check saved owner phone
      let ownerPhone = '';
      try {
        ownerPhone = win.localStorage.getItem(OWNER_WHATSAPP_PHONE_KEY) || '';
      } catch {}

      if (!ownerPhone) {
        // Check digital settings Raast ID if it is a phone
        const raastId = doc.getElementById('settingOwnerRaastId')?.value;
        if (raastId && /^03\d{9}$/.test(raastId.trim())) {
          ownerPhone = raastId.trim();
        }
      }

      if (!ownerPhone) {
        const input = win.prompt(
          'Enter owner WhatsApp number for daily summary (e.g. 03001234567):',
          '03001234567'
        );
        if (input && input.trim()) {
          ownerPhone = input.trim();
          try {
            win.localStorage.setItem(OWNER_WHATSAPP_PHONE_KEY, ownerPhone);
          } catch {}
        }
      }

      const normalized = normalizeWhatsAppNumber(ownerPhone);
      const url = normalized
        ? `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`
        : `https://wa.me/?text=${encodeURIComponent(text)}`;

      win.open(url, '_blank', 'noopener,noreferrer');
    });
  }

  // Wire Top 5 Overdue "Collect" links: open Quick Collect through the
  // controller, preselected to the tapped customer, so the visit uses the
  // canonical #/collect route (#263) exactly like the bottom-bar Collect
  // button — and closing returns to Home. The href="#quick-collect/<id>"
  // remains as a deep-link fallback (no-JS / open in new tab); the screen
  // router treats it as the collect route too, so it can never strand the
  // user in a dialog that reopens itself on close.
  const overdueListEl2 = doc.getElementById('homeTopOverdueList');
  if (overdueListEl2 && !overdueListEl2._langWired) {
    overdueListEl2._langWired = true;
    if (typeof win.addEventListener === 'function') win.addEventListener('shahdara:language-change', update);
  }
  if (overdueListEl2 && !overdueListEl2._collectWired) {
    overdueListEl2._collectWired = true;
    overdueListEl2.addEventListener('click', (event) => {
      const link = event.target?.closest?.('.overdue-collect-link');
      if (!link) return;
      const rawId = (link.getAttribute('href') || '').match(/#quick-collect\/(.+)$/)?.[1];
      const ctl = win.quickCollectModalController;
      if (!rawId || typeof ctl?.open !== 'function') return; // let the deep link fallback run
      let customerId = rawId;
      try { customerId = decodeURIComponent(rawId); } catch { /* keep the raw id */ }
      event.preventDefault();
      ctl.open(customerId);
    });
  }

  // Initial render
  return update();
}
