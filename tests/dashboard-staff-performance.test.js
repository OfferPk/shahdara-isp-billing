import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateStaffPerformance,
  filterStaffCollectors,
  sortStaffCollectors,
  renderStaffPerformanceSvg,
  generateStaffPerformanceCsv,
  generateStaffPerformancePrintHtml,
  generateStaffPerformanceBriefing,
  setupStaffPerformanceModal,
  resolveCollectorName,
  resolveCollectorCategory,
  resolveCollectorTier,
  STAFF_PERFORMANCE_CONSTANTS
} from '../dashboard-staff-performance.js';

import * as dashboardExports from '../dashboard.js';

test('Collector & Staff Performance - exports re-exported from dashboard.js', () => {
  assert.equal(typeof dashboardExports.calculateStaffPerformance, 'function');
  assert.equal(typeof dashboardExports.filterStaffCollectors, 'function');
  assert.equal(typeof dashboardExports.sortStaffCollectors, 'function');
  assert.equal(typeof dashboardExports.renderStaffPerformanceSvg, 'function');
  assert.equal(typeof dashboardExports.generateStaffPerformanceCsv, 'function');
  assert.equal(typeof dashboardExports.generateStaffPerformancePrintHtml, 'function');
  assert.equal(typeof dashboardExports.generateStaffPerformanceBriefing, 'function');
  assert.equal(typeof dashboardExports.setupStaffPerformanceModal, 'function');
  assert.equal(typeof dashboardExports.resolveStaffCollectorName, 'function');
  assert.equal(typeof dashboardExports.resolveCollectorCategory, 'function');
  assert.equal(typeof dashboardExports.resolveCollectorTier, 'function');
  assert.ok(dashboardExports.STAFF_PERFORMANCE_CONSTANTS);
});

test('Collector & Staff Performance - resolveCollectorName handles shop attribution, paidBy, and fallbacks', () => {
  assert.equal(resolveCollectorName('Cash', 'Umair Collector'), 'Umair Collector');
  assert.equal(resolveCollectorName('Cash at Waseem Abbasi shop'), 'Waseem Abbasi');
  assert.equal(resolveCollectorName('Cash at Hassan shop'), 'Hassan');
  assert.equal(resolveCollectorName('Cash at Balla shop'), 'Balla');
  assert.equal(resolveCollectorName('Cash'), 'Direct / Counter Till');
  assert.equal(resolveCollectorName('Easypaisa'), 'Online / Digital Settlement');
  assert.equal(resolveCollectorName('JazzCash'), 'Online / Digital Settlement');
  assert.equal(resolveCollectorName('Bank Transfer'), 'Online / Digital Settlement');
  assert.equal(resolveCollectorName('', ''), 'Direct / Counter Till');
});

test('Collector & Staff Performance - resolveCollectorCategory maps channels properly', () => {
  assert.equal(resolveCollectorCategory('Waseem Abbasi', 'Cash at Waseem Abbasi shop'), STAFF_PERFORMANCE_CONSTANTS.CATEGORIES.SHOP);
  assert.equal(resolveCollectorCategory('Hassan', 'Cash at Hassan shop'), STAFF_PERFORMANCE_CONSTANTS.CATEGORIES.SHOP);
  assert.equal(resolveCollectorCategory('Direct / Counter Till', 'Cash'), STAFF_PERFORMANCE_CONSTANTS.CATEGORIES.COUNTER);
  assert.equal(resolveCollectorCategory('Online / Digital Settlement', 'Easypaisa'), STAFF_PERFORMANCE_CONSTANTS.CATEGORIES.DIGITAL);
  assert.equal(resolveCollectorCategory('Umair Collector', 'Cash'), STAFF_PERFORMANCE_CONSTANTS.CATEGORIES.FIELD);
});

