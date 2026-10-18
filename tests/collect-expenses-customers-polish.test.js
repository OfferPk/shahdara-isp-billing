import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('Issue #255: updateNavigationBadges accurately reflects pending dues and decreases as payments are collected', async () => {
  const { updateNavigationBadges } = await import('../nav.js');
  const { createInitialState, saveBillMonth, addPayment } = await import('../core.js');

  let state = createInitialState();
  assert.equal(state.customers.length, 74);

  // Initially before setting bills, no dues
  let resInitial = updateNavigationBadges(state);
  assert.equal(resInitial.overdueCount, 0);

  // Set bills of PKR 1,000 for all 74 customers
  for (const c of state.customers) {
    state = saveBillMonth(state, c.id, { month: '2026-10', dueAmount: 1000, status: 'pending' });
  }

  // Set up mock DOM elements for badges
  const collectBadge = {
    textContent: '',
    hidden: true,
    classList: { toggle: (cls, active) => {} },
    setAttribute: (k, v) => {}
  };
  const origDoc = globalThis.document;
  globalThis.document = {
    querySelectorAll: (selector) => {
      if (selector.includes('collection') || selector.includes('dues')) {
        return [collectBadge];
      }
      return [];
    }
  };

  try {
    let res74 = updateNavigationBadges(state);
    assert.equal(res74.overdueCount, 74);
    assert.equal(collectBadge.textContent, '74');
    assert.equal(collectBadge.hidden, false);

    // Save payments for 3 customers
    for (let i = 0; i < 3; i++) {
      state = addPayment(state, state.customers[i].id, '2026-10', {
        amount: 1000,
        method: 'Cash',
        date: '2026-10-18'
      });
    }

    // Now update badges - overdueCount must drop to 71
    let res71 = updateNavigationBadges(state);
    assert.equal(res71.overdueCount, 71);
    assert.equal(collectBadge.textContent, '71');
    assert.equal(collectBadge.hidden, false);

    // If remaining 71 customers pay, overdueCount drops to 0 and badge hides
    for (let i = 3; i < 74; i++) {
      state = addPayment(state, state.customers[i].id, '2026-10', {
        amount: 1000,
        method: 'Cash',
        date: '2026-10-18'
      });
    }

    let res0 = updateNavigationBadges(state);
    assert.equal(res0.overdueCount, 0);
    assert.equal(collectBadge.textContent, '0');
    assert.equal(collectBadge.hidden, true);
  } finally {
    globalThis.document = origDoc;
  }
});

test('Issue #257: Expenses screen contains separated cards, Add Expense CTA, and responsive filter styles', () => {
  const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(rootDir, 'styles.css'), 'utf8');

  // Verify separated cards in index.html
  assert.ok(html.includes('id="addExpenseHeading"'), 'Contains Add Expense card heading');
  assert.ok(html.includes('id="recordedExpensesHeading"'), 'Contains Recorded Expenses card heading');
  assert.ok(html.includes('id="scrollToAddExpenseBtn"'), 'Contains + Add Expense button in empty state');

  // Verify form is in addExpense section and table is in recordedExpenses section
  const addExpenseIdx = html.indexOf('id="addExpenseHeading"');
  const formIdx = html.indexOf('id="expenseForm"');
  const recExpenseIdx = html.indexOf('id="recordedExpensesHeading"');
  const tableIdx = html.indexOf('id="expenseTable"');

  assert.ok(addExpenseIdx < formIdx, 'Heading precedes expenseForm');
  assert.ok(formIdx < recExpenseIdx, 'Form precedes recordedExpenses section');
  assert.ok(recExpenseIdx < tableIdx, 'Recorded expenses heading precedes table');

  // Verify responsive CSS removes 240px height gap on mobile
  assert.match(css, /\.table-filter-group\.search-group\s*\{[^}]*flex:\s*0\s+0\s+auto/);
  assert.match(css, /\.table-filter-group\.search-group\s*\{[^}]*width:\s*100%/);
});

test('Issue #256: Customers desktop view provides helpful prompt, live metrics, and spacious 390px column', () => {
  const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(rootDir, 'styles.css'), 'utf8');

  // Verify updated welcomeState copy
  assert.ok(!html.includes('Your ledger starts empty'), 'Eliminated misleading "Your ledger starts empty" banner');
  assert.ok(html.includes('Select a customer to view ledger'), 'Helpful select customer prompt present');
  assert.ok(html.includes('id="welcomeQuickStats"'), 'Contains welcome stats grid');
  assert.ok(html.includes('id="welcomePendingCount"'), 'Contains welcomePendingCount stat');
  assert.ok(html.includes('id="welcomeTotalDues"'), 'Contains welcomeTotalDues stat');

  // Verify desktop CSS wider layout
  assert.match(css, /grid-template-columns:\s*390px\s+minmax\(0,\s*1fr\)/);
  assert.match(css, /\.welcome-stats-grid/);
});
