// #212 step 1: every feature opens as its own screen at the top, primary action first.
import { test, expect } from '@playwright/test';

const SCREENS = {
  customers: { view: '#customersView', title: 'Customers', action: '+ Add Customer' },
  transactions: { view: '#transactionsView', title: 'Transactions', action: '+ Add Payment' },
  reports: { view: '#billingReportsView', title: 'Monthly Report', action: '+ Add Payment' },
  analytics: { view: '#analyticsView', title: 'Area Analytics', action: null },
  inventory: { view: '#inventoryView', title: 'Inventory', action: '+ Add Item', list: '#inventoryStockFilter' },
  expenses: { view: '#expensesView', title: 'Expenses', action: '+ Add Expense', list: '#expenseMonthFilter' }
};

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
}

async function openFromNav(page, target) {
  const drawerToggle = page.locator('#navDrawerToggle');
  if (await drawerToggle.isVisible()) {
    await drawerToggle.click();
    await page.locator(`#navDrawer [data-nav-target="${target}"]`).click();
  } else {
    await page.locator(`.view-nav-button`).filter({ hasText: new RegExp(SCREENS[target].title.split(' ')[0], 'i') }).first().click();
  }
}

async function inFirstScreen(page, locator) {
  const box = await locator.boundingBox();
  const vp = page.viewportSize();
  expect(box, 'element is rendered').not.toBeNull();
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeLessThan(vp.height);
}

async function expectScreen(page, name) {
  const spec = SCREENS[name];
  await expect(page).toHaveURL(new RegExp(`#/${name}$`));
  await expect(page.locator('#srScreenHeader')).toBeVisible();
  await expect(page.locator('#srScreenTitle')).toHaveText(spec.title);
  await expect(page.locator(spec.view)).toBeVisible();
  await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBeLessThan(5);
  expect(await page.locator('#billingDashboard').evaluate(el => el.getBoundingClientRect().height)).toBe(0);
  if (spec.action) {
    await expect(page.locator('#srPrimaryAction')).toHaveText(spec.action);
    await inFirstScreen(page, page.locator('#srPrimaryAction'));
  } else {
    await expect(page.locator('#srPrimaryAction')).toBeHidden();
  }
  await inFirstScreen(page, page.locator(`${spec.view}`));
  // The list (its filters) comes before the tall metric cards and the add form.
  if (spec.list) await inFirstScreen(page, page.locator(spec.list));
}

test.describe('Screen router (#212)', () => {
  test('every nav item opens its own screen at the top', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/');
    await expect(page.locator('#srScreenHeader')).toBeHidden();
    for (const name of Object.keys(SCREENS)) {
      await openFromNav(page, name);
      await expectScreen(page, name);
    }
    expect(errors).toEqual([]);
  });

  test('Customers: Add Customer, search and the list are on the first screen; Add Customer opens the form', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/');
    await openFromNav(page, 'customers');
    await expectScreen(page, 'customers');
    await inFirstScreen(page, page.locator('#customerListSearch'));
    await inFirstScreen(page, page.locator('#customerList > li').first());
    // The list must not be squeezed by the filter panel (desktop sticky pane): the first card is really visible.
    const visible = await page.locator('#customerList > li').first().evaluate(li => {
      const r = li.getBoundingClientRect(); const l = li.parentElement.getBoundingClientRect();
      return Math.min(r.bottom, l.bottom, window.innerHeight) - Math.max(r.top, l.top, 0);
    });
    expect(visible).toBeGreaterThan(150);
    await page.locator('#srPrimaryAction').click();
    await expect(page.locator('#addCustomerDialog')).toBeVisible();
    // Filters stay reachable: the "Filters & sort" button jumps to the panel below the list.
    await page.keyboard.press('Escape');
    await expect(page.locator('#addCustomerDialog')).toBeHidden();
    await page.locator('[data-sr-filters="customers"]').click();
    await expect(page.locator('.customer-filter-panel')).toBeInViewport();
    await expect(page.locator('#customerFilterArea')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('Transactions: Add Payment and the list are on the first screen; Add Payment opens Quick Collect', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/');
    await openFromNav(page, 'transactions');
    await expectScreen(page, 'transactions');
    const list = page.locator('#transactionsList:visible, #transactionsEmpty:visible').first();
    await inFirstScreen(page, list);
    await page.locator('#srPrimaryAction').click();
    await expect(page.locator('#quickCollectModal')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('Back/forward, Home button and deep links work', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/');
    await openFromNav(page, 'customers');
    await expectScreen(page, 'customers');
    await openFromNav(page, 'transactions');
    await expectScreen(page, 'transactions');
    await page.goBack();
    await expectScreen(page, 'customers');
    await page.goForward();
    await expectScreen(page, 'transactions');

    await page.locator('#srScreenHeader [data-sr-home]').click();
    await expect(page).toHaveURL(/#\/home$/);
    await expect(page.locator('#srScreenHeader')).toBeHidden();
    await expect(page.locator('#billingDashboard')).toBeVisible();
    await expect(page.locator('#quickActionReceivePayment')).toBeVisible();

    await page.goto('/#/expenses');
    await expectScreen(page, 'expenses');
    await page.reload();
    await expectScreen(page, 'expenses');
    expect(errors).toEqual([]);
  });

  test('Home tiles still work and route tiles open their screen', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/');
    await page.locator('#quickActionMonthlyReports').click();
    await expectScreen(page, 'reports');
    await page.locator('#srScreenHeader [data-sr-home]').click();
    await page.locator('#quickActionBillingCorrectness').click();
    await expect(page.locator('#billingCorrectnessModal')).toBeVisible();
    await page.locator('#closeBillingCorrectnessModalBtn').click();
    await page.locator('#quickActionAddCustomer').click();
    await expect(page.locator('#addCustomerDialog')).toBeVisible();
    expect(errors).toEqual([]);
  });
});