test('Collector & Staff Performance - resolveCollectorTier correctly assigns performance tiers', () => {
  assert.equal(resolveCollectorTier(40).label, 'Star Collector');
  assert.equal(resolveCollectorTier(35).label, 'Star Collector');
  assert.equal(resolveCollectorTier(25).label, 'High Performer');
  assert.equal(resolveCollectorTier(20).label, 'High Performer');
  assert.equal(resolveCollectorTier(15).label, 'Steady Collector');
  assert.equal(resolveCollectorTier(10).label, 'Steady Collector');
  assert.equal(resolveCollectorTier(5).label, 'Developing / Entry');
  assert.equal(resolveCollectorTier(0).label, 'Developing / Entry');
});

test('Collector & Staff Performance - calculateStaffPerformance handles empty state safely', () => {
  const result = calculateStaffPerformance({}, { selectedMonth: '2026-10' });
  assert.equal(result.totalCollected, 0);
  assert.equal(result.totalReceipts, 0);
  assert.equal(result.uniqueCustomers, 0);
  assert.equal(result.overallAverageTicket, 0);
  assert.equal(result.cashTotal, 0);
  assert.equal(result.digitalTotal, 0);
  assert.equal(result.activeCollectorsCount, 0);
  assert.deepEqual(result.collectors, []);
});

test('Collector & Staff Performance - calculateStaffPerformance aggregates multi-collector receipts with area and daily velocity', () => {
  const mockState = {
    customers: [
      {
        id: 'cust-001',
        name: 'Muhammad Tariq',
        customerNumber: 101,
        mohalla: 'Bara Dari',
        bills: [
          {
            month: '2026-10',
            payments: [
              { id: 'p-1', amount: 2000, date: '2026-10-05', method: 'Cash', paidBy: 'Umair Field' },
              { id: 'p-2', amount: 1000, date: '2026-10-15', method: 'Cash at Waseem Abbasi shop' }
            ]
          }
        ]
      },
      {
        id: 'cust-002',
        name: 'Zahid Khan',
        customerNumber: 102,
        mohalla: 'Imamia Colony',
        bills: [
          {
            month: '2026-10',
            payments: [
              { id: 'p-3', amount: 3000, date: '2026-10-06', method: 'Cash', paidBy: 'Umair Field' },
              { id: 'p-4', amount: 1500, date: '2026-10-10', method: 'Easypaisa' }
            ]
          }
        ]
      },
      {
        id: 'cust-003',
        name: 'Saqib Ali',
        customerNumber: 103,
        mohalla: 'Bara Dari',
        bills: [
          {
            month: '2026-10',
            payments: [
              { id: 'p-5', amount: 2500, date: '2026-10-12', method: 'Cash at Hassan shop' }
            ]
          }
        ]
      }
    ]
  };

  const res = calculateStaffPerformance(mockState, { selectedMonth: '2026-10' });

  // Total collections: 2000 + 1000 + 3000 + 1500 + 2500 = 10,000
  assert.equal(res.totalCollected, 10000);
  assert.equal(res.totalReceipts, 5);
  assert.equal(res.uniqueCustomers, 3);
  assert.equal(res.overallAverageTicket, 2000);
  assert.equal(res.cashTotal, 8500);
  assert.equal(res.digitalTotal, 1500);
  assert.equal(res.cashRatioPct, 85);
  assert.equal(res.digitalRatioPct, 15);
  assert.equal(res.activeCollectorsCount, 4);

  // Check top collector: Umair Field has 5000 (50% share)
  const top = res.collectors[0];
  assert.equal(top.collectorName, 'Umair Field');
  assert.equal(top.totalCollected, 5000);
  assert.equal(top.receiptsCount, 2);
  assert.equal(top.uniqueCustomersCount, 2);
  assert.equal(top.averageTicket, 2500);
  assert.equal(top.cashAmount, 5000);
  assert.equal(top.digitalAmount, 0);
  assert.equal(top.portfolioSharePct, 50);
  assert.equal(top.tier.label, 'Star Collector');
  assert.equal(top.category, STAFF_PERFORMANCE_CONSTANTS.CATEGORIES.FIELD);

  // Check Hassan shop: 2500 (25% share)
  const hassan = res.collectors.find(c => c.collectorName === 'Hassan');
  assert.ok(hassan);
  assert.equal(hassan.totalCollected, 2500);
  assert.equal(hassan.category, STAFF_PERFORMANCE_CONSTANTS.CATEGORIES.SHOP);
  assert.equal(hassan.topArea, 'Bara Dari');

  // Check Online / Digital Settlement: 1500
  const digital = res.collectors.find(c => c.collectorName === 'Online / Digital Settlement');
  assert.ok(digital);
  assert.equal(digital.totalCollected, 1500);
  assert.equal(digital.category, STAFF_PERFORMANCE_CONSTANTS.CATEGORIES.DIGITAL);
  assert.equal(digital.digitalAmount, 1500);
  assert.equal(digital.cashAmount, 0);

  // Test channel filtering: cash only
  const cashOnly = calculateStaffPerformance(mockState, { selectedMonth: '2026-10', channelFilter: 'cash' });
  assert.equal(cashOnly.totalCollected, 8500);
  assert.equal(cashOnly.collectors.some(c => c.collectorName === 'Online / Digital Settlement'), false);

  // Test channel filtering: digital only
  const digitalOnly = calculateStaffPerformance(mockState, { selectedMonth: '2026-10', channelFilter: 'digital' });
  assert.equal(digitalOnly.totalCollected, 1500);
  assert.equal(digitalOnly.collectors.length, 1);
  assert.equal(digitalOnly.collectors[0].collectorName, 'Online / Digital Settlement');
});

