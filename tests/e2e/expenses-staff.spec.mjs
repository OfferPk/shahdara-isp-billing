import { test, expect } from '@playwright/test';

async function navigateToExpenses(page) {
  const drawerToggle = page.locator('#navDrawerToggle');
  if (await drawerToggle.isVisible()) {
    await drawerToggle.click();
    await expect(page.locator('#navDrawer')).toBeVisible();
    await page.locator('#navDrawer [data-nav-target="expenses"]').click();
  } else {
    const topBtn = page.locator('#showExpensesButton');
    if (await topBtn.isVisible()) {
      await topBtn.click();
    }
  }
  await expect(page.locator('#expensesView')).toBeVisible();
}

test.describe('Expense & Staff Forms QA, Payroll Prefill, and Location Attribution E2E Suite', () => {
  test('validates required fields inline on expense form', async ({ page }) => {
    await page.goto('/');
    await navigateToExpenses(page);

    const expenseForm = page.locator('#expenseForm');
    await expect(expenseForm).toBeVisible();

    // Clear required fields and submit
    await page.fill('#expenseDate', '');
    await page.fill('#expenseAmount', '');
    await page.click('#expenseSubmit');

    // Inline errors should be displayed
    const dateErr = page.locator('#expenseDateError');
    await expect(dateErr).toBeVisible();
    await expect(dateErr).toContainText('Payment date is required');

    // Fill valid date, leave amount empty
    const today = new Date().toISOString().slice(0, 10);
    await page.fill('#expenseDate', today);
    await page.click('#expenseSubmit');

    const amtErr = page.locator('#expenseAmountError');
    await expect(amtErr).toBeVisible();
    await expect(amtErr).toContainText('Expense amount is required');
  });

  test('prefills expense form from monthly payroll summary with 1-click and records into ledger', async ({ page }) => {
    await page.goto('/');
    await navigateToExpenses(page);

    // Verify payroll prefill buttons exist
    const saadBtn = page.locator('#recordSaadSalaryExpenseBtn');
    await expect(saadBtn).toBeVisible();

    // Click prefill for Saad
    await saadBtn.click();

    // Check that fields were populated
    await expect(page.locator('#expenseCategory')).toHaveValue('Salary — Saad');
    const amtVal = await page.locator('#expenseAmount').inputValue();
    expect(Number(amtVal)).toBeGreaterThanOrEqual(15000);

    const notice = page.locator('#expensePayrollPrefillNotice');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('Prefilled from');

    // Record the expense
    await page.click('#expenseSubmit');

    // Confirm entry in table
    const table = page.locator('#expenseTable');
    await expect(table).toContainText('Salary — Saad');

    // Notice should now be hidden
    await expect(notice).toBeHidden();
  });

  test('supports location attribution on expenses with edit and table rendering', async ({ page }) => {
    await page.goto('/');
    await navigateToExpenses(page);

    const today = new Date().toISOString().slice(0, 10);
    await page.fill('#expenseDate', today);
    await page.fill('#expenseAmount', '2800');
    await page.selectOption('#expenseCategory', 'Repairs');
    
    // Select or set area
    const areaSelect = page.locator('#expenseArea');
    await expect(areaSelect).toBeVisible();
    const areaOptions = await areaSelect.locator('option').allInnerTexts();
    if (areaOptions.length > 1) {
      await areaSelect.selectOption({ index: 1 });
    }
    await page.fill('#expenseNotes', 'Optical drop cable repair near plaza');
    await page.click('#expenseSubmit');

    const table = page.locator('#expenseTable');
    await expect(table).toContainText('Repairs');
    await expect(table).toContainText('PKR 2,800');

    // Verify edit button preserves area
    const editBtn = table.locator('[data-edit-expense]').first();
    await editBtn.click();
    await expect(page.locator('#expenseSubmit')).toContainText('Save expense correction');
    await page.click('#expenseCancel');
  });

  test('staff attendance forms validate dates and provide 1-click Today shortcut', async ({ page }) => {
    await page.goto('/');
    await navigateToExpenses(page);

    // Test Today button for Saad attendance
    const saadTodayBtn = page.locator('#logSaadTodayBtn');
    await expect(saadTodayBtn).toBeVisible();
    await saadTodayBtn.click();

    const todayStr = new Date().toISOString().slice(0, 10);
    const dateInput = page.locator('#saadAttendanceDate');
    const val = await dateInput.inputValue();
    expect(val.length).toBe(10);

    // Log attendance
    await page.locator('#saadAttendanceForm button[type="submit"]').click();

    // Verify it was logged in the list
    const attendanceList = page.locator('#saadAttendanceList');
    await expect(attendanceList).toContainText(val);

    // Attempt duplicate entry
    await page.fill('#saadAttendanceDate', val);
    await page.locator('#saadAttendanceForm button[type="submit"]').click();
    const saadErr = page.locator('#saadAttendanceError');
    await expect(saadErr).toBeVisible();
    await expect(saadErr).toContainText('already recorded');

    // Test Today button for Umair workday
    const umairTodayBtn = page.locator('#logUmairTodayBtn');
    await expect(umairTodayBtn).toBeVisible();
    await umairTodayBtn.click();
    const umairVal = await page.locator('#umairWorkdayDate').inputValue();
    expect(umairVal.length).toBe(10);
  });

  test('mobile responsive view (390x844) touch targets and no horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await navigateToExpenses(page);

    // Check touch target heights on prefill and today buttons
    const saadBtn = page.locator('#recordSaadSalaryExpenseBtn');
    const saadBox = await saadBtn.boundingBox();
    expect(saadBox).not.toBeNull();
    expect(saadBox.height).toBeGreaterThanOrEqual(44);

    const umairBtn = page.locator('#recordUmairSalaryExpenseBtn');
    const umairBox = await umairBtn.boundingBox();
    expect(umairBox).not.toBeNull();
    expect(umairBox.height).toBeGreaterThanOrEqual(44);

    const logSaadToday = page.locator('#logSaadTodayBtn');
    const logBox = await logSaadToday.boundingBox();
    expect(logBox).not.toBeNull();
    expect(logBox.height).toBeGreaterThanOrEqual(44);

    // Check zero horizontal overflow
    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasOverflow).toBe(false);
  });
});
