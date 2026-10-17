/**
 * tests/mom-growth.test.js
 * Comprehensive unit and integration test suite for Month-over-Month (MoM) Growth,
 * Business Momentum & Traction Suite.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateMomGrowth,
  renderMomGrowthSvg,
  generateMomGrowthCsv,
  generateMomGrowthPrintHtml,
  generateMomGrowthBriefing,
  setupMomGrowthModal,
  escapeHtml,
  escapeXml,
  formatDateYmd
} from '../dashboard-mom-growth.js';

function createMockState() {
  return {
    customers: [
      {
        id: 'cust-1',
        name: 'Muhammad Tariq',
        connectionDate: '2026-05-10',
        bills: [
          {
            month: '2026-08',
            amount: 2500,
            payments: [{ date: '2026-08-05', amount: 2500 }]
          },
          {
            month: '2026-09',
            amount: 2500,
            payments: [{ date: '2026-09-06', amount: 2500 }]
          },
          {
            month: '2026-10',
            amount: 2500,
            payments: [{ date: '2026-10-04', amount: 2500 }]
          }
        ]
      },
      {
        id: 'cust-2',
        name: 'Waseem Akram',
        addedOn: '2026-09-01',
        bills: [
          {
            month: '2026-09',
            amount: 3000,
            payments: [{ date: '2026-09-10', amount: 3000 }]
          },
          {
            month: '2026-10',
            amount: 3000,
            payments: [{ date: '2026-10-05', amount: 1500 }]
          }
        ]
      },
      {
        id: 'cust-3',
        name: 'Chaudhry Arshad',
        registrationDate: '2026-10-01',
        bills: [
          {
            month: '2026-10',
            amount: 4000,
            payments: [{ date: '2026-10-08', amount: 4000 }]
          }
        ]
      },
      {
        id: 'cust-churned',
        name: 'Old Subscriber',
        connectionDate: '2026-06-01',
        archived: true,
        archiveDate: '2026-09-15',
        bills: [
          {
            month: '2026-08',
            amount: 2000,
            payments: [{ date: '2026-08-10', amount: 2000 }]
          },
          {
            month: '2026-09',
            amount: 2000,
            payments: [{ date: '2026-09-12', amount: 2000 }]
          }
        ]
      }
    ],
    expenses: [
      { id: 'exp-1', date: '2026-08-15', amount: 1200, category: 'Upstream Bandwidth' },
      { id: 'exp-2', date: '2026-09-20', amount: 1500, category: 'Staff Salary' },
      { id: 'exp-3', date: '2026-10-10', amount: 1800, category: 'Electricity / Diesel' }
    ]
  };
}

test('calculateMomGrowth handles empty and default state gracefully', () => {
  const result = calculateMomGrowth({}, { selectedMonth: '2026-10', windowMonths: 6 });
  assert.ok(result);
  assert.equal(result.activeMonth, '2026-10');
  assert.equal(result.windowMonths, 6);
  assert.equal(result.monthlyData.length, 6);
  assert.equal(result.activeItem.activeSubscribers, 0);
  assert.equal(result.activeItem.billedAmount, 0);
  assert.equal(result.activeItem.cashCollections, 0);
  assert.equal(result.activeItem.netProfit, 0);
  assert.equal(result.activeItem.mom.subscriberGrowthPct, 0);
  assert.equal(result.momentum, 'Stagnant');
});

test('calculateMomGrowth correctly resolves customer cohorts, growth and financials', () => {
  const state = createMockState();
  const result = calculateMomGrowth(state, { selectedMonth: '2026-10', windowMonths: 6 });

  assert.equal(result.activeMonth, '2026-10');
  assert.equal(result.monthlyData.length, 6);

  const oct = result.activeItem;
  assert.equal(oct.month, '2026-10');
  // In Oct: cust-1 (joined May), cust-2 (joined Sep), cust-3 (joined Oct). cust-churned was archived in Sep 2026.
  // cust-churned archivedMonth is 2026-09, so not active in Oct.
  assert.equal(oct.activeSubscribers, 3);
  assert.equal(oct.newSubscribers, 1); // cust-3
  assert.equal(oct.churnedSubscribers, 0);
  assert.equal(oct.netSubscriberGrowth, 1);

  // Oct billed amounts: cust-1: 2500, cust-2: 3000, cust-3: 4000 = 9500
  assert.equal(oct.billedAmount, 9500);

  // Oct collections: cust-1: 2500, cust-2: 1500, cust-3: 4000 = 8000
  assert.equal(oct.cashCollections, 8000);

  // Oct expenses: exp-3: 1800
  assert.equal(oct.operatingExpenses, 1800);

  // Oct net profit: 8000 - 1800 = 6200
  assert.equal(oct.netProfit, 6200);

  // ARPU: 9500 / 3 = 3167 (rounded)
  assert.equal(oct.arpu, Math.round(9500 / 3));

  // Check September data
  const sep = result.monthlyData.find(m => m.month === '2026-09');
  assert.ok(sep);
  // In Sep: cust-1 (May), cust-2 (Sep), cust-churned (June, archived Sep).
  assert.equal(sep.activeSubscribers, 3);
  assert.equal(sep.newSubscribers, 1); // cust-2
  assert.equal(sep.churnedSubscribers, 1); // cust-churned
  assert.equal(sep.netSubscriberGrowth, 0);
  // Sep collections: cust-1: 2500, cust-2: 3000, cust-churned: 2000 = 7500
  assert.equal(sep.cashCollections, 7500);
  assert.equal(sep.operatingExpenses, 1500);
  assert.equal(sep.netProfit, 6000);

  // MoM deltas for Oct relative to Sep:
  // Subscribers: 3 in Oct, 3 in Sep -> delta 0, pct 0%
  assert.equal(oct.mom.subscriberDelta, 0);
  assert.equal(oct.mom.subscriberGrowthPct, 0);

  // Cash collections: 8000 in Oct vs 7500 in Sep -> +500, pct +6.7%
  assert.equal(oct.mom.collectionDelta, 500);
  assert.equal(oct.mom.collectionGrowthPct, 6.7);

  // Net profit: 6200 vs 6000 -> +200, pct +3.3%
  assert.equal(oct.mom.profitDelta, 200);
  assert.equal(oct.mom.profitGrowthPct, 3.3);
});

test('calculateMomGrowth handles 3M and 12M windows correctly', () => {
  const state = createMockState();
  const res3 = calculateMomGrowth(state, { selectedMonth: '2026-10', windowMonths: 3 });
  assert.equal(res3.monthlyData.length, 3);
  assert.equal(res3.monthlyData[0].month, '2026-08');
  assert.equal(res3.monthlyData[2].month, '2026-10');

  const res12 = calculateMomGrowth(state, { selectedMonth: '2026-10', windowMonths: 12 });
  assert.equal(res12.monthlyData.length, 12);
  assert.equal(res12.monthlyData[11].month, '2026-10');
});

test('calculateMomGrowth classifies momentum accurately', () => {
  const state = createMockState();
  const res = calculateMomGrowth(state, { selectedMonth: '2026-10', windowMonths: 6 });
  assert.ok(['Accelerating', 'Steady Growth', 'Stagnant', 'Contracting', 'Starting'].includes(res.momentum));
  assert.ok(res.momentumUrdu);
  assert.ok(res.momentumColor);
});

test('renderMomGrowthSvg outputs valid, accessible SVG with bars and indicators', () => {
  const state = createMockState();
  const data = calculateMomGrowth(state, { selectedMonth: '2026-10', windowMonths: 6 });
  const svg = renderMomGrowthSvg(data, { width: 700, height: 280 });

  assert.ok(typeof svg === 'string');
  assert.match(svg, /<svg[^>]+xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  assert.match(svg, /viewBox="0 0 700 280"/);
  assert.match(svg, /role="img"/);
  assert.match(svg, /2026-10/);
  assert.match(svg, /rect/);
});

test('renderMomGrowthSvg handles empty or flat data gracefully without crashing', () => {
  const data = calculateMomGrowth({}, { selectedMonth: '2026-10', windowMonths: 6 });
  const svg = renderMomGrowthSvg(data);
  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('2026-10'));
});

test('generateMomGrowthCsv generates valid RFC-4180 CSV with UTF-8 BOM', () => {
  const state = createMockState();
  const data = calculateMomGrowth(state, { selectedMonth: '2026-10', windowMonths: 6 });
  const csv = generateMomGrowthCsv(data);

  assert.ok(csv.startsWith('\uFEFF'), 'CSV must include UTF-8 BOM');
  const lines = csv.split('\r\n');
  assert.ok(lines.length >= 7);
  assert.match(lines[0], /Month,Active Subscribers,New Subscribers,Churned,Net Growth/);

  const octLine = lines.find(l => l.startsWith('2026-10'));
  assert.ok(octLine);
  assert.ok(octLine.includes('3,1,0,1,9500,'));
});

test('generateMomGrowthPrintHtml produces A4 and 80mm thermal slips', () => {
  const state = createMockState();
  const data = calculateMomGrowth(state, { selectedMonth: '2026-10', windowMonths: 6 });

  const a4 = generateMomGrowthPrintHtml(data, { format: 'a4' });
  assert.ok(a4.includes('<!DOCTYPE html>'));
  assert.ok(a4.includes('Shahdara ISP - Month-over-Month Growth Statement'));
  assert.ok(a4.includes('ACTIVE SUBSCRIBERS'));
  assert.ok(a4.includes('BILLED CHARGES'));
  assert.ok(a4.includes('CASH COLLECTIONS'));
  assert.ok(a4.includes('NET CASH PROFIT'));
  assert.ok(a4.includes('2026-10'));

  const thermal = generateMomGrowthPrintHtml(data, { format: 'thermal-80' });
  assert.ok(thermal.includes('<!DOCTYPE html>'));
  assert.ok(thermal.includes('SHAHDARA FIBER NET'));
  assert.ok(thermal.includes('MoM Business Momentum Slip'));
  assert.ok(thermal.includes('2026-10'));
});

test('generateMomGrowthBriefing produces bilingual Urdu and English summary', () => {
  const state = createMockState();
  const data = calculateMomGrowth(state, { selectedMonth: '2026-10', windowMonths: 6 });
  const briefing = generateMomGrowthBriefing(data);

  assert.ok(briefing.includes('Shahdara ISP - MoM Growth & Business Momentum'));
  assert.ok(briefing.includes('شاہدرہ انٹرنیٹ سروسز - ماہانہ ترقیاتی و کاروباری رپورٹ'));
  assert.ok(briefing.includes('2026-10'));
  assert.ok(briefing.includes('PKR 8,000'));
  assert.ok(briefing.includes('PKR 6,200'));
  assert.ok(briefing.includes('Steady Growth') || briefing.includes('Accelerating') || briefing.includes('Stagnant'));
});

test('helper functions escapeHtml, escapeXml, and formatDateYmd work properly', () => {
  assert.equal(escapeHtml('<script>alert("xss")&\'</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&amp;&#39;&lt;/script&gt;');
  assert.equal(escapeXml('foo&bar'), 'foo&amp;bar');
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');

  const date = new Date('2026-10-18T12:00:00Z');
  const formatted = formatDateYmd(date);
  assert.match(formatted, /^2026-10-18$/);
  assert.equal(formatDateYmd(null), '');
});

test('setupMomGrowthModal initializes, opens, closes and manages DOM elements', () => {
  const mockElements = {};
  const createElement = (id, tag = 'div') => {
    const el = {
      id,
      tagName: tag.toUpperCase(),
      innerHTML: '',
      textContent: '',
      value: '',
      style: {},
      listeners: {},
      classList: {
        classes: new Set(),
        add(c) { this.classes.add(c); },
        remove(c) { this.classes.delete(c); },
        contains(c) { return this.classes.has(c); }
      },
      addEventListener(evt, fn) {
        if (!this.listeners[evt]) this.listeners[evt] = [];
        this.listeners[evt].push(fn);
      },
      trigger(evt, payload = {}) {
        if (this.listeners[evt]) {
          this.listeners[evt].forEach(fn => fn({ target: this, ...payload }));
        }
      },
      querySelectorAll() { return []; },
      showModal() { this.open = true; },
      close() { this.open = false; },
      setAttribute(k, v) { this[k] = v; },
      removeAttribute(k) { delete this[k]; }
    };
    mockElements[id] = el;
    return el;
  };

  const ids = [
    'momGrowthModal',
    'closeMomGrowthModalBtn',
    'closeMomGrowthSecondaryBtn',
    'momGrowthMonthSelect',
    'momGrowthWindowToggle',
    'momGrowthSvgContainer',
    'momGrowthTableBody',
    'exportMomGrowthCsvBtn',
    'printMomGrowthA4Btn',
    'printMomGrowthPosBtn',
    'shareMomGrowthWhatsAppBtn',
    'momKpiSubscribers',
    'momKpiSubscribersDelta',
    'momKpiBilled',
    'momKpiBilledDelta',
    'momKpiCollected',
    'momKpiCollectedDelta',
    'momKpiProfit',
    'momKpiProfitDelta',
    'momKpiMomentumBadge',
    'quickActionMomGrowth',
    'openMomGrowthModalBtn'
  ];

  ids.forEach(id => createElement(id));

  // Mock global document.getElementById
  const originalGetElementById = globalThis.document?.getElementById;
  globalThis.document = {
    getElementById: (id) => mockElements[id] || null
  };

  let toastMsg = '';
  const state = createMockState();
  const controller = setupMomGrowthModal(() => state, {
    onToast: (msg) => { toastMsg = msg; }
  });

  assert.ok(controller);
  assert.equal(typeof controller.open, 'function');
  assert.equal(typeof controller.close, 'function');
  assert.equal(typeof controller.renderContent, 'function');

  // Test open and close
  controller.open('2026-10');
  assert.equal(mockElements['momGrowthModal'].open, true);
  assert.equal(mockElements['momGrowthMonthSelect'].value, '2026-10');
  assert.equal(mockElements['momKpiSubscribers'].textContent, '3');
  assert.equal(mockElements['momKpiBilled'].textContent, 'PKR 9,500');
  assert.equal(mockElements['momKpiCollected'].textContent, 'PKR 8,000');
  assert.equal(mockElements['momKpiProfit'].textContent, 'PKR 6,200');

  controller.close();
  assert.equal(mockElements['momGrowthModal'].open, false);

  // Trigger open via quick action button
  mockElements['quickActionMomGrowth'].trigger('click');
  assert.equal(mockElements['momGrowthModal'].open, true);

  // Restore global document
  if (originalGetElementById) {
    globalThis.document.getElementById = originalGetElementById;
  } else {
    delete globalThis.document;
  }
});