test('Collector & Staff Performance - filterStaffCollectors and sortStaffCollectors work correctly', () => {
  const sampleCollectors = [
    { collectorName: 'Umair Field', category: 'Field Collector', totalCollected: 5000, receiptsCount: 4, uniqueCustomersCount: 3, averageTicket: 1250, cashAmount: 5000, digitalAmount: 0, topArea: 'Bara Dari' },
    { collectorName: 'Waseem Abbasi', category: 'Shop Register', totalCollected: 3000, receiptsCount: 2, uniqueCustomersCount: 2, averageTicket: 1500, cashAmount: 3000, digitalAmount: 0, topArea: 'Main Bazaar' },
    { collectorName: 'Online / Digital', category: 'Digital Gateway', totalCollected: 2000, receiptsCount: 1, uniqueCustomersCount: 1, averageTicket: 2000, cashAmount: 0, digitalAmount: 2000, topArea: 'Imamia Colony' }
  ];

  // Search filter
  const filteredByName = filterStaffCollectors(sampleCollectors, 'waseem', 'all');
  assert.equal(filteredByName.length, 1);
  assert.equal(filteredByName[0].collectorName, 'Waseem Abbasi');

  const filteredByArea = filterStaffCollectors(sampleCollectors, 'imamia', 'all');
  assert.equal(filteredByArea.length, 1);
  assert.equal(filteredByArea[0].collectorName, 'Online / Digital');

  // Sort by avgTicket ascending
  const sortedAvgAsc = sortStaffCollectors(sampleCollectors, 'avgTicket', 'asc');
  assert.equal(sortedAvgAsc[0].collectorName, 'Umair Field'); // 1250
  assert.equal(sortedAvgAsc[2].collectorName, 'Online / Digital'); // 2000

  // Sort by collector name ascending
  const sortedNameAsc = sortStaffCollectors(sampleCollectors, 'collector', 'asc');
  assert.equal(sortedNameAsc[0].collectorName, 'Online / Digital');
  assert.equal(sortedNameAsc[1].collectorName, 'Umair Field');
  assert.equal(sortedNameAsc[2].collectorName, 'Waseem Abbasi');
});

