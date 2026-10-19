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
  const drawer = page.locator('#navDrawer');
  const drawerToggle = page.locator('#navDrawerToggle');
  if (await drawer.isVisible()) {
    await page.locator(`#navDrawer [data-nav-target="${target}"]`).click();
  } else if (await drawerToggle.isVisible()) {
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
    // #293 made rows compact (~72px), so check that the first card is fully visible and that
    // the list itself still shows more than 150px of rows (at least two compact cards).
    const fit = await page.locator('#customerList > li').first().evaluate(li => {
      const r = li.getBoundingClientRect(); const l = li.parentElement.getBoundingClientRect();
      const top = Math.max(l.top, 0), bottom = Math.min(l.bottom, window.innerHeight);
      return { card: Math.min(r.bottom, bottom) - Math.max(r.top, top), height: r.height, list: bottom - top };
    });
    expect(fit.card).toBeGreaterThanOrEqual(fit.height - 1);
    expect(fit.height).toBeGreaterThan(40);
    expect(fit.list).toBeGreaterThan(150);
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

test.describe('Screen router layout fixes (#256, #257)', () => {
  test('#256 desktop Customers: full-width list, no misleading "ledger starts empty" pane', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Desktop layout');
    const errors = trackErrors(page);
    await page.goto('/#/customers');
    await expect(page.locator('#srScreenTitle')).toHaveText('Customers');
    await expect(page.locator('#detailPane')).toBeHidden();
    await expect(page.getByText('Your ledger starts empty')).toHaveCount(0);
    const listBox = await page.locator('#customerList').boundingBox();
    expect(listBox.width).toBeGreaterThan(900);
    const tops = await page.locator('#customerList > li').evaluateAll(lis => lis.slice(0, 3).map(li => Math.round(li.getBoundingClientRect().top)));
    expect(tops[1]).toBe(tops[0]); // several customers per row
    await inFirstScreen(page, page.locator('#customerList > li').nth(2));
    // Opening a customer brings back the list + ledger layout.
    await page.locator('#customerList > li').first().locator('.customer-select').click();
    await expect(page.locator('#customerDetail')).toBeVisible();
    await expect(page.locator('#detailPane')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('#257 mobile Expenses: compact filters, list first, form right under its heading', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Phone layout');
    const errors = trackErrors(page);
    await page.goto('/#/expenses');
    await expect(page.locator('#srPrimaryAction')).toHaveText('+ Add Expense');
    await inFirstScreen(page, page.locator('#srPrimaryAction'));
    const card = page.locator('#expensesView .table-card:has(#expenseForm)');
    const search = await card.locator('.table-filter-group.search-group').boundingBox();
    expect(search.height).toBeLessThan(120);
    const toolbar = await card.locator('.table-filter-toolbar').boundingBox();
    expect(toolbar.height).toBeLessThan(260);
    const heading = await card.locator('.table-heading').boundingBox();
    const form = await page.locator('#expenseForm').boundingBox();
    const table = await card.locator('.table-scroll').boundingBox();
    expect(table.y).toBeLessThan(heading.y); // list before the add form
    expect(form.y - (heading.y + heading.height)).toBeLessThan(40); // heading labels the form
    await expect(page.locator('#expensesEmpty')).toContainText('+ Add Expense');
    const empty = await page.locator('#expensesEmpty').boundingBox();
    expect(empty.y).toBeLessThan(heading.y);
    await page.locator('#srPrimaryAction').click();
    await expect(page.locator('#expenseForm')).toBeInViewport();
    expect(errors).toEqual([]);
  });
});