test('Collector & Staff Performance - renderStaffPerformanceSvg generates valid SVG markup', () => {
  const mockData = {
    totalCollected: 10000,
    totalReceipts: 5,
    cashTotal: 8500,
    digitalTotal: 1500,
    cashRatioPct: 85,
    digitalRatioPct: 15,
    selectedMonthLabel: 'October 2026',
    collectors: [
      {
        collectorName: 'Umair Field',
        category: 'Field Collector',
        totalCollected: 5000,
        portfolioSharePct: 50,
        receiptsCount: 2,
        uniqueCustomersCount: 2,
        averageTicket: 2500,
        cashSharePct: 100,
        digitalSharePct: 0,
        topArea: 'Bara Dari',
        tier: STAFF_PERFORMANCE_CONSTANTS.TIERS.STAR
      }
    ]
  };

  const svg = renderStaffPerformanceSvg(mockData);
  assert.ok(svg.startsWith('<svg'));
  assert.ok(svg.includes('role="img"'));
  assert.ok(svg.includes('Umair Field'));
  assert.ok(svg.includes('50%'));
  assert.ok(svg.endsWith('</svg>'));

  // Test empty state
  const emptySvg = renderStaffPerformanceSvg({ collectors: [] });
  assert.ok(emptySvg.includes('<svg'));
  assert.ok(emptySvg.includes('No collector payments recorded in this period'));
});

test('Collector & Staff Performance - generateStaffPerformanceCsv formats valid RFC-4180 with UTF-8 BOM', () => {
  const mockData = {
    selectedMonthLabel: 'October 2026',
    collectors: [
      {
        collectorName: 'Umair Field',
        category: 'Field Collector',
        totalCollected: 5000,
        receiptsCount: 2,
        uniqueCustomersCount: 2,
        averageTicket: 2500,
        cashAmount: 5000,
        cashSharePct: 100,
        digitalAmount: 0,
        digitalSharePct: 0,
        portfolioSharePct: 50,
        topArea: 'Bara Dari'
      }
    ]
  };

  const csv = generateStaffPerformanceCsv(mockData);
  assert.ok(csv.startsWith('\uFEFF')); // UTF-8 BOM
  assert.ok(csv.includes('"Collector Name","Category","Total Collected (PKR)"'));
  assert.ok(csv.includes('"Umair Field"'));
  assert.ok(csv.includes('"Field Collector"'));
  assert.ok(csv.includes('5000'));
});

test('Collector & Staff Performance - generateStaffPerformancePrintHtml generates A4 statement and thermal slip', () => {
  const mockData = {
    selectedMonthLabel: 'October 2026',
    totalCollected: 10000,
    totalReceipts: 5,
    uniqueCustomers: 3,
    overallAverageTicket: 2000,
    cashTotal: 8500,
    digitalTotal: 1500,
    cashRatioPct: 85,
    digitalRatioPct: 15,
    activeCollectorsCount: 1,
    collectors: [
      {
        collectorName: 'Umair Field',
        category: 'Field Collector',
        totalCollected: 5000,
        receiptsCount: 2,
        uniqueCustomersCount: 2,
        averageTicket: 2500,
        cashAmount: 5000,
        cashSharePct: 100,
        digitalAmount: 0,
        digitalSharePct: 0,
        portfolioSharePct: 50,
        topArea: 'Bara Dari',
        tier: STAFF_PERFORMANCE_CONSTANTS.TIERS.STAR
      }
    ]
  };

  const a4Html = generateStaffPerformancePrintHtml(mockData, { format: 'a4' });
  assert.ok(a4Html.includes('SHAHDARA BROADBAND NETWORK'));
  assert.ok(a4Html.includes('Collector &amp; Staff Collection Performance Statement'));
  assert.ok(a4Html.includes('Umair Field'));
  assert.ok(a4Html.includes('Prepared By:'));

  const thermalHtml = generateStaffPerformancePrintHtml(mockData, { format: 'thermal' });
  assert.ok(thermalHtml.includes('SHAHDARA ISP BILLING'));
  assert.ok(thermalHtml.includes('STAFF &amp; COLLECTOR TILL REPORT'));
  assert.ok(thermalHtml.includes('Umair Field'));
  assert.ok(thermalHtml.includes('*** SHIFT AUDIT VERIFIED ***'));
});

test('Collector & Staff Performance - generateStaffPerformanceBriefing produces bilingual WhatsApp text', () => {
  const mockData = {
    selectedMonthLabel: 'October 2026',
    totalCollected: 10000,
    totalReceipts: 5,
    uniqueCustomers: 3,
    overallAverageTicket: 2000,
    cashRatioPct: 85,
    digitalRatioPct: 15,
    activeCollectorsCount: 1,
    topCollector: { collectorName: 'Umair Field', totalCollected: 5000 },
    collectors: [
      {
        collectorName: 'Umair Field',
        category: 'Field Collector',
        totalCollected: 5000,
        portfolioSharePct: 50,
        receiptsCount: 2,
        averageTicket: 2500,
        cashSharePct: 100,
        topArea: 'Bara Dari'
      }
    ]
  };

  const briefing = generateStaffPerformanceBriefing(mockData);
  assert.ok(briefing.includes('SHAHDARA ISP — COLLECTOR & STAFF PERFORMANCE'));
  assert.ok(briefing.includes('Umair Field'));
  assert.ok(briefing.includes('اردو خلاصہ'));
  assert.ok(briefing.includes('شاہدرہ انٹرنیٹ نیٹ ورک'));
});

test('Collector & Staff Performance - setupStaffPerformanceModal simulates interactive controller', () => {
  // Simple DOM simulation
  const mockElements = new Map();
  function getOrCreate(id) {
    if (!mockElements.has(id)) {
      mockElements.set(id, {
        id,
        listeners: {},
        innerHTML: '',
        textContent: '',
        value: '',
        options: [{ value: 'all', text: 'All' }],
        attributes: {},
        addEventListener(event, fn) {
          this.listeners[event] = this.listeners[event] || [];
          this.listeners[event].push(fn);
        },
        setAttribute(k, v) { this.attributes[k] = v; },
        getAttribute(k) { return this.attributes[k]; },
        removeAttribute(k) { delete this.attributes[k]; },
        showModal() { this.attributes.open = true; },
        close() { delete this.attributes.open; },
        querySelectorAll() { return []; }
      });
    }
    return mockElements.get(id);
  }

  const origDocument = globalThis.document;
  globalThis.document = {
    getElementById(id) {
      if (id === 'staffPerformanceModal' || id.startsWith('staffPerf') || id.startsWith('exportStaffPerf') || id.startsWith('printStaffPerf') || id.startsWith('shareStaffPerf') || id.startsWith('closeStaffPerf') || id === 'openStaffPerfModalBtn' || id === 'openStaffPerfFromClosingBtn') {
        return getOrCreate(id);
      }
      return null;
    },
    querySelectorAll() { return []; }
  };

  try {
    const mockState = {
      customers: [
        {
          id: 'c1',
          name: 'Tariq',
          customerNumber: 1,
          mohalla: 'Area 1',
          bills: [{ month: '2026-10', payments: [{ amount: 1500, date: '2026-10-01', method: 'Cash', paidBy: 'Asif' }] }]
        }
      ]
    };

    let toastMessage = '';
    const controller = setupStaffPerformanceModal(() => mockState, {
      onToast: msg => { toastMessage = msg; }
    });

    assert.ok(controller);
    assert.equal(typeof controller.open, 'function');
    assert.equal(typeof controller.close, 'function');
    assert.equal(typeof controller.refresh, 'function');
    assert.equal(typeof controller.getData, 'function');

    controller.open('2026-10');
    assert.equal(getOrCreate('staffPerformanceModal').attributes.open, true);

    const data = controller.getData();
    assert.equal(data.totalCollected, 1500);
    assert.equal(data.collectors.length, 1);
    assert.equal(data.collectors[0].collectorName, 'Asif');

    controller.close();
    assert.equal(getOrCreate('staffPerformanceModal').attributes.open, undefined);
  } finally {
    globalThis.document = origDocument;
  }
});
